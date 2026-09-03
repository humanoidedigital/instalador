"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SourceRow } from "@/lib/types";
import { CHANNEL_LABELS } from "@/lib/channel";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { ChartCard, EmptyState } from "../ui";
import { ChartTooltip } from "./Tooltip";
import { AXIS_PROPS, SERIES } from "./theme";

const CHANNEL_COLOR: Record<string, string> = {
  meta: SERIES.meta,
  google: SERIES.google,
  organic: SERIES.leads,
  other: SERIES.sales,
};

export function SourcesChart({ sources, currency }: { sources: SourceRow[]; currency: string }) {
  const top = sources.slice(0, 8);
  const height = Math.max(200, top.length * 40);

  return (
    <ChartCard
      title="Origem dos leads"
      description="Leads do CRM agrupados por utm_source ou pela fonte da negociação."
      legend={Object.entries(CHANNEL_LABELS)
        // Só os canais presentes: legenda de item inexistente é ruído.
        .filter(([channel]) => top.some((source) => source.channel === channel))
        .map(([channel, label]) => ({ label, color: CHANNEL_COLOR[channel] }))}
      table={{
        columns: ["Origem", "Canal", "Leads", "Vendas", "Conversão", "Receita"],
        rows: sources.map((source) => [
          source.source,
          CHANNEL_LABELS[source.channel],
          formatNumber(source.leads),
          formatNumber(source.won),
          source.conversionRate === null ? "—" : formatPercent(source.conversionRate),
          formatCurrency(source.revenue, currency),
        ]),
      }}
    >
      {top.length === 0 ? (
        <EmptyState message="Sem leads no CRM para este período." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={top} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
            {/* Sem eixo X: cada barra já carrega o próprio número à direita. */}
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="source" width={120} {...AXIS_PROPS} />
            <Tooltip
              cursor={{ fill: "color-mix(in srgb, var(--text-primary) 6%, transparent)" }}
              content={<ChartTooltip formatter={(value) => formatNumber(value)} />}
            />
            <Bar dataKey="leads" name="Leads" radius={[0, 4, 4, 0]} barSize={18}>
              {top.map((source) => (
                <Cell key={source.source} fill={CHANNEL_COLOR[source.channel] || SERIES.cpl} />
              ))}
              <LabelList
                dataKey="leads"
                position="right"
                style={{ fill: "var(--text-secondary)", fontSize: 11 }}
                formatter={(value: number) => formatNumber(value)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
