"use client";

import type { ChannelSummary } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { SERIES } from "./charts/theme";

const COLOR: Record<string, string> = { meta: SERIES.meta, google: SERIES.google };

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="tnum text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
  );
}

/** Comparativo lado a lado dos canais, com a fatia do investimento total. */
export function ChannelBreakdown({ channels, currency }: { channels: ChannelSummary[]; currency: string }) {
  const totalSpend = channels.reduce((total, channel) => total + channel.spend, 0);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {channels.map((channel) => {
        const share = totalSpend > 0 ? channel.spend / totalSpend : 0;
        return (
          <div key={channel.channel} className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR[channel.channel] }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {channel.label}
                </h3>
              </div>
              <span className="tnum text-xs" style={{ color: "var(--text-secondary)" }}>
                {formatPercent(share, 0)} do investimento
              </span>
            </div>

            <div className="mb-3 h-1.5 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${share * 100}%`, background: COLOR[channel.channel] }}
              />
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <Metric label="Investimento" value={formatCurrency(channel.spend, currency)} />
              <Metric label="Leads (CRM)" value={formatNumber(channel.crmLeads)} />
              <Metric label="CPL" value={channel.cpl === null ? "—" : formatCurrency(channel.cpl, currency)} />
              <Metric label="Cliques" value={formatNumber(channel.clicks)} />
              <Metric label="CTR" value={channel.ctr === null ? "—" : formatPercent(channel.ctr)} />
              <Metric label="CPC" value={channel.cpc === null ? "—" : formatCurrency(channel.cpc, currency)} />
              <Metric label="Vendas" value={formatNumber(channel.won)} />
              <Metric label="Receita" value={formatCurrency(channel.revenue, currency)} />
              <Metric label="ROAS" value={channel.roas === null ? "—" : `${channel.roas.toFixed(2)}x`} />
            </dl>
          </div>
        );
      })}
    </div>
  );
}
