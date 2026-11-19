import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { getDb, runInTransaction } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import {
  ForbiddenError,
  logAuditEvent,
  signSessionToken,
} from '@/lib/auth/session';
import {
  AUTH_LAYERS,
  GESTAO_FALLBACK_LAYER_COOKIE,
  getDefaultLayerForRole,
  isRoleAllowedInLayer,
  isValidAuthLayer,
} from '@/lib/auth/layers';
import { getAuthCookieOptions, isHttpsRequest } from '@/lib/auth/cookies';
import { handleApiError } from '@/lib/auth/http';
import { verifyGoogleIdentity } from '@/lib/auth/google-server';
import type { SessionUser, UserRole } from '@/lib/types/domain';
import { addDays, getLuandaNow } from '@/lib/utils/time';

export const dynamic = 'force-dynamic';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function attachLayerCookies(
  response: NextResponse,
  req: NextRequest,
  layer: keyof typeof AUTH_LAYERS,
  token: string
) {
  const cookieOptions = getAuthCookieOptions(isHttpsRequest(req));

  response.cookies.set(AUTH_LAYERS[layer].cookieName, token, cookieOptions);

  if (layer !== 'admin') {
    response.cookies.set(GESTAO_FALLBACK_LAYER_COOKIE, layer, cookieOptions);
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();

    const authHeader = req.headers.get('authorization');
    const bearerToken =
      authHeader && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : null;

    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const rawLayer = body.layer;
    if (rawLayer !== undefined && !isValidAuthLayer(rawLayer)) {
      return NextResponse.json(
        { error: 'Camada de autenticação inválida.' },
        { status: 400 }
      );
    }

    const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : null;
    const identity = await verifyGoogleIdentity({
      accessToken: bearerToken,
      idToken,
    });

    if (!identity) {
      return NextResponse.json(
        { error: 'Sessão Google inválida ou expirada. Tente novamente.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const existingRow = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.phone, u.is_active,
                m.role, m.salon_id, m.professional_id
         FROM users u
         JOIN salon_members m ON m.user_id = u.id AND m.is_active = 1
         WHERE LOWER(u.email) = LOWER(?)
         LIMIT 1`
      )
      .get(identity.email) as
      | {
          id: string;
          email: string;
          name: string;
          phone: string | null;
          is_active: number;
          role: UserRole;
          salon_id: string | null;
          professional_id: string | null;
        }
      | undefined;

    if (existingRow) {
      if (!existingRow.is_active) {
        return NextResponse.json(
          { error: 'Esta conta encontra-se desativada.' },
          { status: 401 }
        );
      }

      const targetLayer = rawLayer ?? getDefaultLayerForRole(existingRow.role);
      if (!isRoleAllowedInLayer(existingRow.role, targetLayer)) {
        throw new ForbiddenError('Acesso não autorizado para este portal.');
      }

      const user: SessionUser = {
        id: existingRow.id,
        email: existingRow.email,
        name: existingRow.name,
        phone: existingRow.phone,
        role: existingRow.role,
        salonId: existingRow.salon_id,
        professionalId: existingRow.professional_id,
      };

      const token = signSessionToken({
        uid: user.id,
        role: user.role,
        layer: targetLayer,
        salonId: user.salonId,
        professionalId: user.professionalId,
      });

      logAuditEvent({
        salonId: user.salonId,
        userId: user.id,
        actorName: user.name,
        action: 'LOGIN_GOOGLE',
        entityType: 'USER',
        entityId: user.id,
        details: `layer=${targetLayer}`,
      });

      const layerMeta = AUTH_LAYERS[targetLayer];
      const response = NextResponse.json({
        user,
        layer: targetLayer,
        redirectPath: layerMeta.redirectPath,
      });
      attachLayerCookies(response, req, targetLayer, token);
      return response;
    }

    // Utilizadora ainda não registada no Salão+
    const requestedLayer = rawLayer ?? 'gestao';
    if (requestedLayer !== 'gestao') {
      throw new ForbiddenError('Conta Google sem acesso configurado para este portal.');
    }

    const salonName = String(body.salonName || '').trim();
    const phone = String(body.phone || '').trim();
    const ownerName = String(body.ownerName || identity.name).trim() || identity.name;
    const address = String(body.address || 'Luanda, Angola').trim() || 'Luanda, Angola';
    const optionalPassword = typeof body.password === 'string' ? body.password : '';

    if (optionalPassword && optionalPassword.length < 6) {
      return NextResponse.json(
        { error: 'A palavra-passe opcional deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      );
    }

    if (!salonName || !phone) {
      return NextResponse.json({
        needsSalonSetup: true,
        googleProfile: {
          email: identity.email,
          name: identity.name,
        },
      });
    }

    const baseSlug = slugify(salonName) || 'salao';
    const now = getLuandaNow();

    const created = runInTransaction((txDb) => {
      const collision = txDb
        .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
        .get(identity.email);
      if (collision) {
        throw new Error('Já existe uma conta registada com este e-mail.');
      }

      let slug = baseSlug;
      const slugCollision = txDb.prepare('SELECT id FROM salons WHERE slug = ?').get(slug);
      if (slugCollision) {
        slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const salonId = `salon_${crypto.randomUUID()}`;
      const userId = `user_${crypto.randomUUID()}`;
      const memberId = `mem_${crypto.randomUUID()}`;
      const hasPassword = optionalPassword.length >= 6;
      const authProvider = hasPassword ? 'BOTH' : 'GOOGLE';
      const secretSource = hasPassword ? optionalPassword : crypto.randomBytes(32).toString('hex');
      const hash = bcrypt.hashSync(secretSource, 10);

      txDb
        .prepare(
          `INSERT INTO salons (
            id, name, slug, description, address, city, phone, email,
            cover_url, timezone, currency, slot_interval_minutes,
            min_advance_hours, max_advance_days, min_cancel_hours, pending_hold_minutes,
            allow_client_cancel, is_temporarily_closed, status, plan_name, created_at
          ) VALUES (?, ?, ?, ?, ?, 'Luanda', ?, ?, '/images/salon_studio_cover_1795068461036.jpg', 'Africa/Luanda', 'AOA', 30, 2, 60, 4, 10, 1, 0, 'ACTIVE', 'Profissional', ?)`
        )
        .run(
          salonId,
          salonName,
          slug,
          'Salão de beleza em Luanda gerido no Salão+.',
          address,
          phone,
          identity.email,
          now.iso
        );

      txDb
        .prepare(
          'INSERT INTO subscriptions (id, salon_id, plan_name, monthly_price_kz, status, renews_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(`sub_${crypto.randomUUID()}`, salonId, 'Profissional', 45000, 'ACTIVE', addDays(now.date, 30));

      for (let d = 0; d <= 6; d++) {
        txDb
          .prepare(
            `INSERT INTO salon_working_hours (id, salon_id, day_of_week, is_open, open_time, close_time)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            `swh_${crypto.randomUUID()}`,
            salonId,
            d,
            d === 0 ? 0 : 1,
            '08:00',
            d === 6 ? '16:00' : '18:00'
          );
      }

      txDb
        .prepare(
          `INSERT INTO notification_preferences (id, salon_id, whatsapp_enabled, sms_enabled, email_enabled, reminder_hours_before, second_reminder_hours)
           VALUES (?, ?, 1, 0, 1, 24, 2)`
        )
        .run(`np_${crypto.randomUUID()}`, salonId);

      txDb
        .prepare(
          'INSERT INTO users (id, email, password_hash, auth_provider, name, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
        )
        .run(userId, identity.email, hash, authProvider, ownerName, phone, now.iso);

      txDb
        .prepare(
          'INSERT INTO salon_members (id, salon_id, user_id, role, professional_id, is_active, created_at) VALUES (?, ?, ?, ?, NULL, 1, ?)'
        )
        .run(memberId, salonId, userId, 'OWNER', now.iso);

      return {
        user: {
          id: userId,
          email: identity.email,
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
      layer: 'gestao',
      salonId: created.user.salonId,
      professionalId: null,
    });

    logAuditEvent({
      salonId: created.user.salonId,
      userId: created.user.id,
      actorName: created.user.name,
      action: 'REGISTER_SALON_GOOGLE',
      entityType: 'SALON',
      entityId: created.user.salonId,
      details: `slug=${created.slug}`,
    });

    const response = NextResponse.json(
      {
        ...created,
        layer: 'gestao',
        redirectPath: AUTH_LAYERS.gestao.redirectPath,
      },
      { status: 201 }
    );
    attachLayerCookies(response, req, 'gestao', token);
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
