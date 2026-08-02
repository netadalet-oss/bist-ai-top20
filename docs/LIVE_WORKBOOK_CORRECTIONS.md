# Canlı Çalışma Kitabı Düzeltmeleri

Bu düzeltmeler 2 Ağustos 2026 tarihinde `V_141225` çalışma kitabında yapılan salt okunur doğrulamadan türetilmiştir. Kapsam, başlangıç hedefiyle sınırlıdır: `Veriler -> K1-K5 -> S -> K_Tarihsel` akışının doğru okunması ve Reel Top 20 başarısının yanıltıcı olmayan biçimde ölçülmesi.

## Düzeltilen sorunlar

1. `Veriler` başlıklarındaki görünmez Unicode biçim karakterleri kaldırılır; satır sonları ve boşluklar deterministik başlık anahtarlarına çevrilir.
2. Runtime adaptörü, canlı kayıtları kanonik başlıklara dönüştürmeden özellik üretmez.
3. Destek ve direnç metinleri sayısal seviyelere ayrılır. En yakın geçerli destek/direnç ve gerçek yüzde uzaklıkları hesaplanır. Veri yoksa `null` kalır; sabit `50` puanı üretilmez.
4. K5 uyumluluk filtresi en az iki uzman model desteği ister. Tek-model satırları konsensüs olarak kabul edilmez.
5. K skor listesi `[object Object]` yerine JSON olarak serileştirilir.
6. Reel TopN listesi 20'den az geçerli hisse içeriyorsa recall paydası mevcut geçerli hisse sayısı olur ve `completeUniverse=false` işareti üretilir.

## Bilinçli sınır

Bu commit kaynak Google Sheet'i değiştirmez. Düzeltmeler modüler Apps Script runtime'ına uygulanmıştır. Canlı dosyaya geçişten önce `runLiveWorkbookCorrectionsTests_()` ve uçtan uca gölge çalıştırma yapılmalıdır.
