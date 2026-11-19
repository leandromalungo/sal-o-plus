'use client';

import { useEffect, useState, useCallback } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import { Plus, Search } from 'lucide-react';
import { formatDatePt, formatKz } from '@/lib/utils/time';
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/types/domain';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  preferences: string | null;
  notes: string | null;
  total_appointments: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  appointments: Array<{
    id: string;
    booking_code: string;
    date: string;
    start_time: string;
    status: AppointmentStatus;
    total_price_kz: number;
    professional_name: string;
  }>;
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '+244 9',
    email: '',
    preferences: '',
    notes: '',
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    const res = await fetch(`/api/gestao/customers${qs}`);
    const json = await res.json();
    setCustomers(json.customers || []);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const res = await fetch('/api/gestao/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      setShowNew(false);
      setForm({ name: '', phone: '+244 9', email: '', preferences: '', notes: '' });
      setFeedback(
        json.deduplicated
          ? 'Telefone já registado: ficha existente atualizada sem duplicação.'
          : 'Cliente registada com sucesso.'
      );
      await load();
    }
  }

  return (
    <GestaoShell title="Clientes">
      {() => (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-[26px] font-bold tracking-tight text-zinc-900">
                Clientes
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Histórico de visitas, preferências e contactos das clientes do salão.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Registar Cliente
            </button>
          </div>

          <div className="bg-[#F7F7F8] border border-zinc-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome ou telefone..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-zinc-200 rounded-full focus:outline-none focus:border-zinc-400"
              />
            </div>
            <span className="px-3 py-1 rounded-full bg-white border border-zinc-200 text-xs font-medium text-zinc-600 tabular-nums">
              {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>

          {feedback && (
            <div className="p-3.5 rounded-2xl bg-[#D8F5E3] border border-emerald-200 text-sm text-[#12532E]">
              {feedback}
            </div>
          )}

          <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-zinc-500">A carregar clientes...</div>
            ) : customers.length === 0 ? (
              <div className="p-10 text-center text-sm text-zinc-500">Nenhuma cliente encontrada.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {customers.map((c) => {
                  const initials = c.name
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase();
                  return (
                    <div key={c.id} className="p-5 space-y-3 hover:bg-[#FAFAFB] transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-[#EBE5FF] text-[#352375] text-xs font-semibold flex items-center justify-center shrink-0">
                            {initials || 'CL'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-zinc-900">{c.name}</h3>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5">
                              {c.phone}
                              {c.email ? ` · ${c.email}` : ''}
                            </p>
                            {(c.preferences || c.notes) && (
                              <p className="text-xs text-zinc-600 mt-1.5">
                                {c.preferences ? `Preferências: ${c.preferences}` : ''}
                                {c.preferences && c.notes ? ' · ' : ''}
                                {c.notes ? `Obs.: ${c.notes}` : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium tabular-nums">
                          <span className="px-2.5 py-1 rounded-full bg-[#F7F7F8] text-zinc-700">
                            {c.total_appointments} visitas
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-[#D8F5E3] text-[#12532E]">
                            {c.completed_count} concluídas
                          </span>
                          {c.cancelled_count > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-[#FCEFD9] text-[#6B4A14]">
                              {c.cancelled_count} cancelamentos
                            </span>
                          )}
                          {c.no_show_count > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                              {c.no_show_count} faltas
                            </span>
                          )}
                        </div>
                      </div>

                      {c.appointments.length > 0 && (
                        <div className="pt-2.5 border-t border-zinc-100 flex flex-wrap gap-2 text-xs text-zinc-600">
                          {c.appointments.slice(0, 3).map((a) => (
                            <span
                              key={a.id}
                              className="px-2.5 py-1 rounded-lg bg-[#F7F7F8] tabular-nums inline-flex items-center gap-1.5"
                            >
                              <span className="font-mono font-medium text-zinc-900">{a.booking_code}</span>
                              <span>
                                · {formatDatePt(a.date)} {a.start_time} · {STATUS_LABELS[a.status]} ·{' '}
                                <span className="font-mono">{formatKz(a.total_price_kz)}</span>
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {showNew && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
              <form
                onSubmit={handleSave}
                className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Nova Cliente
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Nome completo"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Telefone (+244 9...)"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                  <input
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Preferências (ex.: estilo, alergias)"
                    value={form.preferences}
                    onChange={(e) => setForm({ ...form, preferences: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                  <textarea
                    rows={2}
                    placeholder="Observações"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNew(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                  >
                    Guardar Cliente
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
