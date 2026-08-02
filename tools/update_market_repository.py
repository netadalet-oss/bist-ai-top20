#!/usr/bin/env python3
"""Aurum repository market-data updater.

External dependencies are limited to the configured market-data providers.
The script discovers BIST symbols, queries providers in the required order,
merges only missing fields, records lineage, derives a conservative ranking,
and writes data/latest.json for the Android client.
"""
from __future__ import annotations

import csv
import datetime as dt
import io
import json
import math
import os
import re
import statistics
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, List, Optional, Tuple

PROVIDER_ORDER = [
    "ISYATIRIM",
    "ISYATIRIM_LIVE",
    "YAHOO",
    "YAHOO_QUOTE",
    "BIGPARA",
    "STOOQ",
]
USER_AGENT = "Mozilla/5.0 (AurumTop20/1.3; personal research client)"
TIMEOUT = int(os.getenv("AURUM_HTTP_TIMEOUT", "18"))
MAX_SYMBOLS = int(os.getenv("AURUM_MAX_SYMBOLS", "700"))
MIN_DISCOVERED_SYMBOLS = int(os.getenv("AURUM_MIN_SYMBOLS", "100"))


def request_text(url: str, headers: Optional[Dict[str, str]] = None) -> str:
    h = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        return response.read().decode("utf-8", errors="replace")


def request_json(url: str, headers: Optional[Dict[str, str]] = None) -> Any:
    return json.loads(request_text(url, headers))


