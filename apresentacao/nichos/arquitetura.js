/* Nicho: Escritórios de arquitetura (residencial, interiores, comercial).
   Serve para venda direta (todos os serviços) e para cliente indicado por parceiro (o estilo de parceiro
   tira o que não pode ser vendido). O id "arquitetura" liga sozinho a proteção de concorrente do case Dua.
   O funil do escritório: anúncio → clique → contato → briefing ou orçamento → contrato.
   Referências usadas:
   - CTR e clique → lead do setor "casa e reforma" (o mais próximo de arquitetura no estudo LocaliQ/WordStream 2026)
   - mercado: 85% de quem constrói ou reforma não contrata arquiteto nem engenheiro (CAU/BR e Datafolha, 2015)
   - honorário de projeto residencial: R$ 60 a R$ 140 por m² em portais de orçamento (2026), sem valor oficial do CAU
   Taxa de orçamento → contrato não tem referência pública: aparece só o número do escritório. */
NICHO({
  id: 'arquitetura',
  nome: 'Escritórios de arquitetura',
  descricao: 'Arquitetura residencial, interiores e projetos comerciais. Do contato ao contrato assinado.',

  termos: {
    empresa: 'escritório', empresas: 'escritórios',
    cliente: 'cliente', clientes: 'clientes',
    venda: 'contrato', vendas: 'contratos',
    ticket: 'ticket médio por projeto',
    receita: 'receita', suaReceita: 'sua receita',
    fimJornada: 'o contrato assinado',
    compraPensada: 'o cliente que chega até o seu escritório',
    temHoje: 'nome e portfólio'
  },

  capa: { tagline: 'Sistema comercial para escritórios de arquitetura' },

  publico: ['Arquitetura residencial', 'Interiores', 'Projetos comerciais e corporativos', 'Paisagismo', 'Projeto + execução de obra'],

  perfis: {
    titulo: 'Cinco perfis de escritório, cada um com uma dor específica',
    itens: [
      { perfil: 'Residencial alto padrão', dor: 'Cliente pesquisa meses, compara portfólio e some depois do orçamento' },
      { perfil: 'Interiores', dor: 'Muito pedido de orçamento, pouco projeto fechado' },
      { perfil: 'Comercial e corporativo', dor: 'Quem decide é um grupo: a proposta precisa vender sozinha' },
      { perfil: 'Escritório que vive de indicação', dor: 'Mês cheio e mês vazio, sem previsibilidade' },
      { perfil: 'Projeto + execução de obra', dor: 'O projeto abre a porta da obra, onde está a margem' }
    ]
  },

  areas: [
    { id: 'marketing', nome: 'Marketing' },
    { id: 'comercial', nome: 'Comercial' }
  ],

  raiox: [
    {
      id: 'vendas', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Atendimento e *Proposta*',
      campos: [
        { id: 'equipe', rotulo: 'Quantas pessoas atendem e vendem no escritório?', suf: 'pessoas', unidade: 'pessoas' }
      ],
      perguntas: [
        { id: 'quemvende', texto: 'Quem atende e fecha os projetos hoje?', tipo: 'multipla',
          opcoes: ['Sócio(s) arquiteto(s)', 'Arquiteto da equipe', 'Comercial dedicado', 'Secretária ou recepção'] },
        { id: 'processo', texto: 'Existe um processo do primeiro contato ao contrato?', tipo: 'unica',
          opcoes: [{ t: 'Sim, com etapas definidas', dor: 0 }, { t: 'Cada um conduz do seu jeito', dor: 1 }],
          acao: 'Definir o processo comercial do escritório: primeiro contato, briefing, proposta, follow-up e contrato, com prazo em cada etapa.' },
        { id: 'briefing', texto: 'Faz reunião de briefing antes de mandar o valor?', tipo: 'unica',
          opcoes: [{ t: 'Sempre', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não, manda o valor direto', dor: 1 }],
          acao: 'Fazer reunião de briefing antes de qualquer proposta: quem recebe só o valor compara só o preço.' },
        { id: 'ativo', texto: 'O escritório prospecta ativamente?', sub: 'Construtoras, lojas de acabamento, marcenarias, corretores, condomínios', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Montar parcerias de indicação com construtoras, lojas de acabamento, marcenarias e corretores, com rotina de contato.' },
        { id: 'meta', texto: 'Tem meta de contratos por mês?', tipo: 'unica',
          opcoes: [{ t: 'Sim, acompanhada toda semana', dor: 0 }, { t: 'Só uma ideia de faturamento', dor: 0.5 }, { t: 'Não tem meta', dor: 1 }],
          acao: 'Definir meta de contratos e de propostas por mês e acompanhar toda semana.' },
        { id: 'lider', texto: 'Alguém cuida do comercial com meta e cobrança?', sub: 'Ou o sócio vende no tempo que sobra do projeto', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Ter uma pessoa responsável pelo comercial, para o sócio não vender só no tempo que sobra dos projetos.' }
      ]
    },
    {
      id: 'marketing', area: 'marketing',
      kicker: 'Raio-X · Marketing',
      titulo: 'Marketing e *Tráfego Pago*',
      sub: 'Anúncio, portfólio, redes sociais e capacidade de atender',
      perguntas: [
        { id: 'trafego', texto: 'Tem anúncio pago rodando hoje?', sub: 'Meta Ads (Instagram/Facebook), Google ou outro canal', tipo: 'unica',
          opcoes: [{ t: 'Sim, onde?', dor: 0, campo: 'canal' }, { t: 'Já anunciou, mas parou', dor: 1 }, { t: 'Nunca anunciou', dor: 1 }],
          acao: 'Começar campanha paga para quem está planejando obra ou reforma, com custo por contato medido desde o primeiro dia.' },
        { id: 'tracking', texto: 'Sabe quantos orçamentos e contratos vieram de cada anúncio?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Mais ou menos', dor: 0.5 }, { t: 'Não', dor: 1 }],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' },
          acao: 'Rastrear de onde vem cada contato (pixel, UTMs e CRM) para saber quais campanhas geram contrato, não só curtida.' },
        { id: 'criativos', texto: 'Anuncia com projetos reais?', sub: 'Antes e depois, obra pronta, vídeo do processo', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' },
          acao: 'Anunciar com projetos reais: antes e depois, obra pronta e o arquiteto explicando o processo.' },
        { id: 'destino', texto: 'Para onde o anúncio leva?', tipo: 'unica',
          opcoes: ['WhatsApp', 'Formulário do Meta ou do Google', 'Site ou landing page', 'Direct do Instagram'],
          depende: { q: 'trafego', oculta: [2], motivo: 'nunca anunciou' } },
        { id: 'portfolio', texto: 'O portfólio está organizado e fácil de mostrar?', sub: 'Por tipo de projeto e faixa de investimento', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Organizar o portfólio por tipo de projeto e faixa de investimento, para o cliente se ver nele.' },
        { id: 'capacidade', texto: 'O escritório tem capacidade para pegar mais projetos por mês?', tipo: 'unica', opcoes: ['Sim', 'Não'] },
        { id: 'posta', tema: 'social', texto: 'Posta nas redes sociais com frequência?', tipo: 'unica',
          opcoes: ['Sim, com frequência', 'Posta, mas sem frequência', 'Não posta'] },
        { id: 'socialmidia', tema: 'social', texto: 'Tem alguém cuidando das redes?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Ter alguém responsável pelas redes, com rotina de publicação dos projetos.' },
        { id: 'estrategia', tema: 'social', texto: 'Tem estratégia por trás das postagens?', sub: 'Pauta pensada para atrair, gerar confiança e chamar para o orçamento', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'posta', oculta: [2], resposta: 1, motivo: 'não posta nas redes' },
          acao: 'Montar linha editorial: projeto pronto, bastidor de obra, dúvida comum de cliente e chamada para o orçamento.' }
      ]
    },
    {
      id: 'leads', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Origem dos clientes e *Posicionamento*',
      sub: '85% de quem constrói ou reforma não contrata arquiteto nem engenheiro (CAU/BR e Datafolha). O cliente precisa entender o valor antes de pedir orçamento.',
      perguntas: [
        { id: 'funis', texto: 'De onde chegam os clientes hoje?', tipo: 'multipla', bom: 3,
          opcoes: ['Indicação de clientes', 'Parcerias (construtoras, lojas, marcenarias)', 'Instagram orgânico', 'Tráfego pago', 'Google (busca e Perfil da Empresa)', 'Site', 'Plataformas de orçamento', 'Mostras e feiras'],
          acao: 'Abrir mais de uma origem de cliente, para o escritório não depender só de indicação.' },
        { id: 'posicionamento', texto: 'O escritório é conhecido por um tipo de projeto ou público?', sub: 'Ex.: residencial alto padrão, interiores corporativos', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: '+ ou -', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir o tipo de projeto e de cliente que o escritório quer atrair e repetir isso em portfólio, redes e anúncios.' },
        { id: 'qualifica1', texto: 'Pergunta a faixa de investimento e o prazo no primeiro contato?', tipo: 'unica',
          opcoes: [{ t: 'Sempre', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Perguntar faixa de investimento e prazo da obra no primeiro contato, para não gastar briefing com quem não cabe.' }
      ]
    },
    {
      id: 'ferramentas', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: '*Ferramentas*',
      sub: 'O que já está implementado tecnicamente',
      perguntas: [
        { id: 'crm', texto: 'Tem CRM para organizar os contatos e as propostas?', tipo: 'unica',
          opcoes: [{ t: 'Sim, qual?', dor: 0, campo: 'ferramenta' }, { t: 'Não', dor: 1 }],
          acao: 'Implantar CRM para registrar todo contato e toda proposta, com responsável e etapa.' },
        { id: 'funilcrm', texto: 'As etapas (contato, briefing, proposta, contrato) estão no CRM?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          depende: { q: 'crm', oculta: [1], resposta: 1, motivo: 'não tem CRM' },
          acao: 'Desenhar no CRM as etapas do escritório: contato, briefing, proposta enviada, negociação e contrato.' },
        { id: 'propostaPadrao', texto: 'A proposta tem um modelo padrão?', sub: 'Escopo, etapas, prazos, valor e forma de pagamento', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Criar um modelo de proposta com escopo, etapas, prazos e formas de pagamento, que venda mesmo sem o arquiteto junto.' },
        { id: 'automacao', texto: 'Tem automação de mensagens (WhatsApp, Instagram e e-mail)?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Automatizar a resposta inicial e o agendamento do briefing, para nenhum contato esperar.' },
        { id: 'dashboard', texto: 'Tem relatório ou painel para acompanhar contatos, propostas e contratos?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Montar um painel com contatos, briefings, propostas e contratos do mês para acompanhar toda semana.' }
      ]
    },
    {
      id: 'atendimento', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Resposta e *Follow-up*',
      sub: 'O que acontece com o contato e com a proposta depois que chegam',
      perguntas: [
        { id: 'tempoResp', texto: 'Tem tempo máximo para responder um contato novo?', tipo: 'unica',
          opcoes: [{ t: 'Sim, e é medido', dor: 0 }, { t: 'Tem, mas ninguém mede', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Definir um tempo máximo de resposta ao contato novo e medir se ele está sendo cumprido.' },
        { id: 'script', texto: 'Existe roteiro para o primeiro contato e para o briefing?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Escrever o roteiro do primeiro contato e do briefing, com as perguntas que qualificam o projeto.' },
        { id: 'followup', texto: 'Faz follow-up depois de enviar a proposta?', tipo: 'unica',
          opcoes: [{ t: 'Sim, com prazos definidos', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Criar régua de follow-up da proposta (2, 5 e 10 dias depois do envio), sempre com um próximo passo.' },
        { id: 'perdas', texto: 'Registra por que cada proposta foi perdida?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Registrar o motivo de cada proposta perdida (preço, prazo, escopo, concorrente) para ajustar a oferta.' },
        { id: 'reativacao', texto: 'Volta a falar com quem pediu orçamento e não fechou?', tipo: 'unica',
          opcoes: [{ t: 'Sim', dor: 0 }, { t: 'Não', dor: 1 }],
          acao: 'Reativar orçamentos antigos a cada 60 a 90 dias: obra adiada não é obra cancelada.' },
        { id: 'indicacao', texto: 'Pede indicação a quem já contratou?', tipo: 'unica',
          opcoes: [{ t: 'Sempre, com rotina', dor: 0 }, { t: 'Às vezes', dor: 0.5 }, { t: 'Não', dor: 1 }],
          acao: 'Pedir indicação na entrega do projeto e na obra pronta, com um roteiro simples.' }
      ]
    },
    {
      id: 'numeros-mkt', area: 'marketing',
      kicker: 'Raio-X · Marketing',
      titulo: 'Números do *marketing*',
      sub: 'Do Gerenciador de Anúncios, do último mês. Pode ser aproximado; o que não souber, marque "Não sei".',
      campos: [
        { id: 'midia', rotulo: 'Quanto investe por mês em anúncio?', pre: 'R$', suf: 'R$ / mês',
          atalhos: [{ t: 'Não investe', v: 0 }] },
        { id: 'impressoes', rotulo: 'Impressões por mês', sub: 'Quantas vezes o anúncio apareceu', suf: 'impressões / mês', unidade: 'impressões/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'cliques', rotulo: 'Cliques por mês', sub: 'Cliques no link ou no botão do anúncio', suf: 'cliques / mês', unidade: 'cliques/mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'leads', rotulo: 'Contatos novos por mês', sub: 'WhatsApp, Instagram, formulário, site e indicação', suf: 'contatos / mês', unidade: 'contatos/mês',
          atalhos: [{ t: 'Não sei', v: null }] }
      ],
      calculos: { indicadores: ['cpm', 'ctr', 'cpc', 'cpl', 'cliqueLead'] },
      perguntas: [
        { id: 'origem', texto: 'De onde vêm esses números?', tipo: 'unica',
          opcoes: [{ t: 'Do gerenciador e do CRM', dor: 0 }, { t: 'De cabeça, aproximado', dor: 0.5 }, { t: 'Não sabemos', dor: 1 }],
          acao: 'Medir toda semana investimento, contatos, briefings, propostas e contratos, para saber onde o funil perde.' }
      ]
    },
    {
      id: 'numeros-vendas', area: 'comercial',
      kicker: 'Raio-X · Comercial',
      titulo: 'Números *comerciais*',
      sub: 'Os números de hoje viram a base do comparativo mostrado mais à frente. Pode ser aproximado.',
      campos: [
        { id: 'reunioes', rotulo: 'Briefings ou orçamentos por mês', sub: 'Contatos que viraram reunião ou proposta enviada', suf: 'por mês', unidade: 'por mês',
          atalhos: [{ t: 'Não sei', v: null }] },
        { id: 'vendas', rotulo: 'Contratos fechados por mês', suf: 'contratos / mês', unidade: 'contratos/mês' },
        { id: 'ticket', rotulo: 'Ticket médio por projeto', sub: 'Referência: R$ 60 a R$ 140 por m² no projeto residencial completo (portais de orçamento, 2026). Ex.: 150 m² × R$ 100 = R$ 15 mil.', pre: 'R$', suf: 'R$ por projeto' }
      ],
      calculos: { indicadores: ['leadReuniao', 'reuniaoVenda', 'leadVenda', 'custoReuniao', 'cac', 'roas'] }
    },
    {
      id: 'tempo', area: 'comercial',
      kicker: 'Raio-X · O custo de esperar',
      titulo: 'Tempo, investimento e *resultado*',
      sub: 'As últimas respostas viram o comparativo da próxima tela.',
      campos: [
        { id: 'meses', rotulo: 'Há quantos meses vocês tentam ajustar o comercial?', suf: 'meses', unidade: 'meses' },
        { id: 'custo', rotulo: 'Custo mensal do comercial e do marketing', sub: 'Pessoas no atendimento · Anúncios · Ferramentas · Agência', pre: 'R$', suf: 'R$ / mês' },
        { id: 'receitaIni', rotulo: 'Há {meses}, o escritório faturava por mês?', pre: 'R$', suf: 'R$ / mês, no início' },
        { id: 'receitaHoje', rotulo: 'Hoje o escritório fatura por mês?', pre: 'R$', suf: 'R$ / mês, hoje' }
      ]
    }
  ],

  indicadores: [
    { id: 'cpm', rotulo: 'CPM', a: 'midia', b: 'impressoes', x: 1000, formato: 'brl', dica: 'Custo para o anúncio aparecer mil vezes' },
    { id: 'ctr', rotulo: 'CTR', a: 'cliques', b: 'impressoes', x: 100, formato: 'pct', area: 'marketing', ref: 2.14,
      fonte: 'Taxa média de cliques em anúncios do Meta com objetivo de leads no setor casa e reforma (Home & Home Improvement): 2,14%. É o setor mais próximo de arquitetura no estudo. Facebook Advertising Benchmarks 2026, LocaliQ e WordStream.',
      acao: 'Trocar criativos: projeto real, antes e depois e obra pronta chamam mais clique do que imagem genérica.' },
    { id: 'cpc', rotulo: 'CPC', a: 'midia', b: 'cliques', formato: 'brl', dica: 'Custo de cada clique' },
    { id: 'cpl', rotulo: 'Custo por contato', a: 'midia', b: 'leads', formato: 'brl', dica: 'Custo de cada contato novo' },
    { id: 'cliqueLead', rotulo: 'Clique → contato', a: 'leads', b: 'cliques', x: 100, formato: 'pct', area: 'marketing', ref: 5.32,
      fonte: 'Conversão média de clique em lead em anúncios do Meta com objetivo de leads no setor casa e reforma (Home & Home Improvement): 5,32%. Facebook Advertising Benchmarks 2026, LocaliQ e WordStream.',
      acao: 'Melhorar o destino do anúncio (WhatsApp, formulário ou página) com portfólio, faixa de investimento e um próximo passo claro.' },
    { id: 'leadReuniao', rotulo: 'Contato → briefing', a: 'reunioes', b: 'leads', x: 100, formato: 'pct', dica: 'Quantos contatos viram reunião ou orçamento' },
    { id: 'reuniaoVenda', rotulo: 'Orçamento → contrato', a: 'vendas', b: 'reunioes', x: 100, formato: 'pct', dica: 'Quantas propostas viram contrato' },
    { id: 'leadVenda', rotulo: 'Contato → contrato', a: 'vendas', b: 'leads', x: 100, formato: 'pct' },
    { id: 'custoReuniao', rotulo: 'Custo por orçamento', a: 'midia', b: 'reunioes', formato: 'brl', dica: 'Anúncio gasto para cada briefing ou orçamento' },
    { id: 'cac', rotulo: 'CAC de mídia', a: 'midia', b: 'vendas', formato: 'brl', dica: 'Anúncio gasto para cada contrato' },
    { id: 'roas', rotulo: 'ROAS', a: ['vendas', 'ticket'], b: 'midia', formato: 'x', dica: 'Quanto volta em contratos para cada R$ 1 de anúncio' }
  ],

  funil: {
    etapas: [
      { campo: 'impressoes', rotulo: 'Impressões' },
      { campo: 'cliques', rotulo: 'Cliques' },
      { campo: 'leads', rotulo: 'Contatos' },
      { campo: 'reunioes', rotulo: 'Briefings ou orçamentos' },
      { campo: 'vendas', rotulo: 'Contratos' }
    ],
    passos: ['ctr', 'cliqueLead', 'leadReuniao', 'reuniaoVenda'],
    custos: ['cpm', 'cpc', 'cpl', 'custoReuniao', 'cac', 'roas']
  },

  projecao: {
    recorrente: false,                  // cada contrato entra uma vez: o resultado acumula
    multiplicador: 1.5,
    conta: 'extra',
    referencia: { base: 1, ticket: 15000 },   // exemplo enquanto o raio-x não tem números: 150 m² × R$ 100/m²
    baseRotulo: '+{n} contratos a mais por mês',
    explicacao: '50% a mais que os {hoje} contratos de hoje'
  }
});
