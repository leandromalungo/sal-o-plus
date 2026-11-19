import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canManageSalonSettings, logAuditEvent } from '@/lib/auth/session';
import { getDb, runInTransaction } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { getLuandaNow } from '@/lib/utils/time';

export async function GET() {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const db = getDb();
    const categories = db
      .prepare('SELECT * FROM service_categories WHERE salon_id = ? ORDER BY sort_order ASC, name ASC')
      .all(user.salonId);

    const services = db
      .prepare(
        `SELECT s.*, sc.name as category_name
         FROM services s
         LEFT JOIN service_categories sc ON sc.id = s.category_id
         WHERE s.salon_id = ?
         ORDER BY s.is_active DESC, s.name ASC`
      )
      .all(user.salonId);

    const proLinks = db
      .prepare('SELECT professional_id, service_id FROM professional_services WHERE salon_id = ?')
      .all(user.salonId);

    return NextResponse.json({ categories, services, proLinks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageSalonSettings(user.role)) {
      return NextResponse.json({ error: 'Apenas a proprietária pode criar serviços ou categorias.' }, { status: 403 });
    }

    const body = await req.json();

    if (body.kind === 'CATEGORY') {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Nome da categoria obrigatório.' }, { status: 400 });
      const db = getDb();
      const id = `cat_${crypto.randomUUID()}`;
      db.prepare('INSERT INTO service_categories (id, salon_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(id, user.salonId, name, body.description ? String(body.description).trim() : null, Number(body.sortOrder || 0));
      return NextResponse.json({ id }, { status: 201 });
    }

    const name = String(body.name || '').trim();
    const priceKz = Number(body.priceKz || 0);
    const durationMinutes = Number(body.durationMinutes || 30);
    const bufferMinutes = Number(body.bufferMinutes || 0);
    const categoryId = body.categoryId ? String(body.categoryId) : null;
    const professionalIds: string[] = Array.isArray(body.professionalIds) ? body.professionalIds.map(String) : [];

    if (!name || priceKz <= 0 || durationMinutes <= 0) {
      return NextResponse.json({ error: 'Nome, preço positivo (Kz) e duração (min) são obrigatórios.' }, { status: 400 });
    }

    const id = runInTransaction((db) => {
      const svcId = `svc_${crypto.randomUUID()}`;
      db.prepare(
        `INSERT INTO services (id, salon_id, category_id, name, description, price_kz, duration_minutes, buffer_minutes, image_url, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`
      ).run(
        svcId,
        user.salonId!,
        categoryId,
        name,
        String(body.description || '').trim(),
        Math.round(priceKz),
        Math.round(durationMinutes),
        Math.max(0, Math.round(bufferMinutes)),
        getLuandaNow().iso
      );

      for (const pid of professionalIds) {
        db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, salon_id) VALUES (?, ?, ?)')
          .run(pid, svcId, user.salonId!);
      }
      return svcId;
    });

    logAuditEvent({
      salonId: user.salonId,
      userId: user.id,
      actorName: user.name,
      action: 'SERVICE_CREATE',
      entityType: 'SERVICE',
      entityId: id,
      details: `${name} (${priceKz} Kz / ${durationMinutes}m)`,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId || !canManageSalonSettings(user.role)) {
      return NextResponse.json({ error: 'Apenas a proprietária pode editar serviços.' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '');
    const db = getDb();

    const existing = db.prepare('SELECT id FROM services WHERE id = ? AND salon_id = ?').get(id, user.salonId);
    if (!existing) {
      return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
    }

    runInTransaction((txDb) => {
      txDb
        .prepare(
          `UPDATE services
           SET name = COALESCE(?, name),
               description = COALESCE(?, description),
               category_id = COALESCE(?, category_id),
               price_kz = COALESCE(?, price_kz),
               duration_minutes = COALESCE(?, duration_minutes),
               buffer_minutes = COALESCE(?, buffer_minutes),
               is_active = COALESCE(?, is_active)
           WHERE id = ? AND salon_id = ?`
        )
        .run(
          body.name ? String(body.name).trim() : null,
          body.description !== undefined ? String(body.description).trim() : null,
          body.categoryId !== undefined ? (body.categoryId ? String(body.categoryId) : null) : null,
          body.priceKz !== undefined ? Math.round(Number(body.priceKz)) : null,
          body.durationMinutes !== undefined ? Math.round(Number(body.durationMinutes)) : null,
          body.bufferMinutes !== undefined ? Math.max(0, Math.round(Number(body.bufferMinutes))) : null,
          body.isActive !== undefined ? (body.isActive ? 1 : 0) : null,
          id,
          user.salonId!
        );

      if (Array.isArray(body.professionalIds)) {
        txDb.prepare('DELETE FROM professional_services WHERE service_id = ? AND salon_id = ?').run(id, user.salonId!);
        for (const pid of body.professionalIds) {
          txDb
            .prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, salon_id) VALUES (?, ?, ?)')
            .run(String(pid), id, user.salonId!);
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
