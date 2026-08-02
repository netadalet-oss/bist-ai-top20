function runCalibrationDataAdapterTests_() {
  const snapshots = [{
    snapshotId:'s1',snapshotType:'S',predictionTs:'2026-01-02T07:00:00.000Z',featureTs:'2026-01-02T06:59:00.000Z',
    sessionDate:'2026-01-02',sessionKind:'SAME_DAY',model:'S',modelVersion:'v1',symbol:'AAA',rank:1,score:80,
    coverage:0.8,entryPrice:10,sourceModelsJson:'["K1","K5"]',
    payloadJson:JSON.stringify({raw:{components:{consensus:80,shortMomentum:70,liveStrength:60,volumeAcceleration:50,technicalStructure:75}}}),
    payloadHash:'x',createdTs:'2026-01-02T07:00:01.000Z'
  }];
  const outcomes = [{
    outcomeId:'o1',snapshotId:'s1',symbol:'AAA',horizon:'SAME_DAY',evaluationTs:'2026-01-02T15:10:00.000Z',
    top20Hit:1,top20Rank:7,targetPrice:10.8,returnPct:8,maxFavorablePct:10,maxAdversePct:-2,payloadJson:'{}',createdTs:'x'
  }];
  const out = CALIBRATION_DATA_ADAPTER.build({horizon:'SAME_DAY',snapshotRows:snapshots,outcomeRows:outcomes});
  if (out.exampleCount !== 1) throw new Error('Adapter exampleCount hatası.');
  if (!out.examples[0].top20Hit || out.examples[0].returnPct !== 8) throw new Error('Adapter outcome eşleme hatası.');
  if (out.examples[0].components.consensus !== 80) throw new Error('Adapter component okuma hatası.');
  Logger.log('CalibrationDataAdapter tests passed.');
  return true;
}
