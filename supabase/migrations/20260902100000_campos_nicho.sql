-- =====================================================================
-- 0005 · Campos por nicho
--
-- Nichos diferentes têm campos de qualificação diferentes: isenção de IR
-- registra benefício e condição de saúde; aluguel de fantasias registra
-- tamanho e data do evento. Isso NÃO exige tabela nem coluna por cliente.
--
-- Proporção: nome, telefone, e-mail, dono, etapa, valor, datas, origem, UTMs
-- e histórico do funil continuam colunas tipadas — é a maior parte do CRM e é
-- igual em todo nicho. Só os campos de qualificação vão para `contacts.custom`.
--
-- Cliente novo, ou nicho inteiramente novo, entra sem uma linha de DDL.
-- =====================================================================

create type custom_field_type as enum (
  'texto', 'numero', 'moeda', 'data', 'booleano', 'escolha', 'multipla'
);

create table custom_fields (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references orgs(id) on delete cascade,
  chave            text not null,
  rotulo           text not null,
  tipo             custom_field_type not null default 'texto',
  -- Só para 'escolha' e 'multipla': os valores aceitos.
  opcoes           text[] not null default '{}',
  obrigatorio      boolean not null default false,
  -- Se aparece como filtro no funil e como coluna na lista de leads.
  mostrar_no_funil boolean not null default false,
  ordem            int not null default 0,
  created_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  unique (org_id, chave),
  -- Chave é identificador, não rótulo: sem espaço, sem acento.
  constraint chave_em_formato_de_identificador
    check (chave ~ '^[a-z][a-z0-9_]{0,62}$'),
  constraint escolha_precisa_de_opcoes
    check (tipo not in ('escolha','multipla') or cardinality(opcoes) > 0)
);

create index on custom_fields (org_id, ordem) where deleted_at is null;

comment on table custom_fields is
  'Campos de qualificação que cada cliente declara. Nicho novo = linhas, nunca DDL.';

-- Filtrar por campo do nicho sem varrer a tabela inteira.
-- jsonb_path_ops é menor e mais rápido que o padrão para o caso de uso aqui,
-- que é sempre "contém esta chave com este valor".
create index contacts_custom_idx on contacts using gin (custom jsonb_path_ops);

-- ---------------------------------------------------------------------
-- Validação
--
-- É isto que faz o contrato existir de verdade. Sem recusar o que sai do
-- combinado, "campo definido" é só uma convenção que depende de todo mundo
-- lembrar — e seis meses depois alguém mexe num prompt, o campo volta a
-- chegar torto, e o erro só aparece num relatório errado.
-- ---------------------------------------------------------------------
create or replace function app.validar_custom(p_org_id uuid, p_custom jsonb)
  returns void
  language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  d          record;
  v_chave    text;
  v_valor    jsonb;
  v_declarados text[];
  v_txt      text;
