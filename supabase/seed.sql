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
