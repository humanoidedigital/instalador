import { NextResponse } from "next/server";
import { crmCredentials, getClient, loadClients, type ClientConfig } from "@/lib/clients";
import { previousRange, rangeFromSearchParams } from "@/lib/dates";
import { assembleDashboard } from "@/lib/metrics";
import { selectAdsProvider, selectCrmProvider } from "@/lib/providers";
import { cacheClear } from "@/lib/cache";
import type { AdChannel, AdDailyRow, CrmOpportunity, CrmProvider, DateRange, FetchOptions } from "@/lib/types";
import { getSession } from "@/lib/auth/guard";

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

/**
 * Cada cliente tem sua própria conta de CRM, então a visão consolidada busca
 * conta por conta e junta. Contas repetidas (mesmo token e mesmo filtro de
 * funil) são buscadas uma vez só, para não contar o mesmo lead duas vezes.
 */
async function fetchCrm(
  client: ClientConfig,
  provider: CrmProvider,
  range: DateRange,
  label: string,
  warnings: string[],
): Promise<CrmOpportunity[]> {
  const targets = client.id === "__all__" ? loadClients() : [client];
  const seen = new Set<string>();
  const jobs: Promise<CrmOpportunity[]>[] = [];

  for (const target of targets) {
    const credentials = crmCredentials(target);
    if (!credentials.configured && provider.id !== "demo") continue;

    const key = `${credentials.token || credentials.locationId || target.id}|${credentials.pipelines.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const options: FetchOptions = {
      range,
      accountIds: [...target.metaAccountIds, ...target.googleAccountIds],
      crmToken: credentials.token,
      locationId: credentials.locationId,
      pipelines: credentials.pipelines,
    };

    jobs.push(
      settle<CrmOpportunity[]>(
        targets.length > 1 ? `${label} — ${target.name}` : label,
        warnings,
        () => provider.fetchOpportunities(options),
        [],
      ),
    );
  }

  return (await Promise.all(jobs)).flat();
}

export async function GET(request: Request) {
  // O relatório expõe dados de cliente: sem sessão, nem responde.
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }

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

  const [metaRows, googleRows, metaPrev, googlePrev, opportunities, previousOpportunities] = await Promise.all([
    settle<AdDailyRow[]>("Meta Ads", warnings, () => ads.provider.fetchDaily("meta", adOptions("meta", range)), []),
    settle<AdDailyRow[]>("Google Ads", warnings, () => ads.provider.fetchDaily("google", adOptions("google", range)), []),
    settle<AdDailyRow[]>("Meta Ads (período anterior)", warnings, () => ads.provider.fetchDaily("meta", adOptions("meta", previous)), []),
    settle<AdDailyRow[]>("Google Ads (período anterior)", warnings, () => ads.provider.fetchDaily("google", adOptions("google", previous)), []),
    fetchCrm(client, crm.provider, range, "CRM", warnings),
    fetchCrm(client, crm.provider, previous, "CRM (período anterior)", warnings),
  ]);

  if (crm.provider.id !== "demo") {
    const missing = (client.id === "__all__" ? loadClients() : [client]).filter(
      (target) => !crmCredentials(target).configured,
    );
    if (missing.length) {
      warnings.push(
        `Sem credencial de CRM para ${missing.map((target) => target.name).join(", ")} — ` +
          "as métricas de leads, vendas e receita ficam zeradas para esse(s) cliente(s). " +
          "Defina o token no .env e aponte rdCrmTokenEnv no config/clients.json.",
      );
    }
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
