"""Historical event-level Behavior DNA record calculations.

This module never downloads or fabricates observations. It accepts verified, dated
OHLCV and benchmark series and emits one record per stock/event pair.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import numpy as np
import pandas as pd

HORIZONS: tuple[int, ...] = (1, 3, 5, 10, 20, 60)


@dataclass(frozen=True)
class Event:
    event_id: str
    event_date: pd.Timestamp
    event_type: str
    source: str
    source_url: str
    verified_at: pd.Timestamp


def _safe_ratio(numerator: float, denominator: float) -> float:
    if pd.isna(numerator) or pd.isna(denominator) or denominator == 0:
        return np.nan
    return float(numerator / denominator)


def _atr(frame: pd.DataFrame, window: int = 14) -> pd.Series:
    previous_close = frame["close"].shift(1)
    true_range = pd.concat(
        [
            frame["high"] - frame["low"],
            (frame["high"] - previous_close).abs(),
            (frame["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.rolling(window, min_periods=window).mean()


def _recovery_time(close: pd.Series, start_position: int, peak: float) -> float:
    subsequent = close.iloc[start_position + 1 :]
    recovered = np.flatnonzero(subsequent.to_numpy() >= peak)
    return float(recovered[0] + 1) if recovered.size else np.nan


def _validate_market_frame(frame: pd.DataFrame, label: str) -> pd.DataFrame:
    required = {"date", "open", "high", "low", "close", "volume"}
    missing = sorted(required.difference(frame.columns))
    if missing:
        raise ValueError(f"{label} missing columns: {missing}")
    clean = frame.copy()
    clean["date"] = pd.to_datetime(clean["date"], utc=True).dt.normalize()
    clean = clean.sort_values("date").drop_duplicates("date", keep="last")
    if clean[["open", "high", "low", "close", "volume"]].isna().any().any():
        raise ValueError(f"{label} contains null OHLCV values")
    if (clean[["open", "high", "low", "close"]] <= 0).any().any() or (clean["volume"] < 0).any():
        raise ValueError(f"{label} contains invalid OHLCV values")
    return clean.reset_index(drop=True)


def calculate_historical_records(
    symbol: str,
    stock: pd.DataFrame,
    benchmark: pd.DataFrame,
    events: Iterable[Event],
) -> pd.DataFrame:
    """Calculate one fully derived historical Behavior DNA record per event.

    Events without an eligible trading session or without enough look-forward data
    for the 60-session horizon are omitted rather than filled with placeholders.
    """
    stock = _validate_market_frame(stock, "stock")
    benchmark = _validate_market_frame(benchmark, "benchmark")
    merged = stock.merge(
        benchmark[["date", "close"]].rename(columns={"close": "benchmark_close"}),
        on="date",
        how="inner",
        validate="one_to_one",
    )
    merged["return"] = merged["close"].pct_change()
    merged["benchmark_return"] = merged["benchmark_close"].pct_change()
    merged["atr_14"] = _atr(merged)
    merged["realized_vol_20"] = merged["return"].rolling(20).std(ddof=1) * np.sqrt(252)
    merged["volume_ma_20"] = merged["volume"].rolling(20).mean()
    merged["momentum_20"] = merged["close"].pct_change(20)
    merged["trend_persistence_20"] = merged["return"].gt(0).rolling(20).mean()
    merged["liquidity_20"] = (merged["close"] * merged["volume"]).rolling(20).mean()
    merged["gap"] = merged["open"] / merged["close"].shift(1) - 1
    merged["breakout_20"] = merged["close"] / merged["high"].shift(1).rolling(20).max() - 1

    rows: list[dict[str, object]] = []
    for event in events:
        event_date = pd.Timestamp(event.event_date)
        event_date = event_date.tz_localize("UTC") if event_date.tzinfo is None else event_date.tz_convert("UTC")
        eligible = merged.index[merged["date"] >= event_date.normalize()]
        if len(eligible) == 0:
            continue
        i = int(eligible[0])
        if i < 60 or i + max(HORIZONS) >= len(merged):
            continue

        base = merged.iloc[i]
        pre = merged.iloc[i - 20 : i]
        post20 = merged.iloc[i + 1 : i + 21]
        beta_denominator = pre["benchmark_return"].var(ddof=1)
        beta = _safe_ratio(pre["return"].cov(pre["benchmark_return"]), beta_denominator)
        peak = float(merged["close"].iloc[: i + 1].max())
        future60 = merged["close"].iloc[i : i + 61]
        drawdown = float((future60 / future60.cummax() - 1).min())

        row: dict[str, object] = {
            "symbol": symbol,
            "event_id": event.event_id,
            "event_date": event_date.normalize(),
            "trading_date": base["date"],
            "event_type": event.event_type,
            "event_source": event.source,
            "event_source_url": event.source_url,
            "verified_at": event.verified_at,
            "volume_change": _safe_ratio(float(post20["volume"].mean()), float(pre["volume"].mean())) - 1,
            "atr_change": _safe_ratio(float(post20["atr_14"].mean()), float(pre["atr_14"].mean())) - 1,
            "realized_volatility": float(post20["return"].std(ddof=1) * np.sqrt(252)),
            "beta": beta,
            "relative_strength": float(base["momentum_20"] - merged.iloc[i]["benchmark_close"] / merged.iloc[i - 20]["benchmark_close"] + 1),
            "drawdown": drawdown,
            "recovery_time": _recovery_time(merged["close"], i, peak),
            "momentum": float(base["momentum_20"]),
            "trend_persistence": float(base["trend_persistence_20"]),
            "liquidity": float(base["liquidity_20"]),
            "gap_behavior": float(base["gap"]),
            "breakout_behavior": float(base["breakout_20"]),
        }
        for horizon in HORIZONS:
            stock_forward = float(merged.iloc[i + horizon]["close"] / base["close"] - 1)
            benchmark_forward = float(
                merged.iloc[i + horizon]["benchmark_close"] / base["benchmark_close"] - 1
            )
            abnormal = stock_forward - beta * benchmark_forward if not pd.isna(beta) else np.nan
            cumulative_abnormal = float(
                (
                    (1 + merged["return"].iloc[i + 1 : i + horizon + 1])
                    / (1 + beta * merged["benchmark_return"].iloc[i + 1 : i + horizon + 1])
                ).prod()
                - 1
            ) if not pd.isna(beta) else np.nan
            row[f"forward_return_{horizon}"] = stock_forward
            row[f"abnormal_return_{horizon}"] = abnormal
            row[f"cumulative_abnormal_return_{horizon}"] = cumulative_abnormal
        rows.append(row)

    return pd.DataFrame(rows).sort_values(["event_date", "event_id"]).reset_index(drop=True) if rows else pd.DataFrame()
