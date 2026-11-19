# Segurança, RBAC e Isolamento Multi-Tenant — Salão+

## 1. Autenticação e Sessões Isoladas por Camada
- Palavras-passe protegidas com **bcrypt** (`bcryptjs`).
- Cada camada possui a sua própria tela de login, cookie HTTP-only isolado e validação de perfil no servidor:
  - **Proprietária & Gerência (`/login/gestao`)** → `salaomais_session_gestao` (`OWNER`, `MANAGER`)
  - **Receção & Balcão (`/login/recepcao`)** → `salaomais_session_recepcao` (`RECEPTIONIST`)
  - **Profissional (`/login/profissional`)** → `salaomais_session_profissional` (`PROFESSIONAL`)
  - **Super Admin (`/login/admin`)** → `salaomais_session_admin` (`SUPER_ADMIN`)
- Sessões assinadas com **HMAC-SHA256** (`AUTH_SECRET`) incluindo `layer` no payload e verificação resistente a ataques de temporização (`crypto.timingSafeEqual`).
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
