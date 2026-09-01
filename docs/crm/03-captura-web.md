# 03 — Captura em site, landing page e WordPress

## 1. São dois problemas, não um

| Problema | Quem resolve |
|---|---|
| Preservar **de onde veio** (UTM, gclid, fbclid) do clique até a submissão | `crm.js` — o tracker. Independe do formulário |
| **Receber a submissão** dentro do CRM | Adaptador de formulário — 5 modos (seção 3) |

Confundir os dois leva à conclusão errada de que é preciso substituir todos os formulários do site. Não é.

## 2. O tracker `crm.js`

### 2.1 O que captura

Na primeira visita, da query string e do contexto: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`,
`utm_content`, `utm_id`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`, `referrer`,
`landing_url`. Gera `anonymous_id`, deriva `_fbp` e monta `_fbc` no formato `fb.1.<timestamp>.<fbclid>` —
os dois são exigidos pelo CAPI para um Event Match Quality utilizável.

Guarda **first-touch** (nunca sobrescreve) e **last-touch** (sempre atualiza) como registros separados em
`touchpoints`.

### 2.2 A armadilha do cookie

> O cookie **não pode** ser criado por `document.cookie`.

O ITP do Safari corta cookie escrito por JavaScript em **7 dias** — e em **24 horas** quando a URL de
entrada carrega um parâmetro reconhecido como rastreamento cross-site, que é exatamente o caso de toda
landing page com `gclid` ou `fbclid`.

Com ciclo comercial de 30 dias, a consequência prática: a venda aparece como "direto/orgânico" e a
campanha que a gerou apanha no relatório sem ter feito nada errado.

**Correção:** `/ingest/track` responde a partir de um **subdomínio próprio** e devolve o cookie pelo
header HTTP:

```
Set-Cookie: _crm_aid=<uuid>; Domain=.seudominio.com.br; Path=/;
            Max-Age=7776000; HttpOnly; Secure; SameSite=Lax
```

Cookie de primeira parte setado pelo servidor não sofre o corte de 7 dias. Isso torna o subdomínio um
**requisito de infraestrutura**, não um detalhe de implementação:

```
t.seudominio.com.br  →  CNAME/proxy para a Edge Function /ingest/track
```

O `HttpOnly` impede que o `crm.js` leia o cookie — de propósito. O tracker não precisa ler: ele envia os
dados e o servidor correlaciona pelo cookie que já viaja na requisição.

### 2.3 Implementação de referência

```html
<!-- Antes de </body>, em TODAS as páginas do site e das LPs -->
<script src="https://t.seudominio.com.br/crm.js" data-site-key="PUBLIC_SITE_KEY" defer></script>
```

```js
// crm.js — referência. ~4kb minificado, sem dependências.
(function () {
  var S = document.currentScript;
  var ENDPOINT = new URL(S.src).origin;
  var SITE_KEY = S.dataset.siteKey;

  var TRACK_KEYS = [
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id',
    'gclid','gbraid','wbraid','fbclid','msclkid','ttclid'
  ];

  function params() {
    var q = new URLSearchParams(location.search), out = {};
    TRACK_KEYS.forEach(function (k) { if (q.get(k)) out[k] = q.get(k); });
    return out;
  }

  // _fbc precisa ser construído a partir do fbclid; a Meta não entrega pronto.
  function fbc(p) {
    var existing = (document.cookie.match(/_fbc=([^;]+)/) || [])[1];
    if (existing) return decodeURIComponent(existing);
    return p.fbclid ? 'fb.1.' + Date.now() + '.' + p.fbclid : null;
  }
  function fbp() {
    return (document.cookie.match(/_fbp=([^;]+)/) || [])[1] || null;
  }

  var tracking = params();
  tracking.fbc = fbc(tracking);
  tracking.fbp = fbp();
  tracking.landing_url = location.href;
  tracking.referrer = document.referrer || null;

  // credentials:'include' é o que faz o cookie server-side ir e voltar.
  function send(path, body) {
    return fetch(ENDPOINT + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ site_key: SITE_KEY }, body)),
      keepalive: true            // sobrevive ao unload da página
    });
  }

  send('/ingest/track', { tipo: 'pageview', tracking: tracking });

  // ---- MODO B: intercepta qualquer formulário da página ----
  // Não substitui o comportamento do form: deixa o envio original seguir e
  // manda uma cópia para o CRM. Assim nada que já funciona quebra.
  document.addEventListener('submit', function (ev) {
    var form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.hasAttribute('data-crm-ignore')) return;

    var campos = {};
    new FormData(form).forEach(function (v, k) {
      if (typeof v === 'string') campos[k] = v;
    });

    // Honeypot: campo escondido que só bot preenche.
    if (campos._crm_hp) return;

    send('/ingest/form', {
      tracking: tracking,
      campos: campos,
      form_id: form.id || form.getAttribute('name') || null,
      pagina: location.href,
      // Tempo de preenchimento: menos de 2s é bot. O servidor decide.
      ms_preenchimento: Date.now() - inicio
    });
  }, true);   // fase de captura: roda antes do handler do builder

  var inicio = Date.now();
})();
```

