# Walk-Forward Kalibrasyon Denetimi

## Amaç

S seçim motorundaki aynı gün ve ertesi gün ağırlıklarını bütün geçmiş veri üzerinde tek seferde optimize etmek yerine, yalnız geçmişte mevcut olan bilgilerle kalibre etmek.

## Temel ilke

Her fold için:

1. Eğitim dönemi test döneminden önce biter.
2. Ağırlıklar yalnız eğitim dönemindeki değişmez snapshot ve outcome kayıtlarından seçilir.
3. Seçilen ağırlıklar daha sonraki test dönemine dokunulmadan uygulanır.
4. Test sonucu ağırlık seçimine geri beslenmez.

Bu yapı `trainEnd < testStart` kuralını zorunlu tutar.

## Ayrı hedefler

Kalibrasyon iki bağımsız ufukta yürütülür:

- `SAME_DAY`
- `NEXT_DAY`

Aynı gün bileşenleri:

- consensus
- shortMomentum
- liveStrength
- volumeAcceleration
- technicalStructure

Ertesi gün bileşenleri:

- consensus
- trendStructure
- recoveryPattern
- mediumMomentum
- riskQuality

## Ağırlık araması

Başlangıç uygulaması simplex grid search kullanır. `gridStep=0.25` olduğunda beş bileşenin ağırlıkları 0, 0.25, 0.50, 0.75 ve 1.00 değerlerinden oluşur ve toplamları 1'dir.

Bu yöntem bilinçli olarak açıklanabilir ve deterministiktir. Örneklem büyüdüğünde daha ince grid, Bayesian optimization veya düzenlileştirilmiş lojistik model eklenebilir; ancak walk-forward ayrımı korunmalıdır.

## Amaç fonksiyonu

Varsayılan amaç:

- Precision@20: %65
- Getiri kalitesi: %25
- Veri kapsamı: %10

Getiri kalitesi, ortalama getiriyi sınırlı 0-1 ölçeğine dönüştürür. Bu ağırlıklar nihai ekonomik optimum iddiası değildir; açık başlangıç sözleşmesidir.

## Düşük örneklem koruması

Bir fold içinde değerlendirilen tahmin sayısı `minEvaluatedPerFold` eşiğinin altındaysa o ağırlık adayı geçerli kabul edilmez.

## Çıktı

Her fold için:

- eğitim ve test tarih aralığı
- seçilen ağırlıklar
- eğitim metrikleri
- dokunulmamış test metrikleri

saklanır.

Toplu raporda fold ortalamaları verilir. Fold sonuçları birleştirilip geçmiş yeniden optimize edilmez.

## Bilinçli sınırlar

- Kalibrasyon ancak gerçek değişmez snapshot/outcome örnekleri biriktikten sonra anlamlıdır.
- Sentetik testler algoritmik sözleşmeyi doğrular; piyasa başarısını kanıtlamaz.
- Precision ve getiri hedeflerinin ekonomik ağırlıkları işlem maliyeti, likidite ve risk tercihlerine göre daha sonra revize edilmelidir.
- Aynı sembol ve dönemde mükerrer outcome kayıtları veri hazırlama aşamasında reddedilmelidir.
