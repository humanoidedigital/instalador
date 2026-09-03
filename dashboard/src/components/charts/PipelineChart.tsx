"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PipelineStage } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ChartCard, EmptyState } from "../ui";
import { ChartTooltip } from "./Tooltip";
import { AXIS_PROPS } from "./theme";

export function PipelineChart({ stages, currency }: { stages: PipelineStage[]; currency: string }) {
  const height = Math.max(200, stages.length * 42);

  return (
    <ChartCard
      title="Negociações por etapa"
      description="Negociações no CRM, na ordem das etapas do funil."
      table={{
        columns: ["Etapa", "Negociações", "Valor"],
        rows: stages.map((stage) => [stage.stage, formatNumber(stage.count), formatCurrency(stage.value, currency)]),
      }}
    >
      {stages.length === 0 ? (
        <EmptyState message="Sem negociações no CRM para este período." />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={stages} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }}>
            {/* Sem eixo X: cada barra já carrega o próprio número à direita. */}
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="stage" width={140} {...AXIS_PROPS} />
            <Tooltip
              cursor={{ fill: "color-mix(in srgb, var(--text-primary) 6%, transparent)" }}
              content={
                <ChartTooltip
                  formatter={(value, key) => (key === "value" ? formatCurrency(value, currency) : formatNumber(value))}
                />
              }
            />
            {/* Azul sequencial: a barra mede etapa do funil, não canal — laranja
                já significa Google Ads em todo o resto do relatório. */}
            <Bar dataKey="count" name="Negociações" fill="var(--seq-450)" radius={[0, 4, 4, 0]} barSize={18}>
              <LabelList
                dataKey="count"
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
