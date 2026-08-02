function assertRuntimeQuality_(condition, message) {
  if (!condition) throw new Error('RuntimeDataQualityGateTest: ' + message);
}

function completeRuntimeQualityFeature_(symbol) {
  const history = { close: [], chg: [], volChg: [] };
  for (let i = 0; i <= 30; i++) {
    history.close.push(100 - i * 0.1);
    history.chg.push(i === 0 ? 2 : 0.2);
    history.volChg.push(i === 0 ? 15 : 1);
  }
  return {
    symbol: symbol,
    anlik: 102,
    anlikdeg: 2,
    kapanis_T: 100,
    hacimdeg: 15,
    vol5: 2,
    vol21: 3,
    vol63: 4,
    bollu: 110,
    bolla: 90,
    rsi14: 56,
    deg3g_num: 3,
    ema20: 101,
    ema50: 98,
    ema200: 90,
    macdhist: 1.2,
    momentum10: 4,
    getiri1A: 8,
    getiri3A: 12,
    getiri6A: 20,
    history: history
  };
}

function runRuntimeDataQualityGateTests_() {
  const good = [
    completeRuntimeQualityFeature_('AAA'),
    completeRuntimeQualityFeature_('BBB')
  ];
  const allowed = RUNTIME_DATA_QUALITY_GATE.evaluate(good, {
    minCoverage: 1,
    minFeatureCount: 2
  });
  assertRuntimeQuality_(allowed.allowed === true, 'eksiksiz özellikler geçmeli');
  assertRuntimeQuality_(allowed.reasons.length === 0, 'geçerli raporda engel olmamalı');

  const broken = good.map(function (row) {
    const copy = Object.assign({}, row);
    copy.ema200 = null;
    return copy;
  });
  const blocked = RUNTIME_DATA_QUALITY_GATE.evaluate(broken, {
    minCoverage: 0.80,
    minFeatureCount: 2
  });
  assertRuntimeQuality_(blocked.allowed === false, 'EMA200 eksikliği kapıyı kapatmalı');
  assertRuntimeQuality_(blocked.reasons.some(function (reason) {
    return reason.code === 'FIELD_COVERAGE_BELOW_THRESHOLD' && reason.model === 'K2' && reason.field === 'ema200';
  }), 'K2/ema200 engel nedeni raporlanmalı');

  let threw = false;
  try {
    RUNTIME_DATA_QUALITY_GATE.enforce(broken, {
      minCoverage: 0.80,
      minFeatureCount: 2
    });
  } catch (error) {
    threw = error && error.name === 'RuntimeDataQualityError' && !!error.qualityReport;
  }
  assertRuntimeQuality_(threw, 'fail-closed enforce hata vermeli');

  const bypassed = RUNTIME_DATA_QUALITY_GATE.enforce(broken, {
    enabled: false,
    bypassReason: 'TEST_ONLY'
  });
  assertRuntimeQuality_(bypassed.allowed === true, 'açık devre dışı bırakma çalışmalı');
  assertRuntimeQuality_(bypassed.bypassed === true, 'bypass açıkça işaretlenmeli');
  assertRuntimeQuality_(bypassed.bypassReason === 'TEST_ONLY', 'bypass nedeni korunmalı');

  const k2Only = RUNTIME_DATA_QUALITY_GATE.evaluate(broken, {
    requiredModels: ['K1'],
    minCoverage: 0.80,
    minFeatureCount: 2
  });
  assertRuntimeQuality_(k2Only.allowed === true, 'K1 dışındaki alanlar K1-only kapısını engellememeli');

  Logger.log('RuntimeDataQualityGate tests passed.');
  return true;
}
