"""Targeted course enrichment must preserve unrelated assets and publication identity."""
import importlib.util
import json
from pathlib import Path

import pytest


def fixture(tmp_path):
    script = Path(__file__).resolve().parents[3] / "scripts/knowledge/export-authority-learning-content-v2.py"
    spec = importlib.util.spec_from_file_location("bound_card_export", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    for name in ("CARD_ROOT", "AUTHORING_CARD_ROOT", "INFOGRAPH_ROOT"):
        directory = tmp_path / name
        directory.mkdir()
        setattr(module, name, directory)
    identity = {"snapshotId": "snap-" + "a" * 64, "snapshotHash": "a" * 64, "releaseId": "ctr:release:test", "releaseSetId": "set-test"}
    for name, body in {
        "CATALOG": {"authorityBinding": identity, "memberships": [{"canonicalId": "ctc:target"}, {"canonicalId": "ctc:other"}]},
        "SHARDS_CURRENT": identity,
        "AUTHORITY_CURRENT": identity,
        "OVERLAY_CURRENT": {"projectionId": "proj-" + "b" * 64, "projectionHash": "b" * 64},
    }.items():
        file = tmp_path / (name + ".json")
        file.write_text(json.dumps(body), encoding="utf-8")
        setattr(module, name, file)
    module.OUT = tmp_path / "learning.json"
    source = module.AUTHORING_CARD_ROOT / "ctc_target.md"
    source.write_text("---\nauthority_entity_id: ctc:target\nauthority_release_id: ctr:release:test\ncontent_origin: act-course-enrichment\nstatus: ready\n---\n**一句话定义**：完整定义\n### 完整解释\n已有课程材料的解释。\n", encoding="utf-8")
    (module.CARD_ROOT / "ctc_target.md").write_text("authority_entity_id: ctc:target\nstatus: draft-blocked\n", encoding="utf-8")
    (module.CARD_ROOT / "ctc_other.md").write_text("authority_entity_id: ctc:other\n", encoding="utf-8")
    for safe_id in ("ctc_target", "ctc_other"):
        (module.INFOGRAPH_ROOT / (safe_id + ".png")).write_bytes(b"existing-image")
    return module, source


def test_copies_only_selected_cards_and_keeps_the_teaching_seal(tmp_path):
    module, source = fixture(tmp_path)
    other = (module.CARD_ROOT / "ctc_other.md").read_bytes()
    assert module.main(["--copy-authoring-card", "ctc_target"]) == 0
    assert (module.CARD_ROOT / "ctc_target.md").read_bytes() == source.read_bytes()
    assert (module.CARD_ROOT / "ctc_other.md").read_bytes() == other
    assert (module.INFOGRAPH_ROOT / "ctc_target.png").read_bytes() == b"existing-image"
    manifest = json.loads(module.OUT.read_text())
    assert manifest["authoritySnapshotHash"] == "a" * 64
    assert manifest["teachingProjectionId"] == "proj-" + "b" * 64
    assert len(manifest["nodes"]) == 2
    assert all(node["card"]["state"] == "available" for node in manifest["nodes"])


@pytest.mark.parametrize("drift", ["entity", "status", "authority", "selection"])
def test_rejects_unqualified_sources_before_runtime_writes(tmp_path, drift):
    module, source = fixture(tmp_path)
    before = (module.CARD_ROOT / "ctc_target.md").read_bytes()
    text = source.read_text()
    if drift == "entity":
        text = text.replace("ctc:target", "ctc:other")
    elif drift == "status":
        text = text.replace("status: ready", "status: draft-blocked")
    elif drift == "authority":
        text = text.replace("ctr:release:test", "ctr:release:other")
    else:
        selection = json.loads(module.AUTHORITY_CURRENT.read_text())
        selection["releaseSetId"] = "other-set"
        module.AUTHORITY_CURRENT.write_text(json.dumps(selection))
    source.write_text(text)
    with pytest.raises(SystemExit):
        module.main(["--copy-authoring-card", "ctc_target"])
    assert (module.CARD_ROOT / "ctc_target.md").read_bytes() == before
    assert not module.OUT.exists()


def test_rejects_a_source_change_before_copying(tmp_path, monkeypatch):
    module, source = fixture(tmp_path)
    before = (module.CARD_ROOT / "ctc_target.md").read_bytes()
    original_hash = module.sha256
    mutated = False

    def changing_hash(file):
        nonlocal mutated
        if file == source and not mutated:
            source.write_text(source.read_text() + "changed\n")
            mutated = True
        return original_hash(file)

    monkeypatch.setattr(module, "sha256", changing_hash)
    with pytest.raises(SystemExit, match="source changed"):
        module.main(["--copy-authoring-card", "ctc_target"])
    assert (module.CARD_ROOT / "ctc_target.md").read_bytes() == before
    assert not module.OUT.exists()
