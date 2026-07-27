from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / 'scripts' / 'knowledge-extraction' / 'deepseek_extraction_experiment.py'
SPEC = importlib.util.spec_from_file_location('deepseek_extraction_experiment', SCRIPT_PATH)
assert SPEC and SPEC.loader
experiment = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = experiment
SPEC.loader.exec_module(experiment)


def test_extract_heading_section_uses_exact_boundaries() -> None:
    source = '# Root\n\n## Start\nA\nB\n\n## End\nC\n'

    section = experiment.extract_heading_section(source, '## Start', '## End')

    assert section == '## Start\nA\nB\n'


def test_fixed_prefix_and_request_are_byte_stable() -> None:
    config = {
        'model': 'deepseek-ai/DeepSeek-V4-Flash',
        'task_prompt': 'Extract once.',
        'temperature': 0,
        'max_tokens': 100,
        'enable_thinking': False,
    }
    section = experiment.SourceSection(
        source_id='source-1',
        authority='primary_semantic_authority',
        path='book/chapter.md',
        start_heading='## Start',
        end_heading='## End',
        content='## Start\nStable source text.\n',
    )

    first_pack = experiment.build_context_pack('pack-v1', [section])
    second_pack = experiment.build_context_pack('pack-v1', [section])
    first_messages = experiment.build_messages(config, 'Stable prefix\n', first_pack)
    second_messages = experiment.build_messages(config, 'Stable prefix\n', second_pack)
    first_request = experiment.build_request(config, first_messages)
    second_request = experiment.build_request(config, second_messages)

    assert first_pack == second_pack
    assert experiment.canonical_json(first_request) == experiment.canonical_json(second_request)
    assert experiment.sha256_text(experiment.canonical_json(first_messages[:2])) == experiment.sha256_text(
        experiment.canonical_json(second_messages[:2])
    )


def test_pilot_config_resolves_real_sections() -> None:
    config_path = REPO_ROOT / 'scripts' / 'knowledge-extraction' / 'pilot-transfer-function.json'
    config = experiment.load_json(config_path)

    sections = experiment.load_source_sections(config)
    context_pack = experiment.build_context_pack(config['pack_id'], sections)

    assert [section.source_id for section in sections] == [
        'hu-shousong-auto-control-7th:chapter-02:complex-domain-model',
        'feedback-control-of-dynamic-systems-7th:chapter-03:transfer-functions',
        'liu-sheng-auto-control-2015:chapter-03:complex-domain-model',
    ]
    assert '传递函数的定义和性质' in context_pack
    assert 'Transfer Functions and Frequency Response' in context_pack
    assert '传递函数定义' in context_pack


def test_span_context_is_deterministic_and_materializes_verbatim_quote() -> None:
    section = experiment.SourceSection(
        source_id='source-1', authority='primary_semantic_authority', path='book.md',
        start_heading='## Start', end_heading='## End', content='第一段证据。\n\n第二段证据。\n',
    )
    spans = experiment.build_source_spans([section])
    context = experiment.build_context_pack('span-pack', [section], evidence_mode='span_id')
    assert [span.span_id for span in spans] == ['s01-b0001', 's01-b0002']
    assert '<span id="s01-b0002">\n第二段证据。\n</span>' in context
    response = {
        'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({
            'pack_id': 'span-pack',
            'candidates': [{
                'canonical_name': '概念', 'aliases': [], 'definition': '定义',
                'semantic_boundary': '边界', 'independent_teaching_reason': '理由',
                'source_evidence': [{'source_id': 'source-1', 'span_id': 's01-b0002'}],
                'confidence': 'high',
            }],
            'rejected_items': [],
        })}}],
    }
    parsed = experiment.parse_candidate_output(
        response,
        expected_pack_id='span-pack',
        source_content_by_id={'source-1': section.content},
        source_span_by_id={span.span_id: span for span in spans},
    )
    assert parsed['candidates'][0]['source_evidence'][0]['quote'] == '第二段证据。'
    assert parsed['candidates'][0]['source_evidence'][0]['source_content_sha256'] == experiment.sha256_text(
        section.content
    )


