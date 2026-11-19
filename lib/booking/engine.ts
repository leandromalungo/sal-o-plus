// Motor de Agendamentos do Salão+
// Implementa disponibilidade dinâmica, intervalos, antecedência, bloqueios,
// reagendamento seguro, expiração de reservas temporárias e proteção transacional contra concorrência.

import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getDb, runInTransaction } from '../db/client.ts';
import { ensureSeeded } from '../db/seed.ts';
import {
  addDays,
  diffDays,
  getDayOfWeekFromDateString,
  getLuandaNow,
  intervalsOverlap,
  luandaDateTimeToEpochMs,
  minutesToTime,
  normalizePhone,
  timeToMinutes,
} from '../utils/time.ts';
import type {
  Appointment,
  AppointmentStatus,
  AvailableSlot,
  Salon,
} from '../types/domain.ts';

export class BookingError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 422, code = 'BOOKING_VALIDATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class BookingConflictError extends BookingError {
  constructor(
    message = 'Este horário acabou de ser reservado. Por favor, escolha outro horário disponível.'
  ) {
    super(message, 409, 'BOOKING_CONFLICT');
  }
}

interface ServiceRow {
  id: string;
  salon_id: string;
  name: string;
  price_kz: number;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: number;
}

interface ProfessionalRow {
  id: string;
  salon_id: string;
  name: string;
  commission_rate: number;
  buffer_minutes_override: number | null;
  is_active: number;
}

interface SalonRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  slot_interval_minutes: number;
  min_advance_hours: number;
  max_advance_days: number;
  min_cancel_hours: number;
  pending_hold_minutes: number;
  allow_client_cancel: number;
  is_temporarily_closed: number;
  closure_reason: string | null;
  status: string;
}

/**
 * Liberta reservas temporárias (PENDING) cujo prazo expirou.
 */
export function releaseExpiredHolds(db: DatabaseSync, referenceIso: string = new Date().toISOString()): number {
  const expired = db
    .prepare(
      `SELECT id, salon_id, status FROM appointments
       WHERE status = 'PENDING'
         AND hold_expires_at IS NOT NULL
         AND hold_expires_at <= ?`
    )
    .all(referenceIso) as Array<{ id: string; salon_id: string; status: string }>;

  if (expired.length === 0) return 0;

  const updateStmt = db.prepare(
    `UPDATE appointments
     SET status = 'CANCELLED',
         cancellation_reason = 'Reserva temporária expirada automaticamente',
         updated_at = ?
     WHERE id = ?`
  );
  const histStmt = db.prepare(
    `INSERT INTO appointment_status_history (id, salon_id, appointment_id, from_status, to_status, changed_by, reason, created_at)
     VALUES (?, ?, ?, ?, 'CANCELLED', 'SYSTEM', 'Expiração automática da reserva temporária', ?)`
  );

  for (const row of expired) {
    updateStmt.run(referenceIso, row.id);
    histStmt.run(`hist_${crypto.randomUUID()}`, row.salon_id, row.id, row.status, referenceIso);
  }

  return expired.length;
}

function loadSalonOrThrow(db: DatabaseSync, salonId: string): SalonRow {
  const salon = db.prepare('SELECT * FROM salons WHERE id = ?').get(salonId) as SalonRow | undefined;
  if (!salon) {
    throw new BookingError('Estabelecimento não encontrado.', 404, 'SALON_NOT_FOUND');
  }
  if (salon.status !== 'ACTIVE') {
    throw new BookingError('Este estabelecimento não está ativo para marcações.', 403, 'SALON_INACTIVE');
  }
  return salon;
}

