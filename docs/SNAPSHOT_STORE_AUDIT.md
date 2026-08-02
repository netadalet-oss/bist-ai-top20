# Değişmez Snapshot Deposu Denetimi

## Amaç

K1–K5 ve S listelerinin çalışma anındaki hâlini sonradan değiştirilemeyecek biçimde saklamak; tahmin kanıtı ile daha sonra gerçekleşen piyasa sonucunu birbirinden ayırmak.

## Eski yapının sorunu

K ve S sayfaları her çalıştırmada yeniden yazıldığı için geçmişte gerçekten hangi sembolün, hangi sırada, hangi fiyat ve skorla seçildiği kanıtlanamıyordu. `PropertiesService` içindeki üyelik kayıtları da güncel getiriyle sonradan değiştiğinden tarihsel değerlendirmede ileri bilgi sızıntısı oluşabiliyordu.

## Yeni tablolar

### `_Snapshots`

Tahmin anındaki kayıtlar yalnız eklenir:

- `snapshotId`
- `snapshotType`
- `predictionTs`
- `featureTs`
- `sessionDate`
- `sessionKind`
- `model`
- `modelVersion`
- `symbol`
- `rank`
- `score`
- `coverage`
- `entryPrice`
- `sourceModelsJson`
- `payloadJson`
- `payloadHash`
- `createdTs`

Aynı `snapshotId` ikinci kez yazılamaz.

### `_SnapshotOutcomes`

Gerçekleşen sonuçlar tahmin satırını değiştirmeden ayrı satırlar olarak eklenir:

- değerlendirme ufku
- Reel Top 20 isabeti ve sırası
- hedef fiyat
- girişten getiri
- maksimum olumlu hareket
- maksimum ters hareket

## Bütünlük kuralları

1. `featureTs <= predictionTs` zorunludur.
2. Tahmin payload'ı kararlı anahtar sıralı JSON'a çevrilir.
3. JSON için SHA-256 özeti saklanır.
4. Snapshot kimliği mevcutsa yazma reddedilir.
5. Yazmalar `ScriptLock` altında yapılır.
6. Outcome eklemek için önce gerçek snapshot bulunmalıdır.
7. Tahmin ve outcome tabloları birbirinden ayrıdır.

## Kullanım

```javascript
const saved = saveModelSnapshot_({
  snapshotType: 'MODEL',
  predictionTs: new Date(),
  featureTs: featureTimestamp,
  sessionKind: 'SAME_DAY_EARLY',
  results: k5Results
});

saveSnapshotOutcomes_({
  snapshotId: saved.snapshotId,
  outcomes: evaluatedRows
});
```

## Test

```javascript
runSnapshotStoreTests_();
```

Test dosyası depoya eklenmiştir; Apps Script ortamında henüz çalıştırılmış test sonucu iddia edilmez.

## Bilinçli sınır

Google Sheets, veritabanı düzeyinde mutlak değişmezlik sağlamaz; yetkili kullanıcı hücreleri elle değiştirebilir. Bu modül uygulama katmanında append-only davranış, kimlik çakışması engeli ve hash doğrulaması sağlar. Üretim uygulamasında aynı sözleşme salt eklemeli bir zaman serisi/veritabanı tablosuna taşınmalıdır.
