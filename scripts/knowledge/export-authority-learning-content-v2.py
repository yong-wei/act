#!/usr/bin/env python3
"""Scan runtime Authority cards/infographs into a v2 learning-content manifest.

The teaching seal (teachingProjectionId/teachingProjectionHash) is written by
this script from the live domain-fragments overlay pointer; hand-edited or
stale manifests are rejected by scripts/knowledge/check-authority-surface-linkage.mjs.
"""

from __future__ import annotations

import hashlib
import argparse
import json
import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARD_ROOT = ROOT / "course-content/runtime/knowledge/cards/authority/nodes"
AUTHORING_CARD_ROOT = ROOT / "course-content/authoring/knowledge/cards/authority/nodes"
INFOGRAPH_ROOT = ROOT / "course-content/runtime/knowledge/infographs/authority/nodes"
CATALOG = ROOT / "course-content/runtime/knowledge/authority-domain-catalog/catalog.json"
SHARDS_CURRENT = ROOT / "course-content/runtime/knowledge/authority-domain-shards/current.json"
AUTHORITY_CURRENT = ROOT / "course-content/authoring/knowledge/authority/current.json"
OVERLAY_CURRENT = ROOT / "course-content/runtime/knowledge/teaching-projection/domain-fragments/current.json"
OUT = ROOT / "course-content/runtime/knowledge/authority-learning-content-manifest.json"
ENTITY_RE = re.compile(r"^authority_entity_id:\s*[\"']?([^\"'\r\n]+)", re.M)
STATUS_RE = re.compile(r"^status:\s*(\S+)", re.M)
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_teaching_seal() -> dict[str, str]:
    """Read the overlay envelope seal; missing or malformed pointer fails closed (#2045 task 1.1)."""
    if not OVERLAY_CURRENT.is_file():
        raise SystemExit(f"teaching seal source is missing: {OVERLAY_CURRENT.relative_to(ROOT)}")
    overlay = json.loads(OVERLAY_CURRENT.read_text())
    projection_id = overlay.get("projectionId")
    projection_hash = overlay.get("projectionHash")
    if not isinstance(projection_id, str) or not projection_id.startswith("proj-"):
        raise SystemExit(f"teaching seal projectionId is malformed: {projection_id!r}")
    if not isinstance(projection_hash, str) or len(projection_hash) != 64:
        raise SystemExit(f"teaching seal projectionHash is malformed: {projection_hash!r}")
    return {"teachingProjectionId": projection_id, "teachingProjectionHash": projection_hash}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--copy-authoring-card", action="append", default=[], metavar="SAFE_ID")
    args = parser.parse_args(argv)
    catalog = json.loads(CATALOG.read_text())
    graph_ids = {row["canonicalId"] for row in catalog["memberships"]}
    shards = json.loads(SHARDS_CURRENT.read_text())
    authority = json.loads(AUTHORITY_CURRENT.read_text())
    seal = load_teaching_seal()
    copies: dict[str, Path] = {}
    source_hashes: dict[str, str] = {}
    if args.copy_authoring_card:
        binding = catalog.get("authorityBinding", {})
        if any(authority.get(key) != shards.get(key) or binding.get(key) != shards.get(key)
               for key in ("snapshotId", "snapshotHash", "releaseId")):
            raise SystemExit("course card export refuses mixed Authority identities")
        if not authority.get("releaseSetId") or authority.get("releaseSetId") != binding.get("releaseSetId"):
            raise SystemExit("course card export refuses mixed Authority release sets")
        for safe_id in sorted(set(args.copy_authoring_card)):
            if not SAFE_ID_RE.fullmatch(safe_id):
                raise SystemExit("course card export received an unsafe id")
            source = AUTHORING_CARD_ROOT / f"{safe_id}.md"
            if not source.is_file() or source.is_symlink():
                raise SystemExit(f"course card source is absent: {safe_id}")
            source_bytes = source.read_bytes()
            text = source_bytes.decode("utf-8")
            entity = ENTITY_RE.search(text)
            if (not entity or entity.group(1).strip().replace(":", "_") != safe_id
                    or entity.group(1).strip() not in graph_ids
                    or not re.search(r"^content_origin:\s*act-course-enrichment\s*$", text, re.M)
                    or not re.search(r"^status:\s*ready\s*$", text, re.M)
                    or not re.search(r"^authority_release_id:\s*" + re.escape(shards["releaseId"]) + r"\s*$", text, re.M)
                    or "**一句话定义**" not in text or "### 完整解释" not in text):
                raise SystemExit(f"course card source is not qualified: {safe_id}")
            copies[safe_id] = source
            source_hashes[safe_id] = hashlib.sha256(source_bytes).hexdigest()
    card_paths = {path.stem: path for path in CARD_ROOT.glob("*.md")}
    card_paths.update(copies)
    cards = sorted(card_paths.values(), key=lambda path: path.stem)
    if not cards:
        # Empty-directory protection: a missing runtime card set must never
        # silently publish an empty manifest (#2045 task 1.2).
        sys.stderr.write(f"learning-content export failed:\nempty-card-dir:{CARD_ROOT}\n")
        return 1
    if not INFOGRAPH_ROOT.is_dir():
        sys.stderr.write(f"learning-content export failed:\nmissing-infograph-dir:{INFOGRAPH_ROOT}\n")
        return 1
    infographs = {path.stem: path for path in INFOGRAPH_ROOT.glob("*.png")}
    nodes: list[dict] = []
    failures: list[str] = []
    missing_infographs = 0
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
        status = STATUS_RE.search(text)
        blocked = (status.group(1) if status else "") == "draft-blocked"
        infograph = infographs.get(card_path.stem)
        if infograph is None:
            # A card without an infograph is a content gap, not an export
            # failure; register it as `missing` so consumers degrade honestly
            # (#2045 task 1.2). Cards are still mandatory.
            missing_infographs += 1
            nodes.append({
                "canonicalId": canonical_id,
                "safeId": card_path.stem,
                "card": {
                    "state": "blocked" if blocked else "available",
                    "sha256": None if blocked else sha256(card_path),
                },
                "infograph": {"state": "missing", "sha256": None},
            })
            continue
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
    if not nodes:
        sys.stderr.write("learning-content export failed:\nempty-manifest\n")
        return 1
    payload = {
        "contract": "act-authority-learning-content-manifest/v2",
        "authorityReleaseId": shards["releaseId"],
        "authorityReleaseSetId": authority["releaseSetId"],
        "authoritySnapshotId": shards["snapshotId"],
        "authoritySnapshotHash": shards["snapshotHash"],
        **seal,
        "nodes": sorted(nodes, key=lambda row: row["canonicalId"]),
    }
    if any(sha256(source) != source_hashes[safe_id] for safe_id, source in copies.items()):
        raise SystemExit("course card source changed during export")
    for safe_id, source in copies.items():
        with tempfile.NamedTemporaryFile(dir=CARD_ROOT, prefix=f".{safe_id}-", suffix=".tmp", delete=False) as temporary:
            temporary_path = Path(temporary.name)
        try:
            shutil.copy2(source, temporary_path)
            if sha256(temporary_path) != source_hashes[safe_id] or source_hashes[safe_id] != next(node["card"]["sha256"] for node in nodes if node["safeId"] == safe_id):
                raise SystemExit(f"course card changed during export: {safe_id}")
            os.replace(temporary_path, CARD_ROOT / f"{safe_id}.md")
        finally:
            temporary_path.unlink(missing_ok=True)
    with tempfile.NamedTemporaryFile(dir=OUT.parent, prefix=".learning-content-", suffix=".tmp", mode="w", encoding="utf-8", delete=False) as temporary:
        temporary.write(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, OUT)
    print(
        f"wrote {OUT.relative_to(ROOT)} nodes={len(nodes)} "
        f"missingInfographs={missing_infographs} seal={seal['teachingProjectionId']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
