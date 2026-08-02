/* Adaptive enrichment pipeline. No enrichment field is allowed to promote a
 * production model before leakage-safe shadow validation. */
var ADAPTIVE_ENRICHMENT_PIPELINE = (function () {
  'use strict';
  const VERSION = 'ADAPTIVE-ENRICH-1.0.0';
  const NEWS_URL = 'https://www.isyatirim.com.tr/tr-tr/analiz/haberler/Sayfalar/default.aspx';

  function finite_(x) { const n = Number(x); return x == null || x === '' || !isFinite(n) ? null : n; }
  function clamp_(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function mean_(xs) { const v=(xs||[]).map(finite_).filter(function(x){return x!=null;}); return v.length?v.reduce(function(a,b){return a+b;},0)/v.length:null; }

  function classifyMarketRegime(indexSnapshot) {
    const x=indexSnapshot||{};
    const breadth=finite_(x.breadthPct), ret=finite_(x.xu100ChangePct), bank=finite_(x.bankChangePct), vol=finite_(x.marketVolatilityPct);
    let regime='NEUTRAL';
    if (ret!=null && breadth!=null && ret>1 && breadth>60) regime='RISK_ON';
    else if (ret!=null && breadth!=null && ret<-1 && breadth<40) regime='RISK_OFF';
    else if (vol!=null && vol>3) regime='HIGH_VOLATILITY';
    else if (bank!=null && ret!=null && Math.abs(bank-ret)>2) regime='SECTOR_DIVERGENCE';
    return { regime:regime, breadthPct:breadth, xu100ChangePct:ret, bankChangePct:bank, marketVolatilityPct:vol };
  }

  function scoreNewsText_(text) {
    const value=String(text||'').toLocaleLowerCase('tr-TR');
    const positive=['artış','yükseliş','rekor','güçlü','olumlu','hedef yükseltti','temettü','anlaşma','ihale','büyüme','kâr'];
    const negative=['düşüş','zarar','ceza','soruşturma','iflas','temerrüt','hedef düşürdü','olumsuz','iptal','risk','satış baskısı'];
    let score=0; positive.forEach(function(k){if(value.indexOf(k)>=0)score++;}); negative.forEach(function(k){if(value.indexOf(k)>=0)score--;});
    return clamp_(score,-5,5);
  }

  function fetchNewsDigest(symbols, options) {
    const opts=options||{};
    const response=UrlFetchApp.fetch(NEWS_URL,{method:'get',muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':'Mozilla/5.0','Accept-Language':'tr-TR'}});
    if(response.getResponseCode()<200||response.getResponseCode()>=300) return {ok:false,error:'HTTP '+response.getResponseCode(),items:[]};
    const text=String(response.getContentText('UTF-8')||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const universe=(symbols||[]).map(function(s){return String(s).toUpperCase();});
    const items=[];
    universe.forEach(function(symbol){
      const re=new RegExp('(?:^|\\s)'+symbol+'(?:\\s|$)','i');
      if(re.test(text)) items.push({symbol:symbol,matched:true,sentimentScore:scoreNewsText_(text),sourceUrl:NEWS_URL});
    });
    return {ok:true,fetchedAt:new Date().toISOString(),items:items,globalSentimentScore:scoreNewsText_(text),rawStored:false};
  }

  function mergeFeature(record, enrichment, regime, news) {
    const base=Object.assign({},record||{});
    const overlay=enrichment&&typeof ISYATIRIM_COMPANY_CARD!=='undefined'?ISYATIRIM_COMPANY_CARD.buildFeatureOverlay(enrichment):{};
    Object.keys(overlay).forEach(function(k){base[k]=overlay[k];});
    const r=regime||{}; base.marketRegime=r.regime||'NEUTRAL'; base.marketBreadthPct=r.breadthPct; base.marketXu100ChangePct=r.xu100ChangePct; base.marketBankChangePct=r.bankChangePct; base.marketVolatilityPct=r.marketVolatilityPct;
    const item=(news&&news.items||[]).filter(function(x){return x.symbol===base.symbol||x.symbol===base.sym;})[0];
    base.newsSentimentScore=item?item.sentimentScore:(news?news.globalSentimentScore:null);
    base.newsMatched=!!item;
    return base;
  }

  function shadowAdjustment(feature) {
    const f=feature||{};
    const quality=finite_(f.isyCompanyCardCoverage);
    if (quality==null || quality<0.50 || f.isyCompanyCardStale===true || f.isyCrossValidationValid===false) {
      return {eligible:false,adjustment:0,reasons:['ENRICHMENT_QUALITY_GATE']};
    }
    let adjustment=0;
    adjustment += 0.08*(finite_(f.isyRecommendationScore)||0);
    adjustment += 0.002*clamp_(finite_(f.isyTargetPotentialPct)||0,-50,100);
    adjustment += 0.002*clamp_(finite_(f.isyTargetRevisionPct)||0,-50,50);
    adjustment += 0.001*clamp_(finite_(f.isyRelativeMomentumScore)||0,-30,30);
    adjustment += 0.001*clamp_(finite_(f.isyForeignFlowScore)||0,-10,10);
    adjustment += 0.01*clamp_(finite_(f.newsSentimentScore)||0,-5,5);
    if(f.marketRegime==='RISK_OFF') adjustment-=0.05;
    if(f.marketRegime==='RISK_ON') adjustment+=0.03;
    return {eligible:true,adjustment:clamp_(adjustment,-0.20,0.20),reasons:[]};
  }

  function auditFeature(feature) {
    const required=['isyCompanyCardCoverage','isyCrossValidationValid','marketRegime'];
    const missing=required.filter(function(k){return feature==null||feature[k]==null||feature[k]==='';});
    return {valid:missing.length===0,missing:missing,shadowOnly:true,version:VERSION};
  }

  return Object.freeze({version:VERSION,classifyMarketRegime:classifyMarketRegime,fetchNewsDigest:fetchNewsDigest,mergeFeature:mergeFeature,shadowAdjustment:shadowAdjustment,auditFeature:auditFeature,scoreNewsText:scoreNewsText_});
})();
