/** Veriler sayfası şema yönetimi. */
function buildVerilerHeaders_() {
  const fixed = [
    'Hisse','VeriZamani','Anlik','AnlikDegisim%',
    'Degisim3Gun(%)_T0','Destekler(3)_T0','Direncler(3)_T0',
    'KapanisTarihi_T0','FiyatDegisim%_T0','Kapanis_T0','Min_T0','Max_T0',
    'Hacim_T0','HacimDegisim%_T0','EMA20_T0','EMA50_T0','EMA200_T0',
    'MACD_T0','MACDSignal_T0','MACDHist_T0','RSI14_T0','Momentum10_T0',
    'Volatilite5G_T0','Volatilite21G_T0','Volatilite63G_T0',
    'Boll_Orta_T0','Boll_Std_T0','Boll_Alt_T0','Boll_Ust_T0',
    'PD_T0','SERMAYE_T0','FD_T0','FAVOK_T0','FD_FAVOK_T0',
    'F_K_T0','PD_DD_T0','ROE_Yaklasik_T0','Beta_T0','Teknik_Sinyal_T0',
    'Getiri_TL_1A_T0','Getiri_TL_3A_T0','Getiri_TL_6A_T0',
    'Getiri_USD_1A_T0','Getiri_USD_3A_T0','Getiri_USD_6A_T0',
    'Getiri_XU_1A_T0','Getiri_XU_3A_T0','Getiri_XU_6A_T0'
  ];

  const history = [];
  for (let depth = 1; depth <= APP_CONFIG.MAX_T_DEPTH; depth++) {
    const tag = 'T' + depth;
    history.push('FiyatDegisim%_' + tag, 'Kapanis_' + tag);
    if (depth <= 30) history.push('Min_' + tag, 'Max_' + tag);
    history.push('Hacim_' + tag, 'HacimDegisim%_' + tag);
  }
  return fixed.concat(history);
}

function readSheetPlan_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const raw = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  let end = raw.length;
  while (end > 1 && !normalizeHeader_(raw[end - 1])) end--;

  const headers = raw.slice(0, end).map(normalizeHeader_);
  const map = {};
  headers.forEach((header, index) => {
    if (!header) return;
    if (map[header]) throw new Error('Mükerrer başlık: ' + header);
    map[header] = index + 1;
  });

  return { headers, map, width: headers.length, latestLabel: 'T0' };
}

function inspectVerilerSchema_(sheet) {
  const expected = buildVerilerHeaders_();
  const current = readSheetPlan_(sheet);
  const mismatches = [];
  const width = Math.max(expected.length, current.headers.length);

  for (let index = 0; index < width; index++) {
    if ((expected[index] || '') !== (current.headers[index] || '')) {
      mismatches.push({
        column: index + 1,
        expected: expected[index] || '',
        actual: current.headers[index] || ''
      });
    }
  }

  return {
    valid: mismatches.length === 0,
    expectedWidth: expected.length,
    actualWidth: current.headers.length,
    staleColumnCount: Math.max(0, current.headers.length - expected.length),
    mismatches
  };
}

function writeVerilerHeaders_(sheet) {
  const headers = buildVerilerHeaders_();
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return readSheetPlan_(sheet);
}

function assertRequiredHeaders_(plan, requiredHeaders) {
  const missing = (requiredHeaders || []).filter(header => !plan.map[header]);
  if (missing.length) throw new Error('Eksik zorunlu başlıklar: ' + missing.join(', '));
}

function readDataRowsExact_(sheet, plan, rowCount) {
  if (!rowCount) return [];
  assertRequiredHeaders_(plan, ['Hisse', 'VeriZamani', 'Kapanis_T0']);
  return sheet.getRange(2, 1, rowCount, plan.width).getValues();
}
