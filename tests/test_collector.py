from datetime import UTC, datetime

import pandas as pd

from bist_behavior_dna.collector import normalize_frame, validate_market_data


def test_normalize_frame_maps_provider_columns() -> None:
    raw = pd.DataFrame(
        {
            "Date": [pd.Timestamp("2026-07-31")],
            "Open": [100.0],
            "High": [105.0],
            "Low": [99.0],
            "Close": [104.0],
            "Adj Close": [104.0],
            "Volume": [1_000_000],
        }
    )
    result = normalize_frame(raw, "THYAO", "test")
    assert result.loc[0, "symbol"] == "THYAO"
    assert result.loc[0, "provider_symbol"] == "THYAO.IS"
    assert result.loc[0, "close"] == 104.0


def test_validate_market_data_flags_invalid_range() -> None:
    frame = pd.DataFrame(
        {
            "trade_date": [datetime.now(UTC).date()],
            "symbol": ["TEST"],
            "provider_symbol": ["TEST.IS"],
            "open": [10.0],
            "high": [9.0],
            "low": [8.0],
            "close": [10.0],
            "adj_close": [10.0],
            "volume": [100],
            "dividends": [0.0],
            "stock_splits": [0.0],
            "provider": ["test"],
            "collected_at_utc": [datetime.now(UTC).isoformat()],
            "validation_status": ["unchecked"],
        }
    )
    validated, issues = validate_market_data(frame)
    assert validated.loc[0, "validation_status"] == "invalid"
    assert "invalid_ohlc_range" in set(issues["rule_id"])
