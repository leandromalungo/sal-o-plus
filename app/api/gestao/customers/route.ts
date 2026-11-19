import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canManageBookings } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { getLuandaNow, normalizePhone } from '@/lib/utils/time';

export async function GET(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const search = String(req.nextUrl.searchParams.get('q') || '').trim();
    const db = getDb();

    const rows = search
      ? db
          .prepare(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id) as total_appointments,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status = 'COMPLETED') as completed_count,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status = 'CANCELLED') as cancelled_count,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status = 'NO_SHOW') as no_show_count
             FROM customers c
             WHERE c.salon_id = ?
               AND (LOWER(c.name) LIKE LOWER(?) OR c.phone LIKE ? OR c.normalized_phone LIKE ?)
             ORDER BY c.name ASC`
          )
          .all(user.salonId, `%${search}%`, `%${search}%`, `%${normalizePhone(search)}%`)
      : db
          .prepare(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id) as total_appointments,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status = 'COMPLETED') as completed_count,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status = 'CANCELLED') as cancelled_count,
                    (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status = 'NO_SHOW') as no_show_count
             FROM customers c
             WHERE c.salon_id = ?
             ORDER BY c.name ASC`
          )
          .all(user.salonId);

    const historyStmt = db.prepare(
      `SELECT a.id, a.booking_code, a.date, a.start_time, a.status, a.total_price_kz, p.name as professional_name
       FROM appointments a
       JOIN professionals p ON p.id = a.professional_id
       WHERE a.customer_id = ? AND a.salon_id = ?
       ORDER BY a.date DESC, a.start_minutes DESC
       LIMIT 10`
    );

    const customers = (rows as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      appointments: historyStmt.all(String(c.id), user.salonId!),
    }));

    return NextResponse.json({ customers });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageBookings(user.role)) {
      return NextResponse.json({ error: 'Sem permissão para registar clientes.' }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = body.email ? String(body.email).trim() : null;
    const preferences = body.preferences ? String(body.preferences).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nome e telefone são obrigatórios.' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM customers WHERE salon_id = ? AND normalized_phone = ?')
      .get(user.salonId, normalized) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        'UPDATE customers SET name = ?, email = COALESCE(?, email), preferences = COALESCE(?, preferences), notes = COALESCE(?, notes) WHERE id = ?'
      ).run(name, email, preferences, notes, existing.id);
      return NextResponse.json({ id: existing.id, deduplicated: true });
    }

    const id = `cust_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO customers (id, salon_id, name, phone, normalized_phone, email, preferences, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, user.salonId, name, phone, normalized, email, preferences, notes, getLuandaNow().iso);

    return NextResponse.json({ id, deduplicated: false }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageBookings(user.role)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '');
    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM customers WHERE id = ? AND salon_id = ?')
      .get(id, user.salonId);

    if (!existing) {
      return NextResponse.json({ error: 'Cliente não encontrada.' }, { status: 404 });
    }

    db.prepare(
      `UPDATE customers
       SET name = COALESCE(?, name),
           email = ?,
           preferences = ?,
           notes = ?
       WHERE id = ? AND salon_id = ?`
    ).run(
      body.name ? String(body.name).trim() : null,
      body.email ? String(body.email).trim() : null,
      body.preferences ? String(body.preferences).trim() : null,
      body.notes ? String(body.notes).trim() : null,
      id,
      user.salonId
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
