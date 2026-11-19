# Guia de Desenvolvimento — Salão+

## Estrutura de Diretórios

```
app/
  page.tsx                  # Landing page comercial do Salão+
  login/page.tsx            # Login, registo de salão e contas de demonstração
  salao/[slug]/page.tsx     # Portal público Salão+ Booking
  gestao/                   # Portal Salão+ Gestão (Dashboard, Agenda, Clientes, Profissionais, Serviços, Financeiro, Configurações)
  admin/page.tsx            # Painel Salão+ Admin (SUPER_ADMIN)
  api/                      # Endpoints REST (auth, public, gestao, admin)
components/
  booking/                  # Componentes interativos do agendamento público
  gestao/                   # Shell de navegação e componentes de gestão
lib/
  auth/                     # RBAC puro (rbac.ts), sessões HMAC-SHA256 (session.ts), helpers HTTP (http.ts)
  booking/                  # Motor transacional de agendamentos (engine.ts)
  finance/                  # Motor financeiro e caixa (service.ts)
  db/                       # Esquema/triggers SQLite (client.ts) e seed Luanda (seed.ts)
  types/                    # Tipos de domínio e etiquetas PT-AO (domain.ts)
  utils/                    # Fuso Africa/Luanda, Kz, telefones e intervalos (time.ts)
tests/
  booking-engine.test.ts    # Suite automatizada dos 15 cenários críticos
```

## Variáveis de Ambiente (`.env.example`)

- `AUTH_SECRET`: Segredo HMAC-SHA256 para assinar cookies de sessão.
- `SALAO_DB_PATH`: Caminho opcional para o ficheiro SQLite (por omissão `.data/salaomais.db`).

## Requisitos de Runtime
- Node.js 22+ (utiliza o módulo nativo `node:sqlite`).
- Porta padrão do servidor Next.js: `3000`.