begin
  if p_custom is null or p_custom = '{}'::jsonb then
    -- Ainda assim é preciso conferir os obrigatórios.
    null;
  end if;

  select coalesce(array_agg(chave), '{}') into v_declarados
    from custom_fields
   where org_id = p_org_id and deleted_at is null;

  -- 1. Nenhuma chave fora do que o cliente declarou.
  for v_chave in select jsonb_object_keys(coalesce(p_custom, '{}'::jsonb)) loop
    if not (v_chave = any(v_declarados)) then
      raise exception
        'campo % não declarado para esta organização (declarados: %)',
        quote_literal(v_chave),
        coalesce(array_to_string(v_declarados, ', '), 'nenhum')
        using errcode = 'check_violation';
    end if;
  end loop;

  -- 2. Tipo e opções de cada campo declarado.
  for d in
    select * from custom_fields
     where org_id = p_org_id and deleted_at is null
  loop
    v_valor := p_custom -> d.chave;

    if v_valor is null or jsonb_typeof(v_valor) = 'null' then
      if d.obrigatorio then
        raise exception 'campo obrigatório % ausente', quote_literal(d.chave)
          using errcode = 'check_violation';
      end if;
      continue;
    end if;

    case d.tipo
      when 'numero', 'moeda' then
        if jsonb_typeof(v_valor) <> 'number' then
          raise exception 'campo % espera número, recebeu %',
            quote_literal(d.chave), jsonb_typeof(v_valor)
            using errcode = 'check_violation';
        end if;

      when 'booleano' then
        if jsonb_typeof(v_valor) <> 'boolean' then
          raise exception 'campo % espera verdadeiro/falso, recebeu %',
            quote_literal(d.chave), jsonb_typeof(v_valor)
            using errcode = 'check_violation';
        end if;

      when 'data' then
        begin
          perform (v_valor #>> '{}')::date;
        exception when others then
          raise exception 'campo % espera data (AAAA-MM-DD), recebeu %',
            quote_literal(d.chave), v_valor::text
            using errcode = 'check_violation';
        end;

      when 'escolha' then
        v_txt := v_valor #>> '{}';
        if not (v_txt = any(d.opcoes)) then
          raise exception 'campo % não aceita %; opções: %',
            quote_literal(d.chave), quote_literal(v_txt),
            array_to_string(d.opcoes, ', ')
            using errcode = 'check_violation';
        end if;

      when 'multipla' then
        if jsonb_typeof(v_valor) <> 'array' then
          raise exception 'campo % espera uma lista, recebeu %',
            quote_literal(d.chave), jsonb_typeof(v_valor)
            using errcode = 'check_violation';
        end if;
        for v_txt in select jsonb_array_elements_text(v_valor) loop
          if not (v_txt = any(d.opcoes)) then
            raise exception 'campo % não aceita %; opções: %',
              quote_literal(d.chave), quote_literal(v_txt),
              array_to_string(d.opcoes, ', ')
              using errcode = 'check_violation';
          end if;
        end loop;

      else null;  -- texto aceita qualquer coisa
    end case;
  end loop;
end;
$$;

comment on function app.validar_custom(uuid, jsonb) is
  'Recusa campo não declarado, tipo errado ou opção inválida. Erro claro, nunca gravação torta.';

-- ---------------------------------------------------------------------
-- Declarar os campos de um cliente numa chamada
-- ---------------------------------------------------------------------
create or replace function app.definir_campos(p_org_id uuid, p_campos jsonb)
  returns int
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c     jsonb;
  v_n   int := 0;
begin
  for c in select jsonb_array_elements(p_campos) loop
    insert into custom_fields (
      org_id, chave, rotulo, tipo, opcoes, obrigatorio, mostrar_no_funil, ordem
    ) values (
      p_org_id,
      c->>'chave',
      coalesce(c->>'rotulo', c->>'chave'),
      coalesce((c->>'tipo')::custom_field_type, 'texto'),
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(c->'opcoes') x),
        '{}'
      ),
      coalesce((c->>'obrigatorio')::boolean, false),
      coalesce((c->>'mostrar_no_funil')::boolean, false),
      coalesce((c->>'ordem')::int, v_n)
    )
    on conflict (org_id, chave) do update set
      rotulo           = excluded.rotulo,
      tipo             = excluded.tipo,
      opcoes           = excluded.opcoes,
      obrigatorio      = excluded.obrigatorio,
      mostrar_no_funil = excluded.mostrar_no_funil,
      ordem            = excluded.ordem,
      deleted_at       = null;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

comment on function app.definir_campos(uuid, jsonb) is
  'Declara ou atualiza os campos de nicho de um cliente. Idempotente.';

-- ---------------------------------------------------------------------
-- A ficha que o vendedor vê, montada a partir das definições
--
-- É isto que dispensa uma tela codificada por cliente: a interface lê esta
-- view e desenha o formulário sozinha.
-- ---------------------------------------------------------------------
create or replace view v_ficha_campos with (security_invoker = true) as
  select
    f.org_id,
    f.chave,
    f.rotulo,
    f.tipo,
    f.opcoes,
    f.obrigatorio,
    f.mostrar_no_funil,
    f.ordem
  from custom_fields f
  where f.deleted_at is null
  order by f.ordem, f.rotulo;

