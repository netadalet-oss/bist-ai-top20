from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

from .core import CollectorRuntime, RuntimeConfig


class YahooCollector:
    def __init__(self, config: RuntimeConfig | None = None) -> None:
        self.runtime = CollectorRuntime("yahoo_finance", config)

    def _one(self, ticker: str, start: date | None, end: date | None) -> tuple[pd.DataFrame, pd.DataFrame]:
        symbol = ticker if ticker.startswith("^") or ticker.endswith(".IS") else f"{ticker}.IS"
        state = self.runtime.state(symbol.replace("^", "index_"))
        resume = date.fromisoformat(state["last_date"]) + timedelta(days=1) if state.get("last_date") else start
        history = yf.Ticker(symbol).history(
            period="max" if resume is None else None,
            start=resume.isoformat() if resume else None,
            end=(end + timedelta(days=1)).isoformat() if end else None,
            interval="1d", auto_adjust=False, actions=True, repair=True,
            raise_errors=True, timeout=self.runtime.config.timeout,
        )
        if history.empty:
            raise ValueError(f"Yahoo returned no history for {symbol}")
        history = history.reset_index().rename(columns={
            "Date": "date", "Open": "open", "High": "high", "Low": "low", "Close": "close",
            "Adj Close": "adj_close", "Volume": "volume", "Dividends": "dividend",
            "Stock Splits": "split_ratio",
        })
        history["date"] = pd.to_datetime(history["date"], utc=True).dt.date
        history["ticker"] = symbol
        prices = history[[c for c in ["ticker", "date", "open", "high", "low", "close", "adj_close", "volume"] if c in history]]
        actions = history[[c for c in ["ticker", "date", "dividend", "split_ratio"] if c in history]]
        actions = actions[(actions.get("dividend", 0) != 0) | (actions.get("split_ratio", 0) != 0)]
        self.runtime.save_state(symbol.replace("^", "index_"), {"last_date": str(history["date"].max())})
        return prices, actions

    def collect(self, tickers: list[str], start: date | None = None, end: date | None = None) -> tuple[Path, Path | None]:
        if not tickers:
            raise ValueError("at least one ticker is required")
        results = self.runtime.map_parallel(lambda ticker: self._one(ticker, start, end), sorted(set(tickers)))
        prices = pd.concat([result[0] for result in results], ignore_index=True)
        price_path = self.runtime.write_table("adjusted_ohlcv", prices, ["ticker", "date"])
        action_frames = [result[1] for result in results if not result[1].empty]
        action_path = None
        if action_frames:
            action_path = self.runtime.write_table("corporate_actions", pd.concat(action_frames, ignore_index=True), ["ticker", "date"])
        return price_path, action_path

    def collect_from_kap_master(self, master: Path = Path("data/processed/kap/company_master.parquet")) -> tuple[Path, Path | None]:
        frame = pd.read_parquet(master)
        if "ticker" not in frame:
            raise ValueError("KAP company master has no ticker column")
        return self.collect(frame["ticker"].dropna().astype(str).tolist())
