-- =====================================================================
--  CRM — INSTALAÇÃO COMPLETA
--
--  Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
--  Nenhuma credencial precisa sair da sua máquina.
--
--  O que ele cria:
--    · toda a estrutura do CRM (contatos, funil, conversas, tarefas,
--      automações, mídia paga, financeiro)
--    · a segurança por linha (RLS): cada cliente enxerga só o que é dele
--    · a camada de agência: você enxerga todos os seus clientes
--    · a ingestão de leads com deduplicação
--    · o funil padrão que todo cliente novo recebe
--
--  Rodar de novo NÃO é seguro: as tabelas seriam recriadas. Para atualizar
--  depois, aplique só a migration nova em supabase/migrations/.
--
--  DEPOIS DE RODAR, crie sua agência e o primeiro cliente:
--
--    insert into agencies (nome, slug)
--    values ('Nome da sua agência', 'sua-agencia')
--    returning id;
--
--    select app.criar_cliente('<id devolvido acima>', 'Nome do Cliente', 'slug-do-cliente');
--
--  O cliente já nasce com funil, sete etapas e seis motivos de perda.
-- =====================================================================


-- #####################################################################
-- ## 20260901120000_init.sql
-- #####################################################################

-- =====================================================================
-- 0001 · Estrutura inicial do CRM
--
-- Aplicar:  supabase db push
--       ou: psql "$DATABASE_URL" -f supabase/migrations/20260901120000_init.sql
--
-- Referência comentada: docs/crm/01-modelo-de-dados.md
-- =====================================================================

-- =====================================================================
-- CRM Comercial Unificado — DDL de referência
-- Alvo: PostgreSQL 15+ / Supabase
--
-- Roda em Postgres puro (para validação local) e em Supabase.
-- O bloco de bootstrap cria stubs de `auth` apenas quando ausentes,
-- então em Supabase ele é inerte e NUNCA sobrescreve auth.uid().
--
-- Convenções:
--   * Toda tabela de negócio tem org_id (multi-tenant) e deleted_at (soft delete).
--   * Nada de DELETE em entidade de negócio.
--   * Timestamps em timestamptz, sempre UTC.
--   * Helpers de RLS vivem no schema `app`, SECURITY DEFINER, para evitar
--     recursão de policy (uma policy de profiles que lesse profiles trava).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Bootstrap
-- ---------------------------------------------------------------------
create schema if not exists app;

-- gen_random_bytes() (usado na site_key) vem do pgcrypto. Disponível no
-- Supabase; em Postgres puro precisa da extensão instalada.
create extension if not exists pgcrypto;

do $bootstrap$
begin
  -- Em Postgres puro não existe o schema auth do Supabase. Criamos um stub
  -- mínimo para o DDL validar. Em Supabase nada disso executa.
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
  ) then
    create table auth.users (
      id    uuid primary key default gen_random_uuid(),
      email text
    );
  end if;

  -- Só cria auth.uid() se realmente não existir. Em Supabase existe e é dela.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'
    $fn$;
  end if;
end
$bootstrap$;

-- ---------------------------------------------------------------------
-- 1. Tipos
-- ---------------------------------------------------------------------
create type app_role            as enum ('admin', 'gestor', 'vendedor');
create type identity_kind       as enum ('phone', 'email', 'wa_id', 'fbclid', 'gclid', 'fb_lead_id', 'external_id');
create type stage_category      as enum ('lead', 'mql', 'sql', 'reuniao', 'orcamento', 'fechamento');
create type deal_status         as enum ('aberto', 'ganho', 'perdido');
create type channel_kind        as enum ('uazapi', 'waba', 'webchat', 'instagram', 'email');
create type conversation_status as enum ('aberta', 'pendente', 'fechada');
create type msg_direction       as enum ('in', 'out');
create type msg_kind            as enum ('texto', 'imagem', 'audio', 'video', 'documento', 'localizacao', 'contato', 'template', 'sistema');
create type msg_status          as enum ('fila', 'enviado', 'entregue', 'lido', 'falhou');
create type task_kind           as enum ('ligacao', 'whatsapp', 'email', 'reuniao', 'followup', 'outro');
create type task_status         as enum ('aberta', 'concluida', 'cancelada');
create type automation_step_kind as enum ('enviar_whatsapp', 'enviar_email', 'enviar_sms', 'criar_tarefa', 'mover_etapa', 'atribuir', 'webhook', 'esperar', 'condicao');
create type run_status          as enum ('pendente', 'rodando', 'concluido', 'falhou', 'cancelado');
create type ad_platform         as enum ('meta', 'google', 'tiktok', 'outro');
create type ad_level            as enum ('conta', 'campanha', 'conjunto', 'anuncio');
create type conversion_target   as enum ('meta_capi', 'google_data_manager');
create type outbox_status       as enum ('pendente', 'enviado', 'falhou', 'descartado');
create type cost_category       as enum ('midia', 'comissao', 'folha', 'ferramentas', 'operacional', 'imposto', 'outro');
create type revenue_kind        as enum ('unica', 'recorrente');
create type lead_source         as enum ('whatsapp', 'site', 'landing_page', 'fb_lead_ads', 'ctwa', 'instagram', 'email', 'manual', 'importacao', 'api');

