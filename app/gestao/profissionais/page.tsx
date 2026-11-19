'use client';

import { useEffect, useState, useCallback } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import { Plus } from 'lucide-react';
import { DAY_NAMES_PT } from '@/lib/utils/time';

interface ProRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  specialties: string;
  commission_rate: number | null;
  is_active: number;
  workingHours: Array<{
    day_of_week: number;
    is_working: number;
    start_time: string;
    end_time: string;
    lunch_start: string | null;
    lunch_end: string | null;
  }>;
  serviceIds: string[];
}

export default function ProfissionaisPage() {
  const [pros, setPros] = useState<ProRow[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editingPro, setEditingPro] = useState<ProRow | null>(null);

  const [newForm, setNewForm] = useState({
    name: '',
    phone: '+244 9',
    email: '',
    specialties: '',
    commissionRate: 40,
    createAccount: false,
    password: '',
    serviceIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [proRes, svcRes] = await Promise.all([
      fetch('/api/gestao/professionals'),
      fetch('/api/gestao/services'),
    ]);
    const [proJson, svcJson] = await Promise.all([proRes.json(), svcRes.json()]);
    setPros(proJson.professionals || []);
    setServices(svcJson.services || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/gestao/professionals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    });
    if (res.ok) {
      setShowNew(false);
      setNewForm({
        name: '',
        phone: '+244 9',
        email: '',
        specialties: '',
        commissionRate: 40,
        createAccount: false,
        password: '',
        serviceIds: [],
      });
      await load();
    }
  }

  async function toggleActive(pro: ProRow) {
    await fetch('/api/gestao/professionals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pro.id, isActive: pro.is_active !== 1 }),
    });
    await load();
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPro) return;
    await fetch('/api/gestao/professionals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingPro.id,
        commissionRate: editingPro.commission_rate ?? 40,
        workingHours: editingPro.workingHours,
        serviceIds: editingPro.serviceIds,
      }),
    });
    setEditingPro(null);
    await load();
  }

  return (
    <GestaoShell title="Profissionais">
      {({ user }) => (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-600">
              Configure turnos individuais, almoço, dias de folga, serviços autorizados e comissões.
            </p>
            {user.role === 'OWNER' && (
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="px-3.5 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800 inline-flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Profissional
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-zinc-500">A carregar equipa...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {pros.map((pro) => (
                <div key={pro.id} className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={pro.avatar_url || '/images/pro_avatar_one_1795068461594.jpg'}
                        alt={pro.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border border-zinc-200 shrink-0"
                      />
                      <div>
                        <h3 className="font-semibold text-zinc-900">{pro.name}</h3>
                        <p className="text-xs text-zinc-500">{pro.specialties}</p>
                        <p className="font-mono text-xs text-zinc-500 mt-0.5">
                          {pro.phone}
                          {pro.commission_rate !== null ? ` · Comissão ${pro.commission_rate}%` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${pro.is_active ? 'text-emerald-700' : 'text-zinc-400'}`}>
                      {pro.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-600 space-y-1 border-t border-zinc-100 pt-3">
                    {pro.workingHours.slice(1, 7).map((wh) => (
                      <div key={wh.day_of_week} className="flex justify-between tabular-nums">
                        <span>{DAY_NAMES_PT[wh.day_of_week]}</span>
                        <span className="font-mono">
                          {wh.is_working
                            ? `${wh.start_time}–${wh.end_time}${wh.lunch_start ? ` (Almoço ${wh.lunch_start}–${wh.lunch_end})` : ''}`
                            : 'Folga'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {user.role === 'OWNER' && (
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPro(pro)}
                        className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50"
                      >
                        Editar Escala &amp; Serviços
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(pro)}
                        className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50"
                      >
                        {pro.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showNew && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <form onSubmit={handleCreate} className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 space-y-4">
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold">Nova Profissional</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Nome completo"
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Telefone (+244 9...)"
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Especialidades (ex.: Tranças, Manicure)"
                    value={newForm.specialties}
                    onChange={(e) => setNewForm({ ...newForm, specialties: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Comissão (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newForm.commissionRate}
                      onChange={(e) => setNewForm({ ...newForm, commissionRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-zinc-700">Serviços habilitados:</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 border border-zinc-200 rounded-lg p-2">
                      {services.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 text-xs text-zinc-700">
                          <input
                            type="checkbox"
                            checked={newForm.serviceIds.includes(s.id)}
                            onChange={(e) =>
                              setNewForm({
                                ...newForm,
                                serviceIds: e.target.checked
                                  ? [...newForm.serviceIds, s.id]
                                  : newForm.serviceIds.filter((id) => id !== s.id),
                              })
                            }
                          />
                          <span>{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={newForm.createAccount}
                      onChange={(e) => setNewForm({ ...newForm, createAccount: e.target.checked })}
                    />
                    Criar conta individual de acesso à agenda
                  </label>
                  {newForm.createAccount && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        required
                        placeholder="E-mail"
                        value={newForm.email}
                        onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                        className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                      />
                      <input
                        type="password"
                        required
                        placeholder="Palavra-passe"
                        value={newForm.password}
                        onChange={(e) => setNewForm({ ...newForm, password: e.target.value })}
                        className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                      />
                    </div>
                  )}
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
                    Guardar Profissional
                  </button>
                </div>
              </form>
            </div>
          )}

          {editingPro && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveSchedule}
                className="bg-white border border-zinc-200 rounded-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold">
                  Escala &amp; Serviços · {editingPro.name}
                </h3>

                <div className="space-y-2">
                  {editingPro.workingHours.map((wh, idx) => (
                    <div key={wh.day_of_week} className="grid grid-cols-12 gap-2 items-center text-xs">
                      <label className="col-span-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={wh.is_working === 1}
                          onChange={(e) => {
                            const copy = [...editingPro.workingHours];
                            copy[idx] = { ...wh, is_working: e.target.checked ? 1 : 0 };
                            setEditingPro({ ...editingPro, workingHours: copy });
                          }}
                        />
                        <span>{DAY_NAMES_PT[wh.day_of_week]}</span>
                      </label>
                      <input
                        type="time"
                        disabled={wh.is_working !== 1}
                        value={wh.start_time}
                        onChange={(e) => {
                          const copy = [...editingPro.workingHours];
                          copy[idx] = { ...wh, start_time: e.target.value };
                          setEditingPro({ ...editingPro, workingHours: copy });
                        }}
                        className="col-span-4 px-2 py-1 border border-zinc-200 rounded"
                      />
                      <input
                        type="time"
                        disabled={wh.is_working !== 1}
                        value={wh.end_time}
                        onChange={(e) => {
                          const copy = [...editingPro.workingHours];
                          copy[idx] = { ...wh, end_time: e.target.value };
                          setEditingPro({ ...editingPro, workingHours: copy });
                        }}
                        className="col-span-4 px-2 py-1 border border-zinc-200 rounded"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                  <p className="text-xs font-medium text-zinc-700">Serviços associados:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {services.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={editingPro.serviceIds.includes(s.id)}
                          onChange={(e) =>
                            setEditingPro({
                              ...editingPro,
                              serviceIds: e.target.checked
                                ? [...editingPro.serviceIds, s.id]
                                : editingPro.serviceIds.filter((id) => id !== s.id),
                            })
                          }
                        />
                        <span className="truncate">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingPro(null)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg">
                    Guardar Alterações
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
