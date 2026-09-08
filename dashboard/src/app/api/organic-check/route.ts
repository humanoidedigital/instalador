import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { getClient } from "@/lib/clients";
import { addDays, today } from "@/lib/dates";
import {
  loadOrganicConfig,
  ORGANIC_FIELDS,
  ORGANIC_SOURCES,
  type OrganicField,
} from "@/lib/organic-config";
import { probeOrganicSource } from "@/lib/providers/organic/windsor";
import { hasSecret } from "@/lib/secrets";
import type { OrganicSource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Diagnóstico das fontes de orgânico.
 *
 * Existe porque os IDs de campo destes conectores não puderam ser conferidos
 * de antemão: a Windsor recusa listar campos de conector sem conta conectada.
 * Assim que a conta existir, esta rota mostra o que o conector devolve de
 * verdade e diz quais campos do mapa não vieram — o ajuste é editar o mapa em
 * Administração › Orgânico, sem tocar no código.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "master") {
    return NextResponse.json({ error: "Acesso restrito à conta master." }, { status: 401 });
  }

  if (!hasSecret("WINDSOR_API_KEY")) {
    return NextResponse.json(
      { error: "WINDSOR_API_KEY não configurada — preencha em Administração › Conexões." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const client = getClient(url.searchParams.get("client"));
  const pedida = url.searchParams.get("source") as OrganicSource | null;
  const days = Number(url.searchParams.get("days")) || 7;
  const to = today();
  const range = { from: addDays(to, -(days - 1)), to };

  const config = loadOrganicConfig();
  const alvos = ORGANIC_SOURCES.filter((source) => !pedida || source.id === pedida);

  const resultados = await Promise.all(
    alvos.map(async (source) => {
      const mapa = config.sources[source.id];
      const mapeados = (Object.entries(mapa.fields) as [OrganicField, string][]).filter(([, id]) => Boolean(id));

      const base = {
        fonte: source.id,
        rotulo: source.label,
        conector: mapa.connector,
        ativa: mapa.enabled,
        contas: client?.organicAccounts?.[source.id]?.length || 0,
        onboard: source.onboard,
        mapeamento: Object.fromEntries(mapeados),
      };

      try {
        const { fields, rows } = await probeOrganicSource(source.id, { range, accountIds: [] });

        // O que o mapa pede e o conector não devolveu — é aqui que aparece um
        // ID errado, em vez de virar zero silencioso no relatório.
        const ausentes = mapeados.filter(([, id]) => !fields.includes(id)).map(([campo, id]) => `${campo} → ${id}`);

        return {
          ...base,
          ok: true as const,
          camposRecebidos: fields,
          camposAusentes: ausentes,
          naoMapeados: fields.filter(
            (field) => !mapeados.some(([, id]) => id === field) && !ORGANIC_FIELDS.includes(field as OrganicField),
          ),
          linhas: rows.length,
          amostra: rows.slice(0, 2),
        };
      } catch (error) {
        return { ...base, ok: false as const, erro: (error as Error).message };
      }
    }),
  );

  return NextResponse.json({
    periodo: range,
    cliente: client ? { id: client.id, nome: client.name } : null,
    fontes: resultados,
  });
}
