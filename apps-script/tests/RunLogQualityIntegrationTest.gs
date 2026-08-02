function assertRunLogQuality_(condition, message) {
  if (!condition) throw new Error('RunLogQualityIntegrationTest: ' + message);
}

function runRunLogQualityIntegrationTests_() {
  const error = new Error('quality blocked');
  error.name = 'RuntimeDataQualityError';
  error.qualityReport = {
    passed: false,
    reasons: [
      { code: 'FIELD_COVERAGE_BELOW_THRESHOLD', model: 'K2', field: 'ema200' },
      { code: 'INVALID_NUMERIC_FIELD', model: 'K2', field: 'macdhist' },
      { code: 'FIELD_COVERAGE_BELOW_THRESHOLD', model: 'K2', field: 'ema200' }
    ]
  };

  const out = RUN_LOG_QUALITY_INTEGRATION.fromError(error);
  assertRunLogQuality_(out.isQualityFailure === true, 'kalite hatası tanınmalı');
  assertRunLogQuality_(out.errorType === 'RuntimeDataQualityError', 'hata türü');
  assertRunLogQuality_(out.reasonCodes === 'FIELD_COVERAGE_BELOW_THRESHOLD,INVALID_NUMERIC_FIELD', 'neden kodları benzersiz olmalı');
  assertRunLogQuality_(out.qualityModels === 'K2', 'model listesi');
  assertRunLogQuality_(out.qualityFields === 'ema200,macdhist', 'alan listesi');
  assertRunLogQuality_(out.qualityReportJson.indexOf('ema200') >= 0, 'rapor JSON saklanmalı');

  const normal = RUN_LOG_QUALITY_INTEGRATION.fromError(new Error('ordinary'));
  assertRunLogQuality_(normal.isQualityFailure === false, 'normal hata kalite hatası sayılmamalı');

  Logger.log('RunLogQualityIntegration tests passed.');
  return true;
}
