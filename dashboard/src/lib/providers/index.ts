import type { AdsProvider, CrmProvider } from "@/lib/types";
import { loadClients } from "@/lib/clients";
import { windsorAdsProvider } from "./ads/windsor";
import { fetchGoogleNative } from "./ads/google-native";
import { fetchMetaNative } from "./ads/meta-native";
import { rdstationProvider } from "./crm/rdstation";
import { gohighlevelProvider } from "./crm/gohighlevel";
import { demoAdsProvider, demoCrmProvider } from "./demo";

/**
 * Seleção de provedores por ambiente. Trocar de fonte de dados é mudar uma
 * variável no .env — nenhum componente de UI conhece Windsor, Google ou Meta.
 */

const nativeAdsProvider: AdsProvider = {
  id: "native",
  label: "APIs nativas (Google Ads + Meta)",
  async fetchDaily(channel, options) {
    if (!options.accountIds.length) return [];
    return channel === "google" ? fetchGoogleNative(options) : fetchMetaNative(options);
  },
};

export interface ProviderSelection<T> {
  provider: T;
  /** Avisos para mostrar no topo do dashboard (fonte em fallback, credencial faltando). */
  warnings: string[];
  demo: boolean;
}

export function selectAdsProvider(): ProviderSelection<AdsProvider> {
  const configured = (process.env.ADS_PROVIDER || "windsor").toLowerCase();

  if (configured === "demo") {
    return { provider: demoAdsProvider, warnings: [], demo: true };
  }

  if (configured === "native") {
    const missing = !process.env.META_ACCESS_TOKEN && !process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (missing) {
      return {
        provider: demoAdsProvider,
        warnings: ["ADS_PROVIDER=native sem credenciais do Google Ads/Meta — exibindo dados de demonstração."],
        demo: true,
      };
    }
    return { provider: nativeAdsProvider, warnings: [], demo: false };
  }

  if (!process.env.WINDSOR_API_KEY) {
    return {
      provider: demoAdsProvider,
      warnings: ["WINDSOR_API_KEY não configurada — exibindo dados de demonstração."],
      demo: true,
    };
  }

  return { provider: windsorAdsProvider, warnings: [], demo: false };
}

export function selectCrmProvider(): ProviderSelection<CrmProvider> {
  const configured = (process.env.CRM_PROVIDER || "rdstation").toLowerCase();

  if (configured === "demo") {
    return { provider: demoCrmProvider, warnings: [], demo: true };
  }

  if (configured === "gohighlevel") {
    if (!process.env.GHL_API_TOKEN) {
      return {
        provider: demoCrmProvider,
        warnings: ["GHL_API_TOKEN não configurado — CRM exibindo dados de demonstração."],
        demo: true,
      };
    }
    return { provider: gohighlevelProvider, warnings: [], demo: false };
  }

  // O token pode ser global (RD_CRM_TOKEN) ou por cliente, via rdCrmTokenEnv no
  // clients.json — por isso a checagem aqui é só pelo caso "nenhum token".
  const hasAnyToken =
    !!process.env.RD_CRM_TOKEN ||
    loadClients().some((client) => client.rdCrmTokenEnv && process.env[client.rdCrmTokenEnv]);

  if (!hasAnyToken) {
    return {
      provider: demoCrmProvider,
      warnings: [
        "Nenhum token do RD Station CRM configurado — CRM exibindo dados de demonstração. " +
          "Defina RD_CRM_TOKEN no .env (ou um token por cliente via rdCrmTokenEnv).",
      ],
      demo: true,
    };
  }

  return { provider: rdstationProvider, warnings: [], demo: false };
}
