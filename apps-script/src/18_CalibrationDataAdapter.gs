/*
 * Builds leakage-safe calibration examples from immutable snapshot/outcome sheets.
 */
var CALIBRATION_DATA_ADAPTER = (function () {
  'use strict';

  const SNAPSHOT_HEADERS = [
    'snapshotId','snapshotType','predictionTs','featureTs','sessionDate','sessionKind',
    'model','modelVersion','symbol','rank','score','coverage','entryPrice',
    'sourceModelsJson','payloadJson','payloadHash','createdTs'
  ];

  const OUTCOME_HEADERS = [
    'outcomeId','snapshotId','symbol','horizon','evaluationTs','top20Hit','top20Rank',
    'targetPrice','returnPct','maxFavorablePct','maxAdversePct','payloadJson','createdTs'
  ];

  function sheet_(name) {
    const sh = SpreadsheetApp.getActive().getSheetByName(name);
    if (!sh) throw new Error('Sayfa bulunamadı: ' + name);
    return sh;
  }

  function rowsAsObjects_(name, headers) {
    const sh = sheet_(name);
    if (sh.getLastRow() < 2) return [];
    const actual = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    headers.forEach(function (h, i) {
      if (String(actual[i] || '') !== h) throw new Error(name + ' şema uyuşmazlığı: ' + h);
    });
    return sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().map(function (row) {
      const out = {};
      headers.forEach(function (h, i) { out[h] = row[i]; });
      return out;
    });
  }

  function parseJson_(text, fallback) {
    if (text == null || text === '') return fallback;
    try { return JSON.parse(String(text)); }
    catch (_) { return fallback; }
  }

  function key_(snapshotId, symbol, horizon) {
    return [String(snapshotId), String(symbol).toUpperCase(), String(horizon).toUpperCase()].join('|');
  }

  function outcomeMap_(rows) {
    const map = new Map();
    rows.forEach(function (row) {
      const k = key_(row.snapshotId, row.symbol, row.horizon);
      if (map.has(k)) throw new Error('Mükerrer outcome: ' + k);
      map.set(k, row);
    });
    return map;
  }

  function componentsFromSnapshot_(row) {
    const payload = parseJson_(row.payloadJson, {});
    return (payload.raw && payload.raw.components) ||
      (payload.normalized && payload.normalized.components) ||
      payload.components || {};
  }

  function build(input) {
    input = input || {};
    const horizon = String(input.horizon || '').toUpperCase();
    if (horizon !== 'SAME_DAY' && horizon !== 'NEXT_DAY') {
      throw new Error('Desteklenmeyen ufuk: ' + input.horizon);
    }

    const snapshots = input.snapshotRows || rowsAsObjects_('_Snapshots', SNAPSHOT_HEADERS);
    const outcomes = input.outcomeRows || rowsAsObjects_('_SnapshotOutcomes', OUTCOME_HEADERS);
    const outMap = outcomeMap_(outcomes);
    const examples = [];
    let missingOutcomeCount = 0;
    let invalidComponentCount = 0;

    snapshots.forEach(function (s) {
      if (String(s.snapshotType || '').toUpperCase() !== 'S') return;
      const o = outMap.get(key_(s.snapshotId, s.symbol, horizon));
      if (!o) { missingOutcomeCount++; return; }
      const components = componentsFromSnapshot_(s);
      if (!components || !Object.keys(components).length) { invalidComponentCount++; return; }
      const targetPrice = o.targetPrice === '' || o.targetPrice == null ? null : Number(o.targetPrice);
      examples.push({
        snapshotId: String(s.snapshotId),
        predictionTs: s.predictionTs,
        featureTs: s.featureTs,
        sessionDate: s.sessionDate,
        sessionKind: s.sessionKind,
        modelVersion: s.modelVersion,
        symbol: String(s.symbol).toUpperCase(),
        rank: Number(s.rank),
        entryPrice: s.entryPrice === '' || s.entryPrice == null ? null : Number(s.entryPrice),
        components: components,
        top20Hit: Number(o.top20Hit) === 1,
        top20Rank: o.top20Rank === '' || o.top20Rank == null ? null : Number(o.top20Rank),
        dataAvailable: targetPrice != null && isFinite(targetPrice),
        targetPrice: targetPrice,
        returnPct: o.returnPct === '' || o.returnPct == null ? null : Number(o.returnPct),
        maxFavorablePct: o.maxFavorablePct === '' || o.maxFavorablePct == null ? null : Number(o.maxFavorablePct),
        maxAdversePct: o.maxAdversePct === '' || o.maxAdversePct == null ? null : Number(o.maxAdversePct),
        horizon: horizon
      });
    });

    examples.sort(function (a, b) {
      return new Date(a.predictionTs).getTime() - new Date(b.predictionTs).getTime() ||
        a.snapshotId.localeCompare(b.snapshotId) || a.symbol.localeCompare(b.symbol);
    });

    return {
      horizon: horizon,
      snapshotRowCount: snapshots.length,
      outcomeRowCount: outcomes.length,
      exampleCount: examples.length,
      missingOutcomeCount: missingOutcomeCount,
      invalidComponentCount: invalidComponentCount,
      examples: examples
    };
  }

  function buildAndCalibrate(input) {
    input = input || {};
    const prepared = build(input);
    const report = WALK_FORWARD_CALIBRATION.walkForward({
      horizon: prepared.horizon,
      examples: prepared.examples,
      options: input.options || {},
      weightGrid: input.weightGrid
    });
    return { prepared: prepared, calibration: report };
  }

  return Object.freeze({ build: build, buildAndCalibrate: buildAndCalibrate });
})();

function buildCalibrationExamples_(input) {
  return CALIBRATION_DATA_ADAPTER.build(input);
}

function runStoredWalkForwardCalibration_(input) {
  return CALIBRATION_DATA_ADAPTER.buildAndCalibrate(input);
}
