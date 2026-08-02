/*
 * Live workbook contract audit for the original V_141225 workbook.
 * Scope is intentionally limited to the initial objective: validate table
 * transitions Veriler -> K1..K5 -> S -> K_Tarihsel and expose defects that
 * can distort SAME_DAY/NEXT_DAY Top 20 measurement.
 */
var LIVE_WORKBOOK_CONTRACT_AUDIT = (function () {
  'use strict';

  const VERSION = 'LIVE-WORKBOOK-AUDIT-1.0.0';
  const EXPECTED_MODEL_HEADERS = [
    'Hisse','VeriZamani','Anlık Değişim (%)','Anlik','Maliyet','Getiri',
    'İlk Giriş Zamanı','Degisim3Gun(%)','Destekler(3)','Direncler(3)',
    'Kapanış Tarihi','Fiyat Değişim (%)','Kapanış','Skor'
  ];
  const EXPECTED_S_HEADERS = [
    'Hisse','VeriZamani','Anlık Değişim (%)','Anlik','Maliyet','Getiri',
    'İlk Giriş Zamanı','Degisim3Gun(%)','Destekler(3)','Direncler(3)',
    'Kapanış Tarihi','Fiyat Değişim (%)','Kapanış','KaynakK','K-İçi Rank',
    'FinalScore'
  ];

  function normalizeHeader(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compareHeaders(actual, expected) {
    const a = (actual || []).map(normalizeHeader);
    const e = (expected || []).map(normalizeHeader);
    const mismatches = [];
    const n = Math.max(a.length, e.length);
    for (let i = 0; i < n; i++) {
      if ((a[i] || '') !== (e[i] || '')) {
        mismatches.push({ column: i + 1, expected: e[i] || null, actual: a[i] || null });
      }
    }
    return { ok: mismatches.length === 0, mismatches: mismatches };
  }

  function parseModelCount(reason) {
    const text = String(reason || '');
    const m = text.match(/K\s*Adet\s*:\s*([0-9]+(?:[.,][0-9]+)?)/i);
    return m ? Number(m[1].replace(',', '.')) : null;
  }

  function parseNamedNumber(reason, name) {
    const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = String(reason || '').match(new RegExp(escaped + '\\s*:\\s*(-?[0-9]+(?:[.,][0-9]+)?)', 'i'));
    return m ? Number(m[1].replace(',', '.')) : null;
  }

  function countSymbols(text) {
    const matches = String(text || '').match(/\b[A-ZÇĞİÖŞÜ0-9]{3,8}\s*\([+-]?[0-9]+(?:[.,][0-9]+)?%\)/g);
    return matches ? matches.length : 0;
  }

  function auditK5Rows(rows, minModels) {
    minModels = Number(minModels || 2);
    const findings = [];
    (rows || []).forEach(function (row, idx) {
      const count = parseModelCount(row && row[14]);
      if (count != null && count < minModels) {
        findings.push({ row: idx + 2, symbol: row[0], code: 'K5_SINGLE_MODEL_AS_CONSENSUS', modelCount: count });
      }
      if (String(row && row[14] || '').indexOf('[object Object]') >= 0) {
        findings.push({ row: idx + 2, symbol: row[0], code: 'K5_BROKEN_REASON_SERIALIZATION' });
      }
    });
    return findings;
  }

  function auditSRows(rows) {
    const findings = [];
    (rows || []).forEach(function (row, idx) {
      const reason = row && row[16];
      const supGap = parseNamedNumber(reason, 'SupGap(%)');
      const resGap = parseNamedNumber(reason, 'ResGap(%)');
      const supScore = parseNamedNumber(reason, 'SupMM');
      const resScore = parseNamedNumber(reason, 'ResMM');
      if (supGap === 0 && resGap === 0 && supScore === 50 && resScore === 50) {
        findings.push({ row: idx + 2, symbol: row[0], code: 'S_SUPPORT_RESISTANCE_NEUTRAL_CONSTANT' });
      }
    });
    return findings;
  }

  function auditHistoricalRows(rows) {
    const findings = [];
    (rows || []).forEach(function (row, idx) {
      const actual = countSymbols(row && row[2]);
      if (actual > 0 && actual < 20) {
        findings.push({ row: idx + 2, day: row[0], code: 'REAL_TOPN_LESS_THAN_20', actualCount: actual, expectedCount: 20 });
      }
    });
    return findings;
  }

  function audit(input) {
    input = input || {};
    return {
      version: VERSION,
      veriler: {
        physicalColumnCount: Number(input.verilerPhysicalColumnCount || 0),
        canonicalColumnCount: Number(input.verilerCanonicalColumnCount || 468),
        trailingColumnCount: Math.max(0, Number(input.verilerPhysicalColumnCount || 0) - Number(input.verilerCanonicalColumnCount || 468)),
        headerHasInvisibleUnicode: (input.verilerHeaders || []).some(function (x) {
          return /[\u200B-\u200D\u2060\uFEFF]/.test(String(x || ''));
        })
      },
      modelHeaders: {
        K1: compareHeaders(input.k1Headers, EXPECTED_MODEL_HEADERS),
        K2: compareHeaders(input.k2Headers, EXPECTED_MODEL_HEADERS),
        K3: compareHeaders(input.k3Headers, EXPECTED_MODEL_HEADERS),
        K4: compareHeaders(input.k4Headers, EXPECTED_MODEL_HEADERS),
        K5: compareHeaders(input.k5Headers, EXPECTED_MODEL_HEADERS)
      },
      sHeaders: compareHeaders(input.sHeaders, EXPECTED_S_HEADERS),
      findings: []
        .concat(auditK5Rows(input.k5Rows, input.minConsensusModels || 2))
        .concat(auditSRows(input.sRows))
        .concat(auditHistoricalRows(input.historicalRows))
    };
  }

  return Object.freeze({
    version: VERSION,
    normalizeHeader: normalizeHeader,
    compareHeaders: compareHeaders,
    auditK5Rows: auditK5Rows,
    auditSRows: auditSRows,
    auditHistoricalRows: auditHistoricalRows,
    audit: audit
  });
})();

function auditLiveWorkbookContract_(input) {
  return LIVE_WORKBOOK_CONTRACT_AUDIT.audit(input);
}
