from __future__ import annotations

import hashlib
import json
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, Iterable, TypeVar
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pandas as pd

T = TypeVar("T")


@dataclass(frozen=True)
class RuntimeConfig:
    root: Path = Path("data")
    cache_dir: Path = Path(".cache/behavior-dna")
    retries: int = 5
    timeout: float = 45.0
    rate_per_second: float = 2.0
    workers: int = 4


class RateLimiter:
    def __init__(self, rate: float) -> None:
        self.interval = 0.0 if rate <= 0 else 1.0 / rate
        self._lock = threading.Lock()
        self._last = 0.0

    def wait(self) -> None:
        with self._lock:
            delay = self.interval - (time.monotonic() - self._last)
            if delay > 0:
                time.sleep(delay)
            self._last = time.monotonic()


class CollectorRuntime:
    def __init__(self, source: str, config: RuntimeConfig | None = None) -> None:
        self.source = source
        self.config = config or RuntimeConfig()
        self.raw_dir = self.config.root / "raw" / source
        self.processed_dir = self.config.root / "processed" / source
        self.state_dir = self.config.root / "state" / source
        for path in (self.raw_dir, self.processed_dir, self.state_dir, self.config.cache_dir):
            path.mkdir(parents=True, exist_ok=True)
        self.limiter = RateLimiter(self.config.rate_per_second)

    def request(self, url: str, *, method: str = "GET", headers: dict[str, str] | None = None,
                body: bytes | None = None, cache_key: str | None = None) -> bytes:
        key = cache_key or hashlib.sha256((method + url + str(body)).encode()).hexdigest()
        cached = self.config.cache_dir / f"{key}.bin"
        if cached.exists():
            return cached.read_bytes()
        error: Exception | None = None
        for attempt in range(self.config.retries):
            self.limiter.wait()
            try:
                request = Request(url, data=body, method=method, headers={
                    "User-Agent": "bist-behavior-dna/0.3 (+https://github.com/netadalet-oss/bist-ai-top20)",
                    "Accept": "application/json,text/csv,text/html,*/*",
                    **(headers or {}),
                })
                with urlopen(request, timeout=self.config.timeout) as response:
                    payload = response.read()
                digest = hashlib.sha256(payload).hexdigest()
                raw = self.raw_dir / f"{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{digest}.bin"
                if not raw.exists():
                    raw.write_bytes(payload)
                    raw.chmod(0o444)
                    raw.with_suffix(".json").write_text(json.dumps({
                        "source": self.source, "url": url, "method": method,
                        "retrieved_at": datetime.now(UTC).isoformat(), "sha256": digest,
                        "bytes": len(payload), "headers": headers or {},
                    }, ensure_ascii=False, indent=2), encoding="utf-8")
                cached.write_bytes(payload)
                return payload
            except (HTTPError, URLError, TimeoutError) as exc:
                error = exc
                if isinstance(exc, HTTPError) and exc.code not in {408, 429, 500, 502, 503, 504}:
                    raise
                time.sleep(min(60.0, (2 ** attempt) + random.random()))
        raise RuntimeError(f"request failed after {self.config.retries} attempts: {url}") from error

    def map_parallel(self, fn: Callable[[T], Any], items: Iterable[T]) -> list[Any]:
        with ThreadPoolExecutor(max_workers=self.config.workers) as pool:
            futures = [pool.submit(fn, item) for item in items]
            return [future.result() for future in as_completed(futures)]

    def state(self, name: str) -> dict[str, Any]:
        path = self.state_dir / f"{name}.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def save_state(self, name: str, value: dict[str, Any]) -> None:
        path = self.state_dir / f"{name}.json"
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        temp.replace(path)

    def write_table(self, name: str, frame: pd.DataFrame, keys: list[str]) -> Path:
        if frame.empty:
            raise ValueError(f"refusing to write empty dataset: {name}")
        missing = [column for column in keys if column not in frame.columns]
        if missing:
            raise ValueError(f"{name} missing schema keys: {missing}")
        frame = frame.drop_duplicates(keys, keep="last").sort_values(keys).reset_index(drop=True)
        path = self.processed_dir / f"{name}.parquet"
        if path.exists():
            previous = pd.read_parquet(path)
            frame = pd.concat([previous, frame], ignore_index=True).drop_duplicates(keys, keep="last")
            frame = frame.sort_values(keys).reset_index(drop=True)
        temp = path.with_suffix(".tmp.parquet")
        frame.to_parquet(temp, index=False)
        digest = hashlib.sha256(temp.read_bytes()).hexdigest()
        temp.replace(path)
        path.with_suffix(".metadata.json").write_text(json.dumps({
            "source": self.source, "dataset": name, "rows": len(frame),
            "columns": list(frame.columns), "keys": keys, "sha256": digest,
            "generated_at": datetime.now(UTC).isoformat(), "runtime": asdict(self.config),
        }, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return path
