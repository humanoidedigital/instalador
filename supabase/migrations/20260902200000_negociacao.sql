-- =====================================================================
-- 0006 · O que falta para a negociação ser o centro do CRM
--
-- Até aqui o banco sabia tudo sobre COMO o lead chegou e nada sobre o que
-- o vendedor escreveu a respeito dele. Anotação existia só em conversa
-- (`conversation_events.tipo = 'nota'`), que é o registro de atendimento,
-- não o histórico comercial da negociação.
--
-- Duas lacunas, fechadas aqui:
--   1. `deal_notes` — a aba "Anotações" da ficha da negociação
--   2. policy de escrita em `companies` — a tabela existia sem ninguém
--      poder gravar nela, então a tela de Empresas seria só leitura
--
-- Referência: docs/crm/01-modelo-de-dados.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Anotações da negociação
-- ---------------------------------------------------------------------
create table deal_notes (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references orgs(id),
  deal_id    uuid not null references deals(id) on delete cascade,
  autor_id   uuid references profiles(id),
  corpo      text not null check (length(btrim(corpo)) > 0),
  -- Fixar no topo é o equivalente ao "destaque" do RD: o contexto que o
  -- vendedor precisa reler antes de toda ligação.
  fixada     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A consulta da aba: anotações de UMA negociação, fixadas primeiro,
-- depois as mais recentes.
create index deal_notes_feed_idx
  on deal_notes (deal_id, fixada desc, created_at desc)
  where deleted_at is null;

create index on deal_notes (org_id, created_at) where deleted_at is null;

comment on table deal_notes is
  'Anotações livres do vendedor na negociação. Alimenta a aba "Anotações" da ficha.';

alter table deal_notes enable row level security;
alter table deal_notes force row level security;

-- Mesma regra das demais entidades: enxerga quem enxerga a organização.
-- Não restringimos ao autor de propósito — anotação de negociação é
-- memória do time, não diário pessoal; o gestor precisa ler.
create policy deal_notes_org on deal_notes for all
  using (org_id in (select app.orgs_visiveis()))
  with check (
    org_id in (select app.orgs_visiveis())
    -- Ninguém escreve anotação no nome de outro.
    and (autor_id is null or autor_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 2. `companies` sem policy de escrita
--
-- A tabela nasceu na 0001 e a 0003 reescreveu só o SELECT dela. Resultado:
-- toda a RLS negava insert e update, e a tela de Empresas nunca poderia
-- cadastrar nada. Aqui vale a mesma regra de `contacts`: qualquer usuário
-- da organização cria e edita — cadastrar empresa é trabalho de vendedor,
-- não privilégio de administrador.
-- ---------------------------------------------------------------------
drop policy if exists companies_write on companies;
create policy companies_write on companies for all
  using (org_id in (select app.orgs_visiveis()))
  with check (org_id in (select app.orgs_visiveis()));

-- ---------------------------------------------------------------------
-- 3. `updated_at` nas tabelas que ainda não tinham
--
-- `app.touch_updated_at()` já existe desde a 0001 e já está ligada em
-- `contacts` e `deals`. Aqui só faltavam duas: `deal_notes`, criada agora,
-- e `companies`, que nasceu sem a coluna.
-- ---------------------------------------------------------------------
alter table companies add column if not exists updated_at timestamptz not null default now();

create trigger deal_notes_touch before update on deal_notes
  for each row execute function app.touch_updated_at();

create trigger companies_touch before update on companies
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Privilégios
--
-- Sem função nova, nada de EXECUTE para reblindar aqui. Só o acesso às
-- tabelas — a RLS acima é quem decide de fato o que cada um alcança.
-- ---------------------------------------------------------------------
grant select, insert, update, delete on deal_notes to authenticated;
grant select, insert, update, delete on companies  to authenticated;
