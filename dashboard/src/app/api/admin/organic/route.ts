import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/guard";
import { loadClients } from "@/lib/clients";
import {
  loadOrganicConfig,
  organicConfigPath,
  ORGANIC_FIELDS,
  ORGANIC_SOURCES,
  writeOrganicConfig,
  type OrganicConfig,
} from "@/lib/organic-config";
import { hasSecret } from "@/lib/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function denyIfNotMaster() {
  const session = await getSession();
  if (!session || session.role !== "master") {
    return NextResponse.json({ error: "Acesso restrito à conta master." }, { status: 401 });
  }
  return null;
}

/** Descrição de cada campo canônico, para a tela explicar o que preencher. */
const FIELD_HINTS: Record<string, string> = {
  date: "Data da linha. Obrigatório: sem ele não há série diária.",
  accountId: "ID da conta/propriedade.",
  accountName: "Nome da conta, usado só para exibição.",
  dimension: "Agrupador da fonte: canal no GA4, consulta no Search Console, ação no Meu Negócio.",
  sessions: "Sessões.",
  users: "Usuários distintos.",
  newUsers: "Usuários novos.",
  engagedSessions: "Sessões engajadas.",
  pageViews: "Páginas vistas.",
  conversions: "Conversões registradas na ferramenta.",
  impressions: "Impressões (ou visualizações, no Meu Negócio).",
  clicks: "Cliques (ou ações, no Meu Negócio).",
  position: "Posição média na busca.",
  reach: "Alcance — contas distintas alcançadas.",
  engagement: "Interações: curtidas, comentários, salvamentos.",
  followers: "Seguidores. É estoque: vale o número do último dia.",
  posts: "Publicações no período.",
};

export async function GET() {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const config = loadOrganicConfig();
  const clients = loadClients();

  return NextResponse.json({
    fontes: ORGANIC_SOURCES.map((source) => ({
      ...source,
      ...config.sources[source.id],
      // Quantos clientes já têm conta desta fonte — sem isso, ativar a fonte
      // não muda nada e ninguém entende por quê.
      clientes: clients.filter((client) => (client.organicAccounts?.[source.id]?.length || 0) > 0).length,
    })),
    campos: ORGANIC_FIELDS.map((field) => ({ id: field, hint: FIELD_HINTS[field] || "" })),
    arquivo: organicConfigPath(),
    windsorConfigurado: hasSecret("WINDSOR_API_KEY"),
    totalClientes: clients.length,
  });
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { sources?: OrganicConfig["sources"] };
  if (!body.sources || typeof body.sources !== "object") {
    return NextResponse.json({ error: "Formato inválido: esperado um objeto de fontes." }, { status: 400 });
  }

  const errors: string[] = [];
  ORGANIC_SOURCES.forEach((source) => {
    const entry = body.sources?.[source.id];
    if (!entry) return;
    if (entry.enabled && !entry.fields?.date) {
      errors.push(`${source.label}: o campo "date" é obrigatório para ativar a fonte.`);
    }
    if (!String(entry.connector || "").trim()) {
      errors.push(`${source.label}: informe o conector da Windsor.`);
    }
  });

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  try {
    writeOrganicConfig({ sources: body.sources });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `Não foi possível gravar: ${(error as Error).message}` }, { status: 500 });
  }
}
