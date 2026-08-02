function runExecutionCostModelTests_() {
  const cost = EXECUTION_COST_MODEL.apply({
    entryPrice: 100,
    exitPrice: 104,
    dailyTurnoverTry: 20000000,
    orderValueTry: 200000,
    spreadBps: 8
  }, {
    commissionBpsPerSide: 5,
    baseSlippageBpsPerSide: 2,
    impactCoefficientBps: 20,
    maxParticipationRate: 0.10,
    minimumDailyTurnoverTry: 5000000
  });

  if (Math.abs(cost.grossReturnPct - 4) > 1e-9) throw new Error('Brüt getiri hatalı.');
  if (!(cost.netReturnPct < cost.grossReturnPct)) throw new Error('Net getiri maliyet sonrası düşmelidir.');
  if (!cost.eligible) throw new Error('Likidite koşulu yanlış reddedildi.');

  const illiquid = EXECUTION_COST_MODEL.apply({
    grossReturnPct: 5,
    dailyTurnoverTry: 1000000
  }, {
    minimumDailyTurnoverTry: 5000000,
    rejectIlliquid: true
  });
  if (illiquid.eligible) throw new Error('Likiditesi yetersiz kayıt uygun olmamalıdır.');

  const economic = ECONOMIC_CALIBRATION.evaluate({
    horizon: 'SAME_DAY',
    weights: {
      consensus: 1,
      shortMomentum: 0,
      liveStrength: 0,
      volumeAcceleration: 0,
      technicalStructure: 0
    },
    examples: [
      {
        snapshotId: 'S1', predictionTs: new Date('2026-01-05T08:00:00Z'),
        symbol: 'AAA', components: { consensus: 90 }, top20Hit: true,
        dataAvailable: true, returnPct: 3, dailyTurnoverTry: 20000000
      },
      {
        snapshotId: 'S1', predictionTs: new Date('2026-01-05T08:00:00Z'),
        symbol: 'BBB', components: { consensus: 80 }, top20Hit: false,
        dataAvailable: true, returnPct: 1, dailyTurnoverTry: 1000000
      }
    ],
    options: { topN: 20 }
  });

  if (economic.gross.evaluatedCount !== 2) throw new Error('Brüt değerlendirme sayısı hatalı.');
  if (economic.economic.liquidCount !== 1) throw new Error('Likidite filtresi hatalı.');
  if (economic.economic.precisionAt20 !== 1) throw new Error('Ekonomik precision hatalı.');

  Logger.log('ExecutionCostModel tests passed.');
  return true;
}
