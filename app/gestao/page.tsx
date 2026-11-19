'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import GestaoShell from '@/components/gestao/GestaoShell';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock,
  Plus,
  Wallet,
} from 'lucide-react';
import { formatDatePt, formatKz } from '@/lib/utils/time';
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/types/domain';

interface DayAppt {
  id: string;
  booking_code: string;
  date: string;
  start_time: string;
  start_minutes: number;
  service_end_time: string;
  status: AppointmentStatus;
  total_price_kz: number;
  paid_amount_kz: number;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  professional_name: string;
  service_summary: string | null;
}

interface DashboardPayload {
  date: string;
  todayDate: string;
  nowTime: string;
  nowMinutes: number;
  role: string;
  pendingBadgeCount: number;
  stats: {
    totalToday: number;
    pendingCount: number;
    confirmedCount: number;
    completedCount: number;
    cancelledCount: number;
  };
  weekStrip: Array<{
    date: string;
    dayOfWeek: number;
    totalCount: number;
    completedCount: number;
    pendingCount: number;
  }>;
  dayAppointments: DayAppt[];
  finance: {
    revenueTodayKz: number;
    totalRevenueKz: number;
    expensesTodayKz: number;
    totalExpensesKz: number;
    balanceKz: number;
    pendingReceivablesKz: number;
    hasOpenRegister: boolean;
  } | null;
  upcomingAppointments: DayAppt[];
  availableProsToday: Array<{
    id: string;
    name: string;
    specialties: string;
    avatar_url: string | null;
    start_time: string;
    end_time: string;
  }>;
  alerts: Array<{ level: 'warning' | 'info'; message: string }>;
}

const SHORT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

function getStatusVisual(status: AppointmentStatus) {
  switch (status) {
    case 'COMPLETED':
      return {
        bubbleBg: 'bg-[#D8F5E3] text-[#12532E]',
        labelClass: 'text-[#12532E]',
      };
    case 'IN_PROGRESS':
      return {
        bubbleBg: 'bg-[#EBE5FF] text-[#352375]',
        labelClass: 'text-[#352375]',
      };
    case 'CONFIRMED':
      return {
        bubbleBg: 'bg-[#DCF0FF] text-[#14446B]',
        labelClass: 'text-[#14446B]',
      };
    case 'PENDING':
      return {
        bubbleBg: 'bg-[#FCEFD9] text-[#6B4412]',
        labelClass: 'text-[#6B4412]',
      };
    default:
      return {
        bubbleBg: 'bg-zinc-200 text-zinc-700',
        labelClass: 'text-zinc-600',
      };
  }
}

