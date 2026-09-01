-- =====================================================================
-- Semente
--
-- `app.semear_org()` NÃO mora aqui: é função de esquema e vive na migration
-- 0003, antes de `app.criar_cliente()`, que a chama. Deixá-la neste arquivo
-- quebrava a ordem — a migration de permissões tentava blindar uma função
-- que ainda não existia.
--
-- Aqui fica só o que é dado: a org de demonstração do ambiente local.
-- =====================================================================

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
