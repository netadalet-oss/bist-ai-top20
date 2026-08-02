from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class ScoreWeights:
    momentum: float = 0.25
    trend: float = 0.20
    liquidity: float = 0.15
    stability: float = 0.15
    resilience: float = 0.15
    event_quality: float = 0.10

    def validate(self) -> None:
        total = sum(self.__dict__.values())
        if not np.isclose(total, 1.0):
            raise ValueError(f"score weights must sum to 1.0, got {total}")


class BehaviorDNAScorer:
    """Cross-sectional, date-aware BIST behavior scoring model.

    Component scores are percentile ranks in [0, 100]. The composite score is
    therefore interpretable relative to the observed universe on each date and
    does not leak future observations into historical scores.
    """

    def __init__(self, weights: ScoreWeights | None = None) -> None:
        self.weights = weights or ScoreWeights()
        self.weights.validate()

    def score(self, market: pd.DataFrame, events: pd.DataFrame | None = None) -> pd.DataFrame:
        required = {"symbol", "date", "close", "momentum_20d", "volatility_20d", "volume_ratio20", "drawdown"}
        missing = required.difference(market.columns)
        if missing:
            raise ValueError(f"missing scoring columns: {sorted(missing)}")
        data = market.sort_values(["date", "symbol"]).copy()
        group = data.groupby("symbol", group_keys=False)
        data["ma20"] = group["close"].transform(lambda s: s.rolling(20, min_periods=10).mean())
        data["ma60"] = group["close"].transform(lambda s: s.rolling(60, min_periods=20).mean())
        data["trend_raw"] = data["close"] / data["ma20"] - 1
        data["trend_alignment_raw"] = data["ma20"] / data["ma60"] - 1
        data["liquidity_raw"] = np.log1p(data["volume_ratio20"].clip(lower=0))
        data["stability_raw"] = -data["volatility_20d"]
        data["resilience_raw"] = data["drawdown"]
        data["event_quality_raw"] = self._event_quality(data, events)

        components = {
            "momentum_score": "momentum_20d",
            "trend_score": "trend_raw",
            "liquidity_score": "liquidity_raw",
            "stability_score": "stability_raw",
            "resilience_score": "resilience_raw",
            "event_quality_score": "event_quality_raw",
        }
        for output, source in components.items():
            data[output] = data.groupby("date")[source].rank(pct=True, method="average") * 100

        data["behavior_dna_score"] = (
            data["momentum_score"] * self.weights.momentum
            + data["trend_score"] * self.weights.trend
            + data["liquidity_score"] * self.weights.liquidity
            + data["stability_score"] * self.weights.stability
            + data["resilience_score"] * self.weights.resilience
            + data["event_quality_score"] * self.weights.event_quality
        )
        data["behavior_dna_rank"] = data.groupby("date")["behavior_dna_score"].rank(ascending=False, method="min").astype("Int64")
        data["behavior_regime"] = pd.cut(
            data["behavior_dna_score"],
            bins=[-np.inf, 20, 40, 60, 80, np.inf],
            labels=["fragile", "weak", "neutral", "strong", "elite"],
        ).astype("string")
        return data

    @staticmethod
    def _event_quality(data: pd.DataFrame, events: pd.DataFrame | None) -> pd.Series:
        if events is None or events.empty:
            return pd.Series(0.0, index=data.index)
        required = {"symbol", "date", "event_type", "severity"}
        if required.difference(events.columns):
            raise ValueError("events frame lacks required columns")
        polarity = {
            "gap_up": 0.5,
            "gap_down": -0.5,
            "volume_spike": 0.2,
            "breakout_20d": 1.0,
            "breakdown_20d": -1.0,
            "volatility_shock": -0.5,
            "drawdown": -1.0,
        }
        event_data = events.copy()
        event_data["polarity"] = event_data["event_type"].map(polarity).fillna(0.0)
        event_data["quality"] = event_data["polarity"] * event_data["severity"].clip(upper=3)
        aggregated = event_data.groupby(["symbol", "date"], as_index=False)["quality"].sum()
        merged = data[["symbol", "date"]].merge(aggregated, on=["symbol", "date"], how="left")
        return merged["quality"].fillna(0.0).set_axis(data.index)
