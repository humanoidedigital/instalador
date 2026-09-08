/**
 * Camada de IA para análise do relatório.
 *
 * Três provedores atendidos pela mesma interface, com a chave configurada no
 * painel. O schema de saída é um só, compartilhado entre eles — cada provedor
 * o entrega no formato que a sua API espera.
 */

export type AiProviderId = "anthropic" | "openai" | "google";

export type InsightSeverity = "positivo" | "atencao" | "critico" | "informativo";

export interface AiInsight {
  titulo: string;
  severidade: InsightSeverity;
  analise: string;
  acao: string;
}

export interface AiAnalysis {
  resumo: string;
  insights: AiInsight[];
}

export interface AiRequest {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  /** Teto de saída. A análise é curta; não há motivo para pedir mais. */
  maxTokens?: number;
}

export interface AiResult {
  analysis: AiAnalysis;
  /** Modelo que de fato respondeu, para aparecer no rodapé da análise. */
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** Modelo usado quando o painel não define um. */
  defaultModel: string;
  generate(request: AiRequest): Promise<AiResult>;
}

/**
 * Schema da resposta. Um só, para os três provedores — o que muda é só como
 * cada API recebe: output_config no Claude, response_format no OpenAI,
 * responseSchema no Gemini.
 */
export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    resumo: {
      type: "string",
      description: "Um parágrafo curto com a leitura geral do período.",
    },
    insights: {
      type: "array",
      description: "De 3 a 6 achados, do mais relevante para o menos.",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Frase curta e direta." },
          severidade: {
            type: "string",
            enum: ["positivo", "atencao", "critico", "informativo"],
          },
          analise: {
            type: "string",
            description: "O que os números mostram, citando os valores concretos.",
          },
          acao: {
            type: "string",
            description: "A ação recomendada, específica o bastante para ser executada.",
          },
        },
        required: ["titulo", "severidade", "analise", "acao"],
        additionalProperties: false,
      },
    },
  },
  required: ["resumo", "insights"],
  additionalProperties: false,
} as const;

/**
 * Rede de segurança: mesmo com saída estruturada, um modelo pode devolver o
 * JSON embrulhado em cerca de código ou com texto em volta.
 */
export function parseAnalysis(raw: string): AiAnalysis {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const candidate = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  const parsed = JSON.parse(candidate) as Partial<AiAnalysis>;
  return normalizeAnalysis(parsed);
}

export function normalizeAnalysis(parsed: Partial<AiAnalysis> | null | undefined): AiAnalysis {
  const severities: InsightSeverity[] = ["positivo", "atencao", "critico", "informativo"];

  return {
    resumo: String(parsed?.resumo || "").trim(),
    insights: (parsed?.insights || [])
      .filter((insight) => insight && (insight.titulo || insight.analise))
      .map((insight) => ({
        titulo: String(insight.titulo || "").trim(),
        severidade: severities.includes(insight.severidade as InsightSeverity)
          ? (insight.severidade as InsightSeverity)
          : "informativo",
        analise: String(insight.analise || "").trim(),
        acao: String(insight.acao || "").trim(),
      })),
  };
}

/**
 * O fetch do Node lança TypeError("fetch failed") e esconde o motivo em
 * `cause` — sem isso, o painel mostraria "fetch failed" para o operador.
 */
export async function callProvider(label: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    const detalhe = cause?.code || cause?.message || (error as Error).message;
    throw new Error(`Não foi possível falar com a API do ${label}: ${detalhe}. Confira a chave, a URL base e a saída de internet do servidor.`);
  }
}
