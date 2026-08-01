# Aurum BIST Top 20

BIST hisselerinin aynı gün veya sonraki işlem gününde gerçek yükselenler Top 20 listesine girme olasılığını ölçmek ve geliştirmek için kurulan modüler araştırma ve uygulama deposu.

## Çalışma ilkeleri

- Drive'daki mevcut Apps Script kaynak kodu, değiştirilmeyen referans kaynaktır.
- Yeni geliştirmeler `apps-script/src` altında küçük ve test edilebilir modüller halinde yürütülür.
- Her maddi değişiklik ayrı dal ve pull request ile izlenir.
- Tahmin anı ile sonuç anı ayrılır; ileriye bakış ve geçmişi yeniden yazma yasaktır.
- Veri şeması, sayı/tarih dönüşümü ve tablo senkronizasyonu model formüllerinden önce doğrulanır.

## Dizinler

```text
apps-script/src/       Google Apps Script modülleri
apps-script/legacy/    Kaynak sürüm envanteri ve taşıma notları
docs/                  Mimari, denetim ve geliştirme planı
tests/                 Saf fonksiyon ve şema testleri
```

## Aktif geliştirme dalı

`refactor/apps-script-foundation`

Bu dalın ilk kapsamı, veri tabanının doğru okunmasını engelleyen biçimsel, sözdizimsel, başlık, sütun, sayı, tarih, kilit ve yapılandırma hatalarını ayıklamaktır. K1–K5 ve S model ağırlıkları bu temel güvenilir hale geldikten sonra revize edilecektir.
