import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireSessionUser } from '@/lib/auth/http';
import { canAccessFinance, ForbiddenError, logAuditEvent } from '@/lib/auth/session';
import {
  closeCashRegister,
  createExpense,
  getFinanceSummary,
  openCashRegister,
  recordAppointmentPayment,
} from '@/lib/finance/service';
import type { PaymentMethod } from '@/lib/types/domain';

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (!canAccessFinance(user.role)) {
      throw new ForbiddenError('Profissionais não têm autorização para consultar dados financeiros do salão.');
    }
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const summary = getFinanceSummary(user.salonId);
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser();
    if (!canAccessFinance(user.role)) {
      throw new ForbiddenError('Profissionais não têm autorização para registar operações financeiras.');
    }
    if (!user.salonId) {
      return NextResponse.json({ error: 'Sem estabelecimento associado.' }, { status: 400 });
    }

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'RECORD_PAYMENT') {
      const result = recordAppointmentPayment({
        salonId: user.salonId,
        appointmentId: String(body.appointmentId || ''),
        amountKz: Number(body.amountKz || 0),
        method: (body.method || 'MULTICAIXA_EXPRESS') as PaymentMethod,
        notes: body.notes ? String(body.notes) : null,
        recordedBy: user.id,
      });

      logAuditEvent({
        salonId: user.salonId,
        userId: user.id,
        actorName: user.name,
        action: 'PAYMENT_RECORD',
        entityType: 'PAYMENT',
        entityId: result.paymentId,
        details: `${body.amountKz} Kz (${result.paymentStatus})`,
      });

      return NextResponse.json(result, { status: 201 });
    }

    if (action === 'CREATE_EXPENSE') {
      const result = createExpense({
        salonId: user.salonId,
        category: String(body.category || 'Outros'),
        description: String(body.description || ''),
        amountKz: Number(body.amountKz || 0),
        expenseDate: String(body.expenseDate || ''),
        recordedBy: user.id,
        deductFromCashRegister: Boolean(body.deductFromCashRegister),
      });

      logAuditEvent({
        salonId: user.salonId,
        userId: user.id,
        actorName: user.name,
        action: 'EXPENSE_CREATE',
        entityType: 'EXPENSE',
        entityId: result.id,
        details: `${body.category}: ${body.amountKz} Kz`,
      });

      return NextResponse.json(result, { status: 201 });
    }

    if (action === 'OPEN_REGISTER') {
      const result = openCashRegister({
        salonId: user.salonId,
        openingBalanceKz: Number(body.openingBalanceKz || 0),
        openedBy: user.name,
        notes: body.notes ? String(body.notes) : null,
      });
      return NextResponse.json(result, { status: 201 });
    }

    if (action === 'CLOSE_REGISTER') {
      const result = closeCashRegister({
        salonId: user.salonId,
        registerId: String(body.registerId || ''),
        closingBalanceKz: Number(body.closingBalanceKz || 0),
        closedBy: user.name,
        notes: body.notes ? String(body.notes) : null,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Operação financeira inválida.' }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
