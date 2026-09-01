# 06 — Métricas, KPIs e DRE

Todas as consultas abaixo foram executadas contra o [`schema.sql`](schema.sql) em PostgreSQL 16.

## 1. De onde vem cada número

| Fonte | Alimenta |
|---|---|
| `deal_stage_events` | Volume por etapa, conversão entre etapas, tempo por etapa |
| `ad_costs_daily` | Custo de mídia (CPL, custo por MQL/SQL/reunião) |
| `attribution_snapshots` | Recorte por campanha e por origem |
| `revenues` / `costs` | Ticket, LTV, margem, DRE |
| `deals` | Pipeline aberto, ticket médio, taxa de ganho |

> **Armadilha de dupla contagem:** `ad_costs_daily` guarda a mesma verba em três níveis (campanha,
> conjunto, anúncio). Toda soma de custo **precisa** filtrar `nivel = 'campanha'`. Sem o filtro, o custo
> triplica e todos os KPIs derivados ficam errados por um fator constante — que é o pior tipo de erro,
> porque o relatório continua parecendo plausível.

## 2. Ingestão do custo de mídia

Sync diário para `ad_costs_daily`:

- **Meta:** Marketing API, endpoint `insights`, nível `campaign`, com `time_increment=1`.
- **Google:** a Google Ads API **continua** válida para leitura de relatório — só o *upload* de conversões
  migrou para a Data Manager API. Query GAQL em `campaign` com `segments.date`.
- **Atalho:** o MCP do Windsor.ai já conectado a esta conta lê os dois e serve para começar sem construir
  os conectores. Vale para validar o modelo; para produção, o conector direto evita depender de terceiro
  no caminho do dado financeiro.

Reprocessar os últimos **7 dias** a cada execução: plataforma de anúncio revisa custo retroativamente
(invalid clicks, ajuste de câmbio). O `UNIQUE (org_id, external_id, nivel, data)` faz o upsert absorver a
correção.

## 3. Funil

### Volume por etapa no mês

```sql
select mes, categoria, deals
from v_funil_mensal
where org_id = :org and mes = date_trunc('month', :ref::date)::date
order by categoria;
```

### Taxa de conversão entre categorias

```sql
with f as (
  select categoria, deals from v_funil_mensal
  where org_id = :org and mes = date_trunc('month', :ref::date)::date
)
select
  (select deals from f where categoria = 'lead')    as leads,
  (select deals from f where categoria = 'mql')     as mql,
  (select deals from f where categoria = 'sql')     as sql_,
  (select deals from f where categoria = 'reuniao') as reunioes,
  round(100.0 * (select deals from f where categoria = 'mql')
              / nullif((select deals from f where categoria = 'lead'), 0), 1) as pct_lead_mql,
  round(100.0 * (select deals from f where categoria = 'sql')
              / nullif((select deals from f where categoria = 'mql'), 0), 1)  as pct_mql_sql;
```

### Gargalo: onde o deal fica parado

```sql
select stage_nome, transicoes, horas_media, horas_mediana
from v_tempo_por_etapa
where org_id = :org
order by horas_mediana desc nulls last;
```

Compare **mediana** com média. Média muito acima da mediana significa poucos deals travados há meses
distorcendo o número — é um problema de higiene do funil, não de processo comercial.

## 4. Custo por etapa

```sql
-- CPL, custo por MQL, por SQL, por reunião, por orçamento: mesma view,
-- muda só a categoria.
select mes, categoria, deals, custo, custo_por_deal
from v_custo_por_etapa_mensal
where org_id = :org
  and categoria in ('lead','mql','sql','reuniao','orcamento')
  and mes >= date_trunc('month', now()) - interval '6 months'
order by mes desc, categoria;
```

### Por campanha

```sql
select
  a.utm_id,
  coalesce(e.nome, a.utm_campaign)               as campanha,
  count(distinct a.deal_id)                      as deals,
  coalesce(sum(c.custo), 0)                      as custo,
  round(coalesce(sum(c.custo), 0)
        / nullif(count(distinct a.deal_id), 0), 2) as custo_por_deal
from attribution_snapshots a
join v_deal_categoria_atingida v
  on v.deal_id = a.deal_id and v.categoria = :categoria
left join ad_entities e
  on e.org_id = a.org_id and e.external_id = a.utm_id and e.nivel = 'campanha'
left join ad_costs_daily c
  on c.entity_id = e.id
 and c.data between :de and :ate
 and c.nivel = 'campanha'
where a.org_id = :org
  and a.modelo = 'last_touch'
  and v.atingida_em between :de and :ate
group by a.utm_id, coalesce(e.nome, a.utm_campaign)
order by custo desc;
```

O `utm_id` é a chave de join com `ad_entities.external_id`. É por isso que
[`03-captura-web.md`](03-captura-web.md) insiste em gravar o ID numérico e não só o nome da campanha:
com o nome, uma renomeação parte a série histórica em duas.

## 5. CAC, LTV e payback

