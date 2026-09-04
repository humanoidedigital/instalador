import { cookies } from "next/headers";
import { getSecret, writeSecrets } from "@/lib/secrets";
import { hashPassword, isHashed } from "./password";
import { SESSION_COOKIE, verifySession, type Role, type Session } from "./session";

/**
 * Verificação de sessão do lado do servidor.
 *
 * A checagem mora aqui, em runtime Node, e não em middleware: o middleware roda
 * no Edge, onde não há acesso a arquivo — e as credenciais podem ter sido
 * definidas pelo próprio painel, no cofre em disco. Uma checagem que só
 * enxergasse variáveis de ambiente deixaria o painel aberto nesse caso.
 */

export function sessionSecret(): string {
  const stored = getSecret("SESSION_SECRET");
  if (stored) return stored;

  // Sem segredo definido, deriva do hash da senha: as sessões continuam
  // assinadas e são invalidadas quando a senha muda.
  const fallback = getSecret("ADMIN_PASSWORD_HASH") || getSecret("ADMIN_PASSWORD") || getSecret("DASHBOARD_PASSWORD");
  return fallback ? `derivado:${fallback}` : "";
}

/** Existe alguma credencial master definida? */
export function authConfigured(): boolean {
  return !!(getSecret("ADMIN_PASSWORD_HASH") || getSecret("ADMIN_PASSWORD") || getSecret("DASHBOARD_PASSWORD"));
}

export function masterUser(): string {
  return getSecret("ADMIN_USER") || getSecret("DASHBOARD_USER") || "admin";
}

export function storedMasterSecret(): string {
  return getSecret("ADMIN_PASSWORD_HASH") || getSecret("ADMIN_PASSWORD") || getSecret("DASHBOARD_PASSWORD") || "";
}

/** A senha master está guardada em texto puro? O painel avisa quando sim. */
export function masterPasswordNeedsHashing(): boolean {
  const stored = storedMasterSecret();
  return !!stored && !isHashed(stored);
}

export async function getSession(): Promise<Session | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token, secret);
}

export async function hasRole(role: Role): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return role === "viewer" ? true : session.role === "master";
}

/** Define a senha master, sempre gravando hash — nunca texto puro. */
export function setMasterPassword(password: string): void {
  writeSecrets({
    ADMIN_PASSWORD_HASH: hashPassword(password),
    // A senha em texto puro herdada do .env deixa de valer.
    ADMIN_PASSWORD: null,
    DASHBOARD_PASSWORD: null,
  });
}

export function ensureSessionSecret(): void {
  if (getSecret("SESSION_SECRET")) return;
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  writeSecrets({ SESSION_SECRET: random });
}
