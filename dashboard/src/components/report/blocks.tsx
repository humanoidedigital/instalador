"use client";

import type { DashboardPayload, Kpi } from "@/lib/types";
import { KpiGrid } from "../KpiGrid";
import { Insights } from "../Insights";
import { ChannelBreakdown } from "../ChannelBreakdown";
import { CampaignTable } from "../CampaignTable";
import { CreativesGallery } from "../CreativesGallery";
import { AiAnalysis } from "../AiAnalysis";
import { SpendByChannelChart } from "../charts/SpendByChannelChart";
import { LeadsSalesChart } from "../charts/LeadsSalesChart";
import { CplChart } from "../charts/CplChart";
import { FunnelChartCard } from "../charts/FunnelChart";
import { PipelineChart } from "../charts/PipelineChart";
import { SourcesChart } from "../charts/SourcesChart";

/** Espelha ReportBlock do servidor, sem arrastar node:fs para o browser. */
export interface ReportBlockView {
  id: string;
  type: string;
  title?: string;
  description?: string;
  hidden?: boolean;
  kpiIds?: string[];
  columns?: 3 | 4;
  size?: "lg" | "sm";
  text?: string;
}

/** Marcador que significa "todas as métricas personalizadas ativas". */
export const CUSTOM_KPIS_TOKEN = "__custom__";

const DEFAULT_TITLES: Record<string, string> = {
  kpis: "Indicadores",
  insights: "Leitura do período",
  spend: "Evolução diária",
  leads: "Leads e vendas",
  cpl: "Custo por lead",
  funnel: "Funil",
  channels: "Canais",
  pipeline: "CRM",
  sources: "Origem dos leads",
  creatives: "Criativos",
  campaigns: "Campanhas",
  ai: "Análise por IA",
  text: "",
};

export function blockTitle(block: ReportBlockView): string {
  return block.title ?? DEFAULT_TITLES[block.type] ?? "";
}

/** Blocos que ocupam meia largura em telas grandes, para emparelharem. */
export const HALF_WIDTH = new Set(["spend", "leads", "cpl", "funnel", "pipeline", "sources"]);

function selectKpis(payload: DashboardPayload, ids: string[] | undefined): Kpi[] {
  if (!ids || !ids.length) return payload.kpis;

  const selected: Kpi[] = [];
  ids.forEach((id) => {
    if (id === CUSTOM_KPIS_TOKEN) {
      selected.push(...payload.customKpis);
      return;
    }
    const found = payload.kpis.find((kpi) => kpi.id === id) || payload.customKpis.find((kpi) => kpi.id === id);
    // Um id que não existe mais (métrica apagada) some do relatório em vez de
    // quebrar a página.
    if (found) selected.push(found);
  });
  return selected;
}

export function RenderBlock({
  block,
  data,
  currency,
  clientId,
  query,
  isMaster,
}: {
  block: ReportBlockView;
  data: DashboardPayload;
  currency: string;
  clientId: string;
  query: string;
  isMaster: boolean;
}) {
  switch (block.type) {
    case "kpis": {
      const kpis = selectKpis(data, block.kpiIds);
      if (!kpis.length) return null;
      return <KpiGrid kpis={kpis} currency={currency} size={block.size || "lg"} columns={block.columns || 4} />;
    }
    case "insights":
      return data.insights.length ? <Insights insights={data.insights} /> : null;
    case "spend":
      return <SpendByChannelChart series={data.series} currency={currency} />;
    case "leads":
      return <LeadsSalesChart series={data.series} />;
    case "cpl":
      return (
        <CplChart
          series={data.series}
          currency={currency}
          goal={data.kpis.find((kpi) => kpi.id === "cpl")?.goal ?? null}
        />
      );
    case "funnel":
      return <FunnelChartCard stages={data.funnel} />;
    case "channels":
      return <ChannelBreakdown channels={data.channels} currency={currency} />;
    case "pipeline":
      return <PipelineChart stages={data.pipeline} currency={currency} />;
    case "sources":
      return <SourcesChart sources={data.sources} currency={currency} />;
    case "creatives":
      return <CreativesGallery clientId={clientId} query={query} currency={currency} />;
    case "campaigns":
      return <CampaignTable campaigns={data.campaigns} currency={currency} />;
    case "ai":
      return <AiAnalysis data={data} isMaster={isMaster} />;
    case "text":
      return (
        <div className="card p-4">
          <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--text-secondary)" }}>
            {block.text || ""}
          </p>
        </div>
      );
    default:
      return null;
  }
}
