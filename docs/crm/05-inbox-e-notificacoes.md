# 05 — Inbox nativo e notificações

## 1. Máquina de estados da conversa

```
                    mensagem recebida
        (nova)  ──────────────────────►  ABERTA (sem dono, na fila)
                                            │
                        vendedor assume     │  distribuição automática
                                            ▼
                                         ABERTA (com dono)
                                            │
                  vendedor responde  ───────┤──► first_response_at gravado (SLA)
                                            │
                     aguardando cliente     ▼
                                        PENDENTE ──── cliente responde ──► ABERTA
                                            │
                                  vendedor encerra
                                            ▼
                                         FECHADA ──── cliente escreve ──► ABERTA (reabre)
```

Reabrir mantém a mesma linha em `conversations` (o `UNIQUE (channel_id, contact_id)` garante isso) e
registra o evento em `conversation_events`. O histórico do cliente nunca se fragmenta em conversas
paralelas.

## 2. Janela de 24 horas (WABA)

`conversations.window_expires_at` guarda o fim da janela de atendimento, renovado a cada mensagem
recebida do cliente.

| Estado | O que a UI permite |
|---|---|
| Dentro da janela | Texto livre, mídia, qualquer coisa |
| Fora da janela | **Só template aprovado**, escolhido de `message_templates` com `status='aprovado'` |

A UI mostra um contador regressivo. Sem ele, o vendedor escreve, o envio falha na API e ninguém entende
por quê — o erro da Meta nesse caso não é autoexplicativo.

> **01/10/2026:** a janela de atendimento deixa de ser gratuita. Mensagens de serviço e templates
> utility dentro das 24h voltam a ser cobrados. Consequência de produto: o custo por conversa passa a
> ser linha real no DRE (`costs.categoria = 'operacional'`), alimentado pelo relatório de faturamento da
> WABA.

Canal uazapi não tem janela — é WhatsApp comum. `window_expires_at` fica nulo.

## 3. Envio com controle de ritmo

```
UI  →  INSERT messages (status='fila')  →  pgmq q_outbound
                                               │
                                         worker no VPS
                                               │
                     respeita channels.rate_limit_min + jitter aleatório
                                               │
                          ┌────────────────────┴───────────────────┐
                       uazapi                                    WABA
                          │                                        │
             status='enviado' + provider_message_id      idem, e valida a janela
                          │
        webhooks de status atualizam entregue / lido / falhou
```

O rate limit **não é otimização**: número não-oficial que dispara em rajada é número banido. O jitter
existe pelo mesmo motivo — cadência perfeitamente regular também é assinatura de automação.

## 4. Mídia

```
webhook com mídia → q_media → worker baixa do provedor
                            → bucket PRIVADO no Supabase Storage
                            → messages.media_path
UI → signed URL de curta duração
```

O bucket é privado porque anexo de conversa contém documento pessoal, comprovante e foto de cliente. URL
pública de mídia de CRM é vazamento esperando acontecer.

## 5. Tempo real

Supabase Realtime em `messages` e `conversations`. Como a RLS vale também no Realtime, o vendedor só
recebe evento das conversas que pode ver — não é preciso filtrar no client.

## 6. Distribuição e SLA

| Modo | Regra |
|---|---|
| Round-robin | Rodízio ponderado por `profiles.peso_distribuicao` |
| Por carga | Menor número de conversas abertas |
| Fila aberta | Sem dono; a RLS mostra para todos e o primeiro assume |

**SLA de primeira resposta:** `stages.sla_horas` no funil e um limite por canal no inbox. Estourou →
notifica o gestor e destaca a conversa. `first_response_at` é gravado uma única vez, na primeira mensagem
de saída enviada por humano — automação não conta como atendimento.

## 7. Interface

**Desktop (≥1280px)** — três colunas:

```
┌──────────────┬───────────────────────────┬──────────────────┐
│ Conversas    │ Thread                    │ Painel do lead   │
│ filtros:     │                           │ deal + etapa     │
│ minhas /     │ mensagens                 │ tarefas abertas  │
│ fila / todas │                           │ origem e UTMs    │
│ busca        │ [ caixa de envio ]        │ histórico        │
└──────────────┴───────────────────────────┴──────────────────┘
```

**Mobile** — uma coluna por vez, navegação em pilha, bottom nav com Conversas / Funil / Tarefas /
Relatórios. O painel do lead vira um *sheet* que sobe por cima da thread.

**Kanban:** drag-and-drop no desktop; no mobile, botão "mover etapa" abrindo um sheet com a lista. Kanban
com arrastar em tela de celular é um teste de paciência, não um recurso.

## 8. Web Push

### Arquitetura

```
evento (nova mensagem / lead atribuído / tarefa vencendo / SLA)
   → q_notifications
   → Edge Function push-dispatch
   → para cada user_devices ativo do destinatário: Web Push (VAPID)
   → 404/410 na resposta = assinatura morta → ativo=false
```

Chaves VAPID no Vault. A `endpoint` é única em `user_devices`: reinstalar o PWA gera assinatura nova e a
antiga é limpa na primeira falha.

### Gatilhos

| Evento | Quem recebe |
|---|---|
| Lead novo atribuído | O dono |
| Lead novo na fila aberta | Todos os vendedores ativos |
| Mensagem nova em conversa minha | O dono |
| Conversa sem resposta além do SLA | Dono + gestor |
| Tarefa vencendo | O dono, `remind_before_min` antes |
| Menção em nota interna | O mencionado |

Agrupamento por conversa via `tag` na notificação: dez mensagens seguidas do mesmo cliente substituem a
notificação anterior em vez de empilhar dez.

### iOS — a limitação que precisa de onboarding

Web Push no iOS (16.4+) **só funciona se o PWA estiver adicionado à Tela de Início**. Não há contorno pela
web: Safari em aba não recebe push, e a permissão só pode ser pedida a partir de um gesto do usuário.

Consequência de produto, não de engenharia:

1. Detectar iOS + não instalado → tela obrigatória no primeiro login, com o passo-a-passo ilustrado
   (Compartilhar → Adicionar à Tela de Início).
2. Só depois de instalado, pedir a permissão a partir de um toque explícito.
3. Marcar em `user_devices.plataforma='ios'` para medir a adesão real.

**Este é o ponto mais frágil do plano do lado de adoção.** Se a adesão ficar baixa na prática, o plano B é
um app Expo consumindo o mesmo Supabase — o backend não muda em nada.

### Fallback

Sem push entregue e conversa não atendida em X minutos → notifica o gestor e envia e-mail. Cobre o
vendedor que negou a permissão, desinstalou o PWA ou está com o aparelho no silencioso.

## 9. Teste de aceite

1. Mensagem recebida no uazapi cria conversa e aparece na UI **sem recarregar** (Realtime).
2. Reenviar o mesmo webhook → **nenhuma** mensagem duplicada (`messages_provider_uniq`).
3. Conversa WABA com janela expirada → caixa de texto bloqueada, só templates.
4. Push chega em Android instalado, e em iOS **depois** de adicionar à Tela de Início.
5. Assinatura revogada → 410 na resposta → `user_devices.ativo=false` no banco.
6. Vendedor A não enxerga conversa atribuída ao vendedor B (testar com JWT real, não como superuser —
   `force row level security` está ligado, mas superuser ignora RLS).
