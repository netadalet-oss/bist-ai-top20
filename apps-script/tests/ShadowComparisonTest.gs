function runShadowComparisonTests_() {
  const legacy = [
    { symbol: 'AAA', rank: 1 },
    { symbol: 'BBB', rank: 2 },
    { symbol: 'CCC', rank: 3 }
  ];
  const modern = [
    { symbol: 'BBB', rank: 1 },
    { symbol: 'CCC', rank: 2 },
    { symbol: 'DDD', rank: 3 }
  ];
  const out = compareLegacyAndNewS_(legacy, modern);
  if (out.overlap.length !== 2) throw new Error('Overlap count yanlış.');
  if (out.legacyOnly.length !== 1 || out.legacyOnly[0] !== 'AAA') throw new Error('Legacy-only yanlış.');
  if (out.newOnly.length !== 1 || out.newOnly[0] !== 'DDD') throw new Error('New-only yanlış.');
  if (Math.abs(out.overlapRate - 2/3) > 1e-9) throw new Error('Overlap rate yanlış.');
  const bbb = out.rankDiff.filter(function(x){ return x.symbol === 'BBB'; })[0];
  if (!bbb || bbb.delta !== -1) throw new Error('Rank delta yanlış.');
  Logger.log('ShadowComparison tests passed.');
  return true;
}
