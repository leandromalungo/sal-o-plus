# Referência da API REST — Salão+

## Autenticação (`/api/auth/*`)
- `POST /api/auth/login` — Autentica com `email` e `password` e define cookie HTTP-only.
- `POST /api/auth/logout` — Termina a sessão atual.
- `GET /api/auth/me` — Devolve o utilizador autenticado e dados do salão associado.
- `POST /api/auth/register-salon` — Regista um novo salão e utilizador `OWNER` com slug único e horários iniciais de Luanda.

## Portal Público (`/api/public/*`)
- `GET /api/public/salons/[slug]` — Detalhes públicos do salão, serviços ativos, categorias, profissionais e próximas datas sugeridas.
- `GET /api/public/salons/[slug]/availability?date=YYYY-MM-DD&serviceIds=...&professionalId=...` — Calcula e devolve slots livres em tempo real.
- `POST /api/public/bookings` — Cria marcação atómica (`201 Created` ou `409 Conflict` em caso de concorrência). Suporta `asPendingHold`.
- `GET /api/public/bookings/[code]?phone=...` — Consulta marcação existente por código (`SLM-XXXX`) e telefone.
- `PATCH /api/public/bookings/[code]` — Reagenda ou cancela a marcação validando janelas de antecedência e conflitos.

## Portal de Gestão (`/api/gestao/*`)
- `GET /api/gestao/dashboard` — Indicadores do dia/mês e próximos atendimentos.
- `GET /api/gestao/appointments` & `POST /api/gestao/appointments` — Listagem filtrada e criação presencial pela receção.
- `PATCH /api/gestao/appointments/[id]` — Transições de estado e reagendamento.
- `GET /api/gestao/blocks` & `POST /api/gestao/blocks` & `DELETE /api/gestao/blocks` — Bloqueios manuais de agenda.
- `GET /api/gestao/customers` & `POST /api/gestao/customers` — Gestão de clientes do salão.
- `GET /api/gestao/professionals` & `POST /api/gestao/professionals` & `PATCH /api/gestao/professionals` — Equipa, serviços associados e turnos/folgas.
- `GET /api/gestao/services` & `POST /api/gestao/services` & `PATCH /api/gestao/services` — Categorias e serviços.
- `GET /api/gestao/finance` & `POST /api/gestao/finance` — Caixa (abrir/fechar), pagamentos parciais/totais, despesas e comissões (bloqueado para `PROFESSIONAL`).
- `GET /api/gestao/settings` & `PATCH /api/gestao/settings` — Regras de agenda, horários semanais, feriados e notificações.

## Painel Super Admin (`/api/admin/*`)
- `GET /api/admin/salons` — Indicadores globais da plataforma, salões, planos e registos de auditoria.
- `PATCH /api/admin/salons` — Ativar, suspender, desativar salão ou alterar plano de subscrição.
