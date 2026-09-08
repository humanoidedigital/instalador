import type {
  DateRange,
  Kpi,
  OrganicChannelRow,
  OrganicDailyRow,
  OrganicPayload,
  OrganicPoint,
  OrganicQueryRow,
  OrganicSocialRow,
  OrganicSource,
  OrganicSourceStatus,
} from "./types";
import { eachDay } from "./dates";
import { safeDivide } from "./format";
import { organicSourceLabel } from "./organic-config";
import type { ClientConfig } from "./clients";

/**
 * Transforma as linhas diárias de orgânico no payload que a tela consome.
 *
 * Duas regras que valem para tudo aqui:
 * - Fonte sem dado não vira zero na tela; vira ausência. Um relatório que
 *   mostra "0 seguidores" para quem não conectou o Instagram mente.
 * - Seguidores e posição média não se somam. Seguidores é estoque (vale o
 *   último dia) e posição é média ponderada por impressões.
 */

const SOCIAL_SOURCES: OrganicSource[] = ["instagram", "facebook"];

interface Totals {
  sessions: number;
  users: number;
  newUsers: number;
  engagedSessions: number;
  pageViews: number;
  conversions: number;
  searchClicks: number;
  searchImpressions: number;
  searchPositionWeighted: number;
  reach: number;
  socialImpressions: number;
  engagement: number;
  posts: number;
  followers: number;
  gmbViews: number;
  gmbActions: number;
}

const ZERO: Totals = {
  sessions: 0,
  users: 0,
  newUsers: 0,
  engagedSessions: 0,
  pageViews: 0,
  conversions: 0,
  searchClicks: 0,
  searchImpressions: 0,
  searchPositionWeighted: 0,
  reach: 0,
  socialImpressions: 0,
  engagement: 0,
  posts: 0,
  followers: 0,
  gmbViews: 0,
  gmbActions: 0,
};

/** Seguidores do último dia em que a fonte reportou algum número. */
function latestFollowers(rows: OrganicDailyRow[]): number {
  const byDay = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.followers) return;
    byDay.set(row.date, Math.max(byDay.get(row.date) || 0, row.followers));
  });

  const days = Array.from(byDay.keys()).sort();
  return days.length ? byDay.get(days[days.length - 1]) || 0 : 0;
}

export function computeOrganicTotals(rows: OrganicDailyRow[]): Totals {
  const totals = { ...ZERO };

  rows.forEach((row) => {
    if (row.source === "ga4") {
      totals.sessions += row.sessions;
      totals.users += row.users;
      totals.newUsers += row.newUsers;
      totals.engagedSessions += row.engagedSessions;
      totals.pageViews += row.pageViews;
      totals.conversions += row.conversions;
      return;
    }

    if (row.source === "search") {
      // Consulta e página vêm na mesma fonte; somar as duas contaria cada
      // clique duas vezes. As páginas ficam de fora do total.
      if (isPage(row.dimension)) return;
      totals.searchClicks += row.clicks;
      totals.searchImpressions += row.impressions;
      totals.searchPositionWeighted += row.positionWeighted;
      return;
    }

    if (row.source === "gmb") {
      totals.gmbViews += row.impressions;
      totals.gmbActions += row.clicks;
      return;
    }

    totals.reach += row.reach;
    totals.socialImpressions += row.impressions;
    totals.engagement += row.engagement;
    totals.posts += row.posts;
  });

  totals.followers = latestFollowers(rows.filter((row) => SOCIAL_SOURCES.includes(row.source)));
  return totals;
}

function isPage(dimension: string): boolean {
  return dimension.startsWith("/") || dimension.startsWith("http");
}

