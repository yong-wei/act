from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = REPO_ROOT / 'scripts' / 'knowledge-extraction' / 'knowledge_adjudication_experiment.py'
SPEC = importlib.util.spec_from_file_location('knowledge_adjudication_experiment', SCRIPT_PATH)
assert SPEC and SPEC.loader
experiment = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = experiment
SPEC.loader.exec_module(experiment)


def fixture() -> tuple[dict[str, object], dict[tuple[str, str], object], str]:
    _, spans, config, context = experiment.source_material()
    run_dir = experiment.find_v3_run_dir()
    runs = experiment.load_v3_runs(run_dir)
    sets = experiment.build_candidate_sets(runs, spans, expected_pack_id=config['pack_id'])
    return sets, spans, context


def test_frozen_v3_sets_and_ids() -> None:
    sets, _, _ = fixture()
    assert len(sets['union_names']) == 31
    assert len(sets['intersection_names']) == 15
    assert len(sets['disputed_names']) == 16
    assert sets['bulk_approval_names'] == sets['intersection_names']
    expected = experiment.hashlib.sha256(
        'transfer-function-pilot-span-v1\0传递函数'.encode('utf-8')
    ).hexdigest()[:16]
    assert sets['candidates_by_name']['传递函数']['candidate_id'] == expected


def test_bulk_gate_requires_common_legal_hashed_span_and_no_rejection() -> None:
    _, spans, config, _ = experiment.source_material()
    runs = experiment.load_v3_runs(experiment.find_v3_run_dir())
    changed = json.loads(json.dumps(runs, ensure_ascii=False))
    changed[0]['rejected_items'].append({'label': '传递函数', 'reason': 'synonym'})
    try:
        experiment.build_candidate_sets(changed, spans, expected_pack_id=config['pack_id'])
    except experiment.AdjudicationError as error:
        assert 'semantic neighborhoods' in str(error)
    else:
        raise AssertionError('A same-name rejection must remove the item from bulk approval')

    changed = json.loads(json.dumps(runs, ensure_ascii=False))
    changed[0]['candidates'][0]['source_evidence'][0]['source_content_sha256'] = '0' * 64
    try:
        experiment.build_candidate_sets(changed, spans, expected_pack_id=config['pack_id'])
    except experiment.AdjudicationError as error:
        assert 'hash mismatch' in str(error)
    else:
        raise AssertionError('A forged source hash must fail closed')


def test_neighborhood_batches_cover_disputes_once_at_4_8_16() -> None:
    sets, _, _ = fixture()
    batches = experiment.build_batches(sets)
    for size, expected_batches in ((4, 4), (8, 2), (16, 1)):
        assert len(batches[size]) == expected_batches
        names = [item['exact_name'] for batch in batches[size] for item in batch['candidates']]
        assert len(names) == 16
        assert len(set(names)) == 16
        assert set(names) == set(sets['disputed_names'])
        assert all(len(batch['candidates']) == size for batch in batches[size])


def test_requests_are_stable_and_do_not_leak_recall_or_gold() -> None:
    sets, _, context = fixture()
    anchors = [sets['candidates_by_name'][name] for name in sets['bulk_approval_names']]
    batch = experiment.build_batches(sets)[4][0]
    task = experiment.build_task(sets['pack_id'], 'p1', batch, anchors)
    first, first_hash = experiment.build_request('p1', context, task)
    second, second_hash = experiment.build_request('p1', context, task)
    serialized = experiment.canonical_json(first)
    assert experiment.canonical_json(first) == experiment.canonical_json(second)
    assert first_hash == second_hash
    assert first['model'] == 'deepseek-ai/DeepSeek-V4-Pro'
    assert first['temperature'] == 0
    assert first['messages'][-1]['content'] == task
    for forbidden in ('observed_runs', 'majority', 'rejected_items', 'authority_review', 'gold_id', 'gold_sha256'):
        assert forbidden not in serialized


def valid_decisions(batch: dict[str, object]) -> dict[str, object]:
    return {
        'pack_id': 'transfer-function-pilot-span-v1',
        'protocol_id': 'p1',
        'decisions': [{
            'candidate_id': item['candidate_id'],
            'decision': 'ACCEPT',
            'target_candidate_id': None,
            'canonical_name': None,
            'reason_code': 'INDEPENDENT_CONCEPT',
            'evidence': [item['allowed_evidence'][0]],
            'confidence': 'high',
            'risk_flags': [],
        } for item in batch['candidates']],
    }


def test_contract_materializes_evidence_and_flags_review_only() -> None:
    sets, spans, _ = fixture()
    batch = experiment.build_batches(sets)[4][0]
    anchors = [sets['candidates_by_name'][name] for name in sets['bulk_approval_names']]
    parsed = valid_decisions(batch)
    parsed['decisions'][0]['confidence'] = 'low'
    parsed['decisions'][0]['risk_flags'] = ['boundary_ambiguity']
    validated = experiment.validate_decisions(
        parsed, pack_id=sets['pack_id'], protocol_id='p1', batch=batch,
        anchors=anchors, span_by_key=spans,
    )
    first = validated['decisions'][0]
    assert first['manual_review'] is True
    assert first['decision'] == 'ACCEPT'
    assert first['evidence'][0]['quote']
    assert len(first['evidence'][0]['source_content_sha256']) == 64


