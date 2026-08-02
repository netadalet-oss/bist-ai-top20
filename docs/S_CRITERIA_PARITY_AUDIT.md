# S Kriter Yarışı ve Modüler S Karşılaştırması

## Kapsam

Kaynak: Drive belgesindeki `S_KriterYarisi()` bölümü. Hedef: `apps-script/src/16_SSelectionEngine.gs`.

Bu denetim yalnız başlangıç hedefini esas alır: bir hissenin S'ye girişinden sonra aynı gün veya ertesi işlem günü Reel Top 20'ye girme başarısını ve giriş sonrası getiriyi doğru ölçmek.

## Legacy akışın kritik sorunları

1. **Bugünkü listeyle geçmişe bakış:** Güncel K1-K5 TopN listeleri T1-T30 getirileri üzerinde yeniden puanlanır. Bu, tarihsel tahmin snapshot'ı değildir; seçimden sonra bilinen mevcut listeyi geçmişte başarılıymış gibi değerlendirebilir.
2. **Sabit koltuk dağıtımı:** Her K modeline en az bir koltuk verilir. Daha zayıf modelin adayı, daha güçlü başka bir adayın önüne geçebilir.
3. **Okuma sırası kaynak ataması:** Aynı sembol K1-K5'te varsa ilk görülen K altında tutulur; çoklu model desteği kaybolur.
4. **Göreli model min-max:** Yalnız beş model karşılaştırıldığı için tüm modeller kötü olsa da göreli lider yüksek puan alabilir.
5. **Tek günlük şampiyon ödülü:** En iyi tek gün scoreK içinde ayrıca ödüllendirilir ve tesadüfi sıçramayı kalıcı kalite gibi gösterebilir.
6. **Eksik listede ağırlık kaybı:** TopN'den az geçerli satır varsa sıra ağırlıkları yeniden normalize edilmez; veri eksikliği performansla karışır.
7. **Sessiz sıfır fallback:** K_Tarihsel okuma hatası bütün model değerlerini sıfıra çevirir ve üretim devam eder.
8. **Destek seçimi ters:** Fiyat altındaki en uzak destek seçilir ve daha büyük mesafe daha yüksek puan üretir.
9. **Direnç ölçümü yanıltıcı:** Fiyat üstündeki yakın direnç yerine yalnız fiyat altında kırılmış en az iki direnç aranır.
10. **Sabit 50 puan enflasyonu:** Bütün destek/direnç değerleri aynı olduğunda min-max 50 üretir; sıralama bilgisi sağlamadığı hâlde FinalScore seviyesini yükseltir.
11. **Giriş fiyatı reseti:** `Maliyet` çalıştırma anındaki `Anlik` fiyata eşitlenir; aynı satırdaki `Getiri` doğal olarak sıfır olur. Sonraki yenilemeler ilk giriş fiyatını korumaz.
12. **Fiziksel grid okuması:** `getLastColumn()` nedeniyle kanonik 468 sütun yerine boş grid kapasitesi de okunabilir.

## Modüler kararlar

- Sabit K koltukları kaldırıldı; tek aday havuzu kullanılır.
- SAME_DAY ve NEXT_DAY skorları ayrıdır.
- En az iki uzman model desteği ve veri kapsamı şartı vardır.
- Giriş fiyatı değişmez snapshot içinde sabitlenir.
- Geçmiş başarı yalnız tahmin anındaki snapshot ile sonraki outcome eşleştirilerek ölçülür.
- Destek/direnç kriterleri, yönü ve ekonomik katkısı walk-forward ile doğrulanana kadar varsayılan S skoruna alınmaz.
- Eksik bileşenler sıfır sayılmaz; mevcut ağırlıklar üzerinde yeniden normalize edilir.

## Çekirdek düzeltme

`MODEL_CORE.finite()` ve `S_SELECTION_ENGINE` sayısal dönüştürücüsü artık `null`, boş metin ve yalnız boşluk içeren metni geçerli sıfır saymaz. Gerçek `0` değeri geçerli kalır.

Sürümler:

- `MODEL_CORE` sonuç sürümü: `2.0.1`
- `S_SELECTION_ENGINE`: `S-SELECT-1.0.1`

## Çalıştırma

```javascript
auditSCriteriaParity_();
runSCriteriaParityAuditTests_();
```

## Sınır

Bu denetim Apps Script hedef ortamında henüz çalıştırılmamıştır. Canlı Sheet, S sayfası, formüller ve tetikleyiciler değiştirilmemiştir.
