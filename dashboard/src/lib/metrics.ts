import type {
  AdChannel,
  AdDailyRow,
  CampaignRow,
  ChannelSummary,
  CrmOpportunity,
  DashboardPayload,
  DateRange,
  FunnelStage,
  Insight,
  Kpi,
  PipelineStage,
  SourceRow,
  TimeseriesPoint,
} from "./types";
import type { ClientConfig } from "./clients";
import { CHANNEL_LABELS, normalizeCampaignKey } from "./channel";
import { eachDay } from "./dates";
import { safeDivide } from "./format";

/** KPIs que aparecem na linha principal; o resto vai para o bloco secundário. */
export const PRIMARY_KPI_IDS = ["spend", "crmLeads", "cpl", "opportunities", "won", "revenue", "roas", "cac"];

interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  platformLeads: number;
  /** Valor de conversão reportado pelas plataformas — usado quando o CRM não traz receita. */
  platformValue: number;
  crmLeads: number;
  opportunities: number;
  won: number;
  lost: number;
  revenue: number;
}

function emptyTotals(): Totals {
  return {
    spend: 0,
    impressions: 0,
    clicks: 0,
    platformLeads: 0,
    platformValue: 0,
    crmLeads: 0,
    opportunities: 0,
    won: 0,
    lost: 0,
    revenue: 0,
  };
}

/** Oportunidade que passou da triagem inicial — o "lead qualificado" do funil. */
function isQualified(opportunity: CrmOpportunity): boolean {
  return opportunity.status === "won" || opportunity.stageOrder >= 2;
}

export function computeTotals(adRows: AdDailyRow[], opportunities: CrmOpportunity[]): Totals {
  const totals = emptyTotals();

  adRows.forEach((row) => {
    totals.spend += row.spend;
    totals.impressions += row.impressions;
    totals.clicks += row.clicks;
    totals.platformLeads += row.platformLeads;
    totals.platformValue += row.conversionValue;
  });

  opportunities.forEach((opportunity) => {
    totals.crmLeads += 1;
    if (isQualified(opportunity)) totals.opportunities += 1;
    if (opportunity.status === "won") {
      totals.won += 1;
      totals.revenue += opportunity.value;
    }
    if (opportunity.status === "lost") totals.lost += 1;
  });

  return totals;
}

