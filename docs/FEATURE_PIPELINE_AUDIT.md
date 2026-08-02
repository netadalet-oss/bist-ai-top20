# Feature Pipeline Audit

## Source scope

The source of truth is `fetchAndCompute_` in `V_141225`, lines 1723-2036.

## Structural changes

The monolithic function mixed five responsibilities:

1. HTTP acquisition
2. date sorting and field extraction
3. technical indicator calculation
4. fundamental ratio approximation
5. live-price and public record composition

`08_FeaturePipeline.gs` separates these into `normalizeRows`, `extractSeries`, `computeFromRows` and `fetchAndCompute`.

## Correctness changes

### Invalid dates

Legacy sorting used `new Date(value)` directly and retained invalid dates. The new pipeline rejects invalid-date rows before computation.

### Duplicate dates

The old pipeline could retain two rows for the same trading date. The new pipeline deterministically retains the final source row for that date.

### Beta

The new pipeline uses return-based beta from `BIST_INDICATORS.betaFromReturns`, not price-level covariance.

### Missing observations

Strict rolling indicators do not treat missing observations as zero or divide by a full window containing missing data.

## Misleading financial fields

The legacy formulas were:

- `FD = PD`
- `FAVOK = close * volume * 0.2`
- `FD/FAVOK = FD / fabricated FAVOK`

These are not canonical enterprise value or EBITDA calculations. The canonical output now populates `FD`, `FAVOK` and `FD_FAVOK` only when explicit source fields exist. Legacy approximations remain available solely under:

```javascript
record.legacyApprox
```

They must not be used for model training or displayed as reported financial data.

## Compatibility

`fetchAndComputeV2_` preserves the legacy invocation shape while returning the new explicit record contract. Existing `fetchAndCompute_` remains untouched during comparison testing.

## Acceptance checks

Run:

```javascript
runIndicatorTests_();
runFeaturePipelineTests_();
```

Before replacing the legacy production call, compare both pipelines on the same immutable API payload and classify differences as:

- intended correction
- formatting-only difference
- unexplained regression
