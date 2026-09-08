import fs from "node:fs";
import path from "node:path";
import type { OrganicSource } from "./types";

/**
 * Mapa de campos das fontes de orgânico.
 *
 * Por que isto é configurável e o de mídia paga não: as contas de Meta Ads e
 * Google Ads estão conectadas, então os IDs de campo daqueles conectores foram
 * conferidos um a um contra o `get_fields` da Windsor. As fontes de orgânico
 * ainda não têm conta conectada — e a Windsor recusa listar campos de conector
 * sem conta. Chutar nome de campo dentro do código seria vender como validado
 * o que não é.
 *
 * Então o mapa vem em arquivo: quando a conta for conectada, `/api/organic-check`
 * mostra o que o conector devolve de verdade e o ajuste é editar um JSON, sem
 * mexer no código nem rebuildar.
 */

/** Nomes canônicos que o restante do sistema conhece. */
export const ORGANIC_FIELDS = [
  "date",
  "accountId",
  "accountName",
  "dimension",
  "sessions",
  "users",
  "newUsers",
  "engagedSessions",
  "pageViews",
  "conversions",
  "impressions",
  "clicks",
  "position",
  "reach",
  "engagement",
  "followers",
  "posts",
] as const;

export type OrganicField = (typeof ORGANIC_FIELDS)[number];

export interface OrganicSourceConfig {
  enabled: boolean;
  /** Slug do conector na Windsor. */
  connector: string;
  /** Campo canônico -> ID do campo no conector. Vazio = não pede aquele campo. */
  fields: Partial<Record<OrganicField, string>>;
  /** Dimensão alternativa, quando a conta expõe outro agrupador. */
  dimensionLabel: string;
}

export interface OrganicConfig {
  sources: Record<OrganicSource, OrganicSourceConfig>;
}

export const ORGANIC_SOURCES: {
  id: OrganicSource;
  label: string;
  connector: string;
  /** O que este bloco responde no relatório. */
  purpose: string;
  /** Onde a conta é conectada, para o texto de ajuda. */
  onboard: string;
}[] = [
  {
    id: "ga4",
    label: "Google Analytics 4",
    connector: "googleanalytics4",
    purpose: "Sessões, usuários e conversões do site, separados por canal.",
    onboard: "https://onboard.windsor.ai?datasource=googleanalytics4",
  },
  {
    id: "search",
    label: "Google Search Console",
    connector: "searchconsole",
    purpose: "Cliques, impressões, CTR e posição média na busca orgânica.",
    onboard: "https://onboard.windsor.ai?datasource=searchconsole",
  },
  {
    id: "instagram",
    label: "Instagram",
    connector: "instagram",
    purpose: "Seguidores, alcance e engajamento do perfil.",
    onboard: "https://onboard.windsor.ai?datasource=instagram",
  },
  {
    id: "facebook",
    label: "Facebook (orgânico)",
    connector: "facebook_organic",
    purpose: "Alcance, impressões e engajamento da página.",
    onboard: "https://onboard.windsor.ai?datasource=facebook_organic",
  },
  {
    id: "gmb",
    label: "Google Meu Negócio",
    connector: "google_my_business",
    purpose: "Visualizações do perfil e ações de quem encontrou o negócio.",
    onboard: "https://onboard.windsor.ai?datasource=google_my_business",
  },
];

export const ORGANIC_SOURCE_IDS = ORGANIC_SOURCES.map((source) => source.id);

export function organicSourceLabel(source: OrganicSource): string {
  return ORGANIC_SOURCES.find((item) => item.id === source)?.label || source;
}

/**
 * Palpites de nome de campo, seguindo a convenção que a Windsor usa nos
 * conectores já conferidos (snake_case, `date`, `account_id`, `account_name`).
 * São ponto de partida, não verdade: confira em `/api/organic-check` assim que
 * a conta estiver conectada.
 */
