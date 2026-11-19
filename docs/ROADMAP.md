# Roadmap de Evolução — Salão+

## Fase 1 — Núcleo Comercial e Motor de Agendamentos (Concluída)
- Motor transacional com prevenção de concorrência, buffers, pausas, bloqueios, pré-reservas e reagendamento seguro.
- Portal público `/salao/[slug]` com autoatendimento (consulta, reagendamento e cancelamento).
- Portal `/gestao/*` completo (Dashboard, Agenda, Clientes, Profissionais, Serviços, Financeiro/Caixa e Configurações).
- Painel `/admin` multi-tenant com planos em Kwanzas (`Kz`) e auditoria.

## Fase 2 — Operação e Comunicação em Luanda
- Integração com **WhatsApp Business API** e SMS para lembretes automáticos (24h e 2h antes do atendimento) e confirmação de pré-reserva.
- Registo de **Stock e Consumo Interno** de produtos por serviço (tintas, queratina, vernizes, extensões) com alertas de reposição.
- Fidelização e pacotes pré-pagos para clientes frequentes.

## Fase 3 — Escala e Pagamentos Digitais
- Migração opcional do adaptador `lib/db/client.ts` para **PostgreSQL / Supabase** com `EXCLUDE USING gist` nativo.
- Conciliação automática com **Multicaixa Express** / referências de pagamento para sinal de pré-reserva online.
- Exportação contabilística mensal (SAF-T AO / mapas de comissões em PDF e CSV).
