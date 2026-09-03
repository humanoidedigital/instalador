import fs from "node:fs";
import path from "node:path";

export interface ClientGoals {
  /** CPL alvo, na moeda do cliente. */
  cpl?: number | null;
  /** ROAS alvo (3 = 3x). */
  roas?: number | null;
  /** Investimento planejado no mês. */
  monthlyBudget?: number | null;
  /** Meta de leads no mês. */
  monthlyLeads?: number | null;
}

export interface ClientConfig {
  id: string;
  name: string;
  currency: string;
  metaAccountIds: string[];
  googleAccountIds: string[];
  /** locationId do GoHighLevel. Vazio = cliente sem CRM conectado. */
  ghlLocationId: string;
  goals: ClientGoals;
  active?: boolean;
}

const CONFIG_PATH =
  process.env.CLIENTS_CONFIG_PATH || path.join(process.cwd(), "config", "clients.json");

let cache: { mtimeMs: number; clients: ClientConfig[] } | null = null;

function normalize(raw: Partial<ClientConfig>, index: number): ClientConfig {
  return {
    id: String(raw.id || `cliente-${index + 1}`),
    name: String(raw.name || raw.id || `Cliente ${index + 1}`),
    currency: raw.currency || "BRL",
    metaAccountIds: (raw.metaAccountIds || []).map(String),
    googleAccountIds: (raw.googleAccountIds || []).map(String),
    ghlLocationId: raw.ghlLocationId ? String(raw.ghlLocationId) : "",
    goals: raw.goals || {},
    active: raw.active !== false,
  };
}

/**
 * Lê config/clients.json a cada mudança de arquivo — assim dá para adicionar um
 * cliente no VPS sem rebuildar nem reiniciar o processo.
 */
export function loadClients(): ClientConfig[] {
  try {
    const stat = fs.statSync(CONFIG_PATH);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.clients;

    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const list: Partial<ClientConfig>[] = Array.isArray(parsed) ? parsed : parsed.clients || [];
    const clients = list.map(normalize).filter((client) => client.active !== false);
    cache = { mtimeMs: stat.mtimeMs, clients };
    return clients;
  } catch (error) {
    console.error(`[clients] não foi possível ler ${CONFIG_PATH}:`, (error as Error).message);
    return [];
  }
}

/** Cliente virtual que soma todas as contas — a visão de agência. */
export function consolidatedClient(clients: ClientConfig[]): ClientConfig {
  return {
    id: "__all__",
    name: "Todos os clientes",
    currency: clients[0]?.currency || "BRL",
    metaAccountIds: clients.flatMap((client) => client.metaAccountIds),
    googleAccountIds: clients.flatMap((client) => client.googleAccountIds),
    ghlLocationId: "",
    goals: {
      monthlyBudget: sumGoal(clients, "monthlyBudget"),
      monthlyLeads: sumGoal(clients, "monthlyLeads"),
      cpl: null,
      roas: null,
    },
  };
}

function sumGoal(clients: ClientConfig[], key: "monthlyBudget" | "monthlyLeads"): number | null {
  const values = clients.map((client) => client.goals?.[key]).filter((value): value is number => typeof value === "number");
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0);
}

export function getClient(clientId: string | null | undefined): ClientConfig | null {
  const clients = loadClients();
  if (!clients.length) return null;
  if (!clientId || clientId === "__all__") return consolidatedClient(clients);
  return clients.find((client) => client.id === clientId) || null;
}

/** Lista para o seletor: agência primeiro, depois os clientes. */
export function clientOptions(): { id: string; name: string; hasCrm: boolean }[] {
  const clients = loadClients();
  return [
    { id: "__all__", name: "Todos os clientes", hasCrm: clients.some((c) => !!c.ghlLocationId) },
    ...clients.map((client) => ({ id: client.id, name: client.name, hasCrm: !!client.ghlLocationId })),
  ];
}
