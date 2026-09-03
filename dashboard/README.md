# Dashboard de Marketing

Painel único com **Google Ads + Meta Ads + RD Station CRM**: KPIs com comparação
de período, funil, etapas do CRM, origem dos leads e performance por campanha,
com seletor de cliente para operação de agência.

Roda no mesmo VPS do instalador, em processo próprio no PM2 atrás do nginx.

---

## Índice

- [Instalação no VPS](#instalação-no-vps)
- [Rodando localmente](#rodando-localmente)
- [Cadastro dos clientes](#cadastro-dos-clientes)
- [Credenciais](#credenciais)
- [Validar a conexão com o CRM](#validar-a-conexão-com-o-crm)
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
adicionar um cliente **não exige rebuild**.

```json
{
  "clients": [
    {
      "id": "isentei",
      "name": "Isentei",
      "currency": "BRL",
      "metaAccountIds": ["710457422909643"],
      "googleAccountIds": ["185-232-8929"],
      "rdCrmTokenEnv": "RD_CRM_TOKEN_ISENTEI",
      "rdCrmPipelines": [],
      "goals": { "cpl": 25, "roas": 4, "monthlyBudget": 15000, "monthlyLeads": 600 }
    }
  ]
}
```

| Campo | Onde encontrar / para que serve |
|---|---|
| `metaAccountIds` | Gerenciador de Anúncios → ID da conta (sem o prefixo `act_`) |
| `googleAccountIds` | Google Ads → ID do cliente (com ou sem hífens, tanto faz) |
| `rdCrmTokenEnv` | **Nome** da variável de ambiente com o token do RD Station CRM deste cliente. O token fica só no `.env` — este arquivo é versionado no git |
| `rdCrmPipelines` | Nomes dos funis do cliente. Use quando vários clientes dividem a mesma conta de CRM. Vazio = considera todos os funis |
| `goals` | Metas do cliente — alimentam as barras de meta e os alertas automáticos |

### As duas topologias de CRM

**Uma conta de RD Station CRM por cliente** (o mais comum em agência): crie uma
variável por cliente no `.env` e aponte o nome dela em `rdCrmTokenEnv`.

```bash
# .env
RD_CRM_TOKEN_ISENTEI=abc123...
RD_CRM_TOKEN_DURAN=def456...
```

**Uma conta só, com um funil por cliente**: preencha apenas `RD_CRM_TOKEN` no
`.env` e separe os clientes por `rdCrmPipelines`.

```json
"rdCrmTokenEnv": "",
"rdCrmPipelines": ["Funil Isentei"]
```

Na visão "Todos os clientes" o painel busca conta por conta e soma. Contas
repetidas (mesmo token, mesmo filtro de funil) são buscadas uma vez só, para não
contar o mesmo lead duas vezes.

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

### RD Station CRM

Token da conta em **RD Station CRM → Configurações → Integrações → API**. Cada
conta de CRM tem o seu.

| Variável | Para quê |
|---|---|
| `RD_CRM_TOKEN` | Token global, usado quando o cliente não tem `rdCrmTokenEnv` |
| `RD_CRM_TOKEN_<CLIENTE>` | Token de um cliente específico |
| `RD_CRM_API_VERSION` | `v1` (padrão, `crm.rdstation.com/api/v1`, token na query) ou `v2` (`api.rd.services/crm/v2`, Bearer token) |
| `RD_WON_STAGES` | Etapas que contam como venda ganha além do desfecho "ganho" do RD — para times que marcam a venda movendo o card |
| `RD_UTM_SOURCE_FIELD` / `RD_UTM_CAMPAIGN_FIELD` | Nome dos campos personalizados da negociação que guardam a origem. Se existirem, ganham da fonte padrão do RD e melhoram muito a atribuição por canal |

O parsing aceita as variações de nome de campo entre as duas versões da API
(`id`/`_id`, `amount_total`/`amount_unique`, `win` booleano ou textual) e
converte valor em formato brasileiro (`"2.480,50"` → `2480.5`). O filtro de
período é reaplicado localmente, então mesmo que a API ignore o parâmetro de
data o número do painel continua certo.

### GoHighLevel (alternativa)

O adaptador continua disponível: `CRM_PROVIDER=gohighlevel` + `GHL_API_TOKEN`
(Private Integration Token) e `ghlLocationId` por cliente.

---

## Validar a conexão com o CRM

Depois de colocar o token, um comando responde se está tudo certo:

```bash
curl -su admin:SUA_SENHA "https://seu-dominio/api/crm-check?client=isentei&preset=last_30d" | jq
```

A resposta mostra quantas negociações vieram, quais campos a API devolveu, as
etapas e funis reconhecidos, a distribuição de status, a atribuição por canal e
três exemplos mapeados (sem dados pessoais). Se algum número estiver estranho,
`camposDoPrimeiroNegocio` mostra na hora se o contrato da API mudou.

`?client=__all__` roda o diagnóstico em todos os clientes de uma vez.

---

## O que cada número significa

| Indicador | Cálculo | Fonte |
|---|---|---|
| Investimento | soma do gasto | Meta + Google |
| Leads no CRM | negociações criadas no período | RD Station CRM |
| CPL | investimento ÷ leads do CRM | ambos |
| Negociações qualificadas | negociações que passaram da triagem inicial | RD Station CRM |
| Vendas ganhas / Receita | negociações com desfecho ganho e seu valor | RD Station CRM |
| ROAS | receita ÷ investimento | ambos |
| CAC | investimento ÷ vendas ganhas | ambos |
| Conversões nas plataformas | conversões reportadas pelo Meta e pelo Google | Meta + Google |

**Por que o CRM e as plataformas divergem?** As plataformas atribuem a conversão
à data do *clique* dentro da janela de atribuição (7 dias de visualização, 1 dia
de clique etc.), e cada uma conta a seu modo. O CRM conta a negociação na data
em que ela foi criada. Os dois números são exibidos lado a lado de propósito: o
CRM é a verdade do negócio, a plataforma é o sinal que otimiza a campanha.

Quando o CRM não registra receita, o ROAS cai para o valor de conversão
reportado pelas plataformas em vez de mostrar zero — e a tabela de campanhas
marca esses casos com "(plataforma)".

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
| "Dados de demonstração" no topo | falta `WINDSOR_API_KEY` ou nenhum token de CRM no `.env` |
| Aviso do Windsor sobre plano | mais contas conectadas do que o plano Free permite |
| Leads e vendas zerados num cliente | token de CRM ausente — veja o aviso na tela e rode `/api/crm-check` |
| `401` no `/api/crm-check` | token do RD errado, ou de outra conta que não a do cliente |
| Todos os clientes com os mesmos leads | vários clientes usando o `RD_CRM_TOKEN` global; separe por `rdCrmTokenEnv` ou por `rdCrmPipelines` |
| Origem "não identificado" na maioria dos leads | as negociações não têm fonte nem `utm_source`; configure o campo personalizado e aponte em `RD_UTM_SOURCE_FIELD` |
| ROAS "—" na campanha | nenhum lead do CRM casou com a campanha (falta `utm_campaign` na negociação) |
| 401 ao abrir o painel | HTTP Basic: usuário `admin` e a senha definida na instalação |
| Erro 502 no nginx | processo caiu — veja `pm2 logs marketing-dashboard` |

---

## Estrutura

```
dashboard/
├── config/clients.json           # mapa cliente → contas de anúncio + conta de CRM
├── src/lib/
│   ├── providers/
│   │   ├── ads/windsor.ts        # Meta + Google via Windsor.ai
│   │   ├── ads/google-native.ts  # Google Ads API (GAQL)
│   │   ├── ads/meta-native.ts    # Meta Marketing API
│   │   ├── crm/rdstation.ts      # RD Station CRM (v1 e v2)
│   │   ├── crm/gohighlevel.ts    # GoHighLevel (alternativa)
│   │   └── demo.ts               # dados sintéticos determinísticos
│   ├── metrics.ts                # KPIs, funil, séries, insights automáticos
│   ├── clients.ts                # leitura do clients.json e das credenciais
│   └── cache.ts                  # cache TTL + deduplicação de chamadas
├── src/app/api/overview/         # endpoint que monta o payload do painel
├── src/app/api/crm-check/        # diagnóstico da integração com o CRM
└── src/components/               # UI e gráficos
```
