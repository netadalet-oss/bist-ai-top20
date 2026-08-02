function testVerilerCanonicalSchemaExpectedWidth_() {
  var headers = VERILER_CANONICAL_SCHEMA.expectedHeaders();
  if (headers.length !== 468) throw new Error('Beklenen 468 sutun, bulunan: ' + headers.length);
  if (headers[0] !== 'Hisse') throw new Error('Ilk sutun Hisse degil.');
  if (headers[467] !== 'HacimDegisim%_T90') throw new Error('Son sutun HacimDegisim%_T90 degil.');
}

function testVerilerCanonicalSchemaExactOrder_() {
  var headers = VERILER_CANONICAL_SCHEMA.expectedHeaders();
  var report = VERILER_CANONICAL_SCHEMA.audit(headers);
  if (!report.validAfterNormalization) throw new Error(JSON.stringify(report));
}

function testVerilerCanonicalSchemaUnicodeNormalization_() {
  var headers = VERILER_CANONICAL_SCHEMA.expectedHeaders().map(function (header) {
    return header.split('').join('\u2060');
  });
  var report = VERILER_CANONICAL_SCHEMA.audit(headers);
  if (!report.validAfterNormalization) throw new Error(JSON.stringify(report));
  if (report.unicodeContaminatedCount !== 468) {
    throw new Error('Beklenen 468 Unicode-kirli baslik, bulunan: ' + report.unicodeContaminatedCount);
  }
}

function testVerilerCanonicalSchemaDetectsSwap_() {
  var headers = VERILER_CANONICAL_SCHEMA.expectedHeaders();
  var temp = headers[48];
  headers[48] = headers[49];
  headers[49] = temp;
  var report = VERILER_CANONICAL_SCHEMA.audit(headers);
  if (report.orderValid || report.positionalMismatches.length !== 2) {
    throw new Error('Sutun yer degisimi algilanmadi.');
  }
}

function runVerilerCanonicalSchemaTests_() {
  testVerilerCanonicalSchemaExpectedWidth_();
  testVerilerCanonicalSchemaExactOrder_();
  testVerilerCanonicalSchemaUnicodeNormalization_();
  testVerilerCanonicalSchemaDetectsSwap_();
  return 'VerilerCanonicalSchemaTest: OK';
}
