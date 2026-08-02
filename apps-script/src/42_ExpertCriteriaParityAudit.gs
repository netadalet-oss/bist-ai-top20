/* Read-only parity audit between legacy KS_build_K1..K4 and EXPERT_MODELS. */
var EXPERT_CRITERIA_PARITY_AUDIT = (function () {
  'use strict';

  const VERSION = 'EXPERT-CRITERIA-PARITY-1.0.0';
  const FINDINGS = Object.freeze([
    {
      model:'K1', code:'K1_LEGACY_MISSING_AS_ZERO', severity:'HIGH',
      legacy:'Eksik alt bileşenler (score || 0) ile gerçek sıfır gibi toplam skora girer.',
      modular:'MODEL_CORE.weightedValue yalnız mevcut bileşenleri kullanır ve asgari kapsam arar.',
      status:'FIXED'
    },
    {
      model:'K1', code:'K1_HIGH_VOLATILITY_REWARDED', severity:'HIGH',
      legacy:'Vol5, Vol21, Vol63 ve vol oranlarında büyük değer daha iyi puanlanır.',
      modular:'Aynı yön korunmuştur; ekonomik üstünlüğü outcome verisiyle henüz doğrulanmamıştır.',
      status:'QUARANTINED'
    },
    {
      model:'K1', code:'K1_LOWER_BAND_POSITION_UNBOUNDED', severity:'MEDIUM',
      legacy:'Alt bant konumu bant dışına taşınca 0-1 aralığı dışına çıkabilir; evren içi normalizasyon bunu gizler.',
      modular:'Aynı ham oran kullanılır; skor normalize edilse de ham metrik clamp edilmez.',
      status:'OPEN'
    },
    {
      model:'K1', code:'K1_DOTTED_ALIAS_NOT_RESOLVED', severity:'HIGH',
      legacy:'N/A',
      modular:'n_() doğrudan row[name] okur; latest.hacimDeg gibi noktalı yedek yollar çalışmaz.',
      status:'OPEN'
    },
    {
      model:'K2', code:'K2_MISSING_EMA_STACK_FALSE', severity:'HIGH',
      legacy:'EMA alanlarından biri eksik olduğunda emaStack 0 üretilir ve eksiklik olumsuz sinyal sayılır.',
      modular:'Eksik EMA verisi null kalır ve kapsam hesabına tabi olur.',
      status:'FIXED'
    },
    {
      model:'K2', code:'K2_RELATIVE_ONLY_NORMALIZATION', severity:'MEDIUM',
      legacy:'EMA gap, MACD, RSI mesafesi ve momentum yalnız aynı çalışma evrenine göre min-max sıralanır.',
      modular:'Winsorize edilmiş göreli normalizasyon kullanılır; mutlak trend eşiği hâlâ yoktur.',
      status:'OPEN'
    },
    {
      model:'K2', code:'K2_RSI_55_SYMMETRY', severity:'MEDIUM',
      legacy:'RSI 55 merkezine mutlak uzaklık kullanılır; 70 ve 40 aynı uzaklıkta eşit cezalanabilir.',
      modular:'Aynı simetrik hedef korunmuştur; yönsel katkısı kalibrasyonla doğrulanmalıdır.',
      status:'QUARANTINED'
    },
    {
      model:'K3', code:'K3_GLOBAL_FIRST_NONEMPTY_WINDOW', severity:'BLOCKER',
      legacy:'Evren içinde herhangi bir aday üreten ilk pencere tüm hisselere uygulanır; daha geniş penceredeki geçerli hisseler dışlanır.',
      modular:'Her hisse bütün pencere setlerinde ayrı değerlendirilir ve kendi en uygun formasyonu seçilir.',
      status:'FIXED'
    },
    {
      model:'K3', code:'K3_DEEPER_DIP_ALWAYS_BETTER', severity:'HIGH',
      legacy:'Asgari %3 düşüşten sonra daha derin dip doğrudan daha iyi puanlanır.',
      modular:'Aynı yön korunmuştur; aşırı düşüş/falling-knife riski ayrı ceza almamaktadır.',
      status:'QUARANTINED'
    },
    {
      model:'K3', code:'K3_PATTERN_DATA_FAIL_CLOSED', severity:'HIGH',
      legacy:'Formasyon yoksa aday dışlanır; ancak global pencere seçimi evren davranışını bozar.',
      modular:'Hisse bazında formasyon yoksa eligible=false ve açık neden döner.',
      status:'FIXED'
    },
    {
      model:'K4', code:'K4_STABILITY_ABSOLUTE_RETURN_SIGN_LOSS', severity:'BLOCKER',
      legacy:'Stabilite vol21 / |1A getiri| ile hesaplanır; büyük negatif ve büyük pozitif getiri aynı paydayı üretir.',
      modular:'Aynı formül korunmuştur; negatif 1A getiri stabilite bileşeninden olumlu puan alabilir.',
      status:'OPEN'
    },
    {
      model:'K4', code:'K4_STABILITY_ZERO_RETURN_MISSING', severity:'MEDIUM',
      legacy:'1A getiri sıfırsa stabilite null olur; toplamda (score || 0) ile cezaya dönüşür.',
      modular:'Sıfır getiride stabilite null kalır ve kapsam ağırlıkları yeniden normalize edilir.',
      status:'FIXED'
    },
    {
      model:'K4', code:'K4_PARTIAL_HORIZON_RENORMALIZATION', severity:'HIGH',
      legacy:'KS_scoreAvg_ davranışına bağlı olarak eksik 1A/3A/6A ufukları sessizce karışabilir.',
      modular:'En az üç ufuktan ikisi mevcutsa kullanılan ufuklar üzerinde yeniden normalize edilir.',
      status:'FIXED'
    }
  ]);

  function audit() {
    const unresolvedBlockers = FINDINGS.filter(function (x) {
      return x.severity === 'BLOCKER' && x.status !== 'FIXED' && x.status !== 'REMOVED';
    }).map(function (x) { return x.code; });

    return {
      auditVersion: VERSION,
      generatedAt: new Date(),
      legacyFunctions: ['KS_build_K1','KS_build_K2','KS_build_K3','KS_build_K4'],
      modularModule: 'EXPERT_MODELS',
      findings: FINDINGS.slice(),
      counts: FINDINGS.reduce(function (o, x) {
        o[x.severity] = (o[x.severity] || 0) + 1;
        return o;
      }, {}),
      unresolvedBlockers: unresolvedBlockers,
      validForPromotion: unresolvedBlockers.length === 0,
      decision: unresolvedBlockers.length
        ? 'K1-K4 kriter seti aktif model terfisine hazır değildir.'
        : 'K1-K4 kriter setinde açık blocker yoktur.'
    };
  }

  return Object.freeze({version: VERSION, findings: FINDINGS, audit: audit});
})();

function auditExpertCriteriaParity_() {
  const result = EXPERT_CRITERIA_PARITY_AUDIT.audit();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
