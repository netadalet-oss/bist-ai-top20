# Kaynak Sürüm Envanteri

## Referans kaynak

- Ad: `V_141225`
- Tür: Google Apps Script kaynak metni
- Kaynak Google Dokümanı: `10Ht3MGCgw3N5lvQveKFgdRH2YRxE3LSAThYkqU6NDAo`
- Kaynak satır sayısı: 7.285
- Kaynak boyutu: 244.287 bayt
- Revizyon başlığı: `2025-10-20 — Limitler kaldırıldı, tam tur zorlaması`

## Kullanım kuralı

Drive belgesi, monolit kaynak için değiştirilmeyen kanonik referanstır. Modüler taşıma sırasında her fonksiyon:

1. kaynak fonksiyon adı,
2. kaynak satır aralığı,
3. hedef modül,
4. yapılan düzeltme,
5. davranış değişikliği olup olmadığı

bilgileriyle izlenecektir.

## Taşıma durumu

| Alan | Durum | Hedef |
|---|---|---|
| Merkezi yapılandırma | Başlatıldı | `src/00_Config.gs` |
| Veri normalizasyonu | Başlatıldı | `src/01_DataNormalization.gs` |
| Veriler şeması | Başlatıldı | `src/02_SheetSchema.gs` |
| Kilit/durdurma güvenliği | Başlatıldı | `src/03_RuntimeSafety.gs` |
| API istemcisi | Bekliyor | `src/api/` |
| Teknik göstergeler | Bekliyor | `src/indicators/` |
| K1–K5 | Bekliyor | `src/models/` |
| K_Tarihsel | Bekliyor | `src/evaluation/` |
| S | Bekliyor | `src/selection/` |

Kaynak metnin tamamı, sonraki taşıma commitinde değiştirilmeyen `V_141225.original.gs` olarak depoya eklenecektir. Bu ilk commit, önce güvenli klasör ve modül sözleşmesini kurar.
