"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardPayload } from "@/lib/types";
import { PRIMARY_KPI_IDS } from "@/lib/metrics";
import { formatDateTime } from "@/lib/format";
import { Filters, type ClientOption, type FilterState } from "./Filters";
import { KpiGrid } from "./KpiGrid";
import { Insights } from "./Insights";
import { ChannelBreakdown } from "./ChannelBreakdown";
import { CampaignTable } from "./CampaignTable";
import { Badge, Section } from "./ui";
import { SpendByChannelChart } from "./charts/SpendByChannelChart";
import { LeadsSalesChart } from "./charts/LeadsSalesChart";
import { CplChart } from "./charts/CplChart";
import { FunnelChartCard } from "./charts/FunnelChart";
import { PipelineChart } from "./charts/PipelineChart";
import { SourcesChart } from "./charts/SourcesChart";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatRange(range: { from: string; to: string }): string {
  const br = (iso: string) => iso.split("-").reverse().join("/");
  return `${br(range.from)} – ${br(range.to)}`;
}

function buildQuery(state: FilterState, refresh: boolean): string {
  const params = new URLSearchParams({ client: state.clientId });
  if (state.preset === "custom") {
    params.set("from", state.from);
    params.set("to", state.to);
  } else {
    params.set("preset", state.preset);
  }
  if (refresh) params.set("refresh", "1");
  return params.toString();
}

function toCsv(data: DashboardPayload): string {
  const escape = (value: string | number | null) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines: string[] = [];
  lines.push(`Cliente;${data.meta.clientName}`);
  lines.push(`Período;${data.meta.range.from} a ${data.meta.range.to}`);
  lines.push("");
  lines.push("Indicador;Valor;Período anterior;Variação");
  data.kpis.forEach((kpi) => {
    lines.push(
      [kpi.label, kpi.value, kpi.previous ?? "", kpi.delta === null ? "" : `${(kpi.delta * 100).toFixed(1)}%`]
        .map(escape)
        .join(";"),
    );
  });
  lines.push("");
  lines.push("Campanha;Canal;Tipo;Conta;Investimento;Impressões;Cliques;CTR;Leads CRM;Conversões plataforma;CPL;Vendas;Receita;ROAS");
  data.campaigns.forEach((campaign) => {
    lines.push(
      [
        campaign.campaign,
        campaign.channel === "meta" ? "Meta Ads" : "Google Ads",
        campaign.campaignType,
        campaign.accountName,
        campaign.spend,
        campaign.impressions,
        campaign.clicks,
        campaign.ctr === null ? "" : (campaign.ctr * 100).toFixed(2),
        campaign.crmLeads,
        campaign.platformLeads,
        campaign.cpl === null ? "" : campaign.cpl.toFixed(2),
        campaign.won,
        campaign.revenue,
        campaign.roas === null ? "" : campaign.roas.toFixed(2),
      ]
        .map(escape)
        .join(";"),
    );
  });
  lines.push("");
  lines.push("Dia;Investimento Meta;Investimento Google;Cliques;Leads CRM;Vendas;Receita;CPL");
  data.series.forEach((point) => {
    lines.push(
      [
        point.date,
        point.spendMeta,
        point.spendGoogle,
        point.clicks,
        point.crmLeads,
        point.won,
        point.revenue,
        point.cpl ?? "",
      ]
        .map(escape)
        .join(";"),
    );
  });

  return lines.join("\n");
}

/** Estado inicial vindo da URL, para que um link compartilhado abra no mesmo recorte. */
function initialState(clients: ClientOption[]): FilterState {
  const fallback: FilterState = {
    clientId: clients[0]?.id || "__all__",
    preset: "last_30d",
    from: daysAgo(29),
    to: isoToday(),
  };
  if (typeof window === "undefined") return fallback;

  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client");
  const from = params.get("from");
  const to = params.get("to");
  const preset = params.get("preset");

  return {
    clientId: clientId && clients.some((client) => client.id === clientId) ? clientId : fallback.clientId,
    preset: from && to ? "custom" : preset || fallback.preset,
    from: from || fallback.from,
    to: to || fallback.to,
  };
}

