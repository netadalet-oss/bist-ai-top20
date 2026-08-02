/* Read-only parity audit between legacy S_KriterYarisi and S_SELECTION_ENGINE. */
var S_CRITERIA_PARITY_AUDIT = (function () {
  'use strict';
  const VERSION='S-CRITERIA-PARITY-1.0.0';
  const FINDINGS=Object.freeze([
    {code:'LEGACY_CURRENT_LIST_BACKTEST',severity:'BLOCKER',legacy:'Bugünkü K1-K5 listelerini T1-T30 geçmiş getirileriyle puanlar.',modular:'Snapshot/outcome ve walk-forward yalnız tahmin anında sabitlenen listeyi kullanır.',status:'REMOVED'},
    {code:'LEGACY_FIXED_MODEL_SEATS',severity:'BLOCKER',legacy:'Her K modeline en az bir koltuk verir ve göreli scoreK ile kota dağıtır.',modular:'Bütün uygun hisseler tek havuzda horizon skoruna göre sıralanır.',status:'REMOVED'},
    {code:'LEGACY_SOURCE_ORDER_DEDUP',severity:'HIGH',legacy:'Aynı hisseyi K1→K5 okuma sırasına göre ilk görülen KaynakK altında tutar.',modular:'sourceModels bütün destekleyen modelleri korur.',status:'REMOVED'},
    {code:'LEGACY_RELATIVE_MODEL_MINMAX',severity:'HIGH',legacy:'Yalnız beş K modeli arasında min-max yapar; bütün modeller kötü olsa da göreli lider yüksek puan alabilir.',modular:'Aday bileşenleri 0-100 sözleşmesiyle ve veri kapsamıyla değerlendirilir.',status:'REMOVED'},
    {code:'LEGACY_ONE_DAY_CHAMPION',severity:'HIGH',legacy:'scoreK içinde en iyi tek günü %10 ağırlıkla ödüllendirir.',modular:'Tek günlük şampiyon metriği yoktur; performans walk-forward outcome ile ölçülür.',status:'REMOVED'},
    {code:'LEGACY_MISSING_WEIGHT_NOT_RENORMALIZED',severity:'HIGH',legacy:'Eksik günlük adaylarda sabit TopN sıra ağırlıkları yeniden normalize edilmez.',modular:'Eksik bileşenler kullanılabilir ağırlıklar üzerinde yeniden normalize edilir.',status:'REMOVED'},
    {code:'LEGACY_SILENT_KTARIHSEL_ZERO',severity:'HIGH',legacy:'K_Tarihsel okuma hatasında bütün değerleri sessizce sıfıra çevirir.',modular:'Veri kalite kapısı eksik/bozuk veride fail-closed çalışır.',status:'REMOVED'},
    {code:'LEGACY_FARTHEST_SUPPORT',severity:'HIGH',legacy:'Fiyat altındaki desteklerden en uzak olanı seçer ve büyük uzaklığı olumlu puanlar.',modular:'Destek/direnç yalnız doğrulanmış en yakın seviyelerle hesaplanır; varsayılan S skoruna henüz dahil değildir.',status:'QUARANTINED'},
    {code:'LEGACY_BROKEN_RESISTANCE_ONLY',severity:'HIGH',legacy:'Yalnız fiyat altında kırılmış en az iki direnç varsa puan üretir; üstteki yakın direnci ölçmez.',modular:'Yanıltıcı kriter varsayılan skordan çıkarılmıştır.',status:'QUARANTINED'},
    {code:'LEGACY_CONSTANT_NEUTRAL_INFLATION',severity:'MEDIUM',legacy:'Sabit seri min-max sonucunda 50 alır; etkisiz SupMM/ResMM FinalScore seviyesini yapay yükseltir.',modular:'Eksik değerler null kalır ve kullanılabilir ağırlık yeniden normalize edilir.',status:'REMOVED'},
    {code:'LEGACY_ENTRY_PRICE_RESET',severity:'BLOCKER',legacy:'Maliyet her S yenilemesinde güncel anlık fiyata eşitlenir; Getiri aynı anda sıfır olur ve ilk giriş fiyatı korunmaz.',modular:'Değişmez snapshot entryPrice değerini tahmin anında sabitler.',status:'REMOVED'},
    {code:'LEGACY_FULL_GRID_READ',severity:'MEDIUM',legacy:'Veriler getLastColumn() ile boş fiziksel grid dahil okunur.',modular:'Kanonik A:QZ/468 sütun sözleşmesi kullanılır.',status:'REMOVED'},
    {code:'MODULAR_BLANK_AS_ZERO',severity:'BLOCKER',legacy:'N/A',modular:'Number(null) ve Number(\'\') sıfır üretebildiği için eksik bileşen kötü skor gibi davranabiliyordu.',status:'FIXED_2.0.1_1.0.1'}
  ]);
  function audit(){
    const blockers=FINDINGS.filter(function(x){return x.severity==='BLOCKER'&&String(x.status).indexOf('REMOVED')<0&&String(x.status).indexOf('FIXED')<0;});
    return {auditVersion:VERSION,generatedAt:new Date(),legacyFunction:'S_KriterYarisi',modularEngineVersion:S_SELECTION_ENGINE&&S_SELECTION_ENGINE.version,
      findings:FINDINGS.slice(),counts:FINDINGS.reduce(function(o,x){o[x.severity]=(o[x.severity]||0)+1;return o;},{}),
      unresolvedBlockers:blockers.map(function(x){return x.code;}),valid:blockers.length===0,
      decision:'Legacy S_KriterYarisi üretim zincirine geri alınmamalıdır.'};
  }
  return Object.freeze({version:VERSION,findings:FINDINGS,audit:audit});
})();
function auditSCriteriaParity_(){const r=S_CRITERIA_PARITY_AUDIT.audit();Logger.log(JSON.stringify(r,null,2));return r;}
