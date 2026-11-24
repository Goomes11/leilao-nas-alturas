/* ==========================================================================
   config.js — Configuração central do Leilão nas Alturas | GOL 2027
   Datas, rodadas, localidades, regras numéricas e chaves de armazenamento
   ficam SOMENTE aqui. Nenhum outro arquivo deve repetir esses valores.
   Os scripts são clássicos (não ES modules) para que a demonstração abra
   com duplo clique (file://), onde módulos ES são bloqueados pelo navegador.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};

  const config = {
    app: {
      name: 'Leilão nas Alturas',
      campaign: 'Leilão nas Alturas | GOL 2027',
      environmentLabel: 'Ambiente interno GOL',
      fullTitle: 'Leilão nas Alturas | Ambiente interno GOL',
      locale: 'pt-BR',
      timeZoneLabel: 'horário de Brasília'
    },

    /* Regras numéricas */
    rules: {
      bidIncrement: 10,           // incremento obrigatório do lance
      pointsPerPercent: 10,       // cada p.p. inteiro acima de 100% gera 10 pontos
      targetPercent: 100,         // meta
      maxAchievementPercent: 500, // teto de sanidade para atingimento
      maxRewardsPerParticipant: 1,
      minRewardBid: 10
    },

    /* Localidades — adicione novas entradas aqui (id estável + rótulo) */
    locations: [
      { id: 'aracaju', label: 'Aracaju' },
      { id: 'maceio', label: 'Maceió' },
      { id: 'montes-claros', label: 'Montes Claros' },
      { id: 'outro', label: 'Outro' }
    ],

    /* Calendário oficial (datas locais, horário de Brasília).
       start/end são inclusivos: end vale até 23:59:59. */
    calendar: {
      scoring: { start: '2027-01-01', end: '2027-11-30', label: 'Pontuação' },
      rounds: [
        { id: 1, label: 'Rodada 1', start: '2027-12-01', end: '2027-12-03', kind: 'rodada' },
        { id: 2, label: 'Rodada 2', start: '2027-12-04', end: '2027-12-07', kind: 'rodada' },
        { id: 3, label: 'Rodada 3', start: '2027-12-08', end: '2027-12-11', kind: 'rodada' },
        { id: 4, label: 'Repescagem', start: '2027-12-12', end: '2027-12-13', kind: 'repescagem' }
      ],
      homologation: { start: '2027-12-14', end: '2027-12-15', label: 'Homologação e entregas' }
    },

    /* Meses de pontuação (jan a nov/2027) */
    scoringMonths: ['2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11'],

    storage: {
      key: 'lna_gol2027_demo',
      legacyKeys: ['leilao2027_paineis_demo_v1'], // chave do HTML original (migração)
      schemaVersion: 2,
      maxAuditEntries: 2000
    },

    demo: {
      defaultSimulatedDate: '2027-12-02T10:00',
      latencyMs: 280,
      pageSize: 8,
      adminProfile: { id: 'gestao', name: 'Equipe de Gestão', email: 'gestao@exemplo.test' }
    },

    /* Ordem de critérios de desempate (documentada em "Premissas adotadas") */
    tieBreak: ['maior_pontuacao', 'registro_mais_antigo', 'email_alfabetico_tecnico'],

    /* Ícones disponíveis para prêmios (ver LNA.icons em ui.js) */
    rewardIcons: ['tv', 'bike', 'laptop', 'phone', 'fryer', 'headphones', 'coffee', 'speaker', 'suitcase', 'gift', 'plane', 'star']
  };

  // Congela para evitar alterações acidentais em tempo de execução.
  function deepFreeze(o) { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); }
  LNA.config = deepFreeze(config);
})(typeof window !== 'undefined' ? window : globalThis);
