/* Shadow execution and legacy/new S comparison without mutating the production S sheet. */
var SHADOW_COMPARISON = (function () {
  'use strict';

  const SHEET = '_ShadowComparisons';
  const HEADERS = [
    'comparisonId','runTs','predictionTs','sessionKind','horizon','legacySource','newModelVersion',
    'legacyCount','newCount','overlapCount','overlapRate','legacyOnlyCount','newOnlyCount',
    'legacySymbolsJson','newSymbolsJson','legacyOnlyJson','newOnlyJson','rankDiffJson','status','message'
  ];

  function ensure_() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(SHEET);
    if (!sh) sh = ss.insertSheet(SHEET);
    if (sh.getMaxColumns() < HEADERS.length) sh.insertColumnsAfter(sh.getMaxColumns(), HEADERS.length - sh.getMaxColumns());
    const current = sh.getRange(1,1,1,HEADERS.length).getValues()[0];
    const same = HEADERS.every(function(h,i){ return String(current[i] || '') === h; });
    if (!same) {
      if (sh.getLastRow() > 1) throw new Error('Shadow comparison şeması uyuşmuyor.');
      sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function normalizeRows_(rows) {
    const seen = new Set();
    return (rows || []).map(function(row,index){
      const symbol = String((row && (row.symbol || row.sym || row.Hisse)) || '').trim().toUpperCase();
      const rank = Number(row && row.rank);
      return { symbol: symbol, rank: isFinite(rank) && rank > 0 ? rank : index + 1, raw: row };
    }).filter(function(row){
      if (!row.symbol || seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      return true;
    }).sort(function(a,b){ return a.rank - b.rank || a.symbol.localeCompare(b.symbol); });
  }

  function readLegacyS_(options) {
    const opts = options || {};
    if (Array.isArray(opts.legacyRows)) return normalizeRows_(opts.legacyRows);
    const ss = SpreadsheetApp.getActive();
    const sheetName = String(opts.sheetName || 'S');
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return [];
    const width = Math.max(1, sh.getLastColumn());
    const headers = sh.getRange(1,1,1,width).getValues()[0].map(function(v){ return String(v || '').trim(); });
    const symbolIndex = headers.findIndex(function(h){ return ['Hisse','Sembol','Symbol'].indexOf(h) >= 0; });
    const rankIndex = headers.findIndex(function(h){ return ['Sıra','Sira','Rank'].indexOf(h) >= 0; });
    if (symbolIndex < 0) throw new Error('Legacy S sayfasında hisse başlığı bulunamadı.');
    const values = sh.getRange(2,1,sh.getLastRow()-1,width).getValues();
    return normalizeRows_(values.map(function(row,index){
      return { symbol: row[symbolIndex], rank: rankIndex >= 0 ? row[rankIndex] : index + 1 };
    }));
  }

  function compare_(legacyRows, newRows) {
    const legacy = normalizeRows_(legacyRows);
    const modern = normalizeRows_(newRows);
    const legacyMap = new Map(legacy.map(function(r){ return [r.symbol,r]; }));
    const newMap = new Map(modern.map(function(r){ return [r.symbol,r]; }));
    const overlap = legacy.filter(function(r){ return newMap.has(r.symbol); }).map(function(r){ return r.symbol; });
    const legacyOnly = legacy.filter(function(r){ return !newMap.has(r.symbol); }).map(function(r){ return r.symbol; });
    const newOnly = modern.filter(function(r){ return !legacyMap.has(r.symbol); }).map(function(r){ return r.symbol; });
    const rankDiff = overlap.map(function(symbol){
      return { symbol: symbol, legacyRank: legacyMap.get(symbol).rank, newRank: newMap.get(symbol).rank, delta: newMap.get(symbol).rank - legacyMap.get(symbol).rank };
    });
    return {
      legacy: legacy,
      modern: modern,
      overlap: overlap,
      legacyOnly: legacyOnly,
      newOnly: newOnly,
      rankDiff: rankDiff,
      overlapRate: Math.max(legacy.length, modern.length) ? overlap.length / Math.max(legacy.length, modern.length) : 0
    };
  }

  function append_(input, comparison) {
    const sh = ensure_();
    const id = Utilities.getUuid();
    sh.appendRow([
      id,new Date().toISOString(),new Date(input.predictionTs || new Date()).toISOString(),String(input.sessionKind || ''),String(input.horizon || ''),
      String(input.legacySource || 'S'),String(input.newModelVersion || ''),comparison.legacy.length,comparison.modern.length,
      comparison.overlap.length,comparison.overlapRate,comparison.legacyOnly.length,comparison.newOnly.length,
      JSON.stringify(comparison.legacy.map(function(r){return r.symbol;})),JSON.stringify(comparison.modern.map(function(r){return r.symbol;})),
      JSON.stringify(comparison.legacyOnly),JSON.stringify(comparison.newOnly),JSON.stringify(comparison.rankDiff),'SUCCESS',''
    ]);
    return { comparisonId: id, comparison: comparison };
  }

  function run(input) {
    input = input || {};
    const predictionTs = new Date(input.predictionTs || new Date());
    const legacy = readLegacyS_(input.legacyOptions || {});
    const result = runEndToEndSSelection_({
      predictionTs: predictionTs,
      horizon: input.horizon || 'SAME_DAY',
      sessionKind: input.sessionKind || 'SHADOW',
      bindingOptions: input.bindingOptions || { strict: false }
    });
    const modern = normalizeRows_((result && (result.results || result.selection || result.rows)) || result || []);
    const comparison = compare_(legacy, modern);
    const modelVersion = modern.length && modern[0].raw ? String(modern[0].raw.modelVersion || '') : '';
    return append_({ predictionTs: predictionTs, sessionKind: input.sessionKind, horizon: input.horizon, legacySource: (input.legacyOptions && input.legacyOptions.sheetName) || 'S', newModelVersion: modelVersion }, comparison);
  }

  return Object.freeze({ ensure: ensure_, normalizeRows: normalizeRows_, readLegacyS: readLegacyS_, compare: compare_, run: run });
})();

function runShadowComparison_(input) { return SHADOW_COMPARISON.run(input); }
function compareLegacyAndNewS_(legacyRows, newRows) { return SHADOW_COMPARISON.compare(legacyRows, newRows); }
