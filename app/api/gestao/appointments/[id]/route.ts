import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { ForbiddenError, logAuditEvent } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { rescheduleAppointmentAtomic, transitionAppointmentStatus } from '@/lib/booking/engine';
import type { AppointmentStatus } from '@/lib/types/domain';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const { id } = await context.params;
    const db = getDb();
    const existing = db
      .prepare('SELECT id, salon_id, professional_id FROM appointments WHERE id = ?')
      .get(id) as { id: string; salon_id: string; professional_id: string } | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'Marcação não encontrada.' }, { status: 404 });
    }

    if (existing.salon_id !== user.salonId && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Não pode aceder a marcações de outro estabelecimento.');
    }

    if (user.role === 'PROFESSIONAL' && existing.professional_id !== user.professionalId) {
      throw new ForbiddenError('Só pode atualizar as suas próprias marcações.');
    }

    const body = await req.json();

    if (body.action === 'RESCHEDULE') {
      const updated = rescheduleAppointmentAtomic({
        salonId: existing.salon_id,
        appointmentId: id,
        newDate: String(body.newDate || ''),
        newStartTime: String(body.newStartTime || ''),
        newProfessionalId: body.newProfessionalId ? String(body.newProfessionalId) : undefined,
        changedBy: user.name,
        reason: body.reason ? String(body.reason) : 'Reagendado pela equipa',
        bypassMinAdvance: true,
      });

      logAuditEvent({
        salonId: existing.salon_id,
        userId: user.id,
        actorName: user.name,
        action: 'APPOINTMENT_RESCHEDULE',
        entityType: 'APPOINTMENT',
        entityId: id,
        details: `Para ${updated.date} ${updated.startTime}`,
      });

      return NextResponse.json({ appointment: updated });
    }

    const nextStatus = String(body.status || '') as AppointmentStatus;
    const allowed: AppointmentStatus[] = [
      'PENDING',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW',
    ];
    if (!allowed.includes(nextStatus)) {
      return NextResponse.json({ error: 'Estado de marcação inválido.' }, { status: 400 });
    }

    const updated = transitionAppointmentStatus({
      salonId: existing.salon_id,
      appointmentId: id,
      nextStatus,
      changedBy: user.name,
      reason: body.reason ? String(body.reason) : undefined,
    });

    logAuditEvent({
      salonId: existing.salon_id,
      userId: user.id,
      actorName: user.name,
      action: `APPOINTMENT_STATUS_${nextStatus}`,
      entityType: 'APPOINTMENT',
      entityId: id,
      details: body.reason ? String(body.reason) : undefined,
    });

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
