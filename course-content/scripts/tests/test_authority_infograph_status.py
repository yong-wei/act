"""Structural tests for authority card and infographic metadata contracts."""

from __future__ import annotations

import csv
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path
from pathlib import PurePosixPath

REPO = Path(__file__).resolve().parents[3]
AUTHORITY_SCRIPTS = REPO / "course-content" / "scripts" / "authority-cards"
if str(AUTHORITY_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(AUTHORITY_SCRIPTS))

from common import AUTHORING_CARDS, authority_card_status  # noqa: E402
from export_authority_cards_and_infographs import card_export_status  # noqa: E402
from export_domainconcept_inventory import infograph_status  # noqa: E402
from normalize_authority_infograph_metadata import normalize  # noqa: E402


INFOGRAPH_ROOT = (
    REPO / "course-content" / "authoring" / "knowledge" / "infographs" / "authority" / "nodes"
)
CARDS_ROOT = REPO / "course-content" / "authoring" / "knowledge" / "cards" / "authority"
INVENTORY_JSON = CARDS_ROOT / "inventory.json"
INVENTORY_CSV = CARDS_ROOT / "inventory.csv"
STATUS_JSON = CARDS_ROOT / "status.json"


def _assert_repo_reference(value: object, *, must_exist: bool = True) -> None:
    assert isinstance(value, str) and value, value
    assert not value.startswith(("/", "~")), value
    assert "\\" not in value, value
    assert not any(marker in value for marker in ("/Users/", "/private/", "/tmp/")), value
    assert value.startswith("course-content/"), value
    path = REPO / value
    if must_exist:
        assert path.exists(), value


def _disk_infograph_status(safe_id: str) -> str:
    return infograph_status(safe_id)


def test_domainconcept_infograph_counts_identity():
    """Every DomainConcept package has a review status and preserved image."""
    assert INFOGRAPH_ROOT.exists(), f"missing {INFOGRAPH_ROOT}"
    accepted = prepared = rejected = other = 0
    for directory in INFOGRAPH_ROOT.iterdir():
        if not directory.is_dir():
            continue
        image = directory / "infograph.png"
        review = directory / "review.json"
        prompt = directory / "prompt.md"
        if image.exists() and review.exists():
            status = str(json.loads(review.read_text(encoding="utf-8")).get("status") or "").lower()
            if status == "accepted":
                accepted += 1
                generation = directory / "generation.json"
                assert generation.exists(), f"accepted without generation.json: {directory.name}"
                payload = json.loads(generation.read_text(encoding="utf-8"))
                path = str(payload.get("generation_path") or payload.get("provider") or "")
                assert "image" in path.lower() or "grok" in path.lower() or payload.get("provider"), payload
                assert image.stat().st_size > 1000, f"empty image {directory.name}"
            elif status == "rejected":
                rejected += 1
            else:
                other += 1
        elif prompt.exists():
            prepared += 1
        else:
            other += 1
    total = accepted + prepared + rejected + other
    assert (total, accepted) == (1236, 1236)


def test_metadata_paths_are_relative_and_resolvable():
    """Source/generation records cannot leak workstation or temporary paths."""
    source_count = generation_count = 0
    for directory in INFOGRAPH_ROOT.iterdir():
        if not directory.is_dir():
            continue
        source_path = directory / "source.json"
        generation_path = directory / "generation.json"
        source = json.loads(source_path.read_text(encoding="utf-8"))
        generation = json.loads(generation_path.read_text(encoding="utf-8"))
        assert source["safe_id"] == directory.name
        _assert_repo_reference(source["card_path"])
        source_count += 1

        for field in ("output_image", "prompt_path", "source_path"):
            _assert_repo_reference(generation[field])
        source_image = generation["source_image"]
        assert isinstance(source_image, str) and source_image
        assert "/" not in source_image and "\\" not in source_image
        assert source_image == PurePosixPath(source_image).name
        generation_count += 1
    assert (source_count, generation_count) == (1236, 1236)

    queue = json.loads((CARDS_ROOT / "generate-queue.json").read_text(encoding="utf-8"))
    for item in queue.get("items", []):
        _assert_repo_reference(item["prompt_path"])
        _assert_repo_reference(item["out_dir"])

    assert normalize(dry_run=True) == {"sources": 1236, "generations": 1236, "changed": 0}


def test_inventory_status_matches_cards_infographs_and_status_report():
    """Inventory, status report, and current disk projection describe one state."""
    inventory = json.loads(INVENTORY_JSON.read_text(encoding="utf-8"))
    status = json.loads(STATUS_JSON.read_text(encoding="utf-8"))
    nodes = inventory["nodes"]
    assert len(nodes) == 1236
    card_counts = Counter(row["card_status"] for row in nodes)
    image_counts = Counter(row["infograph_status"] for row in nodes)
    assert card_counts == Counter({"ok": 952, "blocked": 284})
    assert image_counts == Counter({"accepted": 1236})
    assert inventory["counts"]["cards_ok"] == 952
    assert inventory["counts"]["cards_blocked"] == 284
    assert inventory["counts"]["infographs_accepted"] == 1236
    assert status["cards"] == {"ok": 952, "blocked": 284}
    assert status["infographs"] == {"accepted": 1236}
    assert status["identity_check"]["equals_total"] is True

    for row in nodes:
        safe_id = row["safe_id"]
        assert row["card_status"] == authority_card_status(AUTHORING_CARDS / f"{safe_id}.md")
        assert row["infograph_status"] == _disk_infograph_status(safe_id)

    with INVENTORY_CSV.open(encoding="utf-8", newline="") as handle:
        csv_rows = list(csv.DictReader(handle))
    assert len(csv_rows) == 1236
    assert Counter(row["card_status"] for row in csv_rows) == card_counts
    assert Counter(row["infograph_status"] for row in csv_rows) == image_counts


def test_default_export_gate_skips_draft_blocked_cards_without_runtime_writes():
    """The default export reports accepted cards only and leaves images independent."""
    card_counts = Counter(
        card_export_status(AUTHORING_CARDS / f"{path.stem}.md")
        for path in AUTHORING_CARDS.glob("*.md")
    )
    assert card_counts == Counter({"ok": 952, "blocked": 284})

    script = AUTHORITY_SCRIPTS / "export_authority_cards_and_infographs.py"
    result = subprocess.run(
        [sys.executable, str(script), "--dry-run"],
        cwd=REPO,
        check=True,
        capture_output=True,
        text=True,
    )
    assert "cards_exported=952" in result.stdout
    assert "cards_skipped=284" in result.stdout
    assert "images_exported=1236" in result.stdout
