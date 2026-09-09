import { NextResponse } from "next/server";
import { sessionWithClient } from "@/lib/auth/guard";
import { getClient, loadClients } from "@/lib/clients";
import { recentAlerts } from "@/lib/db/repository";
import { databaseEnabled } from "@/lib/db/sqlite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Alertas do cliente selecionado, para o bloco no relatório. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // No papel `cliente` o parâmetro da URL não decide nada: vale o da sessão.
  const access = await sessionWithClient(url.searchParams.get("client"));
  if (!access) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (!databaseEnabled()) {
    return NextResponse.json({ alertas: [], motivo: "Histórico desativado." });
  }

  const client = getClient(access.clientId);
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const days = Number(url.searchParams.get("days")) || 14;

  const alertas =
    client.id === "__all__"
      ? loadClients().flatMap((item) => recentAlerts({ clientId: item.id, days, limit: 10 }))
      : recentAlerts({ clientId: client.id, days, limit: 20 });

  return NextResponse.json({
    alertas: alertas.sort((a, b) => (a.firedOn < b.firedOn ? 1 : -1)).slice(0, 20),
    dias: days,
  });
}
