import type { AdDailyRow, FetchOptions } from "@/lib/types";
import { cached, cacheTtlSeconds } from "@/lib/cache";

/**
 * Google Ads API nativa (REST + GAQL via searchStream).
 * Requer developer token aprovado, OAuth (client id/secret/refresh token) e,
 * para contas gerenciadas, o ID da MCC em GOOGLE_ADS_LOGIN_CUSTOMER_ID.
 */

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.accessToken;

  const clientId = requireEnv("GOOGLE_ADS_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_ADS_CLIENT_SECRET");
  const refreshToken = requireEnv("GOOGLE_ADS_REFRESH_TOKEN");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao renovar o token do Google Ads (${response.status}).`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada — necessária para ADS_PROVIDER=native.`);
  return value;
}

const GAQL = `
  SELECT
    segments.date,
    customer.id,
    customer.descriptive_name,
    campaign.id,
    campaign.name,
    campaign.advertising_channel_type,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value
  FROM campaign
  WHERE segments.date BETWEEN '{from}' AND '{to}'
    AND metrics.impressions > 0
`;

interface SearchStreamRow {
  segments?: { date?: string };
  customer?: { id?: string; descriptiveName?: string };
  campaign?: { id?: string; name?: string; advertisingChannelType?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number;
    conversionsValue?: number;
  };
}

async function fetchCustomer(customerId: string, options: FetchOptions): Promise<AdDailyRow[]> {
  const version = process.env.GOOGLE_ADS_API_VERSION || "v18";
  const digits = customerId.replace(/\D/g, "");
  const token = await accessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/\D/g, "");

  const response = await fetch(
    `https://googleads.googleapis.com/${version}/customers/${digits}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      signal: options.signal,
      cache: "no-store",
      body: JSON.stringify({
        query: GAQL.replace("{from}", options.range.from).replace("{to}", options.range.to),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google Ads API ${response.status} na conta ${customerId}: ${body.slice(0, 300)}`);
  }

  // searchStream devolve um array de chunks, cada um com results.
  const chunks = (await response.json()) as { results?: SearchStreamRow[] }[];
  const results = chunks.flatMap((chunk) => chunk.results || []);

  return results.map((row) => ({
    date: row.segments?.date || options.range.from,
    channel: "google" as const,
    accountId: row.customer?.id || digits,
    accountName: row.customer?.descriptiveName || customerId,
    campaignId: row.campaign?.id || "",
    campaign: row.campaign?.name || "(sem campanha)",
    campaignType: row.campaign?.advertisingChannelType || "—",
    spend: Number(row.metrics?.costMicros || 0) / 1_000_000,
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    platformLeads: Number(row.metrics?.conversions || 0),
    conversionValue: Number(row.metrics?.conversionsValue || 0),
  }));
}

export async function fetchGoogleNative(options: FetchOptions): Promise<AdDailyRow[]> {
  const perAccount = await Promise.all(
    options.accountIds.map((accountId) =>
      cached(`google-native:${accountId}:${options.range.from}:${options.range.to}`, cacheTtlSeconds(), () =>
        fetchCustomer(accountId, options),
      ),
    ),
  );
  return perAccount.flat();
}
