/* ==========================================================================
   admin.js — Telas do perfil Gestão (separadas por seção, sem página única)
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA;
  const doc = root.document;
  const { h, clear, icon, fmt, chip, alertBox, button, field, toggle, modal, confirmDialog, stateBlock, pageHead, card, kpi, summaryList, dataTable, barChart, columnChart, rewardMedia, applyErrors, setBusy, download, readFile, toast } = LNA.ui;
  const cfg = LNA.config;
  const V = LNA.validators;
  LNA.views = LNA.views || {};

  const roundLabel = id => (LNA.domain.getRound(id) || {}).label || '—';
  const typeLabel = t => t === 'principal' ? 'Lance principal' : 'Segunda opção';
  const csvDate = d => d ? fmt.dateTime(d) : '';
  const ACTION_LABEL = {
    carga_inicial: 'Carga inicial', migracao: 'Migração de dados', cadastro_participante: 'Cadastro de participante', edicao_participante: 'Edição de participante',
    ativacao_participante: 'Ativação de participante', inativacao_participante: 'Inativação de participante', atualizacao_pontuacao: 'Atualização de pontuação',
    importacao_previa: 'Prévia de importação', importacao_pontuacao: 'Importação de pontuação', criacao_premio: 'Criação de prêmio', edicao_premio: 'Edição de prêmio',
    ativacao_premio: 'Ativação de prêmio', inativacao_premio: 'Inativação de prêmio', registro_lance: 'Registro de lance', atualizacao_lance: 'Atualização de lance',
    lance_rejeitado: 'Lance rejeitado', simulacao_homologacao: 'Simulação de homologação', homologacao: 'Homologação', homologacao_bloqueada: 'Homologação bloqueada',
    reversao_homologacao: 'Reversão de homologação', abertura_rodada: 'Abertura de rodada', reset_demonstracao: 'Reset da demonstração', importacao_backup: 'Importação de backup',
    exportacao_backup: 'Exportação de backup', data_simulada: 'Alteração da data simulada', modo_demonstracao: 'Modo de demonstração', recuperacao_dados: 'Recuperação de dados'
  };

  function emptyModeNotice(ctx) { return ctx.settings.emptyMode ? alertBox('info', 'Modo de dados vazios ativo', 'As listas aparecem vazias para demonstrar os estados vazios. Desative o modo nos Controles da demonstração.') : null; }

  /* ======================================================================
     VISÃO GERAL
     ====================================================================== */
  async function visaoGeral(ctx, app) {
    const o = await app.api.getAdminOverview();
    const head = pageHead({ eyebrow: 'Gestão da campanha', title: 'Visão geral', desc: `${cfg.app.campaign} · ${ctx.phase.label}` });
    if (o.empty) return h('div', null, head, emptyModeNotice(ctx), stateBlock({ kind: 'empty', icon: 'chart', title: 'Sem dados para exibir indicadores.', text: 'Cadastre participantes e lance pontuações para acompanhar a campanha.' }));
    const k = o.kpis;
    const rs = k.roundStatus;
    const kpis = h('div', { class: 'grid grid-4' },
      kpi({ label: 'Participantes cadastrados', value: fmt.int(k.participants), ic: 'users', hint: `${fmt.int(k.active)} ativos · ${fmt.int(k.inactive)} inativos` }),
      kpi({ label: 'Participantes ativos', value: fmt.int(k.active), ic: 'checkCircle' }),
      kpi({ label: 'Participantes inativos', value: fmt.int(k.inactive), ic: 'ban' }),
      kpi({ label: 'Pontos distribuídos', value: fmt.int(k.distributed), unit: 'pts', ic: 'coins', tone: 'brand' }),
      kpi({ label: 'Pontos utilizados', value: fmt.int(k.used), unit: 'pts', hint: 'Consumidos em homologações' }),
      kpi({ label: 'Saldo geral disponível', value: fmt.int(k.available), unit: 'pts' }),
      kpi({ label: 'Lances ativos', value: fmt.int(k.activeBids), ic: 'gavel', hint: k.round.label }),
      kpi({ label: 'Participantes sem lance', value: fmt.int(k.withoutBid), hint: 'Ativos e ainda não contemplados' }),
      kpi({ label: 'Prêmios disponíveis', value: fmt.int(k.rewardsAvailable), ic: 'gift', hint: `De ${fmt.int(k.rewardsTotal)} no catálogo` }),
      kpi({ label: 'Prêmios homologados', value: fmt.int(k.rewardsAwarded), ic: 'trophy' }),
      kpi({ label: 'Rodada atual', value: k.round.label, hint: { aberta: 'Aberta para lances', homologada: 'Homologada', encerrada: 'Encerrada (aguardando nova homologação)', futura: 'Aguardando abertura' }[rs] }),
      kpi({ label: 'Inconsistências detectadas', value: fmt.int(k.inconsistencies), ic: 'alert', tone: k.inconsistencies ? 'alert' : null }));
    const timer = rs === 'aberta' && o.roundTime === 'em_andamento' ? card({ title: 'Tempo restante da rodada', body: app.countdown(o.roundWindow.end, `Encerramento da ${k.round.label}`) }) : card({ title: 'Tempo restante da rodada', body: h('p', { class: 'muted' }, rs === 'homologada' ? 'Rodada homologada. Abra a próxima rodada em “Rodadas”.' : o.roundTime === 'encerrada' ? 'O prazo de lances desta rodada terminou. Simule e homologue em “Rodadas”.' : 'A rodada ainda não começou pelo calendário.') });
    const STATUS_LBL = { disponivel: 'Disponíveis', em_breve: 'Em breve', arrematado: 'Arrematados', inativo: 'Indisponíveis', encerrado: 'Rodada encerrada' };
    const incons = o.inconsistencies.length
      ? h('ul', { class: 'notice-list' }, o.inconsistencies.slice(0, 12).map(i => h('li', null, alertBox(i.severity === 'error' ? 'error' : 'warning', { cadastro: 'Cadastro', saldo: 'Saldo', lance: 'Lance' }[i.kind], i.message))))
      : stateBlock({ kind: 'empty', icon: 'checkCircle', title: 'Nenhuma inconsistência encontrada.', text: 'Cadastros, pontuações e lances estão coerentes.' });
    return h('div', null, head,
      h('div', { class: 'stack' }, kpis, timer,
        h('div', { class: 'grid grid-2' },
          card({ title: 'Pontos distribuídos por localidade', body: barChart({ title: 'Pontos por localidade', items: o.byLocation.map(l => ({ label: l.label, value: l.points })) }) }),
          card({ title: 'Participantes por localidade', body: barChart({ title: 'Participantes por localidade', items: o.byLocation.map(l => ({ label: l.label, value: l.participants })), tone: 'alt' }) }),
          card({ title: `Lances principais por prêmio · ${k.round.label}`, body: barChart({ title: 'Lances por prêmio', items: o.bidsByReward.map(r => ({ label: r.name, value: r.primaryCount })) }) }),
          card({ title: 'Status dos prêmios', body: barChart({ title: 'Status dos prêmios', items: o.rewardStatus.map(s => ({ label: STATUS_LBL[s.status] || s.status, value: s.count })), tone: 'success' }) })),
        card({ title: 'Evolução da pontuação mensal', subtitle: 'Soma dos pontos gerados por mês (todos os participantes)', body: columnChart({ title: 'Pontos por mês', items: o.monthly.map(m => ({ label: fmt.monthFull(m.month), short: fmt.month(m.month).slice(0, 3), value: m.points })) }) }),
        card({ title: 'Inconsistências de cadastro e saldo', actions: [button('Ver participantes', { variant: 'secondary', size: 'sm', onClick: () => app.navigate('/gestao/participantes') })], body: incons })));
  }

  /* ======================================================================
     PARTICIPANTES
     ====================================================================== */
  function participantForm(app, p) {
    const f = {
      name: field({ label: 'Nome completo', required: true, value: p ? p.name : '', maxlength: 100, autocomplete: 'off' }),
      email: field({ label: 'E-mail corporativo', type: 'email', required: true, value: p ? p.email : '', hint: 'Use somente e-mails fictícios nesta demonstração (ex.: nome@exemplo.test).', maxlength: 120 }),
      location: field({ type: 'select', label: 'Localidade', required: true, value: p ? p.location : '', options: [{ value: '', label: 'Selecione' }].concat(cfg.locations.map(l => ({ value: l.id, label: l.label }))) })
    };
    const act = toggle('Participante ativo', p ? p.active : true);
    const err = h('div', { tabindex: '-1' });
    modal({
      title: p ? 'Editar participante' : 'Cadastrar participante', description: p ? `Identificador ${p.id}` : 'O participante poderá acessar o leilão quando estiver ativo.',
      body: h('div', { class: 'stack' }, h('div', { class: 'form-grid' }, f.name.el, f.email.el, f.location.el, h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Situação'), act.el)), err),
      actions: [{ label: 'Cancelar', variant: 'secondary' }, {
        label: p ? 'Salvar alterações' : 'Cadastrar', variant: 'primary', onClick: async (api, btn) => {
          clear(err);
          const input = { id: p ? p.id : null, name: f.name.input.value, email: f.email.input.value, location: f.location.input.value, active: act.input.checked };
          const local = {};
          const n = V.validateName(input.name); if (!n.ok) local.name = n.error;
          const e = V.validateEmail(input.email); if (!e.ok) local.email = e.error;
          if (!input.location) local.location = 'Selecione uma localidade.';
          if (applyErrors(f, local)) return;
          setBusy(btn, true);
          try { const r = await app.api.saveParticipant(input); api.close(); toast(p ? `Cadastro de ${r.name} atualizado.` : `${r.name} cadastrado com sucesso.`, 'success'); app.refresh(); }
          catch (ex) { setBusy(btn, false); if (ex.details && !applyErrors(f, ex.details)) err.appendChild(alertBox('error', null, ex.message)); else if (!ex.details) err.appendChild(alertBox('error', null, ex.message)); }
        }
      }]
    });
  }
  async function toggleParticipant(app, p) {
    const r = await confirmDialog({
      title: p.active ? `Inativar ${p.name}?` : `Ativar ${p.name}?`,
      message: p.active ? 'O participante deixará de poder registrar lances e não será elegível na homologação. Pontuações, lances e histórico são mantidos (não há exclusão física).' : 'O participante voltará a poder registrar lances nas rodadas abertas.',
      confirmLabel: p.active ? 'Inativar' : 'Ativar', variant: p.active ? 'danger' : 'primary', justification: { label: 'Justificativa', min: p.active ? 10 : 0 }
    });
    if (!r) return;
    const res = await app.run(() => app.api.setParticipantActive(p.id, !p.active, r.justification), { success: p.active ? `${p.name} foi inativado.` : `${p.name} foi ativado.` });
    if (res.ok) app.refresh();
  }
  async function participantDetails(app, p) {
    const pts = await app.api.getPoints(p.id).catch(() => []);
    modal({
      title: p.name, description: `${p.email} · ${fmt.location(p.location)}`, wide: true,
      body: h('div', { class: 'stack' },
        h('div', { class: 'tag-list' }, chip(p.active ? 'ativo' : 'inativo_p'), p.award ? chip('homologado', 'Contemplado') : null, p.hasBid ? chip('aberta', 'Com lance ativo') : chip('futura', 'Sem lance ativo')),
        summaryList([['Pontos acumulados', fmt.pts(p.earned)], ['Pontos utilizados', fmt.pts(p.consumed)], ['Saldo disponível', fmt.pts(p.balance), 'total'], ['Última atualização', fmt.dateTime(p.lastUpdate)], ['Cadastrado em', fmt.dateTime(p.createdAt)]]),
        dataTable({ caption: 'Pontuação mensal', stack: false, columns: [{ key: 'month', label: 'Mês', render: r => fmt.monthFull(r.month) }, { key: 'achievement', label: 'Atingimento', num: true, render: r => fmt.pct(r.achievement) }, { key: 'points', label: 'Pontos', num: true, render: r => fmt.int(r.points) }, { key: 'updatedAt', label: 'Atualização', render: r => fmt.dateTime(r.updatedAt) }], rows: pts, empty: 'Nenhuma pontuação lançada.' }).el),
      actions: [{ label: 'Fechar', variant: 'secondary' }, { label: 'Editar', variant: 'primary', onClick: api => { api.close(); participantForm(app, p); } }]
    });
  }
  async function participantes(ctx, app) {
    const rows = await app.api.getParticipants();
    const search = field({ label: 'Pesquisar', type: 'search', icon: 'search', placeholder: 'Nome ou e-mail', className: 'field--search' });
    const loc = field({ type: 'select', label: 'Localidade', options: [{ value: '', label: 'Todas' }].concat(cfg.locations.map(l => ({ value: l.id, label: l.label }))) });
    const st = field({ type: 'select', label: 'Status', options: [{ value: '', label: 'Todos' }, { value: 'ativo', label: 'Ativos' }, { value: 'inativo', label: 'Inativos' }, { value: 'contemplado', label: 'Contemplados' }, { value: 'sem_lance', label: 'Sem lance na rodada' }] });
    const table = dataTable({
      caption: 'Participantes da campanha', captionHint: 'Inativação é lógica: nenhum participante com histórico é excluído.', pageSize: cfg.demo.pageSize, initialSort: { key: 'name', dir: 'asc' }, rowKey: r => r.id,
      columns: [
        { key: 'name', label: 'Participante', sortable: true, render: r => h('div', null, h('div', { class: 'cell-main' }, r.name), h('div', { class: 'cell-sub' }, r.email)) },
        { key: 'location', label: 'Localidade', sortable: true, sortValue: r => fmt.location(r.location), render: r => fmt.location(r.location) },
        { key: 'active', label: 'Status', render: r => chip(r.active ? 'ativo' : 'inativo_p') },
        { key: 'earned', label: 'Acumulados', num: true, sortable: true, render: r => fmt.int(r.earned) },
        { key: 'consumed', label: 'Utilizados', num: true, sortable: true, render: r => fmt.int(r.consumed) },
        { key: 'balance', label: 'Saldo', num: true, sortable: true, render: r => h('strong', null, fmt.int(r.balance)) },
        { key: 'lastUpdate', label: 'Última atualização', sortable: true, render: r => fmt.date(r.lastUpdate) },
        { key: 'act', label: 'Ações', actions: true, render: r => h('div', { class: 'row', style: 'justify-content:flex-end;gap:4px' },
          button('Ver', { variant: 'tertiary', size: 'sm', ariaLabel: `Ver detalhes de ${r.name}`, onClick: () => participantDetails(app, r) }),
          button('Editar', { variant: 'tertiary', size: 'sm', ariaLabel: `Editar ${r.name}`, onClick: () => participantForm(app, r) }),
          button(r.active ? 'Inativar' : 'Ativar', { variant: 'tertiary', size: 'sm', ariaLabel: `${r.active ? 'Inativar' : 'Ativar'} ${r.name}`, onClick: () => toggleParticipant(app, r) })) }
      ],
      rows, empty: rows.length ? 'Nenhum participante corresponde aos filtros.' : 'Nenhum participante cadastrado. Use “Cadastrar participante” para começar.'
    });
    const count = h('p', { class: 'muted', 'aria-live': 'polite' });
    function apply() {
      const q = search.input.value.trim().toLowerCase();
      const list = rows.filter(r => (!q || r.name.toLowerCase().includes(q) || r.email.includes(q)) && (!loc.input.value || r.location === loc.input.value) &&
        (!st.input.value || (st.input.value === 'ativo' && r.active) || (st.input.value === 'inativo' && !r.active) || (st.input.value === 'contemplado' && r.award) || (st.input.value === 'sem_lance' && r.active && !r.hasBid && !r.award)));
      table.update(list); count.textContent = `${fmt.plural(list.length, 'participante', 'participantes')} na lista.`;
    }
    let t; search.input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 200); });
    [loc, st].forEach(f => f.input.addEventListener('change', apply));
    apply();
    const exportCsv = () => { download('participantes.csv', V.toCSV(['ID', 'Nome', 'E-mail', 'Localidade', 'Status', 'Acumulados', 'Utilizados', 'Saldo', 'Última atualização'], table.rows().map(r => [r.id, r.name, r.email, fmt.location(r.location), r.active ? 'Ativo' : 'Inativo', r.earned, r.consumed, r.balance, csvDate(r.lastUpdate)])), 'text/csv;charset=utf-8'); toast('Arquivo participantes.csv gerado.', 'success'); };
    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Participantes', desc: 'Cadastro, situação e saldo dos operadores da campanha.', actions: [button('Exportar CSV', { variant: 'secondary', icon: 'download', onClick: exportCsv, disabled: !rows.length }), button('Cadastrar participante', { icon: 'plus', onClick: () => participantForm(app, null) })] }),
      emptyModeNotice(ctx),
      h('div', { class: 'toolbar' }, search.el, loc.el, st.el), count, h('div', { class: 'mt-3' }, table.el));
  }

  /* ======================================================================
     PONTUAÇÃO
     ====================================================================== */
  async function pontuacao(ctx, app) {
    const [people, points] = await Promise.all([app.api.getParticipants(), app.api.getPoints()]);
    const pOpts = [{ value: '', label: 'Selecione um participante' }].concat(people.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(p => ({ value: p.id, label: `${p.name} · ${fmt.location(p.location)}${p.active ? '' : ' (inativo)'}` })));
    const f = {
      participantId: field({ type: 'select', label: 'Participante', required: true, options: pOpts }),
      month: field({ type: 'select', label: 'Mês de referência', required: true, options: cfg.scoringMonths.map(m => ({ value: m, label: fmt.monthFull(m) })) }),
      achievement: field({ label: 'Atingimento da meta', required: true, inputmode: 'decimal', suffix: '%', placeholder: 'Ex.: 108,5', hint: 'Aceita decimais com vírgula. Não aceita valores negativos.' }),
      justification: field({ label: 'Justificativa', optional: true, maxlength: 300, hint: 'Registrada na trilha de auditoria.' })
    };
    const preview = h('p', { class: 'kpi__value', 'aria-live': 'polite' }, '0', h('small', null, 'pontos'));
    const previewHint = h('p', { class: 'kpi__hint' }, 'Informe o atingimento para calcular.');
    function calc() {
      const r = V.validateAchievement(f.achievement.input.value);
      clear(preview);
      if (!f.achievement.input.value.trim()) { preview.append('0', h('small', null, 'pontos')); previewHint.textContent = 'Informe o atingimento para calcular.'; f.achievement.setError(''); return; }
      if (!r.ok) { preview.append('—'); previewHint.textContent = r.error; f.achievement.setError(r.error); return; }
      f.achievement.setError('');
      const pts = LNA.domain.calcPoints(r.value); // regra única
      preview.append(fmt.int(pts), h('small', null, 'pontos'));
      previewHint.textContent = `${fmt.pct(r.value)} → ${Math.floor(Math.max(0, Math.round((r.value - 100) * 100) / 100))} p.p. inteiros acima de 100% × 10`;
    }
    f.achievement.input.addEventListener('input', calc);
    const monthly = h('div');
    function renderMonthly() {
      clear(monthly);
      const pid = f.participantId.input.value;
      if (!pid) { monthly.appendChild(stateBlock({ kind: 'empty', icon: 'users', title: 'Selecione um participante', text: 'A visualização mensal mostra os 11 meses de pontuação do participante escolhido.' })); return; }
      const mine = points.filter(x => x.participantId === pid);
      const rows = cfg.scoringMonths.map(m => mine.find(x => x.month === m) || { month: m, missing: true });
      monthly.appendChild(dataTable({
        caption: `Pontuação mensal · ${(people.find(p => p.id === pid) || {}).name}`, stack: true,
        columns: [
          { key: 'month', label: 'Mês', render: r => fmt.monthFull(r.month) },
          { key: 'achievement', label: 'Atingimento', num: true, render: r => r.missing ? 'Não lançado' : fmt.pct(r.achievement) },
          { key: 'points', label: 'Pontos', num: true, render: r => r.missing ? '—' : h('strong', null, fmt.int(r.points)) },
          { key: 'type', label: 'Tipo', render: r => r.missing ? '—' : ({ carga_inicial: 'Carga inicial', manual: 'Manual', importacao: 'Importação', migracao: 'Migração' }[r.type] || r.type) },
          { key: 'updatedAt', label: 'Atualização', render: r => r.missing ? '—' : `${fmt.dateTime(r.updatedAt)} · ${r.updatedBy}` },
          { key: 'edit', label: 'Ações', actions: true, render: r => button('Editar', { variant: 'tertiary', size: 'sm', ariaLabel: `Editar ${fmt.monthFull(r.month)}`, onClick: () => { f.month.input.value = r.month; f.achievement.input.value = r.missing ? '' : String(r.achievement).replace('.', ','); calc(); f.achievement.input.focus(); } }) }
        ], rows
      }).el);
    }
    f.participantId.input.addEventListener('change', renderMonthly);
    renderMonthly();
    const saveBtn = button('Salvar pontuação', { type: 'submit', icon: 'check' });
    const form = h('form', { novalidate: true },
      h('div', { class: 'form-grid' }, f.participantId.el, f.month.el, f.achievement.el, h('div', { class: 'card kpi kpi--brand' }, h('p', { class: 'kpi__label' }, 'Pontos calculados'), preview, previewHint), h('div', { class: 'span-2' }, f.justification.el)),
      h('div', { class: 'form-actions' }, saveBtn));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const local = {};
      if (!f.participantId.input.value) local.participantId = 'Selecione um participante.';
      const a = V.validateAchievement(f.achievement.input.value); if (!a.ok) local.achievement = a.error;
      if (applyErrors(f, local)) return;
      const pid = f.participantId.input.value, month = f.month.input.value;
      const existing = points.find(x => x.participantId === pid && x.month === month);
      const newPts = LNA.domain.calcPoints(a.value);
      const ok = await confirmDialog({
        title: existing ? 'Substituir pontuação existente?' : 'Lançar pontuação?',
        details: summaryList([['Participante', (people.find(p => p.id === pid) || {}).name], ['Mês', fmt.monthFull(month)], ['Valor anterior', existing ? `${fmt.pct(existing.achievement)} · ${fmt.pts(existing.points)}` : 'Não lançado'], ['Novo valor', `${fmt.pct(a.value)} · ${fmt.pts(newPts)}`, 'total']]),
        message: 'A alteração será registrada na trilha de auditoria com o valor anterior e o novo.', confirmLabel: 'Confirmar alteração'
      });
      if (!ok) return;
      const r = await app.run(() => app.api.savePoints({ participantId: pid, month, achievement: f.achievement.input.value, justification: f.justification.input.value }), { busyButton: saveBtn, success: res => `Pontuação de ${fmt.monthFull(res.month)} salva para ${res.participant.name}: ${fmt.pts(res.after.points)}.` });
      if (r.ok) {
        r.value.warnings.forEach(w => toast(w, 'warning', { title: 'Atenção ao saldo' }));
        app.params = { keepParticipant: pid }; app.refresh();
      } else if (r.error.details) applyErrors(f, r.error.details);
    });
    if (app.params.keepParticipant) { f.participantId.input.value = app.params.keepParticipant; renderMonthly(); app.params.keepParticipant = null; }

    /* Importação CSV */
    const fileIn = h('input', { type: 'file', id: 'csv-file', accept: '.csv,text/csv' });
    const paste = field({ type: 'textarea', label: 'Ou cole o conteúdo do CSV', rows: 5, placeholder: 'nome;email;mes;atingimento\nAlex Silva;operador1@exemplo.test;2027-11;112,5' });
    const importErr = h('div', { tabindex: '-1' });
    const validateBtn = button('Validar arquivo', { icon: 'check', variant: 'secondary' });
    validateBtn.addEventListener('click', async () => {
      clear(importErr);
      let text = paste.input.value.trim();
      if (fileIn.files && fileIn.files[0]) { try { text = await readFile(fileIn.files[0], 1024 * 1024); } catch (e) { importErr.appendChild(alertBox('error', null, e.message)); return; } }
      if (!text) { importErr.appendChild(alertBox('warning', null, 'Selecione um arquivo .csv ou cole o conteúdo antes de validar.')); importErr.focus(); return; }
      const r = await app.run(() => app.api.previewPointsImport(text), { busyButton: validateBtn, errorTarget: importErr });
      if (r.ok) importPreview(app, r.value);
    });
    const template = () => download('modelo-importacao-pontuacao.csv', V.toCSV(['nome', 'email', 'mes', 'atingimento'], [['Alex Silva', 'operador1@exemplo.test', '2027-11', '112,5'], ['Marina Souza', 'operador2@exemplo.test', '2027-11', '104']]), 'text/csv;charset=utf-8');
    const exportHist = () => { download('historico-pontuacao.csv', V.toCSV(['Participante', 'E-mail', 'Mês', 'Atingimento (%)', 'Pontos', 'Tipo', 'Atualizado em', 'Atualizado por'], points.map(x => { const p = people.find(y => y.id === x.participantId) || {}; return [p.name, p.email, x.month, String(x.achievement).replace('.', ','), x.points, x.type, csvDate(x.updatedAt), x.updatedBy]; })), 'text/csv;charset=utf-8'); toast('Histórico exportado.', 'success'); };

    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Pontuação', desc: 'Lançamentos mensais de atingimento. Cada ponto percentual inteiro acima de 100% gera 10 pontos.', actions: [button('Exportar histórico', { variant: 'secondary', icon: 'download', onClick: exportHist, disabled: !points.length })] }),
      emptyModeNotice(ctx),
      h('div', { class: 'stack' },
        card({ title: 'Atualização individual', subtitle: 'Edição controlada: toda alteração pede confirmação e gera auditoria.', body: form }),
        card({ title: 'Visualização mensal', body: monthly }),
        card({
          title: 'Importação simulada por CSV', subtitle: 'Colunas obrigatórias: nome; email; mes (AAAA-MM ou MM/AAAA); atingimento (ex.: 108,5).',
          actions: [button('Baixar modelo', { variant: 'tertiary', icon: 'download', onClick: template })],
          body: h('div', { class: 'stack' }, h('div', { class: 'upload' }, h('label', { class: 'field__label', for: 'csv-file' }, 'Arquivo CSV (até 1 MB)'), h('div', { class: 'mt-2' }, fileIn)), paste.el, importErr, h('div', { class: 'form-actions', style: 'margin-top:0' }, validateBtn))
        })));
  }
  function importPreview(app, pv) {
    const t = pv.totals;
    const table = dataTable({
      caption: 'Registros do arquivo', pageSize: 10, stack: false,
      columns: [
        { key: 'line', label: 'Linha', num: true },
        { key: 'status', label: 'Situação', render: r => chip(r.status) },
        { key: 'email', label: 'Participante', render: r => h('div', null, h('div', { class: 'cell-main' }, r.raw.nome || '—'), h('div', { class: 'cell-sub' }, r.raw.email || '—')) },
        { key: 'mes', label: 'Mês', render: r => r.month ? fmt.month(r.month) : r.raw.mes || '—' },
        { key: 'ating', label: 'Atingimento', num: true, render: r => r.achievement != null ? fmt.pct(r.achievement) : r.raw.atingimento || '—' },
        { key: 'points', label: 'Pontos', num: true, render: r => r.points != null ? fmt.int(r.points) : '—' },
        { key: 'obs', label: 'Observações', render: r => r.errors.length ? r.errors.join('; ') : r.updates ? `Atualiza (antes: ${fmt.int(r.previous)})` : 'Novo lançamento' }
      ], rows: pv.lines
    });
    modal({
      title: 'Prévia da importação', description: 'Nada foi gravado ainda. Somente os registros válidos serão importados.', wide: true,
      body: h('div', { class: 'stack' },
        h('div', { class: 'grid grid-4' }, kpi({ label: 'Registros válidos', value: fmt.int(t.valid), ic: 'checkCircle' }), kpi({ label: 'Inválidos', value: fmt.int(t.invalid), ic: 'x' }), kpi({ label: 'Duplicados', value: fmt.int(t.duplicated), ic: 'alert' }), kpi({ label: 'Pontos que serão gerados', value: fmt.int(t.points), tone: 'brand' })),
        alertBox('info', null, `${fmt.plural(t.updates, 'lançamento existente será atualizado', 'lançamentos existentes serão atualizados')} e ${fmt.plural(t.newEntries, 'novo lançamento será criado', 'novos lançamentos serão criados')}.`),
        table.el),
      actions: [
        { label: 'Cancelar', variant: 'secondary' },
        { label: 'Baixar relatório de erros', variant: 'tertiary', onClick: () => download('relatorio-importacao.csv', V.toCSV(['Linha', 'Situação', 'Nome', 'E-mail', 'Mês', 'Atingimento', 'Observações'], pv.lines.map(l => [l.line, l.status, l.raw.nome, l.raw.email, l.raw.mes, l.raw.atingimento, l.errors.join('; ')])), 'text/csv;charset=utf-8') },
        t.valid ? { label: `Importar ${fmt.plural(t.valid, 'registro', 'registros')}`, variant: 'primary', onClick: async (api, btn) => { const r = await app.run(() => app.api.confirmPointsImport(pv.token), { busyButton: btn, success: x => `${fmt.plural(x.applied, 'registro importado', 'registros importados')} com sucesso.` }); if (r.ok) { api.close(); app.refresh(); } } } : null
      ].filter(Boolean)
    });
  }

  /* ======================================================================
     PRÊMIOS
     ====================================================================== */
  function rewardForm(app, r) {
    const pol = r ? r.policy : { minBid: true, releaseRound: true, name: true };
    const f = {
      name: field({ label: 'Nome do prêmio', required: true, value: r ? r.name : '', maxlength: 80, disabled: !pol.name }),
      description: field({ label: 'Descrição curta', optional: true, value: r ? r.description : '', maxlength: 160 }),
      icon: field({ type: 'select', label: 'Ícone', value: r ? r.icon : 'gift', options: cfg.rewardIcons.map(i => ({ value: i, label: { tv: 'TV', bike: 'Bicicleta', laptop: 'Notebook', phone: 'Celular', fryer: 'Eletroportátil', headphones: 'Fone', coffee: 'Cafeteira', speaker: 'Caixa de som', suitcase: 'Mala', gift: 'Presente', plane: 'Viagem', star: 'Destaque' }[i] })) }),
      minBid: field({ label: 'Lance mínimo', required: true, inputmode: 'numeric', suffix: 'pts', value: r ? r.minBid : '', disabled: !pol.minBid, hint: pol.minBid ? 'Múltiplos de 10.' : 'Bloqueado: este prêmio já recebeu lances.' }),
      releaseRound: field({ type: 'select', label: 'Rodada de liberação', value: r ? String(r.releaseRound) : '1', disabled: !pol.releaseRound, options: [1, 2, 3].map(i => ({ value: String(i), label: roundLabel(i) })), hint: pol.releaseRound ? 'A repescagem libera todos os prêmios sem vencedor.' : 'Bloqueado: este prêmio já recebeu lances.' }),
      order: field({ label: 'Ordem de exibição', inputmode: 'numeric', value: r ? r.order : 99 })
    };
    const err = h('div');
    const iconPreview = h('div', null, rewardMedia(f.icon.input.value));
    f.icon.input.addEventListener('change', () => { clear(iconPreview); iconPreview.appendChild(rewardMedia(f.icon.input.value)); });
    modal({
      title: r ? `Editar ${r.name}` : 'Novo prêmio', wide: true,
      description: r && r.policy.hasBid ? 'Este prêmio já recebeu lances: lance mínimo e rodada ficam bloqueados para preservar a igualdade da disputa.' : 'Os dados podem ser alterados livremente enquanto o prêmio não tiver lances.',
      body: h('div', { class: 'stack' }, h('div', { class: 'row' }, iconPreview, h('p', { class: 'muted' }, 'Prévia do ícone. Substitua por imagem oficial quando houver.')),
        h('div', { class: 'form-grid' }, f.name.el, f.icon.el, h('div', { class: 'span-2' }, f.description.el), f.minBid.el, f.releaseRound.el, f.order.el), err),
      actions: [{ label: 'Cancelar', variant: 'secondary' }, {
        label: r ? 'Salvar alterações' : 'Criar prêmio', variant: 'primary', onClick: async (api, btn) => {
          clear(err);
          const input = { id: r ? r.id : null, name: f.name.input.value, description: f.description.input.value, icon: f.icon.input.value, minBid: f.minBid.input.value, releaseRound: f.releaseRound.input.value, order: f.order.input.value };
          setBusy(btn, true);
          try { const x = await app.api.saveReward(input); api.close(); toast(r ? `${x.name} atualizado.` : `${x.name} criado.`, 'success'); app.refresh(); }
          catch (ex) { setBusy(btn, false); if (ex.details) applyErrors(f, ex.details); err.appendChild(alertBox('error', null, ex.message)); }
        }
      }]
    });
  }
  async function toggleReward(app, r) {
    if (!r.active) { const res = await app.run(() => app.api.setRewardActive(r.id, true), { success: `${r.name} reativado.` }); if (res.ok) app.refresh(); return; }
    if (r.policy.deactivate === 'bloqueado') { toast('Prêmio homologado não pode ser inativado. Use a reversão da homologação, se necessário.', 'warning'); return; }
    const withBid = r.policy.deactivate === 'com_justificativa';
    const c = await confirmDialog({
      title: `Inativar ${r.name}?`, variant: 'danger', confirmLabel: 'Inativar prêmio',
      message: withBid ? 'Este prêmio possui lances. Os lances serão mantidos no histórico, mas não serão considerados na homologação enquanto o prêmio estiver inativo.' : 'O prêmio deixará de aparecer como disponível para lances.',
      justification: { label: 'Justificativa', min: withBid ? 15 : 0 }, requireCheck: withBid ? 'Entendo que esta ação afeta lances já registrados.' : null
    });
    if (!c) return;
    const res = await app.run(() => app.api.setRewardActive(r.id, false, c.justification), { success: `${r.name} inativado.` });
    if (res.ok) app.refresh();
  }
  async function premiosAdmin(ctx, app) {
    const rows = await app.api.getRewards();
    const view = app.params.rewardView || 'tabela';
    const table = dataTable({
      caption: 'Catálogo de prêmios', captionHint: 'Alterações em prêmios com lances são controladas e auditadas.', initialSort: { key: 'order', dir: 'asc' },
      columns: [
        { key: 'order', label: 'Ordem', num: true, sortable: true },
        { key: 'name', label: 'Prêmio', sortable: true, render: r => h('div', null, h('div', { class: 'cell-main' }, r.name), h('div', { class: 'cell-sub' }, r.description || '—')) },
        { key: 'status', label: 'Status', render: r => chip(r.status, r.status === 'em_breve' ? r.statusLabel : null) },
        { key: 'minBid', label: 'Mínimo', num: true, sortable: true, render: r => h('span', null, fmt.int(r.minBid), r.policy.minBid ? null : h('span', { class: 'sr-only' }, ' (bloqueado)'), r.policy.minBid ? null : icon('lock', 'icon-sm')) },
        { key: 'releaseRound', label: 'Rodada', sortable: true, render: r => roundLabel(r.releaseRound) },
        { key: 'primaryCount', label: 'Lances', num: true, sortable: true, render: r => `${fmt.int(r.primaryCount)} + ${fmt.int(r.secondCount)} (2ª)` },
        { key: 'highestPrimary', label: 'Maior lance', num: true, sortable: true, render: r => r.highestPrimary ? fmt.int(r.highestPrimary) : '—' },
        { key: 'winnerName', label: 'Vencedor', render: r => r.winnerName || '—' },
        { key: 'used', label: 'Pontos utilizados', num: true, render: r => r.award ? fmt.int(r.award.points) : '—' },
        { key: 'act', label: 'Ações', actions: true, render: r => h('div', { class: 'row', style: 'justify-content:flex-end;gap:4px' }, button('Editar', { variant: 'tertiary', size: 'sm', ariaLabel: `Editar ${r.name}`, onClick: () => rewardForm(app, r) }), button(r.active ? 'Inativar' : 'Ativar', { variant: 'tertiary', size: 'sm', ariaLabel: `${r.active ? 'Inativar' : 'Ativar'} ${r.name}`, onClick: () => toggleReward(app, r) })) }
      ], rows, empty: 'Nenhum prêmio cadastrado. Use “Novo prêmio”.'
    });
    const cards = h('div', { class: 'grid grid-3' }, rows.length ? rows.map(r => h('article', { class: ['card', 'reward-card', r.status !== 'disponivel' && 'is-muted'] },
      h('div', { class: 'reward-card__top' }, rewardMedia(r.icon), chip(r.status, r.status === 'em_breve' ? r.statusLabel : null)),
      h('h3', { class: 'reward-card__name' }, r.name),
      h('dl', { class: 'reward-stats' }, h('div', null, h('dt', null, 'Mínimo'), h('dd', null, fmt.int(r.minBid))), h('div', null, h('dt', null, 'Maior lance'), h('dd', { class: 'highlight' }, r.highestPrimary ? fmt.int(r.highestPrimary) : '—')), h('div', null, h('dt', null, 'Lances'), h('dd', null, fmt.int(r.primaryCount))), h('div', null, h('dt', null, 'Vencedor'), h('dd', null, r.winnerName || '—'))),
      h('div', { class: 'reward-card__actions' }, button('Editar', { variant: 'secondary', size: 'sm', onClick: () => rewardForm(app, r), ariaLabel: `Editar ${r.name}` })))) : h('div', { style: 'grid-column:1/-1' }, stateBlock({ kind: 'empty', icon: 'gift', title: 'Nenhum prêmio cadastrado.' })));
    const seg = h('div', { class: 'row', role: 'group', 'aria-label': 'Modo de visualização' },
      button('Tabela', { variant: view === 'tabela' ? 'primary' : 'secondary', size: 'sm', attrs: { 'aria-pressed': String(view === 'tabela') }, onClick: () => { app.params.rewardView = 'tabela'; app.refresh(); } }),
      button('Cards', { variant: view === 'cards' ? 'primary' : 'secondary', size: 'sm', attrs: { 'aria-pressed': String(view === 'cards') }, onClick: () => { app.params.rewardView = 'cards'; app.refresh(); } }));
    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Prêmios', desc: 'Configure nome, lance mínimo, rodada de liberação e ordem. O histórico nunca é apagado.', actions: [seg, button('Novo prêmio', { icon: 'plus', onClick: () => rewardForm(app, null) })] }),
      emptyModeNotice(ctx),
      alertBox('info', 'Regras de edição', 'Descrição, ícone e ordem podem ser alterados a qualquer momento. Lance mínimo e rodada ficam bloqueados após o primeiro lance. Inativar prêmio com lance exige justificativa.'),
      h('div', { class: 'mt-4' }, view === 'cards' ? cards : table.el));
  }

  /* ======================================================================
     LANCES
     ====================================================================== */
  async function lances(ctx, app) {
    const roundId = app.params.bidsRound || ctx.currentRoundId;
    const d = await app.api.getBids(roundId);
    const roundSel = field({ type: 'select', label: 'Rodada', value: String(roundId), options: cfg.calendar.rounds.map(r => ({ value: String(r.id), label: r.label + (r.id === ctx.currentRoundId ? ' (atual)' : '') })) });
    roundSel.input.addEventListener('change', () => { app.params.bidsRound = Number(roundSel.input.value); app.refresh(); });
    const search = field({ label: 'Pesquisar', type: 'search', icon: 'search', placeholder: 'Participante ou prêmio', className: 'field--search' });
    const table = dataTable({
      caption: `Lances ativos · ${roundLabel(roundId)}`, captionHint: 'Visível somente para a gestão. Inclui a segunda opção.', pageSize: 10, initialSort: { key: 'createdAt', dir: 'asc' },
      columns: [
        { key: 'participantName', label: 'Participante', sortable: true, render: r => h('div', null, h('div', { class: 'cell-main' }, r.participantName), h('div', { class: 'cell-sub' }, r.participantEmail)) },
        { key: 'primaryName', label: 'Prêmio principal', sortable: true },
        { key: 'primaryPoints', label: 'Pontos', num: true, sortable: true, render: r => h('strong', null, fmt.int(r.primaryPoints)) },
        { key: 'secondName', label: 'Segunda opção', render: r => r.secondName ? `${r.secondName} · ${fmt.int(r.secondPoints)}` : '—' },
        { key: 'balance', label: 'Saldo atual', num: true, render: r => r.primaryPoints > r.balance ? h('span', null, chip('invalido', 'Acima do saldo'), ' ', fmt.int(r.balance)) : fmt.int(r.balance) },
        { key: 'createdAt', label: 'Registrado em', sortable: true, render: r => fmt.dateTime(r.createdAt) },
        { key: 'version', label: 'Versão', num: true }
      ], rows: d.bids, empty: 'Nenhum lance foi registrado nesta rodada.'
    });
    search.input.addEventListener('input', () => { const q = search.input.value.trim().toLowerCase(); table.update(d.bids.filter(b => !q || [b.participantName, b.participantEmail, b.primaryName, b.secondName].join(' ').toLowerCase().includes(q))); });
    const tops = {};
    d.bids.forEach(b => { const t = tops[b.primaryRewardId]; if (!t || LNA.domain.compareOffers({ points: b.primaryPoints, createdAt: b.createdAt, email: b.participantEmail }, { points: t.primaryPoints, createdAt: t.createdAt, email: t.participantEmail }) < 0) tops[b.primaryRewardId] = b; });
    const topRows = Object.values(tops).map(b => ({ reward: b.primaryName, points: b.primaryPoints, leader: b.participantName, count: d.bids.filter(x => x.primaryRewardId === b.primaryRewardId).length, tie: d.bids.filter(x => x.primaryRewardId === b.primaryRewardId && x.primaryPoints === b.primaryPoints).length > 1 }));
    const exportCsv = () => { download(`lances-rodada-${roundId}.csv`, V.toCSV(['Participante', 'E-mail', 'Principal', 'Pontos', 'Segunda opção', 'Pontos 2ª', 'Registrado em', 'Versão', 'Situação'], d.bids.concat(d.history).map(b => [b.participantName, b.participantEmail, b.primaryName, b.primaryPoints, b.secondName || '', b.secondPoints || '', csvDate(b.createdAt), b.version, b.status])), 'text/csv;charset=utf-8'); toast('Lances exportados.', 'success'); };
    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Lances', desc: 'Acompanhe lances ativos, maiores lances, segundas opções e quem ainda não participou.', actions: [button('Exportar CSV', { variant: 'secondary', icon: 'download', onClick: exportCsv, disabled: !d.bids.length && !d.history.length })] }),
      emptyModeNotice(ctx),
      h('div', { class: 'toolbar' }, roundSel.el, search.el),
      h('div', { class: 'stack' }, table.el,
        dataTable({ caption: 'Maiores lances principais por prêmio', captionHint: 'Prévia informal; o resultado oficial sai da homologação.', columns: [{ key: 'reward', label: 'Prêmio' }, { key: 'points', label: 'Maior lance', num: true, render: r => fmt.int(r.points) }, { key: 'leader', label: 'Líder atual', render: r => h('span', null, r.leader, r.tie ? h('span', null, ' ', chip('duplicado', 'Empate')) : null) }, { key: 'count', label: 'Lances', num: true }], rows: topRows, empty: 'Sem lances principais.' }).el,
        h('div', { class: 'grid grid-2' },
          dataTable({ caption: 'Participantes sem lance', captionHint: 'Ativos e ainda não contemplados', columns: [{ key: 'name', label: 'Participante', render: r => h('div', null, h('div', { class: 'cell-main' }, r.name), h('div', { class: 'cell-sub' }, r.email)) }, { key: 'location', label: 'Localidade', render: r => fmt.location(r.location) }, { key: 'balance', label: 'Saldo', num: true, render: r => fmt.int(r.balance) }], rows: d.withoutBid, empty: 'Todos os participantes elegíveis já deram lance.' }).el,
          dataTable({ caption: 'Prêmios sem lance', captionHint: 'Elegíveis na rodada, sem lance principal nem segunda opção', columns: [{ key: 'name', label: 'Prêmio' }, { key: 'minBid', label: 'Mínimo', num: true, render: r => fmt.int(r.minBid) }], rows: d.rewardsWithoutBid, empty: 'Todos os prêmios elegíveis receberam lances.' }).el),
        dataTable({ caption: 'Histórico de substituições', captionHint: 'Versões anteriores mantidas para rastreabilidade', pageSize: 6, columns: [{ key: 'participantName', label: 'Participante' }, { key: 'primaryName', label: 'Principal', render: r => `${r.primaryName} · ${fmt.int(r.primaryPoints)}` }, { key: 'secondName', label: 'Segunda opção', render: r => r.secondName ? `${r.secondName} · ${fmt.int(r.secondPoints)}` : '—' }, { key: 'createdAt', label: 'Registrado', render: r => fmt.dateTime(r.createdAt) }, { key: 'replacedAt', label: 'Substituído em', render: r => fmt.dateTime(r.replacedAt) }], rows: d.history, empty: 'Nenhuma substituição nesta rodada.' }).el));
  }

  /* ======================================================================
     RODADAS E HOMOLOGAÇÃO
     ====================================================================== */
  function previewView(pv, names, opts = {}) {
    const pn = id => (names.people[id] || { name: id }).name;
    const rn = id => (names.rewards[id] || { name: id }).name;
    return h('div', { class: 'stack' },
      h('div', { class: 'print-only' }, h('h2', null, `${cfg.app.fullTitle} — Relatório de homologação`), h('p', null, `${roundLabel(pv.roundId)} · gerado em ${fmt.dateTime(pv.generatedAt)} · assinatura ${pv.signature}`)),
      h('div', { class: 'grid grid-4' },
        kpi({ label: 'Lances ativos', value: fmt.int(pv.bidCount), ic: 'gavel' }), kpi({ label: opts.final ? 'Vencedores homologados' : 'Vencedores propostos', value: fmt.int(pv.winners.length), ic: 'trophy', tone: 'brand' }),
        kpi({ label: 'Empates resolvidos', value: fmt.int(pv.ties.length), ic: 'split' }), kpi({ label: 'Conflitos', value: fmt.int(pv.conflicts.length), ic: 'alert' })),
      dataTable({
        caption: opts.final ? 'Vencedores homologados' : 'Vencedores propostos', stack: true,
        columns: [{ key: 'rewardId', label: 'Prêmio', render: r => rn(r.rewardId) }, { key: 'participantId', label: 'Participante', render: r => pn(r.participantId) }, { key: 'type', label: 'Origem', render: r => typeLabel(r.type) }, { key: 'points', label: 'Pontos', num: true, render: r => fmt.int(r.points) }, { key: 'reason', label: 'Motivo' }],
        rows: pv.winners, empty: 'Nenhum vencedor nesta rodada (sem lances elegíveis).'
      }).el,
      pv.ties.length ? h('div', { class: 'stack' }, dataTable({
        caption: 'Empates e desempates', stack: true,
        columns: [{ key: 'rewardId', label: 'Prêmio', render: r => rn(r.rewardId) }, { key: 'type', label: 'Fase', render: r => typeLabel(r.type) }, { key: 'points', label: 'Pontos', num: true, render: r => fmt.int(r.points) }, { key: 'participants', label: 'Empatados', render: r => r.participants.map(pn).join(', ') }, { key: 'criterionLabel', label: 'Critério aplicado' }, { key: 'winnerId', label: 'Vencedor', render: r => pn(r.winnerId) }],
        rows: pv.ties
      }).el, alertBox('warning', 'Validação do negócio necessária', 'O critério de desempate por horário de registro e, depois, por e-mail em ordem alfabética é técnico e determinístico para esta demonstração. O critério definitivo precisa ser validado pela área de negócio antes da produção.')) : null,
      pv.conflicts.length ? dataTable({ caption: 'Conflitos entre escolhas', captionHint: 'Participantes que lideravam mais de um prêmio antes da resolução', stack: true, columns: [{ key: 'participantId', label: 'Participante', render: r => pn(r.participantId) }, { key: 'leads', label: 'Liderava', render: r => r.leads.map(l => `${rn(l.rewardId)} (${typeLabel(l.type).toLowerCase()}, ${fmt.int(l.points)})`).join('; ') }, { key: 'resolution', label: 'Resolução' }], rows: pv.conflicts }).el : null,
      dataTable({ caption: 'Lances não considerados e motivos', pageSize: 8, stack: true, columns: [{ key: 'participantId', label: 'Participante', render: r => pn(r.participantId) }, { key: 'type', label: 'Tipo', render: r => typeLabel(r.type) }, { key: 'rewardId', label: 'Prêmio', render: r => rn(r.rewardId) }, { key: 'points', label: 'Pontos', num: true, render: r => fmt.int(r.points) }, { key: 'reason', label: 'Motivo' }], rows: pv.notConsidered, empty: 'Todos os lances elegíveis foram considerados.' }).el,
      h('div', { class: 'grid grid-2' },
        card({ title: 'Prêmios sem lance principal elegível', body: pv.rewardsWithoutPrimary.length ? h('ul', null, pv.rewardsWithoutPrimary.map(id => h('li', null, rn(id), pv.onlySecondOption.includes(id) ? ' — recebido pela segunda opção' : ''))) : h('p', { class: 'muted' }, 'Nenhum.') }),
        card({ title: 'Prêmios que seguem sem vencedor', body: pv.rewardsWithoutWinner.length ? h('ul', null, pv.rewardsWithoutWinner.map(id => h('li', null, rn(id)))) : h('p', { class: 'muted' }, 'Nenhum.') })),
      card({ title: 'Participantes já contemplados (inelegíveis)', body: pv.alreadyAwardedParticipants.length ? h('p', null, pv.alreadyAwardedParticipants.map(pn).join(', ')) : h('p', { class: 'muted' }, 'Nenhum participante contemplado em rodadas anteriores.') }));
  }
  function printModal(title, node) {
    const m = modal({ title, wide: true, body: node, actions: [{ label: 'Fechar', variant: 'secondary' }, { label: 'Imprimir', variant: 'primary', icon: 'printer', onClick: () => { doc.body.classList.add('printing-modal'); root.print(); } }] });
    const after = () => doc.body.classList.remove('printing-modal');
    root.addEventListener('afterprint', after, { once: true });
    return m;
  }

  async function rodadas(ctx, app) {
    const [d, people, rewards] = await Promise.all([app.api.getRounds(), app.api.getParticipants(), app.api.getRewards()]);
    const names = { people: Object.fromEntries(people.map(p => [p.id, p])), rewards: Object.fromEntries(rewards.map(r => [r.id, r])) };
    const cur = d.rounds.find(r => r.id === d.currentRoundId);
    const errBox = h('div', { tabindex: '-1' });

    const roundCards = h('div', { class: 'grid grid-4' }, d.rounds.map(r => h('article', { class: ['card', 'round-card', r.id === d.currentRoundId && 'is-current', r.status === 'homologada' && 'is-done'], 'aria-current': r.id === d.currentRoundId ? 'step' : null },
      h('div', { class: 'row between' }, h('h3', { class: 'card__title' }, r.label), chip(r.status)),
      h('p', { class: 'muted' }, `${fmt.date(LNA.domain.dayStart(r.start))} a ${fmt.date(LNA.domain.dayEnd(r.end))}`),
      summaryList([['Lances ativos', fmt.int(r.bidCount)], ['Participantes', fmt.int(r.participants)], ['Prêmios homologados', fmt.int(r.awards)], ['Calendário', { futura: 'Não iniciada', em_andamento: 'Em andamento', encerrada: 'Prazo encerrado' }[r.timeStatus]]]))));

    const pv = d.preview;
    const simulateBtn = button(pv ? 'Simular novamente' : 'Simular encerramento', { variant: pv ? 'secondary' : 'primary', icon: 'eye', disabled: cur.status === 'homologada' || cur.status === 'futura' });
    const confirmBtn = button('Confirmar homologação', { icon: 'shield', disabled: !pv || cur.status === 'homologada' });
    const nextRound = cfg.calendar.rounds.find(r => r.id === d.currentRoundId + 1);
    const nextBtn = button(nextRound ? `Abrir ${nextRound.label}` : 'Todas as rodadas concluídas', { variant: 'secondary', icon: 'flag', disabled: cur.status !== 'homologada' || !nextRound });

    simulateBtn.addEventListener('click', async () => { clear(errBox); const r = await app.run(() => app.api.simulateHomologation(), { busyButton: simulateBtn, errorTarget: errBox, success: 'Prévia gerada. Revise vencedores, empates e lances não considerados.' }); if (r.ok) app.refresh(); });
    confirmBtn.addEventListener('click', async () => {
      clear(errBox);
      const c = await confirmDialog({
        title: `Homologar a ${cur.label}?`, variant: 'primary', confirmLabel: 'Homologar rodada',
        message: `Serão homologados ${fmt.plural(pv.winners.length, 'vencedor', 'vencedores')}. Os pontos dos vencedores serão consumidos e a rodada será encerrada para lances. Uma homologação confirmada não pode ser repetida; reversões exigem justificativa e ficam na auditoria.`,
        justification: { label: 'Observação da homologação', min: 0 }, requireCheck: 'Revisei a prévia, os empates e os lances não considerados.'
      });
      if (!c) return;
      const r = await app.run(() => app.api.confirmHomologation(cur.id, pv.signature, c.justification), { busyButton: confirmBtn, errorTarget: errBox, success: `${cur.label} homologada com sucesso.` });
      app.refresh();
      if (r.ok) setTimeout(() => printModal(`Relatório de homologação · ${cur.label}`, previewView(r.value.snapshot, names, { final: true })), 300);
    });
    nextBtn.addEventListener('click', async () => {
      const c = await confirmDialog({ title: `Abrir a ${nextRound.label}?`, message: `Os participantes poderão registrar lances nos prêmios liberados até a ${nextRound.label}. Na demonstração, se a data simulada estiver antes do início, ela será ajustada para ${fmt.date(LNA.domain.dayStart(nextRound.start))} às 09h00.`, confirmLabel: 'Abrir rodada' });
      if (!c) return;
      const r = await app.run(() => app.api.openNextRound(), { busyButton: nextBtn, success: `${nextRound.label} aberta para lances.` });
      if (r.ok) app.refresh();
    });

    const flow = h('ol', { class: 'stack-sm muted', style: 'padding-left:20px;margin:0' }, ['Simular resultado', 'Revisar vencedores, conflitos, desempates e lances não considerados', 'Confirmar homologação (com registro na auditoria)', 'Imprimir o relatório', 'Abrir a próxima rodada'].map(s => h('li', null, s)));
    const current = card({
      title: `${cur.label} · rodada atual`, subtitle: `${fmt.date(LNA.domain.dayStart(cur.start))} a ${fmt.date(LNA.domain.dayEnd(cur.end))} · ${fmt.plural(cur.bidCount, 'lance ativo', 'lances ativos')} · ${fmt.plural(cur.participants, 'participante', 'participantes')}`,
      actions: [chip(cur.status)],
      body: h('div', { class: 'stack' },
        cur.status === 'aberta' && cur.timeStatus === 'em_andamento' ? alertBox('warning', 'Rodada ainda em andamento pelo calendário', 'Você pode simular a qualquer momento. Na demonstração também é possível homologar antes do fim do prazo; em produção, a homologação deve ocorrer após o encerramento.') : null,
        cur.status === 'encerrada' ? alertBox('error', 'Homologação revertida', 'A rodada está encerrada para lances e aguarda nova simulação e homologação.') : null,
        flow, errBox,
        h('div', { class: 'row' }, simulateBtn, confirmBtn, nextBtn, pv ? button('Imprimir prévia', { variant: 'tertiary', icon: 'printer', onClick: () => printModal(`Prévia de homologação · ${cur.label}`, previewView(pv, names)) }) : null))
    });

    const previewSection = pv && cur.status !== 'homologada'
      ? h('section', { class: 'section', 'aria-labelledby': 'pv-title' }, h('div', { class: 'section__title' }, h('h2', { id: 'pv-title' }, 'Prévia da homologação'), h('span', { class: 'muted' }, `Gerada em ${fmt.dateTime(pv.generatedAt)} · assinatura ${pv.signature}`)), alertBox('info', null, 'Nada foi gravado. Se houver novos lances ou alterações de pontuação, a confirmação será bloqueada e uma nova simulação será exigida.'), h('div', { class: 'mt-4' }, previewView(pv, names)))
      : null;

    const homs = d.homologations;
    const last = homs.find(x => x.status === 'confirmada' && x.roundId === d.currentRoundId && cur.status === 'homologada');
    const revertBtn = last ? button('Reverter homologação', { variant: 'danger', size: 'sm', icon: 'refresh', onClick: async () => {
      const c = await confirmDialog({ title: `Reverter a homologação da ${cur.label}?`, variant: 'danger', confirmLabel: 'Reverter', message: 'Os prêmios desta rodada voltam a ficar sem vencedor e os pontos deixam de ser consumidos. O registro original é mantido como "revertido". Use somente em caso de erro comprovado.', justification: { label: 'Justificativa da reversão', min: 20 }, requireCheck: 'Confirmo que a reversão foi autorizada pela gestão da campanha.' });
      if (!c) return;
      const r = await app.run(() => app.api.revertHomologation(cur.id, c.justification), { success: 'Homologação revertida e registrada na auditoria.' });
      if (r.ok) app.refresh();
    } }) : null;

    const history = card({
      title: 'Homologações registradas', actions: revertBtn ? [revertBtn] : null,
      body: homs.length ? dataTable({
        caption: 'Histórico de homologações', stack: true,
        columns: [{ key: 'id', label: 'Código' }, { key: 'roundId', label: 'Rodada', render: r => roundLabel(r.roundId) }, { key: 'at', label: 'Data', render: r => fmt.dateTime(r.at) }, { key: 'by', label: 'Responsável' }, { key: 'winners', label: 'Vencedores', num: true }, { key: 'status', label: 'Situação', render: r => chip(r.status === 'confirmada' ? 'homologado' : 'revertido', r.status === 'confirmada' ? 'Confirmada' : 'Revertida') },
          { key: 'rep', label: 'Relatório', actions: true, render: r => button('Ver relatório', { variant: 'tertiary', size: 'sm', icon: 'printer', onClick: () => printModal(`Relatório de homologação · ${roundLabel(r.roundId)}`, previewView(r.snapshot, names, { final: true })) }) }],
        rows: homs
      }).el : stateBlock({ kind: 'empty', icon: 'shield', title: 'Nenhuma rodada foi homologada ainda.', text: 'Depois da confirmação, o relatório fica disponível aqui para consulta e impressão.' })
    });
    const awards = dataTable({
      caption: 'Prêmios homologados', pageSize: 10,
      columns: [{ key: 'roundId', label: 'Rodada', render: r => roundLabel(r.roundId) }, { key: 'rewardName', label: 'Prêmio' }, { key: 'participantName', label: 'Participante', render: r => h('div', null, h('div', { class: 'cell-main' }, r.participantName), h('div', { class: 'cell-sub' }, r.participantEmail)) }, { key: 'type', label: 'Origem', render: r => typeLabel(r.type) }, { key: 'points', label: 'Pontos', num: true, render: r => fmt.int(r.points) }, { key: 'status', label: 'Situação', render: r => chip(r.status) }],
      rows: d.awards, empty: 'Nenhum prêmio homologado.'
    });
    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Rodadas e homologação', desc: 'Nenhuma rodada é homologada sem prévia e confirmação. Cada passo fica registrado na auditoria.' }),
      emptyModeNotice(ctx),
      h('div', { class: 'stack' }, roundCards, current, previewSection, history, awards.el));
  }

  /* ======================================================================
     AUDITORIA
     ====================================================================== */
  async function auditoria(ctx, app) {
    const log = await app.api.getAuditLog();
    const actions = [...new Set(log.map(a => a.action))].sort();
    const entities = [...new Set(log.map(a => a.entity))].sort();
    const search = field({ label: 'Pesquisar', type: 'search', icon: 'search', placeholder: 'Responsável, identificador ou valor', className: 'field--search' });
    const act = field({ type: 'select', label: 'Ação', options: [{ value: '', label: 'Todas' }].concat(actions.map(a => ({ value: a, label: ACTION_LABEL[a] || a }))) });
    const ent = field({ type: 'select', label: 'Entidade', options: [{ value: '', label: 'Todas' }].concat(entities.map(e => ({ value: e, label: e }))) });
    const short = v => v == null ? '—' : String(v).length > 90 ? String(v).slice(0, 90) + '…' : String(v);
    const table = dataTable({
      caption: 'Trilha de auditoria', captionHint: 'Mais recentes primeiro', pageSize: 10,
      columns: [
        { key: 'at', label: 'Data e hora', render: r => fmt.dateTime(r.at) },
        { key: 'actor', label: 'Responsável', render: r => h('div', null, h('div', { class: 'cell-main' }, r.actor), h('div', { class: 'cell-sub' }, r.role)) },
        { key: 'action', label: 'Ação', render: r => ACTION_LABEL[r.action] || r.action },
        { key: 'entity', label: 'Entidade', render: r => `${r.entity} · ${r.entityId}` },
        { key: 'before', label: 'Valor anterior', render: r => h('span', { class: 'code' }, short(r.before)) },
        { key: 'after', label: 'Valor posterior', render: r => h('span', { class: 'code' }, short(r.after)) },
        { key: 'justification', label: 'Justificativa', render: r => r.justification || '—' },
        { key: 'origin', label: 'Origem' },
        { key: 'result', label: 'Resultado', render: r => r.result === 'sucesso' ? chip('valido', 'Sucesso') : h('span', null, r.result) }
      ], rows: log, empty: 'Nenhum registro de auditoria.'
    });
    function apply() { const q = search.input.value.trim().toLowerCase(); table.update(log.filter(a => (!act.input.value || a.action === act.input.value) && (!ent.input.value || a.entity === ent.input.value) && (!q || [a.actor, a.entityId, a.before, a.after, a.justification, a.result].join(' ').toLowerCase().includes(q)))); }
    let t; search.input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 200); });
    [act, ent].forEach(f => f.input.addEventListener('change', apply));
    const exportCsv = () => { download('auditoria.csv', V.toCSV(['Data e hora', 'Responsável', 'Perfil', 'Ação', 'Entidade', 'Identificador', 'Valor anterior', 'Valor posterior', 'Justificativa', 'Origem', 'Resultado'], table.rows().map(a => [csvDate(a.at), a.actor, a.role, ACTION_LABEL[a.action] || a.action, a.entity, a.entityId, a.before || '', a.after || '', a.justification || '', a.origin, a.result])), 'text/csv;charset=utf-8'); toast('Auditoria exportada.', 'success'); };
    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Auditoria', desc: 'Registro de cadastros, pontuações, prêmios, lances, homologações, rodadas, backups e resets.', actions: [button('Exportar CSV', { variant: 'secondary', icon: 'download', onClick: exportCsv, disabled: !log.length })] }),
      alertBox('warning', 'Auditoria de demonstração', 'Estes registros ficam no armazenamento local do navegador e podem ser alterados ou apagados. Não representam uma auditoria imutável de produção.'),
      emptyModeNotice(ctx),
      h('div', { class: 'toolbar mt-4' }, search.el, act.el, ent.el), table.el);
  }

  /* ======================================================================
     CONFIGURAÇÕES DA DEMONSTRAÇÃO
     ====================================================================== */
  async function configuracoes(ctx, app) {
    const fileIn = h('input', { type: 'file', id: 'backup-file', accept: 'application/json,.json' });
    const importErr = h('div', { tabindex: '-1' });
    const importBtn = button('Validar e importar backup', { variant: 'secondary', icon: 'upload' });
    importBtn.addEventListener('click', async () => {
      clear(importErr);
      let text;
      try { text = await readFile(fileIn.files[0]); } catch (e) { importErr.appendChild(alertBox('warning', null, e.message)); importErr.focus(); return; }
      const pv = await app.run(() => app.api.previewBackup(text), { busyButton: importBtn, errorTarget: importErr });
      if (!pv.ok) return;
      const s = pv.value;
      const c = await confirmDialog({ title: 'Restaurar este backup?', variant: 'danger', confirmLabel: 'Substituir dados atuais', message: 'Os dados atuais deste navegador serão substituídos pelo conteúdo do backup. Exporte um backup do estado atual antes, se precisar.', details: summaryList([['Exportado em', fmt.dateTime(s.exportedAt)], ['Participantes', fmt.int(s.participants)], ['Prêmios', fmt.int(s.rewards)], ['Lances', fmt.int(s.bids)], ['Prêmios homologados', fmt.int(s.awards)], ['Registros de auditoria', fmt.int(s.audit)]]) });
      if (!c) return;
      const r = await app.run(() => app.api.importBackup(text), { success: 'Backup restaurado com sucesso.' });
      if (r.ok) app.refresh();
    });
    const exportBtn = button('Exportar backup JSON', { icon: 'download' });
    exportBtn.addEventListener('click', async () => { const r = await app.run(() => app.api.exportBackup(), { busyButton: exportBtn, success: 'Backup exportado.' }); if (r.ok) download(r.value.filename, r.value.content, 'application/json'); });

    const st = ctx.settings;
    const dateIn = field({ type: 'datetime-local', label: 'Data e hora simuladas', value: st.simulatedDate, disabled: st.clockMode !== 'simulado' });
    const clock = field({ type: 'select', label: 'Relógio da aplicação', value: st.clockMode, options: [{ value: 'simulado', label: 'Data simulada (recurso de demonstração)' }, { value: 'real', label: 'Data real do computador' }] });
    const quick = cfg.calendar.rounds.map(r => button(`Ir para ${r.label}`, { variant: 'secondary', size: 'sm', onClick: async () => { await app.api.setDemoSettings({ clockMode: 'simulado', simulatedDate: r.start + 'T09:00' }); toast(`Data simulada: ${fmt.date(LNA.domain.dayStart(r.start))} às 09h00.`, 'success'); app.refresh(); } }));
    quick.push(button('Ir para homologação final', { variant: 'secondary', size: 'sm', onClick: async () => { await app.api.setDemoSettings({ clockMode: 'simulado', simulatedDate: cfg.calendar.homologation.start + 'T09:00' }); app.refresh(); } }));
    const applyDate = button('Aplicar data', { icon: 'check', onClick: async () => { const r = await app.run(() => app.api.setDemoSettings({ clockMode: clock.input.value, simulatedDate: dateIn.input.value || st.simulatedDate }), { success: 'Relógio atualizado.' }); if (r.ok) app.refresh(); } });
    clock.input.addEventListener('change', () => { dateIn.input.disabled = clock.input.value !== 'simulado'; });
    const err = toggle('Simular erro de serviço', st.errorMode, async v => { await app.api.setDemoSettings({ errorMode: v }); app.refresh(); });
    const emp = toggle('Exibir dados vazios', st.emptyMode, async v => { await app.api.setDemoSettings({ emptyMode: v }); app.refresh(); });

    return h('div', null,
      pageHead({ eyebrow: 'Gestão', title: 'Configurações da demonstração', desc: 'Recursos exclusivos desta versão local. Não existem em produção.' }),
      alertBox('demo', 'Ambiente fictício', 'Esta aplicação funciona sem servidor. Os dados ficam no localStorage deste navegador, que não é banco de dados, não oferece autenticação, autorização, transações nem concorrência confiável e pode ser alterado por qualquer pessoa com acesso ao computador. Não insira dados reais.'),
      h('div', { class: 'grid grid-2 mt-4' },
        card({ title: 'Data simulada', subtitle: `Agora na aplicação: ${fmt.dateTime(ctx.now)} · ${ctx.phase.label}`, body: h('div', { class: 'stack' }, h('div', { class: 'form-grid' }, clock.el, dateIn.el), h('div', { class: 'row' }, applyDate), h('p', { class: 'field__hint' }, 'Atalhos do calendário:'), h('div', { class: 'tag-list' }, quick)) }),
        card({ title: 'Modos de teste', body: h('div', { class: 'stack' }, err.el, h('p', { class: 'field__hint' }, 'Faz as consultas falharem com mensagem amigável, para demonstrar o estado de erro.'), emp.el, h('p', { class: 'field__hint' }, 'Mostra listas e indicadores vazios, para demonstrar os estados vazios. Bloqueia alterações enquanto ativo.')) }),
        card({ title: 'Backup', subtitle: 'Exporta todos os dados fictícios, incluindo auditoria, em JSON.', body: h('div', { class: 'stack' }, h('div', { class: 'row' }, exportBtn), h('hr', { class: 'divider' }), h('div', { class: 'upload' }, h('label', { class: 'field__label', for: 'backup-file' }, 'Arquivo de backup (.json, até 5 MB)'), h('div', { class: 'mt-2' }, fileIn)), importErr, h('div', { class: 'row' }, importBtn)) }),
        card({ title: 'Restaurar demonstração', subtitle: 'Volta aos dados fictícios iniciais (rodada 1 aberta, lances de exemplo com empate e segunda opção).', body: h('div', { class: 'row' }, button('Restaurar dados fictícios', { variant: 'danger', icon: 'refresh', onClick: () => app.resetFlow() })) }),
        card({ title: 'Armazenamento', body: summaryList([['Serviço ativo', app.api.kind], ['Chave local', cfg.storage.key], ['Versão do schema', String(cfg.storage.schemaVersion)], ['Última gravação', fmt.dateTime(ctx.updatedAt)], ['localStorage disponível', ctx.storageAvailable ? 'Sim' : 'Não (dados só em memória)']]) }),
        card({ title: 'Para produção', body: h('ul', { class: 'stack-sm muted', style: 'padding-left:18px;margin:0' }, ['Autenticação corporativa com Microsoft Entra ID', 'Autorização por perfil validada no servidor', 'API segura e banco de dados com transações', 'Auditoria imutável, logs e monitoramento', 'Adequação à LGPD e testes de segurança', 'Homologação das regras pela área de negócio'].map(t => h('li', null, t))), foot: h('p', { class: 'field__hint' }, 'Detalhes no README, seção “Requisitos para produção”.') })));
  }

  LNA.views.admin = {
    '/gestao/visao-geral': visaoGeral, '/gestao/participantes': participantes, '/gestao/pontuacao': pontuacao, '/gestao/premios': premiosAdmin,
    '/gestao/lances': lances, '/gestao/rodadas': rodadas, '/gestao/auditoria': auditoria, '/gestao/configuracoes': configuracoes
  };
})(window);
