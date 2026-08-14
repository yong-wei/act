#!/usr/bin/env python3
"""Print / write authority card + infograph status report."""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from common import (
    AUTHORING_CARDS,
    AUTHORING_INFOGRAPH_ROOT,
    DEFAULT_PROJECTION,
    DEFAULT_RELEASE_ID,
    STATUS_JSON,
    authority_card_status,
    index_domain_concepts,
    load_coverage_roles,
    load_domain_projection,
    load_json,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projection", type=Path, default=DEFAULT_PROJECTION)
    parser.add_argument("--release-id", default=DEFAULT_RELEASE_ID)
    parser.add_argument("--out", type=Path, default=STATUS_JSON)
    parser.add_argument("--json-only", action="store_true")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def main() -> None:
    args = parse_args()
    projection = load_domain_projection(args.projection)
    roles = load_coverage_roles()
    rows, _ = index_domain_concepts(projection, roles)

    card_status = Counter()
    image_status = Counter()
    batch_cards = Counter()
    batch_images = Counter()
    blocked: list[dict] = []
    missing_cards: list[str] = []
    missing_images: list[str] = []

    for row in rows:
        safe_id = row["safe_id"]
        card_path = AUTHORING_CARDS / f"{safe_id}.md"
        cs = authority_card_status(card_path)
        card_status[cs] += 1
        if cs == "missing":
            missing_cards.append(safe_id)
        elif cs == "blocked":
            blocked.append({"safe_id": safe_id, "entity_id": row["entity_id"], "reason": "description_too_short"})
        batch_cards[f"{row['batch']}:{cs}"] += 1

        root = AUTHORING_INFOGRAPH_ROOT / safe_id
        image = root / "infograph.png"
        review = root / "review.json"
        if not root.exists():
            image_status["missing"] += 1
            missing_images.append(safe_id)
            ist = "missing"
        elif image.exists() and review.exists():
            try:
                st = str(load_json(review).get("status") or "unknown").lower()
            except Exception:
                st = "unknown"
            image_status[st] += 1
            ist = st
        elif (root / "prompt.md").exists():
            image_status["prepared"] += 1
            ist = "prepared"
        else:
            image_status["partial"] += 1
            ist = "partial"
        batch_images[f"{row['batch']}:{ist}"] += 1

    total = len(rows)
    payload = {
        "schema": "authority-card-status.v1",
        "generated_at": now_iso(),
        "release_id": args.release_id,
        "total_domain_concepts": total,
        "cards": dict(card_status),
        "infographs": dict(image_status),
        "batch_cards": dict(batch_cards),
        "batch_images": dict(batch_images),
        "identity_check": {
            "cards_ok_plus_blocked_plus_missing_plus_invalid": sum(card_status.values()),
            "equals_total": sum(card_status.values()) == total,
        },
        "blocked_sample": blocked[:50],
        "missing_cards_count": len(missing_cards),
        "missing_images_count": len(missing_images),
        "missing_cards_sample": missing_cards[:30],
        "missing_images_sample": missing_images[:30],
    }
    write_json(args.out, payload)

    if not args.json_only:
        print(f"Authority card status ({args.release_id})")
        print(f"  total DomainConcept: {total}")
        print(f"  cards: {dict(card_status)}")
        print(f"  infographs: {dict(image_status)}")
        print(f"  batch cards: {dict(batch_cards)}")
        print(f"  batch images: {dict(batch_images)}")
        print(f"  identity ok: {payload['identity_check']['equals_total']}")
        print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
