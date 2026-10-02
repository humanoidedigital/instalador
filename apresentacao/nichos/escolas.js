/* Nicho: Escolas e cursos. É o pitch original, com as perguntas do raio-x como foram feitas para educação.
   Serve de modelo para criar outros nichos (copie, troque o id e adapte).

   Estrutura:
     id, nome, descricao  → aparecem no seletor de nicho
     termos               → palavras usadas nos textos da marca ({venda}, {cliente}, {receita}...)
     capa, publico, perfis, case → conteúdo dos slides deste nicho (qualquer chave de marca.js pode ser sobrescrita aqui)
     areas                → áreas do placar; só as que têm pergunta com peso entram na nota
     raiox                → as telas do raio-x, na ordem em que aparecem
     projecao             → parâmetros da conta do empilhamento

   Telas do raio-x:
     area     → a qual área do placar a tela pertence
     campos   → números digitados. Ids que entram nas contas: vendas, ticket, meses, custo, receitaIni, receitaHoje
     perguntas:
       tipo 'unica'    → uma resposta; cada opção tem "dor": 0 (estruturado), 0.5 (parcial), 1 (ponto de atenção).
                         Opção sem "dor" não pontua. "campo" abre uma caixinha de texto (ex.: "qual?").
       tipo 'multipla' → várias respostas. Com "bom: 3" pontua (3 ou mais = estruturado, 2 = parcial, 1 = atenção).
                         Sem "bom" só registra.
       acao            → entra no plano de ação do PDF quando a resposta indica dor */
