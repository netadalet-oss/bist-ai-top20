/*
 * Her hisse için zorunlu ve değişmez veri kaynağı sırası:
 * ISYATIRIM -> ISYATIRIM_LIVE -> YAHOO -> YAHOO_QUOTE -> BIGPARA -> STOOQ
 *
 * Altı kaynak her sembolde sırayla denenir. Başarısız kaynak zinciri kesmez.
 * Sonuçlar alan bazında birleştirilir; yüksek öncelikli kaynakta bulunan geçerli
 * değer daha düşük öncelikli kaynak tarafından ezilmez. Her alanın kaynağı
 * `lineage` içinde saklanır.
 */

var SEQUENTIAL_PROVIDER_CHAIN = (function (baseClient) {
  'use strict';

  const VERSION = 'PROVIDER-CHAIN-1.0.0';
  const ORDER = Object.freeze([
    'ISYATIRIM',
    'ISYATIRIM_LIVE',
    'YAHOO',
    'YAHOO_QUOTE',
    'BIGPARA',
    'STOOQ'
  ]);
  const PRIORITY = Object.freeze({
    ISYATIRIM: 600,
    ISYATIRIM_LIVE: 550,
    YAHOO: 500,
    YAHOO_QUOTE: 450,
    BIGPARA: 400,
    STOOQ: 300
  });
  const HEADERS = Object.freeze({
    'User-Agent': 'Mozilla/5.0 (compatible; AurumTop20/1.0)',
    'Accept': 'application/json,text/csv,*/*'
  });

  function finite_(value) {
    if (value == null || value === '') return null;
    const n = Number(String(value).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function symbol_(value) {
    const s = String(value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(s)) throw new Error('Geçersiz hisse kodu: ' + value);
    return s;
  }

  function isoDay_(value) {
    if (value == null || value === '') return null;
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
    const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(String(value));
    if (!m) return null;
    return [m[3], String(m[2]).padStart(2, '0'), String(m[1]).padStart(2, '0')].join('-');
  }

  function trDate_(date) {
    return Utilities.formatDate(date, 'Europe/Istanbul', 'dd-MM-yyyy');
  }

  function compactDate_(date) {
    return Utilities.formatDate(date, 'Europe/Istanbul', 'yyyyMMdd');
  }

  function addMonths_(date, delta) {
    const d = new Date(date.getTime());
    d.setMonth(d.getMonth() + delta);
    return d;
  }

  function fetchText_(url, accept) {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: Object.assign({}, HEADERS, {'Accept': accept || HEADERS.Accept})
    });
    const code = response.getResponseCode();
    const text = response.getContentText() || '';
    if (code < 200 || code >= 300) throw new Error('HTTP ' + code);
    return text;
  }

  function json_(url) {
    const text = fetchText_(url, 'application/json');
    let root = JSON.parse(text || '{}');
    if (typeof root === 'string') root = JSON.parse(root);
    return root;
  }

  function canonicalBar_(date, values, provider) {
    return {
      date: isoDay_(date),
      open: finite_(values.open),
      high: finite_(values.high),
      low: finite_(values.low),
      close: finite_(values.close),
      adjustedClose: finite_(values.adjustedClose),
      volume: finite_(values.volume),
      tradeCount: finite_(values.tradeCount),
      vwap: finite_(values.vwap),
      usdAof: finite_(values.usdAof),
      indexAof: finite_(values.indexAof),
      provider: provider
    };
  }

  function fromIsYatirim_(sym, monthsBack) {
    const result = baseClient.fetchOne(sym, monthsBack);
    if (!result || !result.ok || !result.rows.length) {
      throw new Error((result && result.error) || 'İş Yatırım veri vermedi');
    }
    const bars = result.rows.map(function (r) {
      return canonicalBar_(r.HGDG_TARIH, {
        open: r.HGDG_ACILIS,
        high: r.HGDG_MAX,
        low: r.HGDG_MIN,
        close: r.HGDG_KAPANIS,
        volume: r.HGDG_HACIM,
        tradeCount: r.HGDG_ADET || r.ISLEM_ADEDI,
        vwap: r.HGDG_AOF || r.AOF,
        usdAof: r.DOLAR_BAZLI_AOF,
        indexAof: r.HG_AOF
      }, 'ISYATIRIM');
    }).filter(function (b) { return b.date && b.close != null; });
    const last = result.rows[result.rows.length - 1] || {};
    return {
      provider: 'ISYATIRIM', bars: bars,
      fundamentals: {
        marketCap: finite_(last.PD), capital: finite_(last.SERMAYE),
        pe: finite_(last.F_K || last.FK), pb: finite_(last.PD_DD || last.PB || last.PDD),
        evEbitda: finite_(last.FD_FAVOK || last['FD_FAVÖK']), roe: finite_(last.ROE),
        freeFloat: finite_(last.HALKA_ACIKLIK || last.FIILI_DOLASIM_ORANI)
      },
      live: null, actions: [], url: result.url, rawRows: result.rows
    };
  }

  function fromIsYatirimLive_(sym) {
    const now = new Date();
    const from = new Date(now.getTime() - 86400000);
    function stamp(d) { return Utilities.formatDate(d, 'Europe/Istanbul', 'yyyyMMddHHmmss'); }
    const url = 'https://www.isyatirim.com.tr/_Layouts/15/IsYatirim.Website/Common/ChartData.aspx/IndexHistoricalAll' +
      '?period=60&from=' + stamp(from) + '&to=' + stamp(now) + '&endeks=' + encodeURIComponent(sym);
    const root = json_(url);
    const values = [];
    const keyRe = /^(last|lastprice|price|close|kapanis|son|value|y)$/i;
    (function walk(x, key) {
      if (x == null) return;
      if (typeof x === 'number' && x > 0 && x < 1e9 && keyRe.test(key || '')) values.push(x);
      else if (Array.isArray(x)) x.forEach(function (v) { walk(v, key); });
      else if (typeof x === 'object') Object.keys(x).forEach(function (k) { walk(x[k], k); });
    })(root, '');
    if (!values.length) throw new Error('İş Yatırım canlı fiyat alanı bulunamadı');
    return {provider: 'ISYATIRIM_LIVE', bars: [], fundamentals: {}, live: {price: values[values.length - 1], at: new Date().toISOString(), provider: 'ISYATIRIM_LIVE'}, actions: [], url: url};
  }

  function fromYahoo_(sym, start, end) {
    const ticker = sym === 'XU100' ? 'XU100.IS' : sym + '.IS';
    const p1 = Math.floor(start.getTime() / 1000);
    const p2 = Math.floor((end.getTime() + 86400000) / 1000);
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) +
      '?period1=' + p1 + '&period2=' + p2 + '&interval=1d&events=div%2Csplits&includeAdjustedClose=true';
    const root = json_(url);
    const r = root && root.chart && root.chart.result && root.chart.result[0];
    const q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
    if (!r || !q || !Array.isArray(r.timestamp)) throw new Error('Yahoo chart şeması yok');
    const adj = r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose || [];
    const bars = r.timestamp.map(function (t, i) {
      return canonicalBar_(new Date(t * 1000), {
        open: q.open && q.open[i], high: q.high && q.high[i], low: q.low && q.low[i],
        close: q.close && q.close[i], adjustedClose: adj[i], volume: q.volume && q.volume[i]
      }, 'YAHOO');
    }).filter(function (b) { return b.date && b.close != null; });
    const actions = [];
    const events = r.events || {};
    Object.keys(events.dividends || {}).forEach(function (k) {
      const x = events.dividends[k]; actions.push({symbol: sym, date: isoDay_(new Date(x.date * 1000)), type: 'DIVIDEND', value: finite_(x.amount), source: 'YAHOO'});
    });
    Object.keys(events.splits || {}).forEach(function (k) {
      const x = events.splits[k]; actions.push({symbol: sym, date: isoDay_(new Date(x.date * 1000)), type: 'SPLIT', numerator: finite_(x.numerator), denominator: finite_(x.denominator), ratio: x.splitRatio, source: 'YAHOO'});
    });
    const meta = r.meta || {};
    return {provider: 'YAHOO', bars: bars, fundamentals: {}, live: finite_(meta.regularMarketPrice) == null ? null : {price: finite_(meta.regularMarketPrice), at: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(), provider: 'YAHOO'}, actions: actions, url: url};
  }

  function fromYahooQuote_(sym) {
    const ticker = sym === 'XU100' ? 'XU100.IS' : sym + '.IS';
    let lastError = null;
    const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
    for (let i = 0; i < hosts.length; i++) {
      const url = 'https://' + hosts[i] + '/v7/finance/quote?symbols=' + encodeURIComponent(ticker);
      try {
        const root = json_(url);
        const q = root && root.quoteResponse && root.quoteResponse.result && root.quoteResponse.result[0];
        if (!q) throw new Error('Yahoo quote şeması yok');
        return {provider: 'YAHOO_QUOTE', bars: [], fundamentals: {
          marketCap: finite_(q.marketCap), capital: finite_(q.sharesOutstanding),
          pe: finite_(q.trailingPE || q.forwardPE), pb: finite_(q.priceToBook),
          freeFloat: finite_(q.floatShares) != null && finite_(q.sharesOutstanding) ? 100 * finite_(q.floatShares) / finite_(q.sharesOutstanding) : null
        }, live: finite_(q.regularMarketPrice) == null ? null : {price: finite_(q.regularMarketPrice), at: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString(), provider: 'YAHOO_QUOTE'}, actions: [], url: url};
      } catch (e) { lastError = e; }
    }
    throw lastError || new Error('Yahoo Quote başarısız');
  }

  function findHistory_(root) {
    let hit = null;
    (function walk(x) {
      if (hit || !x || typeof x !== 'object') return;
      const t = x.t || x.time || x.timestamp;
      const c = x.c || x.close;
      if (Array.isArray(t) && Array.isArray(c) && t.length && c.length) { hit = x; return; }
      Object.keys(x).forEach(function (k) { walk(x[k]); });
    })(root);
    return hit;
  }

  function findNumber_(root, keys) {
    const re = new RegExp('^(' + keys.join('|') + ')$', 'i');
    const vals = [];
    (function walk(x, key) {
      if (x == null) return;
      if (typeof x === 'number' && isFinite(x) && re.test(key || '')) vals.push(x);
      else if (Array.isArray(x)) x.forEach(function (v) { walk(v, key); });
      else if (typeof x === 'object') Object.keys(x).forEach(function (k) { walk(x[k], k); });
    })(root, '');
    return vals.length ? vals[vals.length - 1] : null;
  }

  function fromBigPara_(sym, start, end) {
    const url = 'https://bigpara.hurriyet.com.tr/api/v1/chart/tradingviewlight/history?symbol=' + encodeURIComponent(sym);
    const root = json_(url);
    const h = findHistory_(root);
    if (!h) throw new Error('Bigpara tarihsel şeması yok');
    const t = h.t || h.time || h.timestamp, c = h.c || h.close;
    const o = h.o || h.open || [], hi = h.h || h.high || [], lo = h.l || h.low || [], v = h.v || h.volume || [];
    const fromDay = isoDay_(start), toDay = isoDay_(end);
    const bars = t.map(function (x, i) {
      return canonicalBar_(new Date((Number(x) < 1e12 ? Number(x) * 1000 : Number(x))), {open: o[i], high: hi[i], low: lo[i], close: c[i], volume: v[i]}, 'BIGPARA');
    }).filter(function (b) { return b.date && b.close != null && b.date >= fromDay && b.date <= toDay; });
    let live = null, fundamentals = {};
    try {
      const liveUrl = 'https://bigpara.hurriyet.com.tr/api/v1/borsa/hisseyuzeysel/' + encodeURIComponent(sym);
      const liveRoot = json_(liveUrl);
      const price = findNumber_(liveRoot, ['son','last','lastPrice','kapanis','fiyat','price']);
      if (price != null) live = {price: price, at: new Date().toISOString(), provider: 'BIGPARA'};
      fundamentals = {
        marketCap: findNumber_(liveRoot, ['piyasaDegeri','marketCap','pd']),
        pe: findNumber_(liveRoot, ['fk','f_k','pe']), pb: findNumber_(liveRoot, ['pddd','pd_dd','pb']),
        freeFloat: findNumber_(liveRoot, ['halkaAciklik','freeFloat']), capital: findNumber_(liveRoot, ['sermaye','capital'])
      };
    } catch (_) {}
    if (!bars.length && !live && !Object.keys(fundamentals).some(function (k) { return fundamentals[k] != null; })) throw new Error('Bigpara geçerli veri vermedi');
    return {provider: 'BIGPARA', bars: bars, fundamentals: fundamentals, live: live, actions: [], url: url};
  }

  function parseCsv_(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const heads = lines[0].split(',').map(function (x) { return x.trim(); });
    return lines.slice(1).map(function (line) {
      const cells = line.split(','); const row = {};
      heads.forEach(function (h, i) { row[h] = cells[i] == null ? '' : cells[i].trim(); });
      return row;
    });
  }

  function fromStooq_(sym, start, end) {
    let lastError = null;
    const codes = [sym.toLowerCase() + '.tr', sym.toLowerCase() + '.is'];
    for (let i = 0; i < codes.length; i++) {
      const url = 'https://stooq.com/q/d/l/?s=' + encodeURIComponent(codes[i]) + '&d1=' + compactDate_(start) + '&d2=' + compactDate_(end) + '&i=d';
      try {
        const rows = parseCsv_(fetchText_(url, 'text/csv'));
        const bars = rows.map(function (r) { return canonicalBar_(r.Date, {open: r.Open, high: r.High, low: r.Low, close: r.Close, volume: r.Volume}, 'STOOQ'); }).filter(function (b) { return b.date && b.close != null; });
        if (!bars.length) throw new Error('Stooq veri yok');
        return {provider: 'STOOQ', bars: bars, fundamentals: {}, live: null, actions: [], url: url};
      } catch (e) { lastError = e; }
    }
    throw lastError || new Error('Stooq başarısız');
  }

  function merge_(sym, bundles, attempts) {
    const byDate = {};
    const lineage = {bars: {}, fundamentals: {}, live: null};
    let live = null, livePriority = -1, fundamentals = {}, fundamentalPriority = {}, actions = [];
    bundles.forEach(function (bundle) {
      const p = PRIORITY[bundle.provider] || 0;
      (bundle.bars || []).forEach(function (bar) {
        if (!bar.date) return;
        if (!byDate[bar.date]) byDate[bar.date] = {date: bar.date, values: {}, priority: {}, lineage: {}};
        const target = byDate[bar.date];
        ['open','high','low','close','adjustedClose','volume','tradeCount','vwap','usdAof','indexAof'].forEach(function (field) {
          if (bar[field] == null) return;
          if (target.values[field] == null || p > (target.priority[field] || -1)) {
            target.values[field] = bar[field]; target.priority[field] = p; target.lineage[field] = bundle.provider;
          }
        });
      });
      Object.keys(bundle.fundamentals || {}).forEach(function (field) {
        const value = finite_(bundle.fundamentals[field]);
        if (value == null) return;
        if (fundamentals[field] == null || p > (fundamentalPriority[field] || -1)) {
          fundamentals[field] = value; fundamentalPriority[field] = p; lineage.fundamentals[field] = bundle.provider;
        }
      });
      if (bundle.live && finite_(bundle.live.price) != null && p > livePriority) {
        live = bundle.live; livePriority = p; lineage.live = bundle.provider;
      }
      actions = actions.concat(bundle.actions || []);
    });
    const days = Object.keys(byDate).sort();
    const rows = days.map(function (day) {
      const x = byDate[day]; lineage.bars[day] = x.lineage;
      return {
        HGDG_TARIH: day,
        HGDG_ACILIS: x.values.open,
        HGDG_MAX: x.values.high,
        HGDG_MIN: x.values.low,
        HGDG_KAPANIS: x.values.close,
        HGDG_DUZELTILMIS_KAPANIS: x.values.adjustedClose,
        HGDG_HACIM: x.values.volume,
        HGDG_ADET: x.values.tradeCount,
        HGDG_AOF: x.values.vwap,
        DOLAR_BAZLI_AOF: x.values.usdAof,
        HG_AOF: x.values.indexAof,
        _sources: x.lineage
      };
    });
    return {
      ok: rows.length > 0,
      symbol: sym,
      status: rows.length ? 200 : null,
      url: bundles.length ? bundles[0].url : null,
      error: rows.length ? null : 'Hiçbir kaynak geçerli tarihsel veri vermedi',
      rows: rows,
      dates: rows.map(function (r) { return new Date(r.HGDG_TARIH + 'T00:00:00Z'); }),
      dateRaw: rows.map(function (r) { return r.HGDG_TARIH; }),
      providerOrder: ORDER.slice(),
      providers: bundles.map(function (b) { return b.provider; }),
      attempts: attempts,
      live: live,
      fundamentals: fundamentals,
      actions: actions,
      lineage: lineage,
      chainVersion: VERSION
    };
  }

  function fetchOne(sym, monthsBack) {
    const normalized = symbol_(sym);
    const end = new Date();
    const start = addMonths_(end, -Math.max(1, Number(monthsBack || 14)));
    const bundles = [], attempts = [];
    const providers = [
      ['ISYATIRIM', function () { return fromIsYatirim_(normalized, monthsBack); }],
      ['ISYATIRIM_LIVE', function () { return fromIsYatirimLive_(normalized); }],
      ['YAHOO', function () { return fromYahoo_(normalized, start, end); }],
      ['YAHOO_QUOTE', function () { return fromYahooQuote_(normalized); }],
      ['BIGPARA', function () { return fromBigPara_(normalized, start, end); }],
      ['STOOQ', function () { return fromStooq_(normalized, start, end); }]
    ];
    providers.forEach(function (item, index) {
      const started = Date.now();
      try {
        const bundle = item[1](); bundles.push(bundle);
        attempts.push({order: index + 1, provider: item[0], status: 'OK', elapsedMs: Date.now() - started, bars: (bundle.bars || []).length, live: !!bundle.live, fundamentals: Object.keys(bundle.fundamentals || {}).filter(function (k) { return bundle.fundamentals[k] != null; }).length});
      } catch (e) {
        attempts.push({order: index + 1, provider: item[0], status: 'ERROR', elapsedMs: Date.now() - started, error: e && e.message ? e.message : String(e)});
      }
      const delay = Number((typeof PropertiesService !== 'undefined' && PropertiesService.getDocumentProperties().getProperty('CFG.API.INTER_REQUEST_DELAY_MS')) || 60);
      if (delay > 0 && index < providers.length - 1) Utilities.sleep(Math.min(delay, 1000));
    });
    return merge_(normalized, bundles, attempts);
  }

  function fetchMany(symbols, monthsBack) {
    const out = {};
    Array.from(new Set((symbols || []).map(symbol_))).forEach(function (sym) {
      out[sym] = fetchOne(sym, monthsBack);
    });
    return out;
  }

  return Object.freeze({
    version: VERSION,
    order: ORDER.slice(),
    fetchOne: fetchOne,
    fetchMany: fetchMany,
    mergeBundles: merge_,
    parseCsv: parseCsv_
  });
})(BIST_API);

/* Bütün tarihsel veri tüketicileri artık sıralı altı-kaynak zincirini kullanır. */
BIST_API = Object.freeze({
  version: SEQUENTIAL_PROVIDER_CHAIN.version,
  providerOrder: SEQUENTIAL_PROVIDER_CHAIN.order,
  fetchOne: SEQUENTIAL_PROVIDER_CHAIN.fetchOne,
  fetchMany: SEQUENTIAL_PROVIDER_CHAIN.fetchMany,
  parseApiDate: function (value) {
    if (value instanceof Date) return value;
    const day = String(value || '').slice(0, 10);
    const d = new Date(day + 'T00:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }
});
