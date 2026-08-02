/*
 * API client for historical BIST data.
 *
 * Source mapping:
 * - legacy fetchRaw_      : V_141225 lines 1412-1465
 * - legacy fetchRawMulti_ : V_141225 lines 2028-2059
 *
 * This module intentionally returns the same response contract for single
 * and batch requests. Callers receive a result object instead of alternating
 * between `{rows, dates, dateRaw}` and a raw row array.
 */

var BIST_API = (function () {
  'use strict';

  const HEADERS = Object.freeze({
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json',
    'Referer': 'https://www.isyatirim.com.tr'
  });

  const MAX_BATCH_SIZE = 90;

  function addMonthsSafe_(date, delta) {
    const out = new Date(date.getTime());
    out.setMonth(out.getMonth() + Number(delta || 0));
    return out;
  }

  function formatDate_(date) {
    const tz = (typeof TIMEZONE !== 'undefined' && TIMEZONE) || 'Europe/Istanbul';
    return Utilities.formatDate(date, tz, 'dd-MM-yyyy');
  }

  function normalizeSymbol_(symbol) {
    const value = String(symbol || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(value)) {
      throw new Error('Geçersiz hisse kodu: ' + symbol);
    }
    return value;
  }

  function candidateBaseUrls_() {
    const configured = (typeof getBaseUrl_ === 'function') ? String(getBaseUrl_() || '').trim() : '';
    const defaults = [
      'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse=',
      'https://www.isyatirim.com.tr/_Layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse=',
      'https://www.isyatirim.com.tr/_Layouts/15/IsYatirim.Website/Common/Data.aspx/HisseTekil?hisse=',
      'https://isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil?hisse='
    ];

    const all = configured ? [configured].concat(defaults) : defaults;
    return Array.from(new Set(all.filter(Boolean)));
  }

  function buildUrl_(baseUrl, symbol, start, end) {
    return String(baseUrl) + encodeURIComponent(symbol) +
      '&startdate=' + encodeURIComponent(formatDate_(start)) +
      '&enddate=' + encodeURIComponent(formatDate_(end));
  }

  function parseResponse_(response, symbol, url) {
    const code = response.getResponseCode();
    const text = response.getContentText() || '';

    if (code < 200 || code >= 300) {
      return {
        ok: false,
        symbol: symbol,
        status: code,
        url: url,
        error: 'HTTP ' + code,
        rows: [],
        dates: [],
        dateRaw: []
      };
    }

    let json;
    try {
      json = JSON.parse(text || '{}');
    } catch (error) {
      return {
        ok: false,
        symbol: symbol,
        status: code,
        url: url,
        error: 'Geçersiz JSON: ' + error.message,
        rows: [],
        dates: [],
        dateRaw: []
      };
    }

    if (!json || !Array.isArray(json.value)) {
      return {
        ok: false,
        symbol: symbol,
        status: code,
        url: url,
        error: 'API payload içinde value[] bulunamadı',
        rows: [],
        dates: [],
        dateRaw: []
      };
    }

    const rows = json.value.slice().sort(function (a, b) {
      return dateValue_(a && a.HGDG_TARIH) - dateValue_(b && b.HGDG_TARIH);
    });

    const dates = [];
    const dateRaw = [];
    rows.forEach(function (row) {
      const raw = String((row && row.HGDG_TARIH) || '');
      const parsed = parseApiDate_(raw);
      dateRaw.push(raw);
      dates.push(parsed);
    });

    return {
      ok: true,
      symbol: symbol,
      status: code,
      url: url,
      error: null,
      rows: rows,
      dates: dates,
      dateRaw: dateRaw
    };
  }

  function dateValue_(value) {
    const parsed = parseApiDate_(value);
    return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
  }

  function parseApiDate_(value) {
    if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());
    if (value == null || value === '') return null;

    const text = String(value).trim();
    const native = new Date(text);
    if (!isNaN(native.getTime())) return native;

    const tr = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
    if (!tr) return null;

    const out = new Date(
      Number(tr[3]), Number(tr[2]) - 1, Number(tr[1]),
      Number(tr[4] || 0), Number(tr[5] || 0), Number(tr[6] || 0), 0
    );
    return isNaN(out.getTime()) ? null : out;
  }

  function requestOptions_() {
    return {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      headers: HEADERS
    };
  }

  function fetchOne(symbol, monthsBack) {
    const normalized = normalizeSymbol_(symbol);
    const end = new Date();
    const start = addMonthsSafe_(end, -Math.max(1, Number(monthsBack || 14)));
    const bases = candidateBaseUrls_();
    let lastResult = null;

    for (let i = 0; i < bases.length; i++) {
      const url = buildUrl_(bases[i], normalized, start, end);
      try {
        const result = parseResponse_(UrlFetchApp.fetch(url, requestOptions_()), normalized, url);
        if (result.ok) return result;
        lastResult = result;
      } catch (error) {
        lastResult = {
          ok: false,
          symbol: normalized,
          status: null,
          url: url,
          error: error && error.message ? error.message : String(error),
          rows: [], dates: [], dateRaw: []
        };
      }
    }

    return lastResult || {
      ok: false,
      symbol: normalized,
      status: null,
      url: null,
      error: 'API adayı bulunamadı',
      rows: [], dates: [], dateRaw: []
    };
  }

  function fetchMany(symbols, monthsBack) {
    const normalized = Array.from(new Set((symbols || []).map(normalizeSymbol_)));
    const end = new Date();
    const start = addMonthsSafe_(end, -Math.max(1, Number(monthsBack || 14)));
    const primaryBase = candidateBaseUrls_()[0];
    const output = {};

    for (let offset = 0; offset < normalized.length; offset += MAX_BATCH_SIZE) {
      const chunk = normalized.slice(offset, offset + MAX_BATCH_SIZE);
      const urls = chunk.map(function (symbol) {
        return buildUrl_(primaryBase, symbol, start, end);
      });
      const requests = urls.map(function (url) {
        const options = requestOptions_();
        options.url = url;
        return options;
      });

      let responses;
      try {
        responses = UrlFetchApp.fetchAll(requests);
      } catch (batchError) {
        chunk.forEach(function (symbol) {
          output[symbol] = fetchOne(symbol, monthsBack);
        });
        continue;
      }

      chunk.forEach(function (symbol, index) {
        let result;
        try {
          result = parseResponse_(responses[index], symbol, urls[index]);
        } catch (error) {
          result = {
            ok: false, symbol: symbol, status: null, url: urls[index],
            error: error.message || String(error), rows: [], dates: [], dateRaw: []
          };
        }

        // A batch response may fail because the configured base differs from the
        // working legacy variation. Retry only the failed symbol through all bases.
        output[symbol] = result.ok ? result : fetchOne(symbol, monthsBack);
      });
    }

    return output;
  }

  return Object.freeze({
    fetchOne: fetchOne,
    fetchMany: fetchMany,
    parseApiDate: parseApiDate_
  });
})();

/* Compatibility adapters for the monolith during migration. */
function fetchRawV2_(symbol, monthsBack) {
  return BIST_API.fetchOne(symbol, monthsBack);
}

function fetchRawMultiV2_(symbols, monthsBack) {
  const results = BIST_API.fetchMany(symbols, monthsBack);
  const rowsBySymbol = {};
  Object.keys(results).forEach(function (symbol) {
    rowsBySymbol[symbol] = results[symbol].rows;
  });
  return rowsBySymbol;
}
