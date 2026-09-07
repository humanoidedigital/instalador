import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { loadClients } from "@/lib/clients";
import { coverage, databaseStats, recentRuns } from "@/lib/db/repository";
import { databaseEnabled, databasePath } from "@/lib/db/sqlite";
import { defaultLookbackDays } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Estado do histórico: cobertura por cliente, tamanho e últimas coletas. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "master") {
    return NextResponse.json({ error: "Acesso restrito à conta master." }, { status: 401 });
  }

  if (!databaseEnabled()) {
    return NextResponse.json({ habilitado: false, arquivo: databasePath() });
  }

  const clients = loadClients();
  const rows = coverage();
  const byClient = clients.map((client) => ({
    clientId: client.id,
    clientName: client.name,
    ads: rows.find((row) => row.clientId === client.id && row.source === "ads") || null,
    crm: rows.find((row) => row.clientId === client.id && row.source === "crm") || null,
  }));

  return NextResponse.json({
    habilitado: true,
    arquivo: databasePath(),
    estatisticas: databaseStats(),
    janelaPadraoDias: defaultLookbackDays(),
    cobertura: byClient,
    execucoes: recentRuns(15),
  });
}