export function Dashboard({ clients }: { clients: ClientOption[] }) {
  const [state, setState] = useState<FilterState>(() => initialState(clients));
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (next: FilterState, refresh = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/overview?${buildQuery(next, refresh)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Falha ao carregar os dados (HTTP ${response.status}).`);
        }
        setData((await response.json()) as DashboardPayload);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(state);
    // Mantém o filtro na URL para poder compartilhar o link do painel.
    const params = new URLSearchParams(buildQuery(state, false));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [state, load]);

  const primaryKpis = useMemo(
    () => (data ? data.kpis.filter((kpi) => PRIMARY_KPI_IDS.includes(kpi.id)) : []),
    [data],
  );
  const secondaryKpis = useMemo(
    () => (data ? data.kpis.filter((kpi) => !PRIMARY_KPI_IDS.includes(kpi.id)) : []),
    [data],
  );
  const cplGoal = useMemo(() => data?.kpis.find((kpi) => kpi.id === "cpl")?.goal ?? null, [data]);

  function handleExport() {
    if (!data) return;
    const blob = new Blob([`﻿${toCsv(data)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dashboard-${data.meta.clientId}-${data.meta.range.from}_a_${data.meta.range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const currency = data?.meta.currency || "BRL";

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Dashboard de Marketing
          </h1>
          {data ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{data.meta.clientName}</Badge>
              <Badge>Mídia: {data.meta.sources.ads}</Badge>
              <Badge>CRM: {data.meta.sources.crm}</Badge>
              {data.meta.demo ? <Badge tone="warning">Dados de demonstração</Badge> : null}
            </div>
          ) : null}
        </div>

        {data ? (
          <dl className="text-right text-xs" style={{ color: "var(--text-muted)" }}>
            <div className="flex justify-end gap-2">
              <dt>Período</dt>
              <dd className="tnum font-medium" style={{ color: "var(--text-secondary)" }}>
                {formatRange(data.meta.range)}
              </dd>
            </div>
            <div className="mt-0.5 flex justify-end gap-2">
              <dt>Comparado com</dt>
              <dd className="tnum">{formatRange(data.meta.previousRange)}</dd>
            </div>
            <div className="mt-0.5 flex justify-end gap-2">
              <dt>Atualizado às</dt>
              <dd className="tnum">{formatDateTime(data.meta.generatedAt)}</dd>
            </div>
          </dl>
        ) : null}
      </header>

      {/* Barra de filtros fixa no topo: o relatório é longo e o leitor precisa
          saber de qual cliente e de qual período são os números que está vendo.
          No celular ela não gruda — empilhada, comeria 18% da tela o tempo todo. */}
      <div
        className="filters-bar z-20 -mx-4 mb-6 px-4 py-2.5 md:sticky md:top-0 md:-mx-6 md:px-6"
        style={{ background: "var(--surface-0)", borderBottom: "1px solid var(--border)" }}
      >
        <Filters
          clients={clients}
          state={state}
          onChange={setState}
          onRefresh={() => load(state, true)}
          onExport={handleExport}
          loading={loading}
        />
      </div>

      {error ? (
        <div
          className="card mb-5 p-4 text-sm"
          role="alert"
          style={{ borderColor: "var(--critical)", color: "var(--text-primary)" }}
        >
          <strong>Não foi possível carregar o painel.</strong> {error}
        </div>
      ) : null}

      {data && data.meta.warnings.length ? (
        <div className="card mb-5 p-4" role="status">
          <p className="mb-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Avisos de integração
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {data.meta.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!data && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card h-[112px] animate-pulse" />
          ))}
        </div>
      ) : null}

      {data ? (
        <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity 150ms" }}>
          <Section title="Indicadores principais" description="Comparação com o período anterior de mesmo tamanho.">
            <KpiGrid kpis={primaryKpis} currency={currency} />
          </Section>

          {data.insights.length ? (
            <Section title="Leitura do período" description="Gerado automaticamente a partir dos números acima.">
              <Insights insights={data.insights} />
            </Section>
          ) : null}

          <Section title="Evolução diária">
            <div className="grid gap-4 xl:grid-cols-2">
              <SpendByChannelChart series={data.series} currency={currency} />
              <LeadsSalesChart series={data.series} />
              <CplChart series={data.series} currency={currency} goal={cplGoal} />
              <FunnelChartCard stages={data.funnel} />
            </div>
          </Section>

          <Section title="Canais" description="Meta Ads e Google Ads lado a lado.">
            <ChannelBreakdown channels={data.channels} currency={currency} />
          </Section>

          <Section title="CRM" description="Funil e origem das negociações no RD Station CRM.">
            <div className="grid gap-4 xl:grid-cols-2">
              <PipelineChart stages={data.pipeline} currency={currency} />
              <SourcesChart sources={data.sources} currency={currency} />
            </div>
          </Section>

          <Section title="Métricas de mídia" description="Indicadores de eficiência das plataformas.">
            <KpiGrid kpis={secondaryKpis} currency={currency} size="sm" columns={3} />
          </Section>

          <Section
            title="Campanhas"
            description="Ordene por qualquer coluna para achar onde cortar ou escalar. Leads e ROAS marcados com “(plataforma)” não tiveram correspondência no CRM e vêm do que o Meta/Google reportaram."
          >
            <CampaignTable campaigns={data.campaigns} currency={currency} />
          </Section>

          <footer className="mt-8 text-[11px]" style={{ color: "var(--text-muted)" }}>
            Leads e vendas vêm do CRM; investimento, impressões e cliques vêm das plataformas de anúncio. As conversões
            reportadas pelo Meta e pelo Google podem divergir do CRM por causa das janelas de atribuição de cada
            plataforma.
          </footer>
        </div>
      ) : null}
    </main>
  );
}
