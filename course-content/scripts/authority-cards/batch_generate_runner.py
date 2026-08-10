#!/usr/bin/env python3
"""List authority nodes ready for Grok image_gen batch generation.

This script does NOT call image_gen itself (that is an agent/session tool).
It emits a queue of prepared prompts missing images for the agent to process.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from common import (
    AUTHORING_INFOGRAPH_ROOT,
    DEFAULT_PROJECTION,
    INVENTORY_DIR,
    index_domain_concepts,
    load_coverage_roles,
    load_domain_projection,
    repo_relative_path,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projection", type=Path, default=DEFAULT_PROJECTION)
    parser.add_argument("--batch", choices=["A", "B", "C", "all"], default="A")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Queue JSON path (default inventory/generate-queue.json)",
    )
    parser.add_argument(
        "--only-prepared-missing-image",
        action="store_true",
        default=True,
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    projection = load_domain_projection(args.projection)
    roles = load_coverage_roles()
    rows, _ = index_domain_concepts(projection, roles)
    if args.batch != "all":
        rows = [r for r in rows if r["batch"] == args.batch]

    queue: list[dict] = []
    for row in rows:
        root = AUTHORING_INFOGRAPH_ROOT / row["safe_id"]
        prompt = root / "prompt.md"
        image = root / "infograph.png"
        review = root / "review.json"
        if not prompt.exists():
            continue
        if image.exists():
            # already has image
            if review.exists():
                try:
                    st = json.loads(review.read_text(encoding="utf-8")).get("status")
                except Exception:
                    st = None
                if str(st).lower() == "accepted":
                    continue
            else:
                continue
        queue.append(
            {
                "entity_id": row["entity_id"],
                "safe_id": row["safe_id"],
                "name": row["name"],
                "batch": row["batch"],
                "prompt_path": repo_relative_path(prompt),
                "out_dir": repo_relative_path(root),
            }
        )

    slice_q = queue[args.offset : args.offset + args.limit if args.limit else None]
    out = args.out or (INVENTORY_DIR / "generate-queue.json")
    write_json(
        out,
        {
            "batch": args.batch,
            "offset": args.offset,
            "limit": args.limit,
            "pending_total": len(queue),
            "queue_size": len(slice_q),
            "items": slice_q,
        },
    )
    print(f"pending_total={len(queue)} queue_size={len(slice_q)} wrote {out}")
    for i, item in enumerate(slice_q, 1):
        print(f"{i}. [{item['batch']}] {item['safe_id']}  {item['name'][:40]}")


if __name__ == "__main__":
    main()