```sql
-- CAC mensal: (mídia + comissão + folha) / clientes novos
select mes, clientes_novos, custo_midia, custo_comercial, cac
from v_cac_mensal
where org_id = :org
order by mes desc limit 12;

-- LTV por coorte de entrada
select coorte, contatos, receita_total, ltv_medio
from v_ltv_coorte
where org_id = :org
order by coorte desc limit 12;

-- Relação LTV/CAC e payback em meses
select
  l.coorte,
  l.ltv_medio,
  c.cac,
  round(l.ltv_medio / nullif(c.cac, 0), 2) as ltv_cac,
  round(c.cac / nullif(l.ltv_medio / 12.0, 0), 1) as payback_meses
from v_ltv_coorte l
join v_cac_mensal c on c.org_id = l.org_id and c.mes = l.coorte
where l.org_id = :org
order by l.coorte desc;
```

`ltv_cac` abaixo de 3 costuma indicar aquisição cara demais para o ticket. É referência de mercado, não
regra: negócio com recompra alta e margem boa opera saudável abaixo disso.

O `payback_meses` acima assume LTV distribuído linearmente em 12 meses — aproximação suficiente para
acompanhamento, não para decisão de investimento.

## 6. Desempenho por vendedor

```sql
select
  p.nome,
  count(*) filter (where d.status = 'aberto')  as em_aberto,
  count(*) filter (where d.status = 'ganho')   as ganhos,
  count(*) filter (where d.status = 'perdido') as perdidos,
  round(100.0 * count(*) filter (where d.status = 'ganho')
        / nullif(count(*) filter (where d.status in ('ganho','perdido')), 0), 1) as pct_ganho,
  coalesce(sum(d.valor) filter (where d.status = 'ganho'), 0) as receita,
  round(avg(d.valor) filter (where d.status = 'ganho'), 2)    as ticket_medio
from deals d
join profiles p on p.id = d.owner_id
where d.org_id = :org
  and d.deleted_at is null
  and d.created_at >= :de
group by p.nome
order by receita desc;
```

Taxa de ganho olha só deals **decididos** (ganho + perdido). Incluir os abertos no denominador faz o
vendedor com pipeline cheio parecer pior que o que não prospecta.

## 7. Motivos de perda

```sql
select l.nome as motivo, count(*) as deals,
       coalesce(sum(d.valor), 0) as valor_perdido
from deals d
join loss_reasons l on l.id = d.loss_reason_id
where d.org_id = :org and d.status = 'perdido'
  and d.closed_at >= :de and d.deleted_at is null
group by l.nome
order by valor_perdido desc;
```

## 8. DRE

```sql
select mes, receita_bruta, custo_direto,
       midia, comissao, folha, ferramentas, operacional, imposto,
       resultado,
       round(100.0 * resultado / nullif(receita_bruta, 0), 1) as margem_pct
from v_dre_mensal
order by mes desc limit 12;
```

Estrutura:

```
  Receita reconhecida            revenues.valor         (competência, não caixa)
− Custo direto                   revenues.custo_direto
= Margem bruta
− Mídia                          costs.categoria='midia'        ← importado do sync
− Comissão                       costs.categoria='comissao'
− Folha                          costs.categoria='folha'
− Ferramentas                    costs.categoria='ferramentas'  ← inclui custo WhatsApp
− Operacional                    costs.categoria='operacional'
− Imposto                        costs.categoria='imposto'
= Resultado
```

**Receita é por competência** (`reconhecida_em`), não por caixa. Venda parcelada gera uma linha em
`revenues` por parcela reconhecida, e não uma linha cheia no mês do fechamento — caso contrário o mês da
venda infla e os seguintes ficam vazios.

`mv_dre_mensal` é materializada e atualizada por `pg_cron` às 4h. Nunca a leia direto do client: ela não
respeita RLS. O acesso é sempre pela view `v_dre_mensal`.

## 9. Dicionário de métricas

| Métrica | Definição | Fonte |
|---|---|---|
| **Lead** | Deal criado | `deals` |
| **MQL** | Deal que alcançou categoria `mql` | `v_deal_categoria_atingida` |
| **SQL** | Deal que alcançou categoria `sql` | idem |
| **CPL** | Custo de mídia ÷ leads | `v_custo_por_etapa_mensal` |
| **Custo por MQL/SQL/reunião** | Custo ÷ deals que **alcançaram** a categoria | idem |
| **CAC** | (mídia + comissão + folha) ÷ clientes novos | `v_cac_mensal` |
| **LTV** | Receita acumulada por contato, por coorte de entrada | `v_ltv_coorte` |
| **Ticket médio** | Média de `deals.valor` entre os ganhos | `deals` |
| **Taxa de ganho** | ganhos ÷ (ganhos + perdidos) | `deals` |
| **Tempo por etapa** | Mediana de `duracao_anterior_s` | `v_tempo_por_etapa` |
| **SLA de 1ª resposta** | `first_response_at − created_at` | `conversations` |
| **Margem** | resultado ÷ receita bruta | `v_dre_mensal` |

"Alcançou a categoria" é sempre a **primeira** vez (`MIN(occurred_at)`). Deal que volta e avança de novo
conta uma vez só — a mesma regra do dedupe do outbox, para que relatório e plataforma de anúncio nunca
discordem sobre quantos SQLs existiram.
