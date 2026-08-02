/** Kilit, durdurma ve hata güvenliği yardımcıları. */
function withScriptLock_(name, fn, waitMs) {
  const lock = LockService.getScriptLock();
  const timeout = Number.isFinite(waitMs) ? waitMs : 1000;

  if (!lock.tryLock(timeout)) {
    Logger.log(name + ' kilidi alınamadı; önceki işlem devam ediyor.');
    return null;
  }

  try {
    return fn();
  } catch (error) {
    Logger.log(name + ' çalışma hatası: ' + error);
    throw error;
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function withMainLock_(fn) {
  return withScriptLock_('MAIN', fn, 1000);
}

function withKsLock_(fn) {
  return withScriptLock_('KS', fn, 1000);
}

function haltPropertyKey_(block) {
  const normalized = String(block || '').trim().toUpperCase();
  if (normalized === 'MAIN') return APP_CONFIG.PROPERTY_KEYS.HALT_MAIN;
  if (normalized === 'KS') return APP_CONFIG.PROPERTY_KEYS.HALT_KS;
  throw new Error('Geçersiz çalışma bloğu: ' + block);
}

function isHalted_(block) {
  return appProps_().getProperty(haltPropertyKey_(block)) === 'ON';
}

function setHalted_(block, halted) {
  appProps_().setProperty(haltPropertyKey_(block), halted ? 'ON' : 'OFF');
}

function assertNotHalted_(block) {
  if (isHalted_(block)) {
    throw new Error(String(block).toUpperCase() + ' akışı durdurulmuş durumda.');
  }
}

function runWithDeferredFormatting_(sheet, workFn, formatFn) {
  __DEFER_FORMAT_UNTIL_DONE__ = true;
  try {
    return workFn();
  } finally {
    __DEFER_FORMAT_UNTIL_DONE__ = false;
    if (typeof formatFn === 'function') formatFn(sheet);
  }
}
