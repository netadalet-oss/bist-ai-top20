# K1-K4 Expert Criteria Parity Audit

## Scope

This audit compares the legacy `KS_build_K1`, `KS_build_K2`, `KS_build_K3`, and `KS_build_K4` implementations with the modular `EXPERT_MODELS` implementation.

The audit distinguishes implementation defects from unvalidated financial hypotheses. A criterion is not treated as economically correct merely because its code direction is internally consistent.

## Confirmed implementation fixes

- Missing K1 subcomponents are no longer silently converted to numeric zero; available weights are renormalized subject to minimum coverage.
- Dotted fallback paths such as `latest.hacimDeg` and `latest.kapanis` are resolved through `valueAtPath_`.
- K1 lower-band position is clamped to the nominal 0-1 interval before cross-sectional normalization.
- Missing K2 EMA inputs no longer produce a false EMA-stack signal.
- K3 adaptive windows are evaluated per symbol instead of selecting the first window that produces any candidate anywhere in the universe.
- K3 candidates without a valid recovery pattern fail closed with an explicit reason.
- K4 partial horizon availability is handled with coverage-aware renormalization.
- K4 stability no longer uses `abs(return1M)`. It is available only when 1-month return is positive and is calculated as `volatility21 / return1M`.
- Negative or zero 1-month returns cannot receive a positive K4 stability contribution.

## Closed release blocker

### K4 stability return direction

The previous definition:

```text
volatility21 / abs(return1M)
```

removed return direction and could reward a materially negative observation. The modular definition is now:

```text
return1M > 0 ? volatility21 / return1M : null
```

The blocker `K4_STABILITY_ABSOLUTE_RETURN_SIGN_LOSS` is therefore marked `FIXED`.

## Quarantined hypotheses

### K1 volatility direction

K1 rewards larger short-, medium-, and long-window volatility values and larger volatility ratios. That direction may identify expansion or breakout regimes, but it is not inherently a quality signal. It remains quarantined until SAME_DAY and NEXT_DAY outcome evidence demonstrates incremental benefit after costs.

### K2 RSI 55 symmetry

Absolute distance from RSI 55 is symmetric. For example, RSI values above and below 55 at equal distance receive equal treatment even though their directional meanings may differ. This remains a calibration hypothesis.

### K3 deeper-dip reward

After the minimum drawdown threshold, a deeper dip always receives a better depth score. No explicit falling-knife or maximum-drawdown penalty exists. This remains quarantined until attributed outcome evidence supports the direction.

## Open methodological item

K2 EMA gaps, MACD, RSI distance, and momentum are still primarily cross-sectional. A weak market universe can therefore produce a relative leader without satisfying an absolute trend threshold. This is recorded as `K2_RELATIVE_ONLY_NORMALIZATION` and must be evaluated through shadow outcomes before active promotion.

## Promotion decision

There is no unresolved implementation blocker. However, the expert criteria set remains in shadow-only mode while quarantined or open hypotheses exist. Active promotion requires horizon-specific attribution demonstrating incremental Precision@20 and net return contribution.

## Test entry points

```javascript
runExpertModelTests_();
runExpertCriteriaParityAuditTests_();
```

The tests verify implementation and audit-state contracts. They do not claim that Apps Script tests have been executed in the live workbook.
