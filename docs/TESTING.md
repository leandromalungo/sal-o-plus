# Estratégia de Testes — Salão+

Os testes automatizados residem em `tests/booking-engine.test.ts` e utilizam o runner nativo do Node.js (`node --test tests/*.test.ts`) com base de dados SQLite isolada em memória (`:memory:`) inicializada a cada caso de teste.

## Cobertura dos 15 Cenários Críticos

1. **Concorrência simultânea (`1 e 9`)**: Simulação de duas reservas concorrentes para o mesmo horário/profissional; apenas uma é confirmada e a segunda recebe `BookingError` (`409 Conflict`).
2. **Prevenção de sobreposição e `prep_buffer_minutes` (`2 e 3`)**: Marcação de 60 min + 15 min de preparação às 10:00 bloqueia 10:00, 10:30 e 11:00, libertando apenas a partir das 11:15 (ou próximo slot válido da grelha).
3. **Fecho do salão (`4`)**: Impede serviços que ultrapassem o horário de encerramento do estabelecimento.
4. **Folga da profissional (`5`)**: Bloqueia marcações nos dias sem turno configurado para a profissional.
5. **Período bloqueado (`6`)**: Impede reservas em intervalos cobertos por `blocked_slots` gerais ou individuais.
6. **Libertação após cancelamento (`7`)**: Cancelar uma marcação liberta imediatamente o mesmo horário para outra cliente.
7. **Reagendamento seguro (`8`)**: Se o novo horário tiver conflito, o reagendamento falha e o horário anterior permanece preservado.
8. **RBAC financeiro (`10`)**: Perfil `PROFESSIONAL` é bloqueado ao tentar aceder ao módulo financeiro (`ForbiddenError`).
9. **Isolamento multi-tenant (`11`)**: Um salão não consegue aceder a dados de outro salão (`assertSalonIsolation` lança `ForbiddenError`).
10. **Marcações retroativas e antecedência (`12 e 13`)**: Datas no passado, abaixo da antecedência mínima (`min_advance_hours`) ou além do horizonte máximo (`max_advance_days`) são recusadas.
11. **Pagamentos parciais vs. totais (`14`)**: Registo parcial mantém `payment_status = 'PARTIAL'` e só muda para `'PAID'` quando o saldo restante em `Kz` é liquidado.
12. **Expiração de pré-reserva (`15`)**: Pré-reservas `PENDING` com `hold_expires_at` expirado são libertadas automaticamente por `releaseExpiredHolds`, tornando o horário novamente reservável.

## Execução

```bash
npm test
```
