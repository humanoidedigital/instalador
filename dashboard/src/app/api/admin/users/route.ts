import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { loadClients } from "@/lib/clients";
import {
  clientUsersPath,
  createClientUser,
  listClientUsers,
  removeClientUser,
  updateClientUser,
} from "@/lib/auth/users";

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
    // A senha nunca volta, nem como hash: o painel só mostra quem existe.
    usuarios: listClientUsers(),
    clientes: loadClients().map((client) => ({ id: client.id, name: client.name })),
    arquivo: clientUsersPath(),
  });
}

export async function POST(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    user?: string;
    clientId?: string;
    password?: string;
  };

  try {
    createClientUser(body.user || "", body.clientId || "", body.password || "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    user?: string;
    clientId?: string;
    password?: string;
    active?: boolean;
  };

  if (!body.user) {
    return NextResponse.json({ error: "Informe a conta a alterar." }, { status: 400 });
  }

  try {
    updateClientUser(body.user, {
      clientId: body.clientId,
      password: body.password || undefined,
      active: body.active,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const user = new URL(request.url).searchParams.get("user");
  if (!user) return NextResponse.json({ error: "Informe a conta a remover." }, { status: 400 });

  removeClientUser(user);
  return NextResponse.json({ ok: true });
}
