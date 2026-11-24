/* Executa os testes de domínio em Node.js (>= 18) sem dependências.
   Uso: node tests/run-node.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = {};
const context = {
  console, setTimeout, clearTimeout, Date, Math, JSON, Promise, Intl,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
};
context.globalThis = context;
vm.createContext(context);
const base = path.join(__dirname, '..', 'assets', 'js');
['config.js', 'validators.js', 'domain.js', 'mock-data.js', 'storage.js', 'services.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), context, { filename: f }));
vm.runInContext(fs.readFileSync(path.join(__dirname, 'domain.tests.js'), 'utf8'), context, { filename: 'domain.tests.js' });
context.LNA_TESTS.run().then(r => process.exit(r.fail ? 1 : 0));
