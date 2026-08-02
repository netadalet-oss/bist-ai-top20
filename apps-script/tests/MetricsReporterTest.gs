function runMetricsReporterTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error('MetricsReporterTest: ' + message);
  }

  const snapshotRows = [
    { snapshotId:'S1', symbol:'AAA', model:'K5', sessionKind:'EARLY', rank:1 },
    { snapshotId:'S1', symbol:'BBB', model:'K5', sessionKind:'EARLY', rank:2 },
    { snapshotId:'S1', symbol:'CCC', model:'K5', sessionKind:'EARLY', rank:3 },
    { snapshotId:'S2', symbol:'AAA', model:'K5', sessionKind:'CLOSE', rank:1 },
    { snapshotId:'S2', symbol:'DDD', model:'K5', sessionKind:'CLOSE', rank:2 }
  ];

  const outcomes = [
    { snapshotId:'S1', symbol:'AAA', horizon:'SAME_DAY_CLOSE', top20Hit:1, targetPrice:110, returnPct:10, maxFavorablePct:12, maxAdversePct:-2, dataAvailable:true },
    { snapshotId:'S1', symbol:'BBB', horizon:'SAME_DAY_CLOSE', top20Hit:0, targetPrice:98, returnPct:-2, maxFavorablePct:1, maxAdversePct:-5, dataAvailable:true },
    { snapshotId:'S1', symbol:'CCC', horizon:'SAME_DAY_CLOSE', top20Hit:1, targetPrice:105, returnPct:5, maxFavorablePct:7, maxAdversePct:-1, dataAvailable:true },
    { snapshotId:'S2', symbol:'AAA', horizon:'SAME_DAY_CLOSE', top20Hit:0, targetPrice:101, returnPct:1, maxFavorablePct:3, maxAdversePct:-2, dataAvailable:true },
    { snapshotId:'S2', symbol:'DDD', horizon:'SAME_DAY_CLOSE', top20Hit:1, targetPrice:108, returnPct:8, maxFavorablePct:9, maxAdversePct:-1, dataAvailable:true }
  ];

  const s1 = METRICS_REPORTER.snapshotSummary({
    snapshotRows: snapshotRows.filter(function (r) { return r.snapshotId === 'S1'; }),
    outcomes: outcomes,
    horizon: 'SAME_DAY_CLOSE',
    realTop20Count: 20
  });

  assert_(s1.predictionCount === 3, 'predictionCount');
  assert_(s1.evaluatedCount === 3, 'evaluatedCount');
  assert_(s1.hitCount === 2, 'hitCount');
  assert_(Math.abs(s1.precisionAt20 - 2/3) < 1e-12, 'precisionAt20');
  assert_(Math.abs(s1.recallAt20 - 0.1) < 1e-12, 'recallAt20');
  assert_(Math.abs(s1.averageReturnPct - 13/3) < 1e-12, 'averageReturnPct');
  assert_(s1.medianReturnPct === 5, 'medianReturnPct');
  assert_(s1.averageHitReturnPct === 7.5, 'averageHitReturnPct');
  assert_(s1.dataCoverage === 1, 'dataCoverage');

  const agg = METRICS_REPORTER.aggregateSnapshots({
    snapshotRows: snapshotRows,
    outcomes: outcomes,
    horizon: 'SAME_DAY_CLOSE',
    realTop20Count: 20
  });
  assert_(agg.snapshotCount === 2, 'snapshotCount');
  assert_(agg.hitCount === 3, 'aggregate hit count');
  assert_(agg.evaluatedCount === 5, 'aggregate evaluated count');

  const bySymbol = METRICS_REPORTER.bySymbol({
    snapshotRows: snapshotRows,
    outcomes: outcomes,
    horizon: 'SAME_DAY_CLOSE'
  });
  const aaa = bySymbol.filter(function (x) { return x.key === 'AAA'; })[0];
  assert_(aaa.evaluatedCount === 2, 'AAA sample count');
  assert_(aaa.hitCount === 1, 'AAA hit count');
  assert_(aaa.precision === 0.5, 'AAA precision');
  assert_(aaa.averageReturnPct === 5.5, 'AAA average return');

  let duplicateRejected = false;
  try {
    METRICS_REPORTER.snapshotSummary({
      snapshotRows: [snapshotRows[0]],
      outcomes: [outcomes[0], outcomes[0]],
      horizon: 'SAME_DAY_CLOSE'
    });
  } catch (_) {
    duplicateRejected = true;
  }
  assert_(duplicateRejected, 'duplicate outcome must be rejected');

  Logger.log('MetricsReporter tests passed.');
  return true;
}
