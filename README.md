# Salão+ — Plataforma SaaS de Gestão e Agendamento para Salões de Beleza

Plataforma SaaS multi-tenant concebida para salões de beleza e estética em Angola (com foco inicial em Luanda), operando com fuso horário `Africa/Luanda` (`UTC+1`), moeda **AOA (`Kz`)** e interface integralmente em Português.

---

## Portais da Plataforma

1. **Salão+ Booking (`/salao/[slug]`)**
   - Página pública por salão (ex.: `/salao/luanda-esthetique` e `/salao/kizomba-beauty`).
   - Seleção múltipla de serviços com soma automática de duração e preço em `Kz`.
   - Escolha de profissional específica ou **«Qualquer profissional disponível»** com atribuição automática sem conflitos.
   - Cálculo dinâmico de horários livres em tempo real.
   - Validação dupla no servidor e criação atómica da marcação com código único (`SLM-XXXX`).
   - Opção de **pré-reserva temporária** (expiração automática após N minutos configuráveis) ou confirmação imediata.
   - Consulta, reagendamento atómico e cancelamento pela própria cliente através de código de reserva + telefone (sem necessidade de conta).

2. **Salão+ Gestão (`/gestao/*`)**
   - **Dashboard (`/gestao`)**: Indicadores do dia e do mês, receitas, lucro líquido, taxa de cancelamento/faltas e próximos atendimentos.
   - **Agenda & Agendamentos (`/gestao/agenda`)**: Lista cronológica, transição de estados (`PENDING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), marcação presencial e gestão de bloqueios de agenda.
   - **Clientes (`/gestao/clientes`)**: Base de clientes por salão com histórico de visitas e notas.
   - **Profissionais (`/gestao/profissionais`)**: Equipa, especialidades, taxas de comissão, horários de trabalho, pausas de almoço e dias de folga.
   - **Serviços & Categorias (`/gestao/servicos`)**: Catálogo com duração, intervalo de preparação (*prep buffer*), preço em `Kz` e estado ativo/inativo.
   - **Financeiro & Caixa (`/gestao/financeiro`)**: Abertura/fecho de caixa diário, registo de pagamentos (parciais ou totais em Multicaixa Express, TPA, Numerário e Transferência), despesas operacionais e cálculo de comissões.
   - **Configurações (`/gestao/configuracoes`)**: Regras de agenda (intervalo da grelha, antecedência mínima/máxima, janela de cancelamento, tempo de retenção de pré-reserva, feriados e encerramento temporário) e registo de notificações.

3. **Salão+ Admin (`/admin`)**
   - Painel administrativo global da plataforma para o perfil `SUPER_ADMIN`.
   - Gestão de salões registados (ativar, suspender, desativar, alterar plano de subscrição), planos comerciais em `Kz`, utilizadores, indicadores globais e auditoria.

---

## Como Executar

```bash
# Instalar dependências
npm install

# Executar testes automatizados do motor de agendamentos
npm test

# Iniciar servidor de desenvolvimento (porta 3000)
npm run dev

# Verificar tipagem e build de produção
npx tsc --noEmit
npm run build
```

---

## Contas de Demonstração (Seed Luanda)

Todas as contas de demonstração usam a palavra-passe **`Salao@2026`**:

| Perfil | E-mail | Salão | Acesso |
| --- | --- | --- | --- |
| Proprietária | `dona@luandaesthetique.ao` | Luanda Esthétique | Gestão completa, financeiro e configurações |
| Rececionista | `recepcao@luandaesthetique.ao` | Luanda Esthétique | Agenda, clientes e registo de pagamentos |
| Profissional | `ana.silva@luandaesthetique.ao` | Luanda Esthétique | Agenda pessoal (sem acesso a financeiro global) |
| Super Admin | `admin@salaomais.ao` | Plataforma Salão+ | Painel administrativo global (`/admin`) |
| Proprietária (Tenant 2) | `dona@kizomba.ao` | Kizomba Beauty Studio | Isolamento multi-tenant demonstrado |

---

## Documentação Técnica

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Arquitetura de sistema, camadas e multi-tenancy
- [`docs/DATABASE.md`](./docs/DATABASE.md) — Modelo de dados relacional, triggers SQL e migração PostgreSQL
- [`docs/BOOKING_ENGINE.md`](./docs/BOOKING_ENGINE.md) — Motor transacional de agendamentos e prevenção de concorrência
- [`docs/BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) — Regras operacionais, financeiras e políticas de cancelamento
- [`docs/SECURITY.md`](./docs/SECURITY.md) — Autenticação HMAC-SHA256, RBAC e isolamento entre salões
- [`docs/API.md`](./docs/API.md) — Referência completa dos endpoints REST
- [`docs/TESTING.md`](./docs/TESTING.md) — Cobertura dos 15 cenários críticos automatizados
- [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) — Estrutura do código, ambiente e variáveis
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — Evolução futura (Stock, WhatsApp API, PostgreSQL/Supabase)
