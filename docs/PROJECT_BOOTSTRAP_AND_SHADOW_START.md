# Project Bootstrap and Shadow Start

## Purpose

`apps-script/src/43_ProjectBootstrap.gs` provides one controlled entry point for:

- complete project test discovery and execution,
- static and live readiness checks,
- SAME_DAY shadow pilot start,
- NEXT_DAY shadow pilot start.

The default audit and test commands do not overwrite the legacy `S` sheet. Shadow experiments use the existing dual-arm experiment layer.

## Deployment scope

Deploy all files under `apps-script/src/00_*.gs` through `apps-script/src/43_ProjectBootstrap.gs` into the same V8 Apps Script project.

Do not deploy the legacy `V_141225` monolith into that project. The integrity and migration audits intentionally reject legacy global collisions.

Deploy the files under `apps-script/tests/` only in a test/staging Apps Script project or while performing the initial validation cycle.

## First execution order

### 1. Run the unified test suite

```javascript
runAllProjectTests_({
  requireAll: true,
  failFast: false,
  throwOnFailure: false
});
```

The returned report contains:

- `PASSED` test count,
- `FAILED` test count,
- `MISSING` test count,
- duration per test,
- structured error information.

A missing test is a release failure when `requireAll=true`.

### 2. Run the complete readiness audit

```javascript
auditProjectReadiness_({
  runTests: true,
  requireAllTests: true,
  qualityOptions: {
    minCoverage: 0.80,
    historyDepth: 30
  }
});
```

The readiness audit combines:

1. Apps Script global and runtime-chain integrity,
2. legacy-function collision audit,
3. canonical `Veriler` schema audit,
4. live K1-K4 feature coverage audit,
5. legacy/modular S criteria parity audit,
6. expert criteria parity audit,
7. optional full test suite.

The output remains `mode: SHADOW_ONLY`. A valid report authorizes only controlled shadow operation; it is not an economic-performance or production-promotion decision.

### 3. Start SAME_DAY shadow pilot

```javascript
startSameDayShadowPilot_({
  predictionTs: new Date(),
  sessionKind: 'SAME_DAY_EARLY',
  runTests: false,
  qualityOptions: {
    minCoverage: 0.80,
    historyDepth: 30
  },
  legacyOptions: {
    sheetName: 'S'
  },
  bindingOptions: {
    strict: false
  }
});
```

### 4. Start NEXT_DAY shadow pilot

```javascript
startNextDayShadowPilot_({
  predictionTs: new Date(),
  sessionKind: 'NEXT_DAY_CLOSE',
  runTests: false,
  qualityOptions: {
    minCoverage: 0.80,
    historyDepth: 30
  },
  legacyOptions: {
    sheetName: 'S'
  },
  bindingOptions: {
    strict: false
  }
});
```

## Fail-closed behavior

A shadow experiment is not started when any required readiness check fails. The thrown `ShadowReadinessError` contains the full report in:

```javascript
error.readinessReport
```

The legacy S sheet remains untouched.

## Known live-data exclusions

The live workbook audit performed on 2026-08-02 identified:

- `SNKRN`: broad base, technical and historical data absence; exclude from all models.
- `UMPAS`: missing volume-change history; exclude from K3 unless the source data is repaired.
- `YGYO`: missing volume-change history; exclude from K3 unless the source data is repaired.

These exclusions must remain visible as data-quality decisions rather than being converted to zero scores.

## Promotion boundary

The following are still required before replacing legacy S:

- multiple real trading-day SAME_DAY and NEXT_DAY snapshots,
- common Reel Top 20 outcomes for both experiment arms,
- entry-price-based return, MFE and MAE comparison,
- walk-forward calibration,
- bootstrap stability acceptance,
- transaction-cost and liquidity-adjusted superiority.
