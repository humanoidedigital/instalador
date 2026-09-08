import { getSecret, getSecretOr } from "./secrets";
import { loadClients } from "./clients";
import { addDays, today } from "./dates";
import { assembleDashboard } from "./metrics";
import { readAdDaily, readDeals, recordAlert, markAlertDelivered } from "./db/repository";
import { databaseEnabled } from "./db/sqlite";
import { evaluateAlerts, rulesForClient, type AlertHit, type AlertRule } from "./alerts";

/**
 * Roda as regras contra o histórico e grava os disparos.
 *
 * Lê do banco, não das APIs: a avaliação acontece logo depois da coleta, com
 * os números que acabaram de ser gravados, e não gasta chamada de API a mais.
 */

export interface AlertRunResult {
  avaliados: number;
  disparos: number;
  novos: number;
  entregues: number;
  erros: string[];
}

/** Envio para webhook — Slack, Discord, n8n, o que o time já usa. */
async function deliver(hits: AlertHit[], firedOn: string): Promise<{ entregues: number; erros: string[] }> {
  const url = getSecret("ALERT_WEBHOOK_URL");
  if (!url || !hits.length) return { entregues: 0, erros: [] };

  const erros: string[] = [];
  let entregues = 0;

  for (const hit of hits) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "alerta",
          severidade: hit.severity,
          cliente: hit.clientName,
          clienteId: hit.clientId,
          regra: hit.ruleName,
          titulo: hit.title,
          detalhe: hit.detail,
          valor: hit.value,
          limiar: hit.threshold,
          data: firedOn,
          // Texto pronto para quem só repassa a mensagem adiante.
          texto: `[${hit.severity.toUpperCase()}] ${hit.clientName} — ${hit.title}: ${hit.detail}`,
        }),
      });

      if (!response.ok) {
        erros.push(`webhook respondeu ${response.status} para "${hit.title}"`);
        continue;
      }

      markAlertDelivered(hit.ruleId, hit.clientId, hit.scopeKey, firedOn);
      entregues += 1;
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause;
      erros.push(`falha ao chamar o webhook: ${cause?.code || (error as Error).message}`);
      // Uma falha de rede não deve abortar os demais envios.
    }
  }

  return { entregues, erros };
}

export async function runAlerts(options: { days?: number; clientId?: string } = {}): Promise<AlertRunResult> {
  if (!databaseEnabled()) {
    return { avaliados: 0, disparos: 0, novos: 0, entregues: 0, erros: ["Banco desativado."] };
  }

  const firedOn = today();
  const fallback = Number(getSecretOr("ALERT_WINDOW_DAYS", "7"));

  const clients = loadClients().filter((client) => !options.clientId || client.id === options.clientId);
  const erros: string[] = [];
  const novos: AlertHit[] = [];
  let disparos = 0;

  clients.forEach((client) => {
    // Cada regra tem a sua janela; avaliar tudo num intervalo só compararia
    // "CPL de 7 dias" com um número de 30. Então agrupamos por janela e
    // montamos um relatório para cada uma.
    const porJanela = new Map<number, AlertRule[]>();
    rulesForClient(client.id).forEach((rule) => {
      const days = options.days || rule.windowDays || fallback;
      const grupo = porJanela.get(days);
      if (grupo) grupo.push(rule);
      else porJanela.set(days, [rule]);
    });

    porJanela.forEach((rules, days) => {
      try {
        const range = { from: addDays(firedOn, -(days - 1)), to: firedOn };
        const previousRange = { from: addDays(range.from, -days), to: addDays(range.from, -1) };

        const payload = assembleDashboard({
          client,
          // A avaliação não usa layout; o template entra só para satisfazer o tipo.
          template: { id: "alertas", name: "Alertas", blocks: [] },
          templates: [],
          range,
          previousRange,
          adRows: readAdDaily([client.id], range),
          previousAdRows: readAdDaily([client.id], previousRange),
          opportunities: readDeals([client.id], range),
          previousOpportunities: readDeals([client.id], previousRange),
          sources: { ads: "histórico", crm: "histórico" },
          warnings: [],
          demo: false,
        });

        const hits = evaluateAlerts(payload, days, client.goals, rules);
        disparos += hits.length;

        hits.forEach((hit) => {
          if (recordAlert({ ...hit, firedOn })) novos.push(hit);
        });
      } catch (error) {
        erros.push(`${client.name} (janela de ${days} dias): ${(error as Error).message}`);
      }
    });
  });

  const entrega = await deliver(novos, firedOn);

  return {
    avaliados: clients.length,
    disparos,
    novos: novos.length,
    entregues: entrega.entregues,
    erros: [...erros, ...entrega.erros],
  };
}
