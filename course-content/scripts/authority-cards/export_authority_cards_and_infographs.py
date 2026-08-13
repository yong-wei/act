#!/usr/bin/env python3
"""Export selected accepted Authority learning assets to the runtime namespace."""

from __future__ import annotations

import argparse
import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path

from common import (
    AUTHORING_CARDS,
    AUTHORING_INFOGRAPH_ROOT,
    DEFAULT_PROJECTION,
    DEFAULT_RELEASE_ID,
    RUNTIME_CARDS,
    RUNTIME_INFOGRAPH_MANIFEST,
    RUNTIME_INFOGRAPH_ROOT,
    RUNTIME_LEARNING_CONTENT_MANIFEST,
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
    parser.add_argument("--batch", choices=["A", "B", "C", "all"], default="all")
    parser.add_argument("--entity-id", action="append", default=[], help="Only these DomainConcept entity ids")
    parser.add_argument("--cards-only", action="store_true")
    parser.add_argument("--infographs-only", action="store_true")
    parser.add_argument("--require-accepted", action="store_true", default=True)
    parser.add_argument(
        "--include-needs-review",
        action="store_true",
        help="Also export infographs that are needs_review (not recommended)",
    )
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def card_export_status(card_path: Path) -> str:
    """Return the fail-closed card status used by the runtime export gate."""
    return authority_card_status(card_path)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    args = parse_args()
    projection = load_domain_projection(args.projection)
    roles = load_coverage_roles()
    rows, _ = index_domain_concepts(projection, roles)
    if args.entity_id:
        selected = set(args.entity_id)
        rows = [row for row in rows if row["entity_id"] in selected]
    if args.batch != "all":
        rows = [row for row in rows if row["batch"] == args.batch]

    do_cards = not args.infographs_only
    do_images = not args.cards_only

    cards_exported = cards_missing = cards_skipped = 0
    images_exported = images_skipped = images_missing = 0
    infograph_nodes: list[dict] = []
    learning_nodes: list[dict] = []

    if do_cards and not args.dry_run:
        RUNTIME_CARDS.mkdir(parents=True, exist_ok=True)

    for row in rows:
        safe_id = row["safe_id"]
        card_state = "missing"
        card_sha256 = None
        infograph_state = "missing"
        infograph_sha256 = None

        if do_cards:
            src = AUTHORING_CARDS / f"{safe_id}.md"
            status = card_export_status(src)
            if status == "missing":
                cards_missing += 1
            elif status == "blocked":
                cards_skipped += 1
                card_state = "blocked"
            elif status != "ok":
                cards_skipped += 1
            else:
                if not args.dry_run:
                    dest = RUNTIME_CARDS / f"{safe_id}.md"
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dest)
                cards_exported += 1
                card_state = "available"
                card_sha256 = file_sha256(src)

        if do_images:
            root = AUTHORING_INFOGRAPH_ROOT / safe_id
            image = root / "infograph.png"
            review_path = root / "review.json"
            if not image.exists():
                images_missing += 1
            else:
                status = "unknown"
                if review_path.exists():
                    try:
                        status = str(load_json(review_path).get("status") or "unknown")
                    except Exception:
                        status = "unknown"
                accepted = status.lower() == "accepted" or (
                    args.include_needs_review and status.lower() in {"needs_review", "accepted"}
                )
                if not accepted:
                    images_skipped += 1
                else:
                    if not args.dry_run:
                        RUNTIME_INFOGRAPH_ROOT.mkdir(parents=True, exist_ok=True)
                        dest = RUNTIME_INFOGRAPH_ROOT / f"{safe_id}.png"
                        shutil.copy2(image, dest)
                    images_exported += 1
                    infograph_state = "available"
                    infograph_sha256 = file_sha256(image)
                    infograph_nodes.append(
                        {
                            "safe_id": safe_id,
                            "entity_id": row["entity_id"],
                            "name": row["name"],
                            "batch": row["batch"],
                            "runtime_path": f"nodes/{safe_id}.png",
                            "review_status": status,
                        }
                    )

        if do_cards or do_images:
            learning_nodes.append(
                {
                    "canonicalId": row["entity_id"],
                    "safeId": safe_id,
                    "card": {"state": card_state, "sha256": card_sha256},
                    "infograph": {"state": infograph_state, "sha256": infograph_sha256},
                }
            )

    if do_images and not args.dry_run:
        write_json(
            RUNTIME_INFOGRAPH_MANIFEST,
            {
                "schema": "authority-infograph-manifest.v1",
                "generated_at": now_iso(),
                "release_id": args.release_id,
                "count": len(infograph_nodes),
                "nodes": infograph_nodes,
            },
        )

    if (do_cards or do_images) and not args.dry_run:
        write_json(
            RUNTIME_LEARNING_CONTENT_MANIFEST,
            {
                "contract": "act-authority-learning-content-manifest/v1",
                "nodes": sorted(learning_nodes, key=lambda node: node["canonicalId"]),
            },
        )

    print(
        f"export: cards_exported={cards_exported} cards_missing={cards_missing} "
        f"cards_skipped={cards_skipped} "
        f"images_exported={images_exported} images_skipped={images_skipped} "
        f"images_missing={images_missing} dry_run={args.dry_run}"
    )
    if do_images and not args.dry_run:
        print(f"manifest: {RUNTIME_INFOGRAPH_MANIFEST}")
    if (do_cards or do_images) and not args.dry_run:
        print(f"learning manifest: {RUNTIME_LEARNING_CONTENT_MANIFEST}")


if __name__ == "__main__":
    main()