const DEFAULTS: OrganicConfig = {
  sources: {
    ga4: {
      enabled: false,
      connector: "googleanalytics4",
      dimensionLabel: "Canal",
      fields: {
        date: "date",
        accountId: "account_id",
        accountName: "account_name",
        dimension: "default_channel_group",
        sessions: "sessions",
        users: "users",
        newUsers: "new_users",
        engagedSessions: "engaged_sessions",
        pageViews: "screen_page_views",
        conversions: "conversions",
      },
    },
    search: {
      enabled: false,
      connector: "searchconsole",
      dimensionLabel: "Consulta",
      fields: {
        date: "date",
        accountId: "account_id",
        accountName: "account_name",
        dimension: "query",
        impressions: "impressions",
        clicks: "clicks",
        position: "position",
      },
    },
    instagram: {
      enabled: false,
      connector: "instagram",
      dimensionLabel: "Tipo de conteúdo",
      fields: {
        date: "date",
        accountId: "account_id",
        accountName: "account_name",
        impressions: "impressions",
        reach: "reach",
        engagement: "engagement",
        followers: "followers_count",
      },
    },
    facebook: {
      enabled: false,
      connector: "facebook_organic",
      dimensionLabel: "Tipo de conteúdo",
      fields: {
        date: "date",
        accountId: "account_id",
        accountName: "account_name",
        impressions: "page_impressions",
        reach: "page_impressions_unique",
        engagement: "page_engaged_users",
        followers: "page_fans",
      },
    },
    gmb: {
      enabled: false,
      connector: "google_my_business",
      dimensionLabel: "Ação",
      fields: {
        date: "date",
        accountId: "account_id",
        accountName: "account_name",
        impressions: "views",
        clicks: "actions",
      },
    },
  },
};

function configPath(): string {
  if (process.env.ORGANIC_CONFIG_PATH) return process.env.ORGANIC_CONFIG_PATH;
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const dir = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(dir, "organic.json");
}

let cache: { mtimeMs: number; config: OrganicConfig } | null = null;

function normalizeSource(source: OrganicSource, raw: Partial<OrganicSourceConfig> | undefined): OrganicSourceConfig {
  const fallback = DEFAULTS.sources[source];
  const fields: Partial<Record<OrganicField, string>> = {};

  ORGANIC_FIELDS.forEach((field) => {
    const value = raw?.fields?.[field];
    // String vazia é uma escolha: significa "esta conta não expõe este campo".
    // Por isso só cai no padrão quando a chave não existe.
    const resolved = value === undefined ? fallback.fields[field] : String(value).trim();
    if (resolved) fields[field] = resolved;
  });

  return {
    enabled: raw?.enabled === true,
    connector: String(raw?.connector || fallback.connector).trim() || fallback.connector,
    dimensionLabel: String(raw?.dimensionLabel ?? fallback.dimensionLabel),
    fields,
  };
}

export function loadOrganicConfig(): OrganicConfig {
  let raw: Partial<OrganicConfig> = {};

  try {
    const file = configPath();
    const stat = fs.statSync(file);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.config;

    raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<OrganicConfig>;
    const config: OrganicConfig = {
      sources: Object.fromEntries(
        ORGANIC_SOURCE_IDS.map((id) => [id, normalizeSource(id, raw.sources?.[id])]),
      ) as Record<OrganicSource, OrganicSourceConfig>,
    };
    cache = { mtimeMs: stat.mtimeMs, config };
    return config;
  } catch {
    // Sem arquivo, tudo desligado com os palpites carregados — a tela explica
    // o que falta em vez de quebrar.
    return {
      sources: Object.fromEntries(
        ORGANIC_SOURCE_IDS.map((id) => [id, normalizeSource(id, undefined)]),
      ) as Record<OrganicSource, OrganicSourceConfig>,
    };
  }
}

export function writeOrganicConfig(config: OrganicConfig): void {
  const file = configPath();
  const payload = {
    _comment:
      "Mapa de campos das fontes de tráfego orgânico. Editável em Administração > Orgânico. " +
      "Os IDs de campo precisam bater com o conector da Windsor; use /api/organic-check para ver o que vem de verdade.",
    sources: Object.fromEntries(
      ORGANIC_SOURCE_IDS.map((id) => [id, normalizeSource(id, config.sources?.[id])]),
    ),
  };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(temporary, file);
  cache = null;
}

export function organicConfigPath(): string {
  return configPath();
}
