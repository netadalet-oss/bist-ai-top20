/*
 * K1-K4 expert models using MODEL_CORE.
 * Inputs are canonical feature objects produced by FEATURE_PIPELINE / Veriler repository.
 */
var EXPERT_MODELS = (function () {
  'use strict';

  function n_(row, names) {
    for (let i = 0; i < names.length; i++) {
      const value = row[names[i]];
      if (MODEL_CORE.finite(value)) return Number(value);
    }
    return null;
  }

  function batchMetric_(rows, getter, options) {
    const raw = rows.map(getter);
    return { raw: raw, score: MODEL_CORE.normalize(raw, options) };
  }

  function K1(rows) {
    rows = rows || [];
    const v5 = batchMetric_(rows, function (o) { return n_(o, ['vol5','Volatilite5G']); });
    const v21 = batchMetric_(rows, function (o) { return n_(o, ['vol21','Volatilite21G']); });
    const v63 = batchMetric_(rows, function (o) { return n_(o, ['vol63','Volatilite63G']); });
    const r1 = batchMetric_(rows, function (o) {
      const a=n_(o,['vol5','Volatilite5G']), b=n_(o,['vol21','Volatilite21G']); return a!=null&&b? a/b:null;
    });
    const r2 = batchMetric_(rows, function (o) {
      const a=n_(o,['vol21','Volatilite21G']), b=n_(o,['vol63','Volatilite63G']); return a!=null&&b? a/b:null;
    });
    const range = batchMetric_(rows, function (o) {
      const u=n_(o,['bollu','Boll_Ust']), l=n_(o,['bolla','Boll_Alt']); return u!=null&&l!=null&&u!==0?(u-l)/Math.abs(u):null;
    });
    const volCh = batchMetric_(rows, function (o) { return n_(o,['hacimdeg','hacimdeg_T','latest.hacimDeg']); });
    const near = batchMetric_(rows, function (o) {
      const u=n_(o,['bollu','Boll_Ust']), l=n_(o,['bolla','Boll_Alt']), c=n_(o,['kapanis_T','latest.kapanis']);
      return u!=null&&l!=null&&c!=null&&u!==l?(c-l)/Math.abs(u-l):null;
    }, {invert:true});
    const rsi = batchMetric_(rows, function (o) { const v=n_(o,['rsi14','RSI14']); return v==null?null:Math.abs(v-50); }, {invert:true});
    const mom3 = batchMetric_(rows, function (o) { return n_(o,['deg3g_num','Degisim3GunNum']); });
    const live = batchMetric_(rows, function (o) { return n_(o,['anlikdeg','AnlikDegisim']); });
    const priceFlag = batchMetric_(rows, function (o) {
      const a=n_(o,['deg3g_num']), b=n_(o,['anlikdeg','AnlikDegisim']); if(a==null&&b==null)return null; return (a>0?1:0)+(b>0?1:0);
    });
    const volumeFlag = batchMetric_(rows, function (o) { const v=n_(o,['hacimdeg','hacimdeg_T']); return v==null?null:(v>0?1:0); });

    const out = rows.map(function (row,i) {
      const volInfo=MODEL_CORE.weightedValue({v5:v5.score[i],r1:r1.score[i],v21:v21.score[i],r2:r2.score[i],v63:v63.score[i]}, {v5:.35,r1:.35,v21:.15,r2:.10,v63:.05}, .5);
      const dipInfo=MODEL_CORE.weightedValue({range:range.score[i],volCh:volCh.score[i],near:near.score[i]}, {range:.25,volCh:.35,near:.40}, .6);
      const momInfo=MODEL_CORE.weightedValue({mom3:mom3.score[i],live:live.score[i],rsi:rsi.score[i]}, {mom3:.50,live:.35,rsi:.15}, .6);
      const upInfo=MODEL_CORE.weightedValue({price:priceFlag.score[i],volume:volumeFlag.score[i]}, {price:.5,volume:.5}, .5);
      const total=MODEL_CORE.weightedValue({vol:volInfo&&volInfo.value,dip:dipInfo&&dipInfo.value,mom:momInfo&&momInfo.value,up:upInfo&&upInfo.value}, {vol:.25,dip:.20,mom:.35,up:.20}, .7);
      return MODEL_CORE.result('K1',row,total,{vol5:v5.raw[i],vol21:v21.raw[i],vol63:v63.raw[i],volRatio1:r1.raw[i],volRatio2:r2.raw[i],rangeWidth:range.raw[i],volumeChange:volCh.raw[i],lowerBandPosition:near.raw[i],rsiDistance50:rsi.raw[i],momentum3d:mom3.raw[i],liveChange:live.raw[i]}, {vol:volInfo&&volInfo.value,dip:dipInfo&&dipInfo.value,momentum:momInfo&&momInfo.value,upSignal:upInfo&&upInfo.value}, {upSignal:upInfo&&upInfo.value,momentum3d:mom3.score[i]}, 'Kısa vade momentum, volatilite ve dipten dönüş');
    });
    return MODEL_CORE.rankResults(out.filter(function(x){return x.eligible;}),['upSignal','momentum3d']);
  }

  function K2(rows) {
    rows=rows||[];
    const stack=batchMetric_(rows,function(o){const a=n_(o,['ema20','EMA20']),b=n_(o,['ema50','EMA50']),c=n_(o,['ema200','EMA200']);return a!=null&&b!=null&&c!=null?(a>b&&b>c?1:0):null;});
    const gap1=batchMetric_(rows,function(o){const a=n_(o,['ema20','EMA20']),b=n_(o,['ema50','EMA50']);return a!=null&&b? a/b-1:null;});
    const gap2=batchMetric_(rows,function(o){const a=n_(o,['ema50','EMA50']),b=n_(o,['ema200','EMA200']);return a!=null&&b? a/b-1:null;});
    const macd=batchMetric_(rows,function(o){return n_(o,['macdhist','MACDHist']);});
    const rsi=batchMetric_(rows,function(o){const v=n_(o,['rsi14','RSI14']);return v==null?null:Math.abs(v-55);},{invert:true});
    const mom=batchMetric_(rows,function(o){return n_(o,['momentum10','Momentum10']);});
    const out=rows.map(function(row,i){
      const total=MODEL_CORE.weightedValue({stack:stack.score[i],gap1:gap1.score[i],gap2:gap2.score[i],macd:macd.score[i],rsi:rsi.score[i],mom:mom.score[i]}, {stack:.25,gap1:.20,gap2:.10,macd:.25,rsi:.10,mom:.10}, .7);
      return MODEL_CORE.result('K2',row,total,{emaStack:stack.raw[i],ema20_50Gap:gap1.raw[i],ema50_200Gap:gap2.raw[i],macdHist:macd.raw[i],rsiDistance55:rsi.raw[i],momentum10:mom.raw[i]}, {emaStack:stack.score[i],ema20_50Gap:gap1.score[i],ema50_200Gap:gap2.score[i],macdHist:macd.score[i],rsi:rsi.score[i],momentum10:mom.score[i]}, {macd:macd.score[i],emaStack:stack.score[i]}, 'EMA-MACD-RSI-Momentum trend devamı');
    });
    return MODEL_CORE.rankResults(out.filter(function(x){return x.eligible;}),['macd','emaStack']);
  }

  function detectK3_(row, configs) {
    const hist=row.history||row.hist||{};
    const close=hist.close||[]; const chg=hist.chg||[]; const volChg=hist.volChg||[];
    let best=null;
    configs.forEach(function(cfg){
      const size=Math.min(cfg.dipWindow,close.length); if(size<3||close[0]==null)return;
      let dip=null;
      for(let d=1;d<size-1;d++){if(close[d]!=null&&close[d+1]!=null&&close[d-1]!=null&&close[d]<=close[d+1]&&close[d]<=close[d-1]){dip=d;break;}}
      if(dip==null){let min=Infinity;for(let d=0;d<size;d++){if(close[d]!=null&&close[d]<min){min=close[d];dip=d;}}}
      if(dip==null)return;
      let peak=null,peakClose=null;for(let d=dip+1;d<size;d++){if(close[d]!=null&&(peakClose==null||close[d]>peakClose)){peak=d;peakClose=close[d];}}
      if(peak==null||!peakClose)return;
      const drop=(peakClose-close[dip])/peakClose;if(!(drop>.03))return;
      let rec=null;for(let off=1;off<=Math.min(cfg.recWindow,dip);off++){const d=dip-off;if(close[d]!=null&&chg[d]>0&&volChg[d]>0&&close[d]>close[dip]){rec=d;break;}}
      if(rec==null)return;
      const candidate={dipIndex:dip,peakIndex:peak,recoveryIndex:rec,depth:drop,bounce:close[0]/close[dip]-1,recency:rec,volumeUp:volChg[rec],dipWindow:cfg.dipWindow,recoveryWindow:cfg.recWindow};
      if(!best||candidate.recency<best.recency||(candidate.recency===best.recency&&candidate.depth>best.depth))best=candidate;
    });
    return best;
  }

  function K3(rows) {
    rows=rows||[];
    const cfg=[{dipWindow:10,recWindow:3},{dipWindow:15,recWindow:5},{dipWindow:20,recWindow:7},{dipWindow:30,recWindow:10}];
    const patterns=rows.map(function(r){return detectK3_(r,cfg);});
    const depth=MODEL_CORE.normalize(patterns.map(function(x){return x&&x.depth;}));
    const bounce=MODEL_CORE.normalize(patterns.map(function(x){return x&&x.bounce;}));
    const recency=MODEL_CORE.normalize(patterns.map(function(x){return x&&x.recency;}),{invert:true});
    const volume=MODEL_CORE.normalize(patterns.map(function(x){return x&&x.volumeUp;}));
    const out=rows.map(function(row,i){
      if(!patterns[i])return MODEL_CORE.result('K3',row,null,{}, {}, {}, 'Geçerli dipten toparlanma formasyonu yok');
      const total=MODEL_CORE.weightedValue({depth:depth[i],bounce:bounce[i],recency:recency[i],volume:volume[i]}, {depth:.40,bounce:.30,recency:.20,volume:.10}, .75);
      return MODEL_CORE.result('K3',row,total,patterns[i],{depth:depth[i],bounce:bounce[i],recency:recency[i],volume:volume[i]}, {bounce:bounce[i],recency:recency[i]}, 'Hisse bazında adaptif dipten toparlanma');
    });
    return MODEL_CORE.rankResults(out.filter(function(x){return x.eligible;}),['bounce','recency']);
  }

  function K4(rows) {
    rows=rows||[];
    const r1=batchMetric_(rows,function(o){return n_(o,['getiri1A','Getiri_TL_1A','Getiri_TL_1A_T0']);});
    const r3=batchMetric_(rows,function(o){return n_(o,['getiri3A','Getiri_TL_3A','Getiri_TL_3A_T0']);});
    const r6=batchMetric_(rows,function(o){return n_(o,['getiri6A','Getiri_TL_6A','Getiri_TL_6A_T0']);});
    const stability=batchMetric_(rows,function(o){const v=n_(o,['vol21','Volatilite21G']),g=n_(o,['getiri1A','Getiri_TL_1A','Getiri_TL_1A_T0']);return v!=null&&g!=null&&g!==0?v/Math.abs(g):null;},{invert:true});
    const mom=batchMetric_(rows,function(o){return n_(o,['deg3g_num']);});
    const rsi=batchMetric_(rows,function(o){const v=n_(o,['rsi14','RSI14']);return v==null?null:Math.abs(v-55);},{invert:true});
    const out=rows.map(function(row,i){
      const horizons=MODEL_CORE.weightedValue({r1:r1.score[i],r3:r3.score[i],r6:r6.score[i]}, {r1:1,r3:1,r6:1}, .66);
      const short=MODEL_CORE.weightedValue({mom:mom.score[i],rsi:rsi.score[i]}, {mom:.5,rsi:.5}, .5);
      const total=MODEL_CORE.weightedValue({horizons:horizons&&horizons.value,stability:stability.score[i],short:short&&short.value}, {horizons:.45,stability:.30,short:.25}, .7);
      return MODEL_CORE.result('K4',row,total,{return1M:r1.raw[i],return3M:r3.raw[i],return6M:r6.raw[i],stability:stability.raw[i],momentum3d:mom.raw[i],rsiDistance55:rsi.raw[i]}, {horizons:horizons&&horizons.value,stability:stability.score[i],short:short&&short.value}, {return6M:r6.score[i],stability:stability.score[i]}, 'Çoklu zaman dilimi liderlik ve pozitif kalma');
    });
    return MODEL_CORE.rankResults(out.filter(function(x){return x.eligible;}),['return6M','stability']);
  }

  return Object.freeze({K1:K1,K2:K2,K3:K3,K4:K4});
})();
