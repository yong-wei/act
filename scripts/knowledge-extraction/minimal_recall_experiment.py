#!/usr/bin/env python3
"""Run and score the minimal knowledge-node recall experiment."""

from __future__ import annotations

import argparse
import json
import sys
import time
from itertools import combinations
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import deepseek_extraction_experiment as base


PROTOCOL_ID = 'minimal-recall-v1'
CLASSIFICATION = 'experimental-provisional'
RUNTIME_ELIGIBLE = False
DEFAULT_CONFIG = SCRIPT_DIR / 'pilot-transfer-function-minimal-recall-v1.json'
DEFAULT_OUTPUT_ROOT = base.REPO_ROOT / '.logs' / 'knowledge-minimal-recall-experiments'
DEFAULT_GOLD = SCRIPT_DIR / 'adjudication-gold-v1.json'


def parse_minimal_output(
    response: dict[str, Any],
    *,
    expected_pack_id: str,
    source_content_by_id: dict[str, str],
    source_span_by_id: dict[str, base.SourceSpan],
) -> dict[str, Any]:
    try:
        choice = response['choices'][0]
        content = choice['message']['content']
    except (KeyError, IndexError, TypeError) as error:
        raise base.ExperimentError('Provider response has no choices[0].message.content') from error
    if not isinstance(choice, dict) or choice.get('finish_reason') != 'stop':
        finish_reason = choice.get('finish_reason') if isinstance(choice, dict) else None
        raise base.ExperimentError(f'Model did not finish cleanly: finish_reason={finish_reason!r}')
    if not isinstance(content, str):
        raise base.ExperimentError('Provider message content must be a string')
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as error:
        raise base.ExperimentError(f'Model content is not valid JSON: {error}') from error
    if not isinstance(parsed, dict):
        raise base.ExperimentError('Model JSON must be an object')
    expected_top_level = {'protocol_id', 'pack_id', 'candidates'}
    if set(parsed) != expected_top_level:
        raise base.ExperimentError(
            f'Model JSON fields must be exactly {sorted(expected_top_level)}'
        )
    if parsed['protocol_id'] != PROTOCOL_ID:
        raise base.ExperimentError(f'Model JSON protocol_id must be {PROTOCOL_ID}')
    if parsed['pack_id'] != expected_pack_id:
        raise base.ExperimentError(f'Model JSON pack_id does not match {expected_pack_id}')
    candidates = parsed['candidates']
    if not isinstance(candidates, list) or not candidates:
        raise base.ExperimentError('Model JSON must contain a non-empty candidates array')

    seen_labels: set[str] = set()
    expected_candidate_fields = {'candidate_label', 'identity_hint', 'source_evidence'}
    expected_evidence_fields = {'source_id', 'span_id'}
    for candidate_index, candidate in enumerate(candidates):
        if not isinstance(candidate, dict) or set(candidate) != expected_candidate_fields:
            raise base.ExperimentError(
                f'Candidate {candidate_index} fields must be exactly {sorted(expected_candidate_fields)}'
            )
        label = candidate['candidate_label']
        hint = candidate['identity_hint']
        if not isinstance(label, str) or not label.strip():
            raise base.ExperimentError(f'Candidate {candidate_index} candidate_label must be non-empty')
        if label != label.strip():
            raise base.ExperimentError(f'Candidate {candidate_index} candidate_label must not have outer whitespace')
        if label in seen_labels:
            raise base.ExperimentError(f'Duplicate candidate_label: {label}')
        seen_labels.add(label)
        if not isinstance(hint, str) or not hint.strip() or len(hint) > 120:
            raise base.ExperimentError(
                f'Candidate {candidate_index} identity_hint must contain 1-120 Unicode characters'
            )

        evidence_items = candidate['source_evidence']
        if not isinstance(evidence_items, list) or not evidence_items:
            raise base.ExperimentError(f'Candidate {candidate_index} must contain source_evidence')
        seen_evidence: set[tuple[str, str]] = set()
        for evidence_index, evidence in enumerate(evidence_items):
            if not isinstance(evidence, dict) or set(evidence) != expected_evidence_fields:
                raise base.ExperimentError(
                    f'Candidate {candidate_index} evidence {evidence_index} fields must be exactly '
                    f'{sorted(expected_evidence_fields)}'
                )
            source_id = evidence['source_id']
            span_id = evidence['span_id']
            if source_id not in source_content_by_id:
                raise base.ExperimentError(
                    f'Candidate {candidate_index} evidence {evidence_index} has unknown source_id'
                )
            span = source_span_by_id.get(span_id) if isinstance(span_id, str) else None
            if span is None:
                raise base.ExperimentError(
                    f'Candidate {candidate_index} evidence {evidence_index} has unknown span_id'
                )
            if span.source_id != source_id:
                raise base.ExperimentError(
                    f'Candidate {candidate_index} evidence {evidence_index} span belongs to another source'
                )
            evidence_key = (source_id, span_id)
            if evidence_key in seen_evidence:
                raise base.ExperimentError(
                    f'Candidate {candidate_index} evidence {evidence_index} duplicates a span'
                )
            seen_evidence.add(evidence_key)
            evidence['quote'] = span.content
            evidence['source_content_sha256'] = span.source_content_sha256
    return parsed


