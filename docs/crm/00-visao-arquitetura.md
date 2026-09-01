# 00 — Visão e Arquitetura

> Especificação do CRM Comercial Unificado. Documento de referência: descreve **o que** construir e **por quê**.
> Nenhum código de aplicação foi escrito ainda — ver [`07-roadmap.md`](07-roadmap.md) para as fases.

## 1. O problema

Leads chegam por WhatsApp, site, landing pages e Facebook Lead Ads, cada canal em um lugar diferente,
sem chave comum entre eles, sem deduplicação e sem preservar UTM ou identificador de clique.

Três consequências diretas:

| Sintoma | Causa raiz |
|---|---|
| Vendedor não sabe que chegou lead | Não existe inbox único nem notificação push |
| Gestor não sabe o custo real por etapa do funil | Mudança de etapa não é registrada como evento; custo de mídia não é cruzado com o funil |
| Meta e Google otimizam às cegas | Nenhum evento de qualificação volta para as plataformas — elas só sabem quem preencheu formulário, não quem virou cliente |

## 2. O objetivo

Uma base única onde:

1. Todo lead entra **normalizado e deduplicado**, carregando origem e identificadores de clique.
2. Vendedores atendem por um **inbox nativo**, com push em Android, iOS, Windows e macOS.
3. Gestores enxergam **funil, KPIs e DRE** com custo real por etapa.
4. O CRM **devolve eventos de qualificação** para Meta e Google, otimizando por lead que vira dinheiro
   e não por lead que vira formulário.

## 3. Stack

| Camada | Escolha | Papel |
|---|---|---|
| Dados / auth / realtime | **Supabase** (Postgres 15+, Auth, RLS, Realtime, Storage, Edge Functions, pgmq, pg_cron) | Fonte única da verdade |
| Frontend | **PWA React + Tailwind + shadcn/ui** (construído no Lovable) | Interface responsiva mobile/desktop |
| Trabalho longo | **Worker Node no VPS** | uazapi, rate-limit de envio, mídia, sync de custo de mídia, outbox |
| Atendimento | **Inbox nativo** | Chatwoot sai do caminho |
| Notificação | **Web Push (VAPID)** | Um app só para todos os sistemas operacionais |

### Por que essa combinação

O **Supabase** resolve multi-tenant com RLS dentro do próprio banco: a regra de visibilidade vive junto do
dado, não espalhada por controllers. Isso importa num CRM onde "vendedor só vê o lead dele" é requisito de
negócio, não detalhe. O Realtime cobre o inbox sem infraestrutura de WebSocket própria.

O **Lovable** entrega o app React/shadcn conectado ao Supabase sem montar build, auth e deploy à mão.

O **worker no VPS** existe porque Edge Function tem teto de execução (~60s no plano Pro) e não é lugar para
manter sessão de WhatsApp não-oficial nem para varrer relatório de mídia paga.

### Regra de corte entre Edge Function e Worker

```
Edge Function  →  recebe webhook, valida assinatura, grava cru, enfileira.  Sempre rápido.
Worker (VPS)   →  consome fila, faz o trabalho demorado, marca resultado.   Pode demorar.
```

Se uma tarefa pode levar mais de alguns segundos ou precisa de retry com backoff longo, ela é do worker.

## 4. Fluxo geral

```
Fontes                    Ingestão (Edge Functions)        Núcleo (Supabase)         Saídas
──────                    ─────────────────────────        ─────────────────         ──────
uazapi (WhatsApp) ──┐
WABA Cloud API ─────┤
Site / LP (crm.js) ─┼──►  /ingest/*  ──►  webhook_deliveries (idempotência)
Facebook Lead Ads ──┤       │                    │
Instagram / e-mail ─┘       ▼                    ▼
                        normalize +        contacts / contact_identities
                        dedupe/stitch      conversations / messages          ──► Realtime ──► PWA
                             │             deals / stages / tasks            ──► Web Push ──► Android/iOS/Win/Mac
                             ▼             touchpoints / ad_costs_daily
                        pgmq (filas)  ◄──────────┤                           ──► Meta CAPI
                             │                   │                           ──► Google Data Manager API
                             ▼                   ▼
                    Worker Node (VPS): envio WhatsApp com rate-limit, download de mídia,
                    sync de custo Meta/Google Ads, execução de automações, outbox de conversões
```

## 5. Princípios de projeto

Estes valem para todo o resto da especificação e explicam decisões que, isoladas, pareceriam arbitrárias.

1. **Toda ingestão é idempotente.** Provider que reenvia webhook é regra, não exceção. Payload cru entra em
   `webhook_deliveries` com hash antes de qualquer processamento.
2. **Nada é apagado.** Entidade de negócio usa `deleted_at`. Contato fundido vira registro em `contact_merges`,
   nunca `DELETE`.
3. **Mudança de estado vira evento.** `deal_stage_events` é o que torna KPI de funil calculável
   retroativamente. Sem a tabela de eventos, "quantos leads chegaram em SQL em março" é impossível de
   responder depois que o deal andou.
4. **Efeito colateral externo passa por outbox.** Enviar evento pra Meta ou Google nunca acontece dentro da
   transação que mudou a etapa. Grava em `conversion_events_outbox`, o worker entrega com retry.
5. **Dado sensível é hasheado no envio, não no armazenamento.** E-mail e telefone ficam em claro no banco
   (o vendedor precisa ligar). O SHA-256 é gerado no momento de falar com Meta/Google.
6. **`org_id` nunca vem do client.** É derivado de `auth.uid()` ou da `site_key`, sempre no servidor.

## 6. Índice da especificação

| Documento | Conteúdo |
|---|---|
| [`01-modelo-de-dados.md`](01-modelo-de-dados.md) | Entidades, relacionamentos e decisões de modelagem |
| [`schema.sql`](schema.sql) | DDL de referência: tabelas, índices, constraints, RLS |
| [`02-ingestao-e-dedupe.md`](02-ingestao-e-dedupe.md) | Contratos de payload por fonte e algoritmo de stitching |
| [`03-captura-web.md`](03-captura-web.md) | Tracker `crm.js`, `/ingest/form`, plugin WordPress, UTMs |
| [`04-atribuicao-e-conversoes.md`](04-atribuicao-e-conversoes.md) | Meta CAPI e Google Data Manager API |
| [`05-inbox-e-notificacoes.md`](05-inbox-e-notificacoes.md) | Máquina de estados de conversa, janela 24h, Web Push |
| [`06-metricas-e-dre.md`](06-metricas-e-dre.md) | Dicionário de métricas com SQL de cada KPI |
| [`07-roadmap.md`](07-roadmap.md) | Fases, dependências e critérios de aceite |

## 7. Restrições externas com data

Fatos do calendário das plataformas que já estão valendo ou vão valer, e que o desenho considera:

| Data | Mudança | Impacto |
|---|---|---|
| **15/06/2026** | Upload de conversões offline **bloqueado na Google Ads API**; migrou para a **Data Manager API** | Integração com Google usa `datamanager.googleapis.com`. Tutorial que aponte para `OfflineUserDataJob` está desatualizado |
| **01/10/2026** | Fim da janela de atendimento gratuita no WhatsApp: mensagens de serviço e utility dentro das 24h voltam a ser cobradas | Custo por conversa entra no DRE como linha real |
| Vigente | ITP do Safari corta cookie criado por JavaScript em 7 dias, ou 24h se a URL tem parâmetro de rastreamento | Cookie do tracker **precisa** ser server-side. Ver [`03-captura-web.md`](03-captura-web.md) |
