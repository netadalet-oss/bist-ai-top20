/*
 * Snapshot outcome evaluator.
 *
 * Produces labels only from observations strictly after predictionTs. The
 * evaluator is pure: callers provide immutable snapshot rows and market bars.
 * Sheet/database adapters can be added without changing the label contract.
 */
var OUTCOME_EVALUATOR = (function () {
  'use strict';

  const HORIZONS = Object.freeze({
    SAME_DAY_CLOSE: 'SAME_DAY_CLOSE',
    NEXT_TRADING_DAY_CLOSE: 'NEXT_TRADING_DAY_CLOSE'
  });

  function number_(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function date_(v, label) {
    const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
    if (!isFinite(d.getTime())) throw new Error((label || 'date') + ' geçerli değil.');
    return d;
  }

  function dayKey_(v, timeZone) {
    const d = date_(v, 'date');
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(d, timeZone || 'Europe/Istanbul', 'yyyy-MM-dd');
    }
    return d.toISOString().slice(0, 10);
  }

  function symbol_(v) {
    const s = String(v || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(s)) throw new Error('Geçersiz sembol: ' + v);
    return s;
  }

  function isTradingDay_(day, options) {
    const d = date_(day, 'trading day');
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) return false;
    const holidays = new Set((options && options.holidays || []).map(function (x) {
      return dayKey_(x, options && options.timeZone);
    }));
    return !holidays.has(dayKey_(d, options && options.timeZone));
  }

  function nextTradingDay_(day, options) {
    const d = date_(day, 'day');
    d.setUTCHours(12, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (isTradingDay_(d, options || {})) return dayKey_(d, options && options.timeZone);
    }
    throw new Error('Sonraki işlem günü 14 günlük aralıkta bulunamadı.');
  }

  function normalizeBars_(bars, options) {
    const out = [];
    const seen = new Set();
    (bars || []).forEach(function (bar, index) {
      if (!bar) return;
      const sym = symbol_(bar.symbol || bar.sym);
      const ts = date_(bar.ts || bar.timestamp || bar.evaluationTs || bar.date, 'bar.ts');
      const close = number_(bar.close != null ? bar.close : bar.price);
      const sessionReturnPct = number_(bar.sessionReturnPct != null ? bar.sessionReturnPct : bar.returnPct);
      const high = number_(bar.high);
      const low = number_(bar.low);
      const quality = String(bar.quality || 'VALID').toUpperCase();
      const excluded = bar.excluded === true || quality !== 'VALID';
      const key = sym + '|' + ts.toISOString();
      if (seen.has(key)) throw new Error('Mükerrer piyasa gözlemi: ' + key);
      seen.add(key);
      out.push({
        symbol: sym,
        ts: ts,
        day: dayKey_(ts, options && options.timeZone),
        close: close,
        high: high,
        low: low,
        sessionReturnPct: sessionReturnPct,
        quality: quality,
        excluded: excluded,
        sourceIndex: index
      });
    });
    out.sort(function (a, b) { return a.ts - b.ts || a.symbol.localeCompare(b.symbol); });
    return out;
  }

  function buildTop20_(barsForDay) {
    return (barsForDay || [])
      .filter(function (b) {
        return !b.excluded && b.sessionReturnPct != null && isFinite(b.sessionReturnPct);
      })
      .sort(function (a, b) {
        return b.sessionReturnPct - a.sessionReturnPct || a.symbol.localeCompare(b.symbol);
      })
      .slice(0, 20)
      .map(function (b, i) {
        return { symbol: b.symbol, rank: i + 1, sessionReturnPct: b.sessionReturnPct, close: b.close };
      });
  }

  function extremaAfterPrediction_(symbol, predictionTs, evaluationTs, bars, entryPrice) {
    const eligible = bars.filter(function (b) {
      return b.symbol === symbol && !b.excluded && b.ts > predictionTs && b.ts <= evaluationTs;
    });
    if (!eligible.length || entryPrice == null || entryPrice === 0) {
      return { maxFavorablePct: null, maxAdversePct: null, observationCount: eligible.length };
    }
    let maxPrice = null;
    let minPrice = null;
    eligible.forEach(function (b) {
      const hi = b.high != null ? b.high : b.close;
      const lo = b.low != null ? b.low : b.close;
      if (hi != null) maxPrice = maxPrice == null ? hi : Math.max(maxPrice, hi);
      if (lo != null) minPrice = minPrice == null ? lo : Math.min(minPrice, lo);
    });
    return {
      maxFavorablePct: maxPrice == null ? null : (maxPrice / entryPrice - 1) * 100,
      maxAdversePct: minPrice == null ? null : (minPrice / entryPrice - 1) * 100,
      observationCount: eligible.length
    };
  }

  function evaluateHorizon_(snapshotRows, normalizedBars, horizon, targetDay, options) {
    const dayBars = normalizedBars.filter(function (b) { return b.day === targetDay; });
    const top20 = buildTop20_(dayBars);
    const topMap = new Map(top20.map(function (x) { return [x.symbol, x]; }));
    const closeMap = new Map();
    dayBars.filter(function (b) { return !b.excluded; }).forEach(function (b) {
      const old = closeMap.get(b.symbol);
      if (!old || b.ts > old.ts) closeMap.set(b.symbol, b);
    });

    return snapshotRows.map(function (row) {
      const sym = symbol_(row.symbol || row.sym);
      const predictionTs = date_(row.predictionTs, 'predictionTs');
      const entryPrice = number_(row.entryPrice);
      const target = closeMap.get(sym) || null;
      const evaluationTs = target ? target.ts : date_(targetDay + 'T20:00:00Z', 'evaluationTs');
      const hit = topMap.get(sym) || null;
      const targetPrice = target ? target.close : null;
      const returnPct = entryPrice != null && entryPrice !== 0 && targetPrice != null
        ? (targetPrice / entryPrice - 1) * 100
        : null;
      const extrema = extremaAfterPrediction_(sym, predictionTs, evaluationTs, normalizedBars, entryPrice);
      return {
        symbol: sym,
        horizon: horizon,
        evaluationTs: evaluationTs,
        top20Hit: !!hit,
        top20Rank: hit ? hit.rank : null,
        targetPrice: targetPrice,
        returnPct: returnPct,
        maxFavorablePct: extrema.maxFavorablePct,
        maxAdversePct: extrema.maxAdversePct,
        payload: {
          targetDay: targetDay,
          predictionTs: predictionTs.toISOString(),
          entryPrice: entryPrice,
          sessionReturnPct: target ? target.sessionReturnPct : null,
          observationCount: extrema.observationCount,
          marketUniverseCount: dayBars.filter(function (b) { return !b.excluded; }).length,
          top20UniverseCount: top20.length,
          dataAvailable: !!target,
          quality: target ? target.quality : 'MISSING'
        }
      };
    });
  }

  function evaluateSnapshot(input) {
    input = input || {};
    const rows = Array.isArray(input.snapshotRows) ? input.snapshotRows : [];
    if (!rows.length) throw new Error('Değerlendirilecek snapshot satırı bulunamadı.');
    const options = input.options || {};
    const predictionDays = Array.from(new Set(rows.map(function (r) {
      return dayKey_(r.predictionTs, options.timeZone);
    })));
    if (predictionDays.length !== 1) throw new Error('Bir snapshot tek işlem gününe ait olmalıdır.');

    const sameDay = predictionDays[0];
    const nextDay = nextTradingDay_(sameDay + 'T12:00:00Z', options);
    const bars = normalizeBars_(input.marketBars || [], options);
    const outcomes = [];

    if (input.includeSameDay !== false) {
      Array.prototype.push.apply(outcomes,
        evaluateHorizon_(rows, bars, HORIZONS.SAME_DAY_CLOSE, sameDay, options));
    }
    if (input.includeNextDay !== false) {
      Array.prototype.push.apply(outcomes,
        evaluateHorizon_(rows, bars, HORIZONS.NEXT_TRADING_DAY_CLOSE, nextDay, options));
    }
    return {
      sameDay: sameDay,
      nextTradingDay: nextDay,
      outcomes: outcomes
    };
  }

  function evaluateAndSave(input) {
    const snapshotId = String(input && input.snapshotId || '');
    if (!snapshotId) throw new Error('snapshotId zorunludur.');
    if (typeof SNAPSHOT_STORE === 'undefined') throw new Error('SNAPSHOT_STORE yüklenmemiş.');
    const rows = SNAPSHOT_STORE.readSnapshot(snapshotId);
    if (!rows.length) throw new Error('Snapshot bulunamadı: ' + snapshotId);
    const evaluated = evaluateSnapshot({
      snapshotRows: rows,
      marketBars: input.marketBars || [],
      includeSameDay: input.includeSameDay,
      includeNextDay: input.includeNextDay,
      options: input.options || {}
    });
    const saved = SNAPSHOT_STORE.appendOutcomes({ snapshotId: snapshotId, outcomes: evaluated.outcomes });
    return { evaluation: evaluated, saved: saved };
  }

  return Object.freeze({
    HORIZONS: HORIZONS,
    nextTradingDay: nextTradingDay_,
    normalizeBars: normalizeBars_,
    buildTop20: buildTop20_,
    evaluateSnapshot: evaluateSnapshot,
    evaluateAndSave: evaluateAndSave
  });
})();

function evaluateSnapshotOutcomes_(input) {
  return OUTCOME_EVALUATOR.evaluateSnapshot(input);
}

function evaluateAndSaveSnapshotOutcomes_(input) {
  return OUTCOME_EVALUATOR.evaluateAndSave(input);
}
