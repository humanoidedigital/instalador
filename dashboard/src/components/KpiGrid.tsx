"use client";

import type { Kpi } from "@/lib/types";
import { formatDelta, formatKpi } from "@/lib/format";

function deltaTone(kpi: Kpi): { color: string; arrow: string } {
  if (kpi.delta === null) return { color: "var(--text-muted)", arrow: "" };
  const arrow = kpi.delta > 0 ? "▲" : kpi.delta < 0 ? "▼" : "■";
  if (kpi.neutral || kpi.delta === 0) return { color: "var(--text-muted)", arrow };
  const positive = kpi.higherIsBetter ? kpi.delta > 0 : kpi.delta < 0;
  return { color: positive ? "var(--good)" : "var(--critical)", arrow };
}

function goalProgress(kpi: Kpi): { pct: number; label: string } | null {
  if (!kpi.goal || !Number.isFinite(kpi.goal)) return null;
  // Em métricas onde menor é melhor (CPL, CAC), o progresso é meta/valor.
  const ratio = kpi.higherIsBetter ? kpi.value / kpi.goal : kpi.goal / (kpi.value || Infinity);
  const pct = Math.max(0, Math.min(ratio, 1.5));
  return { pct, label: `${Math.round(ratio * 100)}% da meta` };
}

export function KpiCard({ kpi, currency, size = "lg" }: { kpi: Kpi; currency: string; size?: "lg" | "sm" }) {
  const tone = deltaTone(kpi);
  const goal = goalProgress(kpi);

  return (
    // flex-col + mt-auto na meta: cards da mesma linha crescem juntos e a barra
    // fica ancorada no rodapé, em vez de deixar um vazio no meio do card.
    <div className="card flex h-full flex-col p-4" title={kpi.hint}>
      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {kpi.label}
      </p>
      <p
        className={`tnum mt-1 font-semibold ${size === "lg" ? "text-2xl" : "text-lg"}`}
        style={{ color: "var(--text-primary)" }}
      >
        {formatKpi(kpi.value, kpi.format, currency)}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        <span className="tnum font-medium" style={{ color: tone.color }}>
          {tone.arrow} {formatDelta(kpi.delta)}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {kpi.previous === null ? "sem base anterior" : `vs ${formatKpi(kpi.previous, kpi.format, currency)}`}
        </span>
      </div>
      {goal ? (
        <div className="mt-auto pt-3">
          <div className="h-1.5 w-full rounded-full" style={{ background: "var(--surface-2)" }}>
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${Math.min(goal.pct, 1) * 100}%`,
                background: kpi.neutral ? "var(--series-1)" : goal.pct >= 1 ? "var(--good)" : "var(--series-1)",
              }}
            />
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {goal.label} ({formatKpi(kpi.goal as number, kpi.format, currency)})
          </p>
        </div>
      ) : size === "lg" ? (
        // Só no bloco principal: lá convivem cards com e sem meta, e a linha
        // mantém todos com a mesma âncora. No bloco secundário nenhum tem meta,
        // então repetir o aviso nove vezes seria só ruído.
        <p className="mt-auto pt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Meta não definida
        </p>
      ) : null}
    </div>
  );
}

export function KpiGrid({
  kpis,
  currency,
  size = "lg",
  columns = 4,
}: {
  kpis: Kpi[];
  currency: string;
  size?: "lg" | "sm";
  /** Colunas no breakpoint largo. 3 evita a última linha com um card órfão. */
  columns?: 3 | 4;
}) {
  return (
    <div
      className={`grid gap-4 ${
        size === "lg"
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          : `grid-cols-2 md:grid-cols-3 ${columns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`
      }`}
    >
      {kpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} currency={currency} size={size} />
      ))}
    </div>
  );
}
