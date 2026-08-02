/*
 * IS Yatirim company-card enrichment.
 *
 * Purpose:
 * - enrich each symbol with current recommendation, target price, valuation,
 *   financial, dividend, foreign ownership, index-weight and research fields;
 * - derive machine-readable metrics without copying long copyrighted text;
 * - cross-check prices/returns against SEQUENTIAL_PROVIDER_CHAIN;
 * - cache and rate-limit requests; fail closed on stale or malformed payloads.
 */
var ISYATIRIM_COMPANY_CARD = (function () {
  'use strict';

  const VERSION = 'ISY-CARD-1.0.0';
  const BASE = 'https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=';
  const NEWS_URL = 'https://www.isyatirim.com.tr/tr-tr/analiz/haberler/Sayfalar/default.aspx';
  const CACHE_SECONDS = 6 * 60 * 60;
  const MIN_REQUEST_INTERVAL_MS = 350;
  const MAX_TEXT_LENGTH = 480;
  const SHEET_NAME = '_SymbolEnrichment';

  const HEADERS = Object.freeze({
    'User-Agent': 'Mozilla/5.0 (compatible; AurumTop20/1.0; local research use)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.6',
    'Referer': 'https://www.isyatirim.com.tr/'
  });

  function normalizeSymbol_(symbol) {
    const value = String(symbol || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(value)) throw new Error('Geçersiz hisse kodu: ' + symbol);
    return value;
  }

  function fetchHtml_(url, cacheKey, force) {
    const cache = CacheService.getScriptCache();
    if (!force) {
      const hit = cache.get(cacheKey);
      if (hit) return { html: hit, cached: true };
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const props = PropertiesService.getScriptProperties();
      const previous = Number(props.getProperty('ISY.CARD.LAST_FETCH_MS') || 0);
      const wait = MIN_REQUEST_INTERVAL_MS - (Date.now() - previous);
      if (wait > 0) Utilities.sleep(wait);
      const response = UrlFetchApp.fetch(url, {
        method: 'get', muteHttpExceptions: true, followRedirects: true, headers: HEADERS
      });
      props.setProperty('ISY.CARD.LAST_FETCH_MS', String(Date.now()));
      const code = response.getResponseCode();
      const html = response.getContentText('UTF-8') || '';
      if (code < 200 || code >= 300) throw new Error('İş Yatırım HTTP ' + code);
      if (html.length < 1000 || html.indexOf('Şirket') < 0) throw new Error('Şirket kartı payload doğrulanamadı');
      cache.put(cacheKey, html, CACHE_SECONDS);
      return { html: html, cached: false };
    } finally {
      lock.releaseLock();
    }
  }

  function cleanText_(html) {
    return decode_(String(html || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/tr>|<\/li>|<\/h\d>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/ +/g, ' ')
      .replace(/\n +/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim());
  }

  function decode_(text) {
    return text.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); });
  }

  function number_(value) {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text || /^(?:-|A\/D|AD|N\/A)$/i.test(text)) return null;
    if (typeof parseLocalizedNumber_ === 'function') {
      const parsed = parseLocalizedNumber_(text);
      if (parsed != null && isFinite(parsed)) return parsed;
    }
    const normalized = text.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return isFinite(parsed) ? parsed : null;
  }

  function capture_(text, pattern, group) {
    const match = pattern.exec(text);
    return match ? String(match[group || 1] || '').trim() : '';
  }

  function section_(text, start, ends) {
    const startIndex = text.search(start);
    if (startIndex < 0) return '';
    const rest = text.slice(startIndex);
    let endIndex = rest.length;
    (ends || []).forEach(function (end) {
      const found = rest.slice(1).search(end);
      if (found >= 0) endIndex = Math.min(endIndex, found + 1);
    });
    return rest.slice(0, endIndex).trim();
  }

  function short_(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH - 1) + '…' : text;
  }

  function parseCard_(symbol, html, fetchedAt) {
    const text = cleanText_(html);
    const recommendation = section_(text, /Hisse Önerisi/i, [/Dönemsel Hareketler/i]);
    const current = section_(text, /Cari Değerler/i, [/Getiriler/i]);
    const returns = section_(text, /Getiriler/i, [/Ortaklık Yapısı/i]);
    const indexWeights = section_(text, /Dahil Olduğu Endekslerdeki Ağırlığı/i, [/Şirket Künyesi/i]);
    const foreign = section_(text, /Yabancı Oranlar/i, [/Tarihsel Ortalamalar/i]);
    const historical = section_(text, /Tarihsel Ortalamalar/i, [/\+90|Uyarı Notu/i]);
    const financials = section_(text, /Özet Finansal Göstergeler/i, [/Cari Değerler/i]);
    const dividend = section_(text, /Temettü Gerçekleşen\/Planlanan/i, [/Mali Tablolar/i]);

    const target = number_(capture_(recommendation, /Hedef Fiyat\s+([0-9.,-]+)/i));
    const potential = number_(capture_(recommendation, /Getiri Pot\s*%?\s*([0-9.,-]+)/i));
    const lastRecommendationDate = capture_(recommendation, /Son Öneri Tarihi\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i);
    const recommendationCode = capture_(recommendation, /Hisse Önerisi\s+(AL|SAT|TUT|GÖZDEN GEÇİRİLİYOR|ÖNERİ YOK)/i);

    const result = {
      symbol: symbol,
      source: 'ISYATIRIM_COMPANY_CARD',
      sourceUrl: BASE + encodeURIComponent(symbol),
      fetchedAt: fetchedAt.toISOString(),
      recommendation: {
        code: recommendationCode || null,
        date: lastRecommendationDate || null,
        targetPrice: target,
        potentialPct: potential,
        previousDate: capture_(recommendation, /Önceki Öneri Tarihi\s+(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4})/i) || null,
        previousTargetPrice: number_(capture_(recommendation, /Önceki Hedef Fiyat\s+([0-9.,-]+)/i)),
        theme: short_(capture_(recommendation, /Yatırım Teması\s+([\s\S]*?)\s+Katalist/i)),
        catalyst: short_(capture_(recommendation, /Katalist\s+([\s\S]*?)\s+Değerleme/i)),
        valuationNarrative: short_(capture_(recommendation, /Değerleme\s+([\s\S]*?)\s+Riskler/i)),
        risks: short_(capture_(recommendation, /Riskler\s+([\s\S]*?)(?:Önceki Öneri Tarihi|Dönemsel Hareketler)/i))
      },
      valuation: {
        pe: number_(capture_(current, /F\/K\s*\|?\s*([0-9.,-]+)/i)),
        evEbitda: number_(capture_(current, /FD\/FAVÖK\s*\|?\s*([0-9.,-]+)/i)),
        pb: number_(capture_(current, /PD\/DD\s*\|?\s*([0-9.,-]+)/i)),
        evSales: number_(capture_(current, /FD\/Satışlar\s*\|?\s*([0-9.,-]+)/i)),
        marketCapMnTl: number_(capture_(current, /Piyasa Değeri\s*\|?\s*([0-9.,-]+)/i)),
        netDebtMnTl: number_(capture_(current, /Net Borç\s*\|?\s*([0-9.,-]+)/i)),
        freeFloatPct: number_(capture_(current, /Halka Açıklık Oranı\s*\(%\)\s*\|?\s*([0-9.,-]+)/i)),
        foreignOwnershipPct: number_(capture_(current, /Yabancı Oranı\s*\(%\)\s*\|?\s*([0-9.,-]+)/i)),
        avgVolume3MMnUsd: number_(capture_(current, /Ort Hacim.*?3A\/12A\s*\|?\s*([0-9.,-]+)/i)),
        avgVolume12MMnUsd: number_(capture_(current, /Ort Hacim.*?3A\/12A\s*\|?\s*[0-9.,-]+\s*\/\s*([0-9.,-]+)/i)),
        historicalPeDiscountPct: number_(capture_(historical, /F\/K Tahmin\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i)),
        historicalPbDiscountPct: number_(capture_(historical, /PD\/DD Tahmin\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i))
      },
      returns: {
        tl1dPct: number_(capture_(returns, /TL\s*\|?\s*([0-9.,-]+)/i)),
        tl1wPct: number_(capture_(returns, /TL\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i)),
        tl1mPct: number_(capture_(returns, /TL\s*\|?\s*[0-9.,-]+\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i)),
        tlYtdPct: number_(capture_(returns, /TL\s*\|?\s*[0-9.,-]+\s*\|?\s*[0-9.,-]+\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i)),
        relative1dPct: number_(capture_(returns, /Göreceli\s*\|?\s*([0-9.,-]+)/i)),
        relative1wPct: number_(capture_(returns, /Göreceli\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i)),
        relative1mPct: number_(capture_(returns, /Göreceli\s*\|?\s*[0-9.,-]+\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i)),
        relativeYtdPct: number_(capture_(returns, /Göreceli\s*\|?\s*[0-9.,-]+\s*\|?\s*[0-9.,-]+\s*\|?\s*[0-9.,-]+\s*\|?\s*([0-9.,-]+)/i))
      },
      indexWeights: {
        xu100Pct: number_(capture_(indexWeights, /XU100.*?([0-9.,-]+)/i)),
        xu050Pct: number_(capture_(indexWeights, /XU050.*?([0-9.,-]+)/i)),
        xu030Pct: number_(capture_(indexWeights, /XU030.*?([0-9.,-]+)/i))
      },
      foreignFlow: {
        previousPct: number_(capture_(foreign, new RegExp(symbol + '\\s*\\|?\\s*[0-9.,-]+\\s*\\|?\\s*([0-9.,-]+)', 'i'))),
        currentPct: number_(capture_(foreign, new RegExp(symbol + '\\s*\\|?\\s*[0-9.,-]+\\s*\\|?\\s*[0-9.,-]+\\s*\\|?\\s*([0-9.,-]+)', 'i'))),
        changeBps: number_(capture_(foreign, /Değişim.*?([+-]?[0-9.,-]+)/i)),
        freeFloatImpactPct: number_(capture_(foreign, /Etki.*?([+-]?[0-9.,-]+)/i))
      },
      fundamentals: {
        equityMnTl: number_(capture_(financials, /Öz Sermaye\s*\|?\s*([0-9.,-]+)/i)),
        netProfitMnTl: number_(capture_(financials, /Net Kar\s*\|?\s*([0-9.,-]+)/i)),
        roePct: number_(capture_(financials, /ROE\s*\(%\)\s*\|?\s*([0-9.,-]+)/i)),
        netInterestIncomeMnTl: number_(capture_(financials, /Net Faiz Geliri\s*\|?\s*([0-9.,-]+)/i)),
        depositsMnTl: number_(capture_(financials, /Mevduat\s*\|?\s*([0-9.,-]+)/i))
      },
      dividend: {
        latestDate: capture_(dividend, new RegExp(symbol + '\\s*\\|?\\s*(\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]\\d{4})', 'i')) || null,
        latestYieldPct: number_(capture_(dividend, new RegExp(symbol + '\\s*\\|?\\s*\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]\\d{4}\\s*\\|?\\s*([0-9.,-]+)', 'i'))),
        latestGrossPerShare: number_(capture_(dividend, new RegExp(symbol + '\\s*\\|?\\s*\\d{1,2}[.\\/-]\\d{1,2}[.\\/-]\\d{4}\\s*\\|?\\s*[0-9.,-]+\\s*\\|?\\s*([0-9.,-]+)', 'i')))
      },
      rawCoverage: {
        recommendation: !!recommendation,
        currentValues: !!current,
        returns: !!returns,
        indexWeights: !!indexWeights,
        foreignFlow: !!foreign,
        historicalValuation: !!historical,
        financials: !!financials,
        dividend: !!dividend
      }
    };

    result.metrics = deriveMetrics_(result);
    return result;
  }

  function deriveMetrics_(card) {
    const r = card.recommendation || {};
    const v = card.valuation || {};
    const f = card.fundamentals || {};
    const ret = card.returns || {};
    const quality = Object.keys(card.rawCoverage || {}).filter(function (k) { return card.rawCoverage[k]; }).length / 8;
    const recommendationAgeDays = r.date ? daysSince_(r.date) : null;
    const targetRevisionPct = r.targetPrice != null && r.previousTargetPrice != null && r.previousTargetPrice !== 0
      ? (r.targetPrice / r.previousTargetPrice - 1) * 100 : null;
    return {
      coverage: quality,
      recommendationAgeDays: recommendationAgeDays,
      targetRevisionPct: targetRevisionPct,
      recommendationScore: scoreRecommendation_(r.code),
      targetPotentialPct: r.potentialPct,
      valuationDiscountScore: mean_([negate_(v.historicalPeDiscountPct), negate_(v.historicalPbDiscountPct)]),
      profitabilityScore: f.roePct,
      foreignFlowScore: card.foreignFlow.freeFloatImpactPct,
      relativeMomentumScore: mean_([ret.relative1dPct, ret.relative1wPct, ret.relative1mPct]),
      liquidityScore: v.avgVolume3MMnUsd,
      dividendYieldPct: card.dividend.latestYieldPct,
      stale: recommendationAgeDays != null && recommendationAgeDays > 120
    };
  }

  function scoreRecommendation_(code) {
    const key = String(code || '').toUpperCase();
    return key === 'AL' ? 1 : key === 'TUT' ? 0 : key === 'SAT' ? -1 : null;
  }
  function negate_(x) { return x == null ? null : -x; }
  function mean_(values) {
    const valid = (values || []).filter(function (x) { return x != null && isFinite(x); });
    return valid.length ? valid.reduce(function (a, b) { return a + b; }, 0) / valid.length : null;
  }
  function daysSince_(value) {
    const match = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(String(value || ''));
    if (!match) return null;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  function crossValidate_(card, providerResult) {
    const chain = providerResult || {};
    const latest = chain.live || {};
    const close = latest.price != null ? Number(latest.price) : null;
    const impliedPrice = card.recommendation.targetPrice != null && card.recommendation.potentialPct != null
      ? card.recommendation.targetPrice / (1 + card.recommendation.potentialPct / 100) : null;
    const priceGapPct = close != null && impliedPrice != null && close !== 0 ? (impliedPrice / close - 1) * 100 : null;
    return {
      providerOrder: chain.providerOrder || [],
      selectedProviders: chain.selectedProviders || {},
      livePrice: close,
      impliedCardPrice: impliedPrice,
      priceGapPct: priceGapPct,
      return1dGapPct: compare_(card.returns.tl1dPct, latest.changePct),
      valid: priceGapPct == null || Math.abs(priceGapPct) <= 5,
      warnings: [
        priceGapPct != null && Math.abs(priceGapPct) > 5 ? 'CARD_PRICE_MISMATCH' : null,
        card.metrics.stale ? 'STALE_RECOMMENDATION' : null,
        card.metrics.coverage < 0.50 ? 'LOW_CARD_COVERAGE' : null
      ].filter(Boolean)
    };
  }

  function compare_(a, b) { return a != null && b != null ? Number(a) - Number(b) : null; }

  function fetchOne(symbol, options) {
    const normalized = normalizeSymbol_(symbol);
    const opts = options || {};
    const fetchedAt = new Date();
    const result = fetchHtml_(BASE + encodeURIComponent(normalized), 'isy-card:' + normalized, !!opts.force);
    const card = parseCard_(normalized, result.html, fetchedAt);
    card.cached = result.cached;
    let chain = null;
    if (opts.crossValidate !== false && typeof SEQUENTIAL_PROVIDER_CHAIN !== 'undefined') {
      try { chain = SEQUENTIAL_PROVIDER_CHAIN.fetchOne(normalized, opts.monthsBack || 14); } catch (error) { chain = { ok:false, error:String(error) }; }
    }
    card.crossValidation = crossValidate_(card, chain);
    return card;
  }

  function fetchMany(symbols, options) {
    const output = {};
    Array.from(new Set((symbols || []).map(normalizeSymbol_))).forEach(function (symbol) {
      try { output[symbol] = fetchOne(symbol, options); }
      catch (error) { output[symbol] = { symbol:symbol, ok:false, error:error.message || String(error) }; }
    });
    return output;
  }

  function refreshSheet(symbols, options) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rows = fetchMany(symbols, options);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['symbol','fetchedAt','recommendation','recommendationDate','targetPrice','targetPotentialPct','targetRevisionPct','pe','pb','roePct','marketCapMnTl','foreignOwnershipPct','foreignFlowImpactPct','avgVolume3MMnUsd','dividendYieldPct','relative1dPct','relative1wPct','relative1mPct','coverage','stale','crossValid','crossWarnings','sourceUrl','json'];
    const values = Object.keys(rows).sort().map(function (symbol) {
      const x = rows[symbol];
      if (!x || x.ok === false) return [symbol,new Date().toISOString(),'','','','','','','','','','','','','','','','','',0,true,false,x.error || 'ERROR','',''];
      return [
        symbol,x.fetchedAt,x.recommendation.code,x.recommendation.date,x.recommendation.targetPrice,x.recommendation.potentialPct,x.metrics.targetRevisionPct,
        x.valuation.pe,x.valuation.pb,x.fundamentals.roePct,x.valuation.marketCapMnTl,x.valuation.foreignOwnershipPct,x.foreignFlow.freeFloatImpactPct,
        x.valuation.avgVolume3MMnUsd,x.dividend.latestYieldPct,x.returns.relative1dPct,x.returns.relative1wPct,x.returns.relative1mPct,
        x.metrics.coverage,x.metrics.stale,x.crossValidation.valid,(x.crossValidation.warnings || []).join(','),x.sourceUrl,JSON.stringify(x)
      ];
    });
    sheet.clearContents();
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    if (values.length) sheet.getRange(2,1,values.length,headers.length).setValues(values);
    sheet.setFrozenRows(1);
    return { sheet:SHEET_NAME, rows:values.length, generatedAt:new Date().toISOString() };
  }

  function buildFeatureOverlay(card) {
    if (!card || card.ok === false) return {};
    return {
      isyRecommendationScore: card.metrics.recommendationScore,
      isyRecommendationAgeDays: card.metrics.recommendationAgeDays,
      isyTargetPotentialPct: card.metrics.targetPotentialPct,
      isyTargetRevisionPct: card.metrics.targetRevisionPct,
      isyValuationDiscountScore: card.metrics.valuationDiscountScore,
      isyRoePct: card.metrics.profitabilityScore,
      isyForeignFlowScore: card.metrics.foreignFlowScore,
      isyRelativeMomentumScore: card.metrics.relativeMomentumScore,
      isyLiquidityMnUsd: card.metrics.liquidityScore,
      isyDividendYieldPct: card.metrics.dividendYieldPct,
      isyCompanyCardCoverage: card.metrics.coverage,
      isyCompanyCardStale: card.metrics.stale,
      isyCrossValidationValid: card.crossValidation.valid,
      isyCrossValidationWarnings: card.crossValidation.warnings
    };
  }

  return Object.freeze({
    version: VERSION,
    fetchOne: fetchOne,
    fetchMany: fetchMany,
    parseCard: parseCard_,
    deriveMetrics: deriveMetrics_,
    crossValidate: crossValidate_,
    refreshSheet: refreshSheet,
    buildFeatureOverlay: buildFeatureOverlay,
    sheetName: SHEET_NAME
  });
})();

function refreshIsYatirimCompanyCardEnrichment_(symbols, options) {
  return ISYATIRIM_COMPANY_CARD.refreshSheet(symbols, options);
}
