import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha com scrypt. Só roda em rotas Node — o middleware nunca importa
 * este arquivo (lá o runtime é Edge e `node:crypto` não existe).
 *
 * Formato: scrypt$<saltHex>$<hashHex>
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;

  // Senha em texto puro no .env (instalação antiga ou ambiente local):
  // aceita, mas o painel avisa para trocar por hash.
  if (!stored.startsWith("scrypt$")) {
    return safeEqual(Buffer.from(password), Buffer.from(stored));
  }

  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;

  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Comparação em tempo constante, tolerante a tamanhos diferentes. */
function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    // Ainda compara para não vazar o tamanho pelo tempo de resposta.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function isHashed(stored: string | undefined): boolean {
  return !!stored && stored.startsWith("scrypt$");
}
