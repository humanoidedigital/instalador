# 01 — Modelo de dados

DDL executável em [`schema.sql`](schema.sql). Este documento explica as decisões
que o SQL não consegue justificar sozinho.

## Convenções

| Regra | Motivo |
|---|---|
| Toda tabela de negócio tem `org_id` | Multi-tenant por RLS, não por filtro de aplicação |
| Soft delete via `deleted_at` | Lead apagado por engano é rotina em operação comercial |
| `timestamptz` sempre, em UTC | Fuso da org fica em `orgs.timezone`, aplicado só na apresentação |
| Helpers de RLS no schema `app` | Isolamento; e `SECURITY DEFINER` evita recursão de policy |

## Mapa das entidades

```
orgs
 ├── profiles ──┬── teams / team_members
 │              └── user_devices            (assinaturas Web Push)
 │
 ├── contacts ──┬── contact_identities      ◄── DEDUPE
 │              ├── contact_merges
 │              └── contact_companies ── companies
 │
 ├── pipelines ── stages
 │       └── deals ──┬── deal_items ── products
 │                   ├── deal_stage_events  ◄── BASE DOS KPIs
 │                   └── attribution_snapshots
 │
 ├── touchpoints            (rastreamento bruto)
 ├── sites                  (site_key + allowlist de domínio)
 │
 ├── channels ── conversations ──┬── messages
 │                               └── conversation_events
 │
 ├── tasks ── task_reminders
 ├── automations ── automation_steps / automation_runs
 │
 ├── ad_accounts ── ad_entities ── ad_costs_daily
 ├── conversion_destinations ── conversion_events_outbox
 ├── revenues / costs ── mv_dre_mensal
 └── webhook_deliveries / audit_log
```

## As quatro decisões que sustentam o resto

### 1. `contact_identities` — por que não deduplicar direto em `contacts`

Uma pessoa tem várias chaves: telefone, e-mail, `wa_id`, `fb_lead_id`, `gclid` da sessão em que
converteu. Guardar tudo em colunas de `contacts` obrigaria a comparar N colunas contra N colunas a cada
ingestão, e não teria onde colocar a segunda variante do mesmo telefone.

Com uma tabela de identidades, a busca é sempre uma só: `WHERE (tipo, valor) = (?, ?)`, servida por
índice único. Deduplicar vira lookup, não varredura.

**O caso brasileiro que justifica o desenho:** `+5511987654321` e `+551187654321` são a mesma pessoa.
Escrevemos **duas linhas** em `contact_identities`, ambas apontando para o mesmo `contact_id`. Não existe
"normalização correta" única para o nono dígito — existe reconhecer as duas formas.

### 2. `deal_stage_events` — por que não bastam `deals.stage_id` e `updated_at`

`deals.stage_id` guarda onde o deal **está**. Nenhum KPI de funil pergunta isso.

Todas as perguntas reais são históricas: "quantos leads chegaram em SQL em março", "qual o tempo médio
entre proposta e fechamento", "quanto custou cada reunião agendada no trimestre". Sem uma linha por
transição, essas respostas somem no instante em que o deal avança.

A tabela guarda `to_categoria` **desnormalizada**: se amanhã a etapa "Proposta enviada" for
recategorizada de `orcamento` para `sql`, o histórico continua dizendo o que era verdade na época.

### 3. `stages.categoria` — por que o nome da etapa não serve como chave

Cada operação nomeia as etapas do seu jeito: "Contato feito", "Em negociação", "Proposta na mão do
cliente". Métrica de mercado (custo por MQL, custo por SQL) precisa de vocabulário fixo.

`categoria` é a ponte: o cliente nomeia como quiser e marca a qual conceito aquilo corresponde. É o que
permite a mesma query de "custo por SQL" funcionar em qualquer org, e o que faz o gatilho de conversão
(seção 9 do schema) disparar por conceito em vez de por UUID de etapa.

### 4. `conversion_events_outbox` — por que não chamar a API direto no trigger

Três razões, em ordem de gravidade:

1. **Transação.** Uma chamada HTTP dentro do `UPDATE` do deal prende a transação pelo tempo da rede. Se a
   Meta demora 3s, o deal fica travado 3s.
2. **Falha.** Se a API do Google estiver fora, ou o trigger falha (e o deal não move) ou o evento se perde.
   Nenhuma das duas é aceitável.
