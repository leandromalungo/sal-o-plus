import { NextRequest, NextResponse } from 'next/server';
import { authenticateWithCredentials, logAuditEvent } from '@/lib/auth/session';
import {
  AUTH_LAYERS,
  GESTAO_FALLBACK_LAYER_COOKIE,
  isValidAuthLayer,
} from '@/lib/auth/layers';
import { handleApiError } from '@/lib/auth/http';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    const rawLayer = body.layer;

    if (rawLayer !== undefined && !isValidAuthLayer(rawLayer)) {
      return NextResponse.json(
        { error: 'Camada de autenticação inválida.' },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e palavra-passe são obrigatórios.' },
        { status: 400 }
      );
    }

    const result = await authenticateWithCredentials(email, password, rawLayer);
    if (!result) {
      return NextResponse.json(
        { error: 'Credenciais inválidas. Verifique o e-mail e a palavra-passe.' },
        { status: 401 }
      );
    }

    logAuditEvent({
      salonId: result.user.salonId,
      userId: result.user.id,
      actorName: result.user.name,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: result.user.id,
      details: `layer=${result.layer}`,
    });

    const layerMeta = AUTH_LAYERS[result.layer];
    const response = NextResponse.json({
      user: result.user,
      layer: result.layer,
      redirectPath: layerMeta.redirectPath,
    });

    const isHttps =
      req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';

    response.cookies.set(layerMeta.cookieName, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    if (result.layer !== 'admin') {
      response.cookies.set(GESTAO_FALLBACK_LAYER_COOKIE, result.layer, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
