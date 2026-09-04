import { NextResponse } from "next/server";
import { getSecret, maskSecret, secretOrigin, secretsPath, writeSecrets } from "@/lib/secrets";
import { isSecretField, isWritableKey, SETTINGS_GROUPS } from "@/lib/settings-catalog";
import { getSession } from "@/lib/auth/guard";
import { loadClients } from "@/lib/clients";
import { cacheClear } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function denyIfNotMaster() {
  const session = await getSession();
  if (!session || session.role !== "master") {
    return NextResponse.json({ error: "Acesso restrito à conta master." }, { status: 401 });
  }
  return null;
}

function describe(key: string) {
  const value = getSecret(key);
  const secret = isSecretField(key);
  return {
    key,
    // Campos de segredo nunca saem em claro — só a máscara e se estão definidos.
    value: secret ? "" : value || "",
    masked: secret ? maskSecret(value) : "",
    definido: !!value,
    origem: secretOrigin(key),
  };
}

export async function GET() {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.map((field) => ({ ...field, ...describe(field.key) })),
  }));

  // Tokens por cliente, na ordem em que os clientes aparecem.
  const clientTokens = loadClients()
    .filter((client) => client.rdCrmTokenEnv)
    .map((client) => ({
      clientId: client.id,
      clientName: client.name,
      ...describe(client.rdCrmTokenEnv),
    }));

  return NextResponse.json({ groups, clientTokens, cofre: secretsPath() });
}

export async function PUT(request: Request) {
  const denied = await denyIfNotMaster();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    values?: Record<string, string>;
    clear?: string[];
  };

  const patch: Record<string, string | null> = {};

  Object.entries(body.values || {}).forEach(([key, value]) => {
    if (!isWritableKey(key)) return;
    const trimmed = String(value).trim();
    // Campo em branco significa "não mexi neste"; para apagar existe `clear`.
    if (trimmed) patch[key] = trimmed;
  });

  (body.clear || []).forEach((key) => {
    if (isWritableKey(key)) patch[key] = null;
  });

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: true, alterados: 0 });
  }

  try {
    writeSecrets(patch);
    cacheClear();
    return NextResponse.json({ ok: true, alterados: Object.keys(patch).length });
  } catch (error) {
    return NextResponse.json(
      { error: `Não foi possível gravar o cofre: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
