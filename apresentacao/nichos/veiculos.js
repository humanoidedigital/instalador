/* Nicho: Revendas e concessionárias de veículos.
   Mesma estrutura de escolas.js. A diferença principal está na projeção:
   venda de veículo não é recorrente, então a receita acumula sem empilhar. */
NICHO({
  id: 'veiculos',
  nome: 'Revendas de veículos',
  descricao: 'Revendas multimarcas, concessionárias, lojas de motos e seminovos.',

  termos: {
    empresa: 'loja', empresas: 'lojas',
    cliente: 'comprador', clientes: 'compradores',
    venda: 'venda', vendas: 'vendas',
    ticket: 'lucro médio por veículo'
  },

  capa: { kicker: 'Raio-X de Receita · Revendas de veículos' },

  publico: ['Revendas multimarcas', 'Concessionárias', 'Lojas de motos', 'Seminovos premium', 'Caminhões e utilitários'],

  numeros: {
    campos: {
      leads: { rotulo: 'Leads por mês', hint: 'Portais, anúncios, Instagram, telefone', suf: 'leads / mês' },
      vendas: { rotulo: 'Veículos vendidos por mês', hint: 'Média dos últimos meses', suf: 'vendas / mês' },
      ticket: { rotulo: 'Lucro médio por veículo', hint: 'Margem + retorno de financiamento e seguro', pre: 'R$', suf: 'por venda' },
      midia: { rotulo: 'Investimento em anúncios e portais', hint: 'OLX, Webmotors, iCarros, Meta, Google', pre: 'R$', suf: 'por mês' }
    }
  },

  perfis: {
    itens: [
      { perfil: 'Revendas multimarcas', dor: 'Lead de portal esfria em minutos e vai para a loja ao lado' },
      { perfil: 'Concessionárias', dor: 'Volume alto, e o vendedor escolhe só o lead que parece bom' },
      { perfil: 'Lojas de motos', dor: 'Decisão por impulso; financiamento recusado trava a venda' },
      { perfil: 'Seminovos premium', dor: 'Ciclo mais longo, exige test drive e follow-up caprichado' },
      { perfil: 'Caminhões e utilitários', dor: 'Venda consultiva, quem decide é a empresa do comprador' }
    ]
  },

  case: {
    cliente: '[Nome da loja]',
    segmento: '[Revenda multimarcas · cidade]',
    numeros: [
      { valor: '[+00%]', rotulo: '[em vendas em 90 dias]' },
      { valor: '[0 min]', rotulo: '[resposta ao lead de portal]' },
      { valor: '[R$ 0]', rotulo: '[de lucro a mais por mês]' }
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
          opcoes: ['Dono', 'Gerente', 'Vendedores', 'Recepção ou SDR', 'Ninguém fixo'] },
        { texto: 'Quanto tempo o lead espera pela primeira resposta?', tipo: 'unica',
          opcoes: [{ t: 'Até 5 minutos', dor: 0 }, { t: 'Até 1 hora', dor: 0.5 }, { t: 'Mais de 1 hora', dor: 1 }],
          acao: 'Definir meta de resposta em até 5 minutos, com alerta para o gerente quando estourar.' },
        { texto: 'Lead de portal (OLX, Webmotors, iCarros) é respondido na hora?', tipo: 'unica',
          opcoes: [{ t: 'Sempre', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Raramente', dor: 1 }],
          acao: 'Integrar os portais ao CRM para que todo lead de portal caia na hora para um vendedor.' },
        { texto: 'Existe roteiro até agendar visita ou test drive?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro do primeiro contato até a visita ou test drive marcado.' },
        { texto: 'Atende à noite e no fim de semana?', tipo: 'unica',
          opcoes: [{ t: 'Sim, com automação', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar atendimento automático fora do horário, já oferecendo horário de visita.' }
      ]
    },
    {
      id: 'crm',
      nome: 'CRM e distribuição',
      titulo: 'CRM e *distribuição*',
      sub: 'Onde o lead fica e quem é responsável por ele',
      perguntas: [
        { texto: 'Tem CRM para organizar os leads?', tipo: 'unica',
          opcoes: [{ t: 'Sim, qual?', dor: 0, campo: 'ferramenta' }, { t: 'Planilha', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Implantar um CRM com o funil de venda de veículo e integração com os portais.' },
        { texto: 'Os leads ficam no WhatsApp da loja ou do vendedor?', tipo: 'unica',
          opcoes: [{ t: 'Da loja, centralizado', dor: 0 }, { t: 'Misturado', dor: 0.5 }, { t: 'Do vendedor', dor: 1 }],
          acao: 'Centralizar os leads no WhatsApp da loja: quando o vendedor sai, a carteira fica.' },
        { texto: 'A distribuição dos leads entre vendedores tem regra?', tipo: 'unica',
          opcoes: [{ t: 'Sim, rodízio automático', dor: 0 }, { t: 'Manual', dor: 0.5 }, { t: 'Cada um pega o que quer', dor: 1 }],
          acao: 'Distribuir os leads em rodízio automático, com prazo de atendimento por vendedor.' },
        { texto: 'Sabe de onde veio cada venda?', sub: 'Portal, anúncio, indicação, passou na frente', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Em parte', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Registrar a origem de todo lead para saber quais portais e anúncios dão venda.' }
      ]
    },
    {
      id: 'followup',
      nome: 'Follow-up e pós-venda',
      titulo: 'Follow-up e *pós-venda*',
      sub: 'O que acontece com quem não respondeu, visitou e não fechou, ou já comprou',
      perguntas: [
        { texto: 'Quantas vezes tenta falar com um lead que não respondeu?', tipo: 'unica',
          opcoes: [{ t: '5 ou mais', dor: 0 }, { t: '2 a 4', dor: 0.5 }, { t: '1 ou nenhuma', dor: 1 }],
          acao: 'Criar cadência de pelo menos 5 tentativas em 7 dias, com vídeo do carro e condição.' },
        { texto: 'Faz follow-up de quem visitou e não comprou?', tipo: 'unica',
          opcoes: [{ t: 'Sempre', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Retomar todo cliente que visitou e não fechou em até 24 horas, com nova proposta.' },
        { texto: 'Tem estratégia para financiamento recusado?', sub: 'Outro banco, entrada maior, outro carro', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar o fluxo de recuperação de crédito recusado: segundo banco, entrada maior ou outro veículo.' },
        { texto: 'Faz pós-venda (revisão, indicação, troca futura)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Criar a régua de pós-venda: pedido de indicação, revisão e oferta de troca em 2 a 3 anos.' }
      ]
    },
    {
      id: 'marketing',
      nome: 'Marketing e medição',
      titulo: 'Marketing e *medição*',
      sub: 'De onde vêm os leads e quanto custa cada venda',
      perguntas: [
        { texto: 'Quais canais trazem leads hoje?', tipo: 'multipla', bom: 3,
          opcoes: ['Portais', 'Anúncios Meta', 'Google', 'Instagram orgânico', 'Indicação', 'Feirão ou evento', 'Base de clientes'],
          acao: 'Diminuir a dependência dos portais com anúncio próprio e a base de clientes.' },
        { texto: 'Investe em anúncio próprio além dos portais?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Já investiu, parou', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Rodar anúncio próprio com o estoque da loja, levando o lead direto para o WhatsApp da loja.' },
        { texto: 'Sabe quanto custa cada venda por canal?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Tem ideia', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Calcular o custo por venda de cada portal e anúncio todo mês.' },
        { texto: 'Tem meta de venda por vendedor?', tipo: 'unica',
          opcoes: [{ t: 'Sim, semanal', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem', dor: 1 }],
          acao: 'Definir meta semanal por vendedor, acompanhada no CRM.' },
        { texto: 'Acompanha os números num relatório ou painel?', tipo: 'unica',
          opcoes: [{ t: 'Toda semana', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar painel semanal com leads, visitas, test drives, vendas e custo por canal.' }
      ]
    }
  ],

  projecao: {
    recorrente: false,                  // cada venda entra uma vez: a receita acumula
    ganho: 0.3,                         // +30% de vendas vindas dos mesmos leads
    referencia: { vendas: 15, ticket: 3500 }
  }
});
