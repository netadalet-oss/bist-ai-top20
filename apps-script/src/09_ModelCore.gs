/*
 * Shared expert-model core for K1-K4.
 *
 * Design rules:
 * - every model consumes the same canonical feature objects
 * - every model returns the same result contract
 * - missing components are not silently treated as zero
 * - tie breakers may order equal scores but may not materially change scores
 */
var MODEL_CORE = (function () {
  'use strict';

  function finite_(value) {
    return value != null && Number.isFinite(Number(value));
  }

  function quantile_(values, q) {
    const xs = (values || []).filter(finite_).map(Number).sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    const p = (xs.length - 1) * q;
    const i = Math.floor(p);
    const f = p - i;
    return i + 1 < xs.length ? xs[i] * (1 - f) + xs[i + 1] * f : xs[i];
  }

  function normalize(values, options) {
    options = options || {};
    const invert = !!options.invert;
    const low = options.low == null ? 0.05 : Number(options.low);
    const high = options.high == null ? 0.95 : Number(options.high);
    const xs = (values || []).map(function (v) { return finite_(v) ? Number(v) : null; });
    const lo = quantile_(xs, low);
    const hi = quantile_(xs, high);
    if (lo == null || hi == null) return xs.map(function () { return null; });
    if (Math.abs(hi - lo) < 1e-12) {
      return xs.map(function (v) { return v == null ? null : 0.5; });
    }
    return xs.map(function (v) {
      if (v == null) return null;
      let t = (v - lo) / (hi - lo);
      t = Math.max(0, Math.min(1, t));
      return invert ? 1 - t : t;
    });
  }

  function weightedValue(components, weights, minCoverage) {
    let sum = 0;
    let usedWeight = 0;
    let totalWeight = 0;
    Object.keys(weights || {}).forEach(function (key) {
      const weight = Number(weights[key] || 0);
      if (!(weight > 0)) return;
      totalWeight += weight;
      const value = components ? components[key] : null;
      if (!finite_(value)) return;
      sum += Number(value) * weight;
      usedWeight += weight;
    });
    if (!(usedWeight > 0) || !(totalWeight > 0)) return null;
    const coverage = usedWeight / totalWeight;
    if (coverage < (minCoverage == null ? 0.6 : Number(minCoverage))) return null;
    return { value: sum / usedWeight, coverage: coverage };
  }

  function rankResults(results, tieFields) {
    const fields = tieFields || [];
    return (results || []).slice().sort(function (a, b) {
      const scoreA = finite_(a.score) ? Number(a.score) : -Infinity;
      const scoreB = finite_(b.score) ? Number(b.score) : -Infinity;
      if (Math.abs(scoreB - scoreA) > 1e-9) return scoreB - scoreA;
      for (let i = 0; i < fields.length; i++) {
        const av = a.tieBreak && finite_(a.tieBreak[fields[i]]) ? Number(a.tieBreak[fields[i]]) : -Infinity;
        const bv = b.tieBreak && finite_(b.tieBreak[fields[i]]) ? Number(b.tieBreak[fields[i]]) : -Infinity;
        if (Math.abs(bv - av) > 1e-12) return bv - av;
      }
      return String(a.symbol || '').localeCompare(String(b.symbol || ''));
    }).map(function (item, index) {
      item.rank = index + 1;
      return item;
    });
  }

  function result(model, row, scoreInfo, raw, normalized, tieBreak, reason) {
    return {
      model: model,
      modelVersion: '2.0.0',
      symbol: row.sym || row.Hisse || row.symbol,
      featureTs: row.verizamani || row.VeriZamani || null,
      score: scoreInfo == null ? null : Number((scoreInfo.value * 100).toFixed(6)),
      coverage: scoreInfo == null ? 0 : scoreInfo.coverage,
      eligible: scoreInfo != null,
      raw: raw || {},
      normalized: normalized || {},
      tieBreak: tieBreak || {},
      reason: reason || '',
      source: row
    };
  }

  return Object.freeze({
    normalize: normalize,
    weightedValue: weightedValue,
    rankResults: rankResults,
    result: result,
    finite: finite_
  });
})();
