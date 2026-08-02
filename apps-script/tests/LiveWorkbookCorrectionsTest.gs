function runLiveWorkbookCorrectionsTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error(message);
  }

  const hidden = 'H\u2060i\u2060s\u2060s\u2060e';
  assert_(LIVE_WORKBOOK_CORRECTIONS.normalizeHeader(hidden) === 'Hisse', 'Görünmez Unicode temizlenmedi.');

  const normalized = LIVE_WORKBOOK_CORRECTIONS.normalizeRecord({
    'A\nB': 1,
    'H\u2060i\u2060s\u2060s\u2060e': 'THYAO'
  });
  assert_(normalized.A_B === 1, 'Satır sonu normalizasyonu hatalı.');
  assert_(normalized.Hisse === 'THYAO', 'Hisse başlığı normalize edilmedi.');

  const sr = LIVE_WORKBOOK_CORRECTIONS.supportResistance(
    100,
    '98 | 95 | 90',
    '103 | 108 | 112'
  );
  assert_(sr.support === 98, 'En yakın destek seçilmedi.');
  assert_(sr.resistance === 103, 'En yakın direnç seçilmedi.');
  assert_(sr.supportGapPct > 2 && sr.supportGapPct < 2.1, 'Destek uzaklığı hatalı.');
  assert_(sr.resistanceGapPct === 3, 'Direnç uzaklığı hatalı.');

  const filtered = LIVE_WORKBOOK_CORRECTIONS.validConsensusRows([
    { symbol: 'A', raw: { modelCount: 1, scores: { K4: 90 } } },
    { symbol: 'B', raw: { modelCount: 2, scores: { K2: 80, K4: 85 } } }
  ], 2);
  assert_(filtered.length === 1 && filtered[0].symbol === 'B', 'Tek model K5 adayı elenmedi.');
  assert_(filtered[0].scoreListJson === '{"K2":80,"K4":85}', 'Skor listesi JSON üretilmedi.');

  const metrics = LIVE_WORKBOOK_CORRECTIONS.topNMetrics(3, 10, [
    { symbol: 'A' }, { symbol: 'B' }, { symbol: 'C' }, { symbol: 'D' }
  ], 20);
  assert_(metrics.effectiveTopN === 4, 'Gerçek TopN paydası kullanılmadı.');
  assert_(metrics.recall === 0.75, 'Recall gerçek paydayla hesaplanmadı.');
  assert_(metrics.completeUniverse === false, 'Eksik Reel TopN işaretlenmedi.');

  return { ok: true, tests: 13 };
}
