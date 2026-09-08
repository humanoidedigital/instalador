/**
 * Quais KPIs vão para a linha principal do relatório.
 *
 * Vive em módulo próprio porque é consumido pelo componente de tela: se ficasse
 * em metrics.ts, o bundle do browser puxaria junto a leitura de arquivo das
 * métricas personalizadas.
 */
export const PRIMARY_KPI_IDS = ["spend", "crmLeads", "cpl", "opportunities", "won", "revenue", "roas", "cac"];

/**
 * Catálogo dos indicadores base, para o construtor de relatórios oferecer a
 * lista sem precisar calcular um período de verdade.
 */
export const BASE_KPIS: { id: string; label: string }[] = [
  { id: "spend", label: "Investimento" },
  { id: "crmLeads", label: "Leads no CRM" },
  { id: "cpl", label: "CPL" },
  { id: "opportunities", label: "Negociações qualificadas" },
  { id: "won", label: "Vendas ganhas" },
  { id: "revenue", label: "Receita" },
  { id: "roas", label: "ROAS" },
  { id: "cac", label: "CAC" },
  { id: "impressions", label: "Impressões" },
  { id: "clicks", label: "Cliques" },
  { id: "ctr", label: "CTR" },
  { id: "cpc", label: "CPC" },
  { id: "cpm", label: "CPM" },
  { id: "platformLeads", label: "Conversões nas plataformas" },
  { id: "leadToSale", label: "Conversão lead → venda" },
  { id: "ticket", label: "Ticket médio" },
  { id: "cpa", label: "Custo por conversão (plataformas)" },
];
