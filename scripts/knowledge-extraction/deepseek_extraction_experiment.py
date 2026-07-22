#!/usr/bin/env python3
"""Run a reproducible SiliconFlow knowledge-node extraction experiment."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = Path(__file__).with_name('pilot-transfer-function.json')
DEFAULT_OUTPUT_ROOT = REPO_ROOT / '.logs' / 'knowledge-extraction-experiments'
DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1'
API_KEY_ENV = 'SILICONFLOW_API_KEY'


class ExperimentError(RuntimeError):
    """Raised when the experiment contract or provider response is invalid."""


class ProviderRequestError(ExperimentError):
    """Raised for an HTTP response that must be preserved as experiment evidence."""

    def __init__(self, status: int, response_body: str, headers: dict[str, str]) -> None:
        super().__init__(f'Provider returned HTTP {status}')
        self.status = status
        self.response_body = response_body
        self.headers = headers


class ProviderResponseDecodeError(ExperimentError):
    """Raised when a successful HTTP response is not valid provider JSON."""

    def __init__(self, response_body: str, headers: dict[str, str]) -> None:
        super().__init__('Provider returned HTTP 200 with an invalid JSON body')
        self.response_body = response_body
        self.headers = headers


@dataclass(frozen=True)
class SourceSection:
    source_id: str
    authority: str
    path: str
    start_heading: str
    end_heading: str
    content: str


@dataclass(frozen=True)
class SourceSpan:
    span_id: str
    source_id: str
    source_content_sha256: str
    content: str


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        raise ExperimentError(f'Cannot load JSON from {path}: {error}') from error
    if not isinstance(value, dict):
        raise ExperimentError(f'Expected a JSON object in {path}')
    return value


def extract_heading_section(text: str, start_heading: str, end_heading: str) -> str:
    lines = text.splitlines()
    try:
        start = lines.index(start_heading)
    except ValueError as error:
        raise ExperimentError(f'Missing start heading: {start_heading}') from error
    try:
        end = lines.index(end_heading, start + 1)
    except ValueError as error:
        raise ExperimentError(f'Missing end heading after start: {end_heading}') from error
    section = '\n'.join(lines[start:end]).strip()
    if not section:
        raise ExperimentError(f'Empty section between {start_heading} and {end_heading}')
    return section + '\n'


def load_source_sections(config: dict[str, Any]) -> list[SourceSection]:
    raw_sources = config.get('sources')
    if not isinstance(raw_sources, list) or not raw_sources:
        raise ExperimentError('Config must declare a non-empty sources array')

    sections: list[SourceSection] = []
    seen_ids: set[str] = set()
    for raw_source in raw_sources:
        if not isinstance(raw_source, dict):
            raise ExperimentError('Every source entry must be an object')
        required = ('source_id', 'authority', 'path', 'start_heading', 'end_heading')
        missing = [key for key in required if not isinstance(raw_source.get(key), str) or not raw_source[key]]
        if missing:
            raise ExperimentError(f'Source entry is missing string fields: {missing}')

        source_id = raw_source['source_id']
        if source_id in seen_ids:
            raise ExperimentError(f'Duplicate source_id: {source_id}')
        seen_ids.add(source_id)

        relative_path = Path(raw_source['path'])
        if relative_path.is_absolute() or '..' in relative_path.parts:
            raise ExperimentError(f'Source path must stay inside the repository: {relative_path}')
        source_path = REPO_ROOT / relative_path
        try:
            source_text = source_path.read_text(encoding='utf-8')
        except OSError as error:
            raise ExperimentError(f'Cannot read source {source_path}: {error}') from error

        sections.append(SourceSection(
            source_id=source_id,
            authority=raw_source['authority'],
            path=relative_path.as_posix(),
            start_heading=raw_source['start_heading'],
            end_heading=raw_source['end_heading'],
            content=extract_heading_section(
                source_text,
                raw_source['start_heading'],
                raw_source['end_heading'],
            ),
        ))
    return sections


def build_source_spans(sections: list[SourceSection]) -> list[SourceSpan]:
    spans: list[SourceSpan] = []
    for source_index, section in enumerate(sections, start=1):
        blocks = [block.strip() for block in section.content.split('\n\n') if block.strip()]
        spans.extend(
            SourceSpan(
                span_id=f's{source_index:02d}-b{block_index:04d}',
                source_id=section.source_id,
                source_content_sha256=sha256_text(section.content),
                content=block,
            )
            for block_index, block in enumerate(blocks, start=1)
        )
    return spans


def build_context_pack(
    pack_id: str,
    sections: list[SourceSection],
    *,
    evidence_mode: str = 'verbatim_quote',
) -> str:
    if evidence_mode not in {'verbatim_quote', 'span_id'}:
        raise ExperimentError(f'Unsupported evidence_mode: {evidence_mode}')
    spans_by_source: dict[str, list[SourceSpan]] = {}
    if evidence_mode == 'span_id':
        for span in build_source_spans(sections):
            spans_by_source.setdefault(span.source_id, []).append(span)
    blocks = [
        '<authoritative_context_pack>',
        f'<pack_id>{pack_id}</pack_id>',
        '<cache_contract>此上下文包属于固定前缀。除非来源内容或版本发生变化，否则不得改变字节内容或排序。</cache_contract>',
    ]
    for section in sections:
        blocks.extend([
            f'<source id="{section.source_id}" authority="{section.authority}">',
            f'<path>{section.path}</path>',
            f'<selection start="{section.start_heading}" end_exclusive="{section.end_heading}" />',
            f'<content_sha256>{sha256_text(section.content)}</content_sha256>',
            '<content>',
        ])
        if evidence_mode == 'span_id':
            for span in spans_by_source[section.source_id]:
                blocks.extend([f'<span id="{span.span_id}">', span.content, '</span>'])
        else:
            blocks.append(section.content.rstrip('\n'))
        blocks.extend(['</content>', '</source>'])
    blocks.append('</authoritative_context_pack>')
    return '\n'.join(blocks) + '\n'


def build_messages(config: dict[str, Any], prompt_prefix: str, context_pack: str) -> list[dict[str, str]]:
    task_prompt = config.get('task_prompt')
    if not isinstance(task_prompt, str) or not task_prompt.strip():
        raise ExperimentError('Config must declare a non-empty task_prompt')
    return [
        {'role': 'system', 'content': prompt_prefix.rstrip() + '\n'},
        {'role': 'user', 'content': context_pack},
        {'role': 'user', 'content': task_prompt.rstrip() + '\n'},
    ]


def build_request(config: dict[str, Any], messages: list[dict[str, str]]) -> dict[str, Any]:
    model = config.get('model')
    if not isinstance(model, str) or not model:
        raise ExperimentError('Config must declare model')
    request: dict[str, Any] = {
        'model': model,
        'messages': messages,
        'stream': False,
        'max_tokens': int(config.get('max_tokens', 12000)),
        'temperature': float(config.get('temperature', 0)),
        'response_format': {'type': 'json_object'},
    }
    if 'enable_thinking' in config:
        request['enable_thinking'] = bool(config['enable_thinking'])
    return request


def request_json(url: str, api_key: str, *, method: str = 'GET', body: dict[str, Any] | None = None,
                 timeout_seconds: int = 300) -> tuple[dict[str, Any], dict[str, str]]:
    data = canonical_json(body).encode('utf-8') if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'act-knowledge-extraction-experiment/1.0',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            response_body = response.read().decode('utf-8', errors='replace')
            headers = {key.lower(): value for key, value in response.headers.items()}
            try:
                payload = json.loads(response_body)
            except json.JSONDecodeError as error:
                raise ProviderResponseDecodeError(response_body, headers) from error
    except urllib.error.HTTPError as error:
        response_body = error.read().decode('utf-8', errors='replace')
        headers = {key.lower(): value for key, value in error.headers.items()}
        raise ProviderRequestError(error.code, response_body, headers) from error
    except (urllib.error.URLError, TimeoutError) as error:
        raise ExperimentError(f'Provider request failed: {error}') from error
    if not isinstance(payload, dict):
        raise ProviderResponseDecodeError(response_body, headers)
    return payload, headers


def require_api_key() -> str:
    api_key = os.environ.get(API_KEY_ENV)
    if not api_key:
        raise ExperimentError(f'{API_KEY_ENV} is not set in the command environment')
    return api_key


def parse_candidate_output(
    response: dict[str, Any],
    *,
    expected_pack_id: str,
    source_content_by_id: dict[str, str],
    source_span_by_id: dict[str, SourceSpan] | None = None,
) -> dict[str, Any]:
    try:
        choice = response['choices'][0]
        content = choice['message']['content']
    except (KeyError, IndexError, TypeError) as error:
        raise ExperimentError('Provider response has no choices[0].message.content') from error
    if choice.get('finish_reason') != 'stop':
        raise ExperimentError(f'Model did not finish cleanly: finish_reason={choice.get("finish_reason")!r}')
    if not isinstance(content, str):
        raise ExperimentError('Provider message content must be a string')
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as error:
        raise ExperimentError(f'Model content is not valid JSON: {error}') from error
    if not isinstance(parsed, dict):
        raise ExperimentError('Model JSON must be an object')
    if parsed.get('pack_id') != expected_pack_id:
        raise ExperimentError(f'Model JSON pack_id does not match {expected_pack_id}')
    if not isinstance(parsed.get('candidates'), list):
        raise ExperimentError('Model JSON must contain a candidates array')
    if not isinstance(parsed.get('rejected_items'), list):
        raise ExperimentError('Model JSON must contain a rejected_items array')
    for index, candidate in enumerate(parsed['candidates']):
        if not isinstance(candidate, dict):
            raise ExperimentError(f'Candidate {index} must be an object')
        required_strings = ('canonical_name', 'definition', 'semantic_boundary', 'independent_teaching_reason')
        missing = [key for key in required_strings if not isinstance(candidate.get(key), str) or not candidate[key].strip()]
        if missing:
            raise ExperimentError(f'Candidate {index} is missing fields: {missing}')
        aliases = candidate.get('aliases')
        if not isinstance(aliases, list) or any(not isinstance(alias, str) or not alias.strip() for alias in aliases):
            raise ExperimentError(f'Candidate {index} aliases must be an array of non-empty strings')
        if candidate.get('confidence') not in {'high', 'medium', 'low'}:
            raise ExperimentError(f'Candidate {index} confidence must be high, medium, or low')
        evidence_items = candidate.get('source_evidence')
        if not isinstance(evidence_items, list) or not evidence_items:
            raise ExperimentError(f'Candidate {index} must contain source_evidence')
        seen_evidence: set[tuple[str, str]] = set()
        for evidence_index, evidence in enumerate(evidence_items):
            if not isinstance(evidence, dict):
                raise ExperimentError(f'Candidate {index} evidence {evidence_index} must be an object')
            source_id = evidence.get('source_id')
            if source_id not in source_content_by_id:
                raise ExperimentError(f'Candidate {index} evidence {evidence_index} has unknown source_id')
            if source_span_by_id is not None:
                if 'quote' in evidence:
                    raise ExperimentError(f'Candidate {index} evidence {evidence_index} must not provide quote')
                span_id = evidence.get('span_id')
                span = source_span_by_id.get(span_id) if isinstance(span_id, str) else None
                if span is None:
                    raise ExperimentError(f'Candidate {index} evidence {evidence_index} has unknown span_id')
                if span.source_id != source_id:
                    raise ExperimentError(f'Candidate {index} evidence {evidence_index} span belongs to another source')
                evidence_key = (source_id, span.span_id)
                if evidence_key in seen_evidence:
                    raise ExperimentError(f'Candidate {index} evidence {evidence_index} duplicates a span')
                seen_evidence.add(evidence_key)
                evidence['quote'] = span.content
                evidence['source_content_sha256'] = span.source_content_sha256
            else:
                quote = evidence.get('quote')
                if not isinstance(quote, str) or not quote.strip():
                    raise ExperimentError(f'Candidate {index} evidence {evidence_index} has no quote')
                if quote not in source_content_by_id[source_id]:
                    raise ExperimentError(f'Candidate {index} evidence {evidence_index} quote is not verbatim')
    allowed_rejection_reasons = {
        'formula_fragment',
        'example_only',
        'synonym',
        'attribute',
        'navigation',
        'insufficient_evidence',
    }
    for index, item in enumerate(parsed['rejected_items']):
        if not isinstance(item, dict):
            raise ExperimentError(f'Rejected item {index} must be an object')
        if not isinstance(item.get('label'), str) or not item['label'].strip():
            raise ExperimentError(f'Rejected item {index} must contain label')
        if item.get('reason') not in allowed_rejection_reasons:
            raise ExperimentError(f'Rejected item {index} has an unknown reason')
    return parsed


def validate_provider_accounting(response: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
    usage = response.get('usage')
    if not isinstance(usage, dict):
        raise ExperimentError('Provider response has no usage object')
    required_usage = (
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'prompt_cache_hit_tokens',
        'prompt_cache_miss_tokens',
    )
    missing = [field for field in required_usage if not isinstance(usage.get(field), int)]
    if missing:
        raise ExperimentError(f'Provider usage is missing integer fields: {missing}')
    trace_id = headers.get('x-siliconcloud-trace-id')
    if not trace_id:
        raise ExperimentError('Provider response has no x-siliconcloud-trace-id header')
    if not isinstance(response.get('id'), str) or not response['id']:
        raise ExperimentError('Provider response has no response id')
    if not isinstance(response.get('model'), str) or not response['model']:
        raise ExperimentError('Provider response has no model')
    return {'usage': usage, 'trace_id': trace_id}


def response_finish_reason(response: dict[str, Any]) -> Any:
    choices = response.get('choices')
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return None
    return choices[0].get('finish_reason')


def make_run_directory(output_root: Path, pack_id: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    run_dir = output_root / f'{timestamp}-{pack_id}'
    suffix = 1
    while run_dir.exists():
        suffix += 1
        run_dir = output_root / f'{timestamp}-{pack_id}-{suffix}'
    run_dir.mkdir(parents=True)
    return run_dir


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')


def probe_models(args: argparse.Namespace) -> int:
    api_key = require_api_key()
    payload, _ = request_json(f'{args.base_url.rstrip("/")}/models?type=text&sub_type=chat', api_key)
    models = payload.get('data')
    if not isinstance(models, list):
        raise ExperimentError('Model-list response has no data array')
    matching_ids = sorted(
        item['id'] for item in models
        if isinstance(item, dict)
        and isinstance(item.get('id'), str)
        and ('DeepSeek-V4' in item['id'] or 'deepseek-v4' in item['id'].lower())
    )
    print('\n'.join(matching_ids) if matching_ids else 'No DeepSeek V4 model ID returned by SiliconFlow.')
    return 0 if matching_ids else 3


def run_experiment(args: argparse.Namespace) -> int:
    config_path = args.config.resolve()
    config = load_json(config_path)
    pack_id = config.get('pack_id')
    if not isinstance(pack_id, str) or not pack_id:
        raise ExperimentError('Config must declare pack_id')

    prompt_path = config_path.parent / config.get('prompt_prefix_path', 'prompt-prefix-v1.md')
    try:
        prompt_prefix = prompt_path.read_text(encoding='utf-8')
    except OSError as error:
        raise ExperimentError(f'Cannot read prompt prefix {prompt_path}: {error}') from error
    sections = load_source_sections(config)
    evidence_mode = config.get('evidence_mode', 'verbatim_quote')
    if not isinstance(evidence_mode, str):
        raise ExperimentError('Config evidence_mode must be a string')
    context_pack = build_context_pack(pack_id, sections, evidence_mode=evidence_mode)
    messages = build_messages(config, prompt_prefix, context_pack)
    request_body = build_request(config, messages)
    serialized_request = canonical_json(request_body)
    request_hash = sha256_text(serialized_request)
    prefix_hash = sha256_text(canonical_json(messages[:2]))

    output_root = args.output_root.resolve()
    run_dir = make_run_directory(output_root, pack_id)
    (run_dir / 'context-pack.md').write_text(context_pack, encoding='utf-8')
    write_json(run_dir / 'request.json', request_body)
    write_json(run_dir / 'experiment-metadata.json', {
        'config_path': str(config_path.relative_to(REPO_ROOT)),
        'model': request_body['model'],
        'pack_id': pack_id,
        'evidence_mode': evidence_mode,
        'prompt_prefix_sha256': sha256_text(prompt_prefix.rstrip() + '\n'),
        'cache_prefix_sha256': prefix_hash,
        'request_sha256': request_hash,
        'repeat_count': args.repeat,
        'source_sections': [
            {
                'source_id': section.source_id,
                'path': section.path,
                'content_sha256': sha256_text(section.content),
            }
            for section in sections
        ],
    })

    if args.prepare_only:
        write_json(run_dir / 'summary.json', {
            'pack_id': pack_id,
            'cache_prefix_sha256': prefix_hash,
            'request_sha256': request_hash,
            'runs': [],
            'state': 'prepared',
        })
        print(f'Prepared experiment artifacts: {run_dir}')
        return 0

    api_key = require_api_key()
    summaries: list[dict[str, Any]] = []
    endpoint = f'{args.base_url.rstrip("/")}/chat/completions'
    source_content_by_id = {section.source_id: section.content for section in sections}
    source_span_by_id = (
        {span.span_id: span for span in build_source_spans(sections)}
        if evidence_mode == 'span_id'
        else None
    )
    for run_number in range(1, args.repeat + 1):
        if sha256_text(canonical_json(request_body)) != request_hash:
            raise ExperimentError('Request changed between repetitions; cache-prefix contract violated')
        started = time.monotonic()
        run_name = f'run-{run_number:02d}'
        try:
            response, headers = request_json(
                endpoint,
                api_key,
                method='POST',
                body=request_body,
                timeout_seconds=args.timeout_seconds,
            )
        except ProviderResponseDecodeError as error:
            elapsed_ms = round((time.monotonic() - started) * 1000)
            (run_dir / f'{run_name}-provider-response.txt').write_text(error.response_body, encoding='utf-8')
            failure = {
                'run': run_number,
                'state': 'failed',
                'failure_kind': 'provider_response_decode_error',
                'elapsed_ms': elapsed_ms,
                'trace_id': error.headers.get('x-siliconcloud-trace-id'),
            }
            summaries.append(failure)
            write_json(run_dir / f'{run_name}-summary.json', failure)
            write_json(run_dir / 'summary.json', {
                'pack_id': pack_id,
                'cache_prefix_sha256': prefix_hash,
                'request_sha256': request_hash,
                'runs': summaries,
                'state': 'failed',
            })
            raise ExperimentError(f'Invalid provider JSON preserved in {run_dir}') from error
        except ProviderRequestError as error:
            elapsed_ms = round((time.monotonic() - started) * 1000)
            (run_dir / f'{run_name}-http-error.txt').write_text(error.response_body, encoding='utf-8')
            failure = {
                'run': run_number,
                'state': 'failed',
                'failure_kind': 'http_error',
                'http_status': error.status,
                'elapsed_ms': elapsed_ms,
                'trace_id': error.headers.get('x-siliconcloud-trace-id'),
            }
            summaries.append(failure)
            write_json(run_dir / f'{run_name}-summary.json', failure)
            write_json(run_dir / 'summary.json', {
                'pack_id': pack_id,
                'cache_prefix_sha256': prefix_hash,
                'request_sha256': request_hash,
                'runs': summaries,
                'state': 'failed',
            })
            raise ExperimentError(f'Provider returned HTTP {error.status}; response preserved in {run_dir}') from error
        except ExperimentError as error:
            elapsed_ms = round((time.monotonic() - started) * 1000)
            failure = {
                'run': run_number,
                'state': 'failed',
                'failure_kind': 'transport_error',
                'elapsed_ms': elapsed_ms,
                'error': str(error),
            }
            summaries.append(failure)
            write_json(run_dir / f'{run_name}-summary.json', failure)
            write_json(run_dir / 'summary.json', {
                'pack_id': pack_id,
                'cache_prefix_sha256': prefix_hash,
                'request_sha256': request_hash,
                'runs': summaries,
                'state': 'failed',
            })
            raise
        elapsed_ms = round((time.monotonic() - started) * 1000)
        write_json(run_dir / f'{run_name}-response.json', response)
        try:
            accounting = validate_provider_accounting(response, headers)
            parsed = parse_candidate_output(
                response,
                expected_pack_id=pack_id,
                source_content_by_id=source_content_by_id,
                source_span_by_id=source_span_by_id,
            )
        except ExperimentError as error:
            failure = {
                'run': run_number,
                'state': 'failed',
                'failure_kind': 'response_validation_error',
                'elapsed_ms': elapsed_ms,
                'response_id': response.get('id'),
                'model': response.get('model'),
                'usage': response.get('usage'),
                'finish_reason': response_finish_reason(response),
                'trace_id': headers.get('x-siliconcloud-trace-id'),
                'error': str(error),
            }
            summaries.append(failure)
            write_json(run_dir / f'{run_name}-summary.json', failure)
            write_json(run_dir / 'summary.json', {
                'pack_id': pack_id,
                'cache_prefix_sha256': prefix_hash,
                'request_sha256': request_hash,
                'runs': summaries,
                'state': 'failed',
            })
            print(f'{run_name}: validation_failed={error}', file=sys.stderr)
            continue
        write_json(run_dir / f'{run_name}-candidates.json', parsed)
        summary = {
            'run': run_number,
            'state': 'succeeded',
            'elapsed_ms': elapsed_ms,
            'candidate_count': len(parsed['candidates']),
            'response_id': response.get('id'),
            'model': response.get('model'),
            'usage': accounting['usage'],
            'finish_reason': response_finish_reason(response),
            'trace_id': accounting['trace_id'],
            'candidate_output_sha256': sha256_text(canonical_json(parsed)),
        }
        summaries.append(summary)
        write_json(run_dir / f'{run_name}-summary.json', summary)
        print(f'{run_name}: candidates={summary["candidate_count"]} elapsed_ms={elapsed_ms}')

    final_state = 'succeeded' if all(item['state'] == 'succeeded' for item in summaries) else 'completed_with_failures'
    write_json(run_dir / 'summary.json', {
        'pack_id': pack_id,
        'cache_prefix_sha256': prefix_hash,
        'request_sha256': request_hash,
        'runs': summaries,
        'state': final_state,
    })
    print(f'Experiment artifacts: {run_dir}')
    return 0 if final_state == 'succeeded' else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=DEFAULT_BASE_URL)
    subparsers = parser.add_subparsers(dest='command', required=True)

    probe = subparsers.add_parser('probe-models', help='List DeepSeek V4 chat models visible to the API key')
    probe.set_defaults(handler=probe_models)

    run = subparsers.add_parser('run', help='Run the fixed-prefix extraction experiment')
    run.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
    run.add_argument('--output-root', type=Path, default=DEFAULT_OUTPUT_ROOT)
    run.add_argument('--repeat', type=int, default=3)
    run.add_argument('--timeout-seconds', type=int, default=600)
    run.add_argument('--prepare-only', action='store_true', help='Build the exact request without calling SiliconFlow')
    run.set_defaults(handler=run_experiment)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, 'repeat', 1) < 1:
        parser.error('--repeat must be at least 1')
    try:
        return args.handler(args)
    except ExperimentError as error:
        print(f'error: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