-- ---------------------------------------------------------------------
-- 2. Organização e acesso
-- ---------------------------------------------------------------------
create table orgs (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null unique,
  timezone    text not null default 'America/Sao_Paulo',
  -- Janela em dias para a regra anti-deal-duplicado (ver 02-ingestao-e-dedupe.md).
  dedupe_deal_janela_dias int not null default 30 check (dedupe_deal_janela_dias >= 0),
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references orgs(id),
  nome        text not null,
  email       text not null,
  role        app_role not null default 'vendedor',
  ativo       boolean not null default true,
  avatar_url  text,
  -- Peso na distribuição round-robin; 0 tira o vendedor do rodízio.
  peso_distribuicao int not null default 1 check (peso_distribuicao >= 0),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index on profiles (org_id) where deleted_at is null;

create table teams (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  nome       text not null,
  gestor_id  uuid references profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on teams (org_id);

create table team_members (
  team_id    uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (team_id, profile_id)
);

-- Assinaturas Web Push (uma por navegador/dispositivo).
create table user_devices (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id),
  profile_id  uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth_key    text not null,
  user_agent  text,
  plataforma  text,               -- 'android' | 'ios' | 'windows' | 'macos' | 'outro'
  ativo       boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index on user_devices (profile_id) where ativo;

-- ---------------------------------------------------------------------
-- 3. Pessoas e empresas
-- ---------------------------------------------------------------------
create table companies (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  nome       text not null,
  cnpj       text,
  dominio    text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on companies (org_id) where deleted_at is null;

create table contacts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  nome         text,
  email        text,               -- sempre lower(trim())
  phone_e164   text,               -- sempre E.164, ex: +5511987654321
  documento    text,
  owner_id     uuid references profiles(id),
  first_source lead_source,
  tags         text[] not null default '{}',
  opt_out      boolean not null default false,   -- LGPD: desligou comunicação
  opt_out_at   timestamptz,
  consentimento jsonb not null default '{}'::jsonb, -- base legal, origem e data do aceite
  custom       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on contacts (org_id) where deleted_at is null;
create index on contacts (org_id, owner_id) where deleted_at is null;
create index on contacts (org_id, phone_e164);
create index on contacts (org_id, lower(email));
create index on contacts using gin (tags);

-- CORAÇÃO DO DEDUPE.
-- Toda chave conhecida de uma pessoa aponta para o mesmo contato. Um telefone
-- em duas variantes (com e sem o 9º dígito) gera DUAS linhas apontando para o
-- MESMO contact_id — é isso que faz o stitching funcionar em número brasileiro.
create table contact_identities (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  contact_id uuid not null references contacts(id) on delete cascade,
  tipo       identity_kind not null,
  valor      text not null,
  origem     lead_source,
  created_at timestamptz not null default now(),
  unique (org_id, tipo, valor)
);
create index on contact_identities (contact_id);

-- Histórico de fusão. O contato perdedor não é apagado: fica marcado com
-- deleted_at e uma linha aqui explicando para onde foi.
create table contact_merges (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id),
  vencedor_id    uuid not null references contacts(id),
  perdedor_id    uuid not null references contacts(id),
  motivo         text,
  executado_por  uuid references profiles(id),
  snapshot       jsonb,      -- estado do perdedor no momento da fusão
  created_at     timestamptz not null default now()
);
create index on contact_merges (vencedor_id);

create table contact_companies (
  contact_id uuid not null references contacts(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  cargo      text,
  primary key (contact_id, company_id)
);

-- ---------------------------------------------------------------------
-- 4. Funil
-- ---------------------------------------------------------------------
create table pipelines (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  nome       text not null,
  padrao     boolean not null default false,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on pipelines (org_id) where deleted_at is null;

create table stages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  nome        text not null,
  ordem       int not null,
  -- `categoria` é o que liga a etapa (nome livre do cliente) ao vocabulário de
  -- métricas. "Proposta enviada" pode ser categoria 'orcamento'. Sem isso,
  -- custo por SQL só funcionaria se todo mundo nomeasse a etapa de SQL igual.
  categoria   stage_category not null default 'lead',
  is_won      boolean not null default false,
  is_lost     boolean not null default false,
  sla_horas   int check (sla_horas is null or sla_horas > 0),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (pipeline_id, ordem) deferrable initially deferred,
  constraint stage_won_xor_lost check (not (is_won and is_lost))
);
create index on stages (pipeline_id);

create table loss_reasons (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  nome       text not null,
  ativo      boolean not null default true
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  nome         text not null,
  sku          text,
  preco        numeric(14,2),
  -- Custo direto do produto, usado na margem do DRE.
  custo_direto numeric(14,2) not null default 0,
  ativo        boolean not null default true
);

create table deals (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id),
  contact_id     uuid not null references contacts(id),
  company_id     uuid references companies(id),
  pipeline_id    uuid not null references pipelines(id),
  stage_id       uuid not null references stages(id),
  owner_id       uuid references profiles(id),
  titulo         text,
  valor          numeric(14,2) not null default 0,
  moeda          char(3) not null default 'BRL',
  status         deal_status not null default 'aberto',
  loss_reason_id uuid references loss_reasons(id),
  origem         lead_source,
  score          int check (score is null or score between 0 and 100),
  entrou_em      timestamptz not null default now(),  -- entrada na etapa atual
  closed_at      timestamptz,
  custom         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint deal_fechado_tem_data check (
    (status = 'aberto' and closed_at is null) or (status <> 'aberto' and closed_at is not null)
  )
);
create index on deals (org_id, status) where deleted_at is null;
create index on deals (org_id, owner_id, status) where deleted_at is null;
create index on deals (pipeline_id, stage_id) where deleted_at is null;
create index on deals (contact_id);
create index on deals (org_id, created_at);

-- Índice parcial que sustenta a regra anti-deal-duplicado: buscar deal ABERTO
-- do mesmo contato no mesmo pipeline é a consulta feita em toda ingestão.
create index deals_abertos_por_contato_idx
  on deals (org_id, contact_id, pipeline_id, created_at desc)
  where status = 'aberto' and deleted_at is null;

create table deal_items (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references deals(id) on delete cascade,
  product_id uuid references products(id),
  descricao  text,
  quantidade numeric(12,3) not null default 1,
  preco_unit numeric(14,2) not null default 0,
  custo_unit numeric(14,2) not null default 0
);
create index on deal_items (deal_id);

-- TODA mudança de etapa vira uma linha aqui.
-- É o que torna KPI de funil calculável retroativamente: sem esta tabela,
-- "quantos leads chegaram em SQL em março" é impossível de responder depois
-- que o deal já andou para outra etapa.
create table deal_stage_events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id),
  deal_id        uuid not null references deals(id) on delete cascade,
  from_stage_id  uuid references stages(id),
  to_stage_id    uuid not null references stages(id),
  -- Categoria desnormalizada no momento do evento: se a etapa for
  -- recategorizada depois, o histórico permanece verdadeiro.
  to_categoria   stage_category not null,
  changed_by     uuid references profiles(id),
  automatico     boolean not null default false,
  -- Tempo que o deal passou na etapa anterior, em segundos.
  duracao_anterior_s int,
  occurred_at    timestamptz not null default now()
);
create index on deal_stage_events (org_id, occurred_at);
create index on deal_stage_events (deal_id, occurred_at);
create index on deal_stage_events (org_id, to_categoria, occurred_at);

-- ---------------------------------------------------------------------
-- 5. Rastreamento e atribuição
-- ---------------------------------------------------------------------
create table touchpoints (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id),
  contact_id    uuid references contacts(id) on delete cascade,
  -- Antes de o lead se identificar só existe o anonymous_id do cookie.
  -- Quando o formulário chega, os touchpoints anônimos são reatribuídos.
  anonymous_id  text,
  deal_id       uuid references deals(id) on delete set null,
  tipo          text not null default 'pageview',  -- pageview | form | message | click
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_term      text,
  utm_content   text,
  utm_id        text,             -- ID numérico da campanha; ver 03-captura-web.md
  gclid         text,
  gbraid        text,
  wbraid        text,
  fbclid        text,
  fbp           text,
  fbc           text,
  msclkid       text,
  ttclid        text,
  ctwa_clid     text,             -- Click-to-WhatsApp
  ad_external_id text,            -- id do anúncio quando conhecido
  landing_url   text,
  referrer      text,
  user_agent    text,
  ip_hash       text,             -- LGPD: só o hash, nunca o IP cru
  occurred_at   timestamptz not null default now()
);
create index on touchpoints (org_id, occurred_at);
create index on touchpoints (contact_id, occurred_at);
create index on touchpoints (anonymous_id) where anonymous_id is not null;
create index on touchpoints (org_id, gclid) where gclid is not null;
create index on touchpoints (org_id, fbclid) where fbclid is not null;

-- Resultado materializado da atribuição por deal e por modelo.
-- Recalculado quando o deal muda de etapa ou fecha.
create table attribution_snapshots (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id),
  deal_id        uuid not null references deals(id) on delete cascade,
  modelo         text not null,   -- first_touch | last_touch | linear
  touchpoint_id  uuid references touchpoints(id) on delete set null,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_id         text,
  ad_external_id text,
  peso           numeric(6,4) not null default 1,  -- 1 para first/last, fração no linear
  calculado_em   timestamptz not null default now(),
  unique (deal_id, modelo, touchpoint_id)
);
create index on attribution_snapshots (org_id, modelo, utm_id);

-- Sites e landing pages autorizados a postar em /ingest/form.
-- A site_key é pública (vai no HTML); a segurança real é a allowlist de domínio
-- conferida contra o header Origin no servidor.
create table sites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  nome         text not null,
  site_key     text not null unique default encode(gen_random_bytes(16), 'hex'),
  dominios     text[] not null default '{}',
  ativo        boolean not null default true,
  pipeline_id  uuid references pipelines(id),   -- pipeline de destino dos leads
  -- Mapeamento de campos do formulário para campos do CRM (modo E).
  field_map    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index on sites (org_id) where ativo;

-- ---------------------------------------------------------------------
-- 6. Conversas
-- ---------------------------------------------------------------------
create table channels (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  tipo         channel_kind not null,
  nome         text not null,
  identificador text,             -- número em E.164, e-mail ou @ do perfil
  -- Segredos NÃO ficam aqui em claro. Esta coluna guarda referências
  -- (nome do secret no Supabase Vault), nunca o token.
  config       jsonb not null default '{}'::jsonb,
  ativo        boolean not null default true,
  -- Envios por minuto. Número não-oficial que dispara em rajada é banido.
  rate_limit_min int not null default 20 check (rate_limit_min > 0),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on channels (org_id) where deleted_at is null;

create table conversations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id),
  channel_id    uuid not null references channels(id),
  contact_id    uuid not null references contacts(id),
  deal_id       uuid references deals(id) on delete set null,
  assigned_to   uuid references profiles(id),
  status        conversation_status not null default 'aberta',
  -- Fim da janela de 24h da WABA. Fora dela só template aprovado sai.
  window_expires_at timestamptz,
  unread_count  int not null default 0,
  last_message_at timestamptz,
  -- Instante da primeira resposta humana; base do SLA de atendimento.
  first_response_at timestamptz,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  unique (channel_id, contact_id)
);
create index on conversations (org_id, status, last_message_at desc) where deleted_at is null;
create index on conversations (org_id, assigned_to, status) where deleted_at is null;
-- Fila de não atribuídas: a consulta mais quente do inbox.
create index conversations_fila_idx on conversations (org_id, last_message_at desc)
  where assigned_to is null and status <> 'fechada' and deleted_at is null;

create table messages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id),
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction     msg_direction not null,
  tipo          msg_kind not null default 'texto',
  corpo         text,
  media_path    text,             -- caminho no bucket privado do Storage
  media_mime    text,
  -- ID do provedor. UNIQUE por canal é o que torna o webhook idempotente.
  provider_message_id text,
  status        msg_status not null default 'fila',
  sent_by       uuid references profiles(id),
  erro          text,
  raw           jsonb,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  delivered_at  timestamptz,
  read_at       timestamptz
);
create index on messages (conversation_id, created_at desc);
create unique index messages_provider_uniq
  on messages (org_id, provider_message_id) where provider_message_id is not null;

