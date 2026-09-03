"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeseriesPoint } from "@/lib/types";
import { formatCurrency, formatDayLabel } from "@/lib/format";
import { ChartCard } from "../ui";
import { ChartTooltip } from "./Tooltip";
import { AXIS_PROPS, CHART_HEIGHT, GRID_PROPS, SERIES } from "./theme";

export function CplChart({
  series,
  currency,
  goal,
}: {
  series: TimeseriesPoint[];
  currency: string;
  goal?: number | null;
}) {
  const money = (value: number) => formatCurrency(value, currency);

  return (
    <ChartCard
      title="CPL por dia"
      description={goal ? `Custo por lead diário. A linha tracejada é a meta de ${money(goal)}.` : "Custo por lead diário."}
      table={{
        columns: ["Dia", "Investimento", "Leads", "CPL"],
        rows: series.map((point) => [
          formatDayLabel(point.date),
          money(point.spend),
          point.crmLeads,
          point.cpl === null ? "—" : money(point.cpl),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="cpl-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.cpl} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES.cpl} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tickFormatter={formatDayLabel} minTickGap={24} {...AXIS_PROPS} />
          <YAxis tickFormatter={(value: number) => formatCurrency(value, currency, true)} width={64} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={<ChartTooltip formatter={money} labelFormatter={formatDayLabel} />}
          />
          {goal ? (
            <ReferenceLine
              y={goal}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{ value: `Meta ${money(goal)}`, position: "insideTopRight", fill: "var(--text-muted)", fontSize: 11 }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="cpl"
            name="CPL"
            connectNulls
            stroke={SERIES.cpl}
            strokeWidth={2}
            fill="url(#cpl-fill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
