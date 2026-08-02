/* Dual-arm shadow experiment: legacy vs new S with frozen entry prices. */
var SHADOW_EXPERIMENT = (function () {
  'use strict';

  const SHEET_RUNS = '_ShadowExperiments';
  const SHEET_ARMS = '_ShadowExperimentArms';
  const VERSION = 'SHADOW-EXPERIMENT-1.0.0';

  const RUN_HEADERS = [
    'experimentId','createdTs','predictionTs','sessionKind','horizon',
    'legacyCount','newCount','overlapCount','status','message'
  ];
  const ARM_HEADERS = [
    'experimentId','arm','symbol','rank','score','entryPrice','featureTs',
    'modelVersion','sourceJson','createdTs'
  ];

  function ensureSheet_(name, headers) {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getMaxColumns() < headers.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    }
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const same = headers.every(function (h, i) { return String(current[i] || '') === h; });
    if (!same) {
      if (sh.getLastRow() > 1) throw new Error(name + ' şeması uyuşmuyor.');
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function finite_(v) {
    const n = Number(v);
    return v != null && isFinite(n) ? n : null;
  }

  function symbol_(v) { return String(v || '').trim().toUpperCase(); }

  function normalizeArm_(arm, rows, featureMap) {
    const seen = new Set();
    return (rows || []).map(function (row, index) {
      const sym = symbol_(row.symbol || row.sym || row.Hisse);
      if (!sym || seen.has(sym)) return null;
      seen.add(sym);
      const f = featureMap.get(sym) || {};
      const price = finite_(row.entryPrice != null ? row.entryPrice :
        (row.maliyet != null ? row.maliyet :
        (f.anlik != null ? f.anlik : f.kapanis_T)));
      if (price == null || price <= 0) return null;
      return {
        arm: arm,
        symbol: sym,
        rank: finite_(row.rank || row.Sira) || index + 1,
        score: finite_(row.score || row.Puan || row.FinalScore),
        entryPrice: price,
        featureTs: row.featureTs || f.featureTs || f.verizamani || null,
        modelVersion: String(row.modelVersion || (arm === 'LEGACY' ? 'LEGACY-S' : 'NEW-S')),
        source: row.source || row.raw || {}
      };
    }).filter(Boolean);
  }

  function create(input) {
    input = input || {};
    const predictionTs = new Date(input.predictionTs || new Date());
    if (!isFinite(predictionTs.getTime())) throw new Error('Geçersiz predictionTs.');
    const horizon = String(input.horizon || '').toUpperCase();
    if (horizon !== 'SAME_DAY' && horizon !== 'NEXT_DAY') throw new Error('Geçersiz horizon.');

    const features = input.features || [];
    const featureMap = new Map();
    features.forEach(function (f) {
      const sym = symbol_(f.symbol || f.sym);
      if (sym) featureMap.set(sym, f);
    });

    const legacy = normalizeArm_('LEGACY', input.legacyRows || [], featureMap);
    const modern = normalizeArm_('NEW', input.newRows || [], featureMap);
    if (!legacy.length || !modern.length) throw new Error('Her iki deney kolunda da geçerli aday bulunmalıdır.');

    const experimentId = String(input.experimentId || Utilities.getUuid());
    const runSheet = ensureSheet_(SHEET_RUNS, RUN_HEADERS);
    const armSheet = ensureSheet_(SHEET_ARMS, ARM_HEADERS);
    const duplicate = runSheet.getLastRow() > 1 && runSheet
      .getRange(2, 1, runSheet.getLastRow() - 1, 1).getValues().flat()
      .some(function (x) { return String(x) === experimentId; });
    if (duplicate) throw new Error('Experiment zaten mevcut: ' + experimentId);

    const legacySet = new Set(legacy.map(function (x) { return x.symbol; }));
    const overlap = modern.filter(function (x) { return legacySet.has(x.symbol); }).length;
    const now = new Date().toISOString();
    runSheet.appendRow([
      experimentId, now, predictionTs.toISOString(), String(input.sessionKind || ''), horizon,
      legacy.length, modern.length, overlap, 'OPEN', String(input.message || '')
    ]);

    const rows = legacy.concat(modern).map(function (r) {
      return [
        experimentId, r.arm, r.symbol, r.rank, r.score == null ? '' : r.score,
        r.entryPrice, r.featureTs || '', r.modelVersion,
        JSON.stringify(r.source || {}), now
      ];
    });
    armSheet.getRange(armSheet.getLastRow() + 1, 1, rows.length, ARM_HEADERS.length).setValues(rows);
    return { experimentId: experimentId, legacyCount: legacy.length, newCount: modern.length, overlapCount: overlap, status: 'OPEN', version: VERSION };
  }

  function readArms_(experimentId) {
    const sh = ensureSheet_(SHEET_ARMS, ARM_HEADERS);
    if (sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, ARM_HEADERS.length).getValues()
      .filter(function (r) { return String(r[0]) === String(experimentId); })
      .map(function (r) {
        const o = {}; ARM_HEADERS.forEach(function (h, i) { o[h] = r[i]; }); return o;
      });
  }

  function evaluate(input) {
    input = input || {};
    const experimentId = String(input.experimentId || '');
    if (!experimentId) throw new Error('experimentId zorunludur.');
    const arms = readArms_(experimentId);
    if (!arms.length) throw new Error('Experiment kolları bulunamadı: ' + experimentId);
    const outcomes = input.outcomes || [];
    const outcomeMap = new Map();
    outcomes.forEach(function (o) {
      const sym = symbol_(o.symbol || o.sym);
      if (!sym) return;
      if (outcomeMap.has(sym)) throw new Error('Mükerrer outcome: ' + sym);
      outcomeMap.set(sym, o);
    });

    function metrics_(armName) {
      const rows = arms.filter(function (r) { return String(r.arm) === armName; });
      let evaluated = 0, hits = 0, retSum = 0, retCount = 0, mfeSum = 0, mfeCount = 0, maeSum = 0, maeCount = 0;
      const details = rows.map(function (r) {
        const o = outcomeMap.get(symbol_(r.symbol));
        const available = !!(o && o.dataAvailable !== false && finite_(o.targetPrice) != null);
        const entry = finite_(r.entryPrice);
        let ret = null;
        if (available && entry && entry > 0) ret = (finite_(o.targetPrice) / entry - 1) * 100;
        if (available) evaluated++;
        if (available && o.top20Hit === true) hits++;
        if (ret != null) { retSum += ret; retCount++; }
        const mfe = finite_(o && o.maxFavorablePct); if (mfe != null) { mfeSum += mfe; mfeCount++; }
        const mae = finite_(o && o.maxAdversePct); if (mae != null) { maeSum += mae; maeCount++; }
        return { arm: armName, symbol: r.symbol, rank: r.rank, entryPrice: entry, dataAvailable: available, top20Hit: !!(o && o.top20Hit), top20Rank: o && o.top20Rank, targetPrice: o && o.targetPrice, returnPct: ret, maxFavorablePct: mfe, maxAdversePct: mae };
      });
      return {
        arm: armName,
        predictionCount: rows.length,
        evaluatedCount: evaluated,
        dataCoverage: rows.length ? evaluated / rows.length : 0,
        hitCount: hits,
        precisionAt20: evaluated ? hits / evaluated : null,
        averageReturnPct: retCount ? retSum / retCount : null,
        averageMfePct: mfeCount ? mfeSum / mfeCount : null,
        averageMaePct: maeCount ? maeSum / maeCount : null,
        details: details
      };
    }

    const legacy = metrics_('LEGACY');
    const modern = metrics_('NEW');
    return {
      experimentId: experimentId,
      legacy: legacy,
      modern: modern,
      delta: {
        precisionAt20: legacy.precisionAt20 == null || modern.precisionAt20 == null ? null : modern.precisionAt20 - legacy.precisionAt20,
        averageReturnPct: legacy.averageReturnPct == null || modern.averageReturnPct == null ? null : modern.averageReturnPct - legacy.averageReturnPct,
        dataCoverage: modern.dataCoverage - legacy.dataCoverage
      },
      version: VERSION
    };
  }

  function run(input) {
    input = input || {};
    const runtime = buildRuntimeInputs_(input);
    const selected = buildRuntimeSSelection_({
      horizon: input.horizon,
      modelResults: runtime.modelResults,
      features: runtime.features,
      bindingOptions: input.bindingOptions || {}
    });
    const legacy = (typeof SHADOW_COMPARISON !== 'undefined' && SHADOW_COMPARISON.readLegacy)
      ? SHADOW_COMPARISON.readLegacy(input.legacyOptions || {})
      : (input.legacyRows || []);
    return create({
      predictionTs: input.predictionTs,
      sessionKind: input.sessionKind,
      horizon: input.horizon,
      legacyRows: legacy,
      newRows: selected,
      features: runtime.features,
      message: input.message || ''
    });
  }

  return Object.freeze({ VERSION: VERSION, create: create, evaluate: evaluate, run: run });
})();

function createShadowExperiment_(input) { return SHADOW_EXPERIMENT.create(input); }
function evaluateShadowExperiment_(input) { return SHADOW_EXPERIMENT.evaluate(input); }
function runDualArmShadowExperiment_(input) { return SHADOW_EXPERIMENT.run(input); }
