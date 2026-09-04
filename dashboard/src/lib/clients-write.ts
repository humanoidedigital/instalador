import fs from "node:fs";
import path from "node:path";
import type { ClientConfig } from "./clients";

/**
 * Escrita do config/clients.json a partir do painel admin.
 * Valida antes de gravar e escreve de forma atômica — um JSON quebrado aqui
 * derruba o dashboard inteiro.
 */

export interface ClientInput {
  id: string;
  name: string;
  currency?: string;
  metaAccountIds?: string[];
  googleAccountIds?: string[];
  rdCrmTokenEnv?: string;
  rdCrmPipelines?: string[];
  goals?: { cpl?: number | null; roas?: number | null; monthlyBudget?: number | null; monthlyLeads?: number | null };
  active?: boolean;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}$/;

function clientsPath(): string {
  return process.env.CLIENTS_CONFIG_PATH || path.join(process.cwd(), "config", "clients.json");
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Erros de validação, em português, prontos para aparecer no formulário. */
export function validateClients(clients: ClientInput[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  clients.forEach((client, index) => {
    const label = client.name?.trim() || client.id || `cliente ${index + 1}`;

    if (!ID_PATTERN.test(client.id || "")) {
      errors.push(`"${label}": o identificador deve ter de 2 a 39 caracteres, só letras minúsculas, números e hífen.`);
    } else if (seen.has(client.id)) {
      errors.push(`"${label}": o identificador "${client.id}" está repetido.`);
    } else {
      seen.add(client.id);
    }

    if (client.id === "__all__") {
      errors.push(`"${label}": "__all__" é reservado para a visão consolidada.`);
    }
    if (!client.name || !client.name.trim()) {
      errors.push(`Cliente "${client.id}": o nome é obrigatório.`);
    }
    if (client.rdCrmTokenEnv && !/^[A-Z][A-Z0-9_]*$/.test(client.rdCrmTokenEnv)) {
      errors.push(
        `"${label}": o nome da variável de token deve ser em MAIÚSCULAS, com letras, números e "_" (ex.: RD_CRM_TOKEN_ISENTEI).`,
      );
    }
  });

  return errors;
}

export function normalizeClient(client: ClientInput): Record<string, unknown> {
  return {
    id: client.id.trim(),
    name: client.name.trim(),
    currency: (client.currency || "BRL").trim().toUpperCase(),
    metaAccountIds: cleanList(client.metaAccountIds),
    googleAccountIds: cleanList(client.googleAccountIds),
    rdCrmTokenEnv: (client.rdCrmTokenEnv || "").trim(),
    rdCrmPipelines: cleanList(client.rdCrmPipelines),
    goals: {
      cpl: cleanNumber(client.goals?.cpl),
      roas: cleanNumber(client.goals?.roas),
      monthlyBudget: cleanNumber(client.goals?.monthlyBudget),
      monthlyLeads: cleanNumber(client.goals?.monthlyLeads),
    },
    active: client.active !== false,
  };
}

export function writeClients(clients: ClientInput[]): void {
  const file = clientsPath();
  let comment = "";
  try {
    const existing = JSON.parse(fs.readFileSync(file, "utf8")) as { _comment?: string };
    comment = existing._comment || "";
  } catch {
    // Primeiro arquivo: segue sem comentário herdado.
  }

  const payload = {
    ...(comment ? { _comment: comment } : {}),
    clients: clients.map(normalizeClient),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

/** Formato aceito pelo formulário do admin. */
export function toInput(client: ClientConfig): ClientInput {
  return {
    id: client.id,
    name: client.name,
    currency: client.currency,
    metaAccountIds: client.metaAccountIds,
    googleAccountIds: client.googleAccountIds,
    rdCrmTokenEnv: client.rdCrmTokenEnv,
    rdCrmPipelines: client.rdCrmPipelines,
    goals: client.goals,
    active: client.active !== false,
  };
}
