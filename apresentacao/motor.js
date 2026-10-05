/* Motor da apresentação Raio-X Comercial.
   Lê window.MARCA (marca.js) e window.NICHOS (nichos/*.js) e monta os slides.
   A lógica (placar, custo de esperar, empilhamento, relatório) é a mesma para todo nicho;
   o que muda são os textos, as telas do raio-x e os parâmetros que cada arquivo de nicho define. */
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

  // ============ estado ============
  let N = null;                       // nicho ativo
  let dx = novoDx();                  // diagnóstico em andamento
  let slides = [];
  let idx = 0;
  let editing = false;
  const abertos = new Set();          // acordeões abertos no slide final

  function hojeISO(){ const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function novoDx(){ return { ident:{ empresa:'', whatsapp:'', data:hojeISO() }, resp:{}, nums:{}, origem:{} }; }
  const dxKey = () => 'rb:dx:' + (N ? N.id : 'x');
  let saveT = null;
  function gravarDx(){ clearTimeout(saveT); saveT = null; dx.ts = Date.now(); store.set(dxKey(), dx); }
  function salvarDx(){ clearTimeout(saveT); saveT = setTimeout(gravarDx, 250); }
  window.addEventListener('pagehide', () => { if(saveT) gravarDx(); });
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden' && saveT) gravarDx(); });

  // ============ edições (modo edição) ============
  const ED_KEY = 'rb:edicoes';
  const norm = e => ({ marca: Object.assign({}, e && e.marca), nichos: Object.assign({}, e && e.nichos) });
  let embutidas = {};
  try{ embutidas = JSON.parse(($('#edicoes-embutidas') || {}).textContent || '{}'); }catch(e){}
  embutidas = norm(embutidas);
  let localEd = norm(store.get(ED_KEY));
  const ED = { marca:{}, nicho:{} };
  function refreshED(){
    ED.marca = Object.assign({}, embutidas.marca, localEd.marca);
    ED.nicho = N ? Object.assign({}, embutidas.nichos[N.id], localEd.nichos[N.id]) : {};
  }
  function setEdit(sc, path, v){
    const original = getPath(sc === 'nicho' ? N : MARCA, path);
    const alvo = sc === 'nicho' ? (localEd.nichos[N.id] = localEd.nichos[N.id] || {}) : localEd.marca;
    const base = sc === 'nicho' ? (embutidas.nichos[N.id] || {}) : embutidas.marca;
    if(String(v) === String(original == null ? '' : original) && !Object.prototype.hasOwnProperty.call(base, path)) delete alvo[path];
    else alvo[path] = v;
    store.set(ED_KEY, localEd);
    refreshED();
  }

  // ============ leitura: edição → nicho → marca ============
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

  const TERMOS_PADRAO = { empresa:'empresa', empresas:'empresas', cliente:'cliente', clientes:'clientes', venda:'venda', vendas:'vendas',
    ticket:'ticket médio', receita:'receita', suaReceita:'sua receita', fimJornada:'a venda fechada' };
  function termo(k){
    if(k === 'marca' || k === 'Marca') return MARCA.curto || MARCA.nome || '';
    const t = Object.assign({}, TERMOS_PADRAO, MARCA.termos, N && N.termos);
    if(t[k] != null) return t[k];
    const low = k.charAt(0).toLowerCase() + k.slice(1);
    if(k !== low && t[low] != null) return t[low].charAt(0).toUpperCase() + t[low].slice(1);
    return null;
  }
  const LIVE = ['meses', 'fator12'];
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
  // texto puro (resumo, PDF): troca termos e tokens extras, tira marcações
  function plain(s, extra){
    if(s == null) return '';
    return String(s).replace(/\{(\w+)\}/g, (m, k) => {
      if(extra && extra[k] != null) return extra[k];
      const v = termo(k); if(v != null) return v;
      if(k === 'meses'){ const M = Math.round(num('meses')); return M > 0 ? (M === 1 ? '1 mês' : M + ' meses') : 'alguns meses'; }
      return m;
    }).replace(/~~([^~]*)~~/g, '$1').replace(/[*\[\]]/g, '').trim();
  }
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
  const brlS = v => (v < 0 ? '-' : '') + brl(Math.abs(v));
  const pct = v => nf1.format(v) + '%';
  function num(id){ const v = parseFloat(String(dx.nums[id] == null ? '' : dx.nums[id]).replace(',', '.')); return isFinite(v) ? v : 0; }

  // ============ raio-x ============
  const secoes = () => (N && Array.isArray(N.raiox)) ? N.raiox : [];
  const areas = () => (N && Array.isArray(N.areas) && N.areas.length) ? N.areas : [{ id:'comercial', nome:'Comercial' }];
  const optObj = o => (o && typeof o === 'object') ? o : { t:o };
  const qkey = (s, q, i) => s.id + '.' + (q.id || i);
  const qPath = (si, qi) => 'raiox.' + si + '.perguntas.' + qi;
  const optPath = (si, qi, oi) => { const o = (secoes()[si].perguntas || [])[qi].opcoes[oi]; return qPath(si, qi) + '.opcoes.' + oi + (o && typeof o === 'object' ? '.t' : ''); };
  function pontua(q){ return q.tipo === 'multipla' ? typeof q.bom === 'number' : (q.opcoes || []).some(o => typeof optObj(o).dor === 'number'); }
  const areaDe = (s, q) => q.area || s.area || 'comercial';
  // ---- perguntas condicionais ----
  // depende: { q:'id' ou ['id1','id2'], oculta:[opções], semOpcao:opção, resposta:opção, motivo:'texto' }, ou uma lista disso.
  // A pergunta some quando a de origem foi respondida com uma opção de "oculta" (com várias origens, só se todas
  // indicarem) ou, numa múltipla, quando "semOpcao" não foi marcada. "resposta" passa a valer sozinha e entra no
  // placar e no relatório (com o motivo); sem ela, a pergunta só sai da conta.
  function acharPergunta(id){
    let r = null;
    secoes().forEach((s, si) => (s.perguntas || []).forEach((q, qi) => { if(!r && q.id === id) r = { s, si, q, qi }; }));
    return r;
  }
  function estadoQ(s, q, qi, pilha){
    if(!q.depende) return { oculta:false };
    pilha = pilha || [];
    const eu = q.id || qkey(s, q, qi);
    if(pilha.includes(eu)) return { oculta:false };
    for(const c of (Array.isArray(q.depende) ? q.depende : [q.depende])){
      const sels = (Array.isArray(c.q) ? c.q : [c.q]).map(id => { const g = acharPergunta(id); return g ? respEfetiva(g.s, g.q, g.qi, pilha.concat(eu)).sel : null; });
      const some = c.semOpcao != null
        ? sels.every(sel => sel && sel.length && !sel.includes(c.semOpcao))
        : sels.every(sel => sel && sel.length && (c.oculta || []).includes(sel[0]));
      if(some) return { oculta:true, auto: c.resposta != null ? c.resposta : null, motivo: c.motivo || '' };
    }
    return { oculta:false };
  }
  function respEfetiva(s, q, qi, pilha){
    const st = estadoQ(s, q, qi, pilha);
    if(st.oculta) return { sel: st.auto != null ? [st.auto] : [], campos:{}, auto:true, oculta:true, motivo:st.motivo };
    const r = dx.resp[qkey(s, q, qi)];
    return { sel:(r && r.sel) || [], campos:(r && r.campos) || {} };
  }
  function dorQ(s, q, i){
    const sel = respEfetiva(s, q, i).sel;
    if(q.tipo === 'multipla'){
      if(typeof q.bom !== 'number' || !sel.length) return null;
      return sel.length >= q.bom ? 0 : (sel.length >= q.bom - 1 ? 0.5 : 1);
    }
    if(!sel.length) return null;
    const o = optObj((q.opcoes || [])[sel[0]]);
    return typeof o.dor === 'number' ? o.dor : null;
  }
  function cadaPergunta(fn){ secoes().forEach((s, si) => (s.perguntas || []).forEach((q, qi) => fn(s, si, q, qi))); }
  function areaStats(aid){
    let tot = 0, n = 0, alertas = 0, total = 0, respondidas = 0, perguntas = 0;
    cadaPergunta((s, si, q, qi) => {
      if(areaDe(s, q) !== aid) return;
      const ef = respEfetiva(s, q, qi);
      if(ef.oculta && !ef.sel.length) return;   // fora do raio-x por causa de outra resposta
      perguntas++;
      if(respostaTexto(si, qi)) respondidas++;
      if(!pontua(q)) return;
      total++;
      const d = dorQ(s, q, qi);
      if(d == null) return;
      tot += d; n++; if(d >= 0.99) alertas++;
    });
    return { dor: n ? tot / n : null, aprov: n ? Math.round((1 - tot / n) * 100) : null, n, total, alertas, respondidas, perguntas };
  }
  const areasQuePontuam = () => areas().filter(a => areaStats(a.id).total > 0);
  const tier = a => a == null ? 'nodata' : (a < 34 ? 'red' : a < 66 ? 'yellow' : 'green');
  const TIER = { red:'Crítico', yellow:'Atenção', green:'Sob controle', nodata:'Sem dados' };
  function geral(){
    const st = areasQuePontuam().map(a => ({ a, s:areaStats(a.id) })).filter(x => x.s.dor != null);
    if(!st.length) return { aprov:null, st:[] };
    const dor = st.reduce((s, x) => s + x.s.dor, 0) / st.length;
    return { aprov:Math.round((1 - dor) * 100), dor, st };
  }
  function respostaTexto(si, qi){
    const s = secoes()[si], q = s.perguntas[qi];
    const r = respEfetiva(s, q, qi), sel = r.sel;
    if(!sel.length) return '';
    const t = sel.map(oi => {
      const base = plain(raw(optPath(si, qi, oi))).replace(/,?\s*(qual|quais|quanto)\?$/i, '');
      const campo = r.campos[oi];
      return campo ? base + ' (' + campo + ')' : base;
    }).join(' · ');
    return r.auto && r.motivo ? t + ' (' + r.motivo + ')' : t;
  }
  const nomeArea = a => plain(raw('areas.' + areas().indexOf(a) + '.nome')) || a.nome;

  // ============ contas ============
  // O custo de esperar: M meses tentando, V custo operacional por mês, R0 receita no início, R1 hoje.
  // O ganho sobe em rampa: no mês m a receita está incremento × m acima do início, então o
  // acumulado é incremento × m(m+1)/2. Saldo = ganho acumulado − investido; payback = 1º mês com saldo ≥ 0.
  // nichos com "projecao.margem": o cliente informa preço e faturamento (o que ele sabe) e a conta usa a margem
  function margemPct(){
    const P = merged('projecao');
    if(!P.margem) return null;
    const m = num(P.margem.campo);
    return m > 0 ? m : P.margem.referencia;
  }
  function custoEsperar(){
    const fm = margemPct() != null ? margemPct() / 100 : 1;
    const M = Math.round(num('meses')), V = num('custo'), R0 = num('receitaIni') * fm, R1 = num('receitaHoje') * fm;
    if(M < 1 || (R0 <= 0 && R1 <= 0)) return null;
    const inc = (R1 - R0) / M, cresceu = R1 > R0, linhas = [];
    let payback = null;
    for(let m = 1; m <= M; m++){
      const ganho = inc * m * (m + 1) / 2, investido = V * m, saldo = ganho - investido;
      linhas.push({ mes:m, ganho, investido, saldo });
      if(cresceu && payback === null && saldo >= 0) payback = m;
    }
    const fim = linhas[M - 1], per = M === 1 ? '1 mês' : M + ' meses', b = t => '<b>' + t + '</b>';
    let html;
    if(!cresceu) html = 'Você gastou ' + b(brl(V * M)) + ' em ' + b(per) + ' e ' + esc(termo('suaReceita')) + ' ' + (R1 < R0 ? b('caiu') : b('não cresceu')) + '.';
    else if(fim.saldo > 0) html = 'Em ' + b(per) + ' e ' + b(brl(V * M)) + ' investidos, você teve ' + b(brl(fim.saldo)) + ' de ganho líquido acumulado de ' + esc(termo('receita')) + '.';
    else html = 'Em ' + b(per) + ' e ' + b(brl(V * M)) + ' investidos, você ainda não recuperou o que gastou. Seu saldo está ' + b(brl(Math.abs(fim.saldo)) + ' negativo') + '.';
    if(margemPct() != null){
      const P = merged('projecao'), om = origemDe(P.margem.campo);
      html += ' (' + esc(termo('receita')) + ' = faturamento × ' + pct(margemPct()) + ' de margem' + (!(num(P.margem.campo) > 0) || (om && om.tipo === 'media') ? ', média de mercado' : '') + ')';
    }
    return { M, V, R0, R1, inc, cresceu, payback, linhas: cresceu ? linhas : [], ganhoFinal:fim.ganho, investidoFinal:V * M, saldoFinal:fim.saldo, html, texto:html.replace(/<[^>]+>/g, '') };
  }
  // Empilhamento: clientes novos por mês × ticket. Recorrente (escola): cada mês soma os anteriores.
  // Venda única (veículo): o resultado acumula mês a mês.
  function proj(){
    const P = Object.assign({ recorrente:true, multiplicador:2, conta:'total', baseRotulo:'{n} {clientes} novos/mês', explicacao:'o dobro das {hoje} que você faz hoje' }, merged('projecao'));
    const ref = Object.assign({ base:10, ticket:278 }, P.referencia);
    const vendas = num('vendas'), ticket = num('ticket');
    const fator = P.conta === 'extra' ? P.multiplicador - 1 : P.multiplicador;
    const base = vendas > 0 ? Math.max(1, Math.round(vendas * fator)) : ref.base;
    const mg = margemPct(), preco = ticket > 0 ? ticket : ref.ticket;
    const Tk = mg != null ? preco * mg / 100 : preco;
    const mensal = base * Tk;
    const serie = n => Array.from({ length:n }, (_, i) => mensal * (i + 1));
    const total = n => P.recorrente ? mensal * n * (n + 1) / 2 : mensal * n;
    return {
      P, vendas, ticket, base, Tk, mensal, serie, total,
      ref: !(vendas > 0 && ticket > 0) || !!(P.margem && !(num(P.margem.campo) > 0)),
      margem: mg, preco,
      tkDet: mg != null ? ' (' + brl(preco) + ' × ' + pct(mg) + ' de margem)' : '',
      tkMedia: !!(ticket > 0 && origemDe('ticket') && origemDe('ticket').tipo === 'media'),
      rot: plain(P.baseRotulo, { n:nf1.format(base) }),
      expl: vendas > 0 ? plain(P.explicacao, { hoje:nf1.format(vendas) }) : ''
    };
  }
  function secaoDoCampo(id){ return secoes().findIndex(s => (s.campos || []).some(c => c.id === id)); }
  function paginaDoCampo(id){ const si = secaoDoCampo(id); return si < 0 ? '' : plain(raw('raiox.' + si + '.titulo')); }
  function campoDef(id){ for(const s of secoes()) for(const c of (s.campos || [])) if(c.id === id) return c; return null; }
  function valorCampo(f, v){ return f.pre === 'R$' ? brl(v) : f.unidade === '%' ? pct(v) : nf1.format(v) + (f.unidade ? ' ' + f.unidade : ''); }
  // de onde veio o número: digitado, média de mercado (com fonte) ou atalho ("Não sei", "Não investe")
  function origemDe(id){
    const o = dx.origem && dx.origem[id], f = campoDef(id);
    if(!o || !f) return null;
    if(o.tipo === 'media'){ const m = (f.medias || [])[o.i]; return m ? { tipo:'media', t:m.t, fonte:m.fonte } : null; }
    const a = (f.atalhos || [])[o.i]; return a ? { tipo:'atalho', t:a.t, vazio:a.v == null } : null;
  }
  function rotuloDoCampo(id){ const si = secaoDoCampo(id); if(si < 0) return id; const fi = secoes()[si].campos.findIndex(c => c.id === id); return plain(raw('raiox.' + si + '.campos.' + fi + '.rotulo')).replace(/\?$/, ''); }

  // ============ slides ============
  function stats(path, cls){
    return `<div class="stats ${cls == null ? 'reveal' : cls}">${list(path).map((s, i) => `<div class="stat">${T(path + '.' + i + '.valor', 'div', 'n count')}${T(path + '.' + i + '.rotulo', 'div', 'l')}</div>`).join('')}</div>`;
  }
  function foto(path, nomePath){
    const src = raw(path);
    if(src) return `<img class="photo" src="${esc(src)}" alt="">`;
    const nome = plain(raw(nomePath)) || '?';
    const ini = nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
    return `<div class="photo" aria-hidden="true">${esc(ini)}</div>`;
  }
  function shot(imgPath, capPath, vazio){
    const src = raw(imgPath);
    return `<div class="shot">${src ? `<img src="${esc(src)}" alt="">` : `<div class="vazio"><div>${vazio}<br>Coloque a imagem em <b>assets/</b> e informe o caminho em <b>${esc(imgPath)}</b>.</div></div>`}${capPath && raw(capPath) ? T(capPath, 'div', 'cap') : ''}</div>`;
  }
  function campo(si, fi){
    const f = secoes()[si].campos[fi], b = 'raiox.' + si + '.campos.' + fi;
    return `<div class="field">
      ${T(b + '.rotulo', 'label')}
      ${f.sub != null ? T(b + '.sub', 'div', 'fhint') : ''}
      <div class="inwrap">${f.pre ? `<span class="pre">${esc(f.pre)}</span>` : ''}<input id="n-${esc(f.id)}" data-num="${esc(f.id)}" type="number" inputmode="decimal" placeholder="0" autocomplete="off"></div>
      ${T(b + '.suf', 'div', 'suf')}
      ${quick(f)}
    </div>`;
  }
  // botões "média do mercado" (com a fonte no i) e atalhos como "Não sei"
  function quick(f){
    const med = f.medias || [], ata = f.atalhos || [];
    if(!med.length && !ata.length) return '';
    return `<div class="quick" data-quick="${esc(f.id)}">
        ${med.length ? '<span class="qk-l">Não sabe? Média do mercado:</span>' : ''}
        ${med.map((m, mi) => `<span class="qk" role="button" tabindex="0" data-qk="m${mi}">${esc(m.t)} · ${esc(valorCampo(f, m.v))}<i class="tip" tabindex="0" aria-label="Fonte" data-tip="${esc(m.fonte)}">i</i></span>`).join('')}
        ${ata.map((a, ai) => `<span class="qk" role="button" tabindex="0" data-qk="a${ai}">${esc(a.t)}</span>`).join('')}
      </div><div class="origem" id="og-${esc(f.id)}"></div>`;
  }

  const B = {
    capa: () => `
      <img class="logo-big reveal" src="${esc(MARCA.logo || '')}" alt="${esc(MARCA.nome || '')}">
      <div class="rule reveal"></div>
      ${T('capa.tagline', 'div', 'tagline reveal')}`,

    especialista: () => {
      const ret = raw('especialista.retrato');
      return `
      ${ret ? `<div class="esp-foto"><img src="${esc(ret)}" alt="${esc(plain(raw('especialista.nome')))}"></div>` : ''}
      ${T('especialista.kicker', 'div', 'kicker reveal')}
      ${T('especialista.nome', 'h1', 'h1 esp-nome reveal')}
      ${T('especialista.local', 'div', 'sub reveal')}
      <div class="row reveal">${ret ? '' : foto('especialista.foto', 'especialista.nome')}${stats('especialista.numeros', '')}</div>
      ${raw('especialista.frase') ? T('especialista.frase', 'div', 'quote reveal') : ''}`;
    },

    quemSomos: () => `
      ${T('quemSomos.kicker', 'div', 'kicker reveal')}
      ${T('quemSomos.titulo', 'h2', 'h2 reveal')}
      ${T('quemSomos.publicoTitulo', 'div', 'label reveal')}
      <div class="chips reveal">${list('publico').map((p, i) => T('publico.' + i, 'div', 'chip')).join('')}</div>
      ${stats('quemSomos.numeros')}`,

    antes: () => `
      ${T('antes.kicker', 'div', 'kicker reveal')}
      ${T('antes.titulo', 'h2', 'h2 reveal')}
      <div class="rx-line reveal"><div class="trk"></div><div class="fil"></div>
        <div class="nodes">${list('antes.etapas').map((e, i) => `<div class="rx-node"><i></i>${T('antes.etapas.' + i)}</div>`).join('')}</div></div>
      ${T('antes.sub', 'p', 'sub reveal')}
      <div class="ident reveal">
        <div class="field"><label for="id-empresa">${esc(termo('Empresa'))}</label><div class="inwrap"><input class="txt" id="id-empresa" data-id="empresa" type="text" placeholder="Nome" autocomplete="off"></div></div>
        <div class="field"><label for="id-whatsapp">WhatsApp do lead</label><div class="inwrap"><input class="txt" id="id-whatsapp" data-id="whatsapp" type="tel" inputmode="tel" placeholder="(00) 00000-0000" autocomplete="off"></div></div>
        <div class="field"><label for="id-data">Data</label><div class="inwrap"><input class="txt" id="id-data" data-id="data" type="date"></div></div>
      </div>
      <div class="btn-row reveal"><button class="btn ghost" type="button" data-act="novo">Novo diagnóstico</button></div>`,

    secao: (s, si) => {
      const b = 'raiox.' + si, cs = s.campos || [], ps = s.perguntas || [];
      return `
      ${T(b + '.kicker', 'div', 'kicker reveal')}
      ${T(b + '.titulo', 'h2', 'h2 reveal')}
      ${s.sub != null ? T(b + '.sub', 'p', 'sub reveal') : ''}
      ${cs.length ? `<div class="fields ${cs.length === 1 ? 'um' : cs.length >= 5 ? 'tres' : ''} reveal">${cs.map((c, fi) => campo(si, fi)).join('')}</div>` : ''}
      ${s.calculos ? `<div class="derived reveal" data-calc="${si}"></div>` : ''}
      ${ps.length ? `<div class="qgrid ${ps.length <= 2 ? 'uma' : ''} reveal">${ps.map((q, qi) => {
        const multi = q.tipo === 'multipla', qp = qPath(si, qi);
        return `<div class="q${q.depende ? ' q-cond' : ''}" data-q="${esc(qkey(s, q, qi))}" data-si="${si}" data-qi="${qi}" data-multi="${multi ? 1 : 0}">
          ${T(qp + '.texto', 'div', 'q-t')}
          ${q.sub != null ? T(qp + '.sub', 'div', 'q-s') : (multi ? '<div class="q-s">Pode marcar mais de um</div>' : '')}
          <div class="opts">${(q.opcoes || []).map((o, oi) => {
            const ob = optObj(o);
            return `<div class="opt" role="button" tabindex="0" data-oi="${oi}">${T(optPath(si, qi, oi))}${ob.campo ? ` <input class="opt-in" type="text" data-campo="${oi}" placeholder="${esc(ob.campo)}" aria-label="${esc(ob.campo)}">` : ''}</div>`;
          }).join('')}</div>
        </div>`;
      }).join('')}</div>` : ''}`;
    },

    painel: () => `
      ${T('painel.kicker', 'div', 'kicker reveal')}
      ${T('painel.titulo', 'h2', 'h2 reveal')}
      <div class="dash reveal">
        <div class="dash-col">
          <div class="card hero"><div class="phrase" id="dFrase"></div><div class="flag" id="dFlag" hidden></div></div>
          <div class="cmp" id="dCmp">
            <div class="card">${T('painel.mine', 'div', 'label')}<div class="val" id="dMine">--</div><div class="small" id="dMineS"></div></div>
            <div class="card nosso">${T('painel.nosso', 'div', 'label')}<div class="val" id="dNosso">--</div><div class="small" id="dNossoS"></div></div>
          </div>
        </div>
        <div class="dash-col">
          <div class="card ov">
            <div class="gauge" id="gGeral"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="fil" cx="60" cy="60" r="52" stroke-dasharray="326.73" stroke-dashoffset="326.73"/></svg>
              <div class="ctr"><div class="pct" id="gPct">--</div><div class="pl">de aproveitamento comercial</div></div></div>
            <div class="ov-side"><div class="tier" id="gTier">Sem dados</div><div class="small" id="gTxt"></div></div>
          </div>
          <div class="card areas" id="dAreas"></div>
        </div>
      </div>`,

    resolvemos: () => {
      const et = list('resolvemos.etapas');
      return `
      ${T('resolvemos.kicker', 'div', 'kicker reveal')}
      ${T('resolvemos.titulo', 'h2', 'h2 reveal')}
      <div class="flow reveal">${et.map((e, i) => `${i ? '<div class="farrow" aria-hidden="true">→</div>' : ''}<div class="fstep"><div class="circ">${i + 1}</div><div>${T('resolvemos.etapas.' + i + '.nome', 'div', 'fn')}${T('resolvemos.etapas.' + i + '.texto', 'div', 'ft')}</div></div>`).join('')}</div>
      ${T('resolvemos.fecho', 'p', 'sub reveal')}`;
    },

    perfis: () => `
      ${T('perfis.kicker', 'div', 'kicker reveal')}
      ${T('perfis.titulo', 'h2', 'h2 reveal')}
      <div class="prof reveal">${list('perfis.itens').map((p, i) => `<div class="prow">${T('perfis.itens.' + i + '.perfil', 'div', 'pp')}<div class="pa" aria-hidden="true">→</div>${T('perfis.itens.' + i + '.dor', 'div', 'pd')}</div>`).join('')}</div>`,

    marcas: () => {
      const ls = list('marcas.lista');
      return `
      ${T('marcas.kicker', 'div', 'kicker reveal')}
      ${T('marcas.titulo', 'h2', 'h2 reveal')}
      ${T('marcas.sub', 'p', 'sub reveal')}
      <div class="brands reveal" style="--n:${ls.length}">${ls.map((m, i) => {
        const b = 'marcas.lista.' + i, lg = raw(b + '.logo');
        return `<div class="brand">${m.case ? '<span class="bcase">case</span>' : ''}${lg ? `<img src="${esc(lg)}" alt="${esc(plain(raw(b + '.nome')))}">` : T(b + '.nome', 'div', 'bn')}${T(b + '.segmento', 'div', 'bs')}</div>`;
      }).join('')}</div>
      <div class="frentes reveal">${T('marcas.frentesTitulo', 'span', 'label')}${list('marcas.frentes').map((f, i) => T('marcas.frentes.' + i, 'span', 'chip')).join('')}</div>
      ${T('marcas.destaque', 'div', 'insight reveal')}`;
    },

    // um slide por case: gancho, antes, virada, resultado (números ou tabela), moral e de onde vem o número
    caso: ci => {
      const b = 'cases.lista.' + ci, c = list('cases.lista')[ci] || {}, tot = list('cases.lista').length;
      const logos = (c.logos || []).filter(Boolean);
      const marca = logos.length ? logos.map(l => `<img src="${esc(l)}" alt="">`).join('') : T(b + '.marca', 'span', 'cs-nome');
      const degraus = Array.from({ length:tot }, (_, j) => `<i class="${j <= ci ? 'on' : ''}" style="height:${(35 + 65 * (j + 1) / tot).toFixed(0)}%"></i>`).join('');
      const tb = c.tabela;
      const res = tb ? `<div class="cs-res">${T('cases.resultadoRotulo', 'div', 'label')}<table class="tbl cs-tbl"><thead><tr>${(tb.colunas || []).map((x, k) => T(b + '.tabela.colunas.' + k, 'th')).join('')}</tr></thead>
          <tbody>${(tb.linhas || []).map((l, li) => `<tr>${l.map((x, k) => T(b + '.tabela.linhas.' + li + '.' + k, 'td')).join('')}</tr>`).join('')}</tbody></table>${tb.rodape ? T(b + '.tabela.rodape', 'div', 'small') : ''}</div>`
        : `<div class="cs-res">${T('cases.resultadoRotulo', 'div', 'label')}<div class="cs-stats">${(c.numeros || []).map((x, k) => `<div class="stat">${T(b + '.numeros.' + k + '.valor', 'div', 'n count')}${T(b + '.numeros.' + k + '.rotulo', 'div', 'l')}</div>`).join('')}</div></div>`;
      return `
      <div class="cs-head reveal"><div class="cs-marca">${marca}</div><div class="cs-degraus" title="Do mais simples ao mais completo" aria-hidden="true">${degraus}</div></div>
      <div class="kicker reveal"><span>${T('cases.kicker')} ${ci + 1} de ${tot} · ${T(b + '.segmento')}</span></div>
      ${T(b + '.titulo', 'h2', 'h2 reveal')}
      ${T(b + '.gancho', 'div', 'quote reveal')}
      <div class="cs-grid${tb ? ' com-tabela' : ''} reveal">
        <div class="card">${T('cases.antesRotulo', 'div', 'label')}${T(b + '.antes', 'p', 'small')}</div>
        <div class="card">${T('cases.viradaRotulo', 'div', 'label')}${T(b + '.virada', 'p', 'small')}
          <div class="cs-frentes">${(c.frentes || []).map((x, k) => T(b + '.frentes.' + k, 'span', 'chip')).join('')}</div></div>
        ${res}
      </div>
      ${T(b + '.moral', 'div', 'insight reveal')}
      ${T(b + '.obs', 'div', 'cs-obs reveal')}`;
    },

    ponte: () => `
      ${T('ponte.kicker', 'div', 'kicker reveal')}
      ${T('ponte.titulo', 'h2', 'h2 reveal')}
      ${T('ponte.texto', 'p', 'sub reveal')}
      <div class="pt-grid reveal">
        <div class="card hero pt-conta">
          ${T('ponte.pergunta', 'div', 'h3')}
          <div class="pt-n" id="ptN">--</div>
          <div class="pt-l" id="ptL"></div>
          <div class="small" id="ptDet"></div>
        </div>
        <div class="pt-lado">${T('ponte.convite', 'div', 'insight')}${T('ponte.obs', 'div', 'cs-obs')}</div>
      </div>`,

    mkt: () => `
      ${T('mkt.kicker', 'div', 'kicker reveal')}
      ${T('mkt.titulo', 'h2', 'h2 reveal')}
      <div class="split reveal">
        <div><ul class="blist">${list('mkt.itens').map((x, i) => T('mkt.itens.' + i, 'li')).join('')}</ul>
          <div class="big-stat">${T('mkt.destaque.valor', 'div', 'n count')}${T('mkt.destaque.rotulo', 'div', 'l')}</div></div>
        ${shot('mkt.imagem', '', 'Espaço para o print do Instagram de um cliente.')}
      </div>`,

    ferramenta: () => `
      ${T('ferramenta.kicker', 'div', 'kicker reveal')}
      ${T('ferramenta.titulo', 'h2', 'h2 reveal')}
      <div class="split empilha reveal">
        <ul class="blist">${list('ferramenta.itens').map((x, i) => T('ferramenta.itens.' + i, 'li')).join('')}</ul>
        ${shot('ferramenta.imagem', '', 'Espaço para o print do pipeline no CRM.')}
      </div>`,

    time: () => {
      const ps = list('time.pessoas');
      return `
      ${T('time.kicker', 'div', 'kicker reveal')}
      ${T('time.titulo', 'h2', 'h2 reveal')}
      ${T('time.sub', 'p', 'sub reveal')}
      <div class="team${ps.length === 1 ? ' solo' : ''} reveal" style="--n:${ps.length}">${ps.map((p, i) => `<div class="person">${foto('time.pessoas.' + i + '.foto', 'time.pessoas.' + i + '.nome')}<div class="pinfo">${T('time.pessoas.' + i + '.nome', 'div', 'h3')}${T('time.pessoas.' + i + '.cargo', 'div', 'role')}${T('time.pessoas.' + i + '.texto', 'p')}</div></div>`).join('')}</div>`;
    },

    empilhamento: n => `
      ${T('empilhamento.kicker' + n, 'div', 'kicker reveal')}
      ${T('empilhamento.titulo' + n, 'h2', 'h2 reveal')}
      <div class="bars reveal" id="bars${n}">${Array.from({ length:n }, (_, i) => `<div class="bar-c"><div class="bar-t"><div class="bar-f"><span class="bar-v"></span></div></div><div class="bar-l">${n <= 6 ? 'Mês ' + (i + 1) : i + 1}</div></div>`).join('')}</div>
      <div class="stack-foot reveal">
        <div class="card total"><div class="tl">Somando os ${n} meses <span class="tag-est">Estimativa</span></div><div class="tv" id="tot${n}">--</div><div class="basis" id="base${n}"></div></div>
        <div class="card evol">
          ${T('empilhamento.evolucao', 'div', 'label')}
          <div class="seg-bar" id="seg${n}"></div><div class="seg-lbls" id="segL${n}"></div>
          ${T('empilhamento.partida', 'div', 'label')}
          <div class="lead-bar"><div class="base" id="lb${n}"></div><div class="cres" id="lc${n}"></div></div>
          <div class="lead-txt" id="you${n}"></div><div class="lead-txt" id="rec${n}"></div>
        </div>
      </div>`,

    valores: () => `
      ${T('valores.kicker', 'div', 'kicker reveal')}
      ${T('valores.titulo', 'h2', 'h2 reveal')}
      <div class="vstack reveal">${list('valores.itens').map((v, i) => `<div class="vrow">${T('valores.itens.' + i + '.nome', 'span', 'vn')}<span class="vv">${T('valores.itens.' + i + '.valor')}${v.fonte ? `<i class="tip" tabindex="0" aria-label="Fonte" data-tip="${esc(v.fonte)}">i</i>` : ''}</span></div>`).join('')}
        <div class="vrow tot"><span class="vn">${T('valores.totalRotulo')} <span class="tag-est">Estimativa</span></span>${T('valores.total', 'span', 'vv')}</div></div>
      ${T('valores.nota', 'div', 'note reveal')}`,

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
      ${T('planos.nota', 'div', 'note reveal')}
      ${T('planos.implantacao', 'div', 'note reveal')}`;
    },

    garantia: () => `
      ${T('garantia.kicker', 'div', 'kicker reveal')}
      ${T('garantia.titulo', 'h2', 'h2 reveal')}
      ${T('garantia.sub', 'p', 'sub reveal')}
      <div class="plans reveal" style="--n:2">
        <div class="plan"><div class="pn">6 meses</div><div class="pv" id="gar6" style="font-size:clamp(18px,2.2cqw,36px)">--</div>${T('garantia.meta6', 'div', 'pd')}</div>
        <div class="plan hi"><div class="badge">Estimativa</div><div class="pn">12 meses</div><div class="pv" id="gar12" style="font-size:clamp(18px,2.2cqw,36px)">--</div>${T('garantia.meta12', 'div', 'pd')}</div>
      </div>
      ${T('garantia.rodape', 'p', 'note reveal')}`,

    fechamento: () => `
      ${T('fechamento.kicker', 'div', 'kicker reveal')}
      ${T('fechamento.titulo', 'h1', 'h1 reveal')}
      ${T('fechamento.texto', 'p', 'sub reveal')}
      ${raw('fechamento.bonus') || editing ? `<div class="bonus reveal">${T('fechamento.bonusRotulo', 'div', 'label')}${T('fechamento.bonus', 'div', 'h3')}</div>` : ''}
      <img class="logo-small reveal" src="${esc(MARCA.logo || '')}" alt="${esc(MARCA.nome || '')}">`,

    salvar: () => `
      ${T('salvar.kicker', 'div', 'kicker reveal')}
      ${T('salvar.titulo', 'h2', 'h2 reveal')}
      <div class="save reveal">
        <div class="card" style="display:flex;flex-direction:column;gap:.5cqw">
          <div class="save-name" id="sNome"></div>
          <div class="small" id="sMeta"></div>
          <div class="btn-row" style="margin-top:.5cqw">
            <button class="btn" type="button" data-act="pdf-plano">Relatório + plano de ação</button>
            <button class="btn ghost" type="button" data-act="pdf">Relatório</button>
            <button class="btn ghost" type="button" data-act="copiar">Copiar resumo</button>
            <button class="btn ghost" type="button" data-act="novo">Novo diagnóstico</button>
          </div>
          <div class="placar" id="sPlacar"></div>
        </div>
        <div class="acc-list" id="sAcc"></div>
      </div>`
  };

  function defs(){
    const d = [
      { id:'capa', html:B.capa, cls:'centro' },
      { id:'especialista', html:B.especialista, cls: raw('especialista.retrato') ? 'esp' : '' },
      { id:'quem-somos', html:B.quemSomos },
      { id:'antes', html:B.antes }
    ];
    secoes().forEach((s, si) => d.push({ id:'rx-' + s.id, html:() => B.secao(s, si) }));
    d.push(
      { id:'painel', html:B.painel },
      { id:'resolvemos', html:B.resolvemos },
      { id:'perfis', html:B.perfis },
      { id:'marcas', html:B.marcas },
      ...list('cases.lista').map((c, ci) => ({ id:'case-' + (c.id || ci + 1), html:() => B.caso(ci), cls:'cs', nota:'cases.lista.' + ci + '.fala' })),
      { id:'ponte', html:B.ponte, nota:'ponte.fala' },
      { id:'mkt', html:B.mkt },
      { id:'ferramenta', html:B.ferramenta },
      { id:'time', html:B.time },
      { id:'empilhamento-6', html:() => B.empilhamento(6) },
      { id:'empilhamento-12', html:() => B.empilhamento(12) },
      { id:'valores', html:B.valores },
      { id:'planos', html:B.planos },
      { id:'garantia', html:B.garantia },
      { id:'fechamento', html:B.fechamento, cls:'centro' },
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
    const notas = d => d.nota && raw(d.nota) ? `<aside class="notas"><div class="label">Notas do apresentador · N esconde</div>${T(d.nota, 'div', 'nt')}</aside>` : '';
    slidesEl.innerHTML = ds.map(d => `<section class="slide ${d.cls || ''}${hid.includes(d.id) ? ' oculto' : ''}" data-id="${d.id}" aria-label="${esc(d.id)}">${d.html()}${notas(d)}</section>`).join('');
    slides = $$('.slide', slidesEl).map(el => ({ id:el.dataset.id, el }));
    slides.forEach(s => $$('.reveal', s.el).forEach((r, i) => r.style.setProperty('--i', i)));
    preencherCampos();
    if(editing) entrarEdicao();
    $('#dots').innerHTML = slides.map((s, i) => `<button class="dot" type="button" aria-label="Ir para o slide ${i + 1}" data-go="${i}"></button>`).join('');
    const novo = manterId ? slides.findIndex(s => s.id === manterId) : 0;
    idx = -1;
    ir(novo < 0 ? 0 : novo, true);
    $('#nichoNome').textContent = N ? N.nome : 'Escolher';
    computar();
  }
  function marcarQuick(){
    $$('[data-quick]', slidesEl).forEach(q => {
      const o = dx.origem && dx.origem[q.dataset.quick];
      $$('.qk', q).forEach(k => k.classList.toggle('sel', !!o && k.dataset.qk === (o.tipo === 'media' ? 'm' : 'a') + o.i));
    });
  }
  function preencherCampos(){
    marcarQuick();
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
    void el.offsetWidth;
    setTimeout(() => {
      $$('.bar-f', el).forEach((b, i) => { b.style.transition = ''; b.style.transitionDelay = (i * 70) + 'ms'; b.style.height = b.dataset.h || '0'; });
      $$('.gauge .fil', el).forEach(c => { c.style.transition = ''; c.style.strokeDashoffset = c.dataset.off || '326.73'; });
      $$('[data-to]', el).forEach(tween);
    }, 380);
  }
  function tween(el){
    const to = parseFloat(el.dataset.to), kind = el.dataset.fmt;
    if(!isFinite(to) || editing) return;
    const f = kind === 'pct' ? v => Math.round(v) + '%' : kind === 'brlS' ? brlS : brl;
    const t0 = performance.now(), dur = 950;
    (function frame(now){
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = f(to * e);
      if(k < 1) requestAnimationFrame(frame); else el.textContent = f(to);
    })(t0);
  }
  function setVal(id, v, kind){
    const el = document.getElementById(id);
    if(!el) return;
    el.dataset.to = v; el.dataset.fmt = kind || 'brl';
    el.textContent = kind === 'pct' ? Math.round(v) + '%' : kind === 'brlS' ? brlS(v) : brl(v);
  }

  // ============ cálculo na tela ============
  function setGauge(el, aprov, animar){
    const C = 326.73, off = aprov == null ? C : C * (1 - aprov / 100);
    el.classList.remove('red', 'yellow', 'green');
    if(aprov != null) el.classList.add(tier(aprov));
    const c = $('.fil', el);
    c.dataset.off = off.toFixed(2);
    if(animar !== false) c.style.strokeDashoffset = off.toFixed(2);
  }
  const gaugeHtml = (id, mini) => `<div class="gauge${mini ? ' mini' : ''}" id="${id}"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="fil" cx="60" cy="60" r="52" stroke-dasharray="326.73" stroke-dashoffset="326.73"/></svg><div class="ctr"><div class="pct">--</div></div></div>`;

  function computar(){
    if(!N) return;
    const set = (id, h) => { const el = document.getElementById(id); if(el) el.innerHTML = h; };
    const pr = proj(), ce = custoEsperar(), g = geral();
    const M = Math.round(num('meses'));
    const naTela = el => !!(el && slides[idx] && slides[idx].el.contains(el));

    // textos ao vivo
    $$('.live[data-live="meses"]').forEach(s => { s.textContent = M > 0 ? (M === 1 ? '1 mês' : M + ' meses') : '___ meses'; });
    const r12 = pr.total(12) / Math.max(1, pr.total(6));
    $$('.live[data-live="fator12"]').forEach(s => { s.textContent = r12 >= 3 ? 'mais que triplica' : r12 > 2.05 ? 'mais que dobra' : 'dobra'; });

    // ---- perguntas que dependem de outras ----
    $$('.q[data-si]', slidesEl).forEach(el => {
      const s = secoes()[+el.dataset.si], q = s && s.perguntas[+el.dataset.qi];
      if(q) el.classList.toggle('q-oculta', !editing && estadoQ(s, q, +el.dataset.qi).oculta);
    });

    // ---- origem dos números e taxas calculadas ----
    $$('.origem', slidesEl).forEach(el => {
      const o = origemDe(el.id.slice(3));
      el.innerHTML = !o ? '' : o.tipo === 'media' ? 'Usando a média de mercado: ' + esc(o.t) + ' (fonte no i)'
        : o.vazio ? 'Não sabe: fica fora das contas.' : '';
    });
    $$('[data-calc]', slidesEl).forEach(el => {
      const cfg = (secoes()[+el.dataset.calc] || {}).calculos || {};
      const L = num('leads'), V = num('vendas'), I = num('midia'), og = origemDe('leads'), out = [];
      if(L > 0 && V > 0) out.push(`Conversão de vocês: <b>${pct(V / L * 100)}</b> (${nf1.format(V)} de ${nf0.format(L)} contatos)`);
      else out.push('Conversão: ' + (og && og.vazio ? 'sem a contagem de contatos não dá pra calcular' : 'preencha contatos e ' + esc(termo('vendas'))));
      const mgc = margemPct();
      if(mgc != null && num('ticket') > 0) out.push(esc(termo('Ticket')) + ': <b>' + brl(num('ticket') * mgc / 100) + '</b>');
      if(cfg.conversao) out.push(`Média do mercado: <b>${pct(cfg.conversao.v)}</b><i class="tip" tabindex="0" aria-label="Fonte" data-tip="${esc(cfg.conversao.fonte)}">i</i>`);
      if(L > 0 && I > 0) out.push(`Custo por lead: <b>${brl(I / L)}</b>`);
      if(V > 0 && I > 0) out.push(`Custo por ${esc(termo('venda'))}: <b>${brl(I / V)}</b>`);
      el.innerHTML = '<span class="dl">Calculado na hora</span>' + out.map(x => `<span class="dchip">${x}</span>`).join('');
    });

    // ---- painel ----
    if($('#gGeral')){
      const ticket = num('ticket');
      const cmp = $('#dCmp'), flag = $('#dFlag');
      if(M <= 0 || ticket <= 0){
        const falta = [];
        if(M <= 0) falta.push(rotuloDoCampo('meses').toLowerCase() + ' (página "' + paginaDoCampo('meses') + '")');
        if(ticket <= 0) falta.push(rotuloDoCampo('ticket').toLowerCase() + ' (página "' + paginaDoCampo('ticket') + '")');
        set('dFrase', '<span class="empty">Falta preencher: ' + esc(falta.join(' e ')) + '. Sem isso não dá pra calcular o comparativo.</span>');
        cmp.style.display = 'none'; flag.hidden = true;
      } else {
        cmp.style.display = '';
        const C = num('custo');
        set('dFrase', ce ? ce.html : `Você já faz <b>${M} ${M === 1 ? 'mês' : 'meses'}</b> tentando ajustar isso. Gastou <b>${brl(C)}</b> por mês, <b>${brl(C * M)}</b> no total.`);
        const mine = ce ? ce.ganhoFinal : 0, nosso = pr.total(M);
        setVal('dMine', mine, 'brlS'); setVal('dNosso', nosso);
        set('dMineS', esc((!ce || ce.inc === 0) ? 'sem crescimento de ' + termo('receita') + ' no período' : brl(Math.abs(ce.inc)) + (ce.inc > 0 ? ' a mais' : ' a menos') + ' a cada mês, empilhado em ' + M + (M === 1 ? ' mês' : ' meses')));
        set('dNossoS', esc('Com ' + pr.rot + ' e ' + termo('ticket') + ' de ' + brl(pr.Tk) + pr.tkDet + (pr.tkMedia ? ' (média de mercado)' : '') + ', empilhado em ' + M + (M === 1 ? ' mês' : ' meses') + (pr.expl ? ' (' + pr.expl + ')' : '')));
        const ratio = nosso / Math.max(mine, 1);
        flag.hidden = false;
        flag.className = 'flag ' + (ratio > 3 ? 'red' : ratio > 1.5 ? 'yellow' : 'green');
        flag.textContent = ratio > 3 ? 'Muita oportunidade perdida' : ratio > 1.5 ? 'Dá pra crescer bem mais' : 'Você está no caminho certo';
      }
      const gg = $('#gGeral'), t = tier(g.aprov), tEl = $('#gTier'), anima = naTela(gg);
      setGauge(gg, g.aprov, anima);
      if(g.aprov == null){ const p = $('#gPct'); delete p.dataset.to; p.textContent = '--'; } else setVal('gPct', g.aprov, 'pct');
      tEl.className = 'tier ' + t;
      const emp = termo('empresa'), Emp = termo('Empresa');
      const piores = g.st.filter(x => x.s.dor > 0.34).sort((a, b) => b.s.dor - a.s.dor).slice(0, 2).map(x => nomeArea(x.a));
      let txt;
      if(g.aprov == null){ tEl.textContent = 'Sem dados'; txt = 'Preencha o raio-x pra ver o placar geral da ' + emp + ' aqui.'; }
      else if(t === 'red'){ tEl.textContent = Emp + ' no vermelho'; txt = 'A ' + emp + ' está aproveitando só ' + g.aprov + '% do potencial comercial hoje' + (piores.length ? '. O maior ponto de dor agora é ' + piores.join(' e ') + '.' : '.'); }
      else if(t === 'yellow'){ tEl.textContent = 'Dá pra melhorar muito'; txt = 'A ' + emp + ' está aproveitando ' + g.aprov + '% do potencial comercial' + (piores.length ? ', com atenção em ' + piores.join(' e ') + '.' : '.'); }
      else { tEl.textContent = 'No caminho certo'; txt = 'A ' + emp + ' já aproveita ' + g.aprov + '% do potencial comercial. Ainda dá pra destravar o resto.'; }
      set('gTxt', esc(txt));
      const ar = $('#dAreas'), aps = areasQuePontuam();
      ar.innerHTML = aps.map((a, i) => `<div class="area">${gaugeHtml('gA' + i, true)}<div class="an">${esc(nomeArea(a))}</div><div class="ac" id="gAc${i}"></div><div class="tier" id="gAt${i}"></div></div>`).join('');
      aps.forEach((a, i) => {
        const s = areaStats(a.id), el = document.getElementById('gA' + i);
        setGauge(el, s.aprov, true);
        if(!anima) $('.fil', el).style.strokeDashoffset = '326.73';
        $('.pct', el).textContent = s.aprov == null ? '--' : s.aprov + '%';
        set('gAc' + i, s.n ? s.alertas + ' de ' + s.total + ' em alerta' : 'sem dados');
        const te = document.getElementById('gAt' + i); te.className = 'tier ' + tier(s.aprov); te.textContent = TIER[tier(s.aprov)];
      });
    }

    // ---- empilhamento ----
    [6, 12].forEach(n => {
      const bars = document.getElementById('bars' + n);
      if(!bars) return;
      const s = pr.serie(n), mx = Math.max.apply(null, s.concat([1])), soma = s.reduce((a, b) => a + b, 0) || 1;
      const ativo = naTela(bars);
      $$('.bar-f', bars).forEach((b, i) => {
        const h = (s[i] / mx * 100).toFixed(1) + '%';
        b.dataset.h = h;
        if(ativo) b.style.height = h;
        $('.bar-v', b).textContent = nf0.format(Math.round(s[i]));
      });
      setVal('tot' + n, pr.total(n));
      set('base' + n, esc('Base: ' + pr.rot + ' × ' + termo('ticket') + ' de ' + brl(pr.Tk) + pr.tkDet + (pr.tkMedia ? ' (média de mercado)' : '')) + (pr.ref ? ' <span class="ph">[referência: preencha os números do raio-x]</span>' : '') +
        '<br>' + esc(pr.P.recorrente ? 'Cada mês soma os ' + termo('clientes') + ' novos dos meses anteriores.' : 'Cada barra mostra o acumulado até aquele mês.'));
      set('seg' + n, s.map((v, i) => `<div class="seg" title="Mês ${i + 1}: ${brl(v)}" style="width:${(v / soma * 100).toFixed(3)}%;background:rgba(59,142,243,${(0.22 + (i + 1) / n * 0.78).toFixed(2)})"></div>`).join(''));
      set('segL' + n, s.map((v, i) => `<span>${n <= 6 ? 'Mês ' + (i + 1) : i + 1}</span>`).join(''));
      const R0 = num('receitaIni'), R1 = num('receitaHoje'), tem = M > 0 && (R0 > 0 || R1 > 0), ref = Math.max(R1, R0, 1);
      const bw = tem ? Math.min(100, Math.max(R0, 0) / ref * 100) : 0, cw = tem ? Math.max(0, Math.min(100 - bw, Math.max(R1 - R0, 0) / ref * 100)) : 0;
      document.getElementById('lb' + n).style.width = bw.toFixed(2) + '%';
      document.getElementById('lc' + n).style.width = cw.toFixed(2) + '%';
      set('you' + n, ce ? 'Você, sozinho, ' + (ce.ganhoFinal >= 0 ? 'empilhou' : 'perdeu') + ' <b>' + brl(Math.abs(ce.ganhoFinal)) + '</b> em ' + ce.M + ' ' + (ce.M === 1 ? 'mês' : 'meses') + '. É daqui que a ' + esc(termo('marca')) + ' parte.'
        : 'Assim que você preencher seus números (página "' + esc(paginaDoCampo('meses')) + '"), mostramos aqui o seu ponto de partida.');
      const v = num('vendas'), tk = num('ticket');
      const mgx = margemPct();
      set('rec' + n, !(v > 0 && tk > 0) ? '' : mgx != null
        ? 'Hoje suas ' + esc(termo('vendas')) + ' geram <b>' + brl(v * tk) + '</b> de faturamento por mês, cerca de <b>' + brl(v * tk * mgx / 100) + '</b> de lucro.'
        : 'Hoje suas ' + esc(termo('vendas')) + ' geram <b>' + brl(v * tk) + '</b> por mês. São ' + nf1.format(v) + ' ' + esc(termo('vendas')) + ' a ' + brl(tk) + ' de ' + esc(termo('ticket')) + '.');
    });
    setVal('gar6', pr.total(6)); setVal('gar12', pr.total(12));

    // ---- ponte: quantas {vendas} a mais pagam a operação (preço do plano mais completo) ----
    if($('#ptN')){
      const precos = list('planos.itens').map(p => parseFloat(String(plain(p.preco || '')).replace(/[^\d,]/g, '').replace(',', '.'))).filter(v => v > 0);
      const preco = precos.length ? Math.max.apply(null, precos) : 0;
      if(preco > 0 && pr.Tk > 0){
        const n = Math.max(1, Math.ceil(preco / pr.Tk)), um = n === 1;
        set('ptN', nf0.format(n) + ' ' + esc(termo(um ? 'venda' : 'vendas')) + ' a mais' + (pr.P.recorrente ? '' : ' por mês'));
        set('ptL', (um ? 'já paga ' : 'já pagam ') + fmt(raw('ponte.pagaRotulo') || 'a operação inteira') + (pr.P.recorrente ? ', todo mês' : ''));
        set('ptDet', esc(termo('Ticket') + ' de ' + brl(pr.Tk) + pr.tkDet + (pr.tkMedia ? ' (média de mercado)' : '') + '.') +
          (pr.P.recorrente ? ' ' + esc('Cada ' + termo('cliente') + ' novo paga todo mês.') : '') +
          (pr.ref ? ' <span class="ph">[referência: preencha os números do raio-x]</span>' : ''));
      } else { set('ptN', '--'); set('ptL', ''); set('ptDet', ''); }
    }

    // ---- salvar ----
    if($('#sNome')){
      $('#sNome').textContent = dx.ident.empresa || (termo('Empresa') + ' sem nome');
      set('sMeta', esc([dataBR(dx.ident.data || hojeISO()), dx.ident.whatsapp].filter(Boolean).join(' · ')));
      const pcs = areasQuePontuam().map(a => { const s = areaStats(a.id); return { nome:nomeArea(a), v:s.aprov, sub:s.n ? s.alertas + ' de ' + s.total + ' em alerta' : 'sem dados' }; });
      pcs.push({ nome:'Geral', v:g.aprov, sub:g.aprov == null ? 'sem dados' : 'aproveitamento' });
      set('sPlacar', pcs.map(p => `<div class="pc ${tier(p.v)}"><div class="pn">${esc(p.nome)}</div><div class="pv">${p.v == null ? '--' : p.v + '%'}</div><div class="ps">${esc(p.sub)}</div></div>`).join(''));
      let h = areas().map(a => {
        const s = areaStats(a.id), itens = [];
        cadaPergunta((sc, si, q, qi) => {
          if(areaDe(sc, q) !== a.id) return;
          const r = respostaTexto(si, qi); if(!r) return;
          const d = dorQ(sc, q, qi);
          itens.push(`<div class="ans ${d === 1 ? 'd1' : d === 0.5 ? 'd05' : d === 0 ? 'd0' : ''}"><i></i><div><div class="aq">${esc(plain(raw(qPath(si, qi) + '.texto')))}</div><div class="ar2">${esc(r)}</div></div></div>`);
        });
        const k = 'a:' + a.id, ab = abertos.has(k) && itens.length;
        return `<div class="acc-item" data-aberto="${ab ? 1 : 0}"><button type="button" data-acc="${esc(k)}" ${itens.length ? '' : 'disabled'}><span class="an">${esc(nomeArea(a))}</span>
          <span class="ar"><b>${s.aprov == null ? (s.total ? '--' : 'informativo') : s.aprov + '%'}</b> · ${s.respondidas}/${s.perguntas} · ${itens.length ? (ab ? 'ocultar' : 'ver respostas') : 'nada marcado'}</span></button>
          <div class="acc-body">${itens.join('')}</div></div>`;
      }).join('');
      if(ce){
        const ab = abertos.has('custo');
        h += `<div class="acc-item" data-aberto="${ab ? 1 : 0}"><button type="button" data-acc="custo"><span class="an">O custo de esperar</span><span class="ar"><b>saldo ${brlS(ce.saldoFinal)}</b> · ${ab ? 'ocultar' : (ce.linhas.length ? 'ver tabela' : 'ver')}</span></button>
          <div class="acc-body"><div class="phrase">${ce.html}</div>${ce.linhas.length ? `<table class="tbl"><thead><tr><th>Mês</th><th>Ganho acumulado</th><th>Investido acumulado</th><th>Saldo</th></tr></thead><tbody>${ce.linhas.map(l => `<tr class="${l.mes === ce.payback ? 'pb' : ''}"><td>${l.mes}</td><td>${brlS(l.ganho)}</td><td>${brlS(l.investido)}</td><td class="${l.saldo < 0 ? 'neg' : ''}">${brlS(l.saldo)}</td></tr>`).join('')}</tbody></table>` : ''}</div></div>`;
      }
      set('sAcc', h);
    }
  }
  function dataBR(iso){ if(!iso) return ''; const p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }

  // ============ interação ============
  slidesEl.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if(act){ acao(act.dataset.act, act); return; }
    const acc = e.target.closest('[data-acc]');
    if(acc){ const k = acc.dataset.acc; abertos.has(k) ? abertos.delete(k) : abertos.add(k); computar(); return; }
    if(editing) return;
    const qk = e.target.closest('.qk');
    if(qk){
      if(e.target.closest('.tip')) return;
      const id = qk.closest('[data-quick]').dataset.quick, f = campoDef(id), k = qk.dataset.qk;
      const tipo = k[0] === 'm' ? 'media' : 'atalho', i = +k.slice(1);
      dx.origem = dx.origem || {};
      const cur = dx.origem[id];
      if(cur && cur.tipo === tipo && cur.i === i){ delete dx.origem[id]; dx.nums[id] = ''; }
      else { const v = tipo === 'media' ? f.medias[i].v : f.atalhos[i].v; dx.origem[id] = { tipo, i }; dx.nums[id] = v == null ? '' : String(v); }
      const inp = document.getElementById('n-' + id); if(inp) inp.value = dx.nums[id];
      marcarQuick(); salvarDx(); computar(); return;
    }
    if(e.target.closest('.opt-in')) return;
    const opt = e.target.closest('.opt');
    if(!opt) return;
    const q = opt.closest('.q'), key = q.dataset.q, oi = +opt.dataset.oi;
    const r = dx.resp[key] = dx.resp[key] || { sel:[], campos:{} };
    r.sel = q.dataset.multi === '1' ? (r.sel.includes(oi) ? r.sel.filter(x => x !== oi) : r.sel.concat(oi)) : (r.sel[0] === oi ? [] : [oi]);
    $$('.opt', q).forEach(o => o.classList.toggle('sel', r.sel.includes(+o.dataset.oi)));
    salvarDx(); computar();
  });
  slidesEl.addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.k !== undefined && editing){ const p = t.dataset.k.split(':'); setEdit(p[0], p.slice(1).join(':'), t.textContent); return; }
    if(t.dataset.num){ dx.nums[t.dataset.num] = t.value; if(dx.origem) delete dx.origem[t.dataset.num]; marcarQuick(); salvarDx(); computar(); return; }
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
    if(!editing && (e.target.classList.contains('opt') || e.target.classList.contains('qk')) && (e.key === ' ' || e.key === 'Enter')){ e.preventDefault(); e.stopPropagation(); e.target.click(); }
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
    if(['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)){ e.preventDefault(); next(); }
    else if(['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)){ e.preventDefault(); prev(); }
    else if(e.key === 'Home') ir(0);
    else if(e.key === 'End') ir(slides.length - 1);
    else if(e.key === 'f' || e.key === 'F') telaCheia();
    else if(e.key === 'e' || e.key === 'E') alternarEdicao();
    else if(e.key === 'n' || e.key === 'N'){
      const on = document.body.classList.toggle('com-notas');
      if(on && !slides[idx].el.querySelector('.notas')) toast('Notas ligadas. Este slide não tem notas.');
    }
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
  // o palco nunca rola: um foco (ex.: no "i" da fonte) não pode deslocar o slide
  ['#stage', '#slides'].forEach(sel => $(sel).addEventListener('scroll', e => { e.target.scrollTop = 0; e.target.scrollLeft = 0; }));
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

  // confirmação em dois cliques (o visualizador do claude.ai não mostra confirm())
  function confirmar(btn, rotulo, fn){
    if(btn.dataset.conf){ delete btn.dataset.conf; btn.textContent = btn.dataset.orig; fn(); return; }
    btn.dataset.orig = btn.textContent; btn.dataset.conf = 1; btn.textContent = rotulo;
    setTimeout(() => { if(btn.dataset.conf){ delete btn.dataset.conf; btn.textContent = btn.dataset.orig; } }, 3500);
  }
  function acao(a, btn){
    if(a === 'novo') return confirmar(btn, 'Clique de novo para apagar', () => { dx = novoDx(); store.del(dxKey()); abertos.clear(); montar(slides[idx] && slides[idx].id); toast('Diagnóstico zerado.'); });
    if(a === 'pdf') return gerarPdf(false, btn);
    if(a === 'pdf-plano') return gerarPdf(true, btn);
    if(a === 'copiar') return copiarResumo();
  }

  // ============ seletor de nicho ============
  function abrirPicker(){
    $('#pkGrid').innerHTML = NICHOS.map(n => {
      const nq = (n.raiox || []).reduce((s, c) => s + (c.perguntas || []).length, 0);
      return `<button class="pk-card${N && N.id === n.id ? ' cur' : ''}" type="button" data-nicho="${esc(n.id)}">
        <div class="pk-meta">${(n.raiox || []).length} telas de raio-x · ${nq} perguntas</div>
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
    if(saveT) gravarDx();
    N = n;
    store.set('rb:nicho', id);
    try{ history.replaceState(null, '', '#' + id); }catch(e){}
    dx = Object.assign(novoDx(), store.get(dxKey()) || {});
    abertos.clear();
    montar();
    if(dx.ident && dx.ident.empresa) toast('Diagnóstico de ' + dx.ident.empresa + ' retomado.');
  }

  // ============ modo edição ============
  function entrarEdicao(){
    $$('[data-k]', slidesEl).forEach(el => {
      const p = el.dataset.k.split(':');
      const v = raw(p.slice(1).join(':'));
      el.textContent = v == null ? '' : String(v);
      try{ el.contentEditable = 'plaintext-only'; }catch(e){}
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
    const id = slides[idx].id, h = ocultos().slice(), i = h.indexOf(id);
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
    salvarArquivo('apresentacao-' + slug(MARCA.curto || 'raio-x') + '.html', html, 'text/html');
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
      catch(err){ if(err && err.code === 'declined') return; toast('Não foi possível salvar o arquivo aqui (' + ((err && err.code) || 'erro') + '). Use o arquivo ribeker-apresentacao.html no Chrome.'); return; }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type:mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(window.self !== window.top ? 'Arquivo gerado. Se o download não começar, use o arquivo ribeker-apresentacao.html no Chrome.' : 'Arquivo baixado.');
  }
  function slug(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(); }

  // ============ resumo e relatório ============
  function camposInformados(){
    const out = [];
    secoes().forEach((s, si) => (s.campos || []).forEach((c, fi) => {
      const rot = plain(raw('raiox.' + si + '.campos.' + fi + '.rotulo')).replace(/\?$/, ''), o = origemDe(c.id);
      if(o && o.tipo === 'atalho' && o.vazio){ out.push([rot, 'Não sabe']); return; }
      const v = dx.nums[c.id];
      if(v == null || v === '') return;
      const n = parseFloat(String(v).replace(',', '.'));
      if(!isFinite(n)) return;
      out.push([rot, valorCampo(c, n) + (o && o.tipo === 'media' ? ' (média de mercado)' : '')]);
    }));
    const L = num('leads'), V = num('vendas'), I = num('midia');
    if(L > 0 && V > 0) out.push(['Conversão (calculada)', pct(V / L * 100)]);
    const mgi = margemPct();
    if(mgi != null && num('ticket') > 0) out.push([termo('Ticket') + ' (calculado)', brl(num('ticket') * mgi / 100)]);
    if(L > 0 && I > 0) out.push(['Custo por lead (calculado)', brl(I / L)]);
    if(V > 0 && I > 0) out.push(['Custo por ' + termo('venda') + ' (calculado)', brl(I / V)]);
    return out;
  }
  // referências de mercado que aparecem no diagnóstico, com a fonte
  function fontesUsadas(){
    const out = [];
    secoes().forEach(s => {
      (s.campos || []).forEach(c => { const o = origemDe(c.id); if(o && o.tipo === 'media') out.push(o.t + ': ' + o.fonte); });
      if(s.calculos && s.calculos.conversao) out.push('Conversão média do mercado (' + pct(s.calculos.conversao.v) + '): ' + s.calculos.conversao.fonte);
    });
    return out;
  }
  function acoesPorArea(){
    return areasQuePontuam().map(a => {
      const s = areaStats(a.id), itens = [];
      cadaPergunta((sc, si, q, qi) => {
        if(areaDe(sc, q) !== a.id) return;
        const d = dorQ(sc, q, qi), acao = plain(raw(qPath(si, qi) + '.acao'));
        if(d == null || d === 0 || !acao) return;
        itens.push({ acao, pergunta:plain(raw(qPath(si, qi) + '.texto')), dor:d });
      });
      itens.sort((x, y) => y.dor - x.dor);
      return { nome:nomeArea(a), pct:s.aprov, itens };
    }).filter(a => a.itens.length).sort((x, y) => (x.pct == null ? 999 : x.pct) - (y.pct == null ? 999 : y.pct));
  }
  function resumoTexto(){
    const g = geral(), ce = custoEsperar(), pr = proj(), L = [];
    L.push('Raio-X Comercial · ' + (dx.ident.empresa || termo('Empresa')) + ' · ' + dataBR(dx.ident.data || hojeISO()));
    L.push(N.nome);
    L.push('');
    if(g.aprov != null){
      L.push('Aproveitamento geral: ' + g.aprov + '% (' + TIER[tier(g.aprov)] + ')');
      areasQuePontuam().forEach(a => { const s = areaStats(a.id); if(s.aprov != null) L.push('- ' + nomeArea(a) + ': ' + s.aprov + '% · ' + s.alertas + ' de ' + s.total + ' em alerta'); });
      L.push('');
    }
    const cs = camposInformados();
    if(cs.length){ cs.forEach(c => L.push(c[0] + ': ' + c[1])); L.push(''); }
    if(ce) L.push(ce.texto);
    L.push('Empilhamento estimado: 6 meses ' + brl(pr.total(6)) + ' · 12 meses ' + brl(pr.total(12)));
    const ac = acoesPorArea();
    if(ac.length){ L.push(''); L.push('Por onde começar:'); ac.flatMap(a => a.itens).slice(0, 5).forEach(i => L.push('- ' + i.acao)); }
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

  // Monta o documento A4. Paginação por medição: cada bloco entra, a folha é medida e,
  // se passou da altura, o bloco abre folha nova. Nenhum bloco é cortado no meio.
  function montarRelatorio(comPlano){
    const g = geral(), ce = custoEsperar(), rel = $('#rel');
    const emp = dx.ident.empresa || (termo('Empresa') + ' sem nome');
    const dataTxt = dataBR(dx.ident.data || hojeISO());
    const logo = MARCA.logoRelatorio || MARCA.logo || '';
    const LIM = 1123 - 46 - 50; // altura útil: folha menos padding inferior e rodapé
    rel.innerHTML = '';
    const folhas = [];
    let f;
    const nova = titulo => {
      f = document.createElement('div');
      f.className = 'rp'; f.style.minHeight = '0';
      f.innerHTML = `<div class="rp-head"><div><div class="rp-kick">${esc(titulo)}</div><div class="rp-name">${esc(emp)}</div><div class="rp-meta">Diagnóstico realizado em ${esc(dataTxt)}${dx.ident.whatsapp ? ' · ' + esc(dx.ident.whatsapp) : ''}</div></div>${logo ? `<img src="${esc(logo)}" alt="">` : ''}</div>`;
      rel.appendChild(f); folhas.push(f);
    };
    const criar = html => { const tmp = document.createElement('div'); tmp.innerHTML = html.trim(); return tmp.firstElementChild; };
    const add = (html, titulo) => {
      const el = criar(html);
      f.appendChild(el);
      if(f.offsetHeight > LIM && f.children.length > 2){ el.remove(); nova(titulo); f.appendChild(el); }
    };
    // bloco com linhas: quebra entre folhas linha a linha, repetindo o cabeçalho com "continuação"
    const addBloco = (cab, linhas, titulo) => {
      let bloco = criar(`<div class="rp-bloco">${cab(false)}</div>`);
      f.appendChild(bloco);
      if(f.offsetHeight > LIM && f.children.length > 2){ bloco.remove(); nova(titulo); f.appendChild(bloco); }
      linhas.forEach(h => {
        const el = criar(h);
        bloco.appendChild(el);
        if(f.offsetHeight > LIM && bloco.children.length > 2){
          el.remove(); nova(titulo);
          bloco = criar(`<div class="rp-bloco">${cab(true)}</div>`);
          f.appendChild(bloco); bloco.appendChild(el);
        }
      });
    };

    // página 1: panorama
    const t1 = 'Raio-X Comercial · ' + N.nome;
    nova(t1);
    const piores = g.st.filter(x => x.s.aprov < 50).sort((a, b) => a.s.aprov - b.s.aprov).slice(0, 2).map(x => nomeArea(x.a));
    add(`<div class="rp-geral"><div class="rp-pct ${tier(g.aprov)}">${g.aprov == null ? '--' : g.aprov + '%'}</div><div><div class="rp-lab">Aproveitamento geral</div><div class="rp-read">${esc(leitura(g.aprov, piores))}</div></div></div>`, t1);
    add(`<div class="rp-h">Resultado por área</div>`, t1);
    areasQuePontuam().forEach(a => {
      const s = areaStats(a.id);
      add(`<div class="rp-area"><div class="top"><span>${esc(nomeArea(a))}</span><span>${s.aprov == null ? '--' : s.aprov + '%'}</span></div><div class="b"><i class="${tier(s.aprov)}" style="width:${s.aprov || 0}%"></i></div>
        <div class="sb">${s.alertas} de ${s.total} pontos de atenção · ${s.respondidas} respondidas</div></div>`, t1);
    });
    const cs = camposInformados();
    if(cs.length){
      add(`<div class="rp-h">Números informados pela ${esc(termo('empresa'))}</div>`, t1);
      add(`<div class="rp-grid">${cs.map(c => `<div class="rp-kpi"><div class="k">${esc(c[0])}</div><div class="v">${esc(c[1])}</div></div>`).join('')}</div>`, t1);
    }
    add(`<div class="rp-box">${fmtRel(raw('relatorio.legenda'))}</div>`, t1);
    const fu = fontesUsadas();
    if(fu.length) add(`<div class="rp-box"><b>Referências de mercado usadas.</b> ${fu.map(esc).join(' · ')}</div>`, t1);

    // o custo de esperar
    if(ce){
      const tc = 'O custo de esperar';
      nova(tc);
      add(`<div class="rp-frase">${ce.html}</div>`, tc);
      if(ce.linhas.length){
        let tb = null;
        const novaTabela = () => { const t = document.createElement('table'); t.className = 'rp-tbl'; t.innerHTML = '<thead><tr><th>Mês</th><th>Ganho acumulado</th><th>Investido acumulado</th><th>Saldo</th></tr></thead><tbody></tbody>'; f.appendChild(t); tb = t.tBodies[0]; };
        novaTabela();
        ce.linhas.forEach(l => {
          const tr = document.createElement('tr');
          if(l.mes === ce.payback) tr.className = 'pb';
          tr.innerHTML = `<td>${l.mes}</td><td>${brlS(l.ganho)}</td><td>${brlS(l.investido)}</td><td class="${l.saldo < 0 ? 'neg' : ''}">${brlS(l.saldo)}</td>`;
          tb.appendChild(tr);
          if(f.offsetHeight > LIM && tb.children.length > 1){ tr.remove(); nova(tc); novaTabela(); tb.appendChild(tr); }
        });
      }
    }

    // plano de ação
    if(comPlano){
      const porArea = acoesPorArea(), tp = 'Plano de ação';
      if(porArea.length){
        nova(tp);
        add(`<div class="rp-read">${fmtRel(raw('relatorio.planoIntro'))}</div>`, tp);
        const top = porArea.flatMap(a => a.itens.map(i => ({ area:a.nome, acao:i.acao }))).slice(0, 3);
        add(`<div class="rp-prio"><div class="t">Por onde começar</div>${top.map((t, i) => `<div class="it"><div class="n">${i + 1}</div><div>${esc(t.acao)}<div class="ar">${esc(t.area)}</div></div></div>`).join('')}</div>`, tp);
        porArea.forEach(a => addBloco(cont => `<div class="bh"><span class="bn">${esc(a.nome)}${cont ? ' (continuação)' : ''}</span><span class="bp ${tier(a.pct)}">${a.pct == null ? '--' : a.pct + '%'}</span></div>`,
          a.itens.map(i => `<div class="rp-act"><div class="m">›</div><div>${esc(i.acao)}<div class="sb">a partir de: ${esc(i.pergunta)}</div></div></div>`), tp));
        add(`<div class="rp-box">${fmtRel(raw('relatorio.planoFecho'))}</div>`, tp);
      }
    }

    // respostas
    const tr = 'Respostas do diagnóstico';
    nova(tr);
    areas().forEach(a => {
      const s = areaStats(a.id), itens = [];
      cadaPergunta((sc, si, q, qi) => {
        if(areaDe(sc, q) !== a.id) return;
        const r = respostaTexto(si, qi); if(!r) return;
        const d = dorQ(sc, q, qi), dot = d === 1 ? 'r' : d === 0.5 ? 'a' : d === 0 ? 'v' : '';
        itens.push(`<div class="rp-item"><div class="rp-q">${dot ? `<span class="rp-dot ${dot}"></span>` : ''}${esc(plain(raw(qPath(si, qi) + '.texto')))}</div><div class="rp-r">${esc(r)}</div></div>`);
      });
      if(!itens.length) return;
      addBloco(cont => `<div class="bh"><span class="bn">${esc(nomeArea(a))}${cont ? ' (continuação)' : ''}</span><span class="bp ${tier(s.aprov)}">${s.aprov == null ? '' : s.aprov + '%'}</span></div>`, itens, tr);
    });
    add(`<div class="rp-box">${esc(plain(raw('relatorio.rodape'), { data:dataTxt }))}</div>`, tr);

    folhas.forEach((p, i) => {
      p.style.minHeight = '';
      const ft = document.createElement('div'); ft.className = 'rp-foot';
      ft.innerHTML = `<span>${esc(MARCA.nome || '')}</span><span>Página ${i + 1} de ${folhas.length}</span>`;
      p.appendChild(ft);
    });
    return rel;
  }
  // negrito com *asteriscos* e bolinhas (ponto vermelho/amarelo/verde) nos textos do relatório
  function fmtRel(s){
    return esc(plain(String(s || '').replace(/\*([^*]+)\*/g, '§$1§'))).replace(/§([^§]+)§/g, '<b>$1</b>')
      .replace(/\(ponto vermelho\)/g, '<span class="rp-dot r"></span>').replace(/\(ponto amarelo\)/g, '<span class="rp-dot a"></span>').replace(/\(ponto verde\)/g, '<span class="rp-dot v"></span>');
  }
  function leitura(aprov, piores){
    if(aprov == null) return 'Diagnóstico ainda sem respostas suficientes para leitura.';
    const emp = termo('empresa');
    let t;
    if(aprov < 34) t = 'A ' + emp + ' opera hoje com ' + aprov + '% do potencial comercial que já tem instalado. A maior parte do resultado depende de esforço individual, não de processo.';
    else if(aprov < 66) t = 'A ' + emp + ' opera hoje com ' + aprov + '% do potencial comercial que já tem instalado. Parte do processo existe, mas convive com etapas que dependem de memória e improviso.';
    else t = 'A ' + emp + ' opera hoje com ' + aprov + '% do potencial comercial que já tem instalado, com processo presente na maior parte das áreas.';
    if(piores.length) t += ' As áreas com mais pontos de atenção são ' + piores.join(' e ') + '.';
    return t;
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
  // ---- relatório em PDF desenhado direto: texto de verdade, sem print da tela ----
  // (funciona no link do claude.ai, no arquivo local e sem internet)
  const txtPdf = s => String(s == null ? '' : s).replace(/→/g, '->').replace(/≥/g, '>=').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x00-\xFF\u2013\u2014\u2022\u2026\u203A]/g, '');
  async function imagemDataURL(src){
    if(!src) return null;
    if(/^data:/.test(src)) return src;
    try{
      const b = await (await fetch(src)).blob();
      return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(null); fr.readAsDataURL(b); });
    }catch(e){ return null; }
  }
  async function montarPdf(comPlano){
    const pdf = new window.jspdf.jsPDF({ unit:'mm', format:'a4' });
    const W = 210, H = 297, M = 16, CW = W - 2 * M, LIM = H - 18;
    const C = { ink:[12,26,51], mut:[90,107,136], line:[221,228,240], soft:[243,246,251], acc:[31,95,191], ok:[19,168,116], warn:[201,133,16], bad:[214,69,69], white:[255,255,255], accsoft:[238,244,253], oksoft:[223,245,236] };
    const cor = (k, t) => { const c = C[k]; if(t === 'f') pdf.setFillColor(c[0], c[1], c[2]); else if(t === 'd') pdf.setDrawColor(c[0], c[1], c[2]); else pdf.setTextColor(c[0], c[1], c[2]); };
    const tierC = v => v == null ? 'mut' : v < 34 ? 'bad' : v < 66 ? 'warn' : 'ok';
    const fonte = (tam, estilo) => { pdf.setFont('helvetica', estilo || 'normal'); pdf.setFontSize(tam); };
    const linhas = (t, w, tam, estilo) => { fonte(tam, estilo); return pdf.splitTextToSize(txtPdf(t), w); };
    const alt = (n, tam) => n * tam * 0.3528 * 1.35;
    const g = geral(), ce = custoEsperar();
    const emp = dx.ident.empresa || (termo('Empresa') + ' sem nome');
    const dataTxt = dataBR(dx.ident.data || hojeISO());
    const logo = await imagemDataURL(MARCA.logoRelatorio || '');
    let y = M;
    const cab = titulo => {
      y = M;
      fonte(8, 'bold'); cor('acc'); pdf.text(txtPdf(titulo.toUpperCase()), M, y + 3, { charSpace:0.3 });
      fonte(18, 'bold'); cor('ink'); pdf.text(txtPdf(emp), M, y + 11);
      fonte(9); cor('mut'); pdf.text(txtPdf('Diagnóstico realizado em ' + dataTxt + (dx.ident.whatsapp ? ' · ' + dx.ident.whatsapp : '')), M, y + 17);
      if(logo){ try{ const pr = pdf.getImageProperties(logo), h = 11, w = h * pr.width / pr.height; pdf.addImage(logo, 'PNG', W - M - w, y + 1, w, h); }catch(e){} }
      cor('ink', 'd'); pdf.setLineWidth(0.6); pdf.line(M, y + 21, W - M, y + 21);
      y += 28;
    };
    const nova = titulo => { pdf.addPage(); cab(titulo); };
    const cabe = (h, tt) => { if(y + h > LIM) nova(tt); };
    const titulo = (t, tt) => { cabe(12, tt); fonte(12, 'bold'); cor('ink'); pdf.text(txtPdf(t), M, y + 4); y += 8; };
    const caixa = (texto, tt, o) => {
      o = o || {};
      const tam = o.tam || 9.5, ls = linhas(texto, CW - 10, tam), h = alt(ls.length, tam) + 7;
      cabe(h, tt);
      cor(o.fundo || 'soft', 'f'); cor(o.borda || 'line', 'd'); pdf.setLineWidth(0.3); pdf.roundedRect(M, y, CW, h, 2, 2, 'FD');
      fonte(tam); cor(o.cor || 'ink'); pdf.text(ls, M + 5, y + 5.5, { lineHeightFactor:1.35 });
      y += h + 4;
    };
    const blocoTitulo = (nome, p, tt, cont) => {
      cabe(14, tt);
      fonte(9.5, 'bold'); cor('acc'); pdf.text(txtPdf((nome + (cont ? ' (continuação)' : '')).toUpperCase()), M, y + 4, { charSpace:0.3 });
      if(p != null){ fonte(11, 'bold'); cor(tierC(p)); pdf.text(p + '%', W - M, y + 4, { align:'right' }); }
      cor('line', 'd'); pdf.setLineWidth(0.3); pdf.line(M, y + 6.5, W - M, y + 6.5);
      y += 9.5;
    };

    // página 1: panorama
    const t1 = 'Raio-X Comercial · ' + N.nome;
    cab(t1);
    const leit = leitura(g.aprov, g.st.filter(x => x.s.aprov < 50).sort((a, b) => a.s.aprov - b.s.aprov).slice(0, 2).map(x => nomeArea(x.a)));
    const lg = linhas(leit, CW - 52, 10), hG = Math.max(28, alt(lg.length, 10) + 14);
    cor('soft', 'f'); pdf.roundedRect(M, y, CW, hG, 3, 3, 'F');
    fonte(30, 'bold'); cor(tierC(g.aprov)); pdf.text(g.aprov == null ? '--' : g.aprov + '%', M + 6, y + hG / 2 + 4);
    fonte(7.5, 'bold'); cor('mut'); pdf.text('APROVEITAMENTO GERAL', M + 46, y + 8, { charSpace:0.3 });
    fonte(10); cor('ink'); pdf.text(lg, M + 46, y + 14, { lineHeightFactor:1.35 });
    y += hG + 7;
    titulo('Resultado por área', t1);
    areasQuePontuam().forEach(a => {
      const st = areaStats(a.id);
      cabe(18, t1);
      fonte(10.5, 'bold'); cor('ink'); pdf.text(txtPdf(nomeArea(a)), M, y + 4); pdf.text(st.aprov == null ? '--' : st.aprov + '%', W - M, y + 4, { align:'right' });
      cor('line', 'f'); pdf.roundedRect(M, y + 6.5, CW, 2.6, 1.3, 1.3, 'F');
      if(st.aprov){ cor(tierC(st.aprov), 'f'); pdf.roundedRect(M, y + 6.5, CW * st.aprov / 100, 2.6, 1.3, 1.3, 'F'); }
      fonte(8); cor('mut'); pdf.text(txtPdf(st.alertas + ' de ' + st.total + ' pontos de atenção · ' + st.respondidas + ' respondidas'), M, y + 13.5);
      y += 18;
    });
    const cs = camposInformados();
    if(cs.length){
      titulo('Números informados pela ' + termo('empresa'), t1);
      const cols = 3, gap = 4, cw = (CW - gap * (cols - 1)) / cols;
      for(let i = 0; i < cs.length; i += cols){
        const lin = cs.slice(i, i + cols);
        const h = Math.max.apply(null, lin.map(c => alt(linhas(c[0], cw - 6, 8).length, 8) + alt(linhas(c[1], cw - 6, 11, 'bold').length, 11) + 7));
        cabe(h, t1);
        lin.forEach((c, j) => {
          const x = M + j * (cw + gap), l1 = linhas(c[0], cw - 6, 8);
          cor('line', 'd'); pdf.setLineWidth(0.3); pdf.roundedRect(x, y, cw, h, 2, 2, 'D');
          fonte(8); cor('mut'); pdf.text(l1, x + 3, y + 5, { lineHeightFactor:1.3 });
          const l2 = linhas(c[1], cw - 6, 11, 'bold'); cor('ink'); pdf.text(l2, x + 3, y + 5 + alt(l1.length, 8) + 2.5, { lineHeightFactor:1.25 });
        });
        y += h + gap;
      }
      y += 2;
    }
    caixa(plain(String(raw('relatorio.legenda') || '').replace(/\(ponto (vermelho|amarelo|verde)\)\s*/g, '$1 = ')), t1, { tam:9 });
    const fu = fontesUsadas();
    if(fu.length) caixa('Referências de mercado usadas: ' + fu.join(' · '), t1, { tam:8, cor:'mut' });

    // o custo de esperar
    if(ce){
      const tc = 'O custo de esperar';
      nova(tc);
      const lf = linhas(ce.texto, CW, 11);
      fonte(11); cor('ink'); pdf.text(lf, M, y + 4, { lineHeightFactor:1.4 });
      y += alt(lf.length, 11) + 6;
      if(ce.linhas.length){
        const X = [M + 70, M + 125, W - M - 2];
        const head = () => {
          fonte(8.5, 'bold'); cor('mut');
          pdf.text('Mês', M + 2, y + 4.5); pdf.text('Ganho acumulado', X[0], y + 4.5, { align:'right' }); pdf.text('Investido acumulado', X[1], y + 4.5, { align:'right' }); pdf.text('Saldo', X[2], y + 4.5, { align:'right' });
          cor('ink', 'd'); pdf.setLineWidth(0.5); pdf.line(M, y + 6.5, W - M, y + 6.5);
          y += 8;
        };
        head();
        ce.linhas.forEach(l => {
          if(y + 6.5 > LIM){ nova(tc); head(); }
          const pb = l.mes === ce.payback;
          if(pb){ cor('oksoft', 'f'); pdf.rect(M, y - 0.5, CW, 6.5, 'F'); }
          fonte(9, pb ? 'bold' : 'normal'); cor(pb ? 'ok' : 'ink');
          pdf.text(String(l.mes), M + 2, y + 4); pdf.text(txtPdf(brlS(l.ganho)), X[0], y + 4, { align:'right' }); pdf.text(txtPdf(brlS(l.investido)), X[1], y + 4, { align:'right' });
          if(l.saldo < 0 && !pb) cor('bad');
          pdf.text(txtPdf(brlS(l.saldo)), X[2], y + 4, { align:'right' });
          cor('line', 'd'); pdf.setLineWidth(0.2); pdf.line(M, y + 6, W - M, y + 6);
          y += 6.5;
        });
      }
    }

    // plano de ação
    if(comPlano){
      const porArea = acoesPorArea(), tp = 'Plano de ação';
      if(porArea.length){
        nova(tp);
        const li = linhas(plain(raw('relatorio.planoIntro')), CW, 10);
        fonte(10); cor('ink'); pdf.text(li, M, y + 4, { lineHeightFactor:1.4 });
        y += alt(li.length, 10) + 5;
        const top = porArea.flatMap(a => a.itens.map(i => ({ area:a.nome, acao:i.acao }))).slice(0, 3);
        const hs = top.map(t => alt(linhas(t.acao, CW - 22, 10).length, 10) + 7);
        const hP = 13 + hs.reduce((a, b) => a + b, 0);
        cabe(hP, tp);
        cor('accsoft', 'f'); cor('acc', 'd'); pdf.setLineWidth(0.4); pdf.roundedRect(M, y, CW, hP, 2.5, 2.5, 'FD');
        fonte(11, 'bold'); cor('acc'); pdf.text('Por onde começar', M + 5, y + 7.5);
        let yy = y + 13;
        top.forEach((t, i) => {
          cor('acc', 'f'); pdf.circle(M + 8, yy + 1.2, 2.6, 'F');
          fonte(8, 'bold'); cor('white'); pdf.text(String(i + 1), M + 8, yy + 2.3, { align:'center' });
          const la = linhas(t.acao, CW - 22, 10);
          fonte(10); cor('ink'); pdf.text(la, M + 14, yy + 2.3, { lineHeightFactor:1.35 });
          fonte(8); cor('mut'); pdf.text(txtPdf(t.area), M + 14, yy + 2.3 + alt(la.length, 10));
          yy += hs[i];
        });
        y += hP + 7;
        porArea.forEach(a => {
          blocoTitulo(a.nome, a.pct, tp);
          a.itens.forEach(it => {
            const la = linhas(it.acao, CW - 8, 10), lp = linhas('a partir de: ' + it.pergunta, CW - 8, 8);
            const h = alt(la.length, 10) + alt(lp.length, 8) + 4;
            if(y + h > LIM){ nova(tp); blocoTitulo(a.nome, a.pct, tp, true); }
            fonte(10, 'bold'); cor('acc'); pdf.text('\u203A', M + 1, y + 4);
            fonte(10); cor('ink'); pdf.text(la, M + 6, y + 4, { lineHeightFactor:1.35 });
            fonte(8); cor('mut'); pdf.text(lp, M + 6, y + 4 + alt(la.length, 10), { lineHeightFactor:1.3 });
            y += h;
            cor('line', 'd'); pdf.setLineWidth(0.15); pdf.line(M + 6, y - 1, W - M, y - 1);
          });
          y += 5;
        });
        caixa(plain(raw('relatorio.planoFecho')), tp, { tam:9 });
      }
    }

    // respostas
    const tr = 'Respostas do diagnóstico';
    nova(tr);
    areas().forEach(a => {
      const st = areaStats(a.id), itens = [];
      cadaPergunta((sc, si, q, qi) => {
        if(areaDe(sc, q) !== a.id) return;
        const r = respostaTexto(si, qi); if(!r) return;
        itens.push({ q:plain(raw(qPath(si, qi) + '.texto')), r, d:dorQ(sc, q, qi) });
      });
      if(!itens.length) return;
      blocoTitulo(nomeArea(a), st.aprov, tr);
      itens.forEach(it => {
        const lq = linhas(it.q, CW - 8, 9), lr = linhas(it.r, CW - 8, 9.5, 'bold');
        const h = alt(lq.length, 9) + alt(lr.length, 9.5) + 3;
        if(y + h > LIM){ nova(tr); blocoTitulo(nomeArea(a), st.aprov, tr, true); }
        const dc = it.d === 1 ? 'bad' : it.d === 0.5 ? 'warn' : it.d === 0 ? 'ok' : null;
        if(dc){ cor(dc, 'f'); pdf.circle(M + 1.6, y + 2.4, 1.2, 'F'); }
        fonte(9); cor('mut'); pdf.text(lq, M + 5, y + 3.5, { lineHeightFactor:1.3 });
        fonte(9.5, 'bold'); cor('ink'); pdf.text(lr, M + 5, y + 3.5 + alt(lq.length, 9), { lineHeightFactor:1.3 });
        y += h;
      });
      y += 5;
    });
    caixa(plain(raw('relatorio.rodape'), { data:dataTxt }), tr, { tam:8.5, cor:'mut' });

    const n = pdf.getNumberOfPages();
    for(let i = 1; i <= n; i++){
      pdf.setPage(i);
      cor('line', 'd'); pdf.setLineWidth(0.2); pdf.line(M, H - 12, W - M, H - 12);
      fonte(8); cor('mut'); pdf.text(txtPdf(MARCA.nome || ''), M, H - 8); pdf.text('Página ' + i + ' de ' + n, W - M, H - 8, { align:'right' });
    }
    return pdf;
  }
  async function gerarPdf(comPlano, btn){
    const rotulo = btn.textContent;
    btn.disabled = true; btn.textContent = 'Gerando PDF…';
    const nome = 'raio-x-comercial-' + slug(dx.ident.empresa || N.id) + (comPlano ? '-com-plano-de-acao' : '') + '-' + (dx.ident.data || hojeISO()).split('-').reverse().join('-') + '.pdf';
    try{
      await biblioteca('jspdf', 'jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const pdf = await montarPdf(comPlano);
      await salvarArquivo(nome, pdf.output('blob'), 'application/pdf');
    }catch(err){
      // sem a biblioteca de PDF: usa a impressão do navegador ("Salvar como PDF")
      montarRelatorio(comPlano);
      toast('Abrindo a impressão: escolha "Salvar como PDF".');
      const tit = document.title; document.title = nome.replace(/\.pdf$/, '');
      setTimeout(() => { window.print(); setTimeout(() => { document.title = tit; }, 1000); }, 60);
    }finally{
      btn.disabled = false; btn.textContent = rotulo;
    }
  }

  // ============ início ============
  $('#miniLogo').src = MARCA.icone || MARCA.logo || '';
  window.RB = { proj, custoEsperar, geral, areaStats, resumoTexto, escolherNicho, ir, montarRelatorio, montarPdf, estadoQ, respEfetiva, get dx(){ return dx; }, get nicho(){ return N; } };
  const hash = (location.hash || '').replace('#', '');
  const inicial = NICHOS.find(n => n.id === hash) || NICHOS.find(n => n.id === store.get('rb:nicho')) || (NICHOS.length === 1 ? NICHOS[0] : null);
  if(inicial) escolherNicho(inicial.id);
  else { N = NICHOS[0] || null; if(N){ dx = Object.assign(novoDx(), store.get(dxKey()) || {}); montar(); } abrirPicker(); }
})();
