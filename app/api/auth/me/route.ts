import { NextResponse } from 'next/server';
import { getCurrentSessionUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { mapSalonRow } from '@/lib/booking/engine';

export async function GET() {
  ensureSeeded();
  const user = await getCurrentSessionUser();
  if (!user) {
    return NextResponse.json({ user: null, salon: null }, { status: 401 });
  }

  let salon = null;
  if (user.salonId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM salons WHERE id = ?').get(user.salonId) as Record<string, unknown> | undefined;
    if (row) salon = mapSalonRow(row);
  }

  return NextResponse.json({ user, salon });
}
