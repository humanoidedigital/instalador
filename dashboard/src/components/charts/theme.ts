/** Props compartilhados pelos gráficos — eixos recessivos, marcas finas. */
export const AXIS_PROPS = {
  tick: { fill: "var(--text-muted)", fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
};

export const GRID_PROPS = {
  stroke: "var(--border)",
  strokeDasharray: "0",
  vertical: false as const,
};

export const CHART_HEIGHT = 260;

export const SERIES = {
  meta: "var(--series-1)",
  google: "var(--series-2)",
  leads: "var(--series-3)",
  sales: "var(--series-4)",
  cpl: "var(--series-5)",
};

/** Passos ordinais do azul — o mais claro ainda tem contraste sobre a superfície. */
export const ORDINAL_BLUE = ["var(--seq-550)", "var(--seq-450)", "var(--seq-350)", "var(--seq-250)"];
