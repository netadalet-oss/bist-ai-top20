# Bootstrap Güven Aralığı ve Ağırlık Kararlılığı

## Amaç

Walk-forward raporundaki tekil ortalamalar, fold sayısı az veya sonuçlar oynak olduğunda yanıltıcı olabilir. Bu katman model adayını yalnız ortalama Precision@20 ve getiriye göre değil, belirsizlik ve ağırlık kararlılığına göre de değerlendirir.

## Yöntem

- Yeniden örnekleme birimi satır değil test fold'udur.
- Her bootstrap örnekleminde mevcut test fold'ları yerine koymalı olarak seçilir.
- Fold içindeki hisseler ve aynı döneme ait bağımlılıklar parçalanmaz.
- Deterministik sözde rastgele sayı üreteci ve açık seed kullanılır.
- Yüzdelik bootstrap güven aralığı üretilir.

## Üretilen güven aralıkları

- Precision@20
- veri kapsamı
- ortalama getiri

Her alan için tahmin, alt sınır, üst sınır, bootstrap ortalaması ve bootstrap standart sapması saklanır.

## Ağırlık istikrarı

Her bileşen için:

- ortalama
- medyan
- standart sapma
- minimum ve maksimum
- aralık
- sıfır ağırlık payı

hesaplanır. Ardışık fold ağırlıkları arasındaki L1 mesafesi ayrıca raporlanır.

## Aday model kapısı

Varsayılan kapı koşulları:

- en az 5 geçerli test fold'u
- Precision@20 güven aralığı genişliği en fazla 0,20
- getiri güven aralığı genişliği en fazla 6 yüzde puanı
- tek bileşen ağırlığı standart sapması en fazla 0,18
- pozitif fold getirisi olasılığı en az %60

Koşullardan biri sağlanmazsa `eligibleForCandidate=false` olur ve neden kodları döndürülür. Bu karar ekonomik başarı garantisi değildir; yalnız istatistiksel ve yapısal kararlılık kapısıdır.

## Kullanım

```javascript
const analysis = analyzeWalkForwardStability_(walkForwardReport, {
  iterations: 2000,
  confidenceLevel: 0.95,
  seed: 20260802
});
```

## Sınırlar

- Fold sayısı azsa bootstrap güven aralığı güvenilir değildir.
- Fold'lar örtüşen eğitim dönemlerine sahip olduğundan tamamen bağımsız değildir.
- Rejim değişimleri bootstrap ile ortadan kalkmaz.
- Sonuçlar gerçek piyasa ve gerçekleşme verisiyle doğrulanmadan model aktivasyonu yapılmamalıdır.
- Test kodları Apps Script çalışma ortamında henüz çalıştırılmış değildir.