## 3. Os cinco modos de receber a submissão

Todos terminam no **mesmo** `/ingest/form` e no mesmo algoritmo de dedupe do [`02`](02-ingestao-e-dedupe.md).

| Modo | Quando | Como | Robustez |
|---|---|---|---|
| **A. Hidden fields** | Form já entrega os dados onde você controla | `crm.js` injeta inputs ocultos | Frágil — depende do destino repassar |
| **B. Intercept + POST** ⭐ | **Padrão** | `crm.js` copia o submit para o CRM | Boa — qualquer builder, sem plugin |
| **C. Plugin WordPress** ⭐ | Sites WordPress | Hooks nativos enviam server-side | Máxima — imune a adblock e ITP |
| **D. Formulário nativo** | LP nova, sem builder | Snippet gerado no admin | Boa |
| **E. Webhook genérico** | Builder fechado (RD Station LP, Klickpages) | `sites.field_map` traduz os campos | Média — raramente repassa click-ids |

**Recomendação: B como padrão, mais C nos WordPress.** B e D perdem de 5% a 15% do volume para
bloqueadores de anúncio; C não perde, porque sai do servidor. Rodar os dois juntos é seguro — o dedupe
absorve a duplicata.

### Por que não um gerador de formulários como caminho principal

Os sites já têm formulário funcionando, com design e conversão medida. Trocar por um formulário genérico
mexe em layout e taxa de conversão e **não resolve nada** que o modo B não resolva com um script de 4kb.
Um gerador de formulários é um produto inteiro — validação, anti-spam, responsivo, acessibilidade,
multi-step, campos condicionais, versionamento, teste A/B — e nada disso avança a unificação de leads.

Ele passa a valer quando você quiser **impor campos de qualificação padronizados** (orçamento, prazo,
cargo) em todas as origens para alimentar o score de MQL. Por isso entra como modo D na Fase 3, sobre o
mesmo endpoint: nada precisa ser refeito para adicioná-lo depois.

## 4. Contrato do `/ingest/form`

```http
POST https://t.seudominio.com.br/ingest/form
Content-Type: application/json
Origin: https://www.seudominio.com.br
Cookie: _crm_aid=...
```

```jsonc
{
  "site_key": "a1b2c3...",
  "form_id": "contato-home",
  "pagina": "https://www.seudominio.com.br/contato",
  "ms_preenchimento": 18420,
  "campos": { "nome": "João", "email": "joao@ex.com", "telefone": "(11) 98765-4321" },
  "tracking": { "utm_source": "google", "gclid": "...", "fbc": "...", "fbp": "..." }
}
```

Resposta `202 Accepted` — sempre. O endpoint grava em `webhook_deliveries` e enfileira; nunca processa em
linha, e nunca revela ao chamador se o lead era duplicado (isso vazaria a base para quem tem a `site_key`,
que é pública).

### Mapeamento dos campos

`sites.field_map` traduz nomes de campo para o formato canônico. Se estiver vazio, vale a heurística:
qualquer campo cujo nome contenha `mail` vira e-mail; `fone`/`phone`/`whats`/`tel` vira telefone;
`nome`/`name` vira nome. Todo campo não reconhecido vai íntegro para `contacts.custom`.

Nada é descartado por não ser reconhecido — o campo desconhecido de hoje é a pergunta de qualificação de
amanhã.

## 5. Proteção do endpoint público

A `site_key` é pública: está no HTML. Ela **identifica**, não autentica. A segurança real:

| Camada | Regra |
|---|---|
| **Allowlist de domínio** | `Origin` do header conferido contra `sites.dominios`. Não bate → 403 |
| **Rate limit** | Por IP e por `site_key`. Padrão: 30 submissões/min |
| **Honeypot** | Campo `_crm_hp` oculto por CSS. Preenchido → descarta em silêncio (200) |
| **Tempo mínimo** | `ms_preenchimento < 2000` → marca `suspeito`, entra em quarentena para revisão |
| **Turnstile** | Cloudflare Turnstile opcional por site, nas LPs que atraem spam |
| **`org_id`** | **Nunca** vem do client. Derivado da `site_key` no servidor |