create table message_templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  channel_id   uuid references channels(id),
  nome         text not null,
  categoria    text,              -- marketing | utility | authentication
  idioma       text not null default 'pt_BR',
  corpo        text not null,
  variaveis    jsonb not null default '[]'::jsonb,
  provider_id  text,              -- id do template na Meta
  status       text not null default 'rascunho', -- rascunho|pendente|aprovado|rejeitado
  created_at   timestamptz not null default now()
);

create table quick_replies (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  atalho     text not null,
  corpo      text not null,
  owner_id   uuid references profiles(id),   -- null = compartilhada na org
  unique (org_id, atalho)
);

-- Eventos da conversa que não são mensagem: transferência, nota interna,
-- fechamento. Mantidos separados para não poluir a thread do cliente.
create table conversation_events (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id),
  conversation_id uuid not null references conversations(id) on delete cascade,
  tipo            text not null,   -- atribuicao|transferencia|nota|fechamento|reabertura
  autor_id        uuid references profiles(id),
  alvo_id         uuid references profiles(id),
  corpo           text,
  occurred_at     timestamptz not null default now()
);
create index on conversation_events (conversation_id, occurred_at);

-- ---------------------------------------------------------------------
-- 7. Tarefas
-- ---------------------------------------------------------------------
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id),
  titulo         text not null,
  descricao      text,
  tipo           task_kind not null default 'followup',
  status         task_status not null default 'aberta',
  owner_id       uuid not null references profiles(id),
  deal_id        uuid references deals(id) on delete cascade,
  contact_id     uuid references contacts(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  due_at         timestamptz not null,
  remind_before_min int not null default 15 check (remind_before_min >= 0),
  concluida_em   timestamptz,
  criada_por     uuid references profiles(id),
  automacao_id   uuid,             -- FK adicionada após a criação de automations
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint task_concluida_tem_data check (
    (status = 'concluida') = (concluida_em is not null)
  )
);
-- Sustenta as visões "minhas tarefas de hoje" e "vencidas", que são a tela
-- de abertura do vendedor.
create index tasks_agenda_idx on tasks (org_id, owner_id, due_at)
  where status = 'aberta' and deleted_at is null;
create index on tasks (deal_id) where deleted_at is null;

-- Lembretes já disparados. Existe para não notificar duas vezes o mesmo
-- lembrete quando o worker roda de novo.
create table task_reminders (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  disparado_em timestamptz not null default now(),
  canal      text not null default 'push',
  unique (task_id, canal, disparado_em)
);

-- ---------------------------------------------------------------------
-- 8. Automações
-- ---------------------------------------------------------------------
create table automations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  nome       text not null,
  ativo      boolean not null default false,
  -- { "evento": "stage_changed", "pipeline_id": "...", "to_categoria": "sql" }
  trigger    jsonb not null,
  -- Guardas obrigatórias (ver 07): teto diário por lead, horário comercial,
  -- e parar tudo se o lead responder.
  guardas    jsonb not null default '{"max_msgs_dia": 3, "horario_comercial": true, "parar_se_responder": true}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on automations (org_id) where ativo and deleted_at is null;

create table automation_steps (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  ordem         int not null,
  tipo          automation_step_kind not null,
  config        jsonb not null default '{}'::jsonb,
  unique (automation_id, ordem) deferrable initially deferred
);

alter table tasks add constraint tasks_automacao_fk
  foreign key (automacao_id) references automations(id) on delete set null;

create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id),
  automation_id uuid not null references automations(id) on delete cascade,
  deal_id       uuid references deals(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete cascade,
  status        run_status not null default 'pendente',
  step_atual    int not null default 0,
  -- Momento em que o worker deve retomar (usado pelo passo 'esperar').
  retomar_em    timestamptz,
  -- Impede que o mesmo gatilho dispare a mesma automação duas vezes.
  dedupe_key    text not null,
  erro          text,
  created_at    timestamptz not null default now(),
  finalizado_em timestamptz,
  unique (automation_id, dedupe_key)
);
create index automation_runs_pendentes_idx on automation_runs (retomar_em)
  where status in ('pendente', 'rodando');

create table automation_step_runs (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references automation_runs(id) on delete cascade,
  step_id    uuid not null references automation_steps(id) on delete cascade,
  status     run_status not null default 'pendente',
  resultado  jsonb,
  erro       text,
  executado_em timestamptz not null default now()
);
create index on automation_step_runs (run_id);

-- ---------------------------------------------------------------------
-- 9. Mídia paga e devolução de conversões
-- ---------------------------------------------------------------------
create table ad_accounts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id),
  plataforma  ad_platform not null,
  external_id text not null,       -- act_123456 (Meta) ou 123-456-7890 (Google)
  nome        text,
  moeda       char(3) not null default 'BRL',
  ativo       boolean not null default true,
  unique (org_id, plataforma, external_id)
);

-- Hierarquia campanha > conjunto > anúncio, achatada em uma tabela
-- auto-referente. Simplifica o join com touchpoints, que só conhece um id.
create table ad_entities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  account_id   uuid not null references ad_accounts(id) on delete cascade,
  parent_id    uuid references ad_entities(id) on delete cascade,
  nivel        ad_level not null,
  external_id  text not null,
  nome         text,
  status       text,
  atualizado_em timestamptz not null default now(),
  unique (account_id, nivel, external_id)
);
create index on ad_entities (org_id, external_id);

create table ad_costs_daily (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id),
  account_id  uuid not null references ad_accounts(id) on delete cascade,
  entity_id   uuid references ad_entities(id) on delete cascade,
  external_id text not null,       -- redundante de propósito: o sync escreve
                                   -- antes de a hierarquia existir
  nivel       ad_level not null,
  data        date not null,
  impressoes  bigint not null default 0,
  cliques     bigint not null default 0,
  custo       numeric(14,2) not null default 0,
  moeda       char(3) not null default 'BRL',
  raw         jsonb,
  unique (org_id, external_id, nivel, data)
);
create index on ad_costs_daily (org_id, data);
create index on ad_costs_daily (entity_id, data);

-- Mapa configurável no admin: "etapa X do pipeline Y dispara evento Z no
-- destino W". É o que permite mudar o objetivo de otimização sem deploy.
create table conversion_destinations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  destino      conversion_target not null,
  nome         text not null,
  -- Meta: dataset_id. Google: productDestinationId (conversion action UPLOAD_CLICKS).
  external_id  text not null,
  -- Google exige também o operatingAccount/linkedAccount; Meta exige o token.
  config       jsonb not null default '{}'::jsonb,
  pipeline_id  uuid references pipelines(id) on delete cascade,
  stage_id     uuid references stages(id) on delete cascade,
  categoria    stage_category,     -- alternativa a stage_id: dispara por categoria
  event_name   text not null,      -- 'MQL' | 'SQL' | 'ReuniaoAgendada' | 'Purchase'
  -- 'deal'  = usa deals.valor
  -- 'fixo'  = usa valor_fixo
  -- 'nenhum'= não envia valor
  valor_modo   text not null default 'deal' check (valor_modo in ('deal','fixo','nenhum')),
  valor_fixo   numeric(14,2),
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint destino_tem_gatilho check (stage_id is not null or categoria is not null)
);
create index on conversion_destinations (org_id) where ativo;

-- Padrão outbox: a mudança de etapa grava aqui na MESMA transação, e o worker
-- entrega depois. Nunca chame a API da Meta ou do Google dentro da transação
-- que moveu o deal.
create table conversion_events_outbox (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id),
  deal_id        uuid not null references deals(id) on delete cascade,
  destination_id uuid not null references conversion_destinations(id) on delete cascade,
  event_name     text not null,
  event_time     timestamptz not null default now(),
  valor          numeric(14,2),
  moeda          char(3) not null default 'BRL',
  -- deal_id + event_name + destino. UNIQUE garante que uma etapa nunca
  -- dispara duas vezes, mesmo com retry ou replay de webhook.
  dedupe_key     text not null,
  payload        jsonb not null default '{}'::jsonb,
  status         outbox_status not null default 'pendente',
  tentativas     int not null default 0,
  proxima_tentativa_em timestamptz not null default now(),
  ultimo_erro    text,
  resposta       jsonb,
  enviado_em     timestamptz,
  created_at     timestamptz not null default now(),
  unique (destination_id, dedupe_key)
);
create index outbox_pendentes_idx on conversion_events_outbox (proxima_tentativa_em)
  where status = 'pendente';