NICHO({
  id: 'escolas',
  nome: 'Escolas e cursos',
  descricao: 'Escolas de idiomas, cursos profissionalizantes, escolas particulares e faculdades. O pitch original.',

  termos: {
    empresa: 'escola', empresas: 'escolas',
    cliente: 'aluno', clientes: 'alunos',
    venda: 'matrícula', vendas: 'matrículas',
    ticket: 'ticket médio',
    receita: 'receita', suaReceita: 'sua receita',
    fimJornada: 'a cadeira ocupada em sala'
  },

  capa: { tagline: 'Sistema comercial para negócios de educação' },

  publico: ['Escolas de idiomas', 'Cursos profissionalizantes', 'Escolas regulares particulares', 'Faculdades', 'Empresas com equipe comercial'],

  perfis: {
    itens: [
      { perfil: 'Escolas de idiomas', dor: 'Concorrência de franquia, captação o ano inteiro' },
      { perfil: 'Cursos profissionalizantes', dor: 'Decisão rápida, janela curta de urgência' },
      { perfil: 'Escolas regulares particulares', dor: 'Matrícula sazonal, a rematrícula decide o ano' },
      { perfil: 'Faculdades', dor: 'Ciclo longo, nutrição até a matrícula' },
      { perfil: 'Empresas com time comercial', dor: 'Lead sem qualificação, time caro parado' }
    ]
  },

  case: {
    nome: '[Nome da escola]',
    descricao: '[Rede de escolas de idiomas.] O resultado real vem na próxima página.',
    insight: '[Atendemos dezenas de escolas e redes de ensino em todo o Brasil, incluindo franquias que você conhece.] A armadilha silenciosa de toda marca forte é acreditar que a marca vende sozinha.'
  },

  areas: [
    { id: 'comercial', nome: 'Comercial' },
    { id: 'marketing', nome: 'Marketing e Tráfego Pago' }
  ],

  raiox: [
    {
      id: 'vendas', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Vendas e *Prospecção*',
      campos: [
        { id: 'equipe', rotulo: 'Tamanho da equipe comercial?', suf: 'pessoas', unidade: 'pessoas' }
      ],
      perguntas: [
        { texto: 'Quem vende hoje na escola?', tipo: 'multipla',
          opcoes: ['Dono', 'Diretor', 'Professor', 'Secretária', 'Comercial'] },
        { texto: 'Como a instituição vende?', tipo: 'unica',
          opcoes: [{ t: 'Existe processo de venda definido', dor: 0 }, { t: 'Cada um vende do seu jeito que sabe', dor: 1 }],
          acao: 'Definir um processo de venda único, com as mesmas etapas para todo mundo que atende.' },
        { texto: 'Comercial faz ativo?', sub: 'Prospecção via parcerias, reuniões, network, eventos', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar prospecção ativa na rotina da semana: parcerias, visitas, eventos e network.' },
        { texto: 'Tem meta de matrícula definida?', tipo: 'unica',
          opcoes: [{ t: 'Sim, diária/semanal/mensal', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem metas', dor: 1 }],
          acao: 'Quebrar a meta do mês em meta de semana e de dia, com acompanhamento à vista.' },
        { texto: 'Tem líder ou gerente comercial?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter uma pessoa responsável pelo comercial, que acompanha a meta e o time toda semana.' }
      ]
    },
    {
      id: 'marketing', area: 'marketing',
      kicker: 'Raio-X · Especialista',
      titulo: 'Marketing e *Tráfego Pago*',
      sub: 'Diagnóstico de tráfego pago, redes sociais e capacidade de atendimento',
      perguntas: [
        { texto: 'A empresa já realizou anúncios no Meta Ads (Instagram/Facebook)?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'A empresa já investiu/investe em outros canais de publicidade?', tipo: 'unica', opcoes: [{ t: 'Sim, qual?', campo: 'canal' }, 'Não'] },
        { texto: 'A empresa já teve resultados positivos com anúncios pagos?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'A empresa possui verba mensal definida para investir em tráfego pago?', tipo: 'unica', opcoes: [{ t: 'Sim, quanto?', campo: 'R$/mês' }, 'Não'] },
        { texto: 'A empresa possui capacidade para atender uma demanda maior de clientes?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Já possui um WhatsApp Business para receber os contatos gerados pelos anúncios?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Tem constância/frequência de postagens nas redes sociais?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Tem estratégia por trás das postagens?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Produz conteúdos como vídeos, fotos e imagens dos produtos/serviços?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Já realiza vendas e fechamento de negócios através das redes sociais?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'As redes sociais estão preparadas para receber clientes?', tipo: 'unica', opcoes: ['Sim', '+ ou -', 'Não'] }
      ]
    },
    {
      id: 'leads', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Geração de Leads e *Marketing*',
      sub: 'Como a escola atrai e se posiciona hoje',
      perguntas: [
        { texto: 'Quais os funis de geração de lead da escola?', tipo: 'multipla', bom: 3,
          opcoes: ['Tráfego pago', 'Orgânico / Social selling empresa', 'Orgânico / Colaborador', 'Captação ativa (externa)', 'Real interessado', 'Lead base', 'Indicação', 'Remarketing', 'Contrapropostas'],
          acao: 'Abrir mais de uma origem de lead, para o resultado não depender de um canal só.' },
        { texto: 'Hoje tem posicionamento na cidade?', sub: 'Marca, não só oferta', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir pelo que a escola quer ser reconhecida na cidade e repetir isso em toda comunicação.' },
        { texto: 'Tem um social mídia?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter alguém responsável pelas redes, com rotina de publicação definida.' },
        { texto: 'Tem estratégias de postagem?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar linha editorial com pauta da semana, no lugar de postar por impulso.' },
        { texto: 'Instagram: sabe o que é topo, meio e fundo de funil?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Dividir o conteúdo entre atrair, relacionar e converter, com peso definido para cada etapa.' },
        { texto: 'Tem tráfego pago rodando hoje?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Começar campanha paga com verba controlada e custo por lead medido desde o primeiro dia.' }
      ]
    },
    {
      id: 'ferramentas', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Ferramentas*',
      sub: 'O que já está implementado tecnicamente',
      perguntas: [
        { texto: 'Tem CRM pra captação e organização dos leads?', tipo: 'unica',
          opcoes: [{ t: 'Sim, qual?', dor: 0, campo: 'ferramenta' }, { t: 'Não', dor: 1 }],
          acao: 'Implantar CRM para registrar todo lead que chega, com dono e etapa.' },
        { texto: 'Tem automação de mensagens (WhatsApp, Instagram e e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar as mensagens de entrada, confirmação e lembrete, para nenhum lead esperar resposta.' },
        { texto: 'O funil de vendas está desenhado dentro do CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Desenhar as etapas do funil dentro do CRM, do primeiro contato até a matrícula.' },
        { texto: 'Tem relatórios/dashboard pro líder acompanhar as métricas?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar um painel com leads, conversão e matrículas para o líder acompanhar toda semana.' }
      ]
    },
    {
      id: 'atendimento', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Atendimento e *Follow-up*',
      sub: 'Como o lead é tratado depois que chega',
      perguntas: [
        { texto: 'Quem faz a qualificação do lead?', tipo: 'multipla',
          opcoes: ['Dono', 'Secretária', 'Líder/gerente', 'SDR', 'Closer'] },
        { texto: 'Tem tempo médio de resposta definido?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Definir um tempo máximo de resposta ao lead e medir se ele está sendo cumprido.' },
        { texto: 'Existe script/roteiro de atendimento?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro de atendimento, do primeiro contato até o agendamento da visita.' },
        { texto: 'Tem follow-up estruturado depois do primeiro contato?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar régua de follow-up com prazo e responsável, do primeiro contato até a matrícula.' },
        { texto: 'Tem cadência de reativação de leads frios?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar cadência para reativar os leads frios da base antes de cada período de matrícula.' }
      ]
    },
    {
      id: 'resultados', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Resultados*',
      sub: 'Os números de hoje viram a base do comparativo mostrado mais à frente.',
      campos: [
        { id: 'vendas', rotulo: 'Média de matrículas mensais', suf: 'alunos / mês', unidade: 'alunos/mês' },
        { id: 'ticket', rotulo: 'Ticket médio', pre: 'R$', suf: 'R$ / mês' },
        { id: 'cac', rotulo: 'CAC (custo de aquisição por aluno)', pre: 'R$', suf: 'R$' },
        { id: 'conversao', rotulo: 'Taxa de conversão de leads', suf: '%', unidade: '%' }
      ]
    },
    {
      id: 'tempo', area: 'comercial',
      kicker: 'Raio-X · O custo de esperar',
      titulo: 'Tempo, investimento e *resultado*',
      sub: 'As últimas respostas viram o comparativo da próxima tela.',
      campos: [
        { id: 'meses', rotulo: 'Há quantos meses vocês tentam ajustar o comercial?', suf: 'meses', unidade: 'meses' },
        { id: 'custo', rotulo: 'Custo operacional mensal (Comercial)', sub: 'Colaborador · Gestor · Tráfego/anúncio · Ferramentas · Social mídia', pre: 'R$', suf: 'R$ / mês' },
        { id: 'receitaIni', rotulo: 'Há {meses}, a receita mensal era de?', pre: 'R$', suf: 'R$ / mês, no início' },
        { id: 'receitaHoje', rotulo: 'Hoje a receita mensal está em?', pre: 'R$', suf: 'R$ / mês, hoje' }
      ]
    }
  ],

  projecao: {
    recorrente: true,                   // cada aluno novo paga mensalidade todo mês: a receita empilha
    multiplicador: 2,                   // o dobro das matrículas de hoje
    conta: 'total',
    referencia: { base: 10, ticket: 278 },
    baseRotulo: '{n} alunos novos/mês',
    explicacao: 'o dobro das {hoje} que você faz hoje'
  }
});
