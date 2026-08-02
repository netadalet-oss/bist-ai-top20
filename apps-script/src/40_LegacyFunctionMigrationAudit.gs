/*
 * Read-only migration audit between the V_141225 legacy monolith and the
 * modular runtime. This module does not execute or modify the legacy source.
 * It documents critical replacements and blocks accidental co-loading of
 * legacy global entry points that can silently override modular behavior.
 */
var LEGACY_FUNCTION_MIGRATION_AUDIT = (function () {
  'use strict';

  const VERSION = 'LEGACY-FUNCTION-MIGRATION-1.0.0';
  const LEGACY_SOURCE_SHA256 = 'c380b93c4804533e866e79bdd36b44683afbbb973a318e0716862ce7b0dbaa0a';

  const DUPLICATE_DECLARATIONS = Object.freeze([
    { name:'_lastValid_', lines:[1527,1607], risk:'REVIEW' },
    { name:'betaSeries_', lines:[1581,1665], risk:'REVIEW' },
    { name:'bollingerSeries_', lines:[1575,1658], risk:'REVIEW' },
    { name:'buildQueuesByVeriZamani_', lines:[1348,2647], risk:'HIGH' },
    { name:'colByRegex', lines:[3626,6511], risk:'REVIEW' },
    { name:'colIdx', lines:[4019,4113], risk:'REVIEW' },
    { name:'emaSeries_', lines:[1529,1611], risk:'REVIEW' },
    { name:'findCol', lines:[1308,3663], risk:'REVIEW' },
    { name:'getBaseUrl_', lines:[170,3147], risk:'HIGH' },
    { name:'menu_DurdurVeTemizle', lines:[275,3066], risk:'HIGH' },
    { name:'parseLevels_', lines:[5087,6881], risk:'REVIEW' },
    { name:'pctChangeSeries_', lines:[1528,1610], risk:'REVIEW' },
    { name:'readRow_', lines:[2479,2645], risk:'HIGH' },
    { name:'rollingMean_', lines:[1563,1646], risk:'REVIEW' },
    { name:'rollingReturn_', lines:[1595,1679], risk:'REVIEW' },
    { name:'rollingStdev_', lines:[1544,1627], risk:'REVIEW' },
    { name:'rowForSymbolIndex_', lines:[2478,2646], risk:'HIGH' },
    { name:'rsiSeries_', lines:[1530,1612], risk:'REVIEW' },
    { name:'todayLabelTR_', lines:[1066,1109], risk:'REVIEW' },
    { name:'yenile_', lines:[2759,2916], risk:'HIGH' }
  ]);

  const CRITICAL_MIGRATIONS = Object.freeze([
    { legacy:'getBaseUrl_', replacement:'BIST_CONFIG / API client configuration', status:'REPLACED', module:'00_Config.gs, 05_ApiClient.gs' },
    { legacy:'buildQueuesByVeriZamani_', replacement:'VERILER_REPOSITORY symbol-indexed reads and writes', status:'REPLACED', module:'06_VerilerRepository.gs' },
    { legacy:'readRow_', replacement:'VERILER_REPOSITORY.readAllObjects', status:'REPLACED', module:'06_VerilerRepository.gs' },
    { legacy:'rowForSymbolIndex_', replacement:'VERILER_REPOSITORY.buildSymbolIndex', status:'REPLACED', module:'06_VerilerRepository.gs' },
    { legacy:'yenile_', replacement:'scheduler session handlers and runtime input adapter', status:'REPLACED', module:'21_SchedulerAndMaintenance.gs, 23_RuntimeInputAdapter.gs' },
    { legacy:'menu_DurdurVeTemizle', replacement:'safe maintenance commands with dry-run and confirmation token', status:'REPLACED', module:'21_SchedulerAndMaintenance.gs' },
    { legacy:'emaSeries_', replacement:'INDICATORS EMA implementation', status:'REPLACED', module:'07_Indicators.gs' },
    { legacy:'rsiSeries_', replacement:'INDICATORS RSI implementation', status:'REPLACED', module:'07_Indicators.gs' },
    { legacy:'bollingerSeries_', replacement:'INDICATORS Bollinger implementation', status:'REPLACED', module:'07_Indicators.gs' },
    { legacy:'rollingMean_', replacement:'pure indicator/statistical helpers', status:'REPLACED', module:'07_Indicators.gs' },
    { legacy:'rollingStdev_', replacement:'pure indicator/statistical helpers', status:'REPLACED', module:'07_Indicators.gs' },
    { legacy:'parseLevels_', replacement:'LIVE_WORKBOOK_CORRECTIONS support/resistance parser', status:'REPLACED', module:'33_LiveWorkbookCorrections.gs' },
    { legacy:'K1-K5 block', replacement:'EXPERT_MODELS and CONSENSUS_MODEL', status:'REPLACED', module:'10_ExpertModels.gs, 11_ConsensusModel.gs' },
    { legacy:'K_Tarihsel block', replacement:'snapshot outcome and metrics pipeline', status:'REPLACED', module:'12_SnapshotStore.gs through 15_FirstTop20Entry.gs' },
    { legacy:'S criteria race', replacement:'S_SELECTION_ENGINE and runtime binding', status:'REPLACED', module:'16_SSelectionEngine.gs, 20_RuntimeModelBinding.gs' }
  ]);

  // These names must not be present in the modular deployment. Their presence
  // strongly indicates that the full legacy monolith was loaded alongside the
  // modular files, allowing later declarations to override one another.
  const FORBIDDEN_COLOADED_GLOBALS = Object.freeze([
    'buildQueuesByVeriZamani_', 'getBaseUrl_', 'menu_DurdurVeTemizle',
    'readRow_', 'rowForSymbolIndex_', 'yenile_'
  ]);

  function globalObject_() {
    return typeof globalThis !== 'undefined' ? globalThis : this;
  }

  function audit(options) {
    const opts = options || {};
    const root = opts.root || globalObject_();
    const collisions = FORBIDDEN_COLOADED_GLOBALS.filter(function (name) {
      return typeof root[name] !== 'undefined';
    });
    const highRiskDuplicates = DUPLICATE_DECLARATIONS.filter(function (row) {
      return row.risk === 'HIGH';
    });
    const unresolved = CRITICAL_MIGRATIONS.filter(function (row) {
      return row.status !== 'REPLACED';
    });

    return {
      auditVersion: VERSION,
      legacySourceSha256: LEGACY_SOURCE_SHA256,
      legacyNamedDeclarations: 280,
      legacyUniqueNames: 260,
      duplicateDeclarationCount: DUPLICATE_DECLARATIONS.length,
      highRiskDuplicateCount: highRiskDuplicates.length,
      duplicateDeclarations: DUPLICATE_DECLARATIONS.slice(),
      criticalMigrations: CRITICAL_MIGRATIONS.slice(),
      unresolvedCriticalMigrations: unresolved,
      forbiddenColoadedGlobals: FORBIDDEN_COLOADED_GLOBALS.slice(),
      detectedLegacyCollisions: collisions,
      valid: unresolved.length === 0 && collisions.length === 0,
      notes: [
        'This audit verifies the documented critical migration surface, not all 260 legacy names.',
        'The V_141225 monolith must remain an immutable reference and must not be deployed with modular files.',
        'Nested duplicate helper names require source-scope review but are not automatically runtime defects.'
      ]
    };
  }

  function assertValid(options) {
    const report = audit(options);
    if (!report.valid) {
      const error = new Error('Legacy/modüler fonksiyon geçişi güvenli değil: ' +
        report.detectedLegacyCollisions.join(', '));
      error.name = 'LegacyFunctionMigrationError';
      error.migrationReport = report;
      throw error;
    }
    return report;
  }

  return Object.freeze({
    version: VERSION,
    duplicateDeclarations: DUPLICATE_DECLARATIONS,
    criticalMigrations: CRITICAL_MIGRATIONS,
    forbiddenColoadedGlobals: FORBIDDEN_COLOADED_GLOBALS,
    audit: audit,
    assertValid: assertValid
  });
})();

function auditLegacyFunctionMigration_() {
  const report = LEGACY_FUNCTION_MIGRATION_AUDIT.audit();
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function assertLegacyFunctionMigration_() {
  return LEGACY_FUNCTION_MIGRATION_AUDIT.assertValid();
}
