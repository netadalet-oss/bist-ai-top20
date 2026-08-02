from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

import run_pilot_behavior_dna as pipeline

FALLBACKS = {
    "XBANK": ["XUMAL", "BIST100"], "XULAS": ["XUHIZ", "XUSIN", "BIST100"],
    "XUTEK": ["XUSIN", "BIST100"], "XKMYA": ["XUSIN", "BIST100"],
    "XMANA": ["XUSIN", "BIST100"], "XHOLD": ["XUMAL", "BIST100"],
    "XTCRT": ["XUHIZ", "BIST100"], "XGMYO": ["XUMAL", "BIST100"],
}
EXTRA_CANDIDATES = {
    "XUMAL": ["XUMAL.IS", "^XUMAL"], "XUHIZ": ["XUHIZ.IS", "^XUHIZ"],
    "XUSIN": ["XUSIN.IS", "^XUSIN"],
}
RESOLUTIONS: dict[str, dict[str, object]] = {}
FRAMES: dict[str, tuple[str, pd.DataFrame]] = {}
FAILURES: list[dict[str, object]] = []
_original_download = pipeline.download
_original_download_index = pipeline.download_index
_original_event_records = pipeline.event_records


def _failure(requested: str, candidates: list[str], error: Exception) -> None:
    FAILURES.append({
        "source": "Yahoo Finance", "series": requested,
        "symbol_candidates": "|".join(candidates), "error": str(error),
        "analysis_time": datetime.now(timezone.utc).isoformat(), "fatal": False,
    })


def bounded_download(symbol: str, attempts: int = 2) -> pd.DataFrame:
    return _original_download(symbol, attempts=min(attempts, 2))


def _quick_download(name: str) -> tuple[str, pd.DataFrame]:
    errors: list[str] = []
    for ticker in pipeline.INDEX_CANDIDATES.get(name, []):
        try:
            return ticker, _original_download(ticker, attempts=1)
        except Exception as exc:
            errors.append(f"{ticker}: {exc}")
    raise RuntimeError(f"{name} unavailable: {' | '.join(errors)}")


def resilient_download_index(name: str):
    pipeline.INDEX_CANDIDATES.update(EXTRA_CANDIDATES)
    if name in FRAMES:
        return FRAMES[name]
    try:
        if name == "BIST100":
            errors: list[str] = []
            for ticker in pipeline.INDEX_CANDIDATES[name]:
                try:
                    result = (ticker, _original_download(ticker, attempts=2))
                    break
                except Exception as exc:
                    errors.append(f"{ticker}: {exc}")
            else:
                raise RuntimeError("BIST100 unavailable: " + " | ".join(errors))
        else:
            result = _quick_download(name)
        FRAMES[name] = result
        RESOLUTIONS[name] = {"requested": name, "used": name, "ticker": result[0], "available": True, "fallback_level": 0}
        return result
    except Exception as primary:
        _failure(name, list(pipeline.INDEX_CANDIDATES.get(name, [])), primary)
        if name == "BIST100":
            raise
        for level, fallback in enumerate(FALLBACKS.get(name, ["BIST100"]), 1):
            try:
                if fallback == "BIST100" and "BIST100" in FRAMES:
                    result = FRAMES["BIST100"]
                else:
                    result = _quick_download(fallback)
                    FRAMES[fallback] = result
                RESOLUTIONS[name] = {"requested": name, "used": fallback, "ticker": result[0], "available": False, "fallback_level": level}
                return result
            except Exception as exc:
                _failure(f"{name}->{fallback}", list(pipeline.INDEX_CANDIDATES.get(fallback, [])), exc)
        raise RuntimeError(f"No legal market benchmark fallback available for {name}") from primary


def resilient_event_records(symbol: str, aligned: pd.DataFrame, events: pd.DataFrame) -> pd.DataFrame:
    frame = _original_event_records(symbol, aligned, events)
    requested = pipeline.SECTORS[symbol]
    resolution = RESOLUTIONS.get(requested, {"used": "BIST100", "ticker": "XU100.IS", "available": False, "fallback_level": 99})
    frame["sector_index_requested"] = requested
    frame["sector_index_used"] = resolution["used"]
    frame["sector_source_ticker"] = resolution["ticker"]
    frame["sector_data_available"] = bool(resolution["available"])
    frame["sector_fallback_level"] = int(resolution["fallback_level"])
    return frame


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def finalize_metadata() -> None:
    root = pipeline.OUT
    pd.DataFrame(FAILURES, columns=["source", "series", "symbol_candidates", "error", "analysis_time", "fatal"]).to_csv(root / "source_failures.csv", index=False)
    report_path = root / "run_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report.update({
        "behavior_definition_count": 100, "independent_behavior_family_count": 20,
        "threshold_variant_count": 80, "behavior_taxonomy": "Phase-1 market-derived behavior taxonomy",
        "optional_sector_failure_count": len(FAILURES), "sector_resolutions": RESOLUTIONS,
    })
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    hashes = {p.name: sha256(p) for p in sorted(root.iterdir()) if p.is_file() and p.name != "SHA256SUMS.json"}
    (root / "SHA256SUMS.json").write_text(json.dumps(hashes, indent=2, sort_keys=True), encoding="utf-8")


def main() -> None:
    pipeline.download = bounded_download
    pipeline.download_index = resilient_download_index
    pipeline.event_records = resilient_event_records
    pipeline.main()
    finalize_metadata()


if __name__ == "__main__":
    main()
