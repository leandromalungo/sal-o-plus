import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { getPublicSalonBySlug, getSuggestedOpenDate } from '@/lib/booking/engine';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  ensureSeeded();
  const { slug } = await context.params;
  const salon = getPublicSalonBySlug(slug);

  if (!salon) {
    return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
  }
  if (salon.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'Este salão encontra-se temporariamente indisponível na plataforma.' },
      { status: 403 }
    );
  }

  const db = getDb();
  const categories = db
    .prepare('SELECT id, name, description, sort_order FROM service_categories WHERE salon_id = ? ORDER BY sort_order ASC, name ASC')
    .all(salon.id);

  const services = db
    .prepare(
      `SELECT id, category_id, name, description, price_kz, duration_minutes, buffer_minutes, image_url
       FROM services
       WHERE salon_id = ? AND is_active = 1
       ORDER BY name ASC`
    )
    .all(salon.id);

  const professionals = db
    .prepare(
      `SELECT id, name, avatar_url, specialties
       FROM professionals
       WHERE salon_id = ? AND is_active = 1
       ORDER BY name ASC`
    )
    .all(salon.id);

  const professionalServices = db
    .prepare('SELECT professional_id, service_id FROM professional_services WHERE salon_id = ?')
    .all(salon.id);

  const workingHours = db
    .prepare(
      `SELECT day_of_week, is_open, open_time, close_time, break_start, break_end
       FROM salon_working_hours
       WHERE salon_id = ?
       ORDER BY day_of_week ASC`
    )
    .all(salon.id);

  const suggestedDate = getSuggestedOpenDate(salon.id);

  return NextResponse.json({
    salon,
    categories,
    services,
    professionals,
    professionalServices,
    workingHours,
    suggestedDate,
  });
}
