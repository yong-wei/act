#!/usr/bin/env python3
"""Prepare and run the bounded DeepSeek V4 Pro adjudication matrix."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_EXTRACTION_ROOT = REPO_ROOT / '.logs' / 'knowledge-extraction-experiments'
DEFAULT_OUTPUT_ROOT = REPO_ROOT / '.logs' / 'knowledge-adjudication-experiments'
DEFAULT_CONFIG = SCRIPT_DIR / 'pilot-transfer-function-v3-span.json'
DEFAULT_GOLD = SCRIPT_DIR / 'adjudication-gold-v1.json'
MODEL = 'deepseek-ai/DeepSeek-V4-Pro'
API_KEY_ENV = 'SILICONFLOW_API_KEY'
PROTOCOL_PATHS = {
    'p1': SCRIPT_DIR / 'adjudication-prefix-p1.md',
    'p2': SCRIPT_DIR / 'adjudication-prefix-p2.md',
    'p3': SCRIPT_DIR / 'adjudication-prefix-p3.md',
    'p4': SCRIPT_DIR / 'adjudication-prefix-p4.md',
}
NEIGHBORHOODS = (
    ('transfer-representations', (
        '传递函数的时间常数形式', '传递函数的零极点形式',
        '传递函数的零极点分布图', '零极点分布图',
    )),
    ('conditions-and-plant-variants', (
        '零初始条件', '有纯延迟单容水槽', '有纯延迟的单容水槽', '有纯延迟的双容水槽',
    )),
    ('basic-elements', ('比例环节', '惯性环节', '微分环节', '积分环节')),
    ('dynamic-elements-and-component-boundaries', ('振荡环节', '延时环节', '无源网络', '负载效应')),
)
DECISIONS = {'ACCEPT', 'MERGE', 'RENAME', 'REJECT'}
REASON_CODES = {
    'ACCEPT': {'INDEPENDENT_CONCEPT', 'DISTINCT_DEFINITION', 'DISTINCT_APPLICABILITY'},
    'MERGE': {'SAME_CONCEPT'},
    'RENAME': {'CANONICAL_NAME_ALIGNMENT'},
    'REJECT': {
        'ATTRIBUTE_OR_CONDITION', 'REPRESENTATION_ONLY', 'RELATION_OR_STRUCTURE',
        'EXAMPLE_ONLY', 'INSUFFICIENT_EVIDENCE',
    },
}
RISK_FLAGS = {'authority_conflict', 'boundary_ambiguity', 'evidence_tension', 'naming_collision_risk'}
CONFIDENCES = {'high', 'medium', 'low'}


class AdjudicationError(RuntimeError):
    """Raised when experiment inputs or outputs violate the frozen contract."""


def _load_extraction_module() -> Any:
    path = SCRIPT_DIR / 'deepseek_extraction_experiment.py'
    spec = importlib.util.spec_from_file_location('_knowledge_extraction_base', path)
    if spec is None or spec.loader is None:
        raise AdjudicationError(f'Cannot import extraction helpers from {path}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


extraction = _load_extraction_module()
canonical_json = extraction.canonical_json
sha256_text = extraction.sha256_text


def candidate_id(pack_id: str, exact_name: str) -> str:
    return hashlib.sha256(f'{pack_id}\0{exact_name}'.encode('utf-8')).hexdigest()[:16]


def normalize_name(value: str) -> str:
    return ''.join(unicodedata.normalize('NFKC', value).split()).casefold()


def find_v3_run_dir(root: Path = DEFAULT_EXTRACTION_ROOT) -> Path:
    matches = sorted(
        path.parent for path in root.glob('*-transfer-function-pilot-span-v1/run-03-candidates.json')
        if all((path.parent / f'run-0{index}-candidates.json').is_file() for index in (1, 2, 3))
    )
    if not matches:
        raise AdjudicationError(f'No complete V3 three-run artifact found under {root}')
    return matches[-1]


def load_v3_runs(run_dir: Path) -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    for index in (1, 2, 3):
        path = run_dir / f'run-0{index}-candidates.json'
        value = extraction.load_json(path)
        if value.get('pack_id') != 'transfer-function-pilot-span-v1':
            raise AdjudicationError(f'{path} has an unexpected pack_id')
        if not isinstance(value.get('candidates'), list) or not isinstance(value.get('rejected_items'), list):
            raise AdjudicationError(f'{path} is not a validated V3 candidate artifact')
        runs.append(value)
    return runs


def source_material(config_path: Path = DEFAULT_CONFIG) -> tuple[list[Any], dict[str, Any], dict[str, Any], str]:
    config = extraction.load_json(config_path)
    sections = extraction.load_source_sections(config)
    spans = extraction.build_source_spans(sections)
    span_by_key = {(span.source_id, span.span_id): span for span in spans}
    context_pack = extraction.build_context_pack(config['pack_id'], sections, evidence_mode='span_id')
    return sections, span_by_key, config, context_pack


def _validated_evidence(candidate: dict[str, Any], span_by_key: dict[tuple[str, str], Any]) -> list[dict[str, str]]:
    evidence = candidate.get('source_evidence')
    if not isinstance(evidence, list) or not evidence:
        raise AdjudicationError(f'{candidate.get("canonical_name")!r} has no V3 evidence')
    result: list[dict[str, str]] = []
    for item in evidence:
        if not isinstance(item, dict):
            raise AdjudicationError('V3 evidence must be an object')
        key = (item.get('source_id'), item.get('span_id'))
        span = span_by_key.get(key)
        if span is None:
            raise AdjudicationError(f'Illegal V3 evidence reference: {key!r}')
        if item.get('source_content_sha256') != span.source_content_sha256:
            raise AdjudicationError(f'V3 source hash mismatch: {key!r}')
        if item.get('quote') != span.content:
            raise AdjudicationError(f'V3 quote mismatch: {key!r}')
        result.append({'source_id': span.source_id, 'span_id': span.span_id})
    return result


def _validate_v3_contract(run: dict[str, Any], span_by_key: dict[tuple[str, str], Any]) -> None:
    allowed_rejections = {
        'formula_fragment', 'example_only', 'synonym', 'attribute', 'navigation', 'insufficient_evidence',
    }
    for index, candidate in enumerate(run['candidates']):
        if not isinstance(candidate, dict):
            raise AdjudicationError(f'V3 candidate {index} must be an object')
        required = ('canonical_name', 'definition', 'semantic_boundary', 'independent_teaching_reason')
        if any(not isinstance(candidate.get(key), str) or not candidate[key].strip() for key in required):
            raise AdjudicationError(f'V3 candidate {index} did not pass the extraction contract')
        aliases = candidate.get('aliases')
        if not isinstance(aliases, list) or any(not isinstance(alias, str) or not alias.strip() for alias in aliases):
            raise AdjudicationError(f'V3 candidate {index} has invalid aliases')
        if candidate.get('confidence') not in {'high', 'medium', 'low'}:
            raise AdjudicationError(f'V3 candidate {index} has invalid confidence')
        _validated_evidence(candidate, span_by_key)
    for index, item in enumerate(run['rejected_items']):
        if (
            not isinstance(item, dict) or not isinstance(item.get('label'), str)
            or not item['label'].strip() or item.get('reason') not in allowed_rejections
        ):
            raise AdjudicationError(f'V3 rejected item {index} did not pass the extraction contract')


def build_candidate_sets(
    runs: list[dict[str, Any]], span_by_key: dict[tuple[str, str], Any], *, expected_pack_id: str,
) -> dict[str, Any]:
    if len(runs) != 3:
        raise AdjudicationError('Exactly three V3 runs are required')
    per_run: list[dict[str, dict[str, Any]]] = []
    rejected_names: list[set[str]] = []
    for run in runs:
        if run.get('pack_id') != expected_pack_id:
            raise AdjudicationError('All V3 runs must use the expected pack_id')
        _validate_v3_contract(run, span_by_key)
        by_name: dict[str, dict[str, Any]] = {}
        for raw in run['candidates']:
            if not isinstance(raw, dict) or not isinstance(raw.get('canonical_name'), str):
                raise AdjudicationError('V3 candidate contract was not satisfied')
            name = raw['canonical_name']
            if name in by_name:
                raise AdjudicationError(f'Duplicate exact candidate name in one run: {name}')
            _validated_evidence(raw, span_by_key)
            by_name[name] = raw
        per_run.append(by_name)
        rejected_names.append({
            item['label'] for item in run['rejected_items']
            if isinstance(item, dict) and isinstance(item.get('label'), str)
        })

    union_names = set().union(*(set(run) for run in per_run))
    intersection_names = set.intersection(*(set(run) for run in per_run))
    if (len(union_names), len(intersection_names)) != (31, 15):
        raise AdjudicationError(
            f'Frozen V3 set cardinality changed: union={len(union_names)} intersection={len(intersection_names)}'
        )
    normalized: dict[str, str] = {}
    for name in sorted(union_names):
        key = normalize_name(name)
        if key in normalized and normalized[key] != name:
            raise AdjudicationError(f'Normalized-name collision: {normalized[key]!r} and {name!r}')
        normalized[key] = name

    candidates: dict[str, dict[str, Any]] = {}
    for name in sorted(union_names):
        occurrences = [run[name] for run in per_run if name in run]
        allowed = sorted({
            (evidence['source_id'], evidence['span_id'])
            for item in occurrences for evidence in _validated_evidence(item, span_by_key)
        })
        representative = occurrences[0]
        candidates[name] = {
            'candidate_id': candidate_id(expected_pack_id, name),
            'exact_name': name,
            'aliases': representative.get('aliases', []),
            'definition': representative.get('definition', ''),
            'semantic_boundary': representative.get('semantic_boundary', ''),
            'allowed_evidence': [
                {'source_id': source_id, 'span_id': span_id} for source_id, span_id in allowed
            ],
        }

    bulk_names: list[str] = []
    gate_failures: dict[str, list[str]] = {}
    for name in sorted(intersection_names):
        failures: list[str] = []
        evidence_sets = [{
            (item['source_id'], item['span_id'])
            for item in _validated_evidence(run[name], span_by_key)
        } for run in per_run]
        if not set.intersection(*evidence_sets):
            failures.append('no_common_span')
        if any(name in rejected for rejected in rejected_names):
            failures.append('same_name_rejected')
        if failures:
            gate_failures[name] = failures
        else:
            bulk_names.append(name)

    disputed_names = sorted(union_names - set(bulk_names))
    expected_disputed = {name for _, names in NEIGHBORHOODS for name in names}
    if set(disputed_names) != expected_disputed or len(bulk_names) != 15:
        raise AdjudicationError('Frozen semantic neighborhoods no longer cover the exact 16 disputed candidates')
    return {
        'pack_id': expected_pack_id,
        'candidates_by_name': candidates,
        'union_names': sorted(union_names),
        'intersection_names': sorted(intersection_names),
        'bulk_approval_names': bulk_names,
        'disputed_names': disputed_names,
        'gate_failures': gate_failures,
    }


def build_batches(candidate_sets: dict[str, Any]) -> dict[int, list[dict[str, Any]]]:
    by_name = candidate_sets['candidates_by_name']
    groups = [
        {'neighborhood_ids': [group_id], 'candidates': [by_name[name] for name in names]}
        for group_id, names in NEIGHBORHOODS
    ]
    return {
        4: groups,
        8: [
            {'neighborhood_ids': groups[0]['neighborhood_ids'] + groups[1]['neighborhood_ids'],
             'candidates': groups[0]['candidates'] + groups[1]['candidates']},
            {'neighborhood_ids': groups[2]['neighborhood_ids'] + groups[3]['neighborhood_ids'],
             'candidates': groups[2]['candidates'] + groups[3]['candidates']},
        ],
        16: [{
            'neighborhood_ids': [group_id for group_id, _ in NEIGHBORHOODS],
            'candidates': [by_name[name] for _, names in NEIGHBORHOODS for name in names],
        }],
    }


def output_contract(pack_id: str, protocol_id: str) -> dict[str, Any]:
    return {
        'pack_id': pack_id,
        'protocol_id': protocol_id,
        'decisions': [{
            'candidate_id': '复制输入候选的 candidate_id',
            'decision': 'ACCEPT | MERGE | RENAME | REJECT',
            'target_candidate_id': '仅 MERGE 填写目标 ID，其他决定必须为 null',
            'canonical_name': '仅 RENAME 填写规范名称，其他决定必须为 null',
            'reason_code': '使用与 decision 兼容的固定 reason_code',
            'evidence': [{'source_id': '候选允许的 source_id', 'span_id': '候选允许的 span_id'}],
            'confidence': 'high | medium | low',
            'risk_flags': [],
        }],
    }


def build_task(pack_id: str, protocol_id: str, batch: dict[str, Any], anchors: list[dict[str, Any]]) -> str:
    task = {
        'task': 'adjudicate_candidate_batch',
        'pack_id': pack_id,
        'protocol_id': protocol_id,
        'neighborhood_ids': batch['neighborhood_ids'],
        'read_only_anchors': [
            {'candidate_id': item['candidate_id'], 'exact_name': item['exact_name']} for item in anchors
        ],
        'candidates': batch['candidates'],
        'allowed_reason_codes_by_decision': {
            decision: sorted(codes) for decision, codes in REASON_CODES.items()
        },
        'allowed_risk_flags': sorted(RISK_FLAGS),
        'output_instruction': '只返回下列对象本身。不得增加 top_level、output_contract 或其他包装层。',
        'output_contract': output_contract(pack_id, protocol_id),
    }
    return canonical_json(task) + '\n'


def build_request(protocol_id: str, context_pack: str, task: str) -> tuple[dict[str, Any], str]:
    prefix = PROTOCOL_PATHS[protocol_id].read_text(encoding='utf-8').rstrip() + '\n'
    messages = [
        {'role': 'system', 'content': prefix},
        {'role': 'user', 'content': context_pack},
        {'role': 'user', 'content': task},
    ]
    request = {
        'model': MODEL, 'messages': messages, 'stream': False, 'max_tokens': 12000,
        'temperature': 0, 'response_format': {'type': 'json_object'},
    }
    return request, sha256_text(canonical_json(messages[:2]))


def _decision_content(response: dict[str, Any]) -> dict[str, Any]:
    try:
        choice = response['choices'][0]
        content = choice['message']['content']
    except (KeyError, IndexError, TypeError) as error:
        raise AdjudicationError('Provider response has no choices[0].message.content') from error
    if choice.get('finish_reason') != 'stop':
        raise AdjudicationError(f'Model did not finish cleanly: {choice.get("finish_reason")!r}')
    if not isinstance(content, str):
        raise AdjudicationError('Provider decision content must be a string')
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as error:
        raise AdjudicationError(f'Model decision content is not JSON: {error}') from error
    if not isinstance(parsed, dict):
        raise AdjudicationError('Model decision JSON must be an object')
    return parsed


def validate_decisions(
    parsed: dict[str, Any], *, pack_id: str, protocol_id: str, batch: dict[str, Any],
    anchors: list[dict[str, Any]], span_by_key: dict[tuple[str, str], Any],
) -> dict[str, Any]:
    if set(parsed) != {'pack_id', 'protocol_id', 'decisions'}:
        raise AdjudicationError('Decision JSON contains missing or unexpected top-level fields')
    if parsed.get('pack_id') != pack_id or parsed.get('protocol_id') != protocol_id:
        raise AdjudicationError('Decision pack_id or protocol_id does not match the request')
    raw_decisions = parsed.get('decisions')
    if not isinstance(raw_decisions, list):
        raise AdjudicationError('Decision JSON must contain a decisions array')
    batch_by_id = {item['candidate_id']: item for item in batch['candidates']}
    anchor_by_id = {item['candidate_id']: item for item in anchors}
    expected_ids = set(batch_by_id)
    received_ids = [item.get('candidate_id') for item in raw_decisions if isinstance(item, dict)]
    if len(raw_decisions) != len(expected_ids) or set(received_ids) != expected_ids or len(set(received_ids)) != len(received_ids):
        raise AdjudicationError('Every batch candidate must be covered exactly once; new IDs are forbidden')

    materialized: list[dict[str, Any]] = []
    merge_edges: dict[str, str] = {}
    reserved_names = {normalize_name(item['exact_name']) for item in batch['candidates'] + anchors}
    rename_names: set[str] = set()
    for raw in raw_decisions:
        if not isinstance(raw, dict):
            raise AdjudicationError('Every decision must be an object')
        expected_fields = {
            'candidate_id', 'decision', 'target_candidate_id', 'canonical_name',
            'reason_code', 'evidence', 'confidence', 'risk_flags',
        }
        if set(raw) != expected_fields:
            raise AdjudicationError('Decision contains missing or unexpected fields')
        cid = raw['candidate_id']
        decision = raw.get('decision')
        if decision not in DECISIONS:
            raise AdjudicationError(f'{cid} has an unknown decision')
        if raw.get('reason_code') not in REASON_CODES[decision]:
            raise AdjudicationError(f'{cid} has a reason code incompatible with {decision}')
        confidence = raw.get('confidence')
        risk_flags = raw.get('risk_flags')
        if confidence not in CONFIDENCES:
            raise AdjudicationError(f'{cid} has invalid confidence')
        if not isinstance(risk_flags, list) or any(flag not in RISK_FLAGS for flag in risk_flags):
            raise AdjudicationError(f'{cid} has invalid risk flags')
        if len(set(risk_flags)) != len(risk_flags):
            raise AdjudicationError(f'{cid} repeats a risk flag')

        target = raw.get('target_candidate_id')
        canonical_name = raw.get('canonical_name')
        if decision == 'MERGE':
            if target not in batch_by_id and target not in anchor_by_id:
                raise AdjudicationError(f'{cid} merge target is outside the batch and read-only anchors')
            if target == cid:
                raise AdjudicationError(f'{cid} cannot merge into itself')
            merge_edges[cid] = target
        elif target is not None:
            raise AdjudicationError(f'{cid} may only provide target_candidate_id for MERGE')
        if decision == 'RENAME':
            if not isinstance(canonical_name, str) or not canonical_name.strip():
                raise AdjudicationError(f'{cid} RENAME requires canonical_name')
            normalized = normalize_name(canonical_name)
            if normalized in reserved_names or normalized in rename_names:
                raise AdjudicationError(f'{cid} RENAME creates a name collision')
            rename_names.add(normalized)
        elif canonical_name is not None:
            raise AdjudicationError(f'{cid} may only provide canonical_name for RENAME')

        evidence = raw.get('evidence')
        if not isinstance(evidence, list) or not evidence:
            raise AdjudicationError(f'{cid} requires at least one evidence span')
        allowed = {
            (item['source_id'], item['span_id']) for item in batch_by_id[cid]['allowed_evidence']
        }
        seen: set[tuple[str, str]] = set()
        materialized_evidence: list[dict[str, str]] = []
        for item in evidence:
            if not isinstance(item, dict) or set(item) != {'source_id', 'span_id'}:
                raise AdjudicationError(f'{cid} evidence must contain only source_id and span_id')
            key = (item['source_id'], item['span_id'])
            if key not in allowed or key in seen or key not in span_by_key:
                raise AdjudicationError(f'{cid} evidence is unavailable, duplicated, or not allowed: {key!r}')
            seen.add(key)
            span = span_by_key[key]
            materialized_evidence.append({
                'source_id': span.source_id, 'span_id': span.span_id,
                'quote': span.content, 'source_content_sha256': span.source_content_sha256,
            })
        result = dict(raw)
        result['evidence'] = materialized_evidence
        result['manual_review'] = confidence == 'low' or bool(risk_flags)
        materialized.append(result)

    for start in merge_edges:
        seen: set[str] = set()
        current = start
        while current in merge_edges:
            if current in seen:
                raise AdjudicationError('MERGE decisions contain a cycle')
            seen.add(current)
            current = merge_edges[current]
    return {'pack_id': pack_id, 'protocol_id': protocol_id, 'decisions': materialized}


def load_gold(path: Path, candidate_sets: dict[str, Any]) -> dict[str, Any]:
    gold = extraction.load_json(path)
    rows = gold.get('decisions')
    if gold.get('pack_id') != candidate_sets['pack_id'] or not isinstance(rows, list):
        raise AdjudicationError('Gold contract has the wrong pack or decisions')
    by_name = {row.get('exact_name'): row for row in rows if isinstance(row, dict)}
    if set(by_name) != set(candidate_sets['union_names']):
        raise AdjudicationError('Gold must cover the exact 31-candidate union')
    counts = {decision: sum(row.get('decision') == decision for row in rows) for decision in DECISIONS}
    if counts != {'ACCEPT': 24, 'MERGE': 1, 'RENAME': 0, 'REJECT': 6}:
        raise AdjudicationError(f'Gold decision counts changed: {counts}')
    intersection = [by_name[name] for name in candidate_sets['intersection_names']]
    if any(row.get('decision') != 'ACCEPT' for row in intersection):
        raise AdjudicationError('All 15 exact-intersection gold decisions must be ACCEPT')
    if sum(row.get('authority_review') is True for row in intersection) != 4:
        raise AdjudicationError('Exactly four intersection items must be marked for authority review')
    return gold


def score_decisions(validated: dict[str, Any], candidate_sets: dict[str, Any], gold: dict[str, Any]) -> dict[str, Any]:
    name_by_id = {
        item['candidate_id']: name for name, item in candidate_sets['candidates_by_name'].items()
    }
    expected = {row['exact_name']: row['decision'] for row in gold['decisions']}
    predicted = {name: 'ACCEPT' for name in candidate_sets['bulk_approval_names']}
    for row in validated['decisions']:
        predicted[name_by_id[row['candidate_id']]] = row['decision']
    names = sorted(predicted)
    correct = sum(predicted[name] == expected[name] for name in names)
    return {
        'scored_count': len(names), 'correct_count': correct,
        'accuracy': correct / len(names) if names else 0,
        'mismatches': [
            {'exact_name': name, 'expected': expected[name], 'actual': predicted[name]}
            for name in names if predicted[name] != expected[name]
        ],
    }


def make_run_dir(output_root: Path) -> Path:
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    base = output_root / f'{timestamp}-transfer-function-adjudication-v1'
    result = base
    suffix = 1
    while result.exists():
        suffix += 1
        result = Path(f'{base}-{suffix}')
    result.mkdir(parents=True)
    return result


def write_json(path: Path, value: Any) -> None:
    extraction.write_json(path, value)


def prepare_matrix(args: argparse.Namespace, *, execute: bool) -> int:
    v3_dir = args.v3_run_dir.resolve() if args.v3_run_dir else find_v3_run_dir(args.extraction_root.resolve())
    sections, span_by_key, config, context_pack = source_material(args.config.resolve())
    runs = load_v3_runs(v3_dir)
    candidate_sets = build_candidate_sets(runs, span_by_key, expected_pack_id=config['pack_id'])
    gold_path = args.gold.resolve()
    gold = load_gold(gold_path, candidate_sets)
    batches_by_size = build_batches(candidate_sets)
    anchors = [candidate_sets['candidates_by_name'][name] for name in candidate_sets['bulk_approval_names']]
    run_dir = make_run_dir(args.output_root.resolve())
    write_json(run_dir / 'candidate-sets.json', {
        key: value for key, value in candidate_sets.items() if key != 'candidates_by_name'
    } | {'candidates': list(candidate_sets['candidates_by_name'].values())})
    write_json(run_dir / 'bulk-approval-candidates.json', {'pack_id': config['pack_id'], 'candidates': anchors})
    requests: list[dict[str, Any]] = []
    for protocol_id in PROTOCOL_PATHS:
        for size in (4, 8, 16):
            for batch_index, batch in enumerate(batches_by_size[size], start=1):
                task = build_task(config['pack_id'], protocol_id, batch, anchors)
                request, prefix_hash = build_request(protocol_id, context_pack, task)
                request_name = f'{protocol_id}-size-{size:02d}-batch-{batch_index:02d}'
                request_path = run_dir / f'{request_name}-request.json'
                write_json(request_path, request)
                requests.append({
                    'name': request_name, 'protocol_id': protocol_id, 'batch_size': size,
                    'batch_index': batch_index, 'candidate_count': len(batch['candidates']),
                    'candidate_ids': [item['candidate_id'] for item in batch['candidates']],
                    'cache_prefix_sha256': prefix_hash,
                    'prompt_prefix_sha256': sha256_text(request['messages'][0]['content']),
                    'request_sha256': sha256_text(canonical_json(request)),
                    'request_file': request_path.name,
                })
    if execute:
        requests = [
            item for item in requests
            if (args.protocol is None or item['protocol_id'] == args.protocol)
            and (args.batch_size is None or item['batch_size'] == args.batch_size)
            and (args.batch_index is None or item['batch_index'] == args.batch_index)
        ]
        if not requests:
            raise AdjudicationError('Matrix selectors did not match any experiment cell')
    metadata = {
        'state': 'prepared' if not execute else 'running', 'model': MODEL,
        'temperature': 0, 'v3_run_dir': str(v3_dir), 'v3_artifact_sha256': [
            sha256_text((v3_dir / f'run-0{i}-candidates.json').read_text(encoding='utf-8')) for i in (1, 2, 3)
        ],
        'source_hashes': {section.source_id: sha256_text(section.content) for section in sections},
        'context_pack_sha256': sha256_text(context_pack),
        'gold_sha256': sha256_text(gold_path.read_text(encoding='utf-8')),
        'gold_file': gold_path.name, 'requests': requests,
    }
    write_json(run_dir / 'experiment-metadata.json', metadata)
    if not execute:
        write_json(run_dir / 'summary.json', {'state': 'prepared', 'request_count': len(requests)})
        print(f'Prepared adjudication matrix: {run_dir}')
        return 0

    api_key = extraction.require_api_key()
    endpoint = f'{args.base_url.rstrip("/")}/chat/completions'
    outcomes: list[dict[str, Any]] = []
    combined_decisions: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for item in requests:
        print(f'starting {item["name"]}', flush=True)
        request = extraction.load_json(run_dir / item['request_file'])
        batch = next(
            batch for index, batch in enumerate(batches_by_size[item['batch_size']], start=1)
            if index == item['batch_index']
        )
        started = time.monotonic()
        try:
            response, headers = extraction.request_json(
                endpoint, api_key, method='POST', body=request, timeout_seconds=args.timeout_seconds,
            )
            elapsed_ms = round((time.monotonic() - started) * 1000)
            write_json(run_dir / f'{item["name"]}-response.json', response)
            accounting = extraction.validate_provider_accounting(response, headers)
            parsed = _decision_content(response)
            validated = validate_decisions(
                parsed, pack_id=config['pack_id'], protocol_id=item['protocol_id'], batch=batch,
                anchors=anchors, span_by_key=span_by_key,
            )
            write_json(run_dir / f'{item["name"]}-decisions.json', validated)
            combined_decisions.setdefault((item['protocol_id'], item['batch_size']), []).extend(
                validated['decisions']
            )
            outcome = {
                'name': item['name'], 'state': 'succeeded', 'elapsed_ms': elapsed_ms,
                'response_id': response.get('id'), 'trace_id': accounting['trace_id'],
                'usage': accounting['usage'], 'score': score_decisions(validated, candidate_sets, gold),
            }
        except extraction.ProviderResponseDecodeError as error:
            elapsed_ms = round((time.monotonic() - started) * 1000)
            (run_dir / f'{item["name"]}-provider-response.txt').write_text(
                error.response_body, encoding='utf-8'
            )
            outcome = {
                'name': item['name'], 'state': 'failed', 'elapsed_ms': elapsed_ms,
                'failure_kind': type(error).__name__, 'error': str(error),
                'trace_id': error.headers.get('x-siliconcloud-trace-id'),
            }
        except extraction.ProviderRequestError as error:
            elapsed_ms = round((time.monotonic() - started) * 1000)
            (run_dir / f'{item["name"]}-http-error.txt').write_text(
                error.response_body, encoding='utf-8'
            )
            outcome = {
                'name': item['name'], 'state': 'failed', 'elapsed_ms': elapsed_ms,
                'failure_kind': type(error).__name__, 'error': str(error),
                'http_status': error.status,
                'trace_id': error.headers.get('x-siliconcloud-trace-id'),
            }
        except Exception as error:  # one provider call per cell; never retry
            elapsed_ms = round((time.monotonic() - started) * 1000)
            outcome = {
                'name': item['name'], 'state': 'failed', 'elapsed_ms': elapsed_ms,
                'failure_kind': type(error).__name__, 'error': str(error),
            }
        outcomes.append(outcome)
        write_json(run_dir / f'{item["name"]}-summary.json', outcome)
        print(
            f'completed {item["name"]}: state={outcome["state"]} elapsed_ms={outcome["elapsed_ms"]}',
            flush=True,
        )
    final_state = 'succeeded' if all(row['state'] == 'succeeded' for row in outcomes) else 'completed_with_failures'
    aggregate_scores: list[dict[str, Any]] = []
    for protocol_id in PROTOCOL_PATHS:
        for size in (4, 8, 16):
            decisions = combined_decisions.get((protocol_id, size), [])
            expected_count = 16
            if len(decisions) == expected_count and len({row['candidate_id'] for row in decisions}) == expected_count:
                aggregate = score_decisions(
                    {'decisions': decisions}, candidate_sets, gold,
                )
                aggregate_scores.append({
                    'protocol_id': protocol_id, 'batch_size': size, 'state': 'complete', **aggregate,
                })
            else:
                aggregate_scores.append({
                    'protocol_id': protocol_id, 'batch_size': size, 'state': 'incomplete',
                    'received_disputed_count': len(decisions), 'expected_disputed_count': expected_count,
                })
    write_json(run_dir / 'summary.json', {
        'state': final_state, 'runs': outcomes, 'aggregate_scores': aggregate_scores,
    })
    metadata['state'] = final_state
    write_json(run_dir / 'experiment-metadata.json', metadata)
    print(f'Adjudication matrix artifacts: {run_dir}')
    return 0 if final_state == 'succeeded' else 2


def probe(args: argparse.Namespace) -> int:
    api_key = extraction.require_api_key()
    payload, _ = extraction.request_json(f'{args.base_url.rstrip("/")}/models?type=text&sub_type=chat', api_key)
    ids = {item.get('id') for item in payload.get('data', []) if isinstance(item, dict)}
    print(MODEL if MODEL in ids else f'Unavailable: {MODEL}')
    return 0 if MODEL in ids else 3


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default=extraction.DEFAULT_BASE_URL)
    subparsers = parser.add_subparsers(dest='command', required=True)
    probe_parser = subparsers.add_parser('probe')
    probe_parser.set_defaults(handler=probe)
    for command, execute in (('prepare', False), ('matrix', True)):
        child = subparsers.add_parser(command)
        child.add_argument('--config', type=Path, default=DEFAULT_CONFIG)
        child.add_argument('--gold', type=Path, default=DEFAULT_GOLD)
        child.add_argument('--v3-run-dir', type=Path)
        child.add_argument('--extraction-root', type=Path, default=DEFAULT_EXTRACTION_ROOT)
        child.add_argument('--output-root', type=Path, default=DEFAULT_OUTPUT_ROOT)
        child.add_argument('--timeout-seconds', type=int, default=360)
        if execute:
            child.add_argument('--protocol', choices=tuple(PROTOCOL_PATHS))
            child.add_argument('--batch-size', type=int, choices=(4, 8, 16))
            child.add_argument('--batch-index', type=int)
        child.set_defaults(handler=lambda args, value=execute: prepare_matrix(args, execute=value))
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.handler(args)
    except (AdjudicationError, extraction.ExperimentError, OSError) as error:
        print(f'error: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
