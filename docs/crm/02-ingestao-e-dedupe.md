# 02 — Ingestão unificada e deduplicação

Toda origem de lead entra pelo **mesmo pipeline**. Não existe caminho especial para WhatsApp ou para
formulário: muda só o adaptador que traduz o payload do provedor para o formato canônico.

## 1. Formato canônico

Todo adaptador produz este objeto antes de qualquer escrita:

```jsonc
{
  "org_id":  "uuid",              // NUNCA vem do client; derivado da site_key ou do canal
  "source":  "whatsapp | site | landing_page | fb_lead_ads | ctwa | instagram | email | manual | importacao | api",
  "identities": [                 // pelo menos uma
    { "tipo": "phone",      "valor": "+5511987654321" },
    { "tipo": "email",      "valor": "joao@exemplo.com" },
    { "tipo": "fb_lead_id", "valor": "1234567890" }
  ],
  "contato": { "nome": "João Silva", "email": "...", "phone": "...", "custom": {} },
  "tracking": {                   // tudo opcional
    "utm_source": "google", "utm_medium": "cpc", "utm_campaign": "institucional",
    "utm_id": "21456789012", "utm_content": "701234567", "utm_term": "crm para vendas",
    "gclid": "...", "gbraid": null, "wbraid": null,
    "fbclid": "...", "fbp": "fb.1.1735000000.123", "fbc": "fb.1.1735000000.IwAR...",
    "ctwa_clid": null, "ad_external_id": "23851234567890123",
    "landing_url": "https://site.com.br/lp?gclid=...", "referrer": "https://google.com/"
  },
  "mensagem": { "corpo": "...", "provider_message_id": "..." },  // só canais de conversa
  "raw": { }                      // payload original, íntegro
}
```

## 2. Normalização — antes de qualquer busca

### Telefone → E.164

```
1. Remove tudo que não é dígito.
2. Sem DDI  → prefixa 55 (configurável por org).
3. Valida: 55 + DDD(2) + 8 ou 9 dígitos.
4. Gera AS DUAS variantes para celular:
     +55 11 9 8765 4321   (com o nono dígito)
     +55 11   8765 4321   (sem)
   Ambas viram linhas em contact_identities apontando para o MESMO contact_id.
5. contacts.phone_e164 recebe a variante COM o nono dígito (formato de discagem atual).
```

Sem o passo 4, o mesmo cliente que preencheu o formulário com um formato e chamou no WhatsApp com o outro
vira dois leads — e a venda é creditada ao canal errado.

### E-mail

`lower(trim())`. Sem remoção de pontos do Gmail e sem corte de `+tag`: são endereços que o vendedor
precisa ver como o cliente escreveu, e a agressividade aqui funde pessoas diferentes em empresas que usam
`nome+cliente@dominio.com`.

### Hashes

`contacts` guarda e-mail e telefone **em claro** — o vendedor precisa ligar. O SHA-256 exigido por
Meta e Google é gerado **no momento do envio**, nunca persistido no lugar do dado.

## 3. Algoritmo de ingestão

```
1. IDEMPOTÊNCIA
   hash = sha256(provider + payload canônico)
   INSERT INTO webhook_deliveries (provider, payload_hash, payload) ON CONFLICT DO NOTHING
   Se conflitou → já processamos. Retorna 200 e para. (Provider que reenvia é regra.)

2. RESOLVER CONTATO
   SELECT contact_id FROM contact_identities
    WHERE org_id = ? AND (tipo, valor) IN (identities normalizadas)
   ├─ 1 contato   → usa
   ├─ 0 contatos  → cria
   └─ N contatos  → o payload uniu duas fichas que já existiam separadas.
                    Escolhe o mais antigo como vencedor, funde os outros
                    (seção 5), registra em contact_merges.

3. ANEXAR IDENTIDADES novas ao contato (ON CONFLICT DO NOTHING).

4. GRAVAR TOUCHPOINT com todo o bloco `tracking`.
   Se veio anonymous_id, reatribui os touchpoints anônimos daquele cookie
   ao contact_id agora conhecido — é aqui que a jornada pré-identificação
   se cola à pessoa.

5. DECIDIR SOBRE O DEAL
   Existe deal ABERTO deste contato neste pipeline nos últimos
   orgs.dedupe_deal_janela_dias (padrão 30)?
   ├─ SIM → NÃO cria deal novo.
   │        Registra o touchpoint, adiciona nota na conversa e notifica o dono
   │        atual: "este lead voltou por {origem}".
   └─ NÃO → cria deal na primeira etapa do pipeline e distribui (seção 4).

6. CONVERSA (só canais de mensagem)
   UPSERT em conversations por (channel_id, contact_id).
   INSERT da mensagem — o UNIQUE em provider_message_id absorve reenvio.

7. ENFILEIRAR notificação push e automações com gatilho "lead criado".

8. MARCAR webhook_deliveries.processado_em = now().
```

