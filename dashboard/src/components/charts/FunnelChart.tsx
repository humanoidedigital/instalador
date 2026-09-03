"use client";

import type { FunnelStage } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { ChartCard } from "../ui";
import { ORDINAL_BLUE } from "./theme";

/**
 * Funil como barras horizontais proporcionais ao primeiro estágio, com a taxa
 * de passagem escrita ao lado — a razão entre cliques e vendas é grande demais
 * para ser lida só pelo comprimento.
 */
export function FunnelChartCard({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value || 0;

  return (
    <ChartCard
      title="Funil do período"
      description="Do clique no anúncio até a venda registrada no CRM."
      table={{
        columns: ["Etapa", "Volume", "Conversão da etapa anterior"],
        rows: stages.map((stage) => [
          stage.stage,
          formatNumber(stage.value),
          stage.stepRate === null ? "—" : formatPercent(stage.stepRate),
        ]),
      }}
    >
      <ul className="space-y-3 py-1">
        {stages.map((stage, index) => {
          const width = top > 0 ? Math.max((stage.value / top) * 100, stage.value > 0 ? 3 : 0.6) : 0.6;
          return (
            <li key={stage.stage}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                <span style={{ color: "var(--text-secondary)" }}>{stage.stage}</span>
                <span className="tnum font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatNumber(stage.value)}
                  {stage.stepRate !== null ? (
                    <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
                      {formatPercent(stage.stepRate)} da etapa anterior
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-3 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${width}%`,
                    background: ORDINAL_BLUE[Math.min(index, ORDINAL_BLUE.length - 1)],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
