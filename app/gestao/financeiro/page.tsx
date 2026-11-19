'use client';

import { useEffect, useState, useCallback } from 'react';
import GestaoShell from '@/components/gestao/GestaoShell';
import { formatDatePt, formatKz } from '@/lib/utils/time';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/types/domain';

interface FinanceData {
  totals: {
    totalRevenueKz: number;
    totalExpensesKz: number;
    totalCommissionsKz: number;
    netBalanceKz: number;
    pendingReceivablesKz: number;
  };
  payments: Array<{
    id: string;
    booking_code: string | null;
    customer_name: string | null;
    amount_kz: number;
    method: PaymentMethod;
    paid_at: string;
    notes: string | null;
  }>;
  expenses: Array<{
    id: string;
    category: string;
    description: string;
    amount_kz: number;
    expense_date: string;
  }>;
  commissions: Array<{
    id: string;
    professional_name: string;
    booking_code: string;
    appointment_date: string;
    service_value_kz: number;
    received_amount_kz: number;
    commission_rate: number;
    commission_amount_kz: number;
    salon_net_kz: number;
    status: string;
  }>;
  openRegister: {
    id: string;
    opening_balance_kz: number;
    opened_by: string;
    opened_at: string;
  } | null;
  registerTransactions: Array<{
    id: string;
    type: 'IN' | 'OUT';
    amount_kz: number;
    method: string;
    description: string;
    created_at: string;
  }>;
  pendingAppointments: Array<{
    id: string;
    booking_code: string;
    date: string;
    start_time: string;
    total_price_kz: number;
    paid_amount_kz: number;
    payment_status: string;
    customer_name: string;
    professional_name: string;
  }>;
}

