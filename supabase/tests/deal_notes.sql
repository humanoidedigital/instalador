-- =====================================================================
-- Teste: anotações da negociação e escrita em empresas
--
--   psql -d crmtest -f todas as migrations
--   psql -d crmtest -f supabase/tests/deal_notes.sql
--
-- Roda como `authenticated`, não como superusuário — superusuário ignora
-- RLS e faria qualquer teste passar.
-- =====================================================================

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

do $cenario$
declare
  v_ag uuid; v_a uuid; v_b uuid;
begin
  insert into agencies (nome, slug) values ('Agência','ag') returning id into v_ag;
  v_a := app.criar_cliente(v_ag, 'Cliente A', 'cliente-a');
  v_b := app.criar_cliente(v_ag, 'Cliente B', 'cliente-b');

  insert into auth.users (id) values
    ('22222222-0000-4000-8000-00000000000a'),
    ('22222222-0000-4000-8000-00000000000b');

  insert into profiles (id, org_id, agency_id, nome, email, role) values
    ('22222222-0000-4000-8000-00000000000a', v_a, null, 'Ana',   'ana@a.com',   'vendedor'),
    ('22222222-0000-4000-8000-00000000000b', v_b, null, 'Bruno', 'bruno@b.com', 'vendedor');

  insert into contacts (org_id, nome) values (v_a,'Lead do A'), (v_b,'Lead do B');

  insert into deals (org_id, contact_id, pipeline_id, stage_id, owner_id, titulo, valor)
  select c.org_id, c.id, p.id, s.id,
         case c.org_id when v_a then '22222222-0000-4000-8000-00000000000a'::uuid
                                else '22222222-0000-4000-8000-00000000000b'::uuid end,
         c.nome, 1000
    from contacts c
    join pipelines p on p.org_id = c.org_id
    join stages s on s.pipeline_id = p.id and s.ordem = 1;
end
$cenario$;

do $papel$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$papel$;
grant usage on schema auth to authenticated;

create temp table resultado (nome text, esperado text, obtido text, passou boolean);

create or replace function pg_temp.checar(p_nome text, p_esperado text, p_obtido text)
  returns void language plpgsql as $$
