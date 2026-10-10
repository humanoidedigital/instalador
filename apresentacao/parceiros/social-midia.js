/* Parceiro: agência de social mídia que indica a Ribeker.
   O cliente chegou por quem já cuida das redes dele, então a Ribeker vende tudo, MENOS social mídia
   (sem conflito de interesse com o parceiro):
   - as perguntas do raio-x com tema 'social' saem: não pontuam e não vão para o relatório,
     para o diagnóstico não julgar o trabalho do parceiro na frente do cliente
   - social mídia aparece como a parte do parceiro no fluxo, não como serviço da Ribeker
   - valores de mercado sem social mídia
   - planos: tabela exclusiva de parceiros, por faixa de verba de anúncios

   Estilos de parceiro ficam em parceiros/*.js e aparecem no seletor em "Parceiros".
   Valem por cima do nicho: qualquer chave de marca.js pode ser sobrescrita aqui.
   {parceiro} nos textos vira o nome digitado no seletor (ou "parceiroPadrao"). */
PARCEIRO({
  id: 'socialmidia',
  nome: 'Parceiro de social mídia',
  descricao: 'Cliente indicado por agência de social mídia. Vende tráfego, CRM e performance comercial; social mídia fica com o parceiro.',
  chip: 'Parceiro social mídia',
  aviso: 'a oferta desta reunião sai sem social mídia.',
  parceiroPadrao: 'o seu parceiro de social mídia',
  ocultarTemas: ['social'],

  resolvemos: {
    etapas: [
      { nome: 'Social mídia', texto: 'Com {parceiro}: atenção e permanência do seu lead' },
      { nome: 'Tráfego pago', texto: 'Atrai o lead para nível de convivência e cadastro' },
      { nome: 'CRM / IA', texto: 'Organiza e atende' },
      { nome: 'Venda', texto: 'Lead organizado e acompanhado até o fechamento' }
    ],
    fecho: 'O conteúdo segue com {parceiro}. A Ribeker cuida do resto: sua {empresa} nunca mais perde lead por falta de processo, do primeiro clique até {fimJornada}.'
  },

  marcas: { frentes: ['Tráfego pago', 'CRM', 'Vendas', 'Analytics'] },

  mkt: {
    kicker: 'Você não vai ficar sozinho · Tráfego',
    titulo: 'Tudo que o tráfego faz por você',
    itens: [
      'Gestão de até 2 plataformas (Meta, Google e outras)',
      'Planejamento e estratégia das campanhas',
      'Configuração, acompanhamento e otimizações',
      'Tracking de conversões e relatório mensal de performance',
      'Campanhas alinhadas ao conteúdo feito por {parceiro}'
    ]
  },

  valores: {
    itens: [
      { nome: 'Gestor de tráfego pago', valor: 'R$ 3.000/mês',
        fonte: 'Salário médio de Gestor de Tráfego Pago no Brasil: R$ 3.000 por mês. Glassdoor, abril de 2026.' },
      { nome: 'Especialista em RevOps (orienta o time de vendas)', valor: 'R$ 9.150/mês',
        fonte: 'Salário médio de RevOps Specialist no Brasil: R$ 9.150 por mês (faixa comum de R$ 5.375 a R$ 14.600). Glassdoor, junho de 2026.' },
      { nome: 'CRM com WhatsApp e IA (3 usuários)', valor: 'R$ 387/mês',
        fonte: 'Kommo, plano Avançado (automações, Salesbot e agente de IA): R$ 129 por usuário por mês no plano anual. 3 usuários = R$ 387. Tabela de 2026.' }
    ],
    total: 'R$ 12.537/mês',
    nota: 'Salários médios, sem encargos e sem a verba de anúncio. Social mídia fica com {parceiro}.'
  },

  // tabela exclusiva de parceiros: o preço depende da verba mensal de anúncios.
  // A faixa vem da resposta "Quanto investe por mês em anúncio?" do raio-x; dá para trocar clicando na faixa.
  planos: {
    // 1º slide: a tabela completa (faixas × planos), com a margem do parceiro já somada
    tabelaKicker: 'Seu investimento',
    tabelaTitulo: 'Planos de *tráfego pago*',
    tabelaSub: 'Condição de parceria, para clientes indicados por {parceiro}. O valor acompanha a verba mensal de anúncios.',
    // 2º slide: o que entra em cada plano, na faixa de verba do cliente
    kicker: 'Seu investimento · o que entra',
    titulo: 'O que entra em *cada plano*',
    sub: 'Valores da faixa de verba de vocês. Clique em outra faixa para comparar.',
    faixaRotulo: 'Verba mensal de anúncios',
    faixas: [
      { t: 'Até R$ 5 mil', ate: 5000 },
      { t: 'R$ 5 a 10 mil', ate: 10000 },
      { t: 'R$ 10 a 20 mil', ate: 20000 },
      { t: 'R$ 20 a 30 mil', ate: 30000 },
      { t: 'R$ 30 a 50 mil', ate: 50000 },
      { t: 'Acima de R$ 50 mil' }
    ],
    itens: [
      { nome: 'Tráfego pago', detalhe: 'Gestão de anúncios', per: '/mês',
        precos: ['R$ 1.500', 'R$ 2.250', 'R$ 3.500', 'R$ 4.500', 'R$ 6.000', 'Sob consulta'],
        beneficios: ['Gestão de até 2 plataformas (Meta, Google etc.)', 'Planejamento e estratégia das campanhas', 'Configuração, acompanhamento e otimizações', 'Tracking de conversões', 'Relatório mensal de performance'] },
      { nome: 'Tráfego + CRM', detalhe: 'Do anúncio à oportunidade', per: '/mês', inclui: 'Tudo do Tráfego pago, mais:',
        precos: ['R$ 2.500', 'R$ 3.250', 'R$ 4.750', 'R$ 6.000', 'R$ 8.000', 'Sob consulta'],
        beneficios: ['Implantação e organização do CRM', 'Estruturação do funil de vendas', 'Automações essenciais', 'Distribuição e acompanhamento das oportunidades', 'Indicadores de conversão até vendas', 'Relatório integrado (tráfego + comercial)'] },
      { nome: 'Tráfego + CRM + Performance comercial', detalhe: 'Da oportunidade à venda', per: '/mês', inclui: 'Tudo dos planos anteriores, mais:',
        selo: 'Mais completo', destaque: true,
        precos: ['R$ 3.500', 'R$ 4.250', 'R$ 6.000', 'R$ 7.500', 'R$ 10.000', 'Sob consulta'],
        beneficios: ['Estruturação do processo comercial', 'Treinamento da equipe de vendas', 'Abordagem e cadências de follow-up', 'Acompanhamento de indicadores comerciais', 'Reuniões periódicas de performance', 'Suporte contínuo para evolução dos resultados'] }
    ],
    rodape: [
      { t: 'Verba de anúncios separada', d: 'O investimento em mídia não entra no fee de gestão: é pago direto às plataformas.' },
      { t: 'Relatório mensal', d: 'Acompanhamento completo de resultados e indicadores.' },
      { t: 'Escopo padrão', d: 'Volume padrão de oportunidades, usuários e complexidade.' },
      { t: 'Projetos especiais', d: 'Alto volume, várias unidades ou equipes comerciais maiores são avaliados à parte.' }
    ],
    nota: 'Contrato *sem fidelidade*: só 30 dias de aviso prévio.',
    implantacao: ''
  }
});
