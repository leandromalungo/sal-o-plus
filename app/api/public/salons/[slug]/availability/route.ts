import { NextRequest, NextResponse } from 'next/server';
import { getPublicAvailableSlots, getPublicSalonBySlug } from '@/lib/booking/engine';
import { handleApiError } from '@/lib/auth/http';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const salon = getPublicSalonBySlug(slug);
    if (!salon) {
      return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
    }

    const search = req.nextUrl.searchParams;
    const date = search.get('date') || '';
    const serviceIdsParam = search.get('serviceIds') || '';
    const professionalId = search.get('professionalId') || 'any';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Parâmetro date inválido (use YYYY-MM-DD).' }, { status: 400 });
    }

    const serviceIds = serviceIdsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (serviceIds.length === 0) {
      return NextResponse.json({ error: 'Informe pelo menos um serviço.' }, { status: 400 });
    }

    const availability = getPublicAvailableSlots({
      salonId: salon.id,
      date,
      serviceIds,
      professionalId,
    });

    return NextResponse.json(availability);
  } catch (error) {
    return handleApiError(error);
  }
}
