function runExpertCriteriaParityAuditTests_() {
  const audit = EXPERT_CRITERIA_PARITY_AUDIT.audit();
  assertExpertCriteria_(audit && audit.auditVersion === 'EXPERT-CRITERIA-PARITY-1.0.0', 'Audit version mismatch');
  assertExpertCriteria_(audit.legacyFunctions.length === 4, 'Legacy K1-K4 functions missing');
  assertExpertCriteria_(audit.unresolvedBlockers.indexOf('K4_STABILITY_ABSOLUTE_RETURN_SIGN_LOSS') >= 0,
    'K4 return-sign blocker must stay visible until fixed');
  assertExpertCriteria_(audit.validForPromotion === false,
    'Criteria set must not be promotion-eligible while blocker is open');

  const byCode = {};
  audit.findings.forEach(function (x) { byCode[x.code] = x; });
  assertExpertCriteria_(byCode.K3_GLOBAL_FIRST_NONEMPTY_WINDOW.status === 'FIXED',
    'K3 per-symbol adaptive window fix missing');
  assertExpertCriteria_(byCode.K2_MISSING_EMA_STACK_FALSE.status === 'FIXED',
    'K2 missing EMA behavior fix missing');
  assertExpertCriteria_(byCode.K1_DOTTED_ALIAS_NOT_RESOLVED.status === 'OPEN',
    'K1 dotted alias defect must remain open until implementation changes');
  assertExpertCriteria_(byCode.K1_HIGH_VOLATILITY_REWARDED.status === 'QUARANTINED',
    'K1 volatility direction must remain quarantined pending outcome evidence');

  Logger.log('ExpertCriteriaParityAuditTest: OK');
  return true;
}

function assertExpertCriteria_(condition, message) {
  if (!condition) throw new Error('ExpertCriteriaParityAuditTest failed: ' + message);
}
