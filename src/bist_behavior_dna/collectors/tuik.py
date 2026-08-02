from __future__ import annotations

import io
import os
from urllib.parse import quote, urlencode

import pandas as pd

from .core import CollectorRuntime, RuntimeConfig

DEFAULT_BASE = "https://veriportali.tuik.gov.tr/api/sdmx/data"


class TUIKCollector:
    """Official TÜİK SDMX-CSV collector.

    Dataflow identifiers are obtained from TÜİK's SDMX catalogue and are intentionally
    command arguments because TÜİK versions dataflows independently of this package.
    """

    def __init__(self, config: RuntimeConfig | None = None, base_url: str | None = None) -> None:
        self.base_url = (base_url or os.getenv("TUIK_SDMX_BASE") or DEFAULT_BASE).rstrip("/")
        self.runtime = CollectorRuntime("tuik", config)

    def collect(self, dataflow_id: str, *, key: str = "ALL", start: str | None = None,
                end: str | None = None, name: str | None = None) -> pd.DataFrame:
        if not dataflow_id or "," not in dataflow_id:
            raise ValueError("dataflow_id must be a TÜİK SDMX identifier such as TR,DF_...,1.0")
        params = {"dimension_at_observation": "TIME_PERIOD", "detail": "full"}
        if start:
            params["startPeriod"] = start
        if end:
            params["endPeriod"] = end
        url = f"{self.base_url}/{quote(dataflow_id, safe=',')}/{quote(key, safe='.') }?{urlencode(params)}"
        raw = self.runtime.request(url, headers={"Accept": "text/csv;version=2.0,application/vnd.sdmx.data+csv"})
        try:
            frame = pd.read_csv(io.BytesIO(raw))
        except Exception as exc:
            raise ValueError("TÜİK response is not valid SDMX-CSV") from exc
        if frame.empty:
            raise ValueError("TÜİK returned no observations")
        time_column = next((c for c in ("TIME_PERIOD", "obsTime", "time_period") if c in frame.columns), None)
        value_column = next((c for c in ("OBS_VALUE", "obsValue", "value") if c in frame.columns), None)
        if time_column is None or value_column is None:
            raise ValueError(f"TÜİK SDMX schema missing time/value columns: {list(frame.columns)}")
        frame = frame.rename(columns={time_column: "period", value_column: "value"})
        frame["value"] = pd.to_numeric(frame["value"], errors="raise")
        frame["dataflow_id"] = dataflow_id
        dimensions = [c for c in frame.columns if c not in {"value"}]
        dataset = name or dataflow_id.split(",")[1].lower()
        return self.runtime.write_table(dataset, frame, dimensions)