alter table custom_fields enable row level security;
alter table custom_fields force row level security;

create policy custom_fields_org_select on custom_fields for select
  using (org_id in (select app.orgs_visiveis()));

create policy custom_fields_admin_write on custom_fields for all
  using (org_id in (select app.orgs_visiveis()) and app.is_admin())
  with check (org_id in (select app.orgs_visiveis()) and app.is_admin());

-- ---------------------------------------------------------------------
-- `ingerir_lead()` passa a validar antes de gravar
--
-- Recriada por inteiro porque plpgsql não permite emendar corpo de função.
-- A única diferença em relação à 0002 é a chamada a app.validar_custom()
-- logo no começo, marcada abaixo.
-- ---------------------------------------------------------------------
create or replace function ingerir_lead(
  p_org_id       uuid,
  p_delivery_id  uuid,
  p_pipeline_id  uuid,
  p_origem       lead_source,
  p_identidades  jsonb,
  p_contato      jsonb,
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
  -- ---- 0. Contrato: recusa antes de gravar qualquer coisa ----------------
  perform app.validar_custom(p_org_id, coalesce(p_contato->'custom', '{}'::jsonb));

  select dedupe_deal_janela_dias into v_janela from orgs where id = p_org_id;
  v_janela := coalesce(v_janela, 30);

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

    update contacts set
      nome       = coalesce(nome,       nullif(p_contato->>'nome','')),
      email      = coalesce(email,      nullif(p_contato->>'email','')),
      phone_e164 = coalesce(phone_e164, nullif(p_contato->>'phone_e164','')),
      custom     = custom || coalesce(p_contato->'custom', '{}'::jsonb),
      updated_at = now()
    where id = v_contato_id;
  end if;

  for v_ident in select * from jsonb_array_elements(p_identidades) loop
    insert into contact_identities (org_id, contact_id, tipo, valor, origem)
    values (p_org_id, v_contato_id, (v_ident->>'tipo')::identity_kind, v_ident->>'valor', p_origem)
    on conflict (org_id, tipo, valor) do nothing;
  end loop;

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

  if p_anonymous_id is not null then
    update touchpoints
       set contact_id = v_contato_id
     where org_id = p_org_id
       and anonymous_id = p_anonymous_id
       and contact_id is null;
  end if;

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

    insert into deal_stage_events (org_id, deal_id, to_stage_id, to_categoria, automatico)
    select p_org_id, v_deal_id, v_stage_id, s.categoria, true from stages s where s.id = v_stage_id;
  else
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

  if p_delivery_id is not null then
    update webhook_deliveries set processado_em = now() where id = p_delivery_id;
  end if;

  return v_contato_id;
end;
$$;

-- Refaz a blindagem da 0004: `create or replace` restaura o EXECUTE para
-- PUBLIC que o Postgres concede por padrão, e ingerir_lead ignora a RLS.
do $refechar$
begin
  revoke all on function ingerir_lead(uuid,uuid,uuid,lead_source,jsonb,jsonb,jsonb,text,boolean) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function ingerir_lead(uuid,uuid,uuid,lead_source,jsonb,jsonb,jsonb,text,boolean) from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function ingerir_lead(uuid,uuid,uuid,lead_source,jsonb,jsonb,jsonb,text,boolean) from authenticated;
    grant execute on function app.validar_custom(uuid,jsonb) to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function ingerir_lead(uuid,uuid,uuid,lead_source,jsonb,jsonb,jsonb,text,boolean) to service_role;
    grant execute on function app.definir_campos(uuid,jsonb) to service_role;
  end if;
  revoke all on function app.definir_campos(uuid,jsonb) from public;
end
$refechar$;
