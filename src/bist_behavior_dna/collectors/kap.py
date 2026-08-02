from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any
from urllib.parse import urlencode

import pandas as pd

from .core import CollectorRuntime, RuntimeConfig

BASE = "https://www.kap.org.tr/tr/api"


class KAPCollector:
    """Collector for KAP's public website JSON interfaces.

    KAP may change browser endpoints without notice. Responses are retained verbatim and
    schema failures stop processing instead of silently producing incomplete data.
    """

    def __init__(self, config: RuntimeConfig | None = None) -> None:
        self.runtime = CollectorRuntime("kap", config)

    def _json(self, path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        raw = self.runtime.request(
            f"{BASE}/{path.lstrip('/')}", method=method,
            headers={"Content-Type": "application/json", "Referer": "https://www.kap.org.tr/tr/"},
            body=body,
        )
        return json.loads(raw.decode("utf-8-sig"))

    def collect_company_master(self) -> pd.DataFrame:
        data = self._json("company/companiesByExchange/1")
        records = data if isinstance(data, list) else data.get("data", data.get("items", []))
        rows = []
        for item in records:
            ticker = item.get("stockCode") or item.get("ticker") or item.get("code")
            member_id = item.get("memberOid") or item.get("memberId") or item.get("oid")
            title = item.get("title") or item.get("companyTitle") or item.get("name")
            if not ticker or not member_id or not title:
                continue
            rows.append({"ticker": str(ticker).strip(), "member_id": str(member_id), "company_name": title,
                         "city": item.get("city"), "market": item.get("market"), "raw": json.dumps(item, ensure_ascii=False)})
        return self.runtime.write_table("company_master", pd.DataFrame(rows), ["ticker"])

    def collect_disclosures(self, start: date, end: date, *, page_size: int = 100) -> pd.DataFrame:
        state = self.runtime.state("disclosures")
        cursor = date.fromisoformat(state.get("next_date", start.isoformat()))
        frames: list[pd.DataFrame] = []
        while cursor <= end:
            stop = min(end, cursor + timedelta(days=30))
            payload = {
                "fromDate": cursor.strftime("%d.%m.%Y"), "toDate": stop.strftime("%d.%m.%Y"),
                "memberType": "IGS", "disclosureClass": "", "subjectList": [], "index": "",
                "market": "", "isLate": "", "pageSize": page_size, "page": 0,
            }
            page = 0
            while True:
                payload["page"] = page
                data = self._json("disclosureQuery", method="POST", payload=payload)
                records = data if isinstance(data, list) else data.get("data", data.get("results", []))
                if not records:
                    break
                normalized = pd.json_normalize(records)
                if normalized.empty:
                    break
                normalized["window_start"] = cursor.isoformat()
                normalized["window_end"] = stop.isoformat()
                frames.append(normalized)
                if len(records) < page_size:
                    break
                page += 1
            cursor = stop + timedelta(days=1)
            self.runtime.save_state("disclosures", {"next_date": cursor.isoformat()})
        if not frames:
            raise ValueError("KAP returned no disclosures for requested interval")
        frame = pd.concat(frames, ignore_index=True)
        id_column = next((c for c in ("disclosureIndex", "disclosureId", "id", "oid") if c in frame.columns), None)
        if id_column is None:
            raise ValueError("KAP disclosure response has no stable identifier")
        return self.runtime.write_table("historical_disclosures", frame, [id_column])

    def collect_financial_statements(self, start: date, end: date) -> pd.DataFrame:
        disclosures = pd.read_parquet(self.runtime.processed_dir / "historical_disclosures.parquet")
        type_cols = [c for c in disclosures.columns if "type" in c.lower() or "class" in c.lower()]
        mask = pd.Series(False, index=disclosures.index)
        for column in type_cols:
            mask |= disclosures[column].astype(str).str.contains("financial|finansal", case=False, na=False)
        frame = disclosures.loc[mask].copy()
        if frame.empty:
            raise ValueError("no financial statement disclosures found; collect disclosures first")
        return self.runtime.write_table("financial_statements", frame, [next(c for c in ("disclosureIndex", "disclosureId", "id", "oid") if c in frame.columns)])

    def collect_corporate_actions(self) -> pd.DataFrame:
        disclosures = pd.read_parquet(self.runtime.processed_dir / "historical_disclosures.parquet")
        text_cols = [c for c in disclosures.columns if disclosures[c].dtype == "object"]
        joined = disclosures[text_cols].fillna("").astype(str).agg(" ".join, axis=1)
        mask = joined.str.contains("kar pay|temett|bedelli|bedelsiz|sermaye artır|bölünme|hak kullan", case=False, regex=True)
        frame = disclosures.loc[mask].copy()
        if frame.empty:
            raise ValueError("no corporate-action disclosures found")
        return self.runtime.write_table("corporate_actions", frame, [next(c for c in ("disclosureIndex", "disclosureId", "id", "oid") if c in frame.columns)])
