"use client";

import type { Insight } from "@/lib/types";

const TONE: Record<Insight["severity"], { color: string; icon: string; label: string }> = {
  good: { color: "var(--good)", icon: "✓", label: "Positivo" },
  warning: { color: "var(--warning)", icon: "!", label: "Atenção" },
  critical: { color: "var(--critical)", icon: "✕", label: "Crítico" },
  info: { color: "var(--series-1)", icon: "i", label: "Informação" },
};

/** Leitura automática dos números — o que olhar primeiro no período. */
export function Insights({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;

  return (
    // auto-fit em vez de contagem fixa: 3, 4 ou 5 avisos preenchem a linha
    // sem deixar um card sozinho embaixo.
    <ul
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
    >
      {insights.map((insight) => {
        const tone = TONE[insight.severity];
        return (
          <li key={insight.id} className="card flex gap-3 p-3">
            <span
              aria-hidden
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              style={{ background: `color-mix(in srgb, ${tone.color} 16%, transparent)`, color: tone.color }}
            >
              {tone.icon}
            </span>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                <span className="sr-only">{tone.label}: </span>
                {insight.title}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                {insight.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
