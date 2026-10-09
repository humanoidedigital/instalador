/* Nicho: Revendas de veículos. O mesmo pitch de escolas.js, adaptado para loja de carro e moto.
   O que muda:
   - termos: loja, comprador, venda, lucro
   - perguntas da revenda: portais, test drive, financiamento recusado, WhatsApp da loja x do vendedor
   - as contas usam LUCRO, mas o dono responde o que sabe de cabeça: ticket médio do veículo, margem (ou a média
     do mercado, 11%) e faturamento. A margem converte tudo em lucro (projecao.margem)
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
    ticket: 'lucro por veículo',          // ticket médio × margem: é o que entra nas contas
    receita: 'lucro', suaReceita: 'seu lucro',
    fimJornada: 'a chave na mão do cliente',
    compraPensada: 'quem compra carro',   // gancho do case Dua
    temHoje: 'nome e estoque'            // "imagina numa loja que já tem nome e estoque"
  },

  capa: { tagline: 'Sistema comercial para revendas de veículos' },

  // venda de veículo não se repete: o resultado acumula (não empilha mensalidade)
  empilhamento: {
    titulo6: 'Resultado acumulado em *6 meses*',
    titulo12: 'O resultado acumulado *{fator12}*'
  },

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
        { id: 'quemvende', texto: 'Quem vende hoje na loja?', tipo: 'multipla',
          opcoes: ['Dono', 'Gerente', 'Vendedores', 'Recepção / SDR'] },
        { id: 'processo', texto: 'Como a loja vende?', tipo: 'unica',
          opcoes: [{ t: 'Existe processo de venda definido', dor: 0 }, { t: 'Cada vendedor vende do seu jeito', dor: 1 }],
          acao: 'Definir um processo de venda único, com as mesmas etapas para todo vendedor, do primeiro contato à entrega.' },
        { id: 'ativo', texto: 'Os vendedores fazem ativo?', sub: 'Base de clientes, empresas e frotistas, indicação, eventos', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Colocar prospecção ativa na rotina da semana: base de clientes, empresas, frotistas e indicação.' },
        { id: 'meta', texto: 'Tem meta de vendas definida?', tipo: 'unica',
          opcoes: [{ t: 'Sim, por vendedor e por semana', dor: 0 }, { t: 'Só mensal', dor: 0.5 }, { t: 'Não tem metas', dor: 1 }],
          acao: 'Quebrar a meta do mês em meta de semana por vendedor, com acompanhamento à vista.' },
        { id: 'lider', texto: 'Tem gerente de vendas acompanhando o time?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter um responsável pelo comercial que acompanha meta, funil e vendedores toda semana.' }
      ]
    },
    {
      id: 'marketing', area: 'marketing',
      kicker: 'Raio-X · Especialista',
      titulo: 'Marketing e *Tráfego Pago*',
      sub: 'Diagnóstico de tráfego pago, presença digital e capacidade de atendimento',
      perguntas: [
        // pontua no Comercial, como no original ("tem tráfego pago rodando hoje?"). Portais ficam na pergunta das origens de lead
        { id: 'trafego', area: 'comercial', texto: 'Tem anúncio pago rodando hoje, fora os portais?', sub: 'Meta Ads (Instagram/Facebook), Google ou outro canal', tipo: 'unica',
          opcoes: [{ t: 'Sim, onde?', dor: 0, campo: 'canal' }, { t: 'Já anunciou, mas parou', dor: 1 }, { t: 'Nunca anunciou', dor: 1 }],
          acao: 'Começar campanha paga com o estoque, verba controlada e custo por lead medido desde o primeiro dia.' },
        { id: 'resultado', texto: 'Já teve resultado positivo com anúncio pago?', tipo: 'unica', opcoes: ['Sim', 'Não'],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' } },
        { id: 'capacidade', texto: 'A loja tem capacidade para atender uma demanda maior de clientes?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { id: 'posta', tema: 'social', texto: 'Posta nas redes sociais com frequência?', tipo: 'unica',
          opcoes: ['Sim, com frequência', 'Posta, mas sem frequência', 'Não posta'] },
        // as próximas só aparecem para quem posta; para quem não posta valem "Não" automaticamente
        { id: 'socialmidia', tema: 'social', area: 'comercial', texto: 'Tem um social mídia?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Ter alguém responsável pelas redes, com rotina de publicação do estoque e da loja.' },
        { id: 'estrategia', tema: 'social', area: 'comercial', texto: 'Tem estratégia por trás das postagens?', sub: 'Pauta pensada para atrair, gerar confiança e chamar para a loja, não só foto de carro', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Montar linha editorial com pauta da semana, dividindo o conteúdo entre atrair, gerar confiança e chamar para a loja.' },
        { id: 'conteudo', tema: 'social', texto: 'Produz vídeos e fotos dos veículos do estoque?', tipo: 'unica', opcoes: ['Sim', 'Não'],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' } },
        { id: 'venderedes', tema: 'social', texto: 'Já fecha venda pelas redes sociais?', tipo: 'unica', opcoes: ['Sim', 'Não'],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' } },
        { id: 'redesprontas', tema: 'social', texto: 'As redes sociais estão preparadas para receber clientes?', tipo: 'unica', opcoes: ['Sim', '+ ou -', 'Não'],
          depende: { q: 'posta', oculta: [2], resposta: 2, motivo: 'não posta nas redes' } }
      ]
    },
    {
      id: 'leads', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Geração de Leads e *Marketing*',
      sub: 'Como a loja atrai e se posiciona hoje',
      perguntas: [
        // a captação ativa já foi perguntada em Vendas e Prospecção ("Os vendedores fazem ativo?")
        { id: 'funis', texto: 'De onde chegam os leads da loja hoje?', tipo: 'multipla', bom: 3,
          opcoes: ['Portais (OLX, Webmotors, iCarros, Mobiauto)', 'Tráfego pago', 'Orgânico / Instagram da loja', 'Orgânico / Vendedor', 'Base de clientes', 'Indicação', 'Remarketing', 'Feirão / eventos'],
          acao: 'Abrir mais de uma origem de lead, para a loja não depender só dos portais.' },
        { id: 'posicionamento', texto: 'Hoje tem posicionamento na cidade?', sub: 'Marca, não só estoque e preço', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir pelo que a loja quer ser reconhecida na cidade e repetir isso em toda comunicação.' }
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
          acao: 'Implantar CRM para registrar todo lead que chega, com vendedor responsável e etapa.' },
        { id: 'funilcrm', texto: 'O funil de vendas está desenhado dentro do CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'crm', oculta: [1], resposta: 1, motivo: 'não tem CRM' },
          acao: 'Desenhar as etapas do funil no CRM: lead, atendimento, visita/test drive, proposta, ficha, venda.' },
        // só para quem anuncia em portal (opção 0 das origens de lead)
        { id: 'portaiscrm', texto: 'Os leads dos portais caem direto no CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: [
            { q: 'funis', semOpcao: 0, motivo: 'não anuncia em portais' },
            { q: 'crm', oculta: [1], resposta: 1, motivo: 'não tem CRM' }
          ],
          acao: 'Integrar os portais ao CRM para que todo lead de portal chegue na hora para um vendedor.' },
        { id: 'automacao', texto: 'Tem automação de mensagens (WhatsApp, Instagram e e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar as mensagens de entrada, confirmação de visita e lembrete de test drive.' },
        { id: 'dashboard', texto: 'Tem relatório ou painel para acompanhar as métricas?', tipo: 'unica',
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
        { id: 'qualifica', texto: 'Quem faz a qualificação do lead?', tipo: 'multipla',
          opcoes: ['Dono', 'Gerente', 'Vendedor', 'Recepção / SDR'] },
        { id: 'tempoResp', texto: 'Tem tempo médio de resposta definido?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Definir um tempo máximo de resposta ao lead (portal e anúncio) e medir se está sendo cumprido.' },
        { id: 'script', texto: 'Existe script/roteiro de atendimento?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro de atendimento, do primeiro contato até a visita ou o test drive marcado.' },
        { id: 'whatsloja', texto: 'Os leads ficam no WhatsApp da loja ou do vendedor?', tipo: 'unica',
          opcoes: [{ t: 'Da loja', dor: 0 }, { t: 'Misturado', dor: 0.5 }, { t: 'Do vendedor', dor: 1 }],
          acao: 'Centralizar os leads no WhatsApp da loja: quando o vendedor sai, a carteira fica.' },
        { id: 'followup', texto: 'Tem follow-up estruturado depois do primeiro contato?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar régua de follow-up com prazo e responsável, incluindo quem visitou, fez test drive e não fechou.' },
        { id: 'financiamento', texto: 'Tem estratégia para financiamento recusado?', sub: 'Outro banco, entrada maior, outro veículo', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar o fluxo de recuperação de crédito recusado: segundo banco, entrada maior ou outro veículo.' },
        { id: 'reativacao', texto: 'Tem cadência de reativação de leads frios e de clientes antigos?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar cadência para reativar leads frios e oferecer troca para quem comprou há 2 ou 3 anos.' }
      ]
    },
    {
      id: 'resultados', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Resultados*',
      sub: 'Os números de hoje viram a base do comparativo mostrado mais à frente. Pode ser aproximado.',
      // conversão, lucro por veículo, custo por lead e custo por venda são calculados a partir destes campos
      campos: [
        { id: 'vendas', rotulo: 'Média de veículos vendidos por mês', suf: 'vendas / mês', unidade: 'vendas/mês' },
        { id: 'leads', rotulo: 'Quantos contatos novos chegam por mês?', sub: 'Portais, anúncios, Instagram, WhatsApp e telefone', suf: 'contatos / mês', unidade: 'contatos/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'ticket', rotulo: 'Ticket médio do veículo vendido', sub: 'Preço médio de venda', pre: 'R$', suf: 'R$ por veículo',
          medias: [
            { t: 'Seminovos', v: 88030, fonte: 'Ticket médio dos seminovos vendidos no Brasil em maio de 2025: R$ 88.030. Estudo Megadealer de Performance de Veículos Usados, AutoAvaliar.' }
          ] },
        { id: 'margem', rotulo: 'Quanto sobra de margem em cada venda?', sub: 'Em % do preço, depois de pagar o carro e a preparação', suf: '% do preço de venda', unidade: '%',
          medias: [
            { t: 'Seminovos', v: 11, fonte: 'Margem bruta média das revendas de seminovos: 11% em 2025 (entre 10,8% e 11,2% ao longo do ano), em 2.492 revendas. Estudo Megadealer de Performance de Veículos Usados, AutoAvaliar.' }
          ] },
        { id: 'midia', rotulo: 'Quanto investe por mês em anúncios e portais?', pre: 'R$', suf: 'R$ / mês',
          atalhos: [{ t: 'Não investe', v: 0 }] }
      ],
      calculos: {
        conversao: { v: 3, fonte: 'Taxa média de conversão de leads em vendas das concessionárias brasileiras: 3%. Followize, citado pela AutoForce (estudo do 1º semestre de 2018).' }
      },
      perguntas: [
        { id: 'origem', texto: 'De onde vêm esses números?', tipo: 'unica',
          opcoes: [{ t: 'Do CRM ou de relatório', dor: 0 }, { t: 'De cabeça, aproximado', dor: 0.5 }, { t: 'Não sabemos', dor: 1 }],
          acao: 'Medir toda semana contatos, vendas e investimento por canal, para saber a conversão e o custo por venda de verdade.' }
      ]
    },
    {
      id: 'tempo', area: 'comercial',
      kicker: 'Raio-X · O custo de esperar',
      titulo: 'Tempo, investimento e *resultado*',
      sub: 'Faturamento é o que o dono sabe de cabeça. A conta tira o lucro com a margem da tela anterior.',
      campos: [
        { id: 'meses', rotulo: 'Há quantos meses vocês tentam ajustar o comercial?', suf: 'meses', unidade: 'meses' },
        { id: 'custo', rotulo: 'Custo operacional mensal (Comercial)', sub: 'Vendedores · Gerente · Anúncios e portais · Ferramentas · Social mídia', pre: 'R$', suf: 'R$ / mês' },
        { id: 'receitaIni', rotulo: 'Há {meses}, a loja faturava por mês?', pre: 'R$', suf: 'R$ / mês, no início' },
        { id: 'receitaHoje', rotulo: 'Hoje a loja fatura por mês?', pre: 'R$', suf: 'R$ / mês, hoje' }
      ]
    }
  ],

  projecao: {
    recorrente: false,                  // cada venda entra uma vez: o resultado acumula mês a mês
    multiplicador: 1.5,                 // 50% a mais de vendas com os mesmos leads
    conta: 'extra',                     // conta só as vendas a mais, não as que a loja já faz
    margem: { campo: 'margem', referencia: 11 },  // o dono informa preço e faturamento; o lucro sai da margem (ou da média, 11%)
    referencia: { base: 5, ticket: 88030 },  // enquanto não preenchem: 5 vendas de exemplo e o ticket médio dos seminovos
    baseRotulo: '+{n} vendas a mais por mês',
    explicacao: '50% a mais que as {hoje} vendas de hoje'
  }
});
