/* Structured serialization of runtime data-quality failures for _RunLog. */
var RUN_LOG_QUALITY_INTEGRATION = (function () {
  'use strict';

  const VERSION = 'RUN-LOG-QUALITY-1.0.1';
  const MAX_JSON_LENGTH = 45000;

  function text_(value) {
    return value == null ? '' : String(value);
  }

  function unique_(values) {
    const seen = Object.create(null);
    return (values || []).filter(function (value) {
      const key = text_(value);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function qualityReport_(error) {
    return error && error.qualityReport && typeof error.qualityReport === 'object'
      ? error.qualityReport
      : null;
  }

  function reasons_(report) {
    if (!report) return [];
    if (Array.isArray(report.reasons)) return report.reasons;
    if (Array.isArray(report.failures)) return report.failures;
    return [];
  }

  function safeJson_(value) {
    if (value == null) return '';
    let json;
    try {
      json = JSON.stringify(value);
    } catch (err) {
      return JSON.stringify({ serializationError: text_(err && err.message || err) });
    }
    if (json.length <= MAX_JSON_LENGTH) return json;
    return JSON.stringify({
      truncated: true,
      originalLength: json.length,
      preview: json.slice(0, MAX_JSON_LENGTH)
    });
  }

  function fromError(error) {
    const report = qualityReport_(error);
    const reasons = reasons_(report);
    const reasonCodes = unique_(reasons.map(function (reason) {
      return reason && (reason.code || reason.reasonCode || reason.reason);
    }));
    const models = unique_(reasons.map(function (reason) {
      return reason && reason.model;
    }));
    const fields = unique_(reasons.map(function (reason) {
      return reason && reason.field;
    }));

    return {
      errorType: text_(error && error.name) || 'Error',
      reasonCodes: reasonCodes.join(','),
      qualityModels: models.join(','),
      qualityFields: fields.join(','),
      qualityReportJson: safeJson_(report),
      isQualityFailure: !!report || text_(error && error.name) === 'RuntimeDataQualityError'
    };
  }

  return Object.freeze({
    version: VERSION,
    fromError: fromError,
    safeJson: safeJson_
  });
})();