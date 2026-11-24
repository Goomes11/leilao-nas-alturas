/* ==========================================================================
   ui.js — Componentes de interface reutilizáveis
   Regra de segurança: todo conteúdo dinâmico entra por textContent/atributos.
   Não há innerHTML com dados do usuário em nenhum ponto da aplicação.
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};
  const doc = root.document;
  const SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------------- Construtor de elementos ---------------- */
  function h(tag, props, ...children) {
    const el = doc.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        else if (k === 'text') el.textContent = String(v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'style') el.style.cssText = String(v); // CSSOM: compatível com CSP sem 'unsafe-inline'
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' && 'value' in el) el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    append(el, children);
    return el;
  }
  function append(el, children) {
    children.flat(Infinity).forEach(c => {
      if (c == null || c === false || c === true) return;
      el.appendChild(c instanceof root.Node ? c : doc.createTextNode(String(c)));
    });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  function uid(prefix = 'id') { uid.n = (uid.n || 0) + 1; return `${prefix}-${uid.n}`; }

  /* ---------------- Ícones SVG locais (traço 1,8 / 24x24) ---------------- */
  const C = (cx, cy, r) => `M${cx} ${cy - r}a${r} ${r} 0 1 0 0 ${2 * r}a${r} ${r} 0 1 0 0 ${-2 * r}z`;
  const ICONS = {
    home: ['M3 11l9-8 9 8', 'M5 10v10h5v-6h4v6h5V10'],
    coins: [C(12, 12, 9), 'M14.5 9c-.4-.9-1.3-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2 0 2.8 5 1.7 5 4.5 0 1.2-1 2-2.5 2-1.2 0-2.2-.6-2.6-1.5', 'M12 6v1.5', 'M12 16.5V18'],
    gift: ['M3 8h18v4H3z', 'M5 12v9h14v-9', 'M12 8v13', 'M12 8C10.5 5 7 4.5 7 6.5S10 8 12 8z', 'M12 8c1.5-3 5-3.5 5-1.5S14 8 12 8z'],
    gavel: ['M14.5 3.5l6 6-3 3-6-6z', 'M12.5 8.5L4 17l2.5 2.5 8.5-8.5', 'M13 21h8'],
    history: ['M3 12a9 9 0 1 0 2.6-6.4', 'M3 4v5h5', 'M12 7v5l3 2'],
    book: ['M4 19.5V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14', 'M8 7h8', 'M8 11h6'],
    calendar: ['M4 6h16v15H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4', 'M8 14h3v3H8z'],
    users: [C(9, 7, 4), 'M2 21c0-3.9 3.1-6 7-6s7 2.1 7 6', 'M16 3.3a4 4 0 0 1 0 7.4', 'M18 15c2.4.6 4 2.5 4 6'],
    chart: ['M4 20V11', 'M10 20V5', 'M16 20v-6', 'M21 20H3'],
    trend: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
    sliders: ['M4 6h9', 'M17 6h3', 'M15 4v4', 'M4 12h3', 'M11 12h9', 'M9 10v4', 'M4 18h11', 'M19 18h1', 'M17 16v4'],
    shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
    flag: ['M5 21V4', 'M5 4h12l-2.5 4L17 12H5'],
    search: [C(11, 11, 7), 'M20 20l-4-4'],
    filter: ['M3 5h18l-7 8v6l-4 2v-8z'],
    plus: ['M12 5v14', 'M5 12h14'],
    edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
    x: ['M6 6l12 12', 'M18 6L6 18'],
    check: ['M5 12l5 5L20 7'],
    checkCircle: [C(12, 12, 9), 'M8 12l3 3 5-6'],
    alert: ['M12 3l10 18H2z', 'M12 10v4.5', 'M12 17.5v.01'],
    info: [C(12, 12, 9), 'M12 11v6', 'M12 7.5v.01'],
    alertCircle: [C(12, 12, 9), 'M12 7v6', 'M12 16.5v.01'],
    logout: ['M15 4h4v16h-4', 'M10 17l5-5-5-5', 'M15 12H3'],
    bell: ['M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z', 'M10 21h4'],
    menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
    download: ['M12 4v12', 'M7 11l5 5 5-5', 'M4 20h16'],
    upload: ['M12 20V8', 'M7 13l5-5 5 5', 'M4 4h16'],
    refresh: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v5h-5'],
    clock: [C(12, 12, 9), 'M12 7v5l3 2'],
    trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v3', 'M8 21h8', 'M9.5 16h5l.5 5h-6z'],
    eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', C(12, 12, 3)],
    lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
    ban: [C(12, 12, 9), 'M5.6 5.6l12.8 12.8'],
    chevronDown: ['M6 9l6 6 6-6'],
    chevronLeft: ['M15 6l-6 6 6 6'],
    chevronRight: ['M9 6l6 6-6 6'],
    printer: ['M7 9V3h10v6', 'M7 17H4v-7h16v7h-3', 'M7 14h10v7H7z'],
    database: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'],
    sort: ['M8 4v16', 'M4 8l4-4 4 4', 'M16 20V4', 'M12 16l4 4 4-4'],
    send: ['M3 12l18-8-6 17-3-7z', 'M12 14l9-10'],
    split: ['M6 3v6a6 6 0 0 0 6 6h6', 'M15 12l3 3-3 3', 'M6 21v-6'],
    /* prêmios */
    tv: ['M3 6h18v11H3z', 'M8 21h8', 'M12 17v4'],
    bike: [C(6, 17, 3.5), C(18, 17, 3.5), 'M6 17l4-8h5l3 8', 'M10 9L8.5 6H6', 'M15 9l-1-3h2'],
    laptop: ['M5 5h14v10H5z', 'M2 19h20l-2-4H4z'],
    phone: ['M7 2h10v20H7z', 'M11 18h2'],
    fryer: ['M6 7h12l1 13H5z', 'M9 3h6v4H9z', 'M9 12h6', 'M12 15v2'],
    headphones: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15h3v6H4z', 'M17 15h3v6h-3z'],
    coffee: ['M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M16 10h2a2 2 0 0 1 0 4h-2', 'M8 3v2', 'M11 3v2', 'M4 21h13'],
    speaker: ['M6 2h12v20H6z', C(12, 14, 4), 'M12 6.5v.01'],
    suitcase: ['M5 7h14v13H5z', 'M9 7V4h6v3', 'M9 11v5', 'M15 11v5', 'M8 20v1.5', 'M16 20v1.5'],
    star: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
    plane: ['M3 12l18-8-6 17-3-7z', 'M12 14l9-10']
  };
  function icon(name, cls = '', label = null) {
    const svg = doc.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', ('icon ' + cls).trim());
    if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); }
    else { svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); }
    (ICONS[name] || ICONS.info).forEach(d => { const p = doc.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); svg.appendChild(p); });
    return svg;
  }

  /** Grafismo de círculos interligados (inspirado no elo do logo — decorativo). */
  function rings(cls = 'hero__graphic', colors = ['#FF7020', '#9A9187']) {
    const svg = doc.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 400 400'); svg.setAttribute('class', cls); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    [[160, 200, 130, colors[0], 2.5], [250, 200, 130, colors[1], 1.5], [205, 200, 185, colors[0], 1]].forEach(([cx, cy, r, c, w]) => {
      const ci = doc.createElementNS(SVGNS, 'circle');
      ci.setAttribute('cx', cx); ci.setAttribute('cy', cy); ci.setAttribute('r', r); ci.setAttribute('fill', 'none'); ci.setAttribute('stroke', c); ci.setAttribute('stroke-width', w);
      svg.appendChild(ci);
    });
    return svg;
  }

  /* ---------------- Formatação pt-BR ---------------- */
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const fmt = {
    int: n => Number(n || 0).toLocaleString('pt-BR'),
    pts: n => `${Number(n || 0).toLocaleString('pt-BR')} ${Math.abs(Number(n)) === 1 ? 'ponto' : 'pontos'}`,
    pct: n => `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`,
    date: d => d ? new Date(d).toLocaleDateString('pt-BR') : '—',
    dateLong: d => { const x = new Date(d); return `${x.getDate()} de ${MONTHS_FULL[x.getMonth()]}`; },
    dateTime: d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    time: d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    month: m => { const [y, mo] = String(m).split('-'); return `${MONTHS[Number(mo) - 1]}/${y}`; },
    monthFull: m => { const [y, mo] = String(m).split('-'); return `${MONTHS_FULL[Number(mo) - 1]} de ${y}`; },
    location: id => (LNA.config.locations.find(l => l.id === id) || { label: 'Não configurada' }).label,
    plural: (n, one, many) => `${fmt.int(n)} ${Number(n) === 1 ? one : many}`,
    periodShort: (a, b) => `${fmt.date(a)} a ${fmt.date(b)}`
  };

  /* ---------------- Chips de status (cor + ícone + texto) ---------------- */
  const STATUS = {
    disponivel: ['success', 'checkCircle', 'Disponível'],
    em_breve: ['info', 'clock', 'Disponível em breve'],
    arrematado: ['neutral', 'trophy', 'Arrematado'],
    inativo: ['error', 'ban', 'Indisponível'],
    encerrado: ['warning', 'lock', 'Rodada encerrada'],
    ativo: ['success', 'checkCircle', 'Ativo'],
    inativo_p: ['error', 'ban', 'Inativo'],
    substituido: ['neutral', 'history', 'Substituído'],
    aberta: ['success', 'checkCircle', 'Aberta'],
    futura: ['info', 'clock', 'Futura'],
    encerrada: ['warning', 'lock', 'Encerrada'],
    homologada: ['neutral', 'shield', 'Homologada'],
    homologado: ['success', 'shield', 'Homologado'],
    revertido: ['error', 'refresh', 'Revertido'],
    valido: ['success', 'check', 'Válido'],
    invalido: ['error', 'x', 'Inválido'],
    duplicado: ['warning', 'alert', 'Duplicado'],
    selecionado: ['brand', 'star', 'Sua escolha']
  };
  function chip(key, labelOverride) {
    const [tone, ic, label] = STATUS[key] || ['neutral', 'info', key];
    return h('span', { class: `chip chip--${tone}` }, icon(ic), labelOverride || label);
  }

  /* ---------------- Avisos ---------------- */
  const ALERT_ICON = { info: 'info', success: 'checkCircle', warning: 'alert', error: 'alertCircle', demo: 'sliders', deadline: 'clock' };
  function alertBox(kind, title, body, actions) {
    return h('div', { class: `alert alert--${kind}`, role: kind === 'error' ? 'alert' : null },
      icon(ALERT_ICON[kind] || 'info'),
      h('div', { class: 'alert__body' }, title ? h('p', { class: 'alert__title' }, title) : null, body ? (body instanceof root.Node ? body : h('p', null, body)) : null,
        actions && actions.length ? h('div', { class: 'alert__actions' }, actions) : null));
  }

  /* ---------------- Botões ---------------- */
  function button(label, { variant = 'primary', icon: ic, size, onClick, type = 'button', disabled, ariaLabel, block, id, attrs } = {}) {
    return h('button', { type, id, class: ['btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block'], onclick: onClick, disabled, 'aria-label': ariaLabel, ...(attrs || {}) }, ic ? icon(ic) : null, label);
  }
  function iconButton(ic, label, onClick, attrs = {}) {
    return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onclick: onClick, ...attrs }, icon(ic));
  }
  /** Marca um botão como "processando" mantendo o rótulo acessível. */
  function setBusy(btn, busy, busyLabel = 'Processando…') {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.getAttribute('aria-label') || ''; btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true'); btn.setAttribute('aria-label', busyLabel); btn.disabled = true; }
    else { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); if (btn.dataset.label) btn.setAttribute('aria-label', btn.dataset.label); else btn.removeAttribute('aria-label'); btn.disabled = false; }
  }

  /* ---------------- Campos de formulário ---------------- */
  /** field({ label, name, type, value, hint, required, options, optional, suffix, icon, inputmode, attrs })
   *  Retorna { el, input, setError(msg), getValue() } com label/erro/ajuda associados. */
  function field(o) {
    const id = o.id || uid('f');
    const hintId = id + '-hint', errId = id + '-err';
    let input;
    const common = { id, name: o.name || id, required: o.required, disabled: o.disabled, 'aria-describedby': [o.hint ? hintId : null, errId].filter(Boolean).join(' '), ...(o.attrs || {}) };
    if (o.type === 'select') {
      input = h('select', { ...common, class: 'select' }, (o.options || []).map(opt => h('option', { value: opt.value, disabled: opt.disabled }, opt.label)));
      if (o.value != null) input.value = o.value;
    } else if (o.type === 'textarea') {
      input = h('textarea', { ...common, class: 'textarea', rows: o.rows || 5, placeholder: o.placeholder, maxlength: o.maxlength });
      if (o.value != null) input.value = o.value;
    } else {
      input = h('input', { ...common, class: 'input', type: o.type || 'text', value: o.value != null ? o.value : '', placeholder: o.placeholder, inputmode: o.inputmode, autocomplete: o.autocomplete || 'off', maxlength: o.maxlength, min: o.min, max: o.max, step: o.step });
    }
    const err = h('p', { class: 'field__error', id: errId, 'aria-live': 'polite' });
    let control = input;
    if (o.icon) control = h('div', { class: 'input-group' }, icon(o.icon), input);
    if (o.suffix) control = h('div', { class: 'input-suffix' }, input, h('span', { class: 'input-suffix__text', 'aria-hidden': 'true' }, o.suffix));
    const el = h('div', { class: ['field', o.className] },
      h('label', { class: 'field__label', for: id }, o.label, o.optional ? h('span', { class: 'optional' }, ' (opcional)') : null, o.required ? h('span', { class: 'sr-only' }, ' (obrigatório)') : null),
      control, o.hint ? h('p', { class: 'field__hint', id: hintId }, o.hint) : null, err);
    function setError(msg) {
      clear(err);
      if (msg) { err.appendChild(icon('alertCircle', 'icon-sm')); err.appendChild(doc.createTextNode(msg)); input.setAttribute('aria-invalid', 'true'); }
      else input.removeAttribute('aria-invalid');
    }
    return { el, input, setError, getValue: () => input.value };
  }
  function toggle(label, checked, onChange, id = uid('sw')) {
    const input = h('input', { type: 'checkbox', id, role: 'switch', checked, onchange: e => { state.textContent = e.target.checked ? 'Ligado' : 'Desligado'; onChange && onChange(e.target.checked); } });
    const state = h('span', { class: 'switch__state', 'aria-hidden': 'true' }, checked ? 'Ligado' : 'Desligado');
    const el = h('label', { class: 'switch', for: id }, input, h('span', { class: 'switch__track', 'aria-hidden': 'true' }), h('span', null, label), state);
    return { el, input };
  }
  function applyErrors(fields, errors) {
    let first = null;
    Object.entries(fields).forEach(([k, f]) => { const m = errors && errors[k]; f.setError(m || ''); if (m && !first) first = f.input; });
    if (first) first.focus();
    return !!first;
  }

  /* ---------------- Toasts ---------------- */
  function toast(message, kind = 'info', { title, timeout = 6500 } = {}) {
    let region = doc.getElementById('toast-region');
    if (!region) return;
    const t = h('div', { class: `toast toast--${kind}`, role: kind === 'error' ? 'alert' : 'status' },
      icon(kind === 'success' ? 'checkCircle' : kind === 'error' ? 'alertCircle' : kind === 'warning' ? 'alert' : 'info'),
      h('div', null, title ? h('strong', null, title, h('br')) : null, message),
      h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Fechar aviso', onclick: () => t.remove() }, icon('x', 'icon-sm')));
    region.appendChild(t);
    if (timeout) setTimeout(() => t.remove(), timeout);
  }

  /* ---------------- Modal acessível ---------------- */
  const modalStack = [];
  function modal({ title, description, body, actions = [], wide = false, dismissible = true, onClose, labelClose = 'Fechar' }) {
    const opener = doc.activeElement;
    const titleId = uid('mt'), descId = uid('md');
    const footer = h('div', { class: 'modal__foot' });
    const dialog = h('div', { class: ['modal', wide && 'modal--wide'], role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': description ? descId : null, tabindex: '-1' },
      h('div', { class: 'modal__head' },
        h('div', null, h('h2', { class: 'modal__title', id: titleId }, title), description ? h('p', { class: 'modal__desc', id: descId }, description) : null),
        dismissible ? iconButton('x', labelClose, () => close(null)) : null),
      h('div', { class: 'modal__body' }, body),
      footer);
    const backdrop = h('div', { class: 'modal-backdrop', onclick: () => { if (dismissible) close(null); } });
    const rootEl = h('div', { class: 'modal-root' }, backdrop, dialog);
    let result = null, closed = false, resolveFn;
    const promise = new Promise(r => { resolveFn = r; });
    function close(value) {
      if (closed) return; closed = true; result = value;
      release(); rootEl.remove(); modalStack.pop();
      if (!modalStack.length) LNA.a11y.setInert(false);
      if (opener && opener.focus && doc.contains(opener)) opener.focus();
      onClose && onClose(result); resolveFn(result);
    }
    const api = { close, el: dialog, body: dialog.querySelector('.modal__body'), footer, promise, buttons: {} };
    actions.forEach(a => {
      const b = button(a.label, { variant: a.variant || 'secondary', icon: a.icon, onClick: () => a.onClick ? a.onClick(api, b) : close(a.value) });
      if (a.key) api.buttons[a.key] = b;
      footer.appendChild(b);
    });
    if (!actions.length) footer.remove();
    doc.body.appendChild(rootEl);
    modalStack.push(api);
    LNA.a11y.setInert(true);
    const release = LNA.a11y.trapFocus(dialog, () => { if (dismissible) close(null); });
    const auto = dialog.querySelector('[data-autofocus]') || dialog.querySelector('.modal__body input, .modal__body select, .modal__body textarea') || footer.querySelector('.btn--primary, .btn--danger') || dialog;
    setTimeout(() => auto.focus(), 20);
    return api;
  }

  /** Confirmação acessível (substitui window.confirm). Resolve { justification } ou null. */
  function confirmDialog({ title, message, details, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'primary', justification = null, requireCheck = null }) {
    let just = null, chk = null;
    const body = h('div', { class: 'stack' }, message ? h('p', null, message) : null, details || null);
    if (justification) {
      just = field({ type: 'textarea', label: justification.label || 'Justificativa', hint: justification.min ? `Mínimo de ${justification.min} caracteres. Fica registrada na auditoria.` : 'Fica registrada na auditoria.', optional: !justification.min, rows: 3, maxlength: 300 });
      body.appendChild(just.el);
    }
    if (requireCheck) {
      chk = h('input', { type: 'checkbox', id: uid('chk') });
      body.appendChild(h('label', { class: 'check', for: chk.id }, chk, h('span', null, requireCheck)));
    }
    return modal({
      title, body, actions: [
        { label: cancelLabel, variant: 'secondary', value: null },
        {
          label: confirmLabel, variant, key: 'ok', onClick: (api) => {
            const text = just ? just.input.value.trim() : '';
            if (justification && justification.min && text.length < justification.min) { just.setError(`Escreva pelo menos ${justification.min} caracteres.`); just.input.focus(); return; }
            if (chk && !chk.checked) { toast('Marque a confirmação para continuar.', 'warning'); chk.focus(); return; }
            api.close({ justification: text });
          }
        }
      ]
    }).promise;
  }

  /* ---------------- Estados ---------------- */
  function stateBlock({ kind = 'empty', icon: ic, title, text, actions }) {
    const icons = { empty: 'search', error: 'alertCircle', locked: 'lock', forbidden: 'ban', offline: 'alert' };
    return h('div', { class: ['state', `state--${kind === 'forbidden' ? 'locked' : kind}`], role: kind === 'error' ? 'alert' : null },
      h('div', { class: 'state__icon' }, icon(ic || icons[kind] || 'info')),
      h('p', { class: 'state__title' }, title), text ? h('p', { class: 'state__text' }, text) : null,
      actions && actions.length ? h('div', { class: 'state__actions' }, actions) : null);
  }
  function skeleton(kind = 'page') {
    const wrap = h('div', { 'aria-busy': 'true', 'aria-live': 'polite' }, h('span', { class: 'sr-only' }, 'Carregando informações…'));
    wrap.appendChild(h('div', { class: 'skeleton skeleton--title' }));
    const grid = h('div', { class: 'grid grid-4' });
    for (let i = 0; i < 4; i++) grid.appendChild(h('div', { class: 'skeleton skeleton--card', style: 'height:110px' }));
    wrap.appendChild(grid);
    if (kind === 'page') { const g2 = h('div', { class: 'grid grid-3 mt-6' }); for (let i = 0; i < 3; i++) g2.appendChild(h('div', { class: 'skeleton skeleton--card' })); wrap.appendChild(g2); }
    return wrap;
  }

  /* ---------------- Cabeçalho de página e cards ---------------- */
  function pageHead({ eyebrow, title, desc, actions }) {
    return h('div', { class: 'page-head' },
      h('div', null, eyebrow ? h('p', { class: 'page-head__eyebrow' }, eyebrow) : null, h('h1', { tabindex: '-1', 'data-page-title': '' }, title), desc ? h('p', { class: 'page-head__desc' }, desc) : null),
      actions ? h('div', { class: 'row' }, actions) : null);
  }
  function card({ title, subtitle, actions, body, cls, headingLevel = 'h2', foot }) {
    return h('section', { class: ['card', cls] },
      title ? h('div', { class: 'card__head' }, h('div', null, h(headingLevel, { class: 'card__title' }, title), subtitle ? h('p', { class: 'card__subtitle' }, subtitle) : null), actions ? h('div', { class: 'row' }, actions) : null) : null,
      body, foot ? h('div', { class: 'card__foot' }, foot) : null);
  }
  function kpi({ label, value, unit, hint, ic, tone }) {
    return h('div', { class: ['card', 'kpi', tone && `kpi--${tone}`] },
      h('p', { class: 'kpi__label' }, ic ? icon(ic, 'icon-sm') : null, label),
      h('p', { class: 'kpi__value' }, value, unit ? h('small', null, unit) : null),
      hint ? h('p', { class: 'kpi__hint' }, hint) : null);
  }
  function summaryList(items) {
    return h('dl', { class: 'summary' }, items.filter(Boolean).map(([k, v, cls]) => h('div', { class: cls }, h('dt', null, k), h('dd', null, v))));
  }

  /* ---------------- Tabela com ordenação e paginação ---------------- */
  function dataTable({ caption, captionHint, columns, rows, pageSize = 0, empty, stack = true, initialSort, rowKey }) {
    let sort = initialSort || null, page = 1, data = rows || [];
    const wrap = h('div', { class: ['table-wrap', stack && 'stack-mobile'] });
    const table = h('table', { class: 'table' });
    const capEl = h('caption', null, caption, captionHint ? h('span', { class: 'muted' }, captionHint) : null);
    const thead = h('thead'); const tbody = h('tbody');
    table.append(capEl, thead, tbody);
    const pager = h('nav', { class: 'pagination', 'aria-label': `Paginação: ${caption}` });
    wrap.append(table);
    if (pageSize) wrap.append(pager);
    function renderHead() {
      clear(thead);
      thead.appendChild(h('tr', null, columns.map(c => {
        const aria = sort && sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : (c.sortable ? 'none' : null);
        return h('th', { scope: 'col', class: [c.num && 'num', c.cls], 'aria-sort': aria },
          c.sortable ? h('button', { type: 'button', class: 'sort-btn', onclick: () => { sort = { key: c.key, dir: sort && sort.key === c.key && sort.dir === 'asc' ? 'desc' : 'asc' }; page = 1; render(); } }, c.label, icon('sort', 'icon-sm'), h('span', { class: 'sr-only' }, ' — ordenar')) : c.label);
      })));
    }
    function sorted() {
      if (!sort) return data;
      const col = columns.find(c => c.key === sort.key);
      const val = col && col.sortValue ? col.sortValue : r => r[sort.key];
      return data.slice().sort((a, b) => { const x = val(a), y = val(b); const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR'); return sort.dir === 'asc' ? r : -r; });
    }
    function render() {
      renderHead(); clear(tbody);
      const all = sorted();
      const pages = pageSize ? Math.max(1, Math.ceil(all.length / pageSize)) : 1;
      if (page > pages) page = pages;
      const slice = pageSize ? all.slice((page - 1) * pageSize, page * pageSize) : all;
      if (!all.length) {
        tbody.appendChild(h('tr', null, h('td', { colspan: columns.length, style: 'text-align:center;padding:24px', 'data-label': '' }, empty || 'Nenhum registro.')));
      } else slice.forEach(r => {
        tbody.appendChild(h('tr', { 'data-key': rowKey ? rowKey(r) : null }, columns.map((c, i) => {
          const content = c.render ? c.render(r) : (r[c.key] ?? '—');
          const tag = i === 0 && c.rowHeader !== false ? 'th' : 'td';
          return h(tag, { scope: tag === 'th' ? 'row' : null, class: [c.num && 'num', c.actions && 'actions', c.cls], 'data-label': c.label }, content);
        })));
      });
      if (pageSize) {
        clear(pager);
        const from = all.length ? (page - 1) * pageSize + 1 : 0, to = Math.min(page * pageSize, all.length);
        pager.append(h('p', { 'aria-live': 'polite' }, `Exibindo ${from}–${to} de ${fmt.int(all.length)}`),
          h('div', { class: 'pagination__pages' },
            button('Anterior', { variant: 'secondary', size: 'sm', icon: 'chevronLeft', disabled: page <= 1, onClick: () => { page--; render(); } }),
            h('span', { class: 'row', style: 'padding:0 8px' }, `Página ${page} de ${pages}`),
            button('Próxima', { variant: 'secondary', size: 'sm', disabled: page >= pages, onClick: () => { page++; render(); } })));
      }
    }
    render();
    return { el: wrap, update(newRows) { data = newRows; page = 1; render(); }, rows: () => sorted() };
  }

  /* ---------------- Gráficos simples com alternativa textual ---------------- */
  function barChart({ title, items, valueFormat = fmt.int, tone = '' }) {
    const max = Math.max(1, ...items.map(i => i.value));
    const chart = h('div', { class: 'bars', role: 'img', 'aria-label': `${title}: ` + items.map(i => `${i.label} ${valueFormat(i.value)}`).join('; ') },
      items.map(i => h('div', { class: 'bar', 'aria-hidden': 'true' },
        h('div', { class: 'bar__head' }, h('span', null, i.label), h('strong', { class: 'num' }, valueFormat(i.value))),
        h('div', { class: 'bar__track' }, h('div', { class: ['bar__fill', tone && `bar__fill--${tone}`], style: `width:${(i.value / max * 100).toFixed(1)}%` })))));
    return h('div', null, chart, textAlternative(title, items, valueFormat));
  }
  function columnChart({ title, items, valueFormat = fmt.int }) {
    const max = Math.max(1, ...items.map(i => i.value));
    return h('div', null,
      h('div', { class: 'chart-cols', role: 'img', 'aria-label': `${title}: ` + items.map(i => `${i.label} ${valueFormat(i.value)}`).join('; ') },
        items.map(i => h('div', { class: 'chart-col', 'aria-hidden': 'true' }, h('span', { class: 'chart-col__val' }, valueFormat(i.value)), h('div', { class: 'chart-col__bar', style: `height:${Math.max(2, i.value / max * 100).toFixed(1)}%` })))),
      h('div', { class: 'chart-labels', 'aria-hidden': 'true' }, items.map(i => h('span', null, i.short || i.label))),
      textAlternative(title, items, valueFormat));
  }
  function textAlternative(title, items, valueFormat) {
    return h('details', { class: 'chart-alt' }, h('summary', null, 'Ver dados em tabela'),
      h('table', { class: 'table', style: 'min-width:0' }, h('caption', { class: 'sr-only' }, title),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Item'), h('th', { scope: 'col', class: 'num' }, 'Valor'))),
        h('tbody', null, items.map(i => h('tr', null, h('th', { scope: 'row' }, i.label), h('td', { class: 'num' }, valueFormat(i.value)))))));
  }

  /* ---------------- Utilidades ---------------- */
  function download(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: 'display:none' });
    doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function readFile(file, maxBytes = 5 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Selecione um arquivo.'));
      if (file.size > maxBytes) return reject(new Error('Arquivo maior que o limite permitido.'));
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); r.readAsText(file, 'utf-8');
    });
  }
  function rewardMedia(iconName) { return h('div', { class: 'reward-media' }, icon(iconName || 'gift')); }
  const requestId = () => 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  LNA.ui = { h, append, clear, uid, icon, rings, fmt, chip, alertBox, button, iconButton, setBusy, field, toggle, applyErrors, toast, modal, confirmDialog, stateBlock, skeleton, pageHead, card, kpi, summaryList, dataTable, barChart, columnChart, download, readFile, rewardMedia, requestId, ICONS };
})(window);
