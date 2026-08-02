# Runtime Input Adapter Denetimi

## Amaç

`buildRuntimeInputs_()` üretim adaptörü, `Veriler` sayfasından başlayan zinciri standart model girdilerine bağlar:

```text
Veriler
  -> kanonik özellik nesneleri
  -> K1/K2/K3/K4
  -> K5 konsensüs
  -> runtime S seçimi
  -> değişmez snapshot
```

## Kaynak sözleşmesi

Adaptör `VERILER_REPOSITORY.readAllObjects()` çıktısını kullanır. Ham sütun adları açık eşleme listeleriyle kanonik alanlara çevrilir. Kaynakta bulunmayan değerler `null` bırakılır; tahmini veya sentetik teknik değer üretilmez.

K3 için T0-T30 alanlarından şu diziler oluşturulur:

- kapanış
- fiyat değişimi
- hacim
- hacim değişimi

## Veri sızıntısı koruması

Her kayıt için:

```text
featureTs <= predictionTs
```

zorunludur. Gelecek zamanlı kayıtlar `FEATURE_TS_AFTER_PREDICTION` nedeniyle reddedilir. `VeriZamani` bulunmayan kayıtlar `MISSING_FEATURE_TS` olarak ayrılır.

## Üretim fonksiyonları

```javascript
buildRuntimeInputs_(input)
runEndToEndSSelection_(input)
saveEndToEndSSelectionSnapshot_(input)
```

`buildRuntimeInputs_()` özellikleri, K1-K5 sonuçlarını, reddedilen kayıtları ve model bazlı sayıları döndürür.

## Bilinçli sınırlar

- Bu modül API'yi kendisi çağırmaz; önce `Veriler` tablosunun güncel olması gerekir.
- Sütun adları kaynak çalışma kitabındaki gerçek başlıklarla Apps Script ortamında doğrulanmalıdır.
- K3 formasyon kalitesi, T0-T30 tarihsel alanlarının doğru ve aynı zaman kesitinde olmasına bağlıdır.
- Aktif model ağırlıkları ekonomik başarı garantisi değildir.
- Test kodu depoya eklenmiştir; Apps Script çalışma ortamında henüz çalıştırılmış sonuç iddiası yoktur.

## Sonraki doğrulama

1. Gerçek çalışma kitabında başlık eşleme denetimi.
2. `Veriler` güncellemesi sonrası gölge S snapshot üretimi.
3. Eski S ile yeni S sonuçlarının aynı zaman damgasında karşılaştırılması.
4. Snapshot/outcome birikimi sonrası walk-forward kalibrasyon.
