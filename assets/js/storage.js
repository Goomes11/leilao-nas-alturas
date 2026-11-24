/* ==========================================================================
   storage.js — Persistência local da DEMONSTRAÇÃO
   ATENÇÃO: localStorage NÃO é banco de dados. Não oferece autenticação,
   autorização, transações nem concorrência confiável e pode ser alterado
   por qualquer pessoa com acesso ao navegador. Não guarde dados reais.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};
  const cfg = () => LNA.config;

  let memoryFallback = null; // usado se o navegador bloquear localStorage
  let available = true;

  function hasStorage() {
    try { const k = '__lna_probe__'; root.localStorage.setItem(k, '1'); root.localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  }

  /* ---------------- Validação estrutural ---------------- */
  const isStr = v => typeof v === 'string';
  const isInt = v => Number.isInteger(v);
  const isBool = v => typeof v === 'boolean';

  function validateState(s) {
    const problems = [];
    if (!s || typeof s !== 'object' || Array.isArray(s)) return ['Conteúdo não é um objeto de dados.'];
    if (!isInt(s.schemaVersion)) problems.push('Versão do schema ausente.');
    ['participants', 'points', 'rewards', 'bids', 'awards', 'homologations', 'audit'].forEach(k => { if (!Array.isArray(s[k])) problems.push(`Lista "${k}" ausente ou inválida.`); });
    if (!s.rounds || typeof s.rounds !== 'object') problems.push('Situação das rodadas ausente.');
    if (!s.settings || typeof s.settings !== 'object') problems.push('Configurações ausentes.');
    if (!isInt(s.currentRoundId) || !cfg().calendar.rounds.some(r => r.id === s.currentRoundId)) problems.push('Rodada atual inválida.');
    if (problems.length) return problems;

    const ids = new Set();
    s.participants.forEach((p, i) => {
      if (!isStr(p.id) || !isStr(p.email) || !isStr(p.name) || !isBool(p.active) || !isStr(p.location)) problems.push(`Participante #${i + 1} com campos inválidos.`);
      if (ids.has(p.id)) problems.push(`Identificador de participante repetido: ${p.id}.`); ids.add(p.id);
    });
    s.points.forEach((x, i) => {
      if (!isStr(x.participantId) || !isStr(x.month) || typeof x.achievement !== 'number' || !isInt(x.points) || x.points < 0) problems.push(`Pontuação #${i + 1} inválida.`);
    });
    s.rewards.forEach((r, i) => {
      if (!isStr(r.id) || !isStr(r.name) || !isInt(r.minBid) || r.minBid <= 0 || !isInt(r.releaseRound) || !isBool(r.active)) problems.push(`Prêmio #${i + 1} inválido.`);
    });
    s.bids.forEach((b, i) => {
      if (!isStr(b.id) || !isInt(b.roundId) || !isStr(b.participantId) || !isStr(b.primaryRewardId) || !isInt(b.primaryPoints) || !isStr(b.createdAt) || !['ativo', 'substituido', 'cancelado'].includes(b.status)) problems.push(`Lance #${i + 1} inválido.`);
    });
    const activeKeys = new Set();
    s.bids.filter(b => b.status === 'ativo').forEach(b => { const k = b.participantId + '|' + b.roundId; if (activeKeys.has(k)) problems.push(`Mais de um lance ativo para ${b.participantId} na rodada ${b.roundId}.`); activeKeys.add(k); });
    s.awards.forEach((a, i) => { if (!isStr(a.participantId) || !isStr(a.rewardId) || !isInt(a.points)) problems.push(`Prêmio homologado #${i + 1} inválido.`); });
    return problems.slice(0, 20);
  }

  /* ---------------- Migrações ---------------- */
  /** Converte o formato do HTML original (Demo_Dois_Paineis.html, chave v1). */
  function migrateFromLegacy(old) {
    const fresh = LNA.mockData.create();
    const D = LNA.domain;
    const locMap = Object.fromEntries(cfg().locations.map(l => [l.label.toLowerCase(), l.id]));
    const idByEmail = {};
    const participants = (old.people || []).map((p, i) => {
      const id = 'P' + String(i + 1).padStart(3, '0');
      const email = String(p.email || '').toLowerCase();
      idByEmail[email] = id;
      return { id, name: String(p.nome || 'Participante'), email, location: locMap[String(p.site || '').toLowerCase()] || 'outro', active: p.ativo !== 'NAO', createdAt: fresh.meta.createdAt, updatedAt: fresh.meta.createdAt };
    });
    const points = (old.points || []).filter(x => idByEmail[String(x.email).toLowerCase()]).map(x => ({
      participantId: idByEmail[String(x.email).toLowerCase()], month: x.mes, achievement: Number(x.atingimento) || 0,
      points: D.calcPoints(Number(x.atingimento) || 0), type: 'migracao', updatedAt: fresh.meta.createdAt, updatedBy: 'migração v1'
    }));
    const rewards = (old.prizes || []).map((p, i) => ({
      id: 'R' + String(i + 1).padStart(2, '0'), legacyId: p.id, name: String(p.titulo), description: '', icon: cfg().rewardIcons[i % 10],
      minBid: Number(p.minimo) || 10, releaseRound: Number(p.abertura) || 1, active: p.ativo !== false, order: i + 1, createdAt: fresh.meta.createdAt, updatedAt: fresh.meta.createdAt
    }));
    const rid = legacy => (rewards.find(r => r.legacyId === legacy) || {}).id || null;
    let n = 0;
    const bids = (old.offers || []).filter(o => idByEmail[o.email] && rid(o.primary)).map(o => ({
      id: 'B' + String(++n).padStart(4, '0'), roundId: Number(o.round) || 1, participantId: idByEmail[o.email], primaryRewardId: rid(o.primary), primaryPoints: Number(o.points),
      secondRewardId: o.alternative ? rid(o.alternative) : null, secondPoints: o.alternative ? Number(o.alternativePoints) : null,
      createdAt: o.time || fresh.meta.createdAt, version: 1, status: o.status === 'ATIVO' ? 'ativo' : 'substituido', replacedAt: null, previousId: null
    }));
    const awards = (old.winners || []).filter(w => idByEmail[w.email] && rid(w.prize)).map((w, i) => ({
      id: 'W' + String(i + 1).padStart(3, '0'), roundId: Number(w.round) || 1, participantId: idByEmail[w.email], rewardId: rid(w.prize), points: Number(w.points),
      type: w.type === 'ALTERNATIVO' ? 'segunda_opcao' : 'principal', homologatedAt: w.timestamp || fresh.meta.createdAt, status: 'homologado', reason: 'Migrado do protótipo original.'
    }));
    const rounds = {};
    cfg().calendar.rounds.forEach(r => { rounds[r.id] = { status: r.id < old.round ? 'homologada' : r.id === Number(old.round) ? (old.status === 'FECHADA' ? 'homologada' : 'aberta') : 'futura', openedAt: null, homologatedAt: null }; });
    return {
      ...fresh, participants, points, rewards, bids, awards, rounds, currentRoundId: Number(old.round) || 1,
      settings: { ...fresh.settings, participantId: participants[0] ? participants[0].id : null },
      meta: { ...fresh.meta, migratedFrom: 'v1', seq: n + 1 },
      audit: [{ id: 'A0001', at: new Date().toISOString(), actor: 'sistema', role: 'sistema', action: 'migracao', entity: 'demonstracao', entityId: '-', before: 'schema v1', after: 'schema v2', justification: null, origin: 'storage.js', result: 'sucesso' }]
    };
  }

  const migrations = {
    // 2 -> 3 (exemplo para futuras versões): (s) => ({ ...s, schemaVersion: 3 })
  };
  function migrate(state) {
    let s = state;
    while (s.schemaVersion < cfg().storage.schemaVersion) {
      const fn = migrations[s.schemaVersion];
      if (!fn) throw new Error(`Não existe migração a partir da versão ${s.schemaVersion}.`);
      s = fn(s);
    }
    return s;
  }

  /* ---------------- API ---------------- */
  function readRaw() {
    if (!available) return memoryFallback;
    return root.localStorage.getItem(cfg().storage.key);
  }

  /** Retorna { status: 'ok'|'novo'|'migrado'|'corrompido'|'invalido'|'versao_futura', state?, problems?, raw? } */
  function load() {
    available = hasStorage();
    let raw = readRaw();
    if (raw == null && available) {
      for (const k of cfg().storage.legacyKeys) {
        const legacy = root.localStorage.getItem(k);
        if (legacy) {
          try { const st = migrateFromLegacy(JSON.parse(legacy)); save(st); return { status: 'migrado', state: st, storageAvailable: available }; }
          catch (e) { /* segue para dados novos */ }
        }
      }
    }
    if (raw == null) { const st = LNA.mockData.create(); save(st); return { status: 'novo', state: st, storageAvailable: available }; }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { return { status: 'corrompido', problems: ['O conteúdo salvo não é um JSON válido.'], raw, storageAvailable: available }; }
    if (parsed && parsed.schemaVersion > cfg().storage.schemaVersion) return { status: 'versao_futura', problems: [`Dados gravados por uma versão mais nova (schema ${parsed.schemaVersion}).`], raw, storageAvailable: available };
    try { parsed = migrate(parsed); } catch (e) { return { status: 'invalido', problems: [e.message], raw, storageAvailable: available }; }
    const problems = validateState(parsed);
    if (problems.length) return { status: 'invalido', problems, raw, storageAvailable: available };
    return { status: 'ok', state: parsed, storageAvailable: available };
  }

  function save(state) {
    state.meta = state.meta || {};
    state.meta.updatedAt = new Date().toISOString();
    if (state.audit.length > cfg().storage.maxAuditEntries) state.audit = state.audit.slice(0, cfg().storage.maxAuditEntries);
    const json = JSON.stringify(state);
    if (!available) { memoryFallback = json; return; }
    try { root.localStorage.setItem(cfg().storage.key, json); }
    catch (e) { throw new Error('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).'); }
  }

  function reset() { const st = LNA.mockData.create(); save(st); return st; }

  function exportBackup(state) {
    return JSON.stringify({ format: 'lna-backup', app: cfg().app.campaign, exportedAt: new Date().toISOString(), schemaVersion: state.schemaVersion, data: state }, null, 2);
  }

  /** Valida um backup sem aplicá-lo. Retorna { ok, state?, problems?, summary? } */
  function parseBackup(text) {
    if (String(text).length > 5 * 1024 * 1024) return { ok: false, problems: ['Arquivo maior que 5 MB.'] };
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, problems: ['O arquivo não é um JSON válido.'] }; }
    if (!obj || obj.format !== 'lna-backup' || !obj.data) return { ok: false, problems: ['O arquivo não é um backup do Leilão nas Alturas.'] };
    let st = obj.data;
    if (st.schemaVersion > cfg().storage.schemaVersion) return { ok: false, problems: ['Backup gerado por uma versão mais nova da aplicação.'] };
    try { st = migrate(st); } catch (e) { return { ok: false, problems: [e.message] }; }
    const problems = validateState(st);
    if (problems.length) return { ok: false, problems };
    return { ok: true, state: st, summary: { exportedAt: obj.exportedAt, participants: st.participants.length, rewards: st.rewards.length, bids: st.bids.length, awards: st.awards.length, audit: st.audit.length } };
  }

  LNA.storage = { load, save, reset, exportBackup, parseBackup, validateState, migrateFromLegacy, isAvailable: () => available };
})(typeof window !== 'undefined' ? window : globalThis);
