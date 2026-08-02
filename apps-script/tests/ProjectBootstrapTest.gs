function runProjectBootstrapTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error('ProjectBootstrapTest failed: ' + message);
  }

  const testRoot = {
    runIndicatorsTests_:function () { return 'INDICATORS_OK'; },
    runFeaturePipelineTests_:function () { return true; }
  };
  const tests = PROJECT_BOOTSTRAP.runTests({ root:testRoot, requireAll:false });
  assert_(tests.counts.PASSED === 2, 'Synthetic test functions must pass');
  assert_(tests.counts.FAILED === 0, 'Synthetic suite must not fail');
  assert_(tests.counts.MISSING > 0, 'Undeployed test functions must be reported missing');
  assert_(tests.valid === true, 'Missing optional tests must not invalidate requireAll=false');

  let shadowInput = null;
  const readyRoot = {
    APPS_SCRIPT_INTEGRITY_AUDIT:{ audit:function () { return { valid:true }; } },
    LEGACY_FUNCTION_MIGRATION_AUDIT:{ audit:function () { return { valid:true }; } },
    auditVerilerCanonicalSchema_:function () { return { valid:true }; },
    auditLiveModelFeatureCoverage_:function () { return { valid:true }; },
    auditSCriteriaParity_:function () { return { valid:true }; },
    auditExpertCriteriaParity_:function () { return { valid:true }; },
    runDualArmShadowExperiment_:function (input) {
      shadowInput = input;
      return { experimentId:'TEST-EXPERIMENT' };
    }
  };

  const readiness = PROJECT_BOOTSTRAP.readiness({ root:readyRoot });
  assert_(readiness.valid === true, 'Complete synthetic readiness must pass');
  assert_(readiness.mode === 'SHADOW_ONLY', 'Readiness mode must remain SHADOW_ONLY');

  const shadow = PROJECT_BOOTSTRAP.startShadow({
    root:readyRoot,
    predictionTs:new Date('2026-08-02T08:30:00Z'),
    sessionKind:'SAME_DAY_EARLY',
    horizon:'SAME_DAY'
  });
  assert_(shadow.experiment.experimentId === 'TEST-EXPERIMENT', 'Shadow experiment result missing');
  assert_(shadowInput && shadowInput.horizon === 'SAME_DAY', 'Shadow horizon not forwarded');
  assert_(shadowInput.legacyOptions.sheetName === 'S', 'Legacy S sheet must be default source');

  const brokenRoot = {
    APPS_SCRIPT_INTEGRITY_AUDIT:{ audit:function () { return { valid:false }; } },
    LEGACY_FUNCTION_MIGRATION_AUDIT:{ audit:function () { return { valid:true }; } },
    auditVerilerCanonicalSchema_:function () { return { valid:true }; },
    auditLiveModelFeatureCoverage_:function () { return { valid:true }; },
    auditSCriteriaParity_:function () { return { valid:true }; },
    auditExpertCriteriaParity_:function () { return { valid:true }; },
    runDualArmShadowExperiment_:function () { throw new Error('Must not run'); }
  };
  const blocked = PROJECT_BOOTSTRAP.readiness({ root:brokenRoot });
  assert_(blocked.valid === false, 'Invalid integrity report must block readiness');
  assert_(blocked.failedRequired.indexOf('appsScriptIntegrity') >= 0,
    'Failed integrity check must be visible');

  Logger.log('ProjectBootstrapTest: OK');
  return true;
}
