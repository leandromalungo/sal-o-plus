// Autenticação HMAC-SHA256 via cookies HTTP-only, RBAC e auditoria

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getDb } from '../db/client.ts';
import { ensureSeeded } from '../db/seed.ts';
import type { SessionUser, UserRole } from '../types/domain.ts';

export const SESSION_COOKIE_NAME = 'salaomais_session';

function getSessionSecret(): string {
  return process.env.AUTH_SECRET || 'salaomais-luanda-session-key-change-in-production';
}

interface TokenPayload {
  uid: string;
  role: UserRole;
  salonId: string | null;
  professionalId: string | null;
  exp: number;
}

export function signSessionToken(payload: Omit<TokenPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function authenticateWithCredentials(
  email: string,
  password: string
): Promise<{ user: SessionUser; token: string } | null> {
  ensureSeeded();
  const db = getDb();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.name, u.phone, u.is_active,
              m.role, m.salon_id, m.professional_id
       FROM users u
       JOIN salon_members m ON m.user_id = u.id AND m.is_active = 1
       WHERE LOWER(u.email) = LOWER(?)
       LIMIT 1`
    )
    .get(email.trim()) as
    | {
        id: string;
        email: string;
        password_hash: string;
        name: string;
        phone: string | null;
        is_active: number;
        role: UserRole;
        salon_id: string | null;
        professional_id: string | null;
      }
    | undefined;

  if (!row || !row.is_active) return null;
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;

  const user: SessionUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    salonId: row.salon_id,
    professionalId: row.professional_id,
  };

  const token = signSessionToken({
    uid: user.id,
    role: user.role,
    salonId: user.salonId,
    professionalId: user.professionalId,
  });

  return { user, token };
}

export function loadUserFromToken(token: string | undefined | null): SessionUser | null {
  const payload = verifySessionToken(token);
  if (!payload) return null;

  ensureSeeded();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.is_active,
              m.role, m.salon_id, m.professional_id
       FROM users u
       JOIN salon_members m ON m.user_id = u.id AND m.is_active = 1
       WHERE u.id = ?
       LIMIT 1`
    )
    .get(payload.uid) as
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

  if (!row || !row.is_active) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    salonId: row.salon_id,
    professionalId: row.professional_id,
  };
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return loadUserFromToken(token);
}

export {
  assertSalonIsolation,
  canAccessFinance,
  canManageBookings,
  canManageSalonSettings,
  ForbiddenError,
  UnauthorizedError,
} from './rbac.ts';

export function logAuditEvent(params: {
  salonId: string | null;
  userId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_logs (id, salon_id, user_id, actor_name, action, entity_type, entity_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `aud_${crypto.randomUUID()}`,
    params.salonId,
    params.userId,
    params.actorName,
    params.action,
    params.entityType,
    params.entityId ?? null,
    params.details ?? null,
    new Date().toISOString()
  );
}