-- ---------------------------------------------------------------------
-- 10. Financeiro
-- ---------------------------------------------------------------------
create table revenues (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id),
  deal_id       uuid references deals(id) on delete set null,
  contact_id    uuid references contacts(id) on delete set null,
  tipo          revenue_kind not null default 'unica',
  valor         numeric(14,2) not null,
  custo_direto  numeric(14,2) not null default 0,
  -- Competência (quando a receita é reconhecida), não caixa.
  reconhecida_em date not null,
  descricao     text,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on revenues (org_id, reconhecida_em) where deleted_at is null;
create index on revenues (contact_id);
create index on revenues (deal_id);

create table costs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references orgs(id),
  categoria    cost_category not null,
  centro_custo text,
  descricao    text,
  valor        numeric(14,2) not null,
  competencia  date not null,
  -- 'importado' vem do sync de mídia; 'manual' é lançado no admin.
  origem       text not null default 'manual' check (origem in ('manual','importado')),
  ref_externa  text,      -- id da linha de origem, para não duplicar no re-sync
  owner_id     uuid references profiles(id),   -- comissão atribuída a vendedor
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (org_id, origem, ref_externa)
);
create index on costs (org_id, competencia) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 11. Infraestrutura
-- ---------------------------------------------------------------------
-- Toda entrada externa passa por aqui ANTES de ser processada.
-- O unique em (provider, payload_hash) é o que torna a ingestão idempotente:
-- provider que reenvia o mesmo webhook colide e não duplica nada.
create table webhook_deliveries (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id),
  provider     text not null,      -- uazapi | waba | meta_leadgen | form | webhook
  external_id  text,
  payload_hash text not null,
  payload      jsonb not null,
  headers      jsonb,
  processado_em timestamptz,
  erro         text,
  created_at   timestamptz not null default now(),
  unique (provider, payload_hash)
);
create index webhook_nao_processados_idx on webhook_deliveries (created_at)
  where processado_em is null;

create table audit_log (
  id         bigserial primary key,
  org_id     uuid references orgs(id),
  actor_id   uuid references profiles(id),
  entidade   text not null,
  entidade_id uuid,
  acao       text not null,        -- create | update | delete | merge | login
  diff       jsonb,
  ip_hash    text,
  occurred_at timestamptz not null default now()
);
create index on audit_log (org_id, occurred_at desc);
create index on audit_log (entidade, entidade_id);

-- ---------------------------------------------------------------------
-- 12. Helpers de RLS
--
-- SECURITY DEFINER de propósito: uma policy de `profiles` que consultasse
-- `profiles` diretamente entraria em recursão infinita. A função roda com os
-- privilégios do dono e ignora RLS, quebrando o ciclo.
-- ---------------------------------------------------------------------
create or replace function app.current_org_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp as $$
    select org_id from public.profiles where id = auth.uid() and deleted_at is null
  $$;

create or replace function app.current_role() returns app_role
  language sql stable security definer set search_path = public, pg_temp as $$
    select role from public.profiles where id = auth.uid() and deleted_at is null
  $$;

create or replace function app.is_admin() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
    select coalesce(app.current_role() = 'admin', false)
  $$;

create or replace function app.is_gestor() returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
    select coalesce(app.current_role() in ('admin','gestor'), false)
  $$;

-- Donos que o usuário atual pode enxergar:
--   admin    -> todos da org
--   gestor   -> ele mesmo + membros dos times que ele gerencia
--   vendedor -> só ele mesmo
create or replace function app.visible_owner_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp as $$
    select p.id
    from public.profiles p
    where p.org_id = app.current_org_id()
      and (
        app.is_admin()
        or p.id = auth.uid()
        or exists (
          select 1
          from public.teams t
          join public.team_members tm on tm.team_id = t.id
          where t.gestor_id = auth.uid() and tm.profile_id = p.id
        )
      )
  $$;

-- ---------------------------------------------------------------------
-- 13. Triggers
-- ---------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
  language plpgsql as $$
  begin
    new.updated_at := now();
    return new;
  end;
  $$;

create trigger contacts_touch before update on contacts
  for each row execute function app.touch_updated_at();
create trigger deals_touch before update on deals
  for each row execute function app.touch_updated_at();

-- Registra a mudança de etapa e enfileira as conversões correspondentes.
-- As duas coisas acontecem na MESMA transação do UPDATE do deal: ou o deal
-- move e o evento é enfileirado, ou nada acontece.
create or replace function app.on_deal_stage_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare
    v_categoria stage_category;
    v_duracao   int;
    d           record;
  begin
    if new.stage_id is not distinct from old.stage_id then
      return new;
    end if;

    select categoria into v_categoria from stages where id = new.stage_id;
    v_duracao := greatest(0, extract(epoch from (now() - old.entrou_em))::int);

    insert into deal_stage_events (
      org_id, deal_id, from_stage_id, to_stage_id, to_categoria,
      changed_by, duracao_anterior_s
    ) values (
      new.org_id, new.id, old.stage_id, new.stage_id, v_categoria,
      auth.uid(), v_duracao
    );

    new.entrou_em := now();

    -- Fan-out para o outbox. O UNIQUE em (destination_id, dedupe_key) absorve
    -- o caso do deal que volta para uma etapa e avança de novo: o evento já
    -- foi contado uma vez e não é reenviado.
    for d in
      select cd.*
      from conversion_destinations cd
      where cd.org_id = new.org_id
        and cd.ativo
        and (cd.pipeline_id is null or cd.pipeline_id = new.pipeline_id)
        and (cd.stage_id = new.stage_id or cd.categoria = v_categoria)
    loop
      insert into conversion_events_outbox (
        org_id, deal_id, destination_id, event_name, valor, moeda, dedupe_key
      ) values (
        new.org_id, new.id, d.id, d.event_name,
        case d.valor_modo
          when 'deal' then new.valor
          when 'fixo' then d.valor_fixo
          else null
        end,
        new.moeda,
        new.id::text || ':' || d.event_name
      )
      on conflict (destination_id, dedupe_key) do nothing;
    end loop;

    return new;
  end;
  $$;

create trigger deals_stage_change before update of stage_id on deals
  for each row execute function app.on_deal_stage_change();

-- ---------------------------------------------------------------------
-- 14. RLS
--
-- Padrão em três camadas:
--   1. Isolamento de org  — todas as tabelas, sem exceção.
--   2. Escopo por dono    — entidades comerciais (deals, conversas, tarefas).
--   3. Escrita restrita   — tabelas de configuração são só de admin.
-- ---------------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'orgs','profiles','teams','team_members','user_devices','companies','contacts',
    'contact_identities','contact_merges','contact_companies','pipelines','stages',
    'loss_reasons','products','deals','deal_items','deal_stage_events','touchpoints',
    'attribution_snapshots','sites','channels','conversations','messages',
    'message_templates','quick_replies','conversation_events','tasks','task_reminders',
    'automations','automation_steps','automation_runs','automation_step_runs',
    'ad_accounts','ad_entities','ad_costs_daily','conversion_destinations',
    'conversion_events_outbox','revenues','costs','webhook_deliveries','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end
$rls$;

-- Camada 1: isolamento de org para as tabelas que só precisam disso.
do $orgonly$
declare t text;
begin
  foreach t in array array[
    'companies','contacts','contact_identities','contact_merges','pipelines','stages',
    'loss_reasons','products','deal_stage_events','touchpoints','attribution_snapshots',
    'sites','channels','message_templates','quick_replies','automations',
    'automation_runs','ad_accounts','ad_entities','ad_costs_daily',
    'conversion_destinations','conversion_events_outbox','revenues','costs','audit_log'
  ] loop
    execute format($p$
      create policy %I_org_select on %I for select
        using (org_id = app.current_org_id())
    $p$, t, t);
  end loop;
end
$orgonly$;

-- Escrita nas tabelas de configuração: só admin.
do $adminwrite$
declare t text;
begin
  foreach t in array array[
    'pipelines','stages','loss_reasons','products','sites','channels',
    'message_templates','automations','ad_accounts','conversion_destinations','costs'
  ] loop
    execute format($p$
      create policy %I_admin_write on %I for all
        using (org_id = app.current_org_id() and app.is_admin())
        with check (org_id = app.current_org_id() and app.is_admin())
    $p$, t, t);
  end loop;
end
$adminwrite$;

-- Contatos: qualquer um da org lê; vendedor edita os seus e os sem dono.
create policy contacts_write on contacts for all
  using (
    org_id = app.current_org_id()
    and (owner_id is null or owner_id in (select app.visible_owner_ids()))
  )
  with check (org_id = app.current_org_id());

-- Deals: escopo por dono. `owner_id is null` mantém a fila de leads sem dono
-- visível para todos — é dela que o vendedor puxa trabalho.
create policy deals_scope on deals for all
  using (
    org_id = app.current_org_id()
    and (owner_id is null or owner_id in (select app.visible_owner_ids()))
  )
  with check (org_id = app.current_org_id());

