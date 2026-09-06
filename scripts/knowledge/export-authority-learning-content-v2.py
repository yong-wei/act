#!/usr/bin/env python3
"""Scan runtime Authority cards/infographs into a v2 learning-content manifest."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARD_ROOT = ROOT / "course-content/runtime/knowledge/cards/authority/nodes"
INFOGRAPH_ROOT = ROOT / "course-content/runtime/knowledge/infographs/authority/nodes"
CATALOG = ROOT / "course-content/runtime/knowledge/authority-domain-catalog/catalog.json"
SHARDS_CURRENT = ROOT / "course-content/runtime/knowledge/authority-domain-shards/current.json"
AUTHORITY_CURRENT = ROOT / "course-content/authoring/knowledge/authority/current.json"
OUT = ROOT / "course-content/runtime/knowledge/authority-learning-content-manifest.json"
ENTITY_RE = re.compile(r"^authority_entity_id:\s*[\"']?([^\"'\r\n]+)", re.M)
STATUS_RE = re.compile(r"^status:\s*(\S+)", re.M)
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    catalog = json.loads(CATALOG.read_text())
    graph_ids = {row["canonicalId"] for row in catalog["memberships"]}
    shards = json.loads(SHARDS_CURRENT.read_text())
    authority = json.loads(AUTHORITY_CURRENT.read_text())
    cards = sorted(CARD_ROOT.glob("*.md"))
    infographs = {path.stem: path for path in INFOGRAPH_ROOT.glob("*.png")}
    nodes: list[dict] = []
    failures: list[str] = []
    seen: set[str] = set()
    for card_path in cards:
        if not SAFE_ID_RE.fullmatch(card_path.stem):
            failures.append(f"unsafe-safeId:{card_path.name}")
            continue
        text = card_path.read_text(encoding="utf-8")
        entity = ENTITY_RE.search(text)
        if not entity:
            failures.append(f"missing-entity:{card_path.name}")
            continue
        canonical_id = entity.group(1).strip()
        if canonical_id in seen:
            failures.append(f"duplicate-entity:{canonical_id}")
            continue
        seen.add(canonical_id)
        if canonical_id not in graph_ids:
            failures.append(f"unmapped-card:{canonical_id}")
            continue
        infograph = infographs.get(card_path.stem)
        if infograph is None:
            failures.append(f"missing-infograph:{card_path.stem}")
            continue
        status = STATUS_RE.search(text)
        blocked = (status.group(1) if status else "") == "draft-blocked"
        nodes.append({
            "canonicalId": canonical_id,
            "safeId": card_path.stem,
            "card": {
                "state": "blocked" if blocked else "available",
                "sha256": None if blocked else sha256(card_path),
            },
            "infograph": {"state": "available", "sha256": sha256(infograph)},
        })
    extra_infographs = set(infographs) - {node["safeId"] for node in nodes}
    for stem in sorted(extra_infographs):
        failures.append(f"unmapped-infograph:{stem}")
    if failures:
        sys.stderr.write("learning-content export failed:\n" + "\n".join(failures[:50]) + "\n")
        return 1
    payload = {
        "contract": "act-authority-learning-content-manifest/v2",
        "authorityReleaseId": shards["releaseId"],
        "authorityReleaseSetId": authority["releaseSetId"],
        "authoritySnapshotId": shards["snapshotId"],
        "authoritySnapshotHash": shards["snapshotHash"],
        "nodes": sorted(nodes, key=lambda row: row["canonicalId"]),
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} nodes={len(nodes)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
