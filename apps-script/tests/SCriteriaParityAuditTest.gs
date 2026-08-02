function assertSCriteriaParityTest_(condition,message){if(!condition)throw new Error('SCriteriaParityAuditTest: '+message);}
function runSCriteriaParityAuditTests_(){
  const report=S_CRITERIA_PARITY_AUDIT.audit();
  const byCode={};report.findings.forEach(function(x){byCode[x.code]=x;});
  assertSCriteriaParityTest_(report.valid===true,'çözülmemiş blocker olmamalı');
  assertSCriteriaParityTest_(byCode.LEGACY_CURRENT_LIST_BACKTEST.status==='REMOVED','bugünkü liste backtesti kaldırılmalı');
  assertSCriteriaParityTest_(byCode.LEGACY_FIXED_MODEL_SEATS.status==='REMOVED','sabit koltuklar kaldırılmalı');
  assertSCriteriaParityTest_(byCode.LEGACY_ENTRY_PRICE_RESET.status==='REMOVED','giriş fiyatı reseti kaldırılmalı');
  assertSCriteriaParityTest_(byCode.LEGACY_FARTHEST_SUPPORT.status==='QUARANTINED','yanlış destek kriteri karantinada olmalı');
  assertSCriteriaParityTest_(MODEL_CORE.finite(null)===false,'MODEL_CORE null değerini sayı saymamalı');
  assertSCriteriaParityTest_(MODEL_CORE.finite('')===false,'MODEL_CORE boş metni sayı saymamalı');
  assertSCriteriaParityTest_(MODEL_CORE.finite('  ')===false,'MODEL_CORE boşluk metnini sayı saymamalı');
  assertSCriteriaParityTest_(MODEL_CORE.finite(0)===true,'gerçek sıfır geçerli kalmalı');

  const models={
    K1:{score:80,coverage:1,eligible:true},K2:{score:75,coverage:1,eligible:true},
    K3:{score:70,coverage:1,eligible:true},K4:{score:65,coverage:1,eligible:true}
  };
  const missing=S_SELECTION_ENGINE.scoreCandidate('AAA',models,{anlik:100,anlikdeg:null,hacimdeg_T:null,momentum10:null,rsi14:null,volatilite21g:null},S_SELECTION_ENGINE.defaults);
  assertSCriteriaParityTest_(missing.raw.components.liveStrength===null,'eksik canlı değişim sıfıra dönüşmemeli');
  assertSCriteriaParityTest_(missing.raw.components.volumeAcceleration===null,'eksik hacim sıfıra dönüşmemeli');
  Logger.log('SCriteriaParityAudit tests passed.');return true;
}
