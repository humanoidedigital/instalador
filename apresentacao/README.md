# Raio-X Comercial · Ribeker

Apresentação comercial com diagnóstico ao vivo, para usar na reunião de venda.
Segue o pitch original (raio-x comercial + marketing e tráfego pago, painel, empilhamento, planos, fechamento)
com a identidade da Ribeker. Um só motor e um arquivo por nicho.

## Como abrir

- **Arquivo único:** `dist/ribeker-apresentacao.html`. Abre com dois cliques no Chrome e funciona offline
  (só a fonte vem da internet; sem ela, usa a fonte do sistema). É esse arquivo que você leva para a reunião.
- **Versão de trabalho:** `index.html` (lê `marca.js`, `nichos/*.js` e `motor.js`). Depois de mudar qualquer
  arquivo, gere de novo o arquivo único:

  ```bash
  python3 build.py
  ```

## Roteiro (30 a 32 slides, conforme o nicho)

A história: quem é a Ribeker → a prova (marcas e cases) → os números do cliente → a solução e o investimento.

1. Capa · Especialista · Quem somos
2. Um método, vários segmentos (marcas em destaque) · 5 cases (Dua, Pata Negra, Multi Mármore, Isentei,
   IsenteJá + Isentoo)
3. "Agora, a sua {empresa}": nome, WhatsApp do lead e data (com a anotação "Venda direta" ou "Indicação · parceiro")
4. Raio-X em 7 telas: Vendas e Prospecção · Marketing e Tráfego Pago · Geração de Leads e Marketing · Ferramentas ·
   Atendimento e Follow-up · Resultados · Tempo, investimento e resultado
5. O que o diagnóstico mostrou: custo de esperar, "o que você empilhou sozinho" x estimativa da Ribeker, placar
6. Vendas Ribeker · No seu segmento · Ponte "dos cases para a sua {empresa}" (1 venda a mais paga a operação,
   com o ticket do raio-x) · Mkt · Ferramenta · Time
7. Resultado empilhado em 6 e 12 meses
8. Valores de mercado · Planos (sem fidelidade) · Fechamento
9. Salvar o raio-X: placar, respostas por área, custo de esperar, PDF e resumo

## Durante a reunião

| Tecla | O que faz |
|---|---|
| ← → ou espaço | Volta / avança |
| F | Tela cheia |
| E | Liga e desliga o modo edição |
| N | Mostra e esconde as notas do apresentador (fala de 30 s de cada case) |

- **Nicho:** o botão no canto inferior esquerdo troca o nicho. Também dá para abrir direto: `...html#escolas`, `...html#veiculos`.
- **Respostas:** clique para marcar e de novo para desmarcar. A resposta marcada fica sempre azul, inclusive a
  negativa: o julgamento aparece só no painel, não na frente do cliente durante as perguntas.
- **Salvamento:** fica gravado no navegador. Fechou sem querer? Abre de novo e continua.
- **Diagnósticos salvos:** "Novo diagnóstico" não apaga nada; o anterior vai para a lista "Diagnósticos salvos"
  (botão Nicho), com busca por nome ou WhatsApp, aproveitamento e data. "Abrir" retoma de onde parou, inclusive
  trocando de nicho. Pelo link do claude.ai, a lista também fica na área privada da sua conta e aparece em qualquer
  aparelho. No arquivo local ela fica só naquele navegador: use "Baixar cópia de segurança" e "Importar cópia" para
  levar a outro computador (e como backup, porque limpar os dados do navegador apaga a lista).
- **Perguntas condicionais:** algumas perguntas só aparecem quando fazem sentido. Quem "Não posta" nas redes não vê
  social mídia, estratégia, conteúdo, venda pelas redes e redes preparadas: elas valem "Não" sozinhas e aparecem assim
  no relatório, com o motivo. Sem CRM, "funil dentro do CRM" vira "Não". "Resultado com anúncio" some para quem nunca
  anunciou. Em veículos, "leads dos portais no CRM" só aparece para quem marcou Portais nas origens de lead.
  Em Genérico e Arquitetura, "Tem acesso às métricas do anúncio?" decide a tela de números do marketing (abaixo).
  No modo edição todas aparecem, com contorno amarelo nas condicionais.
