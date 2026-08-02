# K1-K4 Expert Criteria Parity Audit

## Scope

This audit compares the legacy `KS_build_K1`, `KS_build_K2`, `KS_build_K3`, and `KS_build_K4` implementations with the modular `EXPERT_MODELS` implementation.

The audit distinguishes implementation defects from unvalidated financial hypotheses. A criterion is not treated as economically correct merely because its code direction is internally consistent.

## Confirmed fixes already present

- Missing K1 subcomponents are no longer silently converted to numeric zero; available weights are renormalized subject to minimum coverage.
- Missing K2 EMA inputs no longer produce a false EMA-stack signal.
- K3 adaptive windows are evaluated per symbol instead of selecting the first window that produces any candidate anywhere in the universe.
- K3 candidates without a valid recovery pattern fail closed with an explicit reason.
- K4 partial horizon availability is handled with coverage-aware renormalization.
- K4 zero 1-month return leaves stability unavailable instead of forcing a zero contribution.

## Open release blocker

### K4 stability loses return direction

Both implementations use:

```text
volatility21 / abs(return1M)
```

This treats a large negative 1-month return and an equally large positive return as identical denominators. Because lower ratios receive better stability scores, a materially negative return can still contribute a strong stability component.

The model must not be promoted until the stability definition preserves return direction or otherwise prevents negative-return observations from receiving a positive stability contribution.

## Quarantined hypotheses

### K1 volatility direction

K1 rewards larger short-, medium-, and long-window volatility values and larger volatility ratios. That direction may identify expansion or breakout regimes, but it is not inherently a quality signal. It remains quarantined until SAME_DAY outcome evidence demonstrates incremental benefit after costs.

### K1 lower-band position

The raw lower-band position is not clamped. Values below the lower band or above the upper band can fall outside the nominal 0-1 interval and then be hidden by cross-sectional normalization.

### K2 RSI 55 symmetry

Absolute distance from RSI 55 is symmetric. For example, RSI values above and below 55 at equal distance receive equal treatment even though their directional meanings may differ. This is a calibration hypothesis, not a verified rule.

### K3 deeper-dip reward

After the minimum drawdown threshold, a deeper dip always receives a better depth score. No explicit falling-knife or maximum-drawdown penalty exists.

## Implementation defect

`EXPERT_MODELS.n_()` reads `row[name]` directly. Consequently, aliases containing dotted paths, such as `latest.hacimDeg`, are not resolved. The alias is currently dead unless the source object literally contains a property with a dot in its name.

## Promotion decision

The expert criteria set is not eligible for active-model promotion while `K4_STABILITY_ABSOLUTE_RETURN_SIGN_LOSS` remains open. Quarantined criteria may remain in shadow mode only and require horizon-specific outcome attribution before activation.

## Test entry point

```javascript
runExpertCriteriaParityAuditTests_();
```

The test verifies audit-state integrity. It does not claim that Apps Script tests have been executed in the live workbook.
