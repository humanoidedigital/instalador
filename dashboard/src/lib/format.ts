const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let formatter = currencyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: compact ? 0 : 2,
    });
    currencyFormatters.set(key, formatter);
  }
  return formatter;
}

export function formatCurrency(value: number, currency = "BRL", compact = false): string {
  if (!Number.isFinite(value)) return "—";
  return currencyFormatter(currency, compact).format(value);
}

export function formatNumber(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** `value` é uma fração: 0.1234 vira "12,3%". */
export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value, 1)}`;
}

export function formatDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: process.env.NEXT_PUBLIC_DASHBOARD_TIMEZONE || "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function formatKpi(value: number, format: string, currency = "BRL"): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, currency);
    case "percent":
      return formatPercent(value);
    case "decimal":
      return formatDecimal(value);
    case "days":
      return `${formatDecimal(value, 1)} d`;
    default:
      return formatNumber(value);
  }
}

/** Divisão que devolve null em vez de Infinity/NaN — usada em todas as métricas derivadas. */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator) || !Number.isFinite(numerator)) return null;
  return numerator / denominator;
}
