# K5 Konsensüs Modeli Denetimi

## Kaynak davranışı

Monolit `KS_build_K5` K1–K4 sayfalarının ilk 14 sütununu okur, aynı sembolün skorlarını toplar ve yalnız aritmetik ortalamayı K5 skoru olarak kullanır.

## Tespit edilen sorunlar

1. Model sayısı (`K_Adet`) açıklama alanında bulunmasına rağmen K5 sıralamasını etkilemez.
2. Bir modelde çok yüksek skor alan tekil aday, dört modelde düzenli destek alan adayın önüne geçebilir.
3. K1–K4 skorlarının dağılımları farklı olmasına rağmen ham skorlar doğrudan ortalanır.
4. Fiyat, maliyet, getiri, destek ve direnç alanları sembolün ilk görüldüğü sayfadan alınır; sonuç model sayfası dolaşım sırasına bağlıdır.
5. K sayfaları arasındaki zaman farkı ve model sürümü kaydedilmez.
6. Tek modelde bulunan adaylar da K5 listesine girebilir; gerçek konsensüs zorunluluğu yoktur.

## Yeni model

`CONSENSUS_MODEL` doğrudan standart K1–K4 sonuç nesnelerini tüketir. Sayfa metni okumaz.

Başlangıç formülü:

```text
%35 ortalama normalize model skoru
%30 model kapsamı
%20 en düşük model skoru
%10 ortalama sıra yüzdeliği
%5  skor tutarlılığı
```

Eksik bileşen varsa mevcut ağırlıklar yeniden normalize edilir. Varsayılan olarak en az iki uzman model desteği gerekir.

## Sonuç sözleşmesi

K5 sonucu diğer modellerle aynı üst sözleşmeyi taşır ve ayrıca:

- model sayısı,
- model adları,
- model bazlı skorlar,
- model sürümleri,
- ortalama giriş coverage,
- skor uyuşmazlığı/tutarlılığı

alanlarını içerir.

## Kanonik piyasa verisi

K5 içinde fiyat, maliyet, getiri veya destek/direnç kopyalanmaz. Bu alanlar, K5 sıralaması tamamlandıktan sonra aynı sembolün ortak özellik kaydından veya değişmez snapshot kaydından birleştirilmelidir.

## Bilinçli sınır

Ağırlıklar henüz hedef etiketiyle kalibre edilmemiş başlangıç ağırlıklarıdır. Değişmez snapshot ve walk-forward doğrulama tamamlandıktan sonra yalnız eğitim penceresinde optimize edilmelidir.
