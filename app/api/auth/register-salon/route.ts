import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { runInTransaction } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { signSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { handleApiError } from '@/lib/auth/http';
import { addDays, getLuandaNow } from '@/lib/utils/time';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const body = await req.json();
    const salonName = String(body.salonName || '').trim();
    const ownerName = String(body.ownerName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const address = String(body.address || 'Luanda, Angola').trim();

    if (!salonName || !ownerName || !email || !phone || password.length < 6) {
      return NextResponse.json(
        { error: 'Preencha todos os campos obrigatórios (palavra-passe mínima de 6 caracteres).' },
        { status: 400 }
      );
    }

    const baseSlug = slugify(salonName) || 'salao';
    const now = getLuandaNow();

    const created = runInTransaction((db) => {
      const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
      if (existingEmail) {
        throw new Error('Já existe uma conta registada com este e-mail.');
      }

      let slug = baseSlug;
      const slugCollision = db.prepare('SELECT id FROM salons WHERE slug = ?').get(slug);
      if (slugCollision) {
        slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const salonId = `salon_${crypto.randomUUID()}`;
      const userId = `user_${crypto.randomUUID()}`;
      const memberId = `mem_${crypto.randomUUID()}`;
      const hash = bcrypt.hashSync(password, 10);

      db.prepare(
        `INSERT INTO salons (
          id, name, slug, description, address, city, phone, email,
          cover_url, timezone, currency, slot_interval_minutes,
          min_advance_hours, max_advance_days, min_cancel_hours, pending_hold_minutes,
          allow_client_cancel, is_temporarily_closed, status, plan_name, created_at
        ) VALUES (?, ?, ?, ?, ?, 'Luanda', ?, ?, '/images/salon_studio_cover_1795068461036.jpg', 'Africa/Luanda', 'AOA', 30, 2, 60, 4, 10, 1, 0, 'ACTIVE', 'Profissional', ?)`
      ).run(
        salonId,
        salonName,
        slug,
        `Salão de beleza em Luanda gerido no Salão+.`,
        address,
        phone,
        email,
        now.iso
      );

      db.prepare(
        'INSERT INTO subscriptions (id, salon_id, plan_name, monthly_price_kz, status, renews_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(`sub_${crypto.randomUUID()}`, salonId, 'Profissional', 45000, 'ACTIVE', addDays(now.date, 30));

      for (let d = 0; d <= 6; d++) {
        db.prepare(
          `INSERT INTO salon_working_hours (id, salon_id, day_of_week, is_open, open_time, close_time)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          `swh_${crypto.randomUUID()}`,
          salonId,
          d,
          d === 0 ? 0 : 1,
          '08:00',
          d === 6 ? '16:00' : '18:00'
        );
      }

      db.prepare(
        `INSERT INTO notification_preferences (id, salon_id, whatsapp_enabled, sms_enabled, email_enabled, reminder_hours_before, second_reminder_hours)
         VALUES (?, ?, 1, 0, 1, 24, 2)`
      ).run(`np_${crypto.randomUUID()}`, salonId);

      db.prepare(
        'INSERT INTO users (id, email, password_hash, name, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
      ).run(userId, email, hash, ownerName, phone, now.iso);

      db.prepare(
        'INSERT INTO salon_members (id, salon_id, user_id, role, professional_id, is_active, created_at) VALUES (?, ?, ?, ?, NULL, 1, ?)'
      ).run(memberId, salonId, userId, 'OWNER', now.iso);

      return {
        user: {
          id: userId,
          email,
          name: ownerName,
          phone,
          role: 'OWNER' as const,
          salonId,
          professionalId: null,
        },
        slug,
      };
    });

    const token = signSessionToken({
      uid: created.user.id,
      role: created.user.role,
      salonId: created.user.salonId,
      professionalId: null,
    });

    const response = NextResponse.json(created, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Já existe uma conta')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error);
  }
}
