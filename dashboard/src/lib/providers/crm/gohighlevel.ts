import type { CrmOpportunity, CrmProvider, CrmStatus, FetchOptions } from "@/lib/types";
import { cached, cacheTtlSeconds } from "@/lib/cache";
import { classifyChannel } from "@/lib/channel";
import { getSecret, getSecretOr } from "@/lib/secrets";

/**
 * GoHighLevel API v2 (services.leadconnectorhq.com).
 * Autenticação por Private Integration Token (Settings -> Private Integrations),
 * com os escopos opportunities.readonly, contacts.readonly e locations.readonly.
 */

// Lidas por chamada, não no import: o painel admin altera o cofre em tempo de execução.
const API_BASE = () => getSecretOr("GHL_API_BASE", "https://services.leadconnectorhq.com");
const API_VERSION = () => getSecretOr("GHL_API_VERSION", "2021-07-28");
const MAX_PAGES = () => Number(getSecretOr("GHL_MAX_PAGES", "30")); // 30 x 100 = 3.000 oportunidades

interface GhlStage {
  id: string;
  name: string;
  position?: number;
}

interface GhlPipeline {
  id: string;
  name: string;
  stages?: GhlStage[];
}

interface GhlAttribution {
  utmSessionSource?: string;
  utmSource?: string;
  utmMedium?: string;
  medium?: string;
  campaign?: string;
  utmCampaign?: string;
  sessionSource?: string;
  referrer?: string;
}

interface GhlOpportunity {
  id: string;
  name?: string;
  monetaryValue?: number;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  lastStatusChangeAt?: string;
  attributions?: GhlAttribution[];
  contact?: { attributionSource?: GhlAttribution; tags?: string[] };
}

function headers(): Record<string, string> {
  const token = getSecret("GHL_API_TOKEN");
  if (!token) {
    throw new Error("GHL_API_TOKEN não configurado — defina no .env ou use CRM_PROVIDER=demo.");
  }
  return {
    Authorization: `Bearer ${token}`,
    Version: API_VERSION(),
    Accept: "application/json",
  };
}

async function ghlFetch<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: headers(), signal, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`GoHighLevel ${response.status} em ${new URL(url).pathname}: ${body.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

/** Mapa stageId -> { nome, posição, pipeline } para nomear e ordenar o funil. */
async function loadStages(locationId: string, signal?: AbortSignal) {
  return cached(`ghl:pipelines:${locationId}`, 900, async () => {
    const payload = await ghlFetch<{ pipelines?: GhlPipeline[] }>(
      `${API_BASE()}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
      signal,
    );
    const stages = new Map<string, { stage: string; order: number; pipeline: string }>();
    (payload.pipelines || []).forEach((pipeline) => {
      (pipeline.stages || []).forEach((stage, index) => {
        stages.set(stage.id, {
          stage: stage.name || `Estágio ${index + 1}`,
          order: typeof stage.position === "number" ? stage.position : index,
          pipeline: pipeline.name || "Pipeline",
        });
      });
    });
    return stages;
  });
}

async function loadOpportunities(locationId: string, signal?: AbortSignal): Promise<GhlOpportunity[]> {
  const opportunities: GhlOpportunity[] = [];
  let url: string | null =
    `${API_BASE()}/opportunities/search?location_id=${encodeURIComponent(locationId)}&limit=100`;

  for (let page = 0; url && page < MAX_PAGES(); page += 1) {
    const payload: { opportunities?: GhlOpportunity[]; meta?: { nextPageUrl?: string | null } } =
      await ghlFetch(url, signal);
    opportunities.push(...(payload.opportunities || []));
    url = payload.meta?.nextPageUrl || null;
  }

  return opportunities;
}

function normalizeStatus(status: string | undefined, stageName: string): CrmStatus {
  const wonStages = getSecretOr("GHL_WON_STAGES", "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (wonStages.includes(stageName.toLowerCase())) return "won";

  switch ((status || "").toLowerCase()) {
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "abandoned":
      return "abandoned";
    default:
      return "open";
  }
}

function pickAttribution(opportunity: GhlOpportunity): GhlAttribution {
  return opportunity.attributions?.[0] || opportunity.contact?.attributionSource || {};
}

export const gohighlevelProvider: CrmProvider = {
  id: "gohighlevel",
  label: "GoHighLevel",
  async fetchOpportunities(options: FetchOptions) {
    const locationId = options.locationId;
    if (!locationId) return [];

    const [stages, raw] = await Promise.all([
      loadStages(locationId, options.signal),
      cached(`ghl:opps:${locationId}`, cacheTtlSeconds(), () => loadOpportunities(locationId, options.signal)),
    ]);

    const from = `${options.range.from}T00:00:00.000Z`;
    const to = `${options.range.to}T23:59:59.999Z`;

    return raw
      .filter((opportunity) => {
        const createdAt = opportunity.createdAt || "";
        return createdAt >= from && createdAt <= to;
      })
      .map<CrmOpportunity>((opportunity) => {
        const stageInfo = stages.get(opportunity.pipelineStageId || "");
        const stage = stageInfo?.stage || "Sem estágio";
        const attribution = pickAttribution(opportunity);
        const source =
          attribution.utmSource ||
          attribution.utmSessionSource ||
          attribution.sessionSource ||
          opportunity.source ||
          attribution.referrer ||
          "não identificado";
        const campaign = attribution.utmCampaign || attribution.campaign || null;

        return {
          id: opportunity.id,
          name: opportunity.name || "Oportunidade",
          createdAt: opportunity.createdAt || from,
          updatedAt: opportunity.updatedAt || opportunity.lastStatusChangeAt || opportunity.createdAt || from,
          pipeline: stageInfo?.pipeline || "Pipeline",
          stage,
          stageOrder: stageInfo?.order ?? 99,
          status: normalizeStatus(opportunity.status, stage),
          value: Number(opportunity.monetaryValue || 0),
          source,
          channel: classifyChannel(
            attribution.utmSource,
            attribution.utmSessionSource,
            attribution.sessionSource,
            attribution.utmMedium || attribution.medium,
            attribution.utmCampaign || attribution.campaign,
            opportunity.source,
          ),
          campaign,
        };
      });
  },
};
