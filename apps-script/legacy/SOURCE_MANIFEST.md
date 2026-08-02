# Kaynak Sürüm Envanteri

## Referans kaynak

- Ad: `V_141225`
- Tür: Google Apps Script kaynak metni
- Kaynak Google Dokümanı: `10Ht3MGCgw3N5lvQveKFgdRH2YRxE3LSAThYkqU6NDAo`
- Kaynak satır sayısı: 7.285
- Kaynak boyutu: 244.287 bayt
- SHA-256: `c380b93c4804533e866e79bdd36b44683afbbb973a318e0716862ce7b0dbaa0a`
- Revizyon başlığı: `2025-10-20 — Limitler kaldırıldı, tam tur zorlaması`

## Kullanım kuralı

Drive belgesi ve SHA-256 değeri monolit kaynak için değiştirilmeyen kanonik referanstır. Monolit, modüler Apps Script projesine birlikte yüklenmez; yalnız karşılaştırma ve kaynak izleme amacıyla tutulur.

Her taşınan kritik davranış:

1. kaynak fonksiyon veya bölüm adı,
2. hedef modül,
3. yapılan düzeltme,
4. davranış değişikliği,
5. test ve denetim sözleşmesi

bilgileriyle izlenir.

## Güncel taşıma durumu

| Alan | Durum | Hedef |
|---|---|---|
| Merkezi yapılandırma | Modüler | `src/00_Config.gs` |
| Veri normalizasyonu | Modüler | `src/01_DataNormalization.gs` |
| Veriler şeması ve repository | Modüler | `src/02_SheetSchema.gs`, `src/06_VerilerRepository.gs` |
| Kilit/durdurma güvenliği | Modüler | `src/03_RuntimeSafety.gs`, `src/21_SchedulerAndMaintenance.gs` |
| API istemcisi | Modüler temel | `src/05_ApiClient.gs` |
| Teknik göstergeler | Modüler | `src/07_Indicators.gs` |
| Özellik üretimi | Modüler | `src/08_FeaturePipeline.gs`, `src/23_RuntimeInputAdapter.gs` |
| K1–K4 | Modüler | `src/09_ModelCore.gs`, `src/10_ExpertModels.gs` |
| K5 | Modüler | `src/11_ConsensusModel.gs` |
| K_Tarihsel karşılığı | Modüler | `src/12_SnapshotStore.gs`–`src/15_FirstTop20Entry.gs` |
| S seçim motoru | Modüler | `src/16_SSelectionEngine.gs`, `src/20_RuntimeModelBinding.gs` |
| Walk-forward ve model registry | Modüler | `src/17_WalkForwardCalibration.gs`–`src/20_RuntimeModelBinding.gs` |
| Scheduler ve çalışma günlüğü | Modüler | `src/21_SchedulerAndMaintenance.gs`, `src/38_RunLogQualityIntegration.gs` |
| Canlı şema ve kalite denetimleri | Modüler | `src/32_LiveWorkbookContractAudit.gs`–`src/39_AppsScriptIntegrityAudit.gs` |
| Legacy fonksiyon geçiş denetimi | Modüler | `src/40_LegacyFunctionMigrationAudit.gs` |

## Bilinçli sınırlar

- 280 bildirimdeki 260 benzersiz fonksiyonun tamamı birebir taşınmış sayılmaz.
- Üretim zincirini etkileyen kritik fonksiyonlar ve global çakışmalar önceliklendirilmiştir.
- Kaynak monolitin tam metni bu repository dalında çalıştırılabilir proje dosyası olarak tutulmaz.
- Gerçek Apps Script çalışma ortamındaki testler ve gölge çalışma sonuçları ayrıca doğrulanmalıdır.

## İlgili denetimler

- `docs/FUNCTION_INVENTORY.md`
- `docs/LEGACY_FUNCTION_MIGRATION_AUDIT.md`
- `apps-script/src/39_AppsScriptIntegrityAudit.gs`
- `apps-script/src/40_LegacyFunctionMigrationAudit.gs`
