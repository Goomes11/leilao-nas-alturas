/* ==========================================================================
   domain.tests.js — Testes automatizados das regras de negócio
   Executar:  node tests/run-node.js     ou abra tests/index.html no navegador
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA;
  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });
  const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'Asserção falhou'); };
  const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || 'Valores diferentes'}: esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); };
  const rejects = async (p, code, msg) => {
    try { await p; } catch (e) { if (code && e.code !== code) throw new Error(`${msg || 'Erro'}: código esperado ${code}, obtido ${e.code} (${e.message})`); return e; }
    throw new Error((msg || 'Esperava rejeição') + ' — a chamada foi aceita.');
  };

  const D = LNA.domain;
  const ROUND1 = new Date(2027, 11, 2, 10, 0); // 02/12/2027 10h
  function svc(mutate, when = ROUND1) {
    const st = LNA.mockData.create();
    if (mutate) mutate(st);
    const s = LNA.services.createDemoService({ latencyMs: 0, persist: false, now: () => when });
    s.init(st);
    return s;
  }
  const asOperator = (s, pid) => { const st = s._state(); st.settings.role = 'operador'; st.settings.participantId = pid; };
  const asAdmin = s => { s._state().settings.role = 'gestao'; };

  /* ---------------- Pontuação ---------------- */
  test('Regra de pontuação: exemplos do enunciado', () => {
    [[99.9, 0], [100, 0], [100.9, 0], [101, 10], [102.8, 20], [108, 80], [114, 140], [0, 0]].forEach(([p, e]) => eq(D.calcPoints(p), e, `calcPoints(${p})`));
  });
  test('Regra de pontuação: rejeita negativo e não numérico', () => {
    let ok = 0; try { D.calcPoints(-1); } catch (e) { ok++; } try { D.calcPoints('abc'); } catch (e) { ok++; } eq(ok, 2);
  });
  test('Conversão decimal brasileira', () => {
    const V = LNA.validators;
    eq(V.parseDecimalBR('108,5').value, 108.5); eq(V.parseDecimalBR('1.234,5').value, 1234.5); eq(V.parseDecimalBR('108.5').value, 108.5);
    assert(!V.parseDecimalBR('10a').ok, 'texto inválido'); assert(!V.parseDecimalBR('').ok, 'vazio'); assert(!V.validateAchievement('-3').ok, 'negativo');
  });

  /* ---------------- Calendário ---------------- */
  test('Fases da campanha pela data', () => {
    eq(D.getCampaignPhase(new Date(2026, 10, 1)).key, 'antes_pontuacao');
    eq(D.getCampaignPhase(new Date(2027, 5, 1)).key, 'pontuacao');
    eq(D.getCampaignPhase(new Date(2027, 11, 3, 23, 59)).roundId, 1);
    eq(D.getCampaignPhase(new Date(2027, 11, 4, 0, 1)).roundId, 2);
    eq(D.getCampaignPhase(new Date(2027, 11, 12)).key, 'repescagem');
    eq(D.getCampaignPhase(new Date(2027, 11, 14)).key, 'homologacao');
    eq(D.getCampaignPhase(new Date(2027, 11, 20)).key, 'encerrada');
  });

  /* ---------------- Lances ---------------- */
  test('Lance válido é registrado e saldo não é consumido', async () => {
    const s = svc(); asOperator(s, 'P001');
    const r = await s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000, secondRewardId: '', secondPoints: '' }, 'req-1');
    eq(r.bid.version, 1); eq(D.balance(s._state(), 'P001'), 1540, 'saldo continua igual até a homologação');
  });
  test('Incremento inválido é rejeitado', async () => {
    const s = svc(); asOperator(s, 'P001');
    const e = await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 905 }), 'validacao'); assert(e.details.primaryPoints.includes('múltiplos de 10'));
  });
  test('Lance abaixo do mínimo, zero e negativo são rejeitados', async () => {
    const s = svc(); asOperator(s, 'P001');
    await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 800 }), 'validacao');
    await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 0 }), 'validacao');
    await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: -10 }), 'validacao');
  });
  test('Lance maior que o saldo é rejeitado com mensagem específica', async () => {
    const s = svc(); asOperator(s, 'P001');
    const e = await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1600 }), 'validacao');
    assert(e.details.primaryPoints.includes('1.540'), e.details.primaryPoints);
  });
  test('Segunda opção igual à primeira é rejeitada', async () => {
    const s = svc(); asOperator(s, 'P001');
    const e = await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000, secondRewardId: 'R02', secondPoints: 900 }), 'validacao');
    assert(e.details.secondRewardId, 'erro no campo da segunda opção');
  });
  test('Participante inativo não pode dar lance', async () => {
    const s = svc(); asOperator(s, 'P006');
    const e = await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000 }), 'validacao'); assert(/inativo/.test(e.message));
  });
  test('Prêmio de rodada futura (fechado) é rejeitado', async () => {
    const s = svc(); asOperator(s, 'P001');
    const e = await rejects(s.submitBid({ primaryRewardId: 'R04', primaryPoints: 800 }), 'validacao'); assert(e.details.primaryRewardId);
  });
  test('Rodada encerrada pelo calendário bloqueia lances', async () => {
    const s = svc(null, new Date(2027, 11, 4, 9)); asOperator(s, 'P001');
    const e = await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000 }), 'validacao'); assert(/prazo/.test(e.message), e.message);
  });
  test('Atualização substitui o lance e mantém histórico', async () => {
    const s = svc(); asOperator(s, 'P001');
    await s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000 }, 'a');
    const r = await s.submitBid({ primaryRewardId: 'R03', primaryPoints: 1100, secondRewardId: 'R02', secondPoints: 900 }, 'b');
    eq(r.updated, true); eq(r.bid.version, 2);
    const mine = s._state().bids.filter(b => b.participantId === 'P001');
    eq(mine.length, 2); eq(mine.filter(b => b.status === 'ativo').length, 1, 'somente um lance ativo');
  });
  test('Duas submissões quase simultâneas: a segunda é bloqueada', async () => {
    const st = LNA.mockData.create(); st.settings.participantId = 'P001';
    const s = LNA.services.createDemoService({ latencyMs: 30, persist: false, now: () => ROUND1 }); s.init(st);
    const p1 = s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000 }, 'x1');
    const p2 = s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1010 }, 'x2').then(() => null, e => e);
    await p1; const e = await p2;
    assert(e && e.code === 'duplicado', 'segunda submissão deveria ser bloqueada');
    eq(s._state().bids.filter(b => b.participantId === 'P001').length, 1, 'apenas um lance gravado');
  });
  test('Mesmo requestId reenviado é rejeitado (idempotência)', async () => {
    const s = svc(); asOperator(s, 'P001');
    await s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000 }, 'same');
    await rejects(s.submitBid({ primaryRewardId: 'R02', primaryPoints: 1000 }, 'same'), 'duplicado');
  });
  test('Operador não acessa dados de outros participantes', async () => {
    const s = svc(); asOperator(s, 'P001');
    const d = await s.getOperatorDashboard();
    const json = JSON.stringify(d);
    ['operador2@exemplo.test', 'Marina', 'rafael.costa', 'P004', 'P002'].forEach(t => assert(!json.includes(t), 'vazou ' + t));
    await rejects(s.getParticipants(), 'sem_permissao'); await rejects(s.getBids(), 'sem_permissao');
  });

  /* ---------------- Homologação ---------------- */
  test('Homologação dos dados iniciais: empate, segunda opção, inativo', () => {
    const st = LNA.mockData.create();
    const p = D.computeHomologation(st, 1, ROUND1.toISOString());
    const w = Object.fromEntries(p.winners.map(x => [x.rewardId, x]));
    eq(w.R01.participantId, 'P002', 'Smart TV para Marina (empate por horário)'); eq(w.R01.tie.criterion, 'registro_mais_antigo');
    eq(w.R03.participantId, 'P005', 'Notebook para Beatriz');
    eq(w.R02.participantId, 'P004', 'Bicicleta para Rafael'); eq(w.R02.type, 'segunda_opcao', 'recebida somente como segunda opção');
    assert(p.notConsidered.some(n => n.participantId === 'P006' && /inativo/.test(n.reason)), 'inativo desconsiderado');
    assert(!p.winners.some(x => x.participantId === 'P003'), 'Lucas não contemplado');
    eq(p.rewardsWithoutPrimary.includes('R02'), true, 'Bicicleta sem lance principal elegível (só o do inativo)') ;
  });
  test('Prêmio sem lance principal fica sem vencedor', () => {
    const st = LNA.mockData.create(); st.bids = [];
    const p = D.computeHomologation(st, 1, ROUND1.toISOString());
    eq(p.winners.length, 0); eq(p.rewardsWithoutWinner.length, 3);
  });
  test('Empate exato (mesmo horário) usa e-mail como critério técnico', () => {
    const st = LNA.mockData.create();
    const t = new Date(2027, 11, 1, 12).toISOString();
    st.bids = [
      { id: 'X1', roundId: 1, participantId: 'P004', primaryRewardId: 'R01', primaryPoints: 1000, secondRewardId: null, secondPoints: null, createdAt: t, version: 1, status: 'ativo' },
      { id: 'X2', roundId: 1, participantId: 'P002', primaryRewardId: 'R01', primaryPoints: 1000, secondRewardId: null, secondPoints: null, createdAt: t, version: 1, status: 'ativo' }
    ];
    const p = D.computeHomologation(st, 1, t);
    eq(p.winners[0].participantId, 'P002', 'operador2@ < rafael.costa@'); eq(p.ties[0].criterion, 'email_alfabetico_tecnico');
  });
  test('Resultado não depende da ordem do array', () => {
    const a = LNA.mockData.create(), b = LNA.mockData.create(); b.bids.reverse(); b.participants.reverse(); b.rewards.reverse();
    const ra = D.computeHomologation(a, 1, 'x').winners.map(w => w.rewardId + w.participantId).sort().join();
    const rb = D.computeHomologation(b, 1, 'x').winners.map(w => w.rewardId + w.participantId).sort().join();
    eq(ra, rb);
  });
  test('Conflito: participante lidera mais de um prêmio', () => {
    const st = LNA.mockData.create();
    st.bids.push({ id: 'X9', roundId: 1, participantId: 'P001', primaryRewardId: 'R01', primaryPoints: 1200, secondRewardId: 'R03', secondPoints: 1200, createdAt: new Date(2027, 11, 2).toISOString(), version: 1, status: 'ativo' });
    const p = D.computeHomologation(st, 1, 'x');
    const c = p.conflicts.find(x => x.participantId === 'P001');
    assert(c && c.leads.length === 2, 'conflito detectado'); eq(p.winners.filter(w => w.participantId === 'P001').length, 1, 'somente um prêmio');
  });
  test('Participante já contemplado não é elegível novamente', () => {
    const st = LNA.mockData.create();
    st.awards.push({ id: 'W1', roundId: 1, participantId: 'P002', rewardId: 'R10', points: 300, type: 'principal', status: 'homologado' });
    const p = D.computeHomologation(st, 1, 'x');
    assert(!p.winners.some(w => w.participantId === 'P002')); assert(p.notConsidered.some(n => n.participantId === 'P002' && /contemplado/.test(n.reason)));
  });
  test('Fluxo completo: prévia, confirmação, bloqueio de duplicidade, próxima rodada', async () => {
    const s = svc(); asAdmin(s);
    await rejects(s.confirmHomologation(1, 'abc'), 'sem_previa', 'sem prévia');
    const prev = await s.simulateHomologation();
    const h = await s.confirmHomologation(1, prev.signature, 'ok');
    eq(h.winners, 3);
    await rejects(s.confirmHomologation(1, prev.signature), 'ja_homologada', 'segunda homologação');
    await rejects(s.simulateHomologation(), 'ja_homologada');
    eq(D.balance(s._state(), 'P002'), 1300 - 1000, 'pontos consumidos após homologação');
    await s.openNextRound({ moveClock: false });
    eq(s._state().currentRoundId, 2);
  });
  test('Prévia desatualizada (novo lance após simular) bloqueia confirmação', async () => {
    const s = svc(); asAdmin(s);
    const prev = await s.simulateHomologation();
    asOperator(s, 'P001'); await s.submitBid({ primaryRewardId: 'R01', primaryPoints: 1200 }, 'late');
    asAdmin(s); await rejects(s.confirmHomologation(1, prev.signature), 'previa_desatualizada');
  });
  test('Participante contemplado não pode dar novo lance', async () => {
    const s = svc(); asAdmin(s);
    const prev = await s.simulateHomologation(); await s.confirmHomologation(1, prev.signature); await s.openNextRound({ moveClock: false });
    const s2 = s; s2._state().settings.clockMode = 'real';
    asOperator(s2, 'P002');
    const e = await rejects(s2.submitBid({ primaryRewardId: 'R04', primaryPoints: 800 }), 'validacao'); assert(/contemplado/.test(e.message), e.message);
  });
  test('Prêmio arrematado não recebe lances', () => {
    const st = LNA.mockData.create(); st.awards.push({ id: 'W', roundId: 1, participantId: 'P004', rewardId: 'R01', points: 1000, status: 'homologado' });
    eq(D.isRewardEligible(st, D.getReward(st, 'R01'), 1), false);
  });
  test('Reversão exige justificativa e reabre para nova homologação', async () => {
    const s = svc(); asAdmin(s);
    const prev = await s.simulateHomologation(); await s.confirmHomologation(1, prev.signature);
    await rejects(s.revertHomologation(1, 'curta'), 'validacao');
    await s.revertHomologation(1, 'Erro de pontuação identificado na auditoria');
    eq(s._state().rounds[1].status, 'encerrada'); eq(D.validAwards(s._state()).length, 0);
  });

  /* ---------------- Gestão ---------------- */
  test('E-mail duplicado é rejeitado no cadastro', async () => {
    const s = svc(); asAdmin(s);
    const e = await rejects(s.saveParticipant({ name: 'Teste Duplicado', email: 'OPERADOR1@exemplo.test', location: 'aracaju', active: true }), 'validacao');
    assert(e.details.email);
  });
  test('Alterar mínimo de prêmio com lance é bloqueado; sem lance é permitido', async () => {
    const s = svc(); asAdmin(s);
    const r1 = D.getReward(s._state(), 'R01');
    await rejects(s.saveReward({ ...r1, minBid: 1100 }), 'bloqueado');
    const r4 = D.getReward(s._state(), 'R04');
    const ok = await s.saveReward({ ...r4, minBid: 820 }); eq(ok.minBid, 820);
  });
  test('Importação CSV: válidos, inválidos, duplicados e inexistentes', async () => {
    const s = svc(); asAdmin(s);
    const csv = 'nome;email;mes;atingimento\nAlex Silva;operador1@exemplo.test;2027-01;120,5\nAlex Silva;operador1@exemplo.test;01/2027;121\nNinguém;nao.existe@exemplo.test;2027-02;110\nMarina Souza;operador2@exemplo.test;2027-02;-5\nMarina Souza;operador2@exemplo.test;2027-03;abc';
    const p = await s.previewPointsImport(csv);
    eq(p.totals.valid, 1); eq(p.totals.duplicated, 1); eq(p.totals.invalid, 3); eq(p.totals.points, 200);
    await s.confirmPointsImport(p.token);
    eq(s._state().points.find(x => x.participantId === 'P001' && x.month === '2027-01').points, 200);
    await rejects(s.confirmPointsImport(p.token), 'previa_expirada');
  });
  test('Importação CSV: cabeçalho inválido', async () => {
    const s = svc(); asAdmin(s);
    await rejects(s.previewPointsImport('email;valor\na@b.test;1'), 'validacao');
  });
  test('Alteração manual de pontuação gera auditoria', async () => {
    const s = svc(); asAdmin(s);
    const n = s._state().audit.length;
    await s.savePoints({ participantId: 'P001', month: '2027-05', achievement: '103,7' });
    eq(s._state().audit.length, n + 1); eq(s._state().audit[0].action, 'atualizacao_pontuacao');
  });
  test('Backup: exporta, valida e rejeita conteúdo inválido', async () => {
    const s = svc(); asAdmin(s);
    const b = await s.exportBackup();
    const sum = await s.previewBackup(b.content); eq(sum.participants, 10);
    await rejects(s.previewBackup('{"format":"outro"}'), 'validacao');
    await rejects(s.previewBackup('{corrompido'), 'validacao');
  });
  test('Armazenamento: estado inválido é detectado', () => {
    const probs = LNA.storage.validateState({ schemaVersion: 2, participants: 'x' });
    assert(probs.length > 0);
  });
  test('Migração do protótipo original (schema v1)', () => {
    const old = { round: 1, status: 'ABERTA', people: [{ email: 'operador1@exemplo.test', nome: 'Alex Silva', site: 'Aracaju', ativo: 'SIM' }], points: [{ email: 'operador1@exemplo.test', mes: '2027-01', atingimento: 114, pontos: 140 }], prizes: [{ id: 'PR01', titulo: 'Smart TV', minimo: 1000, abertura: 1, ativo: true }], offers: [{ round: 1, email: 'operador1@exemplo.test', primary: 'PR01', points: 1000, alternative: '', alternativePoints: 0, time: '2027-12-01T10:00:00.000Z', status: 'ATIVO' }], winners: [] };
    const st = LNA.storage.migrateFromLegacy(old);
    eq(st.participants[0].location, 'aracaju'); eq(st.bids[0].primaryRewardId, 'R01'); eq(LNA.storage.validateState(st).length, 0);
  });
  test('Modo de erro simulado retorna mensagem amigável', async () => {
    const s = svc(s0 => { s0.settings.errorMode = true; }); asAdmin(s);
    const e = await rejects(s.getParticipants(), 'servico_indisponivel'); assert(!/at\s+\w+\s+\(/.test(e.message), 'sem stack trace');
  });
  test('CSV exportado neutraliza fórmulas', () => {
    const csv = LNA.validators.toCSV(['a'], [['=SOMA(1)'], ['+1'], ['normal']]);
    assert(csv.includes("'=SOMA(1)") && csv.includes("'+1"));
  });

  async function run(log = console.log) {
    let pass = 0, fail = 0; const results = [];
    for (const t of tests) {
      try { await t.fn(); pass++; results.push({ name: t.name, ok: true }); log('✔ ' + t.name); }
      catch (e) { fail++; results.push({ name: t.name, ok: false, error: e.message }); log('✘ ' + t.name + '\n    ' + e.message); }
    }
    log(`\n${pass} aprovados, ${fail} reprovados, ${tests.length} no total.`);
    return { pass, fail, results };
  }
  root.LNA_TESTS = { run, count: () => tests.length };
})(typeof window !== 'undefined' ? window : globalThis);
