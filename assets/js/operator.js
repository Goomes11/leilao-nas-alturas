/* ==========================================================================
   operator.js — Telas do perfil Operador
   Usa somente LNA.app.api (dados já filtrados para o próprio participante).
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA;
  const { h, clear, icon, fmt, chip, alertBox, button, field, modal, stateBlock, pageHead, card, kpi, summaryList, dataTable, rewardMedia, applyErrors, setBusy, requestId, rings } = LNA.ui;
  const cfg = LNA.config;
  LNA.views = LNA.views || {};

  const firstName = n => String(n || '').split(' ')[0];
  const rewardName = (d, id) => ((d.rewards.find(r => r.id === id) || {}).name) || '—';
  const deadlineText = d => d.roundWindow ? `${fmt.dateLong(d.roundWindow.end)}, às 23h59` : 'o encerramento da rodada';

  function roundChip(d) {
    const s = d.roundState ? d.roundState.status : 'futura';
    if (s === 'aberta' && d.roundTime === 'encerrada') return chip('encerrada', 'Prazo encerrado');
    if (s === 'aberta' && d.roundTime === 'futura') return chip('futura', 'Aguardando início');
    return chip(s);
  }

  /** Bloco reutilizado quando o operador não pode registrar lances. */
  function bidGateAlert(d) {
    if (d.canBid.ok) return null;
    if (d.canBid.code === 'contemplado') return null; // exibido como sucesso em outro bloco
    const kind = d.canBid.code === 'inativo' || d.canBid.code === 'sem_cadastro' ? 'error' : 'warning';
    return alertBox(kind, d.canBid.code === 'inativo' ? 'Cadastro inativo' : 'Lances indisponíveis no momento', d.canBid.message);
  }
  function awardAlert(d) {
    const a = d.account.award;
    if (!a) return null;
    return alertBox('success', `Parabéns! Você conquistou: ${rewardName(d, a.rewardId)}`, `Prêmio homologado na ${(LNA.domain.getRound(a.roundId) || {}).label || 'rodada'} com ${fmt.pts(a.points)}${a.type === 'segunda_opcao' ? ' (pela sua segunda opção)' : ''}. A equipe da campanha entrará em contato sobre a entrega.`);
  }

  /* ======================================================================
     INÍCIO
     ====================================================================== */
  async function inicio(ctx, app) {
    const d = await app.api.getOperatorDashboard();
    const acc = d.account;
    const open = d.canBid.ok;
    const available = d.rewards.filter(r => r.status === 'disponivel').length;

    const hero = h('section', { class: 'hero', 'aria-labelledby': 'hero-title' }, rings(),
      h('p', { class: 'hero__eyebrow' }, icon('plane', 'icon-sm'), cfg.app.campaign),
      h('h1', { class: 'hero__title', id: 'hero-title', tabindex: '-1', 'data-page-title': '' }, `Olá, ${firstName(d.participant.name)}. `, h('span', { class: 'accent' }, 'Seus pontos podem ir mais longe.')),
      h('p', { class: 'hero__text' }, open ? 'Use seu saldo para participar da rodada atual do Leilão nas Alturas.' : 'Acompanhe seu saldo, conheça os prêmios e fique de olho no calendário das rodadas.'),
      h('div', { class: 'hero__actions' },
        open ? button(acc.bid ? 'Atualizar meu lance' : 'Fazer meu lance', { icon: 'gavel', onClick: () => app.navigate('/lance') }) : null,
        button('Ver prêmios', { variant: open ? 'secondary' : 'primary', icon: 'gift', onClick: () => app.navigate('/premios') })));

    const balance = h('section', { class: 'balance-card', 'aria-labelledby': 'bal-title' }, rings('balance-card__ring', ['#FF7020', '#65605B']),
      h('h2', { class: 'balance-card__label', id: 'bal-title' }, 'Saldo disponível'),
      h('p', { class: 'balance-card__value' }, fmt.int(acc.balance), h('small', null, ' pontos')),
      h('dl', { class: 'balance-card__rows' },
        h('div', null, h('dt', null, 'Pontos acumulados'), h('dd', null, fmt.int(acc.earned))),
        h('div', null, h('dt', null, 'Pontos utilizados'), h('dd', null, fmt.int(acc.consumed))),
        h('div', null, h('dt', null, 'Comprometidos no lance'), h('dd', null, fmt.int(acc.committed))),
        h('div', null, h('dt', null, 'Saldo se vencer'), h('dd', null, fmt.int(acc.potentialAfterWin)))));

    const rs = d.roundState ? d.roundState.status : 'futura';
    const roundBody = h('div', { class: 'stack' },
      h('div', { class: 'row between' }, h('div', null, h('p', { class: 'card__title' }, d.round.label), h('p', { class: 'muted' }, `${fmt.date(d.roundWindow.start)} a ${fmt.date(d.roundWindow.end)}`)), roundChip(d)),
      rs === 'aberta' && d.roundTime === 'em_andamento' ? app.countdown(d.roundWindow.end, 'Tempo restante para lances') : h('p', { class: 'muted' }, ctx.phase.label),
      summaryList([['Prêmios disponíveis nesta rodada', fmt.int(available)], ['Prêmios já homologados', `${fmt.int(d.awardedTotal)} de ${fmt.int(d.rewards.length || 10)}`]]));

    const bidCard = acc.bid
      ? card({
        title: 'Seu lance atual', subtitle: `Versão ${acc.bid.version} · registrada em ${fmt.dateTime(acc.bid.createdAt)}`,
        body: summaryList([['Prêmio principal', rewardName(d, acc.bid.primaryRewardId)], ['Pontos do lance principal', fmt.pts(acc.bid.primaryPoints)], ['Segunda opção', acc.bid.secondRewardId ? `${rewardName(d, acc.bid.secondRewardId)} · ${fmt.pts(acc.bid.secondPoints)}` : 'Não escolhida']]),
        foot: open ? [button('Atualizar lance', { variant: 'secondary', icon: 'edit', onClick: () => app.navigate('/lance') }), h('span', { class: 'muted' }, `Atualizações até ${deadlineText(d)}.`)] : null
      })
      : card({ title: 'Seu lance atual', body: stateBlock({ kind: 'empty', icon: 'gavel', title: 'Nenhum lance foi registrado nesta rodada.', text: open ? 'Escolha um prêmio principal e, se quiser, uma segunda opção.' : d.canBid.code === 'contemplado' ? 'Você já foi contemplado nesta campanha, por isso não participa de novas rodadas.' : 'Quando houver uma rodada aberta, você poderá registrar seu lance aqui.', actions: open ? [button('Fazer meu lance', { onClick: () => app.navigate('/lance') })] : [] }) });

    const shortcuts = h('div', { class: 'grid grid-3' }, [
      ['coins', 'Meus pontos', 'Veja o atingimento e os pontos de cada mês.', '/pontos'],
      ['gift', 'Catálogo de prêmios', 'Pesquise, filtre e compare os prêmios.', '/premios'],
      ['calendar', 'Regras e calendário', 'Entenda lance, segunda opção e desempate.', '/regras']
    ].map(([ic, t, s, p]) => h('a', { class: 'card reward-card', href: '#' + p, style: 'text-decoration:none' }, h('div', { class: 'row' }, rewardMedia(ic), h('div', null, h('h3', { class: 'card__title' }, t), h('p', { class: 'muted' }, s))))));

    return h('div', { class: 'stack' },
      hero, awardAlert(d), bidGateAlert(d),
      ctx.settings.emptyMode ? alertBox('info', 'Modo de dados vazios ativo', 'Os indicadores aparecem zerados para demonstrar os estados vazios.') : null,
      h('div', { class: 'grid grid-2 mt-4' }, balance, card({ title: 'Rodada vigente', body: roundBody, headingLevel: 'h2' })),
      bidCard,
      h('h2', { class: 'section' }, 'Atalhos'), shortcuts);
  }

  /* ======================================================================
     MEUS PONTOS
     ====================================================================== */
  async function pontos(ctx, app) {
    const d = await app.api.getOperatorDashboard();
    const acc = d.account;
    const rows = d.myPoints;
    const table = dataTable({
      caption: 'Histórico mensal de pontuação', captionHint: 'Cada ponto percentual inteiro acima de 100% gera 10 pontos.',
      columns: [
        { key: 'month', label: 'Mês', render: r => fmt.monthFull(r.month), sortable: true },
        { key: 'achievement', label: 'Atingimento', num: true, render: r => fmt.pct(r.achievement), sortable: true },
        { key: 'calc', label: 'Cálculo', render: r => `${Math.floor(Math.max(0, Math.round((r.achievement - 100) * 100) / 100))} p.p. × 10` },
        { key: 'points', label: 'Pontos gerados', num: true, render: r => h('strong', null, fmt.int(r.points)), sortable: true },
        { key: 'type', label: 'Tipo de lançamento', render: r => ({ carga_inicial: 'Carga inicial', manual: 'Ajuste da gestão', importacao: 'Importação', migracao: 'Migração' }[r.type] || r.type) },
        { key: 'updatedAt', label: 'Atualização', render: r => fmt.dateTime(r.updatedAt), sortable: true }
      ],
      rows, empty: 'Nenhuma pontuação foi lançada para você ainda. Os pontos aparecem após o fechamento de cada mês.'
    });
    return h('div', null,
      pageHead({ eyebrow: 'Meus pontos', title: 'Seu extrato de pontos', desc: 'Pontos acumulados de janeiro a novembro de 2027, conforme o atingimento das suas metas.' }),
      h('div', { class: 'grid grid-4' },
        kpi({ label: 'Saldo disponível', value: fmt.int(acc.balance), unit: 'pts', ic: 'coins', tone: 'brand' }),
        kpi({ label: 'Pontos acumulados', value: fmt.int(acc.earned), unit: 'pts', hint: 'Jan a nov/2027' }),
        kpi({ label: 'Pontos utilizados', value: fmt.int(acc.consumed), unit: 'pts', hint: 'Consumidos após homologação' }),
        kpi({ label: 'Comprometidos', value: fmt.int(acc.committed), unit: 'pts', hint: 'Lance principal ativo (ainda não descontado)' })),
      h('div', { class: 'section' }, alertBox('info', 'Como os pontos são calculados', h('div', null,
        h('p', null, 'Cada ponto percentual inteiro acima de 100% de atingimento gera 10 pontos. Frações não são arredondadas para cima.'),
        h('p', null, 'Exemplos: 100,9% = 0 ponto · 101% = 10 pontos · 102,8% = 20 pontos · 114% = 140 pontos.')))),
      h('div', { class: 'section' }, table.el),
      h('p', { class: 'muted mt-3' }, `Total geral: ${fmt.pts(acc.earned)}. Última atualização: ${acc.lastUpdate ? fmt.dateTime(acc.lastUpdate) : '—'}.`));
  }

  /* ======================================================================
     PRÊMIOS
     ====================================================================== */
  function rewardDetails(d, r, app) {
    const myBid = d.account.bid;
    const canPick = d.canBid.ok && r.status === 'disponivel';
    modal({
      title: r.name, description: r.description,
      body: h('div', { class: 'stack' },
        h('div', { class: 'row' }, rewardMedia(r.icon), chip(r.status, r.status === 'em_breve' ? r.statusLabel : null)),
        summaryList([
          ['Lance mínimo', fmt.pts(r.minBid)],
          ['Maior lance principal atual', r.highestPrimary ? fmt.pts(r.highestPrimary) : 'Ainda sem lances'],
          ['Quantidade de lances principais', fmt.int(r.primaryCount)],
          ['Rodada de liberação', (LNA.domain.getRound(r.releaseRound) || {}).label || '—']
        ]),
        alertBox('info', null, 'O maior lance exibido considera somente as escolhas principais. Por privacidade, nenhum participante é identificado e os valores de segunda opção não são exibidos.'),
        myBid && (myBid.primaryRewardId === r.id || myBid.secondRewardId === r.id) ? alertBox('deadline', null, myBid.primaryRewardId === r.id ? 'Este é o seu prêmio principal nesta rodada.' : 'Este prêmio é a sua segunda opção nesta rodada.') : null),
      actions: [
        { label: 'Fechar', variant: 'secondary' },
        canPick ? { label: 'Escolher como principal', variant: 'primary', onClick: api => { api.close(); app.navigate('/lance', { primary: r.id }); } } : null
      ].filter(Boolean)
    });
  }

  function rewardCard(d, r, app) {
    const myBid = d.account.bid;
    const mine = myBid && (myBid.primaryRewardId === r.id ? 'principal' : myBid.secondRewardId === r.id ? 'segunda' : null);
    const muted = r.status !== 'disponivel';
    const canPick = d.canBid.ok && r.status === 'disponivel';
    const titleId = 'rw-' + r.id;
    return h('article', { class: ['card', 'reward-card', muted && 'is-muted', mine && 'is-selected'], 'aria-labelledby': titleId },
      h('div', { class: 'reward-card__top' }, rewardMedia(r.icon), h('div', { class: 'tag-list', style: 'justify-content:flex-end' }, chip(r.status, r.status === 'em_breve' ? r.statusLabel : null), mine ? chip('selecionado', mine === 'principal' ? 'Seu principal' : 'Sua 2ª opção') : null)),
      h('div', null, h('h3', { class: 'reward-card__name', id: titleId }, r.name), h('p', { class: 'reward-card__desc' }, r.description)),
      h('dl', { class: 'reward-stats' },
        h('div', null, h('dt', null, 'Lance mínimo'), h('dd', null, fmt.pts(r.minBid))),
        h('div', null, h('dt', null, 'Maior lance principal'), h('dd', { class: 'highlight' }, r.highestPrimary ? fmt.int(r.highestPrimary) : '—')),
        h('div', null, h('dt', null, 'Lances principais'), h('dd', null, fmt.int(r.primaryCount))),
        h('div', null, h('dt', null, 'Liberação'), h('dd', null, (LNA.domain.getRound(r.releaseRound) || {}).label || '—'))),
      h('div', { class: 'reward-card__actions' },
        button('Ver detalhes', { variant: 'secondary', size: 'sm', icon: 'eye', onClick: () => rewardDetails(d, r, app), ariaLabel: `Ver detalhes de ${r.name}` }),
        canPick ? button(mine === 'principal' ? 'Ajustar lance' : 'Escolher', { size: 'sm', icon: 'gavel', onClick: () => app.navigate('/lance', { primary: r.id }), ariaLabel: `Escolher ${r.name} como prêmio principal` }) : null));
  }

  async function premios(ctx, app) {
    const d = await app.api.getOperatorDashboard();
    const search = field({ label: 'Pesquisar prêmio', type: 'search', icon: 'search', placeholder: 'Ex.: notebook', className: 'field--search' });
    const status = field({ type: 'select', label: 'Situação', options: [{ value: '', label: 'Todas' }, { value: 'disponivel', label: 'Disponíveis' }, { value: 'em_breve', label: 'Disponíveis em breve' }, { value: 'arrematado', label: 'Arrematados' }, { value: 'inativo', label: 'Indisponíveis' }, { value: 'encerrado', label: 'Rodada encerrada' }] });
    const round = field({ type: 'select', label: 'Rodada de liberação', options: [{ value: '', label: 'Todas' }].concat(cfg.calendar.rounds.filter(r => r.kind === 'rodada').map(r => ({ value: String(r.id), label: r.label }))) });
    const sort = field({ type: 'select', label: 'Ordenar por', options: [{ value: 'ordem', label: 'Destaque' }, { value: 'nome', label: 'Nome (A–Z)' }, { value: 'min_asc', label: 'Menor lance mínimo' }, { value: 'min_desc', label: 'Maior lance mínimo' }, { value: 'maior', label: 'Maior lance atual' }] });
    const grid = h('div', { class: 'grid grid-3' });
    const count = h('p', { class: 'muted', 'aria-live': 'polite' });
    const filtersToggle = h('button', { type: 'button', class: 'btn btn--secondary btn--sm filters-toggle', 'aria-expanded': 'false', 'aria-controls': 'reward-filters' }, icon('filter'), 'Filtros');
    const filters = h('div', { class: 'toolbar__filters', id: 'reward-filters' }, status.el, round.el, sort.el);
    const toolbar = h('div', { class: 'toolbar is-collapsible' }, search.el, filtersToggle, filters);
    filtersToggle.addEventListener('click', () => { const o = toolbar.classList.toggle('is-open'); filtersToggle.setAttribute('aria-expanded', String(o)); });

    function apply() {
      const q = search.input.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      let list = d.rewards.filter(r => (!q || (r.name + ' ' + r.description).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)) && (!status.input.value || r.status === status.input.value) && (!round.input.value || String(r.releaseRound) === round.input.value));
      const s = sort.input.value;
      list = list.slice().sort((a, b) => s === 'nome' ? a.name.localeCompare(b.name, 'pt-BR') : s === 'min_asc' ? a.minBid - b.minBid : s === 'min_desc' ? b.minBid - a.minBid : s === 'maior' ? b.highestPrimary - a.highestPrimary : 0);
      clear(grid);
      if (!d.rewards.length) grid.appendChild(h('div', { style: 'grid-column:1/-1' }, stateBlock({ kind: 'empty', icon: 'gift', title: 'Nenhum prêmio cadastrado nesta campanha.', text: 'Quando a gestão publicar o catálogo, os prêmios aparecerão aqui.' })));
      else if (!list.length) grid.appendChild(h('div', { style: 'grid-column:1/-1' }, stateBlock({ kind: 'empty', title: 'Nenhum prêmio corresponde aos filtros.', text: 'Revise a pesquisa ou limpe os filtros para ver todo o catálogo.', actions: [button('Limpar filtros', { variant: 'secondary', onClick: () => { search.input.value = ''; status.input.value = ''; round.input.value = ''; apply(); } })] })));
      else list.forEach(r => grid.appendChild(rewardCard(d, r, app)));
      count.textContent = `${fmt.plural(list.length, 'prêmio encontrado', 'prêmios encontrados')} de ${fmt.int(d.rewards.length)}.`;
    }
    let tmr; search.input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(apply, 200); });
    [status, round, sort].forEach(f => f.input.addEventListener('change', apply));
    apply();
    return h('div', null,
      pageHead({ eyebrow: 'Prêmios', title: 'Catálogo de prêmios', desc: 'O maior lance mostrado é sempre o do lance principal. Nenhum participante é identificado.', actions: d.canBid.ok ? [button(d.account.bid ? 'Atualizar meu lance' : 'Fazer meu lance', { icon: 'gavel', onClick: () => app.navigate('/lance') })] : null }),
      bidGateAlert(d), toolbar, count, h('div', { class: 'mt-3' }, grid));
  }

  /* ======================================================================
     MEU LANCE
     ====================================================================== */
  async function lance(ctx, app) {
    const d = await app.api.getOperatorDashboard();
    const acc = d.account;
    const head = pageHead({ eyebrow: `Meu lance · ${d.round.label}`, title: acc.bid ? 'Atualize seu lance' : 'Faça seu lance', desc: `Você pode atualizar o lance até ${deadlineText(d)}. A versão anterior fica guardada no seu histórico.` });
    const flash = h('div', { tabindex: '-1' });
    if (app.params.flash) { flash.appendChild(alertBox('success', 'Lance registrado', app.params.flash)); setTimeout(() => flash.focus(), 50); app.params.flash = null; }

    if (!d.canBid.ok) {
      const blocked = d.canBid.code === 'contemplado'
        ? awardAlert(d)
        : stateBlock({ kind: 'locked', title: d.canBid.code === 'inativo' ? 'Seu cadastro está inativo' : 'Lances indisponíveis no momento', text: d.canBid.message, actions: [button('Ver regras e calendário', { variant: 'secondary', onClick: () => app.navigate('/regras') })] });
      return h('div', { class: 'stack' }, head, flash, blocked, acc.bid ? card({ title: 'Último lance registrado nesta rodada', body: summaryList([['Prêmio principal', rewardName(d, acc.bid.primaryRewardId)], ['Pontos', fmt.pts(acc.bid.primaryPoints)], ['Segunda opção', acc.bid.secondRewardId ? `${rewardName(d, acc.bid.secondRewardId)} · ${fmt.pts(acc.bid.secondPoints)}` : 'Não escolhida']]) }) : null);
    }

    const avail = d.rewards.filter(r => r.status === 'disponivel');
    if (!avail.length) return h('div', { class: 'stack' }, head, stateBlock({ kind: 'empty', icon: 'gift', title: 'Nenhum prêmio disponível nesta rodada.', text: 'Confira o catálogo para ver quando novos prêmios serão liberados.', actions: [button('Ver catálogo', { onClick: () => app.navigate('/premios') })] }));

    const opt = r => ({ value: r.id, label: `${r.name} — mínimo ${fmt.int(r.minBid)} pts` });
    const pre = { primary: app.params.primary || (acc.bid && acc.bid.primaryRewardId) || '', points: acc.bid && (!app.params.primary || app.params.primary === acc.bid.primaryRewardId) ? acc.bid.primaryPoints : '', second: acc.bid ? acc.bid.secondRewardId || '' : '', secondPoints: acc.bid && acc.bid.secondPoints ? acc.bid.secondPoints : '' };
    if (pre.second === pre.primary) { pre.second = ''; pre.secondPoints = ''; }
    app.params.primary = null;

    const f = {
      primaryRewardId: field({ type: 'select', label: 'Prêmio principal', required: true, value: pre.primary, options: [{ value: '', label: 'Selecione um prêmio' }].concat(avail.map(opt)) }),
      primaryPoints: field({ label: 'Pontos do lance principal', required: true, inputmode: 'numeric', suffix: 'pts', value: pre.points, placeholder: 'Ex.: 1050', hint: 'Escolha um prêmio para ver o mínimo.' }),
      secondRewardId: field({ type: 'select', label: 'Segunda opção', optional: true, value: pre.second, options: [{ value: '', label: 'Sem segunda opção' }].concat(avail.map(opt)) }),
      secondPoints: field({ label: 'Pontos da segunda opção', inputmode: 'numeric', suffix: 'pts', value: pre.secondPoints, placeholder: 'Ex.: 650', hint: 'Preencha somente se escolher uma segunda opção.' })
    };
    const formError = h('div', { tabindex: '-1' });
    const submitBtn = button(acc.bid ? 'Revisar atualização' : 'Revisar lance', { type: 'submit', icon: 'check' });
    const side = h('div');

    const getReward = id => d.rewards.find(r => r.id === id);
    function readInput() { return { primaryRewardId: f.primaryRewardId.input.value, primaryPoints: f.primaryPoints.input.value.trim(), secondRewardId: f.secondRewardId.input.value, secondPoints: f.secondPoints.input.value.trim() }; }

    /** Validação na interface (espelha domain.validateBid; o serviço revalida tudo). */
    function validate(input, touchedOnly) {
      const e = {}, V = LNA.validators;
      const p = getReward(input.primaryRewardId), s = getReward(input.secondRewardId);
      if (!p) e.primaryRewardId = 'Selecione o prêmio principal.';
      if (p) {
        if (input.primaryPoints === '' && touchedOnly) { /* sem erro enquanto vazio */ }
        else { const r = V.validateBidAmount(input.primaryPoints, p.minBid); if (!r.ok) e.primaryPoints = r.error; else if (r.value > acc.balance) e.primaryPoints = `O valor informado supera seu saldo disponível de ${fmt.int(acc.balance)} pontos.`; }
      }
      if (input.secondRewardId) {
        if (input.secondRewardId === input.primaryRewardId) e.secondRewardId = 'A segunda opção precisa ser diferente do prêmio principal.';
        else if (s && !(input.secondPoints === '' && touchedOnly)) { const r = V.validateBidAmount(input.secondPoints, s.minBid); if (!r.ok) e.secondPoints = r.error; else if (r.value > acc.balance) e.secondPoints = `O valor informado supera seu saldo disponível de ${fmt.int(acc.balance)} pontos.`; }
      } else if (input.secondPoints !== '') e.secondRewardId = 'Selecione o prêmio da segunda opção ou apague os pontos informados.';
      if (touchedOnly && !input.primaryRewardId) delete e.primaryRewardId;
      return e;
    }

    function updateSide() {
      const input = readInput();
      const p = getReward(input.primaryRewardId), s = getReward(input.secondRewardId);
      const pts = Number(input.primaryPoints) || 0;
      f.primaryPoints.el.querySelector('.field__hint').textContent = p ? `Mínimo ${fmt.int(p.minBid)} · múltiplos de 10 · maior lance principal atual: ${p.highestPrimary ? fmt.int(p.highestPrimary) : 'nenhum'}` : 'Escolha um prêmio para ver o mínimo.';
      f.secondPoints.el.querySelector('.field__hint').textContent = s ? `Mínimo ${fmt.int(s.minBid)} · múltiplos de 10` : 'Preencha somente se escolher uma segunda opção.';
      f.secondPoints.input.disabled = !input.secondRewardId;
      clear(side);
      side.appendChild(card({
        title: 'Resumo do lance', cls: 'card--raised', body: h('div', { class: 'stack' },
          summaryList([
            ['Saldo disponível', fmt.pts(acc.balance)],
            ['Prêmio principal', p ? p.name : '—'],
            ['Lance mínimo', p ? fmt.pts(p.minBid) : '—'],
            ['Maior lance principal atual', p ? (p.highestPrimary ? fmt.pts(p.highestPrimary) : 'Nenhum') : '—'],
            ['Seu lance principal', pts ? fmt.pts(pts) : '—'],
            ['Segunda opção', s ? `${s.name} · ${input.secondPoints ? fmt.pts(Number(input.secondPoints) || 0) : '—'}` : 'Não escolhida'],
            ['Saldo se vencer no principal', pts && pts <= acc.balance ? fmt.pts(acc.balance - pts) : '—', 'total']
          ]),
          p && pts && p.highestPrimary && pts <= p.highestPrimary ? alertBox('warning', null, `Seu lance está igual ou abaixo do maior lance principal atual (${fmt.int(p.highestPrimary)}). Em empate, vence quem registrou primeiro.`) : null,
          h('p', { class: 'field__hint' }, 'Os pontos não são descontados agora: o desconto acontece somente se o prêmio for homologado para você.'))
      }));
    }
    let tmr;
    function liveValidate(ev) {
      updateSide();
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        const errs = validate(readInput(), true);
        // Mostra erro apenas nos campos já tocados
        Object.entries(f).forEach(([k, fld]) => { if (fld.input.dataset.touched) fld.setError(errs[k] || ''); });
      }, 250);
    }
    Object.values(f).forEach(fld => { fld.input.addEventListener('input', e => { e.target.dataset.touched = '1'; liveValidate(); }); fld.input.addEventListener('change', e => { e.target.dataset.touched = '1'; liveValidate(); }); });

    const form = h('form', { novalidate: true, 'aria-describedby': 'bid-help' },
      h('fieldset', null, h('legend', { class: 'card__title' }, 'Escolha principal'), h('div', { class: 'form-grid' }, f.primaryRewardId.el, f.primaryPoints.el)),
      h('hr', { class: 'divider' }),
      h('fieldset', null, h('legend', { class: 'card__title' }, 'Segunda opção (facultativa)'),
        h('div', { class: 'mt-2' }, alertBox('info', null, 'Caso você não seja contemplado em sua escolha principal, sua segunda opção poderá ser considerada, desde que o prêmio ainda esteja disponível. A segunda opção não garante o prêmio e segue os mesmos critérios de maior lance e desempate.')),
        h('div', { class: 'form-grid mt-4' }, f.secondRewardId.el, f.secondPoints.el)),
      h('p', { id: 'bid-help', class: 'field__hint mt-4' }, 'Regras: lance inteiro, maior que zero, a partir do mínimo do prêmio, em múltiplos de 10 e sem ultrapassar o seu saldo.'),
      formError,
      h('div', { class: 'form-actions' }, button('Cancelar', { variant: 'tertiary', onClick: () => app.navigate('/inicio') }), submitBtn));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      clear(formError);
      const input = readInput();
      Object.values(f).forEach(fld => { fld.input.dataset.touched = '1'; });
      const errs = validate(input, false);
      if (applyErrors(f, errs)) { LNA.a11y.announce('Revise os campos destacados.', true); return; }
      await confirmBid(input);
    });

    async function confirmBid(input) {
      const p = getReward(input.primaryRewardId), s = getReward(input.secondRewardId);
      const pts = Number(input.primaryPoints), sp = input.secondRewardId ? Number(input.secondPoints) : null;
      const reqId = requestId();
      const errBox = h('div');
      const m = modal({
        title: acc.bid ? 'Confirmar atualização do lance' : 'Confirmar lance',
        description: 'Confira os dados antes de registrar.',
        body: h('div', { class: 'stack' },
          summaryList([
            ['Rodada', d.round.label], ['Prêmio principal', p.name], ['Pontos do lance principal', fmt.pts(pts)],
            ['Segunda opção', s ? s.name : 'Não escolhida'], ['Pontos da segunda opção', s ? fmt.pts(sp) : '—'],
            ['Saldo atual', fmt.pts(acc.balance)], ['Saldo potencial após homologação', fmt.pts(acc.balance - pts), 'total']
          ]),
          alertBox('deadline', null, `O lance poderá ser atualizado até ${deadlineText(d)}. ${acc.bid ? 'Esta versão substituirá a anterior, que continuará no seu histórico.' : ''}`),
          errBox),
        actions: [
          { label: 'Voltar e editar', variant: 'secondary', value: null },
          {
            label: acc.bid ? 'Confirmar atualização' : 'Confirmar lance', variant: 'primary', key: 'ok', onClick: async (api, btn) => {
              if (btn.disabled) return;
              clear(errBox);
              setBusy(btn, true, 'Registrando lance…'); setBusy(submitBtn, true, 'Registrando lance…');
              try {
                const r = await app.api.submitBid({ primaryRewardId: input.primaryRewardId, primaryPoints: input.primaryPoints, secondRewardId: input.secondRewardId || null, secondPoints: input.secondRewardId ? input.secondPoints : '' }, reqId);
                api.close('ok');
                const msg = `Seu lance foi registrado. Você poderá atualizá-lo até ${fmt.dateLong(r.roundWindow.end)}, às 23h59.`;
                LNA.ui.toast(msg, 'success', { title: r.updated ? 'Lance atualizado' : 'Lance registrado' });
                LNA.a11y.announce(msg);
                app.navigate('/lance', { flash: msg });
              } catch (err) {
                setBusy(btn, false); setBusy(submitBtn, false);
                if (err.details && typeof err.details === 'object' && !Array.isArray(err.details)) {
                  api.close(null);
                  applyErrors(f, err.details);
                  if (err.details.form) formError.appendChild(alertBox('error', 'Não foi possível registrar o lance', err.details.form));
                } else {
                  errBox.appendChild(alertBox('error', 'Não foi possível registrar o lance', `${err.message} Seus dados foram preservados.`));
                }
              }
            }
          }
        ]
      });
      await m.promise;
    }

    updateSide();
    return h('div', null, head, flash,
      h('div', { class: 'split' }, card({ title: null, body: form }), h('div', { class: 'stack' }, side,
        card({ title: 'Dúvidas rápidas', headingLevel: 'h2', body: h('ul', { class: 'stack-sm muted', style: 'padding-left:18px;margin:0' }, h('li', null, 'Você tem somente um lance ativo por rodada.'), h('li', null, 'Cada participante pode conquistar no máximo um prêmio na campanha.'), h('li', null, 'Em empate, vence o lance registrado primeiro.')) }))));
  }

  /* ======================================================================
     HISTÓRICO
     ====================================================================== */
  async function historico(ctx, app) {
    const d = await app.api.getOperatorDashboard();
    const bids = dataTable({
      caption: 'Versões dos seus lances', captionHint: 'Cada atualização substitui a anterior, que permanece registrada aqui.',
      columns: [
        { key: 'createdAt', label: 'Registrado em', render: r => fmt.dateTime(r.createdAt), sortable: true },
        { key: 'roundId', label: 'Rodada', render: r => (LNA.domain.getRound(r.roundId) || {}).label },
        { key: 'version', label: 'Versão', num: true },
        { key: 'primary', label: 'Prêmio principal', render: r => `${rewardName(d, r.primaryRewardId)} · ${fmt.int(r.primaryPoints)} pts` },
        { key: 'second', label: 'Segunda opção', render: r => r.secondRewardId ? `${rewardName(d, r.secondRewardId)} · ${fmt.int(r.secondPoints)} pts` : '—' },
        { key: 'status', label: 'Situação', render: r => chip(r.status) }
      ],
      rows: d.myBids, empty: 'Nenhum lance foi registrado por você até agora.'
    });
    const moves = d.myPoints.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(p => ({ at: p.updatedAt, desc: `Pontuação de ${fmt.monthFull(p.month)} (${fmt.pct(p.achievement)})`, points: p.points }));
    if (d.account.award) moves.unshift({ at: d.account.award.homologatedAt, desc: `Homologação: ${rewardName(d, d.account.award.rewardId)}`, points: -d.account.award.points });
    const movesTable = dataTable({
      caption: 'Movimentações de pontos', pageSize: 8,
      columns: [{ key: 'at', label: 'Data', render: r => fmt.dateTime(r.at) }, { key: 'desc', label: 'Descrição' }, { key: 'points', label: 'Pontos', num: true, render: r => h('strong', null, (r.points > 0 ? '+' : '') + fmt.int(r.points)) }],
      rows: moves, empty: 'Ainda não há movimentações de pontos.'
    });
    return h('div', { class: 'stack' },
      pageHead({ eyebrow: 'Histórico', title: 'Seu histórico na campanha', desc: 'Somente os seus dados individuais. Informações de outros participantes não são exibidas.' }),
      awardAlert(d) || alertBox('info', 'Nenhum prêmio conquistado até o momento', 'Quando um prêmio for homologado para você, ele aparecerá aqui.'),
      h('div', { class: 'section' }, bids.el), h('div', { class: 'section' }, movesTable.el));
  }

  /* ======================================================================
     REGRAS E CALENDÁRIO
     ====================================================================== */
  function calendarTimeline(ctx) {
    const c = cfg.calendar, now = new Date(ctx.now);
    const items = [{ label: c.scoring.label, start: c.scoring.start, end: c.scoring.end, desc: 'Atingimento mensal gera pontos.' }]
      .concat(c.rounds.map(r => ({ label: r.label, start: r.start, end: r.end, desc: r.kind === 'repescagem' ? 'Prêmios ainda sem vencedor, para quem não foi contemplado.' : `Lances nos prêmios liberados até a ${r.label}.`, roundId: r.id })))
      .concat([{ label: c.homologation.label, start: c.homologation.start, end: c.homologation.end, desc: 'Confirmação final dos vencedores e entregas.' }]);
    return h('ol', { class: 'timeline' }, items.map(i => {
      const s = LNA.domain.dayStart(i.start), e = LNA.domain.dayEnd(i.end);
      const st = now > e ? 'is-done' : now >= s ? 'is-current' : '';
      return h('li', { class: ['timeline__item', st] }, h('span', { class: 'timeline__dot', 'aria-hidden': 'true' }),
        h('p', { class: 'timeline__title' }, i.label, st === 'is-current' ? chip('aberta', 'Agora') : st === 'is-done' ? h('span', { class: 'sr-only' }, ' (concluído)') : null),
        h('p', { class: 'timeline__meta' }, `${fmt.date(s)} a ${fmt.date(e)} · ${i.desc}`));
    }));
  }
  async function regras(ctx) {
    const sec = (title, items, open) => h('details', { open }, h('summary', null, title, icon('chevronDown')), h('div', { class: 'accordion__body' }, h('ul', null, items.map(i => h('li', null, i)))));
    return h('div', null,
      pageHead({ eyebrow: 'Regras e calendário', title: 'Como funciona o Leilão nas Alturas', desc: 'Regras resumidas da campanha GOL 2027. Em caso de dúvida, procure a gestão da campanha.' }),
      h('div', { class: 'split' },
        h('div', { class: 'accordion' },
          sec('Como ganhar pontos', ['Cada ponto percentual inteiro acima de 100% de atingimento gera 10 pontos.', 'Exemplos: 99,9% = 0 · 100% = 0 · 100,9% = 0 · 101% = 10 · 102,8% = 20 · 108% = 80 · 114% = 140 pontos.', 'A pontuação vale de janeiro a novembro de 2027 e é lançada pela gestão.'], true),
          sec('Como dar um lance', ['Escolha um prêmio principal disponível na rodada e informe os pontos.', 'O lance é inteiro, maior que zero, a partir do mínimo do prêmio e em múltiplos de 10.', 'O lance não pode ultrapassar o seu saldo disponível.', 'Você tem um único lance ativo por rodada; atualizar substitui o anterior, que fica no histórico.', 'É possível atualizar até o encerramento da rodada (23h59 do último dia).']),
          sec('Segunda opção', ['É facultativa e precisa ser um prêmio diferente do principal.', 'Só é considerada se você não vencer na escolha principal e se o prêmio continuar sem vencedor.', 'Segue o mesmo mínimo, incremento, limite de saldo e critérios de desempate.', 'A segunda opção não garante o prêmio.']),
          sec('Vencedores e desempate', ['Vence o maior lance principal elegível de cada prêmio.', 'Em empate de pontos, vence o lance registrado primeiro.', 'Se o horário for idêntico, a demonstração usa a ordem alfabética do e-mail como critério técnico; o critério definitivo depende de validação da área de negócio.', 'Depois dos lances principais, são avaliadas as segundas opções.']),
          sec('Pontos e prêmios', ['Os pontos não são descontados ao registrar o lance.', 'O desconto acontece somente após a homologação do prêmio para você.', 'Cada participante pode conquistar no máximo um prêmio em toda a campanha.', 'Prêmios arrematados não recebem novos lances.']),
          sec('Privacidade', ['Você vê apenas os seus próprios dados.', 'O catálogo mostra o maior lance principal e a quantidade de lances, sem identificar ninguém.', 'Valores de segunda opção de outros participantes nunca são exibidos.'])),
        card({ title: 'Calendário oficial previsto', subtitle: 'Horário de Brasília', body: calendarTimeline(ctx) })));
  }

  LNA.views.operator = { '/inicio': inicio, '/pontos': pontos, '/premios': premios, '/lance': lance, '/historico': historico, '/regras': regras };
})(window);
