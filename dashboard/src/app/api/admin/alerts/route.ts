import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { loadClients } from "@/lib/clients";
import {
  alertsConfigPath,
  loadAlertRules,
  validateAlertRules,
  variablesForScope,
  writeAlertRules,
  type AlertRule,
} from "@/lib/alerts";
import { runAlerts } from "@/lib/alerts-runner";
import { recentAlerts } from "@/lib/db/repository";
import { databaseEnabled } from "@/lib/db/sqlite";
import { hasSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

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

  return NextResponse.json({
    rules: loadAlertRules(),
    camposCliente: variablesForScope("cliente"),
    camposCampanha: variablesForScope("campanha"),
    clientes: loadClients().map((client) => ({ id: client.id, name: client.name })),
    arquivo: alertsConfigPath(),
    webhookConfigurado: hasSecret("ALERT_WEBHOOK_URL"),
    historico: databaseEnabled() ? recentAlerts({ days: 30, limit: 40 }) : [],
  });
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { rules?: AlertRule[] };
  if (!Array.isArray(body.rules)) {
    return NextResponse.json({ error: "Formato inválido: esperado uma lista de regras." }, { status: 400 });
  }

  const errors = validateAlertRules(body.rules);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  try {
    writeAlertRules(body.rules);
    return NextResponse.json({ ok: true, total: body.rules.length });
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível gravar: ${(error as Error).message}` }, { status: 500 });
  }
}

/** Roda as regras agora, contra o histórico. */
export async function POST() {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const result = await runAlerts();
  return NextResponse.json(result);
}
