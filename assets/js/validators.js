/* ==========================================================================
   validators.js — Conversão e validação de entradas (sem acesso ao DOM)
   ========================================================================== */
(function (root) {
  'use strict';
  const LNA = root.LNA = root.LNA || {};
  const cfg = () => LNA.config;

  /** Converte texto em número aceitando formato brasileiro ("1.234,5", "108,5", "108.5").
   *  Retorna { ok, value, error }. Não aceita expressões, unidades ou notação científica. */
  function parseDecimalBR(input) {
    if (typeof input === 'number') {
      return Number.isFinite(input) ? { ok: true, value: input } : { ok: false, error: 'Informe um número válido.' };
    }
    let s = String(input == null ? '' : input).trim().replace(/\s|%/g, '');
    if (!s) return { ok: false, error: 'Preencha este campo.' };
    if (!/^-?[\d.,]+$/.test(s)) return { ok: false, error: 'Use apenas números. Exemplo: 108,5' };
    const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      // o separador que aparece por último é o decimal
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma > -1) {
      if ((s.match(/,/g) || []).length > 1) return { ok: false, error: 'Número com formato inválido.' };
      s = s.replace(',', '.');
    } else if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, ''); // "1.234.567" = milhar
    }
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, error: 'Número com formato inválido.' };
    return { ok: true, value: n };
  }

  /** Inteiro de pontos (sem decimais). Aceita "1.050" como mil e cinquenta. */
  function parsePoints(input) {
    if (typeof input === 'number') return Number.isInteger(input) ? { ok: true, value: input } : { ok: false, error: 'O lance deve ser um número inteiro.' };
    const s = String(input == null ? '' : input).trim().replace(/\s/g, '');
    if (!s) return { ok: false, error: 'Informe os pontos.' };
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return { ok: true, value: Number(s.replace(/\./g, '')) };
    if (!/^-?\d+$/.test(s)) return { ok: false, error: 'Use apenas números inteiros, sem vírgula.' };
    return { ok: true, value: Number(s) };
  }

  function validateAchievement(input) {
    const r = parseDecimalBR(input);
    if (!r.ok) return r;
    if (r.value < 0) return { ok: false, error: 'O atingimento não pode ser negativo.' };
    if (r.value > cfg().rules.maxAchievementPercent) return { ok: false, error: `O atingimento máximo aceito é ${cfg().rules.maxAchievementPercent}%.` };
    return { ok: true, value: Math.round(r.value * 100) / 100 };
  }

  const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  function normalizeEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
  function validateEmail(v) {
    const e = normalizeEmail(v);
    if (!e) return { ok: false, error: 'Informe o e-mail corporativo.' };
    if (e.length > 120 || !EMAIL_RE.test(e)) return { ok: false, error: 'Informe um e-mail válido. Exemplo: nome@exemplo.test' };
    return { ok: true, value: e };
  }

  /** Remove caracteres de controle e limita tamanho. O escape para HTML não é
   *  necessário porque a interface usa textContent; isto só higieniza o dado. */
  function cleanText(v, max = 120) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function validateName(v) {
    const n = cleanText(v, 100);
    if (n.length < 3) return { ok: false, error: 'Informe nome e sobrenome (mínimo de 3 caracteres).' };
    if (!/^[\p{L}][\p{L} .'-]*$/u.test(n)) return { ok: false, error: 'Use apenas letras, espaços, apóstrofo ou hífen.' };
    return { ok: true, value: n };
  }
  function validateLocation(id) {
    return cfg().locations.some(l => l.id === id) ? { ok: true, value: id } : { ok: false, error: 'Selecione uma localidade da lista.' };
  }
  function validateMonth(v) {
    let s = String(v == null ? '' : v).trim();
    const br = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (br) s = `${br[2]}-${br[1].padStart(2, '0')}`;
    return cfg().scoringMonths.includes(s) ? { ok: true, value: s } : { ok: false, error: 'Mês fora do período de pontuação (jan a nov/2027).' };
  }

  /** Validação estrutural de um lance (sem regras de saldo/rodada, que ficam no domínio). */
  function validateBidAmount(points, minBid) {
    const inc = cfg().rules.bidIncrement;
    const p = parsePoints(points);
    if (!p.ok) return p;
    if (p.value <= 0) return { ok: false, error: 'O lance precisa ser maior que zero.' };
    if (p.value < minBid) return { ok: false, error: `O lance mínimo deste prêmio é ${fmtInt(minBid)} pontos.` };
    if (p.value % inc !== 0) return { ok: false, error: `Use múltiplos de ${inc} pontos. Exemplo: ${fmtInt(Math.ceil(p.value / inc) * inc)}.` };
    return { ok: true, value: p.value };
  }

  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }

  /* ---------------- CSV ---------------- */
  /** Parser CSV simples com aspas, separador ";" ou "," detectado pelo cabeçalho. */
  function parseCSV(text) {
    const src = String(text || '').replace(/^﻿/, '');
    const firstLine = src.split(/\r?\n/)[0] || '';
    const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (q) {
        if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return { sep, rows: rows.filter(r => r.some(c => String(c).trim() !== '')) };
  }

  /** Gera CSV seguro para Excel pt-BR: separador ";", BOM e neutralização de
   *  fórmulas (células iniciadas por = + - @ recebem apóstrofo). */
  function toCSV(headers, rows) {
    const esc = v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + [headers.map(esc).join(';')].concat(rows.map(r => r.map(esc).join(';'))).join('\r\n');
  }

  function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  }

  LNA.validators = {
    parseDecimalBR, parsePoints, validateAchievement, validateEmail, normalizeEmail, cleanText, validateName,
    validateLocation, validateMonth, validateBidAmount, parseCSV, toCSV, normalizeHeader
  };
})(typeof window !== 'undefined' ? window : globalThis);
