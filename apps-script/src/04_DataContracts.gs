/**
 * Canonical row contracts shared by Veriler, K1-K5, K_Tarihsel and S.
 *
 * This module does not change model weights. It prevents silent field swaps,
 * mixed timestamps and ambiguous numeric values while the legacy code is
 * migrated.
 */

const AURUM_SCHEMA_VERSION = '2026-08-02.2';

const AURUM_CONTRACTS = Object.freeze({
  VERILER_REQUIRED_HEADERS: Object.freeze([
    'Hisse',
    'VeriZamani',
    'Anlik',
    'AnlikDegisim%',
    'KapanisTarihi_T0',
    'FiyatDegisim%_T0',
    'Kapanis_T0',
    'Hacim_T0',
    'EMA20_T0',
    'EMA50_T0',
    'EMA200_T0',
    'MACD_T0',
    'MACDSignal_T0',
    'MACDHist_T0',
    'RSI14_T0',
    'Momentum10_T0'
  ]),

  KN_HEADERS: Object.freeze([
    'Hisse',
    'VeriZamani',
    'AnlikDegisim%',
    'Anlik',
    'Maliyet',
    'Getiri',
    'IlkGirisZamani',
    'Degisim3Gun(%)_T0',
    'Destekler(3)_T0',
    'Direncler(3)_T0',
    'KapanisTarihi_T0',
    'FiyatDegisim%_T0',
    'Kapanis_T0',
    'Skor'
  ]),

  S_REQUIRED_FIELDS: Object.freeze([
    'snapshotId',
    'predictionTs',
    'featureTs',
    'symbol',
    'rank',
    'score',
    'entryPrice',
    'sourceModels',
    'modelVersion',
    'schemaVersion'
  ])
});

function AURUM_normalizeHeader_(value) {
  if (typeof normalizeHeader_ === 'function') return normalizeHeader_(value);
  if (typeof VERILER_CANONICAL_SCHEMA !== 'undefined' &&
      VERILER_CANONICAL_SCHEMA &&
      typeof VERILER_CANONICAL_SCHEMA.normalizeHeader === 'function') {
    return VERILER_CANONICAL_SCHEMA.normalizeHeader(value);
  }
  return String(value == null ? '' : value)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function AURUM_assert_(condition, message) {
  if (!condition) throw new Error(String(message || 'Contract assertion failed'));
}

function AURUM_assertFiniteOrNull_(value, fieldName) {
  AURUM_assert_(
    value == null || (typeof value === 'number' && isFinite(value)),
    fieldName + ' must be a finite number or null'
  );
}

function AURUM_assertDateOrNull_(value, fieldName) {
  AURUM_assert_(
    value == null || (value instanceof Date && !isNaN(value.getTime())),
    fieldName + ' must be a valid Date or null'
  );
}

function AURUM_validateSymbol_(symbol) {
  const normalized = String(symbol || '').trim().toUpperCase();
  AURUM_assert_(/^[A-Z0-9]{3,8}$/.test(normalized), 'Invalid symbol: ' + symbol);
  return normalized;
}

function AURUM_validateVerilerRecord_(record) {
  AURUM_assert_(record && typeof record === 'object', 'Veriler record is required');
  record.sym = AURUM_validateSymbol_(record.sym);

  AURUM_assertDateOrNull_(record.verizamani, 'verizamani');
  AURUM_assertFiniteOrNull_(record.anlik, 'anlik');
  AURUM_assertFiniteOrNull_(record.anlikdeg, 'anlikdeg');
  AURUM_assertFiniteOrNull_(record.kapanis_T, 'kapanis_T');
  AURUM_assertFiniteOrNull_(record.fiyatdeg_T, 'fiyatdeg_T');

  return record;
}

function AURUM_validatePredictionSnapshot_(snapshot) {
  AURUM_assert_(snapshot && typeof snapshot === 'object', 'Snapshot is required');

  AURUM_CONTRACTS.S_REQUIRED_FIELDS.forEach(function(field) {
    AURUM_assert_(
      Object.prototype.hasOwnProperty.call(snapshot, field),
      'Missing snapshot field: ' + field
    );
  });

  snapshot.symbol = AURUM_validateSymbol_(snapshot.symbol);
  AURUM_assertDateOrNull_(snapshot.predictionTs, 'predictionTs');
  AURUM_assertDateOrNull_(snapshot.featureTs, 'featureTs');
  AURUM_assertFiniteOrNull_(snapshot.score, 'score');
  AURUM_assertFiniteOrNull_(snapshot.entryPrice, 'entryPrice');
  AURUM_assert_(snapshot.featureTs <= snapshot.predictionTs,
    'Feature timestamp cannot be after prediction timestamp');
  AURUM_assert_(Array.isArray(snapshot.sourceModels), 'sourceModels must be an array');

  return snapshot;
}

function AURUM_buildHeaderIndex_(headers) {
  const index = Object.create(null);

  (headers || []).forEach(function(header, position) {
    const normalized = AURUM_normalizeHeader_(header);
    if (!normalized) return;
    AURUM_assert_(!index[normalized], 'Duplicate header: ' + normalized);
    index[normalized] = position + 1;
  });

  return index;
}

function AURUM_assertRequiredHeaders_(headers, required) {
  const index = AURUM_buildHeaderIndex_(headers);
  const missing = (required || []).filter(function(header) {
    return !index[AURUM_normalizeHeader_(header)];
  });

  AURUM_assert_(missing.length === 0, 'Missing headers: ' + missing.join(', '));
  return index;
}
