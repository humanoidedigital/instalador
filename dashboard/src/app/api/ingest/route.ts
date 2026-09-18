import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { getSecret } from "@/lib/secrets";
import { ingest, type IngestPayload } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Recebe dados prontos de fora — n8n, script, o que for.
 *
 * Mesma autorização da coleta: sessão master pelo painel, ou Bearer com o
 * COLLECT_TOKEN para automação. Um token só para as duas pontas evita ter mais
 * um segredo circulando.
 */
async function authorize(request: Request): Promise<boolean> {
  const session = await getSession();
  if (session?.role === "master") return true;

  const expected = getSecret("COLLECT_TOKEN");
  if (!expected) return false;

  return (request.headers.get("authorization") || "") === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let payload: IngestPayload;
  try {
    payload = (await request.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "Corpo inválido: esperado JSON." }, { status: 400 });
  }

  try {
    const result = ingest(payload);

    // 207 quando parte entrou e parte foi recusada: o fluxo do n8n consegue
    // distinguir "deu tudo certo" de "gravou pela metade" pelo próprio código.
    return NextResponse.json(result, { status: result.recusados.length ? 207 : 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
