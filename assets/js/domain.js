/* ==========================================================================
   domain.js — Regras de negócio puras (sem DOM, sem localStorage)
   Todas as funções recebem o estado e devolvem resultados; quem grava é a
   camada de serviço. Isso permite testar em Node e mover para o servidor.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};
  const cfg = () => LNA.config;
  const V = () => LNA.validators;

  /* ------------------------------------------------------------------
     1. PONTUAÇÃO — ponto único da regra (não duplicar em outro lugar)
     pontos = floor(max(0, atingimento - 100)) * 10
     ------------------------------------------------------------------ */
  function calcPoints(achievementPercent) {
    const pct = Number(achievementPercent);
    if (!Number.isFinite(pct) || pct < 0) throw new Error('Atingimento inválido para cálculo de pontos.');
    // Arredonda para 2 casas antes do floor para evitar erro binário (ex.: 101,00 virar 100,9999)
    const above = Math.round((pct - cfg().rules.targetPercent) * 100) / 100;
    return Math.floor(Math.max(0, above)) * cfg().rules.pointsPerPercent;
  }

  /* ------------------------------------------------------------------
     2. CALENDÁRIO
     ------------------------------------------------------------------ */
  function dayStart(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d, 0, 0, 0, 0); }
  function dayEnd(ymd) { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999); }
  function getRound(id) { return cfg().calendar.rounds.find(r => r.id === Number(id)) || null; }
  function roundWindow(id) { const r = getRound(id); return r ? { start: dayStart(r.start), end: dayEnd(r.end) } : null; }

  /** Identifica a fase da campanha para uma data.
   *  key: antes_pontuacao | pontuacao | rodada | repescagem | homologacao | encerrada */
  function getCampaignPhase(date) {
    const d = date instanceof Date ? date : new Date(date);
    const c = cfg().calendar;
    const rounds = c.rounds.map(r => ({ ...r, startDate: dayStart(r.start), endDate: dayEnd(r.end) }));
    const scoringStart = dayStart(c.scoring.start), scoringEnd = dayEnd(c.scoring.end);
    const homStart = dayStart(c.homologation.start), homEnd = dayEnd(c.homologation.end);
    const base = { date: d, rounds };
    if (d < scoringStart) return { ...base, key: 'antes_pontuacao', label: 'Campanha ainda não iniciada', roundId: null, start: null, end: scoringStart, next: { label: c.scoring.label, start: scoringStart } };
    if (d <= scoringEnd) return { ...base, key: 'pontuacao', label: 'Período de pontuação', roundId: null, start: scoringStart, end: scoringEnd, next: { label: rounds[0].label, start: rounds[0].startDate } };
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      if (d >= r.startDate && d <= r.endDate) {
        const nx = rounds[i + 1];
        return { ...base, key: r.kind === 'repescagem' ? 'repescagem' : 'rodada', label: r.label, roundId: r.id, start: r.startDate, end: r.endDate, next: nx ? { label: nx.label, start: nx.startDate } : { label: c.homologation.label, start: homStart } };
      }
    }
    if (d >= homStart && d <= homEnd) return { ...base, key: 'homologacao', label: c.homologation.label, roundId: null, start: homStart, end: homEnd, next: null };
    return { ...base, key: 'encerrada', label: 'Campanha encerrada', roundId: null, start: null, end: null, next: null };
  }

  /** Situação de uma rodada pelo calendário: futura | em_andamento | encerrada */
  function roundTimeStatus(roundId, date) {
    const w = roundWindow(roundId); const d = new Date(date);
    if (!w) return 'inexistente';
    if (d < w.start) return 'futura';
    if (d > w.end) return 'encerrada';
    return 'em_andamento';
  }

  /* ------------------------------------------------------------------
     3. CONSULTAS DE ESTADO
     ------------------------------------------------------------------ */
  const byId = (list, id) => list.find(x => x.id === id) || null;
  function getParticipant(state, id) { return byId(state.participants, id); }
  function getReward(state, id) { return byId(state.rewards, id); }
  function validAwards(state) { return state.awards.filter(a => a.status === 'homologado'); }
  function participantAward(state, pid) { return validAwards(state).find(a => a.participantId === pid) || null; }
  function rewardAward(state, rid) { return validAwards(state).find(a => a.rewardId === rid) || null; }

  function earned(state, pid) { return state.points.filter(p => p.participantId === pid).reduce((s, p) => s + p.points, 0); }
  function consumed(state, pid) { return validAwards(state).filter(a => a.participantId === pid).reduce((s, a) => s + a.points, 0); }
  function balance(state, pid) { return earned(state, pid) - consumed(state, pid); }
  function activeBid(state, pid, roundId) { return state.bids.find(b => b.participantId === pid && b.roundId === roundId && b.status === 'ativo') || null; }
  function activeBids(state, roundId) { return state.bids.filter(b => b.roundId === roundId && b.status === 'ativo'); }
  function bidHistory(state, pid) { return state.bids.filter(b => b.participantId === pid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  function committed(state, pid, roundId) { const b = activeBid(state, pid, roundId); return b ? b.primaryPoints : 0; }
  function lastPointsUpdate(state, pid) {
    const list = state.points.filter(p => p.participantId === pid).map(p => p.updatedAt).sort();
    return list.length ? list[list.length - 1] : null;
  }

  function accountSummary(state, pid, roundId) {
    const e = earned(state, pid), c = consumed(state, pid), bid = activeBid(state, pid, roundId);
    return {
      earned: e, consumed: c, balance: e - c, committed: bid ? bid.primaryPoints : 0,
      potentialAfterWin: bid ? (e - c - bid.primaryPoints) : (e - c),
      bid, award: participantAward(state, pid), lastUpdate: lastPointsUpdate(state, pid)
    };
  }

  /** Disponibilidade de um prêmio na rodada em foco.
   *  status: disponivel | em_breve | arrematado | inativo | encerrado */
  function rewardStatus(state, reward, roundId) {
    if (rewardAward(state, reward.id)) return { status: 'arrematado', label: 'Arrematado' };
    if (!reward.active) return { status: 'inativo', label: 'Indisponível' };
    const r = getRound(roundId);
    const releasedInRound = r && (r.kind === 'repescagem' || reward.releaseRound <= roundId);
    if (!releasedInRound) return { status: 'em_breve', label: `Disponível na ${getRound(reward.releaseRound) ? getRound(reward.releaseRound).label : 'próxima rodada'}` };
    const rs = state.rounds[roundId] ? state.rounds[roundId].status : 'futura';
    if (rs === 'homologada' || rs === 'encerrada') return { status: 'encerrado', label: 'Rodada encerrada' };
    if (rs === 'futura') return { status: 'em_breve', label: 'Aguardando abertura da rodada' };
    return { status: 'disponivel', label: 'Disponível' };
  }
  function isRewardEligible(state, reward, roundId) {
    if (!reward || !reward.active || rewardAward(state, reward.id)) return false;
    const r = getRound(roundId);
    return !!r && (r.kind === 'repescagem' || reward.releaseRound <= roundId);
  }

  function rewardStats(state, rewardId, roundId) {
    // Considera apenas lances de participantes ativos (lances de inativos não disputam)
    const isActive = b => { const p = getParticipant(state, b.participantId); return !!(p && p.active); };
    const bids = activeBids(state, roundId).filter(b => b.primaryRewardId === rewardId && isActive(b));
    return {
      highestPrimary: bids.reduce((m, b) => Math.max(m, b.primaryPoints), 0),
      primaryCount: bids.length,
      secondCount: activeBids(state, roundId).filter(b => b.secondRewardId === rewardId && isActive(b)).length
    };
  }
  function rewardHasAnyBid(state, rewardId) {
    return state.bids.some(b => b.primaryRewardId === rewardId || b.secondRewardId === rewardId);
  }

  /* ------------------------------------------------------------------
     4. ELEGIBILIDADE PARA LANCE
     ------------------------------------------------------------------ */
  function canBid(state, pid, now) {
    const p = getParticipant(state, pid);
    const roundId = state.currentRoundId;
    const round = getRound(roundId);
    const rs = state.rounds[roundId] ? state.rounds[roundId].status : 'futura';
    if (!p) return { ok: false, code: 'sem_cadastro', message: 'Seu cadastro não foi localizado nesta campanha. Procure a gestão.' };
    if (!p.active) return { ok: false, code: 'inativo', message: 'Seu cadastro está inativo. Procure a gestão da campanha para regularizar.' };
    const award = participantAward(state, pid);
    if (award) return { ok: false, code: 'contemplado', message: `Você já foi contemplado com ${(getReward(state, award.rewardId) || {}).name || 'um prêmio'}. Cada participante pode conquistar somente um prêmio.` };
    if (!round) return { ok: false, code: 'sem_rodada', message: 'Nenhuma rodada configurada.' };
    if (rs === 'futura') return { ok: false, code: 'rodada_futura', message: `A ${round.label} ainda não foi aberta.` };
    if (rs !== 'aberta') return { ok: false, code: 'rodada_encerrada', message: `A ${round.label} está encerrada para lances.` };
    const t = roundTimeStatus(roundId, now);
    if (t === 'futura') return { ok: false, code: 'fora_periodo', message: `A ${round.label} começa em ${fmtDate(roundWindow(roundId).start)}.` };
    if (t === 'encerrada') return { ok: false, code: 'fora_periodo', message: `O prazo da ${round.label} terminou em ${fmtDate(roundWindow(roundId).end)}, às 23h59.` };
    return { ok: true, round };
  }

  /** Valida o lance completo. Retorna erros por campo para a interface. */
  function validateBid(state, pid, input, now) {
    const errors = {};
    const gate = canBid(state, pid, now);
    if (!gate.ok) return { ok: false, errors: { form: gate.message }, code: gate.code };
    const roundId = state.currentRoundId;
    const bal = balance(state, pid);
    const primary = getReward(state, input.primaryRewardId);
    let primaryPoints = null, secondPoints = null, second = null;

    if (!input.primaryRewardId) errors.primaryRewardId = 'Selecione o prêmio principal.';
    else if (!primary) errors.primaryRewardId = 'Prêmio não localizado.';
    else if (!isRewardEligible(state, primary, roundId)) errors.primaryRewardId = `${primary.name} não está disponível nesta rodada.`;

    if (primary && !errors.primaryRewardId) {
      const r = V().validateBidAmount(input.primaryPoints, primary.minBid);
      if (!r.ok) errors.primaryPoints = r.error;
      else if (r.value > bal) errors.primaryPoints = `O valor informado supera seu saldo disponível de ${fmtInt(bal)} pontos.`;
      else primaryPoints = r.value;
    } else if (input.primaryPoints === '' || input.primaryPoints == null) {
      errors.primaryPoints = errors.primaryPoints || 'Informe os pontos do lance principal.';
    }

    const hasSecond = !!input.secondRewardId;
    if (hasSecond) {
      second = getReward(state, input.secondRewardId);
      if (!second) errors.secondRewardId = 'Prêmio não localizado.';
      else if (input.secondRewardId === input.primaryRewardId) errors.secondRewardId = 'A segunda opção precisa ser diferente do prêmio principal.';
      else if (!isRewardEligible(state, second, roundId)) errors.secondRewardId = `${second.name} não está disponível nesta rodada.`;
      if (second && !errors.secondRewardId) {
        const r = V().validateBidAmount(input.secondPoints, second.minBid);
        if (!r.ok) errors.secondPoints = r.error;
        else if (r.value > bal) errors.secondPoints = `O valor informado supera seu saldo disponível de ${fmtInt(bal)} pontos.`;
        else secondPoints = r.value;
      }
    } else if (input.secondPoints !== '' && input.secondPoints != null && Number(input.secondPoints) !== 0) {
      errors.secondRewardId = 'Selecione o prêmio da segunda opção ou apague os pontos informados.';
    }

    if (Object.keys(errors).length) return { ok: false, errors };
    return {
      ok: true, errors: {},
      value: { roundId, primaryRewardId: primary.id, primaryPoints, secondRewardId: hasSecond ? second.id : null, secondPoints: hasSecond ? secondPoints : null, balance: bal, potentialAfterWin: bal - primaryPoints }
    };
  }

  /** Aplica o lance (muta o estado recebido). A versão anterior vira "substituído". */
  function applyBid(state, pid, value, nowISO, newId) {
    const prev = activeBid(state, pid, value.roundId);
    let version = 1;
    if (prev) { prev.status = 'substituido'; prev.replacedAt = nowISO; version = prev.version + 1; }
    const bid = {
      id: newId, roundId: value.roundId, participantId: pid,
      primaryRewardId: value.primaryRewardId, primaryPoints: value.primaryPoints,
      secondRewardId: value.secondRewardId, secondPoints: value.secondPoints,
      createdAt: nowISO, version, status: 'ativo', replacedAt: null, previousId: prev ? prev.id : null
    };
    state.bids.push(bid);
    return { bid, previous: prev };
  }

  /* ------------------------------------------------------------------
     5. HOMOLOGAÇÃO — determinística, não depende da ordem dos arrays
     ------------------------------------------------------------------ */
  function compareOffers(a, b) {
    if (b.points !== a.points) return b.points - a.points;           // 1º maior pontuação
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1; // 2º registro mais antigo
    return a.email < b.email ? -1 : a.email > b.email ? 1 : 0;        // 3º critério técnico: e-mail A-Z
  }
  function tieCriterion(a, b) {
    if (a.points !== b.points) return null;
    return a.createdAt !== b.createdAt ? 'registro_mais_antigo' : 'email_alfabetico_tecnico';
  }
  const TIE_LABEL = { registro_mais_antigo: 'lance registrado primeiro', email_alfabetico_tecnico: 'e-mail em ordem alfabética (critério técnico da demonstração — validar com o negócio)' };

  /** Assinatura dos lances ativos + prêmios + prêmios arrematados: se mudar
   *  entre a prévia e a confirmação, a confirmação é bloqueada. */
  function homologationSignature(state, roundId) {
    const bids = activeBids(state, roundId).map(b => [b.id, b.primaryRewardId, b.primaryPoints, b.secondRewardId, b.secondPoints].join(':')).sort();
    const parts = state.participants.map(p => p.id + (p.active ? 'A' : 'I')).sort();
    const rw = state.rewards.map(r => r.id + (r.active ? 'A' : 'I') + r.minBid + r.releaseRound).sort();
    const aw = validAwards(state).map(a => a.id).sort();
    const pts = state.points.map(p => p.participantId + p.month + p.points).sort();
    return hash([roundId, bids, parts, rw, aw, pts].map(x => [].concat(x).join('|')).join('#'));
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

  function computeHomologation(state, roundId, nowISO) {
    const round = getRound(roundId);
    if (!round) throw new Error('Rodada inexistente.');
    const eligibleRewards = state.rewards.filter(r => isRewardEligible(state, r, roundId)).sort((a, b) => a.order - b.order);
    const eligibleIds = new Set(eligibleRewards.map(r => r.id));
    const bids = activeBids(state, roundId);
    const priorWinners = new Set(validAwards(state).map(a => a.participantId));
    const notConsidered = [];
    const winners = [];
    const ties = [];
    const wonPids = new Set(), wonRewards = new Set();

    const emailOf = pid => (getParticipant(state, pid) || {}).email || '';
    const offerFrom = (b, type) => ({
      bidId: b.id, participantId: b.participantId, email: emailOf(b.participantId), type,
      rewardId: type === 'principal' ? b.primaryRewardId : b.secondRewardId,
      points: type === 'principal' ? b.primaryPoints : b.secondPoints, createdAt: b.createdAt
    });

    function eligibility(o) {
      const p = getParticipant(state, o.participantId);
      const rw = getReward(state, o.rewardId);
      if (!p) return 'Participante não localizado.';
      if (!p.active) return 'Participante inativo.';
      if (priorWinners.has(p.id)) return 'Participante já contemplado em rodada anterior.';
      if (!rw) return 'Prêmio não localizado.';
      if (!eligibleIds.has(o.rewardId)) return rewardAward(state, o.rewardId) ? 'Prêmio já arrematado em rodada anterior.' : 'Prêmio não liberado ou inativo nesta rodada.';
      if (!Number.isInteger(o.points) || o.points <= 0 || o.points % cfg().rules.bidIncrement !== 0) return 'Valor do lance inválido (incremento).';
      if (o.points < rw.minBid) return `Abaixo do lance mínimo (${fmtInt(rw.minBid)}).`;
      if (o.points > balance(state, p.id)) return `Saldo insuficiente na homologação (saldo ${fmtInt(balance(state, p.id))}).`;
      return null;
    }

    function runPhase(type) {
      const offers = bids.filter(b => type === 'principal' || b.secondRewardId).map(b => offerFrom(b, type));
      const valid = [];
      for (const o of offers) {
        const why = eligibility(o);
        if (why) { notConsidered.push({ ...o, reason: why }); continue; }
        if (type === 'segunda_opcao') {
          if (wonPids.has(o.participantId)) { notConsidered.push({ ...o, reason: 'Participante contemplado no lance principal; segunda opção descartada.' }); continue; }
          if (wonRewards.has(o.rewardId)) { notConsidered.push({ ...o, reason: 'Prêmio já arrematado por um lance principal.' }); continue; }
        }
        valid.push(o);
      }
      const groups = {};
      valid.forEach(o => { (groups[o.rewardId] = groups[o.rewardId] || []).push(o); });
      Object.keys(groups).sort((a, b) => (getReward(state, a).order - getReward(state, b).order)).forEach(rid => {
        const list = groups[rid].slice().sort(compareOffers);
        const win = list[0];
        let tie = null;
        if (list[1]) {
          const crit = tieCriterion(list[0], list[1]);
          if (crit) {
            const tiedWith = list.filter(o => o.points === win.points).map(o => o.participantId);
            tie = { rewardId: rid, type, points: win.points, criterion: crit, criterionLabel: TIE_LABEL[crit], participants: tiedWith, winnerId: win.participantId };
            ties.push(tie);
          }
        }
        wonPids.add(win.participantId); wonRewards.add(rid);
        const reason = (type === 'principal' ? 'Maior lance principal elegível' : 'Maior segunda opção elegível para prêmio sem vencedor') +
          (tie ? `; empate de ${fmtInt(win.points)} pontos resolvido por ${TIE_LABEL[tie.criterion]}.` : '.');
        winners.push({ rewardId: rid, participantId: win.participantId, points: win.points, type, bidId: win.bidId, reason, tie });
        list.slice(1).forEach(o => notConsidered.push({ ...o, reason: o.points === win.points ? `Empate perdido por ${TIE_LABEL[tieCriterion(win, o) || 'registro_mais_antigo']}.` : `Superado por lance de ${fmtInt(win.points)} pontos.` }));
      });
    }
    runPhase('principal');
    runPhase('segunda_opcao');

    // Conflitos: participante que lidera mais de um prêmio antes da resolução
    const leaders = {};
    eligibleRewards.forEach(rw => {
      const offers = [];
      bids.forEach(b => {
        if (b.primaryRewardId === rw.id) offers.push(offerFrom(b, 'principal'));
        if (b.secondRewardId === rw.id) offers.push(offerFrom(b, 'segunda_opcao'));
      });
      const ok = offers.filter(o => !eligibility(o)).sort(compareOffers);
      if (ok[0]) (leaders[ok[0].participantId] = leaders[ok[0].participantId] || []).push({ rewardId: rw.id, type: ok[0].type, points: ok[0].points });
    });
    const conflicts = Object.entries(leaders).filter(([, l]) => l.length > 1).map(([pid, l]) => {
      const w = winners.find(x => x.participantId === pid);
      return { participantId: pid, leads: l, resolution: w ? `Contemplado somente com ${getReward(state, w.rewardId).name} (${w.type === 'principal' ? 'lance principal' : 'segunda opção'}). Limite de um prêmio por participante.` : 'Não contemplado.' };
    });

    // Prêmios sem lance principal ELEGÍVEL (lances de inativos etc. não contam)
    const primaryRewardIds = new Set(winners.filter(w => w.type === 'principal').map(w => w.rewardId));
    const notConsideredSorted = notConsidered.sort((a, b) => a.type.localeCompare(b.type) || (getReward(state, a.rewardId) || { order: 99 }).order - (getReward(state, b.rewardId) || { order: 99 }).order || compareOffers(a, b));
    return {
      roundId, generatedAt: nowISO, signature: homologationSignature(state, roundId),
      eligibleRewardIds: eligibleRewards.map(r => r.id),
      winners, ties, conflicts, notConsidered: notConsideredSorted,
      rewardsWithoutPrimary: eligibleRewards.filter(r => !primaryRewardIds.has(r.id)).map(r => r.id),
      rewardsWithoutWinner: eligibleRewards.filter(r => !wonRewards.has(r.id)).map(r => r.id),
      onlySecondOption: winners.filter(w => w.type === 'segunda_opcao').map(w => w.rewardId),
      alreadyAwardedParticipants: [...priorWinners],
      participantsWithBid: new Set(bids.map(b => b.participantId)).size,
      bidCount: bids.length
    };
  }

  /* ------------------------------------------------------------------
     6. INDICADORES E INCONSISTÊNCIAS (gestão)
     ------------------------------------------------------------------ */
  function inconsistencies(state) {
    const out = [];
    const pids = new Set(state.participants.map(p => p.id));
    const emails = {};
    state.participants.forEach(p => {
      emails[p.email] = (emails[p.email] || 0) + 1;
      if (!cfg().locations.some(l => l.id === p.location)) out.push({ kind: 'cadastro', severity: 'warning', entity: p.id, message: `${p.name}: localidade não configurada.` });
      if (!V().validateEmail(p.email).ok) out.push({ kind: 'cadastro', severity: 'error', entity: p.id, message: `${p.name}: e-mail inválido.` });
      if (p.active && !state.points.some(x => x.participantId === p.id)) out.push({ kind: 'cadastro', severity: 'warning', entity: p.id, message: `${p.name}: participante ativo sem nenhuma pontuação lançada.` });
      if (balance(state, p.id) < 0) out.push({ kind: 'saldo', severity: 'error', entity: p.id, message: `${p.name}: saldo negativo (${fmtInt(balance(state, p.id))} pontos).` });
    });
    Object.entries(emails).filter(([, n]) => n > 1).forEach(([e]) => out.push({ kind: 'cadastro', severity: 'error', entity: e, message: `E-mail duplicado no cadastro: ${e}.` }));
    const seen = {};
    state.points.forEach(x => {
      if (!pids.has(x.participantId)) out.push({ kind: 'saldo', severity: 'error', entity: x.participantId, message: `Pontuação de ${x.month} vinculada a participante inexistente (${x.participantId}).` });
      const k = x.participantId + x.month; if (seen[k]) out.push({ kind: 'saldo', severity: 'error', entity: x.participantId, message: `Mês ${x.month} lançado em duplicidade para ${x.participantId}.` }); seen[k] = 1;
      try { if (calcPoints(x.achievement) !== x.points) out.push({ kind: 'saldo', severity: 'error', entity: x.participantId, message: `Pontos de ${x.month} não conferem com o atingimento (${x.participantId}).` }); } catch (e) { out.push({ kind: 'saldo', severity: 'error', entity: x.participantId, message: `Atingimento inválido em ${x.month} (${x.participantId}).` }); }
    });
    activeBids(state, state.currentRoundId).forEach(b => {
      const p = getParticipant(state, b.participantId);
      if (!p) return;
      if (!p.active) out.push({ kind: 'lance', severity: 'warning', entity: p.id, message: `${p.name} está inativo e possui lance ativo (não será considerado na homologação).` });
      if (b.primaryPoints > balance(state, p.id)) out.push({ kind: 'saldo', severity: 'error', entity: p.id, message: `${p.name}: lance principal de ${fmtInt(b.primaryPoints)} acima do saldo atual (${fmtInt(balance(state, p.id))}).` });
    });
    return out;
  }

  function adminOverview(state, now) {
    const roundId = state.currentRoundId;
    const active = state.participants.filter(p => p.active);
    const bids = activeBids(state, roundId);
    const withBid = new Set(bids.map(b => b.participantId));
    const distributed = state.participants.reduce((s, p) => s + earned(state, p.id), 0);
    const used = state.participants.reduce((s, p) => s + consumed(state, p.id), 0);
    const statuses = state.rewards.map(r => rewardStatus(state, r, roundId).status);
    return {
      participants: state.participants.length, active: active.length, inactive: state.participants.length - active.length,
      distributed, used, available: distributed - used, activeBids: bids.length,
      withoutBid: active.filter(p => !withBid.has(p.id) && !participantAward(state, p.id)).length,
      rewardsAvailable: statuses.filter(s => s === 'disponivel').length,
      rewardsAwarded: validAwards(state).length,
      rewardsTotal: state.rewards.length,
      round: getRound(roundId), roundStatus: (state.rounds[roundId] || {}).status,
      phase: getCampaignPhase(now),
      inconsistencies: inconsistencies(state).length
    };
  }

  /** Campos de prêmio que podem ser alterados conforme existência de lances. */
  function rewardEditPolicy(state, rewardId) {
    const hasBid = rewardHasAnyBid(state, rewardId);
    const awarded = !!rewardAward(state, rewardId);
    return {
      hasBid, awarded,
      name: !awarded, description: true, icon: true, order: true,
      minBid: !hasBid && !awarded, releaseRound: !hasBid && !awarded,
      deactivate: awarded ? 'bloqueado' : hasBid ? 'com_justificativa' : 'livre'
    };
  }

  /* ------------------------------------------------------------------
     Formatação compartilhada (pura)
     ------------------------------------------------------------------ */
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function fmtDate(d) { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

  LNA.domain = {
    calcPoints, getCampaignPhase, roundTimeStatus, roundWindow, getRound, dayStart, dayEnd,
    getParticipant, getReward, participantAward, rewardAward, validAwards,
    earned, consumed, balance, committed, activeBid, activeBids, bidHistory, accountSummary, lastPointsUpdate,
    rewardStatus, isRewardEligible, rewardStats, rewardHasAnyBid, rewardEditPolicy,
    canBid, validateBid, applyBid,
    compareOffers, computeHomologation, homologationSignature, TIE_LABEL,
    inconsistencies, adminOverview
  };
})(typeof window !== 'undefined' ? window : globalThis);
