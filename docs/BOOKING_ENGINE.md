# Motor Transacional de Agendamentos — Salão+

Implementado em `lib/booking/engine.ts`, o motor de agendamentos é o núcleo do produto e garante integridade absoluta de horários mesmo sob reservas simultâneas.

---

## 1. Cálculo Dinâmico de Disponibilidade

Para um salão, data (`YYYY-MM-DD`) e lista ordenada de serviços, `computeAvailableSlots`:

1. **Liberta pré-reservas expiradas** (`releaseExpiredHolds`) antes de ler os horários livres.
2. Verifica se o salão está `ACTIVE` e se não está em encerramento temporário (`is_temporarily_closed`).
3. Verifica feriados (`holidays`) e o horário de funcionamento do salão para o dia da semana (`salon_working_hours`).
4. Respeita a antecedência máxima (`max_advance_days`) e mínima (`min_advance_hours`, calculada em `Africa/Luanda` UTC+1), bloqueando qualquer data/hora no passado.
5. Calcula a duração total dos serviços selecionados e soma o intervalo de preparação (`prep_buffer_minutes`) máximo entre eles:
   - `serviceDuration = SUM(duration_minutes)`
   - `occupiedEnd = start + serviceDuration + prepBuffer`
6. Para cada profissional elegível (que execute todos os serviços escolhidos):
   - Valida o turno individual (`professional_working_hours`).
   - Exclui intervalos em sobreposição com a pausa de almoço (`break_start` – `break_end`).
   - Exclui bloqueios manuais (`blocked_slots` gerais ou da profissional).
   - Exclui marcações ativas (`PENDING` não expiradas, `CONFIRMED`, `IN_PROGRESS`).
   - Garante que o término do serviço (`start + serviceDuration`) não ultrapassa o horário de fecho do salão nem da profissional.
7. Se a cliente escolher **«Qualquer profissional disponível»**, agrega todos os horários onde exista pelo menos uma profissional livre e, na confirmação, atribui automaticamente a primeira profissional livre no instante da transação.

---

## 2. Prevenção de Concorrência (Double Validation + Transação Atómica)

```
Cliente A abre 10:00 ──┐
                       ├──► POST /api/public/bookings
Cliente B abre 10:00 ──┘
                                    │
                                    ▼
                        BEGIN IMMEDIATE (Lock SQL)
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
         Cliente A (1.ª)                     Cliente B (2.ª)
   Revalida disponibilidade             Revalida disponibilidade
   Trigger OK → INSERT                  Conflito detetado → ROLLBACK
   COMMIT → HTTP 201                    Retorna HTTP 409 Conflict
```

- **Dupla Validação**: A disponibilidade é verificada ao listar horários e **novamente** dentro de `runInTransaction()` (`BEGIN IMMEDIATE`) antes de inserir a marcação.
- **Erro Padronizado**: Conflitos retornam `BookingError('SLOT_CONFLICT', 409)` com a mensagem:
  > *"Este horário acabou de ser reservado. Por favor, escolha outro horário disponível."*

---

## 3. Reagendamento Seguro e Cancelamento

- **Reagendamento (`rescheduleAppointmentAtomic`)**:
  - Executa dentro de transação `BEGIN IMMEDIATE`.
  - Valida o novo horário ignorando apenas a própria marcação (`excludeAppointmentId`).
  - Se o novo horário não estiver disponível, aborta a transação e **preserva o horário original intacto**.
- **Cancelamento (`transitionAppointmentStatus`)**:
  - Marcações `CANCELLED` e `NO_SHOW` deixam imediatamente de ocupar a agenda da profissional, libertando o horário para novas clientes.
  - No portal público, o cancelamento exige que falte pelo menos `min_cancel_hours` para o início do atendimento (quando `allow_client_cancel = 1`).
