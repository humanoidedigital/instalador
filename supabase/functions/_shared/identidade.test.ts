/**
 * Testes da normalização de identidades.
 *
 * Rodar:  node --experimental-strip-types supabase/functions/_shared/identidade.test.ts
 *
 * Os casos vieram de formatos que aparecem de verdade em formulário de site,
 * webhook de WhatsApp e planilha de importação no Brasil.
 */
import {
  normalizarTelefone,
  normalizarEmail,
  montarIdentidades,
  hashTelefone,
  hashEmail,
} from "./identidade.ts";

let passou = 0;
let falhou = 0;

function ok(nome: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) {
    passou++;
  } else {
    falhou++;
    console.log(`  FALHOU  ${nome}\n          esperado: ${b}\n          obtido:   ${a}`);
  }
}

console.log("\n== telefone: formatos que chegam do mundo real ==");
for (const [entrada, esperado] of [
  ["(11) 98765-4321", "+5511987654321"],
  ["11987654321", "+5511987654321"],
  ["+55 11 98765-4321", "+5511987654321"],
  ["5511987654321", "+5511987654321"],
  ["011 98765-4321", "+5511987654321"],
  ["11 8765-4321", "+5511987654321"],   // formato antigo, sem o 9
  ["005511987654321", "+5511987654321"],
] as const) {
  ok(entrada, normalizarTelefone(entrada)?.principal, esperado);
}

console.log("\n== o nono dígito: as duas grafias apontam pra mesma pessoa ==");
const comNove = normalizarTelefone("+5511987654321");
const semNove = normalizarTelefone("+551187654321");
ok("com 9 gera as duas variantes", comNove?.variantes, ["+5511987654321", "+551187654321"]);
ok("sem 9 gera as duas variantes", semNove?.variantes, ["+5511987654321", "+551187654321"]);
ok("as duas grafias colidem", comNove?.variantes[0] === semNove?.variantes[0], true);

console.log("\n== fixo nunca ganha o nono dígito ==");
const fixo = normalizarTelefone("(11) 3255-4321");
ok("fixo é reconhecido", fixo?.tipo, "fixo");
ok("fixo tem uma variante só", fixo?.variantes, ["+551132554321"]);

console.log("\n== números que devem ser recusados ==");
for (const ruim of ["", "abc", "987654321", "1198765", "(00) 98765-4321", "+5510987654321"]) {
  ok(`recusa "${ruim}"`, normalizarTelefone(ruim), null);
}

console.log("\n== DDD precisa existir ==");
ok("DDD 11 vale", normalizarTelefone("11987654321") !== null, true);
ok("DDD 20 não existe", normalizarTelefone("20987654321"), null);
ok("DDD 23 não existe", normalizarTelefone("23987654321"), null);

console.log("\n== internacional passa sem variante ==");
const pt = normalizarTelefone("+351912345678");
ok("Portugal aceito", pt?.principal, "+351912345678");
ok("sem variante de nono dígito", pt?.variantes.length, 1);

console.log("\n== e-mail ==");
ok("minúsculo e sem espaço", normalizarEmail("  Joao@Exemplo.COM "), "joao@exemplo.com");
ok("mantém o +tag", normalizarEmail("vendas+cliente@dominio.com"), "vendas+cliente@dominio.com");
ok("mantém pontos do gmail", normalizarEmail("j.o.a.o@gmail.com"), "j.o.a.o@gmail.com");
ok("recusa inválido", normalizarEmail("joao@"), null);
ok("recusa vazio", normalizarEmail(""), null);

console.log("\n== caso real: lead do site e depois no WhatsApp ==");
// Dia 1: formulário da LP, telefone digitado COM o nono dígito, com gclid.
const doSite = montarIdentidades({
  telefone: "(11) 98765-4321",
  email: "Mariana@Clinica.com.br",
  gclid: "Cj0KCQjwTESTE",
});
// Dia 4: webhook do WhatsApp, wa_id SEM o nono dígito.
const doWhats = montarIdentidades({ waId: "551187654321" });

const chavesSite = doSite.filter((i) => i.tipo === "phone").map((i) => i.valor);
const chavesWhats = doWhats.filter((i) => i.tipo === "phone").map((i) => i.valor);
const cruzam = chavesSite.some((c) => chavesWhats.includes(c));
ok("as duas origens compartilham identidade de telefone", cruzam, true);
ok("site guardou o gclid", doSite.some((i) => i.tipo === "gclid"), true);
ok("site guardou o e-mail normalizado",
   doSite.find((i) => i.tipo === "email")?.valor, "mariana@clinica.com.br");

console.log("\n== identidades não se repetem ==");
const repetido = montarIdentidades({ telefone: "11987654321", waId: "5511987654321" });
const valores = repetido.map((i) => `${i.tipo}:${i.valor}`);
ok("sem duplicata na lista", valores.length, new Set(valores).size);

console.log("\n== hash: Meta sem '+', Google com '+' ==");
const hMeta = await hashTelefone("+5511987654321", "meta");
const hGoogle = await hashTelefone("+5511987654321", "google");
ok("Meta e Google produzem hashes diferentes", hMeta !== hGoogle, true);
ok("hash tem 64 caracteres hex", /^[0-9a-f]{64}$/.test(hMeta), true);
// Valor fixo de referência: sha256("5511987654321"), conferido fora do código.
// Se a normalização do telefone mudar, este teste quebra — que é o objetivo.
ok("hash Meta bate com o sha256 dos dígitos puros", hMeta,
   "029c7290f14c4516673508635f0519db95f7daf42057fd0e4ad1de84c5408a66");
const hEmail = await hashEmail("  Joao@Exemplo.COM ");
const hEmail2 = await hashEmail("joao@exemplo.com");
ok("hash de e-mail normaliza antes", hEmail, hEmail2);

console.log(`\n${"=".repeat(46)}`);
console.log(`  ${passou} passaram · ${falhou} falharam`);
console.log(`${"=".repeat(46)}\n`);
if (falhou > 0) process.exit(1);
