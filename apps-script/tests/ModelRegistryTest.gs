function runModelRegistryTests_() {
  const weights = {consensus:0.4,shortMomentum:0.2,liveStrength:0.2,volumeAcceleration:0.1,technicalStructure:0.1};
  const published = MODEL_REGISTRY.publish({
    horizon:'SAME_DAY',weights:weights,trainingStart:'2026-01-01',trainingEnd:'2026-02-01',foldCount:3,exampleCount:500,
    metrics:{meanPrecisionAt20:0.31},calibrationVersion:'WFC-1.0.0',notes:'test'
  });
  if (published.status !== 'CANDIDATE') throw new Error('Registry publish status hatası.');
  const active = MODEL_REGISTRY.activate('SAME_DAY', published.version);
  if (!active || active.version !== published.version) throw new Error('Registry activate hatası.');
  const sum = Object.keys(active.weights).reduce(function(s,k){ return s + Number(active.weights[k]); },0);
  if (Math.abs(sum - 1) > 1e-8) throw new Error('Registry ağırlık toplamı hatası.');
  Logger.log('ModelRegistry tests passed.');
  return true;
}
