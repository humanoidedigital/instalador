/**
 * Sessão assinada por HMAC-SHA256.
 *
 * Usa Web Crypto (não `node:crypto`) porque este módulo roda também no
 * middleware, que executa no runtime Edge — lá `node:crypto` não existe.
 */

export type Role = "master" | "viewer";

export interface Session {
  user: string;
  role: Role;
  /** Epoch em milissegundos. */
  exp: number;
}

export const SESSION_COOKIE = "dashboard_session";
const DEFAULT_TTL_HOURS = 12;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(session: Session, secret: string): Promise<string> {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

/** Devolve a sessão só quando a assinatura confere e o prazo não venceu. */
export async function verifySession(token: string | undefined, secret: string): Promise<Session | null> {
  if (!token || !secret) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      decodeBase64Url(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) return null;

    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (session.role !== "master" && session.role !== "viewer") return null;
    return session;
  } catch {
    return null;
  }
}

export function newSession(user: string, role: Role, ttlHours = DEFAULT_TTL_HOURS): Session {
  return { user, role, exp: Date.now() + ttlHours * 3600_000 };
}

export function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: DEFAULT_TTL_HOURS * 3600,
  };
}
