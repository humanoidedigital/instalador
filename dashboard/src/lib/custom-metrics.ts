import fs from "node:fs";
import path from "node:path";
import { compileFormula, validateFormula, type CompiledFormula } from "./metrics-formula";
import type { KpiFormat } from "./types";

/**
 * Métricas personalizadas: o operador escreve a fórmula no painel e ela vira
 * um card no relatório, com comparação de período e meta como qualquer outro.
 */

export interface CustomMetric {
  id: string;
  label: string;
  formula: string;
  format: KpiFormat;
  higherIsBetter: boolean;
  goal: number | null;
  hint: string;
  enabled: boolean;
  /** Vazio = vale para todos os clientes. */
  clients: string[];
}

function metricsPath(): string {
  if (process.env.METRICS_CONFIG_PATH) return process.env.METRICS_CONFIG_PATH;
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const dir = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(dir, "metrics.json");
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}$/;
const FORMATS: KpiFormat[] = ["currency", "number", "percent", "decimal", "days"];

let cache: { mtimeMs: number; metrics: CustomMetric[] } | null = null;

function normalize(raw: Partial<CustomMetric>, index: number): CustomMetric {
  return {
    id: String(raw.id || `metrica-${index + 1}`),
    label: String(raw.label || raw.id || `Métrica ${index + 1}`),
    formula: String(raw.formula || ""),
    format: FORMATS.includes(raw.format as KpiFormat) ? (raw.format as KpiFormat) : "decimal",
    higherIsBetter: raw.higherIsBetter !== false,
    goal: typeof raw.goal === "number" && Number.isFinite(raw.goal) ? raw.goal : null,
    hint: String(raw.hint || ""),
    enabled: raw.enabled !== false,
    clients: Array.isArray(raw.clients) ? raw.clients.map(String) : [],
  };
}

export function loadCustomMetrics(): CustomMetric[] {
  try {
    const file = metricsPath();
    const stat = fs.statSync(file);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.metrics;

    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { metrics?: Partial<CustomMetric>[] };
    const metrics = (parsed.metrics || []).map(normalize);
    cache = { mtimeMs: stat.mtimeMs, metrics };
    return metrics;
  } catch {
    // Arquivo ausente é o caso normal em instalação nova.
    return [];
  }
}

/** Métricas que valem para o cliente selecionado, já compiladas. */
export function metricsForClient(clientId: string): { metric: CustomMetric; compiled: CompiledFormula }[] {
  return loadCustomMetrics()
    .filter((metric) => metric.enabled)
    .filter((metric) => !metric.clients.length || metric.clients.includes(clientId))
    .map((metric) => {
      try {
        return { metric, compiled: compileFormula(metric.formula) };
      } catch {
        // Fórmula quebrada não pode derrubar o relatório inteiro.
        return null;
      }
    })
    .filter((entry): entry is { metric: CustomMetric; compiled: CompiledFormula } => entry !== null);
}

export function validateCustomMetrics(metrics: CustomMetric[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  metrics.forEach((metric, index) => {
    const label = metric.label?.trim() || metric.id || `métrica ${index + 1}`;

    if (!ID_PATTERN.test(metric.id || "")) {
      errors.push(`"${label}": o identificador deve ter de 2 a 39 caracteres, só minúsculas, números e hífen.`);
    } else if (seen.has(metric.id)) {
      errors.push(`"${label}": o identificador "${metric.id}" está repetido.`);
    } else {
      seen.add(metric.id);
    }

    if (!metric.label?.trim()) errors.push(`Métrica "${metric.id}": o nome é obrigatório.`);

    const formulaError = validateFormula(metric.formula || "");
    if (formulaError) errors.push(`"${label}": ${formulaError}`);
  });

  return errors;
}

export function writeCustomMetrics(metrics: CustomMetric[]): void {
  const file = metricsPath();
  const payload = {
    _comment:
      "Métricas personalizadas do relatório. Editáveis em Administração > Métricas. " +
      "A fórmula aceita os campos do catálogo e as operações + - * / ( ) além de min, max, abs e round.",
    metrics: metrics.map((metric, index) => normalize(metric, index)),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(temporary, file);
  cache = null;
}

export function customMetricsPath(): string {
  return metricsPath();
}
