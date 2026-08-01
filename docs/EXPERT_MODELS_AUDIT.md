# K1–K4 Uzman Model Denetimi

## Kaynak eşlemesi

- K1: monolit kaynak satır 4194–4426
- K2: satır 4438–4544
- K3: satır 4558–4846
- K4: satır 4861–5069

## Ortak eski sorunlar

1. Modeller aynı görünümde çıktı üretse de ortak bir makine sözleşmesine sahip değildi.
2. Ağırlıklı toplamlarda eksik bileşenler `|| 0` ile sıfır kabul ediliyordu. Bu, eksik veri ile gerçek düşük skoru aynılaştırıyordu.
3. `KS_breakTies_` eşit skorları ayırmak için 0–1 arası tam puan ekliyordu; yakın fakat eşit olmayan sıraları da bozabiliyordu.
4. Skor dağılımları ve veri kapsamı sonuçta raporlanmıyordu.

## Model bazlı bulgular

### K1

Kaynak ağırlıkları korunmuştur: volatilite %25, dip %20, momentum %35, yukarı sinyal %20. Yeni sürüm eksik alt bileşenleri sıfır saymak yerine mevcut ağırlıkları yeniden normalize eder ve `coverage` alanını döndürür.

### K2

EMA stack, iki EMA farkı, MACD histogramı, RSI 55 uzaklığı ve Momentum10 korunmuştur. Yetersiz veri kapsamındaki kayıt aday sayılmaz.

### K3

Eski sürüm, tüm evrende aday üreten ilk pencereyi seçip aynı pencereyi bütün hisselere uyguluyordu. Yeni sürüm 10/15/20/30 günlük konfigürasyonları her hisse için ayrı değerlendirir. En yakın geçerli toparlanma, eşitlikte daha derin dip seçilir.

### K4

1/3/6 aylık getiri, stabilite ve kısa vade blokları korunmuştur. Ufuk getirilerinden en az ikisi yoksa çoklu zaman bloğunun kapsamı yetersiz kabul edilir.

## Standart sonuç sözleşmesi

```javascript
{
  model,
  modelVersion,
  symbol,
  featureTs,
  score,
  coverage,
  eligible,
  rank,
  raw,
  normalized,
  tieBreak,
  reason,
  source
}
```

## Bilinçli sınır

Bu aşama ağırlıkları sonuç verisine göre optimize etmez. Ağırlık optimizasyonu ancak değişmez snapshot, doğru hedef etiketi ve walk-forward doğrulama kurulduktan sonra yapılacaktır.
