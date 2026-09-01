-- =====================================================================
-- 0004 · Fechar quem pode executar as funções privilegiadas
--
-- Toda função SECURITY DEFINER roda com os privilégios do dono do banco e
-- IGNORA a RLS. E o Postgres, por padrão, concede EXECUTE a PUBLIC em função
-- nova. As duas coisas juntas abrem um buraco:
--
--   ingerir_lead(p_org_id, ...)      -> usuário do cliente A passaria o
--                                       org_id do cliente B e injetaria leads lá
--   app.fundir_contatos(a, b)        -> fundiria contatos de clientes distintos,
--                                       misturando as bases
--   app.criar_cliente(agency, ...)   -> criaria clientes em qualquer agência
--   app.semear_org(org)              -> mexeria no funil de qualquer cliente
--
-- A RLS não protege contra isso: essas funções passam por cima dela por
-- construção. A defesa é privilégio de execução.
--
-- Regra: função que ESCREVE com privilégio elevado é exclusiva do
-- `service_role` (as Edge Functions). Função que só RESPONDE quem-vê-o-quê
-- precisa continuar executável pelo usuário comum, senão as próprias policies
-- param de funcionar.
-- =====================================================================

do $permissoes$
declare
  v_privilegiadas text[] := array[
    'public.ingerir_lead(uuid,uuid,uuid,lead_source,jsonb,jsonb,jsonb,text,boolean)',
    'app.criar_cliente(uuid,text,text)',
    'app.fundir_contatos(uuid,uuid,text)',
    'app.semear_org(uuid)'
  ];
  -- Helpers de leitura usados dentro das policies. Sem EXECUTE para o usuário
  -- comum, toda consulta com RLS falharia.
  v_helpers text[] := array[
    'app.orgs_visiveis()',
    'app.visible_owner_ids()',
    'app.current_org_id()',
    'app.current_role()',
    'app.is_admin()',
    'app.is_gestor()'
  ];
  f text;
  r text;
begin
  foreach f in array v_privilegiadas loop
    execute format('revoke all on function %s from public', f);
    foreach r in array array['anon','authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', f, r);
      end if;
    end loop;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;

  foreach f in array v_helpers loop
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end
$permissoes$;

-- ---------------------------------------------------------------------
-- Privilégios de tabela
--
-- No Supabase o PostgREST acessa o banco como `authenticated` (ou `anon`).
-- A RLS decide quais LINHAS, mas o privilégio de tabela decide se a consulta
-- chega a rodar. `anon` fica de fora de propósito: o formulário público entra
-- por Edge Function com service_role, nunca direto pelo PostgREST.
-- ---------------------------------------------------------------------
do $tabelas$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public, app to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant usage, select on all sequences in schema public to authenticated;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public, app to service_role;
    grant all on all tables in schema public to service_role;
    grant usage, select on all sequences in schema public to service_role;
  end if;
end
$tabelas$;

-- `webhook_deliveries` é tabela de infraestrutura: guarda o payload cru de
-- todo webhook, inclusive dados de outros clientes antes de serem separados.
-- Não tem policy de leitura e não deve ser alcançável pelo usuário final.
do $infra$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table webhook_deliveries from authenticated;
  end if;
end
$infra$;
