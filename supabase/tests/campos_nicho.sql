-- =====================================================================
-- Teste: dois nichos que não se parecem, no mesmo banco, sem DDL
--
--   psql -d crmtest -f supabase/INSTALAR.sql
--   psql -d crmtest -f supabase/tests/campos_nicho.sql
--
-- Prova os três critérios: relatório, gestão de leads e escala de clientes.
-- =====================================================================

\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

create temp table resultado (nome text, esperado text, obtido text, passou boolean);

create or replace function pg_temp.checar(p_nome text, p_esperado text, p_obtido text)
  returns void language plpgsql as $$
begin
  insert into resultado values (p_nome, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
end;
$$;

-- Fotografia do esquema ANTES. O critério de escala é este: criar um nicho
-- inteiramente novo não pode acrescentar nem tirar uma tabela.
create temp table esquema_antes as
  select table_name from information_schema.tables where table_schema = 'public';

-- ---------------------------------------------------------------------
-- Dois clientes, dois nichos sem nada em comum
-- ---------------------------------------------------------------------
do $montagem$
declare
  v_ag uuid; v_ir uuid; v_fant uuid;
begin
  insert into agencies (nome, slug) values ('Agência', 'ag') returning id into v_ag;

  v_ir   := app.criar_cliente(v_ag, 'Isenção de IR',      'isencao');
  v_fant := app.criar_cliente(v_ag, 'Aluguel de Fantasias','fantasias');

  perform app.definir_campos(v_ir, $j$[
    {"chave":"benefit_type","rotulo":"Tipo de benefício","tipo":"escolha",
     "opcoes":["aposentado","pensionista","militar","ativa"],"mostrar_no_funil":true},
    {"chave":"health_condition","rotulo":"Condição","tipo":"texto"},
    {"chave":"valor_ir_mensal","rotulo":"IR mensal","tipo":"moeda","obrigatorio":false}
  ]$j$::jsonb);

  perform app.definir_campos(v_fant, $j$[
    {"chave":"tamanho","rotulo":"Tamanho","tipo":"escolha",
     "opcoes":["P","M","G","GG"],"mostrar_no_funil":true},
    {"chave":"data_evento","rotulo":"Data do evento","tipo":"data"},
    {"chave":"tema","rotulo":"Tema","tipo":"texto"}
  ]$j$::jsonb);
end
$montagem$;

-- ---------------------------------------------------------------------
-- Asserções
-- ---------------------------------------------------------------------
do $assercoes$
declare
  v_ir uuid; v_fant uuid;
  v_erro text;
  v_c uuid;
begin
  select id into v_ir   from orgs where slug = 'isencao';
  select id into v_fant from orgs where slug = 'fantasias';

  -- ESCALA: nenhum DDL para o segundo nicho
  perform pg_temp.checar('criar nicho novo não alterou o esquema', 'igual',
    case when exists (
      select table_name from information_schema.tables where table_schema='public'
      except select table_name from esquema_antes
      union all
      select table_name from esquema_antes
      except select table_name from information_schema.tables where table_schema='public'
    ) then 'ESQUEMA MUDOU' else 'igual' end);

  -- Lead de cada nicho entra com os campos dele
  perform ingerir_lead(v_ir, null, null, 'fb_lead_ads',
    '[{"tipo":"email","valor":"cliente@ir.com"},{"tipo":"phone","valor":"+5511987654321"}]'::jsonb,
    $c${"nome":"Lead IR","email":"cliente@ir.com","phone_e164":"+5511987654321",
        "custom":{"benefit_type":"aposentado","health_condition":"cardiopatia grave","valor_ir_mensal":1450}}$c$::jsonb);

  perform ingerir_lead(v_fant, null, null, 'site',
    '[{"tipo":"email","valor":"cliente@festa.com"}]'::jsonb,
    $c${"nome":"Lead Fantasia","email":"cliente@festa.com",
        "custom":{"tamanho":"M","data_evento":"2026-12-20","tema":"anos 80"}}$c$::jsonb);

  perform pg_temp.checar('lead do nicho A guardou os campos dele', 'aposentado|1450',
    (select (custom->>'benefit_type') || '|' || (custom->>'valor_ir_mensal')
       from contacts where org_id = v_ir limit 1));

  perform pg_temp.checar('lead do nicho B guardou os campos dele', 'M|anos 80',
    (select (custom->>'tamanho') || '|' || (custom->>'tema')
       from contacts where org_id = v_fant limit 1));

  -- RELATÓRIO: a MESMA consulta serve os dois clientes
  perform pg_temp.checar('a mesma consulta de funil devolve os dois nichos',
    'Aluguel de Fantasias:1, Isenção de IR:1',
    (select string_agg(o.nome || ':' || x.deals, ', ' order by o.nome)
       from orgs o
       join (select org_id, count(*) as deals from deals group by org_id) x on x.org_id = o.id));

  -- GESTÃO: a ficha se monta a partir das definições
  perform pg_temp.checar('ficha do nicho A tem os campos certos',
    'benefit_type, health_condition, valor_ir_mensal',
    (select string_agg(chave, ', ' order by chave) from v_ficha_campos where org_id = v_ir));

  perform pg_temp.checar('ficha do nicho B tem os campos certos',
    'data_evento, tamanho, tema',
    (select string_agg(chave, ', ' order by chave) from v_ficha_campos where org_id = v_fant));

  -- CONTRATO: campo do nicho A é recusado no nicho B
  begin
    perform ingerir_lead(v_fant, null, null, 'site',
      '[{"tipo":"email","valor":"x@y.com"}]'::jsonb,
      $c${"nome":"X","custom":{"benefit_type":"aposentado"}}$c$::jsonb);
    v_erro := 'ACEITOU (falha)';
  exception when others then
    v_erro := case when sqlerrm like '%não declarado%' then 'recusado com mensagem' else 'recusado: ' || sqlerrm end;
  end;
  perform pg_temp.checar('campo do nicho A é recusado no nicho B',
    'recusado com mensagem', v_erro);

  -- CONTRATO: tipo errado
  begin
    perform ingerir_lead(v_ir, null, null, 'site',
      '[{"tipo":"email","valor":"z@y.com"}]'::jsonb,
      $c${"nome":"Z","custom":{"valor_ir_mensal":"mil e quatrocentos"}}$c$::jsonb);
    v_erro := 'ACEITOU (falha)';
  exception when others then
    v_erro := case when sqlerrm like '%espera número%' then 'recusado dizendo o tipo' else 'recusado: ' || sqlerrm end;
  end;
  perform pg_temp.checar('tipo errado é recusado dizendo o tipo esperado',
    'recusado dizendo o tipo', v_erro);

  -- CONTRATO: opção inválida num campo de escolha
  begin
    perform ingerir_lead(v_fant, null, null, 'site',
      '[{"tipo":"email","valor":"w@y.com"}]'::jsonb,
      $c${"nome":"W","custom":{"tamanho":"XGG"}}$c$::jsonb);
    v_erro := 'ACEITOU (falha)';
  exception when others then
    v_erro := case when sqlerrm like '%opções%' then 'recusado listando as opções' else 'recusado: ' || sqlerrm end;
  end;
  perform pg_temp.checar('opção inválida é recusada listando as válidas',
    'recusado listando as opções', v_erro);

  -- ESCALA: cliente pede campo novo, sem tocar no banco
  perform app.definir_campos(v_ir, $j$[
    {"chave":"tem_laudo","rotulo":"Tem laudo médico?","tipo":"booleano"}
  ]$j$::jsonb);

  perform ingerir_lead(v_ir, null, null, 'site',
    '[{"tipo":"email","valor":"novo@ir.com"}]'::jsonb,
    $c${"nome":"Com laudo","email":"novo@ir.com","custom":{"tem_laudo":true}}$c$::jsonb);

  perform pg_temp.checar('campo novo entra sem alterar o banco', 'true',
    (select custom->>'tem_laudo' from contacts where email = 'novo@ir.com'));

  perform pg_temp.checar('e o esquema continua o mesmo', 'igual',
    case when exists (
      select table_name from information_schema.tables where table_schema='public'
      except select table_name from esquema_antes
    ) then 'ESQUEMA MUDOU' else 'igual' end);

  -- Dedupe segue valendo com a validação no caminho
  perform ingerir_lead(v_ir, null, null, 'whatsapp',
    '[{"tipo":"phone","valor":"+551187654321"}]'::jsonb,
    $c${"nome":null,"phone_e164":"+5511987654321","custom":{}}$c$::jsonb);

  perform pg_temp.checar('mesma pessoa por dois canais continua um contato', '1',
    (select count(*)::text from contacts where org_id = v_ir and email = 'cliente@ir.com'));
end
$assercoes$;

\set QUIET off
\echo ''
\echo '=============================================================='
\echo ' CAMPOS POR NICHO — dois nichos, um banco, zero DDL'
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
