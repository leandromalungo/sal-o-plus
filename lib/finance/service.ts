// Módulo Financeiro do Salão+: Pagamentos (parciais/totais), Despesas, Caixa e Comissões

import crypto from 'node:crypto';
import { getDb, runInTransaction } from '../db/client.ts';
import { ensureSeeded } from '../db/seed.ts';
import { getLuandaNow } from '../utils/time.ts';
import type { PaymentMethod, PaymentStatus } from '../types/domain.ts';

export class FinanceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 422) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function recordAppointmentPayment(input: {
  salonId: string;
  appointmentId: string;
  amountKz: number;
  method: PaymentMethod;
  notes?: string | null;
  recordedBy: string;
}): {
  paymentId: string;
  appointmentPaidAmountKz: number;
  paymentStatus: PaymentStatus;
  commissionAmountKz: number;
  salonNetKz: number;
} {
  ensureSeeded();

  if (!Number.isFinite(input.amountKz) || input.amountKz <= 0) {
    throw new FinanceError('O valor do pagamento deve ser superior a 0 Kz.');
  }

  return runInTransaction((db) => {
    const now = getLuandaNow();

    const appt = db
      .prepare('SELECT * FROM appointments WHERE id = ? AND salon_id = ?')
      .get(input.appointmentId, input.salonId) as
      | {
          id: string;
          customer_id: string;
          professional_id: string;
          total_price_kz: number;
          paid_amount_kz: number;
          status: string;
        }
      | undefined;

    if (!appt) {
      throw new FinanceError('Marcação não encontrada neste estabelecimento.', 404);
    }

    if (appt.status === 'CANCELLED') {
      throw new FinanceError('Não é possível registar pagamento para uma marcação cancelada.');
    }

    const remaining = Math.max(0, appt.total_price_kz - appt.paid_amount_kz);
    if (remaining === 0) {
      throw new FinanceError('Esta marcação já se encontra totalmente paga.');
    }
    if (input.amountKz > remaining) {
      throw new FinanceError(`O valor excede o saldo em falta (${remaining} Kz).`);
    }

    const paymentId = `pay_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO payments (id, salon_id, appointment_id, customer_id, amount_kz, method, status, notes, recorded_by, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)`
    ).run(
      paymentId,
      input.salonId,
      appt.id,
      appt.customer_id,
      Math.round(input.amountKz),
      input.method,
      input.notes?.trim() || null,
      input.recordedBy,
      now.iso
    );

    const newPaidAmount = appt.paid_amount_kz + Math.round(input.amountKz);
    const paymentStatus: PaymentStatus =
      newPaidAmount >= appt.total_price_kz ? 'PAID' : newPaidAmount > 0 ? 'PARTIAL' : 'PENDING';

    db.prepare('UPDATE appointments SET paid_amount_kz = ?, payment_status = ?, updated_at = ? WHERE id = ?').run(
      newPaidAmount,
      paymentStatus,
      now.iso,
      appt.id
    );

    // Regista entrada no caixa aberto, se existir
    const openRegister = db
      .prepare("SELECT id FROM cash_registers WHERE salon_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1")
      .get(input.salonId) as { id: string } | undefined;

    if (openRegister) {
      db.prepare(
        `INSERT INTO cash_transactions (id, salon_id, cash_register_id, type, amount_kz, method, description, reference_id, recorded_by, created_at)
         VALUES (?, ?, ?, 'IN', ?, ?, ?, ?, ?, ?)`
      ).run(
        `ctx_${crypto.randomUUID()}`,
        input.salonId,
        openRegister.id,
        Math.round(input.amountKz),
        input.method,
        `Recebimento marcação (${paymentStatus === 'PAID' ? 'Total' : 'Parcial'})`,
        paymentId,
        input.recordedBy,
        now.iso
      );
    }

    // Recalcula comissão com base estrita na taxa configurada da profissional e no valor efectivamente recebido
    const pro = db
      .prepare('SELECT commission_rate FROM professionals WHERE id = ? AND salon_id = ?')
      .get(appt.professional_id, input.salonId) as { commission_rate: number } | undefined;

    const rate = pro?.commission_rate ?? 0;
    const commissionAmountKz = Math.round((newPaidAmount * rate) / 100);
    const salonNetKz = newPaidAmount - commissionAmountKz;

    const existingCommission = db
      .prepare('SELECT id FROM commissions WHERE appointment_id = ? AND salon_id = ?')
      .get(appt.id, input.salonId) as { id: string } | undefined;

    if (existingCommission) {
      db.prepare(
        `UPDATE commissions
         SET received_amount_kz = ?, commission_rate = ?, commission_amount_kz = ?, salon_net_kz = ?,
             status = ?
         WHERE id = ?`
      ).run(
        newPaidAmount,
        rate,
        commissionAmountKz,
        salonNetKz,
        paymentStatus === 'PAID' ? 'APPROVED' : 'PENDING',
        existingCommission.id
      );
    } else {
      db.prepare(
        `INSERT INTO commissions (
          id, salon_id, professional_id, appointment_id, service_value_kz,
          received_amount_kz, commission_rate, commission_amount_kz, salon_net_kz, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `com_${crypto.randomUUID()}`,
        input.salonId,
        appt.professional_id,
        appt.id,
        appt.total_price_kz,
        newPaidAmount,
        rate,
        commissionAmountKz,
        salonNetKz,
        paymentStatus === 'PAID' ? 'APPROVED' : 'PENDING',
        now.iso
      );
    }

    return {
      paymentId,
      appointmentPaidAmountKz: newPaidAmount,
      paymentStatus,
      commissionAmountKz,
      salonNetKz,
    };
  });
}

export function createExpense(input: {
  salonId: string;
  category: string;
  description: string;
  amountKz: number;
  expenseDate: string;
  recordedBy: string;
  deductFromCashRegister?: boolean;
}) {
  ensureSeeded();
  if (!input.description?.trim() || !Number.isFinite(input.amountKz) || input.amountKz <= 0) {
    throw new FinanceError('Descrição e valor positivo em Kz são obrigatórios.');
  }

  return runInTransaction((db) => {
    const now = getLuandaNow();
    const id = `exp_${crypto.randomUUID()}`;

    db.prepare(
      `INSERT INTO expenses (id, salon_id, category, description, amount_kz, expense_date, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.salonId,
      input.category.trim() || 'Outros',
      input.description.trim(),
      Math.round(input.amountKz),
      input.expenseDate || now.date,
      input.recordedBy,
      now.iso
    );

    if (input.deductFromCashRegister) {
      const openRegister = db
        .prepare("SELECT id FROM cash_registers WHERE salon_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1")
        .get(input.salonId) as { id: string } | undefined;

      if (openRegister) {
        db.prepare(
          `INSERT INTO cash_transactions (id, salon_id, cash_register_id, type, amount_kz, method, description, reference_id, recorded_by, created_at)
           VALUES (?, ?, ?, 'OUT', ?, 'CASH', ?, ?, ?, ?)`
        ).run(
          `ctx_${crypto.randomUUID()}`,
          input.salonId,
          openRegister.id,
          Math.round(input.amountKz),
          `Despesa (${input.category}): ${input.description.trim()}`,
          id,
          input.recordedBy,
          now.iso
        );
      }
    }

    return { id };
  });
}

export function openCashRegister(input: {
  salonId: string;
  openingBalanceKz: number;
  openedBy: string;
  notes?: string | null;
}) {
  ensureSeeded();
  if (!Number.isFinite(input.openingBalanceKz) || input.openingBalanceKz < 0) {
    throw new FinanceError('Saldo de abertura inválido.');
  }

  return runInTransaction((db) => {
    const existingOpen = db
      .prepare("SELECT id FROM cash_registers WHERE salon_id = ? AND status = 'OPEN'")
      .get(input.salonId) as { id: string } | undefined;

    if (existingOpen) {
      throw new FinanceError('Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.');
    }

    const now = getLuandaNow();
    const id = `cr_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO cash_registers (id, salon_id, status, opening_balance_kz, opened_by, opened_at, notes)
       VALUES (?, ?, 'OPEN', ?, ?, ?, ?)`
    ).run(id, input.salonId, Math.round(input.openingBalanceKz), input.openedBy, now.iso, input.notes?.trim() || null);

    return { id };
  });
}

