# Kalibrasyon Veri Adaptörü ve Model Registry

## Amaç

Bu katman `_Snapshots` ve `_SnapshotOutcomes` tablolarını aynı gün ve ertesi gün hedefleri için walk-forward kalibrasyon örneklerine dönüştürür; seçilen ağırlıkları sürümlü ve geri alınabilir model kayıtları olarak saklar.

## Veri adaptörü

`apps-script/src/18_CalibrationDataAdapter.gs`

- yalnız `snapshotType = S` kayıtlarını kullanır,
- `snapshotId + symbol + horizon` anahtarıyla outcome eşler,
- mükerrer outcome kaydını reddeder,
- snapshot payload içindeki değişmez `raw.components` alanını kullanır,
- outcome bulunmayan ve component bulunmayan satırları ayrı sayar,
- prediction zamanına göre deterministik sıralama üretir.

Giriş noktaları:

```javascript
buildCalibrationExamples_({ horizon: 'SAME_DAY' });
runStoredWalkForwardCalibration_({
  horizon: 'NEXT_DAY',
  options: { minTrainDates: 20, testDates: 5, stepDates: 5 }
});
```

## Model registry

`apps-script/src/19_ModelRegistry.gs`

Registry sayfası: `_ModelRegistry`

Durumlar:

- `CANDIDATE`: yayımlanmış fakat üretimde kullanılmayan sürüm,
- `ACTIVE`: ilgili horizon için tek aktif sürüm,
- `RETIRED`: daha önce aktif olup yeni sürümle değiştirilmiş kayıt.

Bir kalibrasyon raporundan aday sürüm üretmek:

```javascript
const candidate = publishCalibratedModel_({ report: calibrationReport });
```

Açık aktivasyon:

```javascript
activateModelVersion_('SAME_DAY', candidate.version);
```

Aktif modeli okumak:

```javascript
const active = getActiveModel_('SAME_DAY');
```

## Güvenlik ilkeleri

- Ağırlık toplamı 1 olmak zorundadır.
- Aynı model/horizon/version ikinci kez yazılamaz.
- Yeni sürüm otomatik olarak aktif olmaz.
- Bir horizon için birden fazla aktif kayıt varsa işlem hata verir.
- Kaynak ağırlıklar, eğitim aralığı ve metrikler SHA-256 ile ilişkilendirilir.
- Geçmiş registry satırı silinmez; aktif sürüm değiştiğinde önceki kayıt `RETIRED` olur.

## Bilinçli sınırlar

- Google Sheets yetkili kullanıcı tarafından elle değiştirilebilir; registry uygulama seviyesinde append-only davranış sağlar.
- Kalibrasyon raporunun son fold ağırlıkları aday sürüm olarak yayımlanır. Daha gelişmiş sürüm seçimi için fold kararlılığı ve bootstrap güven aralıkları sonraki aşamada eklenmelidir.
- Aday model, üretime alınmadan önce en az bir dokunulmamış dönem ve operasyonel gölge çalışma ile doğrulanmalıdır.
