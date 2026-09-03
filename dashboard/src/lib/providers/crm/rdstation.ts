import type { CrmOpportunity, CrmProvider, CrmStatus, FetchOptions } from "@/lib/types";
import { cached, cacheTtlSeconds } from "@/lib/cache";
import { classifyChannel } from "@/lib/channel";

/**
 * RD Station CRM.
 *
 * Duas gerações da API convivem e o .env escolhe qual usar (RD_CRM_API_VERSION):
 *   v1 (padrão) — https://crm.rdstation.com/api/v1, autenticada pelo token da
 *                 conta na query string (Configurações → Integrações → API).
 *   v2          — https://api.rd.services/crm/v2, autenticada por Bearer token,
 *                 com paginação no formato page[number]/page[size].
 *
 * O parsing é deliberadamente tolerante: cada campo aceita as variações de nome
 * que as duas versões usam, e o filtro de data é reaplicado localmente mesmo
 * quando enviado na query. Assim uma diferença de contrato vira um número certo
 * em vez de um erro.
 */

const V1_BASE = process.env.RD_CRM_API_BASE || "https://crm.rdstation.com/api/v1";
const V2_BASE = process.env.RD_CRM_V2_API_BASE || "https://api.rd.services/crm/v2";
const PAGE_SIZE = Number(process.env.RD_CRM_PAGE_SIZE || 200);
const MAX_PAGES = Number(process.env.RD_CRM_MAX_PAGES || 30);

type Json = Record<string, unknown>;

function isV2(): boolean {
  return (process.env.RD_CRM_API_VERSION || "v1").toLowerCase() === "v2";
}

function pick(source: Json | undefined, ...keys: string[]): unknown {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function text(value: unknown, fallback = ""): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    const named = pick(value as Json, "name", "nickname", "label", "title");
    return named === undefined ? fallback : String(named);
  }
  return String(value);
}

function money(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  // A v1 devolve valores como string; o separador decimal pode vir em pt-BR.
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: unknown, fallback: string): string {
  const raw = text(value);
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

async function request(path: string, token: string, params: URLSearchParams, signal?: AbortSignal): Promise<Json> {
  const base = isV2() ? V2_BASE : V1_BASE;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (isV2()) headers.Authorization = `Bearer ${token}`;
  else params.set("token", token);

  const url = `${base}${path}?${params.toString()}`;
  const response = await fetch(url, { headers, signal, cache: "no-store" });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const hint =
      response.status === 401 || response.status === 403
        ? " Confira o token da conta (Configurações → Integrações → API) e se ele pertence a esta conta do RD Station CRM."
        : "";
    throw new Error(`RD Station CRM ${response.status} em ${path}: ${body.slice(0, 240)}${hint}`);
  }

  return (await response.json()) as Json;
}

