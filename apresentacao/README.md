# Raio-X de Receita · Ribeker

Apresentação comercial dinâmica com diagnóstico ao vivo, para usar em reunião de venda.
Um só motor (visual, animações, perguntas, placar, projeção, relatório) e um arquivo por nicho.

## Como abrir

- **Arquivo único:** `dist/ribeker-apresentacao.html`. Abre com dois cliques no Chrome, funciona offline
  (só a fonte vem da internet; sem ela, usa a fonte do sistema). É esse arquivo que você manda ou leva para a reunião.
- **Versão de trabalho:** `index.html` (lê `marca.js`, `nichos/*.js` e `motor.js`). Depois de mudar qualquer
  arquivo, gere de novo o arquivo único:

  ```bash
  python3 build.py
  ```

## Durante a reunião

| Tecla | O que faz |
|---|---|
| ← → ou espaço | Volta / avança |
| F | Tela cheia |
| E | Liga e desliga o modo edição |
| Esc | Sai do modo edição |

- **Nicho:** o botão no canto inferior esquerdo troca o nicho. Também dá para abrir direto: `...html#escolas`, `...html#veiculos`.
- **Respostas:** clique para marcar e clique de novo para desmarcar. A resposta marcada fica sempre azul, inclusive a negativa: o julgamento aparece só no painel de resultado, não na frente do cliente durante as perguntas.
- **Salvamento:** tudo fica gravado no navegador, separado por nicho. Fechou sem querer? Abre de novo e continua.
- **Último slide:** "Relatório" e "Relatório + plano de ação" geram o PDF. "Copiar resumo" copia um texto pronto para colar no WhatsApp ou no CRM. "Novo diagnóstico" zera para o próximo cliente.

## Editar sem programar (modo edição)

Aperte **E** ou clique em **Editar**. Todo texto com contorno tracejado pode ser alterado com um clique.

- `*palavra*` destaca em azul.
- `[texto]` marca o que falta preencher. Aparece com contorno amarelo **também na apresentação**, para você não esquecer.
- `~~texto~~` deixa riscado (preço "de").
- `{venda}`, `{vendas}`, `{cliente}`, `{empresa}`, `{ticket}` trocam pela palavra do nicho
  (escola: "matrícula", "aluno"; veículos: "venda", "comprador"). Com maiúscula: `{Venda}`, `{Empresa}`.
- **Ocultar slide** esconde o slide atual só neste nicho.
- **Baixar cópia** gera um novo `.html` com as suas edições já dentro.
- **Baixar alterações** gera um `.json` com só o que você mudou. Para deixar as mudanças fixas no projeto,
  entregue esse arquivo ao Claude Code: *"aplique este alteracoes-apresentacao.json em marca.js e nos nichos"*.

As edições ficam neste navegador. Em outro computador, use a cópia baixada.

## Criar um nicho novo com o Claude Code

Os nichos ficam em `nichos/`. `escolas.js` é o modelo comentado. Peça assim:

> Crie o nicho **clínicas de estética** em `apresentacao/nichos/`, seguindo o modelo de `escolas.js`.
> Termos: cliente = paciente, venda = procedimento fechado, ticket = valor médio do procedimento.
> A receita não é recorrente. Use 4 áreas no raio-x com 4 ou 5 perguntas cada, cada pergunta com a sua ação.
> Registre o arquivo no `index.html` e rode `python3 build.py`.

O que muda de um nicho para outro:

| Campo | Para que serve |
|---|---|
| `termos` | Palavras usadas em todos os textos da marca |
| `publico`, `perfis.itens` | Chips de "Quem atendemos" e o slide perfil → dor |
| `categorias` | As telas do raio-x: perguntas, pesos (`dor`) e ação do plano |
| `projecao.recorrente` | `true` quando o cliente paga todo mês (escola, academia, SaaS): a receita empilha. `false` para venda única (veículo, imóvel) |
| `projecao.ganho` | Quanto a mais de vendas o método traz com os mesmos leads (0.3 = +30%) |
| `projecao.referencia` | Números usados enquanto o cliente não informa os dele |
| Qualquer chave de `marca.js` | Pode ser sobrescrita no nicho (planos, case, textos) |

## Como as contas funcionam

- **Aproveitamento comercial:** cada resposta vale 0 (bom), 0,5 (atenção) ou 1 (problema). A média de cada área
  vira `100% − média`. O placar geral é a média das áreas. Abaixo de 34% é crítico; de 34% a 65%, atenção; de 66% em diante, sob controle.
- **Leads na mesa:** conversão = vendas ÷ leads. Cada +1 ponto de conversão = leads × 1% × ticket.
- **Projeção:** vendas a mais por mês = vendas de hoje × ganho. Em nicho recorrente, cada mês soma os clientes
  novos de todos os meses anteriores. Em venda única, acumula mês a mês.
- **Custo de esperar:** compara o crescimento da receita nos meses informados (somado mês a mês) com a projeção
  do método no mesmo prazo.

Toda projeção aparece com a etiqueta "Estimativa".

## Antes da primeira reunião

Os campos entre colchetes ainda precisam do seu conteúdo:

- `marca.js`: cargo, cidade e números do especialista, números de "Quem somos", time, valores de mercado, planos e preços, garantia, bônus, contato.
- Case de cada nicho (`case` em `nichos/*.js`), com o print do resultado em `assets/`.
- Foto: coloque em `assets/` e informe o caminho em `especialista.foto` (ex.: `'assets/lucas.jpg'`).

## Arquivos

```
apresentacao/
  index.html        página (estrutura e visual)
  motor.js          lógica: slides, raio-x, cálculos, edição, PDF
  marca.js          textos e dados da Ribeker, iguais em todo nicho
  nichos/*.js       um arquivo por nicho
  assets/           logo e imagens
  vendor/           bibliotecas do PDF (html2canvas, jsPDF), para funcionar offline
  build.py          gera dist/ribeker-apresentacao.html
```
