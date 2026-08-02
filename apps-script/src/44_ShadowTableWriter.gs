/*
 * Visible SHADOW-ONLY table writer.
 *
 * Reads the canonical Veriler sheet, runs K1-K4, K5 and both S horizons,
 * and writes results to dedicated _Golge_* sheets. Legacy K1-K5/S sheets are
 * never modified by this module.
 */
var SHADOW_TABLE_WRITER = (function () {
  'use strict';

  const VERSION = 'SHADOW-TABLE-WRITER-1.0.0';
  const SHEETS = Object.freeze({
    K1: '_Golge_K1',
    K2: '_Golge_K2',
    K3: '_Golge_K3',
    K4: '_Golge_K4',
    K5: '_Golge_K5',
    SAME_DAY: '_Golge_S_AyniGun',
    NEXT_DAY: '_Golge_S_ErtesiGun',
    SUMMARY: '_Golge_Ozet'
  });

  function text_(value) {
    return value == null ? '' : String(value);
  }

  function iso_(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? text_(value) : d.toISOString();
  }

  function json_(value) {
    if (value == null) return '';
    let out;
    try {
      out = JSON.stringify(value);
    } catch (error) {
      out = JSON.stringify({ serializationError: text_(error && error.message || error) });
    }
    return out.length > 45000 ? out.slice(0, 45000) : out;
  }

  function sheet_(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  function write_(name, headers, rows) {
    const sh = sheet_(name);
    sh.clearContents();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (rows.length) {
      sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
    return { sheetName:name, rowCount:rows.length };
  }

  function modelRows_(rows) {
    return (rows || []).map(function (r) {
      return [
        r.rank || '',
        r.symbol || '',
        r.model || '',
        r.score == null ? '' : r.score,
        r.coverage == null ? '' : r.coverage,
        r.eligible !== false,
        iso_(r.featureTs),
        r.reason || '',
        json_(r.raw),
        json_(r.normalized),
        json_(r.tieBreak)
      ];
    });
  }

  function selectionRows_(rows) {
    return (rows || []).map(function (r) {
      return [
        r.rank || '',
        r.symbol || '',
        r.horizon || '',
        r.score == null ? '' : r.score,
        r.sameDayScore == null ? '' : r.sameDayScore,
        r.nextDayScore == null ? '' : r.nextDayScore,
        r.combinedScore == null ? '' : r.combinedScore,
        r.coverage == null ? '' : r.coverage,
        r.entryPrice == null ? '' : r.entryPrice,
        (r.sourceModels || []).join(','),
        iso_(r.featureTs),
        r.modelVersion || '',
        r.reason || '',
        json_(r.raw && r.raw.components)
      ];
    });
  }

  function run(options) {
    const opts = options || {};
    const predictionTs = opts.predictionTs || new Date();

    if (typeof assertAppsScriptIntegrity_ === 'function') {
      assertAppsScriptIntegrity_();
    }

    const runtime = buildRuntimeInputs_({
      predictionTs: predictionTs,
      horizon: 'COMBINED',
      sessionKind: 'SHADOW_VISIBLE_TABLES',
      qualityOptions: opts.qualityOptions || {},
      options: { historyDepth: opts.historyDepth || 30 }
    });

    const sameDay = buildRuntimeSSelection_({
      predictionTs: runtime.predictionTs,
      horizon: 'SAME_DAY',
      sessionKind: 'SAME_DAY_EARLY',
      modelResults: runtime.modelResults,
      features: runtime.features,
      options: opts.selectionOptions || {},
      bindingOptions: opts.bindingOptions || { strict:false }
    });

    const nextDay = buildRuntimeSSelection_({
      predictionTs: runtime.predictionTs,
      horizon: 'NEXT_DAY',
      sessionKind: 'NEXT_DAY_CLOSE',
      modelResults: runtime.modelResults,
      features: runtime.features,
      options: opts.selectionOptions || {},
      bindingOptions: opts.bindingOptions || { strict:false }
    });

    const modelHeaders = [
      'Sıra','Hisse','Model','Skor','Kapsam','Uygun','FeatureTs',
      'Gerekçe','HamMetriklerJSON','NormalizeJSON','TieBreakJSON'
    ];
    const selectionHeaders = [
      'Sıra','Hisse','Horizon','Skor','AynıGünSkoru','ErtesiGünSkoru',
      'BirleşikSkor','Kapsam','GirişFiyatı','KaynakModeller','FeatureTs',
      'ModelSürümü','Gerekçe','BileşenlerJSON'
    ];

    const writes = [];
    ['K1','K2','K3','K4','K5'].forEach(function (name) {
      writes.push(write_(SHEETS[name], modelHeaders, modelRows_(runtime.modelResultsByName[name])));
    });
    writes.push(write_(SHEETS.SAME_DAY, selectionHeaders, selectionRows_(sameDay.results)));
    writes.push(write_(SHEETS.NEXT_DAY, selectionHeaders, selectionRows_(nextDay.results)));

    const summaryHeaders = ['Alan','Değer'];
    const summaryRows = [
      ['Sürüm', VERSION],
      ['Çalışma Zamanı', new Date().toISOString()],
      ['Tahmin Zamanı', iso_(runtime.predictionTs)],
      ['Feature Sayısı', runtime.counts.features],
      ['Reddedilen', runtime.counts.rejected],
      ['K1', runtime.counts.K1],
      ['K2', runtime.counts.K2],
      ['K3', runtime.counts.K3],
      ['K4', runtime.counts.K4],
      ['K5', runtime.counts.K5],
      ['S Aynı Gün', sameDay.results.length],
      ['S Ertesi Gün', nextDay.results.length],
      ['Mod', 'SHADOW_ONLY']
    ];
    writes.push(write_(SHEETS.SUMMARY, summaryHeaders, summaryRows));

    const report = {
      version: VERSION,
      predictionTs: runtime.predictionTs,
      counts: runtime.counts,
      sameDayCount: sameDay.results.length,
      nextDayCount: nextDay.results.length,
      writes: writes,
      mode: 'SHADOW_ONLY'
    };
    Logger.log(JSON.stringify(report, null, 2));
    return report;
  }

  return Object.freeze({ version:VERSION, sheets:SHEETS, run:run });
})();

function golgeTablolariniDoldur() {
  return SHADOW_TABLE_WRITER.run({
    predictionTs: new Date(),
    historyDepth: 30,
    bindingOptions: { strict:false }
  });
}