export function closeCashRegister(input: {
  salonId: string;
  registerId: string;
  closingBalanceKz: number;
  closedBy: string;
  notes?: string | null;
}) {
  ensureSeeded();

  return runInTransaction((db) => {
    const reg = db
      .prepare("SELECT * FROM cash_registers WHERE id = ? AND salon_id = ? AND status = 'OPEN'")
      .get(input.registerId, input.salonId) as { id: string; opening_balance_kz: number } | undefined;

    if (!reg) {
      throw new FinanceError('Caixa aberto não encontrado.', 404);
    }

    const totals = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'IN' THEN amount_kz ELSE 0 END), 0) as total_in,
           COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount_kz ELSE 0 END), 0) as total_out
         FROM cash_transactions
         WHERE cash_register_id = ?`
      )
      .get(reg.id) as { total_in: number; total_out: number };

    const expectedBalanceKz = reg.opening_balance_kz + totals.total_in - totals.total_out;
    const now = getLuandaNow();

    db.prepare(
      `UPDATE cash_registers
       SET status = 'CLOSED', closing_balance_kz = ?, expected_balance_kz = ?,
           closed_by = ?, closed_at = ?, notes = COALESCE(?, notes)
       WHERE id = ?`
    ).run(
      Math.round(input.closingBalanceKz),
      expectedBalanceKz,
      input.closedBy,
      now.iso,
      input.notes?.trim() || null,
      reg.id
    );

    return { expectedBalanceKz, closingBalanceKz: Math.round(input.closingBalanceKz) };
  });
}

export function getFinanceSummary(salonId: string) {
  ensureSeeded();
  const db = getDb();

  const payments = db
    .prepare(
      `SELECT p.*, a.booking_code, a.total_price_kz as service_total_kz, a.payment_status as appt_payment_status,
              c.name as customer_name
       FROM payments p
       LEFT JOIN appointments a ON a.id = p.appointment_id
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.salon_id = ?
       ORDER BY p.paid_at DESC
       LIMIT 100`
    )
    .all(salonId);

  const expenses = db
    .prepare('SELECT * FROM expenses WHERE salon_id = ? ORDER BY expense_date DESC, created_at DESC LIMIT 100')
    .all(salonId);

  const commissions = db
    .prepare(
      `SELECT com.*, pr.name as professional_name, a.booking_code, a.date as appointment_date
       FROM commissions com
       JOIN professionals pr ON pr.id = com.professional_id
       JOIN appointments a ON a.id = com.appointment_id
       WHERE com.salon_id = ?
       ORDER BY com.created_at DESC
       LIMIT 100`
    )
    .all(salonId);

  const openRegister = db
    .prepare("SELECT * FROM cash_registers WHERE salon_id = ? AND status = 'OPEN' ORDER BY opened_at DESC LIMIT 1")
    .get(salonId) as Record<string, unknown> | undefined;

  const registerHistory = db
    .prepare('SELECT * FROM cash_registers WHERE salon_id = ? ORDER BY opened_at DESC LIMIT 20')
    .all(salonId);

  const registerTransactions = openRegister
    ? db
        .prepare('SELECT * FROM cash_transactions WHERE cash_register_id = ? ORDER BY created_at DESC')
        .all(String(openRegister.id))
    : [];

  const totals = db
    .prepare(
      `SELECT
         (SELECT COALESCE(SUM(amount_kz), 0) FROM payments WHERE salon_id = ?) as total_revenue_kz,
         (SELECT COALESCE(SUM(amount_kz), 0) FROM expenses WHERE salon_id = ?) as total_expenses_kz,
         (SELECT COALESCE(SUM(commission_amount_kz), 0) FROM commissions WHERE salon_id = ?) as total_commissions_kz,
         (SELECT COALESCE(SUM(total_price_kz - paid_amount_kz), 0) FROM appointments WHERE salon_id = ? AND status NOT IN ('CANCELLED') AND paid_amount_kz < total_price_kz) as pending_receivables_kz`
    )
    .get(salonId, salonId, salonId, salonId) as {
    total_revenue_kz: number;
    total_expenses_kz: number;
    total_commissions_kz: number;
    pending_receivables_kz: number;
  };

  const pendingAppointments = db
    .prepare(
      `SELECT a.id, a.booking_code, a.date, a.start_time, a.total_price_kz, a.paid_amount_kz, a.payment_status, a.status,
              c.name as customer_name, p.name as professional_name
       FROM appointments a
       JOIN customers c ON c.id = a.customer_id
       JOIN professionals p ON p.id = a.professional_id
       WHERE a.salon_id = ? AND a.status NOT IN ('CANCELLED') AND a.paid_amount_kz < a.total_price_kz
       ORDER BY a.date DESC, a.start_time DESC
       LIMIT 30`
    )
    .all(salonId);

  return {
    totals: {
      totalRevenueKz: totals.total_revenue_kz,
      totalExpensesKz: totals.total_expenses_kz,
      totalCommissionsKz: totals.total_commissions_kz,
      netBalanceKz: totals.total_revenue_kz - totals.total_expenses_kz,
      pendingReceivablesKz: totals.pending_receivables_kz,
    },
    payments,
    expenses,
    commissions,
    openRegister: openRegister ?? null,
    registerTransactions,
    registerHistory,
    pendingAppointments,
  };
}