O passo 5 é o que mais muda a percepção da equipe. Sem ele, o cliente que preenche a LP na segunda e o
formulário de contato na quinta aparece como dois leads no relatório e dois cards no kanban — e dois
vendedores diferentes ligam para a mesma pessoa.

## 4. Distribuição do lead novo

Configurável por pipeline:

| Modo | Regra |
|---|---|
| **Round-robin** | Rodízio entre vendedores ativos, ponderado por `profiles.peso_distribuicao` (0 tira do rodízio) |
| **Por carga** | Menor número de deals abertos |
| **Fila aberta** | `owner_id` fica nulo; a RLS torna o lead visível a todos e o primeiro que assumir leva |

Fora do horário comercial: cai na fila aberta e notifica o plantão. Lead que dorme sem dono até de manhã é
lead perdido.

## 5. Fusão de contatos

Automática quando o passo 2 encontra mais de um contato; manual pela tela de duplicados sugeridos
(mesmo telefone, mesmo e-mail, ou nome + empresa iguais).

```
vencedor = contato mais antigo (menor created_at)
1. Reaponta para o vencedor: contact_identities, deals, conversations, tasks,
   touchpoints, revenues, contact_companies.
2. Campos vazios no vencedor recebem o valor do perdedor. Campos preenchidos
   NÃO são sobrescritos.
3. contacts.tags = união dos dois.
4. perdedor.deleted_at = now()  (nunca DELETE)
5. INSERT em contact_merges com snapshot completo do perdedor.
```

O snapshot existe porque fusão errada acontece — dois irmãos com o mesmo telefone fixo, por exemplo — e
sem ele não há como desfazer.

## 6. Adaptadores por origem

| Origem | Entrada | Identidades extraídas | Observação |
|---|---|---|---|
| **uazapi** | Webhook do provedor | `wa_id`, `phone` | Valida token no header; ver [`05`](05-inbox-e-notificacoes.md) |
| **WABA Cloud API** | Webhook Meta (verify GET + POST) | `wa_id`, `phone` | Se vier `referral`, extrai `ctwa_clid` e `source_id` |
| **Formulário site/LP** | `POST /ingest/form` | `email`, `phone` | `org_id` derivado da `site_key`; ver [`03`](03-captura-web.md) |
| **Facebook Lead Ads** | Webhook `leadgen` → Graph API | `fb_lead_id`, `email`, `phone` | O `fb_lead_id` é o que dá match perfeito na devolução |
| **Webhook genérico** | `POST /ingest/webhook/:site_key` | conforme `sites.field_map` | Para LP em builder fechado |
| **Importação CSV** | Upload no admin | conforme mapeamento da tela | Passa pelo **mesmo** algoritmo, incluindo dedupe |
| **Manual** | Formulário do CRM | conforme preenchido | Avisa na hora se já existe contato com aquele telefone |

A importação CSV usar o mesmo caminho não é detalhe: importação é a maior fonte de duplicata em migração
de CRM, exatamente porque costuma ter um atalho próprio.

## 7. Erros e reprocessamento

- Falha no passo 2 em diante: `webhook_deliveries.erro` preenchido, `processado_em` fica nulo.
- O índice parcial `webhook_nao_processados_idx` sustenta a varredura de reprocessamento.
- Tela no admin lista as entregas não processadas com o payload cru e um botão de reprocessar.
- Como todo o pipeline é idempotente, reprocessar é seguro por construção.
