# Canlı Çalışma Kitabı Sözleşme Denetimi

## Kapsam

Bu denetim yalnız başlangıç hedefini kapsar: `Veriler -> K1..K5 -> S -> K_Tarihsel` geçişlerinin doğru okunması ve S listesinin aynı gün/ertesi gün Reel Top 20 başarısının yanıltılmadan ölçülmesi.

## 2 Ağustos 2026 canlı okuma bulguları

### Veriler

- Fiziksel genişlik: 1.731 sütun.
- Kanonik veri sözleşmesi: ilk 468 sütun.
- Artık fiziksel sütun: 1.263.
- Başlıklarda U+2060 gibi görünmez Unicode karakterleri bulunuyor.

Doğrudan metin eşleştirmesi yapan kod, görünürde aynı başlığı farklı kabul edebilir. Bütün başlıklar NFKC ve görünmez karakter temizliğiyle normalize edilmelidir.

### K1-K5

K1-K5 ilk 14 ortak sütunda aynı sırayı kullanıyor. Ancak K5 canlı çıktısında:

- `K Adet: 1` olan hisseler konsensüs listesinde yüksek skorla yer alıyor.
- `K Skor Listesi: [object Object]` üretiliyor; gerekçe serileştirmesi bozuk.

K5 için en az iki uzman model desteği zorunlu olmalı ve model skorları kararlı JSON/metin biçiminde yazılmalıdır.

### S

Canlı S gerekçelerinde incelenen satırlarda:

- `SupGap(%): 0.00`
- `ResGap(%): 0.00`
- `SupMM: 50`
- `ResMM: 50`

sabit kalıyor. Destek ve direnç metinleri dolu olduğu halde uzaklıkların sıfır olması, bu bileşenlerin hesaplanmadığını veya yanlış başlıktan okunduğunu gösterir. Sabit 50 puan bilgi taşımadığı halde FinalScore'u etkileyerek sıralamayı yanıltır. Alanlar doğru hesaplanana kadar ağırlığı sıfır olmalı veya eksik bileşen olarak yeniden normalize edilmelidir.

### K_Tarihsel

`Reel TopN` alanı bazı günlerde 20'den az sembol içeriyor. Buna rağmen model isabetleri `/20` biçiminde gösteriliyor. Gerçek evren veya veri eksikliği nedeniyle yalnız 14 sembol varsa payda 20 kullanılması recall ve trend karşılaştırmasını bozar.

Doğru sözleşme:

- `actualTopCount` ayrı saklanır.
- Precision paydası değerlendirilen tahmin sayısıdır.
- Recall paydası o gün gerçekten mevcut ve geçerli Reel TopN sayısıdır.
- Eksik evren günü `dataCoverage` ile işaretlenir ve tam Top 20 günü gibi raporlanmaz.

## Eklenen denetim

`apps-script/src/32_LiveWorkbookContractAudit.gs`

- görünmez Unicode başlık temizliği,
- K1-K5/S başlık sözleşmesi karşılaştırması,
- tek model K5 adaylarının tespiti,
- bozuk `[object Object]` gerekçelerinin tespiti,
- S sabit destek/direnç puanlarının tespiti,
- 20'den az Reel TopN içeren tarihsel günlerin tespiti

için salt okunur denetim sağlar.

Bu aşamada kaynak Google Sheet değiştirilmemiştir.
