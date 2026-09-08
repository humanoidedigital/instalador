import type { FetchOptions, OrganicDailyRow, OrganicProvider, OrganicSource } from "@/lib/types";
import { getSecret } from "@/lib/secrets";
import { loadOrganicConfig, type OrganicField, type OrganicSourceConfig } from "@/lib/organic-config";

/**
 * Tráfego orgânico via Windsor.ai.
 *
 * Cada fonte tem o seu conector e o seu vocabulário de campos, e o mapa vem de
 * `config/organic.json` — veja o porquê em organic-config.ts. Aqui só se pede
 * o que está mapeado e se traduz de volta para o formato normalizado.
 */

const BASE_URL = "https://connectors.windsor.ai";

type WindsorRow = Record<string, string | number | null>;

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function isPlanWarning(value: string): boolean {
  return value.includes("Uh-oh!") || value.includes("onboard.windsor.ai/app/pricing");
}

/**
 * Campos mapeados, no formato canônico -> ID do conector.
 *
 * Dois campos canônicos podem apontar para o mesmo ID — numa conta que só
 * reporta um número entre impressões e alcance, por exemplo. A lista mantém os
 * dois; quem monta a URL é que remove a repetição.
 */
function requestedFields(config: OrganicSourceConfig): { field: OrganicField; id: string }[] {
  return (Object.entries(config.fields) as [OrganicField, string][])
    .filter(([, id]) => Boolean(id))
    .map(([field, id]) => ({ field, id }));
}

export async function fetchOrganicRows(
  source: OrganicSource,
  options: FetchOptions,
): Promise<OrganicDailyRow[]> {
  const config = loadOrganicConfig().sources[source];
  if (!config.enabled) return [];
  if (!options.accountIds.length) return [];

  const apiKey = getSecret("WINDSOR_API_KEY");
  if (!apiKey) {
    throw new Error("WINDSOR_API_KEY não configurada — defina no .env ou use ORGANIC_PROVIDER=demo.");
  }

  const fields = requestedFields(config);
  if (!fields.some((item) => item.field === "date")) {
    throw new Error(
      `A fonte ${source} está sem o campo "date" no mapa. Sem data não dá para montar a série diária.`,
    );
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    date_from: options.range.from,
    date_to: options.range.to,
    fields: Array.from(new Set(fields.map((item) => item.id))).join(","),
    _renderer: "json",
  });

  if (getSecret("WINDSOR_SEND_ACCOUNT_FILTER") === "true") {
    params.set("select_accounts", options.accountIds.join(","));
  }

  const response = await fetch(`${BASE_URL}/${config.connector}?${params.toString()}`, {
    signal: options.signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Windsor.ai ${config.connector} respondeu ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as { data?: WindsorRow[]; result?: WindsorRow[] };
  const rows = payload.data || payload.result || [];

  if (rows.some((row) => Object.values(row).some((value) => isPlanWarning(str(value))))) {
    throw new Error(
      "Windsor.ai bloqueou os dados: há mais contas conectadas do que o plano permite. " +
        "Faça upgrade em onboard.windsor.ai/app/pricing ou desconecte contas até o limite do plano.",
    );
  }

  return rows.map((row) => mapRow(source, config, row)).filter((row) => row.date);
}

function mapRow(source: OrganicSource, config: OrganicSourceConfig, row: WindsorRow): OrganicDailyRow {
  const get = (field: OrganicField) => {
    const id = config.fields[field];
    return id ? row[id] : undefined;
  };

  const impressions = num(get("impressions"));
  const position = num(get("position"));

  return {
    date: str(get("date")).slice(0, 10),
    source,
    accountId: str(get("accountId")),
    accountName: str(get("accountName"), "Conta sem nome"),
    dimension: str(get("dimension"), "—"),
    sessions: num(get("sessions")),
    users: num(get("users")),
    newUsers: num(get("newUsers")),
    engagedSessions: num(get("engagedSessions")),
    pageViews: num(get("pageViews")),
    conversions: num(get("conversions")),
    impressions,
    clicks: num(get("clicks")),
    // Guardamos posição já ponderada por impressões: somar posições médias de
    // consultas diferentes daria um número errado.
    positionWeighted: position * impressions,
    reach: num(get("reach")),
    engagement: num(get("engagement")),
    followers: num(get("followers")),
    posts: num(get("posts")),
  };
}

/** Chamada crua, para o diagnóstico mostrar o que o conector devolve de verdade. */
export async function probeOrganicSource(
  source: OrganicSource,
  options: FetchOptions,
): Promise<{ fields: string[]; rows: WindsorRow[] }> {
  const config = loadOrganicConfig().sources[source];
  const apiKey = getSecret("WINDSOR_API_KEY");
  if (!apiKey) throw new Error("WINDSOR_API_KEY não configurada.");

  const params = new URLSearchParams({
    api_key: apiKey,
    date_from: options.range.from,
    date_to: options.range.to,
    fields: Array.from(new Set(requestedFields(config).map((item) => item.id))).join(","),
    _renderer: "json",
  });

  const response = await fetch(`${BASE_URL}/${config.connector}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Windsor.ai ${config.connector} respondeu ${response.status}: ${text.slice(0, 400)}`);
  }

  const payload = JSON.parse(text) as { data?: WindsorRow[]; result?: WindsorRow[] };
  const rows = (payload.data || payload.result || []).slice(0, 3);
  const fields = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  return { fields, rows };
}

export const windsorOrganicProvider: OrganicProvider = {
  id: "windsor",
  label: "Windsor.ai (orgânico)",
  fetchDaily: fetchOrganicRows,
};
