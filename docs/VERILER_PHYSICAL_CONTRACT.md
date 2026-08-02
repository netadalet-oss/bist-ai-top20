# Veriler Fiziksel Grid Sözleşmesi

## Amaç

Bu belge, başlangıç hedefi kapsamında canlı `Veriler` sayfasının gerçek veri alanını fiziksel Google Sheets grid kapasitesinden ayırır. Amaç tablo okumasındaki belirsizliği kaldırmak; boş kapasiteyi aktif şema veya eski veri bloğu sanmamaktır.

## 2 Ağustos 2026 canlı doğrulaması

| Alan | Satır | Sütun | Son sütun |
|---|---:|---:|---|
| Fiziksel grid | 1.458 | 1.731 | BMM |
| Fiilen kullanılan veri alanı | 557 | 468 | QZ |
| Boş kapasite fazlası | 901 | 1.263 | RA:BMM |

Canlı okumada:

- `QZ` sütununda son kanonik başlık ve veri bulundu.
- `RA:SB` kontrol aralığında değer bulunmadı.
- 557. satırda son hisse kaydı bulundu.
- 558–1458 aralığında kontrol edilen alt bölge boştu.

Buna göre `Veriler` sayfasının fiilî sözleşmesi `A1:QZ557`, yani **557 × 468** olarak değerlendirilmelidir.

## Kaynak değerlendirmesi

Repository ve kaynak kod aramasında grid'i 1.731 sütuna veya 1.458 satıra çıkaran bir `insertColumnsAfter`, `insertRowsAfter`, `deleteColumns` ya da benzeri aktif işlem bulunmadı.

Bu bulgu, fazla alanın kod tarafından düzenli olarak üretilen ikinci bir veri şeması olduğuna dair kanıt bulunmadığını gösterir. En makul sınıflandırma, Google Sheets dosyasında kalmış boş fiziksel kapasitedir. Bu bir kesin tarihçe iddiası değildir; yalnız mevcut kod ve canlı içerik incelemesinin sonucudur.

## Yeni denetim

`VERILER_PHYSICAL_CONTRACT.audit()` şu ayrımı yapar:

- fiziksel satır/sütun sayısı,
- kullanılan satır/sütun sayısı,
- kanonik genişliğin 468 olup olmadığı,
- sağ ve alt overflow alanlarında içerik bulunup bulunmadığı,
- güvenli bir küçültme planı hazırlanıp hazırlanamayacağı.

`VERILER_PHYSICAL_CONTRACT.planTrim()` yalnız Google Sheets `deleteDimension` istek taslağı üretir. İstekleri çalıştırmaz.

## Güvenlik kuralı

Fiziksel küçültme ancak aşağıdaki koşulların tamamı sağlanırsa düşünülebilir:

1. Kanonik genişlik tam olarak 468 sütundur.
2. Son kullanılan sütun QZ'dir.
3. Son kullanılan satır yeniden doğrulanmıştır.
4. RA'dan sonraki bütün alan formül ve değer bakımından boştur.
5. Son kullanılan satırdan sonraki bütün alan formül ve değer bakımından boştur.
6. İşlem öncesinde çalışma kitabı yedeği alınmıştır.
7. Tarih ve hedef boyut içeren açık onay anahtarı verilmiştir.

Modül bu koşullardan biri sağlanmazsa planı bloke eder. Canlı Google Sheet üzerinde bu aşamada satır veya sütun silinmemiştir.

## S hedefi açısından etkisi

Bu ayrım doğrudan önemlidir:

- Runtime okuyucu yalnız `A:QZ` kanonik alanını kullanmalıdır.
- Başlık taraması 1.731 sütuna yayılmamalıdır.
- Boş sütunlar şema uyuşmazlığı veya eksik veri gibi değerlendirilmemelidir.
- Okuma süresi ve Apps Script bellek kullanımı fiziksel grid yerine kullanılan sözleşmeye göre sınırlandırılmalıdır.