3. **Duplicata.** O `UNIQUE (destination_id, dedupe_key)` com `dedupe_key = deal_id + event_name` garante
   que um deal que volta de etapa e avança de novo **não** conte a conversão duas vezes. Testado: ida e
   volta entre etapas produz uma linha só.

## Índices que não são óbvios

| Índice | Consulta que ele serve |
|---|---|
| `deals_abertos_por_contato_idx` (parcial, `status='aberto'`) | Regra anti-deal-duplicado, executada em **toda** ingestão |
| `conversations_fila_idx` (parcial, `assigned_to is null`) | Fila de conversas sem dono — a tela mais acessada do inbox |
| `tasks_agenda_idx` (parcial, `status='aberta'`) | "Minhas tarefas de hoje" e "vencidas", tela de abertura do vendedor |
| `messages_provider_uniq` (parcial, `provider_message_id not null`) | Idempotência do webhook de mensagem |
| `outbox_pendentes_idx` (parcial, `status='pendente'`) | Varredura do worker, que roda a cada minuto |

Todos são **parciais**. Num CRM, a fração quente da tabela é pequena (deals abertos, tarefas não
concluídas, outbox pendente) e o índice parcial mantém essa fração em memória mesmo quando o histórico
cresce para milhões de linhas.

## RLS em três camadas

1. **Isolamento de org** — todas as tabelas, sem exceção:
   `org_id IN (select app.orgs_visiveis())`.
2. **Escopo por dono** — `deals`, `conversations`, `tasks`, `contacts`:
   `owner_id IN (select app.visible_owner_ids())`.
   - `agencia` → todos os clientes da agência · `admin` → toda a org ·
     `gestor` → seu time · `vendedor` → só ele
   - `owner_id IS NULL` é visível para todos: é a **fila de leads sem dono**, de onde o vendedor puxa trabalho.
3. **Escrita restrita** — tabelas de configuração (`pipelines`, `channels`, `conversion_destinations`,
   `costs`) só aceitam escrita de `admin`.

### A camada de agência

Um banco atende vários clientes. `agencies` fica acima de `orgs`, e
`app.orgs_visiveis()` é o único ponto que decide alcance: devolve todos os
clientes da agência para quem tem papel `agencia`, e apenas a própria
organização para todo o resto. Toda policy consulta essa função — não existe
regra de visibilidade escrita à mão em tabela nenhuma.

`app.current_org_id()` continua existindo e devolve `null` para usuário de
agência: é ela que decide em qual organização uma linha nova nasce, e o
usuário de agência precisa escolher o cliente na interface antes de criar
qualquer coisa.

> **Cuidado que já custou um bug:** dentro de `app.visible_owner_ids()` a
> pergunta é sobre o papel de **quem consulta**, não do dono da linha.
> Comparar `p.role` em vez de `app.current_role()` fazia o usuário de agência
> não enxergar deal nenhum.

Mensagens e itens de deal não repetem a regra: usam `EXISTS` sobre a tabela pai, herdando a policy dela.
Uma regra escrita uma vez.

> **`security_invoker = true` em toda view.** Sem isso, uma view em Postgres roda com os privilégios do
> dono e **ignora a RLS das tabelas de baixo** — um vendedor leria o funil inteiro pela view. É o erro de
> segurança mais fácil de cometer aqui.
>
> `mv_dre_mensal` é materializada e **não** aceita `security_invoker`. Por isso nunca é exposta ao client:
> o acesso é pela view `v_dre_mensal`, que filtra por `app.current_org_id()`.

## Validação executada

```bash
pg_ctlcluster 16 main start
su postgres -c "psql -c 'create database crmspec'"
su postgres -c "psql -v ON_ERROR_STOP=1 -d crmspec -f docs/crm/schema.sql"
```

Resultado: DDL completo aplica sem erro em PostgreSQL 16. Teste funcional confirmou que mover um deal
entre etapas grava `deal_stage_events` com duração, enfileira a conversão correta no outbox, e que uma
ida-e-volta entre etapas **não** duplica o evento.

O isolamento entre clientes tem suíte própria em `supabase/tests/rls_isolamento.sql`, executada sob o
papel `authenticated` — **não** como superusuário, que ignora RLS e faria qualquer teste passar.
