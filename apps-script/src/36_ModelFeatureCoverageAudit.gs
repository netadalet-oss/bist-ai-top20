/*
 * Read-only coverage audit for the canonical features consumed by K1-K4.
 *
 * The audit distinguishes missing values, invalid numeric values, zeros and
 * constant series. It does not mutate the workbook or infer that zero is
 * inherently invalid; zero/constant flags are diagnostic signals.
 */
var MODEL_FEATURE_COVERAGE_AUDIT = (function () {
  'use strict';

  const VERSION = 'MODEL-FEATURE-COVERAGE-1.0.0';
  const DEFAULT_MIN_COVERAGE = 0.80;
  const DEFAULT_HISTORY_DEPTH = 30;

  const FIELD_SPECS = Object.freeze([
    { key: 'anlik', models: ['K1'], kind: 'number' },
    { key: 'anlikdeg', models: ['K1'], kind: 'number' },
    { key: 'kapanis_T', models: ['K1','K3'], kind: 'number' },
    { key: 'hacimdeg', models: ['K1'], kind: 'number' },
    { key: 'vol5', models: ['K1'], kind: 'number' },
    { key: 'vol21', models: ['K1','K4'], kind: 'number' },
    { key: 'vol63', models: ['K1'], kind: 'number' },
    { key: 'bollu', models: ['K1'], kind: 'number' },
    { key: 'bolla', models: ['K1'], kind: 'number' },
    { key: 'rsi14', models: ['K1','K2','K4'], kind: 'number' },
    { key: 'deg3g_num', models: ['K1','K4'], kind: 'number' },
    { key: 'ema20', models: ['K2'], kind: 'number' },
    { key: 'ema50', models: ['K2'], kind: 'number' },
    { key: 'ema200', models: ['K2'], kind: 'number' },
    { key: 'macdhist', models: ['K2'], kind: 'number' },
    { key: 'momentum10', models: ['K2'], kind: 'number' },
    { key: 'getiri1A', models: ['K4'], kind: 'number' },
    { key: 'getiri3A', models: ['K4'], kind: 'number' },
    { key: 'getiri6A', models: ['K4'], kind: 'number' },
    { key: 'history.close', models: ['K3'], kind: 'history' },
    { key: 'history.chg', models: ['K3'], kind: 'history' },
    { key: 'history.volChg', models: ['K3'], kind: 'history' }
  ]);

  function finite_(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function valueAt_(row, key) {
    return key.split('.').reduce(function (value, part) {
      return value == null ? null : value[part];
    }, row);
  }

  function numericStatus_(value) {
    if (value === '' || value == null) return 'missing';
    return finite_(value) ? 'valid' : 'invalid';
  }

  function historyStatus_(value, depth) {
    if (!Array.isArray(value)) return { status: 'missing', validCount: 0, expectedCount: depth + 1 };
    const expected = depth + 1;
    const slice = value.slice(0, expected);
    const validCount = slice.filter(finite_).length;
    if (validCount === 0) return { status: 'missing', validCount: 0, expectedCount: expected };
    if (value.length < expected || validCount < expected) {
      return { status: 'partial', validCount: validCount, expectedCount: expected };
    }
    return { status: 'valid', validCount: validCount, expectedCount: expected };
  }

  function summarizeField_(features, spec, historyDepth) {
    const summary = {
      field: spec.key,
      models: spec.models.slice(),
      kind: spec.kind,
      rowCount: features.length,
      validCount: 0,
      partialCount: 0,
      missingCount: 0,
      invalidCount: 0,
      zeroCount: 0,
      nonZeroCount: 0,
      distinctValidCount: 0,
      coverage: 0,
      constant: false,
      sampleMissingSymbols: [],
      sampleInvalidSymbols: []
    };
    const distinct = Object.create(null);

    features.forEach(function (row) {
      const symbol = String(row.symbol || row.sym || '');
      const value = valueAt_(row, spec.key);
      if (spec.kind === 'history') {
        const state = historyStatus_(value, historyDepth);
        if (state.status === 'valid') summary.validCount++;
        else if (state.status === 'partial') summary.partialCount++;
        else {
          summary.missingCount++;
          if (summary.sampleMissingSymbols.length < 10) summary.sampleMissingSymbols.push(symbol);
        }
        if (Array.isArray(value)) {
          value.slice(0, historyDepth + 1).filter(finite_).forEach(function (n) {
            distinct[String(n)] = true;
            if (n === 0) summary.zeroCount++; else summary.nonZeroCount++;
          });
        }
        return;
      }

      const status = numericStatus_(value);
      if (status === 'valid') {
        summary.validCount++;
        distinct[String(value)] = true;
        if (value === 0) summary.zeroCount++; else summary.nonZeroCount++;
      } else if (status === 'missing') {
        summary.missingCount++;
        if (summary.sampleMissingSymbols.length < 10) summary.sampleMissingSymbols.push(symbol);
      } else {
        summary.invalidCount++;
        if (summary.sampleInvalidSymbols.length < 10) summary.sampleInvalidSymbols.push(symbol);
      }
    });

    summary.distinctValidCount = Object.keys(distinct).length;
    summary.coverage = summary.rowCount ? (summary.validCount + summary.partialCount) / summary.rowCount : 0;
    summary.constant = summary.validCount > 1 && summary.distinctValidCount === 1;
    return summary;
  }

  function modelSummary_(modelName, fieldSummaries, threshold) {
    const fields = fieldSummaries.filter(function (field) {
      return field.models.indexOf(modelName) >= 0;
    });
    const belowThreshold = fields.filter(function (field) { return field.coverage < threshold; });
    const invalid = fields.filter(function (field) { return field.invalidCount > 0; });
    const constant = fields.filter(function (field) { return field.constant; });
    const aggregateCoverage = fields.length
      ? fields.reduce(function (sum, field) { return sum + field.coverage; }, 0) / fields.length
      : 0;
    return {
      model: modelName,
      fieldCount: fields.length,
      aggregateCoverage: aggregateCoverage,
      threshold: threshold,
      belowThresholdFields: belowThreshold.map(function (field) { return field.field; }),
      invalidFields: invalid.map(function (field) { return field.field; }),
      constantFields: constant.map(function (field) { return field.field; }),
      ready: fields.length > 0 && belowThreshold.length === 0 && invalid.length === 0
    };
  }

  function auditFeatures(features, options) {
    const opts = options || {};
    const rows = features || [];
    const threshold = Number(opts.minCoverage == null ? DEFAULT_MIN_COVERAGE : opts.minCoverage);
    const historyDepth = Math.max(1, Number(opts.historyDepth || DEFAULT_HISTORY_DEPTH));
    if (!(threshold >= 0 && threshold <= 1)) throw new Error('minCoverage 0 ile 1 arasında olmalıdır.');

    const fieldSummaries = FIELD_SPECS.map(function (spec) {
      return summarizeField_(rows, spec, historyDepth);
    });
    const models = ['K1','K2','K3','K4'].map(function (name) {
      return modelSummary_(name, fieldSummaries, threshold);
    });

    return {
      auditVersion: VERSION,
      generatedAt: new Date(),
      featureCount: rows.length,
      minCoverage: threshold,
      historyDepth: historyDepth,
      fields: fieldSummaries,
      models: models,
      ready: rows.length > 0 && models.every(function (model) { return model.ready; }),
      warnings: fieldSummaries.filter(function (field) {
        return field.constant || field.zeroCount === field.validCount && field.validCount > 1;
      }).map(function (field) {
        return {
          field: field.field,
          constant: field.constant,
          allValidValuesZero: field.zeroCount === field.validCount && field.validCount > 1
        };
      })
    };
  }

  function auditLive(input) {
    input = input || {};
    const read = RUNTIME_INPUT_ADAPTER.readFeatures({
      predictionTs: input.predictionTs || new Date(),
      records: input.records,
      options: { historyDepth: input.historyDepth || DEFAULT_HISTORY_DEPTH }
    });
    const report = auditFeatures(read.features, input);
    report.rejected = read.rejected;
    report.sourceRecordCount = input.records ? input.records.length : null;
    return report;
  }

  return Object.freeze({
    version: VERSION,
    fieldSpecs: FIELD_SPECS,
    auditFeatures: auditFeatures,
    auditLive: auditLive
  });
})();

function auditLiveModelFeatureCoverage_(input) {
  const report = MODEL_FEATURE_COVERAGE_AUDIT.auditLive(input || {});
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