function computeServiceBundle(
  db: DatabaseSync,
  salonId: string,
  serviceIds: string[],
  allowInactiveForExisting = false
): {
  services: ServiceRow[];
  totalDuration: number;
  baseBuffer: number;
  totalPriceKz: number;
} {
  if (!serviceIds || serviceIds.length === 0) {
    throw new BookingError('Selecione pelo menos um serviço para continuar.', 422, 'NO_SERVICES');
  }

  const uniqueIds = Array.from(new Set(serviceIds));
  const placeholders = uniqueIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM services WHERE salon_id = ? AND id IN (${placeholders})`)
    .all(salonId, ...uniqueIds) as unknown as ServiceRow[];

  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: ServiceRow[] = [];

  for (const id of serviceIds) {
    const svc = byId.get(id);
    if (!svc) {
      throw new BookingError('Um dos serviços selecionados não existe neste salão.', 404, 'SERVICE_NOT_FOUND');
    }
    if (!allowInactiveForExisting && svc.is_active !== 1) {
      throw new BookingError(`O serviço "${svc.name}" está inativo e não aceita novas marcações.`, 422, 'SERVICE_INACTIVE');
    }
    ordered.push(svc);
  }

  const totalDuration = ordered.reduce((acc, s) => acc + s.duration_minutes, 0);
  // Intervalo adicional após o último serviço (ou máximo configurado entre os serviços)
  const baseBuffer = ordered.reduce((max, s) => Math.max(max, s.buffer_minutes || 0), 0);
  const totalPriceKz = ordered.reduce((acc, s) => acc + s.price_kz, 0);

  return { services: ordered, totalDuration, baseBuffer, totalPriceKz };
}

function getEffectiveSalonWindow(
  db: DatabaseSync,
  salon: SalonRow,
  date: string
): {
  isOpen: boolean;
  reason?: string;
  openMinutes: number;
  closeMinutes: number;
  breakStartMinutes: number | null;
  breakEndMinutes: number | null;
} {
  if (salon.is_temporarily_closed === 1) {
    return {
      isOpen: false,
      reason: salon.closure_reason || 'O salão encontra-se temporariamente encerrado.',
      openMinutes: 0,
      closeMinutes: 0,
      breakStartMinutes: null,
      breakEndMinutes: null,
    };
  }

  const holiday = db
    .prepare('SELECT * FROM holidays WHERE salon_id = ? AND date = ?')
    .get(salon.id, date) as
    | { id: string; name: string; is_closed: number; open_time: string | null; close_time: string | null }
    | undefined;

  if (holiday) {
    if (holiday.is_closed === 1) {
      return {
        isOpen: false,
        reason: `Encerrado (${holiday.name}).`,
        openMinutes: 0,
        closeMinutes: 0,
        breakStartMinutes: null,
        breakEndMinutes: null,
      };
    }
    if (holiday.open_time && holiday.close_time) {
      return {
        isOpen: true,
        openMinutes: timeToMinutes(holiday.open_time),
        closeMinutes: timeToMinutes(holiday.close_time),
        breakStartMinutes: null,
        breakEndMinutes: null,
      };
    }
  }

  const dow = getDayOfWeekFromDateString(date);
  const wh = db
    .prepare('SELECT * FROM salon_working_hours WHERE salon_id = ? AND day_of_week = ?')
    .get(salon.id, dow) as
    | {
        is_open: number;
        open_time: string;
        close_time: string;
        break_start: string | null;
        break_end: string | null;
      }
    | undefined;

  if (!wh || wh.is_open !== 1) {
    return {
      isOpen: false,
      reason: 'O salão não funciona neste dia da semana.',
      openMinutes: 0,
      closeMinutes: 0,
      breakStartMinutes: null,
      breakEndMinutes: null,
    };
  }

  return {
    isOpen: true,
    openMinutes: timeToMinutes(wh.open_time),
    closeMinutes: timeToMinutes(wh.close_time),
    breakStartMinutes: wh.break_start ? timeToMinutes(wh.break_start) : null,
    breakEndMinutes: wh.break_end ? timeToMinutes(wh.break_end) : null,
  };
}

function getQualifiedProfessionals(
  db: DatabaseSync,
  salonId: string,
  serviceIds: string[],
  professionalId?: string | 'any'
): ProfessionalRow[] {
  const uniqueServices = Array.from(new Set(serviceIds));
  const allPros =
    professionalId && professionalId !== 'any'
      ? (db
          .prepare('SELECT * FROM professionals WHERE salon_id = ? AND id = ? AND is_active = 1')
          .all(salonId, professionalId) as unknown as ProfessionalRow[])
      : (db
          .prepare('SELECT * FROM professionals WHERE salon_id = ? AND is_active = 1 ORDER BY name ASC')
          .all(salonId) as unknown as ProfessionalRow[]);

  if (allPros.length === 0) return [];

  const linkRows = db
    .prepare('SELECT professional_id, service_id FROM professional_services WHERE salon_id = ?')
    .all(salonId) as Array<{ professional_id: string; service_id: string }>;

  const servicesByPro = new Map<string, Set<string>>();
  for (const l of linkRows) {
    if (!servicesByPro.has(l.professional_id)) {
      servicesByPro.set(l.professional_id, new Set());
    }
    servicesByPro.get(l.professional_id)!.add(l.service_id);
  }

  return allPros.filter((pro) => {
    const allowed = servicesByPro.get(pro.id);
    if (!allowed) return false;
    return uniqueServices.every((sid) => allowed.has(sid));
  });
}

interface BusyCheckContext {
  pro: ProfessionalRow;
  effOpen: number;
  effClose: number;
  busyIntervals: Array<{ start: number; end: number; kind: 'BREAK' | 'BLOCK' | 'APPOINTMENT'; reason: string }>;
  totalBookedMinutes: number;
}

function buildProfessionalDayContext(
  db: DatabaseSync,
  salon: SalonRow,
  salonWindow: ReturnType<typeof getEffectiveSalonWindow>,
  pro: ProfessionalRow,
  date: string,
  nowIso: string,
  ignoreAppointmentId?: string
): BusyCheckContext | null {
  const dow = getDayOfWeekFromDateString(date);
  const pwh = db
    .prepare('SELECT * FROM professional_working_hours WHERE salon_id = ? AND professional_id = ? AND day_of_week = ?')
    .get(salon.id, pro.id, dow) as
    | {
        is_working: number;
        start_time: string;
        end_time: string;
        lunch_start: string | null;
        lunch_end: string | null;
      }
    | undefined;

  if (!pwh || pwh.is_working !== 1) {
    return null;
  }

  const proOpen = timeToMinutes(pwh.start_time);
  const proClose = timeToMinutes(pwh.end_time);
  const effOpen = Math.max(salonWindow.openMinutes, proOpen);
  const effClose = Math.min(salonWindow.closeMinutes, proClose);

  if (effOpen >= effClose) return null;

  const busyIntervals: BusyCheckContext['busyIntervals'] = [];

  if (salonWindow.breakStartMinutes !== null && salonWindow.breakEndMinutes !== null) {
    busyIntervals.push({
      start: salonWindow.breakStartMinutes,
      end: salonWindow.breakEndMinutes,
      kind: 'BREAK',
      reason: 'Pausa do salão',
    });
  }

  if (pwh.lunch_start && pwh.lunch_end) {
    busyIntervals.push({
      start: timeToMinutes(pwh.lunch_start),
      end: timeToMinutes(pwh.lunch_end),
      kind: 'BREAK',
      reason: 'Intervalo de almoço',
    });
  }

  const blocks = db
    .prepare(
      `SELECT start_minutes, end_minutes, reason FROM blocked_time_slots
       WHERE salon_id = ? AND date = ? AND (professional_id = ? OR professional_id IS NULL)`
    )
    .all(salon.id, date, pro.id) as Array<{ start_minutes: number; end_minutes: number; reason: string }>;

  for (const b of blocks) {
    busyIntervals.push({
      start: b.start_minutes,
      end: b.end_minutes,
      kind: 'BLOCK',
      reason: b.reason,
    });
  }

  const activeAppts = db
    .prepare(
      `SELECT id, start_minutes, end_minutes, status, hold_expires_at
       FROM appointments
       WHERE salon_id = ? AND professional_id = ? AND date = ?
         AND status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')`
    )
    .all(salon.id, pro.id, date) as Array<{
    id: string;
    start_minutes: number;
    end_minutes: number;
    status: AppointmentStatus;
    hold_expires_at: string | null;
  }>;

  let totalBookedMinutes = 0;
  for (const appt of activeAppts) {
    if (ignoreAppointmentId && appt.id === ignoreAppointmentId) continue;
    if (appt.status === 'PENDING' && appt.hold_expires_at && appt.hold_expires_at <= nowIso) {
      continue;
    }
    busyIntervals.push({
      start: appt.start_minutes,
      end: appt.end_minutes,
      kind: 'APPOINTMENT',
      reason: 'Horário já ocupado por outro atendimento',
    });
    totalBookedMinutes += appt.end_minutes - appt.start_minutes;
  }

  return {
    pro,
    effOpen,
    effClose,
    busyIntervals,
    totalBookedMinutes,
  };
}

