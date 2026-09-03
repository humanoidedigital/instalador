import type { AdChannel, LeadChannel } from "./types";

const META_TOKENS = ["facebook", "fb", "meta", "instagram", "ig", "messenger", "whatsapp_meta", "fbclid"];
const GOOGLE_TOKENS = ["google", "adwords", "gads", "google_ads", "youtube", "gclid", "gbraid", "wbraid", "search_partners"];
const ORGANIC_TOKENS = ["organic", "organico", "direct", "direto", "referral", "seo", "indicacao", "indicação"];

/**
 * Classifica a origem de um lead do CRM em canal.
 * Usa utm_source, utm_medium, nome da campanha e a fonte de sessão — em ordem de confiança.
 */
export function classifyChannel(...candidates: (string | null | undefined)[]): LeadChannel {
  const haystack = candidates
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return "other";
  if (META_TOKENS.some((token) => haystack.includes(token))) return "meta";
  if (GOOGLE_TOKENS.some((token) => haystack.includes(token))) return "google";
  if (ORGANIC_TOKENS.some((token) => haystack.includes(token))) return "organic";
  return "other";
}

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  organic: "Orgânico / Direto",
  other: "Outros",
};

export function isAdChannel(channel: LeadChannel): channel is AdChannel {
  return channel === "meta" || channel === "google";
}

/** Normaliza o nome da campanha para casar CRM (utm_campaign) com a plataforma. */
export function normalizeCampaignKey(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
