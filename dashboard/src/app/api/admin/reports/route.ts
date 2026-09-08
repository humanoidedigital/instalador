import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { loadClients } from "@/lib/clients";
import { loadCustomMetrics } from "@/lib/custom-metrics";
import { BASE_KPIS } from "@/lib/kpi-order";
import {
  BLOCK_TYPES,
  BUILTIN_TEMPLATE,
  loadTemplates,
  reportsConfigPath,
  validateTemplates,
  writeTemplates,
  type ReportTemplate,
} from "@/lib/reports";
import { cacheClear } from "@/lib/cache";

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

  const stored = loadTemplates();

  return NextResponse.json({
    // Instalação nova começa com o layout de fábrica já editável.
    templates: stored.length ? stored : [BUILTIN_TEMPLATE],
    salvo: stored.length > 0,
    blocos: BLOCK_TYPES,
    indicadores: [
      ...BASE_KPIS,
      ...loadCustomMetrics()
        .filter((metric) => metric.enabled)
        .map((metric) => ({ id: metric.id, label: `${metric.label} (personalizada)` })),
    ],
    clientes: loadClients().map((client) => ({ id: client.id, name: client.name })),
    arquivo: reportsConfigPath(),
  });
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { templates?: ReportTemplate[] };
  if (!Array.isArray(body.templates)) {
    return NextResponse.json({ error: "Formato inválido: esperado uma lista de relatórios." }, { status: 400 });
  }

  const errors = validateTemplates(body.templates);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  try {
    writeTemplates(body.templates);
    cacheClear();
    return NextResponse.json({ ok: true, total: body.templates.length });
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível gravar: ${(error as Error).message}` }, { status: 500 });
  }
}