function delta(current: number, previous: number | null): number | null {
  if (previous === null || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function kpi(
  id: string,
  label: string,
  value: number | null,
  previous: number | null,
  format: Kpi["format"],
  higherIsBetter: boolean,
  extra: Partial<Kpi> = {},
): Kpi {
  const current = value ?? 0;
  return {
    id,
    label,
    value: current,
    previous,
    delta: delta(current, previous),
    format,
    higherIsBetter,
    ...extra,
  };
}

/** Quais fontes trouxeram dado — define quais cards fazem sentido mostrar. */
function present(rows: OrganicDailyRow[]): Set<OrganicSource> {
  const sources = new Set<OrganicSource>();
  rows.forEach((row) => sources.add(row.source));
  return sources;
}

export function buildOrganicKpis(
  rows: OrganicDailyRow[],
  previousRows: OrganicDailyRow[],
): Kpi[] {
  const current = computeOrganicTotals(rows);
  const previous = computeOrganicTotals(previousRows);
  const sources = present(rows);
  const kpis: Kpi[] = [];

  if (sources.has("ga4")) {
    kpis.push(
      kpi("sessions", "Sessões", current.sessions, previous.sessions, "number", true, {
        hint: "Visitas ao site no período, de todas as origens que o GA4 registra.",
      }),
      kpi("users", "Usuários", current.users, previous.users, "number", true, {
        hint: "Pessoas distintas. Uma pessoa que voltou três vezes conta uma vez aqui e três em sessões.",
      }),
      kpi(
        "engagementRate",
        "Taxa de engajamento",
        safeDivide(current.engagedSessions, current.sessions),
        safeDivide(previous.engagedSessions, previous.sessions),
        "percent",
        true,
        { hint: "Sessões que passaram de 10 segundos, viram duas páginas ou converteram." },
      ),
      kpi(
        "organicConversions",
        "Conversões",
        current.conversions,
        previous.conversions,
        "number",
        true,
        { hint: "Eventos marcados como conversão no GA4 — não é o mesmo que lead no CRM." },
      ),
    );
  }

  if (sources.has("search")) {
    kpis.push(
      kpi("searchClicks", "Cliques na busca", current.searchClicks, previous.searchClicks, "number", true, {
        hint: "Cliques vindos da busca do Google, pelo Search Console.",
      }),
      kpi(
        "searchImpressions",
        "Impressões na busca",
        current.searchImpressions,
        previous.searchImpressions,
        "number",
        true,
        { neutral: true, hint: "Quantas vezes o site apareceu nos resultados." },
      ),
      kpi(
        "searchCtr",
        "CTR da busca",
        safeDivide(current.searchClicks, current.searchImpressions),
        safeDivide(previous.searchClicks, previous.searchImpressions),
        "percent",
        true,
      ),
      kpi(
        "searchPosition",
        "Posição média",
        safeDivide(current.searchPositionWeighted, current.searchImpressions),
        safeDivide(previous.searchPositionWeighted, previous.searchImpressions),
        "decimal",
        // Posição 3 é melhor que posição 9: aqui descer é bom.
        false,
        { hint: "Média ponderada por impressões. Quanto menor, mais alto o site aparece." },
      ),
    );
  }

  if (SOCIAL_SOURCES.some((source) => sources.has(source))) {
    const previousFollowers = previous.followers || null;
    kpis.push(
      kpi("followers", "Seguidores", current.followers, previousFollowers, "number", true, {
        hint: "Valor do último dia do período, não a soma dos dias.",
      }),
      kpi("reach", "Alcance", current.reach, previous.reach, "number", true, {
        hint: "Contas distintas alcançadas pelas publicações.",
      }),
      kpi(
        "engagementSocial",
        "Engajamento",
        current.engagement,
        previous.engagement,
        "number",
        true,
        { hint: "Curtidas, comentários, salvamentos e compartilhamentos." },
      ),
      kpi(
        "socialEngagementRate",
        "Taxa de engajamento social",
        safeDivide(current.engagement, current.reach),
        safeDivide(previous.engagement, previous.reach),
        "percent",
        true,
      ),
    );
  }

  if (sources.has("gmb")) {
    kpis.push(
      kpi("gmbViews", "Visualizações no Google Meu Negócio", current.gmbViews, previous.gmbViews, "number", true),
      kpi("gmbActions", "Ações no perfil", current.gmbActions, previous.gmbActions, "number", true, {
        hint: "Ligações, pedidos de rota e cliques para o site.",
      }),
    );
  }

  return kpis;
}

export function buildOrganicSeries(rows: OrganicDailyRow[], range: DateRange): OrganicPoint[] {
  const byDate = new Map<string, OrganicPoint>();

  eachDay(range).forEach((date) => {
    byDate.set(date, {
      date,
      sessions: 0,
      users: 0,
      pageViews: 0,
      conversions: 0,
      searchClicks: 0,
      searchImpressions: 0,
      reach: 0,
      engagement: 0,
    });
  });

  rows.forEach((row) => {
    const point = byDate.get(row.date);
    if (!point) return;

    if (row.source === "ga4") {
      point.sessions += row.sessions;
      point.users += row.users;
      point.pageViews += row.pageViews;
      point.conversions += row.conversions;
      return;
    }

    if (row.source === "search") {
      if (isPage(row.dimension)) return;
      point.searchClicks += row.clicks;
      point.searchImpressions += row.impressions;
      return;
    }

    if (row.source === "gmb") return;

    point.reach += row.reach;
    point.engagement += row.engagement;
  });

  return Array.from(byDate.values());
}

export function buildOrganicChannels(rows: OrganicDailyRow[]): OrganicChannelRow[] {
  const byChannel = new Map<string, OrganicChannelRow>();
  let totalSessions = 0;

  rows
    .filter((row) => row.source === "ga4")
    .forEach((row) => {
      const key = row.dimension || "—";
      const entry =
        byChannel.get(key) ||
        ({
          channel: key,
          sessions: 0,
          users: 0,
          engagedSessions: 0,
          conversions: 0,
          engagementRate: null,
          conversionRate: null,
          share: null,
        } as OrganicChannelRow);

      entry.sessions += row.sessions;
      entry.users += row.users;
      entry.engagedSessions += row.engagedSessions;
      entry.conversions += row.conversions;
      totalSessions += row.sessions;
      byChannel.set(key, entry);
    });

  return Array.from(byChannel.values())
    .map((entry) => ({
      ...entry,
      engagementRate: safeDivide(entry.engagedSessions, entry.sessions),
      conversionRate: safeDivide(entry.conversions, entry.sessions),
      share: safeDivide(entry.sessions, totalSessions),
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

function buildSearchRows(rows: OrganicDailyRow[], pages: boolean, limit: number): OrganicQueryRow[] {
  const byKey = new Map<string, { clicks: number; impressions: number; positionWeighted: number }>();

  rows
    .filter((row) => row.source === "search" && isPage(row.dimension) === pages)
    .forEach((row) => {
      const key = row.dimension || "—";
      const entry = byKey.get(key) || { clicks: 0, impressions: 0, positionWeighted: 0 };
      entry.clicks += row.clicks;
      entry.impressions += row.impressions;
      entry.positionWeighted += row.positionWeighted;
      byKey.set(key, entry);
    });

  return Array.from(byKey.entries())
    .map(([query, entry]) => ({
      query,
      clicks: entry.clicks,
      impressions: entry.impressions,
      ctr: safeDivide(entry.clicks, entry.impressions),
      position: safeDivide(entry.positionWeighted, entry.impressions),
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

export function buildOrganicSocial(
  rows: OrganicDailyRow[],
  previousRows: OrganicDailyRow[],
): OrganicSocialRow[] {
  return SOCIAL_SOURCES.map((source) => {
    const own = rows.filter((row) => row.source === source);
    if (!own.length) return null;

    const previousOwn = previousRows.filter((row) => row.source === source);
    const followers = latestFollowers(own);
    const previousFollowers = latestFollowers(previousOwn);

    const reach = own.reduce((total, row) => total + row.reach, 0);
    const engagement = own.reduce((total, row) => total + row.engagement, 0);

    return {
      source,
      label: organicSourceLabel(source),
      followers,
      // Sem base anterior não inventamos crescimento: fica null e a UI omite.
      followersDelta: previousFollowers ? followers - previousFollowers : null,
      reach,
      impressions: own.reduce((total, row) => total + row.impressions, 0),
      engagement,
      posts: own.reduce((total, row) => total + row.posts, 0),
      engagementRate: safeDivide(engagement, reach),
    } as OrganicSocialRow;
  }).filter((row): row is OrganicSocialRow => row !== null);
}

export interface AssembleOrganicInput {
  client: ClientConfig;
  range: DateRange;
  previousRange: DateRange;
  rows: OrganicDailyRow[];
  previousRows: OrganicDailyRow[];
  status: OrganicSourceStatus[];
  provider: string;
  demo: boolean;
  warnings: string[];
}

export function assembleOrganic(input: AssembleOrganicInput): OrganicPayload {
  return {
    meta: {
      clientId: input.client.id,
      clientName: input.client.name,
      range: input.range,
      previousRange: input.previousRange,
      generatedAt: new Date().toISOString(),
      provider: input.provider,
      demo: input.demo,
      warnings: input.warnings,
    },
    kpis: buildOrganicKpis(input.rows, input.previousRows),
    series: buildOrganicSeries(input.rows, input.range),
    channels: buildOrganicChannels(input.rows),
    queries: buildSearchRows(input.rows, false, 20),
    pages: buildSearchRows(input.rows, true, 20),
    social: buildOrganicSocial(input.rows, input.previousRows),
    status: input.status,
  };
}
