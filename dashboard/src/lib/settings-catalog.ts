/**
 * Catálogo das configurações editáveis pelo painel admin.
 * Só chaves listadas aqui podem ser gravadas — evita que o formulário vire
 * um editor livre de variáveis de ambiente.
 */

export type FieldType = "text" | "password" | "select" | "number";

export interface SettingField {
  key: string;
  label: string;
  help?: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface SettingGroup {
  id: string;
  title: string;
  description: string;
  fields: SettingField[];
}

export const SETTINGS_GROUPS: SettingGroup[] = [
  {
    id: "fontes",
    title: "Fontes de dados",
    description: "De onde vêm os números de mídia e de CRM.",
    fields: [
      {
        key: "ADS_PROVIDER",
        label: "Mídia paga",
        type: "select",
        help: "Windsor cobre Meta e Google com uma chave só. As APIs nativas exigem developer token do Google e App na Meta.",
        options: [
          { value: "windsor", label: "Windsor.ai (recomendado)" },
          { value: "native", label: "APIs nativas (Google Ads + Meta)" },
          { value: "demo", label: "Demonstração (dados sintéticos)" },
        ],
      },
      {
        key: "CRM_PROVIDER",
        label: "CRM",
        type: "select",
        options: [
          { value: "rdstation", label: "RD Station CRM" },
          { value: "gohighlevel", label: "GoHighLevel" },
          { value: "demo", label: "Demonstração (dados sintéticos)" },
        ],
      },
    ],
  },
  {
    id: "windsor",
    title: "Windsor.ai",
    description: "Uma API key cobre Meta Ads e Google Ads. Pegue em onboard.windsor.ai → Account → API key.",
    fields: [
      { key: "WINDSOR_API_KEY", label: "API key", type: "password", placeholder: "cole a chave aqui" },
      {
        key: "WINDSOR_SEND_ACCOUNT_FILTER",
        label: "Filtrar contas na consulta",
        type: "select",
        help: "Mais rápido, mas nem toda conta Windsor aceita o parâmetro. Em caso de dúvida, deixe desligado — o filtro é aplicado localmente.",
        options: [
          { value: "false", label: "Não (filtra localmente)" },
          { value: "true", label: "Sim (envia na query)" },
        ],
      },
    ],
  },
  {
    id: "rd",
    title: "RD Station CRM",
    description: "Token em RD Station CRM → Configurações → Integrações → API. Use este campo quando uma conta só atende todos os clientes; para uma conta por cliente, cadastre o token na aba Clientes.",
    fields: [
      { key: "RD_CRM_TOKEN", label: "Token global", type: "password", placeholder: "cole o token aqui" },
      {
        key: "RD_CRM_API_VERSION",
        label: "Versão da API",
        type: "select",
        options: [
          { value: "v1", label: "v1 — crm.rdstation.com (token na query)" },
          { value: "v2", label: "v2 — api.rd.services (Bearer)" },
        ],
      },
      {
        key: "RD_WON_STAGES",
        label: "Etapas que contam como venda",
        type: "text",
        placeholder: "Fechado, Ganho",
        help: "Separadas por vírgula. Útil quando o time marca a venda movendo o card em vez de mudar o desfecho.",
      },
      { key: "RD_UTM_SOURCE_FIELD", label: "Campo personalizado de origem", type: "text", placeholder: "utm_source" },
      { key: "RD_UTM_CAMPAIGN_FIELD", label: "Campo personalizado de campanha", type: "text", placeholder: "utm_campaign" },
      { key: "RD_CRM_MAX_PAGES", label: "Máximo de páginas por consulta", type: "number", placeholder: "30" },
    ],
  },
  {
    id: "google",
    title: "Google Ads (API nativa)",
    description: "Só necessário com a fonte de mídia em “APIs nativas”.",
    fields: [
      { key: "GOOGLE_ADS_DEVELOPER_TOKEN", label: "Developer token", type: "password" },
      { key: "GOOGLE_ADS_CLIENT_ID", label: "Client ID", type: "password" },
      { key: "GOOGLE_ADS_CLIENT_SECRET", label: "Client secret", type: "password" },
      { key: "GOOGLE_ADS_REFRESH_TOKEN", label: "Refresh token", type: "password" },
      { key: "GOOGLE_ADS_LOGIN_CUSTOMER_ID", label: "ID da MCC", type: "text", placeholder: "somente números" },
    ],
  },
  {
    id: "meta",
    title: "Meta Ads (API nativa)",
    description: "Só necessário com a fonte de mídia em “APIs nativas”.",
    fields: [
      { key: "META_ACCESS_TOKEN", label: "Access token", type: "password" },
      { key: "META_API_VERSION", label: "Versão da Graph API", type: "text", placeholder: "v21.0" },
    ],
  },
  {
    id: "ghl",
    title: "GoHighLevel",
    description: "Alternativa ao RD Station. Private Integration Token com os escopos de leitura.",
    fields: [
      { key: "GHL_API_TOKEN", label: "Private Integration Token", type: "password" },
      { key: "GHL_WON_STAGES", label: "Estágios que contam como venda", type: "text" },
    ],
  },
  {
    id: "acesso",
    title: "Acesso de leitura",
    description: "Senha opcional para quem só precisa ver os relatórios, sem entrar na administração.",
    fields: [
      {
        key: "VIEWER_PASSWORD",
        label: "Senha de leitura",
        type: "password",
        help: "Quem entrar com ela vê os relatórios e não acessa esta área. Deixe vazio para desativar.",
      },
    ],
  },
];

const ALLOWED = new Set(SETTINGS_GROUPS.flatMap((group) => group.fields.map((field) => field.key)));

export function isSecretField(key: string): boolean {
  for (const group of SETTINGS_GROUPS) {
    const field = group.fields.find((item) => item.key === key);
    if (field) return field.type === "password";
  }
  // Token por cliente (RD_CRM_TOKEN_<CLIENTE>) é sempre segredo.
  return /^RD_CRM_TOKEN_/.test(key);
}

/** Chaves gravaveis: o catálogo mais os tokens por cliente. */
export function isWritableKey(key: string): boolean {
  return ALLOWED.has(key) || /^RD_CRM_TOKEN_[A-Z0-9_]+$/.test(key);
}
