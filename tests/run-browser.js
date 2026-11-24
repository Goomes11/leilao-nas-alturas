/* Executor dos testes no navegador (tests/index.html) */
(function () {
  'use strict';
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  window.LNA_TESTS.run(() => {}).then(r => {
    r.results.forEach(t => {
      const li = document.createElement('li');
      li.className = 'alert ' + (t.ok ? 'alert--success' : 'alert--error');
      li.textContent = (t.ok ? '✔ ' : '✘ ') + t.name + (t.error ? ' — ' + t.error : '');
      list.appendChild(li);
    });
    summary.className = 'alert mt-4 ' + (r.fail ? 'alert--error' : 'alert--success');
    summary.textContent = `${r.pass} aprovados, ${r.fail} reprovados, ${r.results.length} no total.`;
  });
})();
