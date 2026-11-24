/* ==========================================================================
   mock-data.js — DADOS FICTÍCIOS DA DEMONSTRAÇÃO
   Nenhum nome, e-mail ou valor representa pessoa ou dado real.
   Domínio de e-mail ".test" é reservado (RFC 2606) e nunca entrega mensagens.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};

  const iso = (y, m, d, h = 9, mi = 0, s = 0) => new Date(y, m - 1, d, h, mi, s).toISOString();

  function create() {
    const C = LNA.config, D = LNA.domain;
    const seedAt = iso(2027, 11, 30, 18, 0);

    const participants = [
      { id: 'P001', name: 'Alex Silva', email: 'operador1@exemplo.test', location: 'aracaju', active: true },
      { id: 'P002', name: 'Marina Souza', email: 'operador2@exemplo.test', location: 'maceio', active: true },
      { id: 'P003', name: 'Lucas Oliveira', email: 'operador3@exemplo.test', location: 'montes-claros', active: true },
      { id: 'P004', name: 'Rafael Costa', email: 'rafael.costa@exemplo.test', location: 'aracaju', active: true },
      { id: 'P005', name: 'Beatriz Lima', email: 'beatriz.lima@exemplo.test', location: 'maceio', active: true },
      { id: 'P006', name: 'Carla Mendes', email: 'carla.mendes@exemplo.test', location: 'montes-claros', active: false },
      { id: 'P007', name: 'Diego Araújo', email: 'diego.araujo@exemplo.test', location: 'outro', active: true },
      { id: 'P008', name: 'Fernanda Rocha', email: 'fernanda.rocha@exemplo.test', location: 'aracaju', active: true },
      { id: 'P009', name: 'Gustavo Pereira', email: 'gustavo.pereira@exemplo.test', location: 'maceio', active: true },
      { id: 'P010', name: 'Helena Martins', email: 'helena.martins@exemplo.test', location: 'outro', active: true }
    ].map(p => ({ ...p, createdAt: iso(2027, 1, 2), updatedAt: iso(2027, 1, 2) }));

    // Atingimento mensal fictício (jan–nov). Variações para gerar gráficos úteis.
    const profiles = {
      P001: [112, 118, 109, 115, 120, 113, 111, 116, 114, 117, 109],
      P002: [110, 114, 108, 112, 119, 111, 113, 110, 115, 112, 106],
      P003: [104, 109, 112, 100, 111, 108, 110, 107, 109, 113, 117],
      P004: [116, 113, 117, 112, 118, 114, 111, 119, 115, 113, 117],
      P005: [106, 108, 110, 106.4, 112, 109, 107, 111, 108, 110, 109],
      P006: [111, 112, 113, 110, 109, 111, 112, 113, 114, 110, 111],
      P007: [101, 102.8, 98, 103, 104, 100.9, 105, 102, 103, 104, 101],
      P008: [108, 114, 113, 110, 112, 109, 115, 111, 116, 114, 112],
      P009: [103, 105, 107, 104, 106, 102, 108, 105, 106, 107, 104],
      P010: null // ativo sem pontuação: aparece como inconsistência de cadastro
    };
    const points = [];
    Object.entries(profiles).forEach(([pid, arr]) => {
      if (!arr) return;
      arr.forEach((pct, i) => {
        const month = C.scoringMonths[i];
        points.push({ participantId: pid, month, achievement: pct, points: D.calcPoints(pct), type: 'carga_inicial', updatedAt: iso(2027, i + 2, 5, 10), updatedBy: 'carga inicial' });
      });
    });

    const rewardSeed = [
      ['R01', 'Smart TV 50"', 'Tela 4K com aplicativos de streaming.', 'tv', 1000, 1],
      ['R02', 'Bicicleta urbana', 'Aro 29, câmbio de 21 marchas.', 'bike', 900, 1],
      ['R03', 'Notebook', 'Tela de 15", 16 GB de memória.', 'laptop', 850, 1],
      ['R04', 'Smartphone', 'Tela de 6,5", 256 GB.', 'phone', 800, 2],
      ['R05', 'Air fryer', 'Capacidade de 5 litros.', 'fryer', 550, 2],
      ['R06', 'Fone Bluetooth', 'Cancelamento de ruído.', 'headphones', 450, 2],
      ['R07', 'Cafeteira', 'Espresso com vaporizador.', 'coffee', 400, 3],
      ['R08', 'Caixa de som', 'Portátil e resistente à água.', 'speaker', 350, 3],
      ['R09', 'Mala de viagem', 'Média, com rodinhas 360°.', 'suitcase', 300, 3],
      ['R10', 'Vale-compras', 'Crédito fictício para demonstração.', 'gift', 250, 3]
    ];
    const rewards = rewardSeed.map(([id, name, description, icon, minBid, releaseRound], i) => ({
      id, name, description, icon, minBid, releaseRound, active: true, order: i + 1, createdAt: seedAt, updatedAt: seedAt
    }));

    /* Lances pré-carregados na Rodada 1 para demonstrar empate, conflito,
       segunda opção, histórico de atualização e participante inativo.
       Resultado esperado da homologação (sem novos lances):
       - Smart TV: Marina (empate 1.000 x Rafael, Marina registrou antes)
       - Notebook: Beatriz (950 > 900 do Lucas)
       - Bicicleta: Rafael pela SEGUNDA OPÇÃO (empate 900 x Lucas, Rafael registrou antes)
       - Carla: inativa, lance desconsiderado.  Lucas: não contemplado. */
    const bids = [
      { id: 'B0001', roundId: 1, participantId: 'P006', primaryRewardId: 'R02', primaryPoints: 1200, secondRewardId: null, secondPoints: null, createdAt: iso(2027, 12, 1, 8, 5), version: 1, status: 'ativo', replacedAt: null, previousId: null },
      { id: 'B0002', roundId: 1, participantId: 'P003', primaryRewardId: 'R02', primaryPoints: 900, secondRewardId: null, secondPoints: null, createdAt: iso(2027, 12, 1, 8, 40), version: 1, status: 'substituido', replacedAt: iso(2027, 12, 1, 16, 20), previousId: null },
      { id: 'B0003', roundId: 1, participantId: 'P002', primaryRewardId: 'R01', primaryPoints: 1000, secondRewardId: 'R03', secondPoints: 900, createdAt: iso(2027, 12, 1, 9, 12), version: 1, status: 'ativo', replacedAt: null, previousId: null },
      { id: 'B0004', roundId: 1, participantId: 'P005', primaryRewardId: 'R03', primaryPoints: 950, secondRewardId: null, secondPoints: null, createdAt: iso(2027, 12, 1, 10, 30), version: 1, status: 'ativo', replacedAt: null, previousId: null },
      { id: 'B0005', roundId: 1, participantId: 'P004', primaryRewardId: 'R01', primaryPoints: 1000, secondRewardId: 'R02', secondPoints: 900, createdAt: iso(2027, 12, 1, 14, 2), version: 1, status: 'ativo', replacedAt: null, previousId: null },
      { id: 'B0006', roundId: 1, participantId: 'P003', primaryRewardId: 'R03', primaryPoints: 900, secondRewardId: 'R02', secondPoints: 900, createdAt: iso(2027, 12, 1, 16, 20), version: 2, status: 'ativo', replacedAt: null, previousId: 'B0002' }
    ];

    const rounds = {};
    C.calendar.rounds.forEach(r => { rounds[r.id] = { status: r.id === 1 ? 'aberta' : 'futura', openedAt: r.id === 1 ? iso(2027, 12, 1, 0, 0) : null, homologatedAt: null }; });

    return {
      schemaVersion: C.storage.schemaVersion,
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dataset: 'demonstracao-ficticia', seq: 7 },
      settings: {
        clockMode: 'simulado', simulatedDate: C.demo.defaultSimulatedDate, simulatedSetAt: Date.now(),
        errorMode: false, emptyMode: false, role: 'operador', participantId: 'P001', demoPanelOpen: false
      },
      currentRoundId: 1,
      rounds,
      participants, points, rewards, bids,
      awards: [], homologations: [], previews: {},
      audit: [{ id: 'A0001', at: seedAt, actor: 'sistema', role: 'sistema', action: 'carga_inicial', entity: 'demonstracao', entityId: '-', before: null, after: 'Dados fictícios carregados', justification: null, origin: 'mock-data.js', result: 'sucesso' }]
    };
  }

  LNA.mockData = { create, demoOperators: ['P001', 'P002', 'P003'] };
})(typeof window !== 'undefined' ? window : globalThis);