export interface AvailabilityResult {
  date: string;
  salonClosedReason: string | null;
  totalDurationMinutes: number;
  totalPriceKz: number;
  slots: AvailableSlot[];
}

export function computeAvailableSlots(
  db: DatabaseSync,
  params: {
    salonId: string;
    date: string;
    serviceIds: string[];
    professionalId?: string | 'any';
    nowOverride?: Date;
    ignoreAppointmentId?: string;
    bypassMinAdvance?: boolean;
  }
): AvailabilityResult {
  const referenceDate = params.nowOverride ?? new Date();
  const now = getLuandaNow(referenceDate);
  releaseExpiredHolds(db, now.iso);

  const salon = loadSalonOrThrow(db, params.salonId);
  const bundle = computeServiceBundle(db, salon.id, params.serviceIds);

  // Não permitir datas passadas
  const dayDelta = diffDays(now.date, params.date);
  if (dayDelta < 0) {
    return {
      date: params.date,
      salonClosedReason: 'Não é possível agendar em datas passadas.',
      totalDurationMinutes: bundle.totalDuration,
      totalPriceKz: bundle.totalPriceKz,
      slots: [],
    };
  }

  // Limite máximo de antecedência
  if (dayDelta > salon.max_advance_days) {
    return {
      date: params.date,
      salonClosedReason: `Marcações disponíveis apenas até ${salon.max_advance_days} dias de antecedência.`,
      totalDurationMinutes: bundle.totalDuration,
      totalPriceKz: bundle.totalPriceKz,
      slots: [],
    };
  }

  const salonWindow = getEffectiveSalonWindow(db, salon, params.date);
  if (!salonWindow.isOpen) {
    return {
      date: params.date,
      salonClosedReason: salonWindow.reason || 'Salão encerrado nesta data.',
      totalDurationMinutes: bundle.totalDuration,
      totalPriceKz: bundle.totalPriceKz,
      slots: [],
    };
  }

  const qualifiedPros = getQualifiedProfessionals(db, salon.id, params.serviceIds, params.professionalId);
  if (qualifiedPros.length === 0) {
    return {
      date: params.date,
      salonClosedReason: 'Nenhuma profissional disponível está habilitada para todos os serviços selecionados.',
      totalDurationMinutes: bundle.totalDuration,
      totalPriceKz: bundle.totalPriceKz,
      slots: [],
    };
  }

  const contexts = qualifiedPros
    .map((pro) =>
      buildProfessionalDayContext(db, salon, salonWindow, pro, params.date, now.iso, params.ignoreAppointmentId)
    )
    .filter((ctx): ctx is BusyCheckContext => ctx !== null);

  if (contexts.length === 0) {
    return {
      date: params.date,
      salonClosedReason: 'Sem profissionais de serviço disponíveis nesta data.',
      totalDurationMinutes: bundle.totalDuration,
      totalPriceKz: bundle.totalPriceKz,
      slots: [],
    };
  }

  const step = Math.max(5, salon.slot_interval_minutes || 30);
  const nowEpochMs = referenceDate.getTime();
  const minAdvanceMs = params.bypassMinAdvance ? 0 : salon.min_advance_hours * 60 * 60 * 1000;

  const slots: AvailableSlot[] = [];

  for (let startMin = salonWindow.openMinutes; startMin < salonWindow.closeMinutes; startMin += step) {
    const startTimeStr = minutesToTime(startMin);
    const slotEpochMs = luandaDateTimeToEpochMs(params.date, startTimeStr);

    // Recusa retroativos e fora da antecedência mínima
    if (slotEpochMs < nowEpochMs) continue;
    if (slotEpochMs < nowEpochMs + minAdvanceMs) continue;

    const serviceEndMin = startMin + bundle.totalDuration;
    const availablePros: BusyCheckContext[] = [];

    for (const ctx of contexts) {
      const effectiveBuffer =
        ctx.pro.buffer_minutes_override !== null
          ? ctx.pro.buffer_minutes_override
          : bundle.baseBuffer;
      const blockedEndMin = serviceEndMin + effectiveBuffer;

      // Deve começar e terminar dentro do expediente simultâneo do salão e da profissional
      if (startMin < ctx.effOpen || serviceEndMin > ctx.effClose) continue;

      const hasConflict = ctx.busyIntervals.some((busy) =>
        intervalsOverlap(startMin, blockedEndMin, busy.start, busy.end)
      );

      if (!hasConflict) {
        availablePros.push(ctx);
      }
    }

    if (availablePros.length > 0) {
      // Escolhe a profissional menos ocupada do dia como recomendada
      availablePros.sort((a, b) => a.totalBookedMinutes - b.totalBookedMinutes);
      const chosen = availablePros[0];
      const chosenBuffer =
        chosen.pro.buffer_minutes_override !== null
          ? chosen.pro.buffer_minutes_override
          : bundle.baseBuffer;

      slots.push({
        time: startTimeStr,
        endTime: minutesToTime(serviceEndMin),
        blockedUntil: minutesToTime(serviceEndMin + chosenBuffer),
        availableProfessionalIds: availablePros.map((c) => c.pro.id),
        recommendedProfessionalId: chosen.pro.id,
      });
    }
  }

  return {
    date: params.date,
    salonClosedReason: null,
    totalDurationMinutes: bundle.totalDuration,
    totalPriceKz: bundle.totalPriceKz,
    slots,
  };
}

