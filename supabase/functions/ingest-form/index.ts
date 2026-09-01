/**
 * POST /ingest/form — recebe submissão de formulário de site e landing page.
 *
 * Vale para os modos B (intercept do crm.js), C (plugin WordPress),
 * D (formulário nativo) e E (webhook genérico). Todos caem aqui.
 *
 * Contrato e regras: docs/crm/03-captura-web.md
 *
 * Princípios que o código segue à risca:
 *   · Responde 202 SEMPRE que o pedido é legítimo — nunca revela se o lead já
 *     existia, porque a site_key é pública e isso vazaria a base.
 *   · Grava o payload cru ANTES de processar, com hash, para ser idempotente.
 *   · org_id nunca vem do cliente: sai da site_key, no servidor.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { montarIdentidades, normalizarEmail, normalizarTelefone } from "../_shared/identidade.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

/** Menos que isso é robô preenchendo, não pessoa digitando. */
const MS_MINIMO_HUMANO = 2000;

interface CorpoFormulario {
  site_key?: string;
  form_id?: string;
  pagina?: string;
  ms_preenchimento?: number;
  anonymous_id?: string;
  campos?: Record<string, string>;
  tracking?: Record<string, string | null>;
}

function cabecalhosCors(origem: string | null, liberado: boolean) {
  return {
    "Access-Control-Allow-Origin": liberado && origem ? origem : "null",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Descobre qual campo do formulário é nome, e-mail e telefone.
 *
 * Usa o mapa configurado no admin quando existe; senão cai na heurística.
 * Campo não reconhecido NUNCA é descartado — vai inteiro para contacts.custom,
 * porque o campo desconhecido de hoje é a pergunta de qualificação de amanhã.
 */
function extrairCampos(
  campos: Record<string, string>,
  mapa: Record<string, string> | null,
) {
  const out: { nome?: string; email?: string; telefone?: string; custom: Record<string, string> } =
    { custom: {} };

  const usados = new Set<string>();

  if (mapa) {
    for (const [chaveForm, destino] of Object.entries(mapa)) {
      const v = campos[chaveForm];
      if (!v) continue;
      if (destino === "nome" || destino === "email" || destino === "telefone") {
        out[destino] = v;
        usados.add(chaveForm);
      }
    }
  }

  for (const [k, v] of Object.entries(campos)) {
    if (usados.has(k) || !v) continue;
    const chave = k.toLowerCase();
    if (!out.email && /mail/.test(chave)) { out.email = v; continue; }
    if (!out.telefone && /(fone|phone|whats|tel|cel)/.test(chave)) { out.telefone = v; continue; }
    if (!out.nome && /(nome|name)/.test(chave) && !/sobrenome|last/.test(chave)) { out.nome = v; continue; }
    out.custom[k] = v;
  }

  return out;
}

Deno.serve(async (req: Request) => {
  const origem = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cabecalhosCors(origem, true) });
  }
  if (req.method !== "POST") {
    return new Response("método não permitido", { status: 405 });
  }

  let corpo: CorpoFormulario;
  try {
    corpo = await req.json();
  } catch {
    return new Response("json inválido", { status: 400 });
  }

  if (!corpo.site_key) {
    return new Response("site_key ausente", { status: 400 });
  }

  // ---- 1. site_key -> org. É daqui que sai o org_id, nunca do cliente. ----
  const { data: site } = await supabase
    .from("sites")
    .select("id, org_id, dominios, pipeline_id, field_map, ativo")
    .eq("site_key", corpo.site_key)
    .maybeSingle();

  if (!site || !site.ativo) {
    return new Response("site não encontrado", { status: 404 });
  }

  // ---- 2. Allowlist de domínio. A site_key identifica; o Origin autentica. ----
  const dominios: string[] = site.dominios ?? [];
  const host = origem ? new URL(origem).hostname : null;
  const liberado = dominios.length === 0 ||
    (host !== null && dominios.some((d) => host === d || host.endsWith("." + d)));

  const cors = cabecalhosCors(origem, liberado);

  // Requisição server-side (plugin WordPress) não manda Origin — e é justamente
  // a mais confiável, porque não passa por bloqueador de anúncio.
  if (origem && !liberado) {
    return new Response("origem não autorizada", { status: 403, headers: cors });
  }

  // ---- 3. Armadilhas de robô. Descarta em silêncio, com 202. ----------------
  const campos = corpo.campos ?? {};
  const respostaOk = () =>
    new Response(JSON.stringify({ ok: true }), {
      status: 202,
      headers: { ...cors, "content-type": "application/json" },
    });

  // Honeypot: campo escondido por CSS que só robô preenche. Devolver 403 aqui
  // ensinaria o spammer a ajustar o script, então devolvemos sucesso.
  if (campos._crm_hp) return respostaOk();

  const suspeito = typeof corpo.ms_preenchimento === "number" &&
    corpo.ms_preenchimento < MS_MINIMO_HUMANO;

  // ---- 4. Idempotência: grava cru antes de qualquer processamento. ---------
  const hash = await sha256Hex(JSON.stringify({ k: corpo.site_key, c: campos, p: corpo.pagina }));

  const { data: entrega, error: erroEntrega } = await supabase
    .from("webhook_deliveries")
    .insert({
      org_id: site.org_id,
      provider: "form",
      external_id: corpo.form_id ?? null,
      payload_hash: hash,
      payload: corpo as unknown as Record<string, unknown>,
      headers: { origin: origem, ua: req.headers.get("user-agent") },
    })
    .select("id")
    .maybeSingle();

  // Conflito no UNIQUE(provider, payload_hash) = reenvio. Já tratamos.
  if (erroEntrega?.code === "23505") return respostaOk();
  if (erroEntrega) {
    console.error("falha ao gravar entrega", erroEntrega);
    return new Response("erro interno", { status: 500, headers: cors });
  }

  // ---- 5. Normaliza e resolve o contato. -----------------------------------
  const extraidos = extrairCampos(campos, site.field_map ?? null);
  const identidades = montarIdentidades({
    telefone: extraidos.telefone,
    email: extraidos.email,
  });

  if (identidades.length === 0) {
    // Sem telefone nem e-mail não há como deduplicar nem atender. Fica
    // registrado na entrega crua para revisão no admin.
    await supabase.from("webhook_deliveries")
      .update({ processado_em: new Date().toISOString(), erro: "sem identidade utilizável" })
      .eq("id", entrega!.id);
    return respostaOk();
  }

  // A resolução de contato, o merge, a regra anti-deal-duplicado e a criação
  // da tarefa acontecem numa função do banco, em transação única — não dá
  // para fazer isso em chamadas soltas sem abrir corrida entre dois leads
  // simultâneos da mesma pessoa.
  const { error: erroIngestao } = await supabase.rpc("ingerir_lead", {
    p_org_id: site.org_id,
    p_delivery_id: entrega!.id,
    p_pipeline_id: site.pipeline_id,
    p_origem: "site",
    p_identidades: identidades,
    p_contato: {
      nome: extraidos.nome ?? null,
      email: normalizarEmail(extraidos.email) ?? null,
      phone_e164: normalizarTelefone(extraidos.telefone)?.principal ?? null,
      custom: extraidos.custom,
    },
    p_tracking: corpo.tracking ?? {},
    p_anonymous_id: corpo.anonymous_id ?? null,
    p_suspeito: suspeito,
  });

  if (erroIngestao) {
    console.error("falha na ingestão", erroIngestao);
    await supabase.from("webhook_deliveries")
      .update({ erro: erroIngestao.message })
      .eq("id", entrega!.id);
    // Ainda devolve 202: a entrega crua está salva e pode ser reprocessada
    // pelo admin. Devolver erro faria o formulário do cliente parecer quebrado.
  }

  return respostaOk();
});
