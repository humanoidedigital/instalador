import { NextResponse } from "next/server";
import { authConfigured, ensureSessionSecret, sessionSecret, setMasterPassword } from "@/lib/auth/guard";
import { writeSecrets } from "@/lib/secrets";
import { cookieOptions, newSession, signSession, SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Primeiro acesso: define a senha master quando ainda não existe nenhuma.
 * Fecha para sempre depois disso — trocar a senha passa a exigir estar logado.
 */
export async function POST(request: Request) {
  if (authConfigured()) {
    return NextResponse.json({ error: "A senha master já foi definida." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as { user?: string; password?: string };
  const user = (body.user || "admin").trim() || "admin";
  const password = body.password || "";

  if (password.length < 10) {
    return NextResponse.json({ error: "A senha master precisa ter pelo menos 10 caracteres." }, { status: 400 });
  }

  writeSecrets({ ADMIN_USER: user });
  setMasterPassword(password);
  ensureSessionSecret();

  const token = await signSession(newSession(user, "master"), sessionSecret());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(new URL(request.url).protocol === "https:"));
  return response;
}
