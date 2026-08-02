"""Content-addressed provenance controls for historical source data."""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class RawAsset:
    dataset: str
    source_name: str
    source_url: str
    retrieved_at: str
    sha256: str
    byte_count: int
    relative_path: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def register_raw_asset(
    source_file: Path,
    raw_root: Path,
    dataset: str,
    source_name: str,
    source_url: str,
    retrieved_at: datetime | None = None,
) -> RawAsset:
    """Store a raw asset once under its content hash; existing bytes are never replaced."""
    if not source_file.is_file() or source_file.stat().st_size == 0:
        raise ValueError("raw source file must exist and be non-empty")
    if not source_url.startswith(("https://", "http://")):
        raise ValueError("source_url must be an absolute HTTP(S) URL")

    digest = sha256_file(source_file)
    suffix = "".join(source_file.suffixes)
    destination = raw_root / dataset / digest[:2] / f"{digest}{suffix}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if sha256_file(destination) != digest:
            raise RuntimeError("content-address collision detected")
    else:
        destination.write_bytes(source_file.read_bytes())
        destination.chmod(0o444)

    timestamp = (retrieved_at or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()
    asset = RawAsset(
        dataset=dataset,
        source_name=source_name,
        source_url=source_url,
        retrieved_at=timestamp,
        sha256=digest,
        byte_count=destination.stat().st_size,
        relative_path=str(destination.relative_to(raw_root)),
    )
    manifest = destination.with_suffix(destination.suffix + ".manifest.json")
    encoded = json.dumps(asdict(asset), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if manifest.exists() and manifest.read_text(encoding="utf-8") != encoded:
        raise RuntimeError("raw manifest is immutable")
    if not manifest.exists():
        manifest.write_text(encoded, encoding="utf-8")
        manifest.chmod(0o444)
    return asset


def reproducibility_fingerprint(*assets: RawAsset, code_version: str, parameters: dict[str, object]) -> str:
    """Return a deterministic fingerprint for a processed dataset build."""
    payload = {
        "assets": sorted((asdict(asset) for asset in assets), key=lambda item: item["sha256"]),
        "code_version": code_version,
        "parameters": parameters,
    }
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    ).hexdigest()
