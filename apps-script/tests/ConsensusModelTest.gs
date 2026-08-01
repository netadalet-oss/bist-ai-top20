function runConsensusModelTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error(message);
  }

  const input = {
    K1: [
      { symbol:'AAA', score:90, coverage:1, eligible:true, rank:1, modelVersion:'k1', featureTs:new Date('2026-01-01T09:00:00Z') },
      { symbol:'BBB', score:95, coverage:1, eligible:true, rank:2, modelVersion:'k1', featureTs:new Date('2026-01-01T09:00:00Z') }
    ],
    K2: [
      { symbol:'AAA', score:85, coverage:1, eligible:true, rank:1, modelVersion:'k2', featureTs:new Date('2026-01-01T09:01:00Z') },
      { symbol:'CCC', score:99, coverage:1, eligible:true, rank:2, modelVersion:'k2', featureTs:new Date('2026-01-01T09:01:00Z') }
    ],
    K3: [
      { symbol:'AAA', score:80, coverage:0.9, eligible:true, rank:1, modelVersion:'k3', featureTs:new Date('2026-01-01T09:02:00Z') },
      { symbol:'BBB', score:70, coverage:0.9, eligible:true, rank:2, modelVersion:'k3', featureTs:new Date('2026-01-01T09:02:00Z') }
    ],
    K4: [
      { symbol:'AAA', score:75, coverage:0.8, eligible:true, rank:1, modelVersion:'k4', featureTs:new Date('2026-01-01T09:03:00Z') }
    ]
  };

  const out = CONSENSUS_MODEL.build(input, { minModels:2, topN:20 });
  assert_(out.length === 2, 'Only AAA and BBB should satisfy minModels=2.');
  assert_(out[0].symbol === 'AAA', 'Four-model consensus should rank ahead of two-model consensus.');
  assert_(out[0].raw.modelCount === 4, 'AAA model count must be four.');
  assert_(out[0].coverage === 1, 'AAA model coverage must be 1.');
  assert_(out[0].featureTs.getTime() === new Date('2026-01-01T09:03:00Z').getTime(), 'Feature timestamp must be latest input timestamp.');
  assert_(out.every((x, i) => x.rank === i + 1), 'Ranks must be contiguous.');
  assert_(out.every(x => x.score >= 0 && x.score <= 100), 'Consensus scores must be bounded.');

  const singleAllowed = CONSENSUS_MODEL.build(input, { minModels:1, topN:20 });
  assert_(singleAllowed.some(x => x.symbol === 'CCC'), 'Single-model candidate should appear only when explicitly allowed.');

  Logger.log('ConsensusModelTest: OK');
  return true;
}