def load_gold_contract(path: Path) -> tuple[set[str], dict[str, str], set[str]]:
    gold = base.load_json(path)
    decisions = gold.get('decisions')
    if not isinstance(decisions, list):
        raise base.ExperimentError('Gold must contain a decisions array')
    accepted: set[str] = set()
    aliases: dict[str, str] = {}
    rejected: set[str] = set()
    for index, decision in enumerate(decisions):
        if not isinstance(decision, dict) or not isinstance(decision.get('exact_name'), str):
            raise base.ExperimentError(f'Gold decision {index} has no exact_name')
        name = decision['exact_name']
        disposition = decision.get('decision')
        if disposition == 'ACCEPT':
            accepted.add(name)
        elif disposition == 'MERGE':
            target = decision.get('target_exact_name')
            if not isinstance(target, str) or not target:
                raise base.ExperimentError(f'Gold MERGE decision {index} has no target_exact_name')
            aliases[name] = target
        elif disposition == 'REJECT':
            rejected.add(name)
        else:
            raise base.ExperimentError(f'Gold decision {index} has unknown decision: {disposition!r}')
    unknown_targets = set(aliases.values()) - accepted
    if unknown_targets:
        raise base.ExperimentError(f'Gold aliases target non-accepted identities: {sorted(unknown_targets)}')
    return accepted, aliases, rejected


def candidate_identity(label: str, accepted: set[str], aliases: dict[str, str]) -> str:
    if label in accepted:
        return label
    if label in aliases:
        return aliases[label]
    return f'UNRESOLVED::{label}'


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return 1.0 if not union else len(left & right) / len(union)


