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
- [x] K5 konsensüs modeli
- [x] Değişmez K/S snapshot deposu
- [x] K_Tarihsel hedef etiketleme çekirdeği
- [x] K_Tarihsel ölçüm ve raporlama
- [x] S aday seçimi ve snapshot entegrasyonu
- [x] Walk-forward kalibrasyon çekirdeği
- [x] Snapshot/outcome kalibrasyon veri adaptörü
- [x] Sürümlü model registry
- [x] Aktif model ağırlıklarını S runtime seçimine bağlama
- [x] Erken/orta seans ve kapanış snapshot zamanlayıcı altyapısı
- [x] Güvenli denetim ve bakım komutları
- [x] S performans rapor sayfası
- [x] Üretim girdisi adaptörü
- [x] Uçtan uca gölge liste karşılaştırma altyapısı
- [x] Gölge kollar için ayrı giriş fiyatı ve ortak outcome deneyi
- [x] Gölge kollar için ham barlardan ayrı MFE/MAE hesaplama
- [x] Merkezi BIST işlem günü ve yarım gün takvim sözleşmesi
- [x] İşlem maliyeti, makas, kayma ve likidite modeli
- [x] Fold bootstrap güven aralığı ve ağırlık kararlılığı analizi

## Faz 3 — Doğru hedef ve snapshot sistemi

- [x] Tahmin ile gerçekleşen sonucu ayrı tablolarda sakla.
- [x] Aynı snapshot kimliğinin yeniden yazılmasını engelle.
- [x] `featureTs <= predictionTs` veri sızıntısı kontrolü uygula.
- [x] Tahmin payload'ını SHA-256 ile doğrulanabilir yap.
- [x] Gün sonu ve ertesi işlem günü outcome üreticisini ekle.
- [x] Reel Top 20 tanımından sabit `%15` filtresini kaldır.
- [x] Veri kalite dışlamalarını açık neden koduna bağla.
- [x] S snapshot'ında giriş fiyatını sabitle.
- [x] Snapshot'a kullanılan SAME_DAY/NEXT_DAY registry sürüm ve hash bilgisini yaz.
- [x] Aynı işlem günü/session/horizon için mükerrer başarılı snapshot'ı engelle.
- [x] Erken seans snapshot oturumlarını adlandır ve zamanlayıcı tanımlarını sabitle.
- [x] Legacy ve yeni gölge kolların giriş fiyatlarını ayrı sabitle.
- [x] Resmi BIST işlem günü/tatil takvimini merkezi sağlayıcıya bağla.
- [ ] Resmi sayfa yenileme ayrıştırıcısını hedef Apps Script ortamında doğrula ve izle.

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
same_day_model_version
next_day_model_version
model_source_hashes
```

Sonuçlar tahmin kaydını değiştirmeden sonradan eklenir.

## Faz 4 — Ölçüm

- [x] Precision@20
- [x] Recall@20
- [x] Aynı gün ve ertesi gün isabet etiketleri
- [x] Girişten hedef kapanışına getiri
- [x] Ortalama, medyan ve çeyrek getiri dağılımı
- [x] Maksimum olumlu ve olumsuz hareket
- [x] Veri kapsamı ve eksik veri ayrımı
- [x] Model, hisse ve seans bazında örneklem sayısı
- [x] Top 20'ye ilk giriş anı ve o ana kadarki getiri
- [x] Kronolojik train/test fold raporları
- [x] Scheduler çalışma durumu, mükerrer atlama ve hata run-log kaydı
- [x] S performans özet ve hisse bazlı detay raporu
- [x] Legacy/yeni S sembol örtüşmesi ve sıra farkı raporu
- [x] Legacy/yeni S için ortak outcome üzerinden Precision ve getiri farkı
- [x] Legacy/yeni S için kol giriş fiyatına göre MFE/MAE farkı
- [x] Brüt/net getiri ve likidite kapsamı ayrımı
- [x] Bootstrap güven aralıkları ve fold/ağırlık kararlılığı raporu

## Faz 5 — Formül iyileştirme

- [x] Eksik veride ağırlıkları mevcut bileşenlere göre yeniden normalize et.
- [x] K3 pencere seçimini hisse bazında yap.
- [x] K5'i gerçek model kapsamı ve sıralama tutarlılığına bağla.
- [x] S'de sabit koltuk dağıtımını kaldır.
- [x] Aynı gün ve ertesi gün S skorlarını ayır.
- [x] Aynı gün ve ertesi gün için veri sızıntısız ağırlık arama altyapısı kur.
- [x] Kalibre edilmiş ağırlıkları aday/aktif/emekli durumlarıyla sürümlü model kaydına bağla.
- [x] Aktif registry ağırlıklarını runtime sırasında otomatik uygula.
- [x] İşlem maliyeti, likidite ve kayma etkisini ekonomik amaç fonksiyonuna ekle.
- [x] Fold kararlılığı ve bootstrap güven aralıkları ekle.
- [ ] Gerçek snapshot birikimiyle uzman modelleri ayrı hedefler için kalibre et.
- [ ] Gerçek gerçekleşme verisiyle maliyet ve piyasa etkisi katsayılarını kalibre et.

## Faz 6 — Uygulama katmanı

- Apps Script adaptörü
- Bağımsız TypeScript/Python hesaplama çekirdeği
- Zaman serisi veri tabanı
- Backtest ve walk-forward doğrulama
- API ve web arayüzü
- Alarm ve raporlama modülü
