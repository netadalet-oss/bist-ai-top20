# Sıralı Altı Kaynak Veri Zinciri

## Değişmez sıra

Her sembol için aşağıdaki kaynakların tamamı sırayla denenir:

1. `ISYATIRIM`
2. `ISYATIRIM_LIVE`
3. `YAHOO`
4. `YAHOO_QUOTE`
5. `BIGPARA`
6. `STOOQ`

Bir kaynağın başarısız olması zinciri durdurmaz. Başarılı veya başarısız bütün denemeler `attempts` alanına sıra numarası, süre, bar sayısı, canlı veri durumu ve hata mesajıyla yazılır.

## Kaynak görevleri

- `ISYATIRIM`: tarihsel fiyat, hacim ve temel veride birincil kaynak.
- `ISYATIRIM_LIVE`: İş Yatırım gün içi son fiyat kaynağı.
- `YAHOO`: günlük OHLCV, düzeltilmiş kapanış ve kurumsal aksiyon kaynağı.
- `YAHOO_QUOTE`: anlık fiyat ve temel oran tamamlayıcısı.
- `BIGPARA`: tarihsel, anlık ve temel veri tamamlayıcısı.
- `STOOQ`: günlük OHLCV son yedek kaynağı.

## Birleştirme önceliği

Alan öncelikleri kaynak sırasıyla aynıdır. Üst sıradaki kaynakta geçerli değer varsa alt sıradaki kaynak bu alanı ezemez. Üst kaynakta eksik alan varsa alt kaynak yalnız eksik alanı tamamlar.

Örnek:

- İş Yatırım kapanış ve hacim sağladıysa bunlar korunur.
- İş Yatırım açılış vermediyse Yahoo açılışı tamamlayabilir.
- Düzeltilmiş kapanış Yahoo’dan alınabilir.
- İş Yatırım Live geçerli canlı fiyat verdiyse Yahoo Quote veya Bigpara canlı fiyatı bunun üzerine yazamaz.

Her gün ve alan için kaynak bilgisi `lineage.bars[date][field]` içinde tutulur. Temel veri kaynakları `lineage.fundamentals`, canlı fiyat kaynağı `lineage.live` altında saklanır.

## Çıktı uyumluluğu

Yeni zincir mevcut `BIST_API.fetchOne()` ve `BIST_API.fetchMany()` arayüzlerinin yerine geçer. Tarihsel satırlar aşağıdaki uyumlu alanlarla döner:

- `HGDG_TARIH`
- `HGDG_ACILIS`
- `HGDG_MAX`
- `HGDG_MIN`
- `HGDG_KAPANIS`
- `HGDG_DUZELTILMIS_KAPANIS`
- `HGDG_HACIM`
- `HGDG_ADET`
- `HGDG_AOF`
- `DOLAR_BAZLI_AOF`
- `HG_AOF`

Bu nedenle mevcut özellik üretim ve model zinciri aynı API arayüzünü kullanmaya devam eder.

## Operasyonel sınır

Altı kaynak × bütün semboller yüksek sayıda HTTP isteği oluşturur. Apps Script çalışma süresi kotası nedeniyle üretim scheduler'ı sembol gruplarını oturumlar arasında bölerek çalıştırmalıdır. Kaynak sırası veya alan önceliği performans gerekçesiyle değiştirilemez.

## Test

`runSequentialProviderChainTests_()` sıralamayı, alan önceliğini, lineage bilgisini, canlı fiyat önceliğini ve Stooq CSV ayrıştırmasını kontrol eder.

Ağ uçlarının canlı erişimi ve güncel payload şemaları hedef Apps Script ortamında ayrıca doğrulanmalıdır.
