import { db } from "./sqlite";
import type { AdChannel, AdDailyRow, CrmOpportunity, CrmStatus, DateRange, LeadChannel } from "@/lib/types";

/**
 * Leitura e escrita dos fatos coletados. Toda escrita é idempotente: coletar
 * o mesmo dia duas vezes atualiza a linha em vez de duplicar, o que permite
 * reprocessar um período sem medo (e é o que acontece todo dia, já que as
 * plataformas revisam números retroativamente).
 */

export interface CoverageRow {
  clientId: string;
  source: "ads" | "crm";
  minDate: string | null;
  maxDate: string | null;
  rows: number;
}

export interface RunRow {
  id: number;
  clientId: string;
  source: string;
  rangeFrom: string;
  rangeTo: string;
  rows: number;
  status: string;
  error: string | null;
  startedAt: string;
  finishedAt: string;
}

export function upsertAdDaily(clientId: string, rows: AdDailyRow[]): number {
  if (!rows.length) return 0;

  const statement = db().prepare(`
    INSERT INTO ad_daily (
      client_id, channel, account_id, campaign_id, date,
      account_name, campaign, campaign_type,
      spend, impressions, clicks, platform_leads, conversion_value, collected_at
    ) VALUES (
      @client_id, @channel, @account_id, @campaign_id, @date,
      @account_name, @campaign, @campaign_type,
      @spend, @impressions, @clicks, @platform_leads, @conversion_value, @collected_at
    )
    ON CONFLICT (client_id, channel, account_id, campaign_id, date) DO UPDATE SET
      account_name = excluded.account_name,
      campaign = excluded.campaign,
      campaign_type = excluded.campaign_type,
      spend = excluded.spend,
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      platform_leads = excluded.platform_leads,
      conversion_value = excluded.conversion_value,
      collected_at = excluded.collected_at
  `);

  const collectedAt = new Date().toISOString();
  const write = db().transaction((list: AdDailyRow[]) => {
    list.forEach((row) => {
      statement.run({
        client_id: clientId,
        channel: row.channel,
        account_id: row.accountId,
        // Campanha sem id (acontece em algumas contas) usa o nome como chave.
        campaign_id: row.campaignId || row.campaign,
        date: row.date,
        account_name: row.accountName,
        campaign: row.campaign,
        campaign_type: row.campaignType,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        platform_leads: row.platformLeads,
        conversion_value: row.conversionValue,
        collected_at: collectedAt,
      });
    });
  });

  write(rows);
  return rows.length;
}

export function upsertDeals(clientId: string, deals: CrmOpportunity[]): number {
  if (!deals.length) return 0;

  const statement = db().prepare(`
    INSERT INTO crm_deal (
      client_id, deal_id, name, created_at, updated_at, pipeline, stage, stage_order,
      status, value, source, channel, campaign, collected_at
    ) VALUES (
      @client_id, @deal_id, @name, @created_at, @updated_at, @pipeline, @stage, @stage_order,
      @status, @value, @source, @channel, @campaign, @collected_at
    )
    ON CONFLICT (client_id, deal_id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at,
      pipeline = excluded.pipeline,
      stage = excluded.stage,
      stage_order = excluded.stage_order,
      status = excluded.status,
      value = excluded.value,
      source = excluded.source,
      channel = excluded.channel,
      campaign = excluded.campaign,
      collected_at = excluded.collected_at
  `);

  const collectedAt = new Date().toISOString();
  const write = db().transaction((list: CrmOpportunity[]) => {
    list.forEach((deal) => {
      statement.run({
        client_id: clientId,
        deal_id: deal.id,
        name: deal.name,
        created_at: deal.createdAt,
        updated_at: deal.updatedAt,
        pipeline: deal.pipeline,
        stage: deal.stage,
        stage_order: deal.stageOrder,
        status: deal.status,
        value: deal.value,
        source: deal.source,
        channel: deal.channel,
        campaign: deal.campaign,
        collected_at: collectedAt,
      });
    });
  });

  write(deals);
  return deals.length;
}

interface AdDailyRecord {
  channel: string;
  account_id: string;
  account_name: string;
  campaign_id: string;
  campaign: string;
  campaign_type: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  platform_leads: number;
  conversion_value: number;
}

export function readAdDaily(clientIds: string[], range: DateRange): AdDailyRow[] {
  if (!clientIds.length) return [];

  const placeholders = clientIds.map(() => "?").join(",");
  const records = db()
    .prepare(
      `SELECT channel, account_id, account_name, campaign_id, campaign, campaign_type, date,
              SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
              SUM(platform_leads) AS platform_leads, SUM(conversion_value) AS conversion_value
         FROM ad_daily
        WHERE client_id IN (${placeholders}) AND date BETWEEN ? AND ?
        GROUP BY channel, account_id, campaign_id, date`,
    )
    .all(...clientIds, range.from, range.to) as AdDailyRecord[];

  return records.map((record) => ({
    date: record.date,
    channel: record.channel as AdChannel,
    accountId: record.account_id,
    accountName: record.account_name,
    campaignId: record.campaign_id,
    campaign: record.campaign,
    campaignType: record.campaign_type,
    spend: record.spend,
    impressions: record.impressions,
    clicks: record.clicks,
    platformLeads: record.platform_leads,
    conversionValue: record.conversion_value,
  }));
}

