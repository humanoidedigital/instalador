# Fase 0 — como colocar de pé

Código pronto e testado. Falta só o projeto Supabase existir.

## 1. Criar o projeto

Em [supabase.com](https://supabase.com), projeto novo, região **South America (São Paulo)** —
latência importa num inbox de conversa.

## 2. Aplicar a estrutura

```bash
# com a CLI da Supabase
supabase link --project-ref SEU_REF
supabase db push

# ou direto, com a connection string do painel
psql "$DATABASE_URL" -f supabase/migrations/20260901120000_init.sql
psql "$DATABASE_URL" -f supabase/migrations/20260901130000_ingestao.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

`seed.sql` cria a função `app.semear_org()`. Chame-a uma vez por organização:

```sql
insert into orgs (nome, slug) values ('Sua operação', 'sua-operacao') returning id;
select app.semear_org('<id devolvido acima>');
```

Isso já entrega funil, sete etapas e seis motivos de perda. Renomeie as etapas à
vontade no admin — a coluna `categoria` é o que mantém os relatórios funcionando.

## 3. Publicar as funções

```bash
supabase functions deploy ingest-form
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

## 4. Apontar o subdomínio

`t.seudominio.com.br` → a Edge Function. **Não é opcional**: é o que faz o
rastreamento sobreviver no Safari. Ver `docs/crm/03-captura-web.md`.

## 5. Instalar a captura no site

- Todo site e LP: `packages/tracker/crm.js` com a `site_key` do registro em `sites`.
- WordPress: `packages/wordpress-plugin/crm-lead-bridge.php`, configurado em
  Ajustes › CRM Lead Bridge. Rodar os dois juntos é seguro — o CRM deduplica.

## O que está testado

| O quê | Como |
|---|---|
| Estrutura completa | `psql -f` limpo em PostgreSQL 16 |
| Normalização de telefone e e-mail | 36 casos automatizados |
| Ingestão, dedupe, fusão e distribuição | Cenário de ponta a ponta em banco real |

```bash
# testes da normalização
node --experimental-strip-types supabase/functions/_shared/identidade.test.ts
```

Casos que o teste de ponta a ponta cobre: o mesmo cliente chegando pela landing
page com o nono dígito e pelo WhatsApp sem ele vira **um** contato e **um** deal,
o `gclid` do primeiro dia continua ligado à negociação, e a distribuição
alterna entre os vendedores.

## Ainda não construído

`ingest-uazapi`, `ingest-waba`, `ingest-leadgen`, `push-dispatch` e o worker de
conversões. Ordem e critérios de aceite em `docs/crm/07-roadmap.md`.
