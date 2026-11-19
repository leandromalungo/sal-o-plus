'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Search,
  RefreshCw,
} from 'lucide-react';
import { DAY_NAMES_PT, formatDatePt, formatKz } from '@/lib/utils/time';
import { STATUS_LABELS, type AppointmentStatus } from '@/lib/types/domain';

interface PublicSalonPayload {
  salon: {
    id: string;
    name: string;
    slug: string;
    description: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    coverUrl: string | null;
    slotIntervalMinutes: number;
    minAdvanceHours: number;
    maxAdvanceDays: number;
    minCancelHours: number;
    pendingHoldMinutes: number;
    allowClientCancel: boolean;
    isTemporarilyClosed: boolean;
    closureReason: string | null;
  };
  categories: Array<{ id: string; name: string }>;
  services: Array<{
    id: string;
    category_id: string | null;
    name: string;
    description: string;
    price_kz: number;
    duration_minutes: number;
    buffer_minutes: number;
  }>;
  professionals: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    specialties: string;
  }>;
  professionalServices: Array<{ professional_id: string; service_id: string }>;
  workingHours: Array<{
    day_of_week: number;
    is_open: number;
    open_time: string;
    close_time: string;
  }>;
  suggestedDate: string;
}

interface SlotItem {
  time: string;
  endTime: string;
  blockedUntil: string;
  availableProfessionalIds: string[];
  recommendedProfessionalId: string;
}

interface BookingReceipt {
  appointment: {
    id: string;
    bookingCode: string;
    date: string;
    startTime: string;
    serviceEndTime: string;
    totalDurationMinutes: number;
    totalPriceKz: number;
    status: AppointmentStatus;
    holdExpiresAt: string | null;
  };
  professionalName: string;
  customerName: string;
}

interface LookupAppointment {
  id: string;
  bookingCode: string;
  date: string;
  startTime: string;
  serviceEndTime: string;
  totalDurationMinutes: number;
  totalPriceKz: number;
  status: AppointmentStatus;
  holdExpiresAt: string | null;
  professionalId: string;
  professionalName: string;
  customerName: string;
  customerPhone: string;
  services: Array<{ service_id: string; service_name: string; price_kz: number; duration_minutes: number }>;
}

