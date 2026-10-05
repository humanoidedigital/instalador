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
  // resolvemos, perfis, marcas, case-<id do case> (case-dua, case-patanegra, case-isentei, case-zero), ponte,
  // mkt, ferramenta, time, empilhamento-6, empilhamento-12, valores, planos, garantia, fechamento, salvar
  ocultar: ['garantia'],               // o acordo com bônus não faz parte da operação

  // palavras usadas nos cases; cada nicho pode trocar em "termos"
  termos: {
    compraPensada: 'qualquer compra de valor alto',   // "Igual a ..." no gancho do case Dua
    temHoje: 'nome e clientes'                          // "imagina numa {empresa} que já tem ..."
  },

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
    publicoTitulo: 'No seu segmento, funciona para',
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
    kicker: 'No seu segmento',
    titulo: 'Cinco perfis, cada um com uma dor específica'
  },

  marcas: {
    kicker: 'Um método, vários segmentos',
    titulo: 'Marcas de segmentos diferentes, *o mesmo método*',
    sub: 'Alguns destaques entre os mais de 20 clientes que já atendemos, de segmentos diferentes, no Brasil e no exterior. Os marcados com "case" vêm a seguir.',
    // logo: coloque o arquivo em assets/marcas/ e informe o caminho (ex.: assets/marcas/isentei.png); sem logo aparece o nome
    // case: true mostra o selo "case" (a marca tem slide de case logo depois)
    lista: [
      { nome: 'DUA', segmento: 'Arquitetura', logo: 'assets/marcas/dua.png', case: true },
      { nome: 'Empório Pata Negra', segmento: 'E-commerce gourmet', logo: '', case: true },
      { nome: 'isentei', segmento: 'Isenção de IR', logo: 'assets/marcas/isentei.png', case: true },
      { nome: 'isente Já', segmento: 'Isenção de IR', logo: 'assets/marcas/isente-ja.png', case: true },
      { nome: 'isentoo', segmento: 'Isenção de IR', logo: 'assets/marcas/isentoo.png', case: true },
      { nome: 'Duran Esquadrias', segmento: 'Esquadrias', logo: 'assets/marcas/duran.png' },
      { nome: 'Multi Mármore', segmento: 'Mármores', logo: 'assets/marcas/multi-marmore.png' },
      { nome: 'Univerplast', segmento: 'Indústria de plásticos', logo: 'assets/marcas/univerplast.png' },
      { nome: 'Tango', segmento: 'Fantasias', logo: 'assets/marcas/tango.png' }
    ],
    frentesTitulo: 'O que roda nessas operações',
    frentes: ['Tráfego pago', 'CRM', 'Vendas', 'Analytics', 'Rede social'],
    destaque: '*Nada de print de curtida.* A seguir, empresas de segmentos diferentes, algumas começando do zero, e o que aconteceu no caixa delas.'
  },

  // Cases: todos contam a mesma história. Anúncio sozinho não paga boleto; o que paga é a operação que leva
  // o contato até o caixa. Cada case é um degrau dessa escada, do mais simples ao mais completo.
  // Esqueleto: gancho, antes, virada, resultado, moral. "obs" aparece no slide (de onde vem o número);
  // "fala" é a versão de 30 segundos, nas notas do apresentador (tecla N).
  cases: {
    kicker: 'Case',                     // vira "Case 1 de 4 · Arquitetura"
    antesRotulo: 'Antes',
    viradaRotulo: 'A virada',
    resultadoRotulo: 'Resultado',
    lista: [
      {
        id: 'dua', marca: 'Dua Arquitetura', segmento: 'Arquitetura · ticket alto',
        logos: ['assets/marcas/dua.png'],
        titulo: '*7 projetos* fechados em um único mês',
        gancho: 'Projeto de arquitetura não é compra por impulso. O cliente pesquisa, compara, some e volta. Igual a {compraPensada}.',
        antes: 'Sem processo comercial, sem CRM e sem tráfego pago: só post impulsionado no Instagram, sem saber o que virava cliente. Orçamento enviado virava silêncio.',
        virada: 'Tráfego no Google e na Meta falando com quem já planejava obra ou reforma, e CRM acompanhando cada contato até o contrato, sem deixar orçamento esfriar.',
        frentes: ['Tráfego pago (Google e Meta)', 'CRM'],
        numeros: [
          { valor: '7', rotulo: 'Projetos fechados no mês, de 7 clientes diferentes' },
          { valor: 'R$ 245 mil', rotulo: 'Em projetos contratados no mês' }
        ],
        moral: 'Em venda de ticket alto, o que importa não é quantos leads chegaram. É quantos contratos saíram no fim do mês.',
        obs: 'R$ 245 mil = 7 projetos × R$ 35 mil de ticket médio, todos vindos de campanhas no Google e na Meta.',
        fala: '"A Dua Arquitetura é um escritório que, antes da gente, só impulsionava post no Instagram. Projeto caro, cliente que pensa muito antes de fechar, parecido com {compraPensada}. A gente montou o tráfego no Google e na Meta e um CRM, e, num único mês, eles fecharam sete projetos. Não sete leads: sete clientes diferentes, com contrato assinado. Perto de duzentos e quarenta e cinco mil reais em projetos. É esse tipo de número que eu quero olhar com você."'
      },
      {
        id: 'patanegra', marca: 'Empório Pata Negra', segmento: 'E-commerce gourmet',
        logos: [],
        titulo: 'November Black: *R$\u00a0220\u00a0mil* com R$\u00a06\u00a0mil de anúncio',
        gancho: 'Todo mundo faz Black Friday. A gente fez o mês inteiro.',
        antes: 'E-commerce de alto padrão (jamón, paella, gourmet) diante da Black Friday de todo ano: um fim de semana disputado por todas as lojas, anúncio caro e cliente cansado de desconto.',
        virada: 'Novembro inteiro de campanha: ofertas escalonadas semana a semana, aquecimento da base antes dos picos e anúncios sustentando o mês, com o pico na semana da Black Friday.',
        frentes: ['Estratégia comercial', 'Tráfego pago'],
        numeros: [
          { valor: '~R$ 220 mil', rotulo: 'Em vendas atribuídas aos anúncios em novembro' },
          { valor: '~R$ 6 mil', rotulo: 'De investimento em mídia' },
          { valor: '~36x', rotulo: 'ROAS: cada R$ 1 voltou como R$ 36' }
        ],
        moral: 'Verba pequena não é desculpa. Uma ideia comercial certa, no calendário certo, rende mais do que dobrar o orçamento de anúncio.',
        obs: 'Valores aproximados de um mês sazonal (novembro de 2025), não uma média mensal.',
        fala: '"O Empório Pata Negra vende jamón e produtos gourmet online. Na Black Friday, todo mundo briga pelo mesmo fim de semana. Eu propus fazer o mês inteiro, a November Black. Com seis mil reais de anúncio, os anúncios trouxeram perto de duzentos e vinte mil em vendas no mês. Trinta e seis vezes o investimento. O ponto não é a verba, é a estratégia comercial por trás dela."'
      },
      {
        id: 'isentei', marca: 'Isentei', segmento: 'Isenção de IR · serviços',
        logos: ['assets/marcas/isentei.png'],
        titulo: 'De 1 para *10 a 15 reuniões* por dia',
        gancho: 'O problema dessa empresa não era falta de lead. Era o que acontecia com o lead depois que ele chegava.',
        antes: 'Cerca de 1 reunião por dia. Sem CRM, sem processo comercial, campanha sem segmentação, sem rastreamento, sem IA e sem follow-up: quem não respondia na primeira mensagem se perdia.',
        virada: 'Uma operação só: campanhas por perfil de cliente, qualificação, CRM com cadências, agentes de IA atendendo no WhatsApp e por ligação, e indicadores para gerir tudo.',
        frentes: ['Tráfego pago', 'CRM', 'IA no WhatsApp e ligação', 'Vendas', 'Analytics'],
        numeros: [
          { valor: '~1', rotulo: 'Reunião por dia, antes' },
          { valor: '10–15', rotulo: 'Reuniões por dia, depois' },
          { valor: 'R$ 1 mi', rotulo: 'De faturamento em um mês de 2026' }
        ],
        moral: 'Quando captação, atendimento e vendas conversam entre si, a mesma verba rende muito mais. Esse é o Receita Real completo.',
        obs: 'Escopo completo (captação, atendimento, vendas e gestão), não efeito de tráfego pago isolado.',
        fala: '"Esse é o case que mostra onde a gente pode chegar juntos. A Isentei fazia uma reunião por dia antes de a gente assumir. A gente organizou tudo: campanha, CRM, acompanhamento e IA atendendo no WhatsApp e no telefone. Foram para dez, quinze reuniões por dia, e teve mês de um milhão. Não começa assim, mas é pra lá que a gente vai."\nNunca apresentar como previsão para a {empresa}.'
      },
      {
        id: 'zero', marca: 'IsenteJá e Isentoo', segmento: 'Isenção de IR · criadas do zero',
        logos: ['assets/marcas/isente-ja.png', 'assets/marcas/isentoo.png'],
        titulo: 'Duas empresas *do zero* a R$\u00a0400–500\u00a0mil por mês',
        gancho: 'Não tinha site, não tinha Instagram, não tinha cliente. Tinha só a ideia.',
        antes: 'Duas empresas de isenção de IR começando literalmente do zero: sem marca, sem canal de venda, sem base de clientes.',
        virada: 'A operação de receita inteira: site, redes sociais, tráfego pago, CRM, automação e agentes de IA no WhatsApp e por ligação. O negócio foi construído junto com a máquina de vendas.',
        frentes: ['Site', 'Redes sociais', 'Tráfego pago', 'CRM', 'Automação', 'IA no WhatsApp e ligação'],
        // tabela no lugar dos números grandes
        tabela: {
          colunas: ['', 'Mídia', 'Faturamento', 'Por R$ 1 de mídia'],
          linhas: [
            ['IsenteJá, 1º mês', '~R$ 10 mil', 'pouco menos de R$ 150 mil', '~15x'],
            ['Isentoo, 1º mês', '~R$ 10 mil', 'R$ 180 mil', '~18x'],
            ['Hoje, cada empresa', 'R$ 25 mil/mês', 'R$ 400 a 500 mil/mês', '~16x a 20x']
          ],
          rodape: 'Somadas, as duas faturam hoje entre *R$ 800 mil e R$ 1 milhão por mês*.'
        },
        moral: 'Funcionou duas vezes, do zero. Isso não é sorte de campanha: é método que se repete.',
        obs: 'Faturamento total de cada empresa, não só o atribuído aos anúncios.',
        fala: '"Esse é o case que eu mais gosto. Duas empresas que não existiam: sem site, sem rede social, sem cliente. A gente montou tudo, do site ao CRM. No primeiro mês, com uns dez mil de anúncio cada, uma faturou perto de cento e cinquenta mil e a outra, cento e oitenta mil. Hoje cada uma fatura entre quatrocentos e quinhentos mil por mês, com vinte e cinco mil de mídia. Se funciona começando do zero, imagina numa {empresa} que já tem {temHoje}."'
      }
    ]
  },

  // depois dos cases: os cases provam o método, não prometem o resultado. A conta usa os números do raio-x
  ponte: {
    kicker: 'Dos cases para a sua {empresa}',
    titulo: 'Os cases provam o *método*. O seu resultado sai dos seus números.',
    texto: 'Segmentos diferentes, um ponto em comum: a gente não parou no anúncio. Acompanhou até o contrato, até o pedido, até a reunião.',
    pergunta: 'No seu caso, a pergunta é uma só: quantas {vendas} a mais por mês saem pela internet?',
    pagaRotulo: 'a operação inteira',   // "1 venda a mais por mês já paga ...": o número e o detalhe saem do ticket do raio-x
    convite: 'Quero começar pequeno, provar isso com você e fazer da sua {empresa} o próximo case.',
    obs: 'Nenhum número dos cases entra na sua conta: os cenários saem do seu ticket, da sua margem e da sua capacidade de atendimento.',
    fala: '"Três negócios diferentes, um ponto em comum: a gente não parou no anúncio. Acompanhou até o contrato, até o pedido, até a reunião. No seu caso, a pergunta é uma só: quantas {vendas} a mais por mês saem pela internet. Eu quero começar pequeno, provar isso com você e fazer da sua {empresa} o meu próximo case."\nTroca a métrica (sai "leads", entra {vendas}), reduz o risco ("uma {venda} paga tudo") e assume a parceria. Não transferir ROAS, ticket ou faturamento dos cases para a {empresa}.'
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
