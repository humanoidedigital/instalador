import { NextResponse } from "next/server";
import { crmCredentials, getClient, loadClients } from "@/lib/clients";
import { rangeFromSearchParams } from "@/lib/dates";
import { inspectRdStation } from "@/lib/providers/crm/rdstation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Diagnóstico da conexão com o RD Station CRM:
 *   curl -u admin:SENHA "https://seu-dominio/api/crm-check?client=isentei" | jq
 *
 * Responde o que a API devolveu, quais campos vieram e como cada negociação foi
 * mapeada — o jeito rápido de conferir token, funil e atribuição sem abrir o painel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const client = getClient(url.searchParams.get("client"));

  if (!client) {
    return NextResponse.json({ error: "Cliente não encontrado em config/clients.json." }, { status: 404 });
  }

  const { range } = rangeFromSearchParams(url.searchParams);
  const targets = client.id === "__all__" ? loadClients() : [client];

  const results = await Promise.all(
    targets.map(async (target) => {
      const credentials = crmCredentials(target);
      if (!credentials.token) {
        return {
          cliente: target.name,
          ok: false,
          motivo: target.rdCrmTokenEnv
            ? `A variável ${target.rdCrmTokenEnv} não está definida no .env.`
            : "Sem rdCrmTokenEnv no clients.json e sem RD_CRM_TOKEN global no .env.",
        };
      }

      try {
        const report = await inspectRdStation({
          range,
          accountIds: [],
          crmToken: credentials.token,
          pipelines: credentials.pipelines,
        });
        const tokenVindoDe =
          target.rdCrmTokenEnv && process.env[target.rdCrmTokenEnv] ? target.rdCrmTokenEnv : "RD_CRM_TOKEN";
        return { cliente: target.name, ok: true, tokenVindoDe, ...report };
      } catch (error) {
        return { cliente: target.name, ok: false, motivo: (error as Error).message };
      }
    }),
  );

  return NextResponse.json({ periodo: range, clientes: results }, { headers: { "Cache-Control": "no-store" } });
}
