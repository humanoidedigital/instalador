import { NextResponse } from "next/server";
import { getSecret } from "@/lib/secrets";
import { verifyPassword } from "@/lib/auth/password";
import { cookieOptions, newSession, signSession, SESSION_COOKIE, type Role } from "@/lib/auth/session";
import { authConfigured, masterUser, sessionSecret, storedMasterSecret } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Atraso fixo em falha de login: encarece tentativa em massa e nivela o tempo de resposta. */
const FAILURE_DELAY_MS = 700;

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "Nenhuma senha master definida ainda." }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as { user?: string; password?: string };
  const user = (body.user || "").trim();
  const password = body.password || "";

  let role: Role | null = null;

  if (user.toLowerCase() === masterUser().toLowerCase() && verifyPassword(password, storedMasterSecret())) {
    role = "master";
  } else {
    const viewerPassword = getSecret("VIEWER_PASSWORD");
    if (viewerPassword && verifyPassword(password, viewerPassword)) role = "viewer";
  }

  if (!role) {
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const token = await signSession(newSession(user || "viewer", role), sessionSecret());
  const response = NextResponse.json({ ok: true, role });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(new URL(request.url).protocol === "https:"));
  return response;
}
