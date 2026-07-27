from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / 'scripts' / 'knowledge-extraction' / 'minimal_recall_experiment.py'
SPEC = importlib.util.spec_from_file_location('minimal_recall_experiment', SCRIPT_PATH)
assert SPEC and SPEC.loader
experiment = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = experiment
SPEC.loader.exec_module(experiment)


def provider_response(candidates: list[dict[str, object]]) -> dict[str, object]:
    return {
        'choices': [{
            'finish_reason': 'stop',
            'message': {'content': json.dumps({
                'protocol_id': experiment.PROTOCOL_ID,
                'pack_id': 'pack-v1',
                'candidates': candidates,
            }, ensure_ascii=False)},
        }],
    }


def candidate(label: str, hint: str = '用于区分身份') -> dict[str, object]:
    return {
        'candidate_label': label,
        'identity_hint': hint,
        'source_evidence': [{'source_id': 'source-1', 'span_id': 's01-b0001'}],
    }


def parse(response: dict[str, object]) -> dict[str, object]:
    span = experiment.base.SourceSpan(
        span_id='s01-b0001',
        source_id='source-1',
        source_content_sha256=experiment.base.sha256_text('逐字证据'),
        content='逐字证据',
    )
    return experiment.parse_minimal_output(
        response,
        expected_pack_id='pack-v1',
        source_content_by_id={'source-1': '逐字证据'},
        source_span_by_id={span.span_id: span},
    )


def test_minimal_schema_accepts_only_identity_fields_and_materializes_evidence() -> None:
    parsed = parse(provider_response([candidate('传递函数')]))

    result = parsed['candidates'][0]
    assert set(result) == {'candidate_label', 'identity_hint', 'source_evidence'}
    assert result['source_evidence'][0]['quote'] == '逐字证据'
    assert result['source_evidence'][0]['source_content_sha256'] == experiment.base.sha256_text('逐字证据')

    invalid = candidate('频率响应')
    invalid['definition'] = '本阶段禁止生成定义'
    try:
        parse(provider_response([invalid]))
    except experiment.base.ExperimentError as error:
        assert 'fields must be exactly' in str(error)
    else:
        raise AssertionError('Additional semantic attributes must fail closed')


def test_minimal_schema_rejects_illegal_span() -> None:
    invalid = candidate('传递函数')
    invalid['source_evidence'] = [{'source_id': 'source-1', 'span_id': 's01-b9999'}]

    try:
        parse(provider_response([invalid]))
    except experiment.base.ExperimentError as error:
        assert 'unknown span_id' in str(error)
    else:
        raise AssertionError('Unknown span IDs must fail closed')


def test_minimal_schema_rejects_duplicate_labels() -> None:
    try:
        parse(provider_response([candidate('比例环节'), candidate('比例环节')]))
    except experiment.base.ExperimentError as error:
        assert 'Duplicate candidate_label' in str(error)
    else:
        raise AssertionError('Duplicate labels must fail closed')


def test_comparison_report_tracks_union_intersection_jaccard_and_unresolved_queue() -> None:
    runs = [
        (1, {'candidates': [candidate('A'), candidate('B'), candidate('R')]}),
        (2, {'candidates': [candidate('AliasA'), candidate('B'), candidate('U')]}),
        (3, {'candidates': [candidate('A'), candidate('C'), candidate('U')]}),
    ]

    report = experiment.build_comparison_report(
        runs,
        accepted={'A', 'B', 'C'},
        aliases={'AliasA': 'A'},
        rejected={'R'},
    )

    assert report['union']['accepted_identity_count'] == 3
    assert report['classification'] == 'experimental-provisional'
    assert report['runtime_eligible'] is False
    assert report['union']['accepted_identity_recall'] == 1.0
    assert report['union']['provisional_false_identity_count'] == 2
    assert report['intersection']['accepted_identities'] == ['A']
    assert [item['jaccard'] for item in report['pairwise_jaccard']] == [0.5, 0.2, 0.5]
    queue = {item['candidate_label']: item for item in report['unresolved_mapping_queue']}
    assert queue['R']['gold_status'] == 'known_rejected'
    assert queue['R']['occurrence_count'] == 1
    assert queue['U']['gold_status'] == 'not_in_frozen_gold'
    assert queue['U']['runs'] == [2, 3]


