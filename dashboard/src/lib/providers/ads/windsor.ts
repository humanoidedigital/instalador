import type { AdChannel, AdDailyRow, AdsProvider, FetchOptions } from "@/lib/types";
import { cached, cacheTtlSeconds } from "@/lib/cache";

/**
 * Provedor de mídia paga via Windsor.ai.
 * Uma API key só cobre Meta Ads e Google Ads — sem developer token do Google
 * nem App Review da Meta. Trocar para as APIs nativas depois é só mudar
 * ADS_PROVIDER=native: a interface AdsProvider é a mesma.
 */

const BASE_URL = "https://connectors.windsor.ai";

const CONNECTOR: Record<AdChannel, string> = {
  meta: "facebook",
  google: "google_ads",
};

/** IDs de campo validados contra o get_fields de cada conector. */
const FIELDS: Record<AdChannel, string[]> = {
  meta: [
    "date",
    "account_id",
    "account_name",
    "campaign_id",
    "campaign",
    "objective",
    "spend",
    "impressions",
    "clicks",
    "actions_lead",
    "actions_offsite_conversion_fb_pixel_lead",
    "actions_onsite_conversion_messaging_conversation_started_7d",
    "actions_purchase",
    "action_values_purchase",
  ],
  google: [
    "date",
    "account_id",
    "account_name",
    "campaign_id",
    "campaign",
    "campaign_type",
    "spend",
    "impressions",
    "clicks",
    "conversions",
    "conversions_value",
  ],
};

type WindsorRow = Record<string, string | number | null>;

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

/** Compara IDs de conta ignorando hífens ("469-030-5572" === "4690305572"). */
export function sameAccount(a: string, b: string): boolean {
  return a.replace(/\W/g, "") === b.replace(/\W/g, "");
}

function isPlanWarning(value: string): boolean {
  return value.includes("Uh-oh!") || value.includes("onboard.windsor.ai/app/pricing");
}

async function requestWindsor(channel: AdChannel, options: FetchOptions): Promise<WindsorRow[]> {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) {
    throw new Error("WINDSOR_API_KEY não configurada — defina no .env ou use ADS_PROVIDER=demo.");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    date_from: options.range.from,
    date_to: options.range.to,
    fields: FIELDS[channel].join(","),
    _renderer: "json",
  });

  if (process.env.WINDSOR_SEND_ACCOUNT_FILTER === "true" && options.accountIds.length) {
    params.set("select_accounts", options.accountIds.join(","));
  }

  const url = `${BASE_URL}/${CONNECTOR[channel]}?${params.toString()}`;
  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Windsor.ai ${CONNECTOR[channel]} respondeu ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { data?: WindsorRow[]; result?: WindsorRow[] };
  const rows = payload.data || payload.result || [];

  // O plano Free devolve uma linha-aviso no lugar dos dados quando há mais
  // contas conectadas do que o plano permite. Vira erro explícito, não zero silencioso.
  const warning = rows.find((row) => isPlanWarning(str(row.account_name)) || isPlanWarning(str(row.campaign)));
  if (warning) {
    throw new Error(
      "Windsor.ai bloqueou os dados: há mais contas conectadas do que o plano permite. " +
        "Faça upgrade em onboard.windsor.ai/app/pricing ou desconecte contas até o limite do plano.",
    );
  }

  return rows;
}

function mapRow(channel: AdChannel, row: WindsorRow): AdDailyRow {
  const shared = {
    date: str(row.date).slice(0, 10),
    channel,
    accountId: str(row.account_id),
    accountName: str(row.account_name, "Conta sem nome"),
    campaignId: str(row.campaign_id),
    campaign: str(row.campaign, "(sem campanha)"),
    spend: num(row.spend),
    impressions: num(row.impressions),
    clicks: num(row.clicks),
  };

  if (channel === "meta") {
    // "Leads" no Meta pode vir de formulário, pixel ou conversa iniciada —
    // pegamos o maior sinal disponível para não subcontar contas que usam só um deles.
    const platformLeads = Math.max(
      num(row.actions_lead),
      num(row.actions_offsite_conversion_fb_pixel_lead),
      num(row.actions_onsite_conversion_messaging_conversation_started_7d),
    );
    return {
      ...shared,
      campaignType: str(row.objective, "—"),
      platformLeads,
      conversionValue: num(row.action_values_purchase),
    };
  }

  return {
    ...shared,
    campaignType: str(row.campaign_type, "—"),
    platformLeads: num(row.conversions),
    conversionValue: num(row.conversions_value),
  };
}

export const windsorAdsProvider: AdsProvider = {
  id: "windsor",
  label: "Windsor.ai",
  async fetchDaily(channel, options) {
    if (!options.accountIds.length) return [];

    // Quando o filtro de contas vai na query, ele faz parte da identidade do cache.
    const accountScope =
      process.env.WINDSOR_SEND_ACCOUNT_FILTER === "true" ? [...options.accountIds].sort().join("|") : "all";
    const key = `windsor:${channel}:${options.range.from}:${options.range.to}:${accountScope}`;
    const rows = await cached(key, cacheTtlSeconds(), () => requestWindsor(channel, options));

    return rows
      .map((row) => mapRow(channel, row))
      .filter((row) => row.date >= options.range.from && row.date <= options.range.to)
      .filter((row) => options.accountIds.some((id) => sameAccount(id, row.accountId)));
  },
};
