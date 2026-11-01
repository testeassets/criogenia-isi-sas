/* Camada de dados. Dois modos com a mesma interface:
   - Supabase (config.js preenchido): login Google/Microsoft; alterações pelas funções crio_* do banco (supabase/schema.sql),
     que gravam quem fez a partir do token do login.
   - Demonstração (config.js vazio): tudo no navegador (localStorage), para ver o site funcionando sem servidor.
   Formato das linhas igual ao das tabelas do banco (snake_case). */
const CrioAPI = (() => {
  const cfg = window.CRIO_CONFIG || {};
  const modo = cfg.supabaseUrl && cfg.supabaseAnonKey ? 'supabase' : 'demo';
  let sb = null;

  // ───────────── Supabase ─────────────
  async function pagina(tabela, filtro) {
    const out = [];
    for (let de = 0; ; de += 1000) {
      let q = sb.from(tabela).select('*');
      if (filtro) q = filtro(q);
      const { data, error } = await q.range(de, de + 999);
      if (error) throw new Error(error.message);
      out.push(...data);
      if (data.length < 1000) return out;
    }
  }
  const supa = {
    async iniciar() {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } });
      const { data } = await sb.auth.getSession();
      sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.reload(); });
      if (!data.session) return null;
      const { data: eu, error } = await sb.rpc('crio_eu');
      if (error) throw new Error(error.message);
      return { ...eu, provedor: data.session.user.app_metadata?.provider || '' };
    },
    async entrar(provedor) {
      const opcoes = { redirectTo: location.origin + location.pathname };
      if (provedor === 'azure') opcoes.scopes = 'email openid profile';
      const { error } = await sb.auth.signInWithOAuth({ provider: provedor, options: opcoes });
      if (error) throw new Error(error.message);
    },
    async sair() { await sb.auth.signOut(); location.reload(); },
    async carregar() {
      const [equipamentos, vials, leituras] = await Promise.all([
        pagina('crio_equipamentos', q => q.is('excluido_em', null).order('ordem')),
        pagina('crio_vials', q => q.is('retirado_em', null).order('codigo')),
        pagina('crio_leituras', q => q.order('em', { ascending: false }).limit(1000)),
      ]);
      return { equipamentos, vials, leituras };
    },
    async acao(nome, p) {
      const { data, error } = await sb.rpc(nome, { p });
      if (error) throw new Error(error.message);
      return data;
    },
    async registro(filtro = {}) {
      return pagina('crio_registro', q => { if (filtro.vialId) q = q.eq('vial_id', filtro.vialId); return q.order('em', { ascending: false }).order('id', { ascending: false }); });
    },
    async leituras(eqId) {
      const { data, error } = await sb.from('crio_leituras').select('*').eq('equipamento_id', eqId).order('em', { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return data;
    },
    async exportar() {
      const [equipamentos, vials, leituras, registro] = await Promise.all([
        pagina('crio_equipamentos', q => q.order('ordem')), pagina('crio_vials', q => q.order('codigo')),
        pagina('crio_leituras', q => q.order('em', { ascending: false })), this.registro()]);
      return { equipamentos, vials, leituras, registro };
    },
  };

  // ───────────── Demonstração (navegador) ─────────────
  const CHAVE = 'crio-isi-sas-demo-v1', CHAVE_USU = 'crio-isi-sas-demo-usuario';
  const ler = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento: fica só na memória */ } };
  let db = null, eu = null;
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16));
  const agora = () => new Date().toISOString();
  const LET = 'ABCDEFGHIJKL', pos = (l, c) => LET[l - 1] + c;
  const erro = m => { throw new Error(m); };
  const txt = (p, k, max = 200) => { const v = String(p[k] ?? '').trim(); if (v.length > max) erro(`Campo ${k} muito longo (máximo ${max} caracteres).`); return v; };
  const num = (p, k) => { const v = String((p || {})[k] ?? '').trim().replace(',', '.'); if (!v) return null; if (!/^-?\d+(\.\d+)?$/.test(v)) erro(`Valor numérico inválido: ${v}`); return Number(v); };

  function semente() {
    const d = { equipamentos: [], vials: [], leituras: [], registro: [], seq: 1, regSeq: 1 };
    const sis = { nome: 'Sistema (dados de exemplo)', email: '' }, t0 = new Date(Date.now() - 3 * 864e5).toISOString();
    const fz = { id: uuid(), tipo: 'freezer', nome: 'Ultrafreezer', modelo: 'ColdLab CL374-86V', temperatura: '−80 °C', layout: { compartimentos: 4, racks: 4, niveis: 4, profundidade: 3, linhas: 9, colunas: 9 },
      limite_temperatura: -70, limite_nivel: null, leitura_dias: 7, ordem: 1, criado_em: t0, criado_por: sis.nome, criado_email: '', excluido_em: null };
    const tq = { id: uuid(), tipo: 'tanque', nome: 'Botijão de N₂', modelo: 'Sempercrio SC-47', temperatura: '−196 °C', layout: { compartimentos: 1, racks: 6, niveis: 5, profundidade: 1, linhas: 5, colunas: 5 },
      limite_temperatura: null, limite_nivel: 20, leitura_dias: 7, ordem: 2, criado_em: t0, criado_por: sis.nome, criado_email: '', excluido_em: null };
    d.equipamentos.push(fz, tq);
    const v = (e, caixa, l, c, amostra, categoria, detalhe, meio, cong) => d.vials.push({ id: uuid(), codigo: d.seq++, equipamento_id: e.id, caixa, linha: l, coluna: c, amostra, categoria, detalhe, meio,
      congelado_em: cong, projeto: '', observacao: '', guardado_em: t0, guardado_por: sis.nome, guardado_email: '', retirado_em: null });
    for (let c = 1; c <= 6; c++) v(fz, 'c1/r1/k1', 1, c, 'HEK293T', 'Células', 'P12', 'SFB + 10% DMSO', '2026-09-12');
    for (let c = 1; c <= 4; c++) v(fz, 'c1/r1/k1', 2, c, 'HeLa', 'Células', 'P8', 'SFB + 10% DMSO', '2026-09-20');
    for (let c = 1; c <= 9; c++) v(fz, 'c1/r2/k4', 1, c, 'E. coli BL21(DE3)', 'Bactérias', 'glicerol 25%', 'LB + glicerol', '2026-08-30');
    for (let c = 1; c <= 5; c++) v(fz, 'c2/r1/k1', 3, c, 'pET-28a', 'Plasmídeos', 'miniprep', '', '2026-07-15');
    for (let c = 1; c <= 5; c++) v(tq, 'r1/k1', 1, c, 'iPSC linhagem A', 'Células', 'P20', 'CryoStor CS10', '2026-06-02');
    for (let c = 1; c <= 3; c++) v(tq, 'r3/k2', 2, c, 'MSC doador 4', 'Células', 'P4', 'CryoStor CS10', '2026-05-18');
    d.leituras.push({ id: uuid(), equipamento_id: fz.id, temperatura: -79.5, nivel: null, reabastecido: false, nota: '', fora: false, em: t0, por_nome: sis.nome, por_email: '' });
    d.leituras.push({ id: uuid(), equipamento_id: tq.id, temperatura: null, nivel: 34, reabastecido: true, nota: '', fora: false, em: t0, por_nome: sis.nome, por_email: '' });
    d.registro.push({ id: d.regSeq++, em: t0, usuario: sis.nome, email: '', acao: 'Equipamento adicionado', equipamento_id: fz.id, equipamento: fz.nome, local: '', vial_id: null, vial_codigo: null, amostra: '', detalhe: 'dados de exemplo' });
    d.registro.push({ id: d.regSeq++, em: t0, usuario: sis.nome, email: '', acao: 'Equipamento adicionado', equipamento_id: tq.id, equipamento: tq.nome, local: '', vial_id: null, vial_codigo: null, amostra: '', detalhe: 'dados de exemplo' });
    return d;
  }
  const salvar = () => gravar(CHAVE, db);
  const equip = id => db.equipamentos.find(e => e.id === id && !e.excluido_em) || erro('Equipamento não encontrado. Atualize a página.');
  const vialAtivo = id => db.vials.find(v => v.id === id && !v.retirado_em) || erro('Vial não encontrado ou já retirado. Atualize a página.');
  function caixaLocal(e, caixa) {
    const L = e.layout;
    if (e.tipo === 'freezer') {
      const m = /^c(\d+)\/r(\d+)\/k(\d+)$/.exec(caixa || '');
      if (!m || +m[1] < 1 || +m[1] > L.compartimentos || +m[2] < 1 || +m[2] > L.racks || +m[3] < 1 || +m[3] > L.niveis * L.profundidade) erro('Caixa inválida neste equipamento.');
      return `Compartimento ${m[1]} › Rack ${m[1]}.${m[2]} › Caixa ${m[3]}`;
    }
    const m = /^r(\d+)\/k(\d+)$/.exec(caixa || '');
    if (!m || +m[1] < 1 || +m[1] > L.racks || +m[2] < 1 || +m[2] > L.niveis) erro('Caixa inválida neste equipamento.');
    return `Rack ${m[1]} › Caixa ${m[2]}`;
  }
  const ocupada = (eid, caixa, l, c, exceto) => db.vials.some(v => !v.retirado_em && v.id !== exceto && v.equipamento_id === eid && v.caixa === caixa && v.linha === l && v.coluna === c);
  const reg = (acao, e, local, v, detalhe) => db.registro.push({ id: db.regSeq++, em: agora(), usuario: eu.nome, email: eu.email, acao, equipamento_id: e ? e.id : null,
    equipamento: e ? e.nome : '', local: local || '', vial_id: v ? v.id : null, vial_codigo: v ? v.codigo : null, amostra: v ? v.amostra : '', detalhe: detalhe || '' });
  const dataBr = d => d ? d.split('-').reverse().join('/') : '—';
  const inteiro = (x, d) => { const n = Number(x ?? d); return Number.isInteger(n) ? n : 0; };

  const acoesDemo = {
    crio_salvar_equipamento(p) {
      const nome = txt(p, 'nome', 120);if (!nome) erro('Informe o nome do equipamento.');
      const lim = p.limits || {};
      if (!p.id) {
        const tipo = p.tipo;if (!['freezer', 'tanque'].includes(tipo)) erro('Tipo de equipamento inválido.');
        const l = p.layout || {}, fz = tipo === 'freezer';
        const L = { compartimentos: fz ? inteiro(l.compartimentos) : 1, racks: inteiro(l.racks), niveis: inteiro(l.niveis), profundidade: fz ? inteiro(l.profundidade) : 1, linhas: inteiro(l.linhas), colunas: inteiro(l.colunas) };
        if ([L.compartimentos, L.racks, L.niveis, L.profundidade].some(n => n < 1 || n > 30)) erro('Estrutura inválida: use números de 1 a 30.');
        if ([L.linhas, L.colunas].some(n => n < 1 || n > 12)) erro('A caixa deve ter de 1 a 12 linhas e colunas.');
        const nc = L.compartimentos * L.racks * L.niveis * L.profundidade;if (nc > 1000) erro('Estrutura grande demais (máximo de 1000 caixas por equipamento).');
        const e = { id: uuid(), tipo, nome, modelo: txt(p, 'modelo', 120), temperatura: txt(p, 'temperatura', 40), layout: L, limite_temperatura: num(lim, 'maxTemperature'),
          limite_nivel: num(lim, 'minLevel'), leitura_dias: num(lim, 'readEveryDays'), ordem: Date.now(), criado_em: agora(), criado_por: eu.nome, criado_email: eu.email, excluido_em: null };
        db.equipamentos.push(e);
        reg('Equipamento adicionado', e, '', null, [e.modelo, e.temperatura, fz ? `${L.compartimentos} compartimentos × ${L.racks} racks` : `${L.racks} racks`, `${nc} caixas ${L.linhas}×${L.colunas}`].filter(Boolean).join(' · '));
        return e.id;
      }
      const e = equip(p.id), mud = [];
      for (const [k, rot, max] of [['nome', 'nome', 120], ['modelo', 'modelo', 120], ['temperatura', 'temperatura', 40]]) { const n = txt(p, k, max); if (e[k] !== n) { mud.push(`${rot}: ${e[k]} → ${n}`); e[k] = n; } }
      e.limite_temperatura = num(lim, 'maxTemperature'); e.limite_nivel = num(lim, 'minLevel'); e.leitura_dias = num(lim, 'readEveryDays');
      reg('Equipamento editado', e, '', null, mud.join('; ') || 'limites de alerta');
      return e.id;
    },
    crio_excluir_equipamento(p) {
      const e = equip(p.id), n = db.vials.filter(v => v.equipamento_id === e.id && !v.retirado_em).length;
      if (n) erro(`Ainda há ${n} vial(s) guardado(s) neste equipamento. Retire ou mova os vials antes de excluir.`);
      Object.assign(e, { excluido_em: agora(), excluido_por: eu.nome, excluido_email: eu.email });
      reg('Equipamento excluído', e, '', null, [e.modelo, e.temperatura].filter(Boolean).join(' · '));
    },
    crio_guardar_vials(p) {
      const e = equip(p.equipamentoId), loc = caixaLocal(e, p.caixa), amostra = txt(p, 'amostra');
      if (!amostra) erro('Informe o nome da amostra.');
      const ps = p.posicoes || [];if (!ps.length) erro('Escolha ao menos uma posição.');
      for (const { linha, coluna } of ps) { if (linha < 1 || linha > e.layout.linhas || coluna < 1 || coluna > e.layout.colunas) erro('Posição fora da caixa.'); if (ocupada(e.id, p.caixa, linha, coluna)) erro(`A posição ${pos(linha, coluna)} já está ocupada. Atualize a página.`); }
      for (const { linha, coluna } of ps) {
        const v = { id: uuid(), codigo: db.seq++, equipamento_id: e.id, caixa: p.caixa, linha, coluna, amostra, categoria: txt(p, 'categoria', 40), detalhe: txt(p, 'detalhe'), meio: txt(p, 'meio', 120),
          congelado_em: p.congeladoEm || null, projeto: txt(p, 'projeto'), observacao: txt(p, 'observacao', 1000), guardado_em: agora(), guardado_por: eu.nome, guardado_email: eu.email, retirado_em: null };
        db.vials.push(v);
        reg('Vial guardado', e, loc + ' › ' + pos(linha, coluna), v, [v.detalhe, v.categoria].filter(Boolean).join(' · '));
      }
      return ps.length;
    },
    crio_editar_vial(p) {
      const v = vialAtivo(p.id), e = equip(v.equipamento_id), mud = [];
      if (!txt(p, 'amostra')) erro('Informe o nome da amostra.');
      for (const [k, kp, rot, max] of [['amostra', 'amostra', 'amostra', 200], ['categoria', 'categoria', 'categoria', 40], ['detalhe', 'detalhe', 'detalhe', 200], ['meio', 'meio', 'meio', 120], ['projeto', 'projeto', 'projeto', 200]]) {
        const n = txt(p, kp, max); if (v[k] !== n) { mud.push(`${rot}: ${v[k]} → ${n}`); v[k] = n; } }
      const cg = p.congeladoEm || null; if (cg !== v.congelado_em) { mud.push(`congelado em: ${dataBr(v.congelado_em)} → ${dataBr(cg)}`); v.congelado_em = cg; }
      const ob = txt(p, 'observacao', 1000); if (ob !== v.observacao) { mud.push('observação alterada'); v.observacao = ob; }
      reg('Vial editado', e, caixaLocal(e, v.caixa) + ' › ' + pos(v.linha, v.coluna), v, mud.join('; ') || 'sem mudanças');
    },
    crio_retirar_vial(p) {
      if (!['Uso', 'Descarte', 'Transferência', 'Perda'].includes(p.motivo)) erro('Motivo de retirada inválido.');
      const v = vialAtivo(p.id), e = equip(v.equipamento_id), ob = txt(p, 'observacao', 500);
      Object.assign(v, { retirado_em: agora(), retirado_por: eu.nome, retirado_email: eu.email, motivo: p.motivo, obs_retirada: ob });
      reg('Vial retirado', e, caixaLocal(e, v.caixa) + ' › ' + pos(v.linha, v.coluna), v, [p.motivo, ob].filter(Boolean).join(' · '));
    },
    crio_mover_vial(p) {
      const v = vialAtivo(p.id), e = equip(v.equipamento_id), d = equip(p.equipamentoId), para = caixaLocal(d, p.caixa), l = Number(p.linha), c = Number(p.coluna);
      if (l < 1 || l > d.layout.linhas || c < 1 || c > d.layout.colunas) erro(`Posição ${pos(l, c)} não existe nessa caixa.`);
      if (ocupada(d.id, p.caixa, l, c, v.id)) erro(`A posição ${pos(l, c)} já está ocupada.`);
      const de = `${e.nome} › ${caixaLocal(e, v.caixa)} › ${pos(v.linha, v.coluna)}`;
      Object.assign(v, { equipamento_id: d.id, caixa: p.caixa, linha: l, coluna: c });
      reg('Vial movido', d, para + ' › ' + pos(l, c), v, 'de ' + de);
    },
    crio_registrar_leitura(p) {
      const e = equip(p.equipmentId), t = num(p, 'temperature'), n = num(p, 'level'), reab = !!p.refilled, nota = txt(p, 'note', 500);
      if (t == null && n == null && !reab) erro('Informe a temperatura ou o nível de N₂.');
      const fora = (e.tipo === 'freezer' && t != null && e.limite_temperatura != null && t > e.limite_temperatura) || (e.tipo === 'tanque' && n != null && e.limite_nivel != null && n < e.limite_nivel);
      db.leituras.unshift({ id: uuid(), equipamento_id: e.id, temperatura: t, nivel: n, reabastecido: reab, nota, fora, em: agora(), por_nome: eu.nome, por_email: eu.email });
      reg('Leitura registrada', e, '', null, [t != null ? String(t).replace('.', ',') + ' °C' : '', n != null ? String(n).replace('.', ',') + ' cm de N₂' : '', reab ? 'reabastecido' : '', fora ? 'FORA DO LIMITE' : '', nota].filter(Boolean).join(' · '));
    },
  };
  const clone = x => JSON.parse(JSON.stringify(x));
  const demo = {
    async iniciar() { db = ler(CHAVE, null) || semente(); salvar(); eu = ler(CHAVE_USU, null); return eu ? { ...eu, pode: true, provedor: 'demo' } : null; },
    async entrarDemo(nome, email) { eu = { nome, email }; gravar(CHAVE_USU, eu); return { ...eu, pode: true, provedor: 'demo' }; },
    async sair() { try { localStorage.removeItem(CHAVE_USU); } catch { /* nada */ } location.reload(); },
    async carregar() { return clone({ equipamentos: db.equipamentos.filter(e => !e.excluido_em).sort((a, b) => a.ordem - b.ordem), vials: db.vials.filter(v => !v.retirado_em), leituras: db.leituras }); },
    async acao(nome, p) {
      const antes = JSON.stringify(db);
      try { const r = acoesDemo[nome](clone(p)); salvar(); return r; } catch (e) { db = JSON.parse(antes); throw e; }
    },
    async registro(f = {}) { return clone(db.registro.filter(r => !f.vialId || r.vial_id === f.vialId).sort((a, b) => b.id - a.id)); },
    async leituras(eqId) { return clone(db.leituras.filter(l => l.equipamento_id === eqId)); },
    async exportar() { return clone({ equipamentos: db.equipamentos, vials: db.vials, leituras: db.leituras, registro: db.registro.slice().sort((a, b) => b.id - a.id) }); },
    reiniciar() { db = semente(); salvar(); },
  };

  const impl = modo === 'supabase' ? supa : demo;
  return { modo, ...impl };
})();
