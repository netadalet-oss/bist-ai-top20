function runWalkForwardCalibrationTests_() {
  const rows = [];
  const start = new Date('2026-01-01T07:00:00Z');

  for (let d = 0; d < 35; d++) {
    const ts = new Date(start.getTime() + d * 86400000).toISOString();
    const snapshotId = 'SNAP-' + d;
    for (let i = 0; i < 30; i++) {
      const strong = i < 8;
      rows.push({
        snapshotId: snapshotId,
        predictionTs: ts,
        symbol: 'T' + ('000' + i).slice(-3),
        components: {
          consensus: strong ? 90 : 30,
          shortMomentum: strong ? 85 : 35,
          liveStrength: strong ? 80 : 40,
          volumeAcceleration: strong ? 75 : 45,
          technicalStructure: strong ? 70 : 50,
          trendStructure: strong ? 88 : 32,
          recoveryPattern: strong ? 82 : 38,
          mediumMomentum: strong ? 78 : 42,
          riskQuality: strong ? 72 : 48
        },
        top20Hit: strong,
        targetPrice: 10,
        dataAvailable: true,
        returnPct: strong ? 4 : -1
      });
    }
  }

  const grid = WALK_FORWARD_CALIBRATION.generateWeightGrid('SAME_DAY', 0.5);
  if (!grid.length) throw new Error('Ağırlık ızgarası üretilmedi.');
  grid.forEach(function (w) {
    const sum = Object.keys(w).reduce(function (s, k) { return s + w[k]; }, 0);
    if (Math.abs(sum - 1) > 1e-9) throw new Error('Ağırlık toplamı 1 değil.');
  });

  const result = WALK_FORWARD_CALIBRATION.walkForward({
    horizon: 'SAME_DAY',
    examples: rows,
    options: {
      gridStep: 0.5,
      minTrainDates: 20,
      testDates: 5,
      stepDates: 5,
      minEvaluatedPerFold: 20,
      topN: 20
    }
  });

  if (result.folds.length !== 3) {
    throw new Error('Beklenen fold sayısı 3, oluşan: ' + result.folds.length);
  }

  result.folds.forEach(function (fold) {
    if (!(fold.trainEnd < fold.testStart)) {
      throw new Error('Veri sızıntısı: eğitim dönemi test döneminden önce bitmiyor.');
    }
    if (fold.testMetrics.precisionAt20 < 0.35) {
      throw new Error('Sentetik veri üzerinde beklenmeyen düşük precision.');
    }
  });

  const prepared = WALK_FORWARD_CALIBRATION.prepareExamples(rows, 'SAME_DAY');
  const firstTestDate = result.folds[0].testStart;
  const futureInTrain = prepared.some(function (e) {
    return e.date >= firstTestDate && e.date <= result.folds[0].trainEnd;
  });
  if (futureInTrain) throw new Error('Test tarihleri eğitim kümesine sızdı.');

  return {
    ok: true,
    foldCount: result.folds.length,
    aggregate: result.aggregate,
    gridSize: result.gridSize
  };
}
