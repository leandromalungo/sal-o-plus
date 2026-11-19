import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canManageBookings, logAuditEvent } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { getLuandaNow, timeToMinutes } from '@/lib/utils/time';

export async function GET(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const date = req.nextUrl.searchParams.get('date');
    const db = getDb();

    const blocks = date
      ? db
          .prepare(
            `SELECT b.*, p.name as professional_name
             FROM blocked_time_slots b
             LEFT JOIN professionals p ON p.id = b.professional_id
             WHERE b.salon_id = ? AND b.date = ?
             ORDER BY b.start_minutes ASC`
          )
          .all(user.salonId, date)
      : db
          .prepare(
            `SELECT b.*, p.name as professional_name
             FROM blocked_time_slots b
             LEFT JOIN professionals p ON p.id = b.professional_id
             WHERE b.salon_id = ?
             ORDER BY b.date DESC, b.start_minutes ASC
             LIMIT 100`
          )
          .all(user.salonId);

    return NextResponse.json({ blocks });
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

    const body = await req.json();
    const professionalId =
      user.role === 'PROFESSIONAL'
        ? user.professionalId
        : body.professionalId && body.professionalId !== 'ALL'
        ? String(body.professionalId)
        : null;

    if (user.role !== 'PROFESSIONAL' && !canManageBookings(user.role)) {
      return NextResponse.json({ error: 'Sem permissão para bloquear horários.' }, { status: 403 });
    }

    const date = String(body.date || '');
    const startTime = String(body.startTime || '');
    const endTime = String(body.endTime || '');
    const reason = String(body.reason || 'Bloqueio manual').trim();
    const blockType = String(body.blockType || 'PERSONAL');

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
      return NextResponse.json({ error: 'A hora de fim deve ser posterior à hora de início.' }, { status: 400 });
    }

    const db = getDb();
    const id = `blk_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO blocked_time_slots (
        id, salon_id, professional_id, date, start_time, end_time,
        start_minutes, end_minutes, reason, block_type, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      user.salonId,
      professionalId,
      date,
      startTime,
      endTime,
      startMinutes,
      endMinutes,
      reason,
      blockType,
      user.id,
      getLuandaNow().iso
    );

    logAuditEvent({
      salonId: user.salonId,
      userId: user.id,
      actorName: user.name,
      action: 'BLOCK_TIME_SLOT',
      entityType: 'BLOCKED_TIME_SLOT',
      entityId: id,
      details: `${date} ${startTime}-${endTime}: ${reason}`,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT id, salon_id, professional_id FROM blocked_time_slots WHERE id = ?')
      .get(id) as { id: string; salon_id: string; professional_id: string | null } | undefined;

    if (!existing || existing.salon_id !== user.salonId) {
      return NextResponse.json({ error: 'Bloqueio não encontrado.' }, { status: 404 });
    }

    if (user.role === 'PROFESSIONAL' && existing.professional_id !== user.professionalId) {
      return NextResponse.json({ error: 'Sem permissão para remover este bloqueio.' }, { status: 403 });
    }

    db.prepare('DELETE FROM blocked_time_slots WHERE id = ? AND salon_id = ?').run(id, user.salonId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
