import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import export_runtime as exporter


def test_retired_node_uses_new_card_path_and_rejects_drift(tmp_path, monkeypatch):
    monkeypatch.setattr(exporter, 'REPO_ROOT', tmp_path)
    monkeypatch.setattr(exporter, 'AUTHORING_ROOT', tmp_path / 'authoring')
    monkeypatch.setattr(exporter, 'RUNTIME_ROOT', tmp_path / 'runtime')
    authority = {'releaseId': 'test', 'releaseSetId': 'set', 'snapshotId': 'snapshot', 'snapshotHash': 'a' * 64}
    authority_path = tmp_path / 'authoring/knowledge/authority/current.json'
    authority_path.parent.mkdir(parents=True)
    authority_path.write_text(json.dumps(authority))
    card = tmp_path / 'runtime/knowledge/cards/authority/nodes/ctc_target.md'
    card.parent.mkdir(parents=True)
    card.write_text('new content')
    record = {'contract': 'act-reviewed-card-replacements/v1', 'status': 'accepted', 'authority': authority,
              'rows': [{'cardId': 'ctc_target', 'sha256': hashlib.sha256(card.read_bytes()).hexdigest(),
                        'retiredResourceIds': ['act:card:old-node']}]}
    record_path = tmp_path / 'authoring/knowledge/resource-bindings/card-replacements.json'
    record_path.parent.mkdir(parents=True)
    record_path.write_text(json.dumps(record))
    nodes = exporter.build_runtime_nodes({'old-node': {'id': 'old-node', 'name': '旧语义节点'}}, {})
    assert nodes[0]['id'] == 'old-node'
    assert nodes[0]['resources'] == ['runtime/knowledge/cards/authority/nodes/ctc_target.md']
    card.write_text('changed')
    with pytest.raises(ValueError, match='hash drift'):
        exporter.build_runtime_nodes({'old-node': {'id': 'old-node', 'name': '旧语义节点'}}, {})
