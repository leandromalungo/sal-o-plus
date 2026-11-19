# Regras de Negócio — Salão+

## 1. Localização e Moeda
- **Fuso horário oficial**: `Africa/Luanda` (`UTC+1`). Todas as datas, validações de antecedência e horários de atendimento são avaliados neste fuso.
- **Moeda**: Kwanza Angolano (`AOA` / `Kz`), armazenado em valores numéricos exatos e formatado para leitura tabular.
- **Idioma**: Português (`pt-AO`).

## 2. Regras de Agendamento
- **Duração + Prep Buffer**: A ocupação da agenda inclui a duração do(s) serviço(s) e o tempo de preparação/higienização configurado no serviço.
- **Múltiplos Serviços**: Numa mesma reserva, os serviços são somados sequencialmente e registados em `appointment_services` na ordem selecionada.
- **Antecedência e Retroatividade**: Bloqueia marcações no passado, abaixo da antecedência mínima (`min_advance_hours`) e acima do horizonte máximo (`max_advance_days`).
- **Pré-Reservas Temporárias (`PENDING`)**: Quando criadas com retenção temporária, expiram após `pending_hold_minutes` se não forem confirmadas pela receção, libertando automaticamente o horário.

## 3. Regras Financeiras e Caixa
- **Pagamentos Parciais vs. Concluídos**:
  - `UNPAID`: `paid_amount_kz = 0`
  - `PARTIAL`: `0 < paid_amount_kz < total_price_kz`
  - `PAID`: `paid_amount_kz >= total_price_kz`
  - Pagamentos não podem exceder o saldo restante da marcação.
- **Caixa Diário**:
  - Cada pagamento registado incrementa automaticamente os registos de entrada da sessão de caixa aberta do salão.
  - O saldo esperado no fecho é calculado por `opening_balance_kz + entradas - despesas_do_periodo`.
- **Comissões**:
  - Calculadas com base na taxa `commission_rate` da profissional sobre o valor do atendimento (`commissions`).

## 4. Estados da Marcação
Fluxo de estados suportado com histórico auditado:
- `PENDING` → `CONFIRMED` | `CANCELLED` | `IN_PROGRESS`
- `CONFIRMED` → `IN_PROGRESS` | `COMPLETED` | `CANCELLED` | `NO_SHOW`
- `IN_PROGRESS` → `COMPLETED` | `CANCELLED`
- `COMPLETED`, `CANCELLED`, `NO_SHOW` são estados terminais.
