/*
 * Metrics and reporting for immutable prediction snapshots.
 *
 * Inputs are snapshot rows and outcome rows. Missing market data is reported
 * separately and is never silently counted as a model miss.
 */
var METRICS_REPORTER = (function () {
  'use strict';

  function num_(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function bool_(v) {
    return v === true || v === 1 || String(v).toLowerCase() === 'true';
  }

  function mean_(values) {
    const xs = values.map(num_).filter(function (v) { return v != null; });
    if (!xs.length) return null;
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  function median_(values) {
    const xs = values.map(num_).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    const m = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
  }

  function percentile_(values, q) {
    const xs = values.map(num_).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    const p = (xs.length - 1) * q;
    const i = Math.floor(p);
    const f = p - i;
    return i + 1 < xs.length ? xs[i] * (1 - f) + xs[i + 1] * f : xs[i];
  }

  function groupBy_(rows, keyFn) {
    const map = new Map();
    (rows || []).forEach(function (row) {
      const key = keyFn(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }

  function outcomeKey_(row) {
    return [String(row.snapshotId || ''), String(row.symbol || '').toUpperCase(), String(row.horizon || '')].join('::');
  }

  function buildOutcomeMap_(outcomes) {
    const map = new Map();
    (outcomes || []).forEach(function (row) {
      const key = outcomeKey_(row);
      if (map.has(key)) throw new Error('Mükerrer outcome kaydı: ' + key);
      map.set(key, row);
    });
    return map;
  }

  function snapshotSummary(input) {
    input = input || {};
    const snapshotRows = Array.isArray(input.snapshotRows) ? input.snapshotRows : [];
    const outcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
    const horizon = String(input.horizon || 'SAME_DAY_CLOSE');
    const realTop20Count = Number(input.realTop20Count || 20);
    const outcomeMap = buildOutcomeMap_(outcomes);

    const evaluated = [];
    const unavailable = [];
    snapshotRows.forEach(function (row) {
      const key = [String(row.snapshotId || ''), String(row.symbol || '').toUpperCase(), horizon].join('::');
      const out = outcomeMap.get(key);
      if (!out || (out.targetPrice == null && out.returnPct == null && !bool_(out.dataAvailable))) {
        unavailable.push(row);
        return;
      }
      evaluated.push({ prediction: row, outcome: out });
    });

    const hits = evaluated.filter(function (x) { return bool_(x.outcome.top20Hit); });
    const hitReturns = hits.map(function (x) { return x.outcome.returnPct; });
    const allReturns = evaluated.map(function (x) { return x.outcome.returnPct; });
    const mfes = evaluated.map(function (x) { return x.outcome.maxFavorablePct; });
    const maes = evaluated.map(function (x) { return x.outcome.maxAdversePct; });

    return {
      snapshotId: snapshotRows.length ? snapshotRows[0].snapshotId : null,
      horizon: horizon,
      predictionCount: snapshotRows.length,
      evaluatedCount: evaluated.length,
      unavailableCount: unavailable.length,
      dataCoverage: snapshotRows.length ? evaluated.length / snapshotRows.length : null,
      hitCount: hits.length,
      precisionAt20: evaluated.length ? hits.length / evaluated.length : null,
      recallAt20: realTop20Count > 0 ? hits.length / realTop20Count : null,
      averageReturnPct: mean_(allReturns),
      medianReturnPct: median_(allReturns),
      averageHitReturnPct: mean_(hitReturns),
      medianHitReturnPct: median_(hitReturns),
      averageMfePct: mean_(mfes),
      medianMfePct: median_(mfes),
      averageMaePct: mean_(maes),
      medianMaePct: median_(maes),
      returnP25Pct: percentile_(allReturns, 0.25),
      returnP75Pct: percentile_(allReturns, 0.75),
      positiveReturnRate: evaluated.length ? evaluated.filter(function (x) { return num_(x.outcome.returnPct) > 0; }).length / evaluated.length : null
    };
  }

  function aggregateSnapshots(input) {
    input = input || {};
    const snapshots = Array.isArray(input.snapshotRows) ? input.snapshotRows : [];
    const outcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
    const horizon = String(input.horizon || 'SAME_DAY_CLOSE');
    const groups = groupBy_(snapshots, function (r) { return String(r.snapshotId || ''); });
    const summaries = [];
    groups.forEach(function (rows) {
      summaries.push(snapshotSummary({
        snapshotRows: rows,
        outcomes: outcomes,
        horizon: horizon,
        realTop20Count: input.realTop20Count || 20
      }));
    });

    return {
      horizon: horizon,
      snapshotCount: summaries.length,
      predictionCount: summaries.reduce(function (s, x) { return s + x.predictionCount; }, 0),
      evaluatedCount: summaries.reduce(function (s, x) { return s + x.evaluatedCount; }, 0),
      hitCount: summaries.reduce(function (s, x) { return s + x.hitCount; }, 0),
      macroPrecisionAt20: mean_(summaries.map(function (x) { return x.precisionAt20; })),
      macroRecallAt20: mean_(summaries.map(function (x) { return x.recallAt20; })),
      macroDataCoverage: mean_(summaries.map(function (x) { return x.dataCoverage; })),
      macroAverageReturnPct: mean_(summaries.map(function (x) { return x.averageReturnPct; })),
      macroMedianReturnPct: median_(summaries.map(function (x) { return x.medianReturnPct; })),
      snapshots: summaries
    };
  }

  function breakdown(input, field) {
    input = input || {};
    const snapshotRows = Array.isArray(input.snapshotRows) ? input.snapshotRows : [];
    const outcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
    const horizon = String(input.horizon || 'SAME_DAY_CLOSE');
    const outcomeMap = buildOutcomeMap_(outcomes);
    const groups = groupBy_(snapshotRows, function (r) { return String(r[field] || 'UNKNOWN'); });
    const result = [];

    groups.forEach(function (rows, key) {
      const joined = [];
      rows.forEach(function (row) {
        const out = outcomeMap.get([String(row.snapshotId || ''), String(row.symbol || '').toUpperCase(), horizon].join('::'));
        if (out) joined.push({ prediction: row, outcome: out });
      });
      const available = joined.filter(function (x) { return x.outcome.targetPrice != null || x.outcome.returnPct != null || bool_(x.outcome.dataAvailable); });
      const hits = available.filter(function (x) { return bool_(x.outcome.top20Hit); });
      result.push({
        key: key,
        predictionCount: rows.length,
        evaluatedCount: available.length,
        dataCoverage: rows.length ? available.length / rows.length : null,
        hitCount: hits.length,
        precision: available.length ? hits.length / available.length : null,
        averageReturnPct: mean_(available.map(function (x) { return x.outcome.returnPct; })),
        medianReturnPct: median_(available.map(function (x) { return x.outcome.returnPct; }))
      });
    });

    return result.sort(function (a, b) {
      if (b.precision !== a.precision) return (b.precision || 0) - (a.precision || 0);
      return b.evaluatedCount - a.evaluatedCount;
    });
  }

  function byModel(input) { return breakdown(input, 'model'); }
  function bySymbol(input) { return breakdown(input, 'symbol'); }
  function bySessionKind(input) { return breakdown(input, 'sessionKind'); }

  return Object.freeze({
    snapshotSummary: snapshotSummary,
    aggregateSnapshots: aggregateSnapshots,
    byModel: byModel,
    bySymbol: bySymbol,
    bySessionKind: bySessionKind,
    mean: mean_,
    median: median_
  });
})();

function summarizeSnapshotMetrics_(input) {
  return METRICS_REPORTER.snapshotSummary(input);
}

function aggregateSnapshotMetrics_(input) {
  return METRICS_REPORTER.aggregateSnapshots(input);
}
