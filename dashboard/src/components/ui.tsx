"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export interface LegendItem {
  label: string;
  color: string;
}

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Moldura padrão dos gráficos: título, legenda e um botão "Ver dados" que troca
 * o gráfico por uma tabela — a saída acessível exigida para leitores de tela,
 * daltonismo e impressão.
 */
export function ChartCard({
  title,
  description,
  legend,
  table,
  children,
}: {
  title: string;
  description?: string;
  legend?: LegendItem[];
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-expanded={showTable}
          aria-controls={id}
          className="no-print rounded-md px-2 py-1 text-xs"
          style={{ border: "1px solid var(--border-strong)", color: "var(--text-secondary)" }}
        >
          {showTable ? "Ver gráfico" : "Ver dados"}
        </button>
      </div>

      {legend && legend.length > 1 ? (
        <div className="mb-2">
          <Legend items={legend} />
        </div>
      ) : null}

      <div id={id}>
        {showTable ? (
          <DataTable columns={table.columns} rows={table.rows} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <div className="scroll-x max-h-[320px] overflow-y-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky-head">
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`py-2 pr-3 font-medium ${index === 0 ? "" : "text-right"}`}
                style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="data-row">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`py-1.5 pr-3 tnum ${cellIndex === 0 ? "" : "text-right"}`}
                  style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border)" }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          Sem dados no período.
        </p>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical" | "accent";
}) {
  const colors: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--surface-2)", fg: "var(--text-secondary)" },
    good: { bg: "color-mix(in srgb, var(--good) 14%, transparent)", fg: "var(--good)" },
    warning: { bg: "color-mix(in srgb, var(--warning) 18%, transparent)", fg: "var(--text-primary)" },
    critical: { bg: "color-mix(in srgb, var(--critical) 16%, transparent)", fg: "var(--critical)" },
    accent: { bg: "color-mix(in srgb, var(--series-1) 14%, transparent)", fg: "var(--series-1)" },
  };
  const color = colors[tone];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: color.bg, color: color.fg }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex h-[240px] items-center justify-center rounded-lg text-sm"
      style={{ color: "var(--text-muted)", border: "1px dashed var(--border-strong)" }}
    >
      {message}
    </div>
  );
}