def test_default_config_reuses_transfer_function_span_pack_and_flash_model() -> None:
    config = experiment.base.load_json(experiment.DEFAULT_CONFIG)
    sections = experiment.base.load_source_sections(config)
    spans = experiment.base.build_source_spans(sections)
    context = experiment.base.build_context_pack(config['pack_id'], sections, evidence_mode='span_id')
    prefix = (experiment.DEFAULT_CONFIG.parent / config['prompt_prefix_path']).read_text(encoding='utf-8')
    messages = experiment.base.build_messages(config, prefix, context)
    request = experiment.base.build_request(config, messages)

    assert config['pack_id'] == 'transfer-function-pilot-span-v1'
    assert request['model'] == 'deepseek-ai/DeepSeek-V4-Flash'
    assert request['enable_thinking'] is False
    assert len(sections) == 3
    assert spans
    assert experiment.base.canonical_json(request) == experiment.base.canonical_json(
        experiment.base.build_request(config, experiment.base.build_messages(config, prefix, context))
    )


def test_runner_sends_three_identical_requests_and_writes_comparison() -> None:
    original_request_json = experiment.base.request_json
    original_api_key = os.environ.get(experiment.base.API_KEY_ENV)
    os.environ[experiment.base.API_KEY_ENV] = 'test-secret-that-must-not-be-written'
    request_bodies: list[str] = []
    source_id = 'hu-shousong-auto-control-7th:chapter-02:complex-domain-model'
    content = json.dumps({
        'protocol_id': experiment.PROTOCOL_ID,
        'pack_id': 'transfer-function-pilot-span-v1',
        'candidates': [{
            'candidate_label': '传递函数',
            'identity_hint': '输入输出拉普拉斯变换之比所表示的系统模型身份',
            'source_evidence': [{'source_id': source_id, 'span_id': 's01-b0001'}],
        }],
    }, ensure_ascii=False)

    def fake_request_json(*args: object, **kwargs: object) -> tuple[dict[str, object], dict[str, str]]:
        request_bodies.append(experiment.base.canonical_json(kwargs['body']))
        return {
            'id': f'response-{len(request_bodies)}',
            'model': 'deepseek-ai/DeepSeek-V4-Flash',
            'choices': [{'finish_reason': 'stop', 'message': {'content': content}}],
            'usage': {
                'prompt_tokens': 100,
                'completion_tokens': 20,
                'total_tokens': 120,
                'prompt_cache_hit_tokens': 90,
                'prompt_cache_miss_tokens': 10,
            },
        }, {'x-siliconcloud-trace-id': f'trace-{len(request_bodies)}'}

    experiment.base.request_json = fake_request_json
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            args = SimpleNamespace(
                config=experiment.DEFAULT_CONFIG,
                output_root=Path(temp_dir),
                repeat=3,
                timeout_seconds=10,
                base_url=experiment.base.DEFAULT_BASE_URL,
                prepare_only=False,
            )
            result = experiment.run_experiment(args)
            run_dir = next(Path(temp_dir).iterdir())
            report = json.loads((run_dir / 'comparison-report.json').read_text(encoding='utf-8'))
            metadata = json.loads((run_dir / 'experiment-metadata.json').read_text(encoding='utf-8'))
            summary = json.loads((run_dir / 'summary.json').read_text(encoding='utf-8'))
            combined = ''.join(path.read_text(encoding='utf-8') for path in run_dir.iterdir())

            assert result == 0
            assert len(request_bodies) == 3
            assert len(set(request_bodies)) == 1
            assert report['successful_run_count'] == 3
            assert report['intersection']['accepted_identities'] == ['传递函数']
            for artifact in (metadata, summary, report):
                assert artifact['classification'] == 'experimental-provisional'
                assert artifact['runtime_eligible'] is False
            assert 'test-secret-that-must-not-be-written' not in combined
    finally:
        experiment.base.request_json = original_request_json
        if original_api_key is None:
            os.environ.pop(experiment.base.API_KEY_ENV, None)
        else:
            os.environ[experiment.base.API_KEY_ENV] = original_api_key


def main() -> None:
    tests = [
        test_minimal_schema_accepts_only_identity_fields_and_materializes_evidence,
        test_minimal_schema_rejects_illegal_span,
        test_minimal_schema_rejects_duplicate_labels,
        test_comparison_report_tracks_union_intersection_jaccard_and_unresolved_queue,
        test_default_config_reuses_transfer_function_span_pack_and_flash_model,
        test_runner_sends_three_identical_requests_and_writes_comparison,
    ]
    for test in tests:
        test()
    print('minimal recall experiment tests passed')


if __name__ == '__main__':
    main()
