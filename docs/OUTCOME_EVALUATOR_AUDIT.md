# Outcome Üreticisi Denetimi

## Amaç

Snapshot anındaki tahmini değiştirmeden, daha sonra oluşan piyasa verisinden iki ayrı hedef etiketi üretmek:

- `SAME_DAY_CLOSE`: tahmin günü kapanış Reel Top 20
- `NEXT_TRADING_DAY_CLOSE`: sonraki işlem günü kapanış Reel Top 20

## Kaynak sistemdeki sorun

Eski K_Tarihsel yapısı güncel K listelerini geçmiş günlere uygulayabiliyor, farklı zamanlara ait getiri değerlerini aynı hücrede birleştiriyor ve Reel Top 20 havuzuna sabit `%15` filtresi uyguluyordu. Bu yaklaşım gerçek tahmin testini, güncel üyelik bilgisini ve veri temizliğini birbirine karıştırıyordu.

Yeni outcome üreticisi yalnız değişmez snapshot satırlarını ve tahmin sonrasında oluşmuş piyasa gözlemlerini kullanır.

## Reel Top 20 tanımı

Geçerli piyasa gözlemleri `sessionReturnPct` alanına göre azalan sıralanır ve ilk 20 alınır. Sabit `%15` veya benzeri keyfi getiri sınırı uygulanmaz.

Kurumsal aksiyon, bozuk fiyat veya başka veri kalite problemi olan satırlar veri sağlayıcı tarafından açık biçimde:

```javascript
{ quality: 'CORPORATE_ACTION', excluded: true }
```

olarak işaretlenmelidir. Böylece gerçek yüksek getiriler sessizce dışlanmaz; dışlama nedeni denetlenebilir olur.

## Zaman sözleşmesi

- Snapshot tek bir tahmin gününe ait olmalıdır.
- MFE/MAE hesabında yalnız `bar.ts > predictionTs` gözlemleri kullanılır.
- Aynı gün ve ertesi işlem günü etiketleri ayrı kaydedilir.
- Ertesi işlem günü hafta sonları ve sağlanan resmi tatil listesi atlanarak bulunur.

## Üretilen alanlar

```text
horizon
evaluationTs
top20Hit
top20Rank
targetPrice
returnPct
maxFavorablePct
maxAdversePct
```

`returnPct`, snapshot giriş fiyatından hedef kapanış fiyatına getiridir. `maxFavorablePct` ve `maxAdversePct`, tahmin anından değerlendirme anına kadar görülen en iyi ve en kötü hareketi ölçer.

## Veri bulunmaması

Bir sembol için hedef gün gözlemi yoksa:

- `top20Hit = false`
- fiyat ve getiri alanları `null`
- payload içinde `dataAvailable = false`

olur. Bu kayıt başarısız tahmin olarak otomatik yorumlanmamalıdır; ölçüm katmanı veri eksikliği ile model hatasını ayırmalıdır.

## Bilinçli sınır

Bu modül piyasa barlarını kendisi indirmez. Tarihsel API veya gelecekteki zaman serisi veritabanı, aynı `marketBars` sözleşmesini sağlamalıdır. Resmi BIST işlem günü takvimi henüz otomatik kaynağa bağlanmamıştır; tatiller seçenek olarak verilmelidir.
