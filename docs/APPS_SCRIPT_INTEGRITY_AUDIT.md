# Apps Script Bütünlük Denetimi

## Amaç

Bu denetim, modüler Apps Script projesinin çalışma zamanında gerekli global nesneleri, giriş fonksiyonlarını ve kritik yöntemleri yayımladığını doğrular. Google Sheet üzerinde okuma/yazma yapmaz, tetikleyici kurmaz ve ağ çağrısı çalıştırmaz.

## Çalıştırma

```javascript
auditAppsScriptIntegrity_();
```

Fail-closed doğrulama:

```javascript
assertAppsScriptIntegrity_();
```

Eksik bağımlılık varsa `AppsScriptIntegrityError` fırlatılır ve tam rapor `error.integrityReport` alanında bulunur.

## Denetlenen zincir

1. `VERILER_REPOSITORY.readAllObjects`
2. `RUNTIME_INPUT_ADAPTER.readFeatures`
3. `RUNTIME_DATA_QUALITY_GATE.enforce`
4. `RUNTIME_INPUT_ADAPTER.buildExpertResults`
5. `CONSENSUS_MODEL.build`
6. `buildRuntimeSSelection_`
7. `saveRuntimeSSelectionSnapshot_`

## Yükleme sırası ilkesi

Dosya adlarındaki `00_`–`39_` önekleri mimari bağımlılık yönünü belgeler. Kod doğruluğu belirli bir dosya değerlendirme sırasına dayandırılmaz. Global bağımlılıklar IIFE oluşturulurken çağrılmak yerine işlev çalıştırıldığı anda çözülür.

## Kapsam sınırı

Bu denetimin başarılı olması yalnız statik çalışma zamanı bütünlüğünü gösterir. Canlı `Veriler` kapsamının yeterli olduğunu, aktif model bulunduğunu veya snapshot üretiminin ekonomik olarak başarılı olacağını kanıtlamaz. Bu kontroller sırasıyla veri kalite kapısı, model registry ve outcome ölçüm katmanlarında yapılır.

## Test

```javascript
runAppsScriptIntegrityAuditTests_();
```