def finite(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        number = float(str(value).replace("%", "").replace(" ", "").replace(",", "."))
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def normalize_symbol(value: str) -> Optional[str]:
    symbol = re.sub(r"[^A-Z0-9]", "", str(value).upper())
    return symbol if re.fullmatch(r"[A-Z0-9]{3,8}", symbol) else None


def discover_symbols() -> List[str]:
    configured = [normalize_symbol(x) for x in os.getenv("AURUM_SYMBOLS", "").split(",")]
    configured = sorted({x for x in configured if x})
    if configured:
        return configured[:MAX_SYMBOLS]

    urls = [
        "https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/default.aspx",
        "https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=AKBNK",
    ]
    found: set[str] = set()
    patterns = [
        r"[?&]hisse=([A-Z0-9]{3,8})",
        r'\"HISSE\"\s*:\s*\"([A-Z0-9]{3,8})\"',
        r'\"symbol\"\s*:\s*\"([A-Z0-9]{3,8})\"',
    ]
    for url in urls:
        try:
            text = request_text(url, {"Referer": "https://www.isyatirim.com.tr/"})
            for pattern in patterns:
                for raw in re.findall(pattern, text, flags=re.I):
                    symbol = normalize_symbol(raw)
                    if symbol:
                        found.add(symbol)
        except Exception:
            continue

    fallback_path = os.path.join(os.path.dirname(__file__), "..", "data", "symbols.txt")
    if os.path.exists(fallback_path):
        with open(fallback_path, "r", encoding="utf-8") as handle:
            for line in handle:
                symbol = normalize_symbol(line.strip())
                if symbol:
                    found.add(symbol)

    symbols = sorted(found)[:MAX_SYMBOLS]
    if len(symbols) < MIN_DISCOVERED_SYMBOLS:
        raise RuntimeError(f"Symbol discovery failed closed: only {len(symbols)} symbols")
    return symbols


def isyatirim_history(symbol: str) -> Dict[str, Any]:
    end = dt.date.today()
    start = end - dt.timedelta(days=460)
    url = (
        "https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/"
        "HisseTekil?hisse=" + urllib.parse.quote(symbol)
        + "&startdate=" + start.strftime("%d-%m-%Y")
        + "&enddate=" + end.strftime("%d-%m-%Y")
    )
    payload = request_json(url, {"Referer": "https://www.isyatirim.com.tr"})
    rows = payload.get("value") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ValueError("empty value[]")
    last = rows[-1]
    close = finite(last.get("HGDG_KAPANIS"))
    volume = finite(last.get("HGDG_HACIM"))
    change = finite(last.get("HGDG_HS_KAPANIS"))
    closes = [finite(row.get("HGDG_KAPANIS")) for row in rows]
    closes = [x for x in closes if x is not None]
    return {"price": close, "changePct": change, "volume": volume, "historyCloses": closes[-260:]}


def isyatirim_live(symbol: str) -> Dict[str, Any]:
    url = "https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=" + urllib.parse.quote(symbol)
    text = request_text(url, {"Referer": "https://www.isyatirim.com.tr"})
    result: Dict[str, Any] = {"companyCardUrl": url}
    patterns = {
        "price": [r'(?i)(?:son|fiyat)[^0-9]{0,40}([0-9]+[.,][0-9]+)'],
        "targetPrice": [r'(?i)hedef\s*fiyat[^0-9]{0,40}([0-9]+[.,][0-9]+)'],
        "pe": [r'(?i)F/K[^0-9]{0,30}([0-9]+[.,][0-9]+)'],
        "pb": [r'(?i)PD/DD[^0-9]{0,30}([0-9]+[.,][0-9]+)'],
    }
    for key, pats in patterns.items():
        for pattern in pats:
            match = re.search(pattern, text)
            if match:
                result[key] = finite(match.group(1))
                break
    recommendation = re.search(r'(?i)(?:öneri|tavsiye)[^A-ZÇĞİÖŞÜ]{0,30}(AL|TUT|SAT|ÖNERİ YOK)', text)
    if recommendation:
        result["recommendation"] = recommendation.group(1).upper()
    return result


def yahoo_chart(symbol: str) -> Dict[str, Any]:
    ticker = urllib.parse.quote(symbol + ".IS")
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1y&interval=1d&events=div%2Csplits"
    payload = request_json(url)
    result = payload.get("chart", {}).get("result", [None])[0]
    if not result:
        raise ValueError("missing chart result")
    meta = result.get("meta", {})
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    closes = [finite(x) for x in quote.get("close", [])]
    closes = [x for x in closes if x is not None]
    volumes = [finite(x) for x in quote.get("volume", [])]
    volumes = [x for x in volumes if x is not None]
    return {
        "price": finite(meta.get("regularMarketPrice")),
        "previousClose": finite(meta.get("chartPreviousClose")),
        "volume": volumes[-1] if volumes else None,
        "historyCloses": closes[-260:],
    }


def yahoo_quote(symbol: str) -> Dict[str, Any]:
    ticker = urllib.parse.quote(symbol + ".IS")
    url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={ticker}"
    payload = request_json(url)
    rows = payload.get("quoteResponse", {}).get("result", [])
    if not rows:
        raise ValueError("missing quote result")
    row = rows[0]
    return {
        "price": finite(row.get("regularMarketPrice")),
        "changePct": finite(row.get("regularMarketChangePercent")),
        "volume": finite(row.get("regularMarketVolume")),
        "marketCap": finite(row.get("marketCap")),
        "pe": finite(row.get("trailingPE")),
        "pb": finite(row.get("priceToBook")),
    }


def bigpara(symbol: str) -> Dict[str, Any]:
    url = "https://bigpara.hurriyet.com.tr/borsa/hisse-fiyatlari/" + symbol.lower() + "/"
    text = request_text(url)
    result: Dict[str, Any] = {"bigparaUrl": url}
    for key, pattern in {
        "price": r'(?i)(?:Son|Fiyat)[^0-9]{0,60}([0-9]+[.,][0-9]+)',
        "changePct": r'(?i)(?:Değişim|Degisim)[^0-9+-]{0,40}([+-]?[0-9]+[.,][0-9]+)',
    }.items():
        match = re.search(pattern, text)
        if match:
            result[key] = finite(match.group(1))
    return result


def stooq(symbol: str) -> Dict[str, Any]:
    candidates = [symbol.lower() + ".tr", symbol.lower()]
    for ticker in candidates:
        url = "https://stooq.com/q/d/l/?s=" + urllib.parse.quote(ticker) + "&i=d"
        text = request_text(url)
        rows = list(csv.DictReader(io.StringIO(text)))
        if rows and "Close" in rows[-1]:
            closes = [finite(row.get("Close")) for row in rows]
            closes = [x for x in closes if x is not None]
            volumes = [finite(row.get("Volume")) for row in rows]
            volumes = [x for x in volumes if x is not None]
            return {"price": closes[-1] if closes else None, "volume": volumes[-1] if volumes else None, "historyCloses": closes[-260:]}
    raise ValueError("no stooq rows")


PROVIDERS = {
    "ISYATIRIM": isyatirim_history,
    "ISYATIRIM_LIVE": isyatirim_live,
    "YAHOO": yahoo_chart,
    "YAHOO_QUOTE": yahoo_quote,
    "BIGPARA": bigpara,
    "STOOQ": stooq,
}


def merge_symbol(symbol: str) -> Dict[str, Any]:
    merged: Dict[str, Any] = {"symbol": symbol, "lineage": {}, "attempts": []}
    observed_prices: List[Tuple[str, float]] = []
    for provider_name in PROVIDER_ORDER:
        started = time.time()
        try:
            payload = PROVIDERS[provider_name](symbol)
            accepted = []
            for key, value in payload.items():
                if value is None or value == [] or value == "":
                    continue
                if key == "price" and finite(value) is not None:
                    observed_prices.append((provider_name, float(value)))
                if key not in merged:
                    merged[key] = value
                    merged["lineage"][key] = provider_name
                    accepted.append(key)
            merged["attempts"].append({"provider": provider_name, "ok": True, "accepted": accepted, "elapsedMs": round((time.time() - started) * 1000)})
        except Exception as exc:
            merged["attempts"].append({"provider": provider_name, "ok": False, "error": str(exc)[:240], "elapsedMs": round((time.time() - started) * 1000)})

    if observed_prices:
        values = [price for _, price in observed_prices if price > 0]
        median = statistics.median(values) if values else None
        max_deviation = max(abs(price / median - 1) for price in values) if median else None
        merged["crossValidation"] = {
            "priceSources": [{"provider": p, "price": v} for p, v in observed_prices],
            "medianPrice": median,
            "maxDeviationPct": max_deviation * 100 if max_deviation is not None else None,
            "valid": max_deviation is not None and max_deviation <= 0.08,
        }
    else:
        merged["crossValidation"] = {"priceSources": [], "valid": False}

    closes = [x for x in merged.get("historyCloses", []) if finite(x) is not None]
    if len(closes) >= 21:
        last = closes[-1]
        merged["return5dPct"] = (last / closes[-6] - 1) * 100 if len(closes) >= 6 and closes[-6] else None
        merged["return20dPct"] = (last / closes[-21] - 1) * 100 if closes[-21] else None
        recent = closes[-20:]
        changes = [(recent[i] / recent[i - 1] - 1) for i in range(1, len(recent)) if recent[i - 1]]
        merged["volatility20dPct"] = statistics.pstdev(changes) * 100 if len(changes) >= 5 else None
    return merged


def score(row: Dict[str, Any]) -> float:
    change = finite(row.get("changePct")) or 0.0
    r5 = finite(row.get("return5dPct")) or 0.0
    r20 = finite(row.get("return20dPct")) or 0.0
    vol = finite(row.get("volatility20dPct"))
    consistency = 10.0 if row.get("crossValidation", {}).get("valid") else 0.0
    coverage = sum(1 for key in ("price", "changePct", "volume", "return5dPct", "return20dPct") if finite(row.get(key)) is not None)
    raw = 0.35 * change + 0.25 * r5 + 0.20 * r20 + consistency + coverage * 2.0
    if vol is not None:
        raw -= max(0.0, vol - 5.0) * 0.5
    return round(raw, 4)


def main() -> None:
    symbols = discover_symbols()
    rows: Dict[str, Any] = {}
    for index, symbol in enumerate(symbols, 1):
        rows[symbol] = merge_symbol(symbol)
        rows[symbol]["score"] = score(rows[symbol])
        if index % 20 == 0:
            print(f"processed {index}/{len(symbols)}", flush=True)
    ranked = sorted(rows.values(), key=lambda x: (finite(x.get("score")) or -1e9), reverse=True)
    top20 = [
        {
            "rank": index + 1,
            "symbol": row["symbol"],
            "score": row["score"],
            "price": row.get("price"),
            "changePct": row.get("changePct"),
            "return5dPct": row.get("return5dPct"),
            "return20dPct": row.get("return20dPct"),
            "crossValid": row.get("crossValidation", {}).get("valid", False),
            "lineage": row.get("lineage", {}),
        }
        for index, row in enumerate(ranked[:20])
    ]
    output = {
        "ok": True,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "providerOrder": PROVIDER_ORDER,
        "universeSize": len(symbols),
        "top20": top20,
        "symbols": rows,
        "method": "API_SEQUENCE_REPOSITORY_V1",
        "notes": [
            "Providers are called in the configured order for every symbol.",
            "Lower-priority providers fill only missing fields.",
            "The ranking is an initial repository-native shadow score, not a guaranteed investment signal.",
        ],
    }
    target = os.path.join(os.path.dirname(__file__), "..", "data", "latest.json")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(output, handle, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {target} with {len(symbols)} symbols")


if __name__ == "__main__":
    main()