interface DealRecord {
  deal_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  pipeline: string;
  stage: string;
  stage_order: number;
  status: string;
  value: number;
  source: string;
  channel: string;
  campaign: string | null;
}

export function readDeals(clientIds: string[], range: DateRange): CrmOpportunity[] {
  if (!clientIds.length) return [];

  const placeholders = clientIds.map(() => "?").join(",");
  const records = db()
    .prepare(
      `SELECT deal_id, name, created_at, updated_at, pipeline, stage, stage_order,
              status, value, source, channel, campaign
         FROM crm_deal
        WHERE client_id IN (${placeholders})
          AND date(created_at) BETWEEN date(?) AND date(?)`,
    )
    .all(...clientIds, range.from, range.to) as DealRecord[];

  return records.map((record) => ({
    id: record.deal_id,
    name: record.name,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    pipeline: record.pipeline,
    stage: record.stage,
    stageOrder: record.stage_order,
    status: record.status as CrmStatus,
    value: record.value,
    source: record.source,
    channel: record.channel as LeadChannel,
    campaign: record.campaign,
  }));
}

/**
 * O período pedido já está coberto pelo histórico?
 * Exige que a coleta alcance o início do período e chegue até o fim (ou até
 * ontem, já que o dia corrente ainda está sendo veiculado).
 */
export function hasCoverage(clientIds: string[], range: DateRange, today: string): boolean {
  if (!clientIds.length) return false;

  const placeholders = clientIds.map(() => "?").join(",");
  const ads = db()
    .prepare(
      `SELECT MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS rows
         FROM ad_daily WHERE client_id IN (${placeholders})`,
    )
    .get(...clientIds) as { min_date: string | null; max_date: string | null; rows: number };

  if (!ads.rows || !ads.min_date || !ads.max_date) return false;
  if (ads.min_date > range.from) return false;

  // O dia de hoje quase nunca está fechado; basta a coleta ter chegado a ontem.
  const requiredEnd = range.to >= today ? previousDay(today) : range.to;
  return ads.max_date >= requiredEnd;
}

function previousDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function coverage(): CoverageRow[] {
  const ads = db()
    .prepare(
      `SELECT client_id, MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS rows
         FROM ad_daily GROUP BY client_id`,
    )
    .all() as { client_id: string; min_date: string; max_date: string; rows: number }[];

  const crm = db()
    .prepare(
      `SELECT client_id, MIN(date(created_at)) AS min_date, MAX(date(created_at)) AS max_date, COUNT(*) AS rows
         FROM crm_deal GROUP BY client_id`,
    )
    .all() as { client_id: string; min_date: string; max_date: string; rows: number }[];

  return [
    ...ads.map((row) => ({
      clientId: row.client_id,
      source: "ads" as const,
      minDate: row.min_date,
      maxDate: row.max_date,
      rows: row.rows,
    })),
    ...crm.map((row) => ({
      clientId: row.client_id,
      source: "crm" as const,
      minDate: row.min_date,
      maxDate: row.max_date,
      rows: row.rows,
    })),
  ];
}

export function logRun(entry: Omit<RunRow, "id">): void {
  db()
    .prepare(
      `INSERT INTO collection_run (client_id, source, range_from, range_to, rows, status, error, started_at, finished_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.clientId,
      entry.source,
      entry.rangeFrom,
      entry.rangeTo,
      entry.rows,
      entry.status,
      entry.error,
      entry.startedAt,
      entry.finishedAt,
    );
}

export function recentRuns(limit = 20): RunRow[] {
  const records = db()
    .prepare(
      `SELECT id, client_id, source, range_from, range_to, rows, status, error, started_at, finished_at
         FROM collection_run ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];

  return records.map((record) => ({
    id: Number(record.id),
    clientId: String(record.client_id),
    source: String(record.source),
    rangeFrom: String(record.range_from),
    rangeTo: String(record.range_to),
    rows: Number(record.rows),
    status: String(record.status),
    error: record.error ? String(record.error) : null,
    startedAt: String(record.started_at),
    finishedAt: String(record.finished_at),
  }));
}

export function databaseStats() {
  const size = db().prepare("SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()").get() as {
    bytes: number;
  };
  const adRows = db().prepare("SELECT COUNT(*) AS total FROM ad_daily").get() as { total: number };
  const dealRows = db().prepare("SELECT COUNT(*) AS total FROM crm_deal").get() as { total: number };

  return { bytes: size.bytes, adRows: adRows.total, dealRows: dealRows.total };
}
