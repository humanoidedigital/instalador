/**
 * Avaliador de fórmulas das métricas personalizadas.
 *
 * Não usa `eval` nem `new Function`: a fórmula vem de um formulário web e
 * acabaria virando execução de código arbitrário no servidor. Aqui ela é
 * tokenizada, convertida para notação polonesa reversa (shunting-yard) e
 * avaliada sobre uma tabela de variáveis conhecidas — nada além de aritmética
 * sobre os campos do catálogo é possível.
 */

export interface VariableDefinition {
  id: string;
  label: string;
  description: string;
}

/**
 * Campos disponíveis nas fórmulas. Nomes em português porque quem escreve a
 * fórmula é quem opera a conta, não quem mantém o código.
 */
export const FORMULA_VARIABLES: VariableDefinition[] = [
  { id: "investimento", label: "Investimento", description: "Gasto em mídia no período (Meta + Google)." },
  { id: "impressoes", label: "Impressões", description: "Impressões somadas das plataformas." },
  { id: "cliques", label: "Cliques", description: "Cliques somados das plataformas." },
  { id: "leads", label: "Leads", description: "Negociações criadas no CRM." },
  { id: "leads_plataforma", label: "Leads das plataformas", description: "Conversões reportadas pelo Meta e pelo Google." },
  { id: "oportunidades", label: "Oportunidades", description: "Negociações que passaram da triagem inicial." },
  { id: "vendas", label: "Vendas", description: "Negociações ganhas." },
  { id: "perdidas", label: "Perdidas", description: "Negociações perdidas." },
  { id: "receita", label: "Receita", description: "Valor das negociações ganhas." },
  { id: "valor_plataforma", label: "Valor de conversão", description: "Valor de conversão reportado pelas plataformas." },
  { id: "dias", label: "Dias", description: "Quantidade de dias do período selecionado." },
  { id: "meta_cpl", label: "Meta de CPL", description: "CPL alvo do cliente. Vazio faz a conta virar indefinida." },
  { id: "meta_roas", label: "Meta de ROAS", description: "ROAS alvo do cliente." },
  { id: "meta_investimento", label: "Meta de investimento", description: "Investimento planejado no mês." },
  { id: "meta_leads", label: "Meta de leads", description: "Leads planejados no mês." },
];

const VARIABLE_IDS = new Set(FORMULA_VARIABLES.map((variable) => variable.id));

/** Funções permitidas. Deliberadamente poucas — nada de acesso a objeto. */
const FUNCTIONS: Record<string, (args: number[]) => number> = {
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  abs: (args) => Math.abs(args[0]),
  round: (args) => Math.round(args[0]),
};

type Token =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "function"; name: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "u-" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

export class FormulaError extends Error {}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3 };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < formula.length) {
    const char = formula[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let raw = "";
      while (index < formula.length && /[0-9.]/.test(formula[index])) {
        raw += formula[index];
        index += 1;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new FormulaError(`Número inválido: "${raw}".`);
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let name = "";
      while (index < formula.length && /[a-zA-Z0-9_]/.test(formula[index])) {
        name += formula[index];
        index += 1;
      }
      const lower = name.toLowerCase();
      if (FUNCTIONS[lower]) {
        tokens.push({ type: "function", name: lower });
      } else if (VARIABLE_IDS.has(lower)) {
        tokens.push({ type: "variable", name: lower });
      } else {
        throw new FormulaError(
          `Campo desconhecido: "${name}". Use um dos disponíveis: ${FORMULA_VARIABLES.map((v) => v.id).join(", ")}.`,
        );
      }
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      // Menos unário: início da fórmula, depois de operador ou de "(".
      const previous = tokens[tokens.length - 1];
      const isUnary =
        char === "-" &&
        (!previous ||
          previous.type === "operator" ||
          previous.type === "comma" ||
          (previous.type === "paren" && previous.value === "("));
      tokens.push({ type: "operator", value: isUnary ? "u-" : char });
      index += 1;
      continue;
    }

    throw new FormulaError(`Caractere não permitido: "${char}".`);
  }

  if (!tokens.length) throw new FormulaError("A fórmula está vazia.");
  return tokens;
}

