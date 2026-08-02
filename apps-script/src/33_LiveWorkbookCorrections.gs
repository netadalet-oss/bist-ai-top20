/*
 * Corrections derived from the live V_141225 workbook audit.
 * Scope is limited to the original objective: reliable Veriler -> K -> S flow
 * and truthful Reel TopN measurement.
 */
var LIVE_WORKBOOK_CORRECTIONS = (function () {
  'use strict';

  const VERSION = 'LIVE-CORRECTIONS-1.0.0';
  const FORMAT_CHARS = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;

  function finite_(value) {
    if (value === '' || value == null) return null;
    if (typeof parseLocalizedNumber_ === 'function') {
      const parsed = parseLocalizedNumber_(value);
      if (parsed != null && isFinite(parsed)) return Number(parsed);
    }
    const n = Number(String(value).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function normalizeHeader(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .replace(FORMAT_CHARS, '')
      .replace(/[\r\n\t]+/g, '_')
      .replace(/\s+/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function normalizeRecord(record) {
    const out = {};
    Object.keys(record || {}).forEach(function (key) {
      const normalized = normalizeHeader(key);
      if (!normalized) return;
      if (!Object.prototype.hasOwnProperty.call(out, normalized) || out[normalized] === '' || out[normalized] == null) {
        out[normalized] = record[key];
      }
    });
    return out;
  }

  function parseLevels(value) {
    if (Array.isArray(value)) return value.map(finite_).filter(function (v) { return v != null; });
    return String(value == null ? '' : value)
      .split(/[|;,]/)
      .map(function (x) { return finite_(x.trim()); })
      .filter(function (v) { return v != null; });
  }

  function supportResistance(price, supports, resistances) {
    const p = finite_(price);
    if (!(p > 0)) return { support: null, resistance: null, supportGapPct: null, resistanceGapPct: null };
    const ss = parseLevels(supports).filter(function (x) { return x > 0 && x <= p; });
    const rs = parseLevels(resistances).filter(function (x) { return x > 0 && x >= p; });
    const support = ss.length ? Math.max.apply(null, ss) : null;
    const resistance = rs.length ? Math.min.apply(null, rs) : null;
    return {
      support: support,
      resistance: resistance,
      supportGapPct: support == null ? null : ((p / support) - 1) * 100,
      resistanceGapPct: resistance == null ? null : ((resistance / p) - 1) * 100
    };
  }

  function enrichFeature(feature, record) {
    const f = Object.assign({}, feature || {});
    const r = normalizeRecord(record || f.raw || {});
    const price = finite_(f.anlik != null ? f.anlik : (f.kapanis_T != null ? f.kapanis_T : f.close));
    const supports = r['Destekler(3)_T0'] != null ? r['Destekler(3)_T0'] : r['Destekler(3)'];
    const resistances = r['Direncler(3)_T0'] != null ? r['Direncler(3)_T0'] : r['Direncler(3)'];
    const sr = supportResistance(price, supports, resistances);
    f.support = sr.support;
    f.resistance = sr.resistance;
    f.supportGapPct = sr.supportGapPct;
    f.resistanceGapPct = sr.resistanceGapPct;
    f.raw = r;
    return f;
  }

  function validConsensusRows(rows, minModels) {
    const required = Math.max(2, Number(minModels || 2));
    return (rows || []).filter(function (row) {
      const count = Number(row && row.raw && row.raw.modelCount != null
        ? row.raw.modelCount
        : row && row.modelCount);
      return isFinite(count) && count >= required;
    }).map(function (row) {
      const out = Object.assign({}, row);
      const scores = out.raw && out.raw.scores ? out.raw.scores : {};
      out.scoreListJson = JSON.stringify(scores);
      return out;
    });
  }

  function effectiveTopN(realRows, requestedTopN) {
    const validCount = (realRows || []).filter(function (row) {
      if (typeof row === 'string') return String(row).trim() !== '';
      return row && String(row.symbol || row.sym || '').trim() !== '';
    }).length;
    return Math.min(Math.max(0, Number(requestedTopN || 20)), validCount);
  }

  function topNMetrics(hitCount, predictionCount, realRows, requestedTopN) {
    const hits = Math.max(0, Number(hitCount || 0));
    const predicted = Math.max(0, Number(predictionCount || 0));
    const denominator = effectiveTopN(realRows, requestedTopN);
    return {
      effectiveTopN: denominator,
      precision: predicted ? hits / predicted : null,
      recall: denominator ? hits / denominator : null,
      completeUniverse: denominator === Number(requestedTopN || 20)
    };
  }

  return Object.freeze({
    version: VERSION,
    normalizeHeader: normalizeHeader,
    normalizeRecord: normalizeRecord,
    parseLevels: parseLevels,
    supportResistance: supportResistance,
    enrichFeature: enrichFeature,
    validConsensusRows: validConsensusRows,
    effectiveTopN: effectiveTopN,
    topNMetrics: topNMetrics
  });
})();

/* Runtime integration: normalize live headers before the existing adapter reads them. */
if (typeof RUNTIME_INPUT_ADAPTER !== 'undefined' && RUNTIME_INPUT_ADAPTER) {
  var RUNTIME_INPUT_ADAPTER_BASE_ = RUNTIME_INPUT_ADAPTER;
  RUNTIME_INPUT_ADAPTER = Object.freeze({
    version: RUNTIME_INPUT_ADAPTER_BASE_.version + '+' + LIVE_WORKBOOK_CORRECTIONS.version,
    toFeature: function (record, options) {
      const normalized = LIVE_WORKBOOK_CORRECTIONS.normalizeRecord(record || {});
      const feature = RUNTIME_INPUT_ADAPTER_BASE_.toFeature(normalized, options || {});
      return feature ? LIVE_WORKBOOK_CORRECTIONS.enrichFeature(feature, normalized) : null;
    },
    readFeatures: function (input) {
      input = Object.assign({}, input || {});
      if (input.records) input.records = input.records.map(LIVE_WORKBOOK_CORRECTIONS.normalizeRecord);
      const base = RUNTIME_INPUT_ADAPTER_BASE_.readFeatures(input);
      base.features = (base.features || []).map(function (feature) {
        return LIVE_WORKBOOK_CORRECTIONS.enrichFeature(feature, feature.raw || {});
      });
      return base;
    },
    buildExpertResults: RUNTIME_INPUT_ADAPTER_BASE_.buildExpertResults,
    build: function (input) {
      input = Object.assign({}, input || {});
      if (input.records) input.records = input.records.map(LIVE_WORKBOOK_CORRECTIONS.normalizeRecord);
      const built = RUNTIME_INPUT_ADAPTER_BASE_.build(input);
      built.features = (built.features || []).map(function (feature) {
        return LIVE_WORKBOOK_CORRECTIONS.enrichFeature(feature, feature.raw || {});
      });
      if (built.modelResultsByName && built.modelResultsByName.K5) {
        built.modelResultsByName.K5 = LIVE_WORKBOOK_CORRECTIONS.validConsensusRows(
          built.modelResultsByName.K5,
          input.consensusOptions && input.consensusOptions.minModels
        );
        built.modelResults = [];
        ['K1','K2','K3','K4','K5'].forEach(function (name) {
          (built.modelResultsByName[name] || []).forEach(function (row) { built.modelResults.push(row); });
        });
        built.counts.K5 = built.modelResultsByName.K5.length;
      }
      return built;
    }
  });
}

function auditAndCorrectLiveRecord_(record) {
  const normalized = LIVE_WORKBOOK_CORRECTIONS.normalizeRecord(record || {});
  const feature = RUNTIME_INPUT_ADAPTER.toFeature(normalized, {});
  return { normalized: normalized, feature: feature };
}
