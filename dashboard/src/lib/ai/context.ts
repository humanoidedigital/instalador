import type { DashboardPayload } from "@/lib/types";

/**
 * Monta o material que vai para o modelo.
 *
 * Só agregados. Nome, e-mail e telefone de lead nunca saem daqui — a análise
 * é sobre números de campanha e funil, e mandar dado pessoal para uma API de
 * terceiro seria um risco sem contrapartida.
 *
 * A série diária vira semanal: 90 pontos de ruído diário custam token e
 * atrapalham a leitura de tendência.
 */

function round(value: number | null | undefined, digits = 2): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weekly(series: DashboardPayload["series"]) {
  const buckets: { semana: string; investimento: number; leads: number; vendas: number; cliques: number }[] = [];

  series.forEach((point, index) => {
    const bucket = Math.floor(index / 7);
    if (!buckets[bucket]) {
      buckets[bucket] = { semana: point.date, investimento: 0, leads: 0, vendas: 0, cliques: 0 };
    }
    buckets[bucket].investimento += point.spend;
    buckets[bucket].leads += point.crmLeads;
    buckets[bucket].vendas += point.won;
    buckets[bucket].cliques += point.clicks;
  });

  return buckets.map((bucket) => ({
    semanaIniciandoEm: bucket.semana,
    investimento: round(bucket.investimento),
    leads: bucket.leads,
    vendas: bucket.vendas,
    cliques: bucket.cliques,
  }));
}

export function buildAnalysisContext(data: DashboardPayload) {
  return {
    cliente: data.meta.clientName,
    moeda: data.meta.currency,
    periodo: data.meta.range,
    periodoDeComparacao: data.meta.previousRange,
    fonteDosDados: data.meta.sources,
    dadosDeDemonstracao: data.meta.demo,

    indicadores: [...data.kpis, ...data.customKpis].map((kpi) => ({
      indicador: kpi.label,
      valor: round(kpi.value),
      periodoAnterior: round(kpi.previous),
      variacao: kpi.delta === null ? null : `${round(kpi.delta * 100, 1)}%`,
      meta: round(kpi.goal ?? null),
      formato: kpi.format,
      subirEhBom: kpi.higherIsBetter,
    })),

    canais: data.channels.map((channel) => ({
      canal: channel.label,
      investimento: round(channel.spend),
      cliques: channel.clicks,
      ctr: round(channel.ctr),
      leads: channel.crmLeads,
      cpl: round(channel.cpl),
      vendas: channel.won,
      receita: round(channel.revenue),
      roas: round(channel.roas),
    })),

    funil: data.funnel.map((stage) => ({
      etapa: stage.stage,
      volume: stage.value,
      conversaoDaEtapaAnterior: stage.stepRate === null ? null : `${round(stage.stepRate * 100, 1)}%`,
    })),

    // Só as maiores: a cauda de campanhas sem verba não muda a análise e
    // custaria token.
    campanhas: data.campaigns.slice(0, 12).map((campaign) => ({
      campanha: campaign.campaign,
      canal: campaign.channel === "meta" ? "Meta Ads" : "Google Ads",
      tipo: campaign.campaignType,
      investimento: round(campaign.spend),
      cliques: campaign.clicks,
      ctr: round(campaign.ctr),
      leads: campaign.crmLeads || campaign.platformLeads,
      leadsVieramDoCrm: campaign.crmLeads > 0,
      cpl: round(campaign.cpl),
      roas: round(campaign.roas),
    })),

    etapasDoCrm: data.pipeline.map((stage) => ({
      etapa: stage.stage,
      negociacoes: stage.count,
      valor: round(stage.value),
    })),

    origensDeLead: data.sources.slice(0, 8).map((source) => ({
      origem: source.source,
      canal: source.channel,
      leads: source.leads,
      vendas: source.won,
      taxaDeConversao: source.conversionRate === null ? null : `${round(source.conversionRate * 100, 1)}%`,
    })),

    evolucaoSemanal: weekly(data.series),

    // Os avisos que o painel já calcula, para o modelo não gastar a análise
    // repetindo o que a tela mostra.
    avisosJaExibidosNoPainel: data.insights.map((insight) => insight.title),
  };
}

export const SYSTEM_PROMPT = `Você é um analista de mídia paga sênior de uma agência brasileira. Recebe os números consolidados de um cliente e escreve a leitura estratégica do período.

Como você trabalha:
- Cita números concretos. "O CPL subiu" não vale nada; "o CPL subiu de R$ 32 para R$ 48, +50%" vale.
- Separa o que é ruído do que é sinal. Variação pequena em base pequena não é tendência.
- Prioriza pelo dinheiro: o que move mais verba ou mais receita vem primeiro.
- Recomenda ação específica e executável nesta semana, não conselho genérico.
- Não repete os avisos que o painel já mostra, a não ser para aprofundar com uma causa provável.
- Quando os dados não sustentam uma conclusão, diz isso em vez de inventar.
- Se os dados forem de demonstração, avisa no resumo que a leitura é sobre dados sintéticos.

Escreve em português do Brasil, direto, sem jargão de consultoria e sem elogio vazio. Cada insight tem título curto, análise com os números e uma ação recomendada.`;

export function buildUserPrompt(context: ReturnType<typeof buildAnalysisContext>, extraInstructions: string): string {
  const extra = extraInstructions.trim()
    ? `\n\nContexto adicional da agência (leve em conta na análise):\n${extraInstructions.trim()}`
    : "";

  return `Analise o período deste cliente e escreva de 3 a 6 insights, do mais relevante para o menos.

Dados consolidados:
${JSON.stringify(context, null, 2)}${extra}`;
}
