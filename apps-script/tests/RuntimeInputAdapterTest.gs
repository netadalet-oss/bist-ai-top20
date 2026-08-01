function assertRuntimeInput_(condition, message) {
  if (!condition) throw new Error('RuntimeInputAdapterTest: ' + message);
}

function runRuntimeInputAdapterTests_() {
  const now = new Date('2026-08-01T10:05:00+03:00');
  const row = {
    Hisse: 'AAA',
    VeriZamani: new Date('2026-08-01T10:04:00+03:00'),
    Anlik: 110,
    'AnlikDegisim%': 5,
    Kapanis_T0: 105,
    'FiyatDegisim%_T0': 4,
    'HacimDegisim%_T0': 30,
    EMA20: 104,
    EMA50: 100,
    EMA200: 90,
    MACDHist: 1.2,
    RSI14: 58,
    Momentum10: 3,
    Volatilite5G: 2,
    Volatilite21G: 3,
    Volatilite63G: 4,
    Boll_Ust: 115,
    Boll_Alt: 95,
    Degisim3GunNum: 4,
    Getiri_TL_1A_T0: 10,
    Getiri_TL_3A_T0: 15,
    Getiri_TL_6A_T0: 20
  };

  for (let i = 0; i <= 30; i++) {
    row['Kapanis_T' + i] = 110 - i * 0.3;
    row['FiyatDegisim%_T' + i] = i === 0 ? 4 : 0.5;
    row['HacimDegisim%_T' + i] = i === 2 ? 20 : 1;
  }

  const feature = RUNTIME_INPUT_ADAPTER.toFeature(row, { historyDepth: 30 });
  assertRuntimeInput_(feature.symbol === 'AAA', 'sembol eşlemesi');
  assertRuntimeInput_(feature.ema200 === 90, 'EMA200 eşlemesi');
  assertRuntimeInput_(feature.history.close.length === 31, 'tarihsel dizi uzunluğu');

  const prepared = RUNTIME_INPUT_ADAPTER.readFeatures({
    predictionTs: now,
    records: [row]
  });
  assertRuntimeInput_(prepared.features.length === 1, 'geçerli kayıt kabulü');

  const future = Object.assign({}, row, {
    Hisse: 'BBB',
    VeriZamani: new Date('2026-08-01T10:06:00+03:00')
  });
  const checked = RUNTIME_INPUT_ADAPTER.readFeatures({
    predictionTs: now,
    records: [row, future]
  });
  assertRuntimeInput_(checked.features.length === 1, 'gelecek özellik reddi');
  assertRuntimeInput_(checked.rejected[0].reason === 'FEATURE_TS_AFTER_PREDICTION', 'gelecek özellik neden kodu');

  const modelResults = RUNTIME_INPUT_ADAPTER.buildExpertResults([feature]);
  assertRuntimeInput_(Array.isArray(modelResults.K1), 'K1 sonuç sözleşmesi');
  assertRuntimeInput_(Array.isArray(modelResults.K4), 'K4 sonuç sözleşmesi');

  Logger.log('RuntimeInputAdapter tests passed.');
  return true;
}