function delta(current: number, previous: number | null): number | null {
  if (previous === null || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function kpi(
  id: string,
  label: string,
  value: number | null,
  previous: number | null,
  format: Kpi["format"],
  higherIsBetter: boolean,
  extra: Partial<Kpi> = {},
): Kpi {
  const current = value ?? 0;
  return {
    id,
    label,
    value: current,
    previous,
    delta: delta(current, previous),
    format,
    higherIsBetter,
    ...extra,
  };
}

export function buildKpis(current: Totals, previous: Totals, client: ClientConfig): Kpi[] {
  const cpl = safeDivide(current.spend, current.crmLeads || current.platformLeads);
  const previousCpl = safeDivide(previous.spend, previous.crmLeads || previous.platformLeads);
  // Sem receita no CRM, cai para o valor de conversão das plataformas em vez de mostrar zero.
  const revenue = current.revenue || current.platformValue;
  const previousRevenue = previous.revenue || previous.platformValue;

  return [
    kpi("spend", "Investimento", current.spend, previous.spend, "currency", true, {
      neutral: true,
      goal: client.goals.monthlyBudget ?? null,
      hint: "Soma do gasto em Meta Ads e Google Ads no período.",
    }),
    kpi("crmLeads", "Leads no CRM", current.crmLeads, previous.crmLeads, "number", true, {
      goal: client.goals.monthlyLeads ?? null,
      hint: "Oportunidades criadas no GoHighLevel no período.",
    }),
    kpi("cpl", "CPL", cpl, previousCpl, "currency", false, {
      goal: client.goals.cpl ?? null,
      hint: "Investimento dividido pelos leads do CRM (ou pelos leads das plataformas, se o CRM não estiver conectado).",
    }),
    kpi("opportunities", "Oportunidades qualificadas", current.opportunities, previous.opportunities, "number", true, {
      hint: "Oportunidades que avançaram além da triagem inicial no pipeline.",
    }),
    kpi("won", "Vendas ganhas", current.won, previous.won, "number", true),
    kpi("revenue", "Receita", revenue, previousRevenue, "currency", true, {
      hint: "Soma do valor das oportunidades ganhas no CRM. Sem receita no CRM, usa o valor de conversão reportado pelas plataformas.",
    }),
    kpi("roas", "ROAS", safeDivide(revenue, current.spend), safeDivide(previousRevenue, previous.spend), "decimal", true, {
      goal: client.goals.roas ?? null,
      hint: "Receita do CRM dividida pelo investimento em mídia.",
    }),
    kpi("cac", "CAC", safeDivide(current.spend, current.won), safeDivide(previous.spend, previous.won), "currency", false, {
      hint: "Investimento dividido pelo número de vendas ganhas.",
    }),
    kpi("impressions", "Impressões", current.impressions, previous.impressions, "number", true, { neutral: true }),
    kpi("clicks", "Cliques", current.clicks, previous.clicks, "number", true),
    kpi("ctr", "CTR", safeDivide(current.clicks, current.impressions), safeDivide(previous.clicks, previous.impressions), "percent", true),
    kpi("cpc", "CPC", safeDivide(current.spend, current.clicks), safeDivide(previous.spend, previous.clicks), "currency", false),
    kpi("cpm", "CPM", safeDivide(current.spend * 1000, current.impressions), safeDivide(previous.spend * 1000, previous.impressions), "currency", false),
    kpi("platformLeads", "Conversões nas plataformas", current.platformLeads, previous.platformLeads, "number", true, {
      hint: "Conversões reportadas pelo Meta e pelo Google. Diverge do CRM por causa da janela de atribuição.",
    }),
    kpi(
      "leadToSale",
      "Conversão lead → venda",
      safeDivide(current.won, current.crmLeads),
      safeDivide(previous.won, previous.crmLeads),
      "percent",
      true,
    ),
    kpi("ticket", "Ticket médio", safeDivide(current.revenue, current.won), safeDivide(previous.revenue, previous.won), "currency", true),
    kpi("cpa", "Custo por conversão (plataformas)", safeDivide(current.spend, current.platformLeads), safeDivide(previous.spend, previous.platformLeads), "currency", false, {
      hint: "Investimento dividido pelas conversões reportadas pelo Meta e pelo Google.",
    }),
  ];
}

export function buildSeries(
  range: DateRange,
  adRows: AdDailyRow[],
  opportunities: CrmOpportunity[],
): TimeseriesPoint[] {
  const byDate = new Map<string, TimeseriesPoint>();

  eachDay(range).forEach((date) => {
    byDate.set(date, {
      date,
      spendMeta: 0,
      spendGoogle: 0,
      spend: 0,
      impressions: 0,
      clicks: 0,
      platformLeads: 0,
      crmLeads: 0,
      won: 0,
      revenue: 0,
      cpl: null,
    });
  });

  adRows.forEach((row) => {
    const point = byDate.get(row.date);
    if (!point) return;
    if (row.channel === "meta") point.spendMeta += row.spend;
    else point.spendGoogle += row.spend;
    point.spend += row.spend;
    point.impressions += row.impressions;
    point.clicks += row.clicks;
    point.platformLeads += row.platformLeads;
  });

  opportunities.forEach((opportunity) => {
    const point = byDate.get(opportunity.createdAt.slice(0, 10));
    if (!point) return;
    point.crmLeads += 1;
    if (opportunity.status === "won") {
      point.won += 1;
      point.revenue += opportunity.value;
    }
  });

  return Array.from(byDate.values()).map((point) => ({
    ...point,
    spendMeta: round2(point.spendMeta),
    spendGoogle: round2(point.spendGoogle),
    spend: round2(point.spend),
    revenue: round2(point.revenue),
    cpl: point.crmLeads ? round2(point.spend / point.crmLeads) : null,
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildChannels(adRows: AdDailyRow[], opportunities: CrmOpportunity[]): ChannelSummary[] {
  const channels: AdChannel[] = ["meta", "google"];

  return channels.map((channel) => {
    const rows = adRows.filter((row) => row.channel === channel);
    const leads = opportunities.filter((opportunity) => opportunity.channel === channel);
    const spend = sum(rows, (row) => row.spend);
    const impressions = sum(rows, (row) => row.impressions);
    const clicks = sum(rows, (row) => row.clicks);
    const platformLeads = sum(rows, (row) => row.platformLeads);
    const crmLeads = leads.length;
    const won = leads.filter((lead) => lead.status === "won").length;
    const revenue = sum(
      leads.filter((lead) => lead.status === "won"),
      (lead) => lead.value,
    );
    const platformValue = sum(rows, (row) => row.conversionValue);
    const revenueBasis = revenue || platformValue;

    return {
      channel,
      label: CHANNEL_LABELS[channel],
      spend: round2(spend),
      impressions,
      clicks,
      platformLeads,
      crmLeads,
      won,
      revenue: round2(revenue),
      ctr: safeDivide(clicks, impressions),
      cpc: safeDivide(spend, clicks),
      cpm: safeDivide(spend * 1000, impressions),
      cpl: safeDivide(spend, crmLeads || platformLeads),
      cac: safeDivide(spend, won),
      roas: revenueBasis > 0 ? safeDivide(revenueBasis, spend) : null,
    };
  });
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

export function buildCampaigns(adRows: AdDailyRow[], opportunities: CrmOpportunity[]): CampaignRow[] {
  const grouped = new Map<string, CampaignRow>();

  // Leads do CRM casados por utm_campaign normalizado.
  const leadsByCampaign = new Map<string, CrmOpportunity[]>();
  opportunities.forEach((opportunity) => {
    const key = normalizeCampaignKey(opportunity.campaign);
    if (!key) return;
    const list = leadsByCampaign.get(key) || [];
    list.push(opportunity);
    leadsByCampaign.set(key, list);
  });

  adRows.forEach((row) => {
    const key = `${row.channel}:${row.campaignId || row.campaign}`;
    const entry =
      grouped.get(key) ||
      ({
        key,
        channel: row.channel,
        campaign: row.campaign,
        campaignType: row.campaignType,
        accountName: row.accountName,
        spend: 0,
        impressions: 0,
        clicks: 0,
        platformLeads: 0,
        platformValue: 0,
        crmLeads: 0,
        won: 0,
        revenue: 0,
        ctr: null,
        cpc: null,
        cpl: null,
        cac: null,
        roas: null,
      } as CampaignRow);

    entry.spend += row.spend;
    entry.impressions += row.impressions;
    entry.clicks += row.clicks;
    entry.platformLeads += row.platformLeads;
    entry.platformValue += row.conversionValue;
    grouped.set(key, entry);
  });

  return Array.from(grouped.values())
    .map((entry) => {
      const matched = leadsByCampaign.get(normalizeCampaignKey(entry.campaign)) || [];
      const won = matched.filter((lead) => lead.status === "won");
      const crmLeads = matched.length;
      const revenue = sum(won, (lead) => lead.value);
      const revenueBasis = revenue || entry.platformValue;

      return {
        ...entry,
        spend: round2(entry.spend),
        crmLeads,
        won: won.length,
        revenue: round2(revenue),
        ctr: safeDivide(entry.clicks, entry.impressions),
        cpc: safeDivide(entry.spend, entry.clicks),
        cpl: safeDivide(entry.spend, crmLeads || entry.platformLeads),
        cac: safeDivide(entry.spend, won.length),
        roas: revenueBasis > 0 ? safeDivide(revenueBasis, entry.spend) : null,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

export function buildFunnel(totals: Totals): FunnelStage[] {
  const leads = totals.crmLeads || totals.platformLeads;
  const raw = [
    { stage: "Cliques", value: totals.clicks },
    { stage: "Leads", value: leads },
    { stage: "Qualificados", value: totals.opportunities },
    { stage: "Vendas", value: totals.won },
  ];

  return raw.map((entry, index) => ({
    ...entry,
    stepRate: index === 0 ? null : safeDivide(entry.value, raw[index - 1].value),
  }));
}

export function buildPipeline(opportunities: CrmOpportunity[]): PipelineStage[] {
  const grouped = new Map<string, PipelineStage & { order: number }>();

  opportunities.forEach((opportunity) => {
    const entry = grouped.get(opportunity.stage) || {
      stage: opportunity.stage,
      count: 0,
      value: 0,
      order: opportunity.stageOrder,
    };
    entry.count += 1;
    entry.value += opportunity.value;
    grouped.set(opportunity.stage, entry);
  });

  return Array.from(grouped.values())
    .sort((a, b) => a.order - b.order)
    .map(({ stage, count, value }) => ({ stage, count, value: round2(value) }));
}

export function buildSources(opportunities: CrmOpportunity[]): SourceRow[] {
  const grouped = new Map<string, SourceRow>();

  opportunities.forEach((opportunity) => {
    const entry = grouped.get(opportunity.source) || {
      source: opportunity.source,
      channel: opportunity.channel,
      leads: 0,
      won: 0,
      revenue: 0,
      conversionRate: null,
    };
    entry.leads += 1;
    if (opportunity.status === "won") {
      entry.won += 1;
      entry.revenue += opportunity.value;
    }
    grouped.set(opportunity.source, entry);
  });

  return Array.from(grouped.values())
    .map((entry) => ({ ...entry, revenue: round2(entry.revenue), conversionRate: safeDivide(entry.won, entry.leads) }))
    .sort((a, b) => b.leads - a.leads);
}

export function buildInsights(
  current: Totals,
  previous: Totals,
  campaigns: CampaignRow[],
  channels: ChannelSummary[],
  client: ClientConfig,
): Insight[] {
  const insights: Insight[] = [];
  const cpl = safeDivide(current.spend, current.crmLeads || current.platformLeads);
  const previousCpl = safeDivide(previous.spend, previous.crmLeads || previous.platformLeads);
  const currency = client.currency || "BRL";
  const money = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

  if (cpl !== null && client.goals.cpl) {
    const gap = (cpl - client.goals.cpl) / client.goals.cpl;
    insights.push({
      id: "cpl-goal",
      severity: gap <= 0 ? "good" : gap > 0.25 ? "critical" : "warning",
      title: gap <= 0 ? "CPL dentro da meta" : "CPL acima da meta",
      detail: `CPL de ${money(cpl)} contra meta de ${money(client.goals.cpl)} (${gap >= 0 ? "+" : ""}${Math.round(gap * 100)}%).`,
    });
  }

  if (cpl !== null && previousCpl !== null) {
    const change = (cpl - previousCpl) / previousCpl;
    if (Math.abs(change) >= 0.15) {
      insights.push({
        id: "cpl-trend",
        severity: change > 0 ? "warning" : "good",
        title: change > 0 ? "CPL subiu no período" : "CPL caiu no período",
        detail: `${change > 0 ? "Alta" : "Queda"} de ${Math.abs(Math.round(change * 100))}% contra o período anterior (${money(previousCpl)} → ${money(cpl)}).`,
      });
    }
  }

  const roas = safeDivide(current.revenue || current.platformValue, current.spend);
  if (roas !== null && client.goals.roas) {
    insights.push({
      id: "roas-goal",
      severity: roas >= client.goals.roas ? "good" : roas >= client.goals.roas * 0.7 ? "warning" : "critical",
      title: roas >= client.goals.roas ? "ROAS na meta" : "ROAS abaixo da meta",
      detail: `ROAS de ${roas.toFixed(2)}x contra meta de ${client.goals.roas.toFixed(2)}x.`,
    });
  }

  // Campanhas com investimento relevante e nenhum lead: dinheiro parado.
  const spendThreshold = Math.max(current.spend * 0.03, 50);
  const noLeads = campaigns.filter(
    (campaign) => campaign.spend >= spendThreshold && campaign.crmLeads === 0 && campaign.platformLeads === 0,
  );
  if (noLeads.length) {
    insights.push({
      id: "campaigns-no-leads",
      severity: "critical",
      title: `${noLeads.length} campanha(s) sem nenhuma conversão`,
      detail: `${noLeads
        .slice(0, 3)
        .map((campaign) => `${campaign.campaign} (${money(campaign.spend)})`)
        .join(", ")}${noLeads.length > 3 ? "…" : ""}. Vale pausar ou revisar a oferta.`,
    });
  }

  // Pior campanha por CPL entre as que têm volume — onde cortar primeiro.
  const withCpl = campaigns.filter((campaign) => campaign.cpl !== null && campaign.spend >= spendThreshold);
  if (withCpl.length >= 2 && cpl !== null) {
    const worst = withCpl.reduce((a, b) => ((a.cpl as number) > (b.cpl as number) ? a : b));
    const best = withCpl.reduce((a, b) => ((a.cpl as number) < (b.cpl as number) ? a : b));
    if ((worst.cpl as number) > cpl * 1.4) {
      insights.push({
        id: "campaign-worst-cpl",
        severity: "warning",
        title: "Campanha puxando o CPL para cima",
        detail: `${worst.campaign} está com CPL de ${money(worst.cpl as number)}, ${Math.round(((worst.cpl as number) / cpl - 1) * 100)}% acima da média da conta.`,
      });
    }
    insights.push({
      id: "campaign-best-cpl",
      severity: "good",
      title: "Melhor campanha do período",
      detail: `${best.campaign} entrega leads a ${money(best.cpl as number)} — candidata natural a receber mais verba.`,
    });
  }

  const [meta, google] = channels;
  if (meta.cpl !== null && google.cpl !== null && meta.spend > 0 && google.spend > 0) {
    const cheaper = meta.cpl <= google.cpl ? meta : google;
    const pricier = cheaper === meta ? google : meta;
    const gap = ((pricier.cpl as number) / (cheaper.cpl as number) - 1) * 100;
    if (gap >= 20) {
      insights.push({
        id: "channel-gap",
        severity: "info",
        title: `${cheaper.label} está mais eficiente`,
        detail: `CPL de ${money(cheaper.cpl as number)} contra ${money(pricier.cpl as number)} no ${pricier.label} — ${Math.round(gap)}% de diferença.`,
      });
    }
  }

  if (!current.crmLeads && current.spend > 0) {
    insights.push({
      id: "no-crm-leads",
      severity: "warning",
      title: "Nenhum lead do CRM no período",
      detail:
        "Houve investimento mas o CRM não registrou oportunidades. Verifique o locationId do cliente e a integração dos formulários com o GoHighLevel.",
    });
  }

  return insights;
}

export interface AssembleInput {
  client: ClientConfig;
  range: DateRange;
  previousRange: DateRange;
  adRows: AdDailyRow[];
  previousAdRows: AdDailyRow[];
  opportunities: CrmOpportunity[];
  previousOpportunities: CrmOpportunity[];
  sources: { ads: string; crm: string };
  warnings: string[];
  demo: boolean;
}

export function assembleDashboard(input: AssembleInput): DashboardPayload {
  const current = computeTotals(input.adRows, input.opportunities);
  const previous = computeTotals(input.previousAdRows, input.previousOpportunities);
  const campaigns = buildCampaigns(input.adRows, input.opportunities);
  const channels = buildChannels(input.adRows, input.opportunities);

  return {
    meta: {
      clientId: input.client.id,
      clientName: input.client.name,
      currency: input.client.currency || "BRL",
      range: input.range,
      previousRange: input.previousRange,
      generatedAt: new Date().toISOString(),
      sources: input.sources,
      warnings: input.warnings,
      demo: input.demo,
    },
    kpis: buildKpis(current, previous, input.client),
    series: buildSeries(input.range, input.adRows, input.opportunities),
    channels,
    campaigns,
    funnel: buildFunnel(current),
    pipeline: buildPipeline(input.opportunities),
    sources: buildSources(input.opportunities),
    insights: buildInsights(current, previous, campaigns, channels, input.client),
  };
}
