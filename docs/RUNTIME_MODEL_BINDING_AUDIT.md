# Runtime Model Binding Audit

## Amaç

`_ModelRegistry` içindeki aktif SAME_DAY ve NEXT_DAY ağırlıklarını çalışma anında S seçim motoruna bağlamak; kullanılan model sürümü ve kaynak hash bilgisini değişmez snapshot kaydına taşımak.

## Çalışma akışı

```text
_ModelRegistry
   ├─ ACTIVE SAME_DAY
   └─ ACTIVE NEXT_DAY
          ↓
RUNTIME_MODEL_BINDING.resolve()
          ↓
S_SELECTION_ENGINE.select()
          ↓
Model sürümleriyle süslenmiş S sonuçları
          ↓
SNAPSHOT_STORE.appendPredictionBatch()
```

## Fallback politikası

Aktif model yoksa varsayılan davranış açıkça tanımlıdır:

- `strict: false`: ilgili horizon için `S_SELECTION_ENGINE.defaults` kullanılır.
- `strict: true`: işlem durdurulur ve aktif model eksikliği hata üretir.

Fallback kullanımı sonuçlarda ve denetim raporunda `DEFAULT` olarak işaretlenir. Varsayılan ağırlıklar kalibre edilmiş model gibi sunulmaz.

## Snapshot izlenebilirliği

Her S sonucu aşağıdaki alanları taşır:

```text
runtimeBindingVersion
sameDayModelVersion
nextDayModelVersion
sameDayModelSource
nextDayModelSource
modelSources.sameDay.registryId
modelSources.sameDay.sourceHash
modelSources.nextDay.registryId
modelSources.nextDay.sourceHash
```

Böylece daha sonra bir snapshot sonucunun hangi aktif model sürümleriyle üretildiği kesin olarak belirlenebilir.

## Güvenlik kuralları

1. Registry ağırlıkları beklenen bileşen anahtarlarına göre normalize edilir.
2. Negatif veya pozitif toplam üretmeyen ağırlıklar reddedilir.
3. SAME_DAY ve NEXT_DAY modelleri birbirinden bağımsız çözülür.
4. Runtime bağlayıcısı `S_SELECTION_ENGINE.defaults` nesnesini değiştirmez.
5. Aktif model otomatik değiştirilmez; yalnız registry aktivasyon işlemi üretim sürümünü belirler.
6. Snapshot model sürümü, iki horizon sürümü ve runtime binding sürümünün birleşimidir.

## Kullanım

```javascript
const selected = buildRuntimeSSelection_({
  horizon: 'COMBINED',
  modelResults: modelResults,
  features: features,
  bindingOptions: { strict: false }
});
```

Doğrudan değişmez snapshot yazmak için:

```javascript
const saved = saveRuntimeSSelectionSnapshot_({
  horizon: 'SAME_DAY',
  predictionTs: new Date(),
  sessionKind: 'SAME_DAY_EARLY',
  modelResults: modelResults,
  features: features,
  bindingOptions: { strict: true }
});
```

Denetim:

```javascript
auditRuntimeModelBinding_({ strict: false });
```

## Bilinçli sınırlar

- Registry’de aktif model bulunması, modelin ekonomik olarak başarılı olduğunu garanti etmez.
- Aktivasyon öncesi dokunulmamış dönem ve gölge çalışma doğrulaması operasyonel olarak ayrıca uygulanmalıdır.
- Testler Apps Script çalışma ortamında manuel çalıştırılmalıdır.
