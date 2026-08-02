/*
 * Project bootstrap, release-readiness audit and unified test runner.
 *
 * Default entry points are read-only. Shadow execution is explicit and does
 * not overwrite the legacy S sheet.
 */
var PROJECT_BOOTSTRAP = (function () {
  'use strict';

  const VERSION = 'PROJECT-BOOTSTRAP-1.0.0';

  const TEST_NAMES = Object.freeze([
    'runIndicatorsTests_',
    'runFeaturePipelineTests_',
    'runExpertModelTests_',
    'runExpertCriteriaParityAuditTests_',
    'runConsensusModelTests_',
    'runSnapshotStoreTests_',
    'runOutcomeEvaluatorTests_',
    'runMetricsReporterTests_',
    'runFirstTop20EntryTests_',
    'runSSelectionEngineTests_',
    'runWalkForwardCalibrationTests_',
    'runCalibrationDataAdapterTests_',
    'runModelRegistryTests_',
    'runRuntimeModelBindingTests_',
    'runSchedulerAndMaintenanceTests_',
    'runSPerformanceReportTests_',
    'runRuntimeInputAdapterTests_',
    'runShadowComparisonTests_',
    'runShadowExperimentTests_',
    'runShadowBarRiskEvaluatorTests_',
    'runBistTradingCalendarTests_',
    'runExecutionCostModelTests_',
    'runBootstrapStabilityTests_',
    'runLiveWorkbookContractAuditTests_',
    'runLiveWorkbookCorrectionsTests_',
    'runVerilerPhysicalContractTests_',
    'runVerilerCanonicalSchemaTests_',
    'runModelFeatureCoverageAuditTests_',
    'runRuntimeDataQualityGateTests_',
    'runRunLogQualityIntegrationTests_',
    'runAppsScriptIntegrityAuditTests_',
    'runSchedulerIntegrityPreflightTests_',
    'runLegacyFunctionMigrationAuditTests_',
    'runSCriteriaParityAuditTests_',
    'runHeaderReaderNormalizationTests_'
  ]);

  function root_() {
    return typeof globalThis !== 'undefined' ? globalThis : this;
  }

  function errorInfo_(error) {
    return {
      name:error && error.name ? String(error.name) : 'Error',
      message:error && error.message ? String(error.message) : String(error),
      stack:error && error.stack ? String(error.stack) : null
    };
  }

  function runTests(options) {
    const opts = options || {};
    const root = opts.root || root_();
    const failFast = opts.failFast === true;
    const requireAll = opts.requireAll !== false;
    const startedAt = new Date();
    const results = [];

    TEST_NAMES.forEach(function (name) {
      const fn = root[name];
      if (typeof fn !== 'function') {
        const missing = { name:name, status:'MISSING', durationMs:0, result:null, error:null };
        results.push(missing);
        if (failFast && requireAll) {
          const error = new Error('Zorunlu test fonksiyonu bulunamadı: ' + name);
          error.name = 'ProjectTestMissingError';
          error.testReport = { results:results.slice() };
          throw error;
        }
        return;
      }

      const testStart = new Date();
      try {
        const value = fn();
        results.push({
          name:name,
          status:'PASSED',
          durationMs:new Date().getTime() - testStart.getTime(),
          result:value == null ? null : value,
          error:null
        });
      } catch (error) {
        results.push({
          name:name,
          status:'FAILED',
          durationMs:new Date().getTime() - testStart.getTime(),
          result:null,
          error:errorInfo_(error)
        });
        if (failFast) {
          error.projectTestReport = { results:results.slice() };
          throw error;
        }
      }
    });

    const counts = results.reduce(function (out, row) {
      out[row.status] = (out[row.status] || 0) + 1;
      return out;
    }, { PASSED:0, FAILED:0, MISSING:0 });

    const report = {
      version:VERSION,
      startedAt:startedAt,
      finishedAt:new Date(),
      durationMs:new Date().getTime() - startedAt.getTime(),
      requireAll:requireAll,
      counts:counts,
      results:results,
      valid:counts.FAILED === 0 && (!requireAll || counts.MISSING === 0)
    };

    if (!report.valid && opts.throwOnFailure === true) {
      const error = new Error(
        'Proje testleri başarısız: failed=' + counts.FAILED + ', missing=' + counts.MISSING
      );
      error.name = 'ProjectTestSuiteError';
      error.testReport = report;
      throw error;
    }

    return report;
  }

  function readiness(options) {
    const opts = options || {};
    const root = opts.root || root_();
    const checks = [];

    function capture(name, fn, required) {
      const start = new Date();
      try {
        const value = fn();
        const valid = value && typeof value.valid === 'boolean' ? value.valid : true;
        checks.push({
          name:name,
          required:required !== false,
          status:valid ? 'PASSED' : 'FAILED',
          durationMs:new Date().getTime() - start.getTime(),
          value:value,
          error:null
        });
      } catch (error) {
        checks.push({
          name:name,
          required:required !== false,
          status:'FAILED',
          durationMs:new Date().getTime() - start.getTime(),
          value:null,
          error:errorInfo_(error)
        });
      }
    }

    capture('appsScriptIntegrity', function () {
      if (!root.APPS_SCRIPT_INTEGRITY_AUDIT || typeof root.APPS_SCRIPT_INTEGRITY_AUDIT.audit !== 'function') {
        throw new Error('APPS_SCRIPT_INTEGRITY_AUDIT.audit bulunamadı.');
      }
      return root.APPS_SCRIPT_INTEGRITY_AUDIT.audit({ root:root });
    }, true);

    capture('legacyMigration', function () {
      if (!root.LEGACY_FUNCTION_MIGRATION_AUDIT || typeof root.LEGACY_FUNCTION_MIGRATION_AUDIT.audit !== 'function') {
        throw new Error('LEGACY_FUNCTION_MIGRATION_AUDIT.audit bulunamadı.');
      }
      return root.LEGACY_FUNCTION_MIGRATION_AUDIT.audit({ root:root });
    }, true);

    capture('canonicalSchema', function () {
      if (typeof root.auditVerilerCanonicalSchema_ !== 'function') {
        throw new Error('auditVerilerCanonicalSchema_ bulunamadı.');
      }
      return root.auditVerilerCanonicalSchema_();
    }, true);

    capture('featureCoverage', function () {
      if (typeof root.auditLiveModelFeatureCoverage_ !== 'function') {
        throw new Error('auditLiveModelFeatureCoverage_ bulunamadı.');
      }
      return root.auditLiveModelFeatureCoverage_(opts.qualityOptions || {});
    }, true);

    capture('sCriteriaParity', function () {
      if (typeof root.auditSCriteriaParity_ !== 'function') {
        throw new Error('auditSCriteriaParity_ bulunamadı.');
      }
      return root.auditSCriteriaParity_();
    }, true);

    capture('expertCriteriaParity', function () {
      if (typeof root.auditExpertCriteriaParity_ !== 'function') {
        throw new Error('auditExpertCriteriaParity_ bulunamadı.');
      }
      return root.auditExpertCriteriaParity_();
    }, true);

    if (opts.runTests === true) {
      capture('testSuite', function () {
        return runTests({
          root:root,
          requireAll:opts.requireAllTests !== false,
          failFast:false,
          throwOnFailure:false
        });
      }, true);
    }

    const failedRequired = checks.filter(function (row) {
      return row.required && row.status !== 'PASSED';
    });

    return {
      version:VERSION,
      generatedAt:new Date(),
      mode:'SHADOW_ONLY',
      checks:checks,
      failedRequired:failedRequired.map(function (row) { return row.name; }),
      valid:failedRequired.length === 0,
      decision:failedRequired.length === 0
        ? 'Statik ve canlı ön kontroller gölge çalışma için uygundur.'
        : 'Gölge çalışma başlatılmadan önce zorunlu kontroller düzeltilmelidir.',
      notes:[
        'Bu rapor ekonomik üstünlük veya üretime geçiş onayı değildir.',
        'Legacy S sayfası değiştirilmez.',
        'Gerçek başarı için gelecekte oluşan SAME_DAY/NEXT_DAY outcome kayıtları gerekir.'
      ]
    };
  }

  function startShadow(options) {
    const opts = options || {};
    const readinessReport = readiness({
      root:opts.root,
      qualityOptions:opts.qualityOptions,
      runTests:opts.runTests === true,
      requireAllTests:opts.requireAllTests
    });

    if (!readinessReport.valid) {
      const error = new Error('Gölge çalışma hazırlık denetimi başarısız.');
      error.name = 'ShadowReadinessError';
      error.readinessReport = readinessReport;
      throw error;
    }

    const root = opts.root || root_();
    if (typeof root.runDualArmShadowExperiment_ !== 'function') {
      throw new Error('runDualArmShadowExperiment_ bulunamadı.');
    }

    return {
      readiness:readinessReport,
      experiment:root.runDualArmShadowExperiment_({
        predictionTs:opts.predictionTs || new Date(),
        sessionKind:opts.sessionKind || 'SAME_DAY_EARLY',
        horizon:opts.horizon || 'SAME_DAY',
        legacyOptions:opts.legacyOptions || { sheetName:'S' },
        bindingOptions:opts.bindingOptions || { strict:false },
        qualityOptions:opts.qualityOptions || {}
      })
    };
  }

  return Object.freeze({
    version:VERSION,
    testNames:TEST_NAMES,
    runTests:runTests,
    readiness:readiness,
    startShadow:startShadow
  });
})();

function runAllProjectTests_(options) {
  const report = PROJECT_BOOTSTRAP.runTests(options || {});
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function auditProjectReadiness_(options) {
  const report = PROJECT_BOOTSTRAP.readiness(options || {});
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function startSameDayShadowPilot_(options) {
  const input = options || {};
  input.sessionKind = input.sessionKind || 'SAME_DAY_EARLY';
  input.horizon = 'SAME_DAY';
  return PROJECT_BOOTSTRAP.startShadow(input);
}

function startNextDayShadowPilot_(options) {
  const input = options || {};
  input.sessionKind = input.sessionKind || 'NEXT_DAY_CLOSE';
  input.horizon = 'NEXT_DAY';
  return PROJECT_BOOTSTRAP.startShadow(input);
}
