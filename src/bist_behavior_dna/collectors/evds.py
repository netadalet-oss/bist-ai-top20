from __future__ import annotations

import json
import os
from datetime import date
from urllib.parse import urlencode

import pandas as pd

from .core import CollectorRuntime, RuntimeConfig

BASE = "https://evds2.tcmb.gov.tr/service/evds"
DEFAULT_SERIES = {
    "usdtry": "TP.DK.USD.A.YTL",
    "eurtry": "TP.DK.EUR.A.YTL",
    "policy_rate": "TP.PPK.BIST.A1",
    "overnight_rate": "TP.AB.O/N",
}


class EVDSCollector:
    def __init__(self, api_key: str | None = None, config: RuntimeConfig | None = None) -> None:
        self.api_key = api_key or os.getenv("EVDS_API_KEY")
        if not self.api_key:
            raise ValueError("EVDS_API_KEY is required by the official EVDS service")
        self.runtime = CollectorRuntime("tcmb_evds", config)

    def collect(self, series: dict[str, str], start: date, end: date, *, frequency: int | None = None) -> pd.DataFrame:
        if not series:
            raise ValueError("at least one EVDS series is required")
        params = {
            "series": "-".join(series.values()),
            "startDate": start.strftime("%d-%m-%Y"),
            "endDate": end.strftime("%d-%m-%Y"),
            "type": "json",
        }
        if frequency is not None:
            params["frequency"] = str(frequency)
        raw = self.runtime.request(
            f"{BASE}/{urlencode(params, safe='-')}",
            headers={"key": self.api_key, "Accept": "application/json"},
        )
        payload = json.loads(raw.decode("utf-8-sig"))
        records = payload.get("items") or payload.get("Items") or payload.get("data")
        if not isinstance(records, list) or not records:
            raise ValueError(f"EVDS returned no observations: {payload.get('message', 'unknown response')}")
        frame = pd.json_normalize(records)
        date_column = next((c for c in ("Tarih", "DATE", "Date") if c in frame.columns), None)
        if date_column is None:
            raise ValueError("EVDS response is missing its date field")
        frame["date"] = pd.to_datetime(frame[date_column], dayfirst=True, errors="raise").dt.date
        code_to_name = {code.replace(".", "_"): name for name, code in series.items()}
        rename = {}
        for column in frame.columns:
            normalized = column.replace("-", "_").replace(".", "_")
            for code, name in code_to_name.items():
                if normalized.upper() == code.upper():
                    rename[column] = name
        frame = frame.rename(columns=rename)
        for name in series:
            if name in frame.columns:
                frame[name] = pd.to_numeric(frame[name].replace({"": None, "null": None}), errors="coerce")
        selected = ["date", *[name for name in series if name in frame.columns]]
        if len(selected) == 1:
            raise ValueError("EVDS response did not contain requested series columns")
        return self.runtime.write_table("macro_series", frame[selected], ["date"])

    def collect_defaults(self, start: date, end: date) -> pd.DataFrame:
        return self.collect(DEFAULT_SERIES, start, end)