/** Extrai a lista de uma resposta, cobrindo os formatos das duas versões. */
function listOf(payload: Json, ...keys: string[]): Json[] {
  for (const key of [...keys, "data", "items"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value as Json[];
  }
  return [];
}

function hasMore(payload: Json, received: number): boolean {
  const explicit = pick(payload, "has_more", "hasMore");
  if (typeof explicit === "boolean") return explicit;
  return received >= PAGE_SIZE;
}

async function fetchPaged(
  path: string,
  listKey: string,
  token: string,
  build: (page: number) => URLSearchParams,
  signal?: AbortSignal,
): Promise<Json[]> {
  const items: Json[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = await request(path, token, build(page), signal);
    const batch = listOf(payload, listKey);
    items.push(...batch);
    if (!batch.length || !hasMore(payload, batch.length)) break;
  }

  return items;
}

/** Nome e ordem de cada etapa do funil, para nomear o pipeline e ordenar o funil. */
async function loadStages(token: string, signal?: AbortSignal) {
  return cached(`rd:stages:${token.slice(-8)}`, 900, async () => {
    const stages = new Map<string, { stage: string; order: number; pipeline: string }>();
    try {
      const list = await fetchPaged(
        isV2() ? "/deal_stages" : "/deal_stages",
        "deal_stages",
        token,
        (page) =>
          new URLSearchParams(
            isV2()
              ? { "page[number]": String(page), "page[size]": String(PAGE_SIZE) }
              : { page: String(page), limit: String(PAGE_SIZE) },
          ),
        signal,
      );

      list.forEach((stage, index) => {
        const id = text(pick(stage, "id", "_id"));
        if (!id) return;
        stages.set(id, {
          stage: text(pick(stage, "name", "nickname"), `Etapa ${index + 1}`),
          order: Number(pick(stage, "order", "position") ?? index),
          pipeline: text(pick(stage, "deal_pipeline", "pipeline"), "Funil"),
        });
      });
    } catch (error) {
      // Sem as etapas o funil ainda funciona: o nome vem do próprio negócio.
      console.warn("[rdstation] não foi possível carregar as etapas:", (error as Error).message);
    }
    return stages;
  });
}

async function loadDeals(token: string, options: FetchOptions): Promise<Json[]> {
  return fetchPaged(
    "/deals",
    "deals",
    token,
    (page) =>
      new URLSearchParams(
        isV2()
          ? {
              "page[number]": String(page),
              "page[size]": String(PAGE_SIZE),
              "filter[created_at][gte]": options.range.from,
              "filter[created_at][lte]": options.range.to,
            }
          : {
              page: String(page),
              limit: String(PAGE_SIZE),
              created_at_period: "true",
              start_date: options.range.from,
              end_date: options.range.to,
            },
      ),
    options.signal,
  );
}

function customField(deal: Json, label: string): string | null {
  const fields = listOf(deal, "deal_custom_fields", "custom_fields");
  const wanted = label.toLowerCase();
  for (const field of fields) {
    const definition = (pick(field, "custom_field") as Json) || field;
    const name = text(pick(definition, "label", "name")).toLowerCase();
    if (name === wanted) {
      const value = text(pick(field, "value", "text_value"));
      return value || null;
    }
  }
  return null;
}

function statusOf(deal: Json, stageName: string): CrmStatus {
  const wonStages = (process.env.RD_WON_STAGES || "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  if (wonStages.includes(stageName.toLowerCase())) return "won";

  const win = pick(deal, "win");
  if (win === true || win === "true") return "won";
  if (win === false || win === "false") return "lost";

  // A v2 pode expor o desfecho como texto em vez de booleano.
  const status = text(pick(deal, "status", "deal_status")).toLowerCase();
  if (status.includes("won") || status.includes("ganho")) return "won";
  if (status.includes("lost") || status.includes("perdid")) return "lost";
  if (pick(deal, "deal_lost_reason", "lost_reason")) return "lost";

  return "open";
}

export function mapDeal(
  deal: Json,
  stages: Map<string, { stage: string; order: number; pipeline: string }>,
  fallbackDate: string,
): CrmOpportunity {
  const stageObject = (pick(deal, "deal_stage", "stage") as Json) || {};
  const stageId = text(pick(stageObject, "id", "_id") ?? pick(deal, "deal_stage_id"));
  const stageInfo = stages.get(stageId);
  const stage = stageInfo?.stage || text(pick(stageObject, "name", "nickname"), "Sem etapa");
  const createdAt = iso(pick(deal, "created_at", "createdAt"), fallbackDate);

  const utmSource = customField(deal, process.env.RD_UTM_SOURCE_FIELD || "utm_source");
  const utmCampaign = customField(deal, process.env.RD_UTM_CAMPAIGN_FIELD || "utm_campaign");
  const source = utmSource || text(pick(deal, "deal_source", "source"), "não identificado");
  const campaign = utmCampaign || text(pick(deal, "campaign"), "") || null;

  return {
    id: text(pick(deal, "id", "_id"), createdAt),
    name: text(pick(deal, "name", "title"), "Negociação"),
    createdAt,
    updatedAt: iso(pick(deal, "updated_at", "closed_at", "updatedAt"), createdAt),
    pipeline:
      stageInfo?.pipeline ||
      text(pick(deal, "deal_pipeline", "pipeline") ?? pick(stageObject, "deal_pipeline"), "Funil"),
    stage,
    stageOrder: stageInfo?.order ?? Number(pick(stageObject, "order", "position") ?? 99),
    status: statusOf(deal, stage),
    value: money(pick(deal, "amount_total", "amount_unique", "amount_montly", "amount_monthly", "value")),
    source,
    channel: classifyChannel(source, campaign, text(pick(deal, "deal_source", "source"))),
    campaign,
  };
}

/** Token do cliente: cada conta do RD Station CRM tem o seu. */
function resolveToken(options: FetchOptions): string {
  const token = options.crmToken || process.env.RD_CRM_TOKEN;
  if (!token) {
    throw new Error(
      "Token do RD Station CRM não configurado — defina RD_CRM_TOKEN no .env ou aponte rdCrmTokenEnv no config/clients.json.",
    );
  }
  return token;
}

export const rdstationProvider: CrmProvider = {
  id: "rdstation",
  label: "RD Station CRM",
  async fetchOpportunities(options: FetchOptions) {
    const token = resolveToken(options);

    const [stages, deals] = await Promise.all([
      loadStages(token, options.signal),
      cached(`rd:deals:${token.slice(-8)}:${options.range.from}:${options.range.to}`, cacheTtlSeconds(), () =>
        loadDeals(token, options),
      ),
    ]);

    const from = `${options.range.from}T00:00:00.000Z`;
    const to = `${options.range.to}T23:59:59.999Z`;
    const pipelines = (options.pipelines || []).map((name) => name.toLowerCase());

    return deals
      .map((deal) => mapDeal(deal, stages, from))
      // O filtro de data também é aplicado aqui: se a API ignorar o parâmetro,
      // o período do painel continua correto.
      .filter((opportunity) => opportunity.createdAt >= from && opportunity.createdAt <= to)
      .filter((opportunity) => !pipelines.length || pipelines.includes(opportunity.pipeline.toLowerCase()));
  },
};

/**
 * Diagnóstico da integração: mostra o que a API devolveu e como foi mapeado,
 * sem expor dados pessoais (nomes truncados, nenhum contato). Serve para
 * conferir o contrato da API contra um token real em um comando só.
 */
export async function inspectRdStation(options: FetchOptions) {
  const token = resolveToken(options);
  const stages = await loadStages(token, options.signal);
  const deals = await loadDeals(token, options);
  const fallback = `${options.range.from}T00:00:00.000Z`;
  const mapped = deals.map((deal) => mapDeal(deal, stages, fallback));

  const count = <T,>(values: T[]) => {
    const totals = new Map<string, number>();
    values.forEach((value) => totals.set(String(value), (totals.get(String(value)) || 0) + 1));
    return Object.fromEntries(Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15));
  };

  return {
    apiVersion: isV2() ? "v2" : "v1",
    endpoint: `${isV2() ? V2_BASE : V1_BASE}/deals`,
    dealsRetornados: deals.length,
    etapasCarregadas: stages.size,
    // As chaves cruas do primeiro negócio: se o mapeamento estiver errado,
    // a diferença de nome aparece aqui.
    camposDoPrimeiroNegocio: Object.keys(deals[0] || {}).sort(),
    statusMapeados: count(mapped.map((opportunity) => opportunity.status)),
    etapasMapeadas: count(mapped.map((opportunity) => opportunity.stage)),
    funisMapeados: count(mapped.map((opportunity) => opportunity.pipeline)),
    origensMapeadas: count(mapped.map((opportunity) => opportunity.source)),
    canaisMapeados: count(mapped.map((opportunity) => opportunity.channel)),
    negociosComValor: mapped.filter((opportunity) => opportunity.value > 0).length,
    valorTotal: Math.round(mapped.reduce((total, opportunity) => total + opportunity.value, 0) * 100) / 100,
    amostra: mapped.slice(0, 3).map((opportunity) => ({
      criadoEm: opportunity.createdAt,
      etapa: opportunity.stage,
      ordemDaEtapa: opportunity.stageOrder,
      status: opportunity.status,
      valor: opportunity.value,
      origem: opportunity.source,
      canal: opportunity.channel,
      campanha: opportunity.campaign,
    })),
  };
}
