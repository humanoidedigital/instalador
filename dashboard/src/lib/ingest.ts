import { getClient } from "./clients";
import { classifyChannel } from "./channel";
import { ORGANIC_SOURCE_IDS } from "./organic-config";
import { logRun, upsertAdDaily, upsertDeals, upsertOrganicDaily } from "./db/repository";
import { databaseEnabled } from "./db/sqlite";
import type {
  AdChannel,
  AdDailyRow,
  CrmOpportunity,
  CrmStatus,
  OrganicDailyRow,
  OrganicSource,
} from "./types";

/**
 * Entrada de dados de fora — n8n, script, o que for.
 *
 * O coletor interno vai buscar nas APIs; esta rota faz o caminho inverso e
 * recebe linhas já prontas. Com ela, de onde o dado vem deixa de ser decisão do
 * código: Windsor, Reportei, planilha ou API nativa entram pelo mesmo lugar.
 *
 * A validação aqui é deliberadamente rígida. Um fluxo de n8n com um campo
 * mapeado errado grava investimento zerado sem reclamar, e aí o CPL do
 * relatório mente por semanas. Linha inválida é recusada e devolvida com o
 * motivo, em vez de virar número silencioso.
 */

export type IngestKind = "ads" | "crm" | "organic";

export interface IngestReject {
  kind: IngestKind;
  /** Posição na lista enviada, para achar a linha no fluxo do n8n. */
  index: number;
  motivo: string;
}

