function runSSelectionEngineTests_() {
  const modelResults = [
    {model:'K1',symbol:'AAAA',score:82,coverage:0.9,eligible:true},
    {model:'K2',symbol:'AAAA',score:78,coverage:0.9,eligible:true},
    {model:'K3',symbol:'AAAA',score:74,coverage:0.8,eligible:true},
    {model:'K4',symbol:'AAAA',score:70,coverage:0.8,eligible:true},
    {model:'K5',symbol:'AAAA',score:84,coverage:0.85,eligible:true},
    {model:'K1',symbol:'BBBB',score:90,coverage:0.9,eligible:true},
    {model:'K2',symbol:'BBBB',score:55,coverage:0.9,eligible:true},
    {model:'K5',symbol:'BBBB',score:68,coverage:0.9,eligible:true},
    {model:'K1',symbol:'CCCC',score:99,coverage:0.95,eligible:true}
  ];

  const features = [
    {symbol:'AAAA',anlik:100,anlikDegisimPct:3,hacimDegisimPctT0:25,momentum10:4,rsi14:58,volatilite21g:3,featureTs:'2026-08-01T08:30:00.000Z'},
    {symbol:'BBBB',anlik:50,anlikDegisimPct:7,hacimDegisimPctT0:40,momentum10:2,rsi14:67,volatilite21g:8,featureTs:'2026-08-01T08:30:00.000Z'},
    {symbol:'CCCC',anlik:20,anlikDegisimPct:9,hacimDegisimPctT0:80,momentum10:8,rsi14:72,volatilite21g:10,featureTs:'2026-08-01T08:30:00.000Z'}
  ];

  const same = S_SELECTION_ENGINE.select({
    modelResults:modelResults,
    features:features,
    horizon:'SAME_DAY',
    options:{topN:20,minCoverage:0.60,minConsensusModels:2}
  });
  const next = S_SELECTION_ENGINE.select({
    modelResults:modelResults,
    features:features,
    horizon:'NEXT_DAY',
    options:{topN:20,minCoverage:0.60,minConsensusModels:2}
  });

  assertS_(same.length === 2, 'Tek model destekli CCCC dışlanmalı.');
  assertS_(same[0].rank === 1 && same[1].rank === 2, 'Sıralar kesintisiz olmalı.');
  assertS_(same.every(function(r){return r.entryPrice > 0;}), 'Giriş fiyatı zorunlu.');
  assertS_(same.every(function(r){return r.sameDayScore != null && r.nextDayScore != null;}), 'İki ufuk skoru da üretilmeli.');
  assertS_(same.every(function(r){return r.sourceModels.indexOf('K5') >= 0;}), 'K5 kaynağı korunmalı.');
  assertS_(next[0].horizon === 'NEXT_DAY', 'Ufuk etiketi doğru olmalı.');
  assertS_(same[0].score === same[0].sameDayScore, 'Aynı gün seçimi doğru skor alanını kullanmalı.');
  assertS_(next[0].score === next[0].nextDayScore, 'Ertesi gün seçimi doğru skor alanını kullanmalı.');

  const strict = S_SELECTION_ENGINE.select({
    modelResults:modelResults,
    features:features,
    horizon:'COMBINED',
    options:{topN:20,minCoverage:0.60,minConsensusModels:4}
  });
  assertS_(strict.length === 1 && strict[0].symbol === 'AAAA', 'Dört model zorunluluğu uygulanmalı.');

  Logger.log('SSelectionEngine tests passed: ' + JSON.stringify({same:same,next:next,strict:strict}));
  return true;
}

function assertS_(condition, message) {
  if (!condition) throw new Error('S_SELECTION_ENGINE TEST FAILED: ' + message);
}
