from __future__ import annotations

import pandas as pd

from bist_behavior_dna.pipeline import add_market_features, normalize_market_frame


def test_normalize_deduplicates_and_sorts() -> None:
    frame = pd.DataFrame([
        {"symbol":"thyao","date":"2024-01-02","open":10,"high":12,"low":9,"close":11,"volume":100},
        {"symbol":"THYAO","date":"2024-01-02","open":10,"high":13,"low":9,"close":12,"volume":120},
    ])
    result = normalize_market_frame(frame)
    assert len(result) == 1
    assert result.loc[0, "symbol"] == "THYAO"
    assert result.loc[0, "close"] == 12


def test_features_are_symbol_isolated() -> None:
    rows = []
    for symbol in ["AAA", "BBB"]:
        for i in range(25):
            rows.append({"symbol":symbol,"date":f"2024-01-{i+1:02d}","open":100+i,"high":102+i,"low":99+i,"close":101+i,"volume":1000+i})
    result = add_market_features(pd.DataFrame(rows))
    first = result.groupby("symbol").head(1)
    assert first["return_1d"].isna().all()
    assert result.groupby("symbol")["momentum_20d"].count().eq(5).all()
