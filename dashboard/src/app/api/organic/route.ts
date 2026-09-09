import { NextResponse } from "next/server";
import { getClient, loadClients, type ClientConfig } from "@/lib/clients";
import { previousRange, rangeFromSearchParams } from "@/lib/dates";
import { organicCoverage, readOrganicDaily } from "@/lib/db/repository";
import { databaseEnabled } from "@/lib/db/sqlite";
import { assembleOrganic } from "@/lib/organic";
import { loadOrganicConfig, ORGANIC_SOURCES } from "@/lib/organic-config";
import { selectOrganicProvider } from "@/lib/providers";
import { sessionWithClient } from "@/lib/auth/guard";
import type { DateRange, OrganicDailyRow, OrganicSource, OrganicSourceStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** IDs reais por trás do cliente selecionado (a visão consolidada abre em todos). */
function targetClientIds(client: ClientConfig): string[] {
  return client.id === "__all__" ? loadClients().map((item) => item.id) : [client.id];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await sessionWithClient(url.searchParams.get("client"));
  if (!access) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }

  const found = getClient(access.clientId);
  if (!found) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
  const client = found;

  const { range } = rangeFromSearchParams(url.searchParams);
  const previous = previousRange(range);

  const organic = selectOrganicProvider();
  const config = loadOrganicConfig();
  const warnings = [...organic.warnings];

  // Fonte ativa que tem conta neste cliente. No modo demonstração ninguém
  // ativou nada ainda, então as contas do cliente é que mandam.
  const sources = ORGANIC_SOURCES.filter(
    (source) =>
      (organic.demo || config.sources[source.id].enabled) &&
      (client.organicAccounts?.[source.id]?.length || 0) > 0,
  );

  const status: OrganicSourceStatus[] = ORGANIC_SOURCES.map((source) => ({
    source: source.id,
    label: source.label,
    connector: config.sources[source.id].connector,
    enabled: config.sources[source.id].enabled,
    accounts: client.organicAccounts?.[source.id]?.length || 0,
    rows: 0,
    error: null,
  }));

  const byId = new Map(status.map((item) => [item.source, item]));

  // ---- Histórico ------------------------------------------------------------
  // Só vale quando o banco cobre o período inteiro, incluindo o de comparação:
  // meio período gravado viraria uma queda que não aconteceu.
  const clientIds = targetClientIds(client);
  const cobertura = databaseEnabled() ? organicCoverage(clientIds) : { minDate: null, maxDate: null };
  const useHistory =
    Boolean(cobertura.minDate && cobertura.maxDate) &&
    cobertura.minDate! <= previous.from &&
    cobertura.maxDate! >= range.to;

  if (useHistory) {
    const rows = readOrganicDaily(clientIds, range);
    if (rows.length) {
      rows.forEach((row) => {
        const entry = byId.get(row.source);
        if (entry) entry.rows += 1;
      });

      return NextResponse.json(
        assembleOrganic({
          client,
          range,
          previousRange: previous,
          rows,
          previousRows: readOrganicDaily(clientIds, previous),
          status,
          provider: `${organic.provider.label} (histórico)`,
          demo: organic.demo,
          warnings,
        }),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // ---- Consulta direta ------------------------------------------------------
  async function load(forRange: DateRange, record: boolean): Promise<OrganicDailyRow[]> {
    const collected: OrganicDailyRow[] = [];

    for (const source of sources) {
      const accounts = accountsFor(client, source.id);
      try {
        const rows = await organic.provider.fetchDaily(source.id, { range: forRange, accountIds: accounts });
        collected.push(...rows);
        if (record) {
          const entry = byId.get(source.id);
          if (entry) entry.rows = rows.length;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Uma fonte quebrada não pode zerar as outras: vira aviso e segue.
        if (record) {
          const entry = byId.get(source.id);
          if (entry) entry.error = message;
        }
        warnings.push(`${source.label}: ${message}`);
      }
    }

    return collected;
  }

  const [rows, previousRows] = await Promise.all([load(range, true), load(previous, false)]);

  if (!sources.length) {
    warnings.push(
      "Nenhuma fonte de orgânico configurada para este cliente. " +
        "Cadastre as contas em Administração › Clientes e ative a fonte em Administração › Orgânico.",
    );
  }

  return NextResponse.json(
    assembleOrganic({
      client,
      range,
      previousRange: previous,
      rows,
      previousRows,
      status,
      provider: organic.provider.label,
      demo: organic.demo,
      warnings,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Na visão consolidada, as contas de todos os clientes entram juntas. */
function accountsFor(client: ClientConfig, source: OrganicSource): string[] {
  return client.organicAccounts?.[source] || [];
}
