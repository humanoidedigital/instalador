"use client";

import type { FunnelStage } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { ChartCard } from "../ui";
import { ORDINAL_BLUE } from "./theme";

/**
 * Funil em barras horizontais.
 *
 * A barra mede a TAXA DE PASSAGEM da etapa anterior, não o volume absoluto:
 * entre cliques e vendas há três ordens de grandeza, e uma escala linear no
 * volume deixaria as três últimas barras invisíveis — que era exatamente o
 * problema. O volume aparece como número, e a conversão acumulada desde a
 * primeira etapa vai na legenda de cada linha, para não perder a noção de
 * afunilamento total.
 */
export function FunnelChartCard({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value || 0;

  return (
    <ChartCard
      title="Funil do período"
      description="Cada barra mostra a taxa de passagem da etapa anterior."
      table={{
        columns: ["Etapa", "Volume", "Da etapa anterior", "Do total de cliques"],
        rows: stages.map((stage) => [
          stage.stage,
          formatNumber(stage.value),
          stage.stepRate === null ? "—" : formatPercent(stage.stepRate),
          top > 0 ? formatPercent(stage.value / top) : "—",
        ]),
      }}
    >
      <ul className="flex h-full flex-col justify-center gap-4 py-1">
        {stages.map((stage, index) => {
          // Primeira etapa é a base: 100%. As demais, a fração que passou.
          const rate = index === 0 ? 1 : stage.stepRate ?? 0;
          const width = Math.max(Math.min(rate, 1) * 100, stage.value > 0 ? 2 : 0.5);
          const cumulative = top > 0 ? stage.value / top : null;

          return (
            <li key={stage.stage}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                  {stage.stage}
                </span>
                <span className="tnum text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatNumber(stage.value)}
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-2.5 rounded-full"
                  style={{
                    width: `${width}%`,
                    background: ORDINAL_BLUE[Math.min(index, ORDINAL_BLUE.length - 1)],
                  }}
                />
              </div>

              <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {index === 0
                  ? "base do funil"
                  : `${formatPercent(rate)} da etapa anterior`}
                {index > 0 && cumulative !== null ? ` · ${formatPercent(cumulative, 2)} dos cliques` : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
