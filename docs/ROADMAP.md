# Geliştirme Yol Haritası

## Faz 0 — Kaynak koruma ve izlenebilirlik

- Drive kaynak sürümünü değiştirilmeyen referans olarak kaydet.
- Her çalışma dalında sürüm, tarih ve kaynak SHA-256 bilgisi tut.
- Değişiklikleri doğrudan `main` yerine pull request üzerinden yürüt.

## Faz 1 — Veri bütünlüğü

- Veriler şemasını 468 sütunluk sözleşmeye bağla.
- Başlık, sayı, tarih ve sembol normalizasyonunu tekleştir.
- Eski sütunları raporla; yedekleme sonrası açık bakım komutuyla ayıkla.
- API yanıtlarını şema doğrulamasından geçir.
- Kurumsal aksiyon ve anormal fiyat değişimi kontrolü ekle.

## Faz 2 — Monolitten modüler yapıya geçiş

- [x] API istemcisi
- [x] Teknik gösterge hesapları
- [x] Özellik üretim hattı
- [x] Tablo şemaları ve yazıcı altyapısı
- [x] K1, K2, K3, K4 ortak model sözleşmesi ve uzman model çekirdeği
- [ ] K5 konsensüs modeli
- [ ] K_Tarihsel snapshot ve değerlendirme
- [ ] S aday seçimi ve performans izleme
- [ ] Zamanlayıcılar ve bakım komutları

## Faz 3 — Doğru hedef ve snapshot sistemi

Her S üretiminde değişmez kayıt:

```text
snapshot_id
prediction_ts
feature_ts
symbol
rank
entry_price
same_day_score
next_day_score
source_models
model_version
```

Sonuçlar tahmin kaydını değiştirmeden sonradan eklenir.

## Faz 4 — Ölçüm

- Precision@20
- Recall@20
- aynı gün ve ertesi gün isabetleri
- girişten Top 20 anına getiri
- gün sonu ve ertesi gün kapanış getirisi
- maksimum olumlu ve olumsuz hareket
- model ve hisse bazında örneklem sayısı

## Faz 5 — Formül iyileştirme

- [x] Eksik veride ağırlıkları mevcut bileşenlere göre yeniden normalize et.
- [x] K3 pencere seçimini hisse bazında yap.
- [ ] Skorları gerçek hedef verisiyle ortak ölçeğe kalibre et.
- [ ] K5'i gerçek model kapsamı ve sıralama tutarlılığına bağla.
- [ ] S'de sabit koltuk dağıtımını kaldır.
- [ ] Aynı gün ve ertesi gün modellerini ayır.

## Faz 6 — Uygulama katmanı

- Apps Script adaptörü
- Bağımsız TypeScript/Python hesaplama çekirdeği
- Zaman serisi veri tabanı
- Backtest ve walk-forward doğrulama
- API ve web arayüzü
- Alarm ve raporlama modülü
