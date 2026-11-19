import type { NextRequest } from 'next/server';

export function isHttpsRequest(req: NextRequest): boolean {
  const forwardedProto = (req.headers.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return req.nextUrl.protocol === 'https:' || forwardedProto === 'https';
}

export function getAuthCookieOptions(isHttps: boolean, maxAge = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    path: '/',
    maxAge,
  };
}