def build_comparison_report(
    successful_runs: list[tuple[int, dict[str, Any]]],
    *,
    accepted: set[str],
    aliases: dict[str, str],
    rejected: set[str],
) -> dict[str, Any]:
    run_identity_sets: dict[int, set[str]] = {}
    run_metrics: list[dict[str, Any]] = []
    unresolved: dict[str, dict[str, Any]] = {}

    for run_number, parsed in successful_runs:
        identities: set[str] = set()
        accepted_found: set[str] = set()
        known_rejected: set[str] = set()
        unresolved_labels: set[str] = set()
        for candidate in parsed['candidates']:
            label = candidate['candidate_label']
            identity = candidate_identity(label, accepted, aliases)
            identities.add(identity)
            if identity in accepted:
                accepted_found.add(identity)
            else:
                unresolved_labels.add(label)
                if label in rejected:
                    known_rejected.add(label)
                entry = unresolved.setdefault(label, {
                    'candidate_label': label,
                    'runs': [],
                    'identity_hints': [],
                    'source_evidence': [],
                    'gold_status': 'known_rejected' if label in rejected else 'not_in_frozen_gold',
                })
                entry['runs'].append(run_number)
                if candidate['identity_hint'] not in entry['identity_hints']:
                    entry['identity_hints'].append(candidate['identity_hint'])
                for evidence in candidate['source_evidence']:
                    evidence_ref = {'source_id': evidence['source_id'], 'span_id': evidence['span_id']}
                    if evidence_ref not in entry['source_evidence']:
                        entry['source_evidence'].append(evidence_ref)
        run_identity_sets[run_number] = identities
        run_metrics.append({
            'run': run_number,
            'candidate_count': len(parsed['candidates']),
            'identity_count': len(identities),
            'accepted_identity_count': len(accepted_found),
            'accepted_identity_recall': len(accepted_found) / len(accepted),
            'provisional_false_identity_count': len(identities - accepted),
            'known_rejected_labels': sorted(known_rejected),
            'unresolved_labels': sorted(unresolved_labels),
        })

    identity_sets = list(run_identity_sets.values())
    union = set().union(*identity_sets) if identity_sets else set()
    intersection = set.intersection(*identity_sets) if identity_sets else set()
    accepted_union = union & accepted
    accepted_intersection = intersection & accepted
    pairwise = [
        {
            'left_run': left_run,
            'right_run': right_run,
            'jaccard': jaccard(run_identity_sets[left_run], run_identity_sets[right_run]),
        }
        for left_run, right_run in combinations(sorted(run_identity_sets), 2)
    ]
    unresolved_queue = []
    for label in sorted(unresolved):
        item = unresolved[label]
        item['occurrence_count'] = len(item['runs'])
        unresolved_queue.append(item)

    return {
        'classification': CLASSIFICATION,
        'runtime_eligible': RUNTIME_ELIGIBLE,
        'comparison_contract': 'exact-or-frozen-alias-v1',
        'gold_accepted_identity_count': len(accepted),
        'successful_run_count': len(successful_runs),
        'runs': run_metrics,
        'union': {
            'identity_count': len(union),
            'accepted_identity_count': len(accepted_union),
            'accepted_identity_recall': len(accepted_union) / len(accepted),
            'provisional_false_identity_count': len(union - accepted),
            'accepted_identities': sorted(accepted_union),
        },
        'intersection': {
            'identity_count': len(intersection),
            'accepted_identity_count': len(accepted_intersection),
            'accepted_identity_recall': len(accepted_intersection) / len(accepted),
            'provisional_false_identity_count': len(intersection - accepted),
            'accepted_identities': sorted(accepted_intersection),
        },
        'pairwise_jaccard': pairwise,
        'unresolved_mapping_queue': unresolved_queue,
    }


def write_overall_summary(
    run_dir: Path,
    *,
    pack_id: str,
    prefix_hash: str,
    request_hash: str,
    summaries: list[dict[str, Any]],
    state: str,
) -> None:
    base.write_json(run_dir / 'summary.json', {
        'classification': CLASSIFICATION,
        'runtime_eligible': RUNTIME_ELIGIBLE,
        'protocol_id': PROTOCOL_ID,
        'pack_id': pack_id,
        'cache_prefix_sha256': prefix_hash,
        'request_sha256': request_hash,
        'runs': summaries,
        'state': state,
    })


