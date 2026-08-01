/*
 * K5 consensus model built directly from standard K1-K4 model results.
 *
 * It does not read K sheets and does not inherit market fields from whichever
 * sheet happens to be visited first. Canonical market fields should be joined
 * later from the common feature record by symbol.
 */
var CONSENSUS_MODEL = (function () {
  'use strict';

  const MODEL_NAMES = Object.freeze(['K1', 'K2', 'K3', 'K4']);
  const VERSION = 'K5-consensus-v1';

  function finite_(v) {
    return v != null && isFinite(Number(v)) ? Number(v) : null;
  }

  function mean_(values) {
    const xs = values.map(finite_).filter(v => v != null);
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  function min_(values) {
    const xs = values.map(finite_).filter(v => v != null);
    return xs.length ? Math.min.apply(null, xs) : null;
  }

  function stdev_(values) {
    const xs = values.map(finite_).filter(v => v != null);
    if (xs.length < 2) return 0;
    const m = mean_(xs);
    const variance = xs.reduce((s, x) => s + Math.pow(x - m, 2), 0) / xs.length;
    return Math.sqrt(variance);
  }

  function rankPercentile_(result, listLength) {
    if (!result || !result.rank || !listLength) return null;
    if (listLength <= 1) return 1;
    return 1 - ((Number(result.rank) - 1) / (listLength - 1));
  }

  function collect_(modelResults) {
    const bySymbol = new Map();
    MODEL_NAMES.forEach(model => {
      const list = Array.isArray(modelResults && modelResults[model])
        ? modelResults[model]
        : [];
      list.forEach(result => {
        if (!result || result.eligible === false || !result.symbol) return;
        const score = finite_(result.score);
        if (score == null) return;
        const symbol = String(result.symbol).trim().toUpperCase();
        if (!symbol) return;
        if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
        bySymbol.get(symbol).push({
          model: model,
          score: score,
          coverage: finite_(result.coverage),
          rank: finite_(result.rank),
          rankPercentile: rankPercentile_(result, list.length),
          featureTs: result.featureTs || null,
          modelVersion: result.modelVersion || null
        });
      });
    });
    return bySymbol;
  }

  function scoreEntry_(symbol, entries, options) {
    const opts = options || {};
    const minModels = Number(opts.minModels == null ? 2 : opts.minModels);
    const modelCount = entries.length;
    const coverage = modelCount / MODEL_NAMES.length;
    const scores = entries.map(x => x.score);
    const avgScore = mean_(scores);
    const minScore = min_(scores);
    const avgRankPct = mean_(entries.map(x => x.rankPercentile));
    const avgInputCoverage = mean_(entries.map(x => x.coverage));
    const disagreement = stdev_(scores) / 100;
    const consistency = Math.max(0, 1 - disagreement);

    const components = [
      { value: avgScore == null ? null : avgScore / 100, weight: 0.35 },
      { value: coverage, weight: 0.30 },
      { value: minScore == null ? null : minScore / 100, weight: 0.20 },
      { value: avgRankPct, weight: 0.10 },
      { value: consistency, weight: 0.05 }
    ];

    let weighted = 0;
    let usedWeight = 0;
    components.forEach(c => {
      if (c.value == null || !isFinite(c.value)) return;
      weighted += c.value * c.weight;
      usedWeight += c.weight;
    });

    const consensusScore = usedWeight ? (weighted / usedWeight) * 100 : null;
    const featureTimes = entries.map(x => x.featureTs).filter(Boolean).map(x => new Date(x).getTime()).filter(isFinite);
    const featureTs = featureTimes.length ? new Date(Math.max.apply(null, featureTimes)) : null;

    return {
      model: 'K5',
      modelVersion: VERSION,
      symbol: symbol,
      featureTs: featureTs,
      score: consensusScore,
      coverage: coverage,
      eligible: modelCount >= minModels && consensusScore != null,
      rank: null,
      raw: {
        modelCount: modelCount,
        models: entries.map(x => x.model),
        scores: entries.reduce((o, x) => { o[x.model] = x.score; return o; }, {}),
        modelVersions: entries.reduce((o, x) => { o[x.model] = x.modelVersion; return o; }, {})
      },
      normalized: {
        averageScore: avgScore == null ? null : avgScore / 100,
        modelCoverage: coverage,
        minimumScore: minScore == null ? null : minScore / 100,
        averageRankPercentile: avgRankPct,
        consistency: consistency,
        averageInputCoverage: avgInputCoverage
      },
      tieBreak: [coverage, avgRankPct, minScore == null ? null : minScore / 100, avgScore == null ? null : avgScore / 100],
      reason: 'K1-K4 model coverage, score strength and rank consistency consensus',
      source: 'standard-model-results'
    };
  }

  function compare_(a, b) {
    const sa = finite_(a.score);
    const sb = finite_(b.score);
    if (sa !== sb) return (sb == null ? -1 : sb) - (sa == null ? -1 : sa);
    const ta = a.tieBreak || [];
    const tb = b.tieBreak || [];
    for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
      const av = finite_(ta[i]);
      const bv = finite_(tb[i]);
      if (av !== bv) return (bv == null ? -1 : bv) - (av == null ? -1 : av);
    }
    return String(a.symbol).localeCompare(String(b.symbol));
  }

  function build(modelResults, options) {
    const grouped = collect_(modelResults || {});
    const out = [];
    grouped.forEach((entries, symbol) => {
      const row = scoreEntry_(symbol, entries, options);
      if (row.eligible) out.push(row);
    });
    out.sort(compare_);
    out.forEach((row, index) => { row.rank = index + 1; });
    const topN = Number(options && options.topN || 20);
    return out.slice(0, topN);
  }

  return Object.freeze({
    VERSION: VERSION,
    MODELS: MODEL_NAMES,
    build: build
  });
})();

function buildK5V2_(modelResults, options) {
  return CONSENSUS_MODEL.build(modelResults, options);
}
