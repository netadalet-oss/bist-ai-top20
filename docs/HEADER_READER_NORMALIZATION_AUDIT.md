# Başlık Okuyucu Normalizasyon Denetimi

## Kapsam

Bu düzeltme yalnız başlangıç hedefindeki veri tabanı okuma engellerini kaldırır. Model ağırlıklarını, kriterleri veya S seçim hedefini değiştirmez.

Canlı `Veriler` sayfasındaki 468 başlığın tamamında karakterler arasına `U+2060 WORD JOINER` yerleştirilmiştir. Başlıklar normalizasyon sonrasında doğru ve tam sıradadır; ancak ham metin eşleşmesi kullanan okuyucular sütunları bulamayabilir.

## Düzeltilen noktalar

### 1. Veri sözleşmesi

`04_DataContracts.gs` içinde kullanılan fakat tanımlı olmayan `AURUM_normalizeHeader_()` fonksiyonu tanımlandı. Fonksiyon öncelikle merkezi `normalizeHeader_()` uygulamasını kullanır; bu fonksiyon bulunamazsa aynı Unicode ve boşluk temizleme kurallarını yerel olarak uygular.

Bu düzeltme olmasaydı `AURUM_buildHeaderIndex_()` çalışma anında `ReferenceError` üretebilirdi.

### 2. Veriler yazma yolu

`VERILER_REPOSITORY.writeRowsBySymbol()` artık `record.values` nesnesindeki ham anahtarları doğrudan kolon haritasında aramaz. Önce her anahtarı kanonik başlığa dönüştürür.

Ayrıca aynı kanonik başlığa dönüşen iki farklı ham anahtar tek kayıtta bulunursa işlem reddedilir. Böylece görünmez karakterli ve temiz başlıkların aynı anda gönderilmesi sessiz veri ezmesine yol açmaz.

### 3. Runtime özellik eşlemesi

`RUNTIME_INPUT_ADAPTER` doğrudan verilen kayıtların anahtarlarını da normalize eder. Böylece yalnız `VERILER_REPOSITORY.readAllObjects()` üzerinden gelen kayıtlar değil, test veya adaptör yoluyla doğrudan verilen ham Sheet kayıtları da aynı sözleşmeye uyar.

Canlı şemadaki şu T0 alanları açık biçimde eşlendi:

- `EMA20_T0`
- `EMA50_T0`
- `EMA200_T0`
- `MACDHist_T0`
- `RSI14_T0`
- `Momentum10_T0`
- `Volatilite5G_T0`
- `Volatilite21G_T0`
- `Volatilite63G_T0`
- `Boll_Alt_T0`
- `Boll_Ust_T0`

Önceki adaptör ağırlıklı olarak `_T0` eki bulunmayan adları arıyordu. Bu nedenle canlı kayıt okunmasına rağmen teknik özellikler `null` kalabiliyordu. Bu durum K1-K4 ve dolayısıyla K5/S skorlarını doğrudan yanıltabilirdi.

`Degisim3Gun(%)_T0` canlı tabloda `3.56 | 1.17 | -1.92` benzeri bir seri metnidir. Adaptör artık bu alanın ilk geçerli sayısını güncel üç günlük değişim değeri olarak okur. Serinin geri kalanı ayrı bir sayıymış gibi birleştirilmez.

### 4. Legacy S okuyucusu

`SHADOW_COMPARISON.readLegacyS()` artık legacy S başlıklarını `.trim()` ile sınırlı biçimde değil, merkezi Unicode normalizasyonuyla eşler. Böylece görünmez karakterli `Hisse`, `Sembol`, `Sıra` veya `Rank` başlıkları gölge karşılaştırmasını durdurmaz.

## Test

`runHeaderReaderNormalizationTests_()` şu davranışları denetler:

- `U+2060` temizliği,
- görünmez karakterli `Hisse`, `VeriZamani`, `Anlik` ve `EMA20_T0` anahtarlarının okunması,
- bütün kritik `_T0` teknik göstergelerinin runtime alanlarına aktarılması,
- `Degisim3Gun(%)_T0` seri metninin ilk sayısının okunması,
- doğrudan verilen kayıtlarda anahtar normalizasyonu.

Test kodu repository'ye eklenmiştir. Hedef Apps Script çalışma ortamında henüz çalıştırılmış sonuç iddiasında bulunulmamaktadır.

## Canlı dosya güvenliği

Bu çalışma sırasında Google Sheet başlıkları veya verileri değiştirilmemiştir. Fiziksel başlık temizliği ancak bütün legacy okuyucuların gölge çalışmada doğrulanmasından ve yedek alınmasından sonra ayrı bir migrasyon olarak değerlendirilmelidir.
