# Model Feature Coverage Audit

## Amaç

Bu denetim, `Veriler` başlıklarının yalnız fiziksel olarak mevcut olup olmadığını değil, K1-K4 modellerinin gerçekten tükettiği kanonik özelliklerin satır bazında kullanılabilir olup olmadığını ölçer.

Denetim salt okunurdur. Çalışma kitabını, başlıkları, formülleri veya verileri değiştirmez.

## Çalıştırma

Apps Script çalışma ortamında:

```javascript
auditLiveModelFeatureCoverage_();
```

Özel eşik ve tarihçe derinliği:

```javascript
auditLiveModelFeatureCoverage_({
  minCoverage: 0.90,
  historyDepth: 30,
  predictionTs: new Date()
});
```

Test:

```javascript
runModelFeatureCoverageAuditTests_();
```

## Ölçülen alanlar

### K1

- `anlik`, `anlikdeg`, `kapanis_T`
- `hacimdeg`
- `vol5`, `vol21`, `vol63`
- `bollu`, `bolla`
- `rsi14`, `deg3g_num`

### K2

- `ema20`, `ema50`, `ema200`
- `macdhist`
- `rsi14`
- `momentum10`

### K3

- `history.close`
- `history.chg`
- `history.volChg`

Varsayılan tarihçe derinliği T0 dahil 31 gözlemdir.

### K4

- `getiri1A`, `getiri3A`, `getiri6A`
- `vol21`
- `deg3g_num`
- `rsi14`

## Alan sınıflandırması

Her alan için aşağıdaki ölçüler üretilir:

- `validCount`: kullanılabilir sonlu sayı veya tam tarihçe
- `partialCount`: yalnız tarihçe alanları için, beklenen derinliğin bir kısmı mevcut
- `missingCount`: boş veya bulunmayan değer
- `invalidCount`: boş olmayan fakat sonlu sayıya dönüşmemiş değer
- `zeroCount`: geçerli sıfır değer sayısı
- `distinctValidCount`: farklı geçerli değer sayısı
- `constant`: en az iki geçerli kayıt içinde bütün değerlerin aynı olması
- `coverage`: `(validCount + partialCount) / rowCount`

Sıfır veya sabit değer tek başına veri hatası sayılmaz. Bunlar API/formül bozulması, yanlış ölçekleme veya güncellenmeyen kolon ihtimalini incelemek için uyarı üretir.

## Model hazır olma kuralı

Bir model `ready=true` olmak için:

1. modele ait bütün alanların kapsamı `minCoverage` eşiğini karşılamalıdır;
2. hiçbir alanda geçersiz tür bulunmamalıdır.

Sabit ve tümü sıfır alanlar uyarı üretir ancak otomatik olarak modeli kapatmaz. Bunun nedeni, bazı piyasa koşullarında sıfırın meşru olabilmesidir. Canlı çalışma kitabında sonuçlar sembol ve kaynak kolon bazında incelenmelidir.

## Bilinçli sınırlar

- Denetim veri doğruluğunu ispatlamaz; yalnız kullanılabilirlik ve temel dağılım anomalilerini ölçer.
- K3 tarihçesinin uzunluğu ve sayısal doluluğu denetlenir; kronolojik sıra ayrıca doğrulanmaz.
- Teknik göstergenin ekonomik olarak makul aralıkta olması bu sürümün kapsamında değildir.
- Canlı sonuç elde etmek için fonksiyon hedef Apps Script çalışma kitabında manuel çalıştırılmalıdır.
- Repository içinde eklenen testler sentetik kayıtlara dayanır; gerçek piyasa verisiyle çalıştırılmış sonuç iddiası değildir.

## Sonraki güvenlik kapısı

Canlı rapor alındıktan sonra:

1. eşik altı alanlar kaynak `Veriler` başlıklarına geri izlenmeli;
2. tümü sıfır veya sabit alanların formülleri/API kaynakları incelenmeli;
3. K3 için tarihçe dizilerinin T0 -> T30 sırası doğrulanmalı;
4. model çalıştırma, kritik alan kapsamı kabul eşiğinin altındaysa fail-closed davranışına bağlanmalıdır.
