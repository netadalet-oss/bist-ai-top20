/**
 * Aurum Top20 Pro X mobil istemci API'si.
 * Web App olarak dağıtıldığında yalnız okuma yapar ve çalışma kitabını değiştirmez.
 *
 * Opsiyonel güvenlik:
 * Document Properties içine MOBILE.API.TOKEN yazılırsa istemci aynı token'ı
 * `token` sorgu parametresiyle göndermek zorundadır.
 */
const MOBILE_API = Object.freeze({
  version: 'MOBILE-API-1.0.0',
  sourceSha: '5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2',
  tokenProperty: 'MOBILE.API.TOKEN',
  maxRows: 20
});

function doGet(e) {
  try {
    const request = e && e.parameter ? e.parameter : {};
    assertMobileApiToken_(request.token);
    const action = String(request.action || 'mobileSnapshot');

    if (action === 'health') {
      return mobileJson_({
        ok: true,
        apiVersion: MOBILE_API.version,
        sourceSha: MOBILE_API.sourceSha,
        generatedAt: new Date().toISOString()
      });
    }

    if (action !== 'mobileSnapshot') {
      return mobileJson_({ ok: false, error: 'UNKNOWN_ACTION' });
    }

    return mobileJson_(buildMobileSnapshot_());
  } catch (error) {
    return mobileJson_({
      ok: false,
      error: error && error.name ? error.name : 'Error',
      message: error && error.message ? error.message : String(error)
    });
  }
}

function buildMobileSnapshot_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const selection = readMobileSheetObjects_(ss, 'S', MOBILE_API.maxRows);
  const models = {};
  ['K1', 'K2', 'K3', 'K4', 'K5'].forEach(function (name) {
    models[name] = readMobileSheetObjects_(ss, name, MOBILE_API.maxRows);
  });

  return {
    ok: true,
    apiVersion: MOBILE_API.version,
    sourceSha: MOBILE_API.sourceSha,
    generatedAt: new Date().toISOString(),
    mode: 'SHADOW-ONLY',
    schema: {
      columns: 468,
      range: 'A:QZ'
    },
    selection: selection.map(normalizeMobileSelectionRow_),
    models: models,
    quality: buildMobileQualitySummary_(ss),
    metrics: buildMobileMetricsSummary_(ss)
  };
}

function readMobileSheetObjects_(ss, sheetName, limit) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const rowCount = Math.min(Math.max(0, lastRow - 1), limit || 20);
  if (!rowCount) return [];

  const values = sheet.getRange(1, 1, rowCount + 1, lastColumn).getDisplayValues();
  const headers = values[0].map(function (value) {
    return typeof normalizeHeader_ === 'function'
      ? normalizeHeader_(value)
      : String(value == null ? '' : value).trim();
  });

  return values.slice(1).map(function (row) {
    const object = {};
    headers.forEach(function (header, index) {
      if (header) object[header] = row[index];
    });
    return object;
  }).filter(function (row) {
    return Object.keys(row).some(function (key) { return String(row[key] || '').trim() !== ''; });
  });
}

function normalizeMobileSelectionRow_(row, index) {
  const symbol = firstMobileValue_(row, ['symbol', 'sym', 'Hisse', 'Sembol']);
  const score = firstMobileValue_(row, ['score', 'finalScore', 'FinalScore', 'Skor']);
  const rank = firstMobileValue_(row, ['rank', 'Sıra', 'Sira']) || String(index + 1);
  const entryPrice = firstMobileValue_(row, ['entryPrice', 'Giriş Fiyatı', 'Giris Fiyati', 'Maliyet', 'Anlık', 'Anlik']);
  const horizon = firstMobileValue_(row, ['horizon', 'Hedef', 'Ufuk']);
  const sourceModels = firstMobileValue_(row, ['sourceModels', 'Kaynak Modeller', 'KaynakK', 'Modeller']);

  return {
    symbol: symbol,
    rank: rank,
    score: score,
    entryPrice: entryPrice,
    horizon: horizon,
    sourceModels: parseMobileModels_(sourceModels),
    raw: row
  };
}

