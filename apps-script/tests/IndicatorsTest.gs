/* Manual Apps Script tests for BIST_INDICATORS. */
function runIndicatorTests_() {
  const tests = [];

  function assert_(condition, message) {
    if (!condition) throw new Error(message);
  }

  function near_(actual, expected, tolerance, message) {
    assert_(actual != null, message + ' actual=null');
    assert_(Math.abs(actual - expected) <= tolerance,
      message + ' actual=' + actual + ' expected=' + expected);
  }

  function test_(name, fn) {
    try {
      fn();
      tests.push({name:name, ok:true, error:''});
    } catch (e) {
      tests.push({name:name, ok:false, error:String(e && e.message ? e.message : e)});
    }
  }

  test_('pctChange preserves index alignment', function () {
    const out = BIST_INDICATORS.pctChange([100, 110, 99]);
    assert_(out.length === 3, 'length');
    assert_(out[0] === null, 'first value');
    near_(out[1], 10, 1e-12, 'return 1');
    near_(out[2], -10, 1e-12, 'return 2');
  });

  test_('EMA uses legacy-compatible first-value seed', function () {
    const out = BIST_INDICATORS.ema([1, 2, 3], 3);
    near_(out[0], 1, 1e-12, 'ema0');
    near_(out[1], 1.5, 1e-12, 'ema1');
    near_(out[2], 2.25, 1e-12, 'ema2');
  });

  test_('rolling windows reject partial null observations', function () {
    const mean = BIST_INDICATORS.rollingMean([1, null, 3], 3);
    const stdev = BIST_INDICATORS.rollingStdev([1, null, 3], 3, false);
    assert_(mean[2] === null, 'mean must be null');
    assert_(stdev[2] === null, 'stdev must be null');
  });

  test_('population standard deviation', function () {
    const out = BIST_INDICATORS.rollingStdev([1, 2, 3], 3, false);
    near_(out[2], Math.sqrt(2 / 3), 1e-12, 'population stdev');
  });

  test_('RSI increasing sequence reaches 100', function () {
    const values = [];
    for (let i = 1; i <= 20; i++) values.push(i);
    const out = BIST_INDICATORS.rsi(values, 14);
    near_(out[14], 100, 1e-12, 'rsi14');
    near_(out[19], 100, 1e-12, 'rsi19');
  });

  test_('MACD output lengths remain aligned', function () {
    const values = [];
    for (let i = 1; i <= 40; i++) values.push(i);
    const out = BIST_INDICATORS.macd(values, 12, 26, 9);
    assert_(out.line.length === values.length, 'line length');
    assert_(out.signal.length === values.length, 'signal length');
    assert_(out.histogram.length === values.length, 'histogram length');
  });

  test_('Bollinger uses complete observations only', function () {
    const out = BIST_INDICATORS.bollinger([1, 2, 3, 4, 5], 5, 2);
    near_(out.middle[4], 3, 1e-12, 'middle');
    near_(out.stdev[4], Math.sqrt(2), 1e-12, 'stdev');
    near_(out.lower[4], 3 - 2 * Math.sqrt(2), 1e-12, 'lower');
    near_(out.upper[4], 3 + 2 * Math.sqrt(2), 1e-12, 'upper');
  });

  const failed = tests.filter(function (x) { return !x.ok; });
  Logger.log(JSON.stringify(tests, null, 2));
  if (failed.length) throw new Error(failed.length + ' indicator test failed.');
  return tests;
}
