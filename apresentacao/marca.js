/* Marca: o pitch da Ribeker, igual em todos os nichos.
   Qualquer chave daqui pode ser sobrescrita dentro de um arquivo de nicho (mesmo nome, mesmo formato).

   Convenções nos textos:
     *palavra*      destaca em azul
     [texto]        marca o que ainda falta preencher (aparece com contorno tracejado)
     ~~texto~~      riscado (ex.: preço "de")
     {venda}        troca pelo termo do nicho: {empresa} {cliente} {clientes} {venda} {vendas} {ticket}
                    {receita} {suaReceita} {fimJornada}; com maiúscula: {Empresa} {Vendas}...
     {marca}        nome curto da marca (Ribeker)
     {meses}        mostra ao vivo o tempo informado no raio-x
     {fator12}      mostra ao vivo "dobra", "mais que dobra" ou "mais que triplica" */
window.MARCA = {
  nome: 'Ribeker Assessoria Digital',
  curto: 'Ribeker',
  logo: 'assets/logo-claro.png',        // slides (fundo escuro)
  logoRelatorio: 'assets/logo.png',     // relatório em PDF (fundo branco)
  icone: 'assets/marca-claro.png',      // barra de navegação

  cores: {
    fundo: '#051330',
    fundo2: '#0a2552',
    destaque: '#3b8ef3',
    destaqueForte: '#1f5fbf',
    texto: '#f2f6ff',
    suave: '#a3b5d4'
  },

  // slides que começam escondidos. Ids: capa, especialista, quem-somos, antes, rx-<id da tela>, painel,
  // resolvemos, perfis, marcas, case, mkt, ferramenta, time, empilhamento-6, empilhamento-12,
  // valores, planos, garantia, fechamento, salvar
  ocultar: ['garantia'],               // o acordo com bônus não faz parte da operação

  capa: {
    tagline: 'Sistema comercial para empresas que vendem através de leads'
  },

  especialista: {
    kicker: 'Fundador',
    nome: 'Lucas Ribeker',
    local: 'Fundador da Ribeker · Revenue Operations',
    foto: 'assets/lucas.jpg',
    retrato: 'assets/lucas-retrato.jpg',   // foto em pé, ocupa a lateral do slide (sem ela, usa a foto redonda)
    numeros: [
      { valor: '11', rotulo: 'Anos de expertise' },
      { valor: '20+', rotulo: 'Clientes atendidos' }
    ],
    frase: '"Quando uma empresa investe em crescimento, ela não coloca apenas verba em jogo. Coloca o próprio sonho. Por isso, cada frente precisa ter meta, responsável e cobrança por resultado."'
  },

  quemSomos: {
    kicker: 'Quem somos · Revenue Operations',
    titulo: 'Conectamos aquisição, atendimento, vendas e gestão para transformar investimento em *receita mensurável*',
    publicoTitulo: 'Quem atendemos',
    numeros: [
      { valor: 'R$2M+', rotulo: 'Faturamento mensal dos clientes' },
      { valor: 'R$150K+', rotulo: 'Mídia/mês sob gestão' },
      { valor: '5', rotulo: 'Frentes, uma meta de receita' }
    ]
  },

  antes: {
    kicker: 'Antes de tudo',
    titulo: 'Vamos te entender *melhor*',
    etapas: ['Comercial', 'Marketing e Tráfego Pago'],
    sub: 'Algumas perguntas rápidas pra entender exatamente onde vocês estão hoje. Vamos marcando juntos.'
  },

  painel: {
    kicker: 'Raio-X · Resultado',
    titulo: 'O que o *diagnóstico* mostrou',
    mine: 'O que você conseguiu empilhar sozinho',
    nosso: 'A estimativa que a Ribeker entrega no mesmo prazo'
  },

  resolvemos: {
    kicker: 'O que resolvemos',
    titulo: 'Vendas Ribeker',
    etapas: [
      { nome: 'Social mídia', texto: 'Gera permanência e atenção do seu lead' },
      { nome: 'Tráfego pago', texto: 'Atrai o lead para nível de convivência e cadastro' },
      { nome: 'CRM / IA', texto: 'Organiza e atende' },
      { nome: 'Venda', texto: 'Lead organizado e acompanhado até o fechamento' }
    ],
    fecho: 'Isso é o que resolvemos: sua {empresa} nunca mais perde lead por falta de processo, do primeiro clique até {fimJornada}.'
  },

  perfis: {
    kicker: 'Quem atendemos',
    titulo: 'Cinco perfis, cada um com uma dor específica'
  },

  marcas: {
    kicker: 'Quem confia na Ribeker',
    titulo: 'Marcas que já rodam com a gente',
    sub: 'Projetos e operações em diferentes segmentos.',
    // logo: coloque o arquivo em assets/marcas/ e informe o caminho (ex.: assets/marcas/isentei.png); sem logo aparece o nome
    lista: [
      { nome: 'isentei', segmento: 'Isenção de IR', logo: 'assets/marcas/isentei.png' },
      { nome: 'isentoo', segmento: 'Isenção de IR', logo: 'assets/marcas/isentoo.png' },
      { nome: 'isente Já', segmento: 'Isenção de IR', logo: 'assets/marcas/isente-ja.png' },
      { nome: 'DUA', segmento: 'Arquitetura', logo: 'assets/marcas/dua.png' },
      { nome: 'Duran Esquadrias', segmento: 'Esquadrias', logo: 'assets/marcas/duran.png' },
      { nome: 'Multi Mármore', segmento: 'Mármores', logo: 'assets/marcas/multi-marmore.png' },
      { nome: 'Univerplast', segmento: 'Indústria de plásticos', logo: 'assets/marcas/univerplast.png' },
      { nome: 'Tango', segmento: 'Fantasias', logo: 'assets/marcas/tango.png' }
    ],
    frentesTitulo: 'O que roda nessas operações',
    frentes: ['Tráfego pago', 'CRM', 'Vendas', 'Analytics', 'Rede social'],
    destaque: '*Case em destaque: Isentei.* De cerca de 1 para 10 a 15 reuniões por dia e R$ 1 milhão de faturamento mensal. Na próxima página.'
  },

  case: {
    kicker: 'Resultado real · Case Isentei',
    nome: 'Isentei',
    descricao: 'Operação especializada em isenção de Imposto de Renda. O resultado real vem na próxima página.',
    insight: 'Havia demanda. Faltava um sistema preparado para escalar. O problema não era o tamanho do nicho: era transformar dados em ICP, qualificação e execução coordenada.',
    imagem: '',                         // com print (ex.: assets/case-print.jpg) ele aparece no lugar da lista "antes"
    legenda: '',
    antesTitulo: 'Antes da Ribeker',
    antes: [
      'Campanhas genéricas, leads fora do perfil',
      'CRM sem organização ou follow-up consistente',
      'Atendimento dependente de esforço manual',
      'Pouca visibilidade sobre o que gerava receita',
      'Marketing, atendimento e vendas desconectados'
    ],
    antesRodape: 'A escala foi construída etapa por etapa: ICP e qualificação, CRM e cadências, IA e automação, gestão e DRE.',
    numeros: [
      { valor: '~1', rotulo: 'Reunião por dia, antes' },
      { valor: '10–15', rotulo: 'Reuniões por dia, depois' },
      { valor: 'R$ 1 mi', rotulo: 'Faturamento mensal' },
      { valor: '4', rotulo: 'Camadas, medidas uma a uma' }
    ],
    rodape: 'Cada melhoria foi medida antes da entrada da próxima camada.',
  },

  mkt: {
    kicker: 'Você não vai ficar sozinho · Mkt',
    titulo: 'Tudo que o marketing faz por você',
    itens: [
      'Posicionamento de marca',
      'Atração e conversão de leads',
      'Tráfego pago (Meta Ads)',
      'Social mídia: até 8 posts por mês (criativos, carrosséis, conteúdo)'
    ],
    destaque: { valor: 'R$150K+', rotulo: 'em mídia por mês sob gestão, somando os projetos ativos' },
    imagem: ''                          // ex.: assets/instagram-case.png
  },

  ferramenta: {
    kicker: 'Você não vai ficar sozinho · Ferramenta',
    titulo: 'CRM e automação rodando 24h',
    itens: [
      'CRM com pipeline de vendas organizado',
      'IA no WhatsApp: atendimento, scripts e SLAs automatizados',
      'Automação de entrada de leads, disparo de mensagens, follow-up e confirmação',
      'Implementação completa, sem trabalho técnico pra você'
    ],
    imagem: ''                          // ex.: assets/crm-pipeline.jpg
  },

  time: {
    kicker: 'Você não vai ficar sozinho · Especialista',
    titulo: 'Quem te acompanha de perto',
    sub: 'Você fala direto com quem desenhou o Método Receita Real e já aplicou em mais de 20 operações, não com um consultor de fora dando palpite.',
    pessoas: [
      { nome: 'Lucas Ribeker', cargo: 'Fundador · Revenue Operations', texto: 'Conduz pessoalmente o seu projeto: estratégia, aquisição, CRM, atendimento e gestão da receita, com meta, responsável e cobrança por resultado em cada frente.', foto: 'assets/lucas.jpg' }
    ]
  },

  empilhamento: {
    kicker6: 'O que já é seu, mês a mês',
    titulo6: 'Resultado empilhado em *6 meses*',
    kicker12: 'Mantendo o trabalho por 12 meses',
    titulo12: 'O resultado empilhado *{fator12}*',
    evolucao: 'Estimativa · evolução mês a mês',
    partida: 'Seu ponto de partida, sozinho'
  },

  // parâmetros da conta do empilhamento (cada nicho define os seus em "projecao")
  projecao: {
    recorrente: true,                   // true: cada cliente novo paga todo mês, a receita empilha
    multiplicador: 2,                   // 2 = o dobro das vendas de hoje
    conta: 'total',                     // 'total' conta todas as vendas da meta; 'extra' só as que passam de hoje
    referencia: { base: 10, ticket: 278 },  // usado enquanto o cliente não informa os números
    baseRotulo: '{n} {clientes} novos/mês',
    explicacao: 'o dobro das {hoje} que você faz hoje'
  },

  valores: {
    kicker: 'Valores de mercado',
    titulo: 'Contratando cada peça separada',
    // salário médio no Brasil (Glassdoor, 2026) e preço de tabela do CRM; o "i" mostra a fonte
    itens: [
      { nome: 'Social mídia', valor: 'R$ 3.000/mês',
        fonte: 'Salário médio de Social Media no Brasil: R$ 3.000 por mês (faixa comum de R$ 2.150 a R$ 4.022). Glassdoor, 2026.' },
      { nome: 'Gestor de tráfego pago', valor: 'R$ 3.000/mês',
        fonte: 'Salário médio de Gestor de Tráfego Pago no Brasil: R$ 3.000 por mês. Glassdoor, abril de 2026.' },
      { nome: 'Especialista em RevOps (orienta o time de vendas)', valor: 'R$ 9.150/mês',
        fonte: 'Salário médio de RevOps Specialist no Brasil: R$ 9.150 por mês (faixa comum de R$ 5.375 a R$ 14.600). Glassdoor, junho de 2026.' },
      { nome: 'CRM com WhatsApp e IA (3 usuários)', valor: 'R$ 387/mês',
        fonte: 'Kommo, plano Avançado (automações, Salesbot e agente de IA): R$ 129 por usuário por mês no plano anual. 3 usuários = R$ 387. Tabela de 2026.' }
    ],
    totalRotulo: 'Total separado',
    total: 'R$ 15.537/mês',
    nota: 'Salários médios, sem encargos e sem a verba de anúncio.'
  },

  planos: {
    kicker: 'Seu investimento',
    titulo: 'Hoje qual plano faz sentido pra você',
    itens: [
      { nome: 'Tráfego + CRM', preco: 'R$ 2.989', per: ',00/mês', detalhe: 'Sem redes sociais',
        beneficios: ['Tráfego pago', 'CRM com a ferramenta inclusa durante o contrato', '1 conexão de WhatsApp e 1 de Instagram', '3 usuários'] },
      { nome: 'Completo', selo: 'Mais completo', destaque: true, preco: 'R$ 3.489', per: ',00/mês', detalhe: 'Redes sociais + tráfego + CRM',
        beneficios: ['Tudo do plano Tráfego + CRM', 'Redes sociais: até 8 posts por mês'] }
    ],
    nota: 'Contrato *sem fidelidade*: só 30 dias de aviso prévio. Conexões e usuários extras: valor sob consulta.',
    implantacao: ''                     // ex.: 'Implementação: ~~R$ 0.000,00~~ *R$ 000,00*'
  },

  garantia: {
    kicker: 'Acordo entre as partes',
    titulo: 'Vamos pro *tudo.*',
    sub: 'Porque o nada não faz parte da nossa trajetória.',
    meta6: '[Empilhamento batido conforme estimado: a Ribeker leva R$ 0.000,00 de bônus]',
    meta12: '[Empilhamento batido conforme estimado: a Ribeker leva R$ 0.000,00 de bônus]',
    rodape: 'Sem fidelidade: se não fizer sentido, você sai com 30 dias de aviso. O risco é nosso, não seu.'
  },

  fechamento: {
    kicker: 'Fechando hoje',
    titulo: 'Hoje é *o dia.*',
    texto: 'Quanto mais cedo você começar, mais cedo o empilhamento vira resultado real no seu bolso.',
    bonusRotulo: '',
    bonus: ''                           // sem bônus na operação; preencha para voltar a mostrar o card
  },

  salvar: {
    kicker: 'Diagnóstico',
    titulo: 'Salvar o *raio-X* desta {empresa}'
  },

  relatorio: {
    legenda: '*Como ler este relatório.* O percentual de cada área mostra o quanto dela já funciona por processo, e não por esforço individual. Quanto mais alto, menos a operação depende de alguém lembrar de fazer. Nas respostas: (ponto vermelho) ponto de atenção · (ponto amarelo) parcialmente resolvido · (ponto verde) já estruturado.',
    planoIntro: 'As ações abaixo saem direto das respostas dadas no diagnóstico. Elas estão organizadas da área mais crítica para a menos crítica, e dentro de cada área o que trava mais vem primeiro. Não é uma lista para fazer tudo ao mesmo tempo, é a ordem em que faz diferença.',
    planoFecho: '*Uma observação sobre esta lista.* Nenhuma dessas ações depende de mais {cliente} entrando na {empresa}. Todas dependem de organizar o que já existe. É por isso que o resultado costuma mudar antes de qualquer aumento de investimento.',
    rodape: 'Este relatório foi montado a partir das respostas dadas pela própria {empresa} durante o diagnóstico. Ele retrata o cenário de {data} e serve como referência para acompanhar a evolução ao longo do tempo.'
  }
};
