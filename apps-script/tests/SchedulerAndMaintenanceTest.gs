function runSchedulerAndMaintenanceTests_() {
  const assert_ = function (condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  };

  const saturday = new Date('2026-08-01T10:00:00+03:00');
  const monday = new Date('2026-08-03T10:00:00+03:00');
  assert_(!SCHEDULER_AND_MAINTENANCE.isTradingDay(saturday, {}), 'Cumartesi işlem günü olmamalı.');
  assert_(SCHEDULER_AND_MAINTENANCE.isTradingDay(monday, {}), 'Pazartesi işlem günü olmalı.');
  assert_(!SCHEDULER_AND_MAINTENANCE.isTradingDay(monday, { holidays: ['2026-08-03'] }), 'Tatil tarihi atlanmalı.');

  const sessions = SCHEDULER_AND_MAINTENANCE.sessions;
  assert_(sessions.SAME_DAY_EARLY.horizon === 'SAME_DAY', 'Erken seans horizon hatalı.');
  assert_(sessions.NEXT_DAY_CLOSE.horizon === 'NEXT_DAY', 'Kapanış horizon hatalı.');
  assert_(sessions.SAME_DAY_EARLY.functionName !== sessions.SAME_DAY_MID.functionName, 'Trigger handler adları benzersiz olmalı.');

  const audit = SCHEDULER_AND_MAINTENANCE.audit();
  assert_(audit.timezone === 'Europe/Istanbul', 'Scheduler timezone hatalı.');
  assert_(audit.expectedHandlers.length === 3, 'Üç beklenen handler olmalı.');

  const dryRun = SCHEDULER_AND_MAINTENANCE.cleanupRunLog({ dryRun: true, retentionDays: 180 });
  assert_(dryRun.dryRun === true, 'Bakım varsayılan olarak dry-run olmalı.');
  assert_(dryRun.removedRows === 0, 'Dry-run satır silmemeli.');

  return {
    ok: true,
    version: SCHEDULER_AND_MAINTENANCE.version,
    tests: 10
  };
}
