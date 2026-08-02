function runFirstTop20EntryTests_() {
  const predictionTs = '2026-07-22T07:00:00.000Z';
  const snapshotRows = [
    { snapshotId: 's1', symbol: 'AAA', predictionTs: predictionTs, entryPrice: 100 },
    { snapshotId: 's1', symbol: 'ZZZ', predictionTs: predictionTs, entryPrice: 50 }
  ];

  const bars = [];
  for (let minute = 1; minute <= 3; minute++) {
    for (let i = 0; i < 25; i++) {
      const symbol = i === 21 ? 'AAA' : ('S' + ('00' + i).slice(-2));
      let ret = 30 - i;
      if (symbol === 'AAA') ret = minute === 1 ? 1 : (minute === 2 ? 25.5 : 26);
      bars.push({
        symbol: symbol,
        ts: new Date(new Date(predictionTs).getTime() + minute * 60000).toISOString(),
        price: symbol === 'AAA' ? 102 + minute : 10 + i,
        dayReturnPct: ret
      });
    }
  }

  const out = FIRST_TOP20_ENTRY.evaluate({ snapshotRows: snapshotRows, marketBars: bars });
  assertFirstTop20_(out.length === 2, 'İki snapshot sonucu bekleniyordu.');
  assertFirstTop20_(out[0].entered === true, 'AAA Top 20’ye girmeliydi.');
  assertFirstTop20_(out[0].firstEntryTs === '2026-07-22T07:02:00.000Z', 'İlk giriş zamanı yanlış.');
  assertFirstTop20_(out[0].firstEntryRank != null && out[0].firstEntryRank <= 20, 'İlk giriş sırası yanlış.');
  assertFirstTop20_(Math.abs(out[0].returnToFirstEntryPct - 4) < 1e-9, 'İlk giriş getirisi yanlış.');
  assertFirstTop20_(out[0].minutesFromPrediction === 2, 'Tahminden girişe süre yanlış.');
  assertFirstTop20_(out[1].entered === false, 'Verisi olmayan ZZZ girmiş sayılmamalı.');

  Logger.log('FirstTop20Entry tests passed: ' + JSON.stringify(out));
  return out;
}

function assertFirstTop20_(condition, message) {
  if (!condition) throw new Error('FirstTop20EntryTest: ' + message);
}