create policy deal_items_scope on deal_items for all
  using (exists (select 1 from deals d where d.id = deal_items.deal_id))
  with check (exists (select 1 from deals d where d.id = deal_items.deal_id));

create policy conversations_scope on conversations for all
  using (
    org_id = app.current_org_id()
    and (assigned_to is null or assigned_to in (select app.visible_owner_ids()))
  )
  with check (org_id = app.current_org_id());

-- Mensagens herdam a visibilidade da conversa. O EXISTS reaproveita a policy
-- de conversations em vez de repetir a regra.
create policy messages_scope on messages for all
  using (exists (select 1 from conversations c where c.id = messages.conversation_id))
  with check (exists (select 1 from conversations c where c.id = messages.conversation_id));

create policy conversation_events_scope on conversation_events for all
  using (exists (select 1 from conversations c where c.id = conversation_events.conversation_id))
  with check (exists (select 1 from conversations c where c.id = conversation_events.conversation_id));

create policy tasks_scope on tasks for all
  using (
    org_id = app.current_org_id()
    and owner_id in (select app.visible_owner_ids())
  )
  with check (org_id = app.current_org_id());

create policy task_reminders_scope on task_reminders for select
  using (exists (select 1 from tasks t where t.id = task_reminders.task_id));

create policy profiles_org on profiles for select
  using (org_id = app.current_org_id());
create policy profiles_self_update on profiles for update
  using (id = auth.uid() or app.is_admin())
  with check (id = auth.uid() or app.is_admin());

create policy orgs_self on orgs for select
  using (id = app.current_org_id());

create policy teams_org on teams for select using (org_id = app.current_org_id());
create policy teams_admin on teams for all
  using (org_id = app.current_org_id() and app.is_gestor())
  with check (org_id = app.current_org_id() and app.is_gestor());

create policy team_members_org on team_members for select
  using (exists (select 1 from teams t where t.id = team_members.team_id));

create policy contact_companies_org on contact_companies for all
  using (exists (select 1 from contacts c where c.id = contact_companies.contact_id))
  with check (exists (select 1 from contacts c where c.id = contact_companies.contact_id));

create policy automation_steps_org on automation_steps for all
  using (exists (select 1 from automations a where a.id = automation_steps.automation_id))
  with check (exists (select 1 from automations a where a.id = automation_steps.automation_id));

create policy automation_step_runs_org on automation_step_runs for select
  using (exists (select 1 from automation_runs r where r.id = automation_step_runs.run_id));

-- Dispositivos de push: cada um enxerga e gerencia apenas os seus.
create policy user_devices_self on user_devices for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and org_id = app.current_org_id());

-- webhook_deliveries não tem policy de leitura para usuário final: é tabela de
-- infraestrutura, acessada apenas pela service_role (que ignora RLS).

-- ---------------------------------------------------------------------
-- 15. Views de métrica
--
-- `security_invoker = true` é OBRIGATÓRIO. Sem ele, uma view em Postgres roda
-- com os privilégios do dono e IGNORA a RLS das tabelas de baixo — um vendedor
-- leria o funil inteiro da org através da view.
-- ---------------------------------------------------------------------

-- Primeira vez que cada deal alcançou cada categoria de etapa.
-- Usa MIN porque o que interessa é "chegou em SQL", não "voltou pra SQL".
create view v_deal_categoria_atingida with (security_invoker = true) as
  select org_id, deal_id, to_categoria as categoria, min(occurred_at) as atingida_em
  from deal_stage_events
  group by org_id, deal_id, to_categoria;

create view v_funil_mensal with (security_invoker = true) as
  select
    org_id,
    date_trunc('month', atingida_em)::date as mes,
    categoria,
    count(distinct deal_id) as deals
  from v_deal_categoria_atingida
  group by 1, 2, 3;

-- Custo de mídia agregado.
-- O filtro por nivel = 'campanha' NÃO é opcional: ad_costs_daily guarda a
-- mesma verba em campanha, conjunto e anúncio. Somar tudo triplica o custo.
create view v_midia_mensal with (security_invoker = true) as
  select
    org_id,
    date_trunc('month', data)::date as mes,
    sum(custo)      as custo,
    sum(cliques)    as cliques,
    sum(impressoes) as impressoes
  from ad_costs_daily
  where nivel = 'campanha'
  group by 1, 2;

-- Custo por etapa do funil: CPL, custo por MQL, por SQL, por reunião, por
-- orçamento — todos saem daqui, mudando só a categoria.
create view v_custo_por_etapa_mensal with (security_invoker = true) as
  select
    f.org_id,
    f.mes,
    f.categoria,
    f.deals,
    m.custo,
    case when f.deals > 0 then round(m.custo / f.deals, 2) end as custo_por_deal
  from v_funil_mensal f
  join v_midia_mensal m on m.org_id = f.org_id and m.mes = f.mes;

-- LTV por coorte de entrada do contato.
create view v_ltv_coorte with (security_invoker = true) as
  select
    c.org_id,
    date_trunc('month', c.created_at)::date as coorte,
    count(distinct c.id)                                   as contatos,
    coalesce(sum(r.valor), 0)                              as receita_total,
    case when count(distinct c.id) > 0
      then round(coalesce(sum(r.valor), 0) / count(distinct c.id), 2)
    end                                                    as ltv_medio
  from contacts c
  left join revenues r on r.contact_id = c.id and r.deleted_at is null
  where c.deleted_at is null
  group by 1, 2;

-- CAC: mídia + custo comercial dividido por clientes novos no mês.
-- "Cliente novo" = contato cujo PRIMEIRO deal ganho caiu naquele mês.
create view v_clientes_novos_mensal with (security_invoker = true) as
  select org_id, mes, count(*) as clientes_novos
  from (
    select d.org_id, d.contact_id, date_trunc('month', min(d.closed_at))::date as mes
    from deals d
    where d.status = 'ganho' and d.deleted_at is null
    group by d.org_id, d.contact_id
  ) primeiro_ganho
  group by org_id, mes;

create view v_cac_mensal with (security_invoker = true) as
  select
    n.org_id,
    n.mes,
    n.clientes_novos,
    coalesce(m.custo, 0)      as custo_midia,
    coalesce(cc.comercial, 0) as custo_comercial,
    case when n.clientes_novos > 0
      then round((coalesce(m.custo, 0) + coalesce(cc.comercial, 0)) / n.clientes_novos, 2)
    end as cac
  from v_clientes_novos_mensal n
  left join v_midia_mensal m on m.org_id = n.org_id and m.mes = n.mes
  left join (
    select org_id, date_trunc('month', competencia)::date as mes, sum(valor) as comercial
    from costs
    where categoria in ('comissao', 'folha') and deleted_at is null
    group by 1, 2
  ) cc on cc.org_id = n.org_id and cc.mes = n.mes;

-- Tempo médio em cada etapa, em horas. Base para achar o gargalo do funil.
create view v_tempo_por_etapa with (security_invoker = true) as
  select
    e.org_id,
    e.from_stage_id as stage_id,
    s.nome          as stage_nome,
    count(*)        as transicoes,
    round(avg(e.duracao_anterior_s) / 3600.0, 2)  as horas_media,
    round((percentile_cont(0.5) within group (order by e.duracao_anterior_s))::numeric / 3600.0, 2) as horas_mediana
  from deal_stage_events e
  join stages s on s.id = e.from_stage_id
  where e.from_stage_id is not null and e.duracao_anterior_s is not null
  group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- 16. DRE
--
-- Materializada porque cruza receita, custo direto e cinco categorias de custo
-- num período longo — caro demais para rodar a cada carregamento de tela.
-- ATENÇÃO: materialized view NÃO respeita RLS. Nunca exponha `mv_dre_mensal`
-- direto ao client; leia sempre pela view `v_dre_mensal` abaixo.
-- ---------------------------------------------------------------------
create materialized view mv_dre_mensal as
  with receita as (
    select org_id, date_trunc('month', reconhecida_em)::date as mes,
           sum(valor) as receita, sum(custo_direto) as custo_direto
    from revenues where deleted_at is null
    group by 1, 2
  ),
  despesa as (
    select org_id, date_trunc('month', competencia)::date as mes, categoria, sum(valor) as valor
    from costs where deleted_at is null
    group by 1, 2, 3
  )
  select
    coalesce(r.org_id, d.org_id)                       as org_id,
    coalesce(r.mes, d.mes)                             as mes,
    coalesce(r.receita, 0)                             as receita_bruta,
    coalesce(r.custo_direto, 0)                        as custo_direto,
    coalesce(sum(d.valor) filter (where d.categoria = 'midia'), 0)       as midia,
    coalesce(sum(d.valor) filter (where d.categoria = 'comissao'), 0)    as comissao,
    coalesce(sum(d.valor) filter (where d.categoria = 'folha'), 0)       as folha,
    coalesce(sum(d.valor) filter (where d.categoria = 'ferramentas'), 0) as ferramentas,
    coalesce(sum(d.valor) filter (where d.categoria = 'operacional'), 0) as operacional,
    coalesce(sum(d.valor) filter (where d.categoria = 'imposto'), 0)     as imposto,
    coalesce(r.receita, 0) - coalesce(r.custo_direto, 0) - coalesce(sum(d.valor), 0) as resultado
  from receita r
  full outer join despesa d on d.org_id = r.org_id and d.mes = r.mes
  group by 1, 2, r.receita, r.custo_direto;

