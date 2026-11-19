'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import {
  Ban,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  addDays,
  formatDatePt,
  formatKz,
  getDayOfWeekFromDateString,
  getLuandaNow,
} from '@/lib/utils/time';
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/types/domain';

interface ApptRow {
  id: string;
  booking_code: string;
  date: string;
  start_time: string;
  end_time: string;
  service_end_time: string;
  start_minutes: number;
  total_duration_minutes: number;
  total_buffer_minutes: number;
  total_price_kz: number;
  paid_amount_kz: number;
  payment_status: string;
  status: AppointmentStatus;
  customer_name: string;
  customer_phone: string;
  professional_id: string;
  professional_name: string;
  notes: string | null;
  services: Array<{
    service_id: string;
    service_name: string;
    price_kz: number;
    duration_minutes: number;
  }>;
  history: Array<{
    from_status: string | null;
    to_status: string;
    changed_by: string | null;
    reason: string | null;
    previous_date: string | null;
    previous_start_time: string | null;
    created_at: string;
  }>;
}

interface BlockRow {
  id: string;
  professional_id: string | null;
  professional_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
  block_type: string;
}

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 20;
const HOUR_HEIGHT = 64;
const SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

function getWeekMonday(dateStr: string): string {
  const dow = getDayOfWeekFromDateString(dateStr);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, offset);
}

function formatWeekTitle(monday: string, sunday: string): string {
  const [y1, m1, d1] = monday.split('-').map(Number);
  const [, m2, d2] = sunday.split('-').map(Number);
  if (m1 === m2) {
    return `${String(d1).padStart(2, '0')}–${String(d2).padStart(2, '0')} ${MONTH_NAMES[m1 - 1]} ${y1}`;
  }
  return `${String(d1).padStart(2, '0')} ${MONTH_NAMES[m1 - 1].slice(0, 3)} – ${String(d2).padStart(2, '0')} ${MONTH_NAMES[m2 - 1].slice(0, 3)} ${y1}`;
}

function getPastelEventStyle(status: AppointmentStatus) {
  switch (status) {
    case 'IN_PROGRESS':
      return 'bg-[#EBE5FF] border-[#D2C3FF] text-[#352375]';
    case 'CONFIRMED':
      return 'bg-[#DCF0FF] border-[#B6E0FF] text-[#14446B]';
    case 'COMPLETED':
      return 'bg-[#D8F5E3] border-[#AFECC7] text-[#12532E]';
    case 'PENDING':
      return 'bg-[#FCEFD9] border-[#F2D5A7] text-[#5C3A0E]';
    default:
      return 'bg-zinc-100 border-zinc-200 text-zinc-600';
  }
}

