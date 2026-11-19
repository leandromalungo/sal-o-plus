# Arquitetura do Sistema — Salão+

## 1. Visão Geral

O **Salão+** segue uma arquitetura modular em **Next.js (App Router)** com TypeScript estrito, separando claramente:

1. **Camada de Apresentação (`app/` e `components/`)**
   - Server Components para carregamento inicial e SEO.
   - Client Components interativos em `components/booking/` e `components/gestao/`.
2. **Camada de API (`app/api/`)**
   - Rotas REST públicas (`/api/public/*`) para o portal **Salão+ Booking**.
   - Rotas autenticadas (`/api/gestao/*`) para o portal **Salão+ Gestão**.
   - Rotas administrativas (`/api/admin/*`) exclusivas para `SUPER_ADMIN`.
   - Rotas de autenticação (`/api/auth/*`) com cookies HTTP-only.
3. **Camada de Domínio & Regras de Negócio (`lib/`)**
   - `lib/booking/engine.ts`: Motor transacional de disponibilidade, criação atómica, reagendamento e transições de estado.
   - `lib/finance/service.ts`: Motor financeiro (pagamentos parciais/totais, caixa, despesas e comissões).
   - `lib/auth/session.ts` & `lib/auth/rbac.ts`: Autenticação, assinatura HMAC-SHA256, controlo de permissões e isolamento multi-tenant.
   - `lib/utils/time.ts`: Utilitários determinísticos para o fuso horário `Africa/Luanda` (`UTC+1`), formatação em `Kz` e normalização de telefones angolanos.
4. **Camada de Persistência (`lib/db/`)**
   - `lib/db/client.ts`: Base de dados relacional SQLite via `node:sqlite` (`DatabaseSync`) em modo WAL com chaves estrangeiras ativas, bloqueio imediato de escrita (`BEGIN IMMEDIATE`) e triggers SQL anti-sobreposição.
   - `lib/db/seed.ts`: Dados iniciais idempotentes focados em Luanda.

---

## 2. Separação dos Três Portais

```
                      ┌──────────────────────────┐
                      │       Salão+ SaaS        │
                      └────────────┬─────────────┘
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│  Salão+ Booking   │    │   Salão+ Gestão   │    │   Salão+ Admin    │
│  /salao/[slug]    │    │     /gestao/*     │    │      /admin       │
│  Acesso Público   │    │  RBAC por Salão   │    │   SUPER_ADMIN     │
└─────────┬─────────┘    └─────────┬─────────┘    └─────────┬─────────┘
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   ▼
                 ┌──────────────────────────────────┐
                 │  Booking Engine + Finance + RBAC │
                 │       SQLite ACID / Triggers     │
                 └──────────────────────────────────┘
```

---

## 3. Modelo Multi-Tenant

Cada estabelecimento é representado por um registo na tabela `salons` identificado por `salon_id` e `slug` único:

- Todas as tabelas operacionais (`professionals`, `services`, `customers`, `appointments`, `blocked_slots`, `payments`, `expenses`, `cash_registers`, `commissions`, `notifications`, `audit_logs`) contêm `salon_id`.
- A função `assertSalonIsolation(user, targetSalonId)` impede que qualquer utilizador (`OWNER`, `MANAGER`, `RECEPTIONIST`, `PROFESSIONAL`) aceda ou altere dados de outro salão.
- Apenas `SUPER_ADMIN` possui visibilidade transversal no painel `/admin`.
