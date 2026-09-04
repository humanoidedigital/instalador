import fs from "node:fs";
import path from "node:path";

/**
 * Cofre de credenciais editável em tempo de execução.
 *
 * O `.env` é lido só na inicialização do processo — se o painel admin gravasse
 * lá, cada troca de token exigiria reiniciar o servidor. Então o admin escreve
 * neste arquivo (permissão 600), que é relido quando muda, e o `.env` continua
 * valendo como valor inicial vindo do instalador.
 *
 * Ordem de resolução: config/secrets.json  ->  process.env
 */

function defaultPath(): string {
  if (process.env.SECRETS_PATH) return process.env.SECRETS_PATH;
  // Mora junto do clients.json, para o admin escrever onde o app lê.
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const dir = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(dir, "secrets.json");
}

let cache: { mtimeMs: number; values: Record<string, string> } | null = null;

export function secretsPath(): string {
  return defaultPath();
}

export function readSecrets(): Record<string, string> {
  const file = defaultPath();
  try {
    const stat = fs.statSync(file);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.values;

    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const values: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "string" && value !== "") values[key] = value;
    });
    cache = { mtimeMs: stat.mtimeMs, values };
    return values;
  } catch {
    // Arquivo ainda não existe: tudo vem do ambiente.
    return {};
  }
}

/** Valor efetivo de uma credencial ou configuração. */
export function getSecret(name: string): string | undefined {
  const stored = readSecrets()[name];
  if (stored !== undefined && stored !== "") return stored;
  const fromEnv = process.env[name];
  return fromEnv === "" ? undefined : fromEnv;
}

export function getSecretOr(name: string, fallback: string): string {
  return getSecret(name) ?? fallback;
}

export function hasSecret(name: string): boolean {
  return !!getSecret(name);
}

/** De onde veio o valor — o admin mostra isso para evitar confusão. */
export function secretOrigin(name: string): "cofre" | "ambiente" | "vazio" {
  if (readSecrets()[name]) return "cofre";
  if (process.env[name]) return "ambiente";
  return "vazio";
}

/**
 * Grava alterações. Valor `null` remove a chave do cofre (voltando ao .env).
 * Escreve em arquivo temporário e renomeia: um erro no meio não deixa o cofre
 * corrompido.
 */
export function writeSecrets(patch: Record<string, string | null>): void {
  const file = defaultPath();
  const current = { ...readSecrets() };

  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === "") delete current[key];
    else current[key] = value;
  });

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
  cache = null;
}

/** Nunca devolvemos o segredo inteiro para o browser. */
export function maskSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `••••••••${value.slice(-4)}`;
}
