function runShadowExperimentTests_() {
  const features = [
    { sym: 'AAA', anlik: 10, featureTs: new Date('2026-08-01T07:00:00Z') },
    { sym: 'BBB', anlik: 20, featureTs: new Date('2026-08-01T07:00:00Z') },
    { sym: 'CCC', anlik: 30, featureTs: new Date('2026-08-01T07:00:00Z') }
  ];
  const created = SHADOW_EXPERIMENT.create({
    experimentId: 'TEST-SHADOW-' + Utilities.getUuid(),
    predictionTs: new Date('2026-08-01T07:05:00Z'),
    sessionKind: 'SAME_DAY_EARLY',
    horizon: 'SAME_DAY',
    features: features,
    legacyRows: [
      { symbol: 'AAA', rank: 1, entryPrice: 10 },
      { symbol: 'BBB', rank: 2, entryPrice: 20 }
    ],
    newRows: [
      { symbol: 'BBB', rank: 1, entryPrice: 20, score: 90 },
      { symbol: 'CCC', rank: 2, entryPrice: 30, score: 80 }
    ]
  });
  if (created.overlapCount !== 1) throw new Error('Örtüşme sayısı hatalı.');

  const evaluated = SHADOW_EXPERIMENT.evaluate({
    experimentId: created.experimentId,
    outcomes: [
      { symbol: 'AAA', dataAvailable: true, top20Hit: false, targetPrice: 11, maxFavorablePct: 12, maxAdversePct: -2 },
      { symbol: 'BBB', dataAvailable: true, top20Hit: true, targetPrice: 22, maxFavorablePct: 15, maxAdversePct: -1 },
      { symbol: 'CCC', dataAvailable: true, top20Hit: true, targetPrice: 33, maxFavorablePct: 14, maxAdversePct: -3 }
    ]
  });
  if (evaluated.legacy.hitCount !== 1) throw new Error('Legacy hitCount hatalı.');
  if (evaluated.modern.hitCount !== 2) throw new Error('New hitCount hatalı.');
  if (!(evaluated.delta.precisionAt20 > 0)) throw new Error('Precision farkı pozitif olmalı.');
  Logger.log(JSON.stringify(evaluated, null, 2));
  return evaluated;
}
