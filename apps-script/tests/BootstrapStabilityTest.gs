function runBootstrapStabilityTests_() {
  var folds = [];
  for (var i = 0; i < 8; i++) {
    folds.push({
      fold: i + 1,
      weights: {
        consensus: 0.35,
        shortMomentum: 0.25,
        liveStrength: 0.20,
        volumeAcceleration: 0.10,
        technicalStructure: 0.10
      },
      testMetrics: {
        evaluatedCount: 20,
        precisionAt20: 0.40 + i * 0.01,
        dataCoverage: 0.90,
        averageReturnPct: 2.0 + i * 0.1
      }
    });
  }

  var report = { horizon: 'SAME_DAY', folds: folds };
  var result1 = analyzeWalkForwardStability_(report, { iterations: 300, seed: 123 });
  var result2 = analyzeWalkForwardStability_(report, { iterations: 300, seed: 123 });

  bootstrapAssert_(result1.foldCount === 8, 'fold count');
  bootstrapAssert_(result1.confidenceIntervals.precisionAt20.lower != null, 'precision lower');
  bootstrapAssert_(result1.confidenceIntervals.precisionAt20.upper >= result1.confidenceIntervals.precisionAt20.lower, 'precision interval');
  bootstrapAssert_(result1.returnPositiveProbability === 1, 'positive return probability');
  bootstrapAssert_(result1.decision.eligibleForCandidate === true, 'candidate decision');
  bootstrapAssert_(JSON.stringify(result1.confidenceIntervals) === JSON.stringify(result2.confidenceIntervals), 'deterministic seed');

  Logger.log('BootstrapStabilityTest: OK');
  return { ok: true, result: result1 };
}

function bootstrapAssert_(condition, label) {
  if (!condition) throw new Error('BootstrapStabilityTest failed: ' + label);
}
