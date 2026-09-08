import fs from "node:fs";
import path from "node:path";
import { compileFormula, validateFormula, FORMULA_VARIABLES } from "./metrics-formula";
import type { ClientGoals } from "./clients";
import type { CampaignRow, DashboardPayload } from "./types";

/**
 * Regras de alerta.
 *
 * Reaproveitam o avaliador de fórmulas das métricas personalizadas: mesmo
 * catálogo de campos, mesmo parser já testado, e nada de `eval`. A regra é
 * "esta fórmula passou deste limiar", que cobre desde "CPL acima da meta" até
 * "campanha gastando sem entregar".
 */

export type AlertSeverity = "critico" | "atencao" | "informativo";
export type AlertScope = "cliente" | "campanha";
export type AlertOperator = ">" | ">=" | "<" | "<=";

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  /** Vazio = vale para todos os clientes. */
  clients: string[];
  scope: AlertScope;
  formula: string;
  operator: AlertOperator;
  threshold: number;
  severity: AlertSeverity;
  /** Janela avaliada, em dias. */
  windowDays: number;
  /** No escopo de campanha, ignora as que gastaram menos que isto no período. */
  minSpend: number;
  /** Aceita {valor}, {limiar}, {cliente} e {campanha}. */
  message: string;
}

export interface AlertHit {
  ruleId: string;
  ruleName: string;
  clientId: string;
  clientName: string;
  /** Identifica o alvo dentro do cliente: "" para o cliente todo, ou a campanha. */
  scopeKey: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  value: number;
  threshold: number;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;
const OPERATORS: AlertOperator[] = [">", ">=", "<", "<="];
const SEVERITIES: AlertSeverity[] = ["critico", "atencao", "informativo"];

/** Campos disponíveis por escopo — campanha não tem receita nem etapa de CRM. */
export const CAMPAIGN_VARIABLES = [
  "investimento",
  "impressoes",
  "cliques",
  "leads",
  "leads_plataforma",
  "dias",
];

export function variablesForScope(scope: AlertScope): { id: string; label: string; description: string }[] {
  return scope === "campanha"
    ? FORMULA_VARIABLES.filter((variable) => CAMPAIGN_VARIABLES.includes(variable.id))
    : FORMULA_VARIABLES;
}

function alertsPath(): string {
  if (process.env.ALERTS_CONFIG_PATH) return process.env.ALERTS_CONFIG_PATH;
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const dir = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(dir, "alerts.json");
}

let cache: { mtimeMs: number; rules: AlertRule[] } | null = null;

function normalize(raw: Partial<AlertRule>, index: number): AlertRule {
  return {
    id: String(raw.id || `alerta-${index + 1}`),
    name: String(raw.name || raw.id || `Alerta ${index + 1}`),
    enabled: raw.enabled !== false,
    clients: Array.isArray(raw.clients) ? raw.clients.map(String) : [],
    scope: raw.scope === "campanha" ? "campanha" : "cliente",
    formula: String(raw.formula || ""),
    operator: OPERATORS.includes(raw.operator as AlertOperator) ? (raw.operator as AlertOperator) : ">",
    threshold: Number.isFinite(Number(raw.threshold)) ? Number(raw.threshold) : 0,
    severity: SEVERITIES.includes(raw.severity as AlertSeverity) ? (raw.severity as AlertSeverity) : "atencao",
    windowDays: Number.isFinite(Number(raw.windowDays)) && Number(raw.windowDays) > 0 ? Number(raw.windowDays) : 7,
    minSpend: Number.isFinite(Number(raw.minSpend)) ? Number(raw.minSpend) : 0,
    message: String(raw.message || ""),
  };
}

export function loadAlertRules(): AlertRule[] {
  try {
    const file = alertsPath();
    const stat = fs.statSync(file);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.rules;

    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { rules?: Partial<AlertRule>[] };
    const rules = (parsed.rules || []).map(normalize);
    cache = { mtimeMs: stat.mtimeMs, rules };
    return rules;
  } catch {
    return [];
  }
}

export function validateAlertRules(rules: AlertRule[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  rules.forEach((rule, index) => {
    const label = rule.name?.trim() || rule.id || `alerta ${index + 1}`;

    if (!ID_PATTERN.test(rule.id || "")) {
      errors.push(`"${label}": identificador inválido (2 a 49 caracteres, minúsculas, números e hífen).`);
    } else if (seen.has(rule.id)) {
      errors.push(`"${label}": o identificador "${rule.id}" está repetido.`);
    } else {
      seen.add(rule.id);
    }

    if (!rule.name?.trim()) errors.push(`Alerta "${rule.id}": o nome é obrigatório.`);

    const formulaError = validateFormula(rule.formula || "");
    if (formulaError) {
      errors.push(`"${label}": ${formulaError}`);
    } else if (rule.scope === "campanha") {
      // Campo que não existe no escopo de campanha passaria como zero e o
      // alerta dispararia sem sentido — melhor recusar na hora de salvar.
      const usados = compileFormula(rule.formula).variables;
      const invalidos = usados.filter((variable) => !CAMPAIGN_VARIABLES.includes(variable));
      if (invalidos.length) {
        errors.push(
          `"${label}": ${invalidos.join(", ")} não existe${invalidos.length > 1 ? "m" : ""} no escopo de campanha. Disponíveis: ${CAMPAIGN_VARIABLES.join(", ")}.`,
        );
      }
    }
  });

  return errors;
}

export function writeAlertRules(rules: AlertRule[]): void {
  const file = alertsPath();
  const payload = {
    _comment:
      "Regras de alerta. Editáveis em Administração > Alertas. A fórmula usa o mesmo catálogo de campos das " +
      "métricas personalizadas; scope 'campanha' avalia cada campanha separadamente.",
    rules: rules.map((rule, index) => normalize(rule, index)),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(temporary, file);
  cache = null;
}

export function alertsConfigPath(): string {
  return alertsPath();
}

function compare(value: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    default:
      return value <= threshold;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

function campaignValues(campaign: CampaignRow, days: number): Record<string, number> {
  return {
    investimento: campaign.spend,
    impressoes: campaign.impressions,
    cliques: campaign.clicks,
    leads: campaign.crmLeads || campaign.platformLeads,
    leads_plataforma: campaign.platformLeads,
    dias: days,
  };
}

function clientValues(data: DashboardPayload, days: number, goals: ClientGoals): Record<string, number> {
  const get = (id: string) => data.kpis.find((kpi) => kpi.id === id)?.value ?? 0;
  return {
    meta_cpl: goals.cpl ?? 0,
    meta_roas: goals.roas ?? 0,
    meta_investimento: goals.monthlyBudget ?? 0,
    meta_leads: goals.monthlyLeads ?? 0,
    investimento: get("spend"),
    impressoes: get("impressions"),
    cliques: get("clicks"),
    leads: get("crmLeads"),
    leads_plataforma: get("platformLeads"),
    oportunidades: get("opportunities"),
    vendas: get("won"),
    perdidas: 0,
    receita: get("revenue"),
    valor_plataforma: 0,
    dias: days,
  };
}

/** Regras ativas que valem para este cliente. */
export function rulesForClient(clientId: string): AlertRule[] {
  return loadAlertRules()
    .filter((rule) => rule.enabled)
    .filter((rule) => !rule.clients.length || rule.clients.includes(clientId));
}

/**
 * Avalia as regras contra um relatório já montado. Devolve só o que disparou.
 *
 * Quem chama passa a janela usada para montar `data`: as regras precisam ser
 * do mesmo tamanho de janela, senão o número comparado não é o que a regra
 * pediu. O runner agrupa por janela antes de chamar aqui.
 */
export function evaluateAlerts(
  data: DashboardPayload,
  days: number,
  goals: ClientGoals = {},
  rules?: AlertRule[],
): AlertHit[] {
  const hits: AlertHit[] = [];
  const clientId = data.meta.clientId;

  (rules ?? rulesForClient(clientId)).forEach((rule) => {
    let compiled;
    try {
      compiled = compileFormula(rule.formula);
    } catch {
      // Regra com fórmula quebrada é ignorada, não derruba a avaliação inteira.
      return;
    }

    const alvos: { key: string; label: string; values: Record<string, number> }[] =
      rule.scope === "campanha"
        ? data.campaigns
            .filter((campaign) => campaign.spend >= rule.minSpend)
            .map((campaign) => ({
              key: campaign.key,
              label: campaign.campaign,
              values: campaignValues(campaign, days),
            }))
        : [{ key: "", label: data.meta.clientName, values: clientValues(data, days, goals) }];

    alvos.forEach((alvo) => {
      const value = compiled.evaluate(alvo.values);
      // Sem valor (divisão por zero) não é o mesmo que "abaixo do limiar":
      // um CPL sem leads não deve disparar um alerta de "CPL baixo".
      if (value === null) return;
      if (!compare(value, rule.operator, rule.threshold)) return;

      const contexto = {
        valor: formatNumber(value),
        limiar: formatNumber(rule.threshold),
        cliente: data.meta.clientName,
        campanha: rule.scope === "campanha" ? alvo.label : "",
      };

      const detalhePadrao =
        rule.scope === "campanha"
          ? `${alvo.label}: ${rule.formula} = ${contexto.valor} (limiar ${rule.operator} ${contexto.limiar}).`
          : `${rule.formula} = ${contexto.valor} (limiar ${rule.operator} ${contexto.limiar}).`;

      hits.push({
        ruleId: rule.id,
        ruleName: rule.name,
        clientId,
        clientName: data.meta.clientName,
        scopeKey: alvo.key,
        severity: rule.severity,
        title: rule.scope === "campanha" ? `${rule.name} — ${alvo.label}` : rule.name,
        detail: rule.message ? render(rule.message, contexto) : detalhePadrao,
        value,
        threshold: rule.threshold,
      });
    });
  });

  return hits;
}
