'use client';

import { useEffect, useState, useCallback } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import { Calendar, Plus, Ban, RefreshCw, Trash2 } from 'lucide-react';
import { formatDatePt, formatKz } from '@/lib/utils/time';
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/types/domain';

interface ApptRow {
  id: string;
  booking_code: string;
  date: string;
  start_time: string;
  end_time: string;
  service_end_time: string;
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
  services: Array<{ service_id: string; service_name: string; price_kz: number; duration_minutes: number }>;
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

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<ApptRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string; price_kz: number; duration_minutes: number }>>([]);
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([]);

  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Modal Nova Marcação
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    serviceId: '',
    professionalId: 'any',
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    customerName: '',
    customerPhone: '+244 9',
    notes: '',
    bypassMinAdvance: true,
  });

  // Modal Bloqueio
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({
    professionalId: 'ALL',
    date: new Date().toISOString().slice(0, 10),
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterDate) qs.set('date', filterDate);
      if (filterStatus !== 'ALL') qs.set('status', filterStatus);

      const [apptRes, blkRes, svcRes, proRes] = await Promise.all([
        fetch(`/api/gestao/appointments?${qs.toString()}`),
        fetch(`/api/gestao/blocks${filterDate ? `?date=${filterDate}` : ''}`),
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
  }, [filterDate, filterStatus, newForm.serviceId]);

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

  return (
    <GestaoShell title="Agenda & Marcações">
      {({ user }) => (
        <div className="space-y-6">
          {/* Barra de filtros e ações */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg"
                />
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate('')}
                    className="text-xs text-zinc-500 hover:text-zinc-900"
                  >
                    Todas as datas
                  </button>
                )}
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                <option value="ALL">Todos os estados</option>
                <option value="PENDING">Pendente</option>
                <option value="CONFIRMED">Confirmado</option>
                <option value="IN_PROGRESS">Em atendimento</option>
                <option value="COMPLETED">Concluído</option>
                <option value="CANCELLED">Cancelado</option>
                <option value="NO_SHOW">Não compareceu</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBlockModal(true)}
                className="px-3.5 py-2 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 inline-flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                Bloquear Horário
              </button>
              {user.role !== 'PROFESSIONAL' && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="px-3.5 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nova Marcação
                </button>
              )}
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl border text-sm ${
                feedback.type === 'err'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          {/* Tabela de Agendamentos */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">
                Marcações registadas ({appointments.length})
              </h2>
              <button type="button" onClick={loadAll} className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </button>
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
                  <div key={appt.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono font-semibold text-violet-700">{appt.booking_code}</span>
                        <span className="text-zinc-300">·</span>
                        <span className="font-semibold text-zinc-900">{appt.customer_name}</span>
                        <span className="font-mono text-xs text-zinc-500">{appt.customer_phone}</span>
                      </div>
                      <p className="text-xs text-zinc-600 tabular-nums">
                        {formatDatePt(appt.date)} · {appt.start_time}–{appt.service_end_time}
                        {appt.total_buffer_minutes > 0 ? ` (prep. até ${appt.end_time})` : ''} ·{' '}
                        <span className="font-medium text-zinc-800">{appt.professional_name}</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {appt.services.map((s) => `${s.service_name} (${s.duration_minutes}m)`).join(' + ')} ·{' '}
                        <span className="font-mono text-zinc-800">{formatKz(appt.total_price_kz)}</span> · Estado:{' '}
                        <span className="font-medium text-zinc-900">{STATUS_LABELS[appt.status]}</span>
                      </p>
                      {appt.history && appt.history.length > 0 && (
                        <p className="text-[11px] text-zinc-400">
                          Último registo: {appt.history[0].to_status} por {appt.history[0].changed_by}
                          {appt.history[0].previous_start_time
                            ? ` (antes ${appt.history[0].previous_date} ${appt.history[0].previous_start_time})`
                            : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {appt.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'CONFIRMED')}
                          className="px-3 py-1.5 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800"
                        >
                          Confirmar
                        </button>
                      )}
                      {appt.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'IN_PROGRESS')}
                          className="px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
                        >
                          Iniciar
                        </button>
                      )}
                      {(appt.status === 'CONFIRMED' || appt.status === 'IN_PROGRESS') && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'COMPLETED')}
                          className="px-3 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
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
                            className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50"
                          >
                            Reagendar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(appt.id, 'NO_SHOW')}
                            className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50"
                          >
                            Faltou
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(appt.id, 'CANCELLED')}
                            className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
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

          {/* Bloqueios de Horário */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-200">
              <h2 className="text-sm font-semibold text-zinc-900">Bloqueios manuais da agenda ({blocks.length})</h2>
            </div>
            {blocks.length === 0 ? (
              <div className="p-6 text-sm text-zinc-500">Sem bloqueios registados.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {blocks.map((b) => (
                  <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <span className="font-mono text-xs text-zinc-700 tabular-nums">
                        {formatDatePt(b.date)} · {b.start_time}–{b.end_time}
                      </span>
                      <span className="text-zinc-300 mx-2">·</span>
                      <span className="font-medium text-zinc-900">{b.professional_name || 'Todo o salão'}</span>
                      <span className="text-zinc-300 mx-2">·</span>
                      <span className="text-zinc-600">{b.reason}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(b.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-600"
                      title="Remover bloqueio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Nova Marcação */}
          {showNewModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <form
                onSubmit={handleCreateBooking}
                className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 space-y-4"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Criar Marcação Interna
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Serviço</label>
                    <select
                      value={newForm.serviceId}
                      onChange={(e) => setNewForm({ ...newForm, serviceId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.duration_minutes} min · {formatKz(s.price_kz)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Profissional</label>
                    <select
                      value={newForm.professionalId}
                      onChange={(e) => setNewForm({ ...newForm, professionalId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
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
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Hora (HH:MM)</label>
                      <input
                        type="time"
                        required
                        value={newForm.startTime}
                        onChange={(e) => setNewForm({ ...newForm, startTime: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Nome da cliente"
                    value={newForm.customerName}
                    onChange={(e) => setNewForm({ ...newForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Telefone (+244 9...)"
                    value={newForm.customerPhone}
                    onChange={(e) => setNewForm({ ...newForm, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800"
                  >
                    Confirmar Marcação
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal Bloqueio */}
          {showBlockModal && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <form
                onSubmit={handleCreateBlock}
                className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 space-y-4"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Bloquear Período da Agenda
                </h3>
                <div className="space-y-3">
                  <select
                    value={blockForm.professionalId}
                    onChange={(e) => setBlockForm({ ...blockForm, professionalId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="time"
                      required
                      value={blockForm.startTime}
                      onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                    />
                    <input
                      type="time"
                      required
                      value={blockForm.endTime}
                      onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                    />
                  </div>
                  <select
                    value={blockForm.blockType}
                    onChange={(e) => setBlockForm({ ...blockForm, blockType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
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
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg"
                  >
                    Guardar Bloqueio
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Modal Reagendamento */}
          {rescheduleTarget && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
              <form
                onSubmit={handleReschedule}
                className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 space-y-4"
              >
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                  Reagendar {rescheduleTarget.booking_code}
                </h3>
                <p className="text-xs text-zinc-500">
                  O horário atual só é libertado após validação do novo período sem conflitos.
                </p>
                <div className="space-y-3">
                  <input
                    type="date"
                    required
                    value={rescheduleForm.newDate}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="time"
                    required
                    value={rescheduleForm.newStartTime}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, newStartTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                  <select
                    value={rescheduleForm.newProfessionalId}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, newProfessionalId: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
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
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRescheduleTarget(null)}
                    className="px-4 py-2 text-xs font-medium border border-zinc-200 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg"
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
