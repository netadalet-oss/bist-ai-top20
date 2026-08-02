/*
 * Fail-closed data quality gate for the Veriler -> K1-K4 -> K5 -> S chain.
 *
 * The gate consumes canonical features and the coverage audit. It never repairs,
 * imputes or fabricates values. A blocked report prevents expert models and S
 * selection from running unless the caller explicitly disables the gate.
 */
var RUNTIME_DATA_QUALITY_GATE = (function () {
  'use strict';

  const VERSION = 'RUNTIME-DATA-QUALITY-GATE-1.0.0';
  const DEFAULT_REQUIRED_MODELS = Object.freeze(['K1','K2','K3','K4']);
  const DEFAULT_MIN_COVERAGE = 0.80;
  const DEFAULT_MIN_FEATURE_COUNT = 1;

  function normalizeModels_(models) {
    const allowed = { K1: true, K2: true, K3: true, K4: true };
    const seen = Object.create(null);
    return (models || DEFAULT_REQUIRED_MODELS).map(function (name) {
      return String(name || '').trim().toUpperCase();
    }).filter(function (name) {
      if (!allowed[name] || seen[name]) return false;
      seen[name] = true;
      return true;
    });
  }

  function buildReasons_(audit, requiredModels, minFeatureCount) {
    const reasons = [];
    if (!audit || typeof audit !== 'object') {
      return [{ code: 'MISSING_AUDIT_REPORT', message: 'Veri kalite raporu üretilemedi.' }];
    }

    if (Number(audit.featureCount || 0) < minFeatureCount) {
      reasons.push({
        code: 'INSUFFICIENT_FEATURE_COUNT',
        actual: Number(audit.featureCount || 0),
        required: minFeatureCount,
        message: 'Geçerli özellik kaydı sayısı gerekli asgari seviyenin altında.'
      });
    }

    const modelMap = Object.create(null);
    (audit.models || []).forEach(function (model) {
      modelMap[String(model.model || '').toUpperCase()] = model;
    });

    requiredModels.forEach(function (name) {
      const model = modelMap[name];
      if (!model) {
        reasons.push({
          code: 'MISSING_MODEL_AUDIT',
          model: name,
          message: name + ' için veri kalite özeti bulunamadı.'
        });
        return;
      }
      (model.belowThresholdFields || []).forEach(function (field) {
        reasons.push({
          code: 'FIELD_COVERAGE_BELOW_THRESHOLD',
          model: name,
          field: field,
          threshold: Number(model.threshold),
          message: name + ' alan kapsamı eşik altında: ' + field
        });
      });
      (model.invalidFields || []).forEach(function (field) {
        reasons.push({
          code: 'INVALID_NUMERIC_FIELD',
          model: name,
          field: field,
          message: name + ' alanında geçersiz sayısal değer bulundu: ' + field
        });
      });
      if (!model.ready && !(model.belowThresholdFields || []).length && !(model.invalidFields || []).length) {
        reasons.push({
          code: 'MODEL_NOT_READY',
          model: name,
          message: name + ' veri kalite kapısını geçemedi.'
        });
      }
    });

    return reasons;
  }

  function evaluate(features, options) {
    const opts = options || {};
    const requiredModels = normalizeModels_(opts.requiredModels);
    if (!requiredModels.length) throw new Error('En az bir requiredModels değeri gereklidir.');

    const minCoverage = Number(opts.minCoverage == null ? DEFAULT_MIN_COVERAGE : opts.minCoverage);
    const minFeatureCount = Math.max(1, Number(opts.minFeatureCount || DEFAULT_MIN_FEATURE_COUNT));
    const historyDepth = Math.max(1, Number(opts.historyDepth || 30));
    if (!(minCoverage >= 0 && minCoverage <= 1)) {
      throw new Error('minCoverage 0 ile 1 arasında olmalıdır.');
    }

    const audit = MODEL_FEATURE_COVERAGE_AUDIT.auditFeatures(features || [], {
      minCoverage: minCoverage,
      historyDepth: historyDepth
    });
    const reasons = buildReasons_(audit, requiredModels, minFeatureCount);

    return {
      gateVersion: VERSION,
      evaluatedAt: new Date(),
      enabled: opts.enabled !== false,
      failClosed: opts.failClosed !== false,
      allowed: reasons.length === 0,
      requiredModels: requiredModels,
      minCoverage: minCoverage,
      minFeatureCount: minFeatureCount,
      historyDepth: historyDepth,
      reasons: reasons,
      warnings: audit.warnings || [],
      audit: audit
    };
  }

  function assertAllowed(report) {
    if (!report || report.allowed) return report;
    const details = (report.reasons || []).map(function (reason) {
      return [reason.code, reason.model, reason.field].filter(Boolean).join(':');
    }).join(', ');
    const error = new Error('RUNTIME_DATA_QUALITY_BLOCKED' + (details ? ' — ' + details : ''));
    error.name = 'RuntimeDataQualityError';
    error.qualityReport = report;
    throw error;
  }

  function enforce(features, options) {
    const opts = options || {};
    const report = evaluate(features, opts);
    if (opts.enabled === false) {
      report.allowed = true;
      report.bypassed = true;
      report.bypassReason = String(opts.bypassReason || 'EXPLICITLY_DISABLED');
      return report;
    }
    if (report.failClosed) assertAllowed(report);
    return report;
  }

  return Object.freeze({
    version: VERSION,
    evaluate: evaluate,
    enforce: enforce,
    assertAllowed: assertAllowed
  });
})();

function auditRuntimeDataQualityGate_(input) {
  input = input || {};
  const read = RUNTIME_INPUT_ADAPTER.readFeatures(input);
  const report = RUNTIME_DATA_QUALITY_GATE.evaluate(read.features, input.qualityOptions || {});
  report.rejected = read.rejected;
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
