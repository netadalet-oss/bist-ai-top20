/* Versioned, append-only model registry for calibrated S weights. */
var MODEL_REGISTRY = (function () {
  'use strict';

  const SHEET = '_ModelRegistry';
  const HEADERS = [
    'registryId','model','horizon','version','status','createdTs','activatedTs',
    'trainingStart','trainingEnd','foldCount','exampleCount','metricsJson',
    'weightsJson','calibrationVersion','sourceHash','notes'
  ];

  function stableObject_(value) {
    if (value == null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(stableObject_);
    const out = {};
    Object.keys(value).sort().forEach(function (k) { out[k] = stableObject_(value[k]); });
    return out;
  }

  function stableJson_(value) { return JSON.stringify(stableObject_(value || {})); }

  function hash_(text) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
      .map(function (b) { const v = b < 0 ? b + 256 : b; return ('0' + v.toString(16)).slice(-2); })
      .join('');
  }

  function ensure_() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(SHEET);
    if (!sh) sh = ss.insertSheet(SHEET);
    if (sh.getMaxColumns() < HEADERS.length) sh.insertColumnsAfter(sh.getMaxColumns(), HEADERS.length - sh.getMaxColumns());
    const current = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    const same = HEADERS.every(function (h, i) { return String(current[i] || '') === h; });
    if (!same) {
      if (sh.getLastRow() > 1) throw new Error('Model registry şeması uyuşmuyor.');
      sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sh.setFrozenRows(1);
    }
    return sh;
  }

  function readAll_() {
    const sh = ensure_();
    if (sh.getLastRow() < 2) return [];
    return sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues().map(function (row) {
      const o = {}; HEADERS.forEach(function (h, i) { o[h] = row[i]; }); return o;
    });
  }

  function nextVersion_(horizon) {
    const prefix = String(horizon).toUpperCase() + '-';
    const nums = readAll_().filter(function (r) { return String(r.horizon).toUpperCase() === String(horizon).toUpperCase(); })
      .map(function (r) { const m = String(r.version).match(/(\d+)$/); return m ? Number(m[1]) : 0; });
    return prefix + String((nums.length ? Math.max.apply(null, nums) : 0) + 1).padStart(4, '0');
  }

  function publish(input) {
    input = input || {};
    const horizon = String(input.horizon || '').toUpperCase();
    if (horizon !== 'SAME_DAY' && horizon !== 'NEXT_DAY') throw new Error('Geçersiz horizon.');
    const weights = input.weights || {};
    const sum = Object.keys(weights).reduce(function (s, k) { const n = Number(weights[k]); return s + (isFinite(n) ? n : 0); }, 0);
    if (Math.abs(sum - 1) > 1e-8) throw new Error('Ağırlık toplamı 1 olmalıdır.');
    const version = String(input.version || nextVersion_(horizon));
    const duplicate = readAll_().some(function (r) { return String(r.model) === 'S' && String(r.horizon) === horizon && String(r.version) === version; });
    if (duplicate) throw new Error('Model sürümü zaten mevcut: ' + version);
    const payload = {
      model: 'S', horizon: horizon, version: version, weights: weights,
      metrics: input.metrics || {}, trainingStart: input.trainingStart || null,
      trainingEnd: input.trainingEnd || null, calibrationVersion: input.calibrationVersion || ''
    };
    const sh = ensure_();
    const now = new Date().toISOString();
    sh.appendRow([
      Utilities.getUuid(),'S',horizon,version,'CANDIDATE',now,'',
      input.trainingStart || '',input.trainingEnd || '',Number(input.foldCount || 0),Number(input.exampleCount || 0),
      stableJson_(input.metrics || {}),stableJson_(weights),String(input.calibrationVersion || ''),hash_(stableJson_(payload)),String(input.notes || '')
    ]);
    return { horizon: horizon, version: version, status: 'CANDIDATE', sourceHash: hash_(stableJson_(payload)) };
  }

  function activate(horizon, version) {
    const h = String(horizon).toUpperCase();
    const v = String(version);
    const sh = ensure_();
    const rows = readAll_();
    let found = false;
    const now = new Date().toISOString();
    rows.forEach(function (r, i) {
      if (String(r.horizon).toUpperCase() !== h) return;
      const isTarget = String(r.version) === v;
      if (isTarget) found = true;
      sh.getRange(i + 2, 5, 1, 2).setValues([[isTarget ? 'ACTIVE' : (String(r.status) === 'ACTIVE' ? 'RETIRED' : r.status), isTarget ? now : r.activatedTs]]);
    });
    if (!found) throw new Error('Aktifleştirilecek model bulunamadı: ' + h + '/' + v);
    return getActive(h);
  }

  function getActive(horizon) {
    const h = String(horizon).toUpperCase();
    const rows = readAll_().filter(function (r) { return String(r.horizon).toUpperCase() === h && String(r.status) === 'ACTIVE'; });
    if (rows.length > 1) throw new Error('Birden fazla aktif model bulundu: ' + h);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      registryId: r.registryId, model: r.model, horizon: r.horizon, version: r.version,
      weights: JSON.parse(String(r.weightsJson || '{}')), metrics: JSON.parse(String(r.metricsJson || '{}')),
      trainingStart: r.trainingStart, trainingEnd: r.trainingEnd, activatedTs: r.activatedTs,
      sourceHash: r.sourceHash
    };
  }

  function publishFromCalibration(input) {
    input = input || {};
    const report = input.report || {};
    const folds = report.folds || [];
    if (!folds.length) throw new Error('Yayımlanabilir calibration fold bulunamadı.');
    const last = folds[folds.length - 1];
    return publish({
      horizon: report.horizon,
      weights: last.weights,
      trainingStart: last.trainStart,
      trainingEnd: last.trainEnd,
      foldCount: report.aggregate && report.aggregate.foldCount,
      exampleCount: report.exampleCount,
      metrics: report.aggregate || {},
      calibrationVersion: report.version,
      notes: input.notes || 'Latest walk-forward fold weights'
    });
  }

  return Object.freeze({ publish: publish, activate: activate, getActive: getActive, publishFromCalibration: publishFromCalibration });
})();

function publishCalibratedModel_(input) { return MODEL_REGISTRY.publishFromCalibration(input); }
function activateModelVersion_(horizon, version) { return MODEL_REGISTRY.activate(horizon, version); }
function getActiveModel_(horizon) { return MODEL_REGISTRY.getActive(horizon); }
