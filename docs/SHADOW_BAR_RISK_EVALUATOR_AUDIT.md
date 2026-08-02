# Shadow Bar Risk Evaluator Audit

## Amaç

Legacy ve yeni S gölge kollarının getiri, MFE ve MAE değerlerini aynı ham piyasa barlarından, fakat her kolun kendi değişmez giriş fiyatına göre yeniden hesaplamak.

## Temel kural

Yalnız `predictionTs < bar.ts <= evaluationTs` aralığındaki barlar kullanılır. Tahmin öncesi yüksek veya düşük fiyatlar başarı/risk hesabına giremez.

## Formüller

- `returnPct = targetClose / entryPrice - 1`
- `maxFavorablePct = max(high) / entryPrice - 1`
- `maxAdversePct = min(low) / entryPrice - 1`

Aynı hisse iki kolda da yer alsa bile giriş fiyatları farklıysa üç metrik ayrı sonuç verir.

## Veri sözleşmesi

Her bar en az şu alanları sağlamalıdır:

```text
symbol
ts
high veya price
low veya price
close veya price
```

Her deney kolu satırı:

```text
experimentId
arm
symbol
entryPrice
predictionTs
```

alanlarını sağlamalıdır.

## Güvenlik ve bütünlük

- Geçersiz veya sıfır giriş fiyatı reddedilir.
- Değerlendirme zamanı tahmin zamanından sonra olmalıdır.
- Aynı `experimentId + arm + symbol` satırı iki kez değerlendirilemez.
- Bar bulunmayan kayıt başarısız değil `dataAvailable=false` olarak işaretlenir.
- Başka bir outcome kaydındaki MFE/MAE değerleri kopyalanmaz.

## Çalıştırma

```javascript
const report = evaluateShadowExperimentFromBars_({
  armRows: armRows,
  marketBars: marketBars,
  evaluationTs: evaluationTs
});
```

Çıktı hem hisse-kol satırlarını hem kol bazlı ortalama getiri, MFE, MAE ve veri kapsamını içerir.

## Test

```javascript
runShadowBarRiskEvaluatorTests_();
```

Test kodu depoya eklenmiştir; Apps Script ortamında çalıştırılmış sonuç iddiası yoktur.

## Kalan sınırlar

- İşlem maliyeti, alış-satış makası ve kayma henüz metriklere uygulanmamaktadır.
- Bar çözünürlüğü MFE/MAE hassasiyetini belirler.
- Kurumsal aksiyon düzeltilmemiş fiyatlar risk metriklerini bozabilir.
