function runBistTradingCalendarTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error('BIST calendar test failed: ' + message);
  }

  assert_(getBistSession_(new Date('2026-01-01T09:00:00+03:00')).state === 'CLOSED', 'New Year must be closed');
  assert_(getBistSession_(new Date('2026-03-19T09:00:00+03:00')).state === 'HALF_DAY', 'Ramadan eve must be half day');
  assert_(getBistSession_(new Date('2026-03-19T09:00:00+03:00')).closeTime === '13:00', 'Half day close must be 13:00');
  assert_(getBistSession_(new Date('2026-03-23T09:00:00+03:00')).state === 'FULL_DAY', '23 March 2026 must be full day');
  assert_(BIST_TRADING_CALENDAR.dateKey(nextBistTradingDay_(new Date('2026-03-19T09:00:00+03:00'))) === '2026-03-23', 'Next day must skip feast and weekend');
  assert_(validateScheduledSession_(new Date('2026-10-28T09:00:00+03:00'), 'NEXT_DAY_CLOSE').ok === false, 'Close session must be disabled on half day');
  assert_(getBistEvaluationDate_(new Date('2026-10-28T09:00:00+03:00'), 'NEXT_DAY').getTime() > new Date('2026-10-28T09:00:00+03:00').getTime(), 'Next-day evaluation must be later');

  Logger.log('BIST trading calendar tests passed.');
  return true;
}
