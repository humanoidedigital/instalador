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

## Roteiro (26 slides)

1. Capa · Especialista · Quem somos
2. Antes de tudo: nome, WhatsApp do lead e data
3. Raio-X em 7 telas: Vendas e Prospecção · Marketing e Tráfego Pago · Geração de Leads e Marketing · Ferramentas ·
   Atendimento e Follow-up · Resultados · Tempo, investimento e resultado
4. O que o diagnóstico mostrou: custo de esperar, "o que você empilhou sozinho" x estimativa da Ribeker, placar
5. Vendas Ribeker · Quem atendemos · Marcas que já rodam com a gente · Case Isentei · Mkt · Ferramenta · Time
6. Resultado empilhado em 6 e 12 meses
7. Valores de mercado · Planos · Acordo · Fechamento
8. Salvar o raio-X: placar, respostas por área, custo de esperar, PDF e resumo

## Durante a reunião

| Tecla | O que faz |
|---|---|
| ← → ou espaço | Volta / avança |
| F | Tela cheia |
| E | Liga e desliga o modo edição |

- **Nicho:** o botão no canto inferior esquerdo troca o nicho. Também dá para abrir direto: `...html#escolas`, `...html#veiculos`.
- **Respostas:** clique para marcar e de novo para desmarcar. A resposta marcada fica sempre azul, inclusive a
  negativa: o julgamento aparece só no painel, não na frente do cliente durante as perguntas.
- **Salvamento:** fica gravado no navegador, separado por nicho. Fechou sem querer? Abre de novo e continua.
- **Último slide:** "Relatório" e "Relatório + plano de ação" geram o PDF. "Copiar resumo" copia um texto para colar
  no WhatsApp ou no CRM. "Novo diagnóstico" zera para o próximo cliente.

## Quando o lead não sabe o número

Na tela **Resultados** ninguém precisa saber taxa em %. As perguntas são simples (vendas por mês, contatos por mês,
ticket, investimento) e a apresentação calcula na hora a **conversão**, o **custo por lead** e o **custo por venda**,
mostrando ao lado a conversão média do mercado do nicho.

- **"Média do mercado"** (no ticket): preenche com a referência do nicho. O "i" mostra a fonte. O campo fica marcado
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
| Veículos | Lucro bruto ~R$ 9.700 por veículo (11% de R$ 88.030) | Megadealer/AutoAvaliar, mai/2025 |
| Veículos | Conversão lead → venda 3% | Followize/AutoForce, 2018 |

Para um nicho novo, peça ao Claude Code para pesquisar as médias com fonte e colocar em `medias` e `calculos`.

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
| `termos` | Palavras usadas nos textos da marca (`receita: 'lucro'` em veículos, por exemplo) |
| `capa.tagline`, `publico`, `perfis.itens`, `case` | Conteúdo dos slides deste nicho |
| `areas` | Áreas do placar. Só as que têm pergunta com peso entram na nota (Marketing e Tráfego Pago é informativo, como no original) |
| `raiox` | As telas do raio-x, com `campos` (números) e `perguntas` (com `dor` 0 / 0,5 / 1 e `acao` para o plano) |
| `campos[].medias` | Botões de média do mercado: `{ t, v, fonte }` |
| `campos[].atalhos` | Botões rápidos: `{ t: 'Não sei', v: null }`, `{ t: 'Não investe', v: 0 }` |
| `raiox[].calculos.conversao` | Conversão média do mercado mostrada ao lado da calculada: `{ v, fonte }` |
| `projecao.recorrente` | `true`: o cliente paga todo mês (escola), a receita empilha. `false`: venda única (veículo), acumula |
| `projecao.multiplicador` e `conta` | Escolas: o dobro das matrículas, contando todas (`total`). Veículos: 50% a mais, contando só as vendas a mais (`extra`) |
| Qualquer chave de `marca.js` | Pode ser sobrescrita no nicho |

Ids de campo que entram nas contas: `vendas`, `ticket`, `leads`, `midia`, `meses`, `custo`, `receitaIni`, `receitaHoje`.

## Como as contas funcionam (iguais ao original)

- **Placar:** cada resposta vale 0 (estruturado), 0,5 (parcial) ou 1 (ponto de atenção). Aproveitamento = 100% − média.
  Abaixo de 34% é crítico; até 65%, atenção; acima, sob controle. Funis de lead: 3 ou mais = estruturado, 2 = parcial, 1 = atenção.
- **Custo de esperar:** com meses, custo mensal e receita no início e hoje, o ganho sobe em rampa
  (incremento × m(m+1)/2). Saldo = ganho acumulado − investido. A tabela mês a mês destaca o mês do payback.
- **Empilhamento:** clientes novos por mês × ticket. Recorrente: o mês m soma m levas (6 meses = 21 × a base; 12 meses = 78 ×).
  Venda única: acumula (6 meses = 6 × a base).

## Antes da primeira reunião

Já preenchido a partir do PDF Revenue Operations: foto, números e frase do fundador, posicionamento, case Isentei e IA no WhatsApp.
O que ainda está entre colchetes:

- `marca.js`: segmento da Univerplast, as outras duas pessoas do time, valores de mercado e bônus do acordo.
- Logos das marcas: coloque em `assets/marcas/` e informe em `marcas.lista[].logo` (sem logo aparece o nome).
- Prints: `mkt.imagem` (Instagram de cliente) e `ferramenta.imagem` (pipeline no CRM), opcionais.

## Arquivos

```
apresentacao/
  index.html        página (estrutura e visual)
  motor.js          lógica: slides, raio-x, contas, edição, PDF
  marca.js          pitch e dados da Ribeker, iguais em todo nicho
  nichos/*.js       um arquivo por nicho
  assets/           logo e imagens
  vendor/           bibliotecas do PDF (html2canvas, jsPDF), para funcionar offline
  build.py          gera dist/ribeker-apresentacao.html
```
