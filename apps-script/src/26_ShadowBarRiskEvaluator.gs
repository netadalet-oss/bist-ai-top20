/*
 * Recomputes shadow experiment return, MFE and MAE from raw market bars using
 * each arm row's immutable entry price. No metric is copied from another arm.
 */
var SHADOW_BAR_RISK_EVALUATOR = (function () {
  'use strict';

  function finite_(v) {
    const n = Number(v);
    return v != null && isFinite(n) ? n : null;
  }

  function time_(v) {
    const d = v instanceof Date ? v : new Date(v);
    const t = d.getTime();
    return isFinite(t) ? t : null;
  }

  function normalizeBars_(bars) {
    return (bars || []).map(function (b) {
      return {
        symbol: String((b && (b.symbol || b.sym)) || '').trim().toUpperCase(),
        ts: time_(b && (b.ts || b.time || b.date)),
        high: finite_(b && (b.high != null ? b.high : b.price)),
        low: finite_(b && (b.low != null ? b.low : b.price)),
        close: finite_(b && (b.close != null ? b.close : b.price))
      };
    }).filter(function (b) {
      return b.symbol && b.ts != null && (b.high != null || b.low != null || b.close != null);
    }).sort(function (a, b) { return a.ts - b.ts; });
  }

  function indexBars_(bars) {
    const bySymbol = new Map();
    normalizeBars_(bars).forEach(function (b) {
      if (!bySymbol.has(b.symbol)) bySymbol.set(b.symbol, []);
      bySymbol.get(b.symbol).push(b);
    });
    return bySymbol;
  }

  function evaluateArmRow_(arm, bars, evaluationTs) {
    const symbol = String((arm && (arm.symbol || arm.sym)) || '').trim().toUpperCase();
    const entryPrice = finite_(arm && arm.entryPrice);
    const predictionTs = time_(arm && arm.predictionTs);
    const endTs = time_(evaluationTs);

    if (!symbol) throw new Error('Shadow arm symbol zorunludur.');
    if (!(entryPrice > 0)) throw new Error('Geçerli shadow arm entryPrice zorunludur: ' + symbol);
    if (predictionTs == null || endTs == null || endTs <= predictionTs) {
      throw new Error('Geçerli prediction/evaluation zaman aralığı zorunludur: ' + symbol);
    }

    const usable = (bars || []).filter(function (b) {
      return b.ts > predictionTs && b.ts <= endTs;
    });

    if (!usable.length) {
      return {
        experimentId: arm.experimentId || null,
        arm: arm.arm || null,
        symbol: symbol,
        entryPrice: entryPrice,
        dataAvailable: false,
        barCount: 0,
        targetPrice: null,
        returnPct: null,
        maxFavorablePct: null,
        maxAdversePct: null,
        maxHigh: null,
        minLow: null
      };
    }

    const highs = usable.map(function (b) { return b.high != null ? b.high : b.close; }).filter(function (v) { return v != null; });
    const lows = usable.map(function (b) { return b.low != null ? b.low : b.close; }).filter(function (v) { return v != null; });
    const closes = usable.map(function (b) { return b.close; }).filter(function (v) { return v != null; });
    const maxHigh = highs.length ? Math.max.apply(null, highs) : null;
    const minLow = lows.length ? Math.min.apply(null, lows) : null;
    const targetPrice = closes.length ? closes[closes.length - 1] : null;

    return {
      experimentId: arm.experimentId || null,
      arm: arm.arm || null,
      symbol: symbol,
      entryPrice: entryPrice,
      dataAvailable: targetPrice != null,
      barCount: usable.length,
      targetPrice: targetPrice,
      returnPct: targetPrice == null ? null : (targetPrice / entryPrice - 1) * 100,
      maxFavorablePct: maxHigh == null ? null : (maxHigh / entryPrice - 1) * 100,
      maxAdversePct: minLow == null ? null : (minLow / entryPrice - 1) * 100,
      maxHigh: maxHigh,
      minLow: minLow
    };
  }

  function evaluate_(input) {
    const args = input || {};
    const index = indexBars_(args.marketBars || []);
    const evaluationTs = args.evaluationTs;
    const seen = new Set();

    return (args.armRows || []).map(function (arm) {
      const symbol = String((arm && (arm.symbol || arm.sym)) || '').trim().toUpperCase();
      const armName = String((arm && arm.arm) || '').trim().toUpperCase();
      const key = String(arm && arm.experimentId || '') + '|' + armName + '|' + symbol;
      if (seen.has(key)) throw new Error('Mükerrer shadow arm satırı: ' + key);
      seen.add(key);
      return evaluateArmRow_(arm, index.get(symbol) || [], evaluationTs);
    });
  }

  function summarize_(rows) {
    const groups = {};
    (rows || []).forEach(function (r) {
      const arm = String(r.arm || 'UNKNOWN');
      if (!groups[arm]) groups[arm] = [];
      groups[arm].push(r);
    });
    const out = {};
    Object.keys(groups).forEach(function (arm) {
      const xs = groups[arm];
      const available = xs.filter(function (x) { return x.dataAvailable; });
      function avg(field) {
        const values = available.map(function (x) { return finite_(x[field]); }).filter(function (v) { return v != null; });
        return values.length ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : null;
      }
      out[arm] = {
        predictionCount: xs.length,
        evaluatedCount: available.length,
        dataCoverage: xs.length ? available.length / xs.length : 0,
        averageReturnPct: avg('returnPct'),
        averageMfePct: avg('maxFavorablePct'),
        averageMaePct: avg('maxAdversePct')
      };
    });
    return out;
  }

  return Object.freeze({
    evaluate: evaluate_,
    summarize: summarize_
  });
})();

function evaluateShadowExperimentFromBars_(input) {
  const rows = SHADOW_BAR_RISK_EVALUATOR.evaluate(input);
  return { rows: rows, arms: SHADOW_BAR_RISK_EVALUATOR.summarize(rows) };
}
