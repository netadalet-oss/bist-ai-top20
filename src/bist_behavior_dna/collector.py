from __future__ import annotations

import hashlib
import json
import time
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd

from .config import CollectionConfig
from .providers import MarketDataProvider

CANONICAL_COLUMNS = [
    "trade_date",
    "symbol",
    "provider_symbol",
    "open",
    "high",
    "low",
    "close",
    "adj_close",
    "volume",
    "dividends",
    "stock_splits",
    "provider",
    "collected_at_utc",
    "validation_status",
]


def normalize_frame(frame: pd.DataFrame, symbol: str, provider: str) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=CANONICAL_COLUMNS)

    renamed = frame.rename(
        columns={
            "Date": "trade_date",
            "Datetime": "trade_date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Adj Close": "adj_close",
            "Volume": "volume",
            "Dividends": "dividends",
            "Stock Splits": "stock_splits",
        }
    ).copy()
    renamed["trade_date"] = pd.to_datetime(renamed["trade_date"], utc=True).dt.date
    renamed["symbol"] = symbol.removesuffix(".IS").upper()
    renamed["provider_symbol"] = f"{renamed['symbol'].iloc[0]}.IS"
    renamed["provider"] = provider
    renamed["collected_at_utc"] = datetime.now(UTC).isoformat()
    for column in ["adj_close", "dividends", "stock_splits"]:
        if column not in renamed:
            renamed[column] = pd.NA
    renamed["validation_status"] = "unchecked"
    return renamed[CANONICAL_COLUMNS]


def validate_market_data(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    data = frame.copy()
    issues: list[dict[str, object]] = []
    if data.empty:
        return data, pd.DataFrame(columns=["trade_date", "symbol", "rule_id", "message"])

    duplicate_mask = data.duplicated(["trade_date", "symbol"], keep=False)
    for _, row in data.loc[duplicate_mask].iterrows():
        issues.append({"trade_date": row.trade_date, "symbol": row.symbol, "rule_id": "duplicate_key", "message": "Duplicate trade_date and symbol"})

    numeric_columns = ["open", "high", "low", "close", "volume"]
    for column in numeric_columns:
        data[column] = pd.to_numeric(data[column], errors="coerce")

    invalid_price = (data[["open", "high", "low", "close"]] <= 0).any(axis=1) | data[["open", "high", "low", "close"]].isna().any(axis=1)
    invalid_range = (data["high"] < data[["open", "close", "low"]].max(axis=1)) | (data["low"] > data[["open", "close", "high"]].min(axis=1))
    invalid_volume = data["volume"].isna() | (data["volume"] < 0)
    future_date = pd.to_datetime(data["trade_date"]) > pd.Timestamp(date.today())

    checks = {
        "invalid_price": invalid_price,
        "invalid_ohlc_range": invalid_range,
        "invalid_volume": invalid_volume,
        "future_trade_date": future_date,
    }
    invalid_any = duplicate_mask.copy()
    for rule_id, mask in checks.items():
        invalid_any |= mask
        for _, row in data.loc[mask].iterrows():
            issues.append({"trade_date": row.trade_date, "symbol": row.symbol, "rule_id": rule_id, "message": rule_id.replace("_", " ")})

    data["validation_status"] = "valid"
    data.loc[invalid_any, "validation_status"] = "invalid"
    issue_frame = pd.DataFrame(issues, columns=["trade_date", "symbol", "rule_id", "message"])
    return data, issue_frame


def read_existing(path: Path, output_format: str) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=CANONICAL_COLUMNS)
    if output_format == "parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path, parse_dates=["trade_date"])


def write_dataset(frame: pd.DataFrame, path: Path, output_format: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = frame.sort_values(["symbol", "trade_date"]).reset_index(drop=True)
    if output_format == "parquet":
        ordered.to_parquet(path, index=False)
    else:
        ordered.to_csv(path, index=False)


def collect(config: CollectionConfig, provider: MarketDataProvider) -> dict[str, object]:
    run_id = str(uuid.uuid4())
    started = datetime.now(UTC)
    existing = read_existing(config.output_path, config.output_format)
    frames: list[pd.DataFrame] = []
    failures: dict[str, str] = {}

    for index, symbol in enumerate(config.symbols):
        symbol_existing = existing.loc[existing["symbol"] == symbol] if not existing.empty else existing
        start = config.start_date
        if not symbol_existing.empty:
            latest = pd.to_datetime(symbol_existing["trade_date"]).max().date()
            start = max(start, latest + timedelta(days=1))
        if config.end_date and start >= config.end_date:
            continue

        last_error: Exception | None = None
        for attempt in range(config.retry_count + 1):
            try:
                raw = provider.fetch_daily(symbol, start, config.end_date)
                frames.append(normalize_frame(raw, symbol, provider.name))
                last_error = None
                break
            except Exception as exc:  # provider/network boundary
                last_error = exc
                if attempt < config.retry_count:
                    time.sleep(2**attempt)
        if last_error is not None:
            failures[symbol] = str(last_error)
        if index < len(config.symbols) - 1 and config.request_pause_seconds:
            time.sleep(config.request_pause_seconds)

    incoming = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=CANONICAL_COLUMNS)
    combined = pd.concat([existing, incoming], ignore_index=True)
    if not combined.empty:
        combined = combined.drop_duplicates(["trade_date", "symbol"], keep="last")
    validated, issues = validate_market_data(combined)
    write_dataset(validated, config.output_path, config.output_format)

    issue_path = Path("data/interim/validation_issues.csv")
    issue_path.parent.mkdir(parents=True, exist_ok=True)
    issues.to_csv(issue_path, index=False)

    config_hash = hashlib.sha256(config.model_dump_json().encode()).hexdigest()
    manifest = {
        "run_id": run_id,
        "started_at_utc": started.isoformat(),
        "completed_at_utc": datetime.now(UTC).isoformat(),
        "provider": provider.name,
        "symbols_requested": len(config.symbols),
        "symbols_failed": failures,
        "rows_existing": len(existing),
        "rows_received": len(incoming),
        "rows_written": len(validated),
        "validation_issues": len(issues),
        "output_path": str(config.output_path),
        "config_sha256": config_hash,
    }
    manifest_path = config.output_path.parent / "collection_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest
