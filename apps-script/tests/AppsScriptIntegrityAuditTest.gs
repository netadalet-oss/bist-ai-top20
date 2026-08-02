function assertAppsScriptIntegrityTest_(condition, message) {
  if (!condition) throw new Error('AppsScriptIntegrityAuditTest: ' + message);
}

function runAppsScriptIntegrityAuditTests_() {
  const noop = function () {};
  const root = {
    BIST_CONFIG: {},
    VERILER_REPOSITORY: { readPlan:noop, readAllObjects:noop, writeRowsBySymbol:noop, audit:noop },
    MODEL_CORE: {},
    EXPERT_MODELS: { K1:noop, K2:noop, K3:noop, K4:noop },
    CONSENSUS_MODEL: { build:noop },
    SNAPSHOT_STORE: {},
    S_SELECTION_ENGINE: {},
    MODEL_REGISTRY: {},
    RUNTIME_MODEL_BINDING: {},
    RUNTIME_INPUT_ADAPTER: { toFeature:noop, readFeatures:noop, buildExpertResults:noop, build:noop },
    MODEL_FEATURE_COVERAGE_AUDIT: { auditFeatures:noop, auditLive:noop },
    RUNTIME_DATA_QUALITY_GATE: { evaluate:noop, enforce:noop, assertAllowed:noop },
    RUN_LOG_QUALITY_INTEGRATION: { fromError:noop, safeJson:noop },
    SCHEDULER_AND_MAINTENANCE: { runSession:noop, audit:noop, maintenanceAudit:noop },
    LEGACY_FUNCTION_MIGRATION_AUDIT: {
      audit:function (input) {
        const r = input && input.root || {};
        const collisions = ['yenile_','getBaseUrl_'].filter(function (name) { return typeof r[name] !== 'undefined'; });
        return { valid:collisions.length === 0, detectedLegacyCollisions:collisions };
      },
      assertValid:noop
    },
    normalizeHeader_:noop,
    parseLocalizedNumber_:noop,
    buildRuntimeInputs_:noop,
    runEndToEndSSelection_:noop,
    saveEndToEndSSelectionSnapshot_:noop,
    buildRuntimeSSelection_:noop,
    saveRuntimeSSelectionSnapshot_:noop,
    auditLiveModelFeatureCoverage_:noop,
    auditLegacyFunctionMigration_:noop,
    scheduledSameDayEarlySnapshot_:noop,
    scheduledSameDayMidSnapshot_:noop,
    scheduledNextDayCloseSnapshot_:noop
  };

  const valid = APPS_SCRIPT_INTEGRITY_AUDIT.audit({ root:root });
  assertAppsScriptIntegrityTest_(valid.valid === true, 'tam sözleşme geçmeli');
  assertAppsScriptIntegrityTest_(valid.brokenRuntimeChain.length === 0, 'runtime zinciri tam olmalı');
  assertAppsScriptIntegrityTest_(valid.legacyCollisions.length === 0, 'legacy çakışması olmamalı');

  root.yenile_ = noop;
  const legacyBroken = APPS_SCRIPT_INTEGRITY_AUDIT.audit({ root:root });
  assertAppsScriptIntegrityTest_(legacyBroken.valid === false, 'legacy global bütünlüğü bozmalı');
  assertAppsScriptIntegrityTest_(legacyBroken.legacyCollisions.indexOf('yenile_') >= 0, 'legacy çakışması raporlanmalı');
  delete root.yenile_;

  delete root.RUNTIME_DATA_QUALITY_GATE;
  const broken = APPS_SCRIPT_INTEGRITY_AUDIT.audit({ root:root });
  assertAppsScriptIntegrityTest_(broken.valid === false, 'eksik global denetimi bozmalı');
  assertAppsScriptIntegrityTest_(broken.missingSymbols.indexOf('RUNTIME_DATA_QUALITY_GATE') >= 0, 'eksik sembol raporlanmalı');
  assertAppsScriptIntegrityTest_(broken.brokenRuntimeChain.indexOf('RUNTIME_DATA_QUALITY_GATE.enforce') >= 0, 'kırık zincir raporlanmalı');

  let threw = false;
  try { APPS_SCRIPT_INTEGRITY_AUDIT.assertValid({ root:root }); }
  catch (err) { threw = err && err.name === 'AppsScriptIntegrityError' && !!err.integrityReport; }
  assertAppsScriptIntegrityTest_(threw, 'assertValid yapılandırılmış hata üretmeli');

  Logger.log('AppsScriptIntegrityAudit tests passed.');
  return true;
}
