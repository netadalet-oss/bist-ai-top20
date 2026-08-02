function assertSchedulerIntegrityPreflight_(condition, message) {
  if (!condition) throw new Error('SchedulerIntegrityPreflightTest: ' + message);
}

function runSchedulerIntegrityPreflightTests_() {
  let called = 0;
  const passingAudit = {
    assertValid: function () {
      called++;
      return { valid:true, auditVersion:'TEST' };
    }
  };
  const ok = SCHEDULER_AND_MAINTENANCE.preflightIntegrity({ audit:passingAudit });
  assertSchedulerIntegrityPreflight_(ok.valid === true, 'başarılı bütünlük raporu');
  assertSchedulerIntegrityPreflight_(called === 1, 'denetleyici bir kez çağrılmalı');

  const bypass = SCHEDULER_AND_MAINTENANCE.preflightIntegrity({
    enabled:false,
    bypassReason:'MANUAL_DIAGNOSTIC_ONLY'
  });
  assertSchedulerIntegrityPreflight_(bypass.bypassed === true, 'açık bypass kaydı');
  assertSchedulerIntegrityPreflight_(bypass.bypassReason === 'MANUAL_DIAGNOSTIC_ONLY', 'bypass nedeni');

  const failingAudit = {
    assertValid: function () {
      const error = new Error('broken');
      error.name = 'AppsScriptIntegrityError';
      error.integrityReport = {
        valid:false,
        missingSymbols:['RUNTIME_DATA_QUALITY_GATE'],
        missingMethods:['RUN_LOG_QUALITY_INTEGRATION.fromError'],
        brokenRuntimeChain:['RUNTIME_DATA_QUALITY_GATE.enforce']
      };
      throw error;
    }
  };

  let failed = false;
  try {
    SCHEDULER_AND_MAINTENANCE.preflightIntegrity({ audit:failingAudit });
  } catch (err) {
    failed = true;
    const details = SCHEDULER_AND_MAINTENANCE.failureDetails(err);
    assertSchedulerIntegrityPreflight_(details.isIntegrityFailure === true, 'bütünlük hatası sınıflandırması');
    assertSchedulerIntegrityPreflight_(SCHEDULER_AND_MAINTENANCE.failureStatus(details) === 'FAILED_INTEGRITY', 'ayrı durum kodu');
    assertSchedulerIntegrityPreflight_(details.reasonCodes.indexOf('MISSING_SYMBOLS') >= 0, 'eksik sembol neden kodu');
    assertSchedulerIntegrityPreflight_(details.reasonCodes.indexOf('BROKEN_RUNTIME_CHAIN') >= 0, 'kırık zincir neden kodu');
    assertSchedulerIntegrityPreflight_(details.qualityFields.indexOf('RUNTIME_DATA_QUALITY_GATE') >= 0, 'eksik sembol kaydı');
  }
  assertSchedulerIntegrityPreflight_(failed, 'başarısız denetim hata üretmeli');

  Logger.log('Scheduler integrity preflight tests passed.');
  return true;
}
