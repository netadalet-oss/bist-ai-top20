/* Snapshot scheduling, structured run logging and safe maintenance commands. */
var SCHEDULER_AND_MAINTENANCE = (function () {
  'use strict';

  const VERSION = 'SCHED-MAINT-1.2.0';
  const TZ = 'Europe/Istanbul';
  const RUN_LOG_SHEET = '_RunLog';
  const LEGACY_RUN_LOG_HEADERS = Object.freeze([
    'runId','runTs','tradingDate','sessionKind','horizon','status','snapshotId',
    'rowCount','modelVersion','message','durationMs'
  ]);
  const QUALITY_RUN_LOG_HEADERS = Object.freeze([
    'errorType','reasonCodes','qualityModels','qualityFields','qualityReportJson'
  ]);
  const RUN_LOG_HEADERS = Object.freeze(LEGACY_RUN_LOG_HEADERS.concat(QUALITY_RUN_LOG_HEADERS));

  const SESSIONS = Object.freeze({
    SAME_DAY_EARLY: Object.freeze({ functionName:'scheduledSameDayEarlySnapshot_', hour:10, minute:5, horizon:'SAME_DAY', sessionKind:'SAME_DAY_EARLY' }),
    SAME_DAY_MID: Object.freeze({ functionName:'scheduledSameDayMidSnapshot_', hour:12, minute:30, horizon:'SAME_DAY', sessionKind:'SAME_DAY_MID' }),
    NEXT_DAY_CLOSE: Object.freeze({ functionName:'scheduledNextDayCloseSnapshot_', hour:17, minute:55, horizon:'NEXT_DAY', sessionKind:'NEXT_DAY_CLOSE' })
  });

  function ensureRunLog_() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(RUN_LOG_SHEET);
    if (!sh) sh = ss.insertSheet(RUN_LOG_SHEET);
    if (sh.getMaxColumns() < RUN_LOG_HEADERS.length) {
      sh.insertColumnsAfter(sh.getMaxColumns(), RUN_LOG_HEADERS.length - sh.getMaxColumns());
    }

    const currentWidth = Math.max(LEGACY_RUN_LOG_HEADERS.length, Math.min(sh.getLastColumn(), RUN_LOG_HEADERS.length));
    const current = sh.getRange(1,1,1,currentWidth).getValues()[0];
    const legacyCompatible = LEGACY_RUN_LOG_HEADERS.every(function (h,i) {
      return String(current[i] || '') === h;
    });
    if (!legacyCompatible && sh.getLastRow() > 1) {
      throw new Error('Run log temel şeması uyuşmuyor. Mevcut kayıtlar korunarak otomatik migrasyon yapılamaz.');
    }

    if (!legacyCompatible && sh.getLastRow() <= 1) {
      sh.getRange(1,1,1,RUN_LOG_HEADERS.length).setValues([RUN_LOG_HEADERS]);
    } else {
      const currentQuality = sh.getRange(1, LEGACY_RUN_LOG_HEADERS.length + 1, 1, QUALITY_RUN_LOG_HEADERS.length).getValues()[0];
      const qualityCompatible = QUALITY_RUN_LOG_HEADERS.every(function (h,i) {
        return String(currentQuality[i] || '') === h;
      });
      if (!qualityCompatible) {
        const occupied = currentQuality.some(function (v) { return String(v || '') !== ''; });
        if (occupied) throw new Error('Run log kalite sütunları dolu ve beklenen şemayla uyuşmuyor.');
        sh.getRange(1, LEGACY_RUN_LOG_HEADERS.length + 1, 1, QUALITY_RUN_LOG_HEADERS.length)
          .setValues([QUALITY_RUN_LOG_HEADERS]);
      }
    }
    sh.setFrozenRows(1);
    return sh;
  }

  function dateKey_(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!isFinite(d.getTime())) throw new Error('Geçersiz tarih: ' + value);
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  }

  function appendRun_(row) {
    const sh = ensureRunLog_();
    sh.appendRow(RUN_LOG_HEADERS.map(function (h) { return row[h] == null ? '' : row[h]; }));
  }

  function hasSuccessfulRun_(tradingDate, sessionKind, horizon) {
    const sh = ensureRunLog_();
    if (sh.getLastRow() < 2) return false;
    const rows = sh.getRange(2,1,sh.getLastRow()-1,RUN_LOG_HEADERS.length).getValues();
    const idx = {};
    RUN_LOG_HEADERS.forEach(function (h,i) { idx[h] = i; });
    return rows.some(function (r) {
      return String(r[idx.tradingDate]) === tradingDate &&
        String(r[idx.sessionKind]) === sessionKind &&
        String(r[idx.horizon]) === horizon &&
        String(r[idx.status]) === 'SUCCESS';
    });
  }

  function isWeekend_(date) { const day = date.getDay(); return day === 0 || day === 6; }
  function isHoliday_(date, holidays) { return (holidays || []).map(String).indexOf(dateKey_(date)) >= 0; }
  function isTradingDay_(date, options) {
    options = options || {};
    if (typeof isBistTradingDay_ === 'function') return isBistTradingDay_(date);
    return !isWeekend_(date) && !isHoliday_(date, options.holidays || []);
  }

  function acquireLock_(fn) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('Snapshot scheduler kilidi alınamadı.');
    try { return fn(); } finally { lock.releaseLock(); }
  }

  function preflightIntegrity_(options) {
    const opts = options || {};
    if (opts.enabled === false) {
      return {
        valid:true,
        bypassed:true,
        bypassReason:String(opts.bypassReason || 'EXPLICITLY_DISABLED')
      };
    }

    const auditor = opts.audit || (
      typeof APPS_SCRIPT_INTEGRITY_AUDIT !== 'undefined'
        ? APPS_SCRIPT_INTEGRITY_AUDIT
        : null
    );
    if (!auditor || typeof auditor.assertValid !== 'function') {
      const error = new Error('Apps Script bütünlük denetleyicisi tanımlı değil.');
      error.name = 'AppsScriptIntegrityError';
      error.integrityReport = {
        valid:false,
        missingSymbols:['APPS_SCRIPT_INTEGRITY_AUDIT'],
        missingMethods:['APPS_SCRIPT_INTEGRITY_AUDIT.assertValid'],
        brokenRuntimeChain:[]
      };
      throw error;
    }
    return auditor.assertValid(opts.auditOptions || {});
  }

  function safeJson_(value) {
    if (typeof RUN_LOG_QUALITY_INTEGRATION !== 'undefined' && RUN_LOG_QUALITY_INTEGRATION.safeJson) {
      return RUN_LOG_QUALITY_INTEGRATION.safeJson(value);
    }
    try { return JSON.stringify(value == null ? null : value); }
    catch (err) { return JSON.stringify({ serializationError:String(err && err.message || err) }); }
  }

  function integrityDetails_(err) {
    const report = err && err.integrityReport && typeof err.integrityReport === 'object'
      ? err.integrityReport
      : null;
    if (!report && String(err && err.name || '') !== 'AppsScriptIntegrityError') return null;
    const symbols = (report && report.missingSymbols) || [];
    const methods = (report && report.missingMethods) || [];
    const chain = (report && report.brokenRuntimeChain) || [];
    return {
      errorType:String(err && err.name || 'AppsScriptIntegrityError'),
      reasonCodes:['INTEGRITY_CHECK_FAILED'].concat(
        symbols.length ? ['MISSING_SYMBOLS'] : [],
        methods.length ? ['MISSING_METHODS'] : [],
        chain.length ? ['BROKEN_RUNTIME_CHAIN'] : []
      ).join(','),
      qualityModels:'',
      qualityFields:symbols.concat(methods, chain).join(','),
      qualityReportJson:safeJson_(report),
      isIntegrityFailure:true,
      isQualityFailure:false
    };
  }

  function failureDetails_(err) {
    const integrity = integrityDetails_(err);
    if (integrity) return integrity;
    if (typeof RUN_LOG_QUALITY_INTEGRATION !== 'undefined' && RUN_LOG_QUALITY_INTEGRATION.fromError) {
      return RUN_LOG_QUALITY_INTEGRATION.fromError(err);
    }
    return {
      errorType:String(err && err.name || 'Error'),
      reasonCodes:'', qualityModels:'', qualityFields:'', qualityReportJson:'',
      isIntegrityFailure:false, isQualityFailure:false
    };
  }

  function failureStatus_(details) {
    if (details && details.isIntegrityFailure) return 'FAILED_INTEGRITY';
    if (details && details.isQualityFailure) return 'FAILED_DATA_QUALITY';
    return 'FAILED';
  }

  function runSession(input) {
    input = input || {};
    const session = input.session;
    if (!session || !session.sessionKind || !session.horizon) throw new Error('Geçersiz session tanımı.');
    const now = input.now instanceof Date ? input.now : new Date();
    const tradingDate = dateKey_(now);
    const started = Date.now();
    const runId = Utilities.getUuid();

    if (!isTradingDay_(now, input.options || {})) {
      appendRun_({ runId:runId, runTs:now.toISOString(), tradingDate:tradingDate,
        sessionKind:session.sessionKind, horizon:session.horizon,
        status:'SKIPPED_NON_TRADING_DAY', rowCount:0, message:'İşlem günü değil.', durationMs:Date.now()-started });
      return { status:'SKIPPED_NON_TRADING_DAY', tradingDate:tradingDate };
    }

    return acquireLock_(function () {
      if (hasSuccessfulRun_(tradingDate, session.sessionKind, session.horizon)) {
        appendRun_({ runId:runId, runTs:now.toISOString(), tradingDate:tradingDate,
          sessionKind:session.sessionKind, horizon:session.horizon,
          status:'SKIPPED_DUPLICATE', rowCount:0,
          message:'Aynı işlem günü/session/horizon için başarılı snapshot mevcut.', durationMs:Date.now()-started });
        return { status:'SKIPPED_DUPLICATE', tradingDate:tradingDate };
      }

      try {
        const integrity = preflightIntegrity_(input.integrityOptions || {});
        if (typeof buildRuntimeInputs_ !== 'function') throw new Error('buildRuntimeInputs_ adaptörü tanımlı değil.');
        const runtimeInput = buildRuntimeInputs_({
          predictionTs:now,
          horizon:session.horizon,
          sessionKind:session.sessionKind,
          qualityOptions:input.qualityOptions || {}
        });
        runtimeInput.integrity = integrity;
        const saved = saveRuntimeSSelectionSnapshot_(Object.assign({}, runtimeInput, {
          predictionTs:now,
          horizon:session.horizon,
          sessionKind:session.sessionKind,
          bindingOptions:Object.assign({ strict:true }, input.bindingOptions || {})
        }));
        const snapshotId = saved && (saved.snapshotId || saved.id) || '';
        const rowCount = saved && Number(saved.rowCount || saved.count || 0);
        const modelVersion = saved && (saved.modelVersion || saved.version) || '';
        appendRun_({ runId:runId, runTs:now.toISOString(), tradingDate:tradingDate,
          sessionKind:session.sessionKind, horizon:session.horizon,
          status:'SUCCESS', snapshotId:snapshotId, rowCount:rowCount,
          modelVersion:modelVersion, message:'', durationMs:Date.now()-started });
        return { status:'SUCCESS', tradingDate:tradingDate, snapshotId:snapshotId, rowCount:rowCount };
      } catch (err) {
        const details = failureDetails_(err);
        appendRun_({ runId:runId, runTs:now.toISOString(), tradingDate:tradingDate,
          sessionKind:session.sessionKind, horizon:session.horizon,
          status:failureStatus_(details), rowCount:0,
          message:String(err && err.stack || err), durationMs:Date.now()-started,
          errorType:details.errorType, reasonCodes:details.reasonCodes,
          qualityModels:details.qualityModels, qualityFields:details.qualityFields,
          qualityReportJson:details.qualityReportJson });
        throw err;
      }
    });
  }

  function installTriggers(options) {
    options = options || {};
    const replaceExisting = options.replaceExisting !== false;
    const handlers = Object.keys(SESSIONS).map(function (k) { return SESSIONS[k].functionName; });
    if (replaceExisting) ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (handlers.indexOf(trigger.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(trigger);
    });
    return Object.keys(SESSIONS).map(function (key) {
      const s = SESSIONS[key];
      const trigger = ScriptApp.newTrigger(s.functionName).timeBased().atHour(s.hour)
        .nearMinute(s.minute).everyDays(1).inTimezone(TZ).create();
      return { key:key, triggerId:trigger.getUniqueId(), functionName:s.functionName };
    });
  }

  function removeTriggers() {
    const handlers = Object.keys(SESSIONS).map(function (k) { return SESSIONS[k].functionName; });
    let removed = 0;
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (handlers.indexOf(trigger.getHandlerFunction()) >= 0) { ScriptApp.deleteTrigger(trigger); removed++; }
    });
    return { removed:removed };
  }

  function audit() {
    const triggers = ScriptApp.getProjectTriggers().map(function (t) {
      return { id:t.getUniqueId(), handler:t.getHandlerFunction(), eventType:String(t.getEventType()) };
    });
    const expected = Object.keys(SESSIONS).map(function (k) { return SESSIONS[k].functionName; });
    return { version:VERSION, timezone:TZ, runLogHeaders:RUN_LOG_HEADERS.slice(), expectedHandlers:expected,
      installed:triggers.filter(function (t) { return expected.indexOf(t.handler) >= 0; }),
      missingHandlers:expected.filter(function (h) { return !triggers.some(function (t) { return t.handler === h; }); }) };
  }

  function maintenanceAudit() {
    const ss = SpreadsheetApp.getActive();
    const names = ss.getSheets().map(function (s) { return s.getName(); });
    const required = ['Veriler','_Snapshots','_SnapshotOutcomes','_ModelRegistry','_RunLog'];
    return { timestamp:new Date().toISOString(), missingSheets:required.filter(function (n) { return names.indexOf(n) < 0; }),
      integrity:typeof auditAppsScriptIntegrity_ === 'function' ? auditAppsScriptIntegrity_() : null,
      triggerAudit:audit(),
      veriler:typeof auditVerilerRepository_ === 'function' ? auditVerilerRepository_() : null,
      runtimeBinding:typeof auditRuntimeModelBinding_ === 'function' ? auditRuntimeModelBinding_({ strict:false }) : null };
  }

  function cleanupRunLog(input) {
    input = input || {};
    const dryRun = input.dryRun !== false;
    const retentionDays = Math.max(30, Number(input.retentionDays || 180));
    const token = String(input.confirmationToken || '');
    const sh = ensureRunLog_();
    if (sh.getLastRow() < 2) return { dryRun:dryRun, removableRows:0, removedRows:0 };
    const cutoff = Date.now() - retentionDays * 86400000;
    const values = sh.getRange(2,1,sh.getLastRow()-1,RUN_LOG_HEADERS.length).getValues();
    const removable = [];
    values.forEach(function (row,i) { const ts = new Date(row[1]).getTime(); if (isFinite(ts) && ts < cutoff) removable.push(i+2); });
    if (dryRun) return { dryRun:true, removableRows:removable.length, removedRows:0, retentionDays:retentionDays };
    const expected = 'DELETE_RUN_LOG_BEFORE_' + Utilities.formatDate(new Date(cutoff), TZ, 'yyyyMMdd');
    if (token !== expected) throw new Error('Geçersiz confirmationToken. Beklenen: ' + expected);
    removable.sort(function (a,b) { return b-a; }).forEach(function (rowNo) { sh.deleteRow(rowNo); });
    return { dryRun:false, removableRows:removable.length, removedRows:removable.length, retentionDays:retentionDays };
  }

  return Object.freeze({ version:VERSION, sessions:SESSIONS, runLogHeaders:RUN_LOG_HEADERS,
    runSession:runSession, installTriggers:installTriggers, removeTriggers:removeTriggers,
    audit:audit, maintenanceAudit:maintenanceAudit, cleanupRunLog:cleanupRunLog,
    isTradingDay:isTradingDay_, ensureRunLog:ensureRunLog_,
    preflightIntegrity:preflightIntegrity_, failureDetails:failureDetails_, failureStatus:failureStatus_ });
})();

function scheduledSameDayEarlySnapshot_() { return SCHEDULER_AND_MAINTENANCE.runSession({ session:SCHEDULER_AND_MAINTENANCE.sessions.SAME_DAY_EARLY }); }
function scheduledSameDayMidSnapshot_() { return SCHEDULER_AND_MAINTENANCE.runSession({ session:SCHEDULER_AND_MAINTENANCE.sessions.SAME_DAY_MID }); }
function scheduledNextDayCloseSnapshot_() { return SCHEDULER_AND_MAINTENANCE.runSession({ session:SCHEDULER_AND_MAINTENANCE.sessions.NEXT_DAY_CLOSE }); }
function installSnapshotTriggers_(options) { return SCHEDULER_AND_MAINTENANCE.installTriggers(options); }
function removeSnapshotTriggers_() { return SCHEDULER_AND_MAINTENANCE.removeTriggers(); }
function auditSnapshotTriggers_() { return SCHEDULER_AND_MAINTENANCE.audit(); }
function auditSystemMaintenance_() { return SCHEDULER_AND_MAINTENANCE.maintenanceAudit(); }
function cleanupRunLog_(input) { return SCHEDULER_AND_MAINTENANCE.cleanupRunLog(input); }