Bot descartado em silêncio com 200 é deliberado: um 403 informa ao spammer que a proteção existe e ele
ajusta o script.

## 6. Plugin WordPress (modo C)

Server-side, imune a adblock. Um arquivo, sem dependências.

```php
<?php
/**
 * Plugin Name: CRM Lead Bridge
 * Description: Envia leads dos formulários do site para o CRM, server-side.
 */
defined('ABSPATH') || exit;

function crm_enviar_lead(array $campos, string $form_id = ''): void {
    $payload = [
        'site_key'  => get_option('crm_site_key'),
        'form_id'   => $form_id,
        'pagina'    => wp_get_referer() ?: home_url(),
        'campos'    => $campos,
        // O cookie do tracker viaja até aqui: é ele que liga esta submissão
        // server-side à sessão que trouxe o gclid/fbclid.
        'anonymous_id' => $_COOKIE['_crm_aid'] ?? null,
    ];

    wp_remote_post(get_option('crm_endpoint') . '/ingest/form', [
        'timeout'  => 5,
        'blocking' => false,          // não segura o thank-you page do visitante
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode($payload),
    ]);
}

// Contact Form 7
add_action('wpcf7_mail_sent', function ($form) {
    $d = WPCF7_Submission::get_instance();
    if ($d) crm_enviar_lead($d->get_posted_data(), 'cf7-' . $form->id());
});

// Elementor Pro
add_action('elementor_pro/forms/new_record', function ($record) {
    $campos = [];
    foreach ($record->get('fields') as $k => $f) $campos[$k] = $f['value'];
    crm_enviar_lead($campos, 'elementor-' . $record->get_form_settings('form_name'));
}, 10, 1);

// WPForms
add_action('wpforms_process_complete', function ($fields, $entry, $form_data) {
    $campos = [];
    foreach ($fields as $f) $campos[$f['name'] ?: $f['id']] = $f['value'];
    crm_enviar_lead($campos, 'wpforms-' . $form_data['id']);
}, 10, 3);

// Gravity Forms
add_action('gform_after_submission', function ($entry, $form) {
    $campos = [];
    foreach ($form['fields'] as $f) $campos[$f->label] = rgar($entry, (string) $f->id);
    crm_enviar_lead($campos, 'gform-' . $form['id']);
}, 10, 2);
```

`'blocking' => false` importa: sem ele, uma lentidão do CRM vira lentidão na página de obrigado do
visitante.

## 7. O que configurar nas plataformas

Sem isso o tracker não tem o que capturar.

### Google Ads

Auto-tagging **ligado** (é o que gera o `gclid`). Tracking template na conta:

```
{lpurl}?utm_source=google&utm_medium=cpc&utm_id={campaignid}&utm_campaign={campaignname}&utm_content={creative}&utm_term={keyword}&matchtype={matchtype}&device={device}
```

### Meta

Campo **Parâmetros de URL**, no **nível do anúncio**. Sem `?` inicial — a Meta adiciona o separador. Não
há herança entre níveis de campanha/conjunto/anúncio: use edição em massa para aplicar.

```
utm_source=facebook&utm_medium=paid_social&utm_id={{campaign.id}}&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_term={{adset.id}}&placement={{placement}}
```

Se os tokens forem colados no campo de **URL do site** em vez do campo de parâmetros, eles não são
substituídos e aparecem literalmente na barra de endereço do visitante.

> **Grave sempre o ID, não só o nome.** `utm_id={campaignid}` no Google e `{{campaign.id}}` na Meta.
> Nome de campanha é renomeado o tempo todo e, quando isso acontece, o histórico se parte em duas
> campanhas diferentes no relatório. O nome serve para leitura humana; o ID é a chave de join com
> `ad_entities.external_id`.

## 8. Teste de aceite

1. Abrir a LP com `?gclid=teste123&utm_source=google` — conferir linha em `touchpoints` com `gclid`
   preenchido e cookie `_crm_aid` presente na resposta HTTP (não em `document.cookie`).
2. Submeter o formulário — conferir contato criado e touchpoint reatribuído do `anonymous_id` para o
   `contact_id`.
3. Submeter de novo com o mesmo e-mail — conferir que **não** nasce contato novo nem deal novo.
4. **Safari:** abrir a LP com `?gclid=teste123`, fechar, voltar 8 dias depois e confirmar que o
   `anonymous_id` sobreviveu. É o teste que separa cookie server-side de cookie de JavaScript — no Chrome
   os dois passam, e é por isso que o problema só aparece em produção.