def run_experiment(args: argparse.Namespace) -> int:
    config_path = args.config.resolve()
    config = base.load_json(config_path)
    pack_id = config.get('pack_id')
    if not isinstance(pack_id, str) or not pack_id:
        raise base.ExperimentError('Config must declare pack_id')
    if config.get('protocol_id') != PROTOCOL_ID:
        raise base.ExperimentError(f'Config protocol_id must be {PROTOCOL_ID}')
    if config.get('evidence_mode') != 'span_id':
        raise base.ExperimentError('Minimal recall requires evidence_mode=span_id')

    prompt_path_value = config.get('prompt_prefix_path')
    if not isinstance(prompt_path_value, str) or not prompt_path_value:
        raise base.ExperimentError('Config must declare prompt_prefix_path')
    prompt_path = config_path.parent / prompt_path_value
    try:
        prompt_prefix = prompt_path.read_text(encoding='utf-8')
    except OSError as error:
        raise base.ExperimentError(f'Cannot read prompt prefix {prompt_path}: {error}') from error
    sections = base.load_source_sections(config)
    spans = base.build_source_spans(sections)
    context_pack = base.build_context_pack(pack_id, sections, evidence_mode='span_id')
    messages = base.build_messages(config, prompt_prefix, context_pack)
    request_body = base.build_request(config, messages)
    request_hash = base.sha256_text(base.canonical_json(request_body))
    prefix_hash = base.sha256_text(base.canonical_json(messages[:2]))

    run_dir = base.make_run_directory(args.output_root.resolve(), pack_id)
    (run_dir / 'context-pack.md').write_text(context_pack, encoding='utf-8')
    base.write_json(run_dir / 'request.json', request_body)
    gold_path = (config_path.parent / config.get('gold_path', DEFAULT_GOLD.name)).resolve()
    accepted, aliases, rejected = load_gold_contract(gold_path)
    base.write_json(run_dir / 'experiment-metadata.json', {
        'classification': CLASSIFICATION,
        'runtime_eligible': RUNTIME_ELIGIBLE,
        'protocol_id': PROTOCOL_ID,
        'config_path': str(config_path.relative_to(base.REPO_ROOT)),
        'gold_path': str(gold_path.relative_to(base.REPO_ROOT)),
        'model': request_body['model'],
        'pack_id': pack_id,
        'evidence_mode': 'span_id',
        'prompt_prefix_sha256': base.sha256_text(prompt_prefix.rstrip() + '\n'),
        'cache_prefix_sha256': prefix_hash,
        'request_sha256': request_hash,
        'repeat_count': args.repeat,
        'source_sections': [
            {
                'source_id': section.source_id,
                'path': section.path,
                'content_sha256': base.sha256_text(section.content),
            }
            for section in sections
        ],
    })
    if args.prepare_only:
        write_overall_summary(
            run_dir,
            pack_id=pack_id,
            prefix_hash=prefix_hash,
            request_hash=request_hash,
            summaries=[],
            state='prepared',
        )
        print(f'Prepared minimal recall artifacts: {run_dir}')
        return 0

    api_key = base.require_api_key()
    endpoint = f'{args.base_url.rstrip("/")}/chat/completions'
    source_content_by_id = {section.source_id: section.content for section in sections}
    source_span_by_id = {span.span_id: span for span in spans}
    summaries: list[dict[str, Any]] = []
    successful_runs: list[tuple[int, dict[str, Any]]] = []
    for run_number in range(1, args.repeat + 1):
        if base.sha256_text(base.canonical_json(request_body)) != request_hash:
            raise base.ExperimentError('Request changed between repetitions; cache-prefix contract violated')
        run_name = f'run-{run_number:02d}'
        started = time.monotonic()
        try:
            response, headers = base.request_json(
                endpoint,
                api_key,
                method='POST',
                body=request_body,
                timeout_seconds=args.timeout_seconds,
            )
        except (base.ProviderRequestError, base.ProviderResponseDecodeError) as error:
            elapsed_ms = round((time.monotonic() - started) * 1000)
            if isinstance(error, base.ProviderRequestError):
                artifact = f'{run_name}-http-error.txt'
                failure_kind = 'http_error'
            else:
                artifact = f'{run_name}-provider-response.txt'
                failure_kind = 'provider_response_decode_error'
            (run_dir / artifact).write_text(error.response_body, encoding='utf-8')
            failure = {
                'run': run_number,
                'state': 'failed',
                'failure_kind': failure_kind,
                'elapsed_ms': elapsed_ms,
                'trace_id': error.headers.get('x-siliconcloud-trace-id'),
            }
            if isinstance(error, base.ProviderRequestError):
                failure['http_status'] = error.status
            summaries.append(failure)
            base.write_json(run_dir / f'{run_name}-summary.json', failure)
            write_overall_summary(
                run_dir, pack_id=pack_id, prefix_hash=prefix_hash, request_hash=request_hash,
                summaries=summaries, state='failed',
            )
            raise base.ExperimentError(f'Provider failure preserved in {run_dir}') from error
        elapsed_ms = round((time.monotonic() - started) * 1000)
        base.write_json(run_dir / f'{run_name}-response.json', response)
        try:
            accounting = base.validate_provider_accounting(response, headers)
            parsed = parse_minimal_output(
                response,
                expected_pack_id=pack_id,
                source_content_by_id=source_content_by_id,
                source_span_by_id=source_span_by_id,
            )
        except base.ExperimentError as error:
            failure = {
                'run': run_number,
                'state': 'failed',
                'failure_kind': 'response_validation_error',
                'elapsed_ms': elapsed_ms,
                'response_id': response.get('id'),
                'model': response.get('model'),
                'usage': response.get('usage'),
                'finish_reason': base.response_finish_reason(response),
                'trace_id': headers.get('x-siliconcloud-trace-id'),
                'error': str(error),
            }
            summaries.append(failure)
            base.write_json(run_dir / f'{run_name}-summary.json', failure)
            print(f'{run_name}: validation_failed={error}', file=sys.stderr)
            continue
        base.write_json(run_dir / f'{run_name}-candidates.json', parsed)
        successful_runs.append((run_number, parsed))
        summary = {
            'run': run_number,
            'state': 'succeeded',
            'elapsed_ms': elapsed_ms,
            'candidate_count': len(parsed['candidates']),
            'response_id': response.get('id'),
            'model': response.get('model'),
            'usage': accounting['usage'],
            'finish_reason': base.response_finish_reason(response),
            'trace_id': accounting['trace_id'],
            'candidate_output_sha256': base.sha256_text(base.canonical_json(parsed)),
        }
        summaries.append(summary)
        base.write_json(run_dir / f'{run_name}-summary.json', summary)
        print(f'{run_name}: candidates={summary["candidate_count"]} elapsed_ms={elapsed_ms}')

    report = build_comparison_report(
        successful_runs,
        accepted=accepted,
        aliases=aliases,
        rejected=rejected,
    )
    base.write_json(run_dir / 'comparison-report.json', report)
    final_state = 'succeeded' if len(successful_runs) == args.repeat else 'completed_with_failures'
    write_overall_summary(
        run_dir,
        pack_id=pack_id,
        prefix_hash=prefix_hash,
        request_hash=request_hash,
        summaries=summaries,
        state=final_state,
    )
    print(f'Minimal recall artifacts: {run_dir}')
    return 0 if final_state == 'succeeded' else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=base.DEFAULT_BASE_URL)
    subparsers = parser.add_subparsers(dest='command', required=True)
    run = subparsers.add_parser('run', help='Prepare or execute the three-run minimal recall experiment')
    run.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
    run.add_argument('--output-root', type=Path, default=DEFAULT_OUTPUT_ROOT)
    run.add_argument('--repeat', type=int, default=3)
    run.add_argument('--timeout-seconds', type=int, default=600)
    run.add_argument('--prepare-only', action='store_true')
    run.set_defaults(handler=run_experiment)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error('--repeat must be at least 1')
    try:
        return args.handler(args)
    except base.ExperimentError as error:
        print(f'error: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
