#!/usr/bin/env python3
"""Register a generated authority infograph image into authoring namespace."""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime, timezone
from pathlib import Path

from common import (
    AUTHORING_INFOGRAPH_ROOT,
    load_json,
    path_basename,
    repo_relative_path,
    safe_entity_id,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entity-id", help="Authority entity_id (ctc:…)")
    parser.add_argument("--safe-id", help="Filesystem safe id")
    parser.add_argument("--image", required=True, help="Path to generated image")
    parser.add_argument(
        "--accept",
        action="store_true",
        help="Mark review.json as accepted after visual review",
    )
    parser.add_argument("--note", default="")
    parser.add_argument(
        "--provider",
        default="grok-image_gen",
        help="Recorded generation provider",
    )
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def main() -> None:
    args = parse_args()
    if not args.entity_id and not args.safe_id:
        raise SystemExit("Provide --entity-id or --safe-id")
    safe_id = args.safe_id or safe_entity_id(args.entity_id)
    out_dir = AUTHORING_INFOGRAPH_ROOT / safe_id
    source_path = out_dir / "source.json"
    prompt_path = out_dir / "prompt.md"
    if not source_path.exists() or not prompt_path.exists():
        raise SystemExit(
            f"Missing source/prompt under {out_dir}; run prepare_authority_infograph.py first"
        )

    image_path = Path(args.image).expanduser().resolve()
    if not image_path.exists():
        raise SystemExit(f"Image not found: {image_path}")

    target = out_dir / "infograph.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(image_path, target)

    source = load_json(source_path)
    write_json(
        out_dir / "generation.json",
        {
            "schema_version": 1,
            "created_at": now_iso(),
            "namespace": "authority",
            "entity_id": source.get("entity_id") or args.entity_id,
            "safe_id": safe_id,
            "generation_path": "native-image-generation",
            "provider": args.provider,
            "model": "grok-image_gen",
            # Keep external generator locations out of committed metadata.
            "source_image": path_basename(image_path),
            "output_image": repo_relative_path(target),
            "prompt_path": repo_relative_path(prompt_path),
            "source_path": repo_relative_path(source_path),
        },
    )
    write_json(
        out_dir / "review.json",
        {
            "schema_version": 1,
            "updated_at": now_iso(),
            "namespace": "authority",
            "entity_id": source.get("entity_id") or args.entity_id,
            "safe_id": safe_id,
            "node_name": (source.get("node") or {}).get("name"),
            "status": "accepted" if args.accept else "needs_review",
            "checks": {
                "source_json_exists": True,
                "prompt_md_exists": True,
                "image_exists": True,
                "no_obvious_text_corruption": bool(args.accept),
                "no_unsupported_fact_observed": bool(args.accept),
                "readable_at_entry_card_size": bool(args.accept),
            },
            "note": args.note,
        },
    )
    print(target.as_posix())
    print((out_dir / "generation.json").as_posix())
    print((out_dir / "review.json").as_posix())


if __name__ == "__main__":
    main()
