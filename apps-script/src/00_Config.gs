/**
 * Merkezi yapılandırma.
 * Aynı ayarın birden fazla PropertiesService anahtarıyla tutulmasını önler.
 */
const APP_CONFIG = Object.freeze({
  SHEET_NAME: 'Veriler',
  TIMEZONE: 'Europe/Istanbul',
  MONTHS_BACK: 14,
  MAX_T_DEPTH: 90,
  MARKET_OPEN_HH: 9,
  MARKET_OPEN_MM: 30,
  MARKET_CLOSE_HH: 22,
  MARKET_CLOSE_MM: 0,
  TOP_N: 20,
  PROPERTY_KEYS: Object.freeze({
    SYMBOLS_MODE: 'CFG.SYMBOLS.MODE',
    SYMBOLS_CUSTOM_JSON: 'CFG.SYMBOLS.CUSTOM.JSON',
    BASE_URL_OVERRIDE: 'CFG.API.BASE_URL.OVERRIDE',
    LIVE_URL_TEMPLATE: 'CFG.API.LIVE.URL.TEMPLATE',
    LIVE_JSON_PATH_LAST: 'CFG.API.LIVE.JSON_PATH.LAST',
    LIVE_ENABLED: 'CFG.API.LIVE.ENABLED',
    LAST_HEADER_SIGNATURE: 'STATE.VERILER.HEADER_SIGNATURE',
    LAST_PROGRESS_INDEX: 'STATE.VERILER.LAST_PROGRESS_INDEX',
    HALT_MAIN: 'STATE.HALT.MAIN',
    HALT_KS: 'STATE.HALT.KS'
  })
});

const DEFAULT_BASE_URL =
  'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse=';

function appProps_() {
  return PropertiesService.getDocumentProperties();
}

function getBaseUrl_() {
  const value = appProps_().getProperty(APP_CONFIG.PROPERTY_KEYS.BASE_URL_OVERRIDE);
  return String(value || DEFAULT_BASE_URL).trim();
}

function setBaseUrl_(url) {
  const value = String(url || '').trim();
  if (!value) {
    appProps_().deleteProperty(APP_CONFIG.PROPERTY_KEYS.BASE_URL_OVERRIDE);
    return;
  }
  appProps_().setProperty(APP_CONFIG.PROPERTY_KEYS.BASE_URL_OVERRIDE, value);
}

function getActiveSymbols_() {
  const mode = appProps_().getProperty(APP_CONFIG.PROPERTY_KEYS.SYMBOLS_MODE) || 'ALL';
  if (mode !== 'CUSTOM') return SYMBOLS.slice();

  let parsed = [];
  try {
    parsed = JSON.parse(
      appProps_().getProperty(APP_CONFIG.PROPERTY_KEYS.SYMBOLS_CUSTOM_JSON) || '[]'
    );
  } catch (_) {
    parsed = [];
  }

  const universe = new Set(SYMBOLS);
  const normalized = Array.from(new Set(
    parsed
      .map(symbol => String(symbol || '').trim().toUpperCase())
      .filter(symbol => universe.has(symbol))
  ));

  return normalized.length ? normalized : SYMBOLS.slice();
}

function setCustomSymbols_(symbols) {
  const universe = new Set(SYMBOLS);
  const normalized = Array.from(new Set(
    (symbols || [])
      .map(symbol => String(symbol || '').trim().toUpperCase())
      .filter(symbol => universe.has(symbol))
  ));

  if (!normalized.length) {
    appProps_().setProperty(APP_CONFIG.PROPERTY_KEYS.SYMBOLS_MODE, 'ALL');
    appProps_().deleteProperty(APP_CONFIG.PROPERTY_KEYS.SYMBOLS_CUSTOM_JSON);
    return;
  }

  appProps_().setProperty(APP_CONFIG.PROPERTY_KEYS.SYMBOLS_MODE, 'CUSTOM');
  appProps_().setProperty(
    APP_CONFIG.PROPERTY_KEYS.SYMBOLS_CUSTOM_JSON,
    JSON.stringify(normalized)
  );
}
