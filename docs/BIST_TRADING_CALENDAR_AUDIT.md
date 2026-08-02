# BIST Trading Calendar Audit

## Purpose

Scheduler, SAME_DAY/NEXT_DAY outcome evaluation and shadow experiments previously accepted independent holiday arrays. This creates inconsistent next-trading-day calculations and can produce snapshots on closed or half-day sessions.

## Official source

The calendar contract references Borsa İstanbul's official holiday page:

- `https://www.borsaistanbul.com/resmi-tatil-gunleri`

Verified 2025 and 2026 closed/half-day dates are included as a deterministic seed. The provider exposes source and freshness metadata through `auditBistTradingCalendar_()`.

## States

- `FULL_DAY`
- `HALF_DAY` with `closeTime: 13:00`
- `CLOSED`

Weekends are always closed. Special official dates override regular weekdays.

## Shared API

```javascript
getBistSession_(date)
isBistTradingDay_(date)
nextBistTradingDay_(date)
previousBistTradingDay_(date)
getBistEvaluationDate_(predictionTs, horizon)
validateScheduledSession_(predictionTs, sessionKind)
```

## Behavioral rules

- SAME_DAY evaluation is rejected on closed days.
- NEXT_DAY uses the next BIST trading session, skipping weekends and official closures.
- `NEXT_DAY_CLOSE` scheduled snapshots are disabled on half days because the normal 17:55 session does not exist.
- Half days remain valid trading days for intraday/early snapshots.

## Storage and refresh

`BIST.CALENDAR.JSON` in Document Properties can hold refreshed official data. Stored official entries override the verified seed. A failed or absent refresh does not erase the seed.

The current implementation deliberately does not claim that the official HTML parser has run successfully in Apps Script. Source refresh and parser monitoring must be tested in the target spreadsheet environment.

## Tests

Run:

```javascript
runBistTradingCalendarTests_();
```

The tests cover full-day, half-day, closed-day and next-trading-day transitions around the 2026 Ramadan holiday.
