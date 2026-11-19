// Suite de testes automatizados para as 15 regras críticas do Salão+
// Execução: npm test

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDbForTests } from '../lib/db/client.ts';
import { ensureSeeded } from '../lib/db/seed.ts';
import {
  BookingConflictError,
  BookingError,
  createBookingAtomic,
  getPublicAvailableSlots,
  rescheduleAppointmentAtomic,
  transitionAppointmentStatus,
} from '../lib/booking/engine.ts';
import { recordAppointmentPayment } from '../lib/finance/service.ts';
import { assertSalonIsolation, canAccessFinance, ForbiddenError } from '../lib/auth/rbac.ts';
import { addDays, getLuandaNow } from '../lib/utils/time.ts';

function getNextTuesday(): string {
  const now = getLuandaNow();
  for (let i = 2; i <= 14; i++) {
    const candidate = addDays(now.date, i);
    const dow = new Date(`${candidate}T12:00:00Z`).getUTCDay();
    if (dow === 2) return candidate; // Terça-feira: todas as profissionais trabalham
  }
  return addDays(now.date, 3);
}

function getNextSunday(): string {
  const now = getLuandaNow();
  for (let i = 1; i <= 14; i++) {
    const candidate = addDays(now.date, i);
    const dow = new Date(`${candidate}T12:00:00Z`).getUTCDay();
    if (dow === 0) return candidate;
  }
  return addDays(now.date, 7);
}

function getNextMonday(): string {
  const now = getLuandaNow();
  for (let i = 2; i <= 14; i++) {
    const candidate = addDays(now.date, i);
    const dow = new Date(`${candidate}T12:00:00Z`).getUTCDay();
    if (dow === 1) return candidate; // Segunda-feira: Carla Domingos (pro_2) está de folga
  }
  return addDays(now.date, 2);
}

