import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canManageBookings, logAuditEvent } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { createBookingAtomic, releaseExpiredHolds } from '@/lib/booking/engine';

export async function GET(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const db = getDb();
    releaseExpiredHolds(db);

    const date = req.nextUrl.searchParams.get('date');
    const status = req.nextUrl.searchParams.get('status');
    const proFilter =
      user.role === 'PROFESSIONAL' && user.professionalId
        ? user.professionalId
        : req.nextUrl.searchParams.get('professionalId');

    const conditions = ['a.salon_id = ?'];
    const params: Array<string | number> = [user.salonId];

    if (date) {
      conditions.push('a.date = ?');
      params.push(date);
    }
    if (status && status !== 'ALL') {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (proFilter && proFilter !== 'ALL') {
      conditions.push('a.professional_id = ?');
      params.push(proFilter);
    }

    const rows = db
      .prepare(
        `SELECT a.*, c.name as customer_name, c.phone as customer_phone, p.name as professional_name
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         JOIN professionals p ON p.id = a.professional_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.date DESC, a.start_minutes ASC
         LIMIT 200`
      )
      .all(...params) as Array<Record<string, unknown>>;

    const servicesStmt = db.prepare(
      'SELECT service_id, service_name, price_kz, duration_minutes, buffer_minutes FROM appointment_services WHERE appointment_id = ? ORDER BY sort_order ASC'
    );
    const historyStmt = db.prepare(
      'SELECT from_status, to_status, changed_by, reason, previous_date, previous_start_time, created_at FROM appointment_status_history WHERE appointment_id = ? ORDER BY created_at DESC'
    );

    const enriched = rows.map((r) => ({
      ...r,
      services: servicesStmt.all(String(r.id)),
      history: historyStmt.all(String(r.id)),
    }));

    return NextResponse.json({ appointments: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }
    if (!canManageBookings(user.role)) {
      return NextResponse.json(
        { error: 'Apenas proprietária ou recepção podem criar marcações para outras profissionais.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const serviceIds = Array.isArray(body.serviceIds)
      ? body.serviceIds.map(String)
      : body.serviceId
      ? [String(body.serviceId)]
      : [];

    const result = createBookingAtomic({
      salonId: user.salonId,
      serviceIds,
      professionalId: String(body.professionalId || 'any'),
      date: String(body.date || ''),
      startTime: String(body.startTime || ''),
      customerName: String(body.customerName || ''),
      customerPhone: String(body.customerPhone || ''),
      customerEmail: body.customerEmail ? String(body.customerEmail) : null,
      notes: body.notes ? String(body.notes) : null,
      source: 'MANAGEMENT',
      actorUserId: user.id,
      bypassMinAdvance: Boolean(body.bypassMinAdvance),
    });

    logAuditEvent({
      salonId: user.salonId,
      userId: user.id,
      actorName: user.name,
      action: 'APPOINTMENT_CREATE',
      entityType: 'APPOINTMENT',
      entityId: result.appointment.id,
      details: `${result.appointment.bookingCode} (${result.appointment.date} ${result.appointment.startTime})`,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
