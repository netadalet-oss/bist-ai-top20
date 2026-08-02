# Methodology

## 1. Research question

BIST Behavior DNA estimates the recurring empirical behaviour of each Borsa İstanbul security. It is descriptive by default: the system characterizes distributions and conditional responses before any predictive or ranking use.

A security's DNA is represented as a vector of standardized, versioned features calculated only from information available at or before each observation date.

## 2. Unit of analysis

- Primary key: `trade_date`, `symbol`
- Base frequency: daily
- Exchange context: Borsa İstanbul, Europe/Istanbul trading dates
- Benchmark: configurable; default `XU100.IS`
- Price convention: adjusted prices when the source supports them; raw and adjusted conventions must not be mixed within a calculation

## 3. Universe

The universe is explicitly configured and point-in-time membership should be used in historical studies. A current constituent list applied retrospectively creates survivorship bias. Delisted, suspended and renamed securities require a maintained security master.

## 4. Canonical input fields

Required: trade date, symbol, open, high, low, close, volume, provider and collection timestamp. Optional: adjusted close, dividends, splits, currency, exchange and benchmark membership.

Validation rules include:

- unique `trade_date × symbol`
- `high >= max(open, close, low)`
- `low <= min(open, close, high)`
- non-negative prices and volume
- finite numerical values
- no future trade dates
- monotonically ordered dates within symbol after normalization

Rows may be retained with a failed validation status for auditability, but invalid rows must be excluded from feature calculation until resolved.

## 5. Feature families

### 5.1 Return and trend persistence

- Arithmetic return: `close_t / close_(t-1) - 1`
- Log return: `ln(close_t / close_(t-1))`
- Rolling compounded returns: 5, 20, 60, 120 and 252 sessions
- Moving-average distance and slope
- Positive-return frequency
- Return autocorrelation at selected lags
- Trend consistency: share of positive subperiod returns within a long window

### 5.2 Volatility and downside asymmetry

- Rolling realized volatility, annualized with `sqrt(252)`
- Downside deviation
- Semivariance ratio
- Return skewness and excess kurtosis
- Average true range normalized by close
- Tail loss quantiles and expected shortfall estimates

### 5.3 Liquidity and turnover

- Traded value: `close × volume`
- Median and percentile traded value
- Amihud illiquidity: `abs(return) / traded_value`
- Zero-volume and zero-return frequency
- Volume coefficient of variation

Shares-outstanding-based turnover is included only when point-in-time shares data is available.

### 5.4 Gap and intraday recovery

- Overnight gap: `open_t / close_(t-1) - 1`
- Intraday return: `close_t / open_t - 1`
- Gap fill indicator using daily high/low
- Close location value: `(close-low)/(high-low)` with zero-range guard
- Opening shock recovery and continuation rates

### 5.5 Volume-price interaction

- Volume z-score over rolling windows
- Return conditional on high-volume sessions
- Up-volume versus down-volume balance
- Price-volume correlation
- Accumulation/distribution proxies

### 5.6 Drawdown and rebound

- Rolling peak and drawdown
- Maximum drawdown by horizon
- Drawdown duration
- Time to recovery
- Rebound magnitude after local troughs

### 5.7 Relative strength and beta

- Excess return versus benchmark
- Rolling beta and correlation
- Upside/downside capture
- Residual volatility from a benchmark regression
- Relative-strength percentile within the eligible universe

### 5.8 Regime sensitivity

Market regimes are assigned using benchmark-only information, for example trend state, volatility percentile and liquidity stress. Security features are then estimated conditionally by regime. Regime labels must be lagged when used predictively.

## 6. Windowing and minimum observations

Default windows are 20, 60, 120 and 252 sessions. A feature is null until at least 80% of the nominal window is available, unless its definition specifies a stricter threshold. Expanding statistics are prohibited in comparative backtests unless all securities share equivalent information histories.

## 7. Normalization and scores

Cross-sectional features are winsorized using configurable point-in-time percentiles, then transformed to robust z-scores using median and MAD where appropriate. Scores are oriented so higher values have a documented interpretation. Composite scores must publish component weights and missing-value handling.

No single universal Behavior DNA score is assumed. Recommended outputs are:

- raw feature vector
- percentile profile by feature
- family-level composite scores
- stability/confidence score based on coverage and temporal variation

## 8. Leakage and bias controls

- Features at date `t` use data no later than `t`.
- Any signal traded at the close must be lagged to the next executable session.
- Universe membership, corporate actions and fundamentals must be point-in-time.
- Missing observations are not silently imputed as zero.
- Backtests include delisted securities where data permits.
- Transaction costs, price limits, liquidity constraints and suspension risk must be modeled separately.

## 9. Reproducibility

Every dataset and score release should record:

- code commit SHA
- configuration hash
- provider and retrieval timestamp
- universe version
- feature-definition version
- row counts, date range and validation failures

## 10. Interpretation

Behavior DNA describes historical regularities, not immutable traits. Profiles can change after capital actions, index changes, ownership shifts, macro shocks and structural liquidity changes. Results should therefore include both level and stability measures and be reviewed across regimes.
