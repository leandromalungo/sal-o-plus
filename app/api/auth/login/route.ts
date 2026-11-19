import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateWithCredentials,
  logAuditEvent,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';
import { handleApiError } from '@/lib/auth/http';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-mail e palavra-passe são obrigatórios.' },
        { status: 400 }
      );
    }

    const result = await authenticateWithCredentials(email, password);
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
    });

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(SESSION_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
