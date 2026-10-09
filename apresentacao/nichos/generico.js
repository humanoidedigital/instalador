/* Nicho: Genérico. Para quando aparece uma reunião sem preparo: qualquer empresa que vende por lead.
   O raio-x separa os dois lados e o funil mostra onde está o gargalo, se em MARKETING ou em VENDAS:
   - Marketing: anúncio, rastreamento, oferta, criativos, destino + CTR e clique → lead (com referência de mercado)
   - Vendas: processo, meta, resposta, follow-up, CRM + lead → reunião/orçamento → venda
   Indicadores calculados com os números de cada tela: CPM, CTR, CPC, CPL, custo por reunião ou orçamento, CAC, ROAS.
   Só CTR e clique → lead têm referência pública e pontuam; os outros dependem do ticket e do ciclo de cada negócio,
   então aparecem como número, sem julgamento. */
NICHO({
  id: 'generico',
  nome: 'Genérico · vende por lead',
  descricao: 'Para prospectar sem preparo: qualquer empresa que vende por lead. Mostra se o gargalo é marketing ou vendas.',

  termos: {
    empresa: 'empresa', empresas: 'empresas',
    cliente: 'cliente', clientes: 'clientes',
    venda: 'venda', vendas: 'vendas',
    ticket: 'ticket médio',
    receita: 'receita', suaReceita: 'sua receita',
    fimJornada: 'o contrato assinado',
    compraPensada: 'qualquer compra de valor alto',
    temHoje: 'nome e clientes'
  },

  publico: ['Empresas de serviços', 'Indústria e distribuição (B2B)', 'Clínicas e saúde', 'Imobiliário e construção', 'Varejo de ticket alto'],

  perfis: {
    itens: [
      { perfil: 'Serviços para o consumidor', dor: 'Lead chega pelo WhatsApp e esfria sem resposta' },
      { perfil: 'B2B e indústria', dor: 'Ciclo longo: proposta enviada vira silêncio' },
      { perfil: 'Clínicas e saúde', dor: 'Agenda vazia com anúncio rodando' },
      { perfil: 'Imobiliário e construção', dor: 'Muito curioso, pouco orçamento qualificado' },
      { perfil: 'Varejo de ticket alto', dor: 'Cliente aparece na loja e ninguém sabe de onde veio' }
    ]
  },

  areas: [
    { id: 'marketing', nome: 'Marketing' },
    { id: 'comercial', nome: 'Vendas' }
  ],

  raiox: [
    {
      id: 'vendas', area: 'comercial',
      kicker: 'Raio-X · Vendas',
      titulo: 'Vendas e *Prospecção*',
      campos: [
        { id: 'equipe', rotulo: 'Quantas pessoas atendem e vendem?', suf: 'pessoas', unidade: 'pessoas' }
      ],
      perguntas: [
        { id: 'quemvende', texto: 'Quem vende hoje?', tipo: 'multipla',
          opcoes: ['Dono', 'Gerente', 'Vendedores', 'Pré-vendas / SDR', 'Recepção'] },
        { id: 'processo', texto: 'Como a empresa vende?', tipo: 'unica',
          opcoes: [{ t: 'Existe processo de venda definido', dor: 0 }, { t: 'Cada um vende do seu jeito', dor: 1 }],
          acao: 'Definir um processo de venda único, com as mesmas etapas para todo mundo que atende.' },
        { id: 'ativo', texto: 'O time faz prospecção ativa?', sub: 'Base de clientes, parcerias, indicação, eventos', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar prospecção ativa na rotina da semana: base de clientes, parcerias, indicação e eventos.' },
        { id: 'meta', texto: 'Tem meta de vendas definida?', tipo: 'unica',
          opcoes: [{ t: 'Sim, por pessoa e por semana', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem metas', dor: 1 }],
          acao: 'Quebrar a meta do mês em meta de semana por pessoa, com acompanhamento à vista.' },
        { id: 'lider', texto: 'Alguém acompanha o comercial com meta e cobrança?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter um responsável pelo comercial, que acompanha meta, funil e time toda semana.' }
      ]
    },
    {
      id: 'marketing', area: 'marketing',
      kicker: 'Raio-X · Marketing',
      titulo: 'Marketing e *Tráfego Pago*',
      sub: 'Anúncio, rastreamento, redes sociais e capacidade de atendimento',
      perguntas: [
        { id: 'trafego', texto: 'Tem anúncio pago rodando hoje?', sub: 'Meta Ads (Instagram/Facebook), Google ou outro canal', tipo: 'unica',
          opcoes: [{ t: 'Sim, onde?', dor: 0, campo: 'canal' }, { t: 'Já anunciou, mas parou', dor: 1 }, { t: 'Nunca anunciou', dor: 1 }],
          acao: 'Começar campanha paga com verba controlada e custo por lead medido desde o primeiro dia.' },
        { id: 'tracking', texto: 'Sabe quantos leads e vendas vieram de cada anúncio?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Mais ou menos', dor: 0.5 }, { t: 'Não', dor: 1 }],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' },
          acao: 'Instalar rastreamento (pixel, API de conversões e UTMs) para saber quanto cada campanha gera de lead e de venda.' },
        { id: 'oferta', texto: 'O anúncio tem uma oferta clara?', sub: 'O que é, para quem, e por que agora', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' },
          acao: 'Reescrever a oferta do anúncio: o que é, para quem e por que agora, com um próximo passo claro.' },
        { id: 'criativos', texto: 'Testa criativos novos todo mês?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' },
          acao: 'Testar criativos novos todo mês e pausar o que não traz lead: o anúncio cansa.' },
        { id: 'destino', texto: 'Para onde o anúncio leva?', tipo: 'unica',
          opcoes: ['WhatsApp', 'Formulário do Meta ou do Google', 'Site ou landing page', 'Direct do Instagram'],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' } },
        { id: 'capacidade', texto: 'A empresa tem capacidade para atender mais clientes?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { id: 'posta', tema: 'social', texto: 'Posta nas redes sociais com frequência?', tipo: 'unica',
          opcoes: ['Sim, com frequência', 'Posta, mas sem frequência', 'Não posta'] },
        { id: 'socialmidia', tema: 'social', texto: 'Tem um social mídia?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Ter alguém responsável pelas redes, com rotina de publicação definida.' },
        { id: 'estrategia', tema: 'social', texto: 'Tem estratégia por trás das postagens?', sub: 'Pauta pensada para atrair, gerar confiança e chamar para a compra', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Montar linha editorial com pauta da semana, dividindo o conteúdo entre atrair, gerar confiança e chamar para a compra.' }
      ]
    },
    {
      id: 'leads', area: 'comercial',
      kicker: 'Raio-X · Vendas',
      titulo: 'Geração de Leads e *Posicionamento*',
      sub: 'De onde vêm os clientes e como a empresa é lembrada',
      perguntas: [
        { id: 'funis', texto: 'De onde chegam os leads hoje?', tipo: 'multipla', bom: 3,
          opcoes: ['Tráfego pago', 'Instagram orgânico', 'Google (busca e Perfil da Empresa)', 'Indicação', 'Parcerias', 'Base de clientes', 'Site', 'Eventos e feiras'],
          acao: 'Abrir mais de uma origem de lead, para o resultado não depender de um canal só.' },
        { id: 'posicionamento', texto: 'A empresa é conhecida por algo específico?', sub: 'Marca, não só preço', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir pelo que a empresa quer ser reconhecida e repetir isso em toda comunicação.' },
        { id: 'qualifica1', texto: 'Qualifica o lead no primeiro contato?', sub: 'Necessidade, prazo e orçamento antes de marcar reunião', tipo: 'unica',
          opcoes: [{ t: 'Sempre', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Qualificar no primeiro contato (necessidade, prazo e orçamento) para não gastar reunião com quem não compra.' }
      ]
    },
    {
      id: 'ferramentas', area: 'comercial',
      kicker: 'Raio-X · Vendas',
      titulo: '*Ferramentas*',
      sub: 'O que já está implementado tecnicamente',
      perguntas: [
        { id: 'crm', texto: 'Tem CRM pra captação e organização dos leads?', tipo: 'unica',
          opcoes: [{ t: 'Sim, qual?', dor: 0, campo: 'ferramenta' }, { t: 'Não', dor: 1 }],
          acao: 'Implantar CRM para registrar todo lead que chega, com responsável e etapa.' },
        { id: 'funilcrm', texto: 'O funil de vendas está desenhado dentro do CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'crm', oculta: [1], resposta: 1, motivo: 'não tem CRM' },
          acao: 'Desenhar as etapas do funil dentro do CRM, do primeiro contato até a venda.' },
        { id: 'automacao', texto: 'Tem automação de mensagens (WhatsApp, Instagram e e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar as mensagens de entrada, confirmação e lembrete, para nenhum lead esperar resposta.' },
        { id: 'dashboard', texto: 'Tem relatório ou painel para acompanhar as métricas?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar um painel com leads, reuniões, vendas e custo por venda para acompanhar toda semana.' }
      ]
    },
    {
      id: 'atendimento', area: 'comercial',
      kicker: 'Raio-X · Vendas',
      titulo: 'Atendimento e *Follow-up*',
      sub: 'Como o lead é tratado depois que chega',
      perguntas: [
        { id: 'tempoResp', texto: 'Tem tempo máximo de resposta ao lead?', tipo: 'unica',
          opcoes: [{ t: 'Sim, e é medido', dor: 0 }, { t: 'Tem, mas ninguém mede', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir um tempo máximo de resposta ao lead e medir se ele está sendo cumprido.' },
        { id: 'script', texto: 'Existe roteiro de atendimento?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro de atendimento, do primeiro contato até a reunião ou o orçamento.' },
        { id: 'followup', texto: 'Tem follow-up estruturado depois do primeiro contato?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar régua de follow-up com prazo e responsável, do primeiro contato até a venda.' },
        { id: 'perdas', texto: 'Registra por que cada venda foi perdida?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Registrar o motivo de cada venda perdida para corrigir preço, oferta ou atendimento com base em dado.' },
        { id: 'reativacao', texto: 'Tem cadência de reativação de leads frios?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar cadência para reativar os leads frios e as propostas que não fecharam.' }
      ]
    },
    {
      id: 'numeros-mkt', area: 'marketing',
      kicker: 'Raio-X · Marketing',
      titulo: 'Números do *marketing*',
      sub: 'Do Gerenciador de Anúncios, do último mês. Pode ser aproximado; o que não souber, marque "Não sei".',
      campos: [
        { id: 'midia', rotulo: 'Quanto investe por mês em anúncio?', pre: 'R$', suf: 'R$ / mês',
          atalhos: [{ t: 'Não investe', v: 0 }] },
        { id: 'impressoes', rotulo: 'Impressões por mês', sub: 'Quantas vezes o anúncio apareceu', suf: 'impressões / mês', unidade: 'impressões/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'cliques', rotulo: 'Cliques por mês', sub: 'Cliques no link ou no botão do anúncio', suf: 'cliques / mês', unidade: 'cliques/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'leads', rotulo: 'Quantos contatos novos chegam por mês?', sub: 'WhatsApp, formulário, Instagram, site e telefone', suf: 'contatos / mês', unidade: 'contatos/mês',
          atalhos: [{ t: 'Não sei', v: null }] }
      ],
      calculos: { indicadores: ['cpm', 'ctr', 'cpc', 'cpl', 'cliqueLead'] },
      perguntas: [
        { id: 'origem', texto: 'De onde vêm esses números?', tipo: 'unica',
          opcoes: [{ t: 'Do gerenciador e do CRM', dor: 0 }, { t: 'De cabeça, aproximado', dor: 0.5 }, { t: 'Não sabemos', dor: 1 }],
          acao: 'Medir toda semana investimento, cliques, leads, reuniões e vendas, para saber onde o funil perde.' }
      ]
    },
    {
      id: 'numeros-vendas', area: 'comercial',
      kicker: 'Raio-X · Vendas',
      titulo: 'Números de *vendas*',
      sub: 'Os números de hoje viram a base do comparativo mostrado mais à frente. Pode ser aproximado.',
      campos: [
        { id: 'reunioes', rotulo: 'Reuniões ou orçamentos por mês', sub: 'Leads que chegaram a uma conversa de venda de verdade', suf: 'por mês', unidade: 'por mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'vendas', rotulo: 'Vendas fechadas por mês', suf: 'vendas / mês', unidade: 'vendas/mês' },
        { id: 'ticket', rotulo: 'Ticket médio', sub: 'Quanto vale uma venda, em média', pre: 'R$', suf: 'R$ por venda' }
      ],
      calculos: { indicadores: ['leadReuniao', 'reuniaoVenda', 'leadVenda', 'custoReuniao', 'cac', 'roas'] }
    },
    {
      id: 'tempo', area: 'comercial',
      kicker: 'Raio-X · O custo de esperar',
      titulo: 'Tempo, investimento e *resultado*',
      sub: 'As últimas respostas viram o comparativo da próxima tela.',
      campos: [
        { id: 'meses', rotulo: 'Há quantos meses vocês tentam ajustar o comercial?', suf: 'meses', unidade: 'meses' },
        { id: 'custo', rotulo: 'Custo mensal do comercial e do marketing', sub: 'Pessoas · Anúncios · Ferramentas · Agência', pre: 'R$', suf: 'R$ / mês' },
        { id: 'receitaIni', rotulo: 'Há {meses}, a receita mensal era de?', pre: 'R$', suf: 'R$ / mês, no início' },
        { id: 'receitaHoje', rotulo: 'Hoje a receita mensal está em?', pre: 'R$', suf: 'R$ / mês, hoje' }
      ]
    }
  ],

  // indicadores: valor = a ÷ b × x. Com ref + area, pontua no placar e entra no plano de ação.
  indicadores: [
    { id: 'cpm', rotulo: 'CPM', a: 'midia', b: 'impressoes', x: 1000, formato: 'brl', dica: 'Custo para o anúncio aparecer mil vezes' },
    { id: 'ctr', rotulo: 'CTR', a: 'cliques', b: 'impressoes', x: 100, formato: 'pct', area: 'marketing', ref: 2.7,
      fonte: 'Taxa média de cliques em anúncios do Meta com objetivo de leads, todos os setores: 2,70%. Facebook Advertising Benchmarks 2026, LocaliQ e WordStream (atualizado em setembro de 2026).',
      acao: 'Trocar criativos e ganchos: o anúncio aparece, mas pouca gente clica.' },
    { id: 'cpc', rotulo: 'CPC', a: 'midia', b: 'cliques', formato: 'brl', dica: 'Custo de cada clique' },
    { id: 'cpl', rotulo: 'CPL', a: 'midia', b: 'leads', formato: 'brl', dica: 'Custo de cada lead' },
    { id: 'cliqueLead', rotulo: 'Clique → lead', a: 'leads', b: 'cliques', x: 100, formato: 'pct', area: 'marketing', ref: 8.54,
      fonte: 'Conversão média de clique em lead em anúncios do Meta com objetivo de leads, todos os setores: 8,54%. Facebook Advertising Benchmarks 2026, LocaliQ e WordStream. No Brasil, landing pages convertem em média 11% das visitas (RD Station, dados de 2025).',
      acao: 'Melhorar o destino do anúncio (página, formulário ou WhatsApp): muita gente clica e pouca vira contato.' },
    { id: 'leadReuniao', rotulo: 'Lead → reunião', a: 'reunioes', b: 'leads', x: 100, formato: 'pct', dica: 'Quantos leads chegam a uma conversa de venda' },
    { id: 'reuniaoVenda', rotulo: 'Reunião → venda', a: 'vendas', b: 'reunioes', x: 100, formato: 'pct', dica: 'Quantas reuniões ou orçamentos viram venda' },
    { id: 'leadVenda', rotulo: 'Lead → venda', a: 'vendas', b: 'leads', x: 100, formato: 'pct' },
    { id: 'custoReuniao', rotulo: 'Custo por reunião', a: 'midia', b: 'reunioes', formato: 'brl', dica: 'Anúncio gasto para cada reunião ou orçamento' },
    { id: 'cac', rotulo: 'CAC de mídia', a: 'midia', b: 'vendas', formato: 'brl', dica: 'Anúncio gasto para cada venda' },
    { id: 'roas', rotulo: 'ROAS', a: ['vendas', 'ticket'], b: 'midia', formato: 'x', dica: 'Quanto volta em vendas para cada R$ 1 de anúncio' }
  ],

  funil: {
    etapas: [
      { campo: 'impressoes', rotulo: 'Impressões' },
      { campo: 'cliques', rotulo: 'Cliques' },
      { campo: 'leads', rotulo: 'Leads' },
      { campo: 'reunioes', rotulo: 'Reuniões ou orçamentos' },
      { campo: 'vendas', rotulo: 'Vendas' }
    ],
    passos: ['ctr', 'cliqueLead', 'leadReuniao', 'reuniaoVenda'],
    custos: ['cpm', 'cpc', 'cpl', 'custoReuniao', 'cac', 'roas']
  },

  projecao: {
    recorrente: false,
    multiplicador: 1.5,
    conta: 'extra',
    referencia: { base: 5, ticket: 1000 },   // exemplo enquanto o raio-x não tem números (aparece marcado como referência)
    baseRotulo: '+{n} vendas a mais por mês',
    explicacao: '50% a mais que as {hoje} vendas de hoje'
  }
});
