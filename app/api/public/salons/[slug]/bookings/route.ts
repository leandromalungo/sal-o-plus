import { NextRequest, NextResponse } from 'next/server';
import { createBookingAtomic, getPublicSalonBySlug } from '@/lib/booking/engine';
import { handleApiError } from '@/lib/auth/http';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { normalizePhone } from '@/lib/utils/time';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    ensureSeeded();
    const { slug } = await context.params;
    const salon = getPublicSalonBySlug(slug);
    if (!salon) {
      return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
    }

    const code = String(req.nextUrl.searchParams.get('code') || '').trim().toUpperCase();
    const phone = String(req.nextUrl.searchParams.get('phone') || '').trim();
    if (!code || !phone) {
      return NextResponse.json(
        { error: 'Informe o código da marcação e o número de telefone.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.*, p.name as professional_name, c.name as customer_name, c.phone as customer_phone, c.normalized_phone
         FROM appointments a
         JOIN professionals p ON p.id = a.professional_id
         JOIN customers c ON c.id = a.customer_id
         WHERE a.salon_id = ? AND UPPER(a.booking_code) = ?`
      )
      .get(salon.id, code) as Record<string, unknown> | undefined;

    if (!row || String(row.normalized_phone) !== normalizePhone(phone)) {
      return NextResponse.json(
        { error: 'Marcação não encontrada para este código e telefone.' },
        { status: 404 }
      );
    }

    const services = db
      .prepare('SELECT service_id, service_name, price_kz, duration_minutes FROM appointment_services WHERE appointment_id = ? ORDER BY sort_order ASC')
      .all(String(row.id));

    return NextResponse.json({
      appointment: {
        id: row.id,
        bookingCode: row.booking_code,
        date: row.date,
        startTime: row.start_time,
        serviceEndTime: row.service_end_time,
        totalDurationMinutes: row.total_duration_minutes,
        totalPriceKz: row.total_price_kz,
        status: row.status,
        holdExpiresAt: row.hold_expires_at,
        professionalId: row.professional_id,
        professionalName: row.professional_name,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        services,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const salon = getPublicSalonBySlug(slug);
    if (!salon) {
      return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
    }

    const body = await req.json();
    const serviceIds = Array.isArray(body.serviceIds)
      ? body.serviceIds.map((s: unknown) => String(s))
      : body.serviceId
      ? [String(body.serviceId)]
      : [];

    const result = createBookingAtomic({
      salonId: salon.id,
      serviceIds,
      professionalId: String(body.professionalId || 'any'),
      date: String(body.date || ''),
      startTime: String(body.startTime || ''),
      customerName: String(body.customerName || ''),
      customerPhone: String(body.customerPhone || ''),
      customerEmail: body.customerEmail ? String(body.customerEmail) : null,
      notes: body.notes ? String(body.notes) : null,
      source: 'PUBLIC',
      asPendingHold: Boolean(body.asPendingHold),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
