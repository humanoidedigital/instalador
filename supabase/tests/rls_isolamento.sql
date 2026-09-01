-- =====================================================================
-- Teste de isolamento entre clientes
--
-- Roda como usuário REAL (papel `authenticated`, sem superusuário), porque
-- superusuário ignora RLS e faria qualquer teste passar.
--
--   createdb crmtest
--   psql -d crmtest -f supabase/migrations/20260901120000_init.sql
--   psql -d crmtest -f supabase/migrations/20260901130000_ingestao.sql
--   psql -d crmtest -f supabase/migrations/20260901140000_agencia.sql
--   psql -d crmtest -f supabase/seed.sql
--   psql -d crmtest -f supabase/tests/rls_isolamento.sql
--
-- Sai com a contagem de aprovados/reprovados no fim.
-- =====================================================================

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

-- ---------------------------------------------------------------------
-- Cenário: duas agências concorrentes, três clientes, quatro usuários.
-- ---------------------------------------------------------------------
do $cenario$
declare
  v_ag1 uuid; v_ag2 uuid;
  v_a uuid; v_b uuid; v_r uuid;
begin
  insert into agencies (nome, slug) values ('Minha Agência','minha-ag') returning id into v_ag1;
  insert into agencies (nome, slug) values ('Agência Rival','rival')     returning id into v_ag2;

  v_a := app.criar_cliente(v_ag1, 'Cliente A', 'cliente-a');
  v_b := app.criar_cliente(v_ag1, 'Cliente B', 'cliente-b');
  v_r := app.criar_cliente(v_ag2, 'Cliente Rival', 'cliente-r');

  insert into auth.users (id) values
    ('11111111-0000-4000-8000-00000000000a'),
    ('11111111-0000-4000-8000-00000000000b'),
    ('11111111-0000-4000-8000-00000000000c'),
    ('11111111-0000-4000-8000-00000000000d');

  insert into profiles (id, org_id, agency_id, nome, email, role) values
    ('11111111-0000-4000-8000-00000000000a', v_a,  null,  'Ana',   'ana@a.com',    'vendedor'),
    ('11111111-0000-4000-8000-00000000000b', v_b,  null,  'Bruno', 'bruno@b.com',  'vendedor'),
    ('11111111-0000-4000-8000-00000000000c', null, v_ag1, 'Gestor','gestor@ag.com','agencia'),
    ('11111111-0000-4000-8000-00000000000d', null, v_ag2, 'Rival', 'rival@ag.com', 'agencia');

  -- Um lead com dono em cada cliente.
  insert into contacts (org_id, nome) values (v_a,'Lead do A'), (v_b,'Lead do B'), (v_r,'Lead do Rival');

  insert into deals (org_id, contact_id, pipeline_id, stage_id, owner_id, titulo, valor)
  select c.org_id, c.id, p.id, s.id,
         case c.org_id
           when v_a then '11111111-0000-4000-8000-00000000000a'::uuid
           when v_b then '11111111-0000-4000-8000-00000000000b'::uuid
         end,
         c.nome, 1000
    from contacts c
    join pipelines p on p.org_id = c.org_id
    join stages s on s.pipeline_id = p.id and s.ordem = 1;
end
$cenario$;

-- Papel da aplicação. Não é superusuário, então a RLS vale para ele.
do $papel$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$papel$;

-- Os privilégios reais vêm da migration 0004. Aqui só garantimos o acesso
-- ao schema auth, que no Supabase já vem concedido.
grant usage on schema auth to authenticated;

-- ---------------------------------------------------------------------
-- Ferramenta de asserção
-- ---------------------------------------------------------------------
create temp table resultado (nome text, esperado text, obtido text, passou boolean);

create or replace function pg_temp.checar(p_nome text, p_esperado text, p_obtido text)
  returns void language plpgsql as $$
