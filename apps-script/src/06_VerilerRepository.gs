/*
 * Veriler sheet read/write repository.
 *
 * Goals:
 * - one canonical header map
 * - exact-width reads and writes
 * - no dependence on stale trailing columns
 * - deterministic symbol-to-row mapping
 * - explicit validation errors instead of silent column fallbacks
 */

var VERILER_REPOSITORY = (function () {
  'use strict';

  function getSheet_() {
    const ss = SpreadsheetApp.getActive();
    const name = (typeof BIST_CONFIG !== 'undefined' && BIST_CONFIG.SHEETS)
      ? BIST_CONFIG.SHEETS.VERILER
      : 'Veriler';
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(name + ' sayfası bulunamadı.');
    return sheet;
  }

  function logicalHeader_(value) {
    if (typeof normalizeHeader_ === 'function') return normalizeHeader_(value);
    return String(value == null ? '' : value)
      .replace(/[\u2060\u200B\u200C\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/[\r\n]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readPlan(sheet) {
    const targetSheet = sheet || getSheet_();
    const physicalLastColumn = Math.max(1, targetSheet.getLastColumn());
    const raw = targetSheet.getRange(1, 1, 1, physicalLastColumn).getValues()[0];

    let logicalWidth = raw.length;
    while (logicalWidth > 1 && logicalHeader_(raw[logicalWidth - 1]) === '') {
      logicalWidth--;
    }

    const headers = raw.slice(0, logicalWidth).map(logicalHeader_);
    const map = {};
    const duplicates = [];

    headers.forEach(function (header, index) {
      if (!header) return;
      if (map[header]) duplicates.push(header);
      map[header] = index + 1;
    });

    if (duplicates.length) {
      throw new Error('Mükerrer Veriler başlıkları: ' + Array.from(new Set(duplicates)).join(', '));
    }

    const required = ['Hisse', 'VeriZamani', 'Anlik', 'AnlikDegisim%', 'Kapanis_T0', 'FiyatDegisim%_T0'];
    const missing = required.filter(function (header) { return !map[header]; });
    if (missing.length) {
      throw new Error('Eksik zorunlu Veriler başlıkları: ' + missing.join(', '));
    }

    return Object.freeze({
      headers: headers,
      map: Object.freeze(map),
      width: headers.length,
      physicalLastColumn: physicalLastColumn,
      trailingColumnCount: Math.max(0, physicalLastColumn - headers.length),
      latestLabel: 'T0'
    });
  }

  function ensureRows_(sheet, requiredRows) {
    const target = Math.max(1, Number(requiredRows || 1));
    if (sheet.getMaxRows() < target) {
      sheet.insertRowsAfter(sheet.getMaxRows(), target - sheet.getMaxRows());
    }
  }

  function activeSymbols_() {
    const list = (typeof getActiveSymbols_ === 'function') ? getActiveSymbols_() : [];
    const seen = new Set();
    return (list || []).map(function (s) { return String(s || '').trim().toUpperCase(); })
      .filter(function (s) {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      });
  }

  function buildSymbolIndex(sheet, plan) {
    const targetSheet = sheet || getSheet_();
    const targetPlan = plan || readPlan(targetSheet);
    const symbolColumn = targetPlan.map.Hisse;
    const lastRow = targetSheet.getLastRow();
    const index = new Map();
    const duplicates = [];

    if (lastRow < 2) return { index: index, duplicates: duplicates };

    const values = targetSheet.getRange(2, symbolColumn, lastRow - 1, 1).getValues();
    values.forEach(function (row, offset) {
      const symbol = String(row[0] || '').trim().toUpperCase();
      if (!symbol) return;
      if (index.has(symbol)) duplicates.push(symbol);
      index.set(symbol, offset + 2);
    });

    return {
      index: index,
      duplicates: Array.from(new Set(duplicates))
    };
  }

  function validateSymbolOrder(sheet, plan) {
    const targetSheet = sheet || getSheet_();
    const targetPlan = plan || readPlan(targetSheet);
    const expected = activeSymbols_();
    const actual = expected.length
      ? targetSheet.getRange(2, targetPlan.map.Hisse, expected.length, 1).getValues().flat()
      : [];

    const mismatches = [];
    for (let i = 0; i < expected.length; i++) {
      const found = String(actual[i] || '').trim().toUpperCase();
      if (found !== expected[i]) {
        mismatches.push({ row: i + 2, expected: expected[i], actual: found });
      }
    }

    return {
      ok: mismatches.length === 0,
      expectedCount: expected.length,
      mismatches: mismatches
    };
  }

  function readAllObjects(options) {
    const opts = options || {};
    const sheet = opts.sheet || getSheet_();
    const plan = opts.plan || readPlan(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const rows = sheet.getRange(2, 1, lastRow - 1, plan.width).getValues();
    return rows.map(function (row, index) {
      const out = { __rowNumber: index + 2 };
      plan.headers.forEach(function (header, columnIndex) {
        if (header) out[header] = row[columnIndex];
      });
      return out;
    }).filter(function (record) {
      return String(record.Hisse || '').trim() !== '';
    });
  }

  function readCanonicalMarketObjects(options) {
    return readAllObjects(options).map(function (record) {
      const numeric = (typeof parseLocalizedNumber_ === 'function')
        ? parseLocalizedNumber_
        : function (v) { const n = Number(v); return isFinite(n) ? n : null; };

      return {
        rowNumber: record.__rowNumber,
        sym: String(record.Hisse || '').trim().toUpperCase(),
        verizamani: record.VeriZamani instanceof Date ? record.VeriZamani : null,
        anlik: numeric(record.Anlik),
        anlikdeg: numeric(record['AnlikDegisim%']),
        kapanis_T: numeric(record.Kapanis_T0),
        fiyatdeg_T: numeric(record['FiyatDegisim%_T0']),
        raw: record
      };
    });
  }

  function writeRowsBySymbol(records, options) {
    const opts = options || {};
    const sheet = opts.sheet || getSheet_();
    const plan = opts.plan || readPlan(sheet);
    const symbols = activeSymbols_();
    const symbolPosition = new Map();
    symbols.forEach(function (symbol, index) { symbolPosition.set(symbol, index); });

    ensureRows_(sheet, symbols.length + 1);

    const currentRows = symbols.length
      ? sheet.getRange(2, 1, symbols.length, plan.width).getValues()
      : [];

    (records || []).forEach(function (record) {
      const symbol = String((record && (record.sym || record.Hisse)) || '').trim().toUpperCase();
      if (!symbolPosition.has(symbol)) {
        throw new Error('Aktif evrende bulunmayan sembol yazılamaz: ' + symbol);
      }

      const index = symbolPosition.get(symbol);
      let row;
      if (Array.isArray(record.rowArray)) {
        row = record.rowArray.slice(0, plan.width);
      } else {
        row = currentRows[index].slice();
        const normalizedKeys = Object.create(null);
        Object.keys(record.values || {}).forEach(function (rawHeader) {
          const header = logicalHeader_(rawHeader);
          if (!header) throw new Error('Boş Veriler başlığı yazılamaz.');
          if (normalizedKeys[header]) {
            throw new Error('Aynı kanonik Veriler başlığı iki kez yazılamaz: ' + header);
          }
          normalizedKeys[header] = true;
          const column = plan.map[header];
          if (!column) throw new Error('Bilinmeyen Veriler başlığı: ' + rawHeader + ' -> ' + header);
          row[column - 1] = record.values[rawHeader];
        });
      }

      while (row.length < plan.width) row.push('');
      row[plan.map.Hisse - 1] = symbol;
      currentRows[index] = row;
    });

    if (currentRows.length) {
      sheet.getRange(2, 1, currentRows.length, plan.width).setValues(currentRows);
    }

    return currentRows.length;
  }

  function audit() {
    const sheet = getSheet_();
    const plan = readPlan(sheet);
    const symbols = buildSymbolIndex(sheet, plan);
    const order = validateSymbolOrder(sheet, plan);

    return {
      sheet: sheet.getName(),
      logicalWidth: plan.width,
      physicalLastColumn: plan.physicalLastColumn,
      trailingColumnCount: plan.trailingColumnCount,
      duplicateSymbols: symbols.duplicates,
      symbolOrderOk: order.ok,
      symbolOrderMismatches: order.mismatches
    };
  }

  return Object.freeze({
    getSheet: getSheet_,
    readPlan: readPlan,
    buildSymbolIndex: buildSymbolIndex,
    validateSymbolOrder: validateSymbolOrder,
    readAllObjects: readAllObjects,
    readCanonicalMarketObjects: readCanonicalMarketObjects,
    writeRowsBySymbol: writeRowsBySymbol,
    audit: audit
  });
})();

function auditVerilerRepository_() {
  const report = VERILER_REPOSITORY.audit();
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
