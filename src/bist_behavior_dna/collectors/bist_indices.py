from __future__ import annotations

from datetime import date
from pathlib import Path

import pandas as pd

from .core import RuntimeConfig
from .yahoo import YahooCollector

# Yahoo Finance symbols for BIST broad, style and sector indices. The collector validates
# every response and fails on unavailable symbols rather than manufacturing gaps.
BIST_INDEX_SYMBOLS = {
    "XU100": "XU100.IS", "XU030": "XU030.IS", "XU050": "XU050.IS",
    "XUTUM": "XUTUM.IS", "XTUMY": "XTUMY.IS", "XK100": "XK100.IS",
    "XBANK": "XBANK.IS", "XUSIN": "XUSIN.IS", "XKAP": "XKAP.IS",
    "XUMAL": "XUMAL.IS", "XUHIZ": "XUHIZ.IS", "XUTEK": "XUTEK.IS",
    "XGIDA": "XGIDA.IS", "XTEKS": "XTEKS.IS", "XKAGT": "XKAGT.IS",
    "XKMYA": "XKMYA.IS", "XTAST": "XTAST.IS", "XMANA": "XMANA.IS",
    "XMESY": "XMESY.IS", "XULAS": "XULAS.IS", "XELKT": "XELKT.IS",
    "XILTM": "XILTM.IS", "XTRZM": "XTRZM.IS", "XTCRT": "XTCRT.IS",
    "XSPOR": "XSPOR.IS", "XSGRT": "XSGRT.IS", "XFINK": "XFINK.IS",
    "XHOLD": "XHOLD.IS", "XGMYO": "XGMYO.IS", "XUTEK": "XUTEK.IS",
    "XBLSM": "XBLSM.IS", "XINSA": "XINSA.IS", "XKOBI": "XKOBI.IS",
    "XHARZ": "XHARZ.IS", "XYORT": "XYORT.IS", "XIST": "XIST.IS",
    "XKURY": "XKURY.IS", "XSRDK": "XSRDK.IS", "XSADA": "XSADA.IS",
}


class BISTIndexCollector:
    def __init__(self, config: RuntimeConfig | None = None) -> None:
        self.yahoo = YahooCollector(config)

    def collect(self, symbols: list[str] | None = None, *, start: date | None = None,
                end: date | None = None, strict: bool = True) -> tuple[Path, Path | None]:
        requested = symbols or list(BIST_INDEX_SYMBOLS.values())
        normalized = [BIST_INDEX_SYMBOLS.get(symbol.upper(), symbol) for symbol in requested]
        if strict:
            return self.yahoo.collect(normalized, start=start, end=end)
        successes: list[str] = []
        failures: list[dict[str, str]] = []
        for symbol in normalized:
            try:
                self.yahoo.collect([symbol], start=start, end=end)
                successes.append(symbol)
            except Exception as exc:
                failures.append({"symbol": symbol, "error": str(exc)})
        if failures:
            path = self.yahoo.runtime.processed_dir / "index_failures.csv"
            pd.DataFrame(failures).to_csv(path, index=False)
        if not successes:
            raise RuntimeError("no BIST index series were collected")
        return self.yahoo.collect(successes, start=start, end=end)
