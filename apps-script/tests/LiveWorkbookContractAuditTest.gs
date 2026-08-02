function runLiveWorkbookContractAuditTests_() {
  const assert = function (ok, msg) { if (!ok) throw new Error(msg); };

  assert(
    LIVE_WORKBOOK_CONTRACT_AUDIT.normalizeHeader('H\u2060i\u2060s\u2060s\u2060e') === 'Hisse',
    'Görünmez Unicode karakterleri temizlenmelidir.'
  );

  const k5 = LIVE_WORKBOOK_CONTRACT_AUDIT.auditK5Rows([
    ['ATSYH','','','','','','','','','','','','','', 'K Adet: 1.00 | K Listesi: K4 | K Skor Listesi: [object Object]'],
    ['SELEC','','','','','','','','','','','','','', 'K Adet: 2.00 | K Listesi: K2, K4']
  ], 2);
  assert(k5.some(function (x) { return x.code === 'K5_SINGLE_MODEL_AS_CONSENSUS'; }), 'Tek model K5 bulgusu bekleniyor.');
  assert(k5.some(function (x) { return x.code === 'K5_BROKEN_REASON_SERIALIZATION'; }), 'Bozuk nesne serileştirme bulgusu bekleniyor.');

  const s = LIVE_WORKBOOK_CONTRACT_AUDIT.auditSRows([
    ['OZATD','','','','','','','','','','','','','','','', 'SupGap(%):0.00 | ResGap(%):0.00 | SupMM:50 | ResMM:50']
  ]);
  assert(s.length === 1 && s[0].code === 'S_SUPPORT_RESISTANCE_NEUTRAL_CONSTANT', 'S sabit nötr puan bulgusu bekleniyor.');

  const hist = LIVE_WORKBOOK_CONTRACT_AUDIT.auditHistoricalRows([
    ['T2','', 'PETKM (+13.98%)\nOTTO (+10.30%)\nCRDFA (+9.15%)']
  ]);
  assert(hist.length === 1 && hist[0].actualCount === 3, 'Eksik Reel TopN sayısı bulunmalıdır.');

  return { ok: true, testCount: 5 };
}