- **Último slide:** "Relatório" e "Relatório + plano de ação" baixam o PDF (desenhado direto, com texto de verdade,
  funciona sem internet). "Copiar resumo" copia um texto para colar no WhatsApp ou no CRM. "Novo diagnóstico" começa
  o próximo cliente e guarda o atual em "Diagnósticos salvos".

## Nichos com funil: Genérico e Arquitetura

- **Genérico · vende por lead:** para quando aparece uma reunião sem preparo. O raio-x separa **Marketing** e **Vendas**
  (cada um com placar próprio) e mostra onde está o gargalo.
- **Escritórios de arquitetura:** o mesmo método com o funil do escritório (contato → briefing ou orçamento → contrato),
  perguntas de briefing, proposta, portfólio, parcerias e indicação. O id `arquitetura` liga sozinho a proteção do case Dua.
- Telas **Números do marketing** (verba, impressões, cliques, contatos) e **Números de vendas** (reuniões ou orçamentos,
  vendas, ticket) calculam na hora: **CPM, CTR, CPC, CPL, clique → lead, lead → reunião, reunião → venda, custo por
  reunião ou orçamento, CAC de mídia e ROAS**.
- Slide **"Onde o seu funil vaza"**: as etapas do anúncio à venda, a taxa entre elas e o veredito ("o gargalo maior
  está em Vendas. De 400 contatos, 40 viraram orçamentos e 4 viraram contratos").
- **Cliente sem métricas:** antes dos números vem "Tem acesso às métricas do anúncio?". **Sim**: aparecem impressões
  e cliques. **Não tem ou não sabe**: impressões e cliques somem (ficam fora das contas, sem inventar número) e entram
  4 perguntas simples de triagem: o anúncio traz contato novo todo dia? os contatos têm o perfil de cliente? sabe
  quanto custa cada contato? quem cuida dos anúncios? Elas pontuam no Marketing e vão para o plano de ação. O funil
  começa nos contatos, com a nota "sem as métricas do anúncio... medir é o primeiro passo do plano". Para quem não
  anuncia, a pergunta nem aparece.
- Só CTR e clique → lead têm referência pública e pontuam (verde: igual ou acima; amarelo: até 30% abaixo; vermelho:
  mais que isso). Os outros dependem do ticket e do ciclo de cada negócio e aparecem sem julgamento.

| Indicador | Genérico | Arquitetura | Fonte |
|---|---|---|---|
| CTR (anúncio de lead no Meta) | 2,70% | 2,14% (casa e reforma) | LocaliQ/WordStream, Facebook Ads Benchmarks 2026 |
| Clique → lead | 8,54% | 5,32% (casa e reforma) | LocaliQ/WordStream 2026; no Brasil, landing pages: 11% (RD Station, dados de 2025) |
| Mercado de arquitetura | | 85% das obras sem arquiteto ou engenheiro | CAU/BR e Datafolha, 2015 |
| Honorário residencial | | R$ 60 a R$ 140 por m² | portais de orçamento, 2026 (sem valor oficial do CAU) |

Para outro nicho com funil, use `indicadores` e `funil` no arquivo do nicho, no modelo de `generico.js`.

## Cases e marcas

O slide de marcas mostra que o método não é de um nicho só: são destaques entre os mais de 20 clientes, de
segmentos diferentes, no Brasil e no exterior. Todas levam o selo "case" (`marcas.lista[].case: true`); as principais
têm slide próprio.

Os cases ficam em `cases.lista` no `marca.js`, na ordem recomendada (do mais simples ao mais completo, um degrau
da mesma escada em cada um): Dua (ticket alto, decisão pensada), Pata Negra (estratégia vale mais que verba),
Multi Mármore (showroom: passou a saber de onde vem cada venda), Isentei (operação completa) e IsenteJá + Isentoo
(do zero, o clímax). Campos opcionais: `tabela` (no lugar dos números) e `funil` (barras do lead à venda). Cada case segue o mesmo esqueleto:
gancho, antes, virada, resultado, moral, e uma linha `obs` dizendo de onde vem o número (ex.: "R$ 245 mil = 7 × R$ 35 mil").

- **Notas do apresentador (tecla N):** a versão falada de 30 segundos de cada case e da ponte. Não compartilhe a tela
  com as notas abertas. No modo edição elas aparecem sempre e dá para editar.
- **Ponte:** depois dos cases, a conversa volta para o cliente. A conta "1 venda a mais por mês já paga a operação
  inteira" é feita ao vivo com o ticket (e a margem) do raio-x contra o plano mais completo, sem mostrar o preço.
  Nenhum número dos cases entra na conta do cliente.
- **Gancho por nicho:** `{compraPensada}` ("Igual a quem compra carro") e `{temHoje}` ("loja que já tem nome e estoque")
  ficam em `termos` de cada nicho.
- Para trocar a ordem, mude a ordem em `cases.lista`. Para esconder um case num nicho: modo edição → Ocultar slide.
- Logo novo: salve em `assets/marcas/` e informe em `marcas.lista[].logo` e `cases.lista[].logos`.

## Parceiros (indicação)

No seletor (botão Nicho), escolha o nicho e, em **Parceiros**, se o cliente veio por indicação; depois clique em
**Começar a apresentação**. A ordem não importa: o parceiro vale **para a reunião inteira** (parceiro, nome e margem),
então trocar de nicho, mesmo para um nicho que já tinha diagnóstico, mantém o parceiro. Ele fica guardado também no
diagnóstico; o selo aparece ao lado do nicho, no rodapé.

**Conferência no slide dos dados do lead ("Agora, a sua {empresa}"):** abaixo dos dados do lead aparece, bem pequeno, **"Venda direta"** (cinza) ou
**"Indicação · Parceiro de social mídia (nome)"** (âmbar). Não é para escolher ali, é para conferir: se estiver errado,
clique na anotação e o seletor abre para corrigir.

**Parceiro de social mídia** (`parceiros/social-midia.js`): agência de social mídia que indica a Ribeker. Para não haver
conflito de interesse, a oferta sai sem social mídia:

- As perguntas de redes sociais saem do raio-x (`tema: 'social'`): não pontuam e não vão para o relatório, para o
  diagnóstico não julgar o trabalho do parceiro na frente do cliente.
- Social mídia não aparece em nenhum slide: "Vendas Ribeker" começa no tráfego pago (Tráfego pago → CRM / IA → Venda),
  o slide de marcas fica sem "Rede social" e o case IsenteJá + Isentoo mostra só site, tráfego, CRM, automação e IA
  (`casos` no arquivo do parceiro ajusta campos de um case pelo id, sem mexer no `marca.js`).
- Marketing vira "Tudo que o tráfego faz por você"; valores de mercado sem social mídia (total R$ 12.537/mês).
- Planos em dois slides:
  1. **"Planos de tráfego pago"**: a tabela de parceiros inteira (Tráfego pago · Tráfego + CRM · Tráfego + CRM +
     Performance comercial × 6 faixas de verba), já com a margem somada, com a faixa do cliente em destaque e o
     rodapé (verba de anúncios separada, relatório mensal, escopo padrão, projetos especiais) e a nota de contrato sem
     fidelidade. Acima de R$ 50 mil: sob consulta.
  2. **"O que entra em cada plano"**: os 3 cards da faixa do cliente, com o que cada plano inclui. Dá para trocar
     a faixa clicando nela.
  A faixa vem da verba informada no raio-x. A conta da ponte usa o plano mais completo da faixa.
- **Dados do parceiro e margem** (botão no seletor, com o parceiro ligado): nome do parceiro e a margem dele,
  em **% sobre o plano** ou **R$ fixo por plano**. O cliente vê só o preço final (tabela de parceiros + margem,
  arredondado para a dezena); a conta aparece só na janela e nas notas do slide de planos (tecla N).
  Os parceiros ficam num cadastro para reusar (e, pelo link do claude.ai, na sua conta).
- O nome do parceiro entra nos textos como `{parceiro}` (ex.: "clientes indicados por Agência X").
- "Novo diagnóstico" mantém o parceiro e a margem; para tirar, escolha "Venda direta".

Para criar outro estilo de parceiro, peça ao Claude Code: *"crie o parceiro X em apresentacao/parceiros/, no modelo de
social-midia.js, e registre no index.html"*. Qualquer chave de `marca.js` pode ser sobrescrita no parceiro.

## Proteção de concorrente

Apresentando para alguém do mesmo segmento de uma marca dos cases (ex.: um escritório de arquitetura e o case Dua)?
O logo vira "Cliente sob sigilo" no slide de marcas e **o case dela sai da apresentação inteiro**: sem o nome, os
números e a história ainda identificariam a empresa para quem conhece o mercado.

- **Automático por nicho:** cada marca tem `concorrentes` em `marcas.lista` (ex.: Dua: `arquitetura`, `interiores`).
  Se o id do nicho ou uma tag em `concorrencia` do nicho bater, a marca já começa protegida (no nicho Arquitetura,
  a Dua sai sozinha).
- **Manual, por reunião:** botão "Nicho" → "Proteção de concorrente" → clique na marca. Fica guardado no diagnóstico.
- Os outros cases continuam, renumerados ("Case 1 de 4").
- Se sobrar o nome de uma marca protegida em algum texto, ele é trocado por "cliente sob sigilo".

## Quando o lead não sabe o número

Na tela **Resultados** ninguém precisa saber taxa em %. As perguntas são simples (vendas por mês, contatos por mês,
ticket, investimento) e a apresentação calcula na hora a **conversão**, o **custo por lead** e o **custo por venda**,
mostrando ao lado a conversão média do mercado do nicho.

- **"Média do mercado"** (no ticket e, em veículos, na margem): preenche com a referência do nicho. O "i" mostra a fonte. O campo fica marcado
  como média de mercado no painel, nas projeções e no PDF, que lista todas as fontes usadas.
- **"Não sei"** (contatos): o campo fica fora das contas, sem inventar número.
- **"Não investe"** (anúncio): preenche 0.
- **"De onde vêm esses números?"**: se a resposta for "não sabemos", isso entra no placar e no plano de ação.

Referências atuais (todas com fonte no arquivo do nicho):

| Nicho | Referência | Fonte |
|---|---|---|
| Escolas | Idiomas R$ 500/mês (meio da faixa R$ 300–700) | WorldStudy, jun/2026 |
| Escolas | Faculdade presencial R$ 835 · EAD R$ 214 (medianas) | Hoper Educação e ABMES, 2026 |
| Escolas | Conversão lead → matrícula ~1,8% | Panorama RD Station 2025 |
| Veículos | Ticket médio dos seminovos R$ 88.030 | Megadealer/AutoAvaliar, mai/2025 |
| Veículos | Margem bruta 11% (10,8% a 11,2% em 2025, 2.492 revendas) | Megadealer/AutoAvaliar, 2025 |
| Veículos | Conversão lead → venda 3% | Followize/AutoForce, 2018 |

Para um nicho novo, peça ao Claude Code para pesquisar as médias com fonte e colocar em `medias` e `calculos`.

### Veículos: faturamento, ticket e margem (em vez de lucro)

O dono raramente sabe o lucro mensal de cabeça, mas sabe quanto fatura e o preço médio do carro. Por isso a tela
Resultados pergunta **ticket médio do veículo** e **margem** (com o botão da média de mercado, 11%), e a tela Tempo
pergunta **faturamento**. A apresentação converte em lucro com a margem: lucro por veículo = ticket × margem, e o custo
de esperar usa faturamento × margem (o texto mostra a margem usada e se ela é a média de mercado).
Para usar isso em outro nicho: `projecao.margem: { campo: 'margem', referencia: 11 }`.

### Valores de mercado (slide "Contratando cada peça separada")

| Peça | Valor | Fonte |
|---|---|---|
| Social mídia | R$ 3.000/mês | Glassdoor, salário médio no Brasil, 2026 |
| Gestor de tráfego pago | R$ 3.000/mês | Glassdoor, abr/2026 |
| Especialista em RevOps (orienta o time de vendas) | R$ 9.150/mês | Glassdoor, RevOps Specialist, jun/2026 |
| CRM com WhatsApp e IA, 3 usuários | R$ 387/mês | Kommo Avançado, R$ 129 por usuário (anual), 2026 |
| **Total** | **R$ 15.537/mês** | salários sem encargos e sem verba de anúncio |

## Editar sem programar (modo edição)

Aperte **E** ou clique em **Editar**. Todo texto com contorno tracejado pode ser alterado com um clique.

- `*palavra*` destaca em azul · `[texto]` marca o que falta preencher (aparece com contorno amarelo também na apresentação)
- `~~texto~~` deixa riscado (preço "de")
- `{venda}`, `{vendas}`, `{cliente}`, `{empresa}`, `{ticket}`, `{receita}` trocam pela palavra do nicho
- **Ocultar slide** esconde o slide atual só neste nicho
- **Baixar cópia** gera um novo `.html` com as suas edições dentro
- **Baixar alterações** gera um `.json` com o que você mudou. Para deixar fixo no projeto, entregue ao Claude Code:
  *"aplique este alteracoes-apresentacao.json em marca.js e nos nichos"*

## Criar um nicho novo com o Claude Code

Os nichos ficam em `nichos/`. `escolas.js` é o pitch original e o modelo comentado; `veiculos.js` mostra como adaptar.
Peça assim:

> Crie o nicho **clínicas de estética** em `apresentacao/nichos/`, seguindo a mesma estrutura de `veiculos.js`
> (as mesmas 7 telas do raio-x, adaptando as perguntas ao nicho). Termos: cliente = paciente, venda = procedimento fechado.
> A venda não é recorrente. Registre o arquivo no `index.html` e rode `python3 build.py`.

| Campo do nicho | Para que serve |
|---|---|
| `termos` | Palavras usadas nos textos da marca (`receita: 'lucro'` em veículos, por exemplo). Se `empresa` for masculino, use `generoEmpresa: 'm'` ("sua {empresa}" vira "seu escritório") |
| `capa.tagline`, `publico`, `perfis.itens`, `case` | Conteúdo dos slides deste nicho |
| `areas` | Áreas do placar. Só as que têm pergunta com peso entram na nota (Marketing e Tráfego Pago é informativo, como no original) |
| `raiox` | As telas do raio-x, com `campos` (números) e `perguntas` (com `dor` 0 / 0,5 / 1 e `acao` para o plano) |
| `perguntas[].id` e `depende` | Pergunta condicional: `depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' }` (explicado no topo de `escolas.js`). `exige: [1]` faz o contrário: só aparece com aquela resposta (triagem de quem não tem métricas) |
| `perguntas[].tema` | `tema: 'social'`: some quando o parceiro esconde esse tema (parceiro de social mídia) |
| `perguntas[].antesDosCampos` | A pergunta aparece antes dos números da tela (ex.: "Tem acesso às métricas do anúncio?") |
| `campos[].depende` | Campo condicional, com a mesma regra das perguntas. Campo escondido fica fora das contas |
| `perguntas[].area` | Faz uma pergunta pontuar em outra área (ex.: "anúncio rodando hoje" fica na tela de Marketing, mas pontua no Comercial) |
| `campos[].medias` | Botões de média do mercado: `{ t, v, fonte }` |
| `campos[].atalhos` | Botões rápidos: `{ t: 'Não sei', v: null }`, `{ t: 'Não investe', v: 0 }` |
| `raiox[].calculos.conversao` | Conversão média do mercado mostrada ao lado da calculada: `{ v, fonte }` |
| `projecao.recorrente` | `true`: o cliente paga todo mês (escola), a receita empilha. `false`: venda única (veículo), acumula |
| `projecao.multiplicador` e `conta` | Escolas: o dobro das matrículas, contando todas (`total`). Veículos: 50% a mais, contando só as vendas a mais (`extra`) |
| Qualquer chave de `marca.js` | Pode ser sobrescrita no nicho |

Ids de campo que entram nas contas: `vendas`, `ticket`, `leads`, `midia`, `meses`, `custo`, `receitaIni`, `receitaHoje`
(e o campo de margem, se o nicho tiver `projecao.margem`).

## Como as contas funcionam (iguais ao original)

- **Placar:** cada resposta vale 0 (estruturado), 0,5 (parcial) ou 1 (ponto de atenção). Aproveitamento = 100% − média.
  Abaixo de 34% é crítico; até 65%, atenção; acima, sob controle. Funis de lead: 3 ou mais = estruturado, 2 = parcial, 1 = atenção.
- **Custo de esperar:** com meses, custo mensal e receita no início e hoje, o ganho sobe em rampa
  (incremento × m(m+1)/2). Saldo = ganho acumulado − investido. A tabela mês a mês destaca o mês do payback.
- **Empilhamento:** clientes novos por mês × ticket. Recorrente: o mês m soma m levas (6 meses = 21 × a base; 12 meses = 78 ×).
  Venda única: acumula (6 meses = 6 × a base).
- **Painel, "O que você somou a mais, sozinho":** o quanto o {receita} mensal subiu entre o início e hoje, somado mês a mês
  em rampa (no 1º mês um pouco a mais, no último a diferença inteira). **"A estimativa com a Ribeker"**: a base da projeção
  × ticket, somada no mesmo prazo. As duas contas aparecem escritas embaixo dos números, e as notas (tecla N) do painel e
  do empilhamento trazem como explicar.

## Antes da primeira reunião

Já preenchido a partir do PDF Revenue Operations: foto, números e frase do fundador, posicionamento, cases (Dua, Pata Negra, Multi Mármore, Isentei, IsenteJá e Isentoo) e IA no WhatsApp.
Valores de mercado preenchidos com fonte (tabela acima).
Ainda opcional:

- O slide do acordo com bônus ("Vamos pro tudo") fica oculto (`ocultar: ['garantia']`), porque não faz parte da operação.
- Logos das marcas: já estão em `assets/marcas/`. Para trocar ou incluir, informe em `marcas.lista[].logo` (sem logo aparece o nome).
- Prints: `mkt.imagem` (Instagram de cliente) e `ferramenta.imagem` (pipeline no CRM), opcionais.

## Arquivos

```
apresentacao/
  index.html        página (estrutura e visual)
  motor.js          lógica: slides, raio-x, contas, edição, PDF
  marca.js          pitch e dados da Ribeker, iguais em todo nicho
  nichos/*.js       um arquivo por nicho
  parceiros/*.js    estilos de parceiro (indicação), por cima do nicho
  assets/           logo e imagens
  vendor/           biblioteca do PDF (jsPDF), para funcionar offline
  build.py          gera dist/ribeker-apresentacao.html
```
