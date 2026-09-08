/**
 * Quais KPIs vão para a linha principal do relatório.
 *
 * Vive em módulo próprio porque é consumido pelo componente de tela: se ficasse
 * em metrics.ts, o bundle do browser puxaria junto a leitura de arquivo das
 * métricas personalizadas.
 */
export const PRIMARY_KPI_IDS = ["spend", "crmLeads", "cpl", "opportunities", "won", "revenue", "roas", "cac"];
