#!/usr/bin/env python3
"""Import and verify the immutable legacy Apps Script source.

Usage:
    python tools/import_legacy_source.py /path/to/V_141225.txt

The script normalizes only an optional UTF-8 BOM, preserves every remaining
character, writes the canonical source to apps-script/legacy/V_141225.original.gs,
and creates deterministic chunks for connector-friendly review.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

EXPECTED_SHA256 = "c380b93c4804533e866e79bdd36b44683afbbb973a318e0716862ce7b0dbaa0a"
CHUNK_LINES = 750


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--allow-hash-change", action="store_true")
    args = parser.parse_args()

    raw = args.source.read_text(encoding="utf-8-sig")
    digest = sha256_text(raw)

    if digest != EXPECTED_SHA256 and not args.allow_hash_change:
        raise SystemExit(
            "Source hash mismatch. Expected "
            f"{EXPECTED_SHA256}, received {digest}. "
            "Use --allow-hash-change only for an intentionally new source revision."
        )

    root = Path(__file__).resolve().parents[1]
    legacy_dir = root / "apps-script" / "legacy"
    chunks_dir = legacy_dir / "chunks"
    legacy_dir.mkdir(parents=True, exist_ok=True)
    chunks_dir.mkdir(parents=True, exist_ok=True)

    canonical = legacy_dir / "V_141225.original.gs"
    canonical.write_text(raw, encoding="utf-8", newline="")

    lines = raw.splitlines(keepends=True)
    manifest = {
        "source": canonical.as_posix(),
        "sha256": digest,
        "line_count": len(lines),
        "character_count": len(raw),
        "chunk_lines": CHUNK_LINES,
        "chunks": [],
    }

    for old in chunks_dir.glob("V_141225.part-*.gs"):
        old.unlink()

    for index, start in enumerate(range(0, len(lines), CHUNK_LINES), start=1):
        body = "".join(lines[start : start + CHUNK_LINES])
        name = f"V_141225.part-{index:02d}.gs"
        target = chunks_dir / name
        target.write_text(body, encoding="utf-8", newline="")
        manifest["chunks"].append(
            {
                "path": target.relative_to(root).as_posix(),
                "start_line": start + 1,
                "end_line": min(start + CHUNK_LINES, len(lines)),
                "sha256": sha256_text(body),
            }
        )

    manifest_path = legacy_dir / "source-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    reconstructed = "".join(
        (root / chunk["path"]).read_text(encoding="utf-8")
        for chunk in manifest["chunks"]
    )
    if reconstructed != raw:
        raise SystemExit("Chunk reconstruction failed: content differs from source")

    print(f"Imported {len(lines)} lines; SHA-256={digest}")
    print(f"Canonical: {canonical}")
    print(f"Manifest:  {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