def test_span_evidence_rejects_cross_source_reference() -> None:
    span = experiment.SourceSpan('s02-b0001', 'source-2', experiment.sha256_text('其他来源'), '其他来源')
    response = {
        'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({
            'pack_id': 'span-pack',
            'candidates': [{
                'canonical_name': '概念', 'aliases': [], 'definition': '定义',
                'semantic_boundary': '边界', 'independent_teaching_reason': '理由',
                'source_evidence': [{'source_id': 'source-1', 'span_id': span.span_id}],
                'confidence': 'high',
            }],
            'rejected_items': [],
        })}}],
    }
    try:
        experiment.parse_candidate_output(
            response,
            expected_pack_id='span-pack',
            source_content_by_id={'source-1': '正文', 'source-2': '其他来源'},
            source_span_by_id={span.span_id: span},
        )
    except experiment.ExperimentError as error:
        assert 'another source' in str(error)
    else:
        raise AssertionError('Cross-source span reference must fail closed')


def test_parse_candidate_output_requires_contract_fields() -> None:
    candidate = {
        'canonical_name': '传递函数',
        'aliases': ['Transfer function'],
        'definition': '定义',
        'semantic_boundary': '边界',
        'independent_teaching_reason': '理由',
        'source_evidence': [{'source_id': 'source-1', 'quote': '证据'}],
        'confidence': 'high',
    }
    response = {
        'choices': [{
            'finish_reason': 'stop',
            'message': {'content': json.dumps({
                'pack_id': 'pack-v1',
                'candidates': [candidate],
                'rejected_items': [],
            })},
        }],
    }

    parsed = experiment.parse_candidate_output(
        response,
        expected_pack_id='pack-v1',
        source_content_by_id={'source-1': '原文证据完整存在'},
    )

    assert parsed['candidates'][0]['canonical_name'] == '传递函数'


def test_parse_candidate_output_rejects_truncated_or_incomplete_contract() -> None:
    incomplete = {
        'choices': [{
            'finish_reason': 'length',
            'message': {'content': json.dumps({'pack_id': 'wrong-pack', 'candidates': []})},
        }],
    }

    try:
        experiment.parse_candidate_output(
            incomplete,
            expected_pack_id='pack-v1',
            source_content_by_id={'source-1': '证据'},
        )
    except experiment.ExperimentError as error:
        assert 'finish_reason' in str(error)
    else:
        raise AssertionError('Truncated output must fail closed')


def test_provider_accounting_requires_cache_usage_and_trace() -> None:
    response = {
        'id': 'response-1',
        'model': 'deepseek-ai/DeepSeek-V4-Flash',
        'usage': {
            'prompt_tokens': 10,
            'completion_tokens': 5,
            'total_tokens': 15,
            'prompt_cache_hit_tokens': 8,
            'prompt_cache_miss_tokens': 2,
        },
    }

    accounting = experiment.validate_provider_accounting(
        response,
        {'x-siliconcloud-trace-id': 'trace-1'},
    )

    assert accounting['trace_id'] == 'trace-1'
    assert accounting['usage']['prompt_cache_hit_tokens'] == 8


def test_run_artifacts_default_to_ignored_logs_directory() -> None:
    assert experiment.DEFAULT_OUTPUT_ROOT == REPO_ROOT / '.logs' / 'knowledge-extraction-experiments'
    with tempfile.TemporaryDirectory() as temp_dir:
        run_dir = experiment.make_run_directory(Path(temp_dir), 'pack-v1')
        assert run_dir.parent == Path(temp_dir)


