#!/usr/bin/env python3
"""Export DomainConcept inventory for authority knowledge cards."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from common import (
    AUTHORING_CARDS,
    AUTHORING_INFOGRAPH_ROOT,
    DEFAULT_PROJECTION,
    DEFAULT_RELEASE_ID,
    INVENTORY_JSON,
    authority_card_status,
    load_coverage_roles,
    load_domain_projection,
    index_domain_concepts,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projection", type=Path, default=DEFAULT_PROJECTION)
    parser.add_argument("--release-id", default=DEFAULT_RELEASE_ID)
    parser.add_argument("--out", type=Path, default=INVENTORY_JSON)
    parser.add_argument(
        "--csv",
        type=Path,
        default=None,
        help="Optional CSV path (default: sibling inventory.csv)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary only; do not write files",
    )
    return parser.parse_args()


def card_status(safe_id: str) -> str:
    return authority_card_status(AUTHORING_CARDS / f"{safe_id}.md")


def infograph_status(safe_id: str) -> str:
    root = AUTHORING_INFOGRAPH_ROOT / safe_id
    if not root.exists():
        return "missing"
    review = root / "review.json"
    image = root / "infograph.png"
    if image.exists() and review.exists():
        try:
            import json

            status = str(json.loads(review.read_text(encoding="utf-8")).get("status") or "")
        except Exception:
            status = ""
        if status.lower() == "accepted":
            return "accepted"
        if status.lower() == "rejected":
            return "rejected"
        return "needs_review"
    if (root / "prompt.md").exists() and (root / "source.json").exists():
        return "prepared"
    return "partial"


def main() -> None:
    args = parse_args()
    projection = load_domain_projection(args.projection)
    roles = load_coverage_roles()
    rows, _adj = index_domain_concepts(projection, roles)

    enriched: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["card_status"] = card_status(row["safe_id"])
        item["infograph_status"] = infograph_status(row["safe_id"])
        # drop bulky fields from inventory rows if needed later; keep description_len only
        item.pop("description", None)
        item.pop("evidence_refs", None)
        enriched.append(item)

    counts = {
        "total": len(enriched),
        "batch_A": sum(1 for r in enriched if r["batch"] == "A"),
        "batch_B": sum(1 for r in enriched if r["batch"] == "B"),
        "batch_C": sum(1 for r in enriched if r["batch"] == "C"),
        "cardable": sum(1 for r in enriched if r["cardable"]),
        "cards_ok": sum(1 for r in enriched if r["card_status"] == "ok"),
        "cards_blocked": sum(1 for r in enriched if r["card_status"] == "blocked"),
        "cards_missing": sum(1 for r in enriched if r["card_status"] == "missing"),
        "cards_invalid": sum(1 for r in enriched if r["card_status"] == "invalid"),
        "infographs_accepted": sum(1 for r in enriched if r["infograph_status"] == "accepted"),
        "infographs_prepared": sum(1 for r in enriched if r["infograph_status"] == "prepared"),
        "infographs_missing": sum(1 for r in enriched if r["infograph_status"] == "missing"),
    }

    payload = {
        "schema": "authority-card-manifest.v1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "release_id": args.release_id,
        "projection_path": str(args.projection.relative_to(args.projection.parents[5])
        if args.projection.is_absolute()
        else args.projection),
        "counts": counts,
        "nodes": enriched,
    }

    # simpler relative path
    try:
        from common import REPO_ROOT

        payload["projection_path"] = str(args.projection.resolve().relative_to(REPO_ROOT))
    except Exception:
        payload["projection_path"] = str(args.projection)

    print(
        f"DomainConcept inventory: total={counts['total']} "
        f"A={counts['batch_A']} B={counts['batch_B']} C={counts['batch_C']} "
        f"cardable={counts['cardable']} cards_ok={counts['cards_ok']} "
        f"cards_blocked={counts['cards_blocked']} "
        f"infographs_accepted={counts['infographs_accepted']}"
    )

    if args.dry_run:
        return

    write_json(args.out, payload)
    csv_path = args.csv or args.out.with_suffix(".csv")
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "entity_id",
        "safe_id",
        "name",
        "name_en",
        "description_len",
        "release_tier",
        "concept_kind",
        "degree",
        "coverage_role",
        "batch",
        "cardable",
        "card_status",
        "infograph_status",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in enriched:
            writer.writerow(row)
    print(f"wrote {args.out}")
    print(f"wrote {csv_path}")


if __name__ == "__main__":
    main()
