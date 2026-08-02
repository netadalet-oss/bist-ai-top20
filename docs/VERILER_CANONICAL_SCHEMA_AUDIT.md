# Veriler Kanonik Şema Denetimi

## Canlı doğrulama — 2 Ağustos 2026

`BIST_SELECTION_PLATFORM_0.1.0_SHADOW_2026-07-24` çalışma kitabındaki `Veriler!A1:QZ557` alanı incelendi.

Kanonik genişlik 468 sütundur:

- 48 temel ve T0 sütunu,
- T1–T30 arasında her gün için 6 alan: fiyat değişimi, kapanış, minimum, maksimum, hacim ve hacim değişimi,
- T31–T90 arasında her gün için 4 alan: fiyat değişimi, kapanış, hacim ve hacim değişimi.

Toplam: `48 + (30 × 6) + (60 × 4) = 468`.

## Sonuçlar

- 468/468 başlık beklenen sırayla eşleşti.
- Eksik başlık bulunmadı.
- Mükerrer başlık bulunmadı.
- Beklenmeyen başlık bulunmadı.
- Yer değiştirmiş başlık bulunmadı.
- İncelenen veri satırlarında aynı sütun içinde metin/sayı türü karışması görülmedi.

## Unicode bulgusu

Canlı başlıkların tamamında karakterler arasına görünmez `U+2060 WORD JOINER` karakteri yerleştirilmiştir. Örneğin görsel olarak `Hisse` görünen hücrenin ham değeri karakterler arasında U+2060 içerir.

Bu durum kullanıcı arayüzünde görünmez; ancak doğrudan string eşitliği, başlık sözlüğü, JSON anahtar eşleme veya regex tabanlı ayrıştırmayı bozabilir.

Yeni `VERILER_CANONICAL_SCHEMA.normalizeHeader()` işlevi şu görünmez karakterleri kaldırır:

- U+200B–U+200D,
- U+2060,
- U+FEFF,
- satır sonları ve diğer boşluklar.

Fiziksel çalışma kitabındaki başlıklar bu aşamada değiştirilmemiştir. Runtime ve denetim kodu normalize edilmiş başlıkları kullanmalıdır.

## Eklenen denetim

`VERILER_CANONICAL_SCHEMA.audit(headers)` aşağıdaki kontrolleri döndürür:

- beklenen ve gerçek sütun sayısı,
- sıra uyumu,
- eksik ve beklenmeyen başlıklar,
- mükerrer başlıklar,
- konumsal uyuşmazlıklar,
- görünmez Unicode içeren başlık sayısı,
- normalizasyon sonrası kanonik geçerlilik.

Canlı çalışma kitabı denetimi için:

```javascript
auditVerilerCanonicalSchema_();
```

kullanılır.

## Güvenlik ilkesi

Başlıkların hücre içinde topluca yeniden yazılması bu aşamada önerilmez. Mevcut Apps Script ve formüllerin ham başlık biçimine bağımlı olma ihtimali vardır. Önce tüm okuyucuların merkezi normalizasyon işlevini kullandığı doğrulanmalı, ardından ayrı bir migrasyon ve geri alma planıyla fiziksel temizlik değerlendirilmelidir.
