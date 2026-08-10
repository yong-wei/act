#!/usr/bin/env python3
"""Normalize tracked authority infographic metadata path references."""

from __future__ import annotations

import argparse
from pathlib import Path

from common import (
    AUTHORING_CARDS,
    AUTHORING_INFOGRAPH_ROOT,
    load_json,
    path_basename,
    repo_relative_path,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=AUTHORING_INFOGRAPH_ROOT,
        help="Authority infographic package root",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report changes without rewriting metadata",
    )
    return parser.parse_args()


def normalize_source(source_path: Path, *, dry_run: bool) -> bool:
    payload = load_json(source_path)
    safe_id = str(payload.get("safe_id") or source_path.parent.name)
    expected = repo_relative_path(AUTHORING_CARDS / f"{safe_id}.md")
    if payload.get("card_path") == expected:
        return False
    payload["card_path"] = expected
    if not dry_run:
        write_json(source_path, payload)
    return True


def normalize_generation(generation_path: Path, *, dry_run: bool) -> bool:
    payload = load_json(generation_path)
    package_root = generation_path.parent
    source_image = payload.get("source_image")
    if not isinstance(source_image, str) or not source_image:
        raise ValueError(f"missing source_image: {generation_path}")

    updates = {
        # An external image may have lived in a private temp directory.  The
        # basename is sufficient to identify the input without leaking it.
        "source_image": path_basename(source_image),
        "output_image": repo_relative_path(package_root / "infograph.png"),
        "prompt_path": repo_relative_path(package_root / "prompt.md"),
        "source_path": repo_relative_path(package_root / "source.json"),
    }
    changed = any(payload.get(key) != value for key, value in updates.items())
    if changed:
        payload.update(updates)
        if not dry_run:
            write_json(generation_path, payload)
    return changed


def normalize(root: Path = AUTHORING_INFOGRAPH_ROOT, *, dry_run: bool = False) -> dict[str, int]:
    sources = generations = changed = 0
    for package_root in sorted(path for path in root.iterdir() if path.is_dir()):
        source_path = package_root / "source.json"
        generation_path = package_root / "generation.json"
        if source_path.exists():
            sources += 1
            changed += int(normalize_source(source_path, dry_run=dry_run))
        if generation_path.exists():
            generations += 1
            changed += int(normalize_generation(generation_path, dry_run=dry_run))
    return {"sources": sources, "generations": generations, "changed": changed}


def main() -> None:
    args = parse_args()
    stats = normalize(args.root, dry_run=args.dry_run)
    print(
        "normalized authority metadata: "
        f"sources={stats['sources']} generations={stats['generations']} "
        f"changed={stats['changed']} dry_run={args.dry_run}"
    )


if __name__ == "__main__":
    main()
