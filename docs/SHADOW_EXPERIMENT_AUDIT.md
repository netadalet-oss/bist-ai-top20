# Çift Kollu Gölge Deney Denetimi

## Amaç

Legacy S ve yeni S listelerini aynı tahmin anında, ayrı ve sabit giriş fiyatlarıyla kaydetmek; daha sonra aynı piyasa outcome evreniyle karşılaştırmaktır.

## Tablolar

- `_ShadowExperiments`: deney üst kaydı
- `_ShadowExperimentArms`: LEGACY ve NEW kol satırları

Tahmin kayıtları append-only yazılır. Outcome değerlendirmesi tahmin satırlarını değiştirmez.

## Fonksiyonlar

```javascript
createShadowExperiment_(input);
runDualArmShadowExperiment_(input);
evaluateShadowExperiment_(input);
```

## Giriş fiyatı ilkesi

Her kolun giriş fiyatı tahmin anında ayrı sabitlenir. Legacy kol için eski S tablosundaki maliyet/giriş fiyatı varsa o değer; yoksa aynı zamandaki kanonik fiyat kullanılır. Yeni kol kendi runtime seçimindeki giriş fiyatını kullanır.

## Ortak outcome ilkesi

İki kol aynı sembol bazlı outcome kümesiyle değerlendirilir. Her kolun getirisi kendi giriş fiyatına göre yeniden hesaplanır:

```text
returnPct = targetPrice / armEntryPrice - 1
```

Bu nedenle ortak sembol iki kolda farklı giriş fiyatına sahipse getirileri de farklı olabilir.

## Üretilen karşılaştırmalar

- predictionCount
- evaluatedCount
- dataCoverage
- hitCount
- Precision@20
- averageReturnPct
- averageMfePct
- averageMaePct
- NEW - LEGACY precision farkı
- NEW - LEGACY ortalama getiri farkı

## Veri bütünlüğü

- Aynı experimentId ikinci kez yazılamaz.
- Her kol içinde mükerrer sembol reddedilir/tekilleştirilir.
- Geçerli ve pozitif giriş fiyatı olmayan satır deneye alınmaz.
- Aynı sembol için mükerrer outcome hata üretir.
- Outcome bulunmayan kayıt başarısız değil, veri yok kabul edilir.

## Bilinçli sınırlar

- MFE/MAE değerleri outcome kaynağından gelir; kol bazlı farklı giriş fiyatına göre yeniden ölçeklenmiyorsa doğrudan karşılaştırma sınırlıdır.
- İşlem maliyeti, alış-satış makası ve kayma henüz uygulanmamaktadır.
- Gerçek ekonomik üstünlük için yeterli örneklem, aynı seanslar ve kronolojik değerlendirme gerekir.
- Test kodları depoya eklenmiştir; Apps Script çalışma ortamında çalıştırılmış sonuç iddiası yoktur.
