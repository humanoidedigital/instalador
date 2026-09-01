/**
 * crm.js — rastreamento de origem para site e landing page.
 *
 * Instalação (todas as páginas, antes de </body>):
 *   <script src="https://t.seudominio.com.br/crm.js" data-site-key="SUA_CHAVE" defer></script>
 *
 * O que faz:
 *   1. Guarda de onde a visita veio (UTM, gclid, fbclid) já na primeira página.
 *   2. Manda uma cópia de qualquer formulário enviado para o CRM — sem
 *      atrapalhar o envio original do site.
 *
 * ATENÇÃO ao cookie: quem cria o `_crm_aid` é o SERVIDOR, na resposta do
 * /ingest/track, e não este script. O ITP do Safari corta cookie escrito por
 * JavaScript em 7 dias — e em 24 horas quando a URL de entrada tem gclid ou
 * fbclid, que é o caso de toda landing page de campanha. Cookie de primeira
 * parte devolvido no cabeçalho Set-Cookie não sofre esse corte.
 * Por isso o endpoint precisa responder de um subdomínio seu.
 *
 * Ver docs/crm/03-captura-web.md
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var SITE_KEY = script.getAttribute("data-site-key");
  if (!SITE_KEY) return;

  var ENDPOINT = new URL(script.src).origin;
  var inicio = Date.now();

  var CHAVES = [
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
    "gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"
  ];

  function lerCookie(nome) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + nome + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function parametrosDaUrl() {
    var q, out = {};
    try { q = new URLSearchParams(location.search); } catch (e) { return out; }
    CHAVES.forEach(function (k) {
      var v = q.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  var tracking = parametrosDaUrl();

  // O _fbc não vem pronto da Meta: é construído a partir do fbclid no momento
  // da visita. Sem ele o match do CAPI despenca para lead de site.
  var fbcExistente = lerCookie("_fbc");
  tracking.fbc = fbcExistente || (tracking.fbclid ? "fb.1." + Date.now() + "." + tracking.fbclid : null);
  tracking.fbp = lerCookie("_fbp");
  tracking.landing_url = location.href;
  tracking.referrer = document.referrer || null;

  function enviar(caminho, corpo) {
    corpo.site_key = SITE_KEY;
    var json = JSON.stringify(corpo);

    // keepalive garante a entrega mesmo se a página for embora logo depois
    // (que é exatamente o que acontece ao enviar formulário).
    if (window.fetch) {
      try {
        return fetch(ENDPOINT + caminho, {
          method: "POST",
          credentials: "include",   // faz o cookie de 1ª parte ir e voltar
          headers: { "Content-Type": "application/json" },
          body: json,
          keepalive: true
        })["catch"](function () { /* rastreamento nunca quebra a página */ });
      } catch (e) { /* cai no XHR abaixo */ }
    }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", ENDPOINT + caminho, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send(json);
    } catch (e) { /* silêncio */ }
  }

  // ---- visita ------------------------------------------------------------
  enviar("/ingest/track", { tipo: "pageview", tracking: tracking });

  // ---- formulários -------------------------------------------------------
  // Fase de captura (true) para rodar antes do handler do construtor de
  // página. Não cancela nem altera o envio original: o site continua fazendo
  // o que já fazia, e o CRM recebe uma cópia.
  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form || form.nodeName !== "FORM") return;
    if (form.hasAttribute("data-crm-ignore")) return;

    var campos = {};
    try {
      new FormData(form).forEach(function (valor, chave) {
        if (typeof valor === "string" && valor.length < 5000) campos[chave] = valor;
      });
    } catch (e) { return; }

    // Honeypot: se o campo escondido veio preenchido, quem enviou foi robô.
    // O servidor decide o que fazer; aqui só repassamos.
    enviar("/ingest/form", {
      tracking: tracking,
      campos: campos,
      form_id: form.id || form.getAttribute("name") || null,
      pagina: location.href,
      ms_preenchimento: Date.now() - inicio
    });
  }, true);
})();
