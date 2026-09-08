import { getSecretOr } from "@/lib/secrets";
import { ANALYSIS_SCHEMA, callProvider, parseAnalysis, type AiProvider } from "./types";

/**
 * OpenAI, por HTTP direto — sem SDK, para não trazer mais uma dependência só
 * por uma chamada. A saída é fixada por json_schema em modo estrito.
 */
// Base configurável: atende Azure OpenAI, gateway corporativo e proxy.
const endpoint = () => `${getSecretOr("OPENAI_BASE_URL", "https://api.openai.com/v1")}/chat/completions`;

interface ChatResponse {
  model?: string;
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export const openaiProvider: AiProvider = {
  id: "openai",
  label: "GPT (OpenAI)",
  defaultModel: "gpt-4o",

  async generate({ apiKey, model, system, prompt, maxTokens = 8000 }) {
    const response = await callProvider("OpenAI", () =>
      fetch(endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || this.defaultModel,
          max_completion_tokens: maxTokens,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "analise_de_marketing", schema: ANALYSIS_SCHEMA, strict: true },
          },
        }),
      }),
    );

    const payload = (await response.json().catch(() => ({}))) as ChatResponse;

    if (!response.ok) {
      throw new Error(`OpenAI ${response.status}: ${payload.error?.message || "falha na chamada"}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("A OpenAI respondeu sem conteúdo.");

    return {
      analysis: parseAnalysis(content),
      model: payload.model || model || this.defaultModel,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      },
    };
  },
};
