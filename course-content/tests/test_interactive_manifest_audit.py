from __future__ import annotations

import importlib.util
import json
from pathlib import Path


def load_audit_module():
    module_path = (
        Path(__file__).resolve().parents[2]
        / '.agents'
        / 'skills'
        / 'interactive-design'
        / 'scripts'
        / 'audit_interactive_manifest.py'
    )
    spec = importlib.util.spec_from_file_location('audit_interactive_manifest', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


audit_interactive_manifest = load_audit_module()


def test_manifest_audit_reads_actual_shared_content_renderer_registry():
    manifest = {
        'lesson_id': 'demo',
        'steps': {
            'step-01': {
                'title': 'demo',
                'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                'modules': [
                    {
                        'id': 'custom-panel',
                        'region': 'main',
                        'kind': 'unit-private-panel',
                        'must_be_visible': True,
                        'payload': {'text': '有内容但没有共享 renderer。'},
                    }
                ],
                'content_blocks': {},
                'interaction_spec': {'interaction_kind': 'none'},
            }
        },
    }

    result = audit_interactive_manifest.audit_manifest(manifest)

    assert result['status'] == 'fail'
    assert result['implementation_sources']['content_renderer'].endswith('content-renderers.tsx')
    assert result['issues'][0]['issue'] == 'missing_shared_content_renderer'


def test_manifest_audit_catches_activity_prompt_repeated_in_content_blocks():
    prompt = '这个题面不能在正文和作答区重复出现。'
    manifest = {
        'lesson_id': 'demo',
        'steps': {
            'step-01': {
                'title': 'demo',
                'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                'modules': [
                    {'id': 'summary', 'region': 'main', 'kind': 'summary-card', 'must_be_visible': True, 'payload': {'text': prompt}},
                    {'id': 'card-a', 'region': 'main', 'kind': 'activity-card', 'must_be_visible': True, 'payload': {}},
                ],
                'content_blocks': {},
                'interaction_spec': {
                    'interaction_kind': 'activity_card_set',
                    'activity_cards': [{'id': 'card-a', 'prompt': prompt, 'response_kind': 'fill_text'}],
                },
            }
        },
    }

    result = audit_interactive_manifest.audit_manifest(manifest)

    assert result['status'] == 'fail'
    assert any(issue['issue'] == 'activity_prompt_repeated_in_content_blocks' for issue in result['issues'])


def test_manifest_audit_catches_activity_card_without_prompt():
    manifest = {
        'lesson_id': 'demo',
        'steps': {
            'step-01': {
                'title': 'demo',
                'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                'modules': [
                    {'id': 'card-a', 'region': 'main', 'kind': 'activity-card', 'must_be_visible': True, 'payload': {}},
                ],
                'content_blocks': {},
                'interaction_spec': {
                    'interaction_kind': 'activity_card_set',
                    'activity_cards': [{'id': 'card-a', 'prompt': '   ', 'response_kind': 'fill_text'}],
                },
            }
        },
    }

    result = audit_interactive_manifest.audit_manifest(manifest)

    assert result['status'] == 'fail'
    assert any(issue['issue'] == 'activity_card_without_prompt' for issue in result['issues'])


def test_manifest_audit_treats_title_only_payload_as_empty_content():
    manifest = {
        'lesson_id': 'demo',
        'steps': {
            'step-01': {
                'title': 'demo',
                'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                'modules': [
                    {
                        'id': 'empty-summary',
                        'region': 'main',
                        'kind': 'summary-card',
                        'must_be_visible': True,
                        'payload': {'title': '这个标题不能替代正文内容'},
                    }
                ],
                'content_blocks': {},
                'interaction_spec': {'interaction_kind': 'none'},
            }
        },
    }

    result = audit_interactive_manifest.audit_manifest(manifest)

    assert result['status'] == 'fail'
    assert any(issue['issue'] == 'empty_required_content_module' for issue in result['issues'])


def test_manifest_audit_treats_missing_content_block_reference_as_empty_content():
    manifest = {
        'lesson_id': 'demo',
        'steps': {
            'step-01': {
                'title': 'demo',
                'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                'modules': [
                    {
                        'id': 'rich-from-block',
                        'region': 'main',
                        'kind': 'content.rich',
                        'must_be_visible': True,
                        'payload': {'block_key': 'missing_block'},
                    },
                    {
                        'id': 'formula-from-block',
                        'region': 'main',
                        'kind': 'content.formula',
                        'must_be_visible': True,
                        'payload': {'formula_key': 'missing_formula'},
                    },
                    {
                        'id': 'figure-from-block',
                        'region': 'main',
                        'kind': 'content.figure',
                        'must_be_visible': True,
                        'payload': {'image_key': 'missing_image'},
                    },
                ],
                'content_blocks': {},
                'interaction_spec': {'interaction_kind': 'none'},
            }
        },
    }

    result = audit_interactive_manifest.audit_manifest(manifest)

    assert result['status'] == 'fail'
    empty_content_issues = [
        issue
        for issue in result['issues']
        if issue['issue'] == 'empty_required_content_module'
    ]
    assert len(empty_content_issues) == 3
    assert {issue['resolved_content_source'] for issue in empty_content_issues} == {
        'content_blocks.missing_block',
        'content_blocks.missing_formula',
        'content_blocks.missing_image',
    }


def test_manifest_audit_rejects_compute_panel_without_entry_payload():
    manifest = {
        'lesson_id': 'demo',
        'steps': {
            'step-01': {
                'title': 'demo',
                'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                'modules': [
                    {
                        'id': 'empty-compute-panel',
                        'region': 'main',
                        'kind': 'compute.panel',
                        'must_be_visible': True,
                        'payload': {'capabilityRef': 'interactive-figure'},
                    }
                ],
                'content_blocks': {},
                'interaction_spec': {'interaction_kind': 'none'},
            }
        },
    }

    result = audit_interactive_manifest.audit_manifest(manifest)

    assert result['status'] == 'fail'
    assert any(issue['issue'] == 'compute_panel_missing_entry_payload' for issue in result['issues'])


def test_review_script_uses_manifest_audit_as_blocking_gate(tmp_path):
    review_module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'review_lesson_content.py'
    spec = importlib.util.spec_from_file_location('review_lesson_content', review_module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {review_module_path}')
    review_lesson_content = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(review_lesson_content)

    manifest_path = tmp_path / 'interactive-manifest.json'
    manifest_path.write_text(
        json.dumps(
            {
                'lesson_id': 'demo',
                'steps': {
                    'step-01': {
                        'title': 'demo',
                        'layout': {'template': 'stacked_regions', 'regions': [{'id': 'main', 'width': 'full', 'order': 1}]},
                        'modules': [
                            {
                                'id': 'custom-panel',
                                'region': 'main',
                                'kind': 'unit-private-panel',
                                'must_be_visible': True,
                                'payload': {'text': '实现层私有模块'},
                            }
                        ],
                        'content_blocks': {},
                        'interaction_spec': {'interaction_kind': 'none'},
                    }
                },
            },
            ensure_ascii=False,
        ),
        encoding='utf-8',
    )

    _result, issues, summary = review_lesson_content.run_interactive_manifest_audit('demo', manifest_path)

    assert summary == ['manifest audit fail: 1 steps, 1 modules, 1 issues']
    assert any('missing_shared_content_renderer' in issue for issue in issues)