begin
  insert into resultado values (p_nome, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
end;
$$;

-- Executa uma consulta sob a identidade de um usuário e devolve o resultado
-- como texto. É aqui que a sessão real é simulada.
create or replace function pg_temp.como(p_usuario uuid, p_sql text)
  returns text language plpgsql as $$
declare v_out text;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', coalesce(p_usuario::text, ''), true);
  execute p_sql into v_out;
  perform set_config('role', 'none', true);
  return coalesce(v_out, '(nenhum)');
end;
$$;

-- ---------------------------------------------------------------------
-- Asserções
-- ---------------------------------------------------------------------
do $assercoes$
declare
  v_org_b uuid;
  v_bloqueado boolean := false;
  v_fn_bloqueada boolean := false;
begin
  perform pg_temp.checar('vendedor do A vê apenas o deal dele', 'Lead do A',
    pg_temp.como('11111111-0000-4000-8000-00000000000a',
      $q$select coalesce(string_agg(titulo, ', ' order by titulo), '(nenhum)') from deals$q$));

  perform pg_temp.checar('vendedor do A não alcança contato do B', '1',
    pg_temp.como('11111111-0000-4000-8000-00000000000a',
      $q$select count(*)::text from contacts$q$));

  perform pg_temp.checar('vendedor do A enxerga uma organização só', '1',
    pg_temp.como('11111111-0000-4000-8000-00000000000a',
      $q$select count(*)::text from orgs$q$));

  perform pg_temp.checar('vendedor do B vê apenas o deal dele', 'Lead do B',
    pg_temp.como('11111111-0000-4000-8000-00000000000b',
      $q$select coalesce(string_agg(titulo, ', ' order by titulo), '(nenhum)') from deals$q$));

  perform pg_temp.checar('agência vê os dois clientes dela', 'Lead do A, Lead do B',
    pg_temp.como('11111111-0000-4000-8000-00000000000c',
      $q$select coalesce(string_agg(titulo, ', ' order by titulo), '(nenhum)') from deals$q$));

  perform pg_temp.checar('agência NÃO vê o cliente da concorrente', '2',
    pg_temp.como('11111111-0000-4000-8000-00000000000c',
      $q$select count(*)::text from orgs$q$));

  perform pg_temp.checar('painel consolidado traz os dois clientes com os valores certos',
    'Cliente A:1:1000.00, Cliente B:1:1000.00',
    pg_temp.como('11111111-0000-4000-8000-00000000000c',
      $q$select string_agg(cliente || ':' || deals_abertos || ':' || valor_em_aberto, ', ' order by cliente)
           from v_agencia_resumo$q$));

  perform pg_temp.checar('agência rival vê apenas o cliente dela', 'Lead do Rival',
    pg_temp.como('11111111-0000-4000-8000-00000000000d',
      $q$select coalesce(string_agg(titulo, ', ' order by titulo), '(nenhum)') from deals$q$));

  perform pg_temp.checar('sessão sem login não vê nada', '(nenhum)',
    pg_temp.como(null,
      $q$select coalesce(string_agg(titulo, ', '), '(nenhum)') from deals$q$));

  perform pg_temp.checar('cliente novo já nasce com as 7 etapas do funil', '7',
    pg_temp.como('11111111-0000-4000-8000-00000000000a',
      $q$select count(*)::text from stages$q$));

  -- ESCRITA CRUZADA
  -- O id da org B é lido como superusuário e passado literal. Escrever
  -- `insert ... select from orgs where slug='cliente-b'` NÃO serviria: como o
  -- vendedor do A não enxerga aquela org, o select devolveria vazio e o insert
  -- gravaria zero linhas em silêncio — o teste passaria sem testar nada.
  select id into v_org_b from orgs where slug = 'cliente-b';
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000a', true);
    execute format('insert into contacts (org_id, nome) values (%L, %L)', v_org_b, 'invasao');
  exception when others then
    v_bloqueado := true;
  end;
  perform set_config('role', 'none', true);

  perform pg_temp.checar('vendedor do A é impedido de gravar na org do B',
    'bloqueado', case when v_bloqueado then 'bloqueado' else 'GRAVOU (falha grave)' end);

  -- FUNÇÃO PRIVILEGIADA
  -- ingerir_lead é SECURITY DEFINER: passa por cima da RLS por construção.
  -- Se o usuário comum puder chamá-la, ele injeta lead em qualquer cliente
  -- só trocando o org_id. A defesa não é RLS, é privilégio de execução.
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-00000000000a', true);
    execute format(
      'select ingerir_lead(%L, null, null, %L, %L::jsonb, %L::jsonb)',
      v_org_b, 'site', '[{"tipo":"email","valor":"x@y.com"}]', '{"nome":"injetado"}');
    v_fn_bloqueada := false;
  exception when others then
    v_fn_bloqueada := true;
  end;
  perform set_config('role', 'none', true);

  perform pg_temp.checar('usuário comum não executa ingerir_lead',
    'bloqueado', case when v_fn_bloqueada then 'bloqueado' else 'EXECUTOU (falha grave)' end);

  perform pg_temp.checar('usuário comum não lê webhook_deliveries', 'bloqueado',
    pg_temp.como('11111111-0000-4000-8000-00000000000a',
      $q$select case when has_table_privilege('authenticated','webhook_deliveries','select')
                     then 'LE (falha grave)' else 'bloqueado' end$q$));

  perform pg_temp.checar('nenhuma linha de invasão ficou no banco', '0',
    (select count(*)::text from contacts where nome = 'invasao'));
end
$assercoes$;

-- ---------------------------------------------------------------------
-- Relatório
-- ---------------------------------------------------------------------
\set QUIET off
\echo ''
\echo '=============================================================='
\echo ' ISOLAMENTO ENTRE CLIENTES'
\echo '=============================================================='
select case when passou then '  ok  ' else 'FALHOU' end as status,
       nome as verificacao,
       case when passou then '' else esperado || '  ->  ' || obtido end as divergencia
  from resultado;

select count(*) filter (where passou) || ' passaram · ' ||
       count(*) filter (where not passou) || ' falharam' as "resultado"
  from resultado;

do $veredito$
declare v int;
begin
  select count(*) into v from resultado where not passou;
  if v > 0 then
    raise exception 'ISOLAMENTO QUEBRADO: % verificação(ões) falharam', v;
  end if;
end
$veredito$;
