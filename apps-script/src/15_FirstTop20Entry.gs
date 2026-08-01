/*
 * Computes the first intraday timestamp at which a predicted symbol enters
 * the real-time BIST Top 20 ranking after predictionTs.
 */
var FIRST_TOP20_ENTRY = (function () {
  'use strict';

  function num_(v) {
    const n = Number(v);
    return isFinite(n) ? n : null;
  }

  function ts_(v, label) {
    const d = v instanceof Date ? v : new Date(v);
    if (!isFinite(d.getTime())) throw new Error((label || 'timestamp') + ' geçersiz.');
    return d.getTime();
  }

  function symbol_(v) {
    return String(v || '').trim().toUpperCase();
  }

  function normalizeBars_(bars) {
    const out = [];
    (bars || []).forEach(function (b) {
      const sym = symbol_(b.symbol || b.sym);
      const t = ts_(b.ts || b.timestamp, 'bar.ts');
      const price = num_(b.price != null ? b.price : b.close);
      const dayReturnPct = num_(b.dayReturnPct != null ? b.dayReturnPct : b.changePct);
      if (!sym || price == null || dayReturnPct == null) return;
      if (b.excluded === true) return;
      out.push({ symbol: sym, ts: t, price: price, dayReturnPct: dayReturnPct });
    });
    out.sort(function (a, b) { return a.ts - b.ts || a.symbol.localeCompare(b.symbol); });
    return out;
  }

  function groupByTimestamp_(bars) {
    const map = new Map();
    bars.forEach(function (b) {
      if (!map.has(b.ts)) map.set(b.ts, []);
      map.get(b.ts).push(b);
    });
    return Array.from(map.entries()).sort(function (a, b) { return a[0] - b[0]; });
  }

  function rankFrame_(frame, topN) {
    return frame.slice().sort(function (a, b) {
      return b.dayReturnPct - a.dayReturnPct || a.symbol.localeCompare(b.symbol);
    }).slice(0, topN).map(function (b, i) {
      return {
        symbol: b.symbol,
        rank: i + 1,
        price: b.price,
        dayReturnPct: b.dayReturnPct,
        ts: b.ts
      };
    });
  }

  function evaluateOne_(snapshotRow, groupedFrames, options) {
    options = options || {};
    const topN = Number(options.topN || 20);
    const predictionTs = ts_(snapshotRow.predictionTs, 'predictionTs');
    const evaluationEndTs = options.evaluationEndTs == null
      ? Number.POSITIVE_INFINITY
      : ts_(options.evaluationEndTs, 'evaluationEndTs');
    const sym = symbol_(snapshotRow.symbol || snapshotRow.sym);
    const entryPrice = num_(snapshotRow.entryPrice);

    let lastSeenPrice = null;
    let framesChecked = 0;

    for (let i = 0; i < groupedFrames.length; i++) {
      const frameTs = groupedFrames[i][0];
      if (frameTs <= predictionTs || frameTs > evaluationEndTs) continue;
      const frame = groupedFrames[i][1];
      framesChecked++;

      for (let j = 0; j < frame.length; j++) {
        if (frame[j].symbol === sym) {
          lastSeenPrice = frame[j].price;
          break;
        }
      }

      const ranked = rankFrame_(frame, topN);
      const hit = ranked.find(function (r) { return r.symbol === sym; });
      if (!hit) continue;

      return {
        snapshotId: snapshotRow.snapshotId || '',
        symbol: sym,
        entered: true,
        firstEntryTs: new Date(frameTs).toISOString(),
        firstEntryRank: hit.rank,
        firstEntryPrice: hit.price,
        returnToFirstEntryPct: entryPrice != null && entryPrice !== 0
          ? (hit.price / entryPrice - 1) * 100
          : null,
        dayReturnPctAtEntry: hit.dayReturnPct,
        minutesFromPrediction: (frameTs - predictionTs) / 60000,
        framesChecked: framesChecked,
        lastSeenPrice: lastSeenPrice
      };
    }

    return {
      snapshotId: snapshotRow.snapshotId || '',
      symbol: sym,
      entered: false,
      firstEntryTs: null,
      firstEntryRank: null,
      firstEntryPrice: null,
      returnToFirstEntryPct: null,
      dayReturnPctAtEntry: null,
      minutesFromPrediction: null,
      framesChecked: framesChecked,
      lastSeenPrice: lastSeenPrice
    };
  }

  function evaluate(input) {
    input = input || {};
    const snapshotRows = Array.isArray(input.snapshotRows) ? input.snapshotRows : [];
    const bars = normalizeBars_(input.marketBars || []);
    const grouped = groupByTimestamp_(bars);
    return snapshotRows.map(function (row) {
      return evaluateOne_(row, grouped, input.options || {});
    });
  }

  return Object.freeze({
    evaluate: evaluate,
    normalizeBars: normalizeBars_,
    rankFrame: rankFrame_
  });
})();

function evaluateFirstTop20Entry_(input) {
  return FIRST_TOP20_ENTRY.evaluate(input);
}