def make_run_args(output_root: Path, *, repeat: int) -> SimpleNamespace:
    return SimpleNamespace(
        config=REPO_ROOT / 'scripts' / 'knowledge-extraction' / 'pilot-transfer-function.json',
        output_root=output_root,
        repeat=repeat,
        timeout_seconds=10,
        base_url='https://api.siliconflow.cn/v1',
        prepare_only=False,
    )


def complete_provider_response(content: str) -> dict[str, object]:
    return {
        'id': 'response-1',
        'model': 'deepseek-ai/DeepSeek-V4-Flash',
        'choices': [{'finish_reason': 'stop', 'message': {'content': content}}],
        'usage': {
            'prompt_tokens': 100,
            'completion_tokens': 20,
            'total_tokens': 120,
            'prompt_cache_hit_tokens': 90,
            'prompt_cache_miss_tokens': 10,
        },
    }


def test_invalid_model_json_preserves_raw_response_and_accounting() -> None:
    original_request_json = experiment.request_json
    original_api_key = os.environ.get(experiment.API_KEY_ENV)
    os.environ[experiment.API_KEY_ENV] = 'test-secret-that-must-not-be-written'

    def fake_request_json(*args: object, **kwargs: object) -> tuple[dict[str, object], dict[str, str]]:
        return complete_provider_response('{invalid-json'), {'x-siliconcloud-trace-id': 'trace-1'}

    experiment.request_json = fake_request_json
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_root = Path(temp_dir)
            result = experiment.run_experiment(make_run_args(output_root, repeat=1))
            assert result == 2

            run_dir = next(output_root.iterdir())
            assert (run_dir / 'run-01-response.json').exists()
            summary = json.loads((run_dir / 'run-01-summary.json').read_text(encoding='utf-8'))
            assert summary['state'] == 'failed'
            assert summary['usage']['prompt_cache_hit_tokens'] == 90
            assert summary['trace_id'] == 'trace-1'
            combined = ''.join(path.read_text(encoding='utf-8') for path in run_dir.iterdir())
            assert 'test-secret-that-must-not-be-written' not in combined
    finally:
        experiment.request_json = original_request_json
        if original_api_key is None:
            os.environ.pop(experiment.API_KEY_ENV, None)
        else:
            os.environ[experiment.API_KEY_ENV] = original_api_key


def test_repetitions_send_the_exact_same_request_without_hidden_retries() -> None:
    original_request_json = experiment.request_json
    original_api_key = os.environ.get(experiment.API_KEY_ENV)
    os.environ[experiment.API_KEY_ENV] = 'test-secret'
    request_bodies: list[str] = []
    content = json.dumps({
        'pack_id': 'transfer-function-pilot-v1',
        'candidates': [{
            'canonical_name': '传递函数',
            'aliases': ['Transfer function'],
            'definition': '定义',
            'semantic_boundary': '边界',
            'independent_teaching_reason': '理由',
            'source_evidence': [{
                'source_id': 'hu-shousong-auto-control-7th:chapter-02:complex-domain-model',
                'quote': '传递函数',
            }],
            'confidence': 'high',
        }],
        'rejected_items': [],
    }, ensure_ascii=False)

    def fake_request_json(*args: object, **kwargs: object) -> tuple[dict[str, object], dict[str, str]]:
        request_bodies.append(experiment.canonical_json(kwargs['body']))
        return complete_provider_response(content), {'x-siliconcloud-trace-id': 'trace-1'}

    experiment.request_json = fake_request_json
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            result = experiment.run_experiment(make_run_args(Path(temp_dir), repeat=3))
            assert result == 0
            assert len(request_bodies) == 3
            assert len(set(request_bodies)) == 1
    finally:
        experiment.request_json = original_request_json
        if original_api_key is None:
            os.environ.pop(experiment.API_KEY_ENV, None)
        else:
            os.environ[experiment.API_KEY_ENV] = original_api_key


