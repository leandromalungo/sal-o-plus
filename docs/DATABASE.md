# Modelo de Dados & Base de Dados — Salão+

## 1. Motor de Persistência Atual e Portabilidade PostgreSQL

O Salão+ utiliza **SQLite relacional (`node:sqlite`)** com modo **WAL**, `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000` e transações com bloqueio exclusivo imediato (`BEGIN IMMEDIATE`).

O esquema foi desenhado de forma 100% compatível com **PostgreSQL / Supabase** para migração futura em produção, bastando substituir a camada `lib/db/client.ts` mantendo as mesmas tabelas, chaves estrangeiras, índices e restrições de exclusão temporal (`EXCLUDE USING gist` com `tstzrange` no PostgreSQL).

---

## 2. Entidades Implementadas (28 Tabelas)

1. **`salons`** — Dados cadastrais, fuso horário (`Africa/Luanda`), moeda (`AOA`), regras de agenda e plano ativo.
2. **`roles`** — Perfis de acesso (`SUPER_ADMIN`, `OWNER`, `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`).
3. **`permissions`** — Permissões granulares por funcionalidade.
4. **`users`** — Credenciais com hash `bcrypt` e dados do utilizador.
5. **`salon_members`** — Associação entre `users`, `salons`, `role` e opcionalmente `professional_id`.
6. **`professionals`** — Profissionais do salão, cor na agenda, bio, avatar e `commission_rate`.
7. **`professional_services`** — Matriz N:N que define que serviços cada profissional executa.
8. **`service_categories`** — Categorias de serviços por salão.
9. **`services`** — Nome, descrição, `duration_minutes`, `prep_buffer_minutes`, `price_kz` e `is_active`.
10. **`customers`** — Base de clientes por salão com unicidade `(salon_id, phone)`.
11. **`salon_working_hours`** — Horário semanal de funcionamento do estabelecimento (`0=Domingo` a `6=Sábado`).
12. **`professional_working_hours`** — Horário semanal por profissional incluindo `break_start` e `break_end`.
13. **`holidays`** — Feriados e encerramentos pontuais do salão.
14. **`blocked_slots`** — Bloqueios manuais (gerais ou por profissional) com data e intervalo horário.
15. **`appointments`** — Marcações com `booking_code`, `start_epoch_ms`, `end_epoch_ms`, `occupied_end_epoch_ms`, estado, pagamento e expiração de pré-reserva.
16. **`appointment_services`** — Serviços ordenados dentro de uma marcação (suporte a múltiplos serviços sequenciais).
17. **`appointment_status_history`** — Auditoria de cada mudança de estado com autor e motivo.
18. **`payments`** — Registos de pagamento em `Kz` vinculados a marcações e caixa.
19. **`payment_methods`** — Métodos configuráveis (Multicaixa Express, TPA, Numerário, Transferência).
20. **`expenses`** — Despesas operacionais por categoria.
21. **`cash_registers`** — Sessões de caixa com abertura, entradas, despesas, saldo esperado e valor contado no fecho.
22. **`commissions`** — Comissões calculadas por atendimento concluído ou pago.
23. **`plans`** — Planos SaaS da plataforma (`Essencial`, `Profissional`, `Empresarial`).
24. **`subscriptions`** — Subscrição ativa de cada salão.
25. **`invoices`** — Faturação de subscrição em `Kz`.
26. **`notifications`** — Histórico de notificações geradas (criação, confirmação, cancelamento, reagendamento).
27. **`audit_logs`** — Registo imutável de ações administrativas, financeiras e de segurança.
28. **`salon_settings`** — Preferências adicionais por salão em chave-valor.

---

## 3. Triggers SQL Anti-Sobreposição

Além da validação aplicacional dentro de `BEGIN IMMEDIATE`, a base de dados impõe uma segunda barreira física através de dois triggers em `appointments`:

- `prevent_overlapping_appointments_insert`
- `prevent_overlapping_appointments_update`

Sempre que uma marcação com estado ocupante (`PENDING`, `CONFIRMED`, `IN_PROGRESS`) se sobreponha ao intervalo `[start_epoch_ms, occupied_end_epoch_ms)` de outra marcação ativa da mesma profissional, a base de dados aborta a instrução com `RAISE(ABORT, 'APPOINTMENT_OVERLAP_CONFLICT')`, que o motor traduz para HTTP **409 Conflict**.
