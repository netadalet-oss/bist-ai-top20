# İşlem Maliyeti ve Ekonomik Kalibrasyon

## Amaç

Brüt model başarısını uygulanabilir ekonomik sonuçtan ayırmak. Precision@20 tek başına yeterli değildir; alış-satış komisyonu, makas, kayma, piyasa etkisi ve likidite yetersizliği net getiriyi düşürebilir.

## Dosyalar

- `apps-script/src/29_ExecutionCostModel.gs`
- `apps-script/src/30_EconomicCalibration.gs`
- `apps-script/tests/ExecutionCostModelTest.gs`

## Maliyet bileşenleri

Toplam gidiş-dönüş maliyeti baz puan cinsinden:

```text
2 × tek taraf komisyon
+ alış-satış makası
+ 2 × (temel kayma + katılım oranına bağlı piyasa etkisi)
```

Piyasa etkisi başlangıç modeli:

```text
impact_bps_per_side = impactCoefficientBps × sqrt(participationRate / maxParticipationRate)
```

Bu, kalibre edilmiş nihai piyasa etkisi modeli değildir; açıklanabilir bir başlangıç yaklaşımıdır.

## Brüt ve net getiri

Brüt getiri değiştirilmez:

```text
grossReturnPct = exitPrice / entryPrice - 1
```

Net getiri ayrı alanda üretilir:

```text
netReturnPct = grossReturnPct - totalRoundTripPct
```

## Likidite uygunluğu

Aşağıdaki kontroller ayrı tutulur:

- minimum günlük TL işlem hacmi
- emrin günlük işleme oranı
- azami katılım oranı

Likidite koşulunu sağlamayan kayıt model isabet raporundan silinmez; ancak ekonomik amaç fonksiyonunda işlem yapılabilir aday kabul edilmez.

## Ekonomik amaç fonksiyonu

Başlangıç ağırlıkları:

```text
Precision@20        %50
Net getiri kalitesi %30
Veri kapsamı        %10
Likidite kapsamı    %10
```

Brüt walk-forward sonucu ve maliyet sonrası ekonomik sonuç aynı raporda ayrı nesneler olarak döner.

## Bilinçli sınırlar

- Varsayılan komisyon ve makas değerleri aracı kurum veya hisse bazında doğrulanmış gerçek oranlar değildir.
- Emir defteri, anlık spread ve gerçek gerçekleşme verisi yoksa maliyet tahmindir.
- Piyasa etkisi karekök yaklaşımı başlangıç modelidir.
- Vergi, BSMV veya kullanıcıya özgü ücretler ayrıca politika parametresi olarak eklenmelidir.
- Gerçek kalibrasyon için hisse, seans, emir büyüklüğü ve gerçekleşme verileri biriktirilmelidir.
