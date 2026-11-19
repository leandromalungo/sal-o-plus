'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CalendarCheck2,
  Check,
  ChevronLeft,
  Clock,
  MapPin,
  Phone,
  AlertCircle,
  UserCheck,
  Search,
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
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

const DEFAULT_SALON_COVER = '/images/salon_studio_cover_1795068461036.jpg';

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
  const [lastBookedServices, setLastBookedServices] = useState<string[]>([]);

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
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('codigo')?.trim();
    if (codeParam) {
      setLookupCode(codeParam.toUpperCase());
      setActiveTab('manage');
    }
  }, []);

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

  const selectedSlotInfo = useMemo(
    () => slots.find((s) => s.time === selectedTime) || null,
    [slots, selectedTime]
  );

  const selectedProfessionalLabel = useMemo(() => {
    if (!data) return 'Qualquer disponível';
    if (selectedProfessionalId === 'any') return 'Qualquer profissional disponível';
    return data.professionals.find((p) => p.id === selectedProfessionalId)?.name || 'Qualquer disponível';
  }, [data, selectedProfessionalId]);

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((item) => item !== id) : prev) : [...prev, id]
    );
    setSelectedTime('');
  }

  function handleResetSelection() {
    if (!data) return;
    setSelectedServiceIds(data.services.length > 0 ? [data.services[0].id] : []);
    setSelectedProfessionalId('any');
    setSelectedDate(data.suggestedDate);
    setSelectedTime('');
    setSubmitError(null);
  }

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTime || selectedServiceIds.length === 0) {
      setSubmitError('Selecione o serviço e um horário disponível.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const chosenNames = [...selectedServicesSummary.names];
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
      setLastBookedServices(chosenNames);
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
      <div className="min-h-screen bg-[#F3F4F0] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 text-center space-y-4 shadow-sm border border-zinc-200/60">
          <div className="w-12 h-12 rounded-full bg-[#F4F4F2] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-bold text-zinc-900">
            Página indisponível
          </h1>
          <p className="text-sm text-zinc-600">{loadError}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-full bg-[#11693B] text-white hover:bg-[#0D542F] transition-colors"
          >
            Voltar ao Salão+
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F3F4F0] flex items-center justify-center p-6">
        <div className="bg-white rounded-[32px] px-8 py-6 shadow-sm border border-zinc-200/60 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-[#11693B] animate-spin" />
          <p className="text-sm text-zinc-600">A carregar agenda e serviços do salão...</p>
        </div>
      </div>
    );
  }

  const { salon, categories, services, workingHours } = data;
  const coverImage = salon.coverUrl || DEFAULT_SALON_COVER;

  return (
    <div className="min-h-screen bg-[#F3F4F0] text-zinc-900 py-4 sm:py-8 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {activeTab === 'manage' ? (
          /* Ecrã de Consulta / Gestão (inspirado no cartão direito da referência) */
          <section className="max-w-xl mx-auto bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-zinc-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                aria-label="Voltar à marcação"
                className="w-10 h-10 rounded-full bg-[#F4F4F2] hover:bg-[#EAECE7] text-zinc-800 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-medium text-zinc-500 truncate px-2">{salon.name}</span>
              <Link
                href="/"
                className="text-xs font-medium text-[#11693B] hover:underline whitespace-nowrap"
              >
                Início
              </Link>
            </div>

            <div className="text-center space-y-2 pt-1">
              <div className="w-11 h-11 rounded-2xl bg-[#E8F3EC] text-[#11693B] flex items-center justify-center mx-auto">
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-bold text-zinc-900">
                Detalhes e Gestão da Marcação
              </h1>
              <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                Introduza o código recebido na confirmação e o seu telefone para consultar, reagendar ou cancelar.
              </p>
            </div>

            <form onSubmit={handleLookup} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  placeholder="Código (ex.: SL-9088)"
                  className="w-full px-4 py-3 text-sm bg-[#F4F4F2] rounded-2xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none font-mono uppercase text-zinc-900 placeholder:text-zinc-400"
                />
                <input
                  type="tel"
                  required
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  placeholder="Telefone (+244 9...)"
                  className="w-full px-4 py-3 text-sm bg-[#F4F4F2] rounded-2xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none text-zinc-900 placeholder:text-zinc-400"
                />
              </div>
              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full min-h-[46px] px-6 py-3 text-sm font-medium bg-[#11693B] hover:bg-[#0D542F] text-white rounded-full transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {lookupLoading ? 'A procurar...' : 'Procurar marcação'}
              </button>
            </form>

            {lookupError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200/80 text-sm text-red-700">
                {lookupError}
              </div>
            )}

            {manageFeedback && (
              <div className="p-4 rounded-2xl bg-[#E8F3EC] border border-[#11693B]/20 text-sm text-[#11693B] font-medium">
                {manageFeedback}
              </div>
            )}

            {foundBooking && (
              <div className="space-y-3 pt-2">
                <div className="rounded-2xl bg-white border border-zinc-200/80 shadow-xs overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {foundBooking.services.map((s) => s.service_name).join(' + ')}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {foundBooking.customerName} · {foundBooking.totalDurationMinutes} min
                      </p>
                    </div>
                    <img
                      src={coverImage}
                      alt={salon.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-cover shrink-0 bg-[#F4F4F2]"
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-sm">
                    <span className="text-zinc-700 font-medium">Valor Total</span>
                    <span className="font-mono font-semibold text-[#11693B] tabular-nums">
                      {formatKz(foundBooking.totalPriceKz)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-4 text-sm">
                    <span className="text-zinc-600">Estado</span>
                    <span className="font-semibold text-[#11693B]">{STATUS_LABELS[foundBooking.status]}</span>
                  </div>
                  <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-4 text-sm">
                    <span className="text-zinc-600">Código da Marcação</span>
                    <span className="font-mono font-semibold text-[#11693B]">{foundBooking.bookingCode}</span>
                  </div>
                  <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-4 text-sm">
                    <span className="text-zinc-600">Data e Horário</span>
                    <span className="font-mono font-medium text-zinc-900 tabular-nums text-right">
                      {formatDatePt(foundBooking.date)} · {foundBooking.startTime}–{foundBooking.serviceEndTime}
                    </span>
                  </div>
                  <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-4 text-sm">
                    <span className="text-zinc-600">Profissional</span>
                    <span className="font-medium text-zinc-900 text-right">{foundBooking.professionalName}</span>
                  </div>
                </div>

                {foundBooking.status !== 'CANCELLED' && foundBooking.status !== 'COMPLETED' && (
                  <div className="pt-3 space-y-4">
                    <div className="rounded-2xl bg-[#F4F4F2] p-4 space-y-3">
                      <p className="text-xs font-medium text-zinc-700">Reagendar para outra data/hora:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => {
                            setRescheduleDate(e.target.value);
                            setRescheduleTime('');
                          }}
                          className="px-3.5 py-2.5 text-sm rounded-xl bg-white border border-zinc-200/80 focus:outline-none focus:border-[#11693B]"
                        />
                        <select
                          value={rescheduleTime}
                          onChange={(e) => setRescheduleTime(e.target.value)}
                          className="px-3.5 py-2.5 text-sm rounded-xl bg-white border border-zinc-200/80 focus:outline-none focus:border-[#11693B]"
                        >
                          <option value="">Escolher novo horário</option>
                          {rescheduleSlots.map((s) => (
                            <option key={s.time} value={s.time}>
                              {s.time} (até {s.endTime})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={!rescheduleTime || lookupLoading}
                        onClick={() => handleClientAction('RESCHEDULE')}
                        className="w-full min-h-[42px] px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-full hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                      >
                        Confirmar reagendamento
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {foundBooking.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleClientAction('CONFIRM_HOLD')}
                          className="min-h-[44px] px-6 py-2.5 text-sm font-medium bg-[#11693B] text-white rounded-full hover:bg-[#0D542F] transition-colors"
                        >
                          Confirmar reserva agora
                        </button>
                      )}
                      {salon.allowClientCancel && (
                        <button
                          type="button"
                          onClick={() => handleClientAction('CANCEL')}
                          className="min-h-[44px] px-6 py-2.5 text-sm font-medium border border-red-200 text-red-700 bg-white rounded-full hover:bg-red-50 transition-colors"
                        >
                          Cancelar marcação
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : receipt ? (
          /* Ecrã de Confirmação / Detalhes da Marcação (Ecrã 2 da imagem de referência) */
          <section className="max-w-md mx-auto bg-white rounded-[32px] p-6 sm:p-8 shadow-sm border border-zinc-200/60 space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setReceipt(null)}
                aria-label="Voltar"
                className="w-10 h-10 rounded-full bg-[#F4F4F2] hover:bg-[#EAECE7] text-zinc-800 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs font-medium text-zinc-400 truncate max-w-[180px]">{salon.name}</span>
              <span className="w-10" aria-hidden="true" />
            </div>

            <div className="text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-[#E8F3EC] text-[#11693B] flex items-center justify-center mx-auto">
                <CalendarCheck2 className="w-5 h-5" />
              </div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-bold text-zinc-900">
                {receipt.appointment.status === 'PENDING'
                  ? 'Pré-Reserva Registada'
                  : 'Detalhes da Marcação'}
              </h1>
              <p className="text-xs text-zinc-500">
                Guarde o seu código para consultar, reagendar ou cancelar quando precisar.
              </p>
            </div>

            <div className="rounded-2xl bg-white border border-zinc-200/80 shadow-xs overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-zinc-900 line-clamp-2">
                    {lastBookedServices.length > 0 ? lastBookedServices.join(' + ') : salon.name}
                  </p>
                  <p className="text-xs text-zinc-500 tabular-nums">
                    {receipt.appointment.totalDurationMinutes} min · {receipt.customerName}
                  </p>
                </div>
                <img
                  src={coverImage}
                  alt={salon.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl object-cover shrink-0 bg-[#F4F4F2]"
                />
              </div>
              <div className="px-4 py-3.5 border-t border-zinc-100 flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-700">Valor Total</span>
                <span className="font-mono font-semibold text-[#11693B] tabular-nums">
                  {formatKz(receipt.appointment.totalPriceKz)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-600">Estado</span>
                <span className="font-semibold text-[#11693B]">
                  {STATUS_LABELS[receipt.appointment.status]}
                </span>
              </div>
              <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-600">Código da Marcação</span>
                <span className="font-mono font-semibold text-[#11693B]">
                  {receipt.appointment.bookingCode}
                </span>
              </div>
              <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-600">Data e Horário</span>
                <span className="font-mono font-medium text-zinc-900 tabular-nums text-right">
                  {formatDatePt(receipt.appointment.date)} · {receipt.appointment.startTime}–
                  {receipt.appointment.serviceEndTime}
                </span>
              </div>
              <div className="px-4 py-3.5 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-600">Profissional</span>
                <span className="font-medium text-zinc-900 text-right">{receipt.professionalName}</span>
              </div>
            </div>

            {receipt.appointment.status === 'PENDING' && receipt.appointment.holdExpiresAt && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                Esta reserva temporária expira automaticamente em {salon.pendingHoldMinutes} minutos caso não seja confirmada em &ldquo;Gerir Marcação&rdquo;.
              </p>
            )}

            <div className="pt-1 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setLookupCode(receipt.appointment.bookingCode);
                  setLookupPhone(customerPhone);
                  setReceipt(null);
                  setActiveTab('manage');
                }}
                className="w-full max-w-[240px] min-h-[46px] px-6 py-3 text-sm font-medium bg-[#11693B] hover:bg-[#0D542F] text-white rounded-full transition-colors"
              >
                Gerir Marcação
              </button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Fazer nova marcação
              </button>
            </div>
          </section>
        ) : (
          /* Ecrã Principal: Ecrã 1 (Foto + Folha Branca Sobreposta) + Ecrã 2 (Resumo & Confirmação) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Cartão Esquerdo — Visual & Seleção de Serviço / Profissional / Horário */}
            <section className="lg:col-span-7 bg-white rounded-[32px] overflow-hidden shadow-sm border border-zinc-200/60">
              {/* Hero Fotográfico com botões circulares flutuantes */}
              <div className="relative h-64 sm:h-72 bg-zinc-200">
                <img
                  src={coverImage}
                  alt={salon.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 top-0 p-5 flex items-center justify-between">
                  <Link
                    href="/"
                    aria-label="Voltar ao início"
                    className="w-10 h-10 rounded-full bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActiveTab('manage')}
                    aria-label="Gerir marcação existente"
                    title="Gerir marcação existente"
                    className="h-10 px-3.5 rounded-full bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 inline-flex items-center gap-2 text-xs font-medium transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-[#11693B]" />
                    <span>Gerir Marcação</span>
                  </button>
                </div>
              </div>

              {/* Folha branca sobreposta com traço verde */}
              <div className="relative z-10 -mt-8 rounded-t-[30px] bg-white px-5 sm:px-7 pt-4 pb-7 space-y-6">
                <div className="w-9 h-1 rounded-full bg-[#11693B] mx-auto" />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h1 className="font-[family-name:var(--font-jakarta)] text-2xl font-bold text-zinc-900">
                      {salon.name}
                    </h1>
                    <span className="font-mono text-sm font-semibold text-[#11693B] tabular-nums">
                      {formatKz(selectedServicesSummary.totalPriceKz)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed">{salon.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#11693B]" />
                      {salon.address}, {salon.city}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-[#11693B]" />
                      {salon.phone}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
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

                {salon.isTemporarilyClosed && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>
                      {salon.closureReason ||
                        'Este estabelecimento encontra-se temporariamente encerrado para marcações.'}
                    </span>
                  </div>
                )}

                {/* 01. Serviços em pílulas suaves #F4F4F2 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                      01. Escolha os serviços
                    </h2>
                    <span className="font-mono text-xs text-zinc-500 tabular-nums">
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
                          <p className="text-xs font-medium text-zinc-400">{cat.name}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {items.map((svc) => {
                              const selected = selectedServiceIds.includes(svc.id);
                              return (
                                <button
                                  key={svc.id}
                                  type="button"
                                  onClick={() => toggleService(svc.id)}
                                  className={`w-full text-left px-4 py-3.5 rounded-2xl transition-all flex items-center justify-between gap-3 ${
                                    selected
                                      ? 'bg-[#E8F3EC] ring-1 ring-[#11693B]'
                                      : 'bg-[#F4F4F2] hover:bg-[#EAECE7]'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">{svc.name}</p>
                                    <p className="text-[11px] text-zinc-500 font-mono tabular-nums mt-0.5">
                                      {svc.duration_minutes} min
                                      {svc.buffer_minutes > 0 ? ` + ${svc.buffer_minutes} min` : ''}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0 flex items-center gap-2">
                                    <span className="font-mono text-xs font-semibold text-[#11693B] tabular-nums">
                                      {formatKz(svc.price_kz)}
                                    </span>
                                    {selected && (
                                      <span className="w-5 h-5 rounded-full bg-[#11693B] text-white flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 02. Profissional */}
                <div className="space-y-3">
                  <div>
                    <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                      02. Escolha a profissional
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Profissionais habilitadas para os serviços selecionados.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfessionalId('any');
                        setSelectedTime('');
                      }}
                      className={`px-4 py-3 rounded-2xl text-left transition-all flex items-center gap-3 ${
                        selectedProfessionalId === 'any'
                          ? 'bg-[#E8F3EC] ring-1 ring-[#11693B]'
                          : 'bg-[#F4F4F2] hover:bg-[#EAECE7]'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-white text-[#11693B] flex items-center justify-center shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">Qualquer disponível</p>
                        <p className="text-[11px] text-zinc-500 truncate">Melhor encaixe automático</p>
                      </div>
                    </button>

                    {eligibleProfessionals.map((pro) => {
                      const active = selectedProfessionalId === pro.id;
                      return (
                        <button
                          key={pro.id}
                          type="button"
                          onClick={() => {
                            setSelectedProfessionalId(pro.id);
                            setSelectedTime('');
                          }}
                          className={`px-4 py-3 rounded-2xl text-left transition-all flex items-center gap-3 ${
                            active
                              ? 'bg-[#E8F3EC] ring-1 ring-[#11693B]'
                              : 'bg-[#F4F4F2] hover:bg-[#EAECE7]'
                          }`}
                        >
                          <img
                            src={pro.avatar_url || '/images/pro_avatar_one_1795068461594.jpg'}
                            alt={pro.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover shrink-0 bg-white"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">{pro.name}</p>
                            <p className="text-[11px] text-zinc-500 truncate">{pro.specialties}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 03. Data e Horários Dinâmicos */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                        03. Data e horário disponível
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Disponibilidade em tempo real (Africa/Luanda).
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center">
                        <Calendar className="w-4 h-4 text-[#11693B] absolute left-3 pointer-events-none" />
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setSelectedTime('');
                          }}
                          className="pl-9 pr-3 py-2 text-sm bg-[#F4F4F2] rounded-xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={fetchAvailability}
                        title="Atualizar disponibilidade"
                        aria-label="Atualizar disponibilidade"
                        className="w-9 h-9 rounded-full bg-[#F4F4F2] hover:bg-[#EAECE7] text-zinc-700 flex items-center justify-center transition-colors"
                      >
                        <RefreshCw className={`w-4 h-4 ${slotsLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {slotsLoading ? (
                    <p className="text-sm text-zinc-500 py-3">A verificar disponibilidade real...</p>
                  ) : closedReason ? (
                    <div className="p-4 rounded-2xl bg-[#F4F4F2] text-sm text-zinc-700">
                      {closedReason}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#F4F4F2] text-sm text-zinc-600">
                      Sem horários livres para esta combinação nesta data. Experimente outro dia ou selecione &ldquo;Qualquer disponível&rdquo;.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {slots.map((slot) => {
                        const active = selectedTime === slot.time;
                        return (
                          <button
                            key={slot.time}
                            type="button"
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-2.5 px-2 rounded-2xl text-center transition-colors ${
                              active
                                ? 'bg-[#11693B] text-white'
                                : 'bg-[#F4F4F2] hover:bg-[#EAECE7] text-zinc-900'
                            }`}
                          >
                            <span className="font-mono text-sm font-medium tabular-nums block">
                              {slot.time}
                            </span>
                            <span className={`font-mono text-[10px] ${active ? 'text-emerald-100' : 'text-zinc-500'}`}>
                              até {slot.endTime}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Barra de ação inferior fiel à referência (reset + atalho para confirmar no mobile) */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResetSelection}
                    title="Repor seleção"
                    aria-label="Repor seleção"
                    className="w-11 h-11 rounded-full bg-[#F4F4F2] hover:bg-[#EAECE7] text-zinc-700 flex items-center justify-center transition-colors shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <a
                    href="#confirmar-marcacao"
                    className="lg:hidden flex-1 min-h-[44px] px-6 py-2.5 rounded-full bg-[#11693B] hover:bg-[#0D542F] text-white text-sm font-medium inline-flex items-center justify-center transition-colors"
                  >
                    Continuar para Confirmar
                  </a>
                  <span className="hidden lg:inline-flex text-xs text-zinc-400">
                    Preencha os seus dados ao lado para confirmar
                  </span>
                </div>
              </div>
            </section>

            {/* Cartão Direito — Resumo & Confirmação (estética limpa do Ecrã 2 da referência) */}
            <aside id="confirmar-marcacao" className="lg:col-span-5 lg:sticky lg:top-6">
              <form
                onSubmit={handleConfirmBooking}
                className="bg-white rounded-[32px] p-6 sm:p-7 shadow-sm border border-zinc-200/60 space-y-5"
              >
                <div className="text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#E8F3EC] text-[#11693B] flex items-center justify-center mx-auto">
                    <CalendarCheck2 className="w-5 h-5" />
                  </div>
                  <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-bold text-zinc-900">
                    Resumo da Marcação
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Sem necessidade de criar conta. Validação imediata.
                  </p>
                </div>

                {/* Caixa elevada de resumo + Total */}
                <div className="rounded-2xl bg-white border border-zinc-200/80 shadow-xs overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-zinc-900 line-clamp-2">
                        {selectedServicesSummary.names.join(' + ') || 'Selecione um serviço'}
                      </p>
                      <p className="text-xs text-zinc-500 tabular-nums">
                        {selectedServicesSummary.totalDuration} min · {selectedProfessionalLabel}
                      </p>
                    </div>
                    <img
                      src={coverImage}
                      alt={salon.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover shrink-0 bg-[#F4F4F2]"
                    />
                  </div>
                  <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-sm">
                    <span className="text-zinc-700 font-medium">Valor Total</span>
                    <span className="font-mono font-semibold text-[#11693B] tabular-nums">
                      {formatKz(selectedServicesSummary.totalPriceKz)}
                    </span>
                  </div>
                </div>

                {/* Linhas #F4F4F2 para Data/Horário e Duração */}
                <div className="space-y-2">
                  <div className="px-4 py-3 rounded-2xl bg-[#F4F4F2] flex items-center justify-between gap-3 text-xs">
                    <span className="text-zinc-500">Data &amp; Horário</span>
                    <span className="font-mono font-medium text-[#11693B] tabular-nums text-right">
                      {selectedDate ? formatDatePt(selectedDate) : '—'} ·{' '}
                      {selectedSlotInfo
                        ? `${selectedSlotInfo.time}–${selectedSlotInfo.endTime}`
                        : 'Escolha um horário'}
                    </span>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700">
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
                      className="w-full px-4 py-2.5 text-sm bg-[#F4F4F2] rounded-2xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Telefone (WhatsApp / Chamadas)
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className="w-full px-4 py-2.5 text-sm bg-[#F4F4F2] rounded-2xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        E-mail (opcional)
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="cliente@exemplo.ao"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#F4F4F2] rounded-2xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Observações
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Preferências..."
                        className="w-full px-3.5 py-2.5 text-sm bg-[#F4F4F2] rounded-2xl border border-transparent focus:bg-white focus:border-[#11693B] focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 pt-1 text-xs text-zinc-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={asPendingHold}
                      onChange={(e) => setAsPendingHold(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 text-[#11693B] focus:ring-[#11693B]"
                    />
                    <span>
                      Pré-reserva temporária ({salon.pendingHoldMinutes} min para confirmar antes da libertação)
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedTime || salon.isTemporarilyClosed}
                  className="w-full min-h-[48px] py-3 px-6 text-sm font-medium text-white bg-[#11693B] rounded-full hover:bg-[#0D542F] transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  {submitting ? 'A validar disponibilidade...' : 'Confirmar Marcação'}
                </button>
              </form>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
