# Teknik Gösterge Denetimi

## Kaynak kapsamı

Monolit kaynakta teknik yardımcılar iki kez, aynı adlarla bildirilmiştir:

- yaklaşık satırlar 1527–1607
- yaklaşık satırlar 1609–1689

Gösterge bileşimi yaklaşık satırlar 1847–1889 arasındadır.

## Tespit edilen sorunlar

### 1. Mükerrer global fonksiyonlar

`_lastValid_`, `pctChangeSeries_`, `emaSeries_`, `rsiSeries_`, `rollingStdev_`, `rollingMean_`, `bollingerSeries_`, `betaSeries_` ve `rollingReturn_` iki kez bildirilmiştir. Bugünkü metinde gövdeler büyük ölçüde aynı olsa da sonraki revizyonlarda bir kopyanın değiştirilmesi sessiz davranış ayrışmasına yol açabilir.

### 2. Eksik gözlemin sıfır gibi hesaba katılması

Eski `rollingMean_` ve `rollingStdev_`, pencere içinde `null` bulunduğunda toplamı yalnız geçerli değerlerle oluşturup yine de `window` sayısına bölmektedir. Bu, eksik gözlemi fiilen sıfır gibi etkiler ve Bollinger/volatilite değerlerini aşağı yönlü çarpıtır.

Yeni strict sözleşme: pencerenin bütün gözlemleri geçerli değilse sonuç `null` olur.

### 3. RSI null güvenliği

Eski RSI doğrudan `arr[i] - arr[i-1]` yapar. Aradaki eksik değerler `NaN` üretebilir ve sonraki seri boyunca yayılabilir. Yeni RSI, kesintisiz geçerli segmentler üzerinde Wilder hesabını yeniden başlatır.

### 4. Beta tanımı

Eski `betaSeries_`, fiyat seviyelerinin kovaryansını fiyat seviyelerinin varyansına böler. Finansal beta normalde fiyat seviyeleri değil, eşzamanlı getiriler üzerinden hesaplanmalıdır.

Yeni fonksiyon `betaFromReturns` adını kullanır ve yüzde getirileri esas alır. Eski beta çıktısı otomatik olarak değiştirilmemiştir; model geçişinde karşılaştırmalı doğrulama gerekir.

### 5. EMA başlangıç tanımı

Eski EMA ilk geçerli gözlemi başlangıç değeri kabul eder; klasik alternatiflerden biri ilk `period` gözlemin SMA'sını seed olarak kullanmaktır. Davranış değişikliğini önlemek için yeni modül mevcut ilk-değer seed yaklaşımını korur ve bunu açıkça belgeler.

### 6. Volatilite tanımı

Mevcut volatilite, günlük yüzde değişimlerin popülasyon standart sapmasıdır. Yıllıklandırma uygulanmaz. Yeni modül aynı tanımı korur; yıllıklandırılmış volatilite ileride ayrı isimli bir özellik olmalıdır.

## Yeni modül

`apps-script/src/07_Indicators.gs`

Saf fonksiyonlar:

- `pctChange`
- `rollingReturn`
- `ema`
- `rsi`
- `rollingMean`
- `rollingStdev`
- `bollinger`
- `momentum`
- `macd`
- `betaFromReturns`
- `computeBundle`

Bu fonksiyonlar `SpreadsheetApp`, `PropertiesService` ve `UrlFetchApp` kullanmaz.

## Testler

`apps-script/tests/IndicatorsTest.gs`

Elle çalıştırılan giriş noktası:

```javascript
runIndicatorTests_();
```

Testler indeks hizası, EMA seed davranışı, null pencereler, popülasyon standart sapması, RSI, MACD dizi uzunluğu ve Bollinger hesaplarını kapsar.

## Geçiş ilkesi

1. Önce yeni ve eski gösterge sonuçları aynı tarihsel örnek üzerinde yan yana kaydedilir.
2. Eksiksiz veri serilerinde beklenmeyen farklar hata kabul edilir.
3. Eksik veri içeren serilerde strict sonuçlar tercih edilir; sonuç `null` olarak taşınır.
4. K1–K4 modelleri yeni gösterge isimlerine tek tek geçirilir.
5. Beta geçişi ayrı model sürümü gerektirir; sessizce değiştirilmez.
