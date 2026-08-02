# API ve Veriler Katmanı Denetimi

## Kaynak eşlemesi

| Eski fonksiyon | Kaynak satırları | Yeni modül |
|---|---:|---|
| `fetchRaw_` | 1412–1465 | `apps-script/src/05_ApiClient.gs` |
| `fetchRawMulti_` | 2028–2059 | `apps-script/src/05_ApiClient.gs` |
| `getCurrentPlan_` | 1261–1272 | `apps-script/src/06_VerilerRepository.gs` |
| `KS_readVerilerAsObjects_` | 3619–3829 | `apps-script/src/06_VerilerRepository.gs` |

## Bulunan maddi sorunlar

### 1. Tekli ve toplu API sözleşmeleri farklıydı

`fetchRaw_` şu yapıyı döndürüyordu:

```javascript
{ rows, dates, dateRaw }
```

`fetchRawMulti_` ise:

```javascript
{ SYMBOL: rows[] }
```

Bu farklılık, aynı verinin farklı çağrı yolunda farklı şekilde yorumlanmasına yol açıyordu.

Yeni istemcide her sembol için ortak sonuç sözleşmesi vardır:

```javascript
{
  ok,
  symbol,
  status,
  url,
  error,
  rows,
  dates,
  dateRaw
}
```

### 2. Toplu çağrıda HTTP durum kodu denetlenmiyordu

Eski toplu çağrı, HTTP 404/429/500 yanıtlarının gövdesini JSON gibi okumaya çalışıyordu. Yeni modül önce HTTP durumunu doğrular, sonra JSON ve `value[]` yapısını denetler.

### 3. URL fallback davranışı yalnız tekli istekte vardı

Tekli istek dört İş Yatırım URL varyasyonunu deniyordu. Toplu istek yalnız `BASE_URL` kullanıyordu. Yeni toplu istemci, başarısız sembolleri tekli fallback zincirinden yeniden geçirir.

### 4. Tarih sıralaması tekli ve toplu çağrıda farklıydı

Tekli istek satırları tarihe göre sıralarken toplu istek API sırasını olduğu gibi kullanıyordu. Yeni istemci her iki yolda da aynı tarih ayrıştırma ve sıralama işlemini uygular.

### 5. Geçersiz tarihlerin diziden atılması indeksleri kaydırıyordu

Eski tekli çağrıda:

```javascript
rows.map(...).filter(...)
```

kullanımı nedeniyle `dates[index]` ile `rows[index]` eşleşmesi bozulabiliyordu. Yeni sözleşme geçersiz tarih için `null` saklar; dizilerin indeksleri korunur.

## Veriler tablosu sorunları

### 1. Fiziksel sütun sayısı mantıksal şema sanılıyordu

`getLastColumn()` eski sütun kalıntıları yüzünden 468 yerine çok daha büyük bir değer döndürebilir. Yeni repository, son dolu mantıksal başlığı belirler ve yalnız bu genişlikte okuma yapar.

### 2. Eksik başlıklar sessiz fallback ile geçiliyordu

Yeni repository şu başlıkları zorunlu kabul eder:

- `Hisse`
- `VeriZamani`
- `Anlik`
- `AnlikDegisim%`
- `Kapanis_T0`
- `FiyatDegisim%_T0`

Eksik başlıkta işlem durur ve açık hata verir.

### 3. Mükerrer semboller ve satır kaymaları raporlanmıyordu

Yeni `auditVerilerRepository_()` fonksiyonu:

- mükerrer başlıkları,
- mükerrer sembolleri,
- aktif sembol sırası ile satır sırası farklarını,
- artık sütun sayısını

raporlar.

### 4. Yazma işlemi satır numarasına güveniyordu

Yeni `writeRowsBySymbol()` sembolü aktif evrendeki deterministik konumuna eşler; aktif evrende olmayan bir sembolü yazmayı reddeder.

## Geçiş planı

1. Yeni modülleri eski kodla yan yana yükle.
2. `auditVerilerRepository_()` çalıştır ve raporu sakla.
3. Tekli ve toplu API sonuçlarını örnek sembollerle karşılaştır.
4. Eski çağrıları sırasıyla `fetchRawV2_` ve `fetchRawMultiV2_` adaptörlerine geçir.
5. K1–K5 okumalarını `VERILER_REPOSITORY.readCanonicalMarketObjects()` üzerine taşı.
6. Sonuç eşitliği doğrulandıktan sonra eski fonksiyonları kaldır.

## Bilinçli kapsam sınırı

Bu aşama model skorlarını veya K1–K5/S seçim mantığını değiştirmez. Yalnız veri taşıma, ayrıştırma, doğrulama ve tablo erişim katmanını güvenilir hâle getirir.
