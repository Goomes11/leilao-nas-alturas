/* ==========================================================================
   accessibility.js — Foco, anúncios para leitores de tela e menu recolhível
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};
  const doc = root.document;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

  /** Prende o foco dentro do container. Retorna função para liberar. */
  function trapFocus(container, onEscape) {
    function onKey(e) {
      if (e.key === 'Escape' && onEscape) { e.preventDefault(); e.stopPropagation(); onEscape(); return; }
      if (e.key !== 'Tab') return;
      const items = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === doc.activeElement);
      if (!items.length) { e.preventDefault(); container.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (doc.activeElement === first || doc.activeElement === container)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', onKey);
    return () => container.removeEventListener('keydown', onKey);
  }

  /** Torna o restante da página inerte enquanto um modal está aberto. */
  function setInert(on) {
    doc.querySelectorAll('[data-inert-scope]').forEach(el => { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }

  /** Anuncia mensagem em região aria-live (polite ou assertive). */
  function announce(message, assertive = false) {
    const el = doc.getElementById(assertive ? 'sr-assertive' : 'sr-polite');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 60);
  }

  const prefersReducedMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Menu recolhível (celular): aria-expanded, Escape, foco gerenciado, backdrop. */
  function createDrawer(toggleBtn, drawer) {
    let backdrop = null, release = null;
    const isMobile = () => root.matchMedia('(max-width: 900px)').matches;
    function open() {
      drawer.classList.add('is-open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      drawer.removeAttribute('aria-hidden');
      backdrop = doc.createElement('div'); backdrop.className = 'drawer-backdrop'; backdrop.addEventListener('click', close);
      doc.body.appendChild(backdrop);
      release = trapFocus(drawer, close);
      const first = drawer.querySelector('[aria-current="page"]') || drawer.querySelector(FOCUSABLE);
      if (first) first.focus();
    }
    function close(returnFocus = true) {
      if (!drawer.classList.contains('is-open')) return;
      drawer.classList.remove('is-open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      if (isMobile()) drawer.setAttribute('aria-hidden', 'true');
      if (backdrop) { backdrop.remove(); backdrop = null; }
      if (release) { release(); release = null; }
      if (returnFocus) toggleBtn.focus();
    }
    function sync() { if (isMobile()) { if (!drawer.classList.contains('is-open')) drawer.setAttribute('aria-hidden', 'true'); } else { drawer.removeAttribute('aria-hidden'); close(false); } }
    toggleBtn.addEventListener('click', () => drawer.classList.contains('is-open') ? close() : open());
    drawer.addEventListener('click', e => { if (e.target.closest('a')) close(false); });
    root.addEventListener('resize', sync);
    sync();
    return { open, close, destroy: () => { root.removeEventListener('resize', sync); close(false); } };
  }

  /** Move o foco para o título da nova página após navegação (SPA). */
  function focusPageTitle(container) {
    const t = container.querySelector('[data-page-title]');
    if (t) t.focus({ preventScroll: false });
  }

  LNA.a11y = { trapFocus, setInert, announce, prefersReducedMotion, createDrawer, focusPageTitle, FOCUSABLE };
})(window);
