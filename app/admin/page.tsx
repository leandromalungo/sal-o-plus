'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ExternalLink } from 'lucide-react';
import { formatKz } from '@/lib/utils/time';
import { ROLE_LABELS, type UserRole } from '@/lib/types/domain';

interface AdminPayload {
  indicators: {
    total_salons: number;
    active_salons: number;
    total_appointments: number;
    mrr_kz: number;
  };
  salons: Array<{
    id: string;
    name: string;
    slug: string;
    city: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
    plan_name: string;
    monthly_price_kz: number;
    total_appointments: number;
    total_customers: number;
    active_professionals: number;
    gmv_kz: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: UserRole;
    salon_name: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    actor_name: string | null;
    action: string;
    entity_type: string;
    details: string | null;
    created_at: string;
  }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/salons');
    if (res.status === 401) {
      router.replace('/login');
      return;
    }
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Sem acesso ao painel Super Admin.');
      return;
    }
    setData(json);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateSalon(salonId: string, patch: { status?: string; planName?: string }) {
    await fetch('/api/admin/salons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salonId, ...patch }),
    });
    await load();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#fafafc] text-zinc-900">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-[family-name:var(--font-jakarta)] text-lg font-bold">
              Salão<span className="text-violet-700">+</span>
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="text-sm font-medium text-zinc-700">Admin Plataforma</span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-red-700"
          >
            <LogOut className="w-4 h-4" />
            Terminar sessão
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {error ? (
          <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        ) : !data ? (
          <p className="text-sm text-zinc-500">A carregar indicadores globais...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                <p className="text-xs text-zinc-500">Salões registados</p>
                <p className="font-mono text-2xl font-semibold tabular-nums mt-1">
                  {data.indicators.total_salons}
                </p>
              </div>
              <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                <p className="text-xs text-zinc-500">Salões ativos</p>
                <p className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1">
                  {data.indicators.active_salons}
                </p>
              </div>
              <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                <p className="text-xs text-zinc-500">Marcações na plataforma</p>
                <p className="font-mono text-2xl font-semibold tabular-nums mt-1">
                  {data.indicators.total_appointments}
                </p>
              </div>
              <div className="p-5 bg-white border border-zinc-200 rounded-xl">
                <p className="text-xs text-zinc-500">Receita recorrente (MRR)</p>
                <p className="font-mono text-2xl font-semibold text-violet-700 tabular-nums mt-1">
                  {formatKz(data.indicators.mrr_kz)}
                </p>
              </div>
            </div>

            <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200">
                <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold">
                  Estabelecimentos Registados &amp; Subscrições
                </h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {data.salons.map((s) => (
                  <div key={s.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-900">{s.name}</h3>
                        <Link
                          href={`/salao/${s.slug}`}
                          target="_blank"
                          className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"
                        >
                          /salao/{s.slug}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1 font-mono tabular-nums">
                        {s.city} · {s.active_professionals} profissionais · {s.total_customers} clientes ·{' '}
                        {s.total_appointments} marcações · GMV {formatKz(s.gmv_kz)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={s.plan_name}
                        onChange={(e) => updateSalon(s.id, { planName: e.target.value })}
                        className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white"
                      >
                        <option value="Essencial">Essencial (25.000 Kz)</option>
                        <option value="Profissional">Profissional (45.000 Kz)</option>
                        <option value="Enterprise">Enterprise (85.000 Kz)</option>
                      </select>

                      <select
                        value={s.status}
                        onChange={(e) => updateSalon(s.id, { status: e.target.value })}
                        className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white"
                      >
                        <option value="ACTIVE">Ativo</option>
                        <option value="SUSPENDED">Suspenso</option>
                        <option value="INACTIVE">Desativado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 text-sm font-semibold">
                  Utilizadores da Plataforma
                </div>
                <div className="divide-y divide-zinc-100">
                  {data.users.map((u) => (
                    <div key={u.id} className="px-5 py-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-zinc-900">{u.name}</p>
                        <p className="font-mono text-zinc-500">{u.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-zinc-800">{ROLE_LABELS[u.role]}</p>
                        <p className="text-zinc-500">{u.salon_name || 'Global'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 text-sm font-semibold">
                  Auditoria Recente
                </div>
                <div className="divide-y divide-zinc-100">
                  {data.auditLogs.slice(0, 12).map((log) => (
                    <div key={log.id} className="px-5 py-3 text-xs">
                      <p className="font-medium text-zinc-900">
                        {log.action} · <span className="text-zinc-500">{log.actor_name || 'Sistema'}</span>
                      </p>
                      {log.details && <p className="text-zinc-500 mt-0.5">{log.details}</p>}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