export default function FinanceiroPage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tab, setTab] = useState<'receitas' | 'despesas' | 'caixa' | 'comissoes'>('receitas');

  const [payForm, setPayForm] = useState({
    appointmentId: '',
    amountKz: 0,
    method: 'MULTICAIXA_EXPRESS' as PaymentMethod,
    notes: '',
  });
  const [expForm, setExpForm] = useState({
    category: 'Materiais',
    description: '',
    amountKz: 0,
    expenseDate: new Date().toISOString().slice(0, 10),
    deductFromCashRegister: true,
  });
  const [registerAmount, setRegisterAmount] = useState(25000);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/gestao/finance');
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Acesso negado.');
      return;
    }
    setData(json);
    if ((json.pendingAppointments || []).length > 0 && !payForm.appointmentId) {
      const first = json.pendingAppointments[0];
      setPayForm((f) => ({
        ...f,
        appointmentId: first.id,
        amountKz: Math.max(0, first.total_price_kz - first.paid_amount_kz),
      }));
    }
  }, [payForm.appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function postAction(payload: Record<string, unknown>, okMessage: string) {
    setFeedback(null);
    setError(null);
    const res = await fetch('/api/gestao/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Operação falhou.');
      return;
    }
    setFeedback(okMessage);
    await load();
  }

  return (
    <GestaoShell title="Financeiro & Caixa">
      {() => (
        <div className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}
          {feedback && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              {feedback}
            </div>
          )}

          {data && (
            <>
              {/* Totais Reais */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-4 bg-white border border-zinc-200 rounded-xl">
                  <p className="text-xs text-zinc-500">Receitas recebidas</p>
                  <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatKz(data.totals.totalRevenueKz)}
                  </p>
                </div>
                <div className="p-4 bg-white border border-zinc-200 rounded-xl">
                  <p className="text-xs text-zinc-500">Por receber</p>
                  <p className="font-mono text-lg font-semibold text-amber-700 tabular-nums mt-1">
                    {formatKz(data.totals.pendingReceivablesKz)}
                  </p>
                </div>
                <div className="p-4 bg-white border border-zinc-200 rounded-xl">
                  <p className="text-xs text-zinc-500">Despesas</p>
                  <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatKz(data.totals.totalExpensesKz)}
                  </p>
                </div>
                <div className="p-4 bg-white border border-zinc-200 rounded-xl">
                  <p className="text-xs text-zinc-500">Comissões apuradas</p>
                  <p className="font-mono text-lg font-semibold text-zinc-900 tabular-nums mt-1">
                    {formatKz(data.totals.totalCommissionsKz)}
                  </p>
                </div>
                <div className="p-4 bg-white border border-zinc-200 rounded-xl">
                  <p className="text-xs text-zinc-500">Saldo líquido</p>
                  <p className="font-mono text-lg font-semibold text-violet-700 tabular-nums mt-1">
                    {formatKz(data.totals.netBalanceKz)}
                  </p>
                </div>
              </div>

              {/* Abas */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-zinc-100 rounded-lg w-fit">
                {(
                  [
                    ['receitas', 'Pagamentos & Receitas'],
                    ['despesas', 'Despesas'],
                    ['caixa', 'Caixa Diário'],
                    ['comissoes', 'Comissões'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      tab === key ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'receitas' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      postAction({ action: 'RECORD_PAYMENT', ...payForm }, 'Pagamento registado com sucesso.');
                    }}
                    className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
                  >
                    <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                      Registar Pagamento (Total ou Parcial)
                    </h2>
                    {data.pendingAppointments.length === 0 ? (
                      <p className="text-xs text-zinc-500">Todas as marcações ativas estão liquidadas.</p>
                    ) : (
                      <div className="space-y-3">
                        <select
                          value={payForm.appointmentId}
                          onChange={(e) => {
                            const found = data.pendingAppointments.find((a) => a.id === e.target.value);
                            setPayForm({
                              ...payForm,
                              appointmentId: e.target.value,
                              amountKz: found ? Math.max(0, found.total_price_kz - found.paid_amount_kz) : 0,
                            });
                          }}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                        >
                          {data.pendingAppointments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.booking_code} · {a.customer_name} (Falta {formatKz(a.total_price_kz - a.paid_amount_kz)})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          required
                          value={payForm.amountKz}
                          onChange={(e) => setPayForm({ ...payForm, amountKz: Number(e.target.value) })}
                          placeholder="Valor recebido em Kz"
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                        />
                        <select
                          value={payForm.method}
                          onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentMethod })}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                        >
                          <option value="MULTICAIXA_EXPRESS">Multicaixa Express</option>
                          <option value="TPA">TPA / Cartão</option>
                          <option value="CASH">Dinheiro (Kz)</option>
                          <option value="BANK_TRANSFER">Transferência Bancária</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Observação (ex.: sinal, liquidação final)"
                          value={payForm.notes}
                          onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                        />
                        <button
                          type="submit"
                          className="w-full py-2.5 text-xs font-medium bg-violet-700 text-white rounded-lg hover:bg-violet-800"
                        >
                          Registar Recebimento
                        </button>
                      </div>
                    )}
                  </form>

                  <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
                      Histórico de Pagamentos
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {data.payments.map((p) => (
                        <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                          <div>
                            <p className="font-medium text-zinc-900">
                              {p.customer_name || 'Cliente'} {p.booking_code ? `· ${p.booking_code}` : ''}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {PAYMENT_METHOD_LABELS[p.method] || p.method} · {p.paid_at.slice(0, 10)}
                            </p>
                          </div>
                          <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                            +{formatKz(p.amount_kz)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'despesas' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      postAction({ action: 'CREATE_EXPENSE', ...expForm }, 'Despesa registada.');
                      setExpForm({ ...expForm, description: '', amountKz: 0 });
                    }}
                    className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 space-y-3"
                  >
                    <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-zinc-900">
                      Lançar Despesa
                    </h2>
                    <select
                      value={expForm.category}
                      onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                    >
                      <option value="Materiais">Materiais</option>
                      <option value="Renda">Renda</option>
                      <option value="Energia">Energia</option>
                      <option value="Água">Água</option>
                      <option value="Salários">Salários</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Outros">Outros custos</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Descrição da despesa"
                      value={expForm.description}
                      onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                    />
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="Valor em Kz"
                      value={expForm.amountKz || ''}
                      onChange={(e) => setExpForm({ ...expForm, amountKz: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                    />
                    <input
                      type="date"
                      required
                      value={expForm.expenseDate}
                      onChange={(e) => setExpForm({ ...expForm, expenseDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                    />
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={expForm.deductFromCashRegister}
                        onChange={(e) => setExpForm({ ...expForm, deductFromCashRegister: e.target.checked })}
                      />
                      Registar saída no caixa aberto
                    </label>
                    <button
                      type="submit"
                      className="w-full py-2.5 text-xs font-medium bg-zinc-900 text-white rounded-lg"
                    >
                      Guardar Despesa
                    </button>
                  </form>

                  <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
                      Registo de Despesas
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {data.expenses.map((ex) => (
                        <div key={ex.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                          <div>
                            <p className="font-medium text-zinc-900">{ex.description}</p>
                            <p className="text-xs text-zinc-500">
                              {ex.category} · {formatDatePt(ex.expense_date)}
                            </p>
                          </div>
                          <span className="font-mono font-semibold text-red-700 tabular-nums">
                            -{formatKz(ex.amount_kz)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'caixa' && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
                  {data.openRegister ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200">
                        <div>
                          <p className="text-xs font-medium text-emerald-700">Caixa Aberto</p>
                          <p className="text-sm text-zinc-700 mt-0.5">
                            Aberto por {data.openRegister.opened_by} · Fundo inicial{' '}
                            <span className="font-mono font-semibold">{formatKz(data.openRegister.opening_balance_kz)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={registerAmount}
                            onChange={(e) => setRegisterAmount(Number(e.target.value))}
                            className="w-36 px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                            placeholder="Contagem final"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              postAction(
                                {
                                  action: 'CLOSE_REGISTER',
                                  registerId: data.openRegister!.id,
                                  closingBalanceKz: registerAmount,
                                },
                                'Caixa fechado com sucesso.'
                              )
                            }
                            className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg"
                          >
                            Fechar Caixa
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {data.registerTransactions.map((tx) => (
                          <div key={tx.id} className="py-3 flex items-center justify-between text-sm">
                            <div>
                              <p className="font-medium text-zinc-900">{tx.description}</p>
                              <p className="text-xs text-zinc-500">{tx.method} · {tx.created_at.slice(0, 16).replace('T', ' ')}</p>
                            </div>
                            <span
                              className={`font-mono font-semibold tabular-nums ${
                                tx.type === 'IN' ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {tx.type === 'IN' ? '+' : '-'}
                              {formatKz(tx.amount_kz)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4 max-w-sm">
                      <h2 className="font-semibold text-zinc-900">Abrir Caixa Diário</h2>
                      <input
                        type="number"
                        min={0}
                        value={registerAmount}
                        onChange={(e) => setRegisterAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono"
                        placeholder="Saldo inicial (Kz)"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          postAction({ action: 'OPEN_REGISTER', openingBalanceKz: registerAmount }, 'Caixa aberto.')
                        }
                        className="px-4 py-2 text-xs font-medium bg-violet-700 text-white rounded-lg"
                      >
                        Abrir Caixa
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === 'comissoes' && (
                <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-zinc-200 text-sm font-semibold text-zinc-900">
                    Separação: Valor do Serviço vs Recebido vs Salão vs Comissão da Profissional
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#fafafc] border-b border-zinc-200 text-xs text-zinc-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Profissional / Marcação</th>
                        <th className="px-5 py-3 font-medium text-right">Valor Serviço</th>
                        <th className="px-5 py-3 font-medium text-right">Recebido</th>
                        <th className="px-5 py-3 font-medium text-right">Taxa</th>
                        <th className="px-5 py-3 font-medium text-right">Comissão Prof.</th>
                        <th className="px-5 py-3 font-medium text-right">Líquido Salão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-mono text-xs tabular-nums">
                      {data.commissions.map((c) => (
                        <tr key={c.id}>
                          <td className="px-5 py-3 font-sans">
                            <p className="font-medium text-zinc-900">{c.professional_name}</p>
                            <p className="text-zinc-500">{c.booking_code} · {formatDatePt(c.appointment_date)}</p>
                          </td>
                          <td className="px-5 py-3 text-right">{formatKz(c.service_value_kz)}</td>
                          <td className="px-5 py-3 text-right">{formatKz(c.received_amount_kz)}</td>
                          <td className="px-5 py-3 text-right">{c.commission_rate}%</td>
                          <td className="px-5 py-3 text-right font-semibold text-violet-700">
                            {formatKz(c.commission_amount_kz)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                            {formatKz(c.salon_net_kz)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </GestaoShell>
  );
}
