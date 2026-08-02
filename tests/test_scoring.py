from __future__ import annotations

import pandas as pd

from bist_behavior_dna.scoring import BehaviorDNAScorer, ScoreWeights


def test_weights_must_sum_to_one() -> None:
    try:
        ScoreWeights(momentum=1.0).validate()
    except ValueError:
        pass
    else:
        raise AssertionError("invalid weights were accepted")


def test_score_is_bounded_and_ranked() -> None:
    rows = []
    for day in range(70):
        for i, symbol in enumerate(["AAA", "BBB", "CCC"]):
            rows.append({
                "symbol": symbol,
                "date": pd.Timestamp("2024-01-01") + pd.Timedelta(days=day),
                "close": 100 + day * (i + 1),
                "momentum_20d": 0.01 * (i + 1),
                "volatility_20d": 0.03 - i * 0.005,
                "volume_ratio20": 1 + i,
                "drawdown": -0.10 + i * 0.03,
            })
    result = BehaviorDNAScorer().score(pd.DataFrame(rows))
    assert result["behavior_dna_score"].dropna().between(0, 100).all()
    latest = result[result["date"] == result["date"].max()]
    assert latest["behavior_dna_rank"].nunique() == 3
