function assertModelCoverage_(condition, message) {
  if (!condition) throw new Error('ModelFeatureCoverageAuditTest: ' + message);
}

function completeCoverageFeature_(symbol, base) {
  const history = { close: [], chg: [], volChg: [] };
  for (let i = 0; i <= 30; i++) {
    history.close.push(base - i);
    history.chg.push(i === 0 ? 1 : 0.2);
    history.volChg.push(i === 0 ? 10 : 1);
  }
  return {
    symbol: symbol,
    anlik: base + 1,
    anlikdeg: 1,
    kapanis_T: base,
    hacimdeg: 10,
    vol5: 2,
    vol21: 3,
    vol63: 4,
    bollu: base + 10,
    bolla: base - 10,
    rsi14: 55,
    deg3g_num: 2,
    ema20: base + 2,
    ema50: base,
    ema200: base - 5,
    macdhist: 1,
    momentum10: 3,
    getiri1A: 5,
    getiri3A: 10,
    getiri6A: 15,
    history: history
  };
}

function runModelFeatureCoverageAuditTests_() {
  const a = completeCoverageFeature_('AAA', 100);
  const b = completeCoverageFeature_('BBB', 120);
  const healthy = MODEL_FEATURE_COVERAGE_AUDIT.auditFeatures([a, b], { minCoverage: 1 });
  assertModelCoverage_(healthy.ready === true, 'tam kayıtlar hazır olmalı');
  assertModelCoverage_(healthy.models.every(function (model) { return model.ready; }), 'tüm modeller hazır olmalı');

  const broken = completeCoverageFeature_('CCC', 140);
  broken.ema200 = null;
  broken.macdhist = 'not-a-number';
  broken.vol21 = 0;
  broken.history.volChg = broken.history.volChg.slice(0, 5);

  const report = MODEL_FEATURE_COVERAGE_AUDIT.auditFeatures([a, broken], { minCoverage: 0.75 });
  const ema200 = report.fields.filter(function (field) { return field.field === 'ema200'; })[0];
  const macd = report.fields.filter(function (field) { return field.field === 'macdhist'; })[0];
  const historyVol = report.fields.filter(function (field) { return field.field === 'history.volChg'; })[0];
  const k2 = report.models.filter(function (model) { return model.model === 'K2'; })[0];

  assertModelCoverage_(ema200.missingCount === 1, 'eksik EMA200 sayılmalı');
  assertModelCoverage_(macd.invalidCount === 1, 'geçersiz MACD sayılmalı');
  assertModelCoverage_(historyVol.partialCount === 1, 'kısmi tarihçe sayılmalı');
  assertModelCoverage_(k2.ready === false, 'geçersiz alan içeren K2 hazır olmamalı');

  const constantA = completeCoverageFeature_('DDD', 160);
  const constantB = completeCoverageFeature_('EEE', 160);
  const constantReport = MODEL_FEATURE_COVERAGE_AUDIT.auditFeatures([constantA, constantB]);
  const rsi = constantReport.fields.filter(function (field) { return field.field === 'rsi14'; })[0];
  assertModelCoverage_(rsi.constant === true, 'sabit RSI serisi işaretlenmeli');
  assertModelCoverage_(constantReport.warnings.length > 0, 'sabit alan uyarısı üretilmeli');

  Logger.log('ModelFeatureCoverageAudit tests passed.');
  return true;
}
