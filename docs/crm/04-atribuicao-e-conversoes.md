# 04 — Atribuição e devolução de conversões

O objetivo é fechar o laço: a plataforma de anúncio aprende quais leads viraram dinheiro, não quais
preencheram formulário.

## 1. Atribuição por canal

### Site e landing page
Ver [`03-captura-web.md`](03-captura-web.md).

### Click-to-WhatsApp (CTWA)

O webhook de mensagem da WABA traz um bloco `referral` quando a conversa nasceu de um anúncio:

```jsonc
{
  "referral": {
    "source_type": "ad",
    "source_id": "23851234567890123",     // ID do anúncio -> ad_entities.external_id
    "ctwa_clid": "AfeQm1...",             // identificador do clique
    "headline": "Fale com um especialista"
  }
}
```

Isso é melhor que link mágico com código no texto: não depende de o lead manter a mensagem
pré-preenchida, e o `ctwa_clid` é aceito pela Meta na devolução do evento.

### Facebook Lead Ads

```
Webhook leadgen (leadgen_id) → GET /v{ver}/{leadgen_id} na Graph API → campos do formulário
```

Guarda `fb_lead_id` em `contact_identities`. É o identificador de match mais forte que existe para lead
da Meta: dispensa hash de e-mail e telefone.

### Lead que entra pelo site e continua no WhatsApp

Padrão na operação brasileira, e o caso que mais distorce relatório quando não é tratado:

```
Dia 1  LP com gclid  → contato criado, identity phone + gclid
Dia 4  WhatsApp      → identity phone JÁ EXISTE → mesmo contato
Dia 12 venda         → conversão devolvida ao Google com o gclid do dia 1
```

Sem o stitching por telefone, a venda vira "WhatsApp orgânico" e a campanha do Google fica sem crédito.

## 2. Modelos de atribuição

`attribution_snapshots` é recalculado quando o deal muda de etapa ou fecha:

| Modelo | Regra | Uso |
|---|---|---|
| `first_touch` | Primeiro touchpoint do contato | Qual campanha **descobre** cliente |
| `last_touch` | Último antes da criação do deal | Qual campanha **fecha** |
| `linear` | Peso `1/n` entre todos | Visão de contribuição |

Os três coexistem. A devolução para as plataformas usa **os identificadores originais** (gclid, fbclid,
lead_id), não o modelo escolhido — cada plataforma aplica o modelo dela.

## 3. Devolução — mecânica comum

```
UPDATE deals SET stage_id = ...
   │  (mesma transação, via trigger app.on_deal_stage_change)
   ├──► INSERT deal_stage_events
   └──► INSERT conversion_events_outbox  (ON CONFLICT DO NOTHING)
              │
              │  worker, a cada minuto
              ▼
        seleciona status='pendente' AND proxima_tentativa_em <= now()
              ├── sucesso → status='enviado', enviado_em=now()
              └── falha   → tentativas+1, backoff exponencial
                            (1min, 5min, 25min, 2h, 10h; 5 tentativas → 'falhou')
```

O `UNIQUE (destination_id, dedupe_key)` com `dedupe_key = deal_id + ':' + event_name` garante que um deal
que volta de etapa e avança de novo **não** conte a conversão duas vezes.

### Configuração no admin

`conversion_destinations` é a tela que responde "posso setar outros objetivos": por pipeline, define qual
etapa (ou qual **categoria** de etapa) dispara qual evento, em qual destino, com qual valor.

| Campo | Efeito |
|---|---|
| `stage_id` ou `categoria` | Gatilho. `categoria` sobrevive a renomeação de etapa |
| `event_name` | Nome enviado à plataforma |
| `valor_modo` | `deal` (usa `deals.valor`), `fixo`, ou `nenhum` |

> **Escolha do evento principal de otimização:** a etapa que de **1/3 a 1/2** dos leads alcança. Otimizar
> direto em "venda ganha" costuma matar de fome o algoritmo em operação de volume médio — poucos eventos
> por semana e o aprendizado não sai do lugar.

## 4. Meta — Conversions API

```http
POST https://graph.facebook.com/v{VERSAO}/{DATASET_ID}/events
Content-Type: application/json
```

```jsonc
{
  "data": [{
    "event_name": "SQL",
    "event_time": 1756704000,
    "action_source": "system_generated",
    "event_id": "<dedupe_key>",
    "user_data": {
      "em":  ["<sha256(lower(trim(email)))>"],
      "ph":  ["<sha256(digitos do telefone com DDI, sem + nem espaços)>"],
      "fn":  ["<sha256(lower(primeiro nome))>"],
      "ln":  ["<sha256(lower(sobrenome))>"],
      "fbc": "fb.1.1735000000.IwAR...",
      "fbp": "fb.1.1735000000.123456789",
      "lead_id": 1234567890
    },
    "custom_data": { "value": 5000.00, "currency": "BRL" }
  }],
  "access_token": "<do Vault, nunca no client>"
}
```

Regras que decidem se isso funciona ou não:

