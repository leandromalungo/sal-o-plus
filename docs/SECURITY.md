# Segurança, RBAC e Isolamento Multi-Tenant — Salão+

## 1. Autenticação e Sessão
- Palavras-passe protegidas com **bcrypt** (`bcryptjs`).
- Sessões baseadas em **cookies HTTP-only** (`salaomais_session`) assinados com **HMAC-SHA256** (`AUTH_SECRET`) e verificação resistente a ataques de temporização (`crypto.timingSafeEqual`).
- Validade de 7 dias por omissão com expiração validada no servidor a cada pedido.

## 2. Controlo de Acesso Baseado em Perfis (RBAC)

| Perfil | Agenda & Marcações | Clientes | Financeiro & Caixa | Profissionais & Serviços | Configurações do Salão | Painel `/admin` |
| --- | --- | --- | --- | --- | --- | --- |
| `OWNER` | Total (do salão) | Total | Total | Total | Total | Não |
| `MANAGER` | Total (do salão) | Total | Total | Total | Total | Não |
| `RECEPTIONIST` | Total (do salão) | Total | Registo de pagamentos & caixa | Leitura | Não | Não |
| `PROFESSIONAL` | Apenas própria agenda | Leitura | **Bloqueado (403)** | Leitura | **Bloqueado (403)** | Não |
| `SUPER_ADMIN` | — | — | — | — | — | **Total** |

## 3. Isolamento Multi-Tenant
- Todas as rotas `/api/gestao/*` invocam `requireSessionUser()` e verificam `assertSalonIsolation(user, targetSalonId)`.
- Utilizadores de um salão nunca conseguem consultar, criar, reagendar ou alterar registos pertencentes a outro `salon_id`, recebendo `403 Forbidden`.
- Todas as alterações críticas (pagamentos, fecho de caixa, bloqueios, criação/suspensão de salões, alterações de regras) ficam registadas em `audit_logs`.
