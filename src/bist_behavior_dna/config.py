from __future__ import annotations

from datetime import date
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator


class CollectionConfig(BaseModel):
    provider: str = "yfinance"
    start_date: date
    end_date: date | None = None
    output_path: Path = Path("data/raw/market_daily.parquet")
    output_format: str = "parquet"
    benchmark: str = "XU100"
    symbols: list[str] = Field(min_length=1)
    retry_count: int = Field(default=3, ge=0, le=10)
    request_pause_seconds: float = Field(default=0.5, ge=0)

    @field_validator("symbols")
    @classmethod
    def normalize_symbols(cls, values: list[str]) -> list[str]:
        normalized = [value.strip().upper().removesuffix(".IS") for value in values]
        return list(dict.fromkeys(normalized))

    @field_validator("output_format")
    @classmethod
    def validate_format(cls, value: str) -> str:
        value = value.lower()
        if value not in {"parquet", "csv"}:
            raise ValueError("output_format must be parquet or csv")
        return value


def load_config(path: Path) -> CollectionConfig:
    with path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle) or {}
    return CollectionConfig.model_validate(payload)
