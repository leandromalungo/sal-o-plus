import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSessionWithLayer } from '@/lib/auth/session';
import { isValidAuthLayer } from '@/lib/auth/layers';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { mapSalonRow } from '@/lib/booking/engine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  ensureSeeded();
  const queryLayer = req.nextUrl.searchParams.get('layer');
  const explicitLayer = isValidAuthLayer(queryLayer) ? queryLayer : undefined;

  const session = await getCurrentSessionWithLayer(explicitLayer);
  if (!session) {
    return NextResponse.json(
      { user: null, layer: null, salon: null },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let salon = null;
  if (session.user.salonId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM salons WHERE id = ?').get(session.user.salonId) as
      | Record<string, unknown>
      | undefined;
    if (row) salon = mapSalonRow(row);
  }

  return NextResponse.json(
    { user: session.user, layer: session.layer, salon },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
