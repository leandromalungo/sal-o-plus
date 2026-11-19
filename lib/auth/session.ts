// Autenticação HMAC-SHA256 isolada por camada via cookies HTTP-only, RBAC e auditoria

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import { getDb } from '../db/client.ts';
import { ensureSeeded } from '../db/seed.ts';
import type { SessionUser, UserRole } from '../types/domain.ts';
import {
  AUTH_LAYERS,
  GESTAO_FALLBACK_LAYER_COOKIE,
  SALON_STAFF_LAYERS,
  getDefaultLayerForRole,
  isRoleAllowedInLayer,
  isValidAuthLayer,
  type AuthLayer,
} from './layers.ts';
import { ForbiddenError } from './rbac.ts';

function getSessionSecret(): string {
  return process.env.AUTH_SECRET || 'salaomais-luanda-session-key-change-in-production';
}

interface TokenPayload {
  uid: string;
  role: UserRole;
  layer: AuthLayer;
  salonId: string | null;
  professionalId: string | null;
  exp: number;
}

export function signSessionToken(
  payload: Omit<TokenPayload, 'exp'>,
  ttlSeconds = 60 * 60 * 24 * 7
): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  expectedLayer?: AuthLayer
): TokenPayload | null {
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
    if (!isValidAuthLayer(parsed.layer)) {
      return null;
    }
    if (expectedLayer && parsed.layer !== expectedLayer) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export class GoogleOnlyAccountError extends Error {
  status = 401;
  constructor(
    message = 'Esta conta foi criada com o Google. Clique em «Continuar com Google» para iniciar sessão.'
  ) {
    super(message);
  }
}

export async function authenticateWithCredentials(
  email: string,
  password: string,
  requestedLayer?: AuthLayer
): Promise<{ user: SessionUser; token: string; layer: AuthLayer } | null> {
  ensureSeeded();
  const db = getDb();

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.auth_provider, u.name, u.phone, u.is_active,
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
        auth_provider?: string;
        name: string;
        phone: string | null;
        is_active: number;
        role: UserRole;
        salon_id: string | null;
        professional_id: string | null;
      }
    | undefined;

  if (!row || !row.is_active) return null;
  if (row.auth_provider === 'GOOGLE') {
    throw new GoogleOnlyAccountError();
  }
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;

  const targetLayer = requestedLayer ?? getDefaultLayerForRole(row.role);

  if (!isRoleAllowedInLayer(row.role, targetLayer)) {
    throw new ForbiddenError('Acesso não autorizado para este portal.');
  }

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
    layer: targetLayer,
    salonId: user.salonId,
    professionalId: user.professionalId,
  });

  return { user, token, layer: targetLayer };
}

export function loadUserFromToken(
  token: string | undefined | null,
  expectedLayer?: AuthLayer
): { user: SessionUser; layer: AuthLayer } | null {
  const payload = verifySessionToken(token, expectedLayer);
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
  if (!isRoleAllowedInLayer(row.role, payload.layer)) return null;

  return {
    layer: payload.layer,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role,
      salonId: row.salon_id,
      professionalId: row.professional_id,
    },
  };
}

export async function getCurrentSessionWithLayer(
  explicitLayer?: AuthLayer
): Promise<{ user: SessionUser; layer: AuthLayer } | null> {
  const cookieStore = await cookies();

  // 1. Camada explícita (ex.: 'admin' nas rotas /api/admin/* ou query/header explícito)
  if (explicitLayer) {
    const token = cookieStore.get(AUTH_LAYERS[explicitLayer].cookieName)?.value;
    return loadUserFromToken(token, explicitLayer);
  }

  // 2. Header x-salao-layer enviado pela aba atual (garante múltiplas abas isoladas sem colisão)
  const reqHeaders = await headers();
  const headerLayer = reqHeaders.get('x-salao-layer');
  if (isValidAuthLayer(headerLayer) && SALON_STAFF_LAYERS.includes(headerLayer)) {
    const token = cookieStore.get(AUTH_LAYERS[headerLayer].cookieName)?.value;
    return loadUserFromToken(token, headerLayer);
  }

  // 3. Fallback apenas entre camadas do salão (nunca mistura com 'admin')
  const fallbackLayer = cookieStore.get(GESTAO_FALLBACK_LAYER_COOKIE)?.value;
  if (isValidAuthLayer(fallbackLayer) && SALON_STAFF_LAYERS.includes(fallbackLayer)) {
    const token = cookieStore.get(AUTH_LAYERS[fallbackLayer].cookieName)?.value;
    const loaded = loadUserFromToken(token, fallbackLayer);
    if (loaded) return loaded;
  }

  // 4. Procura primeira sessão válida de salão
  for (const staffLayer of SALON_STAFF_LAYERS) {
    const token = cookieStore.get(AUTH_LAYERS[staffLayer].cookieName)?.value;
    const loaded = loadUserFromToken(token, staffLayer);
    if (loaded) return loaded;
  }

  return null;
}

export async function getCurrentSessionUser(explicitLayer?: AuthLayer): Promise<SessionUser | null> {
  const result = await getCurrentSessionWithLayer(explicitLayer);
  return result?.user ?? null;
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
