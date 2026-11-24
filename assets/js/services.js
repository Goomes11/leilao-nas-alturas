/* ==========================================================================
   services.js — Camada de serviço
   A interface NUNCA acessa localStorage diretamente: ela chama LNA.api.
   Hoje LNA.api aponta para DemoStorageService. Para produção, implemente
   BackendApiService (mesmos métodos, mesmas respostas) e troque em app.js.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};
  const cfg = () => LNA.config, D = () => LNA.domain, V = () => LNA.validators, S = () => LNA.storage;

  class ServiceError extends Error {
    constructor(message, code = 'erro', details = null) { super(message); this.name = 'ServiceError'; this.code = code; this.details = details; }
  }

  const clone = o => JSON.parse(JSON.stringify(o));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ======================================================================
     DemoStorageService — simula o backend usando LNA.storage
     ====================================================================== */
  function createDemoService(opts = {}) {
    let state = null;
    let loadInfo = null;
    const inFlight = new Set();
    const importPreviews = new Map();
    const latency = opts.latencyMs != null ? opts.latencyMs : cfg().demo.latencyMs;
    const persist = opts.persist !== false;
    const nowFn = opts.now || null; // injeção para testes

    /* ---------------- infraestrutura ---------------- */
    function now() {
      if (nowFn) return nowFn();
      const st = state && state.settings;
      if (st && st.clockMode === 'simulado') {
        const base = new Date(st.simulatedDate).getTime();
        const elapsed = Math.max(0, Date.now() - (st.simulatedSetAt || Date.now()));
        return new Date((Number.isFinite(base) ? base : Date.now()) + elapsed);
      }
      return new Date();
    }
    const nowISO = () => now().toISOString();
    function nextId(prefix, width = 4) { state.meta.seq = (state.meta.seq || 0) + 1; return prefix + String(state.meta.seq).padStart(width, '0'); }
    function save() { if (persist) S().save(state); }
    function role() { return state.settings.role; }
    function actor() {
      if (role() === 'gestao') return { actor: cfg().demo.adminProfile.email, role: 'gestao' };
      const p = D().getParticipant(state, state.settings.participantId);
      return { actor: p ? p.email : 'desconhecido', role: 'operador' };
    }
    function audit(action, entity, entityId, before, after, extra = {}) {
      const a = actor();
      state.audit.unshift({
        id: nextId('A', 5), at: nowISO(), actor: extra.actor || a.actor, role: extra.role || a.role, action, entity, entityId: String(entityId == null ? '-' : entityId),
        before: before == null ? null : (typeof before === 'string' ? before : JSON.stringify(before)),
        after: after == null ? null : (typeof after === 'string' ? after : JSON.stringify(after)),
        justification: extra.justification || null, origin: extra.origin || 'interface da demonstração', result: extra.result || 'sucesso'
      });
    }

    /** Envelopa toda chamada: latência, modo de erro, bloqueio de duplicidade, erros amigáveis. */
    async function call(name, fn, { write = false, lockKey = null, allowInErrorMode = false } = {}) {
      if (!state) throw new ServiceError('A aplicação ainda não foi inicializada.', 'nao_inicializado');
      const key = lockKey || (write ? name : null);
      if (key && inFlight.has(key)) throw new ServiceError('Já existe um envio em processamento. Aguarde a confirmação antes de tentar novamente.', 'duplicado');
      if (key) inFlight.add(key);
      try {
        if (latency) await wait(latency);
        if (state.settings.errorMode && !allowInErrorMode) throw new ServiceError('Não foi possível conectar ao serviço da campanha. Tente novamente em instantes. (Simulação de erro ativada nos Controles da demonstração.)', 'servico_indisponivel');
        if (write && state.settings.emptyMode && !allowInErrorMode) throw new ServiceError('O modo "dados vazios" está ativo. Desative-o nos Controles da demonstração para alterar informações.', 'modo_vazio');
        const out = await fn();
        if (write) save();
        return out === undefined ? true : clone(out);
      } catch (e) {
        if (e instanceof ServiceError) throw e;
        // Nunca expõe stack trace ao usuário
        if (typeof console !== 'undefined') console.error('[LNA]', name, e);
        throw new ServiceError(e && e.message ? e.message : 'Ocorreu um erro inesperado. Nenhuma alteração foi gravada.', 'interno');
      } finally {
        if (key) inFlight.delete(key);
      }
    }
    function ensureAdmin() { if (role() !== 'gestao') throw new ServiceError('Você não tem permissão para esta ação. Ela é exclusiva do perfil Gestão.', 'sem_permissao'); }
    function ensureOperator() { if (role() !== 'operador') throw new ServiceError('Selecione um perfil de operador para esta ação.', 'sem_permissao'); }
    const empty = () => state.settings.emptyMode;

    /* ---------------- inicialização e contexto ---------------- */
    function init(initialState) {
      if (initialState) { state = initialState; loadInfo = { status: 'injetado', storageAvailable: false }; return loadInfo; }
      loadInfo = S().load();
      state = loadInfo.state || null;
      return { status: loadInfo.status, problems: loadInfo.problems || [], storageAvailable: loadInfo.storageAvailable };
    }

    function getContext() {
      const n = now();
      const s = state.settings;
      const user = getCurrentUserSync();
      return clone({
        role: s.role, user, now: n.toISOString(), phase: (({ key, label, roundId, start, end, next }) => ({ key, label, roundId, start, end, next }))(D().getCampaignPhase(n)),
        currentRoundId: state.currentRoundId, round: D().getRound(state.currentRoundId), roundState: state.rounds[state.currentRoundId],
        settings: { clockMode: s.clockMode, simulatedDate: s.simulatedDate, errorMode: s.errorMode, emptyMode: s.emptyMode, participantId: s.participantId, demoPanelOpen: s.demoPanelOpen },
        demoOperators: state.participants.filter(p => LNA.mockData.demoOperators.includes(p.id) || p.id === s.participantId).map(p => ({ id: p.id, name: p.name, location: p.location, active: p.active })),
        storageAvailable: S().isAvailable ? S().isAvailable() : true, updatedAt: state.meta.updatedAt
      });
    }
    function getCurrentUserSync() {
      if (state.settings.role === 'gestao') return { ...cfg().demo.adminProfile, role: 'gestao' };
      const p = D().getParticipant(state, state.settings.participantId);
      return p ? { id: p.id, name: p.name, email: p.email, location: p.location, active: p.active, role: 'operador' } : { id: null, name: 'Operador não localizado', role: 'operador', active: false };
    }

    /* ---------------- Controles da demonstração ---------------- */
    async function setDemoSettings(partial) {
      const allowed = ['role', 'participantId', 'clockMode', 'simulatedDate', 'errorMode', 'emptyMode', 'demoPanelOpen'];
      const before = {};
      Object.keys(partial).forEach(k => {
        if (!allowed.includes(k)) return;
        if (k === 'role' && !['operador', 'gestao'].includes(partial.role)) throw new ServiceError('Perfil inválido.');
        if (k === 'participantId' && !D().getParticipant(state, partial.participantId)) throw new ServiceError('Participante de teste não localizado.');
        if (k === 'simulatedDate' && !Number.isFinite(new Date(partial.simulatedDate).getTime())) throw new ServiceError('Data simulada inválida.');
        before[k] = state.settings[k];
        state.settings[k] = partial[k];
      });
      if ('simulatedDate' in partial || 'clockMode' in partial) {
        state.settings.simulatedSetAt = Date.now();
        audit('data_simulada', 'demonstracao', 'relogio', before, { clockMode: state.settings.clockMode, simulatedDate: state.settings.simulatedDate }, { origin: 'Controles da demonstração' });
      }
      if ('errorMode' in partial || 'emptyMode' in partial) audit('modo_demonstracao', 'demonstracao', 'modos', before, { errorMode: state.settings.errorMode, emptyMode: state.settings.emptyMode }, { origin: 'Controles da demonstração' });
      save();
      return getContext();
    }

    /* ---------------- OPERADOR (dados sempre restritos ao próprio participante) ---------------- */
    function getOperatorDashboard() {
      return call('getOperatorDashboard', () => {
        ensureOperator();
        const pid = state.settings.participantId;
        const p = D().getParticipant(state, pid);
        if (!p) throw new ServiceError('Seu cadastro não foi localizado nesta campanha.', 'sem_cadastro');
        const roundId = state.currentRoundId;
        const n = now();
        const account = D().accountSummary(state, pid, roundId);
        const rewards = empty() ? [] : state.rewards.slice().sort((a, b) => a.order - b.order).map(r => {
          const st = D().rewardStatus(state, r, roundId);
          const stats = D().rewardStats(state, r.id, roundId);
          // Somente agregados: maior lance principal e quantidade. Nunca quem deu o lance.
          return { id: r.id, name: r.name, description: r.description, icon: r.icon, minBid: r.minBid, releaseRound: r.releaseRound, status: st.status, statusLabel: st.label, highestPrimary: stats.highestPrimary, primaryCount: stats.primaryCount };
        });
        const myBids = empty() ? [] : D().bidHistory(state, pid);
        return {
          participant: { id: p.id, name: p.name, email: p.email, location: p.location, active: p.active },
          account: empty() ? { earned: 0, consumed: 0, balance: 0, committed: 0, potentialAfterWin: 0, bid: null, award: null, lastUpdate: null } : account,
          canBid: D().canBid(state, pid, n),
          round: D().getRound(roundId), roundState: state.rounds[roundId], roundTime: D().roundTimeStatus(roundId, n), roundWindow: D().roundWindow(roundId),
          rewards, myBids,
          myPoints: empty() ? [] : state.points.filter(x => x.participantId === pid).sort((a, b) => a.month.localeCompare(b.month)),
          awardedTotal: D().validAwards(state).length
        };
      });
    }

    async function submitBid(input, requestId) {
      return call('submitBid', () => {
        ensureOperator();
        const pid = state.settings.participantId;
        state.meta.processedRequests = state.meta.processedRequests || [];
        if (requestId && state.meta.processedRequests.includes(requestId)) throw new ServiceError('Este lance já foi registrado. Atualize a página para ver a versão mais recente.', 'duplicado');
        const v = D().validateBid(state, pid, input, now());
        if (!v.ok) {
          audit('lance_rejeitado', 'lance', pid, null, input, { result: 'rejeitado: ' + Object.values(v.errors).join(' | ') });
          save();
          throw new ServiceError(v.errors.form || 'Revise os campos destacados.', 'validacao', v.errors);
        }
        const before = D().activeBid(state, pid, v.value.roundId);
        const { bid } = D().applyBid(state, pid, v.value, nowISO(), nextId('B'));
        if (requestId) state.meta.processedRequests = [requestId].concat(state.meta.processedRequests).slice(0, 50);
        audit(before ? 'atualizacao_lance' : 'registro_lance', 'lance', bid.id, before ? { id: before.id, principal: before.primaryRewardId, pontos: before.primaryPoints, segunda: before.secondRewardId, pontosSegunda: before.secondPoints } : null,
          { id: bid.id, versao: bid.version, principal: bid.primaryRewardId, pontos: bid.primaryPoints, segunda: bid.secondRewardId, pontosSegunda: bid.secondPoints });
        return { bid, updated: !!before, round: D().getRound(bid.roundId), roundWindow: D().roundWindow(bid.roundId) };
      }, { write: true, lockKey: 'submitBid:' + state.settings.participantId });
    }

    /* ---------------- GESTÃO: participantes ---------------- */
    function participantRow(p) {
      return { ...p, earned: D().earned(state, p.id), consumed: D().consumed(state, p.id), balance: D().balance(state, p.id), lastUpdate: D().lastPointsUpdate(state, p.id) || p.updatedAt, award: D().participantAward(state, p.id), hasBid: !!D().activeBid(state, p.id, state.currentRoundId) };
    }
    function getParticipants() { return call('getParticipants', () => { ensureAdmin(); return empty() ? [] : state.participants.map(participantRow); }); }

    function saveParticipant(input) {
      return call('saveParticipant', () => {
        ensureAdmin();
        const errors = {};
        const em = V().validateEmail(input.email); if (!em.ok) errors.email = em.error;
        const nm = V().validateName(input.name); if (!nm.ok) errors.name = nm.error;
        const lc = V().validateLocation(input.location); if (!lc.ok) errors.location = lc.error;
        if (em.ok && state.participants.some(p => p.email === em.value && p.id !== input.id)) errors.email = 'Este e-mail já está cadastrado para outro participante.';
        if (Object.keys(errors).length) throw new ServiceError('Revise os campos destacados.', 'validacao', errors);
        const at = nowISO();
        if (input.id) {
          const p = D().getParticipant(state, input.id);
          if (!p) throw new ServiceError('Participante não localizado.');
          const before = { name: p.name, email: p.email, location: p.location, active: p.active };
          Object.assign(p, { name: nm.value, email: em.value, location: lc.value, active: !!input.active, updatedAt: at });
          audit('edicao_participante', 'participante', p.id, before, { name: p.name, email: p.email, location: p.location, active: p.active }, { justification: input.justification || null });
          return participantRow(p);
        }
        const p = { id: nextId('P', 3), name: nm.value, email: em.value, location: lc.value, active: input.active !== false, createdAt: at, updatedAt: at };
        state.participants.push(p);
        audit('cadastro_participante', 'participante', p.id, null, { name: p.name, email: p.email, location: p.location, active: p.active });
        return participantRow(p);
      }, { write: true });
    }

    function setParticipantActive(id, active, justification) {
      return call('setParticipantActive', () => {
        ensureAdmin();
        const p = D().getParticipant(state, id);
        if (!p) throw new ServiceError('Participante não localizado.');
        if (p.active === active) throw new ServiceError(active ? 'O participante já está ativo.' : 'O participante já está inativo.');
        p.active = active; p.updatedAt = nowISO();
        audit(active ? 'ativacao_participante' : 'inativacao_participante', 'participante', id, { active: !active }, { active }, { justification: V().cleanText(justification, 300) || null });
        return participantRow(p);
      }, { write: true });
    }

    /* ---------------- GESTÃO: pontuação ---------------- */
    function getPoints(participantId) {
      return call('getPoints', () => { ensureAdmin(); if (empty()) return []; return state.points.filter(x => !participantId || x.participantId === participantId).sort((a, b) => a.participantId.localeCompare(b.participantId) || a.month.localeCompare(b.month)); });
    }
    function upsertPoints(pid, month, achievement, type) {
      const pts = D().calcPoints(achievement);
      const at = nowISO();
      const old = state.points.find(x => x.participantId === pid && x.month === month);
      const before = old ? { achievement: old.achievement, points: old.points } : null;
      if (old) Object.assign(old, { achievement, points: pts, type, updatedAt: at, updatedBy: actor().actor });
      else state.points.push({ participantId: pid, month, achievement, points: pts, type, updatedAt: at, updatedBy: actor().actor });
      return { before, after: { achievement, points: pts }, created: !old };
    }
    function savePoints(input) {
      return call('savePoints', () => {
        ensureAdmin();
        const errors = {};
        const p = D().getParticipant(state, input.participantId); if (!p) errors.participantId = 'Selecione um participante cadastrado.';
        const m = V().validateMonth(input.month); if (!m.ok) errors.month = m.error;
        const a = V().validateAchievement(input.achievement); if (!a.ok) errors.achievement = a.error;
        if (Object.keys(errors).length) throw new ServiceError('Revise os campos destacados.', 'validacao', errors);
        const r = upsertPoints(p.id, m.value, a.value, 'manual');
        audit('atualizacao_pontuacao', 'pontuacao', `${p.id}/${m.value}`, r.before, r.after, { justification: V().cleanText(input.justification, 300) || null });
        const warn = D().inconsistencies(state).filter(i => i.entity === p.id && i.kind === 'saldo').map(i => i.message);
        return { ...r, participant: { id: p.id, name: p.name }, month: m.value, warnings: warn };
      }, { write: true });
    }

    function previewPointsImport(text) {
      return call('previewPointsImport', () => {
        ensureAdmin();
        const { rows } = V().parseCSV(text);
        if (!rows.length) throw new ServiceError('O arquivo está vazio.', 'validacao');
        if (rows.length > 2001) throw new ServiceError('Limite de 2.000 linhas por importação na demonstração.', 'validacao');
        const head = rows[0].map(V().normalizeHeader);
        const need = { nome: 'nome', email: 'email', mes: 'mes', atingimento: 'atingimento' };
        const idx = {};
        const missing = [];
        Object.keys(need).forEach(k => { const i = head.indexOf(k); if (i < 0) missing.push(k === 'mes' ? 'mês' : k === 'email' ? 'e-mail' : k); idx[k] = i; });
        if (missing.length) throw new ServiceError(`Cabeçalho inválido. Colunas obrigatórias ausentes: ${missing.join(', ')}. Use: nome;email;mes;atingimento`, 'validacao');
        const seen = new Map();
        const lines = rows.slice(1).map((r, i) => {
          const line = i + 2;
          const raw = { nome: (r[idx.nome] || '').trim(), email: (r[idx.email] || '').trim(), mes: (r[idx.mes] || '').trim(), atingimento: (r[idx.atingimento] || '').trim() };
          const errs = [];
          if (!raw.nome) errs.push('nome vazio');
          const em = V().validateEmail(raw.email); if (!em.ok) errs.push('e-mail inválido');
          const p = em.ok ? state.participants.find(x => x.email === em.value) : null;
          if (em.ok && !p) errs.push('participante inexistente');
          if (p && raw.nome && V().cleanText(raw.nome).toLowerCase() !== p.name.toLowerCase()) errs.push(`nome não confere com o cadastro (${p.name})`);
          const mo = V().validateMonth(raw.mes); if (!mo.ok) errs.push('mês inválido');
          const pr = V().parseDecimalBR(raw.atingimento);
          if (!pr.ok) errs.push('atingimento com formato inválido');
          else if (pr.value < 0) errs.push('valor negativo');
          else if (pr.value > cfg().rules.maxAchievementPercent) errs.push('atingimento acima do limite');
          let status = errs.length ? 'invalido' : 'valido';
          const key = p && mo.ok ? p.id + '|' + mo.value : null;
          if (status === 'valido' && seen.has(key)) { status = 'duplicado'; errs.push(`duplicado da linha ${seen.get(key)}`); }
          if (key && !seen.has(key)) seen.set(key, line);
          const achievement = pr.ok ? Math.round(pr.value * 100) / 100 : null;
          const existing = p && mo.ok ? state.points.find(x => x.participantId === p.id && x.month === mo.value) : null;
          return { line, raw, status, errors: errs, participantId: p ? p.id : null, month: mo.ok ? mo.value : null, achievement, points: status === 'valido' ? D().calcPoints(achievement) : null, updates: !!existing, previous: existing ? existing.points : null };
        });
        const valid = lines.filter(l => l.status === 'valido');
        const token = 'imp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        importPreviews.set(token, valid);
        audit('importacao_previa', 'pontuacao', token, null, { linhas: lines.length, validas: valid.length }, { result: 'prévia gerada' });
        save();
        return { token, lines, totals: { total: lines.length, valid: valid.length, invalid: lines.filter(l => l.status === 'invalido').length, duplicated: lines.filter(l => l.status === 'duplicado').length, updates: valid.filter(l => l.updates).length, newEntries: valid.filter(l => !l.updates).length, points: valid.reduce((s, l) => s + l.points, 0) } };
      });
    }
    function confirmPointsImport(token) {
      return call('confirmPointsImport', () => {
        ensureAdmin();
        const valid = importPreviews.get(token);
        if (!valid) throw new ServiceError('A prévia expirou ou já foi aplicada. Gere uma nova prévia.', 'previa_expirada');
        importPreviews.delete(token);
        valid.forEach(l => upsertPoints(l.participantId, l.month, l.achievement, 'importacao'));
        audit('importacao_pontuacao', 'pontuacao', token, null, { registros: valid.length, pontos: valid.reduce((s, l) => s + l.points, 0) });
        return { applied: valid.length };
      }, { write: true });
    }

    /* ---------------- GESTÃO: prêmios ---------------- */
    function rewardRow(r) {
      const roundId = state.currentRoundId;
      const st = D().rewardStatus(state, r, roundId), stats = D().rewardStats(state, r.id, roundId), aw = D().rewardAward(state, r.id);
      const winner = aw ? D().getParticipant(state, aw.participantId) : null;
      return { ...r, status: st.status, statusLabel: st.label, ...stats, policy: D().rewardEditPolicy(state, r.id), award: aw, winnerName: winner ? winner.name : null };
    }
    function getRewards() { return call('getRewards', () => { ensureAdmin(); return empty() ? [] : state.rewards.slice().sort((a, b) => a.order - b.order).map(rewardRow); }); }

    function saveReward(input) {
      return call('saveReward', () => {
        ensureAdmin();
        const errors = {};
        const name = V().cleanText(input.name, 80); if (name.length < 2) errors.name = 'Informe o nome do prêmio.';
        const description = V().cleanText(input.description, 160);
        const min = V().parsePoints(input.minBid);
        if (!min.ok) errors.minBid = min.error; else if (min.value < cfg().rules.minRewardBid || min.value % cfg().rules.bidIncrement) errors.minBid = `Use um valor a partir de ${cfg().rules.minRewardBid}, em múltiplos de ${cfg().rules.bidIncrement}.`;
        const release = Number(input.releaseRound); if (![1, 2, 3].includes(release)) errors.releaseRound = 'Escolha a Rodada 1, 2 ou 3.';
        const icon = cfg().rewardIcons.includes(input.icon) ? input.icon : 'gift';
        const order = V().parsePoints(input.order); if (!order.ok || order.value < 1 || order.value > 999) errors.order = 'Informe uma ordem entre 1 e 999.';
        if (Object.keys(errors).length) throw new ServiceError('Revise os campos destacados.', 'validacao', errors);
        const at = nowISO();
        if (input.id) {
          const r = D().getReward(state, input.id);
          if (!r) throw new ServiceError('Prêmio não localizado.');
          const pol = D().rewardEditPolicy(state, r.id);
          if (r.minBid !== min.value && !pol.minBid) throw new ServiceError('Este prêmio já recebeu lances: o lance mínimo não pode ser alterado.', 'bloqueado', { minBid: 'Bloqueado: o prêmio já recebeu lances.' });
          if (r.releaseRound !== release && !pol.releaseRound) throw new ServiceError('Este prêmio já recebeu lances: a rodada de liberação não pode ser alterada.', 'bloqueado', { releaseRound: 'Bloqueado: o prêmio já recebeu lances.' });
          if (r.name !== name && !pol.name) throw new ServiceError('Prêmio já homologado: o nome não pode ser alterado.', 'bloqueado', { name: 'Bloqueado: prêmio homologado.' });
          const before = { name: r.name, description: r.description, minBid: r.minBid, releaseRound: r.releaseRound, icon: r.icon, order: r.order };
          Object.assign(r, { name, description, minBid: min.value, releaseRound: release, icon, order: order.value, updatedAt: at });
          audit('edicao_premio', 'premio', r.id, before, { name, description, minBid: r.minBid, releaseRound: r.releaseRound, icon, order: r.order });
          return rewardRow(r);
        }
        const r = { id: nextId('R', 2), name, description, icon, minBid: min.value, releaseRound: release, active: true, order: order.value, createdAt: at, updatedAt: at };
        state.rewards.push(r);
        audit('criacao_premio', 'premio', r.id, null, { name, minBid: r.minBid, releaseRound: r.releaseRound });
        return rewardRow(r);
      }, { write: true });
    }
    function setRewardActive(id, active, justification) {
      return call('setRewardActive', () => {
        ensureAdmin();
        const r = D().getReward(state, id);
        if (!r) throw new ServiceError('Prêmio não localizado.');
        const pol = D().rewardEditPolicy(state, id);
        const just = V().cleanText(justification, 300);
        if (!active && pol.deactivate === 'bloqueado') throw new ServiceError('Prêmio homologado não pode ser inativado. Use o fluxo de reversão da homologação.', 'bloqueado');
        if (!active && pol.deactivate === 'com_justificativa' && just.length < 15) throw new ServiceError('Este prêmio tem lances. Informe uma justificativa com pelo menos 15 caracteres.', 'validacao', { justification: 'Justificativa obrigatória (mínimo de 15 caracteres).' });
        r.active = active; r.updatedAt = nowISO();
        audit(active ? 'ativacao_premio' : 'inativacao_premio', 'premio', id, { active: !active }, { active }, { justification: just || null });
        return rewardRow(r);
      }, { write: true });
    }

    /* ---------------- GESTÃO: lances ---------------- */
    function getBids(roundId) {
      return call('getBids', () => {
        ensureAdmin();
        if (empty()) return { bids: [], history: [], withoutBid: [], rewardsWithoutBid: [] };
        const rid = roundId || state.currentRoundId;
        const name = id => (D().getParticipant(state, id) || {}).name || id;
        const email = id => (D().getParticipant(state, id) || {}).email || '';
        const rname = id => id ? ((D().getReward(state, id) || {}).name || id) : null;
        const map = b => ({ ...b, participantName: name(b.participantId), participantEmail: email(b.participantId), primaryName: rname(b.primaryRewardId), secondName: rname(b.secondRewardId), balance: D().balance(state, b.participantId) });
        const act = D().activeBids(state, rid);
        const withBid = new Set(act.map(b => b.participantId));
        return {
          roundId: rid,
          bids: act.map(map).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          history: state.bids.filter(b => b.roundId === rid && b.status !== 'ativo').map(map).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          withoutBid: state.participants.filter(p => p.active && !withBid.has(p.id) && !D().participantAward(state, p.id)).map(p => ({ id: p.id, name: p.name, email: p.email, location: p.location, balance: D().balance(state, p.id) })),
          rewardsWithoutBid: state.rewards.filter(r => D().isRewardEligible(state, r, rid) && !act.some(b => b.primaryRewardId === r.id || b.secondRewardId === r.id)).map(r => ({ id: r.id, name: r.name, minBid: r.minBid }))
        };
      });
    }

    /* ---------------- GESTÃO: rodadas e homologação ---------------- */
    function getRounds() {
      return call('getRounds', () => {
        ensureAdmin();
        return {
          currentRoundId: state.currentRoundId,
          rounds: cfg().calendar.rounds.map(r => ({ ...r, ...state.rounds[r.id], timeStatus: D().roundTimeStatus(r.id, now()), bidCount: D().activeBids(state, r.id).length, participants: new Set(D().activeBids(state, r.id).map(b => b.participantId)).size, awards: D().validAwards(state).filter(a => a.roundId === r.id).length })),
          preview: state.previews[state.currentRoundId] || null,
          homologations: state.homologations.slice().reverse(),
          awards: state.awards.map(a => ({ ...a, participantName: (D().getParticipant(state, a.participantId) || {}).name, participantEmail: (D().getParticipant(state, a.participantId) || {}).email, rewardName: (D().getReward(state, a.rewardId) || {}).name }))
        };
      });
    }

    function simulateHomologation() {
      return call('simulateHomologation', () => {
        ensureAdmin();
        const rid = state.currentRoundId;
        const rs = state.rounds[rid].status;
        if (rs === 'homologada') throw new ServiceError(`A ${D().getRound(rid).label} já foi homologada. Abra a próxima rodada para continuar.`, 'ja_homologada');
        if (rs === 'futura') throw new ServiceError('A rodada ainda não foi aberta.', 'rodada_futura');
        const preview = D().computeHomologation(state, rid, nowISO());
        state.previews[rid] = preview;
        audit('simulacao_homologacao', 'rodada', rid, null, { vencedores: preview.winners.length, empates: preview.ties.length, assinatura: preview.signature });
        return preview;
      }, { write: true, lockKey: 'homologacao' });
    }

    function confirmHomologation(roundId, signature, justification) {
      return call('confirmHomologation', () => {
        ensureAdmin();
        const rid = Number(roundId);
        if (rid !== state.currentRoundId) throw new ServiceError('A rodada informada não é a rodada atual.', 'rodada_invalida');
        const rs = state.rounds[rid];
        if (rs.status === 'homologada') {
          audit('homologacao_bloqueada', 'rodada', rid, null, null, { result: 'rejeitado: rodada já homologada' });
          save();
          throw new ServiceError(`A ${D().getRound(rid).label} já foi homologada. Uma homologação confirmada não pode ser repetida.`, 'ja_homologada');
        }
        if (rs.status === 'futura') throw new ServiceError('A rodada ainda não foi aberta.', 'rodada_futura');
        const preview = state.previews[rid];
        if (!preview) throw new ServiceError('Gere a prévia (Simular encerramento) antes de confirmar.', 'sem_previa');
        if (preview.signature !== signature || D().homologationSignature(state, rid) !== signature) {
          delete state.previews[rid]; save();
          throw new ServiceError('Os dados mudaram depois da prévia (novos lances, pontuação ou prêmios). Simule novamente antes de confirmar.', 'previa_desatualizada');
        }
        const at = nowISO();
        const hid = nextId('H', 3);
        preview.winners.forEach(w => {
          state.awards.push({ id: nextId('W', 4), homologationId: hid, roundId: rid, participantId: w.participantId, rewardId: w.rewardId, points: w.points, type: w.type, bidId: w.bidId, reason: w.reason, homologatedAt: at, status: 'homologado' });
        });
        rs.status = 'homologada'; rs.homologatedAt = at;
        state.homologations.push({ id: hid, roundId: rid, at, by: actor().actor, signature, justification: V().cleanText(justification, 300) || null, winners: preview.winners.length, ties: preview.ties.length, notConsidered: preview.notConsidered.length, snapshot: preview, status: 'confirmada' });
        delete state.previews[rid];
        audit('homologacao', 'rodada', rid, { status: 'aberta' }, { status: 'homologada', vencedores: preview.winners.length, homologacao: hid }, { justification: V().cleanText(justification, 300) || null });
        return state.homologations[state.homologations.length - 1];
      }, { write: true, lockKey: 'homologacao' });
    }

    function openNextRound({ moveClock = true } = {}) {
      return call('openNextRound', () => {
        ensureAdmin();
        const cur = state.currentRoundId;
        if (state.rounds[cur].status !== 'homologada') throw new ServiceError('Homologue a rodada atual antes de abrir a próxima.', 'ordem_invalida');
        const next = D().getRound(cur + 1);
        if (!next) throw new ServiceError('Todas as rodadas já foram concluídas.', 'fim');
        state.currentRoundId = next.id;
        state.rounds[next.id].status = 'aberta';
        state.rounds[next.id].openedAt = nowISO();
        audit('abertura_rodada', 'rodada', next.id, { rodadaAtual: cur }, { rodadaAtual: next.id });
        if (moveClock && state.settings.clockMode === 'simulado' && now() < D().roundWindow(next.id).start) {
          const before = state.settings.simulatedDate;
          state.settings.simulatedDate = next.start + 'T09:00';
          state.settings.simulatedSetAt = Date.now();
          audit('data_simulada', 'demonstracao', 'relogio', before, state.settings.simulatedDate, { origin: 'abertura de rodada (ajuste automático da demonstração)' });
        }
        return { round: next };
      }, { write: true, lockKey: 'homologacao' });
    }

    function revertHomologation(roundId, justification) {
      return call('revertHomologation', () => {
        ensureAdmin();
        const rid = Number(roundId);
        const just = V().cleanText(justification, 300);
        if (just.length < 20) throw new ServiceError('Informe uma justificativa com pelo menos 20 caracteres.', 'validacao', { justification: 'Justificativa obrigatória (mínimo de 20 caracteres).' });
        if (rid !== state.currentRoundId || state.rounds[rid].status !== 'homologada') throw new ServiceError('Só é possível reverter a última rodada homologada, antes da abertura da rodada seguinte.', 'bloqueado');
        const h = state.homologations.slice().reverse().find(x => x.roundId === rid && x.status === 'confirmada');
        state.awards.filter(a => a.roundId === rid && a.status === 'homologado').forEach(a => { a.status = 'revertido'; a.revertedAt = nowISO(); });
        if (h) { h.status = 'revertida'; h.revertedAt = nowISO(); h.revertJustification = just; }
        state.rounds[rid].status = 'encerrada';
        audit('reversao_homologacao', 'rodada', rid, { status: 'homologada' }, { status: 'encerrada' }, { justification: just });
        return true;
      }, { write: true, lockKey: 'homologacao' });
    }

    /* ---------------- GESTÃO: visão geral e auditoria ---------------- */
    function getAdminOverview() {
      return call('getAdminOverview', () => {
        ensureAdmin();
        if (empty()) return { empty: true, kpis: null, byLocation: [], bidsByReward: [], monthly: [], rewardStatus: [], inconsistencies: [] };
        const n = now();
        const kpis = D().adminOverview(state, n);
        const byLocation = cfg().locations.map(l => {
          const ps = state.participants.filter(p => p.location === l.id);
          return { id: l.id, label: l.label, participants: ps.length, active: ps.filter(p => p.active).length, points: ps.reduce((s, p) => s + D().earned(state, p.id), 0) };
        });
        const bidsByReward = state.rewards.slice().sort((a, b) => a.order - b.order).map(r => ({ id: r.id, name: r.name, ...D().rewardStats(state, r.id, state.currentRoundId) }));
        const monthly = cfg().scoringMonths.map(m => ({ month: m, points: state.points.filter(x => x.month === m).reduce((s, x) => s + x.points, 0) }));
        const rs = {}; state.rewards.forEach(r => { const s = D().rewardStatus(state, r, state.currentRoundId); rs[s.status] = (rs[s.status] || 0) + 1; });
        return { kpis, byLocation, bidsByReward, monthly, rewardStatus: Object.entries(rs).map(([status, count]) => ({ status, count })), inconsistencies: D().inconsistencies(state), roundWindow: D().roundWindow(state.currentRoundId), roundTime: D().roundTimeStatus(state.currentRoundId, n) };
      });
    }
    function getAuditLog() { return call('getAuditLog', () => { ensureAdmin(); return empty() ? [] : state.audit; }); }

    /* ---------------- Backup e reset ---------------- */
    function exportBackup() {
      return call('exportBackup', () => { ensureAdmin(); audit('exportacao_backup', 'demonstracao', '-', null, null); save(); return { filename: `leilao-nas-alturas-backup-${new Date().toISOString().slice(0, 10)}.json`, content: S().exportBackup(state) }; }, { allowInErrorMode: true });
    }
    function previewBackup(text) {
      return call('previewBackup', () => { ensureAdmin(); const r = S().parseBackup(text); if (!r.ok) throw new ServiceError('Backup inválido: ' + r.problems.join(' '), 'validacao', { problems: r.problems }); return r.summary; }, { allowInErrorMode: true });
    }
    function importBackup(text) {
      return call('importBackup', () => {
        ensureAdmin();
        const r = S().parseBackup(text);
        if (!r.ok) throw new ServiceError('Backup inválido: ' + r.problems.join(' '), 'validacao');
        const keepSettings = { ...state.settings };
        state = r.state;
        state.settings = { ...state.settings, role: keepSettings.role, demoPanelOpen: keepSettings.demoPanelOpen };
        audit('importacao_backup', 'demonstracao', '-', null, r.summary);
        return r.summary;
      }, { write: true, allowInErrorMode: true });
    }
    function resetDemo() {
      return call('resetDemo', () => {
        const keepRole = state ? state.settings.role : 'operador';
        state = LNA.mockData.create();
        state.settings.role = keepRole;
        audit('reset_demonstracao', 'demonstracao', '-', null, 'Dados fictícios restaurados', { origin: 'Controles da demonstração' });
        return true;
      }, { write: true, allowInErrorMode: true });
    }
    /** Recuperação controlada de dados corrompidos (usada antes de existir estado válido). */
    function recoverWithDefaults() { state = S().reset(); audit('recuperacao_dados', 'demonstracao', '-', 'dados corrompidos', 'dados fictícios restaurados', { actor: 'sistema', role: 'sistema' }); save(); return true; }

    return {
      kind: 'DemoStorageService', ServiceError, init, now, getContext, setDemoSettings,
      getCurrentUser: () => call('getCurrentUser', getCurrentUserSync, { allowInErrorMode: true }),
      getOperatorDashboard, submitBid,
      getParticipants, saveParticipant, setParticipantActive,
      getPoints, savePoints, previewPointsImport, confirmPointsImport,
      getRewards, saveReward, setRewardActive,
      getBids, getRounds, simulateHomologation, confirmHomologation, openNextRound, revertHomologation,
      getAdminOverview, getAuditLog, exportBackup, previewBackup, importBackup, resetDemo, recoverWithDefaults,
      _state: () => state // somente para testes automatizados
    };
  }

  /* ======================================================================
     BackendApiService — contrato para produção (não implementado nesta etapa)
     Cada método deve chamar a API corporativa autenticada (Microsoft Entra ID),
     e TODAS as regras de domain.js devem ser revalidadas no servidor.
     ====================================================================== */
  function createBackendApiService(baseUrl) {
    const notReady = name => () => Promise.reject(new ServiceError(`Integração com backend ainda não implementada (${name}).`, 'nao_implementado'));
    const methods = ['getCurrentUser', 'getOperatorDashboard', 'submitBid', 'getParticipants', 'saveParticipant', 'setParticipantActive', 'getPoints', 'savePoints', 'previewPointsImport', 'confirmPointsImport', 'getRewards', 'saveReward', 'setRewardActive', 'getBids', 'getRounds', 'simulateHomologation', 'confirmHomologation', 'openNextRound', 'revertHomologation', 'getAdminOverview', 'getAuditLog', 'exportBackup', 'importBackup'];
    const api = { kind: 'BackendApiService', baseUrl, ServiceError };
    methods.forEach(m => { api[m] = notReady(m); });
    return api;
  }

  /* GoogleAppsScriptService — o HTML original usava google.script.run.
     Mantido como ponto de extensão; mesmo contrato dos demais serviços. */
  function createGoogleAppsScriptService() {
    const run = (method, ...args) => new Promise((resolve, reject) => {
      if (!root.google || !root.google.script) return reject(new ServiceError('Google Apps Script indisponível neste ambiente.', 'nao_disponivel'));
      root.google.script.run.withSuccessHandler(resolve).withFailureHandler(e => reject(new ServiceError(e && e.message ? e.message : 'Falha no servidor.', 'servidor')))[method](...args);
    });
    return { kind: 'GoogleAppsScriptService', ServiceError, getCurrentUser: () => run('getCurrentUser'), getOperatorDashboard: () => run('getOperatorDashboard'), submitBid: (i, r) => run('submitBid', i, r) };
  }

  LNA.services = { ServiceError, createDemoService, createBackendApiService, createGoogleAppsScriptService };
})(typeof window !== 'undefined' ? window : globalThis);
