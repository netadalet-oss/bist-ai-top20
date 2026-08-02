/*
 * Runtime binding between MODEL_REGISTRY and S_SELECTION_ENGINE.
 *
 * Rules:
 * - SAME_DAY and NEXT_DAY active models are loaded independently.
 * - Missing active models fall back to documented defaults unless strict mode is enabled.
 * - The exact registry version/hash used at prediction time is attached to every result.
 * - Registry weights never mutate S_SELECTION_ENGINE defaults.
 */
var RUNTIME_MODEL_BINDING = (function () {
  'use strict';

  const VERSION = 'RUNTIME-BINDING-1.0.0';

  function clone_(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finite_(value) {
    const n = Number(value);
    return isFinite(n) ? n : null;
  }

  function normalizeWeights_(weights, expectedKeys) {
    const out = {};
    let sum = 0;
    expectedKeys.forEach(function (key) {
      const n = finite_(weights && weights[key]);
      out[key] = n != null && n >= 0 ? n : 0;
      sum += out[key];
    });
    if (sum <= 0) throw new Error('Aktif model ağırlıkları pozitif toplam üretmiyor.');
    expectedKeys.forEach(function (key) { out[key] = out[key] / sum; });
    return out;
  }

  function componentKeys_(horizon) {
    const h = String(horizon || '').toUpperCase();
    if (typeof WALK_FORWARD_CALIBRATION !== 'undefined' && WALK_FORWARD_CALIBRATION.components) {
      const keys = WALK_FORWARD_CALIBRATION.components[h];
      if (keys && keys.length) return keys.slice();
    }
    if (h === 'SAME_DAY') {
      return ['consensus','shortMomentum','liveStrength','volumeAcceleration','technicalStructure'];
    }
    if (h === 'NEXT_DAY') {
      return ['consensus','trendStructure','recoveryPattern','mediumMomentum','riskQuality'];
    }
    throw new Error('Desteklenmeyen horizon: ' + horizon);
  }

  function defaultWeights_(horizon) {
    const h = String(horizon || '').toUpperCase();
    if (typeof S_SELECTION_ENGINE === 'undefined') {
      throw new Error('S_SELECTION_ENGINE yüklenmemiş.');
    }
    if (h === 'SAME_DAY') return clone_(S_SELECTION_ENGINE.defaults.sameDayWeights);
    if (h === 'NEXT_DAY') return clone_(S_SELECTION_ENGINE.defaults.nextDayWeights);
    throw new Error('Desteklenmeyen horizon: ' + horizon);
  }

  function resolveOne_(horizon, options) {
    const h = String(horizon || '').toUpperCase();
    const cfg = options || {};
    const active = typeof MODEL_REGISTRY !== 'undefined' && MODEL_REGISTRY.getActive
      ? MODEL_REGISTRY.getActive(h)
      : null;

    if (!active) {
      if (cfg.strict === true) {
        throw new Error('Aktif model bulunamadı: ' + h);
      }
      return {
        horizon: h,
        source: 'DEFAULT',
        version: h + '-DEFAULT',
        registryId: null,
        sourceHash: null,
        activatedTs: null,
        weights: normalizeWeights_(defaultWeights_(h), componentKeys_(h)),
        metrics: {},
        trainingStart: null,
        trainingEnd: null
      };
    }

    return {
      horizon: h,
      source: 'REGISTRY',
      version: String(active.version),
      registryId: active.registryId || null,
      sourceHash: active.sourceHash || null,
      activatedTs: active.activatedTs || null,
      weights: normalizeWeights_(active.weights || {}, componentKeys_(h)),
      metrics: active.metrics || {},
      trainingStart: active.trainingStart || null,
      trainingEnd: active.trainingEnd || null
    };
  }

  function resolve(options) {
    const cfg = options || {};
    return {
      bindingVersion: VERSION,
      sameDay: resolveOne_('SAME_DAY', cfg),
      nextDay: resolveOne_('NEXT_DAY', cfg),
      resolvedTs: new Date().toISOString()
    };
  }

  function buildSelectionOptions_(binding, overrides) {
    const extra = overrides || {};
    return Object.assign({}, extra, {
      sameDayWeights: clone_(binding.sameDay.weights),
      nextDayWeights: clone_(binding.nextDay.weights)
    });
  }

  function decorate_(results, binding) {
    return (results || []).map(function (row) {
      const out = Object.assign({}, row);
      out.runtimeBindingVersion = VERSION;
      out.sameDayModelVersion = binding.sameDay.version;
      out.nextDayModelVersion = binding.nextDay.version;
      out.sameDayModelSource = binding.sameDay.source;
      out.nextDayModelSource = binding.nextDay.source;
      out.modelSources = {
        sameDay: {
          source: binding.sameDay.source,
          version: binding.sameDay.version,
          registryId: binding.sameDay.registryId,
          sourceHash: binding.sameDay.sourceHash,
          activatedTs: binding.sameDay.activatedTs
        },
        nextDay: {
          source: binding.nextDay.source,
          version: binding.nextDay.version,
          registryId: binding.nextDay.registryId,
          sourceHash: binding.nextDay.sourceHash,
          activatedTs: binding.nextDay.activatedTs
        }
      };
      out.modelVersion = [
        'S',
        binding.sameDay.version,
        binding.nextDay.version,
        VERSION
      ].join('|');
      return out;
    });
  }

  function select(input) {
    input = input || {};
    if (typeof S_SELECTION_ENGINE === 'undefined') {
      throw new Error('S_SELECTION_ENGINE yüklenmemiş.');
    }
    const binding = resolve(input.bindingOptions || {});
    const selectionInput = Object.assign({}, input, {
      options: buildSelectionOptions_(binding, input.options || {})
    });
    delete selectionInput.bindingOptions;
    const results = S_SELECTION_ENGINE.select(selectionInput);
    return {
      binding: binding,
      results: decorate_(results, binding)
    };
  }

  function saveSnapshot(input) {
    input = input || {};
    if (typeof SNAPSHOT_STORE === 'undefined') {
      throw new Error('SNAPSHOT_STORE yüklenmemiş.');
    }
    const selected = select(input);
    if (!selected.results.length) {
      throw new Error('Runtime S snapshot için uygun aday bulunamadı.');
    }
    const featureTimes = selected.results.map(function (r) { return r.featureTs; }).filter(Boolean).sort();
    const predictionTs = input.predictionTs || new Date();
    const featureTs = input.featureTs || (featureTimes.length ? featureTimes[featureTimes.length - 1] : predictionTs);
    const saved = SNAPSHOT_STORE.appendPredictionBatch({
      snapshotType: 'S',
      predictionTs: predictionTs,
      featureTs: featureTs,
      sessionKind: input.sessionKind || String(input.horizon || 'COMBINED').toUpperCase(),
      model: 'S',
      modelVersion: selected.results[0].modelVersion,
      results: selected.results
    });
    return {
      snapshot: saved,
      binding: selected.binding,
      results: selected.results
    };
  }

  function audit(options) {
    const binding = resolve(options || {});
    return {
      bindingVersion: VERSION,
      sameDay: binding.sameDay,
      nextDay: binding.nextDay,
      defaultsUsed: [binding.sameDay, binding.nextDay].filter(function (x) {
        return x.source === 'DEFAULT';
      }).map(function (x) { return x.horizon; })
    };
  }

  return Object.freeze({
    version: VERSION,
    resolve: resolve,
    select: select,
    saveSnapshot: saveSnapshot,
    audit: audit
  });
})();

function buildRuntimeSSelection_(input) {
  return RUNTIME_MODEL_BINDING.select(input);
}

function saveRuntimeSSelectionSnapshot_(input) {
  return RUNTIME_MODEL_BINDING.saveSnapshot(input);
}

function auditRuntimeModelBinding_(options) {
  return RUNTIME_MODEL_BINDING.audit(options);
}