create unique index on mv_dre_mensal (org_id, mes);

create view v_dre_mensal with (security_invoker = true) as
  select * from mv_dre_mensal where org_id = app.current_org_id();

-- Atualização agendada (Supabase). Concurrently exige o unique index acima.
-- select cron.schedule('dre-refresh', '0 4 * * *',
--   $cron$ refresh materialized view concurrently mv_dre_mensal $cron$);

-- ---------------------------------------------------------------------
-- 17. Filas (Supabase Queues / pgmq)
-- ---------------------------------------------------------------------
-- create extension if not exists pgmq;
-- select pgmq.create('q_outbound');     -- envio de mensagem com rate-limit
-- select pgmq.create('q_media');        -- download de mídia -> Storage
-- select pgmq.create('q_ads_events');   -- entrega de conversões (outbox)
-- select pgmq.create('q_automations');  -- passos de automação

-- #####################################################################
-- ## 20260901130000_ingestao.sql
-- #####################################################################

-- =====================================================================
-- 0002 · Ingestão de lead em transação única
--
-- Resolver contato, fundir duplicatas, decidir sobre o deal e distribuir para
-- um vendedor precisa acontecer de uma vez só. Feito em chamadas separadas
-- pela aplicação, dois leads simultâneos da mesma pessoa (formulário + WhatsApp
-- no mesmo segundo) criariam duas fichas — exatamente o problema que o CRM
-- existe para resolver.
--
-- Referência: docs/crm/02-ingestao-e-dedupe.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funde dois contatos: reaponta tudo para o vencedor e arquiva o perdedor.
-- Nunca apaga — fusão errada acontece (dois irmãos no mesmo telefone fixo)
-- e sem o snapshot não há como desfazer.
-- ---------------------------------------------------------------------
create or replace function app.fundir_contatos(
  p_vencedor uuid,
  p_perdedor uuid,
  p_motivo   text default 'fusão automática na ingestão'
) returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_snapshot jsonb;
begin
  if p_vencedor = p_perdedor then return; end if;

  select org_id, to_jsonb(c) into v_org, v_snapshot from contacts c where c.id = p_perdedor;
  if v_org is null then return; end if;

  -- Identidades do perdedor passam a apontar para o vencedor. ON CONFLICT
  -- cobre o caso de o vencedor já ter a mesma chave.
  update contact_identities set contact_id = p_vencedor
   where contact_id = p_perdedor
     and not exists (
       select 1 from contact_identities ci2
        where ci2.contact_id = p_vencedor
          and ci2.tipo = contact_identities.tipo
          and ci2.valor = contact_identities.valor
     );
  delete from contact_identities where contact_id = p_perdedor;

  update deals         set contact_id = p_vencedor where contact_id = p_perdedor;
  update conversations set contact_id = p_vencedor where contact_id = p_perdedor;
  update tasks         set contact_id = p_vencedor where contact_id = p_perdedor;
  update touchpoints   set contact_id = p_vencedor where contact_id = p_perdedor;
  update revenues      set contact_id = p_vencedor where contact_id = p_perdedor;

  update contact_companies set contact_id = p_vencedor
   where contact_id = p_perdedor
     and not exists (
       select 1 from contact_companies cc2
        where cc2.contact_id = p_vencedor and cc2.company_id = contact_companies.company_id
     );
  delete from contact_companies where contact_id = p_perdedor;

  -- Campo vazio no vencedor recebe o do perdedor. Campo preenchido não é
  -- sobrescrito: o dado mais antigo costuma ser o que o vendedor confirmou.
  update contacts v set
    nome        = coalesce(v.nome,        p.nome),
    email       = coalesce(v.email,       p.email),
    phone_e164  = coalesce(v.phone_e164,  p.phone_e164),
    documento   = coalesce(v.documento,   p.documento),
    owner_id    = coalesce(v.owner_id,    p.owner_id),
    first_source= coalesce(v.first_source,p.first_source),
    tags        = array(select distinct unnest(v.tags || p.tags)),
    custom      = p.custom || v.custom,
    opt_out     = v.opt_out or p.opt_out,
    updated_at  = now()
  from contacts p
  where v.id = p_vencedor and p.id = p_perdedor;

  update contacts set deleted_at = now() where id = p_perdedor;

  insert into contact_merges (org_id, vencedor_id, perdedor_id, motivo, snapshot)
  values (v_org, p_vencedor, p_perdedor, p_motivo, v_snapshot);
end;
$$;

-- ---------------------------------------------------------------------
-- Escolhe o dono do lead novo: vendedor ativo com menos deals abertos.
-- Empate resolve pelo id, para o resultado ser determinístico (e testável).
-- peso_distribuicao = 0 tira o vendedor do rodízio.
-- Retorna null quando não há ninguém — o lead cai na fila aberta, que a RLS
-- mostra para todos.
-- ---------------------------------------------------------------------
create or replace function app.escolher_dono(p_org_id uuid)
  returns uuid
  language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id
    from profiles p
    left join deals d
      on d.owner_id = p.id and d.status = 'aberto' and d.deleted_at is null
   where p.org_id = p_org_id
     and p.ativo
     and p.deleted_at is null
     and p.peso_distribuicao > 0
     and p.role in ('vendedor', 'gestor')
   group by p.id, p.peso_distribuicao
   order by (count(d.id)::numeric / p.peso_distribuicao) asc, p.id asc
   limit 1
$$;

-- ---------------------------------------------------------------------
-- Ingestão completa. Devolve o contact_id resolvido.
-- ---------------------------------------------------------------------
create or replace function ingerir_lead(
  p_org_id       uuid,
  p_delivery_id  uuid,
  p_pipeline_id  uuid,
  p_origem       lead_source,
  p_identidades  jsonb,           -- [{"tipo":"phone","valor":"+55..."}, ...]
  p_contato      jsonb,           -- {nome,email,phone_e164,custom}
  p_tracking     jsonb default '{}'::jsonb,
  p_anonymous_id text default null,
  p_suspeito     boolean default false
) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_contato_id   uuid;
  v_encontrados  uuid[];
  v_outro        uuid;
  v_pipeline_id  uuid := p_pipeline_id;
  v_stage_id     uuid;
  v_deal_id      uuid;
  v_janela       int;
  v_dono         uuid;
  v_ident        jsonb;
