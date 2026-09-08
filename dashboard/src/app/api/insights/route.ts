import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSession } from "@/lib/auth/guard";
import { getSecretOr } from "@/lib/secrets";
import { cacheGet, cacheSet } from "@/lib/cache";
import { configuredProviderId, selectAiProvider } from "@/lib/ai";
import { buildAnalysisContext, buildUserPrompt, SYSTEM_PROMPT } from "@/lib/ai/context";
import type { AiAnalysis } from "@/lib/ai/types";
import type { DashboardPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

interface CachedAnalysis {
  analysis: AiAnalysis;
  model: string;
  provider: string;
  geradoEm: string;
}

/** Chave do cache: mesmos números, mesma análise — não paga duas vezes. */
function contextKey(context: unknown, model: string): string {
  return createHash("sha256").update(`${model}:${JSON.stringify(context)}`).digest("hex").slice(0, 32);
}

/** Análise vale por mais tempo que os dados: os números do período fechado não mudam. */
function ttlSeconds(): number {
  const value = Number(getSecretOr("AI_CACHE_SECONDS", "21600"));
  return Number.isFinite(value) && value > 0 ? value : 21600;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const selection = selectAiProvider();
  return NextResponse.json({
    configurado: selection.ok,
    provedor: configuredProviderId(),
    rotulo: selection.ok ? selection.selection.provider.label : null,
    modelo: selection.ok ? selection.selection.model : null,
    motivo: selection.ok ? null : selection.motivo,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { payload?: DashboardPayload; forcar?: boolean };
  if (!body.payload?.meta) {
    return NextResponse.json({ error: "Faltaram os dados do relatório." }, { status: 400 });
  }

  const selection = selectAiProvider();
  if (!selection.ok) {
    return NextResponse.json({ error: selection.motivo }, { status: 409 });
  }

  const { provider, apiKey, model } = selection.selection;
  const context = buildAnalysisContext(body.payload);
  const key = `ai:${provider.id}:${contextKey(context, model)}`;

  if (!body.forcar) {
    const hit = cacheGet<CachedAnalysis>(key);
    if (hit) return NextResponse.json({ ...hit, doCache: true });
  }

  // Gerar custa dinheiro: quem só lê o relatório recebe o que já está em cache,
  // e a geração fica com a conta master.
  if (session.role !== "master") {
    return NextResponse.json(
      { error: "A análise ainda não foi gerada para este período. Peça para a conta master gerar." },
      { status: 409 },
    );
  }

  try {
    const result = await provider.generate({
      apiKey,
      model,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(context, getSecretOr("AI_EXTRA_CONTEXT", "")),
    });

    const cached: CachedAnalysis = {
      analysis: result.analysis,
      model: result.model,
      provider: provider.label,
      geradoEm: new Date().toISOString(),
    };
    cacheSet(key, cached, ttlSeconds());

    return NextResponse.json({ ...cached, doCache: false, uso: result.usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[insights]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
