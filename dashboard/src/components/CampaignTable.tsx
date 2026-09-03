"use client";

import { useMemo, useState } from "react";
import type { CampaignRow } from "@/lib/types";
import { CHANNEL_LABELS } from "@/lib/channel";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { SERIES } from "./charts/theme";

type SortKey = "spend" | "crmLeads" | "cpl" | "clicks" | "ctr" | "roas" | "campaign";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "campaign", label: "Campanha", numeric: false },
  { key: "spend", label: "Investimento", numeric: true },
  { key: "clicks", label: "Cliques", numeric: true },
  { key: "ctr", label: "CTR", numeric: true },
  { key: "crmLeads", label: "Leads", numeric: true },
  { key: "cpl", label: "CPL", numeric: true },
  { key: "roas", label: "ROAS", numeric: true },
];

function value(row: CampaignRow, key: SortKey): number | string {
  const raw = row[key];
  if (raw === null || raw === undefined) return key === "campaign" ? "" : Number.NEGATIVE_INFINITY;
  return raw as number | string;
}

export function CampaignTable({ campaigns, currency }: { campaigns: CampaignRow[]; currency: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [ascending, setAscending] = useState(false);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<"all" | "meta" | "google">("all");

  const rows = useMemo(() => {
    const filtered = campaigns
      .filter((row) => (channel === "all" ? true : row.channel === channel))
      .filter((row) => row.campaign.toLowerCase().includes(query.trim().toLowerCase()));

    return filtered.sort((a, b) => {
      const left = value(a, sortKey);
      const right = value(b, sortKey);
      if (typeof left === "string" || typeof right === "string") {
        return ascending
          ? String(left).localeCompare(String(right), "pt-BR")
          : String(right).localeCompare(String(left), "pt-BR");
      }
      return ascending ? left - right : right - left;
    });
  }, [campaigns, sortKey, ascending, query, channel]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setAscending((current) => !current);
      return;
    }
    setSortKey(key);
    setAscending(key === "campaign");
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar por nome da campanha"
          aria-label="Filtrar campanhas"
          className="control min-w-[220px] flex-1"
        />
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
          aria-label="Filtrar por canal"
          className="control"
        >
          <option value="all">Todos os canais</option>
          <option value="meta">Meta Ads</option>
          <option value="google">Google Ads</option>
        </select>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {rows.length} campanha(s)
        </span>
      </div>

      <div className="scroll-x">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`py-2 pr-3 font-medium ${column.numeric ? "text-right" : ""}`}
                  style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
                  aria-sort={sortKey === column.key ? (ascending ? "ascending" : "descending") : "none"}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="inline-flex items-center gap-1"
                    style={{ color: sortKey === column.key ? "var(--text-primary)" : "inherit" }}
                  >
                    {column.label}
                    {sortKey === column.key ? <span aria-hidden>{ascending ? "▲" : "▼"}</span> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ background: row.channel === "meta" ? SERIES.meta : SERIES.google }}
                    />
                    <span>
                      <span className="block font-medium" style={{ color: "var(--text-primary)" }}>
                        {row.campaign}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {CHANNEL_LABELS[row.channel]} · {row.campaignType} · {row.accountName}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="tnum py-2 pr-3 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                  {formatCurrency(row.spend, currency)}
                </td>
                <td className="tnum py-2 pr-3 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                  {formatNumber(row.clicks)}
                </td>
                <td className="tnum py-2 pr-3 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                  {row.ctr === null ? "—" : formatPercent(row.ctr)}
                </td>
                <td className="tnum py-2 pr-3 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                  {formatNumber(row.crmLeads || row.platformLeads)}
                  {row.crmLeads === 0 && row.platformLeads > 0 ? (
                    <span className="ml-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      (plataforma)
                    </span>
                  ) : null}
                </td>
                <td className="tnum py-2 pr-3 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                  {row.cpl === null ? "—" : formatCurrency(row.cpl, currency)}
                </td>
                <td
                  className="tnum py-2 pr-3 text-right"
                  style={{ borderBottom: "1px solid var(--border)" }}
                  title={
                    row.crmLeads === 0
                      ? "Calculado com o valor de conversão da plataforma — nenhum lead do CRM casou com esta campanha."
                      : "Calculado com a receita das oportunidades ganhas no CRM."
                  }
                >
                  {row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}
                  {row.roas !== null && row.crmLeads === 0 ? (
                    <span className="ml-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      (plataforma)
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Nenhuma campanha com investimento no período.
          </p>
        ) : null}
      </div>
    </div>
  );
}
