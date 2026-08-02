# Gölge Çalışma ve Eski/Yeni S Karşılaştırması

## Amaç

Yeni S motorunu mevcut üretim `S` sayfasını değiştirmeden çalıştırmak ve iki listeyi aynı tahmin anında karşılaştırmak.

## Veri kaynakları

- Legacy liste: varsayılan olarak mevcut `S` sayfası.
- Yeni liste: `runEndToEndSSelection_()` çıktısı.
- Karşılaştırma günlüğü: `_ShadowComparisons`.

## Karşılaştırma alanları

- legacy ve yeni liste büyüklüğü
- ortak sembol sayısı ve oranı
- yalnız legacy listede olanlar
- yalnız yeni listede olanlar
- ortak sembollerin sıra farkları
- kullanılan yeni model sürümü
- tahmin zamanı, session ve horizon

## Güvenlik

Gölge çalışma:

- mevcut `S` sayfasına yazmaz,
- snapshot üretmek zorunda değildir,
- legacy sonucu değiştirmez,
- yalnız `_ShadowComparisons` tablosuna append eder.

## Yorumlama sınırı

Liste örtüşmesi ekonomik başarı ölçüsü değildir. Yeni motorun üstünlüğü ancak her iki listenin aynı zaman kesitindeki giriş fiyatları sabitlenip SAME_DAY/NEXT_DAY outcome sonuçlarıyla ayrı ayrı ölçüldüğünde değerlendirilebilir.

## Kullanım

```javascript
runShadowComparison_({
  predictionTs: new Date(),
  horizon: 'SAME_DAY',
  sessionKind: 'SAME_DAY_EARLY',
  legacyOptions: { sheetName: 'S' },
  bindingOptions: { strict: false }
});
```

## Sonraki aşama

Her gölge karşılaştırma koşusu için legacy ve yeni listelerin ayrı giriş fiyatlarını sabitleyen ve aynı Reel Top 20 outcome evreniyle karşılaştıran çift-kollu deney kaydı oluşturulmalıdır.