def test_contract_rejects_bad_evidence_merge_cycles_and_rename_collisions() -> None:
    sets, spans, _ = fixture()
    batch = experiment.build_batches(sets)[4][0]
    anchors = [sets['candidates_by_name'][name] for name in sets['bulk_approval_names']]

    bad = valid_decisions(batch)
    bad['decisions'][0]['evidence'] = [{'source_id': 'unknown', 'span_id': 'unknown'}]
    try:
        experiment.validate_decisions(
            bad, pack_id=sets['pack_id'], protocol_id='p1', batch=batch,
            anchors=anchors, span_by_key=spans,
        )
    except experiment.AdjudicationError as error:
        assert 'not allowed' in str(error)
    else:
        raise AssertionError('Unavailable evidence must fail closed')

    cyclic = valid_decisions(batch)
    first, second = cyclic['decisions'][:2]
    first.update(decision='MERGE', reason_code='SAME_CONCEPT', target_candidate_id=second['candidate_id'])
    second.update(decision='MERGE', reason_code='SAME_CONCEPT', target_candidate_id=first['candidate_id'])
    try:
        experiment.validate_decisions(
            cyclic, pack_id=sets['pack_id'], protocol_id='p1', batch=batch,
            anchors=anchors, span_by_key=spans,
        )
    except experiment.AdjudicationError as error:
        assert 'cycle' in str(error)
    else:
        raise AssertionError('A merge cycle must fail closed')

    collision = valid_decisions(batch)
    collision['decisions'][0].update(
        decision='RENAME', reason_code='CANONICAL_NAME_ALIGNMENT', canonical_name='传递函数',
    )
    try:
        experiment.validate_decisions(
            collision, pack_id=sets['pack_id'], protocol_id='p1', batch=batch,
            anchors=anchors, span_by_key=spans,
        )
    except experiment.AdjudicationError as error:
        assert 'collision' in str(error)
    else:
        raise AssertionError('A rename collision must fail closed')


def test_contract_rejects_unexpected_top_level_and_decision_fields() -> None:
    sets, spans, _ = fixture()
    batch = experiment.build_batches(sets)[4][0]
    anchors = [sets['candidates_by_name'][name] for name in sets['bulk_approval_names']]

    unexpected_top = valid_decisions(batch)
    unexpected_top['unexpected'] = True
    try:
        experiment.validate_decisions(
            unexpected_top, pack_id=sets['pack_id'], protocol_id='p1', batch=batch,
            anchors=anchors, span_by_key=spans,
        )
    except experiment.AdjudicationError as error:
        assert 'top-level' in str(error)
    else:
        raise AssertionError('Unexpected top-level fields must fail closed')

    unexpected_decision = valid_decisions(batch)
    unexpected_decision['decisions'][0]['unexpected'] = True
    try:
        experiment.validate_decisions(
            unexpected_decision, pack_id=sets['pack_id'], protocol_id='p1', batch=batch,
            anchors=anchors, span_by_key=spans,
        )
    except experiment.AdjudicationError as error:
        assert 'unexpected fields' in str(error)
    else:
        raise AssertionError('Unexpected decision fields must fail closed')


def test_gold_contract_and_prepare_artifacts_exclude_secret() -> None:
    sets, _, _ = fixture()
    gold = experiment.load_gold(experiment.DEFAULT_GOLD, sets)
    counts = {
        decision: sum(row['decision'] == decision for row in gold['decisions'])
        for decision in experiment.DECISIONS
    }
    assert counts == {'ACCEPT': 24, 'MERGE': 1, 'RENAME': 0, 'REJECT': 6}
    intersection = [row for row in gold['decisions'] if row['exact_name'] in sets['intersection_names']]
    assert len(intersection) == 15
    assert all(row['decision'] == 'ACCEPT' for row in intersection)
    assert sum(row['authority_review'] for row in intersection) == 4

    secret = 'secret-that-must-never-be-persisted'
    original = os.environ.get(experiment.API_KEY_ENV)
    os.environ[experiment.API_KEY_ENV] = secret
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            args = SimpleNamespace(
                v3_run_dir=experiment.find_v3_run_dir(), extraction_root=experiment.DEFAULT_EXTRACTION_ROOT,
                config=experiment.DEFAULT_CONFIG, gold=experiment.DEFAULT_GOLD,
                output_root=Path(temp_dir), base_url='https://api.siliconflow.cn/v1', timeout_seconds=10,
            )
            assert experiment.prepare_matrix(args, execute=False) == 0
            artifacts = ''.join(
                path.read_text(encoding='utf-8') for path in Path(temp_dir).rglob('*') if path.is_file()
            )
            assert secret not in artifacts
            metadata_path = next(Path(temp_dir).rglob('experiment-metadata.json'))
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            assert metadata['gold_sha256']
            assert len(metadata['requests']) == 28
    finally:
        if original is None:
            os.environ.pop(experiment.API_KEY_ENV, None)
        else:
            os.environ[experiment.API_KEY_ENV] = original


def main() -> None:
    tests = [
        test_frozen_v3_sets_and_ids,
        test_bulk_gate_requires_common_legal_hashed_span_and_no_rejection,
        test_neighborhood_batches_cover_disputes_once_at_4_8_16,
        test_requests_are_stable_and_do_not_leak_recall_or_gold,
        test_contract_materializes_evidence_and_flags_review_only,
        test_contract_rejects_bad_evidence_merge_cycles_and_rename_collisions,
        test_gold_contract_and_prepare_artifacts_exclude_secret,
    ]
    for test in tests:
        test()
    print('knowledge adjudication experiment tests passed')


if __name__ == '__main__':
    main()
