function runOutcomeEvaluatorTests_() {
  const predictionTs = new Date('2026-07-22T07:00:00Z');
  const rows = [
    { symbol:'AAAA', predictionTs:predictionTs, entryPrice:100 },
    { symbol:'BBBB', predictionTs:predictionTs, entryPrice:50 }
  ];

  const bars = [];
  for (let i=0; i<25; i++) {
    const sym = i === 0 ? 'AAAA' : (i === 24 ? 'BBBB' : ('X' + String(i).padStart(3,'0')));
    bars.push({
      symbol:sym,
      ts:new Date('2026-07-22T15:00:00Z'),
      close:i === 0 ? 110 : (i === 24 ? 51 : 100 + i),
      high:i === 0 ? 112 : null,
      low:i === 0 ? 98 : null,
      sessionReturnPct:25 - i,
      quality:'VALID'
    });
    bars.push({
      symbol:sym,
      ts:new Date('2026-07-23T15:00:00Z'),
      close:i === 24 ? 60 : (i === 0 ? 108 : 100 + i),
      high:i === 24 ? 62 : null,
      low:i === 24 ? 49 : null,
      sessionReturnPct:i,
      quality:'VALID'
    });
  }

  const result = OUTCOME_EVALUATOR.evaluateSnapshot({
    snapshotRows:rows,
    marketBars:bars,
    options:{ timeZone:'Europe/Istanbul', holidays:[] }
  });

  assertOutcome_(result.sameDay === '2026-07-22', 'same day yanlış');
  assertOutcome_(result.nextTradingDay === '2026-07-23', 'next trading day yanlış');
  assertOutcome_(result.outcomes.length === 4, 'iki hisse x iki ufuk beklenir');

  const aSame = result.outcomes.find(function (o) { return o.symbol === 'AAAA' && o.horizon === 'SAME_DAY_CLOSE'; });
  const bSame = result.outcomes.find(function (o) { return o.symbol === 'BBBB' && o.horizon === 'SAME_DAY_CLOSE'; });
  const bNext = result.outcomes.find(function (o) { return o.symbol === 'BBBB' && o.horizon === 'NEXT_TRADING_DAY_CLOSE'; });

  assertOutcome_(aSame.top20Hit === true && aSame.top20Rank === 1, 'AAAA aynı gün Top20 olmalı');
  assertOutcome_(Math.abs(aSame.returnPct - 10) < 1e-9, 'AAAA giriş getirisi yanlış');
  assertOutcome_(Math.abs(aSame.maxFavorablePct - 12) < 1e-9, 'AAAA MFE yanlış');
  assertOutcome_(Math.abs(aSame.maxAdversePct - (-2)) < 1e-9, 'AAAA MAE yanlış');
  assertOutcome_(bSame.top20Hit === false, 'BBBB aynı gün Top20 olmamalı');
  assertOutcome_(bNext.top20Hit === true, 'BBBB ertesi gün Top20 olmalı');
  assertOutcome_(Math.abs(bNext.returnPct - 20) < 1e-9, 'BBBB ertesi gün getirisi yanlış');

  const friday = OUTCOME_EVALUATOR.nextTradingDay('2026-07-24T12:00:00Z', {timeZone:'Europe/Istanbul'});
  assertOutcome_(friday === '2026-07-27', 'hafta sonu atlanmalı');

  const holiday = OUTCOME_EVALUATOR.nextTradingDay('2026-07-27T12:00:00Z', {
    timeZone:'Europe/Istanbul', holidays:['2026-07-28']
  });
  assertOutcome_(holiday === '2026-07-29', 'tatil günü atlanmalı');

  const filtered = OUTCOME_EVALUATOR.buildTop20([
    {symbol:'BAD', sessionReturnPct:999, excluded:true},
    {symbol:'GOOD', sessionReturnPct:1, excluded:false}
  ]);
  assertOutcome_(filtered.length === 1 && filtered[0].symbol === 'GOOD', 'kalite dışlanan veri Top20ye girmemeli');

  return { ok:true, outcomeCount:result.outcomes.length };
}

function assertOutcome_(condition, message) {
  if (!condition) throw new Error('OutcomeEvaluatorTest: ' + message);
}
