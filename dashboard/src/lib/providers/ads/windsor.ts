import type { AdChannel, AdCreative, AdDailyRow, AdsProvider, FetchOptions } from "@/lib/types";
import { cached, cacheTtlSeconds } from "@/lib/cache";
import { getSecret } from "@/lib/secrets";

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

/** Campos de nível de anúncio — é aqui que vive o criativo. */
const CREATIVE_FIELDS: Record<AdChannel, string[]> = {
  meta: [
    "date",
    "account_id",
    "account_name",
    "campaign",
    "ad_id",
    "ad_name",
    "thumbnail_url",
    "image_url",
    "instagram_permalink_url",
    "spend",
    "impressions",
    "clicks",
    "actions_lead",
    "actions_offsite_conversion_fb_pixel_lead",
    "actions_onsite_conversion_messaging_conversation_started_7d",
  ],
  google: [
    "date",
    "account_id",
    "account_name",
    "campaign",
    "ad_group_ad_ad_id",
    "ad_group_ad_ad_name",
    "ad_group_ad_ad_final_urls",
    "ad_group_ad_ad_image_ad_preview_image_url",
    "spend",
    "impressions",
    "clicks",
    "conversions",
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

async function requestWindsor(
  channel: AdChannel,
  options: FetchOptions,
  fields: string[] = FIELDS[channel],
): Promise<WindsorRow[]> {
  const apiKey = getSecret("WINDSOR_API_KEY");
  if (!apiKey) {
    throw new Error("WINDSOR_API_KEY não configurada — defina no .env ou use ADS_PROVIDER=demo.");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    date_from: options.range.from,
    date_to: options.range.to,
    fields: fields.join(","),
    _renderer: "json",
  });

  if (getSecret("WINDSOR_SEND_ACCOUNT_FILTER") === "true" && options.accountIds.length) {
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

function url(value: unknown): string | null {
  const text = str(value).trim();
  if (!text || text === "null" || text === "0") return null;
  // A v1 do Google devolve listas de URL como "['https://x']" ou separadas por vírgula.
  const first = text.replace(/^\[|\]$/g, "").split(",")[0].replace(/^['"]|['"]$/g, "").trim();
  return /^https?:\/\//.test(first) ? first : null;
}

/** Soma as linhas diárias de cada anúncio no período. */
function groupCreatives(channel: AdChannel, rows: WindsorRow[]): AdCreative[] {
  const grouped = new Map<string, AdCreative>();

  rows.forEach((row) => {
    const adId = str(channel === "meta" ? row.ad_id : row.ad_group_ad_ad_id);
    if (!adId) return;

    const key = `${channel}:${adId}`;
    const entry =
      grouped.get(key) ||
      ({
        key,
        channel,
        adId,
        adName: str(channel === "meta" ? row.ad_name : row.ad_group_ad_ad_name, "(sem nome)"),
        campaign: str(row.campaign, "(sem campanha)"),
        accountName: str(row.account_name, "—"),
        thumbnailUrl:
          channel === "meta"
            ? url(row.thumbnail_url) || url(row.image_url)
            : url(row.ad_group_ad_ad_image_ad_preview_image_url),
        imageUrl: channel === "meta" ? url(row.image_url) : null,
        permalinkUrl: channel === "meta" ? url(row.instagram_permalink_url) : null,
        finalUrl: channel === "google" ? url(row.ad_group_ad_ad_final_urls) : null,
        spend: 0,
        impressions: 0,
        clicks: 0,
        platformLeads: 0,
        ctr: null,
        cpc: null,
        cpl: null,
      } as AdCreative);

    entry.spend += num(row.spend);
    entry.impressions += num(row.impressions);
    entry.clicks += num(row.clicks);
    entry.platformLeads +=
      channel === "meta"
        ? Math.max(
            num(row.actions_lead),
            num(row.actions_offsite_conversion_fb_pixel_lead),
            num(row.actions_onsite_conversion_messaging_conversation_started_7d),
          )
        : num(row.conversions);

    // A miniatura só aparece em algumas linhas; guarda a primeira que vier.
    if (!entry.thumbnailUrl) {
      entry.thumbnailUrl =
        channel === "meta"
          ? url(row.thumbnail_url) || url(row.image_url)
          : url(row.ad_group_ad_ad_image_ad_preview_image_url);
    }
    grouped.set(key, entry);
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      spend: Math.round(entry.spend * 100) / 100,
      ctr: entry.impressions ? entry.clicks / entry.impressions : null,
      cpc: entry.clicks ? entry.spend / entry.clicks : null,
      cpl: entry.platformLeads ? entry.spend / entry.platformLeads : null,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export const windsorAdsProvider: AdsProvider = {
  id: "windsor",
  label: "Windsor.ai",
  async fetchDaily(channel, options) {
    if (!options.accountIds.length) return [];

    // Quando o filtro de contas vai na query, ele faz parte da identidade do cache.
    const accountScope =
      getSecret("WINDSOR_SEND_ACCOUNT_FILTER") === "true" ? [...options.accountIds].sort().join("|") : "all";
    const key = `windsor:${channel}:${options.range.from}:${options.range.to}:${accountScope}`;
    const rows = await cached(key, cacheTtlSeconds(), () => requestWindsor(channel, options));

    return rows
      .map((row) => mapRow(channel, row))
      .filter((row) => row.date >= options.range.from && row.date <= options.range.to)
      .filter((row) => options.accountIds.some((id) => sameAccount(id, row.accountId)));
  },

  async fetchCreatives(channel, options) {
    if (!options.accountIds.length) return [];

    const accountScope =
      process.env.WINDSOR_SEND_ACCOUNT_FILTER === "true" ? [...options.accountIds].sort().join("|") : "all";
    const key = `windsor:creatives:${channel}:${options.range.from}:${options.range.to}:${accountScope}`;
    const rows = await cached(key, cacheTtlSeconds(), () =>
      requestWindsor(channel, options, CREATIVE_FIELDS[channel]),
    );

    // Mesmo filtro local das linhas diárias: a resposta traz todas as contas.
    const mine = rows.filter((row) => options.accountIds.some((id) => sameAccount(id, str(row.account_id))));

    return groupCreatives(channel, mine);
  },
};
