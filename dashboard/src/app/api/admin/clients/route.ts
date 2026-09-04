import { NextResponse } from "next/server";
import { loadClients } from "@/lib/clients";
import { toInput, validateClients, writeClients, type ClientInput } from "@/lib/clients-write";
import { getSession } from "@/lib/auth/guard";
import { cacheClear } from "@/lib/cache";
import { hasSecret } from "@/lib/secrets";

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

  const clients = loadClients().map((client) => ({
    ...toInput(client),
    // O token não vem para o browser; só se ele existe.
    tokenDefinido: !!(client.rdCrmTokenEnv && hasSecret(client.rdCrmTokenEnv)),
  }));

  return NextResponse.json({ clients });
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { clients?: ClientInput[] };
  const clients = body.clients;

  if (!Array.isArray(clients)) {
    return NextResponse.json({ error: "Formato inválido: esperado uma lista de clientes." }, { status: 400 });
  }

  const errors = validateClients(clients);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  try {
    writeClients(clients);
    // Dados em cache pertencem à configuração antiga.
    cacheClear();
    return NextResponse.json({ ok: true, total: clients.length });
  } catch (error) {
    return NextResponse.json(
      { error: `Não foi possível gravar o arquivo de clientes: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
