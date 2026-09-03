import { NextResponse } from "next/server";
import { crmCredentials, loadClients } from "@/lib/clients";
import { selectAdsProvider, selectCrmProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Usado pelo instalador e por monitoramento externo para verificar o processo. */
export async function GET() {
  const ads = selectAdsProvider();
  const crm = selectCrmProvider();
  const clients = loadClients();

  return NextResponse.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    clients: clients.length,
    clientsWithCrm: clients.filter((client) => crmCredentials(client).configured).length,
    providers: {
      ads: { id: ads.provider.id, demo: ads.demo },
      crm: { id: crm.provider.id, demo: crm.demo },
    },
    warnings: [...ads.warnings, ...crm.warnings],
  });
}
