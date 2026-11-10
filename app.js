/* Criogenia ISI-SAS: ultrafreezers e botijões de N₂ navegáveis em 3D (CSS 3D, sem bibliotecas).
   Sala → equipamento aberto → rack → caixa → vial. Cena e painel portados da tela de Criogenia do GIRA;
   dados de CrioAPI (data.js), registro de quem fez cada alteração e exportação para Excel. */
'use strict';
const state = {};
const LETRAS = 'ABCDEFGHIJKL';
const giraCryoPos = k => { const [l, c] = k.split(':').map(Number); return LETRAS[l - 1] + c; };
const CRIO_CATEGORIAS = ['Células', 'Bactérias', 'Plasmídeos', 'RNA / reagentes', 'Outros'];
const CRIO_MOTIVOS = ['Uso', 'Descarte', 'Transferência', 'Perda'];
const GIRA_CRYO_PRESETS = {
  coldlab: { tipo: 'freezer', nome: 'Ultrafreezer', modelo: 'ColdLab CL374-86V', temperatura: '−80 °C', layout: { compartimentos: 4, racks: 4, niveis: 4, profundidade: 3, linhas: 9, colunas: 9 },
    label: 'Ultrafreezer ColdLab CL374-86V — 4 compartimentos × 4 racks, 12 caixas 9×9 por rack' },
  tsx: { tipo: 'freezer', nome: 'Ultrafreezer', modelo: 'Thermo Scientific TSX Series', temperatura: '−80 °C', layout: { compartimentos: 5, racks: 4, niveis: 4, profundidade: 3, linhas: 9, colunas: 9 },
    label: 'Ultrafreezer Thermo Scientific TSX — 5 compartimentos × 4 racks, 12 caixas 9×9 por rack' },
  indrel: { tipo: 'freezer', nome: 'Ultrafreezer', modelo: 'Indrel Scientific', temperatura: '−80 °C', layout: { compartimentos: 4, racks: 4, niveis: 4, profundidade: 3, linhas: 9, colunas: 9 },
    label: 'Ultrafreezer Indrel Scientific — 4 compartimentos × 4 racks, 12 caixas 9×9 por rack' },
  sc47: { tipo: 'tanque', nome: 'Botijão de N₂', modelo: 'Sempercrio SC-47', temperatura: '−196 °C', layout: { racks: 6, niveis: 5, linhas: 5, colunas: 5 },
    label: 'Botijão Sempercrio SC-47 (50 L) — 6 racks quadrados, 5 caixas 5×5 por rack' },
  xtb20: { tipo: 'tanque', nome: 'Botijão de N₂', modelo: 'Worthington 20XTB-11M', temperatura: '−196 °C', layout: { racks: 6, niveis: 5, linhas: 5, colunas: 5 },
    label: 'Botijão Worthington 20XTB-11M (20 L) — 6 racks, 5 caixas 5×5 por rack' },
};
const GIRA_CRYO_COR = { 'Células': 'var(--cr-cel)', 'Bactérias': 'var(--cr-bac)', 'Plasmídeos': 'var(--cr-pla)', 'RNA / reagentes': 'var(--cr-rna)' };
const giraCryoCor = cat => GIRA_CRYO_COR[cat] || 'var(--cr-out)';
const giraCryoReduz = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ───────────── utilidades de página ─────────────
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escapeAttr = escapeHtml;
const dataBr = iso => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
const dataHora = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
let toastT = null;
function toast(msg, erro) {
  document.querySelector('.toast')?.remove(); clearTimeout(toastT);
  const t = document.createElement('div'); t.className = 'toast' + (erro ? ' erro' : ''); t.setAttribute('role', erro ? 'alert' : 'status'); t.textContent = msg;
  document.body.appendChild(t); toastT = setTimeout(() => t.remove(), erro ? 6000 : 3200);
}
let modalOk = null, focoAntes = null;
function openModal(titulo, sub, corpo, ok, rotuloOk = 'Salvar') {
  closeModal(); focoAntes = document.activeElement;
  const f = document.createElement('div'); f.className = 'modal-fundo'; f.id = 'modalFundo';
  f.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitulo"><header><h2 id="modalTitulo">${escapeHtml(titulo)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</header>
    <div class="corpo">${corpo}</div><footer><button type="button" class="btn" data-action="closeModal">Cancelar</button><button type="button" class="btn primary" id="modalConfirm">${escapeHtml(rotuloOk)}</button></footer></div>`;
  document.body.appendChild(f); modalOk = ok;
  f.addEventListener('mousedown', e => { if (e.target === f) closeModal(); });
  f.querySelector('#modalConfirm').addEventListener('click', () => modalOk && modalOk());
  f.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); modalOk && modalOk(); } });
  setTimeout(() => (f.querySelector('.corpo input, .corpo select, .corpo textarea') || f.querySelector('#modalConfirm')).focus(), 0);
}
function closeModal() { const f = document.getElementById('modalFundo'); if (f) { f.remove(); modalOk = null; if (focoAntes && focoAntes.isConnected) focoAntes.focus(); } }
function setModalBusy(b) { const x = document.getElementById('modalConfirm'); if (x) { x.disabled = b; x.dataset.rot = x.dataset.rot || x.textContent; x.textContent = b ? 'Salvando…' : x.dataset.rot; } }
function openDetailDrawer(titulo, sub, corpo, rodape) {
  closeDrawer();
  const f = document.createElement('div'); f.className = 'gaveta-fundo'; f.id = 'gavetaFundo';
  f.innerHTML = `<aside class="gaveta" role="dialog" aria-modal="true" aria-labelledby="gavetaTitulo"><header><div><h2 id="gavetaTitulo">${escapeHtml(titulo)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</div><button type="button" class="fechar" data-action="closeDrawer" aria-label="Fechar">×</button></header>
    <div class="corpo">${corpo}</div>${rodape ? `<footer>${rodape}</footer>` : ''}</aside>`;
  f.addEventListener('mousedown', e => { if (e.target === f) closeDrawer(); });
  document.body.appendChild(f); f.querySelector('.fechar').focus();
}
function closeDrawer() { document.getElementById('gavetaFundo')?.remove(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.getElementById('modalFundo')) closeModal(); else closeDrawer(); } });
document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const f = window[a.dataset.action]; if (typeof f === 'function') { e.preventDefault(); f(a.dataset.arg); }
});

// ───────────── dados → árvore ─────────────
// Estrutura derivada do layout: freezer → compartimento → rack → caixa; botijão → rack → caixa.
// A caixa tem chave "c2/r3/k5" (freezer) ou "r3/k5" (botijão), a mesma usada no banco.
function giraCryoBuild(r) {
  const porCaixa = new Map();
  for (const v of r.vials) { const k = v.equipamento_id + '/' + v.caixa; (porCaixa.get(k) || porCaixa.set(k, []).get(k)).push(v); }
  const ultima = new Map(); for (const l of r.leituras) { const u = ultima.get(l.equipamento_id); if (!u || l.em > u.em) ultima.set(l.equipamento_id, l); }
  const caixa = (e, key, nome, nivel, prof) => {
    const vs = porCaixa.get(e.id + '/' + key) || [], cont = new Map();
    for (const v of vs) { const x = cont.get(v.amostra) || { nome: v.amostra, categoria: v.categoria, n: 0 }; x.n++; cont.set(v.amostra, x); }
    return { id: e.id + '/' + key, key, eqId: e.id, tipo: 'caixa', nome, nivel, profundidade: prof, linhas: e.layout.linhas, colunas: e.layout.colunas, ocupadas: vs.length,
      amostras: [...cont.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR')) };
  };
  const equipments = r.equipamentos.map(e => {
    const L = e.layout, base = { id: e.id, tipo: e.tipo, nome: e.nome, modelo: e.modelo, temperatura: e.temperatura, raw: e,
      limits: { maxTemperature: e.limite_temperatura, minLevel: e.limite_nivel, readEveryDays: e.leitura_dias }, ...giraCryoLeituraInfo(e, ultima.get(e.id)) };
    const cans = e.tipo === 'tanque' ? giraCryoCanisters(e) : null;
    const racks = (pre, nomeRack) => Array.from({ length: L.racks }, (_, i) => {
      const r = i + 1, kids = []; let k = 0;
      for (let nv = 1; nv <= (cans ? cans[i].caixas : L.niveis); nv++) for (let f = 1; f <= (e.tipo === 'freezer' ? L.profundidade : 1); f++) { k++; kids.push(caixa(e, `${pre}r${r}/k${k}`, `Caixa ${k}`, nv, e.tipo === 'freezer' ? f : undefined)); }
      return { id: `${e.id}/${pre}r${r}`, tipo: 'rack', nome: nomeRack(r), cor: cans ? cans[i].cor : '', children: kids };
    });
    if (e.tipo === 'freezer') return { ...base, children: Array.from({ length: L.compartimentos }, (_, i) => ({ id: `${e.id}/c${i + 1}`, tipo: 'compartimento', nome: `Compartimento ${i + 1}`, children: racks(`c${i + 1}/`, r => `Rack ${i + 1}.${r}`) })) };
    return { ...base, children: racks('', r => `Canister ${r}`) };
  });
  return { canManage: true, equipments, vials: r.vials };
}
// Cada canister (rack do botijão) tem uma cor fixa pelo número, como os canisters anodizados.
const CANISTER_CORES = ['#e5484d', '#3e7bfa', '#2fa36b', '#f2b311', '#8e4ec6', '#f76b15', '#e93d82', '#12a5b8', '#8a9a1f', '#a0662f'];
const giraCryoCanisterCor = n => CANISTER_CORES[(n - 1) % CANISTER_CORES.length];
// Canisters do botijão: cor e quantidade de caixas de cada um (layout.canisters; sem isso, cor padrão e "niveis" caixas).
function giraCryoCanisters(e) {
  const L = e.layout || {}, lista = Array.isArray(L.canisters) ? L.canisters : [];
  return Array.from({ length: L.racks || 0 }, (_, i) => {
    const c = lista[i] || {};
    return { cor: /^#[0-9a-f]{6}$/i.test(c.cor || '') ? c.cor : giraCryoCanisterCor(i + 1), caixas: Number.isInteger(c.caixas) && c.caixas > 0 ? c.caixas : L.niveis };
  });
}
function giraCryoLeituraInfo(e, u) {
  const dias = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  const lastReading = u ? { temperature: u.temperatura, level: u.nivel, refilled: u.reabastecido, outOfRange: u.fora, daysAgo: dias(u.em), atLabel: dataHora(u.em), by: u.por_nome } : null;
  const readingOverdue = !!e.leitura_dias && (u ? dias(u.em) > e.leitura_dias : dias(e.criado_em) > e.leitura_dias);
  return { lastReading, readingOverdue };
}
async function giraLoadCryo(depois) {
  try { const r = await CrioAPI.carregar(); state.cryoError = ''; giraCryoSetData(giraCryoBuild(r)); }
  catch (e) { state.cryoError = e.message || String(e); }
  if (depois) depois(); else giraRefreshCryo();
}
function giraCryoSetData(cryo) {
  state.cryo = cryo; state.cryoIdx = null;
  const idx = giraCryoIndex();
  state.cryoPath = (state.cryoPath || []).filter(id => idx.has(id));
  if (state.cryoBox) { const p = state.cryoPath; state.cryoBox = p.length && p[p.length - 1] === state.cryoBox.id ? giraCryoBoxData(state.cryoBox.id) : null; }
}
function giraRefreshCryo() { const el = document.getElementById('cryoWorkspace'); if (el) el.outerHTML = giraCryoHtml(); }
// Índice id → {n: nó, pai, eq} da árvore (refeito quando os dados mudam).
function giraCryoIndex() {
  if (state.cryoIdx) return state.cryoIdx;
  const idx = new Map(), andar = (n, pai, eq) => { idx.set(n.id, { n, pai, eq: eq || n }); (n.children || []).forEach(f => andar(f, n, eq || n)); };
  ((state.cryo && state.cryo.equipments) || []).forEach(e => andar(e, null, null));
  return state.cryoIdx = idx;
}
// Caminho visível até o nó (o compartimento do freezer aparece no rack, não como tela própria).
function giraCryoChain(id) {
  const idx = giraCryoIndex(), out = [];
  for (let x = idx.get(id); x; x = x.pai ? idx.get(x.pai.id) : null) if (x.n.tipo !== 'compartimento') out.unshift(x.n.id);
  return out;
}
function giraCryoCaminho(id) { const idx = giraCryoIndex(), out = []; for (let x = idx.get(id); x; x = x.pai ? idx.get(x.pai.id) : null) out.unshift(x.n.nome); return out; }
function giraCryoCount(n) {
  if (n.tipo === 'caixa') return { ocup: n.ocupadas, total: n.linhas * n.colunas, caixas: 1 };
  return (n.children || []).map(giraCryoCount).reduce((a, b) => ({ ocup: a.ocup + b.ocup, total: a.total + b.total, caixas: a.caixas + b.caixas }), { ocup: 0, total: 0, caixas: 0 });
}
const giraCryoPct = c => c.total ? Math.round(100 * c.ocup / c.total) : 0;
function giraCryoBoxTitle(cx) { return cx.amostras && cx.amostras.length ? cx.amostras.slice(0, 2).map(a => a.nome).join(' + ') + (cx.amostras.length > 2 ? ' …' : '') : 'Caixa vazia'; }
// Caixa aberta: os vials guardados nela, no formato da ficha.
function giraCryoBoxData(id) {
  const x = giraCryoIndex().get(id); if (!x || x.n.tipo !== 'caixa') return null;
  const cx = x.n, vials = state.cryo.vials.filter(v => v.equipamento_id === cx.eqId && v.caixa === cx.key).sort((a, b) => a.linha - b.linha || a.coluna - b.coluna)
    .map(v => ({ id: v.id, codigo: v.codigo, linha: v.linha, coluna: v.coluna, pos: LETRAS[v.linha - 1] + v.coluna, amostra: v.amostra, categoriaId: v.categoria, categoria: v.categoria,
      detalhe: v.detalhe, meio: v.meio, congeladoEm: v.congelado_em || '', congeladoFmt: dataBr(v.congelado_em), projeto: v.projeto, observacao: v.observacao,
      guardadoPor: v.guardado_por, guardadoFmt: dataHora(v.guardado_em) }));
  return { id, caminho: giraCryoCaminho(id), vials };
}

// ───────────── tela ─────────────
const ICONE = {
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13l4 5M12 13l-4 5"/></svg>',
  registro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};
function giraCryoHtml() {
  const d = state.cryo, ori = !!(d && d.canManage);
  const head = `<header class="gds-page-heading"><div><span class="gds-eyebrow">Laboratório</span><h1 id="cryoTitle">Criogenia</h1><p>Ultrafreezer e nitrogênio líquido: abra o equipamento e vá aproximando até a caixa e o vial.</p></div>
    <div class="cabecalho-acoes"><button type="button" class="btn" data-action="crioRegistroGeral">${ICONE.registro}Registro de atividades</button><button type="button" class="btn" data-action="crioExportar">${ICONE.excel}Exportar Excel</button>
    ${ori ? `<button type="button" class="btn primary" data-action="giraCryoEquipmentForm" data-arg="">${ICONE.mais}Novo equipamento</button>` : ''}</div></header>`;
  if (!d) return `<section id="cryoWorkspace" class="gds-domain-workspace" aria-labelledby="cryoTitle">${head}<div class="gds-panel gds-empty" role="status"><strong>${state.cryoError ? 'Não foi possível abrir a criogenia.' : 'Carregando a criogenia…'}</strong>${state.cryoError ? `<p>${escapeHtml(state.cryoError)}</p><button type="button" class="btn soft" data-action="giraCryoReload">Tentar de novo</button>` : ''}</div></section>`;
  if (!d.equipments.length) return `<section id="cryoWorkspace" class="gds-domain-workspace" aria-labelledby="cryoTitle">${head}<div class="gds-panel gds-empty"><strong>Nenhum equipamento cadastrado.</strong><p class="gds-muted">Cadastre o ultrafreezer ou o botijão de nitrogênio: o site cria compartimentos, racks e caixas de uma vez.</p><button type="button" class="btn primary" data-action="giraCryoEquipmentForm" data-arg="">${ICONE.mais}Novo equipamento</button></div></section>`;
  setTimeout(giraCryoMount, 0);
  return `<section id="cryoWorkspace" class="gds-domain-workspace" aria-labelledby="cryoTitle">${head}
    <div class="cr-busca"><label for="cryoSearch">Localizar amostra</label><input id="cryoSearch" type="search" autocomplete="off" placeholder="Ex.: HEK293T, BL21, pET-28a" value="${escapeAttr(state.cryoQuery || '')}"><ul id="cryoResults" class="cr-resultados" hidden></ul></div>
    ${giraCryoTrailBox()}
    <div class="cr-layout"><div class="cr-palco" id="cryoStage" aria-label="Visualização tridimensional do armazenamento"><button type="button" class="cr-voltar" data-action="giraCryoBack" ${state.cryoPath && state.cryoPath.length ? '' : 'hidden'}>← Voltar</button><div class="cr-dica" id="cryoHint"></div></div>
    ${giraCryoPanelBox()}</div></section>`;
}
function giraCryoReload() { state.cryo = null; giraRefreshCryo(); giraLoadCryo(); }
const giraCryoTrailBox = () => `<nav class="cr-trilha" id="cryoTrail" aria-label="Caminho até a caixa">${giraCryoTrailHtml()}</nav>`;
const giraCryoPanelBox = () => `<aside class="cr-painel" id="cryoPanel">${giraCryoPanelHtml()}</aside>`;
function giraCryoTrailHtml() {
  const idx = giraCryoIndex(), p = state.cryoPath || [];
  const itens = [['', 'Sala']].concat(p.map(id => [id, idx.get(id).n.nome]));
  let h = itens.map(([id, nome], i) => (i ? '<span class="cr-sep" aria-hidden="true">›</span>' : '') + (i === itens.length - 1 ? `<span aria-current="location">${escapeHtml(nome)}</span>` : `<button type="button" data-action="giraCryoTrail" data-arg="${i}">${escapeHtml(nome)}</button>`)).join('');
  const v = giraCryoSelected(); if (v) h += `<span class="cr-sep" aria-hidden="true">›</span><strong>${escapeHtml(v.pos)}</strong>`;
  return h;
}
function giraCryoSelected() { const b = state.cryoBox; return b && state.cryoSel ? b.vials.find(v => v.id === state.cryoSel) || null : null; }

function giraCryoLine(id, titulo, sub, c, cor) {
  return `<button type="button" class="cr-linha" data-action="giraCryoGo" data-arg="${escapeAttr(id)}"><span><b>${cor ? `<span class="cr-ponto" style="--c:${cor}"></span>` : ''}${escapeHtml(titulo)}</b><small>${escapeHtml(sub)}</small></span><span class="cr-num">${c.ocup}/${c.total}</span><span class="cr-medidor"><i style="width:${giraCryoPct(c)}%"></i></span></button>`;
}
function giraCryoStats(c) { return `<div class="cr-stats"><div><b>${c.ocup}</b><span>vials</span></div><div><b>${c.total - c.ocup}</b><span>posições livres</span></div><div><b>${c.ocup && !giraCryoPct(c) ? '&lt;1' : giraCryoPct(c)}%</b><span>ocupação</span></div></div>`; }
function giraCryoPanelHtml() {
  const d = state.cryo, idx = giraCryoIndex(), p = state.cryoPath || [], ult = p.length ? idx.get(p[p.length - 1]).n : null;
  if (!ult) return `<h2>Equipamentos</h2><div class="cr-lista">${d.equipments.map(e => { const c = giraCryoCount(e); return giraCryoLine(e.id, e.nome, [e.modelo, e.temperatura, c.caixas + ' caixas', giraCryoLeituraCurta(e)].filter(Boolean).join(' · '), c); }).join('')}</div>
    <div class="cr-acoes"><button type="button" class="btn soft" data-action="giraCryoEquipmentForm" data-arg="" data-tipo="freezer">${ICONE.mais}Ultrafreezer</button><button type="button" class="btn soft" data-action="crioNovoBotijao">${ICONE.mais}Botijão de N₂</button></div>`;
  const c = giraCryoCount(ult);
  if (ult.tipo === 'freezer' || ult.tipo === 'tanque') {
    const e = ult.raw, quem = `<p class="gds-muted" style="font-size:13px">Adicionado por ${escapeHtml(e.criado_por || '—')} em ${escapeHtml(dataHora(e.criado_em))}</p>`;
    const acoes = d.canManage ? `<div class="cr-acoes"><button type="button" class="btn soft" data-action="giraCryoEquipmentForm" data-arg="${escapeAttr(ult.id)}">Editar</button><button type="button" class="btn soft" data-action="giraCryoDeleteEquipment" data-arg="${escapeAttr(ult.id)}">Excluir</button></div>` : '';
    const grupos = ult.tipo === 'freezer' ? ult.children.map(cp => `<h3>${escapeHtml(cp.nome)}</h3><div class="cr-lista">${cp.children.map(r => giraCryoLine(r.id, r.nome, giraCryoSummary(r), giraCryoCount(r))).join('')}</div>`).join('')
      : `<div class="cr-lista">${ult.children.map(r => giraCryoLine(r.id, r.nome, giraCryoSummary(r), giraCryoCount(r), r.cor)).join('')}</div>`;
    return `<div><h2>${escapeHtml(ult.nome)}</h2><p class="gds-muted">${escapeHtml([ult.modelo, ult.temperatura].filter(Boolean).join(' · '))}</p>${quem}</div>${giraCryoStats(c)}${giraCryoRegistroHtml(ult)}${acoes}${grupos}`;
  }
  if (ult.tipo === 'rack') {
    return `<div><h2>${ult.cor ? `<span class="cr-ponto cr-ponto-g" style="--c:${ult.cor}"></span>` : ''}${escapeHtml(ult.nome)}</h2><p class="gds-muted">${escapeHtml(idx.get(ult.id).eq.nome)}</p></div>${giraCryoStats(c)}<div class="cr-lista">${ult.children.map(cx => giraCryoLine(cx.id, cx.nome + (cx.ocupadas ? ' · ' + giraCryoBoxTitle(cx) : ''), giraCryoBoxWhere(cx, idx), giraCryoCount(cx))).join('')}</div>`;
  }
  const b = state.cryoBox && state.cryoBox.id === ult.id ? state.cryoBox : null, v = giraCryoSelected(), pick = state.cryoPick || [];
  let h = `<div><h2>${escapeHtml(ult.nome)}</h2><p class="gds-muted">${escapeHtml(giraCryoBoxTitle(ult))} · grade ${ult.linhas}×${ult.colunas}</p></div>${giraCryoStats(c)}`;
  if (!b) return h + '<p class="gds-muted" role="status">Abrindo a caixa…</p>';
  if (v) h += `<div class="cr-ficha"><header><span class="cr-pos">${escapeHtml(v.pos)}</span><div><b>${escapeHtml(v.amostra)}</b><small><span class="cr-ponto" style="--c:${giraCryoCor(v.categoriaId)}"></span>${escapeHtml(v.categoria || 'Sem categoria')}</small></div></header>
    <dl>${[['Detalhe', v.detalhe], ['Meio', v.meio], ['Congelado em', v.congeladoFmt], ['Projeto', v.projeto], ['Observação', v.observacao], ['Guardado por', v.guardadoPor + ' · ' + v.guardadoFmt], ['Código', '#' + v.codigo]].filter(x => x[1]).map(([k, t]) => `<dt>${k}</dt><dd>${escapeHtml(t)}</dd>`).join('')}</dl>
    <div class="cr-acoes"><button type="button" class="btn primary" data-action="giraCryoWithdraw" data-arg="${escapeAttr(v.id)}">Retirar</button><button type="button" class="btn soft" data-action="giraCryoMove" data-arg="${escapeAttr(v.id)}">Mover</button><button type="button" class="btn soft" data-action="giraCryoEdit" data-arg="${escapeAttr(v.id)}">Editar</button><button type="button" class="btn soft" data-action="giraCryoHistory" data-arg="${escapeAttr(v.id)}">Histórico</button></div></div>`;
  else if (pick.length) h += `<div class="cr-ficha"><p><b>${pick.length} ${pick.length === 1 ? 'posição escolhida' : 'posições escolhidas'}</b>: ${escapeHtml(pick.map(k => giraCryoPos(k)).join(', '))}</p><div class="cr-acoes"><button type="button" class="btn primary" data-action="giraCryoStore">Guardar ${pick.length === 1 ? 'vial' : 'vials'} aqui</button><button type="button" class="btn soft" data-action="giraCryoClearPick">Limpar</button></div></div>`;
  else h += '<p class="gds-muted">Clique num vial para ver a ficha, ou nas posições vazias para escolher onde guardar.</p>';
  if (b.vials.length) h += `<h3>Conteúdo</h3><div class="cr-lista cr-vials">${b.vials.map(x => `<button type="button" class="cr-linha${x.id === state.cryoSel ? ' is-selected' : ''}" data-action="giraCryoSelect" data-arg="${escapeAttr(x.id)}" aria-pressed="${x.id === state.cryoSel}"><span><b>${escapeHtml(x.pos)} · ${escapeHtml(x.amostra)}</b><small>${escapeHtml([x.detalhe, x.congeladoFmt].filter(Boolean).join(' · '))}</small></span><span class="cr-ponto" style="--c:${giraCryoCor(x.categoriaId)}"></span></button>`).join('')}</div>`;
  return h;
}
function giraCryoSummary(r) {
  const nomes = [...new Set((r.children || []).flatMap(cx => (cx.amostras || []).map(a => a.nome)))];
  return nomes.length ? nomes.slice(0, 3).join(', ') + (nomes.length > 3 ? '…' : '') : 'Sem amostras';
}
function giraCryoBoxWhere(cx, idx) { return idx.get(cx.id).eq.tipo === 'tanque' ? `nível ${cx.nivel} (de baixo para cima)` : `nível ${cx.nivel} · ${['frente', 'meio', 'fundo'][cx.profundidade - 1] || 'posição ' + cx.profundidade}`; }

// ───────────── palco 3D ─────────────
function giraCryoEl(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
function giraCryoPx(e, o) { for (const k in o) e.style[k] = typeof o[k] === 'number' ? o[k] + 'px' : o[k]; return e; }
function giraCryoCuboid({ w, h, d, x = 0, y = 0, z = 0, cls = '', faces = {}, go }) {
  const c = giraCryoPx(giraCryoEl('div', 'cr-cub ' + cls), { width: w, height: h, left: -w / 2, top: -h / 2, transform: `translate3d(${x}px,${y}px,${z}px)` });
  if (go) c.dataset.go = go;
  const def = { front: [w, h, `translateZ(${d / 2}px)`], back: [w, h, `rotateY(180deg) translateZ(${d / 2}px)`], right: [d, h, `rotateY(90deg) translateZ(${w / 2}px)`],
    left: [d, h, `rotateY(-90deg) translateZ(${w / 2}px)`], top: [w, d, `rotateX(90deg) translateZ(${h / 2}px)`], bottom: [w, d, `rotateX(-90deg) translateZ(${h / 2}px)`] };
  for (const nome in def) { const f = faces[nome]; if (f === false) continue; const [fw, fh, t] = def[nome];
    c.appendChild(giraCryoPx(giraCryoEl('div', 'cr-face f-' + nome, f || ''), { width: fw, height: fh, left: (w - fw) / 2, top: (h - fh) / 2, transform: t })); }
  return c;
}
function giraCryoCylinder({ r, h, n = 32, x = 0, y = 0, z = 0, cls = '', topo = true }) {
  const c = giraCryoPx(giraCryoEl('div', 'cr-cil ' + cls), { left: 0, top: 0, transform: `translate3d(${x}px,${y}px,${z}px)` }), lw = 2 * r * Math.tan(Math.PI / n) + 1;
  for (let i = 0; i < n; i++) { const a = i * 360 / n, t = giraCryoPx(giraCryoEl('div', 'cr-tira'), { width: lw, height: h, left: -lw / 2, top: -h / 2, transform: `rotateY(${a}deg) translateZ(${r}px)` });
    t.style.setProperty('--s', ((1 - Math.cos((a + 35) * Math.PI / 180)) / 4).toFixed(3)); c.appendChild(t); }
  let tampo = null;
  if (topo) { tampo = giraCryoPx(giraCryoEl('div', 'cr-tampo'), { width: 2 * r, height: 2 * r, left: -r, top: -r, transform: `rotateX(90deg) translateZ(${h / 2}px)` }); c.appendChild(tampo); }
  return { c, tampo };
}
function giraCryoGroup(x, y, z, cls = '') { return giraCryoPx(giraCryoEl('div', 'cr-grupo ' + cls), { left: 0, top: 0, transform: `translate3d(${x}px,${y}px,${z}px)` }); }
function giraCryoVapor() { return giraCryoReduz() ? null : giraCryoEl('div', 'cr-vapor', '<i></i><i></i><i></i>'); }
// Botijão em escala (Ø 460 × 710 mm): corpo, ombro, pescoço e rolha. Em corte, só o vidro.
function giraCryoDewar(e, vidro) {
  const g = giraCryoGroup(0, 0, 0), R = 230 * e; let y = 0;
  for (const [r, h, n] of [[R, 560 * e, 40], [R * 0.78, 50 * e, 32], [R * 0.48, 34 * e, 24], [60 * e, 66 * e, 18]]) { g.appendChild(giraCryoCylinder({ r, h, n, y: y - h / 2, cls: vidro ? 'cr-vidro' : '' }).c); y -= h; }
  if (!vidro) g.appendChild(giraCryoCylinder({ r: 52 * e, h: 24 * e, n: 16, y: y - 12 * e, cls: 'cr-rolha' }).c);
  return g;
}
const giraCryoPainel = t => `<div class="cr-porta-ext"><div class="cr-lcd">${escapeHtml(String(t || '').replace(/\s*°C$/, ''))}<small>°C</small></div><div class="cr-puxador"></div></div>`;

function giraCryoSceneRoom(d) {
  const w = giraCryoEl('div', 'cr-world'), eqs = d.equipments, passo = 300, x0 = -(eqs.length - 1) * passo / 2;
  w.appendChild(giraCryoPx(giraCryoEl('div', 'cr-piso'), { transform: 'translateY(200px) rotateX(90deg)' }));
  eqs.forEach((e, i) => {
    const x = x0 + i * passo, rotulo = giraCryoEl('div', 'cr-etq', `${escapeHtml(e.nome)}<small>${escapeHtml(e.modelo || '')}</small>`);
    if (e.tipo === 'freezer') {
      w.appendChild(giraCryoCuboid({ w: 172, h: 410, d: 172, x, y: -5, cls: 'cr-fz', go: e.id, faces: { front: giraCryoPainel(e.temperatura) + '<div class="cr-grade-ar"></div>' } }));
      rotulo.style.transform = `translate3d(${x}px,226px,90px)`;
    } else {
      const g = giraCryoGroup(x, 200, 0); g.dataset.go = e.id; g.appendChild(giraCryoDewar(0.4, false)); w.appendChild(g);
      rotulo.style.transform = `translate3d(${x}px,226px,100px)`;
    }
    rotulo.dataset.go = e.id; w.appendChild(rotulo);
  });
  return { world: w, rx: -10, ry: -20, tam: [Math.max(420, eqs.length * passo + 80), 520], dy: -20, dica: 'Clique num equipamento para abrir. Arraste para girar.' };
}
function giraCryoSceneFreezer(eq) {
  const w = giraCryoEl('div', 'cr-world'), W = 290, H = 640, D = 280;
  const rows = eq.children.map((cp, i) => `<div class="cr-prat" style="grid-template-columns:28px repeat(${cp.children.length},1fr)"><span class="cr-prat-n">C${i + 1}</span>${cp.children.map(r => { const c = giraCryoCount(r);
    return `<button type="button" class="cr-rk" data-go="${escapeAttr(r.id)}" aria-label="${escapeAttr(r.nome + ': ' + c.ocup + ' vials')}"><span class="cr-rk-n">${escapeHtml(r.nome.replace(/^Rack\s*/, ''))}</span><span class="cr-rk-bar"><i style="width:${giraCryoPct(c)}%"></i></span></button>`; }).join('')}<span class="cr-contraporta" aria-hidden="true"></span></div>`).join('');
  w.appendChild(giraCryoCuboid({ w: W, h: H, d: D, cls: 'cr-fz', faces: { front: `<div class="cr-fz-int" style="grid-template-rows:repeat(${eq.children.length},1fr)">${rows}<div class="cr-grade-ar"></div></div>`, back: false } }));
  const porta = giraCryoPx(giraCryoEl('div', 'cr-porta3d', giraCryoPainel(eq.temperatura) + '<div class="cr-porta-int"></div>'), { width: W, height: H * 0.86, left: -W / 2, top: -H / 2, transform: `translateZ(${D / 2 + 2}px) rotateY(0deg)` });
  w.appendChild(porta);
  return { world: w, rx: -6, ry: -16, tam: [540, 700], dica: 'Porta e contraportas abertas. Escolha o compartimento e o rack.',
    entrar() { porta.style.transform = `translateZ(${D / 2 + 2}px) rotateY(-112deg)`; } };
}
function giraCryoSceneTank(eq) {
  const w = giraCryoEl('div', 'cr-world'), E = 0.75, R = 230 * E, Hc = 560 * E, corpo = giraCryoGroup(0, Hc / 2 + 30, 0), racks = eq.children, n = racks.length, hc = 310 * E * 1.1;
  corpo.appendChild(giraCryoDewar(E, true));
  corpo.appendChild(giraCryoPx(giraCryoEl('div', 'cr-ln2'), { width: 2 * R - 20, height: 2 * R - 20, left: -(R - 10), top: -(R - 10), transform: 'translateY(-30px) rotateX(90deg)' }));
  racks.forEach((rk, i) => {
    const a = i * 2 * Math.PI / Math.max(n, 1) + Math.PI / 6, c = giraCryoCount(rk), g = giraCryoGroup(Math.cos(a) * (R - 58), -hc / 2 - 8, Math.sin(a) * (R - 58), 'cr-rack-n2');
    g.dataset.go = rk.id; g.style.transform += ` rotateY(${-a * 180 / Math.PI + 90}deg)`; g.style.setProperty('--can', rk.cor);
    g.appendChild(giraCryoCuboid({ w: 64, h: hc, d: 68, faces: { top: `<span class="cr-can-n">${escapeHtml(rk.nome.replace(/^(Rack|Canister)\s*/, ''))}<small>${c.ocup}</small></span>` } }));
    g.appendChild(giraCryoCylinder({ r: 3, h: Hc - hc + 30, n: 6, y: -(hc / 2) - (Hc - hc + 30) / 2, z: -30, cls: 'cr-alca', topo: false }).c);
    corpo.appendChild(g);
  });
  const v = giraCryoVapor(); if (v) { v.style.transform = `translateY(${-Hc - 45}px) rotateX(90deg)`; corpo.appendChild(v); }
  w.appendChild(corpo);
  return { world: w, rx: -24, ry: -18, tam: [460, 640], dy: -40, dica: 'Vista em corte do botijão. Clique num canister para erguê-lo.' };
}
function giraCryoBoxMini(cx, BW, BH, BD, x, y, z) {
  const c = giraCryoCount(cx), et = `<div class="cr-cx-et"><b>${escapeHtml(cx.nome.replace(/^Caixa\s*/, 'C'))}</b><span>${escapeHtml(giraCryoBoxTitle(cx))}</span><em>${c.ocup}/${c.total}</em></div>`;
  const cor = cx.amostras && cx.amostras[0] ? giraCryoCor(cx.amostras[0].categoria) : '';
  const b = giraCryoCuboid({ w: BW, h: BH, d: BD, x, y, z, cls: 'cr-cx' + (cor ? '' : ' is-empty') + (state.cryoTarget === cx.id ? ' is-target' : ''), go: cx.id, faces: { front: et, right: et } });
  if (cor) b.style.setProperty('--tint', cor);
  return b;
}
function giraCryoSceneRack(rack, eq) {
  const w = giraCryoEl('div', 'cr-world'), cx = rack.children;
  if (eq.tipo === 'tanque') {
    const BW = 120, BH = 44, BD = 120, N = Math.max(1, ...cx.map(c => c.nivel || 1)), H = N * (BH + 10) + 20;
    w.style.setProperty('--can', rack.cor);
    w.appendChild(giraCryoCuboid({ w: BW + 16, h: H, d: BD + 16, cls: 'cr-frame cr-frame-can', faces: { front: false, top: false } }));
    w.appendChild(giraCryoCylinder({ r: 4, h: 170, n: 8, cls: 'cr-alca cr-alca-can', y: -H / 2 - 85, z: -(BD + 16) / 2 + 4, topo: false }).c);
    cx.forEach(c => w.appendChild(giraCryoBoxMini(c, BW, BH, BD, 0, H / 2 - 10 - ((c.nivel || 1) - 1) * (BH + 10) - BH / 2, 0)));
    const v = giraCryoVapor(); if (v) { v.style.transform = `translateY(${H / 2}px) rotateX(90deg)`; w.appendChild(v); }
    return { world: w, rx: -16, ry: -28, tam: [420, H + 220], dy: 40, dica: 'Canister erguido do botijão. A caixa 1 fica no fundo. Clique na caixa.' };
  }
  const BW = 140, BH = 54, BD = 140, NV = Math.max(1, ...cx.map(c => c.nivel || 1)), NF = Math.max(1, ...cx.map(c => c.profundidade || 1));
  const W = BW + 16, H = NV * (BH + 10) + 10, D = NF * (BD + 8) + 10;
  w.appendChild(giraCryoCuboid({ w: W, h: H, d: D, cls: 'cr-frame', faces: { front: false } }));
  w.appendChild(giraCryoCuboid({ w: 60, h: 10, d: 18, y: -H / 2 - 10, z: D / 2 - 10, cls: 'cr-frame' }));
  cx.forEach(c => w.appendChild(giraCryoBoxMini(c, BW, BH, BD, 0, -H / 2 + 10 + ((c.nivel || 1) - 1) * (BH + 10) + BH / 2, D / 2 - 5 - ((c.profundidade || 1) - 1) * (BD + 8) - BD / 2)));
  return { world: w, rx: -14, ry: -48, tam: [560, Math.max(400, H + 140)], dica: 'Rack fora do freezer. Clique na caixa (frente, meio ou fundo de cada nível).' };
}
function giraCryoSceneBox(cx) {
  const w = giraCryoEl('div', 'cr-world'), g = cx.colunas, L = Math.max(g, cx.linhas) * 36 + 46, H = 64, b = state.cryoBox && state.cryoBox.id === cx.id ? state.cryoBox : null;
  const porPos = new Map((b ? b.vials : []).map(v => [v.linha + ':' + v.coluna, v])), pick = new Set(state.cryoPick || []);
  let grid = `<div class="cr-gradev" style="grid-template-columns:22px repeat(${g},1fr);grid-template-rows:22px repeat(${cx.linhas},1fr)"><span></span>`;
  for (let k = 1; k <= g; k++) grid += `<span class="cr-rot">${k}</span>`;
  for (let l = 1; l <= cx.linhas; l++) {
    grid += `<span class="cr-rot">${LETRAS[l - 1]}</span>`;
    for (let k = 1; k <= g; k++) {
      const v = porPos.get(l + ':' + k), pos = LETRAS[l - 1] + k;
      if (!v) { grid += b ? `<button type="button" class="cr-poco${pick.has(l + ':' + k) ? ' is-picked' : ''}" data-pos="${l}:${k}" aria-pressed="${pick.has(l + ':' + k)}" aria-label="${pos}: vazia"></button>` : '<span class="cr-poco"></span>'; continue; }
      grid += `<span class="cr-poco is-full"><button type="button" class="cr-vial${v.id === state.cryoSel ? ' is-selected' : ''}${state.cryoTargetSample && v.amostra === state.cryoTargetSample ? ' is-target' : ''}" data-vial="${escapeAttr(v.id)}" style="--c:${giraCryoCor(v.categoriaId)}" aria-label="${escapeAttr(pos + ': ' + v.amostra + (v.detalhe ? ', ' + v.detalhe : ''))}"></button></span>`;
    }
  }
  grid += '</div>';
  const c = giraCryoCount(cx), tint = cx.amostras && cx.amostras[0] ? giraCryoCor(cx.amostras[0].categoria) : 'var(--gds-muted)';
  const caixa = giraCryoCuboid({ w: L, h: H, d: L, cls: 'cr-cxg', faces: { top: grid, front: `<div class="cr-cx-et"><b>${escapeHtml(cx.nome)}</b><span>${escapeHtml(giraCryoBoxTitle(cx))}</span><em>${c.ocup}/${c.total}</em></div>` } });
  caixa.style.setProperty('--tint', tint); w.appendChild(caixa);
  const tampa = giraCryoPx(giraCryoEl('div', 'cr-tampa'), { width: L, height: L, left: -L / 2, top: -L, transform: `translate3d(0,${-H / 2}px,${-L / 2}px) rotateX(-90deg)` });
  tampa.style.setProperty('--tint', tint); w.appendChild(tampa);
  return { world: w, rx: -48, ry: -12, tam: [L + 80, L * 1.95], dy: L * 0.3, dica: 'Caixa aberta. Clique num vial para ver a ficha, ou nas posições vazias para guardar. Arraste para girar.',
    entrar() { tampa.style.transform = `translate3d(0,${-H / 2}px,${-L / 2}px) rotateX(32deg)`; } };
}
function giraCryoScene() {
  const d = state.cryo, idx = giraCryoIndex(), p = state.cryoPath || [], x = p.length ? idx.get(p[p.length - 1]) : null;
  if (!x) return giraCryoSceneRoom(d);
  if (x.n.tipo === 'freezer') return giraCryoSceneFreezer(x.n);
  if (x.n.tipo === 'tanque') return giraCryoSceneTank(x.n);
  if (x.n.tipo === 'rack') return giraCryoSceneRack(x.n, x.eq);
  return giraCryoSceneBox(x.n);
}
function giraCryoFit(stage, cn) {
  const r = stage.getBoundingClientRect(), k = Math.max(0.2, Math.min(1.25, (r.width - 32) / cn.tam[0], (r.height - 56) / cn.tam[1]));
  cn.world.style.setProperty('--k', k.toFixed(3)); cn.world.style.setProperty('--dy', ((cn.dy || 0) * k) + 'px');
}
// Monta a cena atual. Com `origem`, a cena anterior aproxima (ou se afasta) a partir do ponto clicado.
function giraCryoMount(origem, sentido) {
  const stage = document.getElementById('cryoStage'); if (!stage || !state.cryo) return;
  giraCryoBind(stage);
  const cn = giraCryoScene(), view = giraCryoEl('div', 'cr-view');
  cn.world.style.setProperty('--rx', cn.rx + 'deg'); cn.world.style.setProperty('--ry', cn.ry + 'deg');
  view.appendChild(cn.world);
  const anterior = stage.querySelector('.cr-view'), animar = !!(anterior && (sentido === 'in' || sentido === 'out') && !giraCryoReduz());
  state.cryoScene = cn; state.cryoOrbit = { x: 0, y: 0 };
  const hint = document.getElementById('cryoHint'); if (hint) hint.textContent = cn.dica;
  if (animar) {
    const r = stage.getBoundingClientRect(); let ox = r.width / 2, oy = r.height / 2;
    if (origem && origem.isConnected) { const o = origem.getBoundingClientRect(); ox = o.left + o.width / 2 - r.left; oy = o.top + o.height / 2 - r.top; }
    view.style.transformOrigin = anterior.style.transformOrigin = `${ox}px ${oy}px`;
    view.classList.add(sentido === 'in' ? 'is-entering-in' : 'is-entering-out'); stage.appendChild(view); giraCryoFit(stage, cn);
    void view.offsetWidth;
    anterior.classList.add(sentido === 'in' ? 'is-leaving-in' : 'is-leaving-out'); view.classList.remove('is-entering-in', 'is-entering-out');
    state.cryoAnimating = true; setTimeout(() => { anterior.remove(); state.cryoAnimating = false; }, 600);
    if (cn.entrar) setTimeout(cn.entrar, 120);
  } else {
    stage.querySelectorAll('.cr-view').forEach(v => v.remove()); stage.appendChild(view); giraCryoFit(stage, cn);
    if (cn.entrar) { if (sentido === 'keep') { view.querySelectorAll('.cr-tampa,.cr-porta3d').forEach(e => e.style.transition = 'none'); cn.entrar(); } else setTimeout(cn.entrar, 120); }
  }
}
// Arrastar gira a cena; clique sem arrasto navega, escolhe posição ou abre o vial. Ligado uma vez por palco.
function giraCryoBind(stage) {
  if (stage.dataset.bound) return; stage.dataset.bound = '1';
  let arr = null, arrastou = false;
  stage.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('.cr-voltar')) return; const o = state.cryoOrbit || { x: 0, y: 0 }; arr = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y }; arrastou = false; });
  stage.addEventListener('pointermove', e => {
    if (!arr || !state.cryoScene) return; const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (!arrastou && Math.hypot(dx, dy) < 6) return; arrastou = true; stage.classList.add('is-dragging');
    state.cryoOrbit = { y: Math.max(-50, Math.min(50, arr.ox + dx * 0.3)), x: Math.max(-25, Math.min(25, arr.oy - dy * 0.2)) };
    state.cryoScene.world.style.setProperty('--ory', state.cryoOrbit.y + 'deg'); state.cryoScene.world.style.setProperty('--orx', state.cryoOrbit.x + 'deg');
  });
  const solta = () => { arr = null; stage.classList.remove('is-dragging'); };
  stage.addEventListener('pointerup', solta); stage.addEventListener('pointerleave', solta);
  stage.addEventListener('click', e => {
    if (arrastou) { arrastou = false; e.stopPropagation(); return; }
    if (state.cryoAnimating) return;
    const v = e.target.closest('[data-vial]'); if (v) return giraCryoSelect(v.dataset.vial);
    const p = e.target.closest('[data-pos]'); if (p) return giraCryoTogglePick(p.dataset.pos);
    const g = e.target.closest('[data-go]'); if (g) giraCryoGo(g.dataset.go, g);
  });
  const busca = document.getElementById('cryoSearch');
  if (busca && !busca.dataset.bound) { busca.dataset.bound = '1'; let t = null; busca.addEventListener('input', () => { state.cryoQuery = busca.value; clearTimeout(t); t = setTimeout(giraCryoSearch, 200); }); }
}
window.addEventListener('resize', () => { const s = document.getElementById('cryoStage'); if (s && state.cryoScene) giraCryoFit(s, state.cryoScene); });

// ───────────── navegação ─────────────
function giraCryoRefreshPanel() {
  const p = document.getElementById('cryoPanel'); if (p) p.outerHTML = giraCryoPanelBox();
  const t = document.getElementById('cryoTrail'); if (t) t.outerHTML = giraCryoTrailBox();
  const b = document.querySelector('#cryoStage .cr-voltar'); if (b) b.hidden = !(state.cryoPath && state.cryoPath.length);
}
function giraCryoGo(id, origem, sentido) {
  const idx = giraCryoIndex(); if (!idx.has(id)) return;
  const alvo = giraCryoChain(id), antes = state.cryoPath || [];
  sentido = sentido || (alvo.length < antes.length ? 'out' : 'in');
  if (!(origem instanceof Element)) origem = null;
  if (!origem && sentido === 'in') origem = document.querySelector(`#cryoStage [data-go="${CSS.escape(id)}"]`);
  state.cryoPath = alvo; state.cryoSel = null; state.cryoPick = [];
  const n = idx.get(id).n;
  if (n.tipo === 'caixa') state.cryoBox = giraCryoBoxData(id);
  giraCryoMount(origem, sentido); giraCryoRefreshPanel();
}
function giraCryoBack() {
  const p = state.cryoPath || []; if (!p.length || state.cryoAnimating) return;
  state.cryoTarget = null; state.cryoTargetSample = null;
  if (p.length === 1) { state.cryoPath = []; state.cryoSel = null; state.cryoPick = []; giraCryoMount(null, 'out'); giraCryoRefreshPanel(); }
  else giraCryoGo(p[p.length - 2], null, 'out');
}
function giraCryoTrail(i) {
  const p = state.cryoPath || [], n = Number(i);
  if (n === 0) { state.cryoPath = []; state.cryoSel = null; state.cryoPick = []; giraCryoMount(null, 'out'); giraCryoRefreshPanel(); return; }
  if (p[n - 1]) giraCryoGo(p[n - 1], null, 'out');
}
function giraCryoSelect(id) {
  state.cryoSel = state.cryoSel === id ? null : id; state.cryoPick = [];
  document.querySelectorAll('#cryoStage .cr-vial.is-selected,#cryoStage .cr-poco.is-picked').forEach(e => e.classList.remove('is-selected', 'is-picked'));
  if (state.cryoSel) document.querySelector(`#cryoStage [data-vial="${CSS.escape(id)}"]`)?.classList.add('is-selected');
  giraCryoRefreshPanel();
}
function giraCryoTogglePick(k) {
  const s = new Set(state.cryoPick || []); s.has(k) ? s.delete(k) : s.add(k); state.cryoPick = [...s]; state.cryoSel = null;
  document.querySelectorAll('#cryoStage .cr-vial.is-selected').forEach(e => e.classList.remove('is-selected'));
  const el = document.querySelector(`#cryoStage [data-pos="${k}"]`); if (el) { el.classList.toggle('is-picked', s.has(k)); el.setAttribute('aria-pressed', String(s.has(k))); }
  giraCryoRefreshPanel();
}
function giraCryoClearPick() { state.cryoPick = []; document.querySelectorAll('#cryoStage .cr-poco.is-picked').forEach(e => { e.classList.remove('is-picked'); e.setAttribute('aria-pressed', 'false'); }); giraCryoRefreshPanel(); }

// Busca: caixas com a amostra; escolher um resultado faz o caminho sozinho até a caixa.
function giraCryoSearch() {
  const q = (state.cryoQuery || '').trim().toLocaleLowerCase('pt-BR'), ul = document.getElementById('cryoResults'); if (!ul) return;
  if (q.length < 2) { ul.hidden = true; return; }
  const grupos = new Map();
  for (const v of state.cryo.vials) {
    if (!(v.amostra.toLocaleLowerCase('pt-BR').includes(q) || (v.detalhe || '').toLocaleLowerCase('pt-BR').includes(q))) continue;
    const caixaId = v.equipamento_id + '/' + v.caixa, k = caixaId + '|' + v.amostra, g = grupos.get(k) || { amostra: v.amostra, caixaId, n: 0 }; g.n++; grupos.set(k, g);
  }
  state.cryoFound = [...grupos.values()].filter(g => giraCryoIndex().has(g.caixaId)).map(g => ({ ...g, caminho: giraCryoCaminho(g.caixaId) })).slice(0, 30);
  ul.outerHTML = `<ul id="cryoResults" class="cr-resultados">${state.cryoFound.length ? state.cryoFound.map((x, k) => `<li><button type="button" data-action="giraCryoFly" data-arg="${k}"><b>${escapeHtml(x.amostra)}</b><small>${escapeHtml(x.caminho.join(' › '))} · ${x.n} ${x.n === 1 ? 'vial' : 'vials'}</small></button></li>`).join('') : '<li class="cr-vazio">Nenhuma caixa com essa amostra.</li>'}</ul>`;
}
document.addEventListener('click', e => { const ul = document.getElementById('cryoResults'); if (ul && !ul.hidden && !e.target.closest('.cr-busca')) ul.hidden = true; });
function giraCryoFly(k) {
  const alvo = (state.cryoFound || [])[Number(k)]; const ul = document.getElementById('cryoResults'); if (ul) ul.hidden = true;
  if (!alvo) return; giraCryoFlyTo(alvo.caixaId, alvo.amostra);
}
function giraCryoFlyTo(caixaId, amostra) {
  if (!giraCryoIndex().has(caixaId)) return toast('Caixa não encontrada. Atualize a página.', true);
  state.cryoTarget = caixaId; state.cryoTargetSample = amostra || null;
  const destino = giraCryoChain(caixaId), atual = state.cryoPath || [], espera = giraCryoReduz() ? 0 : 700;
  let comum = 0; while (comum < atual.length && atual[comum] === destino[comum]) comum++;
  const passos = []; if (comum < atual.length) passos.push(() => { if (comum) giraCryoGo(destino[comum - 1], null, 'out'); else { state.cryoPath = []; giraCryoMount(null, 'out'); giraCryoRefreshPanel(); } });
  for (let i = comum; i < destino.length; i++) passos.push(() => giraCryoGo(destino[i]));
  passos.forEach((f, i) => setTimeout(f, i * espera));
  setTimeout(() => { const v = amostra && state.cryoBox && state.cryoBox.vials.find(x => x.amostra === amostra); if (v) giraCryoSelect(v.id); }, passos.length * espera);
}

// ───────────── ações (cada uma vira uma linha no registro, com o nome de quem fez) ─────────────
function giraCryoMutate(action, payload, erroId, depois, extra) {
  setModalBusy(true);
  CrioAPI.acao(action, payload).then(() => extra && extra()).then(() => giraLoadCryo(() => {
    setModalBusy(false); closeModal();
    if (state.cryoSel && !giraCryoSelected()) state.cryoSel = null;
    state.cryoPick = [];
    if (depois) depois();
    if (!document.getElementById('cryoStage') || !state.cryo.equipments.length) giraRefreshCryo(); else { giraCryoMount(null, 'keep'); giraCryoRefreshPanel(); }
    toast(CRIO_MSG[action] || 'Salvo.');
  })).catch(e => { setModalBusy(false); if (/crio_salvar_canisters/.test(e.message || '')) { e = new Error('O banco ainda não tem a função de canisters: rode de novo o supabase/schema.sql no SQL Editor do Supabase.'); giraLoadCryo(); } const el = document.getElementById(erroId); if (el) el.textContent = e.message || String(e); else toast(e.message || String(e), true); });
}
const CRIO_MSG = { crio_salvar_equipamento: 'Equipamento salvo.', crio_salvar_canisters: 'Canisters salvos.', crio_excluir_equipamento: 'Equipamento excluído.', crio_guardar_vials: 'Vials guardados.', crio_editar_vial: 'Vial atualizado.',
  crio_retirar_vial: 'Vial retirado.', crio_mover_vial: 'Vial movido.', crio_registrar_leitura: 'Leitura registrada.' };
function giraCryoVialFields(v) {
  const hoje = new Date().toISOString().slice(0, 10), cats = CRIO_CATEGORIAS.concat(v && v.categoria && !CRIO_CATEGORIAS.includes(v.categoria) ? [v.categoria] : []);
  return `<div class="field"><label for="crAmostra">Amostra</label><input id="crAmostra" maxlength="200" value="${escapeAttr(v ? v.amostra : '')}" placeholder="Ex.: HEK293T, E. coli BL21(DE3)"></div>
    <div class="gds-form-pair"><div class="field"><label for="crCategoria">Categoria</label><select id="crCategoria"><option value="">Sem categoria</option>${cats.map(c => `<option ${v && v.categoria === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select></div>
    <div class="field"><label for="crDetalhe">Passagem, clone ou alíquota</label><input id="crDetalhe" maxlength="200" value="${escapeAttr(v ? v.detalhe : '')}" placeholder="Ex.: P12"></div></div>
    <div class="gds-form-pair"><div class="field"><label for="crMeio">Meio de congelamento</label><input id="crMeio" maxlength="120" value="${escapeAttr(v ? v.meio : '')}" placeholder="Ex.: SFB + 10% DMSO"></div>
    <div class="field"><label for="crData">Congelado em</label><input id="crData" type="date" value="${escapeAttr(v ? v.congeladoEm : hoje)}"></div></div>
    <div class="field"><label for="crProjeto">Projeto</label><input id="crProjeto" maxlength="200" value="${escapeAttr(v ? v.projeto : '')}" placeholder="Ex.: GEN-T"></div>
    <div class="field"><label for="crObs">Observação</label><textarea id="crObs" maxlength="1000">${escapeHtml(v ? v.observacao : '')}</textarea></div><p id="crErro" role="alert"></p>`;
}
function giraCryoReadFields() {
  const v = k => document.getElementById(k).value;
  return { amostra: v('crAmostra').trim(), categoria: v('crCategoria'), detalhe: v('crDetalhe').trim(), meio: v('crMeio').trim(), congeladoEm: v('crData'), projeto: v('crProjeto').trim(), observacao: v('crObs').trim() };
}
function giraCryoStore() {
  const b = state.cryoBox, pick = state.cryoPick || []; if (!b || !pick.length) return;
  const cx = giraCryoIndex().get(b.id).n;
  openModal(pick.length === 1 ? 'Guardar vial' : `Guardar ${pick.length} vials`, `${b.caminho.join(' › ')} · ${pick.map(giraCryoPos).join(', ')}`, `<div class="gds-person-form">${giraCryoVialFields(null)}</div>`, () => {
    const f = giraCryoReadFields(); if (!f.amostra) { document.getElementById('crErro').textContent = 'Informe o nome da amostra.'; return; }
    giraCryoMutate('crio_guardar_vials', { ...f, equipamentoId: cx.eqId, caixa: cx.key, posicoes: pick.map(k => { const [linha, coluna] = k.split(':').map(Number); return { linha, coluna }; }) }, 'crErro');
  }, 'Guardar');
}
function giraCryoEdit(id) {
  const v = state.cryoBox && state.cryoBox.vials.find(x => x.id === id); if (!v) return;
  openModal('Editar vial', `${v.pos} · ${v.amostra}`, `<div class="gds-person-form">${giraCryoVialFields(v)}</div>`, () => {
    const f = giraCryoReadFields(); if (!f.amostra) { document.getElementById('crErro').textContent = 'Informe o nome da amostra.'; return; }
    giraCryoMutate('crio_editar_vial', { ...f, id: v.id }, 'crErro');
  }, 'Salvar');
}
function giraCryoWithdraw(id) {
  const v = state.cryoBox && state.cryoBox.vials.find(x => x.id === id); if (!v) return;
  openModal('Retirar vial', `${v.pos} · ${v.amostra}`, `<div class="gds-person-form"><div class="field"><label for="crMotivo">Motivo</label><select id="crMotivo">${CRIO_MOTIVOS.map(m => `<option>${escapeHtml(m)}</option>`).join('')}</select></div>
    <div class="field"><label for="crObsRet">Observação (opcional)</label><input id="crObsRet" maxlength="500" placeholder="Ex.: descongelado para cultura"></div><p class="gds-muted">A posição fica livre e a retirada entra no registro, com o seu nome.</p><p id="crErro" role="alert"></p></div>`, () => {
    giraCryoMutate('crio_retirar_vial', { id: v.id, motivo: document.getElementById('crMotivo').value, observacao: document.getElementById('crObsRet').value.trim() }, 'crErro', () => { state.cryoSel = null; });
  }, 'Retirar');
}
function giraCryoMove(id) {
  const v = state.cryoBox && state.cryoBox.vials.find(x => x.id === id); if (!v) return;
  const idx = giraCryoIndex(), caixas = [...idx.values()].filter(x => x.n.tipo === 'caixa').map(x => x.n);
  const nome = cx => giraCryoCaminho(cx.id).filter(s => !/^Compartimento/.test(s)).join(' › ');
  openModal('Mover vial', `${v.pos} · ${v.amostra}`, `<div class="gds-person-form"><div class="field"><label for="crDestino">Caixa de destino</label><select id="crDestino">${caixas.map(cx => `<option value="${escapeAttr(cx.id)}" ${cx.id === state.cryoBox.id ? 'selected' : ''}>${escapeHtml(nome(cx))} (${cx.linhas}×${cx.colunas}, ${cx.linhas * cx.colunas - cx.ocupadas} livres)</option>`).join('')}</select></div>
    <div class="field"><label for="crPosicao">Posição (ex.: B4)</label><input id="crPosicao" maxlength="3" autocomplete="off"></div><p id="crErro" role="alert"></p></div>`, () => {
    const m = /^([A-La-l])\s*(\d{1,2})$/.exec(document.getElementById('crPosicao').value.trim());
    if (!m) { document.getElementById('crErro').textContent = 'Escreva a posição como letra e número, por exemplo B4.'; return; }
    const cx = idx.get(document.getElementById('crDestino').value).n;
    giraCryoMutate('crio_mover_vial', { id: v.id, equipamentoId: cx.eqId, caixa: cx.key, linha: LETRAS.indexOf(m[1].toUpperCase()) + 1, coluna: Number(m[2]) }, 'crErro', () => { state.cryoSel = null; });
  }, 'Mover');
}
function crioRegistroLista(itens) {
  return `<ol class="cr-historico">${itens.map(i => `<li><strong><span class="reg-acao${/retirado|excluído/.test(i.acao) ? ' is-saida' : ''}">${escapeHtml(i.acao)}</span>${escapeHtml([i.equipamento, i.amostra].filter(Boolean).join(' · '))}</strong>${i.local ? `<small>${escapeHtml(i.local)}</small>` : ''}${i.detalhe ? `<small>${escapeHtml(i.detalhe)}</small>` : ''}<small>${escapeHtml(i.usuario)}${i.email ? ' (' + escapeHtml(i.email) + ')' : ''} · ${escapeHtml(dataHora(i.em))}</small></li>`).join('') || '<li>Sem registros.</li>'}</ol>`;
}
function giraCryoHistory(id) {
  const v = state.cryoBox && state.cryoBox.vials.find(x => x.id === id); if (!v) return;
  CrioAPI.registro({ vialId: id }).then(itens => openDetailDrawer(v.amostra, `Vial #${v.codigo} · ${v.pos}`, crioRegistroLista(itens))).catch(e => toast(e.message || String(e), true));
}
// Registro geral: todas as inclusões, exclusões e movimentações, com nome e e-mail de quem fez.
function crioRegistroGeral() {
  CrioAPI.registro().then(itens => {
    state.regItens = itens;
    const acoes = [...new Set(itens.map(i => i.acao))].sort();
    openDetailDrawer('Registro de atividades', `${itens.length} ${itens.length === 1 ? 'registro' : 'registros'} · quem incluiu, removeu ou alterou cada item`,
      `<div class="reg-filtros"><input id="regBusca" type="search" placeholder="Filtrar por nome, amostra, equipamento…" aria-label="Filtrar registro"><select id="regAcao" aria-label="Tipo de ação"><option value="">Todas as ações</option>${acoes.map(a => `<option>${escapeHtml(a)}</option>`).join('')}</select></div><div id="regLista">${crioRegistroLista(itens.slice(0, 300))}</div>`,
      `<button type="button" class="btn" data-action="crioExportar">${ICONE.excel}Exportar Excel</button>`);
    const filtra = () => {
      const q = document.getElementById('regBusca').value.trim().toLocaleLowerCase('pt-BR'), a = document.getElementById('regAcao').value;
      const r = state.regItens.filter(i => (!a || i.acao === a) && (!q || [i.usuario, i.email, i.equipamento, i.amostra, i.local, i.detalhe].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
      document.getElementById('regLista').innerHTML = crioRegistroLista(r.slice(0, 300)) + (r.length > 300 ? `<p class="gds-muted">Mostrando 300 de ${r.length}. Use o filtro ou exporte para o Excel.</p>` : '');
    };
    document.getElementById('regBusca').addEventListener('input', filtra); document.getElementById('regAcao').addEventListener('change', filtra);
  }).catch(e => toast(e.message || String(e), true));
}
function crioNovoBotijao() { giraCryoEquipmentForm('', 'sc47'); }
function giraCryoEquipmentForm(id, presetInicial) {
  const e = id ? giraCryoIndex().get(id)?.n : null;
  if (e) {
    const l = e.limits || {}, tanque = e.tipo === 'tanque', vl = x => x == null ? '' : String(x).replace('.', ',');
    openModal('Editar equipamento', e.nome, `<div class="gds-person-form"><div class="field"><label for="crEqNome">Nome</label><input id="crEqNome" maxlength="120" value="${escapeAttr(e.nome)}"></div>
      <div class="gds-form-pair"><div class="field"><label for="crEqModelo">Modelo</label><input id="crEqModelo" maxlength="120" value="${escapeAttr(e.modelo || '')}"></div><div class="field"><label for="crEqTemp">Temperatura</label><input id="crEqTemp" maxlength="40" value="${escapeAttr(e.temperatura || '')}"></div></div>
      <fieldset class="gds-check-group"><legend>Alertas do registro</legend><div class="gds-form-pair">${tanque ? `<div class="field"><label for="crLimNivel">Nível mínimo de N₂ (cm)</label><input id="crLimNivel" type="text" inputmode="decimal" value="${escapeAttr(vl(l.minLevel))}" placeholder="ex.: 20"></div>`
        : `<div class="field"><label for="crLimTemp">Temperatura máxima (°C)</label><input id="crLimTemp" type="text" inputmode="decimal" value="${escapeAttr(vl(l.maxTemperature))}" placeholder="ex.: -70"></div>`}<div class="field"><label for="crLimDias">Ler a cada (dias)</label><input id="crLimDias" type="number" min="1" max="60" value="${escapeAttr(vl(l.readEveryDays))}" placeholder="sem lembrete"></div></div>
      <p class="gds-muted">Leitura fora do limite fica marcada em vermelho. Com "ler a cada", o equipamento aparece como atrasado quando passar do prazo sem leitura.</p></fieldset>
      ${tanque ? `<fieldset class="gds-check-group"><legend>Canisters</legend><p class="gds-muted">Cor e quantidade de caixas de cada canister. A caixa 1 fica no fundo.</p><div class="cr-cans" id="crCans"></div>
        <div class="cr-acoes"><button type="button" class="btn soft" id="crCanMais">${ICONE.mais}Canister</button><button type="button" class="btn soft" id="crCanMenos">Remover o último</button></div></fieldset>` : ''}
      <p id="crErro" role="alert"></p></div>`, () => {
      const val = k => { const x = document.getElementById(k); return x ? x.value.trim() : ''; };
      const payload = { id: e.id, nome: val('crEqNome'), modelo: val('crEqModelo'), temperatura: val('crEqTemp'),
        limits: { maxTemperature: tanque ? (l.maxTemperature ?? '') : val('crLimTemp'), minLevel: tanque ? val('crLimNivel') : (l.minLevel ?? ''), readEveryDays: val('crLimDias') } };
      if (!tanque) return giraCryoMutate('crio_salvar_equipamento', payload, 'crErro');
      const cans = [...document.querySelectorAll('#crCans .cr-can-linha')].map(li => ({ cor: li.querySelector('input[type=color]').value, caixas: Number(li.querySelector('input[type=number]').value) }));
      const antes = giraCryoCanisters(e.raw), mudou = cans.length !== antes.length || cans.some((c, i) => c.cor.toLowerCase() !== antes[i].cor.toLowerCase() || c.caixas !== antes[i].caixas);
      giraCryoMutate('crio_salvar_equipamento', payload, 'crErro', null, mudou ? () => CrioAPI.acao('crio_salvar_canisters', { id: e.id, canisters: cans }) : null);
    }, 'Salvar');
    if (tanque) giraCryoCanForm(e);
    return;
  }
  const num = (k, l, v) => `<div class="field"><label for="crL${k}">${l}</label><input id="crL${k}" type="number" min="1" max="${/linhas|colunas/.test(k) ? 12 : 30}" value="${v}"></div>`;
  openModal('Novo equipamento', 'O site cria compartimentos, racks e caixas de uma vez. Depois é só guardar os vials.', `<div class="gds-person-form">
    <div class="field"><label for="crPreset">Modelo</label><select id="crPreset">${Object.entries(GIRA_CRYO_PRESETS).map(([k, p]) => `<option value="${k}" ${k === presetInicial ? 'selected' : ''}>${escapeHtml(p.label)}</option>`).join('')}<option value="">Outro (preencher abaixo)</option></select></div>
    <div class="gds-form-pair"><div class="field"><label for="crEqTipo">Tipo</label><select id="crEqTipo"><option value="freezer">Ultrafreezer</option><option value="tanque">Botijão de N₂</option></select></div><div class="field"><label for="crEqNome">Nome</label><input id="crEqNome" maxlength="120"></div></div>
    <div class="gds-form-pair"><div class="field"><label for="crEqModelo">Modelo</label><input id="crEqModelo" maxlength="120"></div><div class="field"><label for="crEqTemp">Temperatura</label><input id="crEqTemp" maxlength="40"></div></div>
    <fieldset class="gds-check-group"><legend>Estrutura</legend><div class="cr-form-grade">${num('compartimentos', 'Compartimentos', 4)}${num('racks', 'Racks por compartimento', 4)}${num('niveis', 'Caixas por pilha', 4)}${num('profundidade', 'Caixas em profundidade', 3)}${num('linhas', 'Linhas da caixa', 9)}${num('colunas', 'Colunas da caixa', 9)}</div></fieldset>
    <p id="crErro" role="alert"></p></div>`, () => {
    const v = k => document.getElementById(k).value, n = k => Number(v('crL' + k));
    if (!v('crEqNome').trim()) { document.getElementById('crErro').textContent = 'Informe o nome do equipamento.'; return; }
    state.cryoPath = [];
    giraCryoMutate('crio_salvar_equipamento', { tipo: v('crEqTipo'), nome: v('crEqNome').trim(), modelo: v('crEqModelo').trim(), temperatura: v('crEqTemp').trim(),
      layout: { compartimentos: n('compartimentos'), racks: n('racks'), niveis: n('niveis'), profundidade: n('profundidade'), linhas: n('linhas'), colunas: n('colunas') } }, 'crErro');
  }, 'Cadastrar');
  const preset = document.getElementById('crPreset'), tipo = document.getElementById('crEqTipo');
  const aplicar = () => { const p = GIRA_CRYO_PRESETS[preset.value]; if (!p) return; tipo.value = p.tipo;
    document.getElementById('crEqNome').value = p.nome; document.getElementById('crEqModelo').value = p.modelo; document.getElementById('crEqTemp').value = p.temperatura;
    for (const k of ['compartimentos', 'racks', 'niveis', 'profundidade', 'linhas', 'colunas']) document.getElementById('crL' + k).value = p.layout[k] || 1; giraCryoFormKind(); };
  preset.addEventListener('change', aplicar); tipo.addEventListener('change', giraCryoFormKind); aplicar();
}
// Linhas do formulário de canisters (cor + caixas), com botões para pôr e tirar canister.
function giraCryoCanForm(e) {
  const box = document.getElementById('crCans'), cheias = new Map();
  for (const r of e.children) cheias.set(r.id.split('/').pop(), Math.max(0, ...r.children.filter(cx => cx.ocupadas).map(cx => cx.nivel)));
  const linha = (i, c) => { const usado = cheias.get('r' + (i + 1)) || 0;
    return `<div class="cr-can-linha"><span class="cr-ponto cr-ponto-g" style="--c:${c.cor}"></span><b>Canister ${i + 1}</b><label>Cor <input type="color" value="${c.cor}" aria-label="Cor do canister ${i + 1}"></label>
      <label>Caixas <input type="number" min="${Math.max(1, usado)}" max="30" value="${c.caixas}" aria-label="Caixas do canister ${i + 1}"></label>${usado ? `<small class="gds-muted">com vials até a caixa ${usado}</small>` : ''}</div>`; };
  box.innerHTML = giraCryoCanisters(e.raw).map((c, i) => linha(i, c)).join('');
  box.addEventListener('input', ev => { if (ev.target.type === 'color') ev.target.closest('.cr-can-linha').querySelector('.cr-ponto').style.setProperty('--c', ev.target.value); });
  const erro = t => { document.getElementById('crErro').textContent = t; };
  document.getElementById('crCanMais').onclick = () => { const n = box.children.length; if (n >= 30) return erro('Máximo de 30 canisters.');
    const ult = box.lastElementChild, cx = ult ? Number(ult.querySelector('input[type=number]').value) || 1 : 5;
    box.insertAdjacentHTML('beforeend', linha(n, { cor: giraCryoCanisterCor(n + 1), caixas: cx })); erro(''); };
  document.getElementById('crCanMenos').onclick = () => { const n = box.children.length; if (n <= 1) return erro('O botijão precisa de pelo menos 1 canister.');
    if (cheias.get('r' + n)) return erro(`O canister ${n} tem vials guardados. Retire ou mova os vials antes de removê-lo.`); box.lastElementChild.remove(); erro(''); };
}
// O botijão não tem compartimentos nem profundidade: os campos somem e valem 1.
function giraCryoFormKind() {
  const freezer = document.getElementById('crEqTipo').value === 'freezer';
  for (const k of ['compartimentos', 'profundidade']) { const el = document.getElementById('crL' + k); if (!el) continue; el.closest('.field').hidden = !freezer; if (!freezer) el.value = 1; }
  const r = document.querySelector('label[for="crLracks"]'); if (r) r.textContent = freezer ? 'Racks por compartimento' : 'Racks';
}
function giraCryoDeleteEquipment(id) {
  const e = giraCryoIndex().get(id)?.n; if (!e) return;
  const n = giraCryoCount(e).ocup;
  openModal('Excluir equipamento', e.nome, `<p>O equipamento sai da sala e a exclusão entra no registro com o seu nome.</p>${n ? `<p><b>Há ${n} ${n === 1 ? 'vial guardado' : 'vials guardados'} nele.</b> Retire ou mova os vials antes de excluir.</p>` : '<p>Ele está vazio, então pode ser excluído.</p>'}<p id="crErro" role="alert"></p>`, () => {
    giraCryoMutate('crio_excluir_equipamento', { id }, 'crErro', () => { state.cryoPath = []; });
  }, 'Excluir');
  document.getElementById('modalConfirm')?.classList.add('danger-soft');
}

// ── Registro do equipamento (temperatura, nível de N₂, reabastecimento) ──
const giraCryoNum = n => n == null ? '' : String(n).replace('.', ',');
function giraCryoValorLeitura(l) { return [l.temperature != null ? giraCryoNum(l.temperature) + ' °C' : '', l.level != null ? giraCryoNum(l.level) + ' cm de N₂' : '', l.refilled ? 'reabastecido' : ''].filter(Boolean).join(' · '); }
function giraCryoQuando(dias) { return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias'; }
function giraCryoLeituraCurta(e) {
  const u = e.lastReading; if (!u) return e.readingOverdue ? 'sem leitura' : '';
  return giraCryoValorLeitura(u) + ' ' + giraCryoQuando(u.daysAgo) + (e.readingOverdue ? ' (atrasada)' : '');
}
function giraCryoRegistroHtml(e) {
  const u = e.lastReading, alerta = (u && u.outOfRange) || e.readingOverdue;
  const linha = u ? `<b>${escapeHtml(giraCryoValorLeitura(u))}</b><small>${escapeHtml(giraCryoQuando(u.daysAgo) + ' · ' + u.atLabel + ' · ' + u.by)}</small>` : '<b>Nenhuma leitura ainda</b><small>Registre a temperatura ou o nível de N₂ para acompanhar o equipamento.</small>';
  const aviso = u && u.outOfRange ? 'Última leitura fora do limite.' : e.readingOverdue ? `Leitura atrasada (combinado: a cada ${e.limits.readEveryDays} dia${e.limits.readEveryDays === 1 ? '' : 's'}).` : '';
  return `<div class="cr-ficha cr-registro${alerta ? ' is-alerta' : ''}"><div class="cr-registro-linha"><span>${linha}</span></div>${aviso ? `<p class="cr-registro-aviso" role="note">${escapeHtml(aviso)}</p>` : ''}
    <div class="cr-acoes"><button type="button" class="btn primary" data-action="giraCryoLeitura" data-arg="${escapeAttr(e.id)}">Registrar leitura</button><button type="button" class="btn soft" data-action="giraCryoRegistro" data-arg="${escapeAttr(e.id)}">Ver registro</button></div></div>`;
}
function giraCryoLeitura(id) {
  const e = giraCryoIndex().get(id)?.n; if (!e) return;
  closeDrawer();
  const tanque = e.tipo === 'tanque', l = e.limits || {};
  const campo = (k, rot, ph) => `<div class="field"><label for="${k}">${rot}</label><input id="${k}" type="text" inputmode="decimal" autocomplete="off" placeholder="${ph}"></div>`;
  openModal('Registrar leitura', e.nome, `<div class="gds-person-form"><div class="gds-form-pair">${tanque ? campo('crLeNivel', 'Nível de N₂ (cm)', 'ex.: 32') + campo('crLeTemp', 'Temperatura (°C, opcional)', 'ex.: -190')
      : campo('crLeTemp', 'Temperatura no visor (°C)', 'ex.: -80')}</div>
    ${tanque ? '<label class="gds-check"><input id="crLeReab" type="checkbox"> Reabasteci o botijão agora</label>' : ''}
    <div class="field full"><label for="crLeObs">Observação (opcional)</label><input id="crLeObs" type="text" maxlength="500" placeholder="${tanque ? 'ex.: nível depois de reabastecer' : 'ex.: alarme tocou, porta aberta por 2 min'}"></div>
    ${l.maxTemperature != null || l.minLevel != null ? `<p class="gds-muted">Limite: ${escapeHtml(tanque ? 'nível mínimo de ' + giraCryoNum(l.minLevel) + ' cm' : 'até ' + giraCryoNum(l.maxTemperature) + ' °C')}. Fora dele, a leitura fica marcada em vermelho.</p>` : ''}
    <p id="crErro" role="alert"></p></div>`, () => {
    const v = k => { const x = document.getElementById(k); return x ? x.value.trim() : ''; };
    giraCryoMutate('crio_registrar_leitura', { equipmentId: e.id, temperature: v('crLeTemp'), level: v('crLeNivel'), refilled: !!document.getElementById('crLeReab')?.checked, note: v('crLeObs') }, 'crErro');
  }, 'Registrar');
}
// Gráfico simples das últimas leituras (temperatura no ultrafreezer, nível no botijão), com a linha do limite.
function giraCryoGrafico(d) {
  const tanque = d.tipo === 'tanque', campo = tanque ? 'level' : 'temperature', lim = tanque ? d.limits.minLevel : d.limits.maxTemperature;
  const pts = d.readings.filter(x => x[campo] != null).slice(0, 60).reverse();
  if (pts.length < 2) return '';
  const vals = pts.map(x => x[campo]).concat(lim != null ? [lim] : []), min = Math.min(...vals), max = Math.max(...vals), amp = max - min || 1, W = 320, H = 96, P = 6;
  const X = i => P + i * (W - 2 * P) / (pts.length - 1), Y = v => H - P - (v - min) * (H - 2 * P) / amp;
  const linha = pts.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x[campo]).toFixed(1)).join(' ');
  return `<figure class="cr-grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeAttr((tanque ? 'Nível de N₂' : 'Temperatura') + ' nas últimas ' + pts.length + ' leituras, de ' + giraCryoNum(min) + ' a ' + giraCryoNum(max))}">
    ${lim != null ? `<line x1="${P}" x2="${W - P}" y1="${Y(lim).toFixed(1)}" y2="${Y(lim).toFixed(1)}" class="cr-grafico-limite"/>` : ''}<path d="${linha}" class="cr-grafico-linha"/>
    ${pts.map((x, i) => x.outOfRange ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(x[campo]).toFixed(1)}" r="3" class="cr-grafico-fora"/>` : '').join('')}</svg>
    <figcaption>${tanque ? 'Nível de N₂ (cm)' : 'Temperatura (°C)'}${lim != null ? ' · linha tracejada: limite' : ''}</figcaption></figure>`;
}
function giraCryoRegistro(id) {
  const e = giraCryoIndex().get(id)?.n; if (!e) return;
  CrioAPI.leituras(id).then(rows => {
    const d = { id: e.id, nome: e.nome, tipo: e.tipo, limits: e.limits, readings: rows.map(x => ({ temperature: x.temperatura, level: x.nivel, refilled: x.reabastecido, note: x.nota, outOfRange: x.fora, by: x.por_nome, atLabel: dataHora(x.em) })) };
    const linhas = d.readings.map(x => `<li class="${x.outOfRange ? 'is-fora' : ''}"><strong>${escapeHtml(giraCryoValorLeitura(x))}${x.outOfRange ? ' · fora do limite' : ''}</strong>${x.note ? `<small>${escapeHtml(x.note)}</small>` : ''}<small>${escapeHtml(x.by)} · ${escapeHtml(x.atLabel)}</small></li>`).join('');
    openDetailDrawer('Registro: ' + d.nome, d.readings.length ? `${d.readings.length} leitura${d.readings.length === 1 ? '' : 's'} recente${d.readings.length === 1 ? '' : 's'}` : 'Sem leituras',
      `${giraCryoGrafico(d)}<ol class="cr-historico">${linhas || '<li>Nenhuma leitura registrada.</li>'}</ol>`,
      `<button type="button" class="btn primary" data-action="giraCryoLeitura" data-arg="${escapeAttr(d.id)}">Registrar leitura</button>`);
  }).catch(x => toast(x.message || String(x), true));
}

// ───────────── Excel ─────────────
function crioLocal(e, caixa) {
  let m = /^c(\d+)\/r(\d+)\/k(\d+)$/.exec(caixa || ''); if (m) return `Compartimento ${m[1]} › Rack ${m[1]}.${m[2]} › Caixa ${m[3]}`;
  m = /^r(\d+)\/k(\d+)$/.exec(caixa || ''); return m ? `Rack ${m[1]} › Caixa ${m[2]}` : caixa;
}
async function crioExportar() {
  if (!window.XLSX) return toast('Não foi possível carregar o gerador de Excel. Atualize a página.', true);
  toast('Gerando a planilha…');
  try {
    const d = await CrioAPI.exportar(), porId = new Map(d.equipamentos.map(e => [e.id, e])), D = s => s ? new Date(s) : null, Dd = s => s ? new Date(s + 'T12:00:00') : null;
    const ativos = new Map(); for (const v of d.vials) if (!v.retirado_em) ativos.set(v.equipamento_id, (ativos.get(v.equipamento_id) || 0) + 1);
    const equip = d.equipamentos.map(e => { const L = e.layout, cans = e.tipo === 'tanque' ? giraCryoCanisters(e) : null, cx = cans ? cans.reduce((a, c) => a + c.caixas, 0) : L.compartimentos * L.racks * L.niveis * L.profundidade, tot = cx * L.linhas * L.colunas, oc = ativos.get(e.id) || 0;
      return { 'Equipamento': e.nome, 'Tipo': e.tipo === 'freezer' ? 'Ultrafreezer' : 'Botijão de N₂', 'Modelo': e.modelo, 'Temperatura': e.temperatura,
        'Estrutura': e.tipo === 'freezer' ? `${L.compartimentos} compartimentos × ${L.racks} racks × ${L.niveis * L.profundidade} caixas` : `${L.racks} canisters (caixas: ${cans.map(c => c.caixas).join(', ')})`,
        'Caixas': cx, 'Grade da caixa': `${L.linhas}×${L.colunas}`, 'Vials guardados': oc, 'Posições livres': tot - oc, 'Ocupação (%)': tot ? Math.round(1000 * oc / tot) / 10 : 0,
        'Situação': e.excluido_em ? 'Excluído' : 'Ativo', 'Adicionado por': e.criado_por, 'E-mail (adição)': e.criado_email, 'Adicionado em': D(e.criado_em),
        'Excluído por': e.excluido_por || '', 'E-mail (exclusão)': e.excluido_email || '', 'Excluído em': D(e.excluido_em) }; });
    const vials = d.vials.map(v => { const e = porId.get(v.equipamento_id) || {};
      return { 'Código': v.codigo, 'Situação': v.retirado_em ? 'Retirado' : 'Guardado', 'Equipamento': e.nome || '', 'Local': crioLocal(e, v.caixa), 'Posição': LETRAS[v.linha - 1] + v.coluna,
        'Amostra': v.amostra, 'Categoria': v.categoria, 'Detalhe': v.detalhe, 'Meio': v.meio, 'Congelado em': Dd(v.congelado_em), 'Projeto': v.projeto, 'Observação': v.observacao,
        'Guardado por': v.guardado_por, 'E-mail (guardou)': v.guardado_email, 'Guardado em': D(v.guardado_em),
        'Retirado por': v.retirado_por || '', 'E-mail (retirou)': v.retirado_email || '', 'Retirado em': D(v.retirado_em), 'Motivo': v.motivo || '', 'Obs. da retirada': v.obs_retirada || '' }; });
    const registro = d.registro.map(r => ({ 'Data e hora': D(r.em), 'Usuário': r.usuario, 'E-mail': r.email, 'Ação': r.acao, 'Equipamento': r.equipamento, 'Local': r.local,
      'Amostra': r.amostra, 'Código do vial': r.vial_codigo ?? '', 'Detalhe': r.detalhe }));
    const leituras = d.leituras.map(l => ({ 'Data e hora': D(l.em), 'Equipamento': (porId.get(l.equipamento_id) || {}).nome || '', 'Temperatura (°C)': l.temperatura ?? '', 'Nível de N₂ (cm)': l.nivel ?? '',
      'Reabastecido': l.reabastecido ? 'Sim' : 'Não', 'Fora do limite': l.fora ? 'Sim' : 'Não', 'Observação': l.nota, 'Registrado por': l.por_nome, 'E-mail': l.por_email }));
    const wb = XLSX.utils.book_new();
    const aba = (linhas, nome, cab) => {
      const ws = XLSX.utils.json_to_sheet(linhas.length ? linhas : [Object.fromEntries(cab.map(c => [c, '']))], { cellDates: true, dateNF: 'dd/mm/yyyy hh:mm' });
      const cols = Object.keys(linhas[0] || Object.fromEntries(cab.map(c => [c, ''])));
      ws['!cols'] = cols.map(c => ({ wch: Math.min(48, Math.max(c.length + 2, ...linhas.slice(0, 500).map(r => r[c] instanceof Date ? 16 : String(r[c] ?? '').length + 1))) }));
      ws['!autofilter'] = { ref: ws['!ref'] };
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    aba(registro, 'Registro', ['Data e hora', 'Usuário', 'E-mail', 'Ação', 'Equipamento', 'Local', 'Amostra', 'Código do vial', 'Detalhe']);
    aba(equip, 'Equipamentos', ['Equipamento']);
    aba(vials, 'Vials', ['Código']);
    aba(leituras, 'Leituras', ['Data e hora']);
    XLSX.writeFile(wb, `criogenia-ISI-SAS-${new Date().toISOString().slice(0, 10)}.xlsx`, { compression: true });
  } catch (e) { toast('Não foi possível exportar: ' + (e.message || e), true); }
}

// ───────────── login e início ─────────────
const LOGO = `<span class="marca"><span class="marca-logo"><img class="logo" src="assets/logo-senai-cimatec.png" alt="SENAI CIMATEC" width="320" height="100"></span><span class="marca-isi"><small>Instituto SENAI de Inovação</small><b>Sistemas Avançados de Saúde</b><small>ISI-SAS</small></span></span>`;
const RODAPE = `<footer class="rodape"><div class="convite"><div><b>Gostou? Então venha conhecer o GIRA</b><span>Gestão Integrada de Rotinas Acadêmicas: atividades, projetos, calendário, estoque e criogenia do grupo num só lugar.</span></div><a class="btn primary" href="https://gira-gipac.pages.dev" target="_blank" rel="noopener">Conhecer o GIRA →</a></div>
  <p class="credito">Criado por <b>Sergio Santos Silva Junior</b> · <a href="https://instagram.com/soueushaka" target="_blank" rel="noopener">Instagram @soueushaka</a> · <a href="https://wa.me/5571993550267" target="_blank" rel="noopener">(71) 99355-0267</a> · <a href="mailto:jsilva.ss546@gmail.com">jsilva.ss546@gmail.com</a></p></footer>`;
const G_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const MS_ICON = '<svg viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>';
function topo(u) {
  const ini = (u && u.nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  return `<header class="topo">${LOGO}<span class="espaco"></span>${u ? `<div class="usuario"><span class="avatar" aria-hidden="true">${escapeHtml(ini)}</span><span><b>${escapeHtml(u.nome)}</b><small>${escapeHtml(u.email || '')}</small></span><button type="button" class="btn" data-action="crioSair">Sair</button></div>` : ''}</header>`
    + (CrioAPI.modo === 'demo' ? `<div class="faixa-demo"><b>Modo demonstração:</b> os dados ficam só neste navegador e o login é simulado. Para usar com a equipe, preencha o <code>config.js</code> com o projeto do Supabase (veja o README).${u ? ' <button type="button" class="btn" style="min-height:28px;margin-left:8px" data-action="crioReiniciarDemo">Restaurar dados de exemplo</button>' : ''}</div>` : '');
}
function crioSair() { CrioAPI.sair(); }
function crioReiniciarDemo() { if (confirm('Apagar os dados de demonstração deste navegador e voltar ao exemplo?')) { CrioAPI.reiniciar(); state.cryoPath = []; state.cryoBox = null; giraLoadCryo(); } }
function telaEntrada(msg) {
  const app = document.getElementById('app');
  const demo = CrioAPI.modo === 'demo';
  app.innerHTML = topo(null) + `<div class="entrada"><div class="entrada-cartao">${LOGO}<div><h1>Criogenia</h1><p>Ultrafreezers e botijões de nitrogênio líquido do ISI-SAS. Entre com sua conta para registrar o que você guarda, retira ou altera.</p></div>
    ${demo ? `<div class="field"><label for="demoNome">Seu nome</label><input id="demoNome" autocomplete="name" placeholder="Ex.: Ana Souza"></div><div class="field"><label for="demoEmail">E-mail</label><input id="demoEmail" type="email" autocomplete="email" placeholder="ana@exemplo.com"></div>
      <button type="button" class="btn primary" data-action="crioEntrarDemo">Entrar (demonstração)</button><p class="gds-muted" style="font-size:13px">No site publicado, aqui aparecem os botões "Entrar com Google" e "Entrar com Microsoft".</p>`
    : `<button type="button" class="btn" data-action="crioEntrar" data-arg="google">${G_ICON}Entrar com Google</button><button type="button" class="btn" data-action="crioEntrar" data-arg="azure">${MS_ICON}Entrar com Microsoft</button>`}
    ${msg ? `<p class="entrada-erro" role="alert">${escapeHtml(msg)}</p>` : ''}</div></div>` + RODAPE;
}
function crioEntrar(p) { CrioAPI.entrar(p).catch(e => telaEntrada(e.message || String(e))); }
function crioEntrarDemo() {
  const nome = document.getElementById('demoNome').value.trim(), email = document.getElementById('demoEmail').value.trim();
  if (!nome) return telaEntrada('Informe seu nome.');
  CrioAPI.entrarDemo(nome, email).then(abrir);
}
function abrir(u) {
  state.eu = u;
  const app = document.getElementById('app');
  if (!u.pode) {
    app.innerHTML = topo(u) + `<div class="entrada"><div class="entrada-cartao"><h1>Acesso não liberado</h1><p>A conta <b>${escapeHtml(u.email)}</b> ainda não tem acesso à criogenia. Peça a liberação ao responsável pelo laboratório, ou entre com outra conta.</p><button type="button" class="btn" data-action="crioSair">Sair e trocar de conta</button></div></div>` + RODAPE;
    return;
  }
  app.innerHTML = topo(u) + `<main>${giraCryoHtml()}</main>` + RODAPE;
  giraLoadCryo();
}
(function tema() {
  const m = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  const aplica = () => document.documentElement.dataset.theme = m && m.matches ? 'dark' : 'light';
  aplica(); if (m && m.addEventListener) m.addEventListener('change', () => { aplica(); });
})();
CrioAPI.iniciar().then(u => u ? abrir(u) : telaEntrada()).catch(e => telaEntrada(e.message || String(e)));
