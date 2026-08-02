/*
 * Leakage-safe walk-forward calibration for S horizon weights.
 *
 * Input examples must already be frozen prediction/outcome records. The
 * calibrator never uses an observation whose prediction date is on or after
 * the test period when choosing weights for that test period.
 */
var WALK_FORWARD_CALIBRATION = (function () {
  'use strict';

  const VERSION = 'WFC-1.0.0';
  const HORIZON_COMPONENTS = Object.freeze({
    SAME_DAY: Object.freeze([
      'consensus','shortMomentum','liveStrength','volumeAcceleration','technicalStructure'
    ]),
    NEXT_DAY: Object.freeze([
      'consensus','trendStructure','recoveryPattern','mediumMomentum','riskQuality'
    ])
  });

  const DEFAULTS = Object.freeze({
    topN: 20,
    gridStep: 0.25,
    minTrainDates: 20,
    testDates: 5,
    stepDates: 5,
    minEvaluatedPerFold: 20,
    objectiveWeights: Object.freeze({
      precision: 0.65,
      returnQuality: 0.25,
      dataCoverage: 0.10
    })
  });

  function finite_(v) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function clamp_(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function dateKey_(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!isFinite(d.getTime())) throw new Error('Geçersiz predictionTs: ' + value);
    return d.toISOString().slice(0, 10);
  }

  function normalizeWeights_(weights, keys) {
    let sum = 0;
    const out = {};
    keys.forEach(function (key) {
      const n = finite_(weights && weights[key]);
      out[key] = n != null && n > 0 ? n : 0;
      sum += out[key];
    });
    if (sum <= 0) throw new Error('Ağırlık toplamı pozitif olmalıdır.');
    keys.forEach(function (key) { out[key] = out[key] / sum; });
    return out;
  }

  function weightedAvailable_(components, weights, keys) {
    let total = 0;
    let used = 0;
    keys.forEach(function (key) {
      const value = finite_(components && components[key]);
      const weight = finite_(weights && weights[key]);
      if (value == null || weight == null || weight <= 0) return;
      total += clamp_(value, 0, 100) * weight;
      used += weight;
    });
    return used > 0 ? total / used : null;
  }

  function normalizeExample_(row, horizon) {
    const symbol = String(row && (row.symbol || row.sym) || '').trim().toUpperCase();
    if (!symbol) return null;
    const predictionTs = row.predictionTs || row.prediction_ts;
    const snapshotId = String(row.snapshotId || row.snapshot_id || '');
    const components = row.components || (row.raw && row.raw.components) || {};
    const top20Hit = row.top20Hit === true || Number(row.top20Hit) === 1;
    const dataAvailable = row.dataAvailable !== false && row.targetPrice !== null;
    const returnPct = finite_(row.returnPct);
    return {
      snapshotId: snapshotId,
      predictionTs: predictionTs,
      date: dateKey_(predictionTs),
      horizon: horizon,
      symbol: symbol,
      components: components,
      top20Hit: top20Hit,
      dataAvailable: dataAvailable,
      returnPct: returnPct
    };
  }

  function prepareExamples(rows, horizon) {
    const h = String(horizon || '').toUpperCase();
    if (!HORIZON_COMPONENTS[h]) throw new Error('Desteklenmeyen ufuk: ' + horizon);
    return (rows || []).map(function (row) {
      return normalizeExample_(row, h);
    }).filter(Boolean).sort(function (a, b) {
      return new Date(a.predictionTs).getTime() - new Date(b.predictionTs).getTime() ||
        a.snapshotId.localeCompare(b.snapshotId) || a.symbol.localeCompare(b.symbol);
    });
  }

  function compositions_(units, parts, prefix, out) {
    prefix = prefix || [];
    out = out || [];
    if (parts === 1) {
      out.push(prefix.concat([units]));
      return out;
    }
    for (let i = 0; i <= units; i++) {
      compositions_(units - i, parts - 1, prefix.concat([i]), out);
    }
    return out;
  }

  function generateWeightGrid(horizon, step) {
    const h = String(horizon || '').toUpperCase();
    const keys = HORIZON_COMPONENTS[h];
    if (!keys) throw new Error('Desteklenmeyen ufuk: ' + horizon);
    const s = Number(step || DEFAULTS.gridStep);
    const units = Math.round(1 / s);
    if (!(s > 0 && s <= 1) || Math.abs(units * s - 1) > 1e-9) {
      throw new Error('gridStep, 1 sayısını tam bölmelidir.');
    }
    return compositions_(units, keys.length).filter(function (arr) {
      return arr.some(function (x) { return x > 0; });
    }).map(function (arr) {
      const w = {};
      keys.forEach(function (key, i) { w[key] = arr[i] / units; });
      return w;
    });
  }

  function groupBySnapshot_(examples) {
    const map = new Map();
    examples.forEach(function (e) {
      const key = e.snapshotId || e.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.keys()).sort().map(function (key) {
      return { key: key, rows: map.get(key) };
    });
  }

  function scoreRows_(rows, weights, keys, topN) {
    return rows.map(function (row) {
      return {
        row: row,
        score: weightedAvailable_(row.components, weights, keys)
      };
    }).filter(function (x) { return x.score != null; })
      .sort(function (a, b) {
        return b.score - a.score || a.row.symbol.localeCompare(b.row.symbol);
      }).slice(0, topN);
  }

  function evaluate(examples, horizon, weights, options) {
    const h = String(horizon || '').toUpperCase();
    const keys = HORIZON_COMPONENTS[h];
    const cfg = Object.assign({}, DEFAULTS, options || {});
    const normalizedWeights = normalizeWeights_(weights, keys);
    const groups = groupBySnapshot_(examples);
    let predicted = 0;
    let evaluated = 0;
    let hits = 0;
    const returns = [];

    groups.forEach(function (group) {
      scoreRows_(group.rows, normalizedWeights, keys, Number(cfg.topN)).forEach(function (x) {
        predicted++;
        if (!x.row.dataAvailable) return;
        evaluated++;
        if (x.row.top20Hit) hits++;
        if (x.row.returnPct != null) returns.push(x.row.returnPct);
      });
    });

    const precision = evaluated ? hits / evaluated : 0;
    const coverage = predicted ? evaluated / predicted : 0;
    const avgReturn = returns.length
      ? returns.reduce(function (a, b) { return a + b; }, 0) / returns.length
      : null;
    const returnQuality = avgReturn == null ? 0 : clamp_(0.5 + avgReturn / 20, 0, 1);
    const ow = cfg.objectiveWeights || DEFAULTS.objectiveWeights;
    const objective =
      precision * Number(ow.precision) +
      returnQuality * Number(ow.returnQuality) +
      coverage * Number(ow.dataCoverage);

    return {
      horizon: h,
      weights: normalizedWeights,
      snapshotCount: groups.length,
      predictedCount: predicted,
      evaluatedCount: evaluated,
      hitCount: hits,
      precisionAt20: precision,
      dataCoverage: coverage,
      averageReturnPct: avgReturn,
      returnQuality: returnQuality,
      objective: objective
    };
  }

  function chooseBest_(examples, horizon, grid, options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});
    let best = null;
    (grid || []).forEach(function (weights) {
      const result = evaluate(examples, horizon, weights, cfg);
      if (result.evaluatedCount < Number(cfg.minEvaluatedPerFold)) return;
      if (!best || result.objective > best.objective + 1e-12) {
        best = result;
      } else if (best && Math.abs(result.objective - best.objective) <= 1e-12) {
        const currentSpread = Object.keys(result.weights).reduce(function (s, k) {
          return s + Math.abs(result.weights[k] - 1 / Object.keys(result.weights).length);
        }, 0);
        const bestSpread = Object.keys(best.weights).reduce(function (s, k) {
          return s + Math.abs(best.weights[k] - 1 / Object.keys(best.weights).length);
        }, 0);
        if (currentSpread < bestSpread) best = result;
      }
    });
    return best;
  }

  function uniqueDates_(examples) {
    return Array.from(new Set(examples.map(function (e) { return e.date; }))).sort();
  }

  function walkForward(input) {
    input = input || {};
    const horizon = String(input.horizon || '').toUpperCase();
    const cfg = Object.assign({}, DEFAULTS, input.options || {});
    const examples = prepareExamples(input.examples || [], horizon);
    const dates = uniqueDates_(examples);
    const grid = input.weightGrid || generateWeightGrid(horizon, cfg.gridStep);
    const folds = [];

    for (
      let testStart = Number(cfg.minTrainDates);
      testStart < dates.length;
      testStart += Number(cfg.stepDates)
    ) {
      const testEnd = Math.min(dates.length, testStart + Number(cfg.testDates));
      const trainDates = dates.slice(0, testStart);
      const testDates = dates.slice(testStart, testEnd);
      if (!testDates.length) break;
      const trainSet = new Set(trainDates);
      const testSet = new Set(testDates);
      const train = examples.filter(function (e) { return trainSet.has(e.date); });
      const test = examples.filter(function (e) { return testSet.has(e.date); });
      const bestTrain = chooseBest_(train, horizon, grid, cfg);
      if (!bestTrain) continue;
      const testResult = evaluate(test, horizon, bestTrain.weights, cfg);
      folds.push({
        fold: folds.length + 1,
        trainStart: trainDates[0],
        trainEnd: trainDates[trainDates.length - 1],
        testStart: testDates[0],
        testEnd: testDates[testDates.length - 1],
        weights: bestTrain.weights,
        trainMetrics: bestTrain,
        testMetrics: testResult
      });
    }

    const valid = folds.filter(function (f) { return f.testMetrics.evaluatedCount > 0; });
    const aggregate = {
      foldCount: valid.length,
      meanPrecisionAt20: valid.length ? valid.reduce(function (s, f) {
        return s + f.testMetrics.precisionAt20;
      }, 0) / valid.length : null,
      meanDataCoverage: valid.length ? valid.reduce(function (s, f) {
        return s + f.testMetrics.dataCoverage;
      }, 0) / valid.length : null,
      meanAverageReturnPct: valid.length ? valid.reduce(function (s, f) {
        return s + Number(f.testMetrics.averageReturnPct || 0);
      }, 0) / valid.length : null
    };

    return {
      version: VERSION,
      horizon: horizon,
      dateCount: dates.length,
      exampleCount: examples.length,
      gridSize: grid.length,
      folds: folds,
      aggregate: aggregate
    };
  }

  return Object.freeze({
    version: VERSION,
    prepareExamples: prepareExamples,
    generateWeightGrid: generateWeightGrid,
    evaluate: evaluate,
    walkForward: walkForward,
    components: HORIZON_COMPONENTS,
    defaults: DEFAULTS
  });
})();

function runWalkForwardCalibration_(input) {
  return WALK_FORWARD_CALIBRATION.walkForward(input);
}