begin
  select dedupe_deal_janela_dias into v_janela from orgs where id = p_org_id;
  v_janela := coalesce(v_janela, 30);

  -- ---- 1. Quem já conhece essas chaves? ----------------------------------
  select array_agg(distinct ci.contact_id)
    into v_encontrados
    from contact_identities ci
    join contacts c on c.id = ci.contact_id and c.deleted_at is null
   where ci.org_id = p_org_id
     and (ci.tipo, ci.valor) in (
       select (x->>'tipo')::identity_kind, x->>'valor'
         from jsonb_array_elements(p_identidades) x
     );

  if v_encontrados is null or array_length(v_encontrados, 1) is null then
    insert into contacts (org_id, nome, email, phone_e164, first_source, custom)
    values (
      p_org_id,
      nullif(p_contato->>'nome',''),
      nullif(p_contato->>'email',''),
      nullif(p_contato->>'phone_e164',''),
      p_origem,
      coalesce(p_contato->'custom', '{}'::jsonb)
    )
    returning id into v_contato_id;
  else
    -- Mais de um contato = este payload uniu fichas que já existiam separadas.
    -- O mais antigo vence; os outros são fundidos nele.
    select c.id into v_contato_id
      from contacts c
     where c.id = any(v_encontrados)
     order by c.created_at asc, c.id asc
     limit 1;

    foreach v_outro in array v_encontrados loop
      if v_outro <> v_contato_id then
        perform app.fundir_contatos(v_contato_id, v_outro, 'chaves unidas por novo lead');
      end if;
    end loop;

    -- Completa o que estava faltando, sem sobrescrever o que já havia.
    update contacts set
      nome       = coalesce(nome,       nullif(p_contato->>'nome','')),
      email      = coalesce(email,      nullif(p_contato->>'email','')),
      phone_e164 = coalesce(phone_e164, nullif(p_contato->>'phone_e164','')),
      custom     = custom || coalesce(p_contato->'custom', '{}'::jsonb),
      updated_at = now()
    where id = v_contato_id;
  end if;

  -- ---- 2. Anexa as identidades novas -------------------------------------
  for v_ident in select * from jsonb_array_elements(p_identidades) loop
    insert into contact_identities (org_id, contact_id, tipo, valor, origem)
    values (p_org_id, v_contato_id, (v_ident->>'tipo')::identity_kind, v_ident->>'valor', p_origem)
    on conflict (org_id, tipo, valor) do nothing;
  end loop;

  -- ---- 3. Touchpoint + jornada anônima ------------------------------------
  insert into touchpoints (
    org_id, contact_id, anonymous_id, tipo,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id,
    gclid, gbraid, wbraid, fbclid, fbp, fbc, msclkid, ttclid, ctwa_clid,
    ad_external_id, landing_url, referrer
  ) values (
    p_org_id, v_contato_id, p_anonymous_id, 'form',
    p_tracking->>'utm_source', p_tracking->>'utm_medium', p_tracking->>'utm_campaign',
    p_tracking->>'utm_term', p_tracking->>'utm_content', p_tracking->>'utm_id',
    p_tracking->>'gclid', p_tracking->>'gbraid', p_tracking->>'wbraid',
    p_tracking->>'fbclid', p_tracking->>'fbp', p_tracking->>'fbc',
    p_tracking->>'msclkid', p_tracking->>'ttclid', p_tracking->>'ctwa_clid',
    p_tracking->>'ad_external_id', p_tracking->>'landing_url', p_tracking->>'referrer'
  );

  -- Tudo que a pessoa navegou antes de se identificar passa a pertencer a ela.
  -- É aqui que a visita da campanha de duas semanas atrás se cola ao lead.
  if p_anonymous_id is not null then
    update touchpoints
       set contact_id = v_contato_id
     where org_id = p_org_id
       and anonymous_id = p_anonymous_id
       and contact_id is null;
  end if;

  -- ---- 4. Deal: criar ou reconhecer que o lead voltou ---------------------
  if v_pipeline_id is null then
    select id into v_pipeline_id from pipelines
     where org_id = p_org_id and deleted_at is null
     order by padrao desc, ordem asc limit 1;
  end if;

  select id into v_deal_id
    from deals
   where org_id = p_org_id
     and contact_id = v_contato_id
     and pipeline_id = v_pipeline_id
     and status = 'aberto'
     and deleted_at is null
     and created_at > now() - make_interval(days => v_janela)
   order by created_at desc
   limit 1;

  if v_deal_id is null then
    select id into v_stage_id from stages
     where pipeline_id = v_pipeline_id and deleted_at is null
     order by ordem asc limit 1;

    v_dono := app.escolher_dono(p_org_id);

    insert into deals (org_id, contact_id, pipeline_id, stage_id, owner_id, titulo, origem)
    values (
      p_org_id, v_contato_id, v_pipeline_id, v_stage_id, v_dono,
      coalesce(nullif(p_contato->>'nome',''), 'Lead sem nome'), p_origem
    )
    returning id into v_deal_id;

    update contacts set owner_id = coalesce(owner_id, v_dono) where id = v_contato_id;

    -- O evento de entrada também vira linha no histórico: sem ele o funil
    -- não sabe que este deal existiu na primeira etapa.
    insert into deal_stage_events (org_id, deal_id, to_stage_id, to_categoria, automatico)
    select p_org_id, v_deal_id, v_stage_id, s.categoria, true from stages s where s.id = v_stage_id;
  else
    -- Já existe negociação aberta: NÃO cria outra. Registra a volta.
    insert into conversation_events (org_id, conversation_id, tipo, corpo)
    select p_org_id, cv.id, 'nota',
           'Este lead voltou por ' || p_origem::text || ' em ' ||
           to_char(now(), 'DD/MM/YYYY HH24:MI') || '.'
      from conversations cv
     where cv.contact_id = v_contato_id and cv.deleted_at is null
     order by cv.last_message_at desc nulls last
     limit 1;
  end if;

  update touchpoints set deal_id = v_deal_id
   where contact_id = v_contato_id and deal_id is null;

  if p_suspeito then
    update contacts set tags = array(select distinct unnest(tags || array['suspeito']))
     where id = v_contato_id;
  end if;

  update webhook_deliveries set processado_em = now() where id = p_delivery_id;

  return v_contato_id;
end;
$$;

comment on function ingerir_lead is
  'Ingestão de lead em transação única: resolve contato, funde duplicatas, grava origem e decide sobre o deal.';

-- #####################################################################
-- ## 20260901140000_agencia.sql
-- #####################################################################