function TimelineRow({ appt }: { appt: DayAppt }) {
  const vis = getStatusVisual(appt.status);
  return (
    <Link
      href={`/gestao/agenda?date=${appt.date}`}
      className="group flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl bg-[#F7F7F8] hover:bg-[#EFEFF2] transition-colors min-h-[64px]"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${vis.bubbleBg}`}
        >
          {appt.status === 'COMPLETED' ? (
            <Check className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <Clock className="w-4 h-4" />
          )}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 truncate">
            <span className="truncate">{appt.customer_name}</span>
            {appt.service_summary && (
              <span className="hidden sm:inline font-normal text-zinc-500 truncate">
                · {appt.service_summary}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 tabular-nums truncate">
            <span className="font-mono text-zinc-700">
              {appt.start_time}–{appt.service_end_time}
            </span>{' '}
            · {appt.professional_name} ·{' '}
            <span className={`font-medium ${vis.labelClass}`}>{STATUS_LABELS[appt.status]}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-xs font-semibold text-zinc-800 tabular-nums">
          {formatKz(appt.total_price_kz)}
        </span>
        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
      </div>
    </Link>
  );
}

export default function GestaoDashboardPage() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (dateOverride?: string) => {
    try {
      const qs = dateOverride ? `?date=${encodeURIComponent(dateOverride)}` : '';
      const res = await fetch(`/api/gestao/dashboard${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar painel.');
      setData(json as DashboardPayload);
      if (!dateOverride && json.date) {
        setSelectedDate(json.date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  function handleSelectDay(date: string) {
    setSelectedDate(date);
    loadDashboard(date);
  }

  const morningAppts = (data?.dayAppointments || []).filter((a) => a.start_minutes < 12 * 60);
  const afternoonAppts = (data?.dayAppointments || []).filter((a) => a.start_minutes >= 12 * 60);

  return (
    <GestaoShell title="Visão Geral" pendingCount={data?.pendingBadgeCount}>
      {({ user }) => (
        <div className="space-y-7">
          {error ? (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          ) : !data ? (
            <div className="space-y-5">
              <div className="h-20 rounded-2xl bg-[#F7F7F8] animate-pulse" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-[#F7F7F8] animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Cabeçalho do Dia (Estilo Image 2: Título + Subtítulo + Botão Circular +) */}
              <section className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-[28px] font-semibold tracking-tight text-zinc-900">
                    Jornada do Salão
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                    Acompanhe atendimentos, confirmações e fluxo diário em Luanda numa vista simples.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectDay(data.todayDate)}
                    className="px-3.5 py-2 rounded-full bg-[#F7F7F8] hover:bg-zinc-200/70 text-xs font-medium text-zinc-800 transition-colors tabular-nums cursor-pointer"
                  >
                    {selectedDate === data.todayDate
                      ? `Hoje · ${formatDatePt(data.date)}`
                      : `${formatDatePt(data.date)} · Voltar a hoje`}
                  </button>

                  {user.role !== 'PROFESSIONAL' && (
                    <Link
                      href="/gestao/agenda?new=1"
                      aria-label="Criar nova marcação"
                      className="w-10 h-10 rounded-full bg-[#18181B] hover:bg-zinc-800 text-white flex items-center justify-center shadow-xs transition-colors shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </section>

              {/* Faixa Horizontal de 7 Dias (Estilo Image 2) */}
              <section
                aria-label="Seletor semanal de dias"
                className="grid grid-cols-7 gap-1.5 sm:gap-3"
              >
                {data.weekStrip.map((day) => {
                  const isActive = day.date === data.date;
                  const isToday = day.date === data.todayDate;
                  const dayNum = day.date.slice(8, 10);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => handleSelectDay(day.date)}
                      className={`flex flex-col items-center justify-between py-3 px-1.5 rounded-2xl transition-all cursor-pointer min-h-[82px] ${
                        isActive
                          ? 'bg-[#18181B] text-white shadow-md'
                          : 'bg-[#F7F7F8] hover:bg-[#EFEFF2] text-zinc-700'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-medium ${
                          isActive ? 'text-zinc-300' : 'text-zinc-500'
                        }`}
                      >
                        {SHORT_WEEKDAYS[day.dayOfWeek]}
                      </span>
                      <span className="font-mono text-base sm:text-lg font-semibold tabular-nums mt-0.5">
                        {dayNum}
                      </span>
                      <span className="mt-1.5 h-4 flex items-center justify-center">
                        {day.completedCount > 0 ? (
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              isActive ? 'bg-[#A8DF1A] text-[#142318]' : 'bg-zinc-300/80 text-zinc-700'
                            }`}
                          >
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </span>
                        ) : day.totalCount > 0 ? (
                          <span
                            className={`text-[10px] font-mono tabular-nums ${
                              isActive ? 'text-[#A8DF1A]' : 'text-zinc-500'
                            }`}
                          >
                            {day.totalCount}
                          </span>
                        ) : isToday ? (
                          <span
                            className={`text-[10px] ${
                              isActive ? 'text-zinc-300' : 'text-zinc-400'
                            }`}
                          >
                            ·
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </section>

              {/* Cartão Insight Tracejado Lavanda (Estilo Image 2, alimentado por dados reais) */}
              <section className="rounded-2xl border border-dashed border-[#C7B3FA] bg-[#F8F5FF] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <span className="w-10 h-10 rounded-full bg-white border border-[#E4D9FF] text-[#6D4AFF] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#5333D6]">
                      Resumo Operacional · {formatDatePt(data.date)}
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-600 mt-0.5 leading-relaxed">
                      {data.stats.totalToday === 0
                        ? 'Sem marcações agendadas para esta data até ao momento.'
                        : `${data.stats.totalToday} atendimento(s) neste dia — ${data.stats.completedCount} concluído(s), ${data.stats.confirmedCount} confirmado(s) e ${data.stats.pendingCount} por confirmar.`}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/gestao/agenda?date=${data.date}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5333D6] hover:underline whitespace-nowrap shrink-0"
                >
                  Abrir grelha da agenda
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </section>

              {/* Alertas operacionais reais (quando existirem) */}
              {data.alerts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.alerts.map((al, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-center gap-3 ${
                        al.level === 'warning'
                          ? 'bg-[#FCEFD9]/60 border-[#F2D5A7] text-[#5C3A0E]'
                          : 'bg-[#DCF0FF]/60 border-[#B6E0FF] text-[#14446B]'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{al.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Indicadores Operacionais & Financeiros (Cartões limpos sem aninhamento excessivo) */}
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl">
                    <p className="text-xs text-zinc-500">Marcações do dia</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-900 tabular-nums mt-1.5">
                      {data.stats.totalToday}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl">
                    <p className="text-xs text-zinc-500">Por confirmar</p>
                    <p className="font-mono text-2xl font-semibold text-[#9A5B13] tabular-nums mt-1.5">
                      {data.stats.pendingCount}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl">
                    <p className="text-xs text-zinc-500">Confirmadas</p>
                    <p className="font-mono text-2xl font-semibold text-[#14446B] tabular-nums mt-1.5">
                      {data.stats.confirmedCount}
                    </p>
                  </div>
                  <div className="p-4 sm:p-5 bg-white border border-zinc-200/80 rounded-2xl">
                    <p className="text-xs text-zinc-500">Concluídas</p>
                    <p className="font-mono text-2xl font-semibold text-[#12532E] tabular-nums mt-1.5">
                      {data.stats.completedCount}
                    </p>
                  </div>
                </div>

                {data.finance ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="p-4 sm:p-5 bg-[#F7F7F8] rounded-2xl">
                      <p className="text-xs text-zinc-500">Receita do dia</p>
                      <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums mt-1">
                        {formatKz(data.finance.revenueTodayKz)}
                      </p>
                    </div>
                    <div className="p-4 sm:p-5 bg-[#F7F7F8] rounded-2xl">
                      <p className="text-xs text-zinc-500">Despesas acumuladas</p>
                      <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums mt-1">
                        {formatKz(data.finance.totalExpensesKz)}
                      </p>
                    </div>
                    <div className="p-4 sm:p-5 bg-[#D8F5E3]/55 rounded-2xl">
                      <p className="text-xs text-[#12532E]">Saldo líquido</p>
                      <p className="font-mono text-lg font-semibold text-[#12532E] tabular-nums mt-1">
                        {formatKz(data.finance.balanceKz)}
                      </p>
                    </div>
                    <div className="p-4 sm:p-5 bg-[#FCEFD9]/65 rounded-2xl">
                      <p className="text-xs text-[#6B4412]">Por receber</p>
                      <p className="font-mono text-lg font-semibold text-[#6B4412] tabular-nums mt-1">
                        {formatKz(data.finance.pendingReceivablesKz)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl border border-zinc-200/80 bg-[#F7F7F8] text-xs text-zinc-600">
                    Sessão ativa como Profissional ({user.name}) — os seus indicadores financeiros e administrativos do estabelecimento permanecem isolados.
                  </div>
                )}
              </section>

              {/* Linha do Tempo Agrupada (Manhã / Tarde, estilo Image 2) + Equipa & Caixa */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-8 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                      Agenda de {formatDatePt(data.date)}
                    </h3>
                    <Link
                      href={`/gestao/agenda?date=${data.date}`}
                      className="text-xs font-medium text-zinc-600 hover:text-zinc-900 inline-flex items-center gap-1"
                    >
                      Gerir marcações
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {data.dayAppointments.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-zinc-200/80 bg-[#F7F7F8]/60 text-center space-y-3">
                      <Calendar className="w-6 h-6 text-zinc-400 mx-auto" />
                      <p className="text-sm text-zinc-600">
                        Nenhuma marcação registada para {formatDatePt(data.date)}.
                      </p>
                      {user.role !== 'PROFESSIONAL' && (
                        <Link
                          href="/gestao/agenda?new=1"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#18181B] text-white text-xs font-medium hover:bg-zinc-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Agendar para este dia
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {morningAppts.length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-xs font-medium text-zinc-500">Manhã</p>
                          <div className="space-y-2.5">
                            {morningAppts.map((appt) => (
                              <TimelineRow key={appt.id} appt={appt} />
                            ))}
                          </div>
                        </div>
                      )}

                      {afternoonAppts.length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-xs font-medium text-zinc-500">Tarde</p>
                          <div className="space-y-2.5">
                            {afternoonAppts.map((appt) => (
                              <TimelineRow key={appt.id} appt={appt} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {data.upcomingAppointments.length > 0 && (
                    <div className="pt-2 space-y-2.5">
                      <p className="text-xs font-medium text-zinc-500">
                        Próximas marcações futuras
                      </p>
                      <div className="border border-zinc-200/80 rounded-2xl divide-y divide-zinc-100 overflow-hidden bg-white">
                        {data.upcomingAppointments.slice(0, 5).map((appt) => (
                          <Link
                            key={appt.id}
                            href={`/gestao/agenda?date=${appt.date}`}
                            className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-[#F7F7F8] transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900 truncate">
                                <span className="font-mono text-xs text-zinc-500 mr-2">
                                  {appt.booking_code}
                                </span>
                                {appt.customer_name}
                              </p>
                              <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                                {formatDatePt(appt.date)} · {appt.start_time} · {appt.professional_name}
                              </p>
                            </div>
                            <span className="font-mono text-xs font-medium text-zinc-700 tabular-nums shrink-0">
                              {formatKz(appt.total_price_kz)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* Coluna Direita: Equipa em Escala + Caixa */}
                <aside className="lg:col-span-4 space-y-4">
                  <div className="border border-zinc-200/80 rounded-2xl overflow-hidden bg-white">
                    <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                        Equipa em escala
                      </h3>
                      <span className="text-xs font-mono text-zinc-500 tabular-nums">
                        {data.availableProsToday.length}
                      </span>
                    </div>

                    {data.availableProsToday.length === 0 ? (
                      <div className="p-5 text-xs text-zinc-500">
                        Nenhuma profissional escalada para esta data.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-100">
                        {data.availableProsToday.map((pro) => (
                          <div key={pro.id} className="px-5 py-3.5 flex items-center gap-3">
                            <img
                              src={pro.avatar_url || '/images/pro_avatar_one_1795068461594.jpg'}
                              alt={pro.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-zinc-200 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-zinc-900 truncate">{pro.name}</p>
                              <p className="text-xs text-zinc-500 font-mono tabular-nums">
                                {pro.start_time}–{pro.end_time}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {data.finance && (
                    <div className="border border-zinc-200/80 rounded-2xl p-5 bg-[#F7F7F8] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-900">
                          <Wallet className="w-4 h-4 text-zinc-700" />
                          Caixa Diário
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            data.finance.hasOpenRegister ? 'text-[#12532E]' : 'text-[#9A5B13]'
                          }`}
                        >
                          {data.finance.hasOpenRegister ? 'Aberto' : 'Fechado'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {data.finance.hasOpenRegister
                          ? 'Caixa em operação. Registe pagamentos em numerário, Multicaixa Express ou TPA.'
                          : 'Abra o caixa diário para registar entradas e saídas em numerário.'}
                      </p>
                      <Link
                        href="/gestao/financeiro"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-900 hover:underline"
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        Ir para Financeiro &amp; Caixa
                      </Link>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      )}
    </GestaoShell>
  );
}