def test_http_200_invalid_json_retains_raw_provider_body() -> None:
    original_urlopen = experiment.urllib.request.urlopen

    class FakeResponse:
        headers = {'x-siliconcloud-trace-id': 'trace-invalid-json'}

        def __enter__(self) -> 'FakeResponse':
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self) -> bytes:
            return b'{invalid-provider-json'

    experiment.urllib.request.urlopen = lambda *args, **kwargs: FakeResponse()
    try:
        try:
            experiment.request_json('https://provider.example/models', 'test-secret')
        except experiment.ProviderResponseDecodeError as error:
            assert error.response_body == '{invalid-provider-json'
            assert error.headers['x-siliconcloud-trace-id'] == 'trace-invalid-json'
        else:
            raise AssertionError('Invalid provider JSON must retain its raw body')
    finally:
        experiment.urllib.request.urlopen = original_urlopen


def test_http_200_non_object_json_retains_raw_provider_body() -> None:
    original_urlopen = experiment.urllib.request.urlopen

    class FakeResponse:
        headers = {'x-siliconcloud-trace-id': 'trace-non-object'}

        def __enter__(self) -> 'FakeResponse':
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self) -> bytes:
            return b'[]'

    experiment.urllib.request.urlopen = lambda *args, **kwargs: FakeResponse()
    try:
        try:
            experiment.request_json('https://provider.example/models', 'test-secret')
        except experiment.ProviderResponseDecodeError as error:
            assert error.response_body == '[]'
            assert error.headers['x-siliconcloud-trace-id'] == 'trace-non-object'
        else:
            raise AssertionError('Non-object provider JSON must retain its raw body')
    finally:
        experiment.urllib.request.urlopen = original_urlopen


def test_malformed_choices_still_produce_failure_summaries() -> None:
    original_request_json = experiment.request_json
    original_api_key = os.environ.get(experiment.API_KEY_ENV)
    os.environ[experiment.API_KEY_ENV] = 'test-secret'
    response = complete_provider_response('{}')
    response['choices'] = ['malformed-choice']

    def fake_request_json(*args: object, **kwargs: object) -> tuple[dict[str, object], dict[str, str]]:
        return response, {'x-siliconcloud-trace-id': 'trace-malformed-choice'}

    experiment.request_json = fake_request_json
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            output_root = Path(temp_dir)
            result = experiment.run_experiment(make_run_args(output_root, repeat=1))
            assert result == 2
            run_dir = next(output_root.iterdir())
            summary = json.loads((run_dir / 'run-01-summary.json').read_text(encoding='utf-8'))
            overall = json.loads((run_dir / 'summary.json').read_text(encoding='utf-8'))
            assert summary['failure_kind'] == 'response_validation_error'
            assert summary['finish_reason'] is None
            assert overall['state'] == 'completed_with_failures'
    finally:
        experiment.request_json = original_request_json
        if original_api_key is None:
            os.environ.pop(experiment.API_KEY_ENV, None)
        else:
            os.environ[experiment.API_KEY_ENV] = original_api_key


def main() -> None:
    tests = [
        test_extract_heading_section_uses_exact_boundaries,
        test_fixed_prefix_and_request_are_byte_stable,
        test_pilot_config_resolves_real_sections,
        test_span_context_is_deterministic_and_materializes_verbatim_quote,
        test_span_evidence_rejects_cross_source_reference,
        test_parse_candidate_output_requires_contract_fields,
        test_parse_candidate_output_rejects_truncated_or_incomplete_contract,
        test_provider_accounting_requires_cache_usage_and_trace,
        test_run_artifacts_default_to_ignored_logs_directory,
        test_invalid_model_json_preserves_raw_response_and_accounting,
        test_repetitions_send_the_exact_same_request_without_hidden_retries,
        test_http_200_invalid_json_retains_raw_provider_body,
        test_http_200_non_object_json_retains_raw_provider_body,
        test_malformed_choices_still_produce_failure_summaries,
    ]
    for test in tests:
        test()
    print('deepseek extraction experiment tests passed')


if __name__ == '__main__':
    main()
