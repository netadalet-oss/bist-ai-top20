/*
 * Read-only integrity audit for the modular Apps Script runtime.
 *
 * Apps Script exposes all project files in one global runtime. Numeric file
 * prefixes document dependency direction, but correctness must not depend on
 * a particular file evaluation order. This audit therefore verifies the
 * globals and callable entry points after project load, without mutating any
 * sheet or installing triggers.
 */
var APPS_SCRIPT_INTEGRITY_AUDIT = (function () {
  'use strict';

  const VERSION = 'APPS-SCRIPT-INTEGRITY-1.0.0';

  const REQUIRED_GLOBALS = Object.freeze([
    { name: 'BIST_CONFIG', kind: 'object', layer: 'config' },
    { name: 'VERILER_REPOSITORY', kind: 'object', layer: 'data' },
    { name: 'MODEL_CORE', kind: 'object', layer: 'models' },
    { name: 'EXPERT_MODELS', kind: 'object', layer: 'models' },
    { name: 'CONSENSUS_MODEL', kind: 'object', layer: 'models' },
    { name: 'SNAPSHOT_STORE', kind: 'object', layer: 'persistence' },
    { name: 'S_SELECTION_ENGINE', kind: 'object', layer: 'selection' },
    { name: 'MODEL_REGISTRY', kind: 'object', layer: 'calibration' },
    { name: 'RUNTIME_MODEL_BINDING', kind: 'object', layer: 'runtime' },
    { name: 'RUNTIME_INPUT_ADAPTER', kind: 'object', layer: 'runtime' },
    { name: 'MODEL_FEATURE_COVERAGE_AUDIT', kind: 'object', layer: 'quality' },
    { name: 'RUNTIME_DATA_QUALITY_GATE', kind: 'object', layer: 'quality' },
    { name: 'RUN_LOG_QUALITY_INTEGRATION', kind: 'object', layer: 'operations' },
    { name: 'SCHEDULER_AND_MAINTENANCE', kind: 'object', layer: 'operations' }
  ]);

  const REQUIRED_FUNCTIONS = Object.freeze([
    { name: 'normalizeHeader_', layer: 'normalization' },
    { name: 'parseLocalizedNumber_', layer: 'normalization' },
    { name: 'buildRuntimeInputs_', layer: 'runtime' },
    { name: 'runEndToEndSSelection_', layer: 'runtime' },
    { name: 'saveEndToEndSSelectionSnapshot_', layer: 'runtime' },
    { name: 'buildRuntimeSSelection_', layer: 'selection' },
    { name: 'saveRuntimeSSelectionSnapshot_', layer: 'selection' },
    { name: 'auditLiveModelFeatureCoverage_', layer: 'quality' },
    { name: 'scheduledSameDayEarlySnapshot_', layer: 'operations' },
    { name: 'scheduledSameDayMidSnapshot_', layer: 'operations' },
    { name: 'scheduledNextDayCloseSnapshot_', layer: 'operations' }
  ]);

  function globalObject_() {
    return typeof globalThis !== 'undefined' ? globalThis : this;
  }

  function typeMatches_(value, expected) {
    if (expected === 'object') return value != null && (typeof value === 'object' || typeof value === 'function');
    return typeof value === expected;
  }

  function inspectSymbols_(root, specs) {
    return specs.map(function (spec) {
      const exists = Object.prototype.hasOwnProperty.call(root, spec.name) || typeof root[spec.name] !== 'undefined';
      const actualType = exists ? typeof root[spec.name] : 'undefined';
      return {
        name: spec.name,
        layer: spec.layer,
        expectedType: spec.kind || 'function',
        actualType: actualType,
        exists: exists,
        valid: exists && typeMatches_(root[spec.name], spec.kind || 'function')
      };
    });
  }

  function inspectMethods_(root) {
    const contracts = [
      { owner: 'VERILER_REPOSITORY', methods: ['readPlan','readAllObjects','writeRowsBySymbol','audit'] },
      { owner: 'EXPERT_MODELS', methods: ['K1','K2','K3','K4'] },
      { owner: 'CONSENSUS_MODEL', methods: ['build'] },
      { owner: 'RUNTIME_INPUT_ADAPTER', methods: ['toFeature','readFeatures','buildExpertResults','build'] },
      { owner: 'MODEL_FEATURE_COVERAGE_AUDIT', methods: ['auditFeatures','auditLive'] },
      { owner: 'RUNTIME_DATA_QUALITY_GATE', methods: ['evaluate','enforce'] },
      { owner: 'RUN_LOG_QUALITY_INTEGRATION', methods: ['describeError'] },
      { owner: 'SCHEDULER_AND_MAINTENANCE', methods: ['runSession','audit','maintenanceAudit'] }
    ];

    const rows = [];
    contracts.forEach(function (contract) {
      const owner = root[contract.owner];
      contract.methods.forEach(function (method) {
        rows.push({
          owner: contract.owner,
          method: method,
          valid: !!owner && typeof owner[method] === 'function'
        });
      });
    });
    return rows;
  }

  function inspectRuntimeChain_(root) {
    const chain = [
      'VERILER_REPOSITORY.readAllObjects',
      'RUNTIME_INPUT_ADAPTER.readFeatures',
      'RUNTIME_DATA_QUALITY_GATE.enforce',
      'RUNTIME_INPUT_ADAPTER.buildExpertResults',
      'CONSENSUS_MODEL.build',
      'buildRuntimeSSelection_',
      'saveRuntimeSSelectionSnapshot_'
    ];

    function resolve_(path) {
      const parts = path.split('.');
      let value = root;
      for (let i = 0; i < parts.length; i++) {
        if (value == null) return undefined;
        value = value[parts[i]];
      }
      return value;
    }

    return chain.map(function (path, index) {
      return { order: index + 1, callable: path, valid: typeof resolve_(path) === 'function' };
    });
  }

  function audit(options) {
    const opts = options || {};
    const root = opts.root || globalObject_();
    const globals = inspectSymbols_(root, REQUIRED_GLOBALS);
    const functions = inspectSymbols_(root, REQUIRED_FUNCTIONS.map(function (item) {
      return { name: item.name, kind: 'function', layer: item.layer };
    }));
    const methods = inspectMethods_(root);
    const runtimeChain = inspectRuntimeChain_(root);
    const missing = globals.concat(functions).filter(function (row) { return !row.valid; });
    const missingMethods = methods.filter(function (row) { return !row.valid; });
    const brokenChain = runtimeChain.filter(function (row) { return !row.valid; });

    return {
      auditVersion: VERSION,
      generatedAt: new Date(),
      globals: globals,
      functions: functions,
      methods: methods,
      runtimeChain: runtimeChain,
      missingSymbols: missing.map(function (row) { return row.name; }),
      missingMethods: missingMethods.map(function (row) { return row.owner + '.' + row.method; }),
      brokenRuntimeChain: brokenChain.map(function (row) { return row.callable; }),
      valid: missing.length === 0 && missingMethods.length === 0 && brokenChain.length === 0,
      notes: [
        'Numeric filename prefixes document dependency direction only.',
        'No sheet reads, writes, trigger changes or network calls are performed.',
        'A valid static runtime does not prove that live workbook data passes the quality gate.'
      ]
    };
  }

  function assertValid(options) {
    const report = audit(options);
    if (!report.valid) {
      const parts = [];
      if (report.missingSymbols.length) parts.push('symbols=' + report.missingSymbols.join(','));
      if (report.missingMethods.length) parts.push('methods=' + report.missingMethods.join(','));
      if (report.brokenRuntimeChain.length) parts.push('chain=' + report.brokenRuntimeChain.join(','));
      const error = new Error('Apps Script bütünlük denetimi başarısız: ' + parts.join(' | '));
      error.name = 'AppsScriptIntegrityError';
      error.integrityReport = report;
      throw error;
    }
    return report;
  }

  return Object.freeze({
    version: VERSION,
    requiredGlobals: REQUIRED_GLOBALS,
    requiredFunctions: REQUIRED_FUNCTIONS,
    audit: audit,
    assertValid: assertValid
  });
})();

function auditAppsScriptIntegrity_() {
  const report = APPS_SCRIPT_INTEGRITY_AUDIT.audit();
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function assertAppsScriptIntegrity_() {
  return APPS_SCRIPT_INTEGRITY_AUDIT.assertValid();
}
