import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import {
  customMetricsPath,
  loadCustomMetrics,
  validateCustomMetrics,
  writeCustomMetrics,
  type CustomMetric,
} from "@/lib/custom-metrics";
import { compileFormula, FORMULA_VARIABLES } from "@/lib/metrics-formula";
import { computeTotals } from "@/lib/metrics";
import { readAdDaily, readDeals } from "@/lib/db/repository";
import { databaseEnabled } from "@/lib/db/sqlite";
import { daysBetween, resolvePreset } from "@/lib/dates";
import { loadClients } from "@/lib/clients";
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

  return NextResponse.json({
    metrics: loadCustomMetrics(),
    campos: FORMULA_VARIABLES,
    arquivo: customMetricsPath(),
    clientes: loadClients().map((client) => ({ id: client.id, name: client.name })),
  });
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { metrics?: CustomMetric[] };
  if (!Array.isArray(body.metrics)) {
    return NextResponse.json({ error: "Formato inválido: esperado uma lista de métricas." }, { status: 400 });
  }

  const errors = validateCustomMetrics(body.metrics);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  try {
    writeCustomMetrics(body.metrics);
    cacheClear();
    return NextResponse.json({ ok: true, total: body.metrics.length });
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível gravar: ${(error as Error).message}` }, { status: 500 });
  }
}

/**
 * Testa a fórmula contra números reais do histórico antes de salvar — é a
 * diferença entre "a sintaxe está certa" e "o resultado faz sentido".
 */
export async function POST(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { formula?: string; clientId?: string };
  const formula = (body.formula || "").trim();
  if (!formula) return NextResponse.json({ error: "Escreva a fórmula primeiro." }, { status: 400 });

  let compiled;
  try {
    compiled = compileFormula(formula);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (!databaseEnabled()) {
    return NextResponse.json({ ok: true, valor: null, aviso: "Sem histórico: a fórmula foi validada, mas não testada." });
  }

  const clients = loadClients();
  const clientIds =
    body.clientId && body.clientId !== "__all__" ? [body.clientId] : clients.map((client) => client.id);
  const range = resolvePreset("last_30d");
  const totals = computeTotals(readAdDaily(clientIds, range), readDeals(clientIds, range));

  const values = {
    investimento: totals.spend,
    impressoes: totals.impressions,
    cliques: totals.clicks,
    leads: totals.crmLeads,
    leads_plataforma: totals.platformLeads,
    oportunidades: totals.opportunities,
    vendas: totals.won,
    perdidas: totals.lost,
    receita: totals.revenue,
    valor_plataforma: totals.platformValue,
    dias: daysBetween(range.from, range.to),
  };

  const semDados = !totals.spend && !totals.crmLeads;

  return NextResponse.json({
    ok: true,
    valor: compiled.evaluate(values),
    campos: values,
    periodo: range,
    aviso: semDados ? "O histórico ainda não tem dados deste cliente nos últimos 30 dias." : undefined,
  });
}
