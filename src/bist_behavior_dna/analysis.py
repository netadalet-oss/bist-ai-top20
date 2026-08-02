from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class BISTSnapshot:
    date: pd.Timestamp
    symbols: int
    advancing: int
    declining: int
    breadth_pct: float
    median_return: float
    median_score: float


class BISTAnalyzer:
    def snapshot(self, scored: pd.DataFrame, date: str | pd.Timestamp | None = None) -> BISTSnapshot:
        target = pd.Timestamp(date) if date is not None else pd.to_datetime(scored["date"]).max()
        current = scored[pd.to_datetime(scored["date"]) == target]
        if current.empty:
            raise ValueError(f"no observations for {target.date()}")
        returns = current["return_1d"].dropna()
        advancing = int((returns > 0).sum())
        declining = int((returns < 0).sum())
        denominator = advancing + declining
        return BISTSnapshot(
            date=target,
            symbols=int(current["symbol"].nunique()),
            advancing=advancing,
            declining=declining,
            breadth_pct=(advancing / denominator * 100) if denominator else 50.0,
            median_return=float(returns.median()) if not returns.empty else float("nan"),
            median_score=float(current["behavior_dna_score"].median()),
        )

    def leaderboard(self, scored: pd.DataFrame, date: str | pd.Timestamp | None = None, limit: int = 20) -> pd.DataFrame:
        target = pd.Timestamp(date) if date is not None else pd.to_datetime(scored["date"]).max()
        columns = [
            "symbol", "date", "behavior_dna_rank", "behavior_dna_score", "behavior_regime",
            "momentum_score", "trend_score", "liquidity_score", "stability_score",
            "resilience_score", "event_quality_score", "return_1d", "momentum_20d", "drawdown",
        ]
        available = [column for column in columns if column in scored.columns]
        return scored[pd.to_datetime(scored["date"]) == target][available].sort_values(
            ["behavior_dna_rank", "symbol"]
        ).head(limit).reset_index(drop=True)

    def breadth_history(self, scored: pd.DataFrame) -> pd.DataFrame:
        data = scored.copy()
        data["advance"] = data["return_1d"] > 0
        data["decline"] = data["return_1d"] < 0
        data["above_60"] = data["behavior_dna_score"] >= 60
        result = data.groupby("date", as_index=False).agg(
            symbols=("symbol", "nunique"),
            advancing=("advance", "sum"),
            declining=("decline", "sum"),
            strong_symbols=("above_60", "sum"),
            median_return=("return_1d", "median"),
            median_score=("behavior_dna_score", "median"),
        )
        active = (result["advancing"] + result["declining"]).replace(0, np.nan)
        result["breadth_pct"] = result["advancing"] / active * 100
        result["strong_share_pct"] = result["strong_symbols"] / result["symbols"] * 100
        return result

    def event_study(self, market: pd.DataFrame, events: pd.DataFrame, horizons: tuple[int, ...] = (1, 5, 10, 20)) -> pd.DataFrame:
        data = market.sort_values(["symbol", "date"]).copy()
        group = data.groupby("symbol", group_keys=False)
        for horizon in horizons:
            data[f"forward_return_{horizon}d"] = group["close"].shift(-horizon) / data["close"] - 1
        columns = ["symbol", "date", *[f"forward_return_{h}d" for h in horizons]]
        joined = events.merge(data[columns], on=["symbol", "date"], how="left")
        aggregations: dict[str, tuple[str, str]] = {"events": ("symbol", "size")}
        for horizon in horizons:
            column = f"forward_return_{horizon}d"
            aggregations[f"mean_{horizon}d"] = (column, "mean")
            aggregations[f"median_{horizon}d"] = (column, "median")
            joined[f"win_{horizon}d"] = joined[column] > 0
            aggregations[f"win_rate_{horizon}d"] = (f"win_{horizon}d", "mean")
        result = joined.groupby("event_type", as_index=False).agg(**aggregations)
        for horizon in horizons:
            result[f"win_rate_{horizon}d"] *= 100
        return result.sort_values("events", ascending=False).reset_index(drop=True)

    def correlation_matrix(self, scored: pd.DataFrame) -> pd.DataFrame:
        columns = [
            "behavior_dna_score", "return_1d", "momentum_20d", "volatility_20d",
            "volume_ratio20", "drawdown", "momentum_score", "trend_score",
            "liquidity_score", "stability_score", "resilience_score", "event_quality_score",
        ]
        available = [column for column in columns if column in scored.columns]
        return scored[available].corr(numeric_only=True)
