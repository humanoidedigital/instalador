/* Marca: tudo que é igual em todos os nichos.
   Qualquer chave daqui pode ser sobrescrita dentro de um arquivo de nicho (mesmo nome, mesmo formato).

   Convenções nos textos:
     *palavra*      destaca em azul
     [texto]        marca o que ainda falta preencher (aparece com contorno tracejado)
     ~~texto~~      riscado (ex.: preço "de")
     {venda}        troca pelo termo do nicho: {empresa} {empresas} {cliente} {clientes} {venda} {vendas} {ticket}
                    com inicial maiúscula: {Venda} {Vendas} {Empresa}...
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

  // slides que começam escondidos (ids: capa, especialista, quem-somos, problema, raiox, numeros, tempo,
  // painel, metodo, perfis, case, entregas, time, projecao-6, projecao-12, valores, planos, garantia, fechamento, salvar)
  ocultar: [],

  capa: {
    kicker: 'Raio-X de Receita',
    titulo: 'Onde a sua receita *se perde* entre o clique e a {venda}',
    sub: 'Um diagnóstico feito junto com você, com os seus números, em menos de 30 minutos.'
  },

  especialista: {
    kicker: 'Quem conduz',
    nome: 'Lucas Ribeker',
    cargo: '[Fundador da Ribeker · Estrategista de receita]',
    local: '[Cidade, UF]',
    foto: '',                           // ex.: assets/lucas.jpg (coloque o arquivo na pasta assets)
    numeros: [
      { valor: '[10+]', rotulo: 'anos em marketing e vendas' },
      { valor: '[100+]', rotulo: 'empresas atendidas' },
      { valor: '[R$ 0 mi]', rotulo: 'em receita acompanhada' }
    ]
  },

  quemSomos: {
    kicker: 'Quem somos',
    titulo: 'Assessoria de *receita* para empresas que vendem através de leads',
    publicoTitulo: 'Quem atendemos',
    numeros: [
      { valor: '[100+]', rotulo: 'empresas atendidas' },
      { valor: '[10]', rotulo: 'estados' },
      { valor: '[4]', rotulo: 'nichos com método próprio' }
    ]
  },

  problema: {
    kicker: 'Para empresas que vendem através de leads',
    titulo: 'Dos leads que você paga, *quantos viram {venda} de verdade?*',
    texto: 'Você investe em anúncio todo mês, mas a {venda} não acompanha. Na maioria das vezes, o problema não está no tráfego. Está na operação entre o clique e a {venda}.',
    pilares: [
      { nome: 'Atendimento', texto: 'Quanto tempo o lead espera e o que ouve quando é atendido.' },
      { nome: 'CRM', texto: 'Onde o lead fica registrado e quem é responsável por ele.' },
      { nome: 'Follow-up', texto: 'O que acontece com quem não respondeu ou não decidiu.' },
      { nome: 'Medição', texto: 'Quanto custa cada lead e cada {venda}, por canal.' }
    ]
  },

  raiox: {
    kicker: 'Antes de tudo',
    titulo: 'Vamos entender *onde a receita se perde*',
    sub: 'Algumas perguntas rápidas sobre como funciona hoje. Vamos marcando juntos.'
  },

  numeros: {
    kicker: 'Raio-X · Números',
    titulo: 'Os números de *hoje*',
    sub: 'Viram a base da conta que aparece mais à frente. Pode ser aproximado.',
    campos: {
      leads:  { rotulo: 'Leads por mês', hint: 'Contatos novos, de todos os canais', suf: 'leads / mês' },
      vendas: { rotulo: '{Vendas} por mês', hint: 'Média dos últimos meses', suf: '{vendas} / mês' },
      ticket: { rotulo: '{Ticket}', pre: 'R$', suf: 'por {venda}' },
      midia:  { rotulo: 'Investimento em anúncios', hint: 'Meta, Google, portais', pre: 'R$', suf: 'por mês' }
    }
  },

  tempo: {
    kicker: 'Raio-X · O custo de esperar',
    titulo: 'Tempo, investimento e *resultado*',
    sub: 'Essas respostas viram o comparativo da próxima tela.',
    campos: {
      meses:       { rotulo: 'Há quantos meses vocês tentam aumentar as {vendas}?', suf: 'meses' },
      custo:       { rotulo: 'Custo mensal de comercial e marketing', hint: 'Equipe, anúncios, ferramentas, agência', pre: 'R$', suf: 'por mês' },
      receitaIni:  { rotulo: 'Há {meses}, a receita mensal era de', pre: 'R$', suf: 'por mês, no início' },
      receitaHoje: { rotulo: 'E hoje a receita mensal está em', pre: 'R$', suf: 'por mês, hoje' }
    }
  },

  painel: {
    kicker: 'Raio-X · Resultado',
    titulo: 'O que o *diagnóstico* mostrou',
    nosso: 'Com o Método Receita Real'
  },

  metodo: {
    kicker: 'Como resolvemos',
    nome: 'Método Receita Real',
    titulo: 'Método *Receita Real*',
    etapas: [
      { nome: 'Diagnóstico', texto: 'Mapeamos onde a receita vaza, do clique à {venda}.' },
      { nome: 'Atendimento', texto: 'Resposta em minutos, roteiro claro e o lead conduzido até a decisão.' },
      { nome: 'CRM e automação', texto: 'Todo lead registrado, distribuído e lembrado. Nada fica perdido no WhatsApp.' },
      { nome: 'Follow-up', texto: 'Cadência para quem não respondeu, não decidiu ou esfriou.' },
      { nome: 'Medição', texto: 'Custo por lead, conversão e receita por canal, toda semana.' }
    ],
    fecho: 'Primeiro a gente transforma em {venda} o lead que você já paga. Depois, se fizer sentido, aumenta a verba.'
  },

  perfis: {
    kicker: 'Quem atendemos',
    titulo: 'Cada perfil perde receita *num ponto diferente*'
  },

  case: {
    kicker: 'Resultado real',
    cliente: '[Nome do cliente]',
    segmento: '[Segmento · cidade]',
    texto: '[Em duas linhas: como era antes e o que mudou depois do método.]',
    imagem: '',                         // ex.: assets/case-print.jpg
    numeros: [
      { valor: '[+00%]', rotulo: '[em {vendas} no período]' },
      { valor: '[0 min]', rotulo: '[tempo médio de resposta]' },
      { valor: '[R$ 0]', rotulo: '[de receita a mais]' }
    ]
  },

  entregas: {
    kicker: 'Você não fica sozinho',
    titulo: 'O que a Ribeker *faz por você*',
    itens: [
      { nome: 'Atendimento', itens: ['Roteiro de atendimento até o fechamento', 'Treinamento do time', 'Meta de tempo de resposta'] },
      { nome: 'CRM e automação', itens: ['CRM implantado com o seu funil', 'Distribuição automática dos leads', 'Mensagens automáticas e lembretes'] },
      { nome: 'Follow-up', itens: ['Cadência para quem não respondeu', 'Reativação da base antiga', 'Recuperação de quem não decidiu'] },
      { nome: 'Tráfego e medição', itens: ['Gestão de anúncios', 'Painel com custo por lead e por {venda}', 'Reunião de resultado todo mês'] }
    ]
  },

  time: {
    kicker: 'Quem te acompanha',
    titulo: 'Gente que já fez isso *antes*',
    pessoas: [
      { nome: 'Lucas Ribeker', cargo: '[Estratégia de receita]', texto: '[O que faz no projeto, em uma linha.]', foto: '' },
      { nome: '[Nome]', cargo: '[CRM e automação]', texto: '[O que faz no projeto, em uma linha.]', foto: '' },
      { nome: '[Nome]', cargo: '[Tráfego pago]', texto: '[O que faz no projeto, em uma linha.]', foto: '' }
    ]
  },

  projecao: {
    // parâmetros da conta (cada nicho define os seus):
    recorrente: false,                  // true = cada cliente novo paga todo mês (a receita empilha)
    ganho: 0.3,                         // 0.3 = +30% sobre as vendas de hoje, vindas dos mesmos leads
    referencia: { vendas: 10, ticket: 300 }, // usada enquanto os números não forem preenchidos
    // textos:
    kicker6: 'O que já é seu, mês a mês',
    titulo6: 'Resultado em *6 meses*',
    kicker12: 'Se o compromisso for de 12 meses',
    titulo12: 'Em 12 meses, o resultado *{fator12}*',
    nota: 'Conta só as {vendas} a mais vindas dos leads que você já recebe. Não considera aumento de verba.'
  },

  valores: {
    kicker: 'Valores de mercado',
    titulo: 'Contratando cada peça *separada*',
    itens: [
      { nome: 'Gestão de tráfego', valor: '[R$ 0.000/mês]' },
      { nome: 'CRM e automação', valor: '[R$ 0.000/mês]' },
      { nome: 'Consultoria comercial', valor: '[R$ 0.000/mês]' },
      { nome: 'Treinamento do time', valor: '[R$ 0.000]' }
    ],
    totalRotulo: 'Total separado',
    total: '[R$ 00.000/mês]'
  },

  planos: {
    kicker: 'Seu investimento',
    titulo: 'Qual plano faz *sentido pra você*',
    itens: [
      { nome: '6 meses', preco: '[R$ 0.000]', per: '/mês', detalhe: '[6x de R$ 0.000 = R$ 00.000]',
        beneficios: ['Método Receita Real completo', '[Benefício]'] },
      { nome: '12 meses', selo: 'Mais vantajoso', destaque: true, preco: '[R$ 0.000]', per: '/mês', detalhe: '[12x de R$ 0.000 = R$ 00.000]',
        beneficios: ['Tudo do plano de 6 meses', 'Mensalidade mais baixa', '[Benefício]'] }
    ],
    implantacao: 'Implantação: [~~R$ 0.000~~] *[R$ 000]*'
  },

  garantia: {
    kicker: 'Acordo entre as partes',
    titulo: 'O risco fica *com a gente*',
    texto: '[Descreva o seu acordo de resultado. Os valores abaixo são a estimativa calculada para esta {empresa}.]',
    meta6: '[Batendo a estimativa: bônus de R$ 0.000 para a Ribeker]',
    meta12: '[Batendo a estimativa: bônus de R$ 0.000 para a Ribeker]',
    rodape: '[Se a gente não bater a estimativa, não tem bônus nenhum.]'
  },

  fechamento: {
    kicker: 'Fechando hoje',
    titulo: 'Hoje é *o dia*.',
    texto: 'Quanto antes começar, antes os leads que você já paga viram {vendas}.',
    bonusRotulo: 'Bônus para quem fecha hoje',
    bonus: '[Ex.: auditoria completa do seu WhatsApp comercial]'
  },

  contato: {
    whatsapp: '[(00) 00000-0000]',
    site: '[ribeker.com.br]',
    instagram: '[@ribeker]'
  },

  salvar: {
    kicker: 'Diagnóstico',
    titulo: 'Salvar o *raio-X*'
  },

  relatorio: {
    proximos: [
      'Reunião de devolutiva com o plano completo',
      'Implantação do CRM e do roteiro de atendimento em [00] dias',
      'Primeira leitura de resultado em [30] dias'
    ]
  }
};
