function assertLegacyMigration_(condition, message) {
  if (!condition) throw new Error('LegacyFunctionMigrationAuditTest: ' + message);
}

function runLegacyFunctionMigrationAuditTests_() {
  const cleanRoot = {};
  const clean = LEGACY_FUNCTION_MIGRATION_AUDIT.audit({ root: cleanRoot });
  assertLegacyMigration_(clean.duplicateDeclarationCount === 20, '20 mükerrer bildirim');
  assertLegacyMigration_(clean.legacyNamedDeclarations === 280, '280 bildirim');
  assertLegacyMigration_(clean.legacyUniqueNames === 260, '260 benzersiz ad');
  assertLegacyMigration_(clean.unresolvedCriticalMigrations.length === 0, 'kritik geçişlerin eşlenmesi');
  assertLegacyMigration_(clean.valid === true, 'temiz modüler dağıtım');

  const pollutedRoot = { yenile_: function () {}, getBaseUrl_: function () {} };
  const polluted = LEGACY_FUNCTION_MIGRATION_AUDIT.audit({ root: pollutedRoot });
  assertLegacyMigration_(polluted.valid === false, 'legacy çakışmasının engellenmesi');
  assertLegacyMigration_(polluted.detectedLegacyCollisions.indexOf('yenile_') >= 0, 'yenile_ çakışması');
  assertLegacyMigration_(polluted.detectedLegacyCollisions.indexOf('getBaseUrl_') >= 0, 'getBaseUrl_ çakışması');

  let thrown = null;
  try {
    LEGACY_FUNCTION_MIGRATION_AUDIT.assertValid({ root: pollutedRoot });
  } catch (err) {
    thrown = err;
  }
  assertLegacyMigration_(thrown && thrown.name === 'LegacyFunctionMigrationError', 'fail-closed hata türü');
  assertLegacyMigration_(thrown && thrown.migrationReport, 'hata raporu');

  Logger.log('Legacy function migration audit tests passed.');
  return true;
}
