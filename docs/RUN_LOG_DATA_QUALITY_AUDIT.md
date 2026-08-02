# Run Log Data Quality Integration

## Scope

This change stays within the original S-table reliability plan. It makes failed scheduled runs auditable when K1-K4 input coverage is insufficient or numerically invalid.

## Additive schema migration

The original `_RunLog` columns remain unchanged and in the same order. Five columns are appended:

- `errorType`
- `reasonCodes`
- `qualityModels`
- `qualityFields`
- `qualityReportJson`

Existing non-empty logs are accepted when the original eleven-column prefix matches. The new headers are written only into empty trailing columns. No historical row is rewritten.

## Status

A runtime data-quality failure is logged as `FAILED_DATA_QUALITY`. Other exceptions remain `FAILED`.

## Structured fields

`reasonCodes` contains unique gate reason codes. `qualityModels` and `qualityFields` list affected models and canonical fields. `qualityReportJson` preserves the complete gate report, subject to the Google Sheets cell-size safety truncation implemented by the serializer.

## Operational effect

The scheduler still rethrows the original error after logging it. Therefore no snapshot is treated as successful and duplicate-run protection is not activated by a failed quality run.

## Safety

The integration does not change `Veriler`, K tables, S, snapshots, outcomes or existing `_RunLog` rows. Tests are repository-side only until executed in the target Apps Script project.
