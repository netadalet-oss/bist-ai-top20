function runShadowBarRiskEvaluatorTests_() {
  const predictionTs = new Date('2026-08-03T07:05:00Z');
  const evaluationTs = new Date('2026-08-03T14:00:00Z');
  const arms = [
    { experimentId:'E1', arm:'LEGACY', symbol:'AAA', entryPrice:100, predictionTs:predictionTs },
    { experimentId:'E1', arm:'NEW', symbol:'AAA', entryPrice:102, predictionTs:predictionTs }
  ];
  const bars = [
    { symbol:'AAA', ts:new Date('2026-08-03T07:00:00Z'), high:120, low:80, close:100 },
    { symbol:'AAA', ts:new Date('2026-08-03T08:00:00Z'), high:106, low:98, close:104 },
    { symbol:'AAA', ts:new Date('2026-08-03T10:00:00Z'), high:110, low:101, close:108 }
  ];
  const report = evaluateShadowExperimentFromBars_({ armRows:arms, marketBars:bars, evaluationTs:evaluationTs });
  if (report.rows.length !== 2) throw new Error('İki kol satırı bekleniyordu.');
  const legacy = report.rows.filter(function(x){return x.arm==='LEGACY';})[0];
  const newer = report.rows.filter(function(x){return x.arm==='NEW';})[0];
  if (Math.abs(legacy.returnPct - 8) > 1e-9) throw new Error('Legacy getiri hatalı.');
  if (Math.abs(legacy.maxFavorablePct - 10) > 1e-9) throw new Error('Legacy MFE hatalı.');
  if (Math.abs(legacy.maxAdversePct - (-2)) > 1e-9) throw new Error('Legacy MAE hatalı.');
  if (Math.abs(newer.returnPct - ((108/102-1)*100)) > 1e-9) throw new Error('New getiri kendi giriş fiyatından hesaplanmadı.');
  if (legacy.maxFavorablePct === newer.maxFavorablePct) throw new Error('Farklı giriş fiyatlarında MFE aynı olmamalı.');
  if (report.arms.LEGACY.evaluatedCount !== 1 || report.arms.NEW.evaluatedCount !== 1) throw new Error('Kol özetleri hatalı.');
  Logger.log('ShadowBarRiskEvaluator tests passed.');
  return true;
}
