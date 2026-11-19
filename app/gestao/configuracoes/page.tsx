'use client';

import { useEffect, useState, useCallback } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import { DAY_NAMES_PT, formatDatePt } from '@/lib/utils/time';

interface SettingsPayload {
  salon: {
    id: string;
    name: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    slotIntervalMinutes: number;
    minAdvanceHours: number;
    maxAdvanceDays: number;
    minCancelHours: number;
    pendingHoldMinutes: number;
    allowClientCancel: boolean;
    isTemporarilyClosed: boolean;
    closureReason: string | null;
  };
  workingHours: Array<{
    day_of_week: number;
    is_open: number;
    open_time: string;
    close_time: string;
    break_start: string | null;
    break_end: string | null;
  }>;
  holidays: Array<{
    id: string;
    date: string;
    name: string;
    is_closed: number;
    open_time: string | null;
    close_time: string | null;
  }>;
  notificationPrefs: {
    whatsapp_enabled: number;
    sms_enabled: number;
    email_enabled: number;
    reminder_hours_before: number;
    second_reminder_hours: number;
  };
  notifications: Array<{
    id: string;
    channel: string;
    event_type: string;
    recipient: string;
    message: string;
    status: string;
    created_at: string;
  }>;
}

export default function ConfiguracoesPage() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/gestao/settings');
    if (res.ok) {
      setData(await res.json());
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setFeedback(null);
    const res = await fetch('/api/gestao/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salon: data.salon,
        workingHours: data.workingHours,
        notificationPrefs: data.notificationPrefs,
      }),
    });
    if (res.ok) {
      setFeedback('Configurações do motor e horários guardadas.');
      await load();
    }
  }

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!holidayDate || !holidayName) return;
    await fetch('/api/gestao/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_HOLIDAY', date: holidayDate, name: holidayName, isClosed: true }),
    });
    setHolidayDate('');
    setHolidayName('');
    await load();
  }

  async function removeHoliday(id: string) {
    await fetch('/api/gestao/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REMOVE_HOLIDAY', id }),
    });
    await load();
  }

  return (
    <GestaoShell title="Configurações & Notificações">
      {() =>
        !data ? (
          <p className="text-sm text-zinc-500">A carregar configurações...</p>
        ) : (
          <div className="space-y-8">
            {feedback && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                {feedback}
              </div>
            )}

            <form onSubmit={saveAll} className="space-y-6">
              {/* Regras do Motor */}
              <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Regras do Motor de Agendamentos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Intervalo de grelha</label>
                    <select
                      value={data.salon.slotIntervalMinutes}
                      onChange={(e) =>
                        setData({
                          ...data,
                          salon: { ...data.salon, slotIntervalMinutes: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                    >
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={60}>60 minutos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Antecedência mínima (h)</label>
                    <input
                      type="number"
                      min={0}
                      max={72}
                      value={data.salon.minAdvanceHours}
                      onChange={(e) =>
                        setData({
                          ...data,
                          salon: { ...data.salon, minAdvanceHours: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Limite máximo (dias)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={data.salon.maxAdvanceDays}
                      onChange={(e) =>
                        setData({
                          ...data,
                          salon: { ...data.salon, maxAdvanceDays: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Cancelamento cliente (h)</label>
                    <input
                      type="number"
                      min={0}
                      max={72}
                      value={data.salon.minCancelHours}
                      onChange={(e) =>
                        setData({
                          ...data,
                          salon: { ...data.salon, minCancelHours: Number(e.target.value) },
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      checked={data.salon.allowClientCancel}
                      onChange={(e) =>
                        setData({
                          ...data,
                          salon: { ...data.salon, allowClientCancel: e.target.checked },
                        })
                      }
                    />
                    Permitir cancelamento pela cliente na página pública
                  </label>
                  <label className="flex items-center gap-2 text-sm text-red-700">
                    <input
                      type="checkbox"
                      checked={data.salon.isTemporarilyClosed}
                      onChange={(e) =>
                        setData({
                          ...data,
                          salon: { ...data.salon, isTemporarilyClosed: e.target.checked },
                        })
                      }
                    />
                    Encerramento temporário de emergência
                  </label>
                </div>
              </section>

              {/* Horário semanal do salão */}
              <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Horário de Funcionamento Semanal
                </h2>
                <div className="space-y-2.5">
                  {data.workingHours.map((wh, idx) => (
                    <div key={wh.day_of_week} className="grid grid-cols-12 gap-3 items-center text-sm">
                      <label className="col-span-4 sm:col-span-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={wh.is_open === 1}
                          onChange={(e) => {
                            const copy = [...data.workingHours];
                            copy[idx] = { ...wh, is_open: e.target.checked ? 1 : 0 };
                            setData({ ...data, workingHours: copy });
                          }}
                        />
                        <span>{DAY_NAMES_PT[wh.day_of_week]}</span>
                      </label>
                      <input
                        type="time"
                        disabled={wh.is_open !== 1}
                        value={wh.open_time}
                        onChange={(e) => {
                          const copy = [...data.workingHours];
                          copy[idx] = { ...wh, open_time: e.target.value };
                          setData({ ...data, workingHours: copy });
                        }}
                        className="col-span-4 sm:col-span-3 px-2.5 py-1.5 border border-zinc-200 rounded-lg font-mono text-xs"
                      />
                      <input
                        type="time"
                        disabled={wh.is_open !== 1}
                        value={wh.close_time}
                        onChange={(e) => {
                          const copy = [...data.workingHours];
                          copy[idx] = { ...wh, close_time: e.target.value };
                          setData({ ...data, workingHours: copy });
                        }}
                        className="col-span-4 sm:col-span-3 px-2.5 py-1.5 border border-zinc-200 rounded-lg font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Notificações */}
              {data.notificationPrefs && (
                <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    Canais de Notificação &amp; Lembretes
                  </h2>
                  <div className="flex flex-wrap gap-6 text-sm text-zinc-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={data.notificationPrefs.whatsapp_enabled === 1}
                        onChange={(e) =>
                          setData({
                            ...data,
                            notificationPrefs: {
                              ...data.notificationPrefs,
                              whatsapp_enabled: e.target.checked ? 1 : 0,
                            },
                          })
                        }
                      />
                      WhatsApp
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={data.notificationPrefs.sms_enabled === 1}
                        onChange={(e) =>
                          setData({
                            ...data,
                            notificationPrefs: {
                              ...data.notificationPrefs,
                              sms_enabled: e.target.checked ? 1 : 0,
                            },
                          })
                        }
                      />
                      SMS
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={data.notificationPrefs.email_enabled === 1}
                        onChange={(e) =>
                          setData({
                            ...data,
                            notificationPrefs: {
                              ...data.notificationPrefs,
                              email_enabled: e.target.checked ? 1 : 0,
                            },
                          })
                        }
                      />
                      E-mail
                    </label>
                  </div>
                </section>
              )}

              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800"
              >
                Guardar Todas as Configurações
              </button>
            </form>

            {/* Feriados */}
            <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
              <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                Feriados e Dias de Encerramento
              </h2>
              <form onSubmit={addHoliday} className="flex flex-wrap gap-3">
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Nome do feriado / motivo"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="px-3 py-2 text-sm border border-zinc-200 rounded-lg flex-1 min-w-[200px]"
                />
                <button type="submit" className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg">
                  Adicionar Feriado
                </button>
              </form>
              <div className="divide-y divide-zinc-100">
                {data.holidays.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between text-sm">
                    <span>
                      <span className="font-mono text-xs text-zinc-600">{formatDatePt(h.date)}</span> · {h.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeHoliday(h.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Fila de Notificações */}
            <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
                Fila de Notificações Desacoplada ({data.notifications.length})
              </div>
              <div className="divide-y divide-zinc-100">
                {data.notifications.map((n) => (
                  <div key={n.id} className="px-5 py-3 text-xs flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">
                        {n.channel} · {n.event_type} · {n.recipient}
                      </p>
                      <p className="text-zinc-600 mt-0.5">{n.message}</p>
                    </div>
                    <span className="font-mono text-zinc-500 shrink-0">{n.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )
      }
    </GestaoShell>
  );
}
