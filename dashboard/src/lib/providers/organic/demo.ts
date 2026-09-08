import type { FetchOptions, OrganicDailyRow, OrganicProvider, OrganicSource } from "@/lib/types";
import { eachDay } from "@/lib/dates";

/**
 * Orgânico sintético, determinístico como o de mídia paga: mesma data e mesma
 * conta sempre geram os mesmos números.
 *
 * Existe por um motivo concreto: nenhuma conta de orgânico está conectada na
 * Windsor ainda, e sem isto a tela ficaria impossível de avaliar. Nunca é usado
 * quando um provedor real está configurado.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weekdayFactor(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return [0.68, 1.12, 1.14, 1.1, 1.05, 0.95, 0.7][day];
}

const GA4_CHANNELS = [
  { channel: "Organic Search", weight: 0.42, conversion: 0.031 },
  { channel: "Direct", weight: 0.22, conversion: 0.026 },
  { channel: "Organic Social", weight: 0.17, conversion: 0.014 },
  { channel: "Referral", weight: 0.09, conversion: 0.022 },
  { channel: "Email", weight: 0.06, conversion: 0.048 },
  { channel: "Paid Search", weight: 0.04, conversion: 0.036 },
];

const QUERIES = [
  { query: "isenção de imposto para pcd", weight: 0.18, position: 3.4 },
  { query: "como pedir isenção ipi", weight: 0.14, position: 5.1 },
  { query: "laudo médico isenção carro", weight: 0.12, position: 7.8 },
  { query: "isenção icms carro pcd 2026", weight: 0.11, position: 4.6 },
  { query: "consultoria isenção veículo", weight: 0.09, position: 9.2 },
  { query: "documentos isenção ipva", weight: 0.08, position: 11.4 },
  { query: "quem tem direito a isenção", weight: 0.08, position: 6.3 },
  { query: "isenção de imposto autismo", weight: 0.07, position: 8.7 },
  { query: "esquadrias de alumínio sob medida", weight: 0.07, position: 12.9 },
  { query: "mármore para cozinha preço", weight: 0.06, position: 14.2 },
];

const PAGES = [
  { query: "/isencao-ipi-pcd", weight: 0.26, position: 4.2 },
  { query: "/blog/documentos-necessarios", weight: 0.19, position: 6.8 },
  { query: "/", weight: 0.17, position: 3.1 },
  { query: "/blog/laudo-medico", weight: 0.14, position: 9.4 },
  { query: "/contato", weight: 0.13, position: 7.2 },
  { query: "/blog/prazos-2026", weight: 0.11, position: 12.6 },
];

const GMB_ACTIONS = [
  { action: "Ligações", weight: 0.34 },
  { action: "Rotas", weight: 0.28 },
  { action: "Site", weight: 0.38 },
];

const CONTENT_TYPES = [
  { type: "Reels", weight: 0.44 },
  { type: "Carrossel", weight: 0.33 },
  { type: "Imagem", weight: 0.23 },
];

function empty(date: string, source: OrganicSource, accountId: string, dimension: string): OrganicDailyRow {
  return {
    date,
    source,
    accountId,
    accountName: `Perfil demo ${accountId.slice(-4)}`,
    dimension,
    sessions: 0,
    users: 0,
    newUsers: 0,
    engagedSessions: 0,
    pageViews: 0,
    conversions: 0,
    impressions: 0,
    clicks: 0,
    positionWeighted: 0,
    reach: 0,
    engagement: 0,
    followers: 0,
    posts: 0,
  };
}

/**
 * Crescimento ancorado na data, não na posição dentro do período.
 *
 * Seguidores precisam disto: se o número dependesse do índice do dia, o último
 * dia do período anterior teria o mesmo valor do último dia do atual e a
 * variação daria sempre zero.
 */
const ANCHOR = Date.parse("2026-01-01T00:00:00Z");

function growthByDate(isoDate: string, rate: number): number {
  const days = (Date.parse(`${isoDate}T00:00:00Z`) - ANCHOR) / 86_400_000;
  return 1 + (Number.isFinite(days) ? days : 0) * rate;
}

