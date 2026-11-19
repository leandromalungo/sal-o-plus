import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canAccessFinance } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { ensureSeeded } from '@/lib/db/seed';
import { addDays, getDayOfWeekFromDateString, getLuandaNow } from '@/lib/utils/time';
import { releaseExpiredHolds } from '@/lib/booking/engine';

function getWeekMonday(dateStr: string): string {
  const dow = getDayOfWeekFromDateString(dateStr); // 0=Dom, 1=Seg .. 6=Sab
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, offset);
}

export async function GET(req: NextRequest) {
  try {
    ensureSeeded();
    const user = await requireSessionUser();
    if (!user.salonId) {
      return NextResponse.json({ error: 'Conta sem salão associado.' }, { status: 400 });
    }

    const db = getDb();
    const now = getLuandaNow();
    releaseExpiredHolds(db, now.iso);

    const requestedDate = req.nextUrl.searchParams.get('date');
    const selectedDate =
      requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : now.date;
    const selectedDow = getDayOfWeekFromDateString(selectedDate);

    const salonId = user.salonId;
    const isPro = Boolean(user.role === 'PROFESSIONAL' && user.professionalId);

    const proFilterSql = isPro ? ' AND a.professional_id = ?' : '';
    const proFilterParams = isPro
      ? [salonId, selectedDate, user.professionalId!]
      : [salonId, selectedDate];

    const todayStats = db
      .prepare(
        `SELECT
           COUNT(*) as total_today,
           SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
           SUM(CASE WHEN a.status IN ('CONFIRMED', 'IN_PROGRESS') THEN 1 ELSE 0 END) as confirmed_count,
           SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
           SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count
         FROM appointments a
         WHERE a.salon_id = ? AND a.date = ?${proFilterSql}`
      )
      .get(...proFilterParams) as Record<string, number | null>;

    const pendingBadgeRow = db
      .prepare(
        `SELECT COUNT(*) as cnt
         FROM appointments a
         WHERE a.salon_id = ? AND a.date >= ? AND a.status = 'PENDING'${proFilterSql}`
      )
      .get(...(isPro ? [salonId, now.date, user.professionalId!] : [salonId, now.date])) as {
      cnt: number;
    };

    const monday = getWeekMonday(selectedDate);
    const sunday = addDays(monday, 6);
    const weekRows = db
      .prepare(
        `SELECT a.date,
                COUNT(*) as total_count,
                SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN a.status = 'PENDING' THEN 1 ELSE 0 END) as pending_count
         FROM appointments a
         WHERE a.salon_id = ? AND a.date >= ? AND a.date <= ? AND a.status != 'CANCELLED'${proFilterSql}
         GROUP BY a.date`
      )
      .all(
        ...(isPro ? [salonId, monday, sunday, user.professionalId!] : [salonId, monday, sunday])
      ) as Array<{
      date: string;
      total_count: number;
      completed_count: number;
      pending_count: number;
    }>;

    const weekMap = new Map(weekRows.map((r) => [r.date, r]));
    const weekStrip = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      const row = weekMap.get(d);
      return {
        date: d,
        dayOfWeek: getDayOfWeekFromDateString(d),
        totalCount: Number(row?.total_count || 0),
        completedCount: Number(row?.completed_count || 0),
        pendingCount: Number(row?.pending_count || 0),
      };
    });

    const dayAppointments = db
      .prepare(
        `SELECT a.id, a.booking_code, a.date, a.start_time, a.start_minutes, a.service_end_time,
                a.status, a.total_price_kz, a.paid_amount_kz, a.payment_status,
                c.name as customer_name, c.phone as customer_phone,
                p.name as professional_name,
                (SELECT GROUP_CONCAT(s.service_name, ' + ')
                 FROM appointment_services s
                 WHERE s.appointment_id = a.id) as service_summary
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         JOIN professionals p ON p.id = a.professional_id
         WHERE a.salon_id = ? AND a.date = ? AND a.status != 'CANCELLED'${proFilterSql}
         ORDER BY a.start_minutes ASC`
      )
      .all(...proFilterParams);

    const upcomingAppointments = db
      .prepare(
        `SELECT a.*, c.name as customer_name, c.phone as customer_phone, p.name as professional_name,
                (SELECT GROUP_CONCAT(s.service_name, ' + ')
                 FROM appointment_services s
                 WHERE s.appointment_id = a.id) as service_summary
         FROM appointments a
         JOIN customers c ON c.id = a.customer_id
         JOIN professionals p ON p.id = a.professional_id
         WHERE a.salon_id = ?
           AND (a.date > ? OR (a.date = ? AND a.start_minutes >= ?))
           AND a.status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS')
           ${isPro ? 'AND a.professional_id = ?' : ''}
         ORDER BY a.date ASC, a.start_minutes ASC
         LIMIT 8`
      )
      .all(
        ...(isPro
          ? [salonId, now.date, now.date, now.minutes, user.professionalId!]
          : [salonId, now.date, now.date, now.minutes])
      );

    const availableProsToday = db
      .prepare(
        `SELECT p.id, p.name, p.specialties, p.avatar_url, pwh.start_time, pwh.end_time
         FROM professionals p
         JOIN professional_working_hours pwh ON pwh.professional_id = p.id AND pwh.day_of_week = ?
         WHERE p.salon_id = ? AND p.is_active = 1 AND pwh.is_working = 1
         ORDER BY p.name ASC`
      )
      .all(selectedDow, salonId);

    const alerts: Array<{ level: 'warning' | 'info'; message: string }> = [];
    const pendingTotal = Number(todayStats.pending_count || 0);
    if (pendingTotal > 0) {
      alerts.push({
        level: 'warning',
        message: `${pendingTotal} marcação(ões) pendente(s) nesta data aguardando confirmação.`,
      });
    }

    let finance = null;
    if (canAccessFinance(user.role)) {
      const fin = db
        .prepare(
          `SELECT
             (SELECT COALESCE(SUM(amount_kz), 0) FROM payments WHERE salon_id = ? AND substr(paid_at, 1, 10) = ?) as revenue_today_kz,
             (SELECT COALESCE(SUM(amount_kz), 0) FROM payments WHERE salon_id = ?) as total_revenue_kz,
             (SELECT COALESCE(SUM(amount_kz), 0) FROM expenses WHERE salon_id = ? AND expense_date = ?) as expenses_today_kz,
             (SELECT COALESCE(SUM(amount_kz), 0) FROM expenses WHERE salon_id = ?) as total_expenses_kz,
             (SELECT COALESCE(SUM(total_price_kz - paid_amount_kz), 0) FROM appointments WHERE salon_id = ? AND status != 'CANCELLED' AND paid_amount_kz < total_price_kz) as pending_receivables_kz`
        )
        .get(salonId, selectedDate, salonId, salonId, selectedDate, salonId, salonId) as Record<
        string,
        number
      >;

      const openRegister = db
        .prepare(
          "SELECT id, opening_balance_kz, opened_at FROM cash_registers WHERE salon_id = ? AND status = 'OPEN' LIMIT 1"
        )
        .get(salonId);

      if (!openRegister) {
        alerts.push({
          level: 'warning',
          message:
            'Nenhum caixa está aberto neste momento. Abra o caixa antes de registar movimentos em numerário.',
        });
      }

      if (fin.pending_receivables_kz > 0) {
        alerts.push({
          level: 'info',
          message: 'Existem pagamentos pendentes ou parciais por regularizar.',
        });
      }

      finance = {
        revenueTodayKz: fin.revenue_today_kz,
        totalRevenueKz: fin.total_revenue_kz,
        expensesTodayKz: fin.expenses_today_kz,
        totalExpensesKz: fin.total_expenses_kz,
        balanceKz: fin.total_revenue_kz - fin.total_expenses_kz,
        pendingReceivablesKz: fin.pending_receivables_kz,
        hasOpenRegister: Boolean(openRegister),
      };
    }

    return NextResponse.json({
      date: selectedDate,
      todayDate: now.date,
      nowTime: now.time,
      nowMinutes: now.minutes,
      role: user.role,
      pendingBadgeCount: Number(pendingBadgeRow?.cnt || 0),
      stats: {
        totalToday: Number(todayStats.total_today || 0),
        pendingCount: Number(todayStats.pending_count || 0),
        confirmedCount: Number(todayStats.confirmed_count || 0),
        completedCount: Number(todayStats.completed_count || 0),
        cancelledCount: Number(todayStats.cancelled_count || 0),
      },
      weekStrip,
      dayAppointments,
      finance,
      upcomingAppointments,
      availableProsToday,
      alerts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
