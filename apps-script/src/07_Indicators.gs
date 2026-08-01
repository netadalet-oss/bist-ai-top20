/*
 * Pure technical indicator library.
 *
 * Legacy source mapping:
 * - helper block duplicated at V_141225 lines 1527-1607 and 1609-1689
 * - indicator composition at V_141225 lines 1847-1889
 *
 * All functions are side-effect free and independent of SpreadsheetApp.
 */
var BIST_INDICATORS = (function () {
  'use strict';

  function finiteOrNull_(value) {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeSeries_(values) {
    return (values || []).map(finiteOrNull_);
  }

  function lastValid(values) {
    const arr = values || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      const n = finiteOrNull_(arr[i]);
      if (n != null) return n;
    }
    return null;
  }

  function pctChange(values) {
    const arr = normalizeSeries_(values);
    const out = new Array(arr.length).fill(null);
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      if (prev != null && prev !== 0 && cur != null) out[i] = ((cur - prev) / prev) * 100;
    }
    return out;
  }

  function rollingReturn(values, lag) {
    const arr = normalizeSeries_(values);
    const g = Math.max(1, Math.floor(Number(lag || 1)));
    const out = new Array(arr.length).fill(null);
    for (let i = g; i < arr.length; i++) {
      const prev = arr[i - g];
      const cur = arr[i];
      if (prev != null && prev !== 0 && cur != null) out[i] = ((cur - prev) / prev) * 100;
    }
    return out;
  }

  /* Legacy-compatible EMA seed: first valid observation. Null starts a new segment. */
  function ema(values, period) {
    const arr = normalizeSeries_(values);
    const p = Math.max(1, Math.floor(Number(period || 1)));
    const alpha = 2 / (p + 1);
    const out = new Array(arr.length).fill(null);
    let previous = null;
    for (let i = 0; i < arr.length; i++) {
      const value = arr[i];
      if (value == null) {
        previous = null;
        continue;
      }
      previous = previous == null ? value : alpha * value + (1 - alpha) * previous;
      out[i] = previous;
    }
    return out;
  }

  /* Wilder RSI. A null breaks the sequence; calculation restarts after a full period. */
  function rsi(values, period) {
    const arr = normalizeSeries_(values);
    const p = Math.max(1, Math.floor(Number(period || 14)));
    const out = new Array(arr.length).fill(null);
    let segmentStart = 0;

    while (segmentStart < arr.length) {
      while (segmentStart < arr.length && arr[segmentStart] == null) segmentStart++;
      let segmentEnd = segmentStart;
      while (segmentEnd < arr.length && arr[segmentEnd] != null) segmentEnd++;
      if (segmentEnd - segmentStart >= p + 1) {
        let gains = 0;
        let losses = 0;
        for (let i = segmentStart + 1; i <= segmentStart + p; i++) {
          const change = arr[i] - arr[i - 1];
          if (change > 0) gains += change;
          else losses -= change;
        }
        let avgGain = gains / p;
        let avgLoss = losses / p;
        out[segmentStart + p] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        for (let i = segmentStart + p + 1; i < segmentEnd; i++) {
          const change = arr[i] - arr[i - 1];
          const gain = Math.max(change, 0);
          const loss = Math.max(-change, 0);
          avgGain = (avgGain * (p - 1) + gain) / p;
          avgLoss = (avgLoss * (p - 1) + loss) / p;
          out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }
      }
      segmentStart = segmentEnd + 1;
    }
    return out;
  }

  function rollingMean(values, window) {
    const arr = normalizeSeries_(values);
    const w = Math.max(1, Math.floor(Number(window || 1)));
    const out = new Array(arr.length).fill(null);
    let sum = 0;
    let valid = 0;
    const queue = [];
    for (let i = 0; i < arr.length; i++) {
      const value = arr[i];
      queue.push(value);
      if (value != null) { sum += value; valid++; }
      if (queue.length > w) {
        const old = queue.shift();
        if (old != null) { sum -= old; valid--; }
      }
      if (queue.length === w && valid === w) out[i] = sum / w;
    }
    return out;
  }

  function rollingStdev(values, window, sample) {
    const arr = normalizeSeries_(values);
    const w = Math.max(1, Math.floor(Number(window || 1)));
    const useSample = sample === true;
    const out = new Array(arr.length).fill(null);
    let sum = 0;
    let sumSquares = 0;
    let valid = 0;
    const queue = [];
    for (let i = 0; i < arr.length; i++) {
      const value = arr[i];
      queue.push(value);
      if (value != null) { sum += value; sumSquares += value * value; valid++; }
      if (queue.length > w) {
        const old = queue.shift();
        if (old != null) { sum -= old; sumSquares -= old * old; valid--; }
      }
      if (queue.length === w && valid === w) {
        const denominator = useSample ? w - 1 : w;
        if (denominator > 0) {
          const centered = sumSquares - (sum * sum) / w;
          out[i] = Math.sqrt(Math.max(0, centered / denominator));
        }
      }
    }
    return out;
  }

  function bollinger(values, period, multiplier) {
    const p = Math.max(1, Math.floor(Number(period || 20)));
    const k = Number.isFinite(Number(multiplier)) ? Number(multiplier) : 2;
    const middle = rollingMean(values, p);
    const stdev = rollingStdev(values, p, false);
    return {
      middle: middle,
      stdev: stdev,
      lower: middle.map(function (m, i) { return m != null && stdev[i] != null ? m - k * stdev[i] : null; }),
      upper: middle.map(function (m, i) { return m != null && stdev[i] != null ? m + k * stdev[i] : null; })
    };
  }

  function momentum(values, lag) {
    const arr = normalizeSeries_(values);
    const g = Math.max(1, Math.floor(Number(lag || 10)));
    return arr.map(function (value, i) {
      return i >= g && value != null && arr[i - g] != null ? value - arr[i - g] : null;
    });
  }

  function macd(values, fastPeriod, slowPeriod, signalPeriod) {
    const fast = ema(values, fastPeriod || 12);
    const slow = ema(values, slowPeriod || 26);
    const line = fast.map(function (value, i) {
      return value != null && slow[i] != null ? value - slow[i] : null;
    });
    const signal = ema(line, signalPeriod || 9);
    const histogram = line.map(function (value, i) {
      return value != null && signal[i] != null ? value - signal[i] : null;
    });
    return { line: line, signal: signal, histogram: histogram };
  }

  function betaFromReturns(assetPrices, benchmarkPrices, window) {
    const assetReturns = pctChange(assetPrices);
    const benchmarkReturns = pctChange(benchmarkPrices);
    const w = Math.max(2, Math.floor(Number(window || 60)));
    const n = Math.min(assetReturns.length, benchmarkReturns.length);
    const out = new Array(n).fill(null);
    for (let i = w; i < n; i++) {
      const a = assetReturns.slice(i - w + 1, i + 1);
      const b = benchmarkReturns.slice(i - w + 1, i + 1);
      if (a.some(function (x) { return x == null; }) || b.some(function (x) { return x == null; })) continue;
      const meanA = a.reduce(function (s, x) { return s + x; }, 0) / w;
      const meanB = b.reduce(function (s, x) { return s + x; }, 0) / w;
      let covariance = 0;
      let varianceB = 0;
      for (let j = 0; j < w; j++) {
        covariance += (a[j] - meanA) * (b[j] - meanB);
        varianceB += (b[j] - meanB) * (b[j] - meanB);
      }
      out[i] = varianceB === 0 ? null : covariance / varianceB;
    }
    return out;
  }

  function computeBundle(closeValues) {
    const close = normalizeSeries_(closeValues);
    const changes = pctChange(close);
    const macdSet = macd(close, 12, 26, 9);
    const boll = bollinger(close, 20, 2);
    return {
      close: close,
      changePct: changes,
      ema20: ema(close, 20),
      ema50: ema(close, 50),
      ema200: ema(close, 200),
      macd: macdSet.line,
      macdSignal: macdSet.signal,
      macdHistogram: macdSet.histogram,
      rsi14: rsi(close, 14),
      momentum10: momentum(close, 10),
      volatility5: rollingStdev(changes, 5, false),
      volatility21: rollingStdev(changes, 21, false),
      volatility63: rollingStdev(changes, 63, false),
      bollingerMiddle: boll.middle,
      bollingerStdev: boll.stdev,
      bollingerLower: boll.lower,
      bollingerUpper: boll.upper
    };
  }

  return Object.freeze({
    lastValid: lastValid,
    pctChange: pctChange,
    rollingReturn: rollingReturn,
    ema: ema,
    rsi: rsi,
    rollingMean: rollingMean,
    rollingStdev: rollingStdev,
    bollinger: bollinger,
    momentum: momentum,
    macd: macd,
    betaFromReturns: betaFromReturns,
    computeBundle: computeBundle
  });
})();
