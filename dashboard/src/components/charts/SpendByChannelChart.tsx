"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeseriesPoint } from "@/lib/types";
import { formatCurrency, formatDayLabel } from "@/lib/format";
import { ChartCard } from "../ui";
import { ChartTooltip } from "./Tooltip";
import { AXIS_PROPS, CHART_HEIGHT, GRID_PROPS, SERIES } from "./theme";

export function SpendByChannelChart({ series, currency }: { series: TimeseriesPoint[]; currency: string }) {
  const money = (value: number) => formatCurrency(value, currency);

  return (
    <ChartCard
      title="Investimento por dia"
      description="Empilhado por canal — a altura da barra é o gasto total do dia."
      legend={[
        { label: "Meta Ads", color: SERIES.meta },
        { label: "Google Ads", color: SERIES.google },
      ]}
      table={{
        columns: ["Dia", "Meta Ads", "Google Ads", "Total"],
        rows: series.map((point) => [
          formatDayLabel(point.date),
          money(point.spendMeta),
          money(point.spendGoogle),
          money(point.spend),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tickFormatter={formatDayLabel} minTickGap={24} {...AXIS_PROPS} />
          <YAxis tickFormatter={(value: number) => formatCurrency(value, currency, true)} width={64} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--text-primary) 6%, transparent)" }}
            content={<ChartTooltip formatter={money} labelFormatter={formatDayLabel} total />}
          />
          {/* stroke na cor da superfície = o vão de 2px entre os segmentos empilhados */}
          <Bar dataKey="spendMeta" name="Meta Ads" stackId="spend" fill={SERIES.meta} stroke="var(--surface-1)" strokeWidth={2} />
          <Bar
            dataKey="spendGoogle"
            name="Google Ads"
            stackId="spend"
            fill={SERIES.google}
            stroke="var(--surface-1)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
