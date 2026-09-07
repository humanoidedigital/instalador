import { NextResponse } from "next/server";
import { getClient } from "@/lib/clients";
import { rangeFromSearchParams } from "@/lib/dates";
import { selectAdsProvider } from "@/lib/providers";
import { getSession } from "@/lib/auth/guard";
import type { AdChannel, AdCreative, FetchOptions } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Anúncios individuais com criativo. Fica fora de /api/overview de propósito:
 * é uma consulta mais pesada e só é feita quando a seção é aberta na tela.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }

  const url = new URL(request.url);
  const client = getClient(url.searchParams.get("client"));
  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const { range } = rangeFromSearchParams(url.searchParams);
  const ads = selectAdsProvider();
  const warnings: string[] = [...ads.warnings];

  if (!ads.provider.fetchCreatives) {
    return NextResponse.json({
      creatives: [],
      suportado: false,
      warnings: [`A fonte "${ads.provider.label}" não expõe dados por anúncio.`],
    });
  }

  const options = (channel: AdChannel): FetchOptions => ({
    range,
    accountIds: channel === "meta" ? client.metaAccountIds : client.googleAccountIds,
  });

  const settle = async (label: string, channel: AdChannel): Promise<AdCreative[]> => {
    try {
      return (await ads.provider.fetchCreatives!(channel, options(channel))) || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${label}: ${message}`);
      console.error(`[creatives] ${label}`, message);
      return [];
    }
  };

  const [meta, google] = await Promise.all([settle("Meta Ads", "meta"), settle("Google Ads", "google")]);
  const creatives = [...meta, ...google].sort((a, b) => b.spend - a.spend);

  return NextResponse.json(
    { creatives, suportado: true, demo: ads.demo, warnings },
    { headers: { "Cache-Control": "no-store" } },
  );
}
