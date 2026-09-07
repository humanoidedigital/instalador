import { crmCredentials, loadClients, type ClientConfig } from "./clients";
import { addDays, today } from "./dates";
import { selectAdsProvider, selectCrmProvider } from "./providers";
import { logRun, upsertAdDaily, upsertDeals } from "./db/repository";
import { databaseEnabled } from "./db/sqlite";
import type { AdChannel, DateRange, FetchOptions } from "./types";

/**
 * Coleta e persistência.
 *
 * Roda todo dia sobre uma janela que volta alguns dias no tempo, não só sobre
 * ontem: Meta e Google revisam números retroativamente e o CRM muda o status
 * de negociações antigas. Como a escrita é idempotente, reprocessar o mesmo
 * dia corrige o histórico em vez de duplicá-lo.
 */

export interface CollectResult {
  clientId: string;
  clientName: string;
  source: "ads" | "crm";
  rows: number;
  status: "ok" | "erro" | "ignorado";
  error?: string;
  durationMs: number;
}

/** Janela padrão de recoleta, em dias. */
export function defaultLookbackDays(): number {
  const value = Number(process.env.COLLECT_LOOKBACK_DAYS || 7);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 400) : 7;
}

export function windowFor(days: number): DateRange {
  const to = today();
  return { from: addDays(to, -(days - 1)), to };
}

async function collectAds(client: ClientConfig, range: DateRange): Promise<CollectResult> {
  const started = new Date();
  const ads = selectAdsProvider();

  const options = (channel: AdChannel): FetchOptions => ({
    range,
    accountIds: channel === "meta" ? client.metaAccountIds : client.googleAccountIds,
  });

  try {
    const [meta, google] = await Promise.all([
      ads.provider.fetchDaily("meta", options("meta")),
      ads.provider.fetchDaily("google", options("google")),
    ]);

    const rows = upsertAdDaily(client.id, [...meta, ...google]);
    const finished = new Date();

    logRun({
      clientId: client.id,
      source: "ads",
      rangeFrom: range.from,
      rangeTo: range.to,
      rows,
      status: "ok",
      error: null,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
    });

    return {
      clientId: client.id,
      clientName: client.name,
      source: "ads",
      rows,
      status: "ok",
      durationMs: finished.getTime() - started.getTime(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finished = new Date();

    logRun({
      clientId: client.id,
      source: "ads",
      rangeFrom: range.from,
      rangeTo: range.to,
      rows: 0,
      status: "erro",
      error: message,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
    });

    return {
      clientId: client.id,
      clientName: client.name,
      source: "ads",
      rows: 0,
      status: "erro",
      error: message,
      durationMs: finished.getTime() - started.getTime(),
    };
  }
}

async function collectCrm(client: ClientConfig, range: DateRange): Promise<CollectResult> {
  const started = new Date();
  const crm = selectCrmProvider();
  const credentials = crmCredentials(client);

  if (!credentials.configured && crm.provider.id !== "demo") {
    return {
      clientId: client.id,
      clientName: client.name,
      source: "crm",
      rows: 0,
      status: "ignorado",
      error: "cliente sem credencial de CRM",
      durationMs: 0,
    };
  }

  try {
    const deals = await crm.provider.fetchOpportunities({
      range,
      accountIds: [...client.metaAccountIds, ...client.googleAccountIds],
      crmToken: credentials.token,
      locationId: credentials.locationId,
      pipelines: credentials.pipelines,
    });

    const rows = upsertDeals(client.id, deals);
    const finished = new Date();

    logRun({
      clientId: client.id,
      source: "crm",
      rangeFrom: range.from,
      rangeTo: range.to,
      rows,
      status: "ok",
      error: null,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
    });

    return {
      clientId: client.id,
      clientName: client.name,
      source: "crm",
      rows,
      status: "ok",
      durationMs: finished.getTime() - started.getTime(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finished = new Date();

    logRun({
      clientId: client.id,
      source: "crm",
      rangeFrom: range.from,
      rangeTo: range.to,
      rows: 0,
      status: "erro",
      error: message,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
    });

    return {
      clientId: client.id,
      clientName: client.name,
      source: "crm",
      rows: 0,
      status: "erro",
      error: message,
      durationMs: finished.getTime() - started.getTime(),
    };
  }
}

/**
 * Coleta sequencial por cliente: as APIs têm limite de requisição e disparar
 * tudo em paralelo é o caminho mais curto para tomar 429.
 */
export async function collect(options: {
  clientId?: string;
  days?: number;
  range?: DateRange;
}): Promise<{ range: DateRange; results: CollectResult[] }> {
  if (!databaseEnabled()) {
    throw new Error("Banco desativado (DATABASE_ENABLED=false) — não há onde gravar a coleta.");
  }

  const range = options.range || windowFor(options.days || defaultLookbackDays());
  const clients = loadClients().filter((client) => !options.clientId || client.id === options.clientId);

  if (!clients.length) {
    throw new Error(options.clientId ? `Cliente "${options.clientId}" não encontrado.` : "Nenhum cliente cadastrado.");
  }

  const results: CollectResult[] = [];
  for (const client of clients) {
    results.push(await collectAds(client, range));
    results.push(await collectCrm(client, range));
  }

  return { range, results };
}
