# Ölçüm ve Raporlama Katmanı

## Amaç

Snapshot tahminleri ile sonradan eklenen outcome kayıtlarını birleştirerek model başarısını veri sızıntısı olmadan ölçmek.

## Temel ilkeler

1. Veri bulunmayan hisse otomatik başarısız sayılmaz; `unavailableCount` ve `dataCoverage` ile ayrı raporlanır.
2. Aynı snapshot/sembol/ufuk için mükerrer outcome kaydı hata üretir.
3. Aynı gün ve ertesi işlem günü ufukları ayrı raporlanır.
4. Ortalama getiri tek başına kullanılmaz; medyan, çeyrekler, MFE ve MAE birlikte gösterilir.
5. Hisse bazlı başarı oranlarında örneklem sayısı her zaman raporlanır.

## Snapshot metrikleri

- `predictionCount`: snapshot içindeki aday sayısı.
- `evaluatedCount`: yeterli piyasa verisi bulunan aday sayısı.
- `dataCoverage`: evaluated / prediction.
- `hitCount`: Reel Top 20'ye giren aday sayısı.
- `precisionAt20`: hit / değerlendirilebilir tahmin sayısı.
- `recallAt20`: yakalanan Reel Top 20 hissesi / gerçek Top 20 büyüklüğü.
- `averageReturnPct`, `medianReturnPct`: tüm değerlendirilebilir adayların getirisi.
- `averageHitReturnPct`, `medianHitReturnPct`: yalnız Top 20 isabetlerinin getirisi.
- `averageMfePct`, `medianMfePct`: giriş sonrası maksimum olumlu hareket.
- `averageMaePct`, `medianMaePct`: giriş sonrası maksimum olumsuz hareket.
- `positiveReturnRate`: pozitif getiri üreten değerlendirilebilir aday oranı.

## Toplulaştırma

Snapshotlar arası raporlama makro ortalama kullanır. Böylece çok satırlı bir snapshot diğer günleri örneklem büyüklüğüyle ezmez. Mikro oranlar ayrıca ileride rapor katmanına eklenebilir.

## Kırılımlar

Aynı sözleşme şu kırılımları üretir:

- model bazında,
- sembol bazında,
- seans türü bazında.

Her kırılımda örneklem sayısı, veri kapsamı, isabet oranı, ortalama ve medyan getiri bulunur.

## Yorumlama sınırları

- Düşük örneklemli hisse veya model oranları güvenilir kabul edilmemelidir.
- Precision@20 yüksek olsa bile giriş sonrası getiri negatif olabilir; iki ölçüt birlikte değerlendirilmelidir.
- Recall@20, piyasa evreni ve Reel Top 20 tanımı sabit tutulmadan dönemler arasında karşılaştırılmamalıdır.
- MFE/MAE kalitesi, sağlanan gün içi bar sıklığına bağlıdır.

## Test

Apps Script ortamında:

```javascript
runMetricsReporterTests_();
```

Testler Precision, Recall, getiri özetleri, sembol kırılımı ve mükerrer outcome reddini kontrol eder.
