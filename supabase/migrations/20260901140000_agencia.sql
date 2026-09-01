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
-- 5. Funil padrão de um cliente novo
--
-- Precisa existir ANTES de app.criar_cliente(), que a chama, e antes da
-- migration de permissões, que revoga o acesso a ela.
-- ---------------------------------------------------------------------
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
-- 6. Onboarding de cliente novo em uma chamada
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
-- 7. Visão consolidada: uma linha por cliente
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
