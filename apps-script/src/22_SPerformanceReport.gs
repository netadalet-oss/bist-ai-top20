/* S performance report sheet generated from immutable snapshots and outcomes. */
var S_PERFORMANCE_REPORT = (function () {
  'use strict';

  const SHEET = 'S_Performans';
  const VERSION = 'S-REPORT-1.0.0';
  const SUMMARY_HEADERS = [
    'Horizon','Snapshot','Tahmin','Degerlendirilen','VeriKapsami','Isabet','Precision@20',
    'Recall@20','OrtGetiri%','MedyanGetiri%','IsabetOrtGetiri%','OrtMFE%','OrtMAE%'
  ];
  const DETAIL_HEADERS = [
    'SnapshotId','TahminZamani','Oturum','Horizon','Sira','Hisse','Skor','GirisFiyati',
    'Top20','Top20Sirasi','HedefFiyat','Getiri%','MFE%','MAE%','IlkTop20Zamani',
    'IlkTop20Sirasi','IlkTop20Getiri%','IlkTop20Dakika','ModelSurumu','VeriVar'
  ];

  function sheet_() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(SHEET);
    if (!sh) sh = ss.insertSheet(SHEET);
    return sh;
  }

  function readObjects_(sheetName) {
    const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
    const values = sh.getDataRange().getValues();
    const headers = values.shift().map(function (h) { return String(h || '').trim(); });
    return values.map(function (row) {
      const o = {};
      headers.forEach(function (h, i) { o[h] = row[i]; });
      return o;
    });
  }

  function parseJson_(value, fallback) {
    try { return JSON.parse(String(value || '')); } catch (_) { return fallback; }
  }

  function finite_(value) {
    const n = Number(value);
    return isFinite(n) ? n : null;
  }

  function truthy_(value) {
    return value === true || value === 1 || String(value).toUpperCase() === 'TRUE';
  }

  function outcomeKey_(r) {
    return [String(r.snapshotId || ''), String(r.symbol || '').toUpperCase(), String(r.horizon || '').toUpperCase()].join('|');
  }

  function buildRows_(horizon) {
    const h = String(horizon || '').toUpperCase();
    const snapshots = readObjects_('_Snapshots').filter(function (r) {
      return String(r.snapshotType || '').toUpperCase() === 'S';
    });
    const outcomes = readObjects_('_SnapshotOutcomes');
    const outcomeMap = new Map();
    outcomes.forEach(function (r) {
      const key = outcomeKey_(r);
      if (outcomeMap.has(key)) throw new Error('Mükerrer outcome: ' + key);
      outcomeMap.set(key, r);
    });

    return snapshots.map(function (s) {
      const payload = parseJson_(s.payloadJson, {});
      const symbol = String(s.symbol || payload.symbol || '').toUpperCase();
      const key = [String(s.snapshotId || ''), symbol, h].join('|');
      const o = outcomeMap.get(key) || {};
      return {
        snapshotId: s.snapshotId,
        predictionTs: s.predictionTs,
        sessionKind: s.sessionKind,
        horizon: h,
        rank: finite_(s.rank),
        symbol: symbol,
        score: finite_(s.score),
        entryPrice: finite_(s.entryPrice),
        top20Hit: truthy_(o.top20Hit),
        top20Rank: finite_(o.top20Rank),
        targetPrice: finite_(o.targetPrice),
        returnPct: finite_(o.returnPct),
        mfePct: finite_(o.maxFavorablePct),
        maePct: finite_(o.maxAdversePct),
        firstEntryTs: o.firstEntryTs || '',
        firstEntryRank: finite_(o.firstEntryRank),
        firstEntryReturnPct: finite_(o.returnToFirstEntryPct),
        firstEntryMinutes: finite_(o.minutesFromPrediction),
        modelVersion: s.modelVersion || payload.modelVersion || '',
        dataAvailable: o.dataAvailable === false ? false : o.targetPrice !== '' && o.targetPrice != null
      };
    }).sort(function (a, b) {
      return new Date(b.predictionTs).getTime() - new Date(a.predictionTs).getTime() ||
        String(a.snapshotId).localeCompare(String(b.snapshotId)) || Number(a.rank || 0) - Number(b.rank || 0);
    });
  }

  function average_(arr) {
    const v = arr.filter(function (x) { return x != null && isFinite(x); });
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
  }

  function median_(arr) {
    const v = arr.filter(function (x) { return x != null && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  function summary_(rows, horizon) {
    const groups = new Map();
    rows.forEach(function (r) {
      if (!groups.has(r.snapshotId)) groups.set(r.snapshotId, []);
      groups.get(r.snapshotId).push(r);
    });
    let predictionCount = 0, evaluatedCount = 0, hitCount = 0;
    const returns = [], hitReturns = [], mfe = [], mae = [];
    groups.forEach(function (g) {
      predictionCount += g.length;
      g.forEach(function (r) {
        if (!r.dataAvailable) return;
        evaluatedCount++;
        if (r.top20Hit) hitCount++;
        if (r.returnPct != null) returns.push(r.returnPct);
        if (r.top20Hit && r.returnPct != null) hitReturns.push(r.returnPct);
        if (r.mfePct != null) mfe.push(r.mfePct);
        if (r.maePct != null) mae.push(r.maePct);
      });
    });
    return [
      horizon,
      groups.size,
      predictionCount,
      evaluatedCount,
      predictionCount ? evaluatedCount / predictionCount : null,
      hitCount,
      evaluatedCount ? hitCount / evaluatedCount : null,
      groups.size ? hitCount / (groups.size * 20) : null,
      average_(returns),
      median_(returns),
      average_(hitReturns),
      average_(mfe),
      average_(mae)
    ];
  }

  function render(input) {
    input = input || {};
    const horizons = input.horizons || ['SAME_DAY_CLOSE', 'NEXT_TRADING_DAY_CLOSE'];
    const sh = sheet_();
    sh.clear();
    sh.getRange('A1').setValue('S Performans Raporu');
    sh.getRange('A2').setValue('Rapor Surumu');
    sh.getRange('B2').setValue(VERSION);
    sh.getRange('A3').setValue('Guncelleme');
    sh.getRange('B3').setValue(new Date());

    const allRows = [];
    const summaries = [];
    horizons.forEach(function (h) {
      const rows = buildRows_(h);
      Array.prototype.push.apply(allRows, rows);
      summaries.push(summary_(rows, h));
    });

    sh.getRange(5, 1, 1, SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS]);
    if (summaries.length) sh.getRange(6, 1, summaries.length, SUMMARY_HEADERS.length).setValues(summaries);

    const detailStart = 8 + summaries.length;
    sh.getRange(detailStart, 1, 1, DETAIL_HEADERS.length).setValues([DETAIL_HEADERS]);
    const detailValues = allRows.map(function (r) {
      return [
        r.snapshotId,r.predictionTs,r.sessionKind,r.horizon,r.rank,r.symbol,r.score,r.entryPrice,
        r.top20Hit,r.top20Rank,r.targetPrice,r.returnPct,r.mfePct,r.maePct,r.firstEntryTs,
        r.firstEntryRank,r.firstEntryReturnPct,r.firstEntryMinutes,r.modelVersion,r.dataAvailable
      ];
    });
    if (detailValues.length) sh.getRange(detailStart + 1, 1, detailValues.length, DETAIL_HEADERS.length).setValues(detailValues);

    sh.setFrozenRows(detailStart);
    sh.autoResizeColumns(1, DETAIL_HEADERS.length);
    sh.getRange(5, 1, 1, SUMMARY_HEADERS.length).setFontWeight('bold');
    sh.getRange(detailStart, 1, 1, DETAIL_HEADERS.length).setFontWeight('bold');
    if (summaries.length) {
      sh.getRange(6, 5, summaries.length, 1).setNumberFormat('0.00%');
      sh.getRange(6, 7, summaries.length, 2).setNumberFormat('0.00%');
      sh.getRange(6, 9, summaries.length, 5).setNumberFormat('0.00');
    }
    if (detailValues.length) sh.getRange(detailStart + 1, 12, detailValues.length, 6).setNumberFormat('0.00');
    return { version: VERSION, summaryCount: summaries.length, detailCount: detailValues.length, sheet: SHEET };
  }

  return Object.freeze({ render: render, version: VERSION });
})();

function refreshSPerformanceReport_(input) {
  return S_PERFORMANCE_REPORT.render(input);
}
