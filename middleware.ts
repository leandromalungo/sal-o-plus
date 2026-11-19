import { NextRequest, NextResponse } from 'next/server';
import { AUTH_LAYERS, SALON_STAFF_LAYERS, isRoleAllowedInLayer, isValidAuthLayer, type AuthLayer } from '@/lib/auth/layers';
import type { UserRole } from '@/lib/types/domain';

function getSessionSecret(): string {
  return process.env.AUTH_SECRET || 'salaomais-luanda-session-key-change-in-production';
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((base64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface EdgeTokenPayload {
  uid: string;
  role: UserRole;
  layer: AuthLayer;
  exp: number;
}

async function verifyTokenEdge(
  token: string | undefined,
  expectedLayer: AuthLayer
): Promise<EdgeTokenPayload | null> {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(getSessionSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlToUint8Array(sig);
    const sigBuffer = new Uint8Array(sigBytes).buffer;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      encoder.encode(encoded)
    );
    if (!valid) return null;

    const jsonBytes = base64UrlToUint8Array(encoded);
    const parsed = JSON.parse(new TextDecoder().decode(jsonBytes)) as EdgeTokenPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (!isValidAuthLayer(parsed.layer) || parsed.layer !== expectedLayer) return null;
    if (!isRoleAllowedInLayer(parsed.role, expectedLayer)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Proteção server-side estrita do painel administrativo (/admin)
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const adminToken = req.cookies.get(AUTH_LAYERS.admin.cookieName)?.value;
    const verified = await verifyTokenEdge(adminToken, 'admin');
    if (!verified) {
      const loginUrl = new URL('/login/admin', req.url);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Proteção server-side das rotas privadas do salão (/gestao/*)
  if (pathname === '/gestao' || pathname.startsWith('/gestao/')) {
    const requestedLayer = req.nextUrl.searchParams.get('layer');
    const validStaffSessions: EdgeTokenPayload[] = [];

    for (const layer of SALON_STAFF_LAYERS) {
      const token = req.cookies.get(AUTH_LAYERS[layer].cookieName)?.value;
      const verified = await verifyTokenEdge(token, layer);
      if (verified) {
        validStaffSessions.push(verified);
      }
    }

    if (validStaffSessions.length === 0) {
      const targetLogin =
        requestedLayer && isValidAuthLayer(requestedLayer) && requestedLayer !== 'admin'
          ? AUTH_LAYERS[requestedLayer].loginPath
          : '/login';
      const loginUrl = new URL(targetLogin, req.url);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    const activeSession =
      requestedLayer && isValidAuthLayer(requestedLayer) && requestedLayer !== 'admin'
        ? validStaffSessions.find((s) => s.layer === requestedLayer) ?? null
        : validStaffSessions[0];

    if (!activeSession) {
      const targetLogin =
        requestedLayer && isValidAuthLayer(requestedLayer) && requestedLayer !== 'admin'
          ? AUTH_LAYERS[requestedLayer].loginPath
          : '/login';
      return applySecurityHeaders(NextResponse.redirect(new URL(targetLogin, req.url)));
    }

    // Restrições de rota por papel antes mesmo de renderizar HTML/JS
    if (activeSession.role === 'PROFESSIONAL') {
      const allowedProPaths = ['/gestao', '/gestao/agenda'];
      if (!allowedProPaths.includes(pathname)) {
        return applySecurityHeaders(NextResponse.redirect(new URL('/gestao/agenda', req.url)));
      }
    }
    if (activeSession.role === 'RECEPTIONIST' && pathname === '/gestao/configuracoes') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/gestao/agenda', req.url)));
    }

    return applySecurityHeaders(NextResponse.next());
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/gestao/:path*', '/login/:path*', '/api/:path*'],
};