function buildRows(source: OrganicSource, options: FetchOptions): OrganicDailyRow[] {
  const days = eachDay(options.range);
  const rows: OrganicDailyRow[] = [];

  options.accountIds.forEach((accountId) => {
    const base = mulberry32(hash(`${source}:${accountId}`));
    const dailyBase = 180 + base() * 620;
    const followersBase = 2400 + base() * 18000;

    days.forEach((date) => {
      const day = mulberry32(hash(`${source}:${accountId}:${date}`));
      const noise = 0.82 + day() * 0.36;
      const volume = dailyBase * weekdayFactor(date) * noise * growthByDate(date, 0.0009);

      if (source === "ga4") {
        GA4_CHANNELS.forEach((channel, index) => {
          const random = mulberry32(hash(`ga4:${accountId}:${date}:${index}`));
          const sessions = Math.round(volume * channel.weight * (0.85 + random() * 0.3));
          if (!sessions) return;
          const users = Math.round(sessions * (0.78 + random() * 0.14));

          rows.push({
            ...empty(date, source, accountId, channel.channel),
            sessions,
            users,
            newUsers: Math.round(users * (0.52 + random() * 0.22)),
            engagedSessions: Math.round(sessions * (0.48 + random() * 0.24)),
            pageViews: Math.round(sessions * (1.9 + random() * 1.6)),
            conversions: Math.round(sessions * channel.conversion * (0.7 + random() * 0.7)),
          });
        });
        return;
      }

      if (source === "search") {
        // Consultas e páginas voltam na mesma fonte; a barra inicial separa as
        // duas, como o próprio Search Console devolve.
        [...QUERIES, ...PAGES].forEach((item, index) => {
          const random = mulberry32(hash(`search:${accountId}:${date}:${index}`));
          const impressions = Math.round(volume * 2.4 * item.weight * (0.8 + random() * 0.4));
          if (!impressions) return;

          // CTR cai com a posição, como na vida real.
          const ctr = Math.max(0.008, 0.31 * Math.exp(-0.26 * item.position)) * (0.75 + random() * 0.5);
          const position = item.position * (0.92 + random() * 0.16);

          rows.push({
            ...empty(date, source, accountId, item.query),
            impressions,
            clicks: Math.round(impressions * ctr),
            positionWeighted: position * impressions,
          });
        });
        return;
      }

      if (source === "gmb") {
        GMB_ACTIONS.forEach((action, index) => {
          const random = mulberry32(hash(`gmb:${accountId}:${date}:${index}`));
          const views = Math.round(volume * 0.6 * (0.8 + random() * 0.4));
          rows.push({
            ...empty(date, source, accountId, action.action),
            impressions: views,
            clicks: Math.round(views * action.weight * (0.04 + random() * 0.05)),
          });
        });
        return;
      }

      // Instagram e Facebook orgânico.
      CONTENT_TYPES.forEach((content, index) => {
        const random = mulberry32(hash(`${source}:${accountId}:${date}:${index}`));
        const reach = Math.round(volume * 3.2 * content.weight * (0.7 + random() * 0.6));
        const impressions = Math.round(reach * (1.15 + random() * 0.5));
        const posts = random() > 0.62 ? 1 : 0;

        rows.push({
          ...empty(date, source, accountId, content.type),
          impressions,
          reach,
          engagement: Math.round(reach * (0.028 + random() * 0.05)),
          posts,
          // Seguidores é estoque: o mesmo número em toda linha do dia, subindo
          // devagar. A camada de métricas pega o valor do último dia.
          followers: index === 0 ? Math.round(followersBase * growthByDate(date, 0.00035)) : 0,
        });
      });
    });
  });

  return rows;
}

export const demoOrganicProvider: OrganicProvider = {
  id: "demo",
  label: "Demonstração (orgânico)",
  async fetchDaily(source, options) {
    if (!options.accountIds.length) return [];
    return buildRows(source, options);
  },
};