/** Shunting-yard: infixa para pós-fixa. */
function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  tokens.forEach((token) => {
    if (token.type === "number" || token.type === "variable") {
      output.push(token);
      return;
    }
    if (token.type === "function") {
      stack.push(token);
      return;
    }
    if (token.type === "comma") {
      while (stack.length && !(stack[stack.length - 1].type === "paren")) {
        output.push(stack.pop() as Token);
      }
      if (!stack.length) throw new FormulaError("Vírgula fora de uma função.");
      return;
    }
    if (token.type === "operator") {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "operator") break;
        // "u-" é associativo à direita: --x não deve desempilhar.
        if (PRECEDENCE[top.value] < PRECEDENCE[token.value]) break;
        if (token.value === "u-" && PRECEDENCE[top.value] === PRECEDENCE[token.value]) break;
        output.push(stack.pop() as Token);
      }
      stack.push(token);
      return;
    }
    if (token.value === "(") {
      stack.push(token);
      return;
    }

    // ")"
    let matched = false;
    while (stack.length) {
      const top = stack.pop() as Token;
      if (top.type === "paren" && top.value === "(") {
        matched = true;
        break;
      }
      output.push(top);
    }
    if (!matched) throw new FormulaError("Parênteses não fecham.");
    if (stack.length && stack[stack.length - 1].type === "function") {
      output.push(stack.pop() as Token);
    }
  });

  while (stack.length) {
    const top = stack.pop() as Token;
    if (top.type === "paren") throw new FormulaError("Parênteses não fecham.");
    output.push(top);
  }

  return output;
}

export interface CompiledFormula {
  evaluate(values: Record<string, number>): number | null;
  variables: string[];
}

/** Compila uma vez e reaproveita — a mesma métrica é avaliada em vários períodos. */
export function compileFormula(formula: string): CompiledFormula {
  const tokens = tokenize(formula);
  const rpn = toRpn(tokens);
  const variables = Array.from(
    new Set(tokens.filter((token) => token.type === "variable").map((token) => (token as { name: string }).name)),
  );

  // Validação estrutural agora, para o formulário recusar antes de salvar.
  simulate(rpn);

  return {
    variables,
    evaluate(values) {
      const stack: (number | null)[] = [];

      for (const token of rpn) {
        if (token.type === "number") {
          stack.push(token.value);
          continue;
        }
        if (token.type === "variable") {
          const value = values[token.name];
          stack.push(Number.isFinite(value) ? value : 0);
          continue;
        }
        if (token.type === "function") {
          // Só funções de um ou dois argumentos: pega o que estiver no topo.
          const right = stack.pop();
          const left = token.name === "min" || token.name === "max" ? stack.pop() : undefined;
          const args = (left === undefined ? [right] : [left, right]).filter(
            (value): value is number => value !== null && value !== undefined,
          );
          if (!args.length) {
            stack.push(null);
            continue;
          }
          stack.push(FUNCTIONS[token.name](args));
          continue;
        }

        // Parênteses e vírgulas não sobrevivem à conversão para RPN.
        if (token.type !== "operator") continue;

        if (token.value === "u-") {
          const value = stack.pop();
          stack.push(value === null || value === undefined ? null : -value);
          continue;
        }

        const right = stack.pop();
        const left = stack.pop();
        if (left === null || right === null || left === undefined || right === undefined) {
          stack.push(null);
          continue;
        }

        switch (token.value) {
          case "+":
            stack.push(left + right);
            break;
          case "-":
            stack.push(left - right);
            break;
          case "*":
            stack.push(left * right);
            break;
          case "/":
            // Divisão por zero vira "sem valor", não Infinity: um CPL sem leads
            // não é infinito, é indefinido.
            stack.push(right === 0 ? null : left / right);
            break;
        }
      }

      const result = stack.pop();
      if (result === undefined || result === null) return null;
      return Number.isFinite(result) ? result : null;
    },
  };
}

/** Confere se a expressão consome e produz a quantidade certa de valores. */
function simulate(rpn: Token[]): void {
  let depth = 0;
  rpn.forEach((token) => {
    if (token.type === "number" || token.type === "variable") {
      depth += 1;
      return;
    }
    if (token.type === "function") {
      const consumes = token.name === "min" || token.name === "max" ? 2 : 1;
      if (depth < consumes) throw new FormulaError(`A função ${token.name}() não recebeu argumentos suficientes.`);
      depth -= consumes - 1;
      return;
    }
    if (token.type === "operator") {
      if (token.value === "u-") {
        if (depth < 1) throw new FormulaError("Operador sem valor à direita.");
        return;
      }
      if (depth < 2) throw new FormulaError("Faltou um valor em volta de um operador.");
      depth -= 1;
    }
  });

  if (depth !== 1) throw new FormulaError("A fórmula está incompleta.");
}

/** Valida sem avaliar. Devolve a mensagem de erro ou null quando está correta. */
export function validateFormula(formula: string): string | null {
  try {
    compileFormula(formula);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
