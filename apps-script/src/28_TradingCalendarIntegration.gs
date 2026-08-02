/*
 * Compatibility and integration helpers for the centralized BIST calendar.
 * Existing scheduler/outcome modules can call these wrappers without keeping
 * independent weekend/holiday arrays.
 */
function getBistSession_(dateValue) {
  return BIST_TRADING_CALENDAR.session(dateValue);
}

function isBistTradingDay_(dateValue) {
  return BIST_TRADING_CALENDAR.isTradingDay(dateValue);
}

function nextBistTradingDay_(dateValue) {
  return BIST_TRADING_CALENDAR.nextTradingDay(dateValue);
}

function previousBistTradingDay_(dateValue) {
  return BIST_TRADING_CALENDAR.previousTradingDay(dateValue);
}

function getBistEvaluationDate_(predictionTs, horizon) {
  const h = String(horizon || '').toUpperCase();
  if (h === 'SAME_DAY' || h === 'SAME_DAY_CLOSE') {
    if (!isBistTradingDay_(predictionTs)) {
      throw new Error('SAME_DAY değerlendirmesi işlem günü dışında oluşturulamaz.');
    }
    return new Date(predictionTs);
  }
  if (h === 'NEXT_DAY' || h === 'NEXT_TRADING_DAY_CLOSE') {
    return nextBistTradingDay_(predictionTs);
  }
  throw new Error('Desteklenmeyen horizon: ' + horizon);
}

function validateScheduledSession_(predictionTs, sessionKind) {
  const session = getBistSession_(predictionTs);
  if (session.state === 'CLOSED') {
    return { ok: false, code: 'NON_TRADING_DAY', session: session };
  }

  const kind = String(sessionKind || '').toUpperCase();
  if (session.state === 'HALF_DAY' && kind === 'NEXT_DAY_CLOSE') {
    return {
      ok: false,
      code: 'HALF_DAY_CLOSE_SESSION_DISABLED',
      session: session
    };
  }

  return { ok: true, code: 'OK', session: session };
}

function auditTradingCalendarIntegration_() {
  const now = new Date();
  const report = {
    calendar: BIST_TRADING_CALENDAR.audit(),
    currentSession: getBistSession_(now),
    nextTradingDay: BIST_TRADING_CALENDAR.dateKey(nextBistTradingDay_(now))
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
