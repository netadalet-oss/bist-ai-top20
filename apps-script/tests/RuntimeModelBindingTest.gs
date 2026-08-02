function runRuntimeModelBindingTests_() {
  const originalRegistry = typeof MODEL_REGISTRY === 'undefined' ? null : MODEL_REGISTRY;
  const originalEngine = typeof S_SELECTION_ENGINE === 'undefined' ? null : S_SELECTION_ENGINE;
  try {
    MODEL_REGISTRY = {
      getActive: function (horizon) {
        if (horizon === 'SAME_DAY') {
          return {
            registryId: 'R1', horizon: horizon, version: 'SAME_DAY-0007',
            weights: {
              consensus: 0.40, shortMomentum: 0.20, liveStrength: 0.20,
              volumeAcceleration: 0.10, technicalStructure: 0.10
            },
            metrics: { precisionAt20: 0.35 }, sourceHash: 'abc', activatedTs: '2026-01-01T00:00:00Z'
          };
        }
        return null;
      }
    };

    S_SELECTION_ENGINE = {
      defaults: {
        sameDayWeights: {
          consensus: 0.35, shortMomentum: 0.25, liveStrength: 0.20,
          volumeAcceleration: 0.10, technicalStructure: 0.10
        },
        nextDayWeights: {
          consensus: 0.35, trendStructure: 0.25, recoveryPattern: 0.15,
          mediumMomentum: 0.15, riskQuality: 0.10
        }
      },
      select: function (input) {
        assertRuntime_(input.options.sameDayWeights.consensus === 0.40, 'Aktif SAME_DAY ağırlığı uygulanmadı.');
        assertRuntime_(input.options.nextDayWeights.consensus === 0.35, 'NEXT_DAY varsayılan ağırlığı uygulanmadı.');
        return [{
          symbol: 'TEST', featureTs: '2026-01-02T09:55:00Z', entryPrice: 10,
          sameDayScore: 80, nextDayScore: 70, combinedScore: 75, score: 75,
          sourceModels: ['K1','K2','K5'], raw: { modelCount: 3 }, coverage: 0.8
        }];
      }
    };

    const resolved = RUNTIME_MODEL_BINDING.resolve({ strict: false });
    assertRuntime_(resolved.sameDay.source === 'REGISTRY', 'SAME_DAY registry kaynağı okunmadı.');
    assertRuntime_(resolved.sameDay.version === 'SAME_DAY-0007', 'SAME_DAY sürümü yanlış.');
    assertRuntime_(resolved.nextDay.source === 'DEFAULT', 'NEXT_DAY fallback uygulanmadı.');

    const selected = RUNTIME_MODEL_BINDING.select({ horizon: 'COMBINED' });
    assertRuntime_(selected.results.length === 1, 'Runtime seçim sonucu eksik.');
    assertRuntime_(selected.results[0].sameDayModelVersion === 'SAME_DAY-0007', 'Snapshot model sürümü taşınmadı.');
    assertRuntime_(selected.results[0].nextDayModelVersion === 'NEXT_DAY-DEFAULT', 'Fallback sürümü taşınmadı.');
    assertRuntime_(selected.results[0].modelSources.sameDay.sourceHash === 'abc', 'Registry hash taşınmadı.');

    let strictFailed = false;
    try {
      RUNTIME_MODEL_BINDING.resolve({ strict: true });
    } catch (_) {
      strictFailed = true;
    }
    assertRuntime_(strictFailed, 'Strict mod eksik aktif modeli reddetmedi.');

    Logger.log('RuntimeModelBindingTest: OK');
    return true;
  } finally {
    if (originalRegistry !== null) MODEL_REGISTRY = originalRegistry;
    if (originalEngine !== null) S_SELECTION_ENGINE = originalEngine;
  }
}

function assertRuntime_(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}