export interface IngestResult {
  cliente: string;
  gravados: { ads: number; crm: number; organic: number };
  recusados: IngestReject[];
  periodo: { from: string; to: string } | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHANNELS: AdChannel[] = ["meta", "google"];
const STATUSES: CrmStatus[] = ["open", "won", "lost", "abandoned"];

function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

/** Número tolerante: aceita "1.234,56" e "1234.56", recusa texto que não é número. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  // "1.234,56" (pt-BR) vira "1234.56"; "1234.56" passa intacto.
  const normalized = /,\d{1,2}$/.test(raw) ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Aceita "2026-09-18" ou ISO com hora; devolve null quando não é data. */
function day(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;

  const candidate = raw.slice(0, 10);
  if (!DATE_PATTERN.test(candidate)) return null;

  // Recusa 2026-13-45: o padrão passa, a data não existe.
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === candidate ? candidate : null;
}

function iso(value: unknown, fallback: string): string {
  const raw = text(value);
  if (!raw) return fallback;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

interface Parsed<T> {
  linhas: T[];
  recusados: IngestReject[];
  datas: string[];
}

function parseAds(input: unknown): Parsed<AdDailyRow> {
  const linhas: AdDailyRow[] = [];
  const recusados: IngestReject[] = [];
  const datas: string[] = [];

  toArray(input).forEach((raw, index) => {
    const recusa = (motivo: string) => recusados.push({ kind: "ads", index, motivo });

    const date = day(raw.date);
    if (!date) return recusa('campo "date" ausente ou fora do formato AAAA-MM-DD.');

    const channel = text(raw.channel).toLowerCase() as AdChannel;
    if (!CHANNELS.includes(channel)) return recusa(`canal "${text(raw.channel)}" inválido — use "meta" ou "google".`);

    const numeros = {
      spend: num(raw.spend),
      impressions: num(raw.impressions),
      clicks: num(raw.clicks),
      platformLeads: num(raw.platformLeads ?? raw.platform_leads),
      conversionValue: num(raw.conversionValue ?? raw.conversion_value),
    };

    const invalido = Object.entries(numeros).find(([, value]) => value === null);
    if (invalido) return recusa(`campo "${invalido[0]}" não é um número.`);

    const campaign = text(raw.campaign, "(sem campanha)");

    linhas.push({
      date,
      channel,
      accountId: text(raw.accountId ?? raw.account_id),
      accountName: text(raw.accountName ?? raw.account_name, "Conta sem nome"),
      // Campanha sem id usa o nome como chave, igual ao coletor interno.
      campaignId: text(raw.campaignId ?? raw.campaign_id) || campaign,
      campaign,
      campaignType: text(raw.campaignType ?? raw.campaign_type, "—"),
      spend: numeros.spend as number,
      impressions: numeros.impressions as number,
      clicks: numeros.clicks as number,
      platformLeads: numeros.platformLeads as number,
      conversionValue: numeros.conversionValue as number,
    });
    datas.push(date);
  });

  return { linhas, recusados, datas };
}

function parseCrm(input: unknown): Parsed<CrmOpportunity> {
  const linhas: CrmOpportunity[] = [];
  const recusados: IngestReject[] = [];
  const datas: string[] = [];

  toArray(input).forEach((raw, index) => {
    const recusa = (motivo: string) => recusados.push({ kind: "crm", index, motivo });

    const id = text(raw.id);
    if (!id) return recusa('campo "id" é obrigatório — é a chave que evita duplicar a negociação.');

    const createdDay = day(raw.createdAt ?? raw.created_at);
    if (!createdDay) return recusa('campo "createdAt" ausente ou fora do formato de data.');

    const value = num(raw.value ?? raw.amount);
    if (value === null) return recusa('campo "value" não é um número.');

    const status = text(raw.status, "open").toLowerCase() as CrmStatus;
    if (!STATUSES.includes(status)) {
      return recusa(`status "${text(raw.status)}" inválido — use open, won, lost ou abandoned.`);
    }

    const createdAt = iso(raw.createdAt ?? raw.created_at, `${createdDay}T00:00:00.000Z`);
    const source = text(raw.source, "não identificado");
    const campaign = text(raw.campaign) || null;

    linhas.push({
      id,
      name: text(raw.name, "Negociação"),
      createdAt,
      updatedAt: iso(raw.updatedAt ?? raw.updated_at, createdAt),
      pipeline: text(raw.pipeline, "Funil"),
      stage: text(raw.stage, "Sem etapa"),
      stageOrder: Number.isFinite(Number(raw.stageOrder ?? raw.stage_order))
        ? Number(raw.stageOrder ?? raw.stage_order)
        : 99,
      status,
      value,
      source,
      // Se o fluxo mandar o canal, respeita; senão deduz da origem, como o adaptador do CRM.
      channel: text(raw.channel) ? classifyChannel(text(raw.channel)) : classifyChannel(source, campaign),
      campaign,
    });
    datas.push(createdDay);
  });

  return { linhas, recusados, datas };
}

function parseOrganic(input: unknown): Parsed<OrganicDailyRow> {
  const linhas: OrganicDailyRow[] = [];
  const recusados: IngestReject[] = [];
  const datas: string[] = [];

  toArray(input).forEach((raw, index) => {
    const recusa = (motivo: string) => recusados.push({ kind: "organic", index, motivo });

    const date = day(raw.date);
    if (!date) return recusa('campo "date" ausente ou fora do formato AAAA-MM-DD.');

    const source = text(raw.source).toLowerCase() as OrganicSource;
    if (!ORGANIC_SOURCE_IDS.includes(source)) {
      return recusa(`fonte "${text(raw.source)}" inválida — use ${ORGANIC_SOURCE_IDS.join(", ")}.`);
    }

    const campos = [
      "sessions",
      "users",
      "newUsers",
      "engagedSessions",
      "pageViews",
      "conversions",
      "impressions",
      "clicks",
      "reach",
      "engagement",
      "followers",
      "posts",
    ] as const;

    const numeros: Record<string, number> = {};
    for (const campo of campos) {
      const parsed = num(raw[campo] ?? raw[snake(campo)]);
      if (parsed === null) return recusa(`campo "${campo}" não é um número.`);
      numeros[campo] = parsed;
    }

    // Posição chega como média; o banco guarda ponderada por impressões.
    const position = num(raw.position);
    if (position === null) return recusa('campo "position" não é um número.');

    linhas.push({
      date,
      source,
      accountId: text(raw.accountId ?? raw.account_id),
      accountName: text(raw.accountName ?? raw.account_name, "Conta sem nome"),
      dimension: text(raw.dimension, "—"),
      sessions: numeros.sessions,
      users: numeros.users,
      newUsers: numeros.newUsers,
      engagedSessions: numeros.engagedSessions,
      pageViews: numeros.pageViews,
      conversions: numeros.conversions,
      impressions: numeros.impressions,
      clicks: numeros.clicks,
      positionWeighted: num(raw.positionWeighted ?? raw.position_weighted) || position * numeros.impressions,
      reach: numeros.reach,
      engagement: numeros.engagement,
      followers: numeros.followers,
      posts: numeros.posts,
    });
    datas.push(date);
  });

  return { linhas, recusados, datas };
}

function snake(camel: string): string {
  return camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toArray(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
}

export interface IngestPayload {
  client?: string;
  ads?: unknown;
  crm?: unknown;
  organic?: unknown;
}

export function ingest(payload: IngestPayload): IngestResult {
  if (!databaseEnabled()) {
    throw new Error("Banco desativado (DATABASE_ENABLED=false) — não há onde gravar.");
  }

  const clientId = text(payload.client);
  if (!clientId) throw new Error('Informe o cliente em "client".');
  if (clientId === "__all__") {
    throw new Error('"__all__" é a visão consolidada, não um cliente — envie o identificador real.');
  }

  const client = getClient(clientId);
  if (!client || client.id !== clientId) {
    throw new Error(`Cliente "${clientId}" não existe. Cadastre em Administração › Clientes antes de enviar dados.`);
  }

  const started = new Date();
  const ads = parseAds(payload.ads);
  const crm = parseCrm(payload.crm);
  const organic = parseOrganic(payload.organic);

  const recusados = [...ads.recusados, ...crm.recusados, ...organic.recusados];
  const datas = [...ads.datas, ...crm.datas, ...organic.datas].sort();
  const periodo = datas.length ? { from: datas[0], to: datas[datas.length - 1] } : null;

  const gravados = {
    ads: upsertAdDaily(clientId, ads.linhas),
    crm: upsertDeals(clientId, crm.linhas),
    organic: upsertOrganicDaily(clientId, organic.linhas),
  };

  const total = gravados.ads + gravados.crm + gravados.organic;
  const finished = new Date();

  // Fica no mesmo histórico da coleta interna, então Administração › Dados
  // mostra o que entrou pelo n8n do lado do que veio das APIs. Linha recusada
  // marca a execução como erro: dado faltando não pode passar despercebido.
  logRun({
    clientId,
    source: "ingest",
    rangeFrom: periodo?.from || started.toISOString().slice(0, 10),
    rangeTo: periodo?.to || started.toISOString().slice(0, 10),
    rows: total,
    status: recusados.length ? "erro" : "ok",
    error: recusados.length
      ? `${recusados.length} linha(s) recusada(s): ${recusados
          .slice(0, 5)
          .map((item) => `${item.kind}[${item.index}] ${item.motivo}`)
          .join(" | ")}`
      : null,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
  });

  return { cliente: clientId, gravados, recusados, periodo };
}
