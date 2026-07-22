from __future__ import annotations

import json
import importlib.util
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'course-content' / 'scripts'))

from canonical_nodes import CanonicalNodeIndex
from knowledge_card_coverage import (
    assert_complete_knowledge_card_coverage,
    audit_knowledge_card_coverage,
    materialize_missing_knowledge_cards,
)


def load_export_module():
    path = ROOT / 'course-content' / 'scripts' / 'export_runtime.py'
    spec = importlib.util.spec_from_file_location('knowledge_card_coverage_export_test', path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {path}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_card(path: Path, node_id: str, body: str = 'Existing card') -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f'---\nnode_id: {node_id}\n---\n\n## 首页\n\n# {body}\n\n## 详情\n\n{body}\n',
        encoding='utf-8',
    )


def knowledge_nodes() -> dict[str, dict[str, object]]:
    return {
        'n-linked': {
            'id': 'n-linked',
            'name': '已关联节点',
            'definition': '已有完整 authoring 与 runtime 投影。',
        },
        'n-aliased': {
            'id': 'n-aliased',
            'name': '别名映射节点',
            'definition': 'authoring 卡片存在，但 runtime 投影缺失。',
        },
        'n-missing': {
            'id': 'n-missing',
            'name': '缺失节点',
            'category': '概念性',
            'bloom_level': '理解',
            'knowledge_type': 'C',
            'chapter': 2,
            'definition': '应由 authoring 图谱字段生成卡片。',
            'examples': ['示例一'],
            'formulas': ['G(s)=1/(s+1)'],
            'keywords': ['测试', '覆盖'],
        },
        'n-excluded': {
            'id': 'n-excluded',
            'name': '章节入口',
            'definition': '仅用于章节导航。',
        },
    }


def test_audit_classifies_linked_missing_invalid_and_excluded_nodes(tmp_path: Path) -> None:
    authoring_cards = tmp_path / 'authoring' / 'cards' / 'nodes'
    runtime_cards = tmp_path / 'runtime' / 'cards' / 'nodes'
    exclusions_path = tmp_path / 'authoring' / 'card-exclusions.json'
    canonical_index = CanonicalNodeIndex({
        'nodes': [
            {
                'canonical_node_id': 'n-aliased',
                'selected_card_node_id': 'legacy-n-aliased',
                'aliases': ['legacy-n-aliased'],
            },
        ],
    })

    write_card(authoring_cards / 'n-linked.md', 'n-linked')
    write_card(runtime_cards / 'n-linked.md', 'n-linked')
    write_card(authoring_cards / 'legacy-n-aliased.md', 'n-aliased')
    exclusions_path.parent.mkdir(parents=True, exist_ok=True)
    exclusions_path.write_text(json.dumps({
        'schema_version': 1,
        'exclusions': [
            {'node_id': 'n-excluded', 'reason': '章节导航入口，不承载独立知识内容。'},
        ],
    }, ensure_ascii=False), encoding='utf-8')

    report = audit_knowledge_card_coverage(
        knowledge_nodes(),
        authoring_cards=authoring_cards,
        runtime_cards=runtime_cards,
        exclusions_path=exclusions_path,
        canonical_index=canonical_index,
        require_runtime=True,
    )

    assert report['summary'] == {
        'total': 4,
        'linked': 1,
        'missing_authoring': 1,
        'invalid_mapping_or_runtime': 1,
        'excluded': 1,
    }
    assert {item['node_id']: item['disposition'] for item in report['items']} == {
        'n-aliased': 'invalid_mapping_or_runtime',
        'n-excluded': 'excluded',
        'n-linked': 'linked',
        'n-missing': 'missing_authoring',
    }
    with pytest.raises(ValueError, match='missing_authoring=1, invalid_mapping_or_runtime=1'):
        assert_complete_knowledge_card_coverage(report)


def test_materialize_missing_cards_uses_authoring_graph_fields_without_overwriting(tmp_path: Path) -> None:
    authoring_cards = tmp_path / 'authoring' / 'cards' / 'nodes'
    exclusions_path = tmp_path / 'authoring' / 'card-exclusions.json'
    exclusions_path.parent.mkdir(parents=True, exist_ok=True)
    exclusions_path.write_text(
        json.dumps({
            'schema_version': 1,
            'exclusions': [
                {'node_id': 'n-excluded', 'reason': '章节导航入口，不承载独立知识内容。'},
            ],
        }, ensure_ascii=False),
        encoding='utf-8',
    )
    existing_path = authoring_cards / 'n-linked.md'
    write_card(existing_path, 'n-linked', 'Do not replace')
    original = existing_path.read_text(encoding='utf-8')

    created = materialize_missing_knowledge_cards(
        knowledge_nodes(),
        authoring_cards=authoring_cards,
        exclusions_path=exclusions_path,
        canonical_index=CanonicalNodeIndex(),
        source_path='course-content/authoring/knowledge/base/knowledge_graph.json',
    )

    assert [path.name for path in created] == ['n-aliased.md', 'n-missing.md']
    assert existing_path.read_text(encoding='utf-8') == original
    assert not (authoring_cards / 'n-excluded.md').exists()

    generated = (authoring_cards / 'n-missing.md').read_text(encoding='utf-8')
    assert 'node_id: n-missing' in generated
    assert 'name: 缺失节点' in generated
    assert '## 首页' in generated
    assert '**一句话定义**：应由 authoring 图谱字段生成卡片。' in generated
    assert 'G(s)=1/(s+1)' in generated
    assert '示例一' in generated
    assert '## 详情' in generated


def test_global_export_writes_complete_card_coverage_manifest(tmp_path: Path, monkeypatch) -> None:
    module = load_export_module()
    authoring_root = tmp_path / 'course-content' / 'authoring'
    runtime_root = tmp_path / 'course-content' / 'runtime'
    node = {
        'id': 'n1',
        'name': '稳定性',
        'definition': '系统受扰后仍能保持有界。',
        'chapter': 3,
    }
    write_card(authoring_root / 'knowledge' / 'cards' / 'nodes' / 'n1.md', 'n1')
    exclusions_path = authoring_root / 'knowledge' / 'card-exclusions.json'
    exclusions_path.parent.mkdir(parents=True, exist_ok=True)
    exclusions_path.write_text(
        json.dumps({'schema_version': 1, 'exclusions': []}),
        encoding='utf-8',
    )

    monkeypatch.setattr(module, 'AUTHORING_ROOT', authoring_root)
    monkeypatch.setattr(module, 'RUNTIME_ROOT', runtime_root)
    monkeypatch.setattr(module, 'REPO_ROOT', tmp_path)
    monkeypatch.setattr(module, 'load_combined_authoring_graph', lambda: ({'n1': node}, []))
    monkeypatch.setattr(module, 'load_canonical_index', lambda: CanonicalNodeIndex())
    monkeypatch.setattr(module, 'copy_reviewed_infographs', lambda: {})
    monkeypatch.setattr(module, 'build_runtime_relations', lambda _nodes, _relations: [])

    runtime_nodes, _ = module.export_global_knowledge()

    coverage = json.loads(
        (runtime_root / 'knowledge' / 'cards' / 'coverage.json').read_text(encoding='utf-8')
    )
    assert coverage['summary'] == {
        'total': 1,
        'linked': 1,
        'missing_authoring': 0,
        'invalid_mapping_or_runtime': 0,
        'excluded': 0,
    }
    assert runtime_nodes[0]['resources'] == [
        'course-content/runtime/knowledge/cards/nodes/n1.md',
    ]
