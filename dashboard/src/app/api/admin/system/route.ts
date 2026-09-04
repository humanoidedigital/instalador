import { NextResponse } from "next/server";
import { getSession, masterPasswordNeedsHashing, masterUser } from "@/lib/auth/guard";
import { loadClients, crmCredentials } from "@/lib/clients";
import { selectAdsProvider, selectCrmProvider } from "@/lib/providers";
import { cacheClear, cacheTtlSeconds } from "@/lib/cache";
import { secretsPath } from "@/lib/secrets";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function denyIfNotMaster() {
  const session = await getSession();
  if (!session || session.role !== "master") {
    return NextResponse.json({ error: "Acesso restrito à conta master." }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const ads = selectAdsProvider();
  const crm = selectCrmProvider();
  const clients = loadClients();
  const semCrm = clients.filter((client) => !crmCredentials(client).configured);

  const alertas: string[] = [...ads.warnings, ...crm.warnings];
  if (masterPasswordNeedsHashing()) {
    alertas.push(
      "A senha master está guardada em texto puro (herdada do .env). Troque a senha nesta tela para gravá-la como hash.",
    );
  }
  if (semCrm.length) {
    alertas.push(
      `Sem token de CRM: ${semCrm.map((client) => client.name).join(", ")}. Esses clientes ficam sem leads, vendas e receita.`,
    );
  }

  return NextResponse.json({
    usuarioMaster: masterUser(),
    processo: {
      uptimeSegundos: Math.round(process.uptime()),
      node: process.version,
      memoriaMb: Math.round(process.memoryUsage().rss / 1048576),
      cacheSegundos: cacheTtlSeconds(),
    },
    arquivos: {
      clientes: process.env.CLIENTS_CONFIG_PATH || path.join(process.cwd(), "config", "clients.json"),
      cofre: secretsPath(),
    },
    fontes: {
      midia: { id: ads.provider.id, rotulo: ads.provider.label, demo: ads.demo },
      crm: { id: crm.provider.id, rotulo: crm.provider.label, demo: crm.demo },
    },
    clientes: {
      total: clients.length,
      comCrm: clients.length - semCrm.length,
    },
    alertas,
  });
}

/** Limpa o cache em memória — força a próxima leitura a bater nas APIs. */
export async function POST() {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  cacheClear();
  return NextResponse.json({ ok: true });
}
