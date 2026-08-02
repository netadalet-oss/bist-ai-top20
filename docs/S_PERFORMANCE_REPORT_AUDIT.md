# S Performans Raporu

`S_Performans` sayfası `_Snapshots` ve `_SnapshotOutcomes` kayıtlarından yeniden üretilebilir bir rapordur.

## Üretilen özetler

- SAME_DAY_CLOSE
- NEXT_TRADING_DAY_CLOSE
- snapshot ve tahmin sayısı
- değerlendirilen kayıt ve veri kapsamı
- isabet sayısı
- Precision@20 ve Recall@20
- ortalama/medyan getiri
- isabet eden hisselerin ortalama getirisi
- ortalama MFE ve MAE

## Detay tablosu

Her S tahmini için snapshot kimliği, tahmin zamanı, seans, sıra, hisse, skor, giriş fiyatı, Top 20 sonucu, hedef fiyat, getiri, MFE/MAE, ilk Top 20 giriş bilgileri ve model sürümü gösterilir.

## Yenileme

```javascript
refreshSPerformanceReport_();
```

Rapor kaynak kayıtları değiştirmez. Sayfa her yenilemede tamamen yeniden oluşturulur; ölçümün gerçek kaynağı `_Snapshots` ve `_SnapshotOutcomes` tablolarıdır.

## Sınırlar

- Outcome kaydı oluşmamış tahminler veri yok olarak raporlanır.
- Recall@20 paydası her snapshot için 20 kabul edilir.
- İlk Top 20 giriş alanları outcome üreticisi bu değerleri kaydettiğinde doldurulur.
- Apps Script çalışma ortamındaki testler henüz çalıştırılmış değildir.
