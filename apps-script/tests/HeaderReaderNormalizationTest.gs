function runHeaderReaderNormalizationTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  function near_(actual, expected, epsilon, message) {
    const tolerance = epsilon == null ? 1e-9 : epsilon;
    assert_(actual != null && Math.abs(actual - expected) <= tolerance,
      (message || 'Values differ') + ': actual=' + actual + ', expected=' + expected);
  }

  const contaminatedHisse = 'H\u2060i\u2060s\u2060s\u2060e';
  assert_(AURUM_normalizeHeader_(contaminatedHisse) === 'Hisse',
    'Contract header normalization must remove U+2060.');

  const contaminated = {};
  contaminated[contaminatedHisse] = 'ACSEL';
  contaminated['V\u2060e\u2060r\u2060i\u2060Z\u2060a\u2060m\u2060a\u2060n\u2060i'] = new Date('2026-07-21T10:15:00+03:00');
  contaminated['A\u2060n\u2060l\u2060i\u2060k'] = 133.9;
  contaminated['E\u2060M\u2060A\u20602\u20600\u2060_\u2060T\u20600'] = 135.2;
  contaminated['EMA50_T0'] = 137.23;
  contaminated['EMA200_T0'] = 123.21;
  contaminated['MACDHist_T0'] = -0.154;
  contaminated['RSI14_T0'] = 46.55;
  contaminated['Momentum10_T0'] = -5.1;
  contaminated['Volatilite5G_T0'] = 1.84;
  contaminated['Volatilite21G_T0'] = 2.23;
  contaminated['Volatilite63G_T0'] = 4.17;
  contaminated['Boll_Alt_T0'] = 124.53;
  contaminated['Boll_Ust_T0'] = 145.51;
  contaminated['Degisim3Gun(%)_T0'] = '3.56 | 1.17 | -1.92';
  contaminated['Kapanis_T0'] = 133.9;
  contaminated['FiyatDegisim%_T0'] = 3.56;
  contaminated['HacimDegisim%_T0'] = 375.25;

  const feature = RUNTIME_INPUT_ADAPTER.toFeature(contaminated, { historyDepth: 1 });
  assert_(feature && feature.symbol === 'ACSEL', 'Contaminated symbol header must be read.');
  near_(feature.ema20, 135.2, 1e-9, 'EMA20_T0 must map to ema20');
  near_(feature.ema50, 137.23, 1e-9, 'EMA50_T0 must map to ema50');
  near_(feature.ema200, 123.21, 1e-9, 'EMA200_T0 must map to ema200');
  near_(feature.macdhist, -0.154, 1e-9, 'MACDHist_T0 must map to macdhist');
  near_(feature.rsi14, 46.55, 1e-9, 'RSI14_T0 must map to rsi14');
  near_(feature.momentum10, -5.1, 1e-9, 'Momentum10_T0 must map to momentum10');
  near_(feature.vol5, 1.84, 1e-9, 'Volatilite5G_T0 must map to vol5');
  near_(feature.vol21, 2.23, 1e-9, 'Volatilite21G_T0 must map to vol21');
  near_(feature.vol63, 4.17, 1e-9, 'Volatilite63G_T0 must map to vol63');
  near_(feature.bolla, 124.53, 1e-9, 'Boll_Alt_T0 must map to bolla');
  near_(feature.bollu, 145.51, 1e-9, 'Boll_Ust_T0 must map to bollu');
  near_(feature.deg3g_num, 3.56, 1e-9, 'Three-day series must use its first current value');

  const normalized = RUNTIME_INPUT_ADAPTER.normalizeRecordKeys({
    'H\u2060i\u2060s\u2060s\u2060e': 'THYAO',
    'EMA20_T0': 10
  });
  assert_(normalized.Hisse === 'THYAO', 'Runtime key normalization must expose Hisse.');

  Logger.log('HeaderReaderNormalizationTest: OK');
  return true;
}