- **`action_source`**: `system_generated` para evento de CRM. Use `business_messaging` quando a origem foi
  CTWA — a Meta trata a atribuição de mensageria por um caminho diferente.
- **`lead_id`** (numérico, sem hash) sozinho já dá match perfeito em lead vindo de Lead Ads. Quando existe,
  é o identificador mais forte disponível.
- **`fbc`** é o item mais importante para lead de site. Sem ele o match despenca. É construído a partir do
  `fbclid` no momento da visita — ver [`03`](03-captura-web.md).
- **`event_id`** igual ao `dedupe_key` permite à Meta desduplicar contra o Pixel, caso o mesmo evento
  também dispare no navegador.
- **Hash:** SHA-256 em minúsculas, sem espaços nas pontas. Telefone só dígitos, com DDI, **sem** `+`.
- **Meta de qualidade:** Event Match Quality **≥ 8**. Abaixo de 6 a maior parte dos eventos não conecta a
  ninguém e o laço vaza inteiro. É a métrica a monitorar depois de ligar.

### Eventos sugeridos

| Etapa | `event_name` | Valor |
|---|---|---|
| Lead criado | `Lead` | nenhum |
| Qualificado por marketing | `MQL` | nenhum |
| Qualificado por vendas | `SQL` | nenhum |
| Reunião agendada | `ReuniaoAgendada` | fixo (valor médio esperado) |
| Orçamento enviado | `Orcamento` | `deals.valor` |
| Ganho | `Purchase` | `deals.valor` |

## 5. Google — Data Manager API

> **O upload pela Google Ads API foi bloqueado em 15/06/2026.** Conversões offline e enhanced conversions
> for leads passaram para a **Data Manager API**. Qualquer material que aponte para `OfflineUserDataJob`
> na Google Ads API está desatualizado e não vai funcionar.

```http
POST https://datamanager.googleapis.com/v1/events:ingest
Authorization: Bearer <OAuth2>
Content-Type: application/json
```

```jsonc
{
  "destinations": [{
    "operatingAccount": { "product": "GOOGLE_ADS", "accountId": "1234567890" },
    // ID de uma conversion action do tipo UPLOAD_CLICKS. Não é o ID da campanha.
    "productDestinationId": "987654321"
  }],
  "events": [{
    "transactionId": "<dedupe_key>",
    "eventTimestamp": "2026-09-01T14:30:00Z",
    "lastUpdatedTimestamp": "2026-09-01T14:30:00Z",
    "adIdentifiers": {
      "gclid": "Cj0KCQjw...",
      "gbraid": null,
      "wbraid": null
    },
    "userData": {
      "userIdentifiers": [
        { "emailAddress": "<sha256(email normalizado)>" },
        { "phoneNumber":  "<sha256(telefone E.164 COM o +)>" }
      ]
    },
    "conversionValue": 5000.00,
    "currency": "BRL",
    "consent": { "adUserData": "CONSENT_GRANTED", "adPersonalization": "CONSENT_GRANTED" }
  }]
}
```

Diferenças em relação à Meta que costumam causar erro silencioso:

- **`productDestinationId`** precisa ser uma conversion action **`UPLOAD_CLICKS`**. Apontar para uma ação
  de conversão de site aceita a requisição e não credita nada.
- **Telefone com `+`** antes do hash (E.164 completo). A Meta quer **sem** `+`. É a inversão que mais gera
  bug de match.
- **`gbraid` / `wbraid`** substituem o `gclid` em tráfego iOS de campanhas de app. Envie o que existir;
  nunca os três.
- **`consent`** é obrigatório no EEA e recomendado sempre. Preencha a partir de `contacts.consentimento`.
- Enviar `gclid` **e** identificadores hasheados juntos melhora a performance — é o modo *enhanced
  conversions for leads*, não uma alternativa a ele.

## 6. Segurança e LGPD

- Credenciais (`access_token` da Meta, refresh token do Google) no **Supabase Vault**. `channels.config` e
  `conversion_destinations.config` guardam apenas o **nome** do secret.
- Hash gerado no envio, nunca persistido no lugar do dado cru.
- `contacts.opt_out = true` **bloqueia a devolução**: quem pediu para sair não é enviado a terceiro.
- `conversion_events_outbox.payload` guarda o corpo enviado **já hasheado**, para auditoria sem expor PII.
- IP em `touchpoints.ip_hash`, nunca em claro.

## 7. Teste de aceite

1. Criar deal de teste com `gclid` e e-mail conhecidos; mover para a etapa mapeada.
2. Conferir linha `pendente` em `conversion_events_outbox` com `dedupe_key` correto.
3. Rodar o worker e conferir `status='enviado'` e a resposta gravada.
4. **Meta:** o evento aparece em *Gerenciador de Eventos → Testar eventos*; conferir o Event Match Quality.
5. **Google:** a conversion action mostra conversão importada em até 3h (o painel tem atraso próprio; não
   conclua que falhou antes disso).
6. Mover o deal para trás e para a frente de novo → **nenhuma** linha nova no outbox.
