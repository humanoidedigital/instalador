import fs from "node:fs";
import path from "node:path";

/**
 * Modelo de relatório.
 *
 * Um relatório é uma lista ordenada de blocos. Quem monta escolhe quais blocos
 * entram, em que ordem e com que título — a mesma dinâmica do Looker Studio,
 * sem o canvas livre em pixel, que custa caro e costuma produzir layout pior
 * que uma grade responsiva.
 *
 * Templates têm dois escopos: global (vale para qualquer cliente) e do cliente
 * (só para ele). Cada escopo pode ter um padrão, e o do cliente ganha do global.
 */

export const BLOCK_TYPES = [
  {
    type: "kpis",
    label: "Indicadores",
    description: "Cards de KPI com comparação de período. Você escolhe quais.",
    configurable: ["kpiIds", "columns", "size"],
  },
  {
    type: "insights",
    label: "Leitura do período",
    description: "Avisos gerados automaticamente a partir dos números.",
    configurable: [],
  },
  {
    type: "spend",
    label: "Investimento por dia",
    description: "Barras empilhadas por canal.",
    configurable: [],
  },
  {
    type: "leads",
    label: "Leads e vendas por dia",
    description: "Linhas com negociações criadas e ganhas.",
    configurable: [],
  },
  { type: "cpl", label: "CPL por dia", description: "Custo por lead diário, com a linha de meta.", configurable: [] },
  { type: "funnel", label: "Funil", description: "Do clique à venda, pela taxa de passagem.", configurable: [] },
  { type: "channels", label: "Canais", description: "Meta Ads e Google Ads lado a lado.", configurable: [] },
  { type: "pipeline", label: "Negociações por etapa", description: "Etapas do funil do CRM.", configurable: [] },
  { type: "sources", label: "Origem dos leads", description: "Leads agrupados por utm_source.", configurable: [] },
  {
    type: "creatives",
    label: "Criativos",
    description: "Miniatura, desempenho e link de cada anúncio.",
    configurable: [],
  },
  { type: "campaigns", label: "Campanhas", description: "Tabela ordenável por qualquer coluna.", configurable: [] },
  {
    type: "ai",
    label: "Análise por IA",
    description: "Leitura estratégica do período gerada pelo provedor configurado.",
    configurable: [],
  },
  {
    type: "text",
    label: "Texto livre",
    description: "Comentário da agência, contexto do mês, próximos passos.",
    configurable: ["text"],
  },
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number]["type"];

const VALID_TYPES = new Set<string>(BLOCK_TYPES.map((block) => block.type));

export interface ReportBlock {
  id: string;
  type: BlockType;
  /** Sobrescreve o título padrão do bloco. */
  title?: string;
  description?: string;
  hidden?: boolean;
  /** Bloco "kpis": quais indicadores e como distribuí-los. */
  kpiIds?: string[];
  columns?: 3 | 4;
  size?: "lg" | "sm";
  /** Bloco "text". */
  text?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  /** null = template global, disponível para todos os clientes. */
  clientId: string | null;
  isDefault: boolean;
  blocks: ReportBlock[];
  updatedAt: string;
}

/** Layout que o painel usa quando ainda não há nenhum template configurado. */
export const BUILTIN_TEMPLATE: ReportTemplate = {
  id: "padrao",
  name: "Relatório completo",
  description: "Layout de fábrica, com todos os blocos.",
  clientId: null,
  isDefault: true,
  updatedAt: "",
  blocks: [
    {
      id: "principais",
      type: "kpis",
      title: "Indicadores principais",
      description: "Comparação com o período anterior de mesmo tamanho.",
      kpiIds: ["spend", "crmLeads", "cpl", "opportunities", "won", "revenue", "roas", "cac"],
      columns: 4,
      size: "lg",
    },
    { id: "leitura", type: "insights", title: "Leitura do período" },
    { id: "investimento", type: "spend" },
    { id: "leads-dia", type: "leads" },
    { id: "cpl-dia", type: "cpl" },
    { id: "funil", type: "funnel" },
    { id: "canais", type: "channels", title: "Canais" },
    { id: "etapas", type: "pipeline" },
    { id: "origens", type: "sources" },
    { id: "personalizadas", type: "kpis", title: "Métricas personalizadas", kpiIds: ["__custom__"], columns: 3, size: "sm" },
    {
      id: "midia",
      type: "kpis",
      title: "Métricas de mídia",
      description: "Indicadores de eficiência das plataformas.",
      kpiIds: ["impressions", "clicks", "ctr", "cpc", "cpm", "platformLeads", "leadToSale", "ticket", "cpa"],
      columns: 3,
      size: "sm",
    },
    { id: "criativos", type: "creatives", title: "Criativos" },
    { id: "campanhas", type: "campaigns", title: "Campanhas" },
  ],
};

function reportsPath(): string {
  if (process.env.REPORTS_CONFIG_PATH) return process.env.REPORTS_CONFIG_PATH;
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const dir = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(dir, "reports.json");
}

