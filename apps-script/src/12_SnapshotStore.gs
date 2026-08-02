/*
 * Immutable snapshot store for K1-K5 and S predictions.
 *
 * Prediction rows are append-only. Outcome rows are stored separately so a
 * later evaluation cannot mutate the original prediction evidence.
 */
var SNAPSHOT_STORE = (function () {
  'use strict';

  const SHEETS = Object.freeze({
    SNAPSHOTS: '_Snapshots',
    OUTCOMES: '_SnapshotOutcomes'
  });

  const SNAPSHOT_HEADERS = Object.freeze([
    'snapshotId','snapshotType','predictionTs','featureTs','sessionDate','sessionKind',
    'model','modelVersion','symbol','rank','score','coverage','entryPrice',
    'sourceModelsJson','payloadJson','payloadHash','createdTs'
  ]);

  const OUTCOME_HEADERS = Object.freeze([
    'outcomeId','snapshotId','symbol','horizon','evaluationTs','top20Hit','top20Rank',
    'targetPrice','returnPct','maxFavorablePct','maxAdversePct','payloadJson','createdTs'
  ]);

  function spreadsheet_() {
    return SpreadsheetApp.getActive();
  }

  function nowIso_() {
    return new Date().toISOString();
  }

  function asIso_(value, label) {
    const d = value instanceof Date ? value : new Date(value);
    if (!isFinite(d.getTime())) throw new Error(label + ' geçerli tarih değil.');
    return d.toISOString();
  }

  function symbol_(value) {
    const s = String(value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(s)) throw new Error('Geçersiz sembol: ' + value);
    return s;
  }

  function stableObject_(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(stableObject_);
    const out = {};
    Object.keys(value).sort().forEach(function (key) {
      out[key] = stableObject_(value[key]);
    });
    return out;
  }

  function stableJson_(value) {
    return JSON.stringify(stableObject_(value == null ? {} : value));
  }

  function sha256_(text) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(text),
      Utilities.Charset.UTF_8
    );
    return bytes.map(function (b) {
      const v = b < 0 ? b + 256 : b;
      return ('0' + v.toString(16)).slice(-2);
    }).join('');
  }

  function uuid_() {
    return Utilities.getUuid();
  }

  function ensureSheet_(name, headers) {
    const ss = spreadsheet_();
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);

    if (sh.getMaxColumns() < headers.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    }

    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const same = headers.every(function (h, i) { return String(current[i] || '') === h; });
    if (!same) {
      if (sh.getLastRow() > 1) {
        throw new Error(name + ' şeması mevcut verilerle uyuşmuyor; otomatik değiştirilmedi.');
      }
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function findExistingSnapshotId_(sheet, snapshotId) {
    const last = sheet.getLastRow();
    if (last < 2) return false;
    return sheet.getRange(2, 1, last - 1, 1).getValues().some(function (row) {
      return String(row[0] || '') === snapshotId;
    });
  }

  function assertPredictionTime_(predictionTs, featureTs) {
    const p = new Date(predictionTs).getTime();
    const f = new Date(featureTs).getTime();
    if (!isFinite(p) || !isFinite(f)) throw new Error('Tahmin veya özellik zamanı geçersiz.');
    if (f > p) throw new Error('Veri sızıntısı: featureTs predictionTs sonrasında olamaz.');
  }

  function appendPredictionBatch(input) {
    input = input || {};
    const results = Array.isArray(input.results) ? input.results : [];
    if (!results.length) throw new Error('Snapshot için sonuç bulunamadı.');

    const predictionTs = asIso_(input.predictionTs || new Date(), 'predictionTs');
    const featureTs = asIso_(input.featureTs || predictionTs, 'featureTs');
    assertPredictionTime_(predictionTs, featureTs);

    const snapshotId = String(input.snapshotId || uuid_());
    const snapshotType = String(input.snapshotType || 'MODEL').toUpperCase();
    const sessionDate = String(input.sessionDate || predictionTs.slice(0, 10));
    const sessionKind = String(input.sessionKind || 'UNSPECIFIED').toUpperCase();
    const createdTs = nowIso_();
    const sh = ensureSheet_(SHEETS.SNAPSHOTS, SNAPSHOT_HEADERS);

    if (findExistingSnapshotId_(sh, snapshotId)) {
      throw new Error('Snapshot zaten mevcut ve değiştirilemez: ' + snapshotId);
    }

    const rows = results.map(function (r, index) {
      const payload = {
        raw: r.raw || {},
        normalized: r.normalized || {},
        tieBreak: r.tieBreak || {},
        reason: r.reason || null,
        source: r.source || null
      };
      const payloadJson = stableJson_(payload);
      const rank = Number(r.rank != null ? r.rank : index + 1);
      const entryPrice = r.entryPrice == null ? null : Number(r.entryPrice);
      return [
        snapshotId,
        snapshotType,
        predictionTs,
        featureTs,
        sessionDate,
        sessionKind,
        String(r.model || input.model || ''),
        String(r.modelVersion || input.modelVersion || ''),
        symbol_(r.symbol || r.sym),
        isFinite(rank) ? rank : index + 1,
        r.score == null ? null : Number(r.score),
        r.coverage == null ? null : Number(r.coverage),
        isFinite(entryPrice) ? entryPrice : null,
        stableJson_(r.sourceModels || (r.raw && r.raw.models) || []),
        payloadJson,
        sha256_(payloadJson),
        createdTs
      ];
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (findExistingSnapshotId_(sh, snapshotId)) {
        throw new Error('Snapshot eşzamanlı işlemde oluşturuldu: ' + snapshotId);
      }
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, SNAPSHOT_HEADERS.length).setValues(rows);
    } finally {
      lock.releaseLock();
    }

    return { snapshotId: snapshotId, rowCount: rows.length, predictionTs: predictionTs };
  }

  function appendOutcomes(input) {
    input = input || {};
    const outcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
    if (!outcomes.length) throw new Error('Kaydedilecek sonuç bulunamadı.');
    const snapshotId = String(input.snapshotId || '');
    if (!snapshotId) throw new Error('snapshotId zorunludur.');

    const snapshotSheet = ensureSheet_(SHEETS.SNAPSHOTS, SNAPSHOT_HEADERS);
    if (!findExistingSnapshotId_(snapshotSheet, snapshotId)) {
      throw new Error('Sonuç için snapshot bulunamadı: ' + snapshotId);
    }

    const sh = ensureSheet_(SHEETS.OUTCOMES, OUTCOME_HEADERS);
    const createdTs = nowIso_();
    const rows = outcomes.map(function (o) {
      const payloadJson = stableJson_(o.payload || {});
      return [
        uuid_(), snapshotId, symbol_(o.symbol || o.sym), String(o.horizon || ''),
        asIso_(o.evaluationTs || new Date(), 'evaluationTs'),
        o.top20Hit === true ? 1 : 0,
        o.top20Rank == null ? null : Number(o.top20Rank),
        o.targetPrice == null ? null : Number(o.targetPrice),
        o.returnPct == null ? null : Number(o.returnPct),
        o.maxFavorablePct == null ? null : Number(o.maxFavorablePct),
        o.maxAdversePct == null ? null : Number(o.maxAdversePct),
        payloadJson, createdTs
      ];
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, OUTCOME_HEADERS.length).setValues(rows);
    } finally {
      lock.releaseLock();
    }
    return { snapshotId: snapshotId, outcomeCount: rows.length };
  }

  function readSnapshot(snapshotId) {
    const sh = ensureSheet_(SHEETS.SNAPSHOTS, SNAPSHOT_HEADERS);
    const last = sh.getLastRow();
    if (last < 2) return [];
    const values = sh.getRange(2, 1, last - 1, SNAPSHOT_HEADERS.length).getValues();
    return values.filter(function (row) { return String(row[0] || '') === String(snapshotId); })
      .map(function (row) {
        const obj = {};
        SNAPSHOT_HEADERS.forEach(function (h, i) { obj[h] = row[i]; });
        return obj;
      });
  }

  function verifySnapshot(snapshotId) {
    const rows = readSnapshot(snapshotId);
    return {
      snapshotId: snapshotId,
      rowCount: rows.length,
      valid: rows.length > 0 && rows.every(function (row) {
        return sha256_(String(row.payloadJson || '')) === String(row.payloadHash || '');
      })
    };
  }

  return Object.freeze({
    appendPredictionBatch: appendPredictionBatch,
    appendOutcomes: appendOutcomes,
    readSnapshot: readSnapshot,
    verifySnapshot: verifySnapshot,
    headers: function () { return { snapshots: SNAPSHOT_HEADERS.slice(), outcomes: OUTCOME_HEADERS.slice() }; }
  });
})();

function saveModelSnapshot_(input) {
  return SNAPSHOT_STORE.appendPredictionBatch(input);
}

function saveSnapshotOutcomes_(input) {
  return SNAPSHOT_STORE.appendOutcomes(input);
}

function verifySnapshot_(snapshotId) {
  return SNAPSHOT_STORE.verifySnapshot(snapshotId);
}
