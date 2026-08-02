# S Selection Engine Audit

## Amaç

Mevcut S üretimindeki sabit K1-K5 koltuk dağıtımını kaldırmak ve bütün adayları tek havuzda, hedef ufkuna göre karşılaştırılabilir skorlarla sıralamak.

## Eski yapının temel sorunları

- Her K modeli için önceden ayrılmış koltuk sayısı gerçek başarı verisine dayanmıyordu.
- K sayfalarının dolaşım sırası aday havuzunu etkileyebiliyordu.
- Aynı hisse birden fazla model tarafından desteklense de ilk görülen modelle temsil edilebiliyordu.
- Aynı gün ve ertesi gün hedefleri aynı skor içinde karışıyordu.
- Giriş fiyatı ve özellik zamanı tek veri sözleşmesinden gelmiyordu.

## Yeni sözleşme

`S_SELECTION_ENGINE.select()` şu girdileri kullanır:

- K1-K5 standart model sonuçları
- ortak özellik kayıtları
- hedef ufku: `SAME_DAY`, `NEXT_DAY` veya `COMBINED`
- açık seçim seçenekleri

Çıktı her hisse için şunları içerir:

```text
symbol
rank
sameDayScore
nextDayScore
combinedScore
entryPrice
featureTs
coverage
sourceModels
modelVersion
```

## Başlangıç ağırlıkları

### Aynı gün

- K5 konsensüs: %35
- kısa momentum/K1: %25
- canlı güç: %20
- hacim ivmesi: %10
- teknik yapı: %10

### Ertesi gün

- K5 konsensüs: %35
- trend yapısı/K2: %25
- toparlanma formasyonu/K3: %15
- orta vade momentum: %15
- risk kalitesi: %10

Bu oranlar öğrenilmiş optimum değerler değildir. Snapshot ve outcome örneklemi yeterli olduktan sonra walk-forward kalibrasyonla değiştirilecektir.

## Uygunluk koşulları

Varsayılan olarak:

- en az iki uzman model desteği,
- ortalama girdi kapsamı en az %60,
- geçerli giriş fiyatı,
- iki hedef skoru için hesaplanabilir veri

zorunludur.

## Sıralama

Seçilen hedef ufkun skoru azalan sırada kullanılır. Eşitliklerde sırasıyla:

1. veri kapsamı,
2. destekleyen model sayısı,
3. sembol kodu

kullanılır. Ana skora yapay epsilon eklenmez.

## Snapshot entegrasyonu

`saveSSelectionSnapshot_()` seçilen listeyi `_Snapshots` tablosuna append-only olarak yazar. Giriş fiyatı tahmin anında sabitlenir; sonraki çalıştırmalarda güncellenmez.

## Bilinçli sınırlar

- Canlı güç ve hacim ivmesi mevcut özellik alanlarından türetilen başlangıç dönüşümleridir.
- Dakikalık VWAP, göreli sektör gücü ve açılıştan itibaren hacim hızı henüz mevcut değildir.
- Ağırlıklar gerçek hedef etiketleriyle kalibre edilmeden üretim başarısı iddia edilmemelidir.
- Aynı gün ve ertesi gün skorları ayrı tutulsa da uzman modeller henüz ayrı eğitimli modeller değildir.
