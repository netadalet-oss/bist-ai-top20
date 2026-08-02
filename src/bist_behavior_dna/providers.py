from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol

import pandas as pd


class MarketDataProvider(Protocol):
    name: str

    def fetch_daily(self, symbol: str, start: date, end: date | None) -> pd.DataFrame:
        """Return daily OHLCV rows indexed or labeled by session date."""


@dataclass(slots=True)
class YFinanceProvider:
    name: str = "yfinance"

    def fetch_daily(self, symbol: str, start: date, end: date | None) -> pd.DataFrame:
        import yfinance as yf

        provider_symbol = symbol if symbol.endswith(".IS") else f"{symbol}.IS"
        frame = yf.download(
            provider_symbol,
            start=start.isoformat(),
            end=end.isoformat() if end else None,
            auto_adjust=False,
            actions=True,
            progress=False,
            threads=False,
        )
        if frame.empty:
            return frame
        if isinstance(frame.columns, pd.MultiIndex):
            frame.columns = frame.columns.get_level_values(0)
        return frame.reset_index()


def provider_from_name(name: str) -> MarketDataProvider:
    if name.lower() == "yfinance":
        return YFinanceProvider()
    raise ValueError(f"Unsupported provider: {name}")
