import type { DateRange } from "./types";

export const DATE_PRESETS = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "last_7d", label: "Últimos 7 dias" },
  { id: "last_14d", label: "Últimos 14 dias" },
  { id: "last_30d", label: "Últimos 30 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "last_90d", label: "Últimos 90 dias" },
] as const;

export type DatePresetId = (typeof DATE_PRESETS)[number]["id"];

/** Fuso usado para "hoje" — o negócio é brasileiro, o servidor pode estar em UTC. */
const TIMEZONE = process.env.DASHBOARD_TIMEZONE || "America/Sao_Paulo";

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Data de "hoje" no fuso configurado, como YYYY-MM-DD. */
export function today(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export function eachDay(range: DateRange): string[] {
  const days: string[] = [];
  let cursor = range.from;
  // Guarda contra intervalos absurdos vindos da query string.
  for (let i = 0; i < 400 && cursor <= range.to; i += 1) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function resolvePreset(preset: string): DateRange {
  const now = today();
  const [year, month] = now.split("-").map(Number);

  switch (preset) {
    case "today":
      return { from: now, to: now };
    case "yesterday": {
      const day = addDays(now, -1);
      return { from: day, to: day };
    }
    case "last_7d":
      return { from: addDays(now, -6), to: now };
    case "last_14d":
      return { from: addDays(now, -13), to: now };
    case "last_90d":
      return { from: addDays(now, -89), to: now };
    case "this_month":
      return { from: `${now.slice(0, 7)}-01`, to: now };
    case "last_month": {
      const firstOfThisMonth = `${now.slice(0, 7)}-01`;
      const lastDayPrevMonth = addDays(firstOfThisMonth, -1);
      return { from: `${lastDayPrevMonth.slice(0, 7)}-01`, to: lastDayPrevMonth };
    }
    case "last_30d":
    default:
      return { from: addDays(now, -29), to: now };
  }
}

/** Período imediatamente anterior, do mesmo tamanho — base das variações. */
export function previousRange(range: DateRange): DateRange {
  const length = daysBetween(range.from, range.to);
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Lê o intervalo da query string: `from`/`to` explícitos vencem o `preset`. */
export function rangeFromSearchParams(params: URLSearchParams): { range: DateRange; preset: string } {
  const from = params.get("from");
  const to = params.get("to");
  if (isValidIsoDate(from) && isValidIsoDate(to) && from <= to) {
    return { range: { from, to }, preset: "custom" };
  }
  const preset = params.get("preset") || "last_30d";
  return { range: resolvePreset(preset), preset };
}
