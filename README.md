# Aurum BIST Top 20

BIST hisselerinde aynı gün veya sonraki işlem günü Reel Top 20 adaylarını önceden tespit etmeye yönelik modüler araştırma ve uygulama projesi.

## Aktif geliştirme dalı

`refactor/apps-script-foundation`

## Modüller

- `apps-script/src/00_Config.gs` — merkezi yapılandırma
- `apps-script/src/01_DataNormalization.gs` — sayı, tarih, sembol ve başlık normalizasyonu
- `apps-script/src/02_SheetSchema.gs` — Veriler tablo şeması
- `apps-script/src/03_RuntimeSafety.gs` — kilit, durdurma ve güvenli çalışma
- `apps-script/src/04_DataContracts.gs` — veri sözleşmeleri
- `apps-script/src/05_ApiClient.gs` — tarihsel API istemcisi
- `apps-script/src/06_VerilerRepository.gs` — sembol bazlı Veriler repository
- `apps-script/src/07_Indicators.gs` — saf teknik göstergeler
- `apps-script/src/08_FeaturePipeline.gs` — kanonik özellik üretim hattı
- `apps-script/src/09_ModelCore.gs` — normalizasyon, kapsam ve sıralama çekirdeği
- `apps-script/src/10_ExpertModels.gs` — K1–K4 uzman modelleri

## Temel ilkeler

- Tahmin anından sonraki veri özelliklerde kullanılamaz.
- Geçmiş snapshot sonradan değiştirilemez.
- Eksik veri gerçek sıfır skor gibi yorumlanamaz.
- Model sürümü, veri şeması ve kaynak sürümü izlenebilir olmalıdır.
- Eski davranışlar karşılaştırma amacıyla açıkça `legacy` olarak ayrılır.