export default function AgendaPage() {
  const luandaNow = useMemo(() => getLuandaNow(), []);

  const [appointments, setAppointments] = useState<ApptRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [services, setServices] = useState<
    Array<{ id: string; name: string; price_kz: number; duration_minutes: number }>
  >([]);
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [weekAnchorDate, setWeekAnchorDate] = useState<string>(luandaNow.date);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const [selectedAppt, setSelectedAppt] = useState<ApptRow | null>(null);

  // Modal Nova Marcação
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    serviceId: '',
    professionalId: 'any',
    date: luandaNow.date,
    startTime: '10:00',
    customerName: '',
    customerPhone: '',
    notes: '',
    bypassMinAdvance: true,
  });

  // Modal Bloqueio
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    professionalId: 'ALL',
    date: luandaNow.date,
    startTime: '12:00',
    endTime: '13:00',
    blockType: 'MEETING',
    reason: 'Reunião interna',
  });

  // Modal Reagendamento
  const [rescheduleTarget, setRescheduleTarget] = useState<ApptRow | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: '',
    newStartTime: '10:00',
    newProfessionalId: '',
    reason: 'Ajuste de agenda solicitado',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlDate = params.get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      setWeekAnchorDate(urlDate);
      setNewForm((f) => ({ ...f, date: urlDate }));
    }
    if (params.get('new') === '1') {
      setShowNewModal(true);
    }
  }, []);

  const weekDays = useMemo(() => {
    const monday = getWeekMonday(weekAnchorDate);
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return {
        date,
        dayNum: Number(date.slice(8, 10)),
        dayLabel: SHORT_DAYS[getDayOfWeekFromDateString(date)],
      };
    });
  }, [weekAnchorDate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (viewMode === 'list' && filterDate) qs.set('date', filterDate);
      if (filterStatus !== 'ALL') qs.set('status', filterStatus);

      const [apptRes, blkRes, svcRes, proRes] = await Promise.all([
        fetch(`/api/gestao/appointments?${qs.toString()}`),
        fetch(`/api/gestao/blocks${viewMode === 'list' && filterDate ? `?date=${filterDate}` : ''}`),
        fetch('/api/gestao/services'),
        fetch('/api/gestao/professionals'),
      ]);

      const [apptJson, blkJson, svcJson, proJson] = await Promise.all([
        apptRes.json(),
        blkRes.json(),
        svcRes.json(),
        proRes.json(),
      ]);

      setAppointments(apptJson.appointments || []);
      setBlocks(blkJson.blocks || []);
      setServices(svcJson.services || []);
      setProfessionals(proJson.professionals || []);
      if (!newForm.serviceId && (svcJson.services || []).length > 0) {
        setNewForm((f) => ({ ...f, serviceId: svcJson.services[0].id }));
      }
    } finally {
      setLoading(false);
    }
  }, [viewMode, filterDate, filterStatus, newForm.serviceId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const res = await fetch('/api/gestao/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceIds: [newForm.serviceId],
        professionalId: newForm.professionalId,
        date: newForm.date,
        startTime: newForm.startTime,
        customerName: newForm.customerName,
        customerPhone: newForm.customerPhone,
        notes: newForm.notes,
        bypassMinAdvance: newForm.bypassMinAdvance,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', msg: json.error || 'Não foi possível criar marcação.' });
      return;
    }
    setShowNewModal(false);
    setNewForm((f) => ({ ...f, customerName: '', customerPhone: '', notes: '' }));
    setFeedback({ type: 'ok', msg: `Marcação ${json.appointment.bookingCode} criada com sucesso.` });
    await loadAll();
  }

  async function handleStatusChange(id: string, nextStatus: AppointmentStatus) {
    setFeedback(null);
    const res = await fetch(`/api/gestao/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', msg: json.error || 'Erro ao atualizar estado.' });
      return;
    }
    setSelectedAppt(null);
    setFeedback({ type: 'ok', msg: `Estado atualizado para ${STATUS_LABELS[nextStatus]}.` });
    await loadAll();
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleTarget) return;
    setFeedback(null);
    const res = await fetch(`/api/gestao/appointments/${rescheduleTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESCHEDULE',
        newDate: rescheduleForm.newDate,
        newStartTime: rescheduleForm.newStartTime,
        newProfessionalId: rescheduleForm.newProfessionalId || rescheduleTarget.professional_id,
        reason: rescheduleForm.reason,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', msg: json.error || 'Conflito ao reagendar.' });
      return;
    }
    setRescheduleTarget(null);
    setSelectedAppt(null);
    setFeedback({ type: 'ok', msg: 'Marcação reagendada com validação de disponibilidade.' });
    await loadAll();
  }

  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const res = await fetch('/api/gestao/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blockForm),
    });
    const json = await res.json();
    if (!res.ok) {
      setFeedback({ type: 'err', msg: json.error || 'Erro ao bloquear horário.' });
      return;
    }
    setShowBlockModal(false);
    setFeedback({ type: 'ok', msg: 'Período bloqueado na agenda.' });
    await loadAll();
  }

  async function handleDeleteBlock(id: string) {
    await fetch(`/api/gestao/blocks?id=${id}`, { method: 'DELETE' });
    await loadAll();
  }

  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR + 1 },
    (_, idx) => GRID_START_HOUR + idx
  );
  const nowIndicatorTop =
    ((luandaNow.minutes - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNowLine =
    luandaNow.minutes >= GRID_START_HOUR * 60 && luandaNow.minutes <= GRID_END_HOUR * 60;

  return (
    <GestaoShell title="Agenda & Marcações">
      {({ user }) => (
        <div className="space-y-6">
          {/* Cabeçalho de Período + Filtros em Pílula Interativos (Estilo Image 1) */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-[family-name:var(--font-jakarta)] text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
                {formatWeekTitle(weekDays[0].date, weekDays[6].date)}
              </h2>

              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F5F5F7]">
                <button
                  type="button"
                  onClick={() => setWeekAnchorDate(addDays(weekAnchorDate, -7))}
                  aria-label="Semana anterior"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 hover:bg-white hover:text-zinc-900 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekAnchorDate(luandaNow.date)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-zinc-700 hover:bg-white cursor-pointer whitespace-nowrap"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setWeekAnchorDate(addDays(weekAnchorDate, 7))}
                  aria-label="Próxima semana"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-600 hover:bg-white hover:text-zinc-900 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ['ALL', 'Todos'],
                  ['PENDING', 'Pendente'],
                  ['CONFIRMED', 'Confirmado'],
                  ['IN_PROGRESS', 'Em atendimento'],
                  ['COMPLETED', 'Concluído'],
                ] as const
              ).map(([key, label]) => {
                const active = filterStatus === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterStatus(key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#18181B] text-white'
                        : 'bg-[#F4F4F6] text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    <span>{label}</span>
                  </button>
                );
              })}

              <div className="inline-flex items-center p-1 rounded-full bg-[#F4F4F6] ml-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Grelha
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'list' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                  }`}
                >
                  Lista
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowBlockModal(true)}
                className="px-3.5 py-1.5 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                Bloquear
              </button>

              {user.role !== 'PROFESSIONAL' && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="px-4 py-1.5 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Marcação
                </button>
              )}
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border text-sm flex items-center justify-between gap-3 ${
                feedback.type === 'err'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-[#D8F5E3]/70 border-[#AFECC7] text-[#12532E]'
              }`}
            >
              <span>{feedback.msg}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Vista 1: Grelha Horária Semanal (Estilo Image 1) */}
          {viewMode === 'grid' && (
            <div className="border border-zinc-200/80 rounded-2xl bg-white overflow-x-auto">
              <div className="min-w-[880px]">
                {/* Cabeçalho dos Dias da Semana */}
                <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-zinc-200/80 bg-[#FAFAFB]">
                  <div className="p-3 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={loadAll}
                      title="Atualizar grelha"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-white cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {weekDays.map((day) => {
                    const isToday = day.date === luandaNow.date;
                    return (
                      <div
                        key={day.date}
                        className="p-2 border-l border-zinc-100 flex items-center justify-center"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (user.role !== 'PROFESSIONAL') {
                              setNewForm((f) => ({ ...f, date: day.date }));
                              setShowNewModal(true);
                            }
                          }}
                          className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                            isToday
                              ? 'bg-[#18181B] text-white font-semibold'
                              : 'text-zinc-600 hover:bg-zinc-100'
                          }`}
                        >
                          {day.dayNum} - {day.dayLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Corpo da Grelha Horária */}
                <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] relative">
                  {/* Coluna de Horas */}
                  <div className="divide-y divide-zinc-100 bg-[#FAFAFB]/50">
                    {hours.slice(0, -1).map((h) => (
                      <div
                        key={h}
                        style={{ height: HOUR_HEIGHT }}
                        className="px-2 pt-2 text-[11px] font-mono text-zinc-400 text-right tabular-nums"
                      >
                        {String(h).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* Colunas por Dia */}
                  {weekDays.map((day) => {
                    const isToday = day.date === luandaNow.date;
                    const dayAppts = appointments.filter((a) => a.date === day.date);
                    const dayBlocks = blocks.filter((b) => b.date === day.date);

                    return (
                      <div
                        key={day.date}
                        className="relative border-l border-zinc-100"
                        style={{ height: (hours.length - 1) * HOUR_HEIGHT }}
                      >
                        {/* Linhas de fundo por hora */}
                        <div className="absolute inset-0 divide-y divide-zinc-100 pointer-events-none">
                          {hours.slice(0, -1).map((h) => (
                            <div key={h} style={{ height: HOUR_HEIGHT }} />
                          ))}
                        </div>

                        {/* Bloqueios manuais */}
                        {dayBlocks.map((blk) => {
                          const [sh, sm] = blk.start_time.split(':').map(Number);
                          const [eh, em] = blk.end_time.split(':').map(Number);
                          const startMin = sh * 60 + sm;
                          const endMin = eh * 60 + em;
                          const top =
                            ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
                          const height = Math.max(
                            26,
                            ((endMin - startMin) / 60) * HOUR_HEIGHT
                          );
                          if (endMin <= GRID_START_HOUR * 60 || startMin >= GRID_END_HOUR * 60) {
                            return null;
                          }
                          return (
                            <div
                              key={blk.id}
                              style={{ top, height }}
                              className="absolute inset-x-1.5 z-10 rounded-xl border border-dashed border-zinc-300 bg-zinc-100/90 px-2.5 py-1.5 text-[11px] text-zinc-600 overflow-hidden"
                            >
                              <p className="font-medium truncate">
                                Bloqueio · {blk.reason}
                              </p>
                              <p className="font-mono text-[10px] text-zinc-500">
                                {blk.start_time}–{blk.end_time}
                              </p>
                            </div>
                          );
                        })}

                        {/* Cartões Pastel das Marcações (Estilo Image 1) */}
                        {dayAppts.map((appt) => {
                          const startMin = appt.start_minutes;
                          const duration = Math.max(35, appt.total_duration_minutes);
                          const top =
                            ((startMin - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
                          const height = Math.max(46, (duration / 60) * HOUR_HEIGHT);
                          if (
                            startMin + duration <= GRID_START_HOUR * 60 ||
                            startMin >= GRID_END_HOUR * 60
                          ) {
                            return null;
                          }
                          const styleClass = getPastelEventStyle(appt.status);
                          return (
                            <button
                              key={appt.id}
                              type="button"
                              onClick={() => setSelectedAppt(appt)}
                              style={{ top: Math.max(2, top), height }}
                              className={`absolute inset-x-1.5 z-20 rounded-xl border px-2.5 py-2 text-left transition-transform hover:scale-[1.01] shadow-xs overflow-hidden flex flex-col justify-between cursor-pointer ${styleClass}`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-xs font-semibold truncate">
                                    {appt.customer_name}
                                  </p>
                                  <MoreHorizontal className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                </div>
                                <p className="font-mono text-[10px] opacity-80 tabular-nums mt-0.5 truncate">
                                  {appt.start_time} – {appt.service_end_time}
                                </p>
                                {height >= 72 && (
                                  <p className="text-[10px] opacity-85 truncate mt-1">
                                    {appt.services[0]?.service_name || appt.professional_name}
                                  </p>
                                )}
                              </div>

                              {height >= 64 && (
                                <div className="flex items-center justify-between gap-1 mt-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/85 text-[10px] font-medium text-zinc-800 truncate">
                                    <Check className="w-2.5 h-2.5 shrink-0" />
                                    {STATUS_LABELS[appt.status]}
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })}

                        {/* Linha da Hora Atual em Luanda (Estilo Image 1) */}
                        {isToday && showNowLine && (
                          <div
                            style={{ top: nowIndicatorTop }}
                            className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
                          >
                            <span className="-ml-7 px-2 py-0.5 rounded-full bg-[#18181B] text-white font-mono text-[10px] font-semibold tabular-nums shadow-xs">
                              {luandaNow.time}
                            </span>
                            <div className="flex-1 h-[2px] bg-[#18181B]" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Vista 2: Lista Detalhada com Filtro de Data */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              <div className="bg-[#F7F7F8] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-zinc-500" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="px-3 py-1.5 text-sm bg-white border border-zinc-200 rounded-xl"
                  />
                  {filterDate && (
                    <button
                      type="button"
                      onClick={() => setFilterDate('')}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      Todas as datas
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={loadAll}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar lista
                </button>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Marcações registadas ({appointments.length})
                  </h3>
                </div>

                {loading ? (
                  <div className="p-8 text-center text-sm text-zinc-500">A carregar agenda...</div>
                ) : appointments.length === 0 ? (
                  <div className="p-8 text-center text-sm text-zinc-500">
                    Nenhuma marcação encontrada para os filtros aplicados.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {appointments.map((appt) => (
                      <div
                        key={appt.id}
                        className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#FAFAFB]"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-mono font-semibold text-zinc-900">
                              {appt.booking_code}
                            </span>
                            <span className="text-zinc-300">·</span>
                            <span className="font-semibold text-zinc-900">{appt.customer_name}</span>
                            <span className="font-mono text-xs text-zinc-500">
                              {appt.customer_phone}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 tabular-nums">
                            {formatDatePt(appt.date)} · {appt.start_time}–{appt.service_end_time}
                            {appt.total_buffer_minutes > 0
                              ? ` (prep. até ${appt.end_time})`
                              : ''}{' '}
                            · <span className="font-medium text-zinc-900">{appt.professional_name}</span>
                          </p>
                          <p className="text-xs text-zinc-500">
                            {appt.services
                              .map((s) => `${s.service_name} (${s.duration_minutes}m)`)
                              .join(' + ')}{' '}
                            ·{' '}
                            <span className="font-mono text-zinc-800">
                              {formatKz(appt.total_price_kz)}
                            </span>{' '}
                            · Estado:{' '}
                            <span className="font-medium text-zinc-900">
                              {STATUS_LABELS[appt.status]}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {appt.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(appt.id, 'CONFIRMED')}
                              className="px-3.5 py-1.5 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                            >
                              Confirmar
                            </button>
                          )}
                          {appt.status === 'CONFIRMED' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(appt.id, 'IN_PROGRESS')}
                              className="px-3.5 py-1.5 text-xs font-medium bg-[#EBE5FF] text-[#352375] rounded-full hover:opacity-90 cursor-pointer"
                            >
                              Iniciar
                            </button>
                          )}
                          {(appt.status === 'CONFIRMED' || appt.status === 'IN_PROGRESS') && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                              className="px-3.5 py-1.5 text-xs font-medium bg-[#D8F5E3] text-[#12532E] rounded-full hover:opacity-90 cursor-pointer"
                            >
                              Concluir
                            </button>
                          )}
                          {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRescheduleTarget(appt);
                                  setRescheduleForm({
                                    newDate: appt.date,
                                    newStartTime: appt.start_time,
                                    newProfessionalId: appt.professional_id,
                                    reason: 'Reagendamento pela equipa',
                                  });
                                }}
                                className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 cursor-pointer"
                              >
                                Reagendar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(appt.id, 'NO_SHOW')}
                                className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 cursor-pointer"
                              >
                                Faltou
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
                                className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-full hover:bg-red-50 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bloqueios Manuais */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">
                Bloqueios manuais da agenda ({blocks.length})
              </h3>
            </div>
            {blocks.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">Sem bloqueios registados.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {blocks.map((b) => (
                  <div
                    key={b.id}
                    className="px-5 py-3 flex items-center justify-between gap-4 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-zinc-700 tabular-nums">
                        {formatDatePt(b.date)} · {b.start_time}–{b.end_time}
                      </span>
                      <span className="text-zinc-300 mx-2">·</span>
                      <span className="font-medium text-zinc-900">
                        {b.professional_name || 'Todo o salão'}
                      </span>
                      <span className="text-zinc-300 mx-2">·</span>
                      <span className="text-zinc-600">{b.reason}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(b.id)}
                      className="p-2 text-zinc-400 hover:text-red-600 cursor-pointer shrink-0"
                      title="Remover bloqueio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal de Detalhes & Ações da Marcação (ao clicar num cartão pastel da grelha) */}
          {selectedAppt && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-zinc-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-zinc-500">{selectedAppt.booking_code}</p>
                    <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-zinc-900 mt-0.5">
                      {selectedAppt.customer_name}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      {selectedAppt.customer_phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAppt(null)}
                    className="p-2 rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="rounded-2xl bg-[#F7F7F8] p-4 space-y-2 text-xs text-zinc-700">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Data e hora</span>
                    <span className="font-mono font-medium text-zinc-900 tabular-nums">
                      {formatDatePt(selectedAppt.date)} · {selectedAppt.start_time}–
                      {selectedAppt.service_end_time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Profissional</span>
                    <span className="font-medium text-zinc-900">
                      {selectedAppt.professional_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Serviços</span>
                    <span className="font-medium text-zinc-900 text-right">
                      {selectedAppt.services.map((s) => s.service_name).join(' + ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Valor / Estado</span>
                    <span className="font-mono font-semibold text-zinc-900 tabular-nums">
                      {formatKz(selectedAppt.total_price_kz)} · {STATUS_LABELS[selectedAppt.status]}
                    </span>
                  </div>
                </div>

                {selectedAppt.history && selectedAppt.history.length > 0 && (
                  <div className="text-[11px] text-zinc-500 space-y-1">
                    <p className="font-medium text-zinc-700">Histórico recente</p>
                    {selectedAppt.history.slice(0, 3).map((h, i) => (
                      <p key={i}>
                        {h.to_status} por {h.changed_by || 'Sistema'}
                        {h.previous_start_time
                          ? ` (antes ${h.previous_date} ${h.previous_start_time})`
                          : ''}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  {selectedAppt.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedAppt.id, 'CONFIRMED')}
                      className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                    >
                      Confirmar
                    </button>
                  )}
                  {selectedAppt.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedAppt.id, 'IN_PROGRESS')}
                      className="px-4 py-2 text-xs font-medium bg-[#EBE5FF] text-[#352375] rounded-full cursor-pointer"
                    >
                      Iniciar atendimento
                    </button>
                  )}
                  {(selectedAppt.status === 'CONFIRMED' ||
                    selectedAppt.status === 'IN_PROGRESS') && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedAppt.id, 'COMPLETED')}
                      className="px-4 py-2 text-xs font-medium bg-[#D8F5E3] text-[#12532E] rounded-full cursor-pointer"
                    >
                      Concluir
                    </button>
                  )}
                  {selectedAppt.status !== 'CANCELLED' && selectedAppt.status !== 'COMPLETED' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleTarget(selectedAppt);
                          setRescheduleForm({
                            newDate: selectedAppt.date,
                            newStartTime: selectedAppt.start_time,
                            newProfessionalId: selectedAppt.professional_id,
                            reason: 'Reagendamento pela equipa',
                          });
                        }}
                        className="px-3.5 py-2 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 cursor-pointer"
                      >
                        Reagendar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedAppt.id, 'NO_SHOW')}
                        className="px-3.5 py-2 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 cursor-pointer"
                      >
                        Faltou
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedAppt.id, 'CANCELLED')}
                        className="px-3.5 py-2 text-xs font-medium border border-red-200 text-red-700 rounded-full hover:bg-red-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modal Nova Marcação */}
          {showNewModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleCreateBooking}
                className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    Criar Marcação Interna
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Serviço</label>
                    <select
                      value={newForm.serviceId}
                      onChange={(e) => setNewForm({ ...newForm, serviceId: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.duration_minutes} min · {formatKz(s.price_kz)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Profissional
                    </label>
                    <select
                      value={newForm.professionalId}
                      onChange={(e) => setNewForm({ ...newForm, professionalId: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                    >
                      <option value="any">Qualquer profissional disponível</option>
                      {professionals.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Data</label>
                      <input
                        type="date"
                        required
                        value={newForm.date}
                        onChange={(e) => setNewForm({ ...newForm, date: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Hora (HH:MM)
                      </label>
                      <input
                        type="time"
                        required
                        value={newForm.startTime}
                        onChange={(e) => setNewForm({ ...newForm, startTime: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nome da cliente"
                    value={newForm.customerName}
                    onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Telefone (+244 923 000 000)"
                    value={newForm.customerPhone}
                    onChange={(e) => setNewForm({ ...newForm, customerPhone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-full cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                  >
                    Confirmar Marcação
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal Bloqueio */}
          {showBlockModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleCreateBlock}
                className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    Bloquear Período da Agenda
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <select
                    value={blockForm.professionalId}
                    onChange={(e) => setBlockForm({ ...blockForm, professionalId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  >
                    <option value="ALL">Todo o salão (encerramento extraordinário)</option>
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    required
                    value={blockForm.date}
                    onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="time"
                      required
                      value={blockForm.startTime}
                      onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                    />
                    <input
                      type="time"
                      required
                      value={blockForm.endTime}
                      onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                    />
                  </div>
                  <select
                    value={blockForm.blockType}
                    onChange={(e) => setBlockForm({ ...blockForm, blockType: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  >
                    <option value="MEETING">Reunião</option>
                    <option value="LUNCH">Almoço</option>
                    <option value="MAINTENANCE">Manutenção</option>
                    <option value="VACATION">Férias / Folga</option>
                    <option value="PERSONAL">Compromisso pessoal</option>
                    <option value="EXTRAORDINARY">Encerramento extraordinário</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Motivo do bloqueio"
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-full cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                  >
                    Guardar Bloqueio
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal Reagendamento */}
          {rescheduleTarget && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleReschedule}
                className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    Reagendar {rescheduleTarget.booking_code}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRescheduleTarget(null)}
                    className="p-1.5 rounded-full hover:bg-zinc-100 text-zinc-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  O horário atual só é libertado após validação do novo período sem conflitos.
                </p>
                <div className="space-y-3">
                  <input
                    type="date"
                    required
                    value={rescheduleForm.newDate}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                  <input
                    type="time"
                    required
                    value={rescheduleForm.newStartTime}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, newStartTime: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                  <select
                    value={rescheduleForm.newProfessionalId}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, newProfessionalId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Motivo do reagendamento"
                    value={rescheduleForm.reason}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, reason: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-xl bg-[#F7F7F8]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleTarget(null)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-full cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                  >
                    Confirmar Reagendamento
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </GestaoShell>
  );
}
