# Dashboard de Marketing

Painel único com **Google Ads + Meta Ads + RD Station CRM**: KPIs com comparação
de período, funil, etapas do CRM, origem dos leads e performance por campanha,
com seletor de cliente para operação de agência.

Roda no mesmo VPS do instalador, em processo próprio no PM2 atrás do nginx.

---

## Índice

- [O que comprar de VPS](#o-que-comprar-de-vps)
- [Instalação no VPS](#instalação-no-vps)
- [Rodando localmente](#rodando-localmente)
- [Primeiro acesso](#primeiro-acesso)
- [Painel administrativo](#painel-administrativo)
- [Histórico e coleta diária](#histórico-e-coleta-diária)
- [Construtor de relatórios](#construtor-de-relatórios)
- [Métricas personalizadas](#métricas-personalizadas)
- [Análise por IA](#análise-por-ia)
- [Alertas](#alertas)
- [Tráfego orgânico](#tráfego-orgânico)
- [Cadastro dos clientes](#cadastro-dos-clientes)
- [Credenciais](#credenciais)
- [Validar a conexão com o CRM](#validar-a-conexão-com-o-crm)
- [O que cada número significa](#o-que-cada-número-significa)
- [Trocar Windsor pelas APIs nativas](#trocar-windsor-pelas-apis-nativas)
- [Operação no dia a dia](#operação-no-dia-a-dia)
- [Problemas comuns](#problemas-comuns)

---

## O que comprar de VPS

Números medidos neste app, não estimativa:

| Recurso | Consumo real |
|---|---|
| RAM em execução | ~200 MB |
| RAM no pico do `next build` | ~700 MB (o `npm install` sobe mais) |
| Disco | ~420 MB (`node_modules` 304 MB + `.next` 124 MB) |
| Histórico | ~15 MB por ano (medido: 90 dias de 8 clientes = 3,6 MB) |

| Cenário | Recomendado |
|---|---|
| Só o dashboard | 2 vCPU · 2 GB RAM · 40 GB SSD (o instalador cria 2 GB de swap) |
| Dashboard + CRM/whaticket na mesma máquina | 2–4 vCPU · 4 GB RAM · 80 GB SSD |

Ubuntu 22.04 LTS. Antes de rodar o instalador, aponte um registro **A** do
subdomínio (ex.: `painel.suaagencia.com.br`) para o IP da VPS e deixe as portas
**22, 80 e 443** abertas — o certificado SSL depende disso.

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

## Primeiro acesso

Abra `https://seu-dominio` no navegador. Se o instalador não tiver definido a
senha master, a primeira tela pede para criar usuário e senha — e enquanto isso
não acontece **ninguém abre o painel**.

A senha é guardada como hash scrypt em `config/secrets.json` (permissão 600).
Ela não fica no `.env`, nem em texto puro em lugar nenhum.

Perdeu o acesso? Redefina pelo servidor, sem navegador:

```bash
cd /home/deploy/marketing-dashboard
sudo -u deploy /opt/node20/bin/node scripts/set-password.mjs "admin" "nova-senha-forte"
```

---

## Painel administrativo

Em `/admin` (link **Administração** no topo do relatório). Só a conta master
entra. Nove abas:

| Aba | O que faz |
|---|---|
| **Clientes** | Cadastra, edita e desativa clientes: contas do Meta e do Google, token do CRM, funis, metas de CPL/ROAS/investimento/leads. Tem um botão **Testar CRM** por cliente, que consulta a API de verdade e diz quantas negociações e etapas voltaram |
| **Conexões** | Todas as credenciais e chaves: Windsor, RD Station, Google Ads e Meta nativos, GoHighLevel, senha de leitura. Campos de senha aparecem mascarados e nunca voltam em claro para o navegador |
| **Relatórios** | Monta o layout: quais blocos, em que ordem, e os templates globais e por cliente |
| **Métricas** | Cria e testa métricas personalizadas por fórmula |
| **Alertas** | Regras de alerta, histórico de disparos e o botão **Rodar agora** |
| **Orgânico** | Liga as fontes de tráfego orgânico e ajusta o mapa de campos de cada conector |
| **Dados** | Cobertura do histórico por cliente, backfill e resultado das últimas coletas |
| **Acesso** | Troca usuário e senha master (exige a senha atual) |
| **Sistema** | Estado do processo, fontes ativas, alertas de configuração, caminho dos arquivos e botão para limpar o cache |

### Onde as coisas ficam gravadas

| Arquivo | Conteúdo | Efeito |
|---|---|---|
| `config/clients.json` | clientes, contas de anúncio, metas | vale na hora |
| `config/secrets.json` | tokens, chaves e a senha master (permissão 600) | vale na hora |
| `config/metrics.json` | métricas personalizadas | vale na hora |
| `config/reports.json` | templates de relatório | vale na hora |
| `config/data/dashboard.db` | histórico coletado (SQLite) | atualizado pela coleta |
| `.env` | valores iniciais escritos pelo instalador | lido na inicialização |

O painel escreve nos dois primeiros, e eles têm prioridade sobre o `.env`. Por
isso **trocar um token não exige reiniciar o servidor** — o processo relê os
arquivos quando eles mudam. O `.env` continua servindo de ponto de partida e de
plano B.

Esses arquivos são todo o estado do painel: faça backup deles.

### Dois níveis de acesso

- **Master** — entra na administração e vê tudo.
- **Leitura** — só o relatório. Defina a “Senha de leitura” na aba Conexões e
  entregue para o cliente ou para quem não deve mexer em configuração. Quem
  entrar com ela não enxerga o link de administração nem as rotas de admin.

### Ainda dá para editar por SSH

O painel é a forma recomendada, mas os arquivos continuam legíveis e editáveis à
mão — útil para automação ou recuperação:

```bash
nano /home/deploy/marketing-dashboard/config/clients.json
```

---

## Histórico e coleta diária

Sem histórico próprio o painel só consegue mostrar o que as APIs devolvem no
momento: nada de comparar com o mesmo mês do ano passado, nada de projeção, e
períodos antigos somem quando a plataforma para de devolvê-los.

Por isso existe um banco local em **SQLite** (`config/data/dashboard.db`) e uma
coleta que roda **todo dia às 5h15** por cron.

### Como funciona

| | |
|---|---|
| **O que é gravado** | uma linha por campanha/dia (investimento, impressões, cliques, conversões, valor) e uma linha por negociação do CRM |
| **Janela de recoleta** | os últimos 7 dias, não só ontem — Meta e Google revisam números depois do fechamento e o CRM muda status de negociação antiga |
| **Idempotência** | recoletar o mesmo dia atualiza a linha em vez de duplicar, então reprocessar corrige o histórico |
| **Leitura** | `DATA_SOURCE_MODE=auto`: usa o histórico quando ele cobre o período pedido, e cai para as APIs quando não cobre |

Por que SQLite e não Postgres: o volume é pequeno — **90 dias de 8 clientes deram
20.644 linhas e 3,6 MB**, o que projeta ~15 MB/ano — e o SQLite dá conta com
folga (200 mil inserções em ~250 ms) sem um serviço a mais para instalar,
monitorar e fazer backup. Backup do painel inteiro é copiar dois arquivos e uma
pasta.

### No painel

**Administração → Dados** mostra a cobertura por cliente (de que dia até que
dia, quantas linhas), o log das últimas coletas com erro quando houver, e três
botões: coletar a janela padrão, backfill de 90 dias e backfill de 365 dias.

### Pela linha de comando

```bash
# a mesma chamada que o cron faz
curl -fsS -X POST -H "Authorization: Bearer $COLLECT_TOKEN" \
  "http://127.0.0.1:3333/api/collect?days=7"

# backfill de um cliente específico
curl -fsS -X POST -H "Authorization: Bearer $COLLECT_TOKEN" \
  "http://127.0.0.1:3333/api/collect?client=isentei&days=365"

# ver o agendamento
sudo -u deploy crontab -l
# último resultado
cat /home/deploy/marketing-dashboard/coleta.log
```

O `COLLECT_TOKEN` é gerado pelo instalador e fica no `.env`.

---

## Construtor de relatórios

Um relatório é uma **lista ordenada de blocos**. Em **Administração →
Relatórios** você escolhe quais entram, em que ordem e com que título — a mesma
dinâmica do Looker Studio.

O que não copiamos do Looker: o canvas livre com posicionamento em pixel. Custa
caro de construir e o resultado costuma ficar pior que uma grade responsiva,
que continua legível no celular e na impressão.

### Blocos disponíveis

| Bloco | O que mostra |
|---|---|
| Indicadores | Cards de KPI — você escolhe quais, quantas colunas e o tamanho |
| Leitura do período | Avisos automáticos a partir dos números |
| Investimento por dia | Barras empilhadas por canal |
| Leads e vendas por dia | Linhas de negociações criadas e ganhas |
| CPL por dia | Custo por lead diário, com a linha de meta |
| Funil | Do clique à venda, pela taxa de passagem |
| Canais | Meta Ads e Google Ads lado a lado |
| Negociações por etapa | Etapas do funil do CRM |
| Origem dos leads | Agrupado por utm_source |
| Alertas | Regras que dispararam no período, do histórico gravado |
| Orgânico — indicadores | Sessões, busca, redes e Meu Negócio, conforme as fontes conectadas |
| Orgânico — tráfego do site | Sessões e usuários por dia, pelo GA4 |
| Orgânico — canais | De onde vem o tráfego: busca, direto, social, referência |
| Orgânico — busca | Search Console: evolução, termos e páginas |
| Orgânico — redes sociais | Seguidores, alcance e engajamento por rede |
| Orgânico — situação das fontes | O que está conectado e o que falta |
| Criativos | Miniatura, desempenho e link de cada anúncio |
| Campanhas | Tabela ordenável |
| **Texto livre** | Comentário da agência, contexto do mês, próximos passos |

No bloco de Indicadores dá para escolher qualquer KPI base, qualquer métrica
personalizada, ou marcar **“Todas as personalizadas”** — assim uma métrica nova
entra no relatório sozinha, sem precisar editar o template.

Blocos de gráfico em sequência **dividem a linha automaticamente** em telas
largas. Quem monta o relatório não precisa declarar largura de bloco.

### Templates globais e do cliente

| Escopo | Vale para | Quem edita |
|---|---|---|
| **Global** | todos os clientes | conta master |
| **Do cliente** | só aquele cliente | conta master |

Cada escopo pode ter um **padrão** (a estrela na lista), e o do cliente ganha do
global. A resolução é: template pedido na URL → padrão do cliente → padrão
global → layout de fábrica.

Isso cobre os dois usos do dia a dia: um layout global que serve para todo mundo
e, quando um cliente pede algo diferente, **Duplicar** + trocar o escopo para
ele = "salvar como template do cliente".

Quem tem acesso master vê um seletor de modelo no topo do relatório e pode
alternar entre os disponíveis; quem tem acesso de leitura abre direto no padrão.

O botão **Ver no relatório** abre o template em uma aba nova, com dados reais.

Tudo fica em `config/reports.json`. Sem esse arquivo, o painel usa o layout de
fábrica — o relatório nunca fica em branco por falta de configuração.

---

## Métricas personalizadas

Em **Administração → Métricas** você cria indicadores próprios com fórmula, e
eles viram cards na seção “Métricas personalizadas” do relatório — com
comparação contra o período anterior e meta, como qualquer outro KPI.

```
(receita - investimento) / investimento     margem sobre investimento
investimento / dias                         ritmo diário de gasto
oportunidades / leads                       taxa de qualificação
investimento / oportunidades                custo por oportunidade
```

### Campos disponíveis

`investimento`, `impressoes`, `cliques`, `leads`, `leads_plataforma`,
`oportunidades`, `vendas`, `perdidas`, `receita`, `valor_plataforma`, `dias`.

Operações: `+ - * / ( )` e as funções `min`, `max`, `abs`, `round`.

### Como a fórmula é avaliada

Sem `eval` e sem `new Function`. A fórmula vem de um formulário web e, avaliada
com qualquer um dos dois, viraria execução de código arbitrário no servidor.
Aqui ela é tokenizada, convertida para notação polonesa reversa e avaliada
sobre uma tabela de variáveis conhecidas — nada além de aritmética sobre os
campos do catálogo é possível. `require("fs")`, `process.exit(1)`,
`constructor` e afins são recusados na validação, antes de salvar.

Divisão por zero devolve **vazio, não infinito**: um custo por lead sem nenhum
lead é indefinido, não infinito.

### Testar antes de salvar

O botão **Testar** roda a fórmula contra os números reais dos últimos 30 dias e
mostra o resultado. É a diferença entre “a sintaxe está certa” e “o número faz
sentido”.

Cada métrica pode valer para todos os clientes ou só para alguns, e pode ser
desativada sem ser apagada. Tudo fica em `config/metrics.json`, relido quando o
arquivo muda.

---

## Análise por IA

O bloco **Análise por IA** lê os números do período e escreve a leitura
estratégica: o que aconteceu, por quê, e a ação recomendada para cada achado.

### Três provedores, sua chave

| Provedor | Modelo padrão | Onde pegar a chave |
|---|---|---|
| **Claude** (Anthropic) | `claude-opus-5` | console.anthropic.com |
| **GPT** (OpenAI) | `gpt-4o` | platform.openai.com |
| **Gemini** (Google) | `gemini-2.0-flash` | aistudio.google.com |

Configure em **Administração → Conexões → Análise por IA**: escolha o provedor,
cole a chave e, se quiser, troque o modelo. A cobrança vai direto para a sua
conta no provedor — o painel não intermedeia nada.

Cada provedor também aceita uma **URL base alternativa**, para quem passa por
Azure OpenAI, gateway corporativo ou proxy.

### O que é enviado — e o que não é

Só agregados: KPIs com variação e meta, canais, funil, as 12 maiores campanhas,
etapas do CRM, origens de lead e a evolução semanal. **Nome, e-mail e telefone
de lead nunca saem do servidor** — a análise é sobre números de campanha e
funil, e mandar dado pessoal para uma API de terceiro seria risco sem
contrapartida.

A série diária vira semanal antes de sair: 90 pontos de ruído diário custam
token e atrapalham a leitura de tendência.

### Custo sob controle

- **Geração sob demanda**, no botão — nada é gerado ao abrir o relatório.
- **Cache por conteúdo**: mesmos números, mesma análise. Só gera de novo quando
  os dados mudam ou quando você clica em "Gerar de novo". Padrão de 6 h,
  ajustável em `AI_CACHE_SECONDS`.
- **Só a conta master gera.** Quem tem acesso de leitura vê a análise já
  gerada, mas não dispara chamadas novas.

### Instruções extras

O campo **Instruções extras** entra no prompt junto com os números. Serve para
o que só você sabe: sazonalidade do setor, meta do trimestre, o que não
recomendar, o tom que o cliente espera.

O bloco pode ser posicionado em qualquer lugar do relatório pelo construtor, e
sai de qualquer template do cliente onde não fizer sentido.

---

## Alertas

O dashboard avisa quando um número sai do lugar, em vez de esperar alguém abrir
o relatório e reparar. As regras ficam em **Administração › Alertas** e são
gravadas em `config/alerts.json`.

### Como uma regra é montada

Uma regra é sempre a mesma frase: *esta fórmula, nesta janela, passou deste
limiar*. Os campos são:

| Campo | Para que serve |
|---|---|
| Escopo | `cliente` avalia o total do período; `campanha` avalia uma campanha por vez |
| Fórmula | Mesmo catálogo e mesma sintaxe das métricas personalizadas |
| Janela | Quantos dias entram na conta (1, 3, 7, 14 ou 30) |
| Operador e limiar | `>`, `>=`, `<` ou `<=` contra um número |
| Severidade | Crítico, Atenção ou Informativo — define a cor no relatório |
| Gasto mínimo | Só no escopo de campanha: ignora as que gastaram pouco |
| Clientes | Nenhum marcado = vale para todos |
| Mensagem | Aceita `{valor}`, `{limiar}`, `{cliente}` e `{campanha}` |

Cada regra é avaliada na **sua própria janela**: uma regra de 7 dias e outra de
30 rodam contra períodos diferentes, sem misturar.

### Regra por cliente, sem limiar por cliente

A fórmula enxerga as metas cadastradas no cliente — `meta_cpl`, `meta_roas`,
`meta_investimento` e `meta_leads`. Assim uma regra só serve para a carteira
inteira:

```
(investimento / leads) / meta_cpl   >   1.2
```

Isso é “CPL 20% acima da meta **deste** cliente”, com um limiar único. Cliente
sem meta cadastrada faz a conta virar indefinida — e regra sem resultado não
dispara. Divisão por zero também não dispara: um CPL sem nenhum lead **não**
vira alerta de “CPL baixo”.

### O que já vem configurado

| Regra | Escopo | Dispara quando |
|---|---|---|
| CPL acima da meta | Cliente | CPL de 7 dias passa de 1,2× a meta |
| Campanha gastando sem gerar lead | Campanha | Gastou mais de R$ 300 em 7 dias sem um lead |
| CTR baixo | Campanha | CTR de 14 dias abaixo de 0,5%, com gasto acima de R$ 200 |
| ROAS abaixo da meta | Cliente | ROAS de 30 dias abaixo de 0,8× a meta |
| Ritmo de verba acima do previsto | Cliente | Projeção do mês passa de 1,15× o orçamento |
| Leads parados no CRM | Cliente | Menos de 10% dos leads viraram oportunidade em 14 dias |

Ajuste os limiares para a sua operação — os que vêm de fábrica são um ponto de
partida, não um consenso de mercado.

### Quando as regras rodam

Junto com a coleta diária, logo depois de gravar os números do dia — não gastam
chamada de API a mais, porque leem do histórico. O botão **Rodar agora** faz a
mesma avaliação na hora, contra o que já está no banco.

Uma regra dispara **no máximo uma vez por dia** por cliente (ou por campanha).
Rodar duas vezes no mesmo dia não duplica nada nem reenvia o webhook.

### Para onde os alertas vão

- **Bloco “Alertas”** no relatório, posicionável como qualquer outro bloco.
- **Histórico** dos últimos 30 dias na aba Alertas.
- **Webhook**, se `ALERT_WEBHOOK_URL` estiver preenchido em Conexões › Alertas.

O webhook recebe um POST com JSON por alerta:

```json
{
  "tipo": "alerta",
  "severidade": "critico",
  "cliente": "Isentei",
  "clienteId": "isentei",
  "regra": "CPL acima da meta",
  "titulo": "CPL acima da meta",
  "detalhe": "O CPL dos últimos 7 dias está 1,67x a meta do cliente. …",
  "valor": 1.6727322580645165,
  "limiar": 1.2,
  "data": "2026-09-08",
  "texto": "[CRITICO] Isentei — CPL acima da meta: O CPL dos últimos 7 dias …"
}
```

O campo `texto` já vem pronto para quem só repassa a mensagem adiante — cole a
URL de um webhook do Slack, do Discord ou de um fluxo do n8n e nada mais
precisa ser feito. Uma falha no envio não derruba os demais alertas nem a
coleta; ela aparece no resultado da execução.

---

## Tráfego orgânico

Mídia paga responde "quanto custou o lead". Orgânico responde "o que o cliente
construiu que não depende de verba". São fontes diferentes, então o orgânico tem
o seu próprio payload, os seus próprios blocos e o seu próprio template — o
**Tráfego orgânico**, que já vem pronto e pode virar o relatório de um cliente
ou entrar no relatório completo bloco a bloco.

### As cinco fontes

| Fonte | Conector Windsor | O que traz |
|---|---|---|
| Google Analytics 4 | `googleanalytics4` | Sessões, usuários, engajamento e conversões, por canal |
| Google Search Console | `searchconsole` | Cliques, impressões, CTR e posição média, por consulta e por página |
| Instagram | `instagram` | Seguidores, alcance, impressões e engajamento |
| Facebook orgânico | `facebook_organic` | Alcance, impressões e engajamento da página |
| Google Meu Negócio | `google_my_business` | Visualizações do perfil e ações (ligar, rota, site) |

As contas de cada fonte ficam no cliente, em **Administração › Clientes**. Fonte
sem conta cadastrada não é consultada para aquele cliente.

### Os IDs de campo ainda não foram conferidos

Vale dizer com todas as letras: os IDs de campo destas cinco fontes **são
palpites informados, não valores validados**. Os conectores de Meta Ads e Google
Ads foram conferidos campo a campo contra o `get_fields` da Windsor, porque as
contas estão conectadas. Nas fontes de orgânico não há conta conectada, e a
Windsor recusa listar os campos de um conector sem conta.

Por isso o mapa de campos é um arquivo (`config/organic.json`) e não código:

1. Conecte a conta na Windsor (o link está em cada fonte na aba Orgânico).
2. Abra **Administração › Orgânico** e clique em **Conferir campos**.
3. A tela mostra o que o conector devolveu de verdade e lista o que o mapa pede
   e não veio.
4. Corrija os IDs errados no próprio formulário e marque a fonte como **Ativa**.

Nada disso exige rebuild nem reinício. O diagnóstico também responde direto em
`GET /api/organic-check?days=7` (só conta master).

### Enquanto nada está conectado

Sem nenhuma fonte ativa, os blocos mostram **dados de demonstração** com um aviso
explícito. É proposital: assim dá para desenhar e aprovar o relatório antes de
ter as contas, e ninguém confunde demonstração com número real. Bloco cuja fonte
não existe não mostra zero — mostra o que precisa ser conectado.

### Coleta e histórico

O orgânico entra na mesma coleta diária da mídia e do CRM, gravado em
`organic_daily`. Duas regras de cálculo que valem a pena conhecer:

- **Seguidores é estoque, não fluxo.** Somar dia a dia daria um número sem
  sentido; o relatório usa o valor do último dia do período.
- **Posição média é ponderada por impressões.** Média simples de posições de
  consultas diferentes daria um número errado — a consulta com 5 impressões
  pesaria igual à com 5.000.

E o Search Console devolve consultas e páginas na mesma fonte: as páginas (que
começam com `/`) ficam fora do total de cliques, senão cada clique contaria duas
vezes.

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
| Leads e vendas zerados num cliente | token de CRM ausente — abra Administração → Clientes e use o botão **Testar CRM** |
| `401` no `/api/crm-check` | token do RD errado, ou de outra conta que não a do cliente |
| Todos os clientes com os mesmos leads | vários clientes usando o `RD_CRM_TOKEN` global; separe por `rdCrmTokenEnv` ou por `rdCrmPipelines` |
| Origem "não identificado" na maioria dos leads | as negociações não têm fonte nem `utm_source`; configure o campo personalizado e aponte em `RD_UTM_SOURCE_FIELD` |
| ROAS "—" na campanha | nenhum lead do CRM casou com a campanha (falta `utm_campaign` na negociação) |
| Não consigo entrar | redefina a senha master com `scripts/set-password.mjs` (veja Primeiro acesso) |
| Relatório de um mês antigo vem vazio | o histórico ainda não cobre esse período — rode um backfill em Administração → Dados |
| Coleta falhando todo dia | veja o erro em Administração → Dados → Últimas coletas; quase sempre é token vencido |
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
│   ├── collector.ts              # coleta e grava os fatos no histórico
│   ├── metrics-formula.ts        # avaliador de fórmulas (sem eval)
│   ├── custom-metrics.ts         # métricas personalizadas
│   ├── reports.ts                # templates de relatório e resolução por cliente
│   ├── ai/                       # Claude, GPT e Gemini atrás da mesma interface
│   ├── db/                       # SQLite: schema, upserts, cobertura e log
│   └── cache.ts                  # cache TTL + deduplicação de chamadas
│   └── auth/                     # sessão assinada, hash de senha e guarda de rotas
├── src/app/admin/                # painel administrativo (conta master)
├── src/app/login/                # login e criação das credenciais master
├── src/app/api/overview/         # endpoint que monta o payload do painel
├── src/app/api/admin/            # clientes, credenciais, senha, estado e histórico
├── src/app/api/collect/          # dispara a coleta (painel ou cron)
├── src/app/api/crm-check/        # diagnóstico da integração com o CRM
├── scripts/set-password.mjs      # redefine a senha master pelo servidor
├── src/components/report/        # registro de blocos do relatório
└── src/components/               # UI, gráficos e painel admin
```