describe('Salão+ Motor de Agendamentos & Regras Críticas', () => {
  beforeEach(() => {
    resetDbForTests(':memory:');
    ensureSeeded();
  });

  it('1 e 9. Duas clientes não conseguem reservar a mesma profissional no mesmo horário (concorrência)', async () => {
    const date = getNextTuesday();

    const attempts = await Promise.allSettled([
      Promise.resolve().then(() =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_manicure'], // 60m + 15m prep
          professionalId: 'pro_2',
          date,
          startTime: '10:00',
          customerName: 'Maria A',
          customerPhone: '+244 923 111 111',
        })
      ),
      Promise.resolve().then(() =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_manicure'],
          professionalId: 'pro_2',
          date,
          startTime: '10:00',
          customerName: 'Helena B',
          customerPhone: '+244 923 222 222',
        })
      ),
    ]);

    const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
    const rejected = attempts.filter((a) => a.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok((rejected[0] as PromiseRejectedResult).reason instanceof BookingConflictError);
  });

  it('2 e 3. Uma profissional não recebe marcações sobrepostas considerando duração + intervalo de preparação', () => {
    const date = getNextTuesday();

    // Manicure às 10:00 (60m) + 15m intervalo => ocupa até 11:15
    createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '10:00',
      customerName: 'Maria',
      customerPhone: '+244 923 300 301',
    });

    // Tentativa às 10:30 ou 11:00 deve falhar por sobreposição com 10:00-11:15
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_pedicure'],
          professionalId: 'pro_2',
          date,
          startTime: '10:30',
          customerName: 'Joana',
          customerPhone: '+244 923 300 302',
        }),
      BookingConflictError
    );

    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_pedicure'],
          professionalId: 'pro_2',
          date,
          startTime: '11:00',
          customerName: 'Joana',
          customerPhone: '+244 923 300 302',
        }),
      BookingConflictError
    );

    // Às 11:30 deve permitir (após o intervalo das 11:15)
    const ok = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_pedicure'],
      professionalId: 'pro_2',
      date,
      startTime: '11:30',
      customerName: 'Joana',
      customerPhone: '+244 923 300 302',
    });
    assert.equal(ok.appointment.startTime, '11:30');
  });

  it('4. Um serviço não pode ultrapassar o horário de funcionamento do salão', () => {
    const date = getNextTuesday(); // Salão fecha às 18:00

    // Tranças duram 120m: começar às 17:00 terminaria às 19:00 (> 18:00)
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_trancas'],
          professionalId: 'pro_1',
          date,
          startTime: '17:00',
          customerName: 'Paula',
          customerPhone: '+244 923 400 401',
        }),
      BookingError
    );

    // Domingo o salão está encerrado
    const sunday = getNextSunday();
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_corte'],
          professionalId: 'pro_1',
          date: sunday,
          startTime: '10:00',
          customerName: 'Paula',
          customerPhone: '+244 923 400 401',
        }),
      BookingError
    );
  });

  it('5. Uma profissional não recebe marcações durante a sua folga', () => {
    const monday = getNextMonday(); // pro_2 (Carla) folga à Segunda-feira
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_manicure'],
          professionalId: 'pro_2',
          date: monday,
          startTime: '10:00',
          customerName: 'Clara',
          customerPhone: '+244 923 500 501',
        }),
      BookingError
    );
  });

  it('6. Uma marcação não pode ocorrer num período bloqueado', () => {
    const date = getNextTuesday();
    const db = resetDbForTests(':memory:');
    ensureSeeded();

    db.prepare(
      `INSERT INTO blocked_time_slots (id, salon_id, professional_id, date, start_time, end_time, start_minutes, end_minutes, reason, block_type, created_at)
       VALUES ('blk_test', 'salon_luanda_1', 'pro_2', ?, '14:00', '16:00', 840, 960, 'Formação técnica', 'MEETING', datetime('now'))`
    ).run(date);

    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_manicure'],
          professionalId: 'pro_2',
          date,
          startTime: '14:30',
          customerName: 'Beatriz',
          customerPhone: '+244 923 600 601',
        }),
      BookingConflictError
    );
  });

  it('7. Uma marcação cancelada liberta o horário imediatamente', () => {
    const date = getNextTuesday();
    const first = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '10:00',
      customerName: 'Ana',
      customerPhone: '+244 923 700 701',
    });

    transitionAppointmentStatus({
      salonId: 'salon_luanda_1',
      appointmentId: first.appointment.id,
      nextStatus: 'CANCELLED',
      changedBy: 'OWNER',
      reason: 'Cancelamento teste',
    });

    const second = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '10:00',
      customerName: 'Sofia',
      customerPhone: '+244 923 700 702',
    });
    assert.equal(second.appointment.status, 'CONFIRMED');
  });

  it('8. Reagendamento verifica nova disponibilidade e preserva o horário anterior se houver conflito', () => {
    const date = getNextTuesday();

    const apptA = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '09:00',
      customerName: 'Cliente A',
      customerPhone: '+244 923 800 801',
    });

    // Ocupa 11:00-12:15
    createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '11:00',
      customerName: 'Cliente B',
      customerPhone: '+244 923 800 802',
    });

    // Tentar reagendar A para 11:00 deve falhar mantendo A às 09:00
    assert.throws(
      () =>
        rescheduleAppointmentAtomic({
          salonId: 'salon_luanda_1',
          appointmentId: apptA.appointment.id,
          newDate: date,
          newStartTime: '11:00',
          changedBy: 'OWNER',
        }),
      BookingConflictError
    );

    // Reagendar A para 14:30 deve funcionar e libertar 09:00
    const rescheduled = rescheduleAppointmentAtomic({
      salonId: 'salon_luanda_1',
      appointmentId: apptA.appointment.id,
      newDate: date,
      newStartTime: '14:30',
      changedBy: 'OWNER',
    });
    assert.equal(rescheduled.startTime, '14:30');
  });

  it('10. Uma profissional não consegue consultar informações financeiras sem autorização', () => {
    assert.equal(canAccessFinance('PROFESSIONAL'), false);
    assert.equal(canAccessFinance('OWNER'), true);
    assert.equal(canAccessFinance('RECEPTIONIST'), true);
  });

  it('11. Um salão não consegue consultar os dados de outro (isolamento multi-tenant)', () => {
    const ownerSalon1 = {
      id: 'user_owner_1',
      email: 'dona@luandaesthetique.ao',
      name: 'Miriam',
      phone: null,
      role: 'OWNER' as const,
      salonId: 'salon_luanda_1',
      professionalId: null,
    };

    assert.throws(() => assertSalonIsolation(ownerSalon1, 'salon_luanda_2'), ForbiddenError);
  });

  it('12 e 13. Marcações retroativas e fora da antecedência mínima/máxima são recusadas', () => {
    const now = getLuandaNow();
    const yesterday = addDays(now.date, -1);

    // Retroativa
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_corte'],
          professionalId: 'pro_1',
          date: yesterday,
          startTime: '10:00',
          customerName: 'Retro',
          customerPhone: '+244 923 900 901',
        }),
      BookingError
    );

    // Antecedência mínima (2h): simulando 09:00 tentando marcar para 10:00 no mesmo dia
    const tuesday = getNextTuesday();
    const fakeNineAm = new Date(`${tuesday}T09:00:00+01:00`);
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_corte'],
          professionalId: 'pro_1',
          date: tuesday,
          startTime: '10:00',
          customerName: 'Curto Prazo',
          customerPhone: '+244 923 900 902',
          nowOverride: fakeNineAm,
        }),
      BookingError
    );

    // Antecedência máxima (> 60 dias)
    const tooFar = addDays(now.date, 90);
    const avail = getPublicAvailableSlots({
      salonId: 'salon_luanda_1',
      date: tooFar,
      serviceIds: ['svc_corte'],
    });
    assert.equal(avail.slots.length, 0);
  });

  it('14. Pagamentos parciais não são confundidos com pagamentos concluídos', () => {
    const date = getNextTuesday();
    const booking = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'], // 8.500 Kz
      professionalId: 'pro_2',
      date,
      startTime: '10:00',
      customerName: 'Luciana',
      customerPhone: '+244 923 911 911',
    });

    const partial = recordAppointmentPayment({
      salonId: 'salon_luanda_1',
      appointmentId: booking.appointment.id,
      amountKz: 3000,
      method: 'MULTICAIXA_EXPRESS',
      recordedBy: 'user_recep_1',
    });
    assert.equal(partial.paymentStatus, 'PARTIAL');
    assert.equal(partial.appointmentPaidAmountKz, 3000);

    const complete = recordAppointmentPayment({
      salonId: 'salon_luanda_1',
      appointmentId: booking.appointment.id,
      amountKz: 5500,
      method: 'CASH',
      recordedBy: 'user_recep_1',
    });
    assert.equal(complete.paymentStatus, 'PAID');
    assert.equal(complete.appointmentPaidAmountKz, 8500);
  });

  it('15. A expiração de uma reserva temporária liberta o horário corretamente', () => {
    const date = getNextTuesday();
    const holdTime = new Date(`${addDays(date, -2)}T10:00:00Z`);

    const hold = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '10:00',
      customerName: 'Pré-Reserva',
      customerPhone: '+244 923 955 955',
      asPendingHold: true,
      nowOverride: holdTime,
    });

    assert.equal(hold.appointment.status, 'PENDING');

    // Antes de expirar (+2 min), bloqueia outra marcação
    const twoMinLater = new Date(holdTime.getTime() + 2 * 60 * 1000);
    assert.throws(
      () =>
        createBookingAtomic({
          salonId: 'salon_luanda_1',
          serviceIds: ['svc_manicure'],
          professionalId: 'pro_2',
          date,
          startTime: '10:00',
          customerName: 'Concorrente',
          customerPhone: '+244 923 955 956',
          nowOverride: twoMinLater,
        }),
      BookingConflictError
    );

    // Após expirar (+15 min), o horário é libertado automaticamente
    const fifteenMinLater = new Date(holdTime.getTime() + 15 * 60 * 1000);
    const afterExpiry = createBookingAtomic({
      salonId: 'salon_luanda_1',
      serviceIds: ['svc_manicure'],
      professionalId: 'pro_2',
      date,
      startTime: '10:00',
      customerName: 'Nova Cliente',
      customerPhone: '+244 923 955 957',
      nowOverride: fifteenMinLater,
    });
    assert.equal(afterExpiry.appointment.status, 'CONFIRMED');
  });
});