export default function PublicBookingClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicSalonPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'book' | 'manage'>('book');

  // Estado da marcação
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('any');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('+244 9');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [asPendingHold, setAsPendingHold] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);

  // Estado de consulta / reagendamento / cancelamento
  const [lookupCode, setLookupCode] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundBooking, setFoundBooking] = useState<LookupAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotItem[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [manageFeedback, setManageFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/salons/${slug}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Salão indisponível');
        return json as PublicSalonPayload;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setSelectedDate(payload.suggestedDate);
        if (payload.services.length > 0) {
          setSelectedServiceIds([payload.services[0].id]);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar salão.');
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const fetchAvailability = useCallback(async () => {
    if (!data || !selectedDate || selectedServiceIds.length === 0) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setClosedReason(null);
    try {
      const qs = new URLSearchParams({
        date: selectedDate,
        serviceIds: selectedServiceIds.join(','),
        professionalId: selectedProfessionalId,
      });
      const res = await fetch(`/api/public/salons/${slug}/availability?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setClosedReason(json.error || 'Erro ao verificar horários.');
        setSlots([]);
      } else {
        setSlots(json.slots || []);
        setClosedReason(json.salonClosedReason || null);
        if (selectedTime && !(json.slots || []).some((s: SlotItem) => s.time === selectedTime)) {
          setSelectedTime('');
        }
      }
    } catch {
      setClosedReason('Não foi possível consultar disponibilidade.');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [data, selectedDate, selectedServiceIds, selectedProfessionalId, slug, selectedTime]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const eligibleProfessionals = useMemo(() => {
    if (!data) return [];
    if (selectedServiceIds.length === 0) return data.professionals;
    return data.professionals.filter((pro) =>
      selectedServiceIds.every((sid) =>
        data.professionalServices.some((ps) => ps.professional_id === pro.id && ps.service_id === sid)
      )
    );
  }, [data, selectedServiceIds]);

  useEffect(() => {
    if (
      selectedProfessionalId !== 'any' &&
      !eligibleProfessionals.some((p) => p.id === selectedProfessionalId)
    ) {
      setSelectedProfessionalId('any');
    }
  }, [eligibleProfessionals, selectedProfessionalId]);

  const selectedServicesSummary = useMemo(() => {
    if (!data) return { count: 0, totalDuration: 0, totalPriceKz: 0, names: [] as string[] };
    const chosen = data.services.filter((s) => selectedServiceIds.includes(s.id));
    return {
      count: chosen.length,
      totalDuration: chosen.reduce((acc, s) => acc + s.duration_minutes, 0),
      totalPriceKz: chosen.reduce((acc, s) => acc + s.price_kz, 0),
      names: chosen.map((s) => s.name),
    };
  }, [data, selectedServiceIds]);

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((item) => item !== id) : prev) : [...prev, id]
    );
    setSelectedTime('');
  }

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTime || selectedServiceIds.length === 0) {
      setSubmitError('Selecione o serviço e um horário disponível.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/public/salons/${slug}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedServiceIds,
          professionalId: selectedProfessionalId,
          date: selectedDate,
          startTime: selectedTime,
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          notes: notes || null,
          asPendingHold,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || 'Não foi possível concluir a marcação.');
        await fetchAvailability();
        setSubmitting(false);
        return;
      }
      setReceipt(json as BookingReceipt);
      setSelectedTime('');
      await fetchAvailability();
    } catch {
      setSubmitError('Erro de ligação ao confirmar marcação.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);
    setManageFeedback(null);
    try {
      const qs = new URLSearchParams({ code: lookupCode.trim(), phone: lookupPhone.trim() });
      const res = await fetch(`/api/public/salons/${slug}/bookings?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setLookupError(json.error || 'Marcação não encontrada.');
        setFoundBooking(null);
      } else {
        setFoundBooking(json.appointment);
        setRescheduleDate(json.appointment.date);
      }
    } catch {
      setLookupError('Erro ao consultar marcação.');
    } finally {
      setLookupLoading(false);
    }
  }

  useEffect(() => {
    if (!foundBooking || !rescheduleDate || foundBooking.services.length === 0) return;
    const qs = new URLSearchParams({
      date: rescheduleDate,
      serviceIds: foundBooking.services.map((s) => s.service_id).join(','),
      professionalId: foundBooking.professionalId,
    });
    fetch(`/api/public/salons/${slug}/availability?${qs.toString()}`)
      .then((r) => r.json())
      .then((j) => setRescheduleSlots(j.slots || []))
      .catch(() => setRescheduleSlots([]));
  }, [foundBooking, rescheduleDate, slug]);

  async function handleClientAction(action: 'CANCEL' | 'CONFIRM_HOLD' | 'RESCHEDULE') {
    if (!foundBooking) return;
    setLookupLoading(true);
    setLookupError(null);
    setManageFeedback(null);
    try {
      const res = await fetch(`/api/public/salons/${slug}/bookings/${foundBooking.bookingCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: lookupPhone.trim(),
          action,
          newDate: rescheduleDate,
          newStartTime: rescheduleTime,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLookupError(json.error || 'Operação recusada.');
      } else {
        setManageFeedback(
          action === 'CANCEL'
            ? 'Marcação cancelada com sucesso. O horário foi libertado.'
            : action === 'CONFIRM_HOLD'
            ? 'Reserva confirmada definitivamente.'
            : 'Marcação reagendada com sucesso.'
        );
        // Atualiza dados da consulta
        const refresh = await fetch(
          `/api/public/salons/${slug}/bookings?${new URLSearchParams({
            code: foundBooking.bookingCode,
            phone: lookupPhone.trim(),
          }).toString()}`
        );
        const refreshed = await refresh.json();
        if (refresh.ok) setFoundBooking(refreshed.appointment);
      }
    } catch {
      setLookupError('Erro de ligação.');
    } finally {
      setLookupLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#fafafc] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h1 className="text-lg font-semibold text-zinc-900">Página indisponível</h1>
          <p className="text-sm text-zinc-600">{loadError}</p>
          <Link href="/" className="inline-block text-sm font-medium text-violet-700 hover:underline">
            Voltar ao Salão+
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fafafc] flex items-center justify-center p-6">
        <p className="text-sm text-zinc-500">A carregar agenda e serviços do salão...</p>
      </div>
    );
  }

  const { salon, categories, services, workingHours } = data;

  return (
    <div className="min-h-screen bg-[#fafafc] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 whitespace-nowrap">
              Salão+
            </Link>
            <span className="text-zinc-300">/</span>
            <span className="font-[family-name:var(--font-jakarta)] font-semibold text-zinc-900 truncate">
              {salon.name}
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('book')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'book' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Nova Marcação
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manage')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'manage' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Gerir Marcação
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Cabeçalho do salão */}
        <section className="bg-white border border-zinc-200 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 h-52 md:h-auto bg-zinc-100">
            <img
              src={salon.coverUrl || '/images/salon_studio_cover_1795068461036.jpg'}
              alt={salon.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-7 p-6 flex flex-col justify-between space-y-4">
            <div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-2xl font-bold text-zinc-900">
                {salon.name}
              </h1>
              <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">{salon.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-100 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-violet-700 shrink-0" />
                <span>{salon.address}, {salon.city}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-violet-700 shrink-0" />
                <span className="font-mono">{salon.phone}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
              {workingHours
                .filter((w) => w.is_open === 1)
                .slice(0, 3)
                .map((w) => (
                  <span key={w.day_of_week}>
                    {DAY_NAMES_PT[w.day_of_week].slice(0, 3)}: {w.open_time}–{w.close_time}
                  </span>
                ))}
              <span>· Antecedência mín. {salon.minAdvanceHours}h</span>
            </div>
          </div>
        </section>

        {salon.isTemporarilyClosed && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{salon.closureReason || 'Este estabelecimento encontra-se temporariamente encerrado para marcações.'}</span>
          </div>
        )}

        {activeTab === 'manage' ? (
          <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-zinc-900">
                Consultar, reagendar ou cancelar marcação
              </h2>
              <p className="text-sm text-zinc-600 mt-1">
                Introduza o código recebido na confirmação e o seu número de telefone.
              </p>
            </div>

            <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value)}
                placeholder="Código (ex.: SL-9088)"
                className="px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg font-mono uppercase"
              />
              <input
                type="tel"
                required
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                placeholder="Telefone (+244 9...)"
                className="px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg"
              />
              <button
                type="submit"
                disabled={lookupLoading}
                className="px-4 py-2.5 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800 inline-flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Procurar marcação
              </button>
            </form>

            {lookupError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {lookupError}
              </div>
            )}

            {manageFeedback && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                {manageFeedback}
              </div>
            )}

            {foundBooking && (
              <div className="border border-zinc-200 rounded-xl p-5 space-y-5 bg-[#fafafc]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-semibold text-violet-700">{foundBooking.bookingCode}</p>
                    <h3 className="text-base font-semibold text-zinc-900 mt-0.5">
                      {foundBooking.customerName} · {foundBooking.professionalName}
                    </h3>
                    <p className="text-sm text-zinc-600 mt-1 tabular-nums">
                      {formatDatePt(foundBooking.date)} às {foundBooking.startTime}–{foundBooking.serviceEndTime} ·{' '}
                      {formatKz(foundBooking.totalPriceKz)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-zinc-800">
                      Estado: {STATUS_LABELS[foundBooking.status]}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-600">
                  Serviços: {foundBooking.services.map((s) => `${s.service_name} (${s.duration_minutes} min)`).join(', ')}
                </div>

                {foundBooking.status !== 'CANCELLED' && foundBooking.status !== 'COMPLETED' && (
                  <div className="pt-4 border-t border-zinc-200 space-y-4">
                    <div className="flex flex-wrap gap-3">
                      {foundBooking.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleClientAction('CONFIRM_HOLD')}
                          className="px-4 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800"
                        >
                          Confirmar reserva agora
                        </button>
                      )}
                      {salon.allowClientCancel && (
                        <button
                          type="button"
                          onClick={() => handleClientAction('CANCEL')}
                          className="px-4 py-2 text-xs font-medium border border-red-200 text-red-700 bg-white rounded-lg hover:bg-red-50"
                        >
                          Cancelar marcação
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-700">Reagendar para outra data/hora:</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => {
                            setRescheduleDate(e.target.value);
                            setRescheduleTime('');
                          }}
                          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                        />
                        <select
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                        >
                          <option value="">Escolher novo horário</option>
                          {rescheduleSlots.map((s) => (
                            <option key={s.time} value={s.time}>
                              {s.time} (até {s.endTime})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!rescheduleTime || lookupLoading}
                          onClick={() => handleClientAction('RESCHEDULE')}
                          className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-40"
                        >
                          Confirmar reagendamento
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : receipt ? (
          <section className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-bold text-zinc-900">
                  {receipt.appointment.status === 'PENDING'
                    ? 'Pré-reserva temporária registada'
                    : 'Marcação confirmada com sucesso'}
                </h2>
                <p className="text-sm text-zinc-600 mt-1">
                  Guarde o seu código para consultar, reagendar ou cancelar quando precisar.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-[#fafafc] border border-zinc-200">
              <div>
                <p className="text-xs text-zinc-500">Código da marcação</p>
                <p className="font-mono text-base font-bold text-violet-700 mt-0.5">{receipt.appointment.bookingCode}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Data e horário</p>
                <p className="font-mono text-sm font-semibold text-zinc-900 tabular-nums mt-0.5">
                  {formatDatePt(receipt.appointment.date)} · {receipt.appointment.startTime}–{receipt.appointment.serviceEndTime}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Profissional</p>
                <p className="text-sm font-semibold text-zinc-900 mt-0.5">{receipt.professionalName}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Valor estimado</p>
                <p className="font-mono text-sm font-semibold text-zinc-900 tabular-nums mt-0.5">
                  {formatKz(receipt.appointment.totalPriceKz)}
                </p>
              </div>
            </div>

            {receipt.appointment.status === 'PENDING' && receipt.appointment.holdExpiresAt && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Esta reserva temporária expira automaticamente em {salon.pendingHoldMinutes} minutos caso não seja confirmada no separador &ldquo;Gerir Marcação&rdquo;.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setLookupCode(receipt.appointment.bookingCode);
                  setLookupPhone(customerPhone);
                  setReceipt(null);
                  setActiveTab('manage');
                }}
                className="px-4 py-2 text-sm font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50"
              >
                Gerir esta marcação
              </button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="px-4 py-2 text-sm font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800"
              >
                Fazer nova marcação
              </button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Passos 1, 2 e 3 */}
            <div className="lg:col-span-7 space-y-6">
              {/* Passo 1: Serviços */}
              <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                      01. Escolha os serviços
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Pode selecionar um ou mais serviços para a mesma visita.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-zinc-600 tabular-nums">
                    {selectedServicesSummary.count} selecionado(s)
                  </span>
                </div>

                <div className="space-y-4">
                  {(categories.length > 0 ? categories : [{ id: 'all', name: 'Serviços' }]).map((cat) => {
                    const items = services.filter((s) =>
                      categories.length > 0 ? s.category_id === cat.id : true
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={cat.id} className="space-y-2">
                        <p className="text-xs font-medium text-zinc-500">{cat.name}</p>
                        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-lg overflow-hidden">
                          {items.map((svc) => {
                            const selected = selectedServiceIds.includes(svc.id);
                            return (
                              <button
                                key={svc.id}
                                type="button"
                                onClick={() => toggleService(svc.id)}
                                className={`w-full text-left p-3.5 flex items-start justify-between gap-4 transition-colors ${
                                  selected ? 'bg-violet-50/70' : 'bg-white hover:bg-zinc-50'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-zinc-900">{svc.name}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{svc.description}</p>
                                  <p className="text-xs text-zinc-500 mt-1.5 font-mono tabular-nums">
                                    {svc.duration_minutes} min
                                    {svc.buffer_minutes > 0 ? ` + ${svc.buffer_minutes} min preparação` : ''}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-mono text-sm font-semibold text-zinc-900 tabular-nums">
                                    {formatKz(svc.price_kz)}
                                  </p>
                                  <span
                                    className={`inline-block mt-1 text-[11px] font-medium ${
                                      selected ? 'text-violet-700' : 'text-zinc-400'
                                    }`}
                                  >
                                    {selected ? 'Selecionado' : 'Selecionar'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Passo 2: Profissional */}
              <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    02. Escolha a profissional
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Apenas profissionais habilitadas para todos os serviços escolhidos são apresentadas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProfessionalId('any');
                      setSelectedTime('');
                    }}
                    className={`p-3.5 rounded-lg border text-left transition-colors flex items-center gap-3 ${
                      selectedProfessionalId === 'any'
                        ? 'border-violet-600 bg-violet-50/70'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">Qualquer profissional disponível</p>
                      <p className="text-xs text-zinc-500">Encontra o melhor encaixe automático</p>
                    </div>
                  </button>

                  {eligibleProfessionals.map((pro) => (
                    <button
                      key={pro.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfessionalId(pro.id);
                        setSelectedTime('');
                      }}
                      className={`p-3.5 rounded-lg border text-left transition-colors flex items-center gap-3 ${
                        selectedProfessionalId === pro.id
                          ? 'border-violet-600 bg-violet-50/70'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <img
                        src={pro.avatar_url || '/images/pro_avatar_one_1795068461594.jpg'}
                        alt={pro.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{pro.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{pro.specialties}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Passo 3: Data e Horários Dinâmicos */}
              <section className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                      03. Data e horário disponível
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Horários calculados em tempo real (Fuso Africa/Luanda).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-zinc-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTime('');
                      }}
                      className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={fetchAvailability}
                      title="Atualizar disponibilidade"
                      className="p-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 text-zinc-600"
                    >
                      <RefreshCw className={`w-4 h-4 ${slotsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {slotsLoading ? (
                  <p className="text-sm text-zinc-500 py-4">A verificar disponibilidade real...</p>
                ) : closedReason ? (
                  <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-700">
                    {closedReason}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
                    Sem horários livres para esta combinação nesta data. Experimente outro dia ou selecione &ldquo;Qualquer profissional disponível&rdquo;.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                    {slots.map((slot) => {
                      const active = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-2.5 px-2 rounded-lg border text-center transition-colors ${
                            active
                              ? 'border-violet-700 bg-violet-700 text-white'
                              : 'border-zinc-200 bg-white hover:border-violet-300 text-zinc-900'
                          }`}
                        >
                          <span className="font-mono text-sm font-medium tabular-nums block">{slot.time}</span>
                          <span className={`font-mono text-[10px] ${active ? 'text-violet-100' : 'text-zinc-400'}`}>
                            até {slot.endTime}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Resumo e Dados da Cliente */}
            <div className="lg:col-span-5">
              <form
                onSubmit={handleConfirmBooking}
                className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5 sticky top-6"
              >
                <div>
                  <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-zinc-900">
                    04. Os seus dados e confirmação
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Sem necessidade de criar conta. Validação imediata no servidor.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#fafafc] border border-zinc-200 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Serviços</span>
                    <span className="text-zinc-900 font-medium text-right">
                      {selectedServicesSummary.names.join(' + ') || 'Nenhum'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Duração total</span>
                    <span className="font-mono text-zinc-900 tabular-nums">
                      {selectedServicesSummary.totalDuration} min
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Data &amp; Hora</span>
                    <span className="font-mono text-zinc-900 tabular-nums">
                      {selectedDate ? formatDatePt(selectedDate) : '—'} · {selectedTime || 'Escolha um horário'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-200 flex justify-between gap-2 text-sm font-semibold">
                    <span className="text-zinc-900">Total estimado</span>
                    <span className="font-mono text-violet-700 tabular-nums">
                      {formatKz(selectedServicesSummary.totalPriceKz)}
                    </span>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Nome completo</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex.: Maria Fernandes"
                      className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Telefone (WhatsApp / Chamadas)</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">E-mail (opcional)</label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="cliente@exemplo.ao"
                      className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Observações (opcional)</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Preferências ou notas para a profissional..."
                      className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 pt-1 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={asPendingHold}
                      onChange={(e) => setAsPendingHold(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-violet-700 focus:ring-violet-600"
                    />
                    <span>
                      Registar como pré-reserva temporária ({salon.pendingHoldMinutes} min para confirmar antes da libertação automática)
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedTime || salon.isTemporarilyClosed}
                  className="w-full py-3 px-4 text-sm font-medium text-white bg-violet-700 rounded-lg hover:bg-violet-800 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {submitting ? 'A validar disponibilidade...' : 'Confirmar Pedido de Agendamento'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
