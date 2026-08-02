/*
 * Canonical feature computation pipeline.
 *
 * Source mapping: legacy fetchAndCompute_ in V_141225 lines 1723-2036.
 * The pipeline separates acquisition, normalization, technical features,
 * legacy approximations and the public record contract.
 */
var FEATURE_PIPELINE = (function () {
  'use strict';

  function n_(value) {
    if (typeof parseLocaleNumber_ === 'function') return parseLocaleNumber_(value);
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function validLast_(series) {
    for (let i = (series || []).length - 1; i >= 0; i--) {
      if (series[i] != null && Number.isFinite(Number(series[i]))) return Number(series[i]);
    }
    return null;
  }

  function emptyRecord_(symbol, error) {
    return {
      ok: false,
      error: error || 'NO_DATA',
      Hisse: String(symbol || '').trim().toUpperCase(),
      VeriZamani: new Date(),
      Anlik: null,
      AnlikDegisim: null,
      Degisim3Gun: '',
      Destekler3: '',
      Direncler3: '',
      latestLabel: null,
      latest: { tarih: '', fiyatDeg: null, kapanis: null, min: null, max: null, hacim: null, hacimDeg: null },
      EMA20: null, EMA50: null, EMA200: null,
      MACD: null, MACDSignal: null, MACDHist: null,
      RSI14: null, Momentum10: null,
      Volatilite5G: null, Volatilite21G: null, Volatilite63G: null,
      Boll_Orta: null, Boll_Std: null, Boll_Alt: null, Boll_Ust: null,
      PD: null, SERMAYE: null, FD: null, FAVOK: null, FD_FAVOK: null,
      F_K: null, PD_DD: null, ROE_Yaklasik: null, Beta: null, Teknik_Sinyal: null,
      Getiri_TL_1A: null, Getiri_TL_3A: null, Getiri_TL_6A: null,
      Getiri_USD_1A: null, Getiri_USD_3A: null, Getiri_USD_6A: null,
      Getiri_XU_1A: null, Getiri_XU_3A: null, Getiri_XU_6A: null,
      legacyApprox: { FD: null, FAVOK: null, FD_FAVOK: null },
      arrays: {}
    };
  }

  function dateValue_(row) {
    const raw = row && row.HGDG_TARIH;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function normalizeRows(rows) {
    const prepared = (Array.isArray(rows) ? rows : [])
      .map(function (row, sourceIndex) {
        return { row: row || {}, date: dateValue_(row || {}), sourceIndex: sourceIndex };
      })
      .filter(function (x) { return x.date != null; })
      .sort(function (a, b) { return a.date.getTime() - b.date.getTime() || a.sourceIndex - b.sourceIndex; });

    const seen = {};
    const deduped = [];
    prepared.forEach(function (x) {
      const key = x.date.getTime();
      // Same-day duplicates are resolved deterministically in favour of the last source row.
      if (seen[key] != null) deduped[seen[key]] = x;
      else { seen[key] = deduped.length; deduped.push(x); }
    });
    return deduped.map(function (x) { return x.row; });
  }

  function extractSeries(rows) {
    function field(name, aliases) {
      return rows.map(function (r) {
        let value = r[name];
        if (value == null && aliases) {
          for (let i = 0; i < aliases.length; i++) if (r[aliases[i]] != null) { value = r[aliases[i]]; break; }
        }
        return n_(value);
      });
    }
    return {
      tarihRaw: rows.map(function (r) { return String(r.HGDG_TARIH || ''); }),
      kapanis: field('HGDG_KAPANIS'),
      minArr: field('HGDG_MIN'),
      maxArr: field('HGDG_MAX'),
      hacim: field('HGDG_HACIM'),
      dolar: field('DOLAR_BAZLI_AOF'),
      endeks: field('HG_AOF'),
      pd: field('PD'),
      sermaye: field('SERMAYE'),
      fk: field('F_K', ['FK']),
      pddd: field('PD_DD', ['PB', 'PDD']),
      fd: field('FD'),
      favok: field('FAVOK')
    };
  }

  function pivotLevels_(high, low, close) {
    if (![high, low, close].every(function (v) { return v != null && Number.isFinite(v); })) {
      return { supports: [], resistances: [] };
    }
    const p = (high + low + close) / 3;
    const s1 = 2 * p - high;
    const s2 = p - (high - low);
    const s3 = s2 - (high - low);
    const r1 = 2 * p - low;
    const r2 = p + (high - low);
    const r3 = r2 + (high - low);
    return { supports: [s1, s2, s3], resistances: [r1, r2, r3] };
  }

  function signalSeries_(macd, rsi) {
    return macd.map(function (m, i) {
      const r = rsi[i];
      if (m == null || r == null) return null;
      if (m > 0 && r > 70) return 'Güçlü Al';
      if (m > 0 && r > 50) return 'Al';
      if (m < 0 && r < 30) return 'Güçlü Sat';
      if (m < 0 && r < 50) return 'Sat';
      return 'Nötr';
    });
  }

  function computeFromRows(symbol, rawRows, options) {
    options = options || {};
    const rows = normalizeRows(rawRows);
    if (!rows.length) return emptyRecord_(symbol, 'NO_VALID_ROWS');

    const s = extractSeries(rows);
    const I = BIST_INDICATORS;
    const bundle = I.computeBundle(s.kapanis);
    const degF = I.pctChange(s.kapanis);
    const degH = I.pctChange(s.hacim);
    const vol5 = I.rollingStdev(degF, 5);
    const vol21 = I.rollingStdev(degF, 21);
    const vol63 = I.rollingStdev(degF, 63);
    const boll = I.bollinger(s.kapanis, 20, 2);
    const beta = I.betaFromReturns(s.kapanis, s.endeks, 60);

    const di = s.kapanis.length - 1;
    const close = s.kapanis[di];
    const previousClose = di > 0 ? s.kapanis[di - 1] : null;
    const priceChange = previousClose != null && close != null && previousClose !== 0
      ? (close / previousClose - 1) * 100 : null;
    const volumeChange = degH[di] != null ? degH[di] : null;
    const pivots = pivotLevels_(s.maxArr[di], s.minArr[di], close);

    const pdSeries = s.pd.slice();
    const capitalSeries = s.sermaye.slice();
    const fkSeries = s.fk.map(function (v, i) {
      return v != null ? v : (pdSeries[i] != null && s.kapanis[i] ? pdSeries[i] / (s.kapanis[i] * 4) : null);
    });
    const pdddSeries = s.pddd.map(function (v, i) {
      const denominator = capitalSeries[i] != null && s.kapanis[i] != null ? capitalSeries[i] * s.kapanis[i] : null;
      return v != null ? v : (pdSeries[i] != null && denominator ? pdSeries[i] / denominator : null);
    });

    // Canonical financial fields are only populated from explicit source fields.
    const fdSeries = s.fd.slice();
    const favokSeries = s.favok.slice();
    const fdFavokSeries = fdSeries.map(function (v, i) {
      return v != null && favokSeries[i] != null && favokSeries[i] !== 0 ? v / favokSeries[i] : null;
    });

    // Retain legacy approximations under an explicitly labelled namespace only.
    const legacyFd = pdSeries.slice();
    const legacyFavok = s.kapanis.map(function (v, i) {
      return v != null && s.hacim[i] != null ? v * s.hacim[i] * 0.2 : null;
    });
    const legacyFdFavok = legacyFd.map(function (v, i) {
      return v != null && legacyFavok[i] ? v / legacyFavok[i] : null;
    });

    const roeSeries = fkSeries.map(function (fk, i) {
      const denominator = capitalSeries[i] != null && s.kapanis[i] != null ? capitalSeries[i] * s.kapanis[i] : null;
      return fk != null && fk !== 0 && pdSeries[i] != null && denominator ? ((pdSeries[i] / fk) / denominator) * 100 : null;
    });
    const signals = signalSeries_(bundle.macd, bundle.rsi14);

    const liveLast = n_(options.liveLast);
    const marketOpen = Boolean(options.marketOpen);
    const anlik = marketOpen && liveLast != null && liveLast > 0 ? liveLast : close;
    const anlikDeg = marketOpen && liveLast != null && close
      ? (liveLast / close - 1) * 100 : priceChange;

    const tl1 = I.rollingReturn(s.kapanis, 21), tl3 = I.rollingReturn(s.kapanis, 63), tl6 = I.rollingReturn(s.kapanis, 126);
    const usd1 = I.rollingReturn(s.dolar, 21), usd3 = I.rollingReturn(s.dolar, 63), usd6 = I.rollingReturn(s.dolar, 126);
    const xu1 = I.rollingReturn(s.endeks, 21), xu3 = I.rollingReturn(s.endeks, 63), xu6 = I.rollingReturn(s.endeks, 126);

    const latestLabel = s.tarihRaw[di] || null;
    return {
      ok: true,
      error: null,
      Hisse: String(symbol || '').trim().toUpperCase(),
      VeriZamani: options.featureTimestamp instanceof Date ? options.featureTimestamp : new Date(),
      Anlik: anlik,
      AnlikDegisim: anlikDeg,
      Degisim3Gun: [degF[di], degF[di - 1], degF[di - 2]].filter(function (v) { return v != null; }).map(function (v) { return Number(v).toFixed(2); }).join(' | '),
      Destekler3: pivots.supports.map(function (v) { return v.toFixed(2); }).join(' | '),
      Direncler3: pivots.resistances.map(function (v) { return v.toFixed(2); }).join(' | '),
      latestLabel: latestLabel,
      latest: { tarih: latestLabel, fiyatDeg: priceChange, kapanis: close, min: s.minArr[di], max: s.maxArr[di], hacim: s.hacim[di], hacimDeg: volumeChange },
      EMA20: validLast_(bundle.ema20), EMA50: validLast_(bundle.ema50), EMA200: validLast_(bundle.ema200),
      MACD: validLast_(bundle.macd), MACDSignal: validLast_(bundle.macdSignal), MACDHist: validLast_(bundle.macdHist),
      RSI14: validLast_(bundle.rsi14), Momentum10: validLast_(bundle.momentum10),
      Volatilite5G: validLast_(vol5), Volatilite21G: validLast_(vol21), Volatilite63G: validLast_(vol63),
      Boll_Orta: validLast_(boll.middle), Boll_Std: validLast_(boll.stdev), Boll_Alt: validLast_(boll.lower), Boll_Ust: validLast_(boll.upper),
      PD: validLast_(pdSeries), SERMAYE: validLast_(capitalSeries), FD: validLast_(fdSeries), FAVOK: validLast_(favokSeries), FD_FAVOK: validLast_(fdFavokSeries),
      F_K: validLast_(fkSeries), PD_DD: validLast_(pdddSeries), ROE_Yaklasik: validLast_(roeSeries), Beta: validLast_(beta), Teknik_Sinyal: signals[signals.length - 1] || null,
      Getiri_TL_1A: validLast_(tl1), Getiri_TL_3A: validLast_(tl3), Getiri_TL_6A: validLast_(tl6),
      Getiri_USD_1A: validLast_(usd1), Getiri_USD_3A: validLast_(usd3), Getiri_USD_6A: validLast_(usd6),
      Getiri_XU_1A: validLast_(xu1), Getiri_XU_3A: validLast_(xu3), Getiri_XU_6A: validLast_(xu6),
      legacyApprox: { FD: validLast_(legacyFd), FAVOK: validLast_(legacyFavok), FD_FAVOK: validLast_(legacyFdFavok) },
      arrays: {
        TARIH_S: s.tarihRaw, kapanis: s.kapanis, minArr: s.minArr, maxArr: s.maxArr, hacim: s.hacim, degF: degF, degH: degH,
        EMA20_S: bundle.ema20, EMA50_S: bundle.ema50, EMA200_S: bundle.ema200,
        MACD_S: bundle.macd, MACDSignal_S: bundle.macdSignal, MACDHist_S: bundle.macdHist,
        RSI14_S: bundle.rsi14, Momentum10_S: bundle.momentum10,
        Vol5_S: vol5, Vol21_S: vol21, Vol63_S: vol63,
        Boll_MU_S: boll.middle, Boll_STD_S: boll.stdev, Boll_LOW_S: boll.lower, Boll_UP_S: boll.upper,
        PD_S: pdSeries, SERMAYE_S: capitalSeries, FD_S: fdSeries, FAVOK_S: favokSeries, FD_FAVOK_S: fdFavokSeries,
        FK_S: fkSeries, PD_DD_S: pdddSeries, ROE_S: roeSeries, Beta_S: beta, Teknik_Sinyal_S: signals,
        GET_TL_1A_S: tl1, GET_TL_3A_S: tl3, GET_TL_6A_S: tl6,
        GET_USD_1A_S: usd1, GET_USD_3A_S: usd3, GET_USD_6A_S: usd6,
        GET_XU_1A_S: xu1, GET_XU_3A_S: xu3, GET_XU_6A_S: xu6
      }
    };
  }

  function fetchAndCompute(symbol, monthsBack, options) {
    options = options || {};
    let rows = options.preRows;
    if (!Array.isArray(rows)) {
      const result = BIST_API.fetchOne(symbol, monthsBack);
      if (!result.ok) return emptyRecord_(symbol, result.error);
      rows = result.rows;
    }
    return computeFromRows(symbol, rows, options);
  }

  return Object.freeze({ normalizeRows: normalizeRows, extractSeries: extractSeries, computeFromRows: computeFromRows, fetchAndCompute: fetchAndCompute, emptyRecord: emptyRecord_ });
})();

function fetchAndComputeV2_(symbol, monthsBack, preRows) {
  const now = new Date();
  return FEATURE_PIPELINE.fetchAndCompute(symbol, monthsBack, {
    preRows: Array.isArray(preRows) ? preRows : null,
    marketOpen: typeof isTradingWindow_ === 'function' ? isTradingWindow_(now) : false,
    liveLast: typeof getLiveLast_ === 'function' && typeof isTradingWindow_ === 'function' && isTradingWindow_(now) ? getLiveLast_(symbol) : null,
    featureTimestamp: now
  });
}
