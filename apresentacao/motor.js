/* Motor da apresentação Raio-X de Receita.
   Lê window.MARCA (marca.js) e window.NICHOS (nichos/*.js) e monta os slides.
   A lógica (pontuação, projeção, relatório) é a mesma para todo nicho; o que muda
   são os textos, as perguntas e os parâmetros que cada arquivo de nicho define. */
(function(){
  'use strict';

  // HTML original, antes de qualquer mudança: base do "Baixar cópia" do modo edição.
  const PRISTINE = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;

  const MARCA = window.MARCA || {};
  const NICHOS = (window.NICHOS || []).filter(n => n && n.id);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const store = {
    get(k){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }catch(e){ return null; } },
    set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem(k); }catch(e){} }
  };

  // ============ cores da marca ============
  (function aplicarCores(){
    const c = MARCA.cores || {};
    const map = { fundo:'--bg', fundo2:'--bg2', destaque:'--acc', destaqueForte:'--acc-strong', texto:'--tx', suave:'--mut' };
    Object.keys(map).forEach(k => { if(c[k]) document.documentElement.style.setProperty(map[k], c[k]); });
    if(c.destaque && /^#([0-9a-f]{6})$/i.test(c.destaque)){
      const n = parseInt(c.destaque.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      document.documentElement.style.setProperty('--acc-soft', `rgba(${r},${g},${b},.17)`);
      document.documentElement.style.setProperty('--acc-glow', `rgba(${r},${g},${b},.45)`);
    }
  })();

  // ============ edições (modo edição) ============
  const ED_KEY = 'rb:edicoes';
  const norm = e => ({ marca: Object.assign({}, e && e.marca), nichos: Object.assign({}, e && e.nichos) });
  let embutidas = {};
  try{ embutidas = JSON.parse(($('#edicoes-embutidas') || {}).textContent || '{}'); }catch(e){}
  embutidas = norm(embutidas);
  let localEd = norm(store.get(ED_KEY));
  let ED = { marca:{}, nicho:{} };
  function refreshED(){
    ED.marca = Object.assign({}, embutidas.marca, localEd.marca);
    ED.nicho = N ? Object.assign({}, embutidas.nichos[N.id], localEd.nichos[N.id]) : {};
  }
  function setEdit(sc, path, v){
    const original = getPath(sc === 'nicho' ? N : MARCA, path);
    const alvo = sc === 'nicho' ? (localEd.nichos[N.id] = localEd.nichos[N.id] || {}) : localEd.marca;
    if(String(v) === String(original ?? '') && !(sc === 'nicho' ? (embutidas.nichos[N.id] || {}) : embutidas.marca).hasOwnProperty(path)) delete alvo[path];
    else alvo[path] = v;
    store.set(ED_KEY, localEd);
    refreshED();
  }

  // ============ estado ============
  let N = null;                       // nicho ativo
  let dx = novoDx();                  // diagnóstico em andamento
  let slides = [];                    // [{id, el, oculto}]
  let idx = 0;
  let editing = false;

  function hojeISO(){ const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function novoDx(){ return { ident:{ empresa:'', responsavel:'', whatsapp:'', data:hojeISO() }, resp:{}, nums:{} }; }
  const dxKey = () => 'rb:dx:' + (N ? N.id : 'x');
  let saveT = null;
  function gravarDx(){ clearTimeout(saveT); saveT = null; dx.ts = Date.now(); store.set(dxKey(), dx); }
  function salvarDx(){ clearTimeout(saveT); saveT = setTimeout(gravarDx, 250); }
  window.addEventListener('pagehide', () => { if(saveT) gravarDx(); });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && saveT) gravarDx(); });

  // ============ leitura de dados com edição e fallback nicho → marca ============
  function getPath(o, p){ return String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
  function resolve(path){
    if(N){
      if(Object.prototype.hasOwnProperty.call(ED.nicho, path)) return { sc:'nicho', v:ED.nicho[path] };
      const v = getPath(N, path);
      if(v !== undefined) return { sc:'nicho', v };
    }
    if(Object.prototype.hasOwnProperty.call(ED.marca, path)) return { sc:'marca', v:ED.marca[path] };
    return { sc:'marca', v:getPath(MARCA, path) };
  }
  const raw = path => resolve(path).v;
  function list(path){ const a = N && getPath(N, path); if(Array.isArray(a)) return a; const b = getPath(MARCA, path); return Array.isArray(b) ? b : []; }
  function merged(key){ return Object.assign({}, MARCA[key], N && N[key]); }

  const TERMOS_PADRAO = { empresa:'empresa', empresas:'empresas', cliente:'cliente', clientes:'clientes', venda:'venda', vendas:'vendas', ticket:'ticket médio' };
  function termo(k){
    const t = Object.assign({}, TERMOS_PADRAO, MARCA.termos, N && N.termos);
    if(t[k] != null) return t[k];
    const low = k.charAt(0).toLowerCase() + k.slice(1);
    if(k !== low && t[low] != null) return t[low].charAt(0).toUpperCase() + t[low].slice(1);
    return null;
  }
  const LIVE = ['meses', 'fator12', 'empresa_cliente'];
  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
  function fmt(s){
    if(s == null) return '';
    let h = esc(s);
    h = h.replace(/\{(\w+)\}/g, (m, k) => {
      if(LIVE.includes(k)) return `<span class="live" data-live="${k}"></span>`;
      const v = termo(k);
      return v != null ? esc(v) : m;
    });
    h = h.replace(/\[([^\]\n]+)\]/g, '<span class="ph">[$1]</span>');
    h = h.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
    h = h.replace(/\*([^*\n]+)\*/g, '<span class="hl">$1</span>');
    return h.replace(/\n/g, '<br>');
  }
  const plain = s => (s == null ? '' : String(s).replace(/\{(\w+)\}/g, (m, k) => { const v = termo(k); return v != null ? v : (k === 'meses' ? 'alguns meses' : m); }).replace(/[*\[\]]/g, '').replace(/~~[^~]*~~/g, '').trim());

  // elemento de texto editável
  function T(path, tag, cls){
    tag = tag || 'span';
    const r = resolve(path);
    const vazio = r.v == null || r.v === '';
    return `<${tag} class="${cls || ''}${vazio ? ' is-empty' : ''}" data-k="${r.sc}:${esc(path)}">${vazio ? '' : fmt(r.v)}</${tag}>`;
  }

  // ============ números ============
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits:0 });
  const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits:1 });
  const brl = v => 'R$ ' + nf0.format(Math.round(v || 0));
  const brlK = v => { const a = Math.abs(v); if(a >= 1e6) return nf1.format(v / 1e6) + ' mi'; if(a >= 1e3) return nf1.format(v / 1e3) + ' mil'; return nf0.format(v); };
  const pct = v => nf1.format(v) + '%';
  function num(id){ const v = parseFloat(String(dx.nums[id] == null ? '' : dx.nums[id]).replace(',', '.')); return isFinite(v) ? v : 0; }

  // ============ raio-x: pontuação ============
  const cats = () => (N && Array.isArray(N.categorias)) ? N.categorias : [];
  const qkey = (c, q, i) => c.id + '.' + (q.id || i);
  const optObj = o => (o && typeof o === 'object') ? o : { t:o };
  function pontua(q){ return q.tipo === 'multipla' ? typeof q.bom === 'number' : (q.opcoes || []).some(o => typeof optObj(o).dor === 'number'); }
  function dorQ(c, q, i){
    const r = dx.resp[qkey(c, q, i)];
    const sel = (r && r.sel) || [];
    if(q.tipo === 'multipla'){
      if(typeof q.bom !== 'number' || !sel.length) return null;
      return sel.length >= q.bom ? 0 : (sel.length >= q.bom - 1 ? 0.5 : 1);
    }
    if(!sel.length) return null;
    const o = optObj((q.opcoes || [])[sel[0]]);
    return typeof o.dor === 'number' ? o.dor : null;
  }
  function catStats(c){
    let tot = 0, n = 0, alertas = 0;
    (c.perguntas || []).forEach((q, i) => { const d = dorQ(c, q, i); if(d == null) return; tot += d; n++; if(d >= 0.99) alertas++; });
    return { n, total:(c.perguntas || []).filter(pontua).length, alertas, aprov: n ? Math.round((1 - tot / n) * 100) : null };
  }
  const tier = a => a == null ? 'nodata' : (a < 34 ? 'red' : a < 66 ? 'yellow' : 'green');
  const TIER = { red:'Crítico', yellow:'Atenção', green:'Sob controle', nodata:'Sem dados' };
  function geral(){
    const st = cats().map(c => ({ c, s:catStats(c) })).filter(x => x.s.aprov != null);
    if(!st.length) return { aprov:null, st:[] };
    return { aprov: Math.round(st.reduce((a, x) => a + x.s.aprov, 0) / st.length), st };
  }
  function respostaTexto(c, q, i){
    const r = dx.resp[qkey(c, q, i)];
    const sel = (r && r.sel) || [];
    if(!sel.length) return '';
    return sel.map(oi => {
      const base = plain(raw(optPath(c, q, i, oi)));
      const campo = r.campos && r.campos[oi];
      return campo ? base + ': ' + campo : base;
    }).join(', ');
  }
  function catIndex(c){ return cats().indexOf(c); }
  function qPath(c, i){ return 'categorias.' + catIndex(c) + '.perguntas.' + i; }
  function optPath(c, q, i, oi){ const o = (q.opcoes || [])[oi]; return qPath(c, i) + '.opcoes.' + oi + (o && typeof o === 'object' ? '.t' : ''); }

  // ============ cálculos ============
  function calc(){
    const P = Object.assign({ recorrente:false, ganho:0.3, referencia:{} }, merged('projecao'));
    const ref = P.referencia || {};
    const leads = num('leads'), vendas = num('vendas'), ticket = num('ticket'), midia = num('midia');
    const V = vendas > 0 ? vendas : (ref.vendas || 10);
    const Tk = ticket > 0 ? ticket : (ref.ticket || 300);
    const usaRef = !(vendas > 0 && ticket > 0);
    const extra = Math.max(1, Math.round(V * P.ganho));
    const mensal = extra * Tk;
    const perm = P.permanencia > 0 ? P.permanencia : Infinity;
    const serie = n => { const a = []; for(let m = 1; m <= n; m++) a.push(P.recorrente ? mensal * Math.min(m, perm) : mensal * m); return a; };
    const total = n => P.recorrente ? serie(n).reduce((s, v) => s + v, 0) : mensal * n;
    const M = Math.round(num('meses')), C = num('custo'), R0 = num('receitaIni'), R1 = num('receitaHoje');
    let espera = null;
    if(M >= 1 && (R0 > 0 || R1 > 0)){
      const inc = (R1 - R0) / M;
      espera = { M, C, R0, R1, investido:C * M, inc, ganho:inc * M * (M + 1) / 2, varPct: R0 > 0 ? (R1 - R0) / R0 * 100 : null, nosso:total(M) };
    } else if(M >= 1 && C > 0){
      espera = { M, C, investido:C * M, semReceita:true };
    }
    return {
      P, leads, vendas, ticket, midia, V, Tk, usaRef, extra, mensal, serie, total, espera,
      conv: leads > 0 && vendas > 0 ? vendas / leads * 100 : null,
      cpl: leads > 0 && midia > 0 ? midia / leads : null,
      cac: vendas > 0 && midia > 0 ? midia / vendas : null,
      porPonto: leads > 0 && ticket > 0 ? leads * 0.01 * ticket : null
    };
  }
  function fraseEspera(e){
    if(!e) return '';
    const per = e.M === 1 ? '1 mês' : e.M + ' meses';
    if(e.semReceita) return `Em <b>${per}</b> foram <b>${brl(e.investido)}</b> investidos em comercial e marketing.`;
    const inv = e.C > 0 ? ` e <b>${brl(e.investido)}</b> investidos em comercial e marketing` : '';
    if(e.R1 < e.R0) return `Em <b>${per}</b>${inv}, a receita mensal <b>caiu ${brl(e.R0 - e.R1)}</b>.`;
    if(e.R1 === e.R0) return `Em <b>${per}</b>${inv}, a receita mensal <b>ficou parada</b>.`;
    return `Em <b>${per}</b>${inv}, a receita mensal subiu <b>${brl(e.R1 - e.R0)}</b>${e.varPct != null ? ` (<b>+${nf1.format(e.varPct)}%</b>)` : ''}.`;
  }
  function leitura(aprov, piores){
    if(aprov == null) return 'Ainda sem respostas suficientes para a leitura.';
    const emp = termo('empresa');
    let t;
    if(aprov < 34) t = `A ${emp} aproveita hoje ${aprov}% do potencial comercial que já tem. A maior parte do resultado depende de esforço individual, não de processo.`;
    else if(aprov < 66) t = `A ${emp} aproveita hoje ${aprov}% do potencial comercial que já tem. Parte do processo existe, mas convive com etapas que dependem de memória e improviso.`;
    else t = `A ${emp} aproveita hoje ${aprov}% do potencial comercial que já tem, com processo presente na maior parte das áreas. Ainda dá para destravar o resto.`;
    if(piores.length) t += ` Os maiores pontos de atenção estão em ${piores.join(' e ')}.`;
    return t;
  }
  function piores(g){ return g.st.filter(x => x.s.aprov < 66).sort((a, b) => a.s.aprov - b.s.aprov).slice(0, 2).map(x => plain(raw('categorias.' + catIndex(x.c) + '.nome'))); }

  // ============ slides ============
  function campo(grupo, id, tipo){
    const b = grupo + '.campos.' + id;
    const pre = raw(b + '.pre');
    return `<div class="field">
      ${T(b + '.rotulo', 'label', '')}
      ${raw(b + '.hint') != null ? T(b + '.hint', 'div', 'fhint') : ''}
      <div class="inwrap">${pre ? `<span class="pre">${esc(pre)}</span>` : ''}<input id="n-${id}" data-num="${id}" type="${tipo || 'number'}" inputmode="decimal" placeholder="0" autocomplete="off"></div>
      ${T(b + '.suf', 'div', 'suf')}
    </div>`;
  }
  function stats(path){
    return `<div class="stats reveal">${list(path).map((s, i) => `<div class="stat">${T(path + '.' + i + '.valor', 'div', 'n count')}${T(path + '.' + i + '.rotulo', 'div', 'l')}</div>`).join('')}</div>`;
  }
  function foto(path, nomePath){
    const src = raw(path);
    if(src) return `<img class="photo" src="${esc(src)}" alt="">`;
    const nome = plain(raw(nomePath)) || '?';
    const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    return `<div class="photo" aria-hidden="true">${esc(ini)}</div>`;
  }

  const B = {
    capa: () => `
      <img class="logo-big reveal" src="${esc(MARCA.logo || '')}" alt="${esc(MARCA.nome || '')}">
      ${T('capa.kicker', 'div', 'kicker reveal')}
      ${T('capa.titulo', 'h1', 'h1 reveal')}
      <div class="capa-line reveal"></div>
      ${T('capa.sub', 'p', 'sub reveal')}`,

    especialista: () => `
      ${T('especialista.kicker', 'div', 'kicker reveal')}
      <div class="row reveal">
        ${foto('especialista.foto', 'especialista.nome')}
        <div style="display:flex;flex-direction:column;gap:.6cqw;min-width:0">
          ${T('especialista.nome', 'h2', 'h2')}
          ${T('especialista.cargo', 'div', 'sub')}
          ${T('especialista.local', 'div', 'small')}
        </div>
      </div>
      ${stats('especialista.numeros')}`,

    quemSomos: () => `
      ${T('quemSomos.kicker', 'div', 'kicker reveal')}
      ${T('quemSomos.titulo', 'h2', 'h2 reveal')}
      ${T('quemSomos.publicoTitulo', 'div', 'label reveal')}
      <div class="chips reveal">${list('publico').map((p, i) => T('publico.' + i, 'div', 'chip')).join('')}</div>
      ${stats('quemSomos.numeros')}`,

    problema: () => `
      ${T('problema.kicker', 'div', 'kicker reveal')}
      ${T('problema.titulo', 'h2', 'h2 reveal')}
      ${T('problema.texto', 'p', 'sub reveal')}
      <div class="pillars reveal">${list('problema.pilares').map((p, i) => `<div class="pillar">${T('problema.pilares.' + i + '.nome', 'div', 'pn')}${T('problema.pilares.' + i + '.texto', 'div', 'pt')}</div>`).join('')}</div>`,

    raiox: () => `
      ${T('raiox.kicker', 'div', 'kicker reveal')}
      ${T('raiox.titulo', 'h2', 'h2 reveal')}
      <div class="rx-steps reveal">${cats().map((c, i) => `<div class="rx-step"><i>${i + 1}</i>${T('categorias.' + i + '.nome')}</div>`).join('')}</div>
      ${T('raiox.sub', 'p', 'sub reveal')}
      <div class="ident reveal">
        <div class="field"><label for="id-empresa">${esc(termo('Empresa'))}</label><div class="inwrap"><input class="txt" id="id-empresa" data-id="empresa" type="text" placeholder="Nome" autocomplete="off"></div></div>
        <div class="field"><label for="id-responsavel">Responsável</label><div class="inwrap"><input class="txt" id="id-responsavel" data-id="responsavel" type="text" placeholder="Quem decide" autocomplete="off"></div></div>
        <div class="field"><label for="id-whatsapp">WhatsApp</label><div class="inwrap"><input class="txt" id="id-whatsapp" data-id="whatsapp" type="tel" inputmode="tel" placeholder="(00) 00000-0000" autocomplete="off"></div></div>
        <div class="field"><label for="id-data">Data</label><div class="inwrap"><input class="txt" id="id-data" data-id="data" type="date"></div></div>
      </div>
      <div class="btn-row reveal"><button class="btn ghost" type="button" data-act="novo">Novo diagnóstico</button></div>`,

    categoria: (c, ci) => {
      const total = cats().length;
      return `
      <div class="kicker reveal">Raio-X · ${ci + 1} de ${total}</div>
      ${T('categorias.' + ci + '.titulo', 'h2', 'h2 reveal')}
      ${T('categorias.' + ci + '.sub', 'p', 'sub reveal')}
      <div class="qgrid reveal">${(c.perguntas || []).map((q, qi) => {
        const qp = 'categorias.' + ci + '.perguntas.' + qi;
        const multi = q.tipo === 'multipla';
        return `<div class="q" data-q="${esc(qkey(c, q, qi))}" data-multi="${multi ? 1 : 0}">
          ${T(qp + '.texto', 'div', 'q-t')}
          ${q.sub != null || multi ? (q.sub != null ? T(qp + '.sub', 'div', 'q-s') : '<div class="q-s">Pode marcar mais de um</div>') : ''}
          <div class="opts">${(q.opcoes || []).map((o, oi) => {
            const ob = optObj(o);
            return `<div class="opt" role="button" tabindex="0" data-oi="${oi}">${T(optPath(c, q, qi, oi))}${ob.campo ? ` <input class="opt-in" type="text" data-campo="${oi}" placeholder="${esc(ob.campo)}" aria-label="${esc(ob.campo)}">` : ''}</div>`;
          }).join('')}</div>
        </div>`;
      }).join('')}</div>`;
    },

    numeros: () => `
      ${T('numeros.kicker', 'div', 'kicker reveal')}
      ${T('numeros.titulo', 'h2', 'h2 reveal')}
      ${T('numeros.sub', 'p', 'sub reveal')}
      <div class="fields f4 reveal">${['leads', 'vendas', 'ticket', 'midia'].map(id => campo('numeros', id)).join('')}</div>
      <div class="derived reveal" id="derived"></div>`,

    tempo: () => `
      ${T('tempo.kicker', 'div', 'kicker reveal')}
      ${T('tempo.titulo', 'h2', 'h2 reveal')}
      ${T('tempo.sub', 'p', 'sub reveal')}
      <div class="fields reveal">${['meses', 'custo', 'receitaIni', 'receitaHoje'].map(id => campo('tempo', id)).join('')}</div>`,

    painel: () => `
      ${T('painel.kicker', 'div', 'kicker reveal')}
      ${T('painel.titulo', 'h2', 'h2 reveal')}
      <div class="dash reveal">
        <div class="dash-left">
          <div class="card ov">
            <div class="gauge" id="gGeral"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="fil" cx="60" cy="60" r="52" stroke-dasharray="326.73" stroke-dashoffset="326.73"/></svg>
              <div class="ctr"><div class="pct" id="gPct">--</div><div class="pl">de aproveitamento comercial</div></div></div>
            <div class="ov-side"><div class="tier" id="gTier">Sem dados</div><div class="small" id="gTxt"></div></div>
          </div>
          <div class="card cats" id="dCats"></div>
        </div>
        <div class="dash-right">
          <div class="card"><div class="label" style="margin-bottom:.5cqw">O custo de esperar</div><div class="phrase" id="dEspera"></div></div>
          <div class="card"><div class="label" style="margin-bottom:.5cqw">Leads na mesa</div><div class="phrase" id="dMesa"></div></div>
          <div class="cmp" id="dCmp">
            <div class="card"><div class="label">Você, no período</div><div class="val" id="dMine">--</div><div class="small" id="dMineS"></div></div>
            <div class="card nosso"><div class="label">${T('painel.nosso')}</div><div class="val" id="dNosso">--</div><div class="small" id="dNossoS"></div></div>
          </div>
          <div class="flag" id="dFlag" hidden></div>
        </div>
      </div>`,

    metodo: () => {
      const et = list('metodo.etapas');
      return `
      ${T('metodo.kicker', 'div', 'kicker reveal')}
      ${T('metodo.titulo', 'h2', 'h2 reveal')}
      <div class="flow reveal" style="--n:${et.length}">${et.map((e, i) => `<div class="fstep">${T('metodo.etapas.' + i + '.nome', 'div', 'fn')}${T('metodo.etapas.' + i + '.texto', 'div', 'ft')}</div>`).join('')}</div>
      ${T('metodo.fecho', 'p', 'sub reveal')}`;
    },

    perfis: () => `
      ${T('perfis.kicker', 'div', 'kicker reveal')}
      ${T('perfis.titulo', 'h2', 'h2 reveal')}
      <div class="prof reveal">${list('perfis.itens').map((p, i) => `<div class="prow">${T('perfis.itens.' + i + '.perfil', 'div', 'pp')}<div class="pa" aria-hidden="true">→</div>${T('perfis.itens.' + i + '.dor', 'div', 'pd')}</div>`).join('')}</div>`,

    case: () => {
      const img = raw('case.imagem');
      return `
      ${T('case.kicker', 'div', 'kicker reveal')}
      ${T('case.cliente', 'h2', 'h2 reveal')}
      <div class="case reveal">
        <div class="case-shot">${img ? `<img src="${esc(img)}" alt="">` : '<div>Espaço para o print do resultado.<br>Coloque a imagem em assets/ e informe o caminho em <b>case.imagem</b> (marca.js ou no nicho).</div>'}</div>
        <div style="display:flex;flex-direction:column;gap:1.2cqw;min-width:0">
          ${T('case.segmento', 'div', 'label')}
          ${T('case.texto', 'p', 'sub')}
          ${stats('case.numeros').replace('stats reveal', 'stats')}
        </div>
      </div>`;
    },

    entregas: () => {
      const it = list('entregas.itens');
      return `
      ${T('entregas.kicker', 'div', 'kicker reveal')}
      ${T('entregas.titulo', 'h2', 'h2 reveal')}
      <div class="deliv reveal" style="--n:${it.length}">${it.map((d, i) => `<div class="dcol">${T('entregas.itens.' + i + '.nome', 'div', 'h3')}<ul>${(d.itens || []).map((b, j) => T('entregas.itens.' + i + '.itens.' + j, 'li')).join('')}</ul></div>`).join('')}</div>`;
    },

    time: () => {
      const ps = list('time.pessoas');
      return `
      ${T('time.kicker', 'div', 'kicker reveal')}
      ${T('time.titulo', 'h2', 'h2 reveal')}
      <div class="team reveal" style="--n:${ps.length}">${ps.map((p, i) => `<div class="person">${foto('time.pessoas.' + i + '.foto', 'time.pessoas.' + i + '.nome')}${T('time.pessoas.' + i + '.nome', 'div', 'h3')}${T('time.pessoas.' + i + '.cargo', 'div', 'role')}${T('time.pessoas.' + i + '.texto', 'p')}</div>`).join('')}</div>`;
    },

    projecao: n => `
      ${T('projecao.kicker' + n, 'div', 'kicker reveal')}
      ${T('projecao.titulo' + n, 'h2', 'h2 reveal')}
      <div class="proj reveal">
        <div><div class="bars" id="bars${n}">${Array.from({ length:n }, (_, i) => `<div class="bar-c"><div class="bar-t"><div class="bar-f"><span class="bar-v"></span></div></div><div class="bar-l">${n <= 6 ? 'Mês ' + (i + 1) : i + 1}</div></div>`).join('')}</div>
          <div class="basis" id="barsL${n}" style="margin-top:.6cqw"></div></div>
        <div class="proj-side">
          <div class="label">Somando os ${n} meses <span class="tag-est">Estimativa</span></div>
          <div class="total-v" id="tot${n}">--</div>
          <div class="basis" id="base${n}"></div>
          ${T('projecao.nota', 'div', 'basis')}
        </div>
      </div>`,

    valores: () => `
      ${T('valores.kicker', 'div', 'kicker reveal')}
      ${T('valores.titulo', 'h2', 'h2 reveal')}
      <div class="vstack reveal">${list('valores.itens').map((v, i) => `<div class="vrow">${T('valores.itens.' + i + '.nome', 'span', 'vn')}<span class="dots"></span>${T('valores.itens.' + i + '.valor', 'span', 'vv')}</div>`).join('')}
        <div class="vrow tot"><span>${T('valores.totalRotulo')} <span class="tag-est">Estimativa</span></span><span class="dots"></span>${T('valores.total', 'span', 'vv')}</div></div>`,

    planos: () => {
      const ps = list('planos.itens');
      return `
      ${T('planos.kicker', 'div', 'kicker reveal')}
      ${T('planos.titulo', 'h2', 'h2 reveal')}
      <div class="plans reveal" style="--n:${ps.length}">${ps.map((p, i) => {
        const b = 'planos.itens.' + i;
        return `<div class="plan${p.destaque ? ' hi' : ''}">${raw(b + '.selo') ? T(b + '.selo', 'div', 'badge') : ''}${T(b + '.nome', 'div', 'pn')}
          <div class="pv">${T(b + '.preco')}<small>${T(b + '.per')}</small></div>${T(b + '.detalhe', 'div', 'pd')}
          <ul>${(p.beneficios || []).map((x, j) => T(b + '.beneficios.' + j, 'li')).join('')}</ul></div>`;
      }).join('')}</div>
      ${T('planos.implantacao', 'div', 'note reveal')}`;
    },

    garantia: () => `
      ${T('garantia.kicker', 'div', 'kicker reveal')}
      ${T('garantia.titulo', 'h2', 'h2 reveal')}
      ${T('garantia.texto', 'p', 'sub reveal')}
      <div class="plans reveal" style="--n:2">
        <div class="plan"><div class="pn">6 meses</div><div class="pv" id="gar6" style="font-size:clamp(20px,2.4cqw,38px)">--</div>${T('garantia.meta6', 'div', 'pd')}</div>
        <div class="plan hi"><div class="badge">Estimativa</div><div class="pn">12 meses</div><div class="pv" id="gar12" style="font-size:clamp(20px,2.4cqw,38px)">--</div>${T('garantia.meta12', 'div', 'pd')}</div>
      </div>
      ${T('garantia.rodape', 'p', 'note reveal')}`,

    fechamento: () => `
      ${T('fechamento.kicker', 'div', 'kicker reveal')}
      ${T('fechamento.titulo', 'h1', 'h1 reveal')}
      ${T('fechamento.texto', 'p', 'sub reveal')}
      <div class="bonus reveal">${T('fechamento.bonusRotulo', 'div', 'label')}${T('fechamento.bonus', 'div', 'h3')}</div>
      <div class="contact reveal"><span>WhatsApp ${T('contato.whatsapp', 'b')}</span><span>${T('contato.site', 'b')}</span><span>${T('contato.instagram', 'b')}</span></div>
      <img class="logo-small reveal" src="${esc(MARCA.logo || '')}" alt="${esc(MARCA.nome || '')}">`,

    salvar: () => `
      ${T('salvar.kicker', 'div', 'kicker reveal')}
      ${T('salvar.titulo', 'h2', 'h2 reveal')}
      <div class="save reveal">
        <div class="card" style="display:flex;flex-direction:column;gap:.6cqw">
          <div class="save-name" id="sNome"></div>
          <div class="small" id="sMeta"></div>
          <div class="cats" id="sCats"></div>
          <div class="btn-row" style="margin-top:.8cqw">
            <button class="btn" type="button" data-act="pdf-plano">Relatório + plano de ação</button>
            <button class="btn ghost" type="button" data-act="pdf">Relatório</button>
            <button class="btn ghost" type="button" data-act="copiar">Copiar resumo</button>
            <button class="btn ghost" type="button" data-act="novo">Novo diagnóstico</button>
          </div>
        </div>
        <div class="card"><div class="label" style="margin-bottom:.7cqw">Pontos de atenção</div><ul class="alerts" id="sAlerts"></ul></div>
      </div>`
  };

  function defs(){
    const d = [
      { id:'capa', html:B.capa, cls:'capa' },
      { id:'especialista', html:B.especialista },
      { id:'quem-somos', html:B.quemSomos },
      { id:'problema', html:B.problema },
      { id:'raiox', html:B.raiox }
    ];
    cats().forEach((c, ci) => d.push({ id:'rx-' + c.id, html:() => B.categoria(c, ci) }));
    d.push(
      { id:'numeros', html:B.numeros },
      { id:'tempo', html:B.tempo },
      { id:'painel', html:B.painel },
      { id:'metodo', html:B.metodo },
      { id:'perfis', html:B.perfis },
      { id:'case', html:B.case },
      { id:'entregas', html:B.entregas },
      { id:'time', html:B.time },
      { id:'projecao-6', html:() => B.projecao(6) },
      { id:'projecao-12', html:() => B.projecao(12) },
      { id:'valores', html:B.valores },
      { id:'planos', html:B.planos },
      { id:'garantia', html:B.garantia },
      { id:'fechamento', html:B.fechamento },
      { id:'salvar', html:B.salvar }
    );
    return d;
  }
  function ocultos(){
    const e = ED.nicho._ocultos;
    if(Array.isArray(e)) return e;
    return [].concat(MARCA.ocultar || [], (N && N.ocultar) || []);
  }

  // ============ montagem ============
  const slidesEl = $('#slides');
  function montar(manterId){
    refreshED();
    const hid = ocultos();
    const ds = defs().filter(d => editing || !hid.includes(d.id));
    slidesEl.innerHTML = ds.map(d => `<section class="slide ${d.cls || ''}${hid.includes(d.id) ? ' oculto' : ''}" data-id="${d.id}" aria-label="${esc(d.id)}">${d.html()}</section>`).join('');
    slides = $$('.slide', slidesEl).map(el => ({ id:el.dataset.id, el }));
    slides.forEach(s => $$('.reveal', s.el).forEach((r, i) => r.style.setProperty('--i', i)));
    preencherCampos();
    if(editing) entrarEdicao();
    const dots = $('#dots');
    dots.innerHTML = slides.map((s, i) => `<button class="dot" type="button" aria-label="Ir para o slide ${i + 1}" data-go="${i}"></button>`).join('');
    let novo = manterId ? slides.findIndex(s => s.id === manterId) : 0;
    idx = -1;
    ir(novo < 0 ? 0 : novo, true);
    $('#nichoNome').textContent = N ? N.nome : 'Escolher';
    computar(false);
  }

  function preencherCampos(){
    $$('[data-id]', slidesEl).forEach(inp => { inp.value = dx.ident[inp.dataset.id] || ''; });
    $$('[data-num]', slidesEl).forEach(inp => { const v = dx.nums[inp.dataset.num]; inp.value = v == null ? '' : v; });
    $$('.q', slidesEl).forEach(q => {
      const r = dx.resp[q.dataset.q];
      $$('.opt', q).forEach(o => o.classList.toggle('sel', !!(r && r.sel && r.sel.includes(+o.dataset.oi))));
      $$('[data-campo]', q).forEach(inp => { inp.value = (r && r.campos && r.campos[inp.dataset.campo]) || ''; });
    });
  }

  // ============ navegação ============
  function ir(i, forcar){
    if(i < 0 || i >= slides.length || (i === idx && !forcar)) return;
    idx = i;
    slides.forEach((s, j) => {
      s.el.classList.toggle('active', j === idx);
      s.el.classList.toggle('before', j < idx);
      s.el.setAttribute('aria-hidden', j === idx ? 'false' : 'true');
    });
    $$('.dot').forEach((d, j) => d.classList.toggle('on', j === idx));
    const pad = n => (n < 10 ? '0' : '') + n;
    $('#counter').textContent = pad(idx + 1) + ' / ' + pad(slides.length);
    $('#progress').style.width = (slides.length > 1 ? idx / (slides.length - 1) * 100 : 0) + '%';
    $('#stage').dataset.slide = slides[idx].id;
    $('#ebHide').textContent = slides[idx].el.classList.contains('oculto') ? 'Mostrar slide' : 'Ocultar slide';
    ativar(slides[idx].el);
  }
  const next = () => ir(idx + 1);
  const prev = () => ir(idx - 1);

  function parseStat(txt){
    const m = /^(\D*?)(\d[\d.]*(?:,\d+)?)(.*)$/.exec(txt.trim());
    if(!m) return null;
    const dec = m[2].includes(',') ? m[2].split(',')[1].length : 0;
    return { pre:m[1], val:parseFloat(m[2].replace(/\./g, '').replace(',', '.')), dec, suf:m[3] };
  }
  function contar(el){
    if(editing || el.querySelector('.ph') || el.dataset.busy) return;
    const p = parseStat(el.textContent);
    if(!p || !isFinite(p.val)) return;
    const f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits:p.dec, maximumFractionDigits:p.dec });
    const fim = el.innerHTML, t0 = performance.now(), dur = 1300;
    el.dataset.busy = 1;
    (function frame(now){
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = p.pre + f.format(p.val * e) + p.suf;
      if(k < 1) requestAnimationFrame(frame); else { el.innerHTML = fim; delete el.dataset.busy; }
    })(t0);
  }
  function ativar(el){
    $$('.count', el).forEach(c => setTimeout(() => contar(c), 450));
    $$('.bar-f', el).forEach(b => { b.style.transition = 'none'; b.style.height = '0'; });
    $$('.gauge .fil', el).forEach(c => { c.style.transition = 'none'; c.style.strokeDashoffset = '326.73'; });
    $$('.cb .bar i', el).forEach(b => { b.style.transition = 'none'; b.style.width = '0'; });
    void el.offsetWidth;
    setTimeout(() => {
      $$('.bar-f', el).forEach((b, i) => { b.style.transition = ''; b.style.transitionDelay = (i * 60) + 'ms'; b.style.height = b.dataset.h || '0'; });
      $$('.gauge .fil', el).forEach(c => { c.style.transition = ''; c.style.strokeDashoffset = c.dataset.off || '326.73'; });
      $$('.cb .bar i', el).forEach(b => { b.style.transition = ''; b.style.width = b.dataset.w || '0'; });
    }, 380);
  }

  // ============ cálculo na tela ============
  function setGauge(el, aprov){
    const C = 326.73, off = aprov == null ? C : C * (1 - aprov / 100);
    el.classList.remove('red', 'yellow', 'green');
    if(aprov != null) el.classList.add(tier(aprov));
    const c = $('.fil', el);
    c.dataset.off = off.toFixed(2);
    c.style.strokeDashoffset = off.toFixed(2);
  }
  function catBars(alvo){
    if(!alvo) return;
    alvo.innerHTML = cats().map((c, i) => {
      const s = catStats(c), t = tier(s.aprov);
      return `<div class="cb"><span>${fmt(raw('categorias.' + i + '.nome'))}</span><span class="bar"><i class="${t}" data-w="${s.aprov == null ? 0 : s.aprov}%" style="width:${s.aprov == null ? 0 : s.aprov}%"></i></span><span class="v">${s.aprov == null ? '--' : s.aprov + '%'}</span></div>`;
    }).join('');
  }
  function computar(){
    if(!N) return;
    const k = calc(), g = geral();
    const set = (id, h) => { const el = document.getElementById(id); if(el) el.innerHTML = h; };

    // campos derivados
    const der = [];
    if(k.conv != null) der.push(`Conversão: <b>${pct(k.conv)}</b>`);
    if(k.cpl != null) der.push(`Custo por lead: <b>${brl(k.cpl)}</b>`);
    if(k.cac != null) der.push(`Custo por ${esc(termo('venda'))}: <b>${brl(k.cac)}</b>`);
    if(k.vendas > 0 && k.ticket > 0) der.push(`Receita das ${esc(termo('vendas'))} do mês: <b>${brl(k.vendas * k.ticket)}</b>`);
    set('derived', der.map(d => `<span class="dchip">${d}</span>`).join(''));

    // textos ao vivo
    $$('.live[data-live="meses"]').forEach(s => { s.textContent = k.espera ? (k.espera.M === 1 ? '1 mês' : k.espera.M + ' meses') : '___ meses'; });
    const r = k.total(12) / Math.max(1, k.total(6));
    $$('.live[data-live="fator12"]').forEach(s => { s.textContent = r >= 3 ? 'mais que triplica' : r > 2.05 ? 'mais que dobra' : 'dobra'; });

    // painel
    const gg = $('#gGeral');
    if(gg){
      setGauge(gg, g.aprov);
      set('gPct', g.aprov == null ? '--' : g.aprov + '%');
      const t = tier(g.aprov), tEl = $('#gTier');
      tEl.className = 'tier ' + t;
      tEl.textContent = g.aprov == null ? 'Sem dados' : ({ red:'No vermelho', yellow:'Dá pra melhorar muito', green:'No caminho certo' })[t];
      set('gTxt', esc(g.aprov == null ? 'Marque as respostas do raio-x para ver o placar aqui.' : leitura(g.aprov, piores(g))));
      catBars($('#dCats'));
      const e = k.espera;
      set('dEspera', e ? fraseEspera(e) : `<span class="empty" style="display:block">Preencha tempo, custo e receita na página <b>${esc(plain(raw('tempo.titulo')))}</b>.</span>`);
      set('dMesa', k.conv != null
        ? `De <b>${nf0.format(k.leads)} leads</b> por mês, <b>${nf1.format(k.vendas)}</b> viram ${esc(termo('venda'))} (<b>${pct(k.conv)}</b>).` +
          (k.porPonto != null ? ` Cada <b>+1 ponto</b> de conversão vale <b>${brl(k.porPonto)}</b> a mais por mês.` : '')
        : `<span class="empty" style="display:block">Preencha leads e ${esc(termo('vendas'))} por mês na página <b>${esc(plain(raw('numeros.titulo')))}</b>.</span>`);
      const cmp = $('#dCmp'), flag = $('#dFlag');
      if(e && !e.semReceita){
        cmp.style.display = '';
        set('dMine', (e.ganho < 0 ? '−' : '') + brl(Math.abs(e.ganho)));
        set('dMineS', esc(e.inc === 0 ? 'sem crescimento de receita no período' : `de receita ${e.ganho < 0 ? 'perdida' : 'a mais'}, somando mês a mês em ${e.M} ${e.M === 1 ? 'mês' : 'meses'}`));
        set('dNosso', brl(e.nosso));
        set('dNossoS', esc(`estimativa com +${k.extra} ${termo('vendas')}/mês × ${brl(k.Tk)}, no mesmo prazo`));
        const ratio = e.nosso / Math.max(e.ganho, 1);
        flag.hidden = false;
        flag.className = 'flag ' + (ratio > 3 ? 'red' : ratio > 1.5 ? 'yellow' : 'green');
        flag.textContent = ratio > 3 ? 'Muita receita ficando na mesa' : ratio > 1.5 ? 'Dá pra crescer bem mais' : 'Vocês estão no caminho certo';
      } else {
        cmp.style.display = 'none';
        flag.hidden = true;
      }
    }

    // projeções
    [6, 12].forEach(n => {
      const bars = document.getElementById('bars' + n);
      if(!bars) return;
      const s = k.serie(n), mx = Math.max.apply(null, s.concat([1]));
      $$('.bar-f', bars).forEach((b, i) => {
        const h = (s[i] / mx * 100).toFixed(1) + '%';
        b.dataset.h = h;
        if(b.style.height && b.style.height !== '0px' && b.style.height !== '0') b.style.height = h;
        $('.bar-v', b).textContent = brlK(s[i]);
        b.title = (k.P.recorrente ? 'Receita extra no mês ' : 'Acumulado até o mês ') + (i + 1) + ': ' + brl(s[i]);
      });
      set('barsL' + n, esc(k.P.recorrente ? 'Cada barra: receita a mais naquele mês. Os novos ' + termo('clientes') + ' continuam pagando, então soma.' : 'Cada barra: receita a mais acumulada até aquele mês.'));
      set('tot' + n, brl(k.total(n)));
      set('base' + n, esc(`Base: +${k.extra} ${termo('vendas')}/mês (${Math.round(k.P.ganho * 100)}% sobre ${nf1.format(k.V)} de hoje) × ${termo('ticket')} de ${brl(k.Tk)}.`) +
        (k.usaRef ? ' <span class="ph">[valores de referência: preencha a página de números]</span>' : ''));
      set('gar' + n, brl(k.total(n)));
    });

    // salvar
    const sn = $('#sNome');
    if(sn){
      sn.textContent = dx.ident.empresa || (termo('Empresa') + ' sem nome');
      set('sMeta', esc([N.nome, dataBR(dx.ident.data), dx.ident.responsavel, dx.ident.whatsapp].filter(Boolean).join(' · ')) +
        (g.aprov != null ? ` · <b style="color:var(--tx)">${g.aprov}% de aproveitamento (${TIER[tier(g.aprov)]})</b>` : ''));
      catBars($('#sCats'));
      const al = alertas();
      set('sAlerts', al.length ? al.map(a => `<li class="${a.dor >= 0.99 ? 'd1' : ''}">${esc(a.cat)}: ${esc(a.q)} <b style="color:var(--tx)">${esc(a.resp)}</b></li>`).join('') : '<li style="padding-left:0">Nenhum ponto marcado ainda.</li>');
    }
  }
  function alertas(){
    const out = [];
    cats().forEach((c, ci) => (c.perguntas || []).forEach((q, qi) => {
      const d = dorQ(c, q, qi);
      if(d == null || d === 0) return;
      out.push({ dor:d, cat:plain(raw('categorias.' + ci + '.nome')), q:plain(raw(qPath(c, qi) + '.texto')), resp:respostaTexto(c, q, qi), acao:plain(raw(qPath(c, qi) + '.acao')) });
    }));
    return out.sort((a, b) => b.dor - a.dor);
  }
  function dataBR(iso){ if(!iso) return ''; const p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }

  // ============ interação ============
  slidesEl.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if(act){ acao(act.dataset.act, act); return; }
    if(editing) return;
    if(e.target.closest('.opt-in')) return;
    const opt = e.target.closest('.opt');
    if(!opt) return;
    const q = opt.closest('.q'), key = q.dataset.q, oi = +opt.dataset.oi;
    const r = dx.resp[key] = dx.resp[key] || { sel:[], campos:{} };
    if(q.dataset.multi === '1'){
      r.sel = r.sel.includes(oi) ? r.sel.filter(x => x !== oi) : r.sel.concat(oi);
    } else {
      r.sel = r.sel[0] === oi ? [] : [oi];
    }
    $$('.opt', q).forEach(o => o.classList.toggle('sel', r.sel.includes(+o.dataset.oi)));
    salvarDx(); computar();
  });
  slidesEl.addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.k !== undefined && editing){ const [sc, ...p] = t.dataset.k.split(':'); setEdit(sc, p.join(':'), t.textContent); return; }
    if(t.dataset.num){ dx.nums[t.dataset.num] = t.value; salvarDx(); computar(); return; }
    if(t.dataset.id){ dx.ident[t.dataset.id] = t.value; salvarDx(); computar(); return; }
    if(t.dataset.campo){
      const q = t.closest('.q'), key = q.dataset.q, oi = +t.dataset.campo;
      const r = dx.resp[key] = dx.resp[key] || { sel:[], campos:{} };
      r.campos = r.campos || {};
      r.campos[oi] = t.value;
      if(t.value && !r.sel.includes(oi)){
        r.sel = q.dataset.multi === '1' ? r.sel.concat(oi) : [oi];
        $$('.opt', q).forEach(o => o.classList.toggle('sel', r.sel.includes(+o.dataset.oi)));
      }
      salvarDx(); computar();
    }
  });
  slidesEl.addEventListener('keydown', e => {
    if(e.target.classList.contains('opt-in') && (e.key === ' ' || e.key === 'Enter')) e.stopPropagation();
    if(!editing && e.target.classList.contains('opt') && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); e.stopPropagation(); e.target.click(); }
  });

  document.addEventListener('keydown', e => {
    const t = e.target, tag = (t && t.tagName) || '';
    if(tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)){
      if(t.isContentEditable && e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); t.blur(); }
      if(e.key === 'Escape') t.blur();
      return;
    }
    if(!$('#picker').hidden){ if(e.key === 'Escape' && N) fecharPicker(); return; }
    if((e.key === ' ' || e.key === 'Enter') && t && t.closest && t.closest('button,[role="button"],a')) return;
    if(['ArrowRight', 'PageDown', ' '].includes(e.key)){ e.preventDefault(); next(); }
    else if(['ArrowLeft', 'PageUp'].includes(e.key)){ e.preventDefault(); prev(); }
    else if(e.key === 'Home') ir(0);
    else if(e.key === 'End') ir(slides.length - 1);
    else if(e.key === 'f' || e.key === 'F') telaCheia();
    else if(e.key === 'e' || e.key === 'E') alternarEdicao();
    else if(e.key === 'Escape' && editing) alternarEdicao();
  });
  let tx0 = null, ty0 = null;
  slidesEl.addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; }, { passive:true });
  slidesEl.addEventListener('touchend', e => {
    if(tx0 == null) return;
    const dxp = e.changedTouches[0].clientX - tx0, dyp = e.changedTouches[0].clientY - ty0;
    if(Math.abs(dxp) > 60 && Math.abs(dxp) > Math.abs(dyp) * 1.5 && !e.target.closest('input,[contenteditable="true"],[contenteditable="plaintext-only"]')) (dxp < 0 ? next() : prev());
    tx0 = null;
  });
  $('#next').addEventListener('click', next);
  $('#prev').addEventListener('click', prev);
  $('#dots').addEventListener('click', e => { const d = e.target.closest('[data-go]'); if(d) ir(+d.dataset.go); });
  $('#fsBtn').addEventListener('click', telaCheia);
  $('#editBtn').addEventListener('click', alternarEdicao);
  function telaCheia(){
    try{
      if(!document.fullscreenElement){ const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if(p && p.catch) p.catch(() => toast('Tela cheia não disponível aqui.')); }
      else document.exitFullscreen();
    }catch(e){ toast('Tela cheia não disponível aqui.'); }
  }
  let toastT = null;
  function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
  setTimeout(() => $('#hint').classList.add('off'), 5000);

  // confirmação em dois cliques (o visualizador não mostra confirm())
  function confirmar(btn, rotulo, fn){
    if(btn.dataset.conf){ delete btn.dataset.conf; btn.textContent = btn.dataset.orig; fn(); return; }
    btn.dataset.orig = btn.textContent; btn.dataset.conf = 1; btn.textContent = rotulo;
    setTimeout(() => { if(btn.dataset.conf){ delete btn.dataset.conf; btn.textContent = btn.dataset.orig; } }, 3500);
  }

  function acao(a, btn){
    if(a === 'novo') return confirmar(btn, 'Clique de novo para apagar', () => { dx = novoDx(); store.del(dxKey()); const id = slides[idx] && slides[idx].id; montar(id); toast('Diagnóstico zerado.'); });
    if(a === 'pdf') return gerarPdf(false, btn);
    if(a === 'pdf-plano') return gerarPdf(true, btn);
    if(a === 'copiar') return copiarResumo();
  }

  // ============ seletor de nicho ============
  function abrirPicker(){
    $('#pkGrid').innerHTML = NICHOS.map(n => {
      const nq = (n.categorias || []).reduce((s, c) => s + (c.perguntas || []).length, 0);
      return `<button class="pk-card${N && N.id === n.id ? ' cur' : ''}" type="button" data-nicho="${esc(n.id)}">
        <div class="pk-meta">${(n.categorias || []).length} áreas · ${nq} perguntas</div>
        <div class="h3">${esc(n.nome)}</div><div class="small">${esc(n.descricao || '')}</div></button>`;
    }).join('') || '<p class="sub">Nenhum nicho carregado. Confira as linhas &lt;script src="nichos/..."&gt; no index.html.</p>';
    $('#pkClose').hidden = !N;
    $('#picker').hidden = false;
    const first = $('.pk-card', $('#picker')); if(first) first.focus();
  }
  function fecharPicker(){ $('#picker').hidden = true; }
  $('#nichoBtn').addEventListener('click', abrirPicker);
  $('#pkClose').addEventListener('click', fecharPicker);
  $('#pkGrid').addEventListener('click', e => { const c = e.target.closest('[data-nicho]'); if(c){ escolherNicho(c.dataset.nicho); fecharPicker(); } });
  function escolherNicho(id){
    const n = NICHOS.find(x => x.id === id);
    if(!n) return;
    N = n;
    store.set('rb:nicho', id);
    try{ history.replaceState(null, '', '#' + id); }catch(e){}
    dx = Object.assign(novoDx(), store.get(dxKey()) || {});
    montar();
    if(dx.ident && dx.ident.empresa) toast('Diagnóstico de ' + dx.ident.empresa + ' retomado.');
  }

  // ============ modo edição ============
  function entrarEdicao(){
    $$('[data-k]', slidesEl).forEach(el => {
      const [sc, ...p] = el.dataset.k.split(':');
      const v = raw(p.join(':'));
      el.textContent = v == null ? '' : String(v);
      try{ el.contentEditable = 'plaintext-only'; }catch(e){ el.contentEditable = 'true'; }
      if(el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
      el.spellcheck = true;
    });
  }
  function alternarEdicao(){
    editing = !editing;
    document.body.classList.toggle('editing', editing);
    $('#editbar').hidden = !editing;
    $('#editBtn').classList.toggle('on', editing);
    montar(slides[idx] && slides[idx].id);
    toast(editing ? 'Modo edição ligado.' : 'Alterações aplicadas.');
  }
  slidesEl.addEventListener('paste', e => {
    if(!editing || !e.target.closest('[data-k]')) return;
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, txt);
  });
  $('#ebDone').addEventListener('click', alternarEdicao);
  $('#ebHide').addEventListener('click', () => {
    const id = slides[idx].id, h = ocultos().slice();
    const i = h.indexOf(id);
    if(i >= 0) h.splice(i, 1); else h.push(id);
    localEd.nichos[N.id] = localEd.nichos[N.id] || {};
    localEd.nichos[N.id]._ocultos = h;
    store.set(ED_KEY, localEd);
    montar(id);
    toast(i >= 0 ? 'Slide volta a aparecer.' : 'Slide oculto na apresentação.');
  });
  $('#ebReset').addEventListener('click', e => confirmar(e.currentTarget, 'Confirmar: apagar edições', () => {
    localEd = norm(null); store.del(ED_KEY); montar(slides[idx] && slides[idx].id); toast('Edições deste navegador apagadas.');
  }));
  function todasEdicoes(){
    const out = { marca:Object.assign({}, embutidas.marca, localEd.marca), nichos:{} };
    new Set(Object.keys(embutidas.nichos).concat(Object.keys(localEd.nichos))).forEach(id => { out.nichos[id] = Object.assign({}, embutidas.nichos[id], localEd.nichos[id]); });
    return out;
  }
  $('#ebJson').addEventListener('click', () => {
    const data = Object.assign({ descricao:'Alterações do modo edição. Peça ao Claude Code: "aplique estas alterações em marca.js e nos nichos".', geradoEm:new Date().toISOString() }, todasEdicoes());
    salvarArquivo('alteracoes-apresentacao.json', JSON.stringify(data, null, 2), 'application/json');
  });
  $('#ebHtml').addEventListener('click', () => {
    const json = JSON.stringify(todasEdicoes()).replace(/</g, '\\u003c');
    const html = PRISTINE.replace(/(<script id="edicoes-embutidas" type="application\/json">)[\s\S]*?(<\/script>)/, (m, a, b) => a + json + b);
    salvarArquivo('apresentacao-' + (MARCA.curto || 'raio-x').toLowerCase() + '.html', html, 'text/html');
  });

  // ============ arquivos ============
  let dlCap = null;
  const dlPronto = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads').then(c => { dlCap = c; }).catch(() => {})
    : Promise.resolve();
  async function salvarArquivo(nome, data, mime){
    await Promise.race([dlPronto, new Promise(r => setTimeout(r, 1500))]);
    if(dlCap){
      try{ await dlCap.save({ filename:nome, data }); toast('Arquivo pronto.'); return; }
      catch(err){ if(err && err.code === 'declined') return; toast('Não foi possível salvar o arquivo aqui.'); return; }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type:mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Arquivo baixado.');
  }
  function slug(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }

  // ============ resumo e relatório ============
  function resumoTexto(){
    const k = calc(), g = geral(), L = [];
    L.push('Raio-X de Receita · ' + (dx.ident.empresa || termo('Empresa')) + (dx.ident.data ? ' · ' + dataBR(dx.ident.data) : ''));
    L.push(N.nome + (dx.ident.responsavel ? ' · ' + dx.ident.responsavel : ''));
    L.push('');
    if(g.aprov != null){
      L.push('Aproveitamento comercial: ' + g.aprov + '% (' + TIER[tier(g.aprov)] + ')');
      cats().forEach((c, i) => { const s = catStats(c); if(s.aprov != null) L.push('- ' + plain(raw('categorias.' + i + '.nome')) + ': ' + s.aprov + '%'); });
      L.push('');
    }
    const nums = [];
    if(k.leads) nums.push(nf0.format(k.leads) + ' leads/mês');
    if(k.vendas) nums.push(nf1.format(k.vendas) + ' ' + termo('vendas') + '/mês' + (k.conv != null ? ' (' + pct(k.conv) + ')' : ''));
    if(k.ticket) nums.push(termo('ticket') + ' ' + brl(k.ticket));
    if(k.midia) nums.push('anúncios ' + brl(k.midia) + '/mês');
    if(nums.length){ L.push('Números: ' + nums.join(' · ')); }
    if(k.porPonto != null) L.push('Cada +1 ponto de conversão: ' + brl(k.porPonto) + ' a mais por mês.');
    if(k.espera) L.push(fraseEspera(k.espera).replace(/<[^>]+>/g, ''));
    L.push('Projeção (estimativa): 6 meses ' + brl(k.total(6)) + ' · 12 meses ' + brl(k.total(12)));
    const al = alertas();
    if(al.length){ L.push(''); L.push('Pontos de atenção:'); al.slice(0, 8).forEach(a => L.push('- ' + a.q + ' → ' + a.resp)); }
    L.push(''); L.push(MARCA.nome || '');
    return L.join('\n');
  }
  function copiarResumo(){
    const txt = resumoTexto();
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
      ta.remove(); toast(ok ? 'Resumo copiado.' : 'Não consegui copiar. Use o relatório em PDF.');
    };
    try{ navigator.clipboard.writeText(txt).then(() => toast('Resumo copiado. Cole no WhatsApp ou no CRM.'), fallback); }catch(e){ fallback(); }
  }

  function montarRelatorio(comPlano){
    const k = calc(), g = geral(), rel = $('#rel');
    const emp = dx.ident.empresa || (termo('Empresa') + ' sem nome');
    const logo = MARCA.logoRelatorio || MARCA.logo || '';
    const head = titulo => `<div class="rp-head"><div><div class="rp-kick">${esc(titulo)} · ${esc(N.nome)}</div><div class="rp-name">${esc(emp)}</div>
      <div class="rp-meta">${esc([dx.ident.data ? 'Diagnóstico realizado em ' + dataBR(dx.ident.data) : '', dx.ident.responsavel, dx.ident.whatsapp].filter(Boolean).join(' · '))}</div></div>
      ${logo ? `<img src="${esc(logo)}" alt="">` : ''}</div>`;
    const foot = n => `<div class="rp-foot"><span>${esc(MARCA.nome || '')}${raw('contato.whatsapp') ? ' · ' + esc(plain(raw('contato.whatsapp'))) : ''}</span><span>Página ${n}</span></div>`;
    const t = tier(g.aprov);
    const catsH = cats().map((c, i) => { const s = catStats(c), tt = tier(s.aprov); return `<div class="rp-cb"><span>${esc(plain(raw('categorias.' + i + '.nome')))}</span><span class="b"><i class="${tt}" style="width:${s.aprov || 0}%"></i></span><span class="v">${s.aprov == null ? '--' : s.aprov + '%'}</span></div>`; }).join('');
    const kpi = (rot, v) => `<div class="rp-kpi"><div class="k">${esc(rot)}</div><div class="v">${v}</div></div>`;
    const p1 = `<div class="rp">${head('Raio-X de Receita')}
      <div class="rp-score"><div class="rp-pct ${t}">${g.aprov == null ? '--' : g.aprov + '%'}</div><div><div class="rp-tier ${t}">${TIER[t]}</div><div class="rp-read">${esc(leitura(g.aprov, piores(g)))}</div></div></div>
      <div><div class="rp-h">Aproveitamento por área</div><div class="rp-cats">${catsH}</div></div>
      <div><div class="rp-h">Números de hoje</div><div class="rp-grid">
        ${kpi('Leads por mês', k.leads ? nf0.format(k.leads) : '--')}
        ${kpi(termo('Vendas') + ' por mês', k.vendas ? nf1.format(k.vendas) : '--')}
        ${kpi('Conversão', k.conv != null ? pct(k.conv) : '--')}
        ${kpi(plain(raw('numeros.campos.ticket.rotulo')) || termo('Ticket'), k.ticket ? brl(k.ticket) : '--')}
        ${kpi('Custo por lead', k.cpl != null ? brl(k.cpl) : '--')}
        ${kpi('Custo por ' + termo('venda'), k.cac != null ? brl(k.cac) : '--')}
      </div></div>
      ${k.porPonto != null ? `<div class="rp-box">Dos <b>${nf0.format(k.leads)} leads</b> que chegam por mês, <b>${nf1.format(k.vendas)}</b> viram ${esc(termo('venda'))}. Cada <b>+1 ponto</b> de conversão vale <b>${brl(k.porPonto)}</b> a mais por mês, sem gastar mais em anúncio.</div>` : ''}
      ${k.espera ? `<div class="rp-box">${fraseEspera(k.espera)}</div>` : ''}
      <div class="rp-box acc"><b>Projeção com o ${esc(plain(raw('metodo.nome')) || 'método')}</b>: 6 meses <b>${brl(k.total(6))}</b> · 12 meses <b>${brl(k.total(12))}</b>
        <div class="rp-est">Estimativa. Base: +${k.extra} ${esc(termo('vendas'))}/mês × ${esc(termo('ticket'))} de ${brl(k.Tk)}${k.usaRef ? ' (valores de referência)' : ''}. ${esc(plain(raw('projecao.nota')))}</div></div>
      ${foot(1)}</div>`;
    const qs = cats().map((c, ci) => `<div class="rp-cat"><h4>${esc(plain(raw('categorias.' + ci + '.nome')))}</h4>${(c.perguntas || []).map((q, qi) => {
      const d = dorQ(c, q, qi), r = respostaTexto(c, q, qi);
      return `<div class="rp-q">${esc(plain(raw(qPath(c, qi) + '.texto')))}<div class="a ${!r ? 'na' : d === 1 ? 'd1' : d === 0.5 ? 'd05' : ''}">${esc(r || 'Sem resposta')}</div></div>`;
    }).join('')}</div>`).join('');
    const p2 = `<div class="rp">${head('Respostas do raio-x')}<div class="rp-qs">${qs}</div>${foot(2)}</div>`;
    let p3 = '';
    if(comPlano){
      const al = alertas().filter(a => a.acao);
      const prox = list('relatorio.proximos');
      p3 = `<div class="rp">${head('Plano de ação')}
        <div class="rp-read">Prioridades a partir das respostas, da mais urgente para a menos urgente.</div>
        <div>${al.length ? al.map(a => `<div class="rp-act"><div class="rp-pri ${a.dor >= 0.99 ? 'alta' : 'media'}">${a.dor >= 0.99 ? 'Alta' : 'Média'}</div><div>${esc(a.acao)}<div class="qq">${esc(a.cat)} · ${esc(a.q)} → ${esc(a.resp)}</div></div></div>`).join('') : '<div class="rp-box">Nenhum ponto crítico marcado no raio-x.</div>'}</div>
        ${prox.length ? `<div><div class="rp-h">Próximos passos</div><ol>${prox.map((p, i) => `<li>${esc(plain(raw('relatorio.proximos.' + i)))}</li>`).join('')}</ol></div>` : ''}
        ${foot(3)}</div>`;
    }
    rel.innerHTML = p1 + p2 + p3;
    return rel;
  }
  function carregar(src){
    return new Promise((ok, erro) => {
      const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { s.remove(); erro(new Error(src)); }; document.head.appendChild(s);
    });
  }
  // usa a cópia da pasta vendor/ (funciona offline); se não achar, busca na internet
  async function biblioteca(global, arquivo, cdn){
    if(window[global]) return;
    try{ await carregar('vendor/' + arquivo); }catch(e){}
    if(!window[global]) await carregar(cdn);
  }
  async function gerarPdf(comPlano, btn){
    const rotulo = btn.textContent;
    btn.disabled = true; btn.textContent = 'Gerando PDF…';
    const rel = montarRelatorio(comPlano);
    const nome = 'raio-x-' + slug(dx.ident.empresa || N.id) + (comPlano ? '-plano-de-acao' : '') + (dx.ident.data ? '-' + dx.ident.data : '') + '.pdf';
    try{
      await biblioteca('html2canvas', 'html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await biblioteca('jspdf', 'jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if(document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
      const telas = [];
      for(const p of $$('.rp', rel)) telas.push(await window.html2canvas(p, { scale:2, backgroundColor:'#ffffff', useCORS:true, logging:false }));
      const alt = c => 210 * c.height / c.width;
      const pdf = new window.jspdf.jsPDF({ unit:'mm', format:[210, alt(telas[0])] });
      telas.forEach((c, i) => { if(i) pdf.addPage([210, alt(c)]); pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, alt(c)); });
      await salvarArquivo(nome, pdf.output('blob'), 'application/pdf');
    }catch(err){
      // sem as bibliotecas (offline) ou imagem bloqueada: usa a impressão do navegador
      const tit = document.title; document.title = nome.replace(/\.pdf$/, '');
      setTimeout(() => { window.print(); setTimeout(() => { document.title = tit; }, 1000); }, 60);
    }finally{
      btn.disabled = false; btn.textContent = rotulo;
    }
  }

  // ============ início ============
  $('#miniLogo').src = MARCA.icone || MARCA.logo || '';
  window.RB = { calc, geral, resumoTexto, escolherNicho, get dx(){ return dx; }, get nicho(){ return N; }, ir, montarRelatorio };
  const hash = (location.hash || '').replace('#', '');
  const inicial = NICHOS.find(n => n.id === hash) || NICHOS.find(n => n.id === store.get('rb:nicho')) || (NICHOS.length === 1 ? NICHOS[0] : null);
  if(inicial) escolherNicho(inicial.id);
  else { N = NICHOS[0] || null; if(N){ dx = Object.assign(novoDx(), store.get(dxKey()) || {}); montar(); } abrirPicker(); }
})();
