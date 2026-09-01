# CRM Comercial Unificado — Especificação

Blueprint para centralizar leads de WhatsApp, site, landing pages e Facebook Lead Ads em uma base única,
com inbox nativo, atribuição de mídia, devolução de conversões para Meta e Google, e DRE.

**Status:** especificação. Nenhum código de aplicação foi escrito.

## Leitura

| # | Documento | Conteúdo |
|---|---|---|
| 00 | [Visão e arquitetura](00-visao-arquitetura.md) | Problema, stack, fluxo, princípios |
| 01 | [Modelo de dados](01-modelo-de-dados.md) | Entidades e decisões de modelagem |
| — | [`schema.sql`](schema.sql) | DDL de referência (validado em PostgreSQL 16) |
| 02 | [Ingestão e dedupe](02-ingestao-e-dedupe.md) | Formato canônico, normalização, stitching |
| 03 | [Captura web](03-captura-web.md) | `crm.js`, `/ingest/form`, plugin WordPress, UTMs |
| 04 | [Atribuição e conversões](04-atribuicao-e-conversoes.md) | Meta CAPI, Google Data Manager API |
| 05 | [Inbox e notificações](05-inbox-e-notificacoes.md) | Conversas, janela 24h, Web Push |
| 06 | [Métricas e DRE](06-metricas-e-dre.md) | KPIs com SQL, CAC, LTV, DRE |
| 07 | [Roadmap](07-roadmap.md) | Fases, critérios de aceite, riscos |

## Validar o schema localmente

```bash
pg_ctlcluster 16 main start
su postgres -c "psql -c 'create database crmspec'"
su postgres -c "psql -v ON_ERROR_STOP=1 -d crmspec -f docs/crm/schema.sql"
```

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Backend | Supabase (Postgres, Auth, RLS, Realtime, Storage, Edge Functions, pgmq) |
| Frontend | PWA React + Tailwind + shadcn/ui (Lovable) |
| Trabalho longo | Worker Node no VPS |
| Atendimento | Inbox nativo (Chatwoot sai do caminho) |
| Notificação | Web Push (VAPID) |

## Três coisas que mudam o resultado

1. **O cookie do tracker precisa ser server-side.** O ITP do Safari corta cookie de JavaScript em 7 dias,
   ou 24h em URL com `gclid`/`fbclid`. Ver [03](03-captura-web.md).
2. **O Google mudou de API em 15/06/2026.** Conversões offline agora vão pela Data Manager API. Material
   apontando para `OfflineUserDataJob` está desatualizado. Ver [04](04-atribuicao-e-conversoes.md).
3. **Custo de mídia soma só o nível de campanha.** `ad_costs_daily` guarda a mesma verba em três níveis.
   Ver [06](06-metricas-e-dre.md).

## Verificação executada

`schema.sql` aplicado em PostgreSQL 16 sem erro, e quatro casos percorridos de ponta a ponta contra o
modelo — nenhum precisou de tabela que não existe:

| Caso | Resultado |
|---|---|
| Lead do Facebook Lead Ads que já tinha falado no WhatsApp | Telefone sem o nono dígito resolveu para o mesmo contato; `fb_lead_id` anexado à ficha existente |
| Lead do Google: LP → SQL → ganho | Duas linhas no outbox (`SQL` sem valor, `Purchase` com 8000), ambas carregando o `gclid` capturado na LP |
| Mensagem Click-to-WhatsApp | `ctwa_clid` gravado e `ad_external_id` resolvido para a campanha em `ad_entities` |
| Custo por reunião agendada | R$ 1.200 com verba lançada nos três níveis — o filtro `nivel='campanha'` evitou a triplicação |

Também confirmado: mover um deal entre etapas grava `deal_stage_events` com a duração da etapa anterior, e
uma ida-e-volta entre etapas **não** duplica o evento no outbox. As 9 consultas de
[`06-metricas-e-dre.md`](06-metricas-e-dre.md) foram extraídas e executadas contra o schema.
