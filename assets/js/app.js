/* ==========================================================================
   app.js — Inicialização, roteamento, cabeçalho, navegação e Controles da
   demonstração. As telas ficam em operator.js e admin.js.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA;
  const doc = root.document;
  const { h, clear, icon, fmt, button, iconButton, toast, modal, confirmDialog, stateBlock, skeleton, toggle } = LNA.ui;

  /* Troca de backend: substitua por LNA.services.createBackendApiService('https://api...') */
  const api = LNA.services.createDemoService();

  const OPERATOR_NAV = [
    { path: '/inicio', label: 'Início', icon: 'home' },
    { path: '/pontos', label: 'Meus pontos', icon: 'coins' },
    { path: '/premios', label: 'Prêmios', icon: 'gift' },
    { path: '/lance', label: 'Meu lance', icon: 'gavel' },
    { path: '/historico', label: 'Histórico', icon: 'history' },
    { path: '/regras', label: 'Regras e calendário', icon: 'book' }
  ];
  const ADMIN_NAV = [
    { path: '/gestao/visao-geral', label: 'Visão geral', icon: 'chart' },
    { path: '/gestao/participantes', label: 'Participantes', icon: 'users' },
    { path: '/gestao/pontuacao', label: 'Pontuação', icon: 'coins' },
    { path: '/gestao/premios', label: 'Prêmios', icon: 'gift' },
    { path: '/gestao/lances', label: 'Lances', icon: 'gavel' },
    { path: '/gestao/rodadas', label: 'Rodadas', icon: 'flag' },
    { path: '/gestao/auditoria', label: 'Auditoria', icon: 'shield' },
    { path: '/gestao/configuracoes', label: 'Configurações da demonstração', icon: 'sliders' }
  ];

  const app = {
    api, ctx: null, params: {}, cleanups: [], drawer: null, renderToken: 0,
    navigate(path, params = {}) { app.params = params; if (location.hash === '#' + path) render(true); else location.hash = '#' + path; },
    refresh: () => render(false),
    onCleanup(fn) { app.cleanups.push(fn); },
    /** Executa uma ação do serviço com tratamento padronizado de erro. */
    async run(fn, { success, busyButton, errorTarget } = {}) {
      if (busyButton) LNA.ui.setBusy(busyButton, true);
      try {
        const r = await fn();
        if (success) { toast(typeof success === 'function' ? success(r) : success, 'success'); LNA.a11y.announce(typeof success === 'function' ? success(r) : success); }
        return { ok: true, value: r };
      } catch (e) {
        const msg = e && e.message ? e.message : 'Não foi possível concluir a operação.';
        if (errorTarget) { clear(errorTarget); errorTarget.appendChild(LNA.ui.alertBox('error', 'Não foi possível concluir', msg)); errorTarget.focus && errorTarget.focus(); }
        else toast(msg, 'error', { title: 'Não foi possível concluir' });
        return { ok: false, error: e };
      } finally { if (busyButton && doc.contains(busyButton)) LNA.ui.setBusy(busyButton, false); }
    },
    /** Contagem regressiva acessível (atualiza visualmente a cada segundo; leitores de tela leem o texto resumido). */
    countdown(target, label = 'Tempo restante') {
      const units = [['dias', 86400], ['horas', 3600], ['min', 60], ['seg', 1]];
      const vals = units.map(([u]) => h('span', { class: 'countdown__value' }, '00'));
      const sr = h('span', { class: 'sr-only' });
      const el = h('div', null, h('p', { class: 'kpi__label' }, icon('clock', 'icon-sm'), label), h('div', { class: 'countdown', 'aria-hidden': 'true' }, units.map(([u], i) => h('div', { class: 'countdown__unit' }, vals[i], h('span', { class: 'countdown__label' }, u)))), sr);
      function tick() {
        let s = Math.max(0, Math.floor((new Date(target) - api.now()) / 1000));
        const parts = units.map(([, sec]) => { const v = Math.floor(s / sec); s -= v * sec; return v; });
        parts.forEach((v, i) => { vals[i].textContent = String(v).padStart(2, '0'); });
        sr.textContent = `${label}: ${parts[0]} dias, ${parts[1]} horas e ${parts[2]} minutos.`;
      }
      tick();
      const t = setInterval(tick, 1000); app.onCleanup(() => clearInterval(t));
      return el;
    },
    OPERATOR_NAV, ADMIN_NAV
  };
  LNA.app = app;

  /* ======================================================================
     Controles da demonstração
     ====================================================================== */
  function renderDemoBar() {
    const bar = doc.getElementById('demo-bar');
    const ctx = app.ctx;
    const open = !!ctx.settings.demoPanelOpen;
    clear(bar);
    const toggleBtn = h('button', { type: 'button', class: 'demo-bar__toggle', 'aria-expanded': String(open), 'aria-controls': 'demo-panel', onclick: async () => { await api.setDemoSettings({ demoPanelOpen: !open }); app.ctx = api.getContext(); renderDemoBar(); doc.querySelector('.demo-bar__toggle').focus(); } }, open ? 'Ocultar controles' : 'Abrir controles', icon('chevronDown', 'icon-sm'));
    const modes = [ctx.settings.errorMode && 'simulação de erro', ctx.settings.emptyMode && 'dados vazios'].filter(Boolean);
    bar.appendChild(h('div', { class: 'container demo-bar__inner' },
      h('span', { class: 'demo-bar__badge' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Controles da demonstração'),
      h('span', { class: 'demo-bar__text' }, `Ambiente fictício, sem login real. ${ctx.settings.clockMode === 'simulado' ? 'Data simulada: ' + fmt.dateTime(ctx.now) : 'Data real do computador'}${modes.length ? ' · Modo ativo: ' + modes.join(' e ') : ''}`),
      toggleBtn));
    if (!open) return;

    const roleSel = LNA.ui.field({ type: 'select', label: 'Perfil', value: ctx.role, options: [{ value: 'operador', label: 'Operador' }, { value: 'gestao', label: 'Gestão / administrador' }] });
    const partSel = LNA.ui.field({ type: 'select', label: 'Participante (operador)', value: ctx.settings.participantId, disabled: ctx.role !== 'operador', options: ctx.demoOperators.map(p => ({ value: p.id, label: `${p.name} · ${fmt.location(p.location)}` })) });
    const clockSel = LNA.ui.field({ type: 'select', label: 'Relógio', value: ctx.settings.clockMode, options: [{ value: 'simulado', label: 'Data simulada' }, { value: 'real', label: 'Data real' }] });
    const dateIn = LNA.ui.field({ type: 'datetime-local', label: 'Data simulada', value: ctx.settings.simulatedDate, disabled: ctx.settings.clockMode !== 'simulado', hint: `Fase: ${ctx.phase.label}` });
    roleSel.input.addEventListener('change', async () => { await api.setDemoSettings({ role: roleSel.input.value }); app.navigate(roleSel.input.value === 'gestao' ? '/gestao/visao-geral' : '/inicio'); LNA.a11y.announce('Perfil alterado.'); });
    partSel.input.addEventListener('change', async () => { await api.setDemoSettings({ participantId: partSel.input.value }); app.navigate('/inicio'); LNA.a11y.announce('Participante de teste alterado.'); });
    clockSel.input.addEventListener('change', async () => { await api.setDemoSettings({ clockMode: clockSel.input.value }); app.refresh(); });
    dateIn.input.addEventListener('change', async () => { if (!dateIn.input.value) return; await app.run(() => api.setDemoSettings({ simulatedDate: dateIn.input.value }), { success: 'Data simulada atualizada.' }); app.refresh(); });
    const err = toggle('Simular erro', ctx.settings.errorMode, async v => { await api.setDemoSettings({ errorMode: v }); app.refresh(); });
    const emp = toggle('Dados vazios', ctx.settings.emptyMode, async v => { await api.setDemoSettings({ emptyMode: v }); app.refresh(); });
    const reset = button('Restaurar demonstração', { variant: 'secondary', icon: 'refresh', size: 'sm', onClick: resetFlow });
    reset.classList.add('btn--on-dark');
    bar.appendChild(h('div', { id: 'demo-panel', class: 'demo-panel' }, h('div', { class: 'container' },
      h('div', { class: 'demo-panel__grid' }, roleSel.el, partSel.el, clockSel.el, dateIn.el,
        h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Modos de teste'), err.el, emp.el),
        h('div', { class: 'field' }, h('span', { class: 'field__label' }, 'Dados'), reset)))));
  }

  async function resetFlow() {
    const r = await confirmDialog({ title: 'Restaurar a demonstração?', message: 'Todos os lances, pontuações, homologações e registros de auditoria criados nesta sessão serão apagados e os dados fictícios iniciais voltarão. Exporte um backup antes, se quiser guardar o estado atual.', confirmLabel: 'Restaurar dados', variant: 'danger' });
    if (!r) return;
    const res = await app.run(() => api.resetDemo(), { success: 'Demonstração restaurada com os dados fictícios iniciais.' });
    if (res.ok) app.navigate(app.ctx.role === 'gestao' ? '/gestao/visao-geral' : '/inicio');
  }
  app.resetFlow = resetFlow;

  /* ======================================================================
     Cabeçalho e navegação
     ====================================================================== */
  function renderHeader() {
    const ctx = app.ctx, u = ctx.user;
    const actions = doc.getElementById('header-actions');
    clear(actions);
    const initials = String(u.name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
    actions.append(
      h('span', { class: 'chip chip--warning hide-sm' }, icon('sliders'), 'Dados fictícios'),
      iconButton('bell', 'Avisos da campanha', openNotices),
      h('div', { class: 'user-chip' },
        h('div', { class: 'user-chip__info' }, h('span', { class: 'user-chip__name' }, u.name), h('span', { class: 'user-chip__role' }, ctx.role === 'gestao' ? 'Perfil: Gestão' : `Perfil: Operador · ${fmt.location(u.location)}`)),
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials)),
      iconButton('logout', 'Sair (simulação)', () => modal({ title: 'Saída simulada', body: h('div', { class: 'stack' }, h('p', null, 'Esta demonstração não possui login real, portanto não há sessão para encerrar.'), h('p', { class: 'muted' }, 'Em produção, este botão encerra a sessão corporativa (Microsoft Entra ID) e retorna à tela de acesso.')), actions: [{ label: 'Entendi', variant: 'primary' }] }), { class: 'icon-btn hide-sm' }),
      h('button', { type: 'button', id: 'menu-toggle', class: 'icon-btn menu-toggle', 'aria-label': 'Abrir menu de navegação', 'aria-expanded': 'false', 'aria-controls': 'main-nav' }, icon('menu')));
  }

  function navList(items, current, cls) {
    return h('ul', { class: cls }, items.map(i => h('li', null, h('a', { class: 'nav-link', href: '#' + i.path, 'aria-current': current === i.path || current.startsWith(i.path + '/') ? 'page' : null }, icon(i.icon), i.label))));
  }
  function drawerHead() {
    return h('div', { class: 'nav-drawer__head' }, h('strong', null, 'Menu'), iconButton('x', 'Fechar menu', () => app.drawer && app.drawer.close()));
  }

  /* Notificações (simples, derivadas do contexto) */
  async function openNotices() {
    const ctx = app.ctx;
    const list = [];
    const rs = ctx.roundState ? ctx.roundState.status : 'futura';
    if (rs === 'aberta') list.push(['deadline', `${ctx.round.label} aberta`, `Lances até ${fmt.dateLong(LNA.domain.roundWindow(ctx.currentRoundId).end)}, às 23h59.`]);
    if (rs === 'homologada') list.push(['success', `${ctx.round.label} homologada`, 'Resultados disponíveis. A próxima rodada será aberta pela gestão.']);
    list.push(['demo', 'Ambiente de demonstração', 'Os dados são fictícios e ficam salvos apenas neste navegador.']);
    if (ctx.settings.errorMode) list.push(['error', 'Simulação de erro ativa', 'As consultas vão falhar até você desligar o modo nos Controles da demonstração.']);
    modal({ title: 'Avisos', body: h('ul', { class: 'notice-list' }, list.map(([k, t, b]) => h('li', null, LNA.ui.alertBox(k, t, b)))), actions: [{ label: 'Fechar', variant: 'secondary' }] });
  }

  /* ======================================================================
     Roteamento
     ====================================================================== */
  function currentPath() {
    const hsh = location.hash || '';
    if (!hsh.startsWith('#/')) return null;
    const p = hsh.slice(1).split('?')[0];
    return p === '/' ? null : p;
  }

  async function render(isNavigation = false) {
    const token = ++app.renderToken;
    app.cleanups.splice(0).forEach(fn => { try { fn(); } catch (e) { /* ignora */ } });
    app.ctx = api.getContext();
    const ctx = app.ctx;
    const isAdmin = ctx.role === 'gestao';
    let path = currentPath();
    if (!path) { path = isAdmin ? ADMIN_NAV[0].path : OPERATOR_NAV[0].path; history.replaceState(null, '', '#' + path); }

    renderDemoBar();
    renderHeader();
    if (app.drawer) { app.drawer.destroy(); app.drawer = null; }

    const navSlot = doc.getElementById('nav-slot');
    const viewRoot = doc.getElementById('view-root');
    clear(navSlot); clear(viewRoot);

    let content;
    if (isAdmin) {
      const side = h('aside', { class: 'side-nav nav-drawer', id: 'main-nav', 'aria-label': 'Menu da gestão' }, drawerHead(), h('p', { class: 'side-nav__title' }, 'Gestão da campanha'), h('nav', { 'aria-label': 'Seções da gestão' }, navList(ADMIN_NAV, path, 'side-nav__list')));
      content = h('div', { class: 'admin-content', style: 'min-width:0' });
      viewRoot.appendChild(h('div', { class: 'admin-shell' }, side, content));
      app.drawer = LNA.a11y.createDrawer(doc.getElementById('menu-toggle'), side);
    } else {
      const nav = h('nav', { class: 'top-nav nav-drawer', id: 'main-nav', 'aria-label': 'Menu do operador' }, h('div', { class: 'container' }, drawerHead(), navList(OPERATOR_NAV, path, 'top-nav__list')));
      navSlot.appendChild(nav);
      content = h('div');
      viewRoot.appendChild(content);
      app.drawer = LNA.a11y.createDrawer(doc.getElementById('menu-toggle'), nav);
    }

    const routes = Object.assign({}, LNA.views.operator, LNA.views.admin);
    const view = routes[path];
    const isAdminRoute = path.startsWith('/gestao');
    if (!view) {
      content.appendChild(stateBlock({ kind: 'empty', icon: 'search', title: 'Página não encontrada', text: 'O endereço acessado não existe nesta aplicação.', actions: [button('Ir para o início', { onClick: () => app.navigate(isAdmin ? ADMIN_NAV[0].path : '/inicio') })] }));
      return;
    }
    if (isAdminRoute !== isAdmin) {
      content.appendChild(stateBlock({ kind: 'forbidden', title: 'Você não tem permissão para acessar esta área', text: isAdminRoute ? 'Esta seção é exclusiva do perfil Gestão. Os operadores consultam apenas os próprios dados.' : 'Esta seção é do perfil Operador. Use o menu da gestão para continuar.', actions: [button(isAdmin ? 'Ir para a Visão geral' : 'Ir para o início', { onClick: () => app.navigate(isAdmin ? ADMIN_NAV[0].path : '/inicio') })] }));
      doc.title = 'Acesso não permitido | ' + LNA.config.app.fullTitle;
      return;
    }

    const label = (isAdmin ? ADMIN_NAV : OPERATOR_NAV).find(n => n.path === path);
    doc.title = (label ? label.label + ' | ' : '') + LNA.config.app.fullTitle;
    content.appendChild(skeleton());
    try {
      const node = await view(ctx, app);
      if (token !== app.renderToken) return; // navegação mais recente em andamento
      clear(content); content.appendChild(node);
      if (isNavigation) { LNA.a11y.focusPageTitle(content); root.scrollTo(0, 0); }
    } catch (e) {
      if (token !== app.renderToken) return;
      clear(content);
      content.appendChild(stateBlock({ kind: 'error', title: 'Não foi possível carregar esta página', text: e && e.message ? e.message : 'Tente novamente em instantes.', actions: [button('Tentar novamente', { icon: 'refresh', onClick: () => app.refresh() })] }));
      LNA.a11y.announce('Erro ao carregar a página.', true);
    }
  }

  /* ======================================================================
     Inicialização e recuperação de dados corrompidos
     ====================================================================== */
  function bootError(info) {
    const viewRoot = doc.getElementById('view-root');
    clear(viewRoot);
    doc.getElementById('demo-bar').hidden = true;
    const exportRaw = button('Baixar dados corrompidos', { variant: 'secondary', icon: 'download', onClick: () => LNA.ui.download('leilao-dados-corrompidos.txt', info.raw || '') });
    const restore = button('Restaurar dados fictícios', { icon: 'refresh', onClick: () => { api.recoverWithDefaults(); doc.getElementById('demo-bar').hidden = false; render(true); toast('Dados fictícios restaurados com sucesso.', 'success'); } });
    viewRoot.appendChild(h('div', { class: 'boot' }, stateBlock({
      kind: 'error', title: 'Os dados salvos neste navegador não puderam ser lidos',
      text: `${(info.problems || []).slice(0, 3).join(' ')} Nenhuma informação foi apagada automaticamente. Você pode baixar o conteúdo atual para análise e restaurar os dados fictícios da demonstração.`,
      actions: [restore, exportRaw]
    })));
    doc.querySelector('.boot [class*="btn--primary"]').focus();
  }

  function boot() {
    const info = api.init();
    doc.getElementById('skip-link').addEventListener('click', e => { e.preventDefault(); const m = doc.getElementById('main'); m.focus(); m.scrollIntoView(); });
    if (!['ok', 'novo', 'migrado'].includes(info.status)) { bootError(info); return; }
    if (info.status === 'migrado') setTimeout(() => toast('Encontramos dados do protótipo anterior e eles foram convertidos para o novo formato.', 'info'), 400);
    if (!info.storageAvailable) setTimeout(() => toast('O navegador bloqueou o armazenamento local. As alterações valerão só até fechar a aba.', 'warning'), 400);
    root.addEventListener('hashchange', () => { if ((location.hash || '').startsWith('#/')) render(true); });
    render(false);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
