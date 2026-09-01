# 07 — Roadmap, dependências e critérios de aceite

## Fases

| Fase | Escopo | Estimativa | Depende de |
|---|---|---|---|
| **F0** | Projeto Supabase, `schema.sql` aplicado, RLS, auth, shell do PWA, deploy | 1–2 sem | — |
| **F1** | Ingestão unificada + dedupe + contatos/deals + kanban + inbox uazapi/WABA | 2–3 sem | F0 |
| **F2** | Tracker `crm.js` + subdomínio de cookie, `/ingest/form`, plugin WordPress, touchpoints, CTWA, Facebook Lead Ads | 2 sem | F1 |
| **F3** | Tarefas + Web Push + onboarding iOS · formulário nativo (modo D) e webhook genérico (modo E) | 1–2 sem | F1 |
| **F4** | Outbox de conversões → Meta CAPI + Google Data Manager API + tela de mapeamento | 1–2 sem | F2 |
| **F5** | Sync de custo de mídia + KPIs + DRE | 2 sem | F2, F4 |
| **F6** | Motor de automações (WhatsApp / e-mail / SMS) | 2 sem | F1, F3 |

F2 e F3 são independentes entre si e podem correr em paralelo com equipes separadas. F4 depende de F2
porque não há o que devolver sem click-id capturado. F5 depende de F4 para o recorte por campanha.

## Critérios de aceite

### F0 — Fundação
- [ ] `schema.sql` aplicado no Supabase sem erro
- [ ] Vendedor autenticado **não** lê deal de outro vendedor (testado com JWT real, não como superuser)
- [ ] PWA instala em Android, iOS, Windows e macOS
- [ ] `mv_dre_mensal` agendada no `pg_cron`

### F1 — Núcleo comercial
- [ ] Mensagem no uazapi cria contato, conversa e deal
- [ ] Reenvio do mesmo webhook **não** duplica (testar reenviando o payload cru)
- [ ] Telefone com e sem o nono dígito resolve para o **mesmo** contato
- [ ] Segundo contato do mesmo lead em 30 dias **não** cria deal novo
- [ ] Kanban move deal e grava `deal_stage_events` com duração
- [ ] Fora da janela de 24h, a WABA só permite template

### F2 — Rastreamento
- [ ] LP com `?gclid=x` grava `touchpoints` com o `gclid`
- [ ] Cookie `_crm_aid` vem no header `Set-Cookie`, **não** em `document.cookie`
- [ ] **Safari:** `anonymous_id` sobrevive a 8 dias (o teste que separa cookie server-side de cookie JS)
- [ ] Formulário do WordPress chega pelos dois caminhos (B e C) sem gerar lead duplicado
- [ ] Mensagem CTWA grava `ctwa_clid` e `ad_external_id`
- [ ] Lead do Facebook Lead Ads grava `fb_lead_id` em `contact_identities`

### F3 — Tarefas e push
- [ ] Push chega em Android, Windows e macOS
- [ ] Push chega em iOS **depois** de adicionar à Tela de Início
- [ ] Onboarding de iOS aparece automaticamente no primeiro login em iPhone
- [ ] Assinatura revogada (410) marca `user_devices.ativo=false`
- [ ] Lembrete de tarefa dispara uma única vez, mesmo com o worker rodando de novo

### F4 — Conversões
- [ ] Mudança de etapa mapeada enfileira no outbox com `dedupe_key` correto
- [ ] Ida e volta entre etapas **não** duplica o evento
- [ ] Evento aparece no Gerenciador de Eventos da Meta com **Event Match Quality ≥ 8**
- [ ] Conversão importada aparece na conversion action `UPLOAD_CLICKS` do Google
- [ ] `contacts.opt_out = true` bloqueia a devolução
- [ ] Falha na API entra em backoff e não perde o evento

### F5 — Relatórios
- [ ] Custo de mídia bate com o painel da Meta e do Google (tolerância de 1%, câmbio e fuso)
- [ ] Soma de custo filtra `nivel='campanha'` (conferir que não triplicou)
- [ ] CPL, custo por MQL/SQL/reunião calculados e conferidos à mão num mês fechado
- [ ] DRE fecha contra a planilha atual da operação
- [ ] `v_dre_mensal` não vaza dado de outra org

### F6 — Automações
- [ ] Automação dispara uma vez por gatilho (`dedupe_key`)
- [ ] Guardas respeitadas: teto diário, horário comercial, parar se o lead responder
- [ ] `contacts.opt_out` interrompe a sequência
- [ ] Passo `esperar` sobrevive a restart do worker

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Ban do número no uazapi** | Alto — canal principal fora do ar | Rate limit + jitter, WABA em paralelo como caminho oficial, alerta de queda de canal. **Não se elimina com arquitetura**: é risco inerente a API não-oficial |
| **Adesão do PWA no iOS** | Alto — vendedor não recebe lead | Onboarding obrigatório, medição de `user_devices.plataforma`, fallback por e-mail/gestor. Plano B: app Expo sobre o mesmo backend |
| **Custo WhatsApp a partir de 01/10/2026** | Médio — margem | Modelar em `costs` desde o início; monitorar volume de template |
| **Qualidade de match no CAPI** | Médio — otimização não melhora | Monitorar EMQ; garantir `fbc` capturado; usar `lead_id` onde existir |
| **Divergência de custo entre plataforma e CRM** | Médio — desconfiança no DRE | Reprocessar 7 dias retroativos; tolerância explícita de 1% |
| **Migração de dados do Chatwoot** | Médio — histórico perdido | Importar conversas pelo mesmo pipeline de ingestão, com dedupe |

## Fora de escopo nesta especificação

Decisões deliberadamente adiadas, para não travar o começo:

- Telefonia / discador
- Assinatura eletrônica de proposta
- App nativo (só se a adesão do PWA no iOS falhar)
- Multi-idioma
- Marketplace de integrações
- Score de lead por machine learning — a Fase 1 usa regra explícita, que é auditável e ajustável pelo
  gestor sem depender de volume histórico
