import { getSecret, getSecretOr } from "@/lib/secrets";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { googleProvider } from "./google";
import type { AiProvider, AiProviderId } from "./types";

export const AI_PROVIDERS: Record<AiProviderId, AiProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
};

/** Nome da variável que guarda a chave de cada provedor. */
const KEY_NAMES: Record<AiProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_AI_API_KEY",
};

const MODEL_NAMES: Record<AiProviderId, string> = {
  anthropic: "ANTHROPIC_MODEL",
  openai: "OPENAI_MODEL",
  google: "GOOGLE_AI_MODEL",
};

export interface AiSelection {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export function configuredProviderId(): AiProviderId | "off" {
  const configured = getSecretOr("AI_PROVIDER", "off").toLowerCase();
  return configured === "anthropic" || configured === "openai" || configured === "google"
    ? configured
    : "off";
}

/** Provedor pronto para uso, ou o motivo de não estar. */
export function selectAiProvider(): { ok: true; selection: AiSelection } | { ok: false; motivo: string } {
  const id = configuredProviderId();
  if (id === "off") {
    return { ok: false, motivo: "Análise por IA desligada. Escolha um provedor em Administração → IA." };
  }

  const provider = AI_PROVIDERS[id];
  const apiKey = getSecret(KEY_NAMES[id]);
  if (!apiKey) {
    return { ok: false, motivo: `Falta a chave de API do ${provider.label}. Configure em Administração → IA.` };
  }

  return {
    ok: true,
    selection: { provider, apiKey, model: getSecretOr(MODEL_NAMES[id], provider.defaultModel) },
  };
}

export function aiKeyName(id: AiProviderId): string {
  return KEY_NAMES[id];
}

export function aiModelName(id: AiProviderId): string {
  return MODEL_NAMES[id];
}
