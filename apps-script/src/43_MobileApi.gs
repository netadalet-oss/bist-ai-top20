var MOBILE_API = (function () {
  'use strict';

  var VERSION = 'MOBILE-API-1.0.0';
  var SOURCE_LOCK = '5fbe5a2df9ec7a28f8e8b87d4648a8f1f0826dd2';

  function normalizeHeader_(value) {
    if (typeof VERILER_CANONICAL_SCHEMA !== 'undefined' && VERILER_CANONICAL_SCHEMA.normalizeHeader) {
      return VERILER_CANONICAL_SCHEMA.normalizeHeader(value);
    }
    return String(value == null ? '' : value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function json_(payload, status) {
    var output = ContentService.createTextOutput(JSON.stringify({
      ok: status == null || status < 400,
      status: status || 200,
      version: VERSION,
      generatedAt: new Date().toISOString(),
      data: payload
    }));
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  function sheetObjects_(sheetName, limit) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    var lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 1) return [];
    var maxRows = Math.min(lastRow - 1, Math.max(1, Number(limit) || 100));
    var values = sheet.getRange(1, 1, maxRows + 1, lastColumn).getDisplayValues();
    var headers = values[0].map(normalizeHeader_);
    return values.slice(1).filter(function (row) {
      return row.some(function (cell) { return String(cell).trim() !== ''; });
    }).map(function (row) {
      var out = {};
      headers.forEach(function (header, index) {
        if (header) out[header] = row[index];
      });
      return out;
    });
  }

  function first_(row, names) {
    for (var i = 0; i < names.length; i++) {
      var key = names[i];
      if (row[key] != null && String(row[key]).trim() !== '') return row[key];
    }
    return null;
  }

  function selection_(limit) {
    return sheetObjects_('S', limit || 20).map(function (row, index) {
      return {
        rank: Number(first_(row, ['Sıra', 'Sira', 'Rank'])) || index + 1,
        symbol: first_(row, ['Hisse', 'Sembol', 'Symbol']),
        score: first_(row, ['FinalScore', 'Skor', 'Score']),
        sameDayScore: first_(row, ['SameDayScore', 'SAME_DAY', 'Aynı Gün Skoru']),
        nextDayScore: first_(row, ['NextDayScore', 'NEXT_DAY', 'Ertesi Gün Skoru']),
        entryPrice: first_(row, ['Giriş Fiyatı', 'Giris Fiyati', 'Maliyet', 'EntryPrice']),
        sourceModels: first_(row, ['Kaynak Modeller', 'KaynakK', 'SourceModels']),
        reason: first_(row, ['Gerekçe', 'Gerekce', 'Reason'])
      };
    }).filter(function (item) { return item.symbol; });
  }

  function performance_(limit) {
    return sheetObjects_('S_Performans', limit || 200);
  }

  function quality_() {
    var report = null;
    try {
      if (typeof MODEL_FEATURE_COVERAGE_AUDIT !== 'undefined' && MODEL_FEATURE_COVERAGE_AUDIT.auditActiveSheet) {
        report = MODEL_FEATURE_COVERAGE_AUDIT.auditActiveSheet();
      }
    } catch (error) {
      report = { error: error.message };
    }
    return {
      sourceLock: SOURCE_LOCK,
      mode: 'SHADOW_ONLY',
      knownExclusions: {
        allModels: ['SNKRN'],
        K3: ['UMPAS', 'YGYO']
      },
      report: report
    };
  }

  function status_() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    return {
      ready: true,
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      sourceLock: SOURCE_LOCK,
      mode: 'SHADOW_ONLY',
      endpoints: ['status', 'selection', 'performance', 'quality']
    };
  }

  function handle_(parameters) {
    var action = String((parameters && parameters.action) || 'status').toLowerCase();
    var limit = Number(parameters && parameters.limit) || 20;
    if (action === 'status') return json_(status_());
    if (action === 'selection') return json_(selection_(limit));
    if (action === 'performance') return json_(performance_(limit));
    if (action === 'quality') return json_(quality_());
    return json_({ error: 'UNKNOWN_ACTION', action: action }, 400);
  }

  return {
    version: VERSION,
    handle: handle_
  };
}());

function doGet(e) {
  try {
    return MOBILE_API.handle((e && e.parameter) || {});
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        status: 500,
        version: 'MOBILE-API-1.0.0',
        generatedAt: new Date().toISOString(),
        error: error && error.message ? error.message : String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e);
}