let cache: { mtimeMs: number; templates: ReportTemplate[] } | null = null;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;

function normalizeBlock(raw: Partial<ReportBlock>, index: number): ReportBlock {
  const type = (VALID_TYPES.has(String(raw.type)) ? raw.type : "kpis") as BlockType;
  return {
    id: String(raw.id || `bloco-${index + 1}`),
    type,
    title: raw.title ? String(raw.title) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    hidden: raw.hidden === true,
    kpiIds: Array.isArray(raw.kpiIds) ? raw.kpiIds.map(String) : undefined,
    columns: raw.columns === 3 ? 3 : raw.columns === 4 ? 4 : undefined,
    size: raw.size === "sm" ? "sm" : raw.size === "lg" ? "lg" : undefined,
    text: raw.text ? String(raw.text) : undefined,
  };
}

function normalizeTemplate(raw: Partial<ReportTemplate>, index: number): ReportTemplate {
  return {
    id: String(raw.id || `relatorio-${index + 1}`),
    name: String(raw.name || raw.id || `Relatório ${index + 1}`),
    description: String(raw.description || ""),
    clientId: raw.clientId ? String(raw.clientId) : null,
    isDefault: raw.isDefault === true,
    blocks: (raw.blocks || []).map(normalizeBlock),
    updatedAt: String(raw.updatedAt || ""),
  };
}

export function loadTemplates(): ReportTemplate[] {
  try {
    const file = reportsPath();
    const stat = fs.statSync(file);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.templates;

    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { templates?: Partial<ReportTemplate>[] };
    const templates = (parsed.templates || []).map(normalizeTemplate);
    cache = { mtimeMs: stat.mtimeMs, templates };
    return templates;
  } catch {
    return [];
  }
}

/** Templates que o cliente pode usar: os dele mais os globais. */
export function templatesForClient(clientId: string): ReportTemplate[] {
  const all = loadTemplates();
  const list = all.filter((template) => template.clientId === clientId || template.clientId === null);
  return list.length ? list : [BUILTIN_TEMPLATE];
}

/**
 * Qual template usar. Precedência: o pedido explicitamente, depois o padrão do
 * cliente, depois o padrão global, e por fim o layout de fábrica.
 */
export function resolveTemplate(clientId: string, requestedId?: string | null): ReportTemplate {
  const available = templatesForClient(clientId);

  if (requestedId) {
    const requested = available.find((template) => template.id === requestedId);
    if (requested) return requested;
  }

  const clientDefault = available.find((template) => template.clientId === clientId && template.isDefault);
  if (clientDefault) return clientDefault;

  const globalDefault = available.find((template) => template.clientId === null && template.isDefault);
  if (globalDefault) return globalDefault;

  return available[0] || BUILTIN_TEMPLATE;
}

export function validateTemplates(templates: ReportTemplate[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  templates.forEach((template, index) => {
    const label = template.name?.trim() || template.id || `relatório ${index + 1}`;

    if (!ID_PATTERN.test(template.id || "")) {
      errors.push(`"${label}": o identificador deve ter de 2 a 49 caracteres, só minúsculas, números e hífen.`);
    } else if (seen.has(template.id)) {
      errors.push(`"${label}": o identificador "${template.id}" está repetido.`);
    } else {
      seen.add(template.id);
    }

    if (!template.name?.trim()) errors.push(`Relatório "${template.id}": o nome é obrigatório.`);
    if (!template.blocks?.length) errors.push(`"${label}": o relatório precisa de pelo menos um bloco.`);

    template.blocks?.forEach((block) => {
      if (!VALID_TYPES.has(String(block.type))) {
        errors.push(`"${label}": bloco de tipo desconhecido ("${block.type}").`);
      }
    });
  });

  // Um padrão por escopo: dois padrões no mesmo escopo deixariam a escolha ao acaso.
  const globalDefaults = templates.filter((template) => template.clientId === null && template.isDefault);
  if (globalDefaults.length > 1) {
    errors.push(`Há ${globalDefaults.length} templates globais marcados como padrão. Deixe apenas um.`);
  }

  const byClient = new Map<string, number>();
  templates
    .filter((template) => template.clientId && template.isDefault)
    .forEach((template) => byClient.set(template.clientId as string, (byClient.get(template.clientId as string) || 0) + 1));
  byClient.forEach((count, clientId) => {
    if (count > 1) errors.push(`O cliente "${clientId}" tem ${count} templates marcados como padrão. Deixe apenas um.`);
  });

  return errors;
}

export function writeTemplates(templates: ReportTemplate[]): void {
  const file = reportsPath();
  const payload = {
    _comment:
      "Templates de relatório. Editáveis em Administração > Relatórios. clientId nulo = template global; " +
      "isDefault marca o padrão do escopo (o do cliente ganha do global).",
    templates: templates.map((template, index) => ({
      ...normalizeTemplate(template, index),
      updatedAt: new Date().toISOString(),
    })),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(temporary, file);
  cache = null;
}

export function reportsConfigPath(): string {
  return reportsPath();
}
