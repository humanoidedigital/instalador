import { NextResponse } from "next/server";
import { collect, defaultLookbackDays } from "@/lib/collector";
import { getSession } from "@/lib/auth/guard";
import { getSecret } from "@/lib/secrets";
import { cacheClear } from "@/lib/cache";
import { runAlerts } from "@/lib/alerts-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Dispara a coleta. Duas formas de autorizar:
 *   - sessão master, pelo painel;
 *   - Bearer com o COLLECT_TOKEN, para o cron do servidor.
 */
async function authorize(request: Request): Promise<boolean> {
  const session = await getSession();
  if (session?.role === "master") return true;

  const expected = getSecret("COLLECT_TOKEN");
  if (!expected) return false;

  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client") || undefined;
  const daysParam = Number(url.searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 400) : defaultLookbackDays();

  const startedAt = Date.now();
  try {
    const { range, results } = await collect({ clientId: clientId === "__all__" ? undefined : clientId, days });
    // O relatório passa a ler o histórico novo.
    cacheClear();

    // Alertas avaliados logo após a gravação: os números são os que acabaram
    // de entrar, e não custa nenhuma chamada de API a mais.
    const alertas = await runAlerts().catch((error) => ({
      avaliados: 0,
      disparos: 0,
      novos: 0,
      entregues: 0,
      erros: [(error as Error).message],
    }));

    const erros = results.filter((result) => result.status === "erro");
    return NextResponse.json({
      alertas,
      ok: erros.length === 0,
      periodo: range,
      duracaoMs: Date.now() - startedAt,
      linhas: results.reduce((total, result) => total + result.rows, 0),
      resultados: results,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
