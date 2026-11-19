import { NextRequest, NextResponse } from 'next/server';
import {
  ALL_AUTH_LAYERS,
  AUTH_LAYERS,
  GESTAO_FALLBACK_LAYER_COOKIE,
  isValidAuthLayer,
} from '@/lib/auth/layers';

export async function POST(req: NextRequest) {
  let requestedLayer: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.layer === 'string') {
      requestedLayer = body.layer;
    }
  } catch {
    // Corpo vazio significa encerramento da camada indicada pelo header ou todas
  }

  const headerLayer = req.headers.get('x-salao-layer') || undefined;
  const target = requestedLayer || headerLayer;

  const isHttps =
    req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';

  const response = NextResponse.json({ ok: true });

  if (target && isValidAuthLayer(target)) {
    response.cookies.set(AUTH_LAYERS[target].cookieName, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 0,
    });
    return response;
  }

  for (const layer of ALL_AUTH_LAYERS) {
    response.cookies.set(AUTH_LAYERS[layer].cookieName, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 0,
    });
  }
  response.cookies.set(GESTAO_FALLBACK_LAYER_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 0,
  });

  return response;
}
