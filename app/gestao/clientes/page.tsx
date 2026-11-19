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
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar por nome ou telefone..."
                className="w-full pl-9 pr-3.5 py-2 text-sm border border-zinc-200 rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="px-3.5 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Registar Cliente
            </button>
          </div>

          {feedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              {feedback}
            </div>
          )}

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-zinc-500">A carregar clientes...</div>
            ) : customers.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">Nenhuma cliente encontrada.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {customers.map((c) => (
                  <div key={c.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-zinc-900">{c.name}</h3>
                        <p className="text-xs text-zinc-600 font-mono mt-0.5">
                          {c.phone}
                          {c.email ? ` · ${c.email}` : ''}
                        </p>
                        {(c.preferences || c.notes) && (
                          <p className="text-xs text-zinc-500 mt-1">
                            {c.preferences ? `Preferências: ${c.preferences}` : ''}
                            {c.preferences && c.notes ? ' · ' : ''}
                            {c.notes ? `Obs.: ${c.notes}` : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-zinc-600 font-mono tabular-nums">
                        <span>{c.total_appointments} visitas</span>
                        <span>·</span>
                        <span>{c.completed_count} concluídas</span>
                        <span>·</span>
                        <span>{c.cancelled_count} cancelamentos</span>
                        <span>·</span>
                        <span>{c.no_show_count} faltas</span>
                      </div>
                    </div>

                    {c.appointments.length > 0 && (
                      <div className="pt-2 border-t border-zinc-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
                        {c.appointments.slice(0, 3).map((a) => (
                          <span key={a.id} className="tabular-nums">
                            <span className="font-mono text-zinc-700">{a.booking_code}</span> ({formatDatePt(a.date)} {a.start_time}) ·{' '}
                            {STATUS_LABELS[a.status]} · {formatKz(a.total_price_kz)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {showNew && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 space-y-4">
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
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Telefone (+244 9...)"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Preferências (ex.: estilo, alergias)"
                    value={form.preferences}
                    onChange={(e) => setForm({ ...form, preferences: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <textarea
                    rows={2}
                    placeholder="Observações"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNew(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg">
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
