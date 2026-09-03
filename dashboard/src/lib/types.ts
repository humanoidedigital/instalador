/**
 * Tipos compartilhados entre os provedores de dados, a camada de métricas e a UI.
 * Todo provedor (Windsor, API nativa, demo) normaliza sua resposta para estes formatos.
 */

export type AdChannel = "meta" | "google";
export type LeadChannel = AdChannel | "organic" | "other";

/** Uma linha diária de mídia paga, já normalizada por campanha. */
export interface AdDailyRow {
  date: string; // YYYY-MM-DD
  channel: AdChannel;
  accountId: string;
  accountName: string;
  campaignId: string;
  campaign: string;
  campaignType: string;
  spend: number;
  impressions: number;
  clicks: number;
  /** Conversões/leads reportados pela própria plataforma. */
  platformLeads: number;
  conversionValue: number;
}

export type CrmStatus = "open" | "won" | "lost" | "abandoned";

/** Uma oportunidade/lead do CRM, já normalizada. */
export interface CrmOpportunity {
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  pipeline: string;
  stage: string;
  /** Posição do estágio no pipeline (0 = primeiro). Usado para ordenar o funil. */
  stageOrder: number;
  status: CrmStatus;
  value: number;
  source: string;
  channel: LeadChannel;
  campaign: string | null;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface FetchOptions {
  range: DateRange;
  /** IDs das contas de anúncio do cliente selecionado. */
  accountIds: string[];
  /** locationId do GoHighLevel do cliente selecionado. */
  locationId?: string;
  signal?: AbortSignal;
}

export interface AdsProvider {
  id: string;
  label: string;
  /** Retorna linhas diárias por campanha para o canal informado. */
  fetchDaily(channel: AdChannel, options: FetchOptions): Promise<AdDailyRow[]>;
}

export interface CrmProvider {
  id: string;
  label: string;
  fetchOpportunities(options: FetchOptions): Promise<CrmOpportunity[]>;
}

export type KpiFormat = "currency" | "number" | "percent" | "decimal" | "days";

export interface Kpi {
  id: string;
  label: string;
  value: number;
  format: KpiFormat;
  /** Valor no período anterior de mesmo tamanho. */
  previous: number | null;
  /** Variação relativa (0.12 = +12%). null quando não há base de comparação. */
  delta: number | null;
  /** true quando subir é bom (leads), false quando subir é ruim (CPL). */
  higherIsBetter: boolean;
  /** Métrica sem "bom/ruim" — investimento, impressões. A variação aparece em cinza. */
  neutral?: boolean;
  hint?: string;
  /** Meta configurada para o cliente, quando existir. */
  goal?: number | null;
}

export interface TimeseriesPoint {
  date: string;
  spendMeta: number;
  spendGoogle: number;
  spend: number;
  impressions: number;
  clicks: number;
  platformLeads: number;
  crmLeads: number;
  won: number;
  revenue: number;
  cpl: number | null;
}

export interface ChannelSummary {
  channel: AdChannel;
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  platformLeads: number;
  crmLeads: number;
  won: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
}

export interface CampaignRow {
  key: string;
  channel: AdChannel;
  campaign: string;
  campaignType: string;
  accountName: string;
  spend: number;
  impressions: number;
  clicks: number;
  platformLeads: number;
  /** Valor de conversão reportado pela plataforma (Meta/Google). */
  platformValue: number;
  crmLeads: number;
  won: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  cac: number | null;
  roas: number | null;
}

export interface FunnelStage {
  stage: string;
  value: number;
  /** Conversão em relação ao estágio anterior. */
  stepRate: number | null;
}

export interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

export interface SourceRow {
  source: string;
  channel: LeadChannel;
  leads: number;
  won: number;
  revenue: number;
  conversionRate: number | null;
}

export type InsightSeverity = "good" | "warning" | "critical" | "info";

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
}

export interface DashboardPayload {
  meta: {
    clientId: string;
    clientName: string;
    currency: string;
    range: DateRange;
    previousRange: DateRange;
    generatedAt: string;
    sources: {
      ads: string;
      crm: string;
    };
    warnings: string[];
    demo: boolean;
  };
  kpis: Kpi[];
  series: TimeseriesPoint[];
  channels: ChannelSummary[];
  campaigns: CampaignRow[];
  funnel: FunnelStage[];
  pipeline: PipelineStage[];
  sources: SourceRow[];
  insights: Insight[];
}
