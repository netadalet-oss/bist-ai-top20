from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

from bist_behavior_dna.historical_records import Event, calculate_historical_records

PILOT = ["AKBNK", "GARAN", "ISCTR", "YKBNK", "THYAO", "ASELS", "TUPRS", "EREGL", "KCHOL", "BIMAS"]
HORIZONS = (1, 3, 5, 10, 20, 60)
OUT = Path("artifacts/behavior_dna")
RAW = OUT / "raw"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_history(frame: pd.DataFrame, symbol: str) -> pd.DataFrame:
    if frame.empty:
        raise RuntimeError(f"No Yahoo Finance history returned for {symbol}")
    if isinstance(frame.columns, pd.MultiIndex):
        if symbol in frame.columns.get_level_values(-1):
            frame = frame.xs(symbol, axis=1, level=-1)
        else:
            frame.columns = frame.columns.get_level_values(0)
    frame = frame.reset_index()
    frame.columns = [str(c).strip().lower().replace(" ", "_") for c in frame.columns]
    rename = {"adj_close": "adj_close", "stock_splits": "stock_splits"}
    frame = frame.rename(columns=rename)
    required = ["date", "open", "high", "low", "close", "volume"]
    missing = [c for c in required if c not in frame.columns]
    if missing:
        raise RuntimeError(f"{symbol} missing Yahoo fields: {missing}")
    frame["date"] = pd.to_datetime(frame["date"], utc=True).dt.normalize()
    numeric = ["open", "high", "low", "close", "volume"]
    for column in numeric:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=required).sort_values("date").drop_duplicates("date", keep="last")
    frame = frame[(frame["close"] > 0) & (frame["high"] > 0) & (frame["low"] > 0) & (frame["volume"] >= 0)]
    if len(frame) < 180:
        raise RuntimeError(f"Insufficient verified history for {symbol}: {len(frame)} rows")
    frame["symbol"] = symbol.replace(".IS", "")
    return frame.reset_index(drop=True)


def download(symbol: str, attempts: int = 5) -> pd.DataFrame:
    RAW.mkdir(parents=True, exist_ok=True)
    cached = RAW / f"{symbol.replace('^', 'INDEX_').replace('.', '_')}.parquet"
    for attempt in range(1, attempts + 1):
        try:
            frame = yf.download(
                symbol,
                period="max",
                interval="1d",
                auto_adjust=False,
                actions=True,
                progress=False,
                threads=False,
                timeout=60,
            )
            clean = normalize_history(frame, symbol)
            clean.to_parquet(cached, index=False)
            return clean
        except Exception:
            if attempt == attempts:
                if cached.exists():
                    return pd.read_parquet(cached)
                raise
            time.sleep(min(30, 2 ** attempt))
    raise AssertionError("unreachable")


def download_benchmark() -> tuple[str, pd.DataFrame]:
    errors: list[str] = []
    for ticker in ("XU100.IS", "^XU100"):
        try:
            return ticker, download(ticker)
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")
    raise RuntimeError("BIST100 download failed; " + " | ".join(errors))


def build_events(benchmark: pd.DataFrame, benchmark_ticker: str) -> list[Event]:
    market = benchmark.copy().sort_values("date").reset_index(drop=True)
    market["return"] = market["close"].pct_change()
    market["rv20"] = market["return"].rolling(20).std(ddof=1)
    market["vol_z"] = (market["return"].abs() - market["return"].abs().rolling(60).mean()) / market["return"].abs().rolling(60).std(ddof=1)
    candidates = market[(market["return"].abs() >= 0.025) | (market["vol_z"] >= 2.5)].copy()
    selected: list[pd.Series] = []
    last_date: pd.Timestamp | None = None
    for _, row in candidates.iterrows():
        date = pd.Timestamp(row["date"])
        if last_date is not None and (date - last_date).days < 5:
            if abs(float(row["return"])) > abs(float(selected[-1]["return"])):
                selected[-1] = row
                last_date = date
            continue
        selected.append(row)
        last_date = date
    verified_at = pd.Timestamp(datetime.now(timezone.utc))
    events: list[Event] = []
    for row in selected:
        ret = float(row["return"])
        event_type = "BIST100_SHARP_RISE" if ret > 0 else "BIST100_SHARP_FALL"
        if abs(ret) < 0.025:
            event_type = "BIST100_VOLATILITY_SHOCK"
        date = pd.Timestamp(row["date"])
        events.append(
            Event(
                event_id=f"{event_type}:{date.date().isoformat()}",
                event_date=date,
                event_type=event_type,
                source="Yahoo Finance BIST100 historical market data",
                source_url=f"https://finance.yahoo.com/quote/{benchmark_ticker}/history",
                verified_at=verified_at,
            )
        )
    if not events:
        raise RuntimeError("No verified BIST100 market events detected")
    return events


