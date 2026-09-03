"use client";

import type { TooltipProps } from "recharts";

interface Entry {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Tooltip compartilhado: rótulo, valor formatado e o quadradinho da série. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
  total,
  totalLabel = "Total",
}: TooltipProps<number, string> & {
  formatter: (value: number, key: string) => string;
  labelFormatter?: (label: string) => string;
  total?: boolean;
  totalLabel?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const entries = payload as Entry[];
  const sum = entries.reduce((acc, entry) => acc + (typeof entry.value === "number" ? entry.value : 0), 0);

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow)",
        color: "var(--text-primary)",
      }}
    >
      <p className="mb-1 font-medium">{labelFormatter ? labelFormatter(String(label)) : String(label)}</p>
      <ul className="space-y-0.5">
        {entries.map((entry, index) => (
          <li key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
              <span aria-hidden className="inline-block h-2 w-2 rounded-[2px]" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="tnum font-medium">
              {typeof entry.value === "number" ? formatter(entry.value, String(entry.dataKey)) : "—"}
            </span>
          </li>
        ))}
        {total && entries.length > 1 ? (
          <li
            className="mt-1 flex items-center justify-between gap-4 pt-1"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <span style={{ color: "var(--text-secondary)" }}>{totalLabel}</span>
            <span className="tnum font-semibold">{formatter(sum, "total")}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