-- =====================================================================
-- 0003 · Camada de agência: um banco, muitos clientes
--
-- Até aqui, `profiles.org_id` amarrava cada usuário a UMA organização e
-- `app.current_org_id()` devolvia só ela. Isso serve para o usuário do
-- cliente, mas impede que quem administra vários clientes enxergue mais de um.
--
-- Esta migration acrescenta o nível de cima — a agência — sem afrouxar nada:
-- o vendedor do cliente A continua sem alcançar uma única linha do cliente B.
--
-- Referência: docs/crm/01-modelo-de-dados.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estrutura
-- ---------------------------------------------------------------------
create table agencies (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table orgs     add column agency_id uuid references agencies(id);
alter table profiles add column agency_id uuid references agencies(id);

create index on orgs (agency_id) where deleted_at is null;
create index on profiles (agency_id) where deleted_at is null;

-- Usuário de agência não pertence a nenhum cliente específico.
alter table profiles alter column org_id drop not null;

alter table profiles add constraint profile_pertence_a_algum_lugar
  check (org_id is not null or agency_id is not null);

-- O papel novo. Comparado como texto nas funções abaixo, de propósito:
-- usar o literal do enum na mesma transação que o adiciona falha em Postgres.
alter type app_role add value if not exists 'agencia';

comment on table agencies is
  'Quem administra vários clientes. Uma org sem agency_id é operação independente.';

-- ---------------------------------------------------------------------
-- 2. O helper que substitui a regra de visibilidade
--
-- SECURITY DEFINER pelo mesmo motivo dos outros helpers: uma policy de
-- profiles que consultasse profiles entraria em recursão.
-- ---------------------------------------------------------------------
create or replace function app.orgs_visiveis() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp
as $$
  select o.id
    from public.orgs o
    join public.profiles p on p.id = auth.uid()
   where p.deleted_at is null
     and o.deleted_at is null
     and (
       -- usuário de agência enxerga todos os clientes DAQUELA agência
       (p.role::text = 'agencia' and p.agency_id is not null and o.agency_id = p.agency_id)
       -- todos os demais enxergam apenas a própria organização
       or o.id = p.org_id
     )
$$;

comment on function app.orgs_visiveis() is
  'Organizações que o usuário da sessão pode alcançar. Base de toda a RLS.';

-- `app.current_org_id()` continua existindo e é usada para decidir em qual org
-- uma linha nova nasce. Passa a devolver null para usuário de agência, que
-- precisa escolher o cliente na interface antes de criar qualquer coisa.

-- ---------------------------------------------------------------------
-- 3. Reescrita das policies
--
-- Troca mecânica de `org_id = app.current_org_id()` por
-- `org_id in (select app.orgs_visiveis())`. Feita pelos mesmos blocos DO que
-- geraram as policies originais, para não haver política escrita à mão que
-- destoe das outras.
-- ---------------------------------------------------------------------
do $orgonly$
declare t text;
begin
  foreach t in array array[
    'companies','contacts','contact_identities','contact_merges','pipelines','stages',
    'loss_reasons','products','deal_stage_events','touchpoints','attribution_snapshots',
    'sites','channels','message_templates','quick_replies','automations',
    'automation_runs','ad_accounts','ad_entities','ad_costs_daily',
    'conversion_destinations','conversion_events_outbox','revenues','costs','audit_log'
  ] loop
    execute format('drop policy if exists %I_org_select on %I', t, t);
    execute format($p$
      create policy %I_org_select on %I for select
        using (org_id in (select app.orgs_visiveis()))
    $p$, t, t);
  end loop;
end
$orgonly$;

do $adminwrite$
declare t text;
begin
  foreach t in array array[
    'pipelines','stages','loss_reasons','products','sites','channels',
    'message_templates','automations','ad_accounts','conversion_destinations','costs'
  ] loop
    execute format('drop policy if exists %I_admin_write on %I', t, t);
    execute format($p$
      create policy %I_admin_write on %I for all
        using (org_id in (select app.orgs_visiveis()) and app.is_admin())
        with check (org_id in (select app.orgs_visiveis()) and app.is_admin())
    $p$, t, t);
  end loop;
end
$adminwrite$;

-- Entidades com escopo por dono. `owner_id is null` continua visível para
-- todos da org: é a fila de leads sem dono.
drop policy if exists contacts_write on contacts;
create policy contacts_write on contacts for all
  using (
    org_id in (select app.orgs_visiveis())
    and (owner_id is null or owner_id in (select app.visible_owner_ids()))
  )
  with check (org_id in (select app.orgs_visiveis()));

drop policy if exists deals_scope on deals;
create policy deals_scope on deals for all
  using (
    org_id in (select app.orgs_visiveis())
    and (owner_id is null or owner_id in (select app.visible_owner_ids()))
  )
  with check (org_id in (select app.orgs_visiveis()));

drop policy if exists conversations_scope on conversations;
create policy conversations_scope on conversations for all
  using (
    org_id in (select app.orgs_visiveis())
    and (assigned_to is null or assigned_to in (select app.visible_owner_ids()))
  )
  with check (org_id in (select app.orgs_visiveis()));

drop policy if exists tasks_scope on tasks;
create policy tasks_scope on tasks for all
  using (
    org_id in (select app.orgs_visiveis())
    and owner_id in (select app.visible_owner_ids())
  )
  with check (org_id in (select app.orgs_visiveis()));

drop policy if exists orgs_self on orgs;
create policy orgs_self on orgs for select
  using (id in (select app.orgs_visiveis()));

drop policy if exists profiles_org on profiles;
create policy profiles_org on profiles for select
  using (
    org_id in (select app.orgs_visiveis())
    or (agency_id is not null and agency_id = (
          select p2.agency_id from profiles p2 where p2.id = auth.uid()
        ))
  );

drop policy if exists teams_org on teams;
create policy teams_org on teams for select
  using (org_id in (select app.orgs_visiveis()));

drop policy if exists teams_admin on teams;
create policy teams_admin on teams for all
  using (org_id in (select app.orgs_visiveis()) and app.is_gestor())
  with check (org_id in (select app.orgs_visiveis()) and app.is_gestor());

alter table agencies enable row level security;
alter table agencies force row level security;
create policy agencies_propria on agencies for select
  using (id = (select p.agency_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------
-- 4. `app.visible_owner_ids()` precisa acompanhar
--
-- A versão original limitava a busca a `app.current_org_id()`, que é null para
-- usuário de agência — ele não enxergaria dono nenhum e, por consequência,
-- nenhum deal. Agora percorre todas as organizações visíveis.
-- ---------------------------------------------------------------------
create or replace function app.visible_owner_ids() returns setof uuid
  language sql stable security definer set search_path = public, pg_temp
as $$
  select p.id
    from public.profiles p
   where p.org_id in (select app.orgs_visiveis())
     and (
       app.is_admin()
       -- Papel de QUEM CONSULTA, não da linha: o usuário de agência enxerga
       -- todos os donos dos clientes dele. Comparar `p.role` aqui seria
       -- perguntar se o *dono* é da agência, que não é a pergunta.
       or app.current_role()::text = 'agencia'
       or p.id = auth.uid()
       or exists (
         select 1
           from public.teams t
           join public.team_members tm on tm.team_id = t.id
          where t.gestor_id = auth.uid() and tm.profile_id = p.id
       )
     )
$$;

-- ---------------------------------------------------------------------
-- 5. Onboarding de cliente novo em uma chamada
-- ---------------------------------------------------------------------
create or replace function app.criar_cliente(
  p_agency_id uuid,
  p_nome      text,
  p_slug      text
) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  insert into orgs (nome, slug, agency_id)
  values (p_nome, p_slug, p_agency_id)
  returning id into v_org_id;

  -- Definida em supabase/seed.sql: funil, sete etapas e motivos de perda.
  perform app.semear_org(v_org_id);

  return v_org_id;
end;
$$;

comment on function app.criar_cliente(uuid, text, text) is
  'Cria um cliente já com funil e etapas prontos. Devolve o org_id.';

-- ---------------------------------------------------------------------
-- 6. Visão consolidada: uma linha por cliente
--
-- security_invoker = true é obrigatório. Sem ele a view roda com os
-- privilégios do dono e ignora a RLS — o usuário de um cliente leria os
-- números de todos os outros.
-- ---------------------------------------------------------------------
create or replace view v_agencia_resumo with (security_invoker = true) as
  select
    o.id                                   as org_id,
    o.nome                                 as cliente,
    o.agency_id,
    count(distinct d.id) filter (where d.status = 'aberto')                as deals_abertos,
    coalesce(sum(d.valor) filter (where d.status = 'aberto'), 0)           as valor_em_aberto,
    count(distinct d.id) filter (
      where d.status = 'ganho' and d.closed_at >= date_trunc('month', now())
    )                                                                     as ganhos_no_mes,
    count(distinct d.id) filter (
      where d.created_at >= date_trunc('month', now())
    )                                                                     as leads_no_mes,
    count(distinct c.id) filter (
      where c.status <> 'fechada' and c.assigned_to is null
    )                                                                     as conversas_sem_dono
  from orgs o
  left join deals d         on d.org_id = o.id and d.deleted_at is null
  left join conversations c on c.org_id = o.id and c.deleted_at is null
  where o.deleted_at is null
  group by o.id, o.nome, o.agency_id;

-- #####################################################################
-- ## seed.sql
-- #####################################################################

-- =====================================================================
-- Semente: funil padrão de uma nova organização.
--
-- Não é um script de uma vez só: `app.semear_org()` é chamada toda vez que
-- uma org nasce, para que ela já comece com funil, etapas e motivos de perda
-- utilizáveis. O gestor renomeia depois; a `categoria` é o que mantém os
-- relatórios funcionando mesmo com nomes trocados.
--
-- Aplicar:  psql "$DATABASE_URL" -f supabase/seed.sql
-- =====================================================================

create or replace function app.semear_org(p_org_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  v_pipeline_id uuid;
begin
  -- Não semeia duas vezes: rodar de novo é seguro.
  if exists (select 1 from pipelines where org_id = p_org_id and deleted_at is null) then
    return;
  end if;

  insert into pipelines (org_id, nome, padrao, ordem)
  values (p_org_id, 'Comercial', true, 0)
  returning id into v_pipeline_id;

  -- A coluna `categoria` liga o nome livre da etapa ao vocabulário fixo das
  -- métricas. Renomear "Qualificado" para "Contato feito" não quebra nada;
  -- mudar a categoria, sim.
  insert into stages (org_id, pipeline_id, nome, ordem, categoria, is_won, is_lost, sla_horas) values
    (p_org_id, v_pipeline_id, 'Novo lead',        1, 'lead',       false, false, 1),
    (p_org_id, v_pipeline_id, 'Em contato',       2, 'mql',        false, false, 24),
    (p_org_id, v_pipeline_id, 'Qualificado',      3, 'sql',        false, false, 48),
    (p_org_id, v_pipeline_id, 'Reunião agendada', 4, 'reuniao',    false, false, null),
    (p_org_id, v_pipeline_id, 'Orçamento enviado',5, 'orcamento',  false, false, 72),
    (p_org_id, v_pipeline_id, 'Ganho',            6, 'fechamento', true,  false, null),
    (p_org_id, v_pipeline_id, 'Perdido',          7, 'fechamento', false, true,  null);

  insert into loss_reasons (org_id, nome) values
    (p_org_id, 'Preço acima do orçamento'),
    (p_org_id, 'Sem retorno / sumiu'),
    (p_org_id, 'Fechou com concorrente'),
    (p_org_id, 'Fora do perfil'),
    (p_org_id, 'Sem verba no momento'),
    (p_org_id, 'Comprou depois / recontatar');
end;
$$;

comment on function app.semear_org(uuid) is
  'Cria funil, etapas e motivos de perda padrão para uma org nova. Idempotente.';

-- ---------------------------------------------------------------------
-- Ambiente local: uma org de demonstração para desenvolver contra dados
-- reais de estrutura. NÃO roda em produção — ver a guarda abaixo.
-- ---------------------------------------------------------------------
do $demo$
declare
  v_org uuid := '00000000-0000-4000-8000-000000000001';
begin
  if current_setting('app.ambiente', true) is distinct from 'local' then
    raise notice 'Semente de demonstração ignorada (defina app.ambiente=local para criá-la).';
    return;
  end if;

  insert into orgs (id, nome, slug)
  values (v_org, 'Organização de teste', 'teste')
  on conflict (id) do nothing;

  perform app.semear_org(v_org);
  raise notice 'Org de demonstração pronta: %', v_org;
end
$demo$;
