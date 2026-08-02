/*
 * Bootstrap confidence intervals and fold/weight stability diagnostics.
 *
 * Input is a completed WALK_FORWARD_CALIBRATION report. Resampling is done at
 * fold level, not row level, so observations inside the same test fold remain
 * grouped. A deterministic PRNG is used to make audits reproducible.
 */
var BOOTSTRAP_STABILITY = (function () {
  'use strict';

  const VERSION = 'BOOTSTRAP-STABILITY-1.0.0';
  const DEFAULTS = Object.freeze({
    iterations: 2000,
    confidenceLevel: 0.95,
    seed: 20260802,
    minimumFolds: 5,
    maximumPrecisionCiWidth: 0.20,
    maximumReturnCiWidthPct: 6.0,
    maximumWeightStdDev: 0.18,
    minimumPositiveReturnProbability: 0.60
  });

  function finite_(value) {
    const n = Number(value);
    return isFinite(n) ? n : null;
  }

  function mean_(values) {
    const xs = (values || []).map(finite_).filter(function (x) { return x != null; });
    if (!xs.length) return null;
    return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  }

  function stdev_(values) {
    const xs = (values || []).map(finite_).filter(function (x) { return x != null; });
    if (xs.length < 2) return 0;
    const m = mean_(xs);
    const variance = xs.reduce(function (s, x) {
      const d = x - m;
      return s + d * d;
    }, 0) / (xs.length - 1);
    return Math.sqrt(variance);
  }

  function quantile_(values, q) {
    const xs = (values || []).map(finite_).filter(function (x) { return x != null; })
      .sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    if (xs.length === 1) return xs[0];
    const p = Math.max(0, Math.min(1, Number(q))) * (xs.length - 1);
    const lo = Math.floor(p);
    const hi = Math.ceil(p);
    if (lo === hi) return xs[lo];
    return xs[lo] + (xs[hi] - xs[lo]) * (p - lo);
  }

  function mulberry32_(seed) {
    let a = Number(seed) >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function validFolds_(report) {
    return ((report && report.folds) || []).filter(function (fold) {
      const metrics = fold && fold.testMetrics;
      return metrics && Number(metrics.evaluatedCount || 0) > 0;
    });
  }

  function metricFromFold_(fold, metric) {
    const metrics = fold.testMetrics || {};
    if (metric === 'precisionAt20') return finite_(metrics.precisionAt20);
    if (metric === 'dataCoverage') return finite_(metrics.dataCoverage);
    if (metric === 'averageReturnPct') return finite_(metrics.averageReturnPct);
    if (metric === 'economicObjective') return finite_(metrics.economicObjective || metrics.objective);
    return finite_(metrics[metric]);
  }

  function bootstrapMetric_(folds, metric, cfg, random) {
    const samples = [];
    const n = folds.length;
    for (let i = 0; i < Number(cfg.iterations); i++) {
      const draw = [];
      for (let j = 0; j < n; j++) {
        const fold = folds[Math.floor(random() * n)];
        const value = metricFromFold_(fold, metric);
        if (value != null) draw.push(value);
      }
      const m = mean_(draw);
      if (m != null) samples.push(m);
    }
    const alpha = 1 - Number(cfg.confidenceLevel);
    const estimate = mean_(folds.map(function (f) { return metricFromFold_(f, metric); }));
    return {
      metric: metric,
      estimate: estimate,
      lower: quantile_(samples, alpha / 2),
      upper: quantile_(samples, 1 - alpha / 2),
      bootstrapMean: mean_(samples),
      bootstrapStdDev: stdev_(samples),
      iterations: samples.length
    };
  }

  function collectWeightKeys_(folds) {
    const set = {};
    folds.forEach(function (fold) {
      Object.keys(fold.weights || {}).forEach(function (key) { set[key] = true; });
    });
    return Object.keys(set).sort();
  }

  function weightStability_(folds) {
    const keys = collectWeightKeys_(folds);
    const byComponent = {};
    keys.forEach(function (key) {
      const values = folds.map(function (fold) { return finite_(fold.weights && fold.weights[key]); })
        .filter(function (x) { return x != null; });
      byComponent[key] = {
        mean: mean_(values),
        median: quantile_(values, 0.5),
        stdev: stdev_(values),
        min: values.length ? Math.min.apply(null, values) : null,
        max: values.length ? Math.max.apply(null, values) : null,
        range: values.length ? Math.max.apply(null, values) - Math.min.apply(null, values) : null,
        zeroShare: values.length ? values.filter(function (x) { return Math.abs(x) <= 1e-12; }).length / values.length : null,
        observations: values.length
      };
    });

    const foldDistances = [];
    for (let i = 1; i < folds.length; i++) {
      let l1 = 0;
      keys.forEach(function (key) {
        const prev = finite_(folds[i - 1].weights && folds[i - 1].weights[key]) || 0;
        const next = finite_(folds[i].weights && folds[i].weights[key]) || 0;
        l1 += Math.abs(next - prev);
      });
      foldDistances.push(l1);
    }

    return {
      byComponent: byComponent,
      meanAdjacentL1Distance: mean_(foldDistances),
      maximumAdjacentL1Distance: foldDistances.length ? Math.max.apply(null, foldDistances) : 0,
      foldDistances: foldDistances
    };
  }

  function stabilityDecision_(analysis, cfg) {
    const reasons = [];
    if (analysis.foldCount < Number(cfg.minimumFolds)) {
      reasons.push('INSUFFICIENT_FOLDS');
    }

    const precision = analysis.confidenceIntervals.precisionAt20;
    const precisionWidth = precision.lower == null || precision.upper == null
      ? null : precision.upper - precision.lower;
    if (precisionWidth == null || precisionWidth > Number(cfg.maximumPrecisionCiWidth)) {
      reasons.push('PRECISION_CI_TOO_WIDE');
    }

    const ret = analysis.confidenceIntervals.averageReturnPct;
    const returnWidth = ret.lower == null || ret.upper == null ? null : ret.upper - ret.lower;
    if (returnWidth == null || returnWidth > Number(cfg.maximumReturnCiWidthPct)) {
      reasons.push('RETURN_CI_TOO_WIDE');
    }

    const weightKeys = Object.keys(analysis.weightStability.byComponent);
    const unstableWeights = weightKeys.filter(function (key) {
      return Number(analysis.weightStability.byComponent[key].stdev || 0) > Number(cfg.maximumWeightStdDev);
    });
    if (unstableWeights.length) reasons.push('WEIGHT_INSTABILITY:' + unstableWeights.join(','));

    const positiveProbability = analysis.returnPositiveProbability;
    if (positiveProbability == null || positiveProbability < Number(cfg.minimumPositiveReturnProbability)) {
      reasons.push('LOW_POSITIVE_RETURN_PROBABILITY');
    }

    return {
      eligibleForCandidate: reasons.length === 0,
      reasons: reasons,
      thresholds: {
        minimumFolds: Number(cfg.minimumFolds),
        maximumPrecisionCiWidth: Number(cfg.maximumPrecisionCiWidth),
        maximumReturnCiWidthPct: Number(cfg.maximumReturnCiWidthPct),
        maximumWeightStdDev: Number(cfg.maximumWeightStdDev),
        minimumPositiveReturnProbability: Number(cfg.minimumPositiveReturnProbability)
      }
    };
  }

  function analyze(report, options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});
    const folds = validFolds_(report);
    if (!folds.length) throw new Error('Geçerli test fold bulunamadı.');
    if (!(Number(cfg.iterations) >= 100)) throw new Error('iterations en az 100 olmalıdır.');
    if (!(Number(cfg.confidenceLevel) > 0 && Number(cfg.confidenceLevel) < 1)) {
      throw new Error('confidenceLevel 0 ile 1 arasında olmalıdır.');
    }

    const random = mulberry32_(cfg.seed);
    const confidenceIntervals = {
      precisionAt20: bootstrapMetric_(folds, 'precisionAt20', cfg, random),
      dataCoverage: bootstrapMetric_(folds, 'dataCoverage', cfg, random),
      averageReturnPct: bootstrapMetric_(folds, 'averageReturnPct', cfg, random)
    };

    const foldReturns = folds.map(function (f) { return metricFromFold_(f, 'averageReturnPct'); })
      .filter(function (x) { return x != null; });
    const analysis = {
      version: VERSION,
      horizon: report && report.horizon || null,
      foldCount: folds.length,
      confidenceLevel: Number(cfg.confidenceLevel),
      iterations: Number(cfg.iterations),
      seed: Number(cfg.seed),
      confidenceIntervals: confidenceIntervals,
      returnPositiveProbability: foldReturns.length
        ? foldReturns.filter(function (x) { return x > 0; }).length / foldReturns.length
        : null,
      negativePrecisionFoldShare: folds.filter(function (f) {
        return Number(metricFromFold_(f, 'precisionAt20') || 0) <= 0;
      }).length / folds.length,
      weightStability: weightStability_(folds)
    };
    analysis.decision = stabilityDecision_(analysis, cfg);
    return analysis;
  }

  return Object.freeze({
    version: VERSION,
    defaults: DEFAULTS,
    analyze: analyze
  });
})();

function analyzeWalkForwardStability_(report, options) {
  return BOOTSTRAP_STABILITY.analyze(report, options);
}
