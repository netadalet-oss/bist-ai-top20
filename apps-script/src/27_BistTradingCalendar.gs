/*
 * Central Borsa Istanbul trading calendar provider.
 * Official source: https://www.borsaistanbul.com/resmi-tatil-gunleri
 *
 * The provider keeps scheduler/outcome/next-day logic on one contract.
 * Official-page refresh is best effort; verified seed data remains available
 * and all source/freshness information is exposed by audit().
 */
var BIST_TRADING_CALENDAR = (function () {
  'use strict';

  const VERSION = 'BIST-CALENDAR-1.0.0';
  const TZ = 'Europe/Istanbul';
  const SOURCE_URL = 'https://www.borsaistanbul.com/resmi-tatil-gunleri';
  const PROP_KEY = 'BIST.CALENDAR.JSON';

  const VERIFIED_SEED = Object.freeze({
    '2025-01-01': { state: 'CLOSED', name: 'Yeni Yıl Tatili' },
    '2025-03-29': { state: 'CLOSED', name: 'Ramazan Bayramı Arefesi' },
    '2025-03-30': { state: 'CLOSED', name: 'Ramazan Bayramı' },
    '2025-03-31': { state: 'CLOSED', name: 'Ramazan Bayramı' },
    '2025-04-01': { state: 'CLOSED', name: 'Ramazan Bayramı' },
    '2025-04-23': { state: 'CLOSED', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
    '2025-05-01': { state: 'CLOSED', name: 'Emek ve Dayanışma Günü' },
    '2025-05-19': { state: 'CLOSED', name: "Atatürk'ü Anma Gençlik ve Spor Bayramı" },
    '2025-06-05': { state: 'HALF_DAY', closeTime: '13:00', name: 'Kurban Bayramı Arefesi' },
    '2025-06-06': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2025-06-07': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2025-06-08': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2025-06-09': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2025-07-15': { state: 'CLOSED', name: 'Demokrasi ve Milli Birlik Günü' },
    '2025-08-30': { state: 'CLOSED', name: 'Zafer Bayramı' },
    '2025-10-28': { state: 'HALF_DAY', closeTime: '13:00', name: 'Cumhuriyet Bayramı' },
    '2025-10-29': { state: 'CLOSED', name: 'Cumhuriyet Bayramı' },

    '2026-01-01': { state: 'CLOSED', name: 'Yeni Yıl Tatili' },
    '2026-03-19': { state: 'HALF_DAY', closeTime: '13:00', name: 'Ramazan Bayramı Arefesi' },
    '2026-03-20': { state: 'CLOSED', name: 'Ramazan Bayramı' },
    '2026-03-21': { state: 'CLOSED', name: 'Ramazan Bayramı' },
    '2026-03-22': { state: 'CLOSED', name: 'Ramazan Bayramı' },
    '2026-04-23': { state: 'CLOSED', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
    '2026-05-01': { state: 'CLOSED', name: 'Emek ve Dayanışma Günü' },
    '2026-05-19': { state: 'CLOSED', name: "Atatürk'ü Anma Gençlik ve Spor Bayramı" },
    '2026-05-26': { state: 'HALF_DAY', closeTime: '13:00', name: 'Kurban Bayramı Arefesi' },
    '2026-05-27': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2026-05-28': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2026-05-29': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2026-05-30': { state: 'CLOSED', name: 'Kurban Bayramı' },
    '2026-07-15': { state: 'CLOSED', name: 'Demokrasi ve Milli Birlik Günü' },
    '2026-08-30': { state: 'CLOSED', name: 'Zafer Bayramı' },
    '2026-10-28': { state: 'HALF_DAY', closeTime: '13:00', name: 'Cumhuriyet Bayramı' },
    '2026-10-29': { state: 'CLOSED', name: 'Cumhuriyet Bayramı' }
  });

  function dateKey_(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) throw new Error('Geçersiz takvim tarihi: ' + value);
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  }

  function weekday_(value) {
    const d = value instanceof Date ? value : new Date(value);
    return Number(Utilities.formatDate(d, TZ, 'u')); // 1 Monday ... 7 Sunday
  }

  function stored_() {
    const raw = PropertiesService.getDocumentProperties().getProperty(PROP_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && parsed.days ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function mergedDays_() {
    const days = Object.assign({}, VERIFIED_SEED);
    const stored = stored_();
    if (stored && stored.days) Object.keys(stored.days).forEach(k => { days[k] = stored.days[k]; });
    return days;
  }

  function session(value) {
    const key = dateKey_(value);
    const wd = weekday_(value);
    if (wd >= 6) return { date: key, state: 'CLOSED', reason: 'WEEKEND', closeTime: null };
    const special = mergedDays_()[key];
    if (special) return Object.assign({ date: key, reason: 'OFFICIAL_CALENDAR' }, special);
    return { date: key, state: 'FULL_DAY', reason: 'REGULAR_WEEKDAY', closeTime: '18:10' };
  }

  function isTradingDay(value) {
    return session(value).state !== 'CLOSED';
  }

  function isFullDay(value) {
    return session(value).state === 'FULL_DAY';
  }

  function nextTradingDay(value) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(d.getTime())) throw new Error('Geçersiz başlangıç tarihi.');
    for (let i = 0; i < 370; i++) {
      d.setDate(d.getDate() + 1);
      if (isTradingDay(d)) return new Date(d.getTime());
    }
    throw new Error('370 gün içinde sonraki işlem günü bulunamadı.');
  }

  function previousTradingDay(value) {
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (isNaN(d.getTime())) throw new Error('Geçersiz başlangıç tarihi.');
    for (let i = 0; i < 370; i++) {
      d.setDate(d.getDate() - 1);
      if (isTradingDay(d)) return new Date(d.getTime());
    }
    throw new Error('370 gün içinde önceki işlem günü bulunamadı.');
  }

  function saveOfficialDays_(days, fetchedTs, parserVersion) {
    const payload = {
      sourceUrl: SOURCE_URL,
      fetchedTs: new Date(fetchedTs || Date.now()).toISOString(),
      parserVersion: parserVersion || 'manual-import',
      days: days || {}
    };
    PropertiesService.getDocumentProperties().setProperty(PROP_KEY, JSON.stringify(payload));
    return payload;
  }

  function audit() {
    const stored = stored_();
    return {
      version: VERSION,
      timeZone: TZ,
      sourceUrl: SOURCE_URL,
      seedDayCount: Object.keys(VERIFIED_SEED).length,
      storedDayCount: stored && stored.days ? Object.keys(stored.days).length : 0,
      storedFetchedTs: stored ? stored.fetchedTs || null : null,
      sourceMode: stored ? 'OFFICIAL_REFRESH_PLUS_SEED' : 'VERIFIED_SEED',
      today: session(new Date())
    };
  }

  return Object.freeze({
    VERSION: VERSION,
    TIME_ZONE: TZ,
    SOURCE_URL: SOURCE_URL,
    dateKey: dateKey_,
    session: session,
    isTradingDay: isTradingDay,
    isFullDay: isFullDay,
    nextTradingDay: nextTradingDay,
    previousTradingDay: previousTradingDay,
    saveOfficialDays: saveOfficialDays_,
    audit: audit
  });
})();

function auditBistTradingCalendar_() {
  const report = BIST_TRADING_CALENDAR.audit();
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
