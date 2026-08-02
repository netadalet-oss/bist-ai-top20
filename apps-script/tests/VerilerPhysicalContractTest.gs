function runVerilerPhysicalContractTests_() {
  function assert_(condition, message) {
    if (!condition) throw new Error('VerilerPhysicalContractTest: ' + message);
  }

  assert_(VERILER_PHYSICAL_CONTRACT.columnToNumber('QZ') === 468, 'QZ 468 olmalıdır.');
  assert_(VERILER_PHYSICAL_CONTRACT.numberToColumn(468) === 'QZ', '468 QZ olmalıdır.');

  const liveShape = VERILER_PHYSICAL_CONTRACT.audit({
    physicalRows: 1458,
    physicalColumns: 1731,
    usedRows: 557,
    usedColumns: 468,
    rightOverflowHasContent: false,
    bottomOverflowHasContent: false
  });
  assert_(liveShape.excess.rows === 901, 'Fazla satır sayısı 901 olmalıdır.');
  assert_(liveShape.excess.columns === 1263, 'Fazla sütun sayısı 1263 olmalıdır.');
  assert_(liveShape.safeToPlanTrim === true, 'Boş overflow için plan güvenli olmalıdır.');

  const blocked = VERILER_PHYSICAL_CONTRACT.planTrim({
    sheetId: 0,
    physicalRows: 1458,
    physicalColumns: 1731,
    usedRows: 557,
    usedColumns: 468,
    rightOverflowHasContent: true,
    bottomOverflowHasContent: false
  });
  assert_(blocked.allowed === false, 'Dolu overflow küçültmeyi engellemelidir.');
  assert_(blocked.report.blockers.indexOf('RIGHT_OVERFLOW_NOT_EMPTY') >= 0,
    'Sağ overflow engeli raporlanmalıdır.');

  const plan = VERILER_PHYSICAL_CONTRACT.planTrim({
    sheetId: 0,
    physicalRows: 1458,
    physicalColumns: 1731,
    usedRows: 557,
    usedColumns: 468,
    rightOverflowHasContent: false,
    bottomOverflowHasContent: false
  });
  assert_(plan.allowed === true, 'Boş overflow için plan üretilmelidir.');
  assert_(plan.requests.length === 2, 'Satır ve sütun için iki istek olmalıdır.');
  assert_(plan.confirmationToken === 'TRIM_VERILER_TO_557x468', 'Onay anahtarı sabit olmalıdır.');

  assert_(VERILER_PHYSICAL_CONTRACT.matrixHasContent([[null, ''], ['', null]]) === false,
    'Boş matris boş sayılmalıdır.');
  assert_(VERILER_PHYSICAL_CONTRACT.matrixHasContent([[null, '=A1']]) === true,
    'Formül/metin içeren matris dolu sayılmalıdır.');

  return { ok: true, testCount: 10 };
}
