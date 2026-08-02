# Scheduler and Maintenance Audit

## Scope

This layer operationalizes immutable S snapshots without silently changing model logic. It schedules named prediction sessions, prevents duplicate successful runs, records every execution, and keeps destructive maintenance behind an explicit confirmation token.

## Named sessions

| Session | Local time | Horizon | Purpose |
|---|---:|---|---|
| `SAME_DAY_EARLY` | 10:05 Europe/Istanbul | `SAME_DAY` | Early-session candidate snapshot |
| `SAME_DAY_MID` | 12:30 Europe/Istanbul | `SAME_DAY` | Mid-session comparison snapshot |
| `NEXT_DAY_CLOSE` | 17:55 Europe/Istanbul | `NEXT_DAY` | Pre-close next-trading-day snapshot |

Apps Script time-based triggers are approximate. `nearMinute()` does not guarantee second-level or exact-minute execution. The actual prediction timestamp is therefore written into the snapshot and run log and must be used in evaluation.

## Duplicate prevention

A successful execution is uniquely identified operationally by:

```text
tradingDate + sessionKind + horizon
```

If a successful run already exists for that key, later invocations are recorded as `SKIPPED_DUPLICATE`; no second snapshot is written.

## Run log

`_RunLog` stores:

```text
runId
runTs
tradingDate
sessionKind
horizon
status
snapshotId
rowCount
modelVersion
message
durationMs
```

Statuses include:

- `SUCCESS`
- `FAILED`
- `SKIPPED_DUPLICATE`
- `SKIPPED_NON_TRADING_DAY`

## Trading-day rule

Weekend exclusion is built in. Official holidays must currently be supplied as explicit `yyyy-MM-dd` values. This is an acknowledged limitation until an authoritative BIST calendar adapter is added.

## Runtime dependency

The scheduler intentionally does not recreate features or model results itself. It calls a project adapter:

```javascript
buildRuntimeInputs_({ predictionTs, horizon, sessionKind })
```

That adapter must return the current `modelResults` and `features` required by `saveRuntimeSSelectionSnapshot_()`.

This boundary keeps scheduling independent from data acquisition and makes the same runtime usable in Apps Script or a later service application.

## Trigger management

```javascript
installSnapshotTriggers_({ replaceExisting: true });
auditSnapshotTriggers_();
removeSnapshotTriggers_();
```

Trigger installation is an explicit administrative action. Merely deploying the source does not create triggers.

## Maintenance controls

The system audit is read-only:

```javascript
auditSystemMaintenance_();
```

Run-log cleanup defaults to dry-run:

```javascript
cleanupRunLog_({ dryRun: true, retentionDays: 180 });
```

Physical deletion requires the exact date-bound confirmation token returned by the dry-run convention:

```text
DELETE_RUN_LOG_BEFORE_yyyyMMdd
```

No snapshot, outcome, or model-registry deletion command is provided. Those records are evidentiary inputs to performance measurement and calibration and must not be casually purged.

## Known limits

1. Apps Script triggers are not exact-time schedulers.
2. Official BIST holidays are not yet automatically sourced.
3. `_RunLog` and snapshot sheets remain manually editable by spreadsheet editors.
4. The scheduler requires `buildRuntimeInputs_()` to be implemented against the live data pipeline.
5. A trigger being installed does not prove the data source or active model is healthy; run-log failures and audits must be monitored.
