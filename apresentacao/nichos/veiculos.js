/* Nicho: Revendas de veículos. O mesmo pitch de escolas.js, adaptado para loja de carro e moto.
   O que muda:
   - termos: loja, comprador, venda, lucro
   - perguntas da revenda: portais, test drive, financiamento recusado, WhatsApp da loja x do vendedor
   - as contas usam LUCRO (ticket = lucro médio por veículo; receita do "custo de esperar" = lucro mensal)
   - venda de veículo não se repete todo mês: o resultado acumula, não empilha,
     e conta só as vendas a mais (50% acima de hoje), não todas */
NICHO({
  id: 'veiculos',
  nome: 'Revendas de veículos',
  descricao: 'Revendas multimarcas, concessionárias, lojas de motos e seminovos.',

  termos: {
    empresa: 'loja', empresas: 'lojas',
    cliente: 'comprador', clientes: 'compradores',
    venda: 'venda', vendas: 'vendas',
    ticket: 'lucro médio por veículo',
    receita: 'lucro', suaReceita: 'seu lucro',
    fimJornada: 'a chave na mão do cliente'
  },

  capa: { tagline: 'Sistema comercial para revendas de veículos' },

  publico: ['Revendas multimarcas', 'Concessionárias', 'Lojas de motos', 'Seminovos premium', 'Caminhões e utilitários'],

  perfis: {
    itens: [
      { perfil: 'Revendas multimarcas', dor: 'Lead de portal esfria em minutos e vai pra loja do lado' },
      { perfil: 'Concessionárias', dor: 'Volume alto, vendedor escolhe só o lead que parece bom' },
      { perfil: 'Lojas de motos', dor: 'Decisão por impulso, financiamento recusado trava a venda' },
      { perfil: 'Seminovos premium', dor: 'Ciclo mais longo, test drive e follow-up decidem' },
      { perfil: 'Caminhões e utilitários', dor: 'Venda consultiva, quem decide é a empresa do comprador' }
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
        { id: 'equipe', rotulo: 'Tamanho da equipe de vendas?', suf: 'pessoas', unidade: 'pessoas' }
      ],
      perguntas: [
        { texto: 'Quem vende hoje na loja?', tipo: 'multipla',
          opcoes: ['Dono', 'Gerente', 'Vendedores', 'Recepção / SDR'] },
        { texto: 'Como a loja vende?', tipo: 'unica',
          opcoes: [{ t: 'Existe processo de venda definido', dor: 0 }, { t: 'Cada vendedor vende do seu jeito', dor: 1 }],
          acao: 'Definir um processo de venda único, com as mesmas etapas para todo vendedor, do primeiro contato à entrega.' },
        { texto: 'Os vendedores fazem ativo?', sub: 'Base de clientes, empresas e frotistas, indicação, eventos', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar prospecção ativa na rotina da semana: base de clientes, empresas, frotistas e indicação.' },
        { texto: 'Tem meta de vendas definida?', tipo: 'unica',
          opcoes: [{ t: 'Sim, por vendedor e por semana', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem metas', dor: 1 }],
          acao: 'Quebrar a meta do mês em meta de semana por vendedor, com acompanhamento à vista.' },
        { texto: 'Tem gerente de vendas acompanhando o time?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter um responsável pelo comercial que acompanha meta, funil e vendedores toda semana.' }
      ]
    },
    {
      id: 'marketing', area: 'marketing',
      kicker: 'Raio-X · Especialista',
      titulo: 'Marketing e *Tráfego Pago*',
      sub: 'Diagnóstico de tráfego pago, portais, redes sociais e capacidade de atendimento',
      perguntas: [
        { texto: 'A loja já realizou anúncios no Meta Ads (Instagram/Facebook)?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'A loja anuncia em portais (OLX, Webmotors, iCarros, Mobiauto)?', tipo: 'unica', opcoes: [{ t: 'Sim, quais?', campo: 'portais' }, 'Não'] },
        { texto: 'A loja já investiu/investe em outros canais de publicidade?', tipo: 'unica', opcoes: [{ t: 'Sim, qual?', campo: 'canal' }, 'Não'] },
        { texto: 'A loja já teve resultados positivos com anúncios pagos?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'A loja possui verba mensal definida para investir em tráfego pago?', tipo: 'unica', opcoes: [{ t: 'Sim, quanto?', campo: 'R$/mês' }, 'Não'] },
        { texto: 'A loja possui capacidade para atender uma demanda maior de clientes?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Já possui um WhatsApp Business para receber os contatos gerados pelos anúncios?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Tem constância/frequência de postagens nas redes sociais?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Tem estratégia por trás das postagens?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Produz vídeos e fotos dos veículos do estoque?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'Já realiza vendas e fechamento de negócios através das redes sociais?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { texto: 'As redes sociais estão preparadas para receber clientes?', tipo: 'unica', opcoes: ['Sim', '+ ou -', 'Não'] }
      ]
    },
    {
      id: 'leads', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Geração de Leads e *Marketing*',
      sub: 'Como a loja atrai e se posiciona hoje',
      perguntas: [
        { texto: 'Quais os funis de geração de lead da loja?', tipo: 'multipla', bom: 3,
          opcoes: ['Portais', 'Tráfego pago', 'Orgânico / Instagram da loja', 'Orgânico / Vendedor', 'Captação ativa (externa)', 'Base de clientes', 'Indicação', 'Remarketing', 'Feirão / eventos'],
          acao: 'Abrir mais de uma origem de lead, para a loja não depender só dos portais.' },
        { texto: 'Hoje tem posicionamento na cidade?', sub: 'Marca, não só estoque e preço', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir pelo que a loja quer ser reconhecida na cidade e repetir isso em toda comunicação.' },
        { texto: 'Tem um social mídia?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter alguém responsável pelas redes, com rotina de publicação do estoque e da loja.' },
        { texto: 'Tem estratégias de postagem?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar linha editorial com pauta da semana, no lugar de postar carro por impulso.' },
        { texto: 'Instagram: sabe o que é topo, meio e fundo de funil?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Dividir o conteúdo entre atrair, relacionar e converter, com peso definido para cada etapa.' },
        { texto: 'Tem tráfego pago rodando hoje?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Começar campanha paga com o estoque, verba controlada e custo por lead medido desde o primeiro dia.' }
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
          acao: 'Implantar CRM para registrar todo lead que chega, com vendedor responsável e etapa.' },
        { texto: 'Os leads dos portais caem direto no CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Integrar os portais ao CRM para que todo lead de portal chegue na hora para um vendedor.' },
        { texto: 'Tem automação de mensagens (WhatsApp, Instagram e e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar as mensagens de entrada, confirmação de visita e lembrete de test drive.' },
        { texto: 'O funil de vendas está desenhado dentro do CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Desenhar as etapas do funil no CRM: lead, atendimento, visita/test drive, proposta, ficha, venda.' },
        { texto: 'Tem relatórios/dashboard pro gerente acompanhar as métricas?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar um painel com leads, visitas, test drives e vendas por vendedor para acompanhar toda semana.' }
      ]
    },
    {
      id: 'atendimento', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Atendimento e *Follow-up*',
      sub: 'Como o lead é tratado depois que chega',
      perguntas: [
        { texto: 'Quem faz a qualificação do lead?', tipo: 'multipla',
          opcoes: ['Dono', 'Gerente', 'Vendedor', 'Recepção / SDR'] },
        { texto: 'Tem tempo médio de resposta definido?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Definir um tempo máximo de resposta ao lead (portal e anúncio) e medir se está sendo cumprido.' },
        { texto: 'Existe script/roteiro de atendimento?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro de atendimento, do primeiro contato até a visita ou o test drive marcado.' },
        { texto: 'Os leads ficam no WhatsApp da loja ou do vendedor?', tipo: 'unica',
          opcoes: [{ t: 'Da loja', dor: 0 }, { t: 'Misturado', dor: 0.5 }, { t: 'Do vendedor', dor: 1 }],
          acao: 'Centralizar os leads no WhatsApp da loja: quando o vendedor sai, a carteira fica.' },
        { texto: 'Tem follow-up estruturado depois do primeiro contato?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar régua de follow-up com prazo e responsável, incluindo quem visitou, fez test drive e não fechou.' },
        { texto: 'Tem estratégia para financiamento recusado?', sub: 'Outro banco, entrada maior, outro veículo', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar o fluxo de recuperação de crédito recusado: segundo banco, entrada maior ou outro veículo.' },
        { texto: 'Tem cadência de reativação de leads frios e de clientes antigos?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar cadência para reativar leads frios e oferecer troca para quem comprou há 2 ou 3 anos.' }
      ]
    },
    {
      id: 'resultados', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Resultados*',
      sub: 'Os números de hoje viram a base do comparativo mostrado mais à frente. Pode ser aproximado.',
      // conversão, custo por lead e custo por venda são calculados a partir destes campos
      campos: [
        { id: 'vendas', rotulo: 'Média de veículos vendidos por mês', suf: 'vendas / mês', unidade: 'vendas/mês' },
        { id: 'leads', rotulo: 'Quantos contatos novos chegam por mês?', sub: 'Portais, anúncios, Instagram, WhatsApp e telefone', suf: 'contatos / mês', unidade: 'contatos/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'ticket', rotulo: 'Lucro médio por veículo', sub: 'Margem + retorno de financiamento e seguro', pre: 'R$', suf: 'R$ por venda',
          medias: [
            { t: 'Seminovos', v: 9700, fonte: 'Margem bruta média de 11% sobre o ticket médio de R$ 88.030 dos seminovos (maio de 2025): cerca de R$ 9.700 por veículo. Estudo Megadealer de Performance de Veículos Usados, AutoAvaliar.' }
          ] },
        { id: 'midia', rotulo: 'Quanto investe por mês em anúncios e portais?', pre: 'R$', suf: 'R$ / mês',
          atalhos: [{ t: 'Não investe', v: 0 }] }
      ],
      calculos: {
        conversao: { v: 3, fonte: 'Taxa média de conversão de leads em vendas das concessionárias brasileiras: 3%. Followize, citado pela AutoForce (estudo do 1º semestre de 2018).' }
      },
      perguntas: [
        { texto: 'De onde vêm esses números?', tipo: 'unica',
          opcoes: [{ t: 'Do CRM ou de relatório', dor: 0 }, { t: 'De cabeça, aproximado', dor: 0.5 }, { t: 'Não sabemos', dor: 1 }],
          acao: 'Medir toda semana contatos, vendas e investimento por canal, para saber a conversão e o custo por venda de verdade.' }
      ]
    },
    {
      id: 'tempo', area: 'comercial',
      kicker: 'Raio-X · O custo de esperar',
      titulo: 'Tempo, investimento e *resultado*',
      sub: 'As últimas respostas viram o comparativo da próxima tela.',
      campos: [
        { id: 'meses', rotulo: 'Há quantos meses vocês tentam ajustar o comercial?', suf: 'meses', unidade: 'meses' },
        { id: 'custo', rotulo: 'Custo operacional mensal (Comercial)', sub: 'Vendedores · Gerente · Anúncios e portais · Ferramentas · Social mídia', pre: 'R$', suf: 'R$ / mês' },
        { id: 'receitaIni', rotulo: 'Há {meses}, o lucro mensal da loja era de?', pre: 'R$', suf: 'R$ / mês, no início' },
        { id: 'receitaHoje', rotulo: 'Hoje o lucro mensal está em?', pre: 'R$', suf: 'R$ / mês, hoje' }
      ]
    }
  ],

  projecao: {
    recorrente: false,                  // cada venda entra uma vez: o resultado acumula mês a mês
    multiplicador: 1.5,                 // 50% a mais de vendas com os mesmos leads
    conta: 'extra',                     // conta só as vendas a mais, não as que a loja já faz
    referencia: { base: 5, ticket: 9700 },  // enquanto não preenchem: 5 vendas de exemplo e a média de seminovos
    baseRotulo: '+{n} vendas/mês',
    explicacao: '50% a mais que as {hoje} vendas de hoje'
  }
});
