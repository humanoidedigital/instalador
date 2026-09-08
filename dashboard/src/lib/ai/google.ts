import { getSecretOr } from "@/lib/secrets";
import { ANALYSIS_SCHEMA, callProvider, parseAnalysis, type AiProvider } from "./types";

/**
 * Gemini, por HTTP direto. O responseSchema do Gemini não aceita
 * `additionalProperties`, então o schema compartilhado é limpo antes de sair.
 */
const base = () => getSecretOr("GOOGLE_AI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/models");

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

/** Remove as chaves que o Gemini rejeita, preservando a estrutura. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;

  const output: Record<string, unknown> = {};
  Object.entries(schema as Record<string, unknown>).forEach(([key, value]) => {
    if (key === "additionalProperties") return;
    output[key] = toGeminiSchema(value);
  });
  return output;
}

export const googleProvider: AiProvider = {
  id: "google",
  label: "Gemini (Google)",
  defaultModel: "gemini-2.0-flash",

  async generate({ apiKey, model, system, prompt, maxTokens = 8000 }) {
    const chosen = model || this.defaultModel;
    const response = await callProvider("Gemini", () =>
      fetch(`${base()}/${encodeURIComponent(chosen)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(ANALYSIS_SCHEMA),
          },
        }),
      }),
    );

    const payload = (await response.json().catch(() => ({}))) as GenerateResponse;

    if (!response.ok) {
      throw new Error(`Gemini ${response.status}: ${payload.error?.message || "falha na chamada"}`);
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
    if (!text) {
      const motivo = payload.candidates?.[0]?.finishReason;
      throw new Error(`O Gemini respondeu sem conteúdo${motivo ? ` (${motivo})` : ""}.`);
    }

    return {
      analysis: parseAnalysis(text),
      model: chosen,
      usage: {
        inputTokens: payload.usageMetadata?.promptTokenCount,
        outputTokens: payload.usageMetadata?.candidatesTokenCount,
      },
    };
  },
};
