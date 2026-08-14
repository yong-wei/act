#!/usr/bin/env python3
"""Export selected accepted Authority learning assets to the runtime namespace."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from common import (
    AUTHORING_CARDS,
    AUTHORING_INFOGRAPH_ROOT,
    DEFAULT_PROJECTION,
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


LEARNING_CONTENT_MANIFEST_CONTRACT = "act-authority-learning-content-manifest/v2"
AUTHORITY_SHARD_MANIFEST_CONTRACT = "act-authority-domain-shard-set/v1"
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projection", type=Path, default=DEFAULT_PROJECTION)
    parser.add_argument(
        "--authority-shard-manifest",
        type=Path,
        required=True,
        help="Immutable Authority shard-set manifest whose envelope seals this export.",
    )
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


def _non_empty_string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _authority_identity(
    manifest_path: Path,
    projection_path: Path,
    projection: dict,
) -> dict[str, str]:
    """Load the only Authority identity an export may claim.

    The shard-set manifest is immutable runtime evidence.  A projection must
    independently name the same audited release before cards or images are
    copied, so a command-line release string cannot create a mixed export.
    """
    payload = load_json(manifest_path)
    envelope = payload.get("envelope") if isinstance(payload, dict) else None
    authority = envelope.get("authority") if isinstance(envelope, dict) else None
    if payload.get("contract") != AUTHORITY_SHARD_MANIFEST_CONTRACT or not isinstance(authority, dict):
        raise ValueError("authority shard manifest is not a sealed shard-set manifest")

    identity = {
        "authorityReleaseId": _non_empty_string(authority.get("releaseId")),
        "authorityReleaseSetId": _non_empty_string(authority.get("releaseSetId")),
        "authoritySnapshotId": _non_empty_string(authority.get("snapshotId")),
        "authoritySnapshotHash": _non_empty_string(authority.get("snapshotHash")),
    }
    if not all(identity.values()) or not SHA256_RE.fullmatch(identity["authoritySnapshotHash"] or ""):
        raise ValueError("authority shard manifest has an invalid identity envelope")

    source_release = _non_empty_string(projection.get("source_release"))
    source_release_hash = _non_empty_string(projection.get("source_release_hash"))
    if source_release != identity["authorityReleaseId"] or not SHA256_RE.fullmatch(source_release_hash or ""):
        raise ValueError("projection source release does not match the Authority shard envelope")

    release_path = projection_path.parent / "release.json"
    release = load_json(release_path) if release_path.exists() else None
    if not isinstance(release, dict) or (
        release.get("id") != source_release
        or release.get("release_hash") != source_release_hash
    ):
        raise ValueError("projection release evidence is missing or does not match its source identity")
    identity["authorityReleaseVersion"] = _non_empty_string(release.get("release_version")) or ""
    if not identity["authorityReleaseVersion"]:
        raise ValueError("projection release evidence is missing its release version")
    return identity


def _card_release_matches(card_path: Path, identity: dict[str, str]) -> bool:
    if not card_path.exists():
        return False
    match = re.search(
        r"^authority_release_id:\s*[\"']?([^\"'\r\n]+)[\"']?\s*$",
        card_path.read_text(encoding="utf-8"),
        flags=re.MULTILINE,
    )
    return bool(match and match.group(1).strip() in {
        identity["authorityReleaseId"],
        identity["authorityReleaseVersion"],
    })


def _valid_learning_node(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    if not _non_empty_string(value.get("canonicalId")) or not _non_empty_string(value.get("safeId")):
        return False
    card = value.get("card")
    infograph = value.get("infograph")
    if not isinstance(card, dict) or not isinstance(infograph, dict):
        return False
    return (
        card.get("state") in {"available", "blocked", "missing"}
        and (card.get("sha256") is None or bool(SHA256_RE.fullmatch(str(card.get("sha256")))))
        and infograph.get("state") in {"available", "missing"}
        and (infograph.get("sha256") is None or bool(SHA256_RE.fullmatch(str(infograph.get("sha256")))))
    )


def _read_matching_existing_learning_manifest(
    path: Path,
    identity: dict[str, str],
) -> dict[str, dict]:
    """Return a complete v2 manifest only when it shares this sealed identity."""
    if not path.exists():
        raise ValueError("partial export requires an existing matching v2 learning-content manifest")
    payload = load_json(path)
    if not isinstance(payload, dict) or payload.get("contract") != LEARNING_CONTENT_MANIFEST_CONTRACT:
        raise ValueError("partial export refuses a legacy or invalid learning-content manifest")
    for field in (
        "authorityReleaseId",
        "authorityReleaseSetId",
        "authoritySnapshotId",
        "authoritySnapshotHash",
    ):
        if payload.get(field) != identity[field]:
            raise ValueError("partial export refuses a learning-content manifest from another Authority identity")
    nodes = payload.get("nodes")
    if not isinstance(nodes, list) or not all(_valid_learning_node(node) for node in nodes):
        raise ValueError("partial export refuses an invalid learning-content manifest")
    by_id = {node["canonicalId"]: node for node in nodes}
    if len(by_id) != len(nodes):
        raise ValueError("partial export refuses duplicate canonical ids")
    return by_id


def _merge_partial_learning_nodes(
    existing_nodes: dict[str, dict],
    fresh_nodes: list[dict],
    *,
    do_cards: bool,
    do_images: bool,
) -> list[dict]:
    """Update only the side a partial export actually processed."""
    merged_nodes = dict(existing_nodes)
    for node in fresh_nodes:
        previous = merged_nodes.get(node["canonicalId"])
        if previous is None:
            previous = {
                "canonicalId": node["canonicalId"],
                "safeId": node["safeId"],
                "card": {"state": "missing", "sha256": None},
                "infograph": {"state": "missing", "sha256": None},
            }
        merged_nodes[node["canonicalId"]] = {
            "canonicalId": node["canonicalId"],
            "safeId": node["safeId"],
            "card": node["card"] if do_cards else previous["card"],
            "infograph": node["infograph"] if do_images else previous["infograph"],
        }
    return sorted(merged_nodes.values(), key=lambda node: node["canonicalId"])


def main() -> None:
    args = parse_args()
    if args.cards_only and args.infographs_only:
        raise ValueError("--cards-only and --infographs-only cannot be combined")
    projection_path = args.projection.resolve()
    projection = load_domain_projection(projection_path)
    authority_identity = _authority_identity(
        args.authority_shard_manifest.resolve(),
        projection_path,
        projection,
    )
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

    existing_nodes: dict[str, dict] = {}
    if not args.dry_run and (args.cards_only or args.infographs_only):
        existing_nodes = _read_matching_existing_learning_manifest(
            RUNTIME_LEARNING_CONTENT_MANIFEST,
            authority_identity,
        )

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
            elif not _card_release_matches(src, authority_identity):
                cards_skipped += 1
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
            card_source = AUTHORING_CARDS / f"{safe_id}.md"
            if not _card_release_matches(card_source, authority_identity):
                images_skipped += 1
            elif not image.exists():
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
                "release_id": authority_identity["authorityReleaseId"],
                "count": len(infograph_nodes),
                "nodes": infograph_nodes,
            },
        )

    if (do_cards or do_images) and not args.dry_run:
        if args.cards_only or args.infographs_only:
            output_nodes = _merge_partial_learning_nodes(
                existing_nodes,
                learning_nodes,
                do_cards=do_cards,
                do_images=do_images,
            )
        else:
            output_nodes = learning_nodes
        write_json(
            RUNTIME_LEARNING_CONTENT_MANIFEST,
            {
                "contract": LEARNING_CONTENT_MANIFEST_CONTRACT,
                "authorityReleaseId": authority_identity["authorityReleaseId"],
                "authorityReleaseSetId": authority_identity["authorityReleaseSetId"],
                "authoritySnapshotId": authority_identity["authoritySnapshotId"],
                "authoritySnapshotHash": authority_identity["authoritySnapshotHash"],
                "nodes": sorted(output_nodes, key=lambda node: node["canonicalId"]),
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
