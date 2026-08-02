# Function Inventory — V_141225

- Source lines: **7285**
- Named function declarations: **280**
- Unique names: **260**
- Duplicate function names: **20**
- SHA-256: `c380b93c4804533e866e79bdd36b44683afbbb973a318e0716862ce7b0dbaa0a`

## Duplicate declarations

| Function | Lines | Risk |
|---|---:|---|
| `_lastValid_` | 1527, 1607 | Review — scope may be local or global |
| `betaSeries_` | 1581, 1665 | Review — scope may be local or global |
| `bollingerSeries_` | 1575, 1658 | Review — scope may be local or global |
| `buildQueuesByVeriZamani_` | 1348, 2647 | High — later declaration overrides earlier behavior |
| `colByRegex` | 3626, 6511 | Review — scope may be local or global |
| `colIdx` | 4019, 4113 | Review — scope may be local or global |
| `emaSeries_` | 1529, 1611 | Review — scope may be local or global |
| `findCol` | 1308, 3663 | Review — scope may be local or global |
| `getBaseUrl_` | 170, 3147 | High — later declaration overrides earlier behavior |
| `menu_DurdurVeTemizle` | 275, 3066 | High — later declaration overrides earlier behavior |
| `parseLevels_` | 5087, 6881 | Review — scope may be local or global |
| `pctChangeSeries_` | 1528, 1610 | Review — scope may be local or global |
| `readRow_` | 2479, 2645 | High — later declaration overrides earlier behavior |
| `rollingMean_` | 1563, 1646 | Review — scope may be local or global |
| `rollingReturn_` | 1595, 1679 | Review — scope may be local or global |
| `rollingStdev_` | 1544, 1627 | Review — scope may be local or global |
| `rowForSymbolIndex_` | 2478, 2646 | High — later declaration overrides earlier behavior |
| `rsiSeries_` | 1530, 1612 | Review — scope may be local or global |
| `todayLabelTR_` | 1066, 1109 | Review — scope may be local or global |
| `yenile_` | 2759, 2916 | High — later declaration overrides earlier behavior |

## Section index

| Line | Section |
|---:|---|
| 6 | [A] GENEL AYARLAR & KONFİG |
| 91 | [B] EVREN: SABİT SIRALI HİSSE LİSTESİ |
| 144 | [C] MENÜLER — Sade, Gruplu, Estetik + Kurulum |
| 261 | [CX] DURDUR / DEVAM / TEMİZLE |
| 370 | [D] TETİKLEYİCİLER — İstenen takvimle uyumlu |
| 527 | KS BLOKLARI İÇİN TAZELİK KONTROL YARDIMCILARI |
| 1015 | [E] ORTAK YARDIMCILAR & KORUMALI TANIMLAR |
| 1156 | Boş kalmaması için sayıyı 0’a çeviren yardımcı |
| 1163 | [F] VERİLER: BAŞLIK/PLAN ÜRETİMİ |
| 1295 | Veriler → sembol alanlarını hızlı okuma (cache) |
| 1343 | [G] KUYRUK & SAYFA YARDIMCILARI |
| 1409 | [F] VERİ ÇEKİMİ: Ham / Anlık / Türev |
| 1522 | Teknik / Türev yardımcıları |
| 1604 | [I] TEKNİK/TÜREV SERİLER |
| 1688 | [HOTFIX] Anlık veri fonksiyonu garanti tanımlı olsun |
| 1706 | [G] KAYIT HESAPLAMA: fetchAndCompute_ |
| 1720 | [G] KAYIT HESAPLAMA: fetchAndCompute_ |
| 2255 | [K] SATIR YAZIMI & BİÇİM |
| 2628 | [I] KUYRUK / DURUM / YARDIMCI |
| 2702 | [J] YÜKSEK HIZLI YAZIM |
| 2756 | [K] ANA AKIŞLAR — Sınırsız, tam tur |
| 2796 | [K] ANA AKIŞLAR — Tek seferde, toplu |
| 2982 | [L] MENÜ EYLEMLERİ |
| 3086 | [M] ANLIK API (MENÜ) |
| 3106 | Aktif Hisse Listesi Ayarı |
| 3144 | BASE_URL override (normal/tarihsel) |
| 3175 | KS BLOĞU — TEK PARÇA |
| 4697 | K1–K5 MODELLERİ |
| 5244 | K_Tarihsel |
| 6510 | S KRİTER YARIŞI |

## High-priority remediation order

1. Remove the stray `демон` identifier after `withKsLock_`.
2. Resolve global duplicate declarations that silently override earlier implementations.
3. Unify property keys for symbol scope, API configuration and halt state.
4. Make the active symbol universe explicit in every queue and row-index function.
5. Validate the 468-column `Veriler` contract before any read or write.
6. Move nested helper functions to module scope only when they are intentionally reusable.
7. Archive the exact source in immutable chunks and verify the combined SHA-256.

## Notes

This inventory is generated from the Drive source and records declaration locations. A duplicate name is not automatically a bug when declarations are nested in separate functions, but every global duplicate is a release blocker because Apps Script keeps the later declaration.