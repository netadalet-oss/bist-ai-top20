function runExpertCriteriaParityAuditTests_() {
  const audit = EXPERT_CRITERIA_PARITY_AUDIT.audit();
  assertExpertCriteria_(audit && audit.auditVersion === 'EXPERT-CRITERIA-PARITY-1.1.0', 'Audit version mismatch');
  assertExpertCriteria_(audit.legacyFunctions.length === 4, 'Legacy K1-K4 functions missing');
  assertExpertCriteria_(audit.unresolvedBlockers.length === 0,
    'Known K4 return-sign blocker must be fixed');
  assertExpertCriteria_(audit.validForPromotion === false,
    'Criteria set must remain shadow-only while open/quarantined hypotheses exist');

  const byCode = {};
  audit.findings.forEach(function (x) { byCode[x.code] = x; });
  assertExpertCriteria_(byCode.K3_GLOBAL_FIRST_NONEMPTY_WINDOW.status === 'FIXED',
    'K3 per-symbol adaptive window fix missing');
  assertExpertCriteria_(byCode.K2_MISSING_EMA_STACK_FALSE.status === 'FIXED',
    'K2 missing EMA behavior fix missing');
  assertExpertCriteria_(byCode.K1_DOTTED_ALIAS_NOT_RESOLVED.status === 'FIXED',
    'K1 dotted alias fix missing');
  assertExpertCriteria_(byCode.K1_LOWER_BAND_POSITION_UNBOUNDED.status === 'FIXED',
    'K1 lower-band clamp fix missing');
  assertExpertCriteria_(byCode.K4_STABILITY_ABSOLUTE_RETURN_SIGN_LOSS.status === 'FIXED',
    'K4 signed-return stability fix missing');
  assertExpertCriteria_(byCode.K1_HIGH_VOLATILITY_REWARDED.status === 'QUARANTINED',
    'K1 volatility direction must remain quarantined pending outcome evidence');
  assertExpertCriteria_(audit.quarantinedCriteria.length >= 3,
    'Expected quarantined expert hypotheses are missing');

  Logger.log('ExpertCriteriaParityAuditTest: OK');
  return true;
}

function assertExpertCriteria_(condition, message) {
  if (!condition) throw new Error('ExpertCriteriaParityAuditTest failed: ' + message);
}
