import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canManageSalonSettings, logAuditEvent } from '@/lib/auth/session';
import { getDb, runInTransaction } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { getLuandaNow } from '@/lib/utils/time';

export async function GET() {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const db = getDb();
    const professionals = db
      .prepare('SELECT * FROM professionals WHERE salon_id = ? ORDER BY is_active DESC, name ASC')
      .all(user.salonId) as Array<Record<string, unknown>>;

    const whStmt = db.prepare(
      'SELECT day_of_week, is_working, start_time, end_time, lunch_start, lunch_end FROM professional_working_hours WHERE professional_id = ? ORDER BY day_of_week ASC'
    );
    const svcStmt = db.prepare('SELECT service_id FROM professional_services WHERE professional_id = ?');

    const enriched = professionals.map((p) => ({
      ...p,
      // Profissional não vê taxas de comissão de outras profissionais
      commission_rate:
        user.role === 'PROFESSIONAL' && p.id !== user.professionalId ? null : p.commission_rate,
      workingHours: whStmt.all(String(p.id)),
      serviceIds: (svcStmt.all(String(p.id)) as Array<{ service_id: string }>).map((s) => s.service_id),
    }));

    return NextResponse.json({ professionals: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageSalonSettings(user.role)) {
      return NextResponse.json({ error: 'Apenas a proprietária pode adicionar profissionais.' }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const specialties = String(body.specialties || '').trim();
    const commissionRate = Math.max(0, Math.min(100, Number(body.commissionRate ?? 40)));
    const createAccount = Boolean(body.createAccount && email && body.password);
    const serviceIds: string[] = Array.isArray(body.serviceIds) ? body.serviceIds.map(String) : [];

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nome e contacto da profissional são obrigatórios.' }, { status: 400 });
    }

    const now = getLuandaNow();

    const proId = runInTransaction((db) => {
      let linkedUserId: string | null = null;
      const newProId = `pro_${crypto.randomUUID()}`;

      if (createAccount && email) {
        const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
        if (existingUser) {
          throw new Error('Já existe uma conta de acesso com este e-mail.');
        }
        linkedUserId = `user_${crypto.randomUUID()}`;
        const hash = bcrypt.hashSync(String(body.password), 10);
        db.prepare(
          'INSERT INTO users (id, email, password_hash, name, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
        ).run(linkedUserId, email, hash, name, phone, now.iso);
        db.prepare(
          'INSERT INTO salon_members (id, salon_id, user_id, role, professional_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
        ).run(`mem_${crypto.randomUUID()}`, user.salonId!, linkedUserId, 'PROFESSIONAL', newProId, now.iso);
      }

      db.prepare(
        `INSERT INTO professionals (
          id, salon_id, user_id, name, phone, email, avatar_url, specialties, commission_rate, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(
        newProId,
        user.salonId!,
        linkedUserId,
        name,
        phone,
        email,
        '/images/pro_avatar_two_1795068461143.jpg',
        specialties,
        commissionRate,
        now.iso
      );

      for (let d = 0; d <= 6; d++) {
        db.prepare(
          `INSERT INTO professional_working_hours (id, salon_id, professional_id, day_of_week, is_working, start_time, end_time, lunch_start, lunch_end)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `pwh_${crypto.randomUUID()}`,
          user.salonId!,
          newProId,
          d,
          d === 0 ? 0 : 1,
          '08:00',
          d === 6 ? '16:00' : '18:00',
          d === 6 ? null : '12:30',
          d === 6 ? null : '13:30'
        );
      }

      for (const sid of serviceIds) {
        db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, salon_id) VALUES (?, ?, ?)')
          .run(newProId, sid, user.salonId!);
      }

      return newProId;
    });

    logAuditEvent({
      salonId: user.salonId,
      userId: user.id,
      actorName: user.name,
      action: 'PROFESSIONAL_CREATE',
      entityType: 'PROFESSIONAL',
      entityId: proId,
      details: name,
    });

    return NextResponse.json({ id: proId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Já existe uma conta')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageSalonSettings(user.role)) {
      return NextResponse.json({ error: 'Apenas a proprietária pode editar profissionais.' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '');
    const db = getDb();

    const existing = db
      .prepare('SELECT id FROM professionals WHERE id = ? AND salon_id = ?')
      .get(id, user.salonId);

    if (!existing) {
      return NextResponse.json({ error: 'Profissional não encontrada.' }, { status: 404 });
    }

    runInTransaction((txDb) => {
      txDb
        .prepare(
          `UPDATE professionals
           SET name = COALESCE(?, name),
               phone = COALESCE(?, phone),
               specialties = COALESCE(?, specialties),
               commission_rate = COALESCE(?, commission_rate),
               is_active = COALESCE(?, is_active)
           WHERE id = ? AND salon_id = ?`
        )
        .run(
          body.name ? String(body.name).trim() : null,
          body.phone ? String(body.phone).trim() : null,
          body.specialties !== undefined ? String(body.specialties).trim() : null,
          body.commissionRate !== undefined ? Math.max(0, Math.min(100, Number(body.commissionRate))) : null,
          body.isActive !== undefined ? (body.isActive ? 1 : 0) : null,
          id,
          user.salonId!
        );

      if (Array.isArray(body.workingHours)) {
        const stmt = txDb.prepare(
          `UPDATE professional_working_hours
           SET is_working = ?, start_time = ?, end_time = ?, lunch_start = ?, lunch_end = ?
           WHERE professional_id = ? AND salon_id = ? AND day_of_week = ?`
        );
        for (const wh of body.workingHours) {
          stmt.run(
            wh.is_working ? 1 : 0,
            String(wh.start_time || '08:00'),
            String(wh.end_time || '18:00'),
            wh.lunch_start || null,
            wh.lunch_end || null,
            id,
            user.salonId!,
            Number(wh.day_of_week)
          );
        }
      }

      if (Array.isArray(body.serviceIds)) {
        txDb.prepare('DELETE FROM professional_services WHERE professional_id = ? AND salon_id = ?').run(id, user.salonId!);
        for (const sid of body.serviceIds) {
          txDb
            .prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, salon_id) VALUES (?, ?, ?)')
            .run(id, String(sid), user.salonId!);
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