export function getPublicAvailableSlots(params: {
  salonId: string;
  date: string;
  serviceIds: string[];
  professionalId?: string | 'any';
  nowOverride?: Date;
}): AvailabilityResult {
  ensureSeeded();
  const db = getDb();
  return computeAvailableSlots(db, params);
}

export interface CreateBookingInput {
  salonId: string;
  serviceIds: string[];
  professionalId: string | 'any';
  date: string;
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  notes?: string | null;
  source?: 'PUBLIC' | 'MANAGEMENT';
  asPendingHold?: boolean;
  actorUserId?: string | null;
  nowOverride?: Date;
  bypassMinAdvance?: boolean;
}

export function createBookingAtomic(input: CreateBookingInput): {
  appointment: Appointment;
  professionalName: string;
  customerName: string;
} {
  ensureSeeded();

  if (!input.customerName?.trim() || !input.customerPhone?.trim()) {
    throw new BookingError('Nome e número de telefone da cliente são obrigatórios.', 422, 'INVALID_CUSTOMER');
  }

  return runInTransaction((db) => {
    const referenceDate = input.nowOverride ?? new Date();
    const now = getLuandaNow(referenceDate);
    releaseExpiredHolds(db, now.iso);

    const salon = loadSalonOrThrow(db, input.salonId);
    const bundle = computeServiceBundle(db, salon.id, input.serviceIds);

    const startMin = timeToMinutes(input.startTime);
    const dayDelta = diffDays(now.date, input.date);
    const slotEpochMs = luandaDateTimeToEpochMs(input.date, input.startTime);
    const nowEpochMs = referenceDate.getTime();

    if (dayDelta < 0 || slotEpochMs < nowEpochMs) {
      throw new BookingError('Não são permitidas marcações retroativas no passado.', 422, 'RETROACTIVE_BOOKING');
    }

    if (!input.bypassMinAdvance) {
      const minAdvanceMs = salon.min_advance_hours * 60 * 60 * 1000;
      if (slotEpochMs < nowEpochMs + minAdvanceMs) {
        throw new BookingError(
          `Este salão exige uma antecedência mínima de ${salon.min_advance_hours}h para marcações.`,
          422,
          'MIN_ADVANCE_VIOLATION'
        );
      }
    }

    if (dayDelta > salon.max_advance_days) {
      throw new BookingError(
        `Marcações só podem ser feitas com até ${salon.max_advance_days} dias de antecedência.`,
        422,
        'MAX_ADVANCE_VIOLATION'
      );
    }

    const salonWindow = getEffectiveSalonWindow(db, salon, input.date);
    if (!salonWindow.isOpen) {
      throw new BookingError(salonWindow.reason || 'O salão está encerrado nesta data.', 422, 'SALON_CLOSED');
    }

    const qualifiedPros = getQualifiedProfessionals(db, salon.id, input.serviceIds, input.professionalId);
    if (qualifiedPros.length === 0) {
      throw new BookingError(
        'A profissional selecionada não está disponível ou não realiza todos os serviços escolhidos.',
        422,
        'PROFESSIONAL_UNQUALIFIED'
      );
    }

    const serviceEndMin = startMin + bundle.totalDuration;
    let chosenPro: ProfessionalRow | null = null;
    let chosenBlockedEndMin = serviceEndMin;
    let chosenBuffer = bundle.baseBuffer;
    let failureReason: { message: string; isConflict: boolean } | null = null;

    const candidateContexts: Array<{ ctx: BusyCheckContext; buffer: number; blockedEnd: number }> = [];

    for (const pro of qualifiedPros) {
      const ctx = buildProfessionalDayContext(db, salon, salonWindow, pro, input.date, now.iso);
      if (!ctx) {
        failureReason = { message: 'A profissional está de folga ou fora do seu turno nesta data.', isConflict: false };
        continue;
      }

      const effectiveBuffer =
        pro.buffer_minutes_override !== null ? pro.buffer_minutes_override : bundle.baseBuffer;
      const blockedEndMin = serviceEndMin + effectiveBuffer;

      if (startMin < ctx.effOpen || serviceEndMin > ctx.effClose) {
        failureReason = {
          message: 'O atendimento ultrapassa o horário de funcionamento do salão ou o turno da profissional.',
          isConflict: false,
        };
        continue;
      }

      const conflict = ctx.busyIntervals.find((b) => intervalsOverlap(startMin, blockedEndMin, b.start, b.end));
      if (conflict) {
        if (conflict.kind === 'APPOINTMENT') {
          failureReason = {
            message: 'Este horário acabou de ser reservado. Por favor, escolha outro horário disponível.',
            isConflict: true,
          };
        } else if (conflict.kind === 'BLOCK') {
          failureReason = {
            message: `Horário bloqueado na agenda (${conflict.reason}).`,
            isConflict: true,
          };
        } else {
          failureReason = {
            message: `Horário indisponível devido a pausa (${conflict.reason}).`,
            isConflict: false,
          };
        }
        continue;
      }

      candidateContexts.push({ ctx, buffer: effectiveBuffer, blockedEnd: blockedEndMin });
    }

    if (candidateContexts.length === 0) {
      if (failureReason?.isConflict) {
        throw new BookingConflictError(failureReason.message);
      }
      throw new BookingError(
        failureReason?.message || 'Horário indisponível para esta seleção.',
        422,
        'SLOT_UNAVAILABLE'
      );
    }

    candidateContexts.sort((a, b) => a.ctx.totalBookedMinutes - b.ctx.totalBookedMinutes);
    chosenPro = candidateContexts[0].ctx.pro;
    chosenBuffer = candidateContexts[0].buffer;
    chosenBlockedEndMin = candidateContexts[0].blockedEnd;

    // Deduplicação de cliente pelo telefone normalizado no mesmo salão
    const normalized = normalizePhone(input.customerPhone);
    let customer = db
      .prepare('SELECT id, name FROM customers WHERE salon_id = ? AND normalized_phone = ?')
      .get(salon.id, normalized) as { id: string; name: string } | undefined;

    if (!customer) {
      const custId = `cust_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO customers (id, salon_id, name, phone, normalized_phone, email, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        custId,
        salon.id,
        input.customerName.trim(),
        input.customerPhone.trim(),
        normalized,
        input.customerEmail?.trim() || null,
        now.iso
      );
      customer = { id: custId, name: input.customerName.trim() };
    } else if (input.customerEmail?.trim()) {
      db.prepare('UPDATE customers SET email = COALESCE(email, ?) WHERE id = ?').run(
        input.customerEmail.trim(),
        customer.id
      );
    }

    const apptId = `appt_${crypto.randomUUID()}`;
    const bookingCode = `SL-${Math.floor(1000 + Math.random() * 9000)}-${apptId.slice(-3).toUpperCase()}`;
    const status: AppointmentStatus = input.asPendingHold ? 'PENDING' : 'CONFIRMED';
    const holdExpiresAt = input.asPendingHold
      ? new Date(referenceDate.getTime() + (salon.pending_hold_minutes || 10) * 60 * 1000).toISOString()
      : null;

    const startTimeStr = minutesToTime(startMin);
    const serviceEndTimeStr = minutesToTime(serviceEndMin);
    const endTimeStr = minutesToTime(chosenBlockedEndMin);

    try {
      db.prepare(
        `INSERT INTO appointments (
          id, salon_id, booking_code, customer_id, professional_id,
          date, start_time, end_time, service_end_time,
          start_minutes, end_minutes, total_duration_minutes, total_buffer_minutes,
          total_price_kz, paid_amount_kz, payment_status, status,
          hold_expires_at, notes, cancellation_reason, created_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', ?, ?, ?, NULL, ?, ?, ?)`
      ).run(
        apptId,
        salon.id,
        bookingCode,
        customer.id,
        chosenPro.id,
        input.date,
        startTimeStr,
        endTimeStr,
        serviceEndTimeStr,
        startMin,
        chosenBlockedEndMin,
        bundle.totalDuration,
        chosenBuffer,
        bundle.totalPriceKz,
        status,
        holdExpiresAt,
        input.notes?.trim() || null,
        input.source ?? 'PUBLIC',
        now.iso,
        now.iso
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('OVERLAPPING_APPOINTMENT')) {
        throw new BookingConflictError();
      }
      throw err;
    }

    // Snapshot dos serviços no momento da reserva (preserva preço e duração históricos)
    const insertSvcStmt = db.prepare(
      `INSERT INTO appointment_services (id, appointment_id, service_id, service_name, price_kz, duration_minutes, buffer_minutes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    bundle.services.forEach((svc, idx) => {
      insertSvcStmt.run(
        `as_${crypto.randomUUID()}`,
        apptId,
        svc.id,
        svc.name,
        svc.price_kz,
        svc.duration_minutes,
        svc.buffer_minutes,
        idx
      );
    });

    db.prepare(
      `INSERT INTO appointment_status_history (id, salon_id, appointment_id, from_status, to_status, changed_by, reason, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`
    ).run(
      `hist_${crypto.randomUUID()}`,
      salon.id,
      apptId,
      status,
      input.actorUserId ?? customer.id,
      input.asPendingHold ? 'Reserva temporária iniciada' : 'Marcação criada e confirmada',
      now.iso
    );

    // Notificação desacoplada na fila interna
    db.prepare(
      `INSERT INTO notifications (id, salon_id, appointment_id, channel, event_type, recipient, message, status, scheduled_for, created_at)
       VALUES (?, ?, ?, 'WHATSAPP', ?, ?, ?, 'QUEUED', ?, ?)`
    ).run(
      `notif_${crypto.randomUUID()}`,
      salon.id,
      apptId,
      status === 'PENDING' ? 'BOOKING_PENDING' : 'BOOKING_CONFIRMED',
      input.customerPhone.trim(),
      `Olá ${customer.name}! Marcação ${bookingCode} em ${salon.name} para ${input.date} às ${startTimeStr} com ${chosenPro.name}.`,
      input.date,
      now.iso
    );

    const createdRow = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId) as Record<string, unknown>;
    return {
      appointment: mapAppointmentRow(createdRow),
      professionalName: chosenPro.name,
      customerName: customer.name,
    };
  });
}

export function rescheduleAppointmentAtomic(input: {
  salonId: string;
  appointmentId: string;
  newDate: string;
  newStartTime: string;
  newProfessionalId?: string;
  changedBy: string;
  reason?: string;
  nowOverride?: Date;
  bypassMinAdvance?: boolean;
}): Appointment {
  ensureSeeded();

  return runInTransaction((db) => {
    const referenceDate = input.nowOverride ?? new Date();
    const now = getLuandaNow(referenceDate);
    releaseExpiredHolds(db, now.iso);

    const existing = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND salon_id = ?')
      .get(input.appointmentId, input.salonId) as Record<string, unknown> | undefined;

    if (!existing) {
      throw new BookingError('Marcação não encontrada neste estabelecimento.', 404, 'APPOINTMENT_NOT_FOUND');
    }

    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
      throw new BookingError('Não é possível reagendar uma marcação concluída ou cancelada.', 422, 'INVALID_STATE');
    }

    const serviceRows = db
      .prepare('SELECT service_id, duration_minutes, buffer_minutes FROM appointment_services WHERE appointment_id = ? ORDER BY sort_order ASC')
      .all(input.appointmentId) as Array<{ service_id: string; duration_minutes: number; buffer_minutes: number }>;

    const serviceIds = serviceRows.map((s) => s.service_id);
    const targetProId = input.newProfessionalId || String(existing.professional_id);

    // Verifica disponibilidade do novo horário ANTES de libertar/atualizar o antigo
    const availability = computeAvailableSlots(db, {
      salonId: input.salonId,
      date: input.newDate,
      serviceIds,
      professionalId: targetProId,
      nowOverride: referenceDate,
      ignoreAppointmentId: input.appointmentId,
      bypassMinAdvance: input.bypassMinAdvance,
    });

    if (availability.salonClosedReason) {
      throw new BookingError(availability.salonClosedReason, 422, 'RESCHEDULE_CLOSED');
    }

    const matchingSlot = availability.slots.find((s) => s.time === input.newStartTime);
    if (!matchingSlot) {
      throw new BookingConflictError('O novo horário selecionado não está disponível para reagendamento.');
    }

    const assignedProId =
      targetProId === 'any' ? matchingSlot.recommendedProfessionalId : targetProId;
    const startMin = timeToMinutes(input.newStartTime);
    const endMin = timeToMinutes(matchingSlot.blockedUntil);

    try {
      db.prepare(
        `UPDATE appointments
         SET professional_id = ?, date = ?, start_time = ?, end_time = ?, service_end_time = ?,
             start_minutes = ?, end_minutes = ?, updated_at = ?
         WHERE id = ? AND salon_id = ?`
      ).run(
        assignedProId,
        input.newDate,
        input.newStartTime,
        matchingSlot.blockedUntil,
        matchingSlot.endTime,
        startMin,
        endMin,
        now.iso,
        input.appointmentId,
        input.salonId
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('OVERLAPPING_APPOINTMENT')) {
        throw new BookingConflictError();
      }
      throw err;
    }

    db.prepare(
      `INSERT INTO appointment_status_history (
        id, salon_id, appointment_id, from_status, to_status, changed_by, reason, previous_date, previous_start_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `hist_${crypto.randomUUID()}`,
      input.salonId,
      input.appointmentId,
      String(existing.status),
      String(existing.status),
      input.changedBy,
      input.reason || 'Reagendamento confirmado',
      String(existing.date),
      String(existing.start_time),
      now.iso
    );

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(input.appointmentId) as Record<string, unknown>;
    return mapAppointmentRow(updated);
  });
}

export function transitionAppointmentStatus(input: {
  salonId: string;
  appointmentId: string;
  nextStatus: AppointmentStatus;
  changedBy: string;
  reason?: string;
  isClientAction?: boolean;
  nowOverride?: Date;
}): Appointment {
  ensureSeeded();

  return runInTransaction((db) => {
    const referenceDate = input.nowOverride ?? new Date();
    const now = getLuandaNow(referenceDate);

    const salon = loadSalonOrThrow(db, input.salonId);
    const existing = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND salon_id = ?')
      .get(input.appointmentId, input.salonId) as Record<string, unknown> | undefined;

    if (!existing) {
      throw new BookingError('Marcação não encontrada.', 404, 'APPOINTMENT_NOT_FOUND');
    }

    const currentStatus = String(existing.status) as AppointmentStatus;

    if (input.isClientAction && input.nextStatus === 'CANCELLED') {
      if (salon.allow_client_cancel !== 1) {
        throw new BookingError('Este salão não permite cancelamento direto pela cliente.', 403, 'CANCEL_DISABLED');
      }
      const apptStartMs = luandaDateTimeToEpochMs(String(existing.date), String(existing.start_time));
      const minCancelMs = salon.min_cancel_hours * 60 * 60 * 1000;
      if (apptStartMs - referenceDate.getTime() < minCancelMs) {
        throw new BookingError(
          `Cancelamentos pela cliente só são permitidos com pelo menos ${salon.min_cancel_hours}h de antecedência.`,
          422,
          'CANCEL_TOO_LATE'
        );
      }
    }

    db.prepare(
      `UPDATE appointments
       SET status = ?,
           hold_expires_at = CASE WHEN ? = 'CONFIRMED' THEN NULL ELSE hold_expires_at END,
           cancellation_reason = CASE WHEN ? = 'CANCELLED' THEN ? ELSE cancellation_reason END,
           updated_at = ?
       WHERE id = ? AND salon_id = ?`
    ).run(
      input.nextStatus,
      input.nextStatus,
      input.nextStatus,
      input.reason || null,
      now.iso,
      input.appointmentId,
      input.salonId
    );

    db.prepare(
      `INSERT INTO appointment_status_history (id, salon_id, appointment_id, from_status, to_status, changed_by, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `hist_${crypto.randomUUID()}`,
      input.salonId,
      input.appointmentId,
      currentStatus,
      input.nextStatus,
      input.changedBy,
      input.reason || null,
      now.iso
    );

    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(input.appointmentId) as Record<string, unknown>;
    return mapAppointmentRow(updated);
  });
}

export function mapAppointmentRow(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    salonId: String(row.salon_id),
    bookingCode: String(row.booking_code),
    customerId: String(row.customer_id),
    professionalId: String(row.professional_id),
    date: String(row.date),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    serviceEndTime: String(row.service_end_time),
    startMinutes: Number(row.start_minutes),
    endMinutes: Number(row.end_minutes),
    totalDurationMinutes: Number(row.total_duration_minutes),
    totalBufferMinutes: Number(row.total_buffer_minutes),
    totalPriceKz: Number(row.total_price_kz),
    paidAmountKz: Number(row.paid_amount_kz),
    paymentStatus: String(row.payment_status) as Appointment['paymentStatus'],
    status: String(row.status) as AppointmentStatus,
    holdExpiresAt: row.hold_expires_at ? String(row.hold_expires_at) : null,
    notes: row.notes ? String(row.notes) : null,
    cancellationReason: row.cancellation_reason ? String(row.cancellation_reason) : null,
    createdSource: String(row.created_source) as Appointment['createdSource'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function getPublicSalonBySlug(slug: string): Salon | null {
  ensureSeeded();
  const db = getDb();
  const row = db.prepare('SELECT * FROM salons WHERE slug = ?').get(slug) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapSalonRow(row);
}

export function mapSalonRow(row: Record<string, unknown>): Salon {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description || ''),
    address: String(row.address || ''),
    city: String(row.city || 'Luanda'),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    coverUrl: row.cover_url ? String(row.cover_url) : null,
    timezone: String(row.timezone || 'Africa/Luanda'),
    currency: String(row.currency || 'AOA'),
    slotIntervalMinutes: Number(row.slot_interval_minutes),
    minAdvanceHours: Number(row.min_advance_hours),
    maxAdvanceDays: Number(row.max_advance_days),
    minCancelHours: Number(row.min_cancel_hours),
    pendingHoldMinutes: Number(row.pending_hold_minutes),
    allowClientCancel: Number(row.allow_client_cancel) === 1,
    isTemporarilyClosed: Number(row.is_temporarily_closed) === 1,
    closureReason: row.closure_reason ? String(row.closure_reason) : null,
    status: String(row.status) as Salon['status'],
    planName: String(row.plan_name || 'Profissional'),
    createdAt: String(row.created_at),
  };
}

export function getSuggestedOpenDate(salonId: string, nowOverride?: Date): string {
  ensureSeeded();
  const db = getDb();
  const salon = loadSalonOrThrow(db, salonId);
  const now = getLuandaNow(nowOverride);
  for (let offset = 0; offset <= 14; offset++) {
    const candidate = addDays(now.date, offset);
    const win = getEffectiveSalonWindow(db, salon, candidate);
    if (win.isOpen) return candidate;
  }
  return now.date;
}
