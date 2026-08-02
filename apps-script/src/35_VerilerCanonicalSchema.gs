var VERILER_CANONICAL_SCHEMA = (function () {
  var BASE_HEADERS = [
    'Hisse','VeriZamani','Anlik','AnlikDegisim%','Degisim3Gun(%)_T0',
    'Destekler(3)_T0','Direncler(3)_T0','KapanisTarihi_T0','FiyatDegisim%_T0',
    'Kapanis_T0','Min_T0','Max_T0','Hacim_T0','HacimDegisim%_T0','EMA20_T0',
    'EMA50_T0','EMA200_T0','MACD_T0','MACDSignal_T0','MACDHist_T0','RSI14_T0',
    'Momentum10_T0','Volatilite5G_T0','Volatilite21G_T0','Volatilite63G_T0',
    'Boll_Orta_T0','Boll_Std_T0','Boll_Alt_T0','Boll_Ust_T0','PD_T0','SERMAYE_T0',
    'FD_T0','FAVOK_T0','FD_FAVOK_T0','F_K_T0','PD_DD_T0','ROE_Yaklasik_T0',
    'Beta_T0','Teknik_Sinyal_T0','Getiri_TL_1A_T0','Getiri_TL_3A_T0',
    'Getiri_TL_6A_T0','Getiri_USD_1A_T0','Getiri_USD_3A_T0','Getiri_USD_6A_T0',
    'Getiri_XU_1A_T0','Getiri_XU_3A_T0','Getiri_XU_6A_T0'
  ];

  function normalizeHeader(value) {
    return String(value == null ? '' : value)
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\s+/g, '');
  }

  function expectedHeaders() {
    var out = BASE_HEADERS.slice();
    var t;
    for (t = 1; t <= 30; t++) {
      out.push('FiyatDegisim%_T' + t, 'Kapanis_T' + t, 'Min_T' + t,
        'Max_T' + t, 'Hacim_T' + t, 'HacimDegisim%_T' + t);
    }
    for (t = 31; t <= 90; t++) {
      out.push('FiyatDegisim%_T' + t, 'Kapanis_T' + t,
        'Hacim_T' + t, 'HacimDegisim%_T' + t);
    }
    return out;
  }

  function audit(headers) {
    var raw = headers || [];
    var actual = raw.map(normalizeHeader);
    var expected = expectedHeaders();
    var counts = {};
    var duplicates = [];
    var missing = [];
    var unexpected = [];
    var positional = [];
    var unicodeContaminated = [];
    var i;

    actual.forEach(function (header) { counts[header] = (counts[header] || 0) + 1; });
    Object.keys(counts).forEach(function (header) {
      if (header && counts[header] > 1) duplicates.push({ header: header, count: counts[header] });
    });

    for (i = 0; i < expected.length; i++) {
      if (actual.indexOf(expected[i]) === -1) missing.push(expected[i]);
      if (actual[i] !== expected[i]) positional.push({ column: i + 1, expected: expected[i], actual: actual[i] || '' });
    }
    for (i = 0; i < actual.length; i++) {
      if (expected.indexOf(actual[i]) === -1) unexpected.push({ column: i + 1, header: actual[i] });
      if (String(raw[i] == null ? '' : raw[i]) !== actual[i]) {
        unicodeContaminated.push({ column: i + 1, raw: raw[i], normalized: actual[i] });
      }
    }

    return {
      expectedCount: expected.length,
      actualCount: actual.length,
      widthValid: actual.length === expected.length,
      orderValid: positional.length === 0,
      uniqueValid: duplicates.length === 0,
      missing: missing,
      unexpected: unexpected,
      duplicates: duplicates,
      positionalMismatches: positional,
      unicodeContaminatedCount: unicodeContaminated.length,
      unicodeContaminated: unicodeContaminated,
      validAfterNormalization: actual.length === expected.length && positional.length === 0 && duplicates.length === 0
    };
  }

  function auditActiveSheet() {
    var sheet = SpreadsheetApp.getActive().getSheetByName('Veriler');
    if (!sheet) throw new Error('Veriler sayfasi bulunamadi.');
    var headers = sheet.getRange(1, 1, 1, 468).getDisplayValues()[0];
    return audit(headers);
  }

  return {
    normalizeHeader: normalizeHeader,
    expectedHeaders: expectedHeaders,
    audit: audit,
    auditActiveSheet: auditActiveSheet
  };
})();

function auditVerilerCanonicalSchema_() {
  return VERILER_CANONICAL_SCHEMA.auditActiveSheet();
}
