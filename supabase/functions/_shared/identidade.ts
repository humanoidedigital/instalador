/**
 * Normalização e deduplicação de identidades.
 *
 * É o módulo mais importante do CRM: se ele errar, o mesmo cliente vira duas
 * fichas e a venda é creditada ao canal errado. Toda ingestão passa por aqui,
 * sem exceção — incluindo a importação de CSV.
 *
 * Ver docs/crm/02-ingestao-e-dedupe.md
 */

export type TipoIdentidade =
  | "phone"
  | "email"
  | "wa_id"
  | "fbclid"
  | "gclid"
  | "fb_lead_id"
  | "external_id";

export interface Identidade {
  tipo: TipoIdentidade;
  valor: string;
}

/** DDDs que existem no Brasil. Fora desta lista o número é inválido. */
const DDDS_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export interface TelefoneNormalizado {
  /** Forma canônica gravada em contacts.phone_e164 (celular sempre com o 9). */
  principal: string;
  /**
   * TODAS as formas pelas quais esta pessoa pode ser encontrada.
   * Celular gera duas: com e sem o nono dígito. Cada uma vira uma linha em
   * contact_identities apontando para o MESMO contato — é isso que faz o
   * stitching funcionar quando o site manda um formato e o WhatsApp outro.
   */
  variantes: string[];
  tipo: "celular" | "fixo";
}

/**
 * Normaliza um telefone brasileiro para E.164.
 *
 * Retorna null quando o número não é aproveitável — nesse caso o lead ainda
 * é criado, só não ganha identidade de telefone.
 *
 * @param bruto  como veio do formulário, do webhook ou da planilha
 * @param ddiPadrao  país assumido quando não vem DDI (55 = Brasil)
 */
export function normalizarTelefone(
  bruto: string | null | undefined,
  ddiPadrao = "55",
): TelefoneNormalizado | null {
  if (!bruto) return null;

  let d = String(bruto).replace(/\D/g, "");
  if (!d) return null;

  // 00 é prefixo internacional discado; 0 é prefixo de operadora interurbano.
  d = d.replace(/^00+/, "");

  // Sem DDI: 10 dígitos (fixo) ou 11 (celular). Um 0 na frente do DDD é comum
  // em planilha antiga — "011 98765-4321".
  if (d.length === 11 || d.length === 10) {
    d = ddiPadrao + d;
  } else if (d.length === 12 && d.startsWith("0")) {
    d = ddiPadrao + d.slice(1);
  } else if (d.length === 8 || d.length === 9) {
    // Número sem DDD é ambíguo: não dá pra adivinhar a cidade. Descarta.
    return null;
  }

  // Fora do Brasil: aceita como está, sem variantes (a regra do nono dígito
  // não se aplica) — mas só se tiver tamanho plausível de E.164.
  if (!d.startsWith("55")) {
    if (d.length < 8 || d.length > 15) return null;
    return { principal: "+" + d, variantes: ["+" + d], tipo: "fixo" };
  }

  const nacional = d.slice(2);
  if (nacional.length !== 10 && nacional.length !== 11) return null;

  const ddd = Number(nacional.slice(0, 2));
  if (!DDDS_VALIDOS.has(ddd)) return null;

  const assinante = nacional.slice(2);
  const primeiro = assinante[0];

  // 8 dígitos começando em 2–5 é telefone fixo. Nunca ganha o nono dígito:
  // acrescentar um 9 aqui inventaria um celular que não existe.
  if (assinante.length === 8 && primeiro >= "2" && primeiro <= "5") {
    const e164 = `+55${nacional}`;
    return { principal: e164, variantes: [e164], tipo: "fixo" };
  }

  // Celular. Duas grafias possíveis para a mesma linha.
  let com9: string;
  let sem9: string;

  if (assinante.length === 9) {
    if (primeiro !== "9") return null; // celular de 9 dígitos sempre começa em 9
    com9 = assinante;
    sem9 = assinante.slice(1);
  } else if (assinante.length === 8 && primeiro >= "6" && primeiro <= "9") {
    // Formato antigo, ainda aparece em base legada.
    com9 = "9" + assinante;
    sem9 = assinante;
  } else {
    return null;
  }

  const principal = `+55${nacional.slice(0, 2)}${com9}`;
  const alternativo = `+55${nacional.slice(0, 2)}${sem9}`;

  return { principal, variantes: [principal, alternativo], tipo: "celular" };
}

/**
 * Normaliza e-mail.
 *
 * Deliberadamente conservador: NÃO remove pontos do Gmail nem corta o +tag.
 * Empresa que usa `vendas+cliente@dominio.com` para separar caixas teria
 * pessoas diferentes fundidas numa ficha só.
 */
export function normalizarEmail(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const e = String(bruto).trim().toLowerCase();
  // Validação frouxa de propósito: e-mail estranho de lead real é melhor
  // guardado do que descartado.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null;
  return e;
}

/**
 * Monta a lista de identidades de um lead, já normalizada e sem repetição.
 * É esta lista que vai para o SELECT em contact_identities.
 */
export function montarIdentidades(entrada: {
  telefone?: string | null;
  email?: string | null;
  waId?: string | null;
  fbLeadId?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  externalId?: string | null;
}): Identidade[] {
  const out: Identidade[] = [];
  const vistos = new Set<string>();

  const push = (tipo: TipoIdentidade, valor: string | null | undefined) => {
    if (!valor) return;
    const chave = `${tipo}:${valor}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    out.push({ tipo, valor });
  };

  const tel = normalizarTelefone(entrada.telefone);
  if (tel) for (const v of tel.variantes) push("phone", v);

  push("email", normalizarEmail(entrada.email));

  // wa_id chega da API como dígitos puros (ex.: 5511987654321). Passa pela
  // mesma normalização para colidir com o telefone do formulário.
  const wa = normalizarTelefone(entrada.waId);
  if (wa) {
    push("wa_id", wa.principal);
    for (const v of wa.variantes) push("phone", v);
  }

  push("fb_lead_id", entrada.fbLeadId?.trim());
  push("gclid", entrada.gclid?.trim());
  push("fbclid", entrada.fbclid?.trim());
  push("external_id", entrada.externalId?.trim());

  return out;
}

/**
 * SHA-256 em hexadecimal. Usado só no momento de enviar evento para Meta e
 * Google — o dado cru continua no banco, porque o vendedor precisa ligar.
 */
export async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Telefone hasheado para cada plataforma.
 *
 * ATENÇÃO à inversão que mais causa erro de match silencioso:
 *   Meta   → dígitos com DDI, SEM o "+"
 *   Google → E.164 completo, COM o "+"
 */
export async function hashTelefone(
  e164: string,
  destino: "meta" | "google",
): Promise<string> {
  const valor = destino === "meta" ? e164.replace(/\D/g, "") : e164;
  return await sha256(valor);
}

export async function hashEmail(email: string): Promise<string> {
  return await sha256(normalizarEmail(email) ?? email.trim().toLowerCase());
}
