/*
 * Horizon-aware S selection engine.
 *
 * Replaces fixed K1-K5 seat allocation with one candidate pool scored for:
 *   - SAME_DAY
 *   - NEXT_DAY
 *   - COMBINED
 *
 * The engine is intentionally calibration-ready. Default weights are explicit
 * starting assumptions, not claims of learned optimality.
 */
var S_SELECTION_ENGINE = (function () {
  'use strict';

  const VERSION = 'S-SELECT-1.0.0';
  const HORIZONS = Object.freeze({
    SAME_DAY: 'SAME_DAY',
    NEXT_DAY: 'NEXT_DAY',
    COMBINED: 'COMBINED'
  });

  const DEFAULTS = Object.freeze({
    topN: 20,
    minCoverage: 0.60,
    minConsensusModels: 2,
    sameDayWeights: Object.freeze({
      consensus: 0.35,
      shortMomentum: 0.25,
      liveStrength: 0.20,
      volumeAcceleration: 0.10,
      technicalStructure: 0.10
    }),
    nextDayWeights: Object.freeze({
      consensus: 0.35,
      trendStructure: 0.25,
      recoveryPattern: 0.15,
      mediumMomentum: 0.15,
      riskQuality: 0.10
    }),
    combinedWeights: Object.freeze({
      sameDay: 0.50,
      nextDay: 0.50
    })
  });

  function finite_(v) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function clamp_(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function normalize01_(v) {
    const n = finite_(v);
    return n == null ? null : clamp_(n, 0, 100) / 100;
  }

  function weightedAvailable_(parts, weights) {
    let weighted = 0;
    let used = 0;
    Object.keys(weights).forEach(function (key) {
      const value = finite_(parts[key]);
      const weight = finite_(weights[key]);
      if (value == null || weight == null || weight <= 0) return;
      weighted += value * weight;
      used += weight;
    });
    return used > 0 ? weighted / used : null;
  }

  function modelMap_(modelResults) {
    const out = new Map();
    (modelResults || []).forEach(function (r) {
      if (!r || r.eligible === false) return;
      const symbol = String(r.symbol || r.sym || '').trim().toUpperCase();
      const model = String(r.model || '').trim().toUpperCase();
      if (!symbol || !model) return;
      if (!out.has(symbol)) out.set(symbol, {});
      out.get(symbol)[model] = r;
    });
    return out;
  }

  function featureMap_(features) {
    const out = new Map();
    (features || []).forEach(function (f) {
      const symbol = String((f && (f.symbol || f.sym)) || '').trim().toUpperCase();
      if (symbol) out.set(symbol, f);
    });
    return out;
  }

  function kScore_(models, name) {
    const r = models && models[name];
    return r ? finite_(r.score) : null;
  }

  function coverage_(models) {
    const names = ['K1','K2','K3','K4'];
    const present = names.filter(function (name) {
      return models && models[name] && models[name].eligible !== false;
    });
    const inputCoverage = present.map(function (name) {
      return finite_(models[name].coverage);
    }).filter(function (v) { return v != null; });
    const avgInput = inputCoverage.length
      ? inputCoverage.reduce(function (a, b) { return a + b; }, 0) / inputCoverage.length
      : 0;
    return {
      modelCount: present.length,
      modelCoverage: present.length / names.length,
      averageInputCoverage: avgInput
    };
  }

  function safeScore100_(v) {
    const n = finite_(v);
    return n == null ? null : clamp_(n, 0, 100);
  }

  function buildComponents_(models, feature) {
    const k1 = kScore_(models, 'K1');
    const k2 = kScore_(models, 'K2');
    const k3 = kScore_(models, 'K3');
    const k4 = kScore_(models, 'K4');
    const k5 = kScore_(models, 'K5');

    const liveChange = finite_(feature && (feature.anlikDegisimPct != null
      ? feature.anlikDegisimPct : feature.anlikdeg));
    const volumeChange = finite_(feature && (feature.hacimDegisimPctT0 != null
      ? feature.hacimDegisimPctT0 : feature.hacimdeg_T));
    const momentum10 = finite_(feature && feature.momentum10);
    const rsi14 = finite_(feature && feature.rsi14);
    const volatility21 = finite_(feature && feature.volatilite21g);

    const liveStrength = liveChange == null ? null : clamp_(50 + liveChange * 5, 0, 100);
    const volumeAcceleration = volumeChange == null ? null : clamp_(50 + volumeChange, 0, 100);
    const mediumMomentum = momentum10 == null ? null : clamp_(50 + momentum10 * 5, 0, 100);
    const riskQuality = volatility21 == null ? null : clamp_(100 - volatility21 * 5, 0, 100);
    const technicalStructure = weightedAvailable_({ k2: k2, rsi: rsi14 }, { k2: 0.75, rsi: 0.25 });

    return {
      consensus: safeScore100_(k5 != null ? k5 : weightedAvailable_({k1:k1,k2:k2,k3:k3,k4:k4},{k1:1,k2:1,k3:1,k4:1})),
      shortMomentum: safeScore100_(k1),
      liveStrength: safeScore100_(liveStrength),
      volumeAcceleration: safeScore100_(volumeAcceleration),
      technicalStructure: safeScore100_(technicalStructure),
      trendStructure: safeScore100_(k2),
      recoveryPattern: safeScore100_(k3),
      mediumMomentum: safeScore100_(mediumMomentum != null ? mediumMomentum : k4),
      riskQuality: safeScore100_(riskQuality),
      longStrength: safeScore100_(k4)
    };
  }

  function scoreCandidate_(symbol, models, feature, options) {
    const cfg = options || DEFAULTS;
    const cov = coverage_(models);
    const c = buildComponents_(models, feature || {});

    const sameDayScore = weightedAvailable_(c, cfg.sameDayWeights || DEFAULTS.sameDayWeights);
    const nextDayScore = weightedAvailable_(c, cfg.nextDayWeights || DEFAULTS.nextDayWeights);
    const combinedScore = weightedAvailable_(
      { sameDay: sameDayScore, nextDay: nextDayScore },
      cfg.combinedWeights || DEFAULTS.combinedWeights
    );

    const entryPrice = finite_(feature && (
      feature.anlik != null ? feature.anlik :
      feature.kapanis_T != null ? feature.kapanis_T : feature.close
    ));
    const featureTs = feature && (feature.featureTs || feature.veriZamani || feature.verizamani) || null;

    const eligible =
      cov.modelCount >= Number(cfg.minConsensusModels == null ? DEFAULTS.minConsensusModels : cfg.minConsensusModels) &&
      cov.averageInputCoverage >= Number(cfg.minCoverage == null ? DEFAULTS.minCoverage : cfg.minCoverage) &&
      sameDayScore != null && nextDayScore != null && entryPrice != null && entryPrice > 0;

    return {
      model: 'S',
      modelVersion: VERSION,
      symbol: symbol,
      featureTs: featureTs,
      score: combinedScore,
      sameDayScore: sameDayScore,
      nextDayScore: nextDayScore,
      combinedScore: combinedScore,
      coverage: cov.averageInputCoverage,
      eligible: eligible,
      entryPrice: entryPrice,
      sourceModels: Object.keys(models || {}).sort(),
      raw: {
        modelCount: cov.modelCount,
        modelCoverage: cov.modelCoverage,
        components: c
      },
      normalized: {
        sameDayScore: sameDayScore,
        nextDayScore: nextDayScore,
        combinedScore: combinedScore
      },
      reason: eligible ? null : 'MINIMUM_DATA_OR_CONSENSUS_NOT_MET'
    };
  }

  function select(input) {
    input = input || {};
    const cfg = Object.assign({}, DEFAULTS, input.options || {});
    const modelsBySymbol = modelMap_(input.modelResults || []);
    const featuresBySymbol = featureMap_(input.features || []);
    const symbols = Array.from(new Set(
      Array.from(modelsBySymbol.keys()).concat(Array.from(featuresBySymbol.keys()))
    )).sort();

    const candidates = symbols.map(function (symbol) {
      return scoreCandidate_(symbol, modelsBySymbol.get(symbol) || {}, featuresBySymbol.get(symbol) || {}, cfg);
    }).filter(function (r) { return r.eligible; });

    const horizon = String(input.horizon || HORIZONS.COMBINED).toUpperCase();
    const field = horizon === HORIZONS.SAME_DAY ? 'sameDayScore'
      : horizon === HORIZONS.NEXT_DAY ? 'nextDayScore' : 'combinedScore';

    candidates.sort(function (a, b) {
      const d = Number(b[field]) - Number(a[field]);
      if (d) return d;
      const coverageDiff = Number(b.coverage) - Number(a.coverage);
      if (coverageDiff) return coverageDiff;
      const modelDiff = Number(b.raw.modelCount) - Number(a.raw.modelCount);
      if (modelDiff) return modelDiff;
      return a.symbol.localeCompare(b.symbol);
    });

    const topN = Math.max(1, Number(cfg.topN || DEFAULTS.topN));
    return candidates.slice(0, topN).map(function (r, i) {
      r.rank = i + 1;
      r.score = r[field];
      r.horizon = horizon;
      return r;
    });
  }

  return Object.freeze({
    select: select,
    scoreCandidate: scoreCandidate_,
    horizons: HORIZONS,
    version: VERSION,
    defaults: DEFAULTS
  });
})();

function buildSSelection_(input) {
  return S_SELECTION_ENGINE.select(input);
}

function saveSSelectionSnapshot_(input) {
  input = input || {};
  const results = S_SELECTION_ENGINE.select(input);
  if (!results.length) throw new Error('S snapshot için uygun aday bulunamadı.');
  const featureTimes = results.map(function (r) { return r.featureTs; }).filter(Boolean);
  const featureTs = input.featureTs || (featureTimes.length ? featureTimes.sort().slice(-1)[0] : input.predictionTs || new Date());
  return SNAPSHOT_STORE.appendPredictionBatch({
    snapshotType: 'S',
    predictionTs: input.predictionTs || new Date(),
    featureTs: featureTs,
    sessionKind: input.sessionKind || results[0].horizon,
    model: 'S',
    modelVersion: S_SELECTION_ENGINE.version,
    results: results
  });
}
