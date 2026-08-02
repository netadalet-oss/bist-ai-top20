from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd

REQUIRED_COLUMNS = {"symbol", "date", "open", "high", "low", "close", "volume"}


@dataclass(frozen=True)
class PipelineResult:
    rows: int
    symbols: int
    start: pd.Timestamp
    end: pd.Timestamp
    output_path: Path


def normalize_market_frame(frame: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(f"missing required columns: {sorted(missing)}")
    data = frame.copy()
    data["symbol"] = data["symbol"].astype(str).str.upper().str.strip()
    data["date"] = pd.to_datetime(data["date"], utc=True).dt.tz_convert(None).dt.normalize()
    numeric = ["open", "high", "low", "close", "volume"]
    data[numeric] = data[numeric].apply(pd.to_numeric, errors="coerce")
    data = data.dropna(subset=["symbol", "date", "open", "high", "low", "close", "volume"])
    data = data[data["volume"] >= 0]
    data = data[(data["high"] >= data[["open", "close", "low"]].max(axis=1))]
    data = data[(data["low"] <= data[["open", "close", "high"]].min(axis=1))]
    return data.drop_duplicates(["symbol", "date"], keep="last").sort_values(["symbol", "date"]).reset_index(drop=True)


def add_market_features(frame: pd.DataFrame) -> pd.DataFrame:
    data = normalize_market_frame(frame)
    group = data.groupby("symbol", group_keys=False)
    data["return_1d"] = group["close"].pct_change()
    data["log_return_1d"] = group["close"].transform(lambda s: (s / s.shift(1)).apply(lambda x: pd.NA if pd.isna(x) or x <= 0 else __import__("math").log(x)))
    data["range_pct"] = (data["high"] - data["low"]) / data["close"].replace(0, pd.NA)
    data["gap_pct"] = data["open"] / group["close"].shift(1) - 1
    data["volume_ma20"] = group["volume"].transform(lambda s: s.rolling(20, min_periods=5).mean())
    data["volume_ratio20"] = data["volume"] / data["volume_ma20"].replace(0, pd.NA)
    data["volatility_20d"] = group["return_1d"].transform(lambda s: s.rolling(20, min_periods=10).std())
    data["momentum_20d"] = group["close"].pct_change(20)
    data["drawdown"] = data["close"] / group["close"].cummax() - 1
    return data


class DataCollectionPipeline:
    def __init__(self, provider: object, output_dir: str | Path = "data/processed") -> None:
        self.provider = provider
        self.output_dir = Path(output_dir)

    def collect(self, symbols: Iterable[str], start: str, end: str, filename: str = "market_daily.parquet") -> PipelineResult:
        frames: list[pd.DataFrame] = []
        for symbol in symbols:
            raw = self.provider.fetch(symbol=symbol, start=start, end=end)
            if raw.empty:
                continue
            raw = raw.copy()
            raw["symbol"] = symbol
            frames.append(raw)
        if not frames:
            raise ValueError("provider returned no market data")
        enriched = add_market_features(pd.concat(frames, ignore_index=True))
        self.output_dir.mkdir(parents=True, exist_ok=True)
        output = self.output_dir / filename
        enriched.to_parquet(output, index=False)
        return PipelineResult(len(enriched), enriched["symbol"].nunique(), enriched["date"].min(), enriched["date"].max(), output)
