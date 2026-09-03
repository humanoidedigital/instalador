import type { AdDailyRow, FetchOptions } from "@/lib/types";
import { cached, cacheTtlSeconds } from "@/lib/cache";

/**
 * Meta Marketing API nativa (Graph API /insights, nível campanha, diário).
 * Requer um access token de sistema com ads_read nas contas.
 */

interface InsightAction {
  action_type: string;
  value: string;
}

interface InsightRow {
  date_start: string;
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: InsightAction[];
  action_values?: InsightAction[];
}

const LEAD_ACTIONS = new Set([
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
  "onsite_conversion.messaging_conversation_started_7d",
]);

function sumActions(actions: InsightAction[] | undefined, match: (type: string) => boolean): number {
  if (!actions) return 0;
  return actions
    .filter((action) => match(action.action_type))
    .reduce((total, action) => total + Number(action.value || 0), 0);
}

async function fetchAccount(accountId: string, options: FetchOptions): Promise<AdDailyRow[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado — necessário para ADS_PROVIDER=native.");

  const version = process.env.META_API_VERSION || "v21.0";
  const params = new URLSearchParams({
    access_token: token,
    level: "campaign",
    time_increment: "1",
    limit: "500",
    time_range: JSON.stringify({ since: options.range.from, until: options.range.to }),
    fields: [
      "account_id",
      "account_name",
      "campaign_id",
      "campaign_name",
      "objective",
      "spend",
      "impressions",
      "clicks",
      "actions",
      "action_values",
    ].join(","),
  });

  const rows: InsightRow[] = [];
  let url: string | null = `https://graph.facebook.com/${version}/act_${accountId.replace(/\D/g, "")}/insights?${params}`;

  // A Graph API pagina com cursores; seguimos até acabar (teto de segurança em 20 páginas).
  for (let page = 0; url && page < 20; page += 1) {
    const response: Response = await fetch(url, { signal: options.signal, cache: "no-store" });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Meta Marketing API ${response.status} na conta ${accountId}: ${body.slice(0, 300)}`);
    }
    const payload = (await response.json()) as { data?: InsightRow[]; paging?: { next?: string } };
    rows.push(...(payload.data || []));
    url = payload.paging?.next || null;
  }

  return rows.map((row) => ({
    date: row.date_start,
    channel: "meta" as const,
    accountId: row.account_id || accountId,
    accountName: row.account_name || accountId,
    campaignId: row.campaign_id || "",
    campaign: row.campaign_name || "(sem campanha)",
    campaignType: row.objective || "—",
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    platformLeads: sumActions(row.actions, (type) => LEAD_ACTIONS.has(type)),
    conversionValue: sumActions(row.action_values, (type) => type.includes("purchase")),
  }));
}

export async function fetchMetaNative(options: FetchOptions): Promise<AdDailyRow[]> {
  const perAccount = await Promise.all(
    options.accountIds.map((accountId) =>
      cached(`meta-native:${accountId}:${options.range.from}:${options.range.to}`, cacheTtlSeconds(), () =>
        fetchAccount(accountId, options),
      ),
    ),
  );
  return perAccount.flat();
}
