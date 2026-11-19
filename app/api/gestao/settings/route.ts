import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canManageSalonSettings, ForbiddenError, logAuditEvent } from '@/lib/auth/session';
import { getDb, runInTransaction } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { mapSalonRow } from '@/lib/booking/engine';

export async function GET() {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageSalonSettings(user.role)) {
      throw new ForbiddenError('Apenas a proprietária pode consultar as configurações do salão.');
    }

    const db = getDb();
    const salonRow = db.prepare('SELECT * FROM salons WHERE id = ?').get(user.salonId) as Record<string, unknown> | undefined;
    if (!salonRow) {
      return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
    }

    const workingHours = db
      .prepare('SELECT * FROM salon_working_hours WHERE salon_id = ? ORDER BY day_of_week ASC')
      .all(user.salonId);

    const holidays = db
      .prepare('SELECT * FROM holidays WHERE salon_id = ? ORDER BY date ASC')
      .all(user.salonId);

    const notificationPrefs = db
      .prepare('SELECT * FROM notification_preferences WHERE salon_id = ?')
      .get(user.salonId);

    const notifications = db
      .prepare('SELECT * FROM notifications WHERE salon_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(user.salonId);

    return NextResponse.json({
      salon: mapSalonRow(salonRow),
      workingHours,
      holidays,
      notificationPrefs,
      notifications,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageSalonSettings(user.role)) {
      throw new ForbiddenError('Apenas a proprietária pode alterar as configurações do salão.');
    }

    const body = await req.json();
    const db = getDb();

    if (body.action === 'ADD_HOLIDAY') {
      const id = `hol_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT OR REPLACE INTO holidays (id, salon_id, date, name, is_closed, open_time, close_time)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        user.salonId,
        String(body.date || ''),
        String(body.name || 'Feriado / Horário Especial').trim(),
        body.isClosed !== false ? 1 : 0,
        body.openTime || null,
        body.closeTime || null
      );
      return NextResponse.json({ id }, { status: 201 });
    }

    if (body.action === 'REMOVE_HOLIDAY') {
      db.prepare('DELETE FROM holidays WHERE id = ? AND salon_id = ?').run(String(body.id || ''), user.salonId);
      return NextResponse.json({ ok: true });
    }

    runInTransaction((txDb) => {
      if (body.salon) {
        const s = body.salon;
        txDb
          .prepare(
            `UPDATE salons
             SET name = COALESCE(?, name),
                 description = COALESCE(?, description),
                 address = COALESCE(?, address),
                 phone = COALESCE(?, phone),
                 email = COALESCE(?, email),
                 slot_interval_minutes = COALESCE(?, slot_interval_minutes),
                 min_advance_hours = COALESCE(?, min_advance_hours),
                 max_advance_days = COALESCE(?, max_advance_days),
                 min_cancel_hours = COALESCE(?, min_cancel_hours),
                 pending_hold_minutes = COALESCE(?, pending_hold_minutes),
                 allow_client_cancel = COALESCE(?, allow_client_cancel),
                 is_temporarily_closed = COALESCE(?, is_temporarily_closed),
                 closure_reason = ?
             WHERE id = ?`
          )
          .run(
            s.name ? String(s.name).trim() : null,
            s.description !== undefined ? String(s.description).trim() : null,
            s.address ? String(s.address).trim() : null,
            s.phone ? String(s.phone).trim() : null,
            s.email ? String(s.email).trim() : null,
            s.slotIntervalMinutes ? Number(s.slotIntervalMinutes) : null,
            s.minAdvanceHours !== undefined ? Number(s.minAdvanceHours) : null,
            s.maxAdvanceDays !== undefined ? Number(s.maxAdvanceDays) : null,
            s.minCancelHours !== undefined ? Number(s.minCancelHours) : null,
            s.pendingHoldMinutes !== undefined ? Number(s.pendingHoldMinutes) : null,
            s.allowClientCancel !== undefined ? (s.allowClientCancel ? 1 : 0) : null,
            s.isTemporarilyClosed !== undefined ? (s.isTemporarilyClosed ? 1 : 0) : null,
            s.closureReason ? String(s.closureReason).trim() : null,
            user.salonId!
          );
      }

      if (Array.isArray(body.workingHours)) {
        const stmt = txDb.prepare(
          `UPDATE salon_working_hours
           SET is_open = ?, open_time = ?, close_time = ?, break_start = ?, break_end = ?
           WHERE salon_id = ? AND day_of_week = ?`
        );
        for (const wh of body.workingHours) {
          stmt.run(
            wh.is_open ? 1 : 0,
            String(wh.open_time || '08:00'),
            String(wh.close_time || '18:00'),
            wh.break_start || null,
            wh.break_end || null,
            user.salonId!,
            Number(wh.day_of_week)
          );
        }
      }

      if (body.notificationPrefs) {
        const np = body.notificationPrefs;
        txDb
          .prepare(
            `UPDATE notification_preferences
             SET whatsapp_enabled = ?, sms_enabled = ?, email_enabled = ?,
                 reminder_hours_before = ?, second_reminder_hours = ?
             WHERE salon_id = ?`
          )
          .run(
            np.whatsapp_enabled ? 1 : 0,
            np.sms_enabled ? 1 : 0,
            np.email_enabled ? 1 : 0,
            Number(np.reminder_hours_before ?? 24),
            Number(np.second_reminder_hours ?? 2),
            user.salonId!
          );
      }
    });

    logAuditEvent({
      salonId: user.salonId,
      userId: user.id,
      actorName: user.name,
      action: 'SALON_SETTINGS_UPDATE',
      entityType: 'SALON',
      entityId: user.salonId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
