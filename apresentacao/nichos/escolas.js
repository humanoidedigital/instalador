/* Nicho: Escolas e cursos. É o pitch original, com as perguntas do raio-x como foram feitas para educação.
   Serve de modelo para criar outros nichos (copie, troque o id e adapte).

   Estrutura:
     id, nome, descricao  → aparecem no seletor de nicho
     termos               → palavras usadas nos textos da marca ({venda}, {cliente}, {receita}...)
     capa, publico, perfis       → conteúdo dos slides deste nicho (qualquer chave de marca.js pode ser sobrescrita aqui)
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
       acao            → entra no plano de ação do PDF quando a resposta indica dor
       tema            → assunto da pergunta. Um estilo de parceiro pode esconder um tema inteiro
                         (ex.: 'social' some com o parceiro de social mídia)
       id              → nome da pergunta, usado por "depende"
       area            → troca a área do placar só desta pergunta (ex.: uma pergunta de tela informativa que pontua)
       depende         → pergunta condicional. Some da tela quando outra pergunta tem certa resposta:
                         { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' }
                           oculta    → índices das opções da pergunta de origem que escondem esta (0 = primeira)
                           resposta  → opção que passa a valer sozinha (entra no placar e no relatório, com o motivo).
                                       Sem "resposta", a pergunta só sai da conta.
                         { q: 'funis', semOpcao: 0 } → some quando a múltipla de origem foi respondida sem a opção 0.
                         Com q: ['a', 'b'], só some se todas as de origem indicarem. Aceita uma lista de condições. */
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
    fimJornada: 'a cadeira ocupada em sala',
    compraPensada: 'quem escolhe uma escola',   // gancho do case Dua
    temHoje: 'nome e alunos'
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
        { id: 'quemvende', texto: 'Quem vende hoje na escola?', tipo: 'multipla',
          opcoes: ['Dono', 'Diretor', 'Professor', 'Secretária', 'Comercial'] },
        { id: 'processo', texto: 'Como a instituição vende?', tipo: 'unica',
          opcoes: [{ t: 'Existe processo de venda definido', dor: 0 }, { t: 'Cada um vende do seu jeito que sabe', dor: 1 }],
          acao: 'Definir um processo de venda único, com as mesmas etapas para todo mundo que atende.' },
        { id: 'ativo', texto: 'Comercial faz ativo?', sub: 'Prospecção via parcerias, reuniões, network, eventos', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar prospecção ativa na rotina da semana: parcerias, visitas, eventos e network.' },
        { id: 'meta', texto: 'Tem meta de matrícula definida?', tipo: 'unica',
          opcoes: [{ t: 'Sim, diária/semanal/mensal', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem metas', dor: 1 }],
          acao: 'Quebrar a meta do mês em meta de semana e de dia, com acompanhamento à vista.' },
        { id: 'lider', texto: 'Tem líder ou gerente comercial?', tipo: 'unica',
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
        // pontua no Comercial, como no original ("tem tráfego pago rodando hoje?")
        { id: 'trafego', area: 'comercial', texto: 'Tem anúncio pago rodando hoje?', sub: 'Meta Ads (Instagram/Facebook), Google ou outro canal', tipo: 'unica',
          opcoes: [{ t: 'Sim, onde?', dor: 0, campo: 'canal' }, { t: 'Já anunciou, mas parou', dor: 1 }, { t: 'Nunca anunciou', dor: 1 }],
          acao: 'Começar campanha paga com verba controlada e custo por lead medido desde o primeiro dia.' },
        { id: 'resultado', texto: 'Já teve resultado positivo com anúncio pago?', tipo: 'unica', opcoes: ['Sim', 'Não'],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' } },
        { id: 'capacidade', texto: 'A escola tem capacidade para atender uma demanda maior de alunos?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { id: 'posta', tema: 'social', texto: 'Posta nas redes sociais com frequência?', tipo: 'unica',
          opcoes: ['Sim, com frequência', 'Posta, mas sem frequência', 'Não posta'] },
        // as próximas só aparecem para quem posta; para quem não posta valem "Não" automaticamente
        { id: 'socialmidia', tema: 'social', area: 'comercial', texto: 'Tem um social mídia?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Ter alguém responsável pelas redes, com rotina de publicação definida.' },
        { id: 'estrategia', tema: 'social', area: 'comercial', texto: 'Tem estratégia por trás das postagens?', sub: 'Pauta pensada para atrair, gerar confiança e chamar para a matrícula', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Montar linha editorial com pauta da semana, dividindo o conteúdo entre atrair, gerar confiança e chamar para a matrícula.' },
        { id: 'conteudo', tema: 'social', texto: 'Produz vídeos e fotos próprios (escola, aulas, alunos)?', tipo: 'unica', opcoes: ['Sim', 'Não'],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' } },
        { id: 'venderedes', tema: 'social', texto: 'Já fecha matrícula pelas redes sociais?', tipo: 'unica', opcoes: ['Sim', 'Não'],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' } },
        { id: 'redesprontas', tema: 'social', texto: 'As redes sociais estão preparadas para receber clientes?', tipo: 'unica', opcoes: ['Sim', '+ ou -', 'Não'],
          depende: { q: 'posta', oculta: [2], resposta: 2, motivo: 'não posta nas redes' } }
      ]
    },
    {
      id: 'leads', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Geração de Leads e *Marketing*',
      sub: 'Como a escola atrai e se posiciona hoje',
      perguntas: [
        // a captação ativa já foi perguntada em Vendas e Prospecção ("Comercial faz ativo?")
        { id: 'funis', texto: 'De onde chegam os leads da escola hoje?', tipo: 'multipla', bom: 3,
          opcoes: ['Tráfego pago', 'Orgânico / Instagram da escola', 'Orgânico / Colaborador', 'Real interessado', 'Lead base', 'Indicação', 'Remarketing', 'Contrapropostas'],
          acao: 'Abrir mais de uma origem de lead, para o resultado não depender de um canal só.' },
        { id: 'posicionamento', texto: 'Hoje tem posicionamento na cidade?', sub: 'Marca, não só oferta', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir pelo que a escola quer ser reconhecida na cidade e repetir isso em toda comunicação.' }
      ]
    },
    {
      id: 'ferramentas', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Ferramentas*',
      sub: 'O que já está implementado tecnicamente',
      perguntas: [
        { id: 'crm', texto: 'Tem CRM pra captação e organização dos leads?', tipo: 'unica',
          opcoes: [{ t: 'Sim, qual?', dor: 0, campo: 'ferramenta' }, { t: 'Não', dor: 1 }],
          acao: 'Implantar CRM para registrar todo lead que chega, com dono e etapa.' },
        { id: 'funilcrm', texto: 'O funil de vendas está desenhado dentro do CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'crm', oculta: [1], resposta: 1, motivo: 'não tem CRM' },
          acao: 'Desenhar as etapas do funil dentro do CRM, do primeiro contato até a matrícula.' },
        { id: 'automacao', texto: 'Tem automação de mensagens (WhatsApp, Instagram e e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar as mensagens de entrada, confirmação e lembrete, para nenhum lead esperar resposta.' },
        { id: 'dashboard', texto: 'Tem relatório ou painel para acompanhar as métricas?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar um painel com leads, conversão e matrículas para acompanhar toda semana.' }
      ]
    },
    {
      id: 'atendimento', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Atendimento e *Follow-up*',
      sub: 'Como o lead é tratado depois que chega',
      perguntas: [
        { id: 'qualifica', texto: 'Quem faz a qualificação do lead?', tipo: 'multipla',
          opcoes: ['Dono', 'Secretária', 'Líder/gerente', 'SDR', 'Closer'] },
        { id: 'tempoResp', texto: 'Tem tempo médio de resposta definido?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Definir um tempo máximo de resposta ao lead e medir se ele está sendo cumprido.' },
        { id: 'script', texto: 'Existe script/roteiro de atendimento?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro de atendimento, do primeiro contato até o agendamento da visita.' },
        { id: 'followup', texto: 'Tem follow-up estruturado depois do primeiro contato?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar régua de follow-up com prazo e responsável, do primeiro contato até a matrícula.' },
        { id: 'reativacao', texto: 'Tem cadência de reativação de leads frios?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar cadência para reativar os leads frios da base antes de cada período de matrícula.' }
      ]
    },
    {
      id: 'resultados', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Resultados*',
      sub: 'Os números de hoje viram a base do comparativo mostrado mais à frente. Pode ser aproximado.',
      // conversão, custo por lead e custo por matrícula são calculados a partir destes campos
      campos: [
        { id: 'vendas', rotulo: 'Média de matrículas por mês', suf: 'alunos / mês', unidade: 'alunos/mês' },
        { id: 'leads', rotulo: 'Quantos contatos novos chegam por mês?', sub: 'WhatsApp, Instagram, site e telefone', suf: 'contatos / mês', unidade: 'contatos/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'ticket', rotulo: 'Ticket médio (mensalidade)', sub: 'Quanto um aluno paga por mês, em média', pre: 'R$', suf: 'R$ / mês',
          medias: [
            { t: 'Idiomas', v: 500, fonte: 'Escolas de idiomas cobram de R$ 300 a R$ 700 por mês em turmas regulares; usamos o meio da faixa. WorldStudy, junho de 2026.' },
            { t: 'Faculdade presencial', v: 835, fonte: 'Mediana nacional da mensalidade presencial em 2026. Cenário de Precificação da Graduação 2026, Hoper Educação e ABMES.' },
            { t: 'Faculdade EAD', v: 214, fonte: 'Mediana nacional da mensalidade EAD em 2026. Cenário de Precificação da Graduação 2026, Hoper Educação e ABMES.' }
          ] },
        { id: 'midia', rotulo: 'Quanto investe por mês em anúncio?', pre: 'R$', suf: 'R$ / mês',
          atalhos: [{ t: 'Não investe', v: 0 }] }
      ],
      calculos: {
        conversao: { v: 1.8, fonte: 'Panorama RD Station 2025, Educação e Ensino: 14% dos leads viram oportunidade e 13% das oportunidades viram venda, cerca de 1,8% do lead à matrícula. Base: empresas com RD Station Marketing e CRM integrados.' }
      },
      perguntas: [
        { id: 'origem', texto: 'De onde vêm esses números?', tipo: 'unica',
          opcoes: [{ t: 'Do CRM ou de relatório', dor: 0 }, { t: 'De cabeça, aproximado', dor: 0.5 }, { t: 'Não sabemos', dor: 1 }],
          acao: 'Medir toda semana contatos, matrículas e investimento, para saber a conversão e o custo por matrícula de verdade.' }
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
    referencia: { base: 10, ticket: 500 },  // enquanto não preenchem: 10 alunos de exemplo e a média de idiomas
    baseRotulo: '{n} alunos novos por mês',
    explicacao: 'o dobro das {hoje} de hoje, contando todas, não só as a mais'
  }
});
