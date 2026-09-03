"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeseriesPoint } from "@/lib/types";
import { formatDayLabel, formatNumber } from "@/lib/format";
import { ChartCard } from "../ui";
import { ChartTooltip } from "./Tooltip";
import { AXIS_PROPS, CHART_HEIGHT, GRID_PROPS, SERIES } from "./theme";

export function LeadsSalesChart({ series }: { series: TimeseriesPoint[] }) {
  return (
    <ChartCard
      title="Leads e vendas por dia"
      description="Contagem de negociações criadas e ganhas no CRM."
      legend={[
        { label: "Leads no CRM", color: SERIES.leads },
        { label: "Vendas ganhas", color: SERIES.sales },
      ]}
      table={{
        columns: ["Dia", "Leads", "Vendas"],
        rows: series.map((point) => [formatDayLabel(point.date), formatNumber(point.crmLeads), formatNumber(point.won)]),
      }}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tickFormatter={formatDayLabel} minTickGap={24} {...AXIS_PROPS} />
          <YAxis allowDecimals={false} width={40} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={<ChartTooltip formatter={(value) => formatNumber(value)} labelFormatter={formatDayLabel} />}
          />
          <Line
            type="monotone"
            dataKey="crmLeads"
            name="Leads no CRM"
            stroke={SERIES.leads}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
          />
          <Line
            type="monotone"
            dataKey="won"
            name="Vendas ganhas"
            stroke={SERIES.sales}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
