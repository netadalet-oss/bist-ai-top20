# BIST Behavior DNA

A reproducible research and data-engineering project for measuring the persistent and regime-dependent trading behaviour of Borsa İstanbul equities.

## Objective

Behavior DNA converts daily market observations into an auditable feature set describing how each security behaves across liquidity, volatility, trend, gap, drawdown, volume, relative-strength and market-regime dimensions. The project is designed for research and decision support—not trade execution or investment advice.

## Initial scope

- Configurable BIST universe with symbol normalization (`.IS` for Yahoo Finance-compatible providers)
- Incremental OHLCV collection with raw-data preservation
- Validation, deduplication and deterministic parquet/CSV outputs
- Feature-ready canonical schema
- Excel workbook schema specification for analyst review and downstream reporting
- Explicit methodology, assumptions and data-quality controls
- Unit-testable provider abstraction

## Repository layout

```text
behavior-dna/
├── config/                  # Universe and collection settings
├── data/{raw,interim,processed}/
├── docs/                    # Methodology and Excel schema
├── schemas/                 # Machine-readable field contracts
├── src/bist_behavior_dna/   # Python package
├── tests/                   # Unit tests
├── .env.example
├── Makefile
├── pyproject.toml
└── README.md
```

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env
behavior-dna collect --config config/collection.yaml
behavior-dna validate --input data/raw/market_daily.parquet
```

To export CSV instead of parquet:

```bash
behavior-dna collect --config config/collection.yaml --format csv
```

## Collection contract

The engine writes one canonical row per `trade_date × symbol`, using adjusted OHLC where supplied by the configured provider. It preserves provider identity, collection timestamp and validation status. Existing observations are merged by primary key, so repeated runs are idempotent.

Default provider: `yfinance`. This is a replaceable adapter and may be unsuitable for licensed, latency-sensitive or production-grade use. Users remain responsible for exchange/vendor licensing, redistribution restrictions and source verification.

## Core outputs

- `data/raw/market_daily.parquet`: canonical incremental observations
- `data/raw/collection_manifest.json`: run metadata and row counts
- `data/interim/validation_issues.csv`: failed validation rules
- `docs/excel_schema.md`: workbook tabs, columns and formulas
- `schemas/market_daily.schema.json`: canonical raw-data contract

## Behavior DNA dimensions

1. Return and trend persistence
2. Volatility and downside asymmetry
3. Liquidity and turnover behaviour
4. Gap and intraday recovery behaviour
5. Volume-price interaction
6. Drawdown and rebound profile
7. Relative strength versus BIST benchmark
8. Regime sensitivity and stability

Feature definitions, lookback rules and leakage controls are documented in [docs/methodology.md](docs/methodology.md).

## Data governance

- Raw observations are append/merge only; transformations belong in `interim` or `processed`.
- Every derived feature must declare its lookback, minimum observations and null policy.
- Corporate-action treatment must be explicit and consistent within a study.
- No forward-filled prices or future information may enter predictive features.
- All timestamps are UTC; exchange dates use the Europe/Istanbul trading calendar context.

## Development

```bash
make install
make test
make lint
make collect
```

## Status

This branch initializes the complete project foundation: structure, documentation, schemas and a functioning collection engine. Feature computation and scoring modules are the next implementation layer.

## Disclaimer

This software is for research and informational purposes. It does not constitute investment advice, an offer, solicitation, recommendation or guarantee of future performance.
