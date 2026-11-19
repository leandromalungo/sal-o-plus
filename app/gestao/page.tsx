'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GestaoShell from '@/components/gestao/GestaoShell';
import { AlertTriangle, Calendar, ArrowRight } from 'lucide-react';
import { formatDatePt, formatKz } from '@/lib/utils/time';
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/types/domain';

interface DashboardPayload {
  date: string;
  role: string;
  stats: {
    totalToday: number;
    pendingCount: number;
    confirmedCount: number;
    completedCount: number;
    cancelledCount: number;
  };
  finance: {
    revenueTodayKz: number;
    totalRevenueKz: number;
    expensesTodayKz: number;
    totalExpensesKz: number;
    balanceKz: number;
    pendingReceivablesKz: number;
    hasOpenRegister: boolean;
  } | null;
  upcomingAppointments: Array<{
    id: string;
    booking_code: string;
    date: string;
    start_time: string;
    service_end_time: string;
    status: AppointmentStatus;
    total_price_kz: number;
    customer_name: string;
    customer_phone: string;
    professional_name: string;
  }>;
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

export default function GestaoDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gestao/dashboard')
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar painel.');
        return json as DashboardPayload;
      })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro inesperado.'));
  }, []);

  return (
    <GestaoShell title="Dashboard">
      {({ user }) => (
        <div className="space-y-8">
          {error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          ) : !data ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-zinc-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Alertas reais */}
              {data.alerts.length > 0 && (
                <div className="space-y-2">
                  {data.alerts.map((al, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-sm flex items-center gap-3 ${
                        al.level === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-violet-50 border-violet-200 text-violet-900'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{al.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Indicadores operacionais (calculados da base de dados) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-zinc-500">
                    Resumo operacional · {formatDatePt(data.date)} (Luanda)
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-xs text-zinc-500">Marcações hoje</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-900 tabular-nums mt-1">
                      {data.stats.totalToday}
                    </p>
                  </div>
                  <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-xs text-zinc-500">Pendentes</p>
                    <p className="font-mono text-2xl font-semibold text-amber-700 tabular-nums mt-1">
                      {data.stats.pendingCount}
                    </p>
                  </div>
                  <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-xs text-zinc-500">Confirmadas</p>
                    <p className="font-mono text-2xl font-semibold text-violet-700 tabular-nums mt-1">
                      {data.stats.confirmedCount}
                    </p>
                  </div>
                  <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-xs text-zinc-500">Concluídas</p>
                    <p className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1">
                      {data.stats.completedCount}
                    </p>
                  </div>
                  <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-xs text-zinc-500">Cancelamentos</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-700 tabular-nums mt-1">
                      {data.stats.cancelledCount}
                    </p>
                  </div>
                </div>
              </section>

              {/* Indicadores financeiros (ocultos para perfil Profissional) */}
              {data.finance ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-zinc-500">Indicadores financeiros (AOA / Kz)</h2>
                    <Link
                      href="/gestao/financeiro"
                      className="text-xs font-medium text-violet-700 hover:underline inline-flex items-center gap-1"
                    >
                      Abrir Financeiro &amp; Caixa
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                      <p className="text-xs text-zinc-500">Receitas de hoje</p>
                      <p className="font-mono text-xl font-semibold text-zinc-900 tabular-nums mt-1">
                        {formatKz(data.finance.revenueTodayKz)}
                      </p>
                    </div>
                    <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                      <p className="text-xs text-zinc-500">Despesas acumuladas</p>
                      <p className="font-mono text-xl font-semibold text-zinc-900 tabular-nums mt-1">
                        {formatKz(data.finance.totalExpensesKz)}
                      </p>
                    </div>
                    <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                      <p className="text-xs text-zinc-500">Saldo líquido</p>
                      <p className="font-mono text-xl font-semibold text-violet-700 tabular-nums mt-1">
                        {formatKz(data.finance.balanceKz)}
                      </p>
                    </div>
                    <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                      <p className="text-xs text-zinc-500">Por receber</p>
                      <p className="font-mono text-xl font-semibold text-amber-700 tabular-nums mt-1">
                        {formatKz(data.finance.pendingReceivablesKz)}
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="p-4 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-500">
                  Sessão ativa como Profissional ({user.name}) — os seus indicadores financeiros e administrativos do salão permanecem protegidos.
                </section>
              )}

              {/* Próximos atendimentos + Equipa disponível */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-8 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
                    <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                      Próximos atendimentos
                    </h2>
                    <Link href="/gestao/agenda" className="text-xs font-medium text-violet-700 hover:underline">
                      Ver agenda completa
                    </Link>
                  </div>

                  {data.upcomingAppointments.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <Calendar className="w-6 h-6 text-zinc-400 mx-auto" />
                      <p className="text-sm text-zinc-600">Sem próximos atendimentos agendados.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      {data.upcomingAppointments.map((appt) => (
                        <div key={appt.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-zinc-50">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                              <span className="font-mono text-xs text-violet-700">{appt.booking_code}</span>
                              <span>·</span>
                              <span className="truncate">{appt.customer_name}</span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                              {formatDatePt(appt.date)} · {appt.start_time}–{appt.service_end_time} · {appt.professional_name}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-medium text-zinc-800">{STATUS_LABELS[appt.status]}</p>
                            <p className="font-mono text-xs text-zinc-500 tabular-nums mt-0.5">
                              {formatKz(appt.total_price_kz)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-200">
                    <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                      Profissionais em escala hoje
                    </h2>
                  </div>
                  {data.availableProsToday.length === 0 ? (
                    <div className="p-6 text-sm text-zinc-500">Nenhuma profissional escalada para hoje.</div>
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">{pro.name}</p>
                            <p className="text-xs text-zinc-500 font-mono tabular-nums">
                              {pro.start_time}–{pro.end_time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </GestaoShell>
  );
}
