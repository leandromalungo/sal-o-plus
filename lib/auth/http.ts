import { NextResponse } from 'next/server';
import {
  ForbiddenError,
  getCurrentSessionUser,
  UnauthorizedError,
} from './session.ts';
import type { AuthLayer } from './layers.ts';
import { BookingError } from '../booking/engine.ts';
import { FinanceError } from '../finance/service.ts';
import type { SessionUser } from '../types/domain.ts';

export async function requireSessionUser(explicitLayer?: AuthLayer): Promise<SessionUser> {
  const user = await getCurrentSessionUser(explicitLayer);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof BookingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
  }
  if (error instanceof FinanceError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  console.error('[Salão+ API Error]', error);
  const message = error instanceof Error ? error.message : 'Erro interno do servidor.';
  return NextResponse.json({ error: message }, { status: 500 });
}