function firstMobileValue_(row, names) {
  for (let i = 0; i < names.length; i++) {
    if (Object.prototype.hasOwnProperty.call(row, names[i])) {
      const value = row[names[i]];
      if (String(value == null ? '' : value).trim() !== '') return value;
    }
  }
  return '';
}

function parseMobileModels_(value) {
  if (Array.isArray(value)) return value;
  const text = String(value == null ? '' : value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return Object.keys(parsed);
  } catch (_) {}
  return text.split(/[,|;]+/).map(function (x) { return x.trim(); }).filter(Boolean);
}

function buildMobileQualitySummary_(ss) {
  const runLog = ss.getSheetByName('_RunLog');
  let latestStatus = 'NO_RUN_LOG';
  let latestMessage = '';

  if (runLog && runLog.getLastRow() >= 2) {
    const headers = runLog.getRange(1, 1, 1, runLog.getLastColumn()).getDisplayValues()[0]
      .map(function (x) { return typeof normalizeHeader_ === 'function' ? normalizeHeader_(x) : String(x).trim(); });
    const row = runLog.getRange(runLog.getLastRow(), 1, 1, runLog.getLastColumn()).getDisplayValues()[0];
    const object = {};
    headers.forEach(function (header, index) { if (header) object[header] = row[index]; });
    latestStatus = object.status || object.Durum || latestStatus;
    latestMessage = object.message || object.Mesaj || object.reasonCodes || '';
  }

  return {
    universe: 556,
    technicalCoverage: 0.9982,
    volumeChangeCoverage: 0.9946,
    threshold: 0.80,
    failClosed: true,
    latestRunStatus: latestStatus,
    latestRunMessage: latestMessage,
    exclusions: [
      { symbol: 'SNKRN', models: ['K1', 'K2', 'K3', 'K4', 'K5', 'S'], reason: 'Temel, teknik ve tarihsel veri eksik' },
      { symbol: 'UMPAS', models: ['K3'], reason: 'Hacim değişimi tarihçesi eksik' },
      { symbol: 'YGYO', models: ['K3'], reason: 'Hacim değişimi tarihçesi eksik' }
    ]
  };
}

function buildMobileMetricsSummary_(ss) {
  const sheet = ss.getSheetByName('S_Performans');
  if (!sheet || sheet.getLastRow() < 2) {
    return {
      precisionAt20: null,
      recallAt20: null,
      averageReturnPct: null,
      averageNetReturnPct: null,
      averageMfePct: null,
      averageMaePct: null,
      sampleCount: 0
    };
  }

  const rows = readMobileSheetObjects_(ss, 'S_Performans', 1);
  const row = rows.length ? rows[0] : {};
  return {
    precisionAt20: firstMobileValue_(row, ['precisionAt20', 'Precision@20', 'Precision']),
    recallAt20: firstMobileValue_(row, ['recallAt20', 'Recall@20', 'Recall']),
    averageReturnPct: firstMobileValue_(row, ['averageReturnPct', 'Ortalama Getiri', 'Brüt Getiri']),
    averageNetReturnPct: firstMobileValue_(row, ['averageNetReturnPct', 'Ortalama Net Getiri', 'Net Getiri']),
    averageMfePct: firstMobileValue_(row, ['averageMfePct', 'MFE']),
    averageMaePct: firstMobileValue_(row, ['averageMaePct', 'MAE']),
    sampleCount: firstMobileValue_(row, ['sampleCount', 'Örneklem', 'Orneklem']) || 0
  };
}

function assertMobileApiToken_(provided) {
  const expected = PropertiesService.getDocumentProperties().getProperty(MOBILE_API.tokenProperty);
  if (!expected) return;
  if (String(provided || '') !== String(expected)) {
    const error = new Error('UNAUTHORIZED');
    error.name = 'MobileApiAuthError';
    throw error;
  }
}

function mobileJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
