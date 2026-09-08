"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardPayload } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Filters, type ClientOption, type FilterState } from "./Filters";
import { HALF_WIDTH, RenderBlock, blockTitle, type ReportBlockView } from "./report/blocks";
import { Badge, Section } from "./ui";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

type BlockGroup =
  | { kind: "full"; block: ReportBlockView }
  | { kind: "half"; blocks: ReportBlockView[]; title: string; description?: string };

/**
 * Blocos estreitos em sequência dividem a mesma linha em telas largas — é o que
 * mantém gráfico ao lado de gráfico, como no layout original, sem pedir para
 * quem monta o relatório declarar largura de cada bloco.
 */
function groupBlocks(blocks: ReportBlockView[]): BlockGroup[] {
  const groups: BlockGroup[] = [];

  blocks
    .filter((block) => !block.hidden)
    .forEach((block) => {
      if (!HALF_WIDTH.has(block.type)) {
        groups.push({ kind: "full", block });
        return;
      }

      const last = groups[groups.length - 1];
      if (last && last.kind === "half" && last.blocks.length < 2) {
        last.blocks.push(block);
        return;
      }

      groups.push({
        kind: "half",
        blocks: [block],
        // O título do grupo vem do primeiro bloco; os cards já trazem o seu.
        title: block.title || "",
        description: block.description,
      });
    });

  return groups;
}

function formatRange(range: { from: string; to: string }): string {
  const br = (iso: string) => iso.split("-").reverse().join("/");
  return `${br(range.from)} – ${br(range.to)}`;
}

function buildQuery(state: FilterState, refresh: boolean, templateId = ""): string {
  const params = new URLSearchParams({ client: state.clientId });
  if (templateId) params.set("template", templateId);
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
  [...data.kpis, ...data.customKpis].forEach((kpi) => {
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

export function Dashboard({ clients, role }: { clients: ClientOption[]; role: "master" | "viewer" }) {
  const [state, setState] = useState<FilterState>(() => initialState(clients));
  // Template escolhido na tela. Vazio = o padrão do cliente.
  const [templateId, setTemplateId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("template") || "";
  });
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (next: FilterState, refresh = false, templateOverride = "") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/overview?${buildQuery(next, refresh, templateOverride)}`, {
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
    load(state, false, templateId);
    // Mantém o filtro na URL para poder compartilhar o link do painel.
    const params = new URLSearchParams(buildQuery(state, false, templateId));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [state, templateId, load]);


  async function handleLogout(event: React.FormEvent) {
    event.preventDefault();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
              Dashboard de Marketing
            </h1>
            <nav className="no-print flex items-center gap-3 text-xs">
              {role === "master" ? (
                <a href="/admin" style={{ color: "var(--series-1)" }}>
                  Administração
                </a>
              ) : null}
              <form action="/api/auth/logout" method="post" onSubmit={handleLogout}>
                <button type="submit" style={{ color: "var(--text-secondary)" }}>
                  Sair
                </button>
              </form>
            </nav>
          </div>
          {data ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="accent">{data.meta.clientName}</Badge>
              <Badge>Mídia: {data.meta.sources.ads}</Badge>
              <Badge>CRM: {data.meta.sources.crm}</Badge>
              {data.meta.demo ? <Badge tone="warning">Dados de demonstração</Badge> : null}
              {data.meta.templates.length > 1 ? (
                <select
                  value={data.meta.template.id}
                  onChange={(event) => setTemplateId(event.target.value)}
                  aria-label="Modelo de relatório"
                  className="control no-print py-1 text-xs"
                >
                  {data.meta.templates.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {option.scope === "cliente" ? " (do cliente)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge>Modelo: {data.meta.template.name}</Badge>
              )}
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
          onRefresh={() => load(state, true, templateId)}
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
          {groupBlocks(data.meta.template.blocks as ReportBlockView[]).map((group, index) =>
            group.kind === "full" ? (
              <Section
                key={group.block.id}
                title={blockTitle(group.block)}
                description={group.block.description}
              >
                <RenderBlock
                  block={group.block}
                  data={data}
                  currency={currency}
                  clientId={state.clientId}
                  query={buildQuery(state, false, templateId)}
                />
              </Section>
            ) : (
              <Section
                key={`grupo-${index}`}
                title={group.title}
                description={group.description}
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  {group.blocks.map((block) => (
                    <RenderBlock
                      key={block.id}
                      block={block}
                      data={data}
                      currency={currency}
                      clientId={state.clientId}
                      query={buildQuery(state, false, templateId)}
                    />
                  ))}
                </div>
              </Section>
            ),
          )}

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
