/*
 * Cost-aware wrapper around WALK_FORWARD_CALIBRATION.
 * Keeps gross and net economics separate and rejects non-tradable candidates.
 */
var ECONOMIC_CALIBRATION = (function () {
  'use strict';

  const VERSION = 'ECON-CAL-1.0.0';
  const DEFAULT_OBJECTIVE = Object.freeze({
    precision: 0.50,
    netReturnQuality: 0.30,
    dataCoverage: 0.10,
    liquidityCoverage: 0.10
  });

  function finite_(v) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function clamp_(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function enrichExamples(rows, costPolicy) {
    return (rows || []).map(function (row) {
      const cost = EXECUTION_COST_MODEL.apply({
        entryPrice: row.entryPrice,
        exitPrice: row.targetPrice,
        grossReturnPct: row.returnPct,
        dailyTurnoverTry: row.dailyTurnoverTry || row.turnoverTry,
        orderValueTry: row.orderValueTry,
        participationRate: row.participationRate,
        spreadBps: row.spreadBps
      }, costPolicy);
      return Object.assign({}, row, {
        grossReturnPct: cost.grossReturnPct,
        netReturnPct: cost.netReturnPct,
        executionCostPct: cost.totalRoundTripPct,
        liquidityEligible: cost.eligible,
        executionCostVersion: cost.version
      });
    });
  }

  function evaluateSelected_(examples, horizon, weights, options) {
    const cfg = Object.assign({ topN: 20 }, options || {});
    const prepared = WALK_FORWARD_CALIBRATION.prepareExamples(examples, horizon);
    const keys = WALK_FORWARD_CALIBRATION.components[horizon];
    const bySnapshot = new Map();
    prepared.forEach(function (e, i) {
      const source = examples[i] || {};
      const merged = Object.assign({}, e, {
        netReturnPct: finite_(source.netReturnPct),
        liquidityEligible: source.liquidityEligible !== false
      });
      const key = merged.snapshotId || merged.date;
      if (!bySnapshot.has(key)) bySnapshot.set(key, []);
      bySnapshot.get(key).push(merged);
    });

    let predicted = 0, evaluated = 0, liquid = 0, hits = 0;
    const netReturns = [];
    bySnapshot.forEach(function (rows) {
      rows.map(function (row) {
        let total = 0, used = 0;
        keys.forEach(function (key) {
          const value = finite_(row.components && row.components[key]);
          const weight = finite_(weights && weights[key]);
          if (value == null || weight == null || weight <= 0) return;
          total += clamp_(value, 0, 100) * weight;
          used += weight;
        });
        return { row: row, score: used ? total / used : null };
      }).filter(function (x) { return x.score != null; })
        .sort(function (a, b) { return b.score - a.score || a.row.symbol.localeCompare(b.row.symbol); })
        .slice(0, Number(cfg.topN))
        .forEach(function (x) {
          predicted++;
          if (!x.row.dataAvailable) return;
          evaluated++;
          if (x.row.liquidityEligible) liquid++;
          if (!x.row.liquidityEligible) return;
          if (x.row.top20Hit) hits++;
          if (x.row.netReturnPct != null) netReturns.push(x.row.netReturnPct);
        });
    });

    const precision = liquid ? hits / liquid : 0;
    const dataCoverage = predicted ? evaluated / predicted : 0;
    const liquidityCoverage = evaluated ? liquid / evaluated : 0;
    const avgNetReturn = netReturns.length
      ? netReturns.reduce(function (a, b) { return a + b; }, 0) / netReturns.length
      : null;
    const netReturnQuality = avgNetReturn == null ? 0 : clamp_(0.5 + avgNetReturn / 20, 0, 1);
    const ow = Object.assign({}, DEFAULT_OBJECTIVE, cfg.objectiveWeights || {});
    const objective = precision * ow.precision +
      netReturnQuality * ow.netReturnQuality +
      dataCoverage * ow.dataCoverage +
      liquidityCoverage * ow.liquidityCoverage;

    return {
      horizon: horizon,
      predictedCount: predicted,
      evaluatedCount: evaluated,
      liquidCount: liquid,
      hitCount: hits,
      precisionAt20: precision,
      dataCoverage: dataCoverage,
      liquidityCoverage: liquidityCoverage,
      averageNetReturnPct: avgNetReturn,
      netReturnQuality: netReturnQuality,
      objective: objective
    };
  }

  function evaluate(input) {
    input = input || {};
    const horizon = String(input.horizon || '').toUpperCase();
    const enriched = enrichExamples(input.examples || [], input.costPolicy);
    const gross = WALK_FORWARD_CALIBRATION.evaluate(
      enriched,
      horizon,
      input.weights,
      input.options
    );
    const net = evaluateSelected_(enriched, horizon, input.weights, input.options);
    return {
      version: VERSION,
      horizon: horizon,
      gross: gross,
      economic: net,
      costPolicy: EXECUTION_COST_MODEL.normalizePolicy(input.costPolicy)
    };
  }

  return Object.freeze({
    VERSION: VERSION,
    enrichExamples: enrichExamples,
    evaluate: evaluate
  });
})();

function evaluateEconomicCalibration_(input) {
  return ECONOMIC_CALIBRATION.evaluate(input);
}
