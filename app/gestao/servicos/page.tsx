'use client';

import { useEffect, useState, useCallback } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import { Plus } from 'lucide-react';
import { formatKz } from '@/lib/utils/time';

interface ServiceRow {
  id: string;
  category_id: string | null;
  category_name: string | null;
  name: string;
  description: string;
  price_kz: number;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: number;
}

export default function ServicosPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    priceKz: 10000,
    durationMinutes: 60,
    bufferMinutes: 15,
    professionalIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [svcRes, proRes] = await Promise.all([
      fetch('/api/gestao/services'),
      fetch('/api/gestao/professionals'),
    ]);
    const [svcJson, proJson] = await Promise.all([svcRes.json(), proRes.json()]);
    setServices(svcJson.services || []);
    setCategories(svcJson.categories || []);
    setProfessionals(proJson.professionals || []);
    if (!form.categoryId && (svcJson.categories || []).length > 0) {
      setForm((f) => ({ ...f, categoryId: svcJson.categories[0].id }));
    }
    setLoading(false);
  }, [form.categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/gestao/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowModal(false);
      setForm({
        name: '',
        description: '',
        categoryId: categories[0]?.id || '',
        priceKz: 10000,
        durationMinutes: 60,
        bufferMinutes: 15,
        professionalIds: [],
      });
      await load();
    }
  }

  async function toggleActive(svc: ServiceRow) {
    await fetch('/api/gestao/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: svc.id, isActive: svc.is_active !== 1 }),
    });
    await load();
  }

  return (
    <GestaoShell title="Serviços & Categorias">
      {({ user }) => (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-2xl sm:text-[26px] font-bold tracking-tight text-zinc-900">
                Serviços &amp; Categorias
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Serviços inativos deixam de aparecer para novas marcações mantendo o histórico intacto.
              </p>
            </div>
            {user.role === 'OWNER' && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 inline-flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Serviço
              </button>
            )}
          </div>

          <div className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-sm text-zinc-500">A carregar catálogo...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FAFAFB] border-b border-zinc-200/80 text-xs text-zinc-500">
                    <tr>
                      <th className="px-5 py-3.5 font-medium">Serviço</th>
                      <th className="px-5 py-3.5 font-medium">Categoria</th>
                      <th className="px-5 py-3.5 font-medium text-right">Duração + Prep.</th>
                      <th className="px-5 py-3.5 font-medium text-right">Preço</th>
                      <th className="px-5 py-3.5 font-medium text-right">Estado</th>
                      {user.role === 'OWNER' && <th className="px-5 py-3.5 font-medium text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {services.map((svc) => (
                      <tr key={svc.id} className="hover:bg-[#FAFAFB] transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-zinc-900">{svc.name}</p>
                          <p className="text-xs text-zinc-500 line-clamp-1">{svc.description}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#EBE5FF] text-[#352375] text-[11px] font-medium">
                            {svc.category_name || 'Geral'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-zinc-700 tabular-nums">
                          {svc.duration_minutes}m {svc.buffer_minutes > 0 ? `+ ${svc.buffer_minutes}m` : ''}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-zinc-900 tabular-nums">
                          {formatKz(svc.price_kz)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-xs">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                              svc.is_active ? 'bg-[#D8F5E3] text-[#12532E]' : 'bg-zinc-100 text-zinc-500'
                            }`}
                          >
                            {svc.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        {user.role === 'OWNER' && (
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => toggleActive(svc)}
                              className="px-3 py-1 text-xs font-medium border border-zinc-200 rounded-full hover:bg-[#F7F7F8] transition-colors cursor-pointer"
                            >
                              {svc.is_active ? 'Desativar' : 'Ativar'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
              <form
                onSubmit={handleCreate}
                className="bg-white border border-zinc-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Criar Novo Serviço
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Nome do serviço"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    placeholder="Descrição breve"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl focus:outline-none focus:bg-white"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-zinc-600 mb-1">Preço (Kz)</label>
                      <input
                        type="number"
                        min={100}
                        required
                        value={form.priceKz}
                        onChange={(e) => setForm({ ...form, priceKz: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-600 mb-1">Duração (min)</label>
                      <input
                        type="number"
                        min={10}
                        required
                        value={form.durationMinutes}
                        onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-600 mb-1">Intervalo (min)</label>
                      <input
                        type="number"
                        min={0}
                        value={form.bufferMinutes}
                        onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-sm bg-[#F7F7F8] border border-zinc-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-zinc-700">Profissionais habilitadas:</p>
                    <div className="space-y-1.5 bg-[#F7F7F8] border border-zinc-200 rounded-xl p-2.5">
                      {professionals.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-xs text-zinc-700">
                          <input
                            type="checkbox"
                            checked={form.professionalIds.includes(p.id)}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                professionalIds: e.target.checked
                                  ? [...form.professionalIds, p.id]
                                  : form.professionalIds.filter((id) => id !== p.id),
                              })
                            }
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-full hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-[#18181B] text-white rounded-full hover:bg-zinc-800 cursor-pointer"
                  >
                    Guardar Serviço
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
