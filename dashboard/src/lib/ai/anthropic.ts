import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { getSecret } from "@/lib/secrets";
import { ANALYSIS_SCHEMA, normalizeAnalysis, type AiProvider, type AiAnalysis } from "./types";

/**
 * Claude, pelo SDK oficial. A saída vem estruturada por output_config, então
 * não há regex tentando extrair JSON de texto corrido.
 */
export const anthropicProvider: AiProvider = {
  id: "anthropic",
  label: "Claude (Anthropic)",
  defaultModel: "claude-opus-5",

  async generate({ apiKey, model, system, prompt, maxTokens = 8000 }) {
    // baseURL configurável atende gateway corporativo e proxy.
    const baseURL = getSecret("ANTHROPIC_BASE_URL");
    const client = new Anthropic(baseURL ? { apiKey, baseURL } : { apiKey });

    let response;
    try {
      response = await client.messages.parse({
        model: model || this.defaultModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: jsonSchemaOutputFormat(ANALYSIS_SCHEMA) },
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string; message?: string } }).cause;
      const detalhe = cause?.code || (error as Error).message;
      throw new Error(`Falha na chamada à Anthropic: ${detalhe}`);
    }

    // Uma recusa vem com HTTP 200 e stop_reason próprio: precisa ser checada
    // antes de ler o conteúdo, senão vira "análise vazia" sem explicação.
    if (response.stop_reason === "refusal") {
      throw new Error(
        "O modelo recusou a solicitação. Revise as instruções extras configuradas para a análise.",
      );
    }

    const parsed = response.parsed_output as Partial<AiAnalysis> | null;
    if (!parsed) {
      throw new Error("O modelo respondeu fora do formato esperado.");
    }

    return {
      analysis: normalizeAnalysis(parsed),
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  },
};
