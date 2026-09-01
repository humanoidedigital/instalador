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
