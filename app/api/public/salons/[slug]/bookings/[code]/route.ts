import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicSalonBySlug,
  rescheduleAppointmentAtomic,
  transitionAppointmentStatus,
} from '@/lib/booking/engine';
import { handleApiError } from '@/lib/auth/http';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { normalizePhone } from '@/lib/utils/time';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string; code: string }> }
) {
  try {
    ensureSeeded();
    const { slug, code } = await context.params;
    const salon = getPublicSalonBySlug(slug);
    if (!salon) {
      return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
    }

    const body = await req.json();
    const phone = String(body.phone || '').trim();
    const action = String(body.action || '');

    const db = getDb();
    const appt = db
      .prepare(
        `SELECT a.id, c.normalized_phone
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         WHERE a.salon_id = ? AND UPPER(a.booking_code) = ?`
      )
      .get(salon.id, code.toUpperCase()) as { id: string; normalized_phone: string } | undefined;

    if (!appt || appt.normalized_phone !== normalizePhone(phone)) {
      return NextResponse.json(
        { error: 'Marcação não encontrada ou telefone não corresponde.' },
        { status: 404 }
      );
    }

    if (action === 'CANCEL') {
      const updated = transitionAppointmentStatus({
        salonId: salon.id,
        appointmentId: appt.id,
        nextStatus: 'CANCELLED',
        changedBy: 'CLIENT_SELF_SERVICE',
        reason: String(body.reason || 'Cancelado pela cliente na página pública'),
        isClientAction: true,
      });
      return NextResponse.json({ appointment: updated });
    }

    if (action === 'CONFIRM_HOLD') {
      const updated = transitionAppointmentStatus({
        salonId: salon.id,
        appointmentId: appt.id,
        nextStatus: 'CONFIRMED',
        changedBy: 'CLIENT_SELF_SERVICE',
        reason: 'Reserva temporária confirmada pela cliente',
        isClientAction: true,
      });
      return NextResponse.json({ appointment: updated });
    }

    if (action === 'RESCHEDULE') {
      const updated = rescheduleAppointmentAtomic({
        salonId: salon.id,
        appointmentId: appt.id,
        newDate: String(body.newDate || ''),
        newStartTime: String(body.newStartTime || ''),
        newProfessionalId: body.newProfessionalId ? String(body.newProfessionalId) : undefined,
        changedBy: 'CLIENT_SELF_SERVICE',
        reason: String(body.reason || 'Reagendado pela cliente'),
      });
      return NextResponse.json({ appointment: updated });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
