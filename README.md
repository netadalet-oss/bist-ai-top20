# Aurum BIST Top 20

BIST en çok yükselen Reel Top 20 adaylarını aynı gün veya bir sonraki işlem günü için önceden belirlemeye yönelik, kaynak kodu izlenebilir ve test edilebilir hâle getiren çalışma deposu.

## Aktif geliştirme

- Dal: `refactor/apps-script-foundation`
- Taslak PR: `#2`
- Roadmap: `docs/ROADMAP.md`

## Modüler Apps Script yapısı

```text
apps-script/src/
├── 00_Config.gs
├── 01_DataNormalization.gs
├── 02_SheetSchema.gs
├── 03_RuntimeSafety.gs
├── 04_DataContracts.gs
├── 05_ApiClient.gs
├── 06_VerilerRepository.gs
├── 07_Indicators.gs
└── 08_FeaturePipeline.gs
```

Test girişleri:

```javascript
runIndicatorTests_();
runFeaturePipelineTests_();
```

Eski monolit davranış üretimden hemen kaldırılmaz. Yeni modüller aynı ham veri üzerinde karşılaştırmalı olarak doğrulandıktan sonra çağrı noktaları aşamalı biçimde taşınır.
