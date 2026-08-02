# Runtime Data Quality Gate Audit

## Amaç

`Veriler -> kanonik özellikler -> K1-K4 -> K5 -> S` zincirinde kritik teknik alanlar eksik veya bozukken tahmin üretiminin sessizce devam etmesini engellemek.

## Konum

Kapı, `RUNTIME_INPUT_ADAPTER.readFeatures()` sonrasında ve `EXPERT_MODELS.K1-K4()` çağrılarından önce çalışır.

```text
Veriler
  -> başlık/alan normalizasyonu
  -> zaman ve sembol doğrulaması
  -> veri kalite kapısı
  -> K1-K4
  -> K5
  -> S
```

## Varsayılan politika

- `enabled: true`
- `failClosed: true`
- `minCoverage: 0.80`
- `minFeatureCount: 1`
- `requiredModels: K1,K2,K3,K4`
- `historyDepth: 30` (T0 dahil 31 gözlem)

Kapı aşağıdaki durumlarda çalışmayı durdurur:

- gerekli bir modelin alan kapsamı eşik altındaysa,
- bir model alanında sayısal olmayan geçersiz değer varsa,
- geçerli özellik kaydı sayısı asgari sınırın altındaysa,
- model kalite özeti üretilememişse.

Sabit veya tamamen sıfır seriler otomatik engel değildir; ayrı uyarı olarak taşınır. Bunun nedeni sıfırın bazı göstergelerde meşru olabilmesidir. Bu alanların ekonomik ve istatistiksel anlamı ayrıca incelenmelidir.

## Engel kodları

- `INSUFFICIENT_FEATURE_COUNT`
- `MISSING_MODEL_AUDIT`
- `FIELD_COVERAGE_BELOW_THRESHOLD`
- `INVALID_NUMERIC_FIELD`
- `MODEL_NOT_READY`
- `MISSING_AUDIT_REPORT`

Fail-closed hata adı:

```text
RuntimeDataQualityError
```

Hata nesnesinde tam rapor `qualityReport` alanında korunur.

## Açık bypass

Kapı yalnız açık yapılandırmayla devre dışı bırakılabilir:

```javascript
qualityOptions: {
  enabled: false,
  bypassReason: 'MANUAL_DIAGNOSTIC_ONLY'
}
```

Bu kullanım üretim snapshot'ı için önerilmez. Rapor `bypassed=true` ve `bypassReason` alanlarıyla işaretlenir; sessiz bypass yoktur.

## Runtime çıktısı

Başarılı veya açıkça bypass edilmiş kalite raporu runtime sonucunda:

```javascript
runtime.qualityGate
```

alanında saklanır. Böylece S listesinin hangi veri kapsamıyla üretildiği sonradan denetlenebilir.

## Test

```javascript
runRuntimeDataQualityGateTests_();
```

Test; eksiksiz veri geçişini, EMA200 kapsam eksikliğinin K2'yi bloke etmesini, fail-closed hata davranışını, açık bypass kaydını ve yalnız seçilmiş modeller için kapı çalıştırılmasını kapsar.

## Sınır

Bu modül veri üretmez, eksik değer doldurmaz ve kaynak hatasını düzeltmez. Yalnız hatalı girdinin model ve S tablosuna taşınmasını durdurur. Gerçek çalışma kitabındaki kapsam yüzdeleri Apps Script projesinde canlı denetim çalıştırılmadan iddia edilemez.