def quality_for_symbol(frame: pd.DataFrame) -> tuple[float, int]:
    dates = pd.DatetimeIndex(frame["date"])
    duplicates = int(frame.duplicated("date").sum())
    missing_ohlcv = int(frame[["open", "high", "low", "close", "volume"]].isna().sum().sum())
    expected = max(1, len(pd.bdate_range(dates.min().date(), dates.max().date())))
    coverage = min(1.0, len(frame) / expected)
    score = max(0.0, 100.0 * coverage - duplicates * 2.0 - missing_ohlcv * 0.1)
    return round(score, 4), missing_ohlcv


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    benchmark_ticker, benchmark = download_benchmark()
    events = build_events(benchmark, benchmark_ticker)

    stock_frames: list[pd.DataFrame] = []
    record_frames: list[pd.DataFrame] = []
    coverage_rows: list[dict[str, object]] = []
    missing_rows: list[dict[str, object]] = []

    for symbol in PILOT:
        ticker = f"{symbol}.IS"
        stock = download(ticker)
        quality, missing_count = quality_for_symbol(stock)
        coverage_rows.append(
            {
                "symbol": symbol,
                "rows": len(stock),
                "start_date": stock["date"].min(),
                "end_date": stock["date"].max(),
                "quality_score": quality,
                "source": "Yahoo Finance",
                "source_url": f"https://finance.yahoo.com/quote/{ticker}/history",
            }
        )
        missing_rows.append({"symbol": symbol, "missing_ohlcv_cells": missing_count})
        stock_frames.append(stock)
        records = calculate_historical_records(symbol, stock, benchmark, events)
        if records.empty:
            raise RuntimeError(f"No Behavior DNA records calculated for {symbol}")
        record_frames.append(records)

    stocks = pd.concat(stock_frames, ignore_index=True).sort_values(["symbol", "date"])
    behavior = pd.concat(record_frames, ignore_index=True).sort_values(["symbol", "event_date"])
    behavior["volatility_change"] = behavior["atr_change"]
    behavior["momentum_change"] = behavior.groupby("symbol")["momentum"].diff()
    behavior["event_outcome"] = np.select(
        [behavior["forward_return_20"] > 0.02, behavior["forward_return_20"] < -0.02],
        ["positive", "negative"],
        default="neutral",
    )
    behavior["data_source"] = behavior["event_source"]
    behavior["quality_score"] = 100.0 - behavior.isna().mean(axis=1) * 100.0

    event_study_columns = [
        "symbol", "event_id", "event_date", "trading_date", "event_type", "event_outcome",
        "volume_change", "volatility_change", "drawdown", "recovery_time", "momentum_change",
        "trend_persistence", "relative_strength", "beta", "data_source", "event_source_url",
    ] + [f"forward_return_{h}" for h in HORIZONS] + [f"abnormal_return_{h}" for h in HORIZONS]
    event_study = behavior[event_study_columns].copy()
    events_frame = pd.DataFrame([asdict(event) for event in events])
    market = benchmark.copy()
    market["symbol"] = "BIST100"
    market["source"] = "Yahoo Finance"
    coverage = pd.DataFrame(coverage_rows)
    missing = pd.DataFrame(missing_rows)

    outputs = {
        "stocks.parquet": stocks,
        "events.parquet": events_frame,
        "behavior_dna.parquet": behavior,
        "event_study.parquet": event_study,
        "market.parquet": market,
    }
    for filename, frame in outputs.items():
        frame.to_parquet(OUT / filename, index=False, compression="zstd")

    sqlite_path = OUT / "behavior_dna.sqlite"
    with sqlite3.connect(sqlite_path) as connection:
        stocks.to_sql("stocks", connection, if_exists="replace", index=False, chunksize=5000)
        events_frame.to_sql("events", connection, if_exists="replace", index=False)
        behavior.to_sql("behavior_dna", connection, if_exists="replace", index=False, chunksize=5000)
        event_study.to_sql("event_study", connection, if_exists="replace", index=False, chunksize=5000)
        market.to_sql("market", connection, if_exists="replace", index=False, chunksize=5000)
        connection.execute("CREATE INDEX IF NOT EXISTS idx_behavior_symbol_date ON behavior_dna(symbol, event_date)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_event_study_event ON event_study(event_id, symbol)")

    excel_path = OUT / "BehaviorDNA.xlsx"
    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        behavior.to_excel(writer, sheet_name="Behavior DNA", index=False)
        event_study.to_excel(writer, sheet_name="Event Study", index=False)
        events_frame.to_excel(writer, sheet_name="Events", index=False)
        coverage.to_excel(writer, sheet_name="Coverage", index=False)
        missing.to_excel(writer, sheet_name="Missing Data", index=False)
        stocks.groupby("symbol").tail(1).to_excel(writer, sheet_name="Latest Prices", index=False)
        for sheet in writer.book.worksheets:
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions

    coverage.to_csv(OUT / "coverage_report.csv", index=False)
    missing.to_csv(OUT / "missing_data_report.csv", index=False)

    files = [path for path in OUT.iterdir() if path.is_file()]
    hashes = {path.name: sha256(path) for path in sorted(files)}
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stocks": sorted(behavior["symbol"].unique().tolist()),
        "stock_count": int(behavior["symbol"].nunique()),
        "behavior_rows": int(len(behavior)),
        "event_count": int(events_frame["event_id"].nunique()),
        "coverage_start": str(stocks["date"].min()),
        "coverage_end": str(stocks["date"].max()),
        "sources": sorted(behavior["data_source"].unique().tolist()),
        "hashes": hashes,
    }
    if report["stock_count"] != 10 or report["behavior_rows"] == 0:
        raise RuntimeError(f"Pilot acceptance failed: {report}")
    (OUT / "run_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    hashes["run_report.json"] = sha256(OUT / "run_report.json")
    (OUT / "SHA256SUMS.json").write_text(json.dumps(hashes, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
