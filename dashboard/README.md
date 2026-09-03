# Dashboard de Marketing

Painel único com **Google Ads + Meta Ads + CRM (GoHighLevel)**: KPIs com comparação
de período, funil, pipeline, origem dos leads e performance por campanha, com
seletor de cliente para operação de agência.

Roda no mesmo VPS do instalador, em processo próprio no PM2 atrás do nginx.

---

## Índice

- [Instalação no VPS](#instalação-no-vps)
- [Rodando localmente](#rodando-localmente)
- [Cadastro dos clientes](#cadastro-dos-clientes)
- [Credenciais](#credenciais)
- [O que cada número significa](#o-que-cada-número-significa)
- [Trocar Windsor pelas APIs nativas](#trocar-windsor-pelas-apis-nativas)
- [Operação no dia a dia](#operação-no-dia-a-dia)
- [Problemas comuns](#problemas-comuns)

---

## Instalação no VPS

Na raiz do repositório do instalador:

```bash
sudo ./install_dashboard
```

O script pergunta domínio, porta, senha de acesso e as credenciais, e então:

1. instala nginx, certbot e rsync se ainda não existirem;
2. instala um **Node 20 dedicado em `/opt/node20`** — o node 16 do sistema, que o
   whaticket exige, não é tocado;
3. copia o dashboard para `/home/deploy/marketing-dashboard`;
4. escreve o `.env` (permissão 600), instala dependências e compila;
5. sobe no PM2 como `marketing-dashboard`;
6. cria o site no nginx e emite o certificado SSL.

O acesso é protegido por HTTP Basic (usuário `admin` e a senha digitada na
instalação).

---

## Rodando localmente

```bash
cd dashboard
cp .env.example .env
npm install
npm run dev        # http://localhost:3333
```

Sem credenciais, o painel sobe em **modo demonstração** com dados sintéticos —
útil para ver o layout antes de conectar as contas. O aviso "Dados de
demonstração" fica visível no topo enquanto for esse o caso.

---

## Cadastro dos clientes

Tudo vive em `config/clients.json`. O app relê o arquivo sempre que ele muda:
adicionar um cliente **não exige rebuild**, só um `pm2 restart` se você quiser
limpar o cache.

```json
{
  "clients": [
    {
      "id": "isentei",
      "name": "Isentei",
      "currency": "BRL",
      "metaAccountIds": ["710457422909643"],
      "googleAccountIds": ["185-232-8929"],
      "ghlLocationId": "COLE_AQUI_O_LOCATION_ID",
      "goals": { "cpl": 25, "roas": 4, "monthlyBudget": 15000, "monthlyLeads": 600 }
    }
  ]
}
```

| Campo | Onde encontrar |
|---|---|
| `metaAccountIds` | Gerenciador de Anúncios → ID da conta (sem o prefixo `act_`) |
| `googleAccountIds` | Google Ads → ID do cliente (com ou sem hífens, tanto faz) |
| `ghlLocationId` | GoHighLevel → Settings → Business Profile, ou o ID na URL da subconta |
| `goals` | Metas do cliente — alimentam as barras de meta e os alertas automáticos |

O arquivo já vem preenchido com as contas de Meta e Google encontradas na conta
Windsor.ai. **Falta preencher o `ghlLocationId` de cada cliente** — sem ele as
métricas de CRM (leads, vendas, receita, pipeline) ficam zeradas para aquele
cliente, e o painel avisa isso na tela.

O seletor sempre inclui "Todos os clientes", que soma todas as contas.

---

## Credenciais

Todas ficam no `.env` (veja `.env.example` com o comentário de cada uma).

### Windsor.ai (mídia paga)

Uma API key só cobre Meta Ads e Google Ads, sem developer token do Google e sem
App Review da Meta. Pegue em <https://onboard.windsor.ai> → Account → API key e
coloque em `WINDSOR_API_KEY`.

> **Atenção ao plano.** No plano Free, o Windsor bloqueia a API quando há mais
> contas conectadas do que o limite e devolve um aviso no lugar dos dados. O
> dashboard detecta isso e mostra o motivo na tela em vez de exibir zeros. A
> conta atual está nessa situação: ou faz upgrade, ou desconecta contas até o
> limite do plano.

### GoHighLevel (CRM)

Settings → **Private Integrations** → criar token com os escopos
`opportunities.readonly`, `contacts.readonly` e `locations.readonly`. Cole em
`GHL_API_TOKEN`. Um token de agência atende todas as subcontas; um token de
subconta atende só a dela.

`GHL_WON_STAGES` aceita uma lista de nomes de estágio (separados por vírgula)
que devem contar como venda ganha, além do status `won` do próprio GHL — útil
quando o time marca a venda movendo o card em vez de mudar o status.

---

## O que cada número significa

| Indicador | Cálculo | Fonte |
|---|---|---|
| Investimento | soma do gasto | Meta + Google |
| Leads no CRM | oportunidades criadas no período | GoHighLevel |
| CPL | investimento ÷ leads do CRM | ambos |
| Oportunidades qualificadas | oportunidades que passaram da triagem inicial | GoHighLevel |
| Vendas ganhas / Receita | oportunidades com status ganho e seu valor | GoHighLevel |
| ROAS | receita ÷ investimento | ambos |
| CAC | investimento ÷ vendas ganhas | ambos |
| Conversões nas plataformas | conversões reportadas pelo Meta e pelo Google | Meta + Google |

**Por que o CRM e as plataformas divergem?** As plataformas atribuem a conversão
à data do *clique* dentro da janela de atribuição (7 dias de visualização, 1 dia
de clique etc.), e cada uma conta a seu modo. O CRM conta a oportunidade na data
em que ela foi criada. Os dois números são exibidos lado a lado de propósito: o
CRM é a verdade do negócio, a plataforma é o sinal que otimiza a campanha.

Quando o CRM não registra receita, o ROAS cai para o valor de conversão
reportado pelas plataformas em vez de mostrar zero.

Todo gráfico tem o botão **"Ver dados"**, que troca o desenho por uma tabela —
serve para conferência, leitores de tela e impressão. O botão **Exportar CSV**
baixa KPIs, campanhas e a série diária de uma vez.

---

## Trocar Windsor pelas APIs nativas

A camada de dados é de adaptadores: nenhum componente de tela conhece a origem.
Para migrar, preencha as credenciais e mude uma variável:

```bash
ADS_PROVIDER=native

GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_LOGIN_CUSTOMER_ID=...      # ID da MCC, só números

META_ACCESS_TOKEN=...
```

Depois `pm2 restart marketing-dashboard`. Os dois provedores nativos já estão
implementados (`src/lib/providers/ads/google-native.ts` via GAQL/searchStream e
`meta-native.ts` via Graph API `/insights`) — o que falta é a burocracia de cada
plataforma: developer token aprovado no Google e App com `ads_read` na Meta.

Dá para migrar um canal por vez? Sim: mantenha `ADS_PROVIDER=windsor` até ter as
duas credenciais, ou ajuste `nativeAdsProvider` em `src/lib/providers/index.ts`
para escolher por canal.

---

## Operação no dia a dia

```bash
pm2 logs marketing-dashboard          # logs
pm2 restart marketing-dashboard       # reiniciar (limpa o cache em memória)
curl -s http://127.0.0.1:3333/api/health | jq   # diagnóstico rápido
```

Atualizar o código depois de um `git pull` no instalador:

```bash
cd /caminho/do/instalador
sudo bash -c 'source variables/manifest.sh; source utils/manifest.sh; source lib/manifest.sh; \
  dashboard_name=marketing-dashboard PROJECT_ROOT=$PWD dashboard_update'
```

As respostas das APIs externas ficam em cache por `CACHE_TTL_SECONDS` (300s por
padrão). O botão "Atualizar dados" no painel força a releitura ignorando o cache.

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Dados de demonstração" no topo | falta `WINDSOR_API_KEY` ou `GHL_API_TOKEN` no `.env` |
| Aviso do Windsor sobre plano | mais contas conectadas do que o plano Free permite |
| Leads e vendas zerados num cliente | `ghlLocationId` vazio no `config/clients.json` |
| CPL alto demais no consolidado | leads do CRM sem `utm_source`; confira o rastreio dos formulários |
| ROAS "—" na campanha | nenhum lead do CRM casou com a campanha (falta `utm_campaign`) |
| 401 ao abrir o painel | HTTP Basic: usuário `admin` e a senha definida na instalação |
| Erro 502 no nginx | processo caiu — veja `pm2 logs marketing-dashboard` |

---

## Estrutura

```
dashboard/
├── config/clients.json          # mapa cliente → contas de anúncio + location do CRM
├── src/lib/
│   ├── providers/
│   │   ├── ads/windsor.ts       # Meta + Google via Windsor.ai
│   │   ├── ads/google-native.ts # Google Ads API (GAQL)
│   │   ├── ads/meta-native.ts   # Meta Marketing API
│   │   ├── crm/gohighlevel.ts   # GoHighLevel API v2
│   │   └── demo.ts              # dados sintéticos determinísticos
│   ├── metrics.ts               # KPIs, funil, séries, insights automáticos
│   ├── clients.ts               # leitura do clients.json
│   └── cache.ts                 # cache TTL + deduplicação de chamadas
├── src/app/api/overview/        # endpoint que monta o payload do painel
└── src/components/              # UI e gráficos
```
