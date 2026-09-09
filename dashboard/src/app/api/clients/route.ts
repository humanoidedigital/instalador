import { NextResponse } from "next/server";
import { clientOptions } from "@/lib/clients";
import { getSession } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const clients = clientOptions();

  // O seletor de uma sessão de cliente lista só o cliente dela — nem o nome dos
  // outros sai daqui, e "Todos os clientes" também não.
  if (session.role === "cliente") {
    return NextResponse.json({ clients: clients.filter((client) => client.id === session.clientId) });
  }

  return NextResponse.json({ clients });
}
