import fs from "node:fs";
import path from "node:path";
import { hashPassword, verifyPassword } from "./password";

/**
 * Contas de acesso do cliente.
 *
 * Cada conta abre um relatório só — o do `clientId`. É o que permite mandar o
 * link para o cliente sem que ele veja a carteira inteira.
 *
 * Mora em arquivo próprio, e não no cofre de segredos, porque é uma lista com
 * estrutura (usuário, cliente, situação) e não pares chave/valor. O arquivo
 * guarda só o hash da senha e fica fora do git, como o cofre.
 */

export interface ClientUser {
  user: string;
  clientId: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  /** Última entrada bem-sucedida, para o painel mostrar quem realmente usa. */
  lastLoginAt: string | null;
}

/** O que pode sair para o navegador: nunca o hash. */
export interface ClientUserView {
  user: string;
  clientId: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const USER_PATTERN = /^[a-z0-9][a-z0-9._-]{2,39}$/;

function usersPath(): string {
  if (process.env.USERS_CONFIG_PATH) return process.env.USERS_CONFIG_PATH;
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const dir = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(dir, "users.json");
}

function normalize(raw: Partial<ClientUser>): ClientUser {
  return {
    user: String(raw.user || "").trim().toLowerCase(),
    clientId: String(raw.clientId || "").trim(),
    passwordHash: String(raw.passwordHash || ""),
    active: raw.active !== false,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    lastLoginAt: raw.lastLoginAt ? String(raw.lastLoginAt) : null,
  };
}

export function loadClientUsers(): ClientUser[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(usersPath(), "utf8")) as { users?: Partial<ClientUser>[] };
    return (parsed.users || []).map(normalize).filter((user) => user.user && user.clientId);
  } catch {
    // Sem arquivo ainda: nenhuma conta de cliente, que é o estado inicial.
    return [];
  }
}

export function listClientUsers(): ClientUserView[] {
  return loadClientUsers().map(({ passwordHash, ...view }) => view);
}

function persist(users: ClientUser[]): void {
  const file = usersPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ users }, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  // O rename preserva o modo do arquivo temporário, mas um arquivo herdado de
  // uma versão anterior pode estar aberto demais.
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Sistema de arquivos sem suporte a modo: segue sem falhar a gravação.
  }
}

export function validateClientUser(user: string, clientId: string, existing: ClientUser[]): string | null {
  const normalized = user.trim().toLowerCase();

  if (!USER_PATTERN.test(normalized)) {
    return "O usuário deve ter de 3 a 40 caracteres: minúsculas, números, ponto, hífen ou sublinhado.";
  }
  if (!clientId.trim()) return "Escolha o cliente que esta conta enxerga.";
  if (existing.some((item) => item.user === normalized)) return `O usuário "${normalized}" já existe.`;
  return null;
}

export function createClientUser(user: string, clientId: string, password: string): void {
  const users = loadClientUsers();
  const error = validateClientUser(user, clientId, users);
  if (error) throw new Error(error);
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");

  users.push({
    user: user.trim().toLowerCase(),
    clientId: clientId.trim(),
    passwordHash: hashPassword(password),
    active: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  });

  persist(users);
}

export function updateClientUser(
  user: string,
  patch: { clientId?: string; password?: string; active?: boolean },
): void {
  const users = loadClientUsers();
  const target = users.find((item) => item.user === user.trim().toLowerCase());
  if (!target) throw new Error(`Conta "${user}" não encontrada.`);

  if (patch.clientId !== undefined) {
    if (!patch.clientId.trim()) throw new Error("Escolha o cliente que esta conta enxerga.");
    target.clientId = patch.clientId.trim();
  }
  if (patch.password) {
    if (patch.password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    target.passwordHash = hashPassword(patch.password);
  }
  if (patch.active !== undefined) target.active = patch.active;

  persist(users);
}

export function removeClientUser(user: string): void {
  const normalized = user.trim().toLowerCase();
  persist(loadClientUsers().filter((item) => item.user !== normalized));
}

/** Devolve a conta quando usuário e senha conferem e a conta está ativa. */
export function authenticateClientUser(user: string, password: string): ClientUser | null {
  const target = loadClientUsers().find((item) => item.user === user.trim().toLowerCase());
  if (!target || !target.active) return null;
  if (!verifyPassword(password, target.passwordHash)) return null;
  return target;
}

export function recordClientLogin(user: string): void {
  const users = loadClientUsers();
  const target = users.find((item) => item.user === user.trim().toLowerCase());
  if (!target) return;
  target.lastLoginAt = new Date().toISOString();
  persist(users);
}

export function clientUsersPath(): string {
  return usersPath();
}
