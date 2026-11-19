import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { ForbiddenError, logAuditEvent } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import type { SalonStatus } from '@/lib/types/domain';

export async function GET() {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Acesso restrito ao Super Admin da plataforma Salão+.');
    }

    const db = getDb();
    const salons = db
      .prepare(
        `SELECT s.*,
                sub.monthly_price_kz, sub.status as subscription_status, sub.renews_at,
                (SELECT COUNT(*) FROM appointments a WHERE a.salon_id = s.id) as total_appointments,
                (SELECT COUNT(*) FROM customers c WHERE c.salon_id = s.id) as total_customers,
                (SELECT COUNT(*) FROM professionals p WHERE p.salon_id = s.id AND p.is_active = 1) as active_professionals,
                (SELECT COALESCE(SUM(pay.amount_kz), 0) FROM payments pay WHERE pay.salon_id = s.id) as gmv_kz
         FROM salons s
         LEFT JOIN subscriptions sub ON sub.salon_id = s.id
         ORDER BY s.created_at DESC`
      )
      .all();

    const users = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.phone, u.is_active, m.role, m.salon_id, s.name as salon_name
         FROM users u
         JOIN salon_members m ON m.user_id = u.id
         LEFT JOIN salons s ON s.id = m.salon_id
         ORDER BY u.created_at DESC`
      )
      .all();

    const auditLogs = db
      .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 40')
      .all();

    const indicators = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM salons) as total_salons,
           (SELECT COUNT(*) FROM salons WHERE status = 'ACTIVE') as active_salons,
           (SELECT COUNT(*) FROM appointments) as total_appointments,
           (SELECT COALESCE(SUM(monthly_price_kz), 0) FROM subscriptions WHERE status = 'ACTIVE') as mrr_kz`
      )
      .get();

    return NextResponse.json({ salons, users, auditLogs, indicators });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Apenas o Super Admin pode gerir estabelecimentos da plataforma.');
    }

    const body = await req.json();
    const salonId = String(body.salonId || '');
    const status = body.status ? (String(body.status) as SalonStatus) : null;
    const planName = body.planName ? String(body.planName) : null;

    const db = getDb();
    const existing = db.prepare('SELECT id FROM salons WHERE id = ?').get(salonId);
    if (!existing) {
      return NextResponse.json({ error: 'Salão não encontrado.' }, { status: 404 });
    }

    if (status && ['ACTIVE', 'SUSPENDED', 'INACTIVE'].includes(status)) {
      db.prepare('UPDATE salons SET status = ? WHERE id = ?').run(status, salonId);
      db.prepare('UPDATE subscriptions SET status = ? WHERE salon_id = ?').run(
        status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED',
        salonId
      );
    }

    if (planName) {
      const price = planName === 'Enterprise' ? 85000 : planName === 'Profissional' ? 45000 : 25000;
      db.prepare('UPDATE salons SET plan_name = ? WHERE id = ?').run(planName, salonId);
      db.prepare('UPDATE subscriptions SET plan_name = ?, monthly_price_kz = ? WHERE salon_id = ?').run(
        planName,
        price,
        salonId
      );
    }

    logAuditEvent({
      salonId,
      userId: user.id,
      actorName: user.name,
      action: 'ADMIN_SALON_UPDATE',
      entityType: 'SALON',
      entityId: salonId,
      details: `status=${status ?? '-'}, plan=${planName ?? '-'}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
