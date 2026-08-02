# Temel Veri ve Kod Denetimi

## Amaç

Bu aşama K1–K5 veya S puanlama ağırlıklarını değiştirmez. Önce veri tabanının ve tablo katmanının doğru okunmasını sağlayan teknik temeli kurar.

## Tespit edilen kritik sorunlar

1. `withKsLock_` sonunda yabancı bir tanımlayıcı (`демон`) bulunması KS akışında `ReferenceError` üretebilir.
2. Aynı isimli fonksiyonlar (`yenile_`, `menu_DurdurVeTemizle`, `getBaseUrl_`, `getActiveSymbols_`) son tanımın önceki tanımı sessizce ezmesine yol açıyor.
3. Aynı ayar için birden fazla PropertiesService anahtarı kullanılıyor.
4. Sabit `SYMBOLS` listesi ile özel kullanıcı listesi bazı akışlarda karıştırılıyor; satır-simge eşleşmesi kayabilir.
5. Görünmez karakterler ve satır sonları başlık eşleşmesini bozabiliyor.
6. Türkçe sayı biçimleri `Number()` ile güvenilir biçimde okunamıyor.
7. `dd.MM.yyyy HH:mm:ss` metninin `new Date(text)` ile okunması çalışma ortamına bağlıdır.
8. Veriler sayfasındaki eski/artık sütunlar `getLastColumn()` sonucunu büyütüp şema haritasını bozabiliyor.
9. Biçimlendirme erteleme bayrakları hata durumunda açık kalabiliyor.
10. Tablo okuyucuları beklenen sütun genişliği yerine fiziksel son sütuna kadar veri okuyabiliyor.

## İlk modüler düzeltmeler

- `00_Config.gs`: tek yapılandırma ve tek özellik anahtarı kaynağı.
- `01_DataNormalization.gs`: başlık, sembol, sayı ve tarih normalizasyonu.
- `02_SheetSchema.gs`: 468 sütunluk beklenen Veriler şeması ve zarar vermeyen doğrulama.
- `03_RuntimeSafety.gs`: ortak kilit, durdurma ve `finally` güvenliği.

## Güvenlik ilkesi

Eski sütunlar veya kayıtlar otomatik olarak silinmeyecek. Önce `inspectVerilerSchema_()` raporu alınacak; ardından yedekleme ve açık bakım komutuyla temizlik yapılacaktır.

## Sonraki teknik işler

- Kaynak monolitin fonksiyon bazında modüllere taşınması.
- Mükerrer fonksiyonların statik analizle otomatik tespiti.
- Her tablo için zorunlu başlık sözleşmesi.
- Saf hesaplama fonksiyonlarının Apps Script servislerinden ayrılması.
- Snapshot veri modeli ve ileriye bakışsız performans ölçümü.
