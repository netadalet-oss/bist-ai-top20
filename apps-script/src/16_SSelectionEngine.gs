var S_SELECTION_ENGINE = (function () {
  'use strict';
  const VERSION='S-SELECT-1.0.1';
  const HORIZONS=Object.freeze({SAME_DAY:'SAME_DAY',NEXT_DAY:'NEXT_DAY',COMBINED:'COMBINED'});
  const DEFAULTS=Object.freeze({
    topN:20,minCoverage:.60,minConsensusModels:2,
    sameDayWeights:Object.freeze({consensus:.35,shortMomentum:.25,liveStrength:.20,volumeAcceleration:.10,technicalStructure:.10}),
    nextDayWeights:Object.freeze({consensus:.35,trendStructure:.25,recoveryPattern:.15,mediumMomentum:.15,riskQuality:.10}),
    combinedWeights:Object.freeze({sameDay:.50,nextDay:.50})
  });

  function finite_(v){
    if(v==null)return null;
    if(typeof v==='string'&&v.trim()==='')return null;
    const n=Number(v);return isFinite(n)?n:null;
  }
  function clamp_(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function weightedAvailable_(parts,weights){
    let sum=0,used=0;
    Object.keys(weights||{}).forEach(function(k){
      const v=finite_(parts&&parts[k]),w=finite_(weights[k]);
      if(v==null||w==null||w<=0)return;
      sum+=v*w;used+=w;
    });
    return used>0?sum/used:null;
  }
  function modelMap_(rows){
    const out=new Map();
    (rows||[]).forEach(function(r){
      if(!r||r.eligible===false)return;
      const s=String(r.symbol||r.sym||'').trim().toUpperCase();
      const m=String(r.model||'').trim().toUpperCase();
      if(!s||!m)return;
      if(!out.has(s))out.set(s,{});
      out.get(s)[m]=r;
    });
    return out;
  }
  function featureMap_(rows){
    const out=new Map();
    (rows||[]).forEach(function(r){const s=String(r&&(r.symbol||r.sym)||'').trim().toUpperCase();if(s)out.set(s,r);});
    return out;
  }
  function kScore_(models,name){return models&&models[name]?finite_(models[name].score):null;}
  function coverage_(models){
    const names=['K1','K2','K3','K4'];
    const present=names.filter(function(n){return models&&models[n]&&models[n].eligible!==false;});
    const values=present.map(function(n){return finite_(models[n].coverage);}).filter(function(v){return v!=null;});
    return {modelCount:present.length,modelCoverage:present.length/names.length,
      averageInputCoverage:values.length?values.reduce(function(a,b){return a+b;},0)/values.length:0};
  }
  function safe100_(v){const n=finite_(v);return n==null?null:clamp_(n,0,100);}
  function components_(models,f){
    const k1=kScore_(models,'K1'),k2=kScore_(models,'K2'),k3=kScore_(models,'K3'),k4=kScore_(models,'K4'),k5=kScore_(models,'K5');
    const live=finite_(f&&(f.anlikDegisimPct!=null?f.anlikDegisimPct:f.anlikdeg));
    const volume=finite_(f&&(f.hacimDegisimPctT0!=null?f.hacimDegisimPctT0:f.hacimdeg_T));
    const momentum=finite_(f&&f.momentum10),rsi=finite_(f&&f.rsi14),vol21=finite_(f&&f.volatilite21g);
    const technical=weightedAvailable_({k2:k2,rsi:rsi},{k2:.75,rsi:.25});
    return {
      consensus:safe100_(k5!=null?k5:weightedAvailable_({k1:k1,k2:k2,k3:k3,k4:k4},{k1:1,k2:1,k3:1,k4:1})),
      shortMomentum:safe100_(k1),liveStrength:safe100_(live==null?null:50+live*5),
      volumeAcceleration:safe100_(volume==null?null:50+volume),technicalStructure:safe100_(technical),
      trendStructure:safe100_(k2),recoveryPattern:safe100_(k3),
      mediumMomentum:safe100_(momentum==null?k4:50+momentum*5),
      riskQuality:safe100_(vol21==null?null:100-vol21*5),longStrength:safe100_(k4)
    };
  }
  function scoreCandidate_(symbol,models,feature,options){
    const cfg=options||DEFAULTS,cov=coverage_(models),c=components_(models,feature||{});
    const same=weightedAvailable_(c,cfg.sameDayWeights||DEFAULTS.sameDayWeights);
    const next=weightedAvailable_(c,cfg.nextDayWeights||DEFAULTS.nextDayWeights);
    const combined=weightedAvailable_({sameDay:same,nextDay:next},cfg.combinedWeights||DEFAULTS.combinedWeights);
    const price=finite_(feature&&(feature.anlik!=null?feature.anlik:feature.kapanis_T!=null?feature.kapanis_T:feature.close));
    const featureTs=feature&&(feature.featureTs||feature.veriZamani||feature.verizamani)||null;
    const eligible=cov.modelCount>=Number(cfg.minConsensusModels==null?DEFAULTS.minConsensusModels:cfg.minConsensusModels)&&
      cov.averageInputCoverage>=Number(cfg.minCoverage==null?DEFAULTS.minCoverage:cfg.minCoverage)&&
      same!=null&&next!=null&&price!=null&&price>0;
    return {model:'S',modelVersion:VERSION,symbol:symbol,featureTs:featureTs,score:combined,
      sameDayScore:same,nextDayScore:next,combinedScore:combined,coverage:cov.averageInputCoverage,
      eligible:eligible,entryPrice:price,sourceModels:Object.keys(models||{}).sort(),
      raw:{modelCount:cov.modelCount,modelCoverage:cov.modelCoverage,components:c},
      normalized:{sameDayScore:same,nextDayScore:next,combinedScore:combined},
      reason:eligible?null:'MINIMUM_DATA_OR_CONSENSUS_NOT_MET'};
  }
  function select(input){
    input=input||{};
    const cfg=Object.assign({},DEFAULTS,input.options||{}),models=modelMap_(input.modelResults||[]),features=featureMap_(input.features||[]);
    const symbols=Array.from(new Set(Array.from(models.keys()).concat(Array.from(features.keys())))).sort();
    const candidates=symbols.map(function(s){return scoreCandidate_(s,models.get(s)||{},features.get(s)||{},cfg);}).filter(function(r){return r.eligible;});
    const horizon=String(input.horizon||HORIZONS.COMBINED).toUpperCase();
    const field=horizon===HORIZONS.SAME_DAY?'sameDayScore':horizon===HORIZONS.NEXT_DAY?'nextDayScore':'combinedScore';
    candidates.sort(function(a,b){return Number(b[field])-Number(a[field])||Number(b.coverage)-Number(a.coverage)||Number(b.raw.modelCount)-Number(a.raw.modelCount)||a.symbol.localeCompare(b.symbol);});
    return candidates.slice(0,Math.max(1,Number(cfg.topN||DEFAULTS.topN))).map(function(r,i){r.rank=i+1;r.score=r[field];r.horizon=horizon;return r;});
  }
  return Object.freeze({select:select,scoreCandidate:scoreCandidate_,horizons:HORIZONS,version:VERSION,defaults:DEFAULTS});
})();
function buildSSelection_(input){return S_SELECTION_ENGINE.select(input);}
function saveSSelectionSnapshot_(input){
  input=input||{};
  const results=S_SELECTION_ENGINE.select(input);
  if(!results.length)throw new Error('S snapshot için uygun aday bulunamadı.');
  const times=results.map(function(r){return r.featureTs;}).filter(Boolean);
  const featureTs=input.featureTs||(times.length?times.sort().slice(-1)[0]:input.predictionTs||new Date());
  return SNAPSHOT_STORE.appendPredictionBatch({snapshotType:'S',predictionTs:input.predictionTs||new Date(),featureTs:featureTs,
    sessionKind:input.sessionKind||results[0].horizon,model:'S',modelVersion:S_SELECTION_ENGINE.version,results:results});
}
