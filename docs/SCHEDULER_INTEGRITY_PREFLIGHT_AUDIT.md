# Scheduler Integrity Preflight Audit

## Amaç

Snapshot zamanlayıcısının `Veriler` sayfasını okumadan önce modüler Apps Script çalışma zamanının bütünlüğünü doğrulaması.

## Çalışma sırası

1. İşlem günü ve mükerrer başarılı çalışma kontrolü yapılır.
2. `APPS_SCRIPT_INTEGRITY_AUDIT.assertValid()` çağrılır.
3. Eksik global, yöntem veya kırık runtime zinciri varsa çalışma durur.
4. `buildRuntimeInputs_()` çağrılmaz; dolayısıyla `Veriler` okunmaz.
5. Hata `_RunLog` tablosuna `FAILED_INTEGRITY` olarak kaydedilir.

## Kayıt alanları

Mevcut geriye uyumlu run-log sütunları kullanılır:

- `errorType`: `AppsScriptIntegrityError`
- `reasonCodes`: `INTEGRITY_CHECK_FAILED`, `MISSING_SYMBOLS`, `MISSING_METHODS`, `BROKEN_RUNTIME_CHAIN`
- `qualityFields`: eksik sembol, yöntem ve kırık zincir adları
- `qualityReportJson`: tam bütünlük raporu

Alan adlarındaki `quality` ifadesi eski şemayla geriye uyumluluk içindir; bütünlük raporları da aynı yapılandırılmış hata sütunlarında saklanır.

## Fail-closed davranış

Bütünlük denetleyicisinin kendisi bulunamazsa sistem devam etmez. `APPS_SCRIPT_INTEGRITY_AUDIT` ve `assertValid` eksikliği ayrı bir `AppsScriptIntegrityError` raporuna dönüştürülür.

## Açık bypass

Yalnız kontrollü teşhis için:

```javascript
integrityOptions: {
  enabled: false,
  bypassReason: 'MANUAL_DIAGNOSTIC_ONLY'
}
```

Bypass sessiz değildir ve dönen runtime girdisine bütünlük bilgisi eklenir. Üretim tetikleyicilerinde kullanılmamalıdır.

## Sınırlar

Bu katman canlı verinin doğruluğunu kanıtlamaz. Statik/global bütünlük başarılı olduktan sonra ayrıca veri kalite kapısı çalışır.
