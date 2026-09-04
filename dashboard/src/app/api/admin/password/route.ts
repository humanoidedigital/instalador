import { NextResponse } from "next/server";
import { getSession, masterUser, setMasterPassword, storedMasterSecret } from "@/lib/auth/guard";
import { verifyPassword } from "@/lib/auth/password";
import { writeSecrets } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Troca da senha master. Exige a senha atual mesmo com sessão aberta. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "master") {
    return NextResponse.json({ error: "Acesso restrito à conta master." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    atual?: string;
    nova?: string;
    usuario?: string;
  };

  if (!verifyPassword(body.atual || "", storedMasterSecret())) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return NextResponse.json({ error: "A senha atual não confere." }, { status: 401 });
  }

  const nova = body.nova || "";
  if (nova.length < 10) {
    return NextResponse.json({ error: "A nova senha precisa ter pelo menos 10 caracteres." }, { status: 400 });
  }

  const usuario = (body.usuario || masterUser()).trim();
  if (usuario) writeSecrets({ ADMIN_USER: usuario });
  setMasterPassword(nova);

  return NextResponse.json({ ok: true });
}
