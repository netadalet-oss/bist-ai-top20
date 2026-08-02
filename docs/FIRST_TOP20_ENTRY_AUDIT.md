# Gün İçi İlk Reel Top 20 Giriş Denetimi

## Amaç

Bir S veya model snapshot'ındaki hissenin, tahmin anından sonra gün içinde ilk kez Reel Top 20'ye girdiği anı ölçmek.

## Yöntem

Her piyasa zaman diliminde tüm geçerli hisseler `dayReturnPct` değerine göre yeniden sıralanır. İlk 20 oluşturulur. Snapshot sembolü ilk kez bu kümede görülürse o zaman dilimi ilk giriş olarak kaydedilir.

## Çıktılar

- `entered`
- `firstEntryTs`
- `firstEntryRank`
- `firstEntryPrice`
- `returnToFirstEntryPct`
- `dayReturnPctAtEntry`
- `minutesFromPrediction`
- `framesChecked`

## Veri sızıntısı önlemi

Yalnız `frameTs > predictionTs` olan zaman dilimleri kullanılır. Tahminden önceki Top 20 üyeliği başarı olarak sayılmaz.

## Reel sıralama için gerekli veri

Her zaman diliminde yalnız aday hissenin değil, karşılaştırılabilir tüm BIST evreninin günlük getiri verisi gerekir. Eksik evrenle hesaplanan sıra gerçek Reel Top 20 olarak kabul edilmemelidir.

## Zaman çözünürlüğü

İlk giriş zamanı, veri kaynağının bar çözünürlüğü kadar hassastır. Beş dakikalık veri kullanılırsa gerçek giriş anı beş dakikalık aralıkla yaklaşık belirlenir. Dakikalık veya tick veri daha kesin sonuç verir.

## Kurumsal aksiyon ve veri kalitesi

`excluded: true` olarak işaretlenen kayıtlar sıralamaya alınmaz. Dışlama gerekçesi veri hazırlama katmanında açık kalite koduyla saklanmalıdır.

## Sınır

Bu modül ilk Top 20 girişini hesaplar; kapanışta Top 20'de kalma şartı aramaz. İlk giriş ve kapanış başarısı ayrı ölçümlerdir.
