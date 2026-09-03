import type {
  AdChannel,
  AdDailyRow,
  AdsProvider,
  CrmOpportunity,
  CrmProvider,
  FetchOptions,
} from "@/lib/types";
import { eachDay } from "@/lib/dates";
import { classifyChannel } from "@/lib/channel";

/**
 * Dados sintéticos determinísticos: a mesma data e o mesmo cliente sempre geram
 * os mesmos números. Serve para validar layout e cálculos sem credenciais —
 * nunca é usado quando um provedor real está configurado.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const META_CAMPAIGNS = [
  { name: "[MET] Conversão | Lead Form | Frio", type: "OUTCOME_LEADS", weight: 0.34 },
  { name: "[MET] Conversão | WhatsApp | Frio", type: "OUTCOME_LEADS", weight: 0.28 },
  { name: "[MET] Remarketing | 30d", type: "OUTCOME_SALES", weight: 0.18 },
  { name: "[MET] Advantage+ | Vendas", type: "OUTCOME_SALES", weight: 0.2 },
];

const GOOGLE_CAMPAIGNS = [
  { name: "[GAD] Search | Marca", type: "SEARCH", weight: 0.16 },
  { name: "[GAD] Search | Genéricas", type: "SEARCH", weight: 0.34 },
  { name: "[GAD] Performance Max | Geral", type: "PERFORMANCE_MAX", weight: 0.32 },
  { name: "[GAD] Demand Gen | Topo", type: "DEMAND_GEN", weight: 0.18 },
];

const DEMO_SOURCES = [
  { source: "facebook", weight: 0.32 },
  { source: "instagram", weight: 0.16 },
  { source: "google", weight: 0.3 },
  { source: "organic", weight: 0.14 },
  { source: "indicacao", weight: 0.08 },
];

const DEMO_STAGES = [
  { stage: "Novo lead", order: 0 },
  { stage: "Contato feito", order: 1 },
  { stage: "Qualificado", order: 2 },
  { stage: "Proposta enviada", order: 3 },
  { stage: "Negociação", order: 4 },
  { stage: "Fechado", order: 5 },
];

/** Sazonalidade semanal: fim de semana rende menos. */
function weekdayFactor(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return [0.72, 1.06, 1.1, 1.08, 1.04, 0.98, 0.74][day];
}

function baseSpend(channel: AdChannel, accountId: string): number {
  const random = mulberry32(hash(`${channel}:${accountId}`));
  return channel === "meta" ? 320 + random() * 480 : 240 + random() * 380;
}

function buildRows(channel: AdChannel, options: FetchOptions): AdDailyRow[] {
  const campaigns = channel === "meta" ? META_CAMPAIGNS : GOOGLE_CAMPAIGNS;
  const rows: AdDailyRow[] = [];

  options.accountIds.forEach((accountId) => {
    const daily = baseSpend(channel, accountId);

    eachDay(options.range).forEach((date) => {
      campaigns.forEach((campaign, index) => {
        const random = mulberry32(hash(`${channel}:${accountId}:${date}:${index}`));
        const noise = 0.75 + random() * 0.5;
        const spend = daily * campaign.weight * weekdayFactor(date) * noise;
        const cpm = channel === "meta" ? 18 + random() * 14 : 26 + random() * 18;
        const impressions = Math.round((spend / cpm) * 1000);
        const ctr = channel === "meta" ? 0.012 + random() * 0.018 : 0.032 + random() * 0.045;
        const clicks = Math.round(impressions * ctr);
        const conversionRate = 0.06 + random() * 0.09;
        const platformLeads = Math.round(clicks * conversionRate);
        const ticket = 480 + random() * 900;

        rows.push({
          date,
          channel,
          accountId,
          accountName: `Conta demo ${accountId.slice(-4)}`,
          campaignId: `${channel}-${index}`,
          campaign: campaign.name,
          campaignType: campaign.type,
          spend: Number(spend.toFixed(2)),
          impressions,
          clicks,
          platformLeads,
          conversionValue: Number((platformLeads * 0.22 * ticket).toFixed(2)),
        });
      });
    });
  });

  return rows;
}

export const demoAdsProvider: AdsProvider = {
  id: "demo",
  label: "Dados de demonstração",
  async fetchDaily(channel, options) {
    if (!options.accountIds.length) return [];
    return buildRows(channel, options);
  },
};

function pickSource(random: () => number): string {
  const roll = random();
  let cumulative = 0;
  for (const entry of DEMO_SOURCES) {
    cumulative += entry.weight;
    if (roll <= cumulative) return entry.source;
  }
  return "organic";
}

export const demoCrmProvider: CrmProvider = {
  id: "demo",
  label: "Dados de demonstração",
  async fetchOpportunities(options) {
    const opportunities: CrmOpportunity[] = [];
    const seedKey = options.locationId || options.accountIds.join("-") || "demo";

    eachDay(options.range).forEach((date) => {
      const dayRandom = mulberry32(hash(`crm:${seedKey}:${date}`));
      const count = Math.round((14 + dayRandom() * 16) * weekdayFactor(date));

      for (let i = 0; i < count; i += 1) {
        const random = mulberry32(hash(`crm:${seedKey}:${date}:${i}`));
        const source = pickSource(random);
        // Quanto mais avançado o estágio, menos oportunidades — funil real.
        const progress = random();
        const stageIndex =
          progress > 0.86 ? 5 : progress > 0.7 ? 4 : progress > 0.5 ? 3 : progress > 0.28 ? 2 : progress > 0.12 ? 1 : 0;
        const stage = DEMO_STAGES[stageIndex];
        const won = stageIndex === 5 && random() > 0.25;
        const lost = !won && stageIndex >= 3 && random() > 0.78;
        const value = Math.round(600 + random() * 3200);
        const hours = Math.floor(random() * 12) + 8;

        opportunities.push({
          id: `${date}-${i}`,
          name: `Oportunidade ${date} #${i + 1}`,
          createdAt: `${date}T${String(hours).padStart(2, "0")}:00:00.000Z`,
          updatedAt: `${date}T${String(hours + 2).padStart(2, "0")}:00:00.000Z`,
          pipeline: "Comercial",
          stage: stage.stage,
          stageOrder: stage.order,
          status: won ? "won" : lost ? "lost" : "open",
          value: won ? value : stageIndex >= 3 ? value : 0,
          source,
          channel: classifyChannel(source),
          campaign: null,
        });
      }
    });

    return opportunities;
  },
};
