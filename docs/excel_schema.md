# Excel Workbook Schema

The analyst workbook is a presentation and review layer over versioned data outputs. It must not become the system of record.

## Workbook tabs

### 1. `README`

Purpose, data timestamp, provider, code commit, methodology version, universe version, warnings and contact/ownership fields.

### 2. `Universe`

| Column | Type | Required | Description |
|---|---|---:|---|
| symbol | text | yes | Canonical BIST ticker |
| provider_symbol | text | yes | Provider-specific ticker |
| company_name | text | no | Issuer name |
| sector | text | no | Sector classification |
| active_from | date | no | Point-in-time membership start |
| active_to | date | no | Point-in-time membership end |
| benchmark | boolean | yes | Benchmark flag |
| enabled | boolean | yes | Collection flag |

### 3. `Daily_Market`

One row per `trade_date × symbol`.

| Column | Type | Required | Description |
|---|---|---:|---|
| trade_date | date | yes | Exchange session date |
| symbol | text | yes | Canonical symbol |
| open | decimal | yes | Session open |
| high | decimal | yes | Session high |
| low | decimal | yes | Session low |
| close | decimal | yes | Session close |
| adj_close | decimal | no | Adjusted close |
| volume | integer | yes | Share volume |
| traded_value | decimal | derived | `close * volume` |
| provider | text | yes | Source adapter |
| collected_at_utc | datetime | yes | Retrieval timestamp |
| validation_status | text | yes | `valid`, `warning`, `invalid` |

### 4. `Features`

One row per `as_of_date × symbol`; columns are versioned in `Feature_Dictionary`. Initial columns:

- identifiers: `as_of_date`, `symbol`, `feature_version`
- returns: `ret_5d`, `ret_20d`, `ret_60d`, `ret_120d`, `ret_252d`
- trend: `ma20_distance`, `ma60_distance`, `trend_consistency_60d`
- risk: `vol_20d`, `vol_60d`, `downside_dev_60d`, `atr_pct_20d`, `max_drawdown_252d`
- liquidity: `median_traded_value_20d`, `amihud_20d`, `volume_cv_60d`
- behaviour: `gap_mean_60d`, `gap_fill_rate_60d`, `close_location_mean_60d`
- relative: `beta_252d`, `corr_252d`, `excess_ret_60d`
- regime: `bull_beta`, `bear_beta`, `high_vol_capture`
- quality: `coverage_ratio`, `stability_score`

### 5. `DNA_Scores`

| Column | Type | Description |
|---|---|---|
| as_of_date | date | Score date |
| symbol | text | Security |
| momentum_score | decimal | 0–100 percentile/composite |
| resilience_score | decimal | 0–100 |
| liquidity_score | decimal | 0–100 |
| volatility_score | decimal | 0–100; orientation documented |
| relative_strength_score | decimal | 0–100 |
| regime_adaptability_score | decimal | 0–100 |
| confidence_score | decimal | Coverage/stability confidence |
| composite_score | decimal | Optional published composite |
| rank | integer | Eligible-universe rank |

### 6. `Feature_Dictionary`

| Column | Description |
|---|---|
| feature_name | Stable machine name |
| family | Methodology family |
| definition | Plain-language definition |
| formula | Exact formula/pseudocode |
| lookback_sessions | Nominal window |
| min_observations | Minimum valid rows |
| orientation | Meaning of higher value |
| unit | Decimal, percent, days, TRY, etc. |
| null_policy | Missing-data rule |
| version | Definition version |

### 7. `Validation`

Rule-level exceptions with `trade_date`, `symbol`, `field`, `rule_id`, `severity`, `observed_value`, `message`, `run_id`.

### 8. `Run_Log`

Collection/feature generation audit trail: `run_id`, timestamps, command, provider, date range, requested symbols, successful symbols, failed symbols, rows read/written, config hash, commit SHA and status.

## Excel implementation rules

- Convert every data range to a named Excel Table.
- Freeze headers and enable filters.
- Dates use ISO-compatible display `yyyy-mm-dd`; timestamps use UTC suffix.
- Do not embed hard-coded ticker lists in formulas.
- Use structured references, not whole-column volatile formulas.
- Protect dictionary and methodology cells from casual edits.
- Conditional formatting is presentational only and must not encode business logic.
- Calculated workbook cells must be reproducible from source tables.

## Suggested formulas

In `Daily_Market[traded_value]`:

```excel
=[@close]*[@volume]
```

In `DNA_Scores[rank]` (descending composite, eligible rows only):

```excel
=IF([@composite_score]="","",RANK.EQ([@composite_score],DNA_Scores[composite_score],0))
```

## Export convention

The programmatic workbook generator should write `outputs/bist_behavior_dna_YYYYMMDD.xlsx` and include data and methodology version metadata on the `README` tab.
