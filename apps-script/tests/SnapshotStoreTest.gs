function runSnapshotStoreTests_() {
  const ts = new Date('2026-08-02T08:00:00.000Z');
  const snapshotId = 'TEST-' + Utilities.getUuid();

  const saved = SNAPSHOT_STORE.appendPredictionBatch({
    snapshotId: snapshotId,
    snapshotType: 'MODEL',
    predictionTs: ts,
    featureTs: new Date(ts.getTime() - 60000),
    sessionDate: '2026-08-02',
    sessionKind: 'SAME_DAY_EARLY',
    results: [
      {
        model: 'K5', modelVersion: 'test', symbol: 'THYAO', rank: 1,
        score: 88.5, coverage: 1, entryPrice: 250,
        raw: { models: ['K1','K2','K3','K4'] }, normalized: { modelCoverage: 1 }
      },
      {
        model: 'K5', modelVersion: 'test', symbol: 'ASELS', rank: 2,
        score: 80, coverage: 0.75, entryPrice: 150,
        raw: { models: ['K1','K2','K4'] }, normalized: { modelCoverage: 0.75 }
      }
    ]
  });

  assertSnapshot_(saved.snapshotId === snapshotId, 'snapshot id korunmalı');
  assertSnapshot_(saved.rowCount === 2, 'iki tahmin satırı yazılmalı');

  const rows = SNAPSHOT_STORE.readSnapshot(snapshotId);
  assertSnapshot_(rows.length === 2, 'snapshot iki satır okunmalı');
  assertSnapshot_(String(rows[0].symbol) === 'THYAO', 'ilk sembol korunmalı');

  const verification = SNAPSHOT_STORE.verifySnapshot(snapshotId);
  assertSnapshot_(verification.valid === true, 'payload hash doğrulanmalı');

  let duplicateRejected = false;
  try {
    SNAPSHOT_STORE.appendPredictionBatch({
      snapshotId: snapshotId,
      predictionTs: ts,
      featureTs: ts,
      results: [{ model: 'K5', symbol: 'GARAN', rank: 1, score: 90 }]
    });
  } catch (_) {
    duplicateRejected = true;
  }
  assertSnapshot_(duplicateRejected, 'aynı snapshot yeniden yazılamamalı');

  let leakageRejected = false;
  try {
    SNAPSHOT_STORE.appendPredictionBatch({
      snapshotId: 'LEAK-' + Utilities.getUuid(),
      predictionTs: ts,
      featureTs: new Date(ts.getTime() + 1),
      results: [{ model: 'K5', symbol: 'GARAN', rank: 1, score: 90 }]
    });
  } catch (_) {
    leakageRejected = true;
  }
  assertSnapshot_(leakageRejected, 'gelecek özellik zamanı reddedilmeli');

  const outcomes = SNAPSHOT_STORE.appendOutcomes({
    snapshotId: snapshotId,
    outcomes: [
      {
        symbol: 'THYAO', horizon: 'SAME_DAY_CLOSE', evaluationTs: new Date(ts.getTime() + 3600000),
        top20Hit: true, top20Rank: 8, targetPrice: 260, returnPct: 4
      }
    ]
  });
  assertSnapshot_(outcomes.outcomeCount === 1, 'sonuç ayrı tabloya yazılmalı');

  return { ok: true, snapshotId: snapshotId };
}

function assertSnapshot_(condition, message) {
  if (!condition) throw new Error('Snapshot test hatası: ' + message);
}
