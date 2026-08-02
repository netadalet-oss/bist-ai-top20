function runFeaturePipelineTests_() {
  const rows = [];
  for (let i = 0; i < 220; i++) {
    const d = new Date(2025, 0, 1 + i);
    rows.push({
      HGDG_TARIH: Utilities.formatDate(d, 'Europe/Istanbul', 'yyyy-MM-dd'),
      HGDG_KAPANIS: 100 + i * 0.5,
      HGDG_MIN: 99 + i * 0.5,
      HGDG_MAX: 101 + i * 0.5,
      HGDG_HACIM: 1000000 + i * 1000,
      DOLAR_BAZLI_AOF: 3 + i * 0.01,
      HG_AOF: 9000 + i * 10,
      PD: 1000000000,
      SERMAYE: 100000000,
      F_K: 10,
      PD_DD: 2
    });
  }

  const rec = FEATURE_PIPELINE.computeFromRows('TEST', rows, {
    marketOpen: false,
    featureTimestamp: new Date(2025, 7, 1)
  });

  assertFeature_(rec.ok === true, 'record should be successful');
  assertFeature_(rec.Hisse === 'TEST', 'symbol normalization');
  assertFeature_(rec.arrays.kapanis.length === 220, 'series alignment');
  assertFeature_(rec.EMA200 != null, 'EMA200 should exist');
  assertFeature_(rec.Anlik === rec.latest.kapanis, 'closed market price contract');
  assertFeature_(rec.FD == null, 'canonical FD must not be fabricated');
  assertFeature_(rec.FAVOK == null, 'canonical FAVOK must not be fabricated');
  assertFeature_(rec.legacyApprox.FD != null, 'legacy FD retained explicitly');
  assertFeature_(rec.legacyApprox.FAVOK != null, 'legacy FAVOK retained explicitly');

  const duplicate = rows.concat([Object.assign({}, rows[rows.length - 1], { HGDG_KAPANIS: 999 })]);
  const normalized = FEATURE_PIPELINE.normalizeRows(duplicate);
  assertFeature_(normalized.length === 220, 'same-date rows should be deduplicated');
  assertFeature_(Number(normalized[normalized.length - 1].HGDG_KAPANIS) === 999, 'last duplicate should win');

  const invalid = FEATURE_PIPELINE.computeFromRows('BAD', [{ HGDG_TARIH: 'not-a-date' }], {});
  assertFeature_(invalid.ok === false && invalid.error === 'NO_VALID_ROWS', 'invalid rows should fail explicitly');

  Logger.log('FeaturePipeline tests passed.');
  return true;
}

function assertFeature_(condition, message) {
  if (!condition) throw new Error('FeaturePipelineTest: ' + message);
}
