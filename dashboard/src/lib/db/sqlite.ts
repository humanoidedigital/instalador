import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Banco local em SQLite.
 *
 * Por que não Postgres: o volume aqui é pequeno — algumas centenas de milhares
 * de linhas por ano — e SQLite entrega isso com folga (200 mil inserções em
 * ~250 ms) sem um serviço a mais para instalar, monitorar e fazer backup.
 * Backup do painel inteiro passa a ser copiar um arquivo.
 */

let connection: Database.Database | null = null;

export function databasePath(): string {
  if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
  const clientsPath = process.env.CLIENTS_CONFIG_PATH;
  const base = clientsPath ? path.dirname(clientsPath) : path.join(process.cwd(), "config");
  return path.join(base, "data", "dashboard.db");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ad_daily (
  client_id      TEXT NOT NULL,
  channel        TEXT NOT NULL,
  account_id     TEXT NOT NULL,
  campaign_id    TEXT NOT NULL,
  date           TEXT NOT NULL,
  account_name   TEXT NOT NULL DEFAULT '',
  campaign       TEXT NOT NULL DEFAULT '',
  campaign_type  TEXT NOT NULL DEFAULT '',
  spend          REAL NOT NULL DEFAULT 0,
  impressions    INTEGER NOT NULL DEFAULT 0,
  clicks         INTEGER NOT NULL DEFAULT 0,
  platform_leads REAL NOT NULL DEFAULT 0,
  conversion_value REAL NOT NULL DEFAULT 0,
  collected_at   TEXT NOT NULL,
  PRIMARY KEY (client_id, channel, account_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS ad_daily_range ON ad_daily (client_id, date);

CREATE TABLE IF NOT EXISTS crm_deal (
  client_id   TEXT NOT NULL,
  deal_id     TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT '',
  pipeline    TEXT NOT NULL DEFAULT '',
  stage       TEXT NOT NULL DEFAULT '',
  stage_order INTEGER NOT NULL DEFAULT 99,
  status      TEXT NOT NULL DEFAULT 'open',
  value       REAL NOT NULL DEFAULT 0,
  source      TEXT NOT NULL DEFAULT '',
  channel     TEXT NOT NULL DEFAULT 'other',
  campaign    TEXT,
  collected_at TEXT NOT NULL,
  PRIMARY KEY (client_id, deal_id)
);

CREATE INDEX IF NOT EXISTS crm_deal_range ON crm_deal (client_id, created_at);

CREATE TABLE IF NOT EXISTS collection_run (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   TEXT NOT NULL,
  source      TEXT NOT NULL,
  range_from  TEXT NOT NULL,
  range_to    TEXT NOT NULL,
  rows        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL,
  error       TEXT,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS collection_run_recent ON collection_run (finished_at DESC);

CREATE TABLE IF NOT EXISTS alert_event (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id    TEXT NOT NULL,
  rule_name  TEXT NOT NULL,
  client_id  TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  scope_key  TEXT NOT NULL DEFAULT '',
  severity   TEXT NOT NULL,
  title      TEXT NOT NULL,
  detail     TEXT NOT NULL,
  value      REAL NOT NULL DEFAULT 0,
  threshold  REAL NOT NULL DEFAULT 0,
  fired_on   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered  INTEGER NOT NULL DEFAULT 0,
  -- Um disparo por regra, alvo e dia: sem isto o mesmo alerta reapareceria a
  -- cada coleta e o webhook viraria spam.
  UNIQUE (rule_id, client_id, scope_key, fired_on)
);

CREATE INDEX IF NOT EXISTS alert_event_recent ON alert_event (fired_on DESC, id DESC);
`;

export function db(): Database.Database {
  if (connection) return connection;

  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const instance = new Database(file);
  // WAL: leitura do relatório não trava enquanto a coleta escreve.
  instance.pragma("journal_mode = WAL");
  instance.pragma("synchronous = NORMAL");
  instance.pragma("busy_timeout = 5000");
  instance.exec(SCHEMA);

  connection = instance;
  return connection;
}

/** Habilitado por padrão; DATABASE_ENABLED=false volta ao modo sem histórico. */
export function databaseEnabled(): boolean {
  return process.env.DATABASE_ENABLED !== "false";
}

export function closeDatabase(): void {
  connection?.close();
  connection = null;
}
