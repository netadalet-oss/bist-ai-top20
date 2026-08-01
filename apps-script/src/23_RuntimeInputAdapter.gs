/*
 * Production runtime input adapter.
 *
 * Connects the canonical Veriler repository to K1-K4, K5 and runtime S.
 * It never fabricates unavailable features. Missing source fields remain null.
 */
var RUNTIME_INPUT_ADAPTER = (function () {
  'use strict';

  const VERSION = 'RUNTIME-INPUT-1.0.0';

  function finite_(value) {
    if (value === '' || value == null) return null;
    if (typeof parseLocalizedNumber_ === 'function') {
      const parsed = parseLocalizedNumber_(value);
      return parsed != null && isFinite(parsed) ? Number(parsed) : null;
    }
    const n = Number(value);
    return isFinite(n) ? n : null;
  }

  function first_(record, names) {
    for (let i = 0; i < names.length; i++) {
      if (Object.prototype.hasOwnProperty.call(record, names[i])) {
        const value = record[names[i]];
        if (value !== '' && value != null) return value;
      }
    }
    return null;
  }

  function number_(record, names) {
    return finite_(first_(record, names));
  }

  function date_(value) {
    if (value instanceof Date && isFinite(value.getTime())) return value;
    const d = value == null || value === '' ? null : new Date(value);
    return d && isFinite(d.getTime()) ? d : null;
  }

  function history_(record, depth) {
    const close = [];
    const chg = [];
    const volume = [];
    const volChg = [];
    const maxDepth = Math.max(1, Number(depth || 30));

    for (let i = 0; i <= maxDepth; i++) {
      close.push(number_(record, ['Kapanis_T' + i, 'Kapanış_T' + i]));
      chg.push(number_(record, ['FiyatDegisim%_T' + i, 'FiyatDeğişim%_T' + i]));
      volume.push(number_(record, ['Hacim_T' + i]));
      volChg.push(number_(record, ['HacimDegisim%_T' + i, 'HacimDeğişim%_T' + i]));
    }

    return { close: close, chg: chg, volume: volume, volChg: volChg };
  }

  function toFeature(record, options) {
    const opts = options || {};
    const symbol = String(first_(record, ['Hisse', 'symbol', 'sym']) || '').trim().toUpperCase();
    if (!symbol) return null;

    const featureTs = date_(first_(record, ['VeriZamani', 'Veri Zamanı', 'featureTs']));
    const feature = {
      symbol: symbol,
      sym: symbol,
      featureTs: featureTs,
      verizamani: featureTs,
      anlik: number_(record, ['Anlik', 'Anlık']),
      anlikdeg: number_(record, ['AnlikDegisim%', 'AnlıkDeğişim%']),
      anlikDegisimPct: number_(record, ['AnlikDegisim%', 'AnlıkDeğişim%']),
      kapanis_T: number_(record, ['Kapanis_T0', 'Kapanış_T0']),
      fiyatdeg_T: number_(record, ['FiyatDegisim%_T0', 'FiyatDeğişim%_T0']),
      hacimdeg_T: number_(record, ['HacimDegisim%_T0', 'HacimDeğişim%_T0']),
      hacimdeg: number_(record, ['HacimDegisim%_T0', 'HacimDeğişim%_T0']),
      ema20: number_(record, ['EMA20']),
      ema50: number_(record, ['EMA50']),
      ema200: number_(record, ['EMA200']),
      macdhist: number_(record, ['MACDHist', 'MACD_Hist']),
      rsi14: number_(record, ['RSI14']),
      momentum10: number_(record, ['Momentum10']),
      vol5: number_(record, ['Volatilite5G', 'Volatilite_5G']),
      vol21: number_(record, ['Volatilite21G', 'Volatilite_21G']),
      vol63: number_(record, ['Volatilite63G', 'Volatilite_63G']),
      volatilite21g: number_(record, ['Volatilite21G', 'Volatilite_21G']),
      bollu: number_(record, ['Boll_Ust', 'Bollinger_Ust']),
      bolla: number_(record, ['Boll_Alt', 'Bollinger_Alt']),
      deg3g_num: number_(record, ['Degisim3GunNum', 'Değişim3GünNum', 'Degisim3Gun']),
      getiri1A: number_(record, ['Getiri_TL_1A_T0', 'Getiri_TL_1A']),
      getiri3A: number_(record, ['Getiri_TL_3A_T0', 'Getiri_TL_3A']),
      getiri6A: number_(record, ['Getiri_TL_6A_T0', 'Getiri_TL_6A']),
      history: history_(record, opts.historyDepth || 30),
      raw: record
    };

    return feature;
  }

  function validateFeatureTime_(feature, predictionTs) {
    if (!feature.featureTs) return { ok: false, reason: 'MISSING_FEATURE_TS' };
    const p = date_(predictionTs);
    if (!p) throw new Error('Geçersiz predictionTs.');
    if (feature.featureTs.getTime() > p.getTime()) {
      return { ok: false, reason: 'FEATURE_TS_AFTER_PREDICTION' };
    }
    return { ok: true, reason: null };
  }

  function readFeatures(input) {
    input = input || {};
    const predictionTs = date_(input.predictionTs || new Date());
    if (!predictionTs) throw new Error('Geçersiz predictionTs.');

    const records = input.records || VERILER_REPOSITORY.readAllObjects();
    const rejected = [];
    const features = [];
    const seen = new Set();

    records.forEach(function (record) {
      const feature = toFeature(record, input.options || {});
      if (!feature) return;
      if (seen.has(feature.symbol)) {
        rejected.push({ symbol: feature.symbol, reason: 'DUPLICATE_SYMBOL' });
        return;
      }
      seen.add(feature.symbol);
      const timeCheck = validateFeatureTime_(feature, predictionTs);
      if (!timeCheck.ok) {
        rejected.push({ symbol: feature.symbol, reason: timeCheck.reason });
        return;
      }
      features.push(feature);
    });

    return { predictionTs: predictionTs, features: features, rejected: rejected };
  }

  function buildExpertResults(features) {
    const rows = features || [];
    return {
      K1: EXPERT_MODELS.K1(rows),
      K2: EXPERT_MODELS.K2(rows),
      K3: EXPERT_MODELS.K3(rows),
      K4: EXPERT_MODELS.K4(rows)
    };
  }

  function flatten_(modelResults) {
    const out = [];
    ['K1','K2','K3','K4','K5'].forEach(function (name) {
      (modelResults[name] || []).forEach(function (row) { out.push(row); });
    });
    return out;
  }

  function build(input) {
    input = input || {};
    const read = readFeatures(input);
    if (!read.features.length) {
      throw new Error('Runtime için geçerli özellik kaydı bulunamadı.');
    }

    const expert = buildExpertResults(read.features);
    const k5 = CONSENSUS_MODEL.build(expert, input.consensusOptions || {});
    const all = Object.assign({}, expert, { K5: k5 });

    return {
      adapterVersion: VERSION,
      predictionTs: read.predictionTs,
      horizon: String(input.horizon || 'COMBINED').toUpperCase(),
      sessionKind: String(input.sessionKind || input.horizon || 'COMBINED'),
      features: read.features,
      modelResultsByName: all,
      modelResults: flatten_(all),
      rejected: read.rejected,
      counts: {
        features: read.features.length,
        rejected: read.rejected.length,
        K1: expert.K1.length,
        K2: expert.K2.length,
        K3: expert.K3.length,
        K4: expert.K4.length,
        K5: k5.length
      }
    };
  }

  return Object.freeze({
    version: VERSION,
    toFeature: toFeature,
    readFeatures: readFeatures,
    buildExpertResults: buildExpertResults,
    build: build
  });
})();

function buildRuntimeInputs_(input) {
  return RUNTIME_INPUT_ADAPTER.build(input || {});
}

function runEndToEndSSelection_(input) {
  input = input || {};
  const runtime = RUNTIME_INPUT_ADAPTER.build(input);
  const selected = buildRuntimeSSelection_({
    predictionTs: runtime.predictionTs,
    horizon: runtime.horizon,
    sessionKind: runtime.sessionKind,
    modelResults: runtime.modelResults,
    features: runtime.features,
    options: input.selectionOptions || {},
    bindingOptions: input.bindingOptions || {}
  });
  return { runtime: runtime, selected: selected };
}

function saveEndToEndSSelectionSnapshot_(input) {
  input = input || {};
  const runtime = RUNTIME_INPUT_ADAPTER.build(input);
  return saveRuntimeSSelectionSnapshot_({
    predictionTs: runtime.predictionTs,
    featureTs: input.featureTs || runtime.predictionTs,
    horizon: runtime.horizon,
    sessionKind: runtime.sessionKind,
    modelResults: runtime.modelResults,
    features: runtime.features,
    options: input.selectionOptions || {},
    bindingOptions: input.bindingOptions || {}
  });
}
