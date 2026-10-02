/* Nicho: Escolas e cursos.
   Este arquivo serve de modelo para criar outros nichos (copie, troque o id e adapte).

   Estrutura:
     id, nome, descricao  → aparecem no seletor de nicho
     termos               → palavras usadas nos textos da marca ({venda}, {cliente}...)
     capa, numeros...     → qualquer chave de marca.js pode ser sobrescrita aqui
     publico              → chips do slide "Quem somos"
     perfis.itens         → slide "Quem atendemos" (perfil → dor)
     categorias           → as telas do raio-x
     projecao             → parâmetros da conta de projeção

   Perguntas:
     tipo 'unica'    → uma resposta; cada opção tem "dor": 0 (bom), 0.5 (atenção), 1 (problema)
                       opção sem "dor" não pontua; "campo" abre uma caixinha de texto (ex.: "qual?")
     tipo 'multipla' → várias respostas; com "bom: 3" pontua (3 ou mais = bom); sem "bom" só registra
     acao            → entra no plano de ação do PDF quando a resposta indica problema */
NICHO({
  id: 'escolas',
  nome: 'Escolas e cursos',
  descricao: 'Escolas de idiomas, cursos livres e profissionalizantes, escolas particulares e faculdades.',

  termos: {
    empresa: 'escola', empresas: 'escolas',
    cliente: 'aluno', clientes: 'alunos',
    venda: 'matrícula', vendas: 'matrículas',
    ticket: 'mensalidade média'
  },

  capa: { kicker: 'Raio-X de Receita · Escolas e cursos' },

  publico: ['Escolas de idiomas', 'Cursos profissionalizantes', 'Escolas particulares', 'Faculdades', 'Cursos livres'],

  numeros: {
    campos: {
      ticket: { rotulo: 'Mensalidade média', pre: 'R$', suf: 'por aluno, por mês' }
    }
  },

  perfis: {
    itens: [
      { perfil: 'Escolas de idiomas', dor: 'Concorrência de franquia e captação o ano inteiro' },
      { perfil: 'Cursos profissionalizantes', dor: 'Decisão rápida: quem demora a responder perde a matrícula' },
      { perfil: 'Escolas particulares', dor: 'Matrícula sazonal; a rematrícula decide o ano' },
      { perfil: 'Faculdades', dor: 'Ciclo longo, o lead precisa ser nutrido até a matrícula' },
      { perfil: 'Cursos livres', dor: 'Muito lead curioso e pouco processo para separar quem vai fechar' }
    ]
  },

  case: {
    cliente: '[Nome da escola]',
    segmento: '[Escola de idiomas · cidade]',
    numeros: [
      { valor: '[+00%]', rotulo: '[em matrículas em 90 dias]' },
      { valor: '[0 min]', rotulo: '[tempo médio de resposta]' },
      { valor: '[R$ 0]', rotulo: '[de receita mensal a mais]' }
    ]
  },

  categorias: [
    {
      id: 'atendimento',
      nome: 'Atendimento',
      titulo: 'Atendimento e *velocidade*',
      sub: 'O que acontece nos primeiros minutos depois que o lead chega',
      perguntas: [
        { texto: 'Quem atende os leads hoje?', tipo: 'multipla',
          opcoes: ['Dono', 'Diretor', 'Secretária', 'Consultor comercial', 'Professor'] },
        { texto: 'Quanto tempo o lead espera pela primeira resposta?', tipo: 'unica',
          opcoes: [{ t: 'Até 5 minutos', dor: 0 }, { t: 'Até 1 hora', dor: 0.5 }, { t: 'Mais de 1 hora', dor: 1 }],
          acao: 'Definir meta de resposta em até 5 minutos no horário comercial, com resposta automática fora dele.' },
        { texto: 'Existe roteiro de atendimento até a visita ou aula experimental?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro de atendimento do primeiro contato até o agendamento da visita ou aula experimental.' },
        { texto: 'O lead é convidado para visita ou aula experimental?', tipo: 'unica',
          opcoes: [{ t: 'Sempre', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Raramente', dor: 1 }],
          acao: 'Tornar o convite para visita ou aula experimental a meta de todo atendimento.' },
        { texto: 'Atende à noite e no fim de semana?', tipo: 'unica',
          opcoes: [{ t: 'Sim, com automação', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar atendimento automático para noite e fim de semana, com agendamento para o próximo dia útil.' }
      ]
    },
    {
      id: 'crm',
      nome: 'CRM e organização',
      titulo: 'CRM e *organização*',
      sub: 'Onde o lead fica registrado e como a equipe sabe o que fazer com ele',
      perguntas: [
        { texto: 'Tem CRM para organizar os leads?', tipo: 'unica',
          opcoes: [{ t: 'Sim, qual?', dor: 0, campo: 'ferramenta' }, { t: 'Planilha', dor: 0.5 }, { t: 'Não, fica no WhatsApp', dor: 1 }],
          acao: 'Implantar um CRM com o funil de matrícula e tirar os leads do WhatsApp solto.' },
        { texto: 'O funil de matrícula está desenhado em etapas?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Desenhar as etapas do funil (novo, em atendimento, visita marcada, visitou, matriculado, perdido) e usar no CRM.' },
        { texto: 'Sabe de onde veio cada matrícula?', sub: 'Anúncio, indicação, Instagram, passou na frente', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Em parte', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Registrar a origem de todo lead para saber quais canais dão matrícula, não só contato.' },
        { texto: 'Tem mensagens automáticas (WhatsApp, Instagram, e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar boas-vindas, lembrete de visita e confirmação de aula experimental.' }
      ]
    },
    {
      id: 'followup',
      nome: 'Follow-up e rematrícula',
      titulo: 'Follow-up e *rematrícula*',
      sub: 'O que acontece com quem não respondeu, não decidiu ou já é aluno',
      perguntas: [
        { texto: 'Quantas vezes tenta falar com um lead que não respondeu?', tipo: 'unica',
          opcoes: [{ t: '5 ou mais', dor: 0 }, { t: '2 a 4', dor: 0.5 }, { t: '1 ou nenhuma', dor: 1 }],
          acao: 'Criar cadência de pelo menos 5 tentativas em 10 dias, alternando WhatsApp, ligação e áudio.' },
        { texto: 'Tem ação para leads antigos e de anos anteriores?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Reativar a base de leads antigos antes de cada período de matrícula.' },
        { texto: 'Tem campanha estruturada de rematrícula?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar a campanha de rematrícula com calendário, condição e responsável.' },
        { texto: 'Tem programa de indicação ativo?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Lançar programa de indicação para alunos e pais, com benefício claro.' }
      ]
    },
    {
      id: 'marketing',
      nome: 'Marketing e medição',
      titulo: 'Marketing e *medição*',
      sub: 'De onde vêm os leads e quanto custa cada matrícula',
      perguntas: [
        { texto: 'Quais canais trazem leads hoje?', tipo: 'multipla', bom: 3,
          opcoes: ['Anúncios Meta', 'Google', 'Instagram orgânico', 'Indicação', 'Parcerias', 'Eventos', 'Base antiga'],
          acao: 'Abrir pelo menos mais um canal de leads além dos que já funcionam.' },
        { texto: 'Tem anúncio pago rodando hoje?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Já teve, parou', dor: 0.5 }, { t: 'Nunca', dor: 1 }],
          acao: 'Rodar anúncio com verba fixa mensal, ligado ao funil do CRM.' },
        { texto: 'Sabe quanto custa cada matrícula (CAC)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Tem ideia', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Calcular o custo por matrícula de cada canal todo mês.' },
        { texto: 'Tem meta de matrícula definida?', tipo: 'unica',
          opcoes: [{ t: 'Diária ou semanal', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem', dor: 1 }],
          acao: 'Quebrar a meta mensal em meta semanal por pessoa, acompanhada no CRM.' },
        { texto: 'Acompanha os números num relatório ou painel?', tipo: 'unica',
          opcoes: [{ t: 'Toda semana', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar painel semanal com leads, visitas, matrículas e custo por canal.' }
      ]
    }
  ],

  projecao: {
    recorrente: true,                   // cada aluno novo paga mensalidade todo mês: a receita empilha
    ganho: 0.5,                         // +50% de matrículas vindas dos mesmos leads
    referencia: { vendas: 10, ticket: 350 }
  }
});