begin
  insert into resultado values (p_nome, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
end;
$$;

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

do $assercoes$
declare
  v_deal_a uuid; v_deal_b uuid; v_org_a uuid; v_org_b uuid;
  v_erro text;
begin
  select d.id, d.org_id into v_deal_a, v_org_a from deals d join orgs o on o.id=d.org_id where o.slug='cliente-a';
  select d.id, d.org_id into v_deal_b, v_org_b from deals d join orgs o on o.id=d.org_id where o.slug='cliente-b';

  -- Ana escreve na negociação dela
  perform pg_temp.como('22222222-0000-4000-8000-00000000000a', format(
    $q$insert into deal_notes (org_id, deal_id, autor_id, corpo)
       values (%L, %L, %L, 'Ligou, pediu proposta.') returning 'ok'$q$,
    v_org_a, v_deal_a, '22222222-0000-4000-8000-00000000000a'));

  perform pg_temp.checar('vendedor grava anotação na própria negociação', '1',
    (select count(*)::text from deal_notes where deal_id = v_deal_a));

  -- Bruno não enxerga a anotação da Ana
  perform pg_temp.checar('anotação do cliente A é invisível para o cliente B', '0',
    pg_temp.como('22222222-0000-4000-8000-00000000000b',
      $q$select count(*)::text from deal_notes$q$));

  -- Bruno não grava na negociação do A
  begin
    perform pg_temp.como('22222222-0000-4000-8000-00000000000b', format(
      $q$insert into deal_notes (org_id, deal_id, autor_id, corpo)
         values (%L, %L, %L, 'invasao') returning 'ok'$q$,
      v_org_a, v_deal_a, '22222222-0000-4000-8000-00000000000b'));
    v_erro := 'GRAVOU (falha grave)';
  exception when others then
    v_erro := 'bloqueado';
  end;
  perform set_config('role', 'none', true);
  perform pg_temp.checar('vendedor do B não anota na negociação do A', 'bloqueado', v_erro);

  -- Ninguém assina com o nome de outro
  begin
    perform pg_temp.como('22222222-0000-4000-8000-00000000000a', format(
      $q$insert into deal_notes (org_id, deal_id, autor_id, corpo)
         values (%L, %L, %L, 'assinada pelo Bruno') returning 'ok'$q$,
      v_org_a, v_deal_a, '22222222-0000-4000-8000-00000000000b'));
    v_erro := 'GRAVOU (falha grave)';
  exception when others then
    v_erro := 'bloqueado';
  end;
  perform set_config('role', 'none', true);
  perform pg_temp.checar('ninguém assina anotação no nome de outro', 'bloqueado', v_erro);

  -- Anotação vazia é recusada pelo CHECK
  begin
    perform pg_temp.como('22222222-0000-4000-8000-00000000000a', format(
      $q$insert into deal_notes (org_id, deal_id, autor_id, corpo)
         values (%L, %L, %L, '   ') returning 'ok'$q$,
      v_org_a, v_deal_a, '22222222-0000-4000-8000-00000000000a'));
    v_erro := 'ACEITOU (falha)';
  exception when others then
    v_erro := 'recusado';
  end;
  perform set_config('role', 'none', true);
  perform pg_temp.checar('anotação em branco é recusada', 'recusado', v_erro);

  -- Empresas: agora dá para cadastrar
  perform pg_temp.como('22222222-0000-4000-8000-00000000000a', format(
    $q$insert into companies (org_id, nome) values (%L, 'Padaria do Zé') returning 'ok'$q$, v_org_a));

  perform pg_temp.checar('vendedor cadastra empresa na própria org', 'Padaria do Zé',
    pg_temp.como('22222222-0000-4000-8000-00000000000a',
      $q$select string_agg(nome, ', ') from companies$q$));

  perform pg_temp.checar('empresa do A é invisível para o B', '(nenhum)',
    pg_temp.como('22222222-0000-4000-8000-00000000000b',
      $q$select coalesce(string_agg(nome, ', '), '(nenhum)') from companies$q$));

  -- updated_at acompanha a edição.
  --
  -- Comparar `updated_at > created_at` NÃO serve: `now()` é constante dentro
  -- da transação, então os dois nascem iguais e o teste passaria (ou falharia)
  -- sem dizer nada sobre o gatilho. Aqui envelhecemos a linha à força, com o
  -- gatilho desligado, e só então editamos: se `updated_at` voltar para o
  -- presente, foi o gatilho que a moveu.
  alter table companies disable trigger companies_touch;
  update companies set updated_at = timestamptz '2020-01-01' where nome = 'Padaria do Zé';
  alter table companies enable trigger companies_touch;

  update companies set nome = 'Padaria do Zé Ltda' where nome = 'Padaria do Zé';

  perform pg_temp.checar('gatilho traz updated_at da empresa para o presente', 'atualizou',
    (select case when updated_at > timestamptz '2020-01-02' then 'atualizou' else 'PARADO EM 2020' end
       from companies where nome = 'Padaria do Zé Ltda'));
end
$assercoes$;

\set QUIET off
\echo ''
\echo '=============================================================='
\echo ' ANOTAÇÕES DA NEGOCIAÇÃO E ESCRITA EM EMPRESAS'
\echo '=============================================================='
select case when passou then '  ok  ' else 'FALHOU' end as status,
       nome as verificacao,
       case when passou then '' else esperado || '  ->  ' || obtido end as divergencia
  from resultado;

select count(*) filter (where passou) || ' passaram · ' ||
       count(*) filter (where not passou) || ' falharam' as resultado
  from resultado;

do $veredito$
declare v int;
begin
  select count(*) into v from resultado where not passou;
  if v > 0 then raise exception '% verificação(ões) falharam', v; end if;
end
$veredito$;
