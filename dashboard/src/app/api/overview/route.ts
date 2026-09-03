import { NextResponse } from "next/server";
import { getClient } from "@/lib/clients";
import { previousRange, rangeFromSearchParams } from "@/lib/dates";
import { assembleDashboard } from "@/lib/metrics";
import { selectAdsProvider, selectCrmProvider } from "@/lib/providers";
import { cacheClear } from "@/lib/cache";
import type { AdChannel, AdDailyRow, CrmOpportunity, DateRange, FetchOptions } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Uma chamada externa que falha não pode derrubar o dashboard inteiro:
 * o erro vira aviso na tela e as outras fontes continuam sendo exibidas.
 */
async function settle<T>(label: string, warnings: string[], loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`${label}: ${message}`);
    console.error(`[overview] ${label}`, message);
    return fallback;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const client = getClient(clientId);

  if (!client) {
    return NextResponse.json(
      { error: "Cliente não encontrado. Confira o arquivo config/clients.json." },
      { status: 404 },
    );
  }

  if (url.searchParams.get("refresh") === "1") {
    cacheClear();
  }

  const { range } = rangeFromSearchParams(url.searchParams);
  const previous = previousRange(range);

  const ads = selectAdsProvider();
  const crm = selectCrmProvider();
  const warnings = [...ads.warnings, ...crm.warnings];

  const adOptions = (channel: AdChannel, forRange: DateRange): FetchOptions => ({
    range: forRange,
    accountIds: channel === "meta" ? client.metaAccountIds : client.googleAccountIds,
  });

  const crmOptions = (forRange: DateRange): FetchOptions => ({
    range: forRange,
    accountIds: [...client.metaAccountIds, ...client.googleAccountIds],
    locationId: client.ghlLocationId || undefined,
  });

  const [metaRows, googleRows, metaPrev, googlePrev, opportunities, previousOpportunities] = await Promise.all([
    settle<AdDailyRow[]>("Meta Ads", warnings, () => ads.provider.fetchDaily("meta", adOptions("meta", range)), []),
    settle<AdDailyRow[]>("Google Ads", warnings, () => ads.provider.fetchDaily("google", adOptions("google", range)), []),
    settle<AdDailyRow[]>("Meta Ads (período anterior)", warnings, () => ads.provider.fetchDaily("meta", adOptions("meta", previous)), []),
    settle<AdDailyRow[]>("Google Ads (período anterior)", warnings, () => ads.provider.fetchDaily("google", adOptions("google", previous)), []),
    settle<CrmOpportunity[]>("CRM", warnings, () => crm.provider.fetchOpportunities(crmOptions(range)), []),
    settle<CrmOpportunity[]>("CRM (período anterior)", warnings, () => crm.provider.fetchOpportunities(crmOptions(previous)), []),
  ]);

  if (!client.ghlLocationId && crm.provider.id !== "demo") {
    warnings.push(
      `O cliente "${client.name}" está sem ghlLocationId em config/clients.json — as métricas de CRM ficam zeradas.`,
    );
  }

  const payload = assembleDashboard({
    client,
    range,
    previousRange: previous,
    adRows: [...metaRows, ...googleRows],
    previousAdRows: [...metaPrev, ...googlePrev],
    opportunities,
    previousOpportunities,
    sources: { ads: ads.provider.label, crm: crm.provider.label },
    warnings,
    demo: ads.demo || crm.demo,
  });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
