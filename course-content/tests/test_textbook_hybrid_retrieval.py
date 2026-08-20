from __future__ import annotations

import importlib.util
import json
import math
import shutil
import subprocess
import sys
import urllib.error
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / 'course-content' / 'scripts' / 'textbook_hybrid_retrieval.py'
SCHEMA_CLI = (
    REPO_ROOT
    / 'course-content'
    / 'scripts'
    / 'validate_textbook_hybrid_retrieval.mjs'
)
BENCHMARK_ROOT = (
    REPO_ROOT / 'course-content' / 'benchmarks' / 'textbook-hybrid-retrieval'
)


def load_module():
    spec = importlib.util.spec_from_file_location('textbook_hybrid_retrieval', SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load {SCRIPT}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


hybrid = load_module()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False) + '\n', encoding='utf-8')


def write_jsonl(path: Path, values: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        '\n'.join(json.dumps(value, ensure_ascii=False) for value in values) + '\n',
        encoding='utf-8',
    )


def add_second_runtime_book(runtime_root: Path, book_id: str) -> None:
    source_book = runtime_root / 'fixture-book'
    other_book = runtime_root / book_id
    shutil.copytree(source_book, other_book)
    for filename in ('units.jsonl', 'windows.jsonl'):
        path = other_book / filename
        rows = [
            json.loads(line)
            for line in path.read_text(encoding='utf-8').splitlines()
        ]
        for row in rows:
            row['bookId'] = book_id
            if 'id' in row:
                row['id'] = row['id'].replace('fixture-book', book_id)
            if 'primaryUnitId' in row:
                row['primaryUnitId'] = row['primaryUnitId'].replace(
                    'fixture-book',
                    book_id,
                )
            for segment in row.get('segments', []):
                segment['owningUnitId'] = segment['owningUnitId'].replace(
                    'fixture-book',
                    book_id,
                )
        write_jsonl(path, rows)
    manifest_path = other_book / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['bookId'] = book_id
    write_json(manifest_path, manifest)


@pytest.fixture(autouse=True)
def fixture_resource_set(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    resource_set_path = tmp_path / 'fixture-resource-set.json'
    write_json(resource_set_path, {
        'resourceSetId': 'fixture-resource-set-v1',
        'sourceRoot': 'course-content/authoring/resources',
        'configRoot': 'course-content/config/textbook-structure-v2',
        'books': ['fixture-book'],
    })
    monkeypatch.setattr(hybrid, 'DEFAULT_RESOURCE_SET_PATH', resource_set_path)
    return resource_set_path


def runtime_fixture(tmp_path: Path, revision: str = 'revision-1') -> Path:
    runtime_root = tmp_path / 'textbooks-v2'
    book_dir = runtime_root / 'fixture-book'
    source_path = 'textbooks/fixture-book/chapter-01/textbook.md'
    unit_one = 'textbook-unit:fixture-book@first/chapter-01/section-1'
    unit_two = 'textbook-unit:fixture-book@first/chapter-01/section-2'
    units = [
        {
            'recordType': 'structure-unit',
            'schemaVersion': 'structured-textbook-runtime.v2',
            'id': unit_one,
            'bookId': 'fixture-book',
            'edition': 'first',
        },
        {
            'recordType': 'structure-unit',
            'schemaVersion': 'structured-textbook-runtime.v2',
            'id': unit_two,
            'bookId': 'fixture-book',
            'edition': 'first',
        },
    ]
    windows = [
        {
            'recordType': 'retrieval-window',
            'schemaVersion': 'structured-textbook-runtime.v2',
            'id': 'textbook-window:fixture-book@first/chapter-01/section-1',
            'primaryUnitId': unit_one,
            'citationTarget': False,
            'segments': [{
                'owningUnitId': unit_one,
                'markdown': '单位阶跃 response G(s)=1。',
                'sourceSpan': {'sourcePath': source_path},
            }],
        },
        {
            'recordType': 'retrieval-window',
            'schemaVersion': 'structured-textbook-runtime.v2',
            'id': 'textbook-window:fixture-book@first/chapter-01/section-2',
            'primaryUnitId': unit_two,
            'citationTarget': False,
            'segments': [
                {
                    'owningUnitId': unit_one,
                    'markdown': '反馈控制 ',
                    'sourceSpan': {'sourcePath': source_path},
                },
                {
                    'owningUnitId': unit_two,
                    'markdown': 'feedback control',
                    'sourceSpan': {'sourcePath': source_path},
                },
            ],
        },
    ]
    write_jsonl(book_dir / 'units.jsonl', units)
    write_jsonl(book_dir / 'windows.jsonl', windows)
    write_json(book_dir / 'manifest.json', {
        'recordType': 'export-manifest',
        'schemaVersion': 'structured-textbook-runtime.v2',
        'bookId': 'fixture-book',
        'edition': 'first',
        'sourceRevision': revision,
        'sourceHashes': {
            source_path: f'sha256:{"1" * 64}',
        },
        'counts': {
            'structureUnits': len(units),
            'retrievalWindows': len(windows),
            'unresolvedAnomalies': 0,
            'pendingSamples': 0,
        },
    })
    return runtime_root


def large_runtime_fixture(tmp_path: Path) -> tuple[Path, str, str, str]:
    runtime_root = runtime_fixture(tmp_path)
    book_dir = runtime_root / 'fixture-book'
    unit_one = 'textbook-unit:fixture-book@first/chapter-01/section-1'
    unit_two = 'textbook-unit:fixture-book@first/chapter-01/section-2'
    source_window_id = 'textbook-window:fixture-book@first/chapter-01/large'
    source_one = 'textbooks/fixture-book/chapter-01/first.md'
    source_two = 'textbooks/fixture-book/chapter-01/second.md'
    first_segment = '甲' * 5988
    second_segment = ('乙' * 10) + '\n\n' + ('丙' * (486265 - 6000))
    write_jsonl(book_dir / 'windows.jsonl', [{
        'recordType': 'retrieval-window',
        'schemaVersion': 'structured-textbook-runtime.v2',
        'id': source_window_id,
        'primaryUnitId': unit_one,
        'citationTarget': False,
        'segments': [
            {
                'owningUnitId': unit_one,
                'markdown': first_segment,
                'sourceSpan': {'sourcePath': source_one},
            },
            {
                'owningUnitId': unit_two,
                'markdown': second_segment,
                'sourceSpan': {'sourcePath': source_two},
            },
        ],
    }])
    manifest_path = book_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['sourceHashes'] = {
        source_one: f'sha256:{"1" * 64}',
        source_two: f'sha256:{"2" * 64}',
    }
    manifest['counts']['retrievalWindows'] = 1
    write_json(manifest_path, manifest)
    return runtime_root, source_window_id, first_segment, second_segment


class FakeEmbedder:
    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def __call__(self, texts):
        self.calls.append(list(texts))
        call_number = len(self.calls)
        return {
            'vectors': [
                [1.0, float(index + 1)]
                for index, _ in enumerate(texts)
            ],
            'usageTokens': len(texts) * 10,
            'latencyMs': float(call_number),
            'traceId': f'build-trace-{call_number}',
        }


def build_fixture(tmp_path: Path, model: str = 'fixture/model'):
    runtime_root = runtime_fixture(tmp_path)
    suffix = model.replace('/', '-')
    output_dir = tmp_path / f'i-{suffix}'
    cache_root = tmp_path / 'cache'
    embedder = FakeEmbedder()
    manifest = hybrid.build_index(
        runtime_root,
        output_dir,
        model=model,
        expected_dimension=2,
        cache_root=cache_root,
        expected_book_count=1,
        batch_size=1,
        embed=embedder,
    )
    return runtime_root, output_dir, cache_root, embedder, manifest


def refresh_index_hashes(output_dir: Path) -> None:
    report_path = output_dir / 'build-report.json'
    report = json.loads(report_path.read_text(encoding='utf-8'))
    report['fileHashes'] = {
        name: hybrid.sha256_file(output_dir / name)
        for name in hybrid.CORE_FILES
    }
    write_json(report_path, report)
    manifest_path = output_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['files'] = {
        **report['fileHashes'],
        'build-report.json': hybrid.sha256_file(report_path),
    }
    write_json(manifest_path, manifest)


def ranking_inputs(
    documents: list[tuple[str, str]],
) -> tuple[list[dict], dict[str, dict[str, int]], bytes]:
    windows = [
        {
            'bookId': book_id,
            'tokenCount': len(hybrid.lexical_tokens(body)),
        }
        for book_id, body in documents
    ]
    postings: dict[str, list[tuple[int, int]]] = {}
    for row, (_, body) in enumerate(documents):
        for token, frequency in hybrid.Counter(
            hybrid.lexical_tokens(body),
        ).items():
            postings.setdefault(token, []).append((row, frequency))
    terms: dict[str, dict[str, int]] = {}
    encoded_parts: list[bytes] = []
    offset = 0
    for token in sorted(postings, key=lambda value: value.encode('utf-8')):
        previous = -1
        encoded = bytearray()
        for row, frequency in postings[token]:
            encoded.extend(hybrid.encode_unsigned_varint(row - previous))
            encoded.extend(hybrid.encode_unsigned_varint(frequency))
            previous = row
        terms[token] = {
            'byteOffset': offset,
            'byteLength': len(encoded),
            'postingCount': len(postings[token]),
        }
        encoded_parts.append(bytes(encoded))
        offset += len(encoded)
    return windows, terms, b''.join(encoded_parts)


def benchmark_record(query_id: str, query: str, unit_id: str) -> dict:
    return {
        'schemaVersion': 'textbook-retrieval-benchmark-entry.v1',
        'queryId': query_id,
        'query': query,
        'category': 'concept',
        'language': 'zh-CN',
        'acceptableUnitIds': [unit_id],
        'preferredUnitId': unit_id,
        'sourceBookIds': ['fixture-book'],
        'rationale': 'fixture',
        'labelingVersion': 'fixture-v1',
    }


def evaluation_inputs(tmp_path: Path) -> tuple[Path, Path, Path]:
    unit_id = 'textbook-unit:fixture-book@first/chapter-01/section-2'
    benchmark_path = tmp_path / 'benchmark.jsonl'
    split_path = tmp_path / 'split.json'
    lock_path = tmp_path / 'benchmark-lock.json'
    write_jsonl(benchmark_path, [
        benchmark_record('tuning-query', '反馈控制', unit_id),
        benchmark_record('acceptance-query', 'feedback control', unit_id),
    ])
    split = {
        'schemaVersion': 'textbook-retrieval-benchmark-split.v1',
        'strategy': 'fixture',
        'lockedAt': '2026-07-25T00:00:00Z',
        'tuningQueryIds': ['tuning-query'],
        'acceptanceQueryIds': ['acceptance-query'],
    }
    write_json(split_path, split)
    write_json(lock_path, {
        'recordType': 'benchmark-lock',
        'lockVersion': 'textbook-hybrid-retrieval-benchmark-lock.v1',
        'benchmarkHash': hybrid.sha256_file(benchmark_path),
        'splitHash': hybrid.sha256_file(split_path),
        'queryCount': 2,
        'tuningQueryCount': 1,
        'acceptanceQueryCount': 1,
        'tuningQueryIdsHash': hybrid.canonical_value_hash(['tuning-query']),
        'acceptanceQueryIdsHash': hybrid.canonical_value_hash(['acceptance-query']),
        'candidateModels': list(hybrid.DECLARED_MODELS),
        'pricing': {
            'currency': 'CNY',
            'unit': 'per-million-input-tokens',
            'version': 'siliconflow-public-model-pricing-cny-2026-07-25',
            'checkedAt': '2026-07-25T00:00:00+08:00',
            'sourceUrl': 'https://siliconflow.cn/pricing',
            'inputCnyPerMillionTokens':
                hybrid.OFFICIAL_INPUT_CNY_PER_MILLION_TOKENS,
        },
    })
    return benchmark_path, split_path, lock_path


class FakeQueryEmbedder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str]]] = []

    def __call__(self, model: str, texts):
        self.calls.append((model, list(texts)))
        return {
            'vectors': [[1.0, 1.0] for _ in texts],
            'usageTokens': len(texts) * 100,
            'latencyMs': 5.0,
            'traceId': f'query-trace-{len(self.calls)}',
        }


def test_normalization_and_tokens_cover_chinese_and_technical_forms() -> None:
    assert hybrid.normalize_text('ＡＢＣ 控制') == 'abc 控制'
    tokens = hybrid.lexical_tokens('控制系统 G(s)=１.０ STEP_response ω_n≈ζ')
    assert {
        '控', '制', '控制', '系统', 'g', 's', '=', '1.0',
        'step_response', 'ω_n', '≈', 'ζ',
    } <= set(tokens)


def test_cache_key_covers_every_contract_component() -> None:
    base = hybrid.embedding_cache_key('m', 2, 'v1', 'sha256:a')
    assert base != hybrid.embedding_cache_key('other', 2, 'v1', 'sha256:a')
    assert base != hybrid.embedding_cache_key('m', 3, 'v1', 'sha256:a')
    assert base != hybrid.embedding_cache_key('m', 2, 'v2', 'sha256:a')
    assert base != hybrid.embedding_cache_key('m', 2, 'v1', 'sha256:b')


@pytest.mark.parametrize(
    'vector,error',
    [
        ([1.0], 'dimension'),
        ([math.nan, 1.0], 'non-finite'),
        ([0.0, 0.0], 'non-zero'),
    ],
)
def test_invalid_vectors_are_rejected(vector, error) -> None:
    with pytest.raises(hybrid.RetrievalContractError, match=error):
        hybrid.validate_and_normalize_vector(vector, 2)


def test_large_runtime_window_is_losslessly_and_deterministically_chunked(
    tmp_path: Path,
) -> None:
    runtime_root, source_window_id, first_segment, second_segment = (
        large_runtime_fixture(tmp_path)
    )
    first_load = hybrid._load_runtime(runtime_root, 1)[2]
    second_load = hybrid._load_runtime(runtime_root, 1)[2]
    assert first_load == second_load
    assert ''.join(chunk['body'] for chunk in first_load) == (
        first_segment + second_segment
    )
    assert sum(len(chunk['body']) for chunk in first_load) == 486265
    assert all(
        0 < len(chunk['body']) <= hybrid.MAX_EMBEDDING_CHUNK_CODEPOINTS
        for chunk in first_load
    )
    assert all(
        chunk['sourceWindowId'] == source_window_id
        for chunk in first_load
    )
    assert [chunk['id'] for chunk in first_load] == sorted(
        chunk['id'] for chunk in first_load
    )
    assert first_load[0]['owningUnitIds'] == [
        'textbook-unit:fixture-book@first/chapter-01/section-1',
        'textbook-unit:fixture-book@first/chapter-01/section-2',
    ]
    assert first_load[0]['sourcePaths'] == [
        'textbooks/fixture-book/chapter-01/first.md',
        'textbooks/fixture-book/chapter-01/second.md',
    ]
    assert first_load[0]['primaryUnitId'].endswith('/section-1')
    for chunk in first_load:
        assert ('甲' in chunk['body']) == (
            chunk['owningUnitIds'][0].endswith('/section-1')
        )
        if '甲' not in chunk['body']:
            assert chunk['owningUnitIds'] == [
                'textbook-unit:fixture-book@first/chapter-01/section-2',
            ]
            assert chunk['sourcePaths'] == [
                'textbooks/fixture-book/chapter-01/second.md',
            ]
            assert chunk['primaryUnitId'].endswith('/section-2')


def test_build_reuses_cache_but_rebuilds_complete_index(tmp_path: Path) -> None:
    runtime_root, output_dir, cache_root, embedder, first = build_fixture(tmp_path)
    assert len(embedder.calls) == 2
    rebuilt_dir = tmp_path / 'rebuilt-index'
    unexpected = FakeEmbedder()
    second = hybrid.build_index(
        runtime_root,
        rebuilt_dir,
        model='fixture/model',
        expected_dimension=2,
        cache_root=cache_root,
        expected_book_count=1,
        embed=unexpected,
    )
    assert unexpected.calls == []
    assert first['counts'] == second['counts']
    assert (output_dir / 'vectors.f32').read_bytes() == (
        rebuilt_dir / 'vectors.f32'
    ).read_bytes()
    report = json.loads((rebuilt_dir / 'build-report.json').read_text())
    assert report['cacheHits'] == 2
    assert report['cacheMisses'] == 0
    assert report['providerBatches'] == 0
    assert report['providerUsageTokens'] == 0
    assert report['providerLatencyMs'] == {
        'batchCount': 0,
        'samples': [],
        'p50': 0.0,
        'p95': 0.0,
        'total': 0.0,
    }
    assert report['providerTraceIds'] == []


def test_build_deduplicates_repeated_content_before_provider_batches(
    tmp_path: Path,
) -> None:
    runtime_root = runtime_fixture(tmp_path)
    book_dir = runtime_root / 'fixture-book'
    windows_path = book_dir / 'windows.jsonl'
    source_windows = [
        json.loads(line)
        for line in windows_path.read_text(encoding='utf-8').splitlines()
    ]
    duplicate = json.loads(json.dumps(source_windows[0]))
    duplicate['id'] = (
        'textbook-window:fixture-book@first/chapter-01/section-1-copy'
    )
    write_jsonl(windows_path, [*source_windows, duplicate])
    manifest_path = book_dir / 'manifest.json'
    runtime_manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    runtime_manifest['counts']['retrievalWindows'] = 3
    write_json(manifest_path, runtime_manifest)

    output_dir = tmp_path / 'index'
    cache_root = tmp_path / 'cache'
    embedder = FakeEmbedder()
    first_manifest = hybrid.build_index(
        runtime_root,
        output_dir,
        model='fixture/model',
        expected_dimension=2,
        cache_root=cache_root,
        expected_book_count=1,
        batch_size=32,
        embed=embedder,
    )

    assert len(embedder.calls) == 1
    assert len(embedder.calls[0]) == 2
    assert embedder.calls[0].count('单位阶跃 response G(s)=1。') == 1
    first_report = json.loads(
        (output_dir / 'build-report.json').read_text(encoding='utf-8')
    )
    assert first_report['cacheHits'] == 0
    assert first_report['cacheMisses'] == 3
    assert first_report['providerBatches'] == 1
    assert first_report['providerUsageTokens'] == 20

    indexed_windows = [
        json.loads(line)
        for line in (output_dir / 'windows.jsonl').read_text(
            encoding='utf-8',
        ).splitlines()
    ]
    repeated_rows = [
        row['vectorRow']
        for row in indexed_windows
        if row['contentHash'] == indexed_windows[0]['contentHash']
    ]
    assert len(repeated_rows) == 2
    vector_width = first_manifest['observedDimension'] * 4
    first_vectors = (output_dir / 'vectors.f32').read_bytes()
    repeated_vector_bytes = {
        first_vectors[row * vector_width:(row + 1) * vector_width]
        for row in repeated_rows
    }
    assert len(repeated_vector_bytes) == 1

    rebuilt_dir = tmp_path / 'rebuilt-index'
    unexpected = FakeEmbedder()
    hybrid.build_index(
        runtime_root,
        rebuilt_dir,
        model='fixture/model',
        expected_dimension=2,
        cache_root=cache_root,
        expected_book_count=1,
        batch_size=1,
        embed=unexpected,
    )
    assert unexpected.calls == []
    assert (rebuilt_dir / 'vectors.f32').read_bytes() == first_vectors
    rebuilt_report = json.loads(
        (rebuilt_dir / 'build-report.json').read_text(encoding='utf-8')
    )
    assert rebuilt_report['cacheHits'] == 3
    assert rebuilt_report['cacheMisses'] == 0
    assert rebuilt_report['providerBatches'] == 0
    assert rebuilt_report['providerUsageTokens'] == 0


def test_initial_build_records_provider_usage_latency_and_safe_trace(
    tmp_path: Path,
) -> None:
    _, output_dir, _, _, _ = build_fixture(tmp_path)
    report_text = (output_dir / 'build-report.json').read_text()
    report = json.loads(report_text)
    assert report['providerUsageTokens'] == 20
    assert report['providerLatencyMs'] == {
        'batchCount': 2,
        'samples': [1.0, 2.0],
        'p50': 1.5,
        'p95': 1.95,
        'total': 3.0,
    }
    assert report['providerTraceIds'] == ['build-trace-1', 'build-trace-2']
    assert '单位阶跃' not in report_text
    assert 'secret' not in report_text.lower()


def test_verify_closes_offsets_vectors_and_runtime_revision(tmp_path: Path) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    assert hybrid.verify_index(
        output_dir,
        runtime_root=runtime_root,
        expected_book_count=1,
    )['status'] == 'valid'
    manifest_path = runtime_root / 'fixture-book' / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['sourceRevision'] = 'revision-2'
    write_json(manifest_path, manifest)
    with pytest.raises(hybrid.RetrievalContractError, match='stale'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


def test_index_records_resource_set_id(tmp_path: Path) -> None:
    _, output_dir, _, _, manifest = build_fixture(tmp_path)
    assert manifest['resourceSetId'] == 'fixture-resource-set-v1'
    report = json.loads(
        (output_dir / 'build-report.json').read_text(encoding='utf-8')
    )
    assert report['resourceSetId'] == 'fixture-resource-set-v1'


def test_verify_accepts_explicit_resource_set_and_rejects_stale_count(
    tmp_path: Path,
) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    resource_set_path = tmp_path / 'fixture-resource-set.json'
    result = hybrid.verify_index(
        output_dir,
        runtime_root=runtime_root,
        resource_set=resource_set_path,
    )
    assert result['resourceSetId'] == 'fixture-resource-set-v1'
    with pytest.raises(hybrid.RetrievalContractError, match='disagree'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=2,
        )


def test_runtime_rejects_matching_count_with_wrong_book_set(
    tmp_path: Path,
) -> None:
    runtime_root = runtime_fixture(tmp_path)
    add_second_runtime_book(runtime_root, 'other-book')
    source_revision, books, _ = hybrid._load_runtime(
        runtime_root,
        expected_book_count=2,
        expected_book_ids=['fixture-book', 'other-book'],
    )
    assert source_revision == 'revision-1'
    assert [book['bookId'] for book in books] == ['fixture-book', 'other-book']
    with pytest.raises(hybrid.RetrievalContractError, match='textbook set'):
        hybrid._load_runtime(
            runtime_root,
            expected_book_count=2,
            expected_book_ids=['fixture-book', 'missing-book'],
        )


def test_build_and_verify_reject_same_count_wrong_book_set(
    tmp_path: Path,
) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    wrong_resource_set = tmp_path / 'wrong-resource-set.json'
    write_json(wrong_resource_set, {
        'resourceSetId': 'wrong-resource-set-v1',
        'sourceRoot': 'course-content/authoring/resources',
        'configRoot': 'course-content/config/textbook-structure-v2',
        'books': ['missing-book'],
    })
    with pytest.raises(hybrid.RetrievalContractError, match='textbook set'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            resource_set=wrong_resource_set,
        )
    with pytest.raises(hybrid.RetrievalContractError, match='textbook set'):
        hybrid.build_index(
            runtime_root,
            tmp_path / 'wrong-index',
            model='fixture/model',
            expected_dimension=2,
            cache_root=tmp_path / 'wrong-cache',
            resource_set=wrong_resource_set,
            embed=FakeEmbedder(),
        )


def test_compact_lexical_index_preserves_postings_and_ranking(tmp_path: Path) -> None:
    _, output_dir, _, _, _ = build_fixture(tmp_path)
    windows = hybrid._read_jsonl(output_dir / 'windows.jsonl')
    lexical_records = hybrid._read_jsonl(output_dir / 'lexical-terms.jsonl')
    assert lexical_records[0] == {
        'recordType': 'lexical-terms-header',
        'formatVersion': hybrid.FORMAT_VERSION,
        'normalizationVersion': hybrid.NORMALIZATION_VERSION,
    }
    assert all(
        record['recordType'] == 'lexical-term'
        for record in lexical_records[1:]
    )
    terms, postings_bytes = hybrid._load_lexical_index(output_dir, len(windows))
    expected: dict[str, list[list[int]]] = {}
    for row, window in enumerate(windows):
        body = (output_dir / 'bodies.utf8').read_bytes()[
            window['bodyOffset']:window['bodyOffset'] + window['bodyLength']
        ].decode('utf-8')
        for token, frequency in hybrid.Counter(hybrid.lexical_tokens(body)).items():
            expected.setdefault(token, []).append([row, frequency])
    assert set(terms) == set(expected)
    assert {
        token: hybrid._decode_posting_slice(postings_bytes, term, len(windows))
        for token, term in terms.items()
    } == expected

    query = '反馈 control'
    scores = hybrid.Counter()
    for token in hybrid.lexical_tokens(query):
        for row, frequency in expected.get(token, []):
            scores[row] += frequency
    old_ranking = [
        row for row, _ in sorted(
            scores.items(), key=lambda item: (-item[1], item[0]),
        )
    ]
    assert hybrid._query_rank(
        query,
        terms,
        postings_bytes,
        len(windows),
        [(1.0, 0.0)] * len(windows),
        None,
    ) == old_ranking


def test_four_channel_rank_gates_and_tie_breaks_match_runtime() -> None:
    documents = [
        ('hu-shousong-auto-control-8th', '中文 中文 术语 反馈控制'),
        ('hu-shousong-auto-control-8th', '中文 术语 反馈控制'),
        ('dorf-modern-control-systems', '中文 术语 现代控制'),
        ('reference-work', '普通查询 稳定裕度'),
    ]
    windows, terms, postings_bytes = ranking_inputs(documents)
    books = [
        {'bookId': 'hu-shousong-auto-control-8th', 'edition': '第八版'},
        {'bookId': 'dorf-modern-control-systems', 'edition': '14th Global Edition'},
        {'bookId': 'reference-work', 'edition': '2015版'},
    ]
    assert hybrid._bm25_rank(
        '反馈控制', terms, postings_bytes, windows,
    ) == []
    assert hybrid._bm25_rank(
        '反馈控制中文叫什么', terms, postings_bytes, windows,
    )
    assert hybrid._matching_book_ids('反馈控制中文叫什么', books) == set()
    assert hybrid._matching_book_ids(
        'hu shousong 反馈控制', books,
    ) == {'hu-shousong-auto-control-8th'}
    assert hybrid._matching_book_ids(
        '第八版 反馈控制', books,
    ) == {'hu-shousong-auto-control-8th'}

    ranked = hybrid._query_rank(
        'hu shousong 8th 第八版 反馈控制中文叫什么',
        terms,
        postings_bytes,
        len(windows),
        [(1.0, 0.0), (0.8, 0.6), (0.0, 1.0), (-1.0, 0.0)],
        [1.0, 0.0],
        windows=windows,
        books=books,
        source_priority=[book['bookId'] for book in books],
    )
    assert ranked[0] == 0

    tie_windows, tie_terms, tie_postings = ranking_inputs([
        ('lower-priority-book', '反馈反馈'),
        ('higher-priority-book', '反馈'),
    ])
    assert hybrid._query_rank(
        '反馈',
        tie_terms,
        tie_postings,
        len(tie_windows),
        [(0.0, 1.0), (1.0, 0.0)],
        [1.0, 0.0],
        windows=tie_windows,
        books=[
            {'bookId': 'lower-priority-book', 'edition': 'lower'},
            {'bookId': 'higher-priority-book', 'edition': 'higher'},
        ],
        source_priority=['higher-priority-book', 'lower-priority-book'],
    ) == [1, 0]


def test_verify_rejects_compact_lexical_contract_corruption(tmp_path: Path) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    terms_path = output_dir / 'lexical-terms.jsonl'
    terms_document = hybrid._read_jsonl(terms_path)
    terms_document[2]['byteOffset'] = 0
    write_jsonl(terms_path, terms_document)
    refresh_index_hashes(output_dir)
    with pytest.raises(hybrid.RetrievalContractError, match='offsets'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )

    runtime_root, output_dir, _, _, _ = build_fixture(
        tmp_path / 'noncanonical',
    )
    terms_path = output_dir / 'lexical-terms.jsonl'
    terms_document = hybrid._read_jsonl(terms_path)
    first = terms_document[1]
    binary_path = output_dir / 'lexical-postings.bin'
    original = binary_path.read_bytes()
    binary_path.write_bytes(b'\x81\x00' + original[1:])
    first['byteLength'] += 1
    for term in terms_document[2:]:
        term['byteOffset'] += 1
    write_jsonl(terms_path, terms_document)
    refresh_index_hashes(output_dir)
    with pytest.raises(hybrid.RetrievalContractError, match='noncanonical'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )

    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path / 'trailing')
    binary_path = output_dir / 'lexical-postings.bin'
    binary_path.write_bytes(binary_path.read_bytes() + b'\x00')
    refresh_index_hashes(output_dir)
    with pytest.raises(hybrid.RetrievalContractError, match='do not close'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


def test_verify_rejects_legacy_lexical_layout(tmp_path: Path) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    manifest_path = output_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['files'].pop('lexical-terms.jsonl')
    manifest['files'].pop('lexical-postings.bin')
    manifest['files']['lexical-terms.json'] = f'sha256:{"0" * 64}'
    write_json(manifest_path, manifest)
    with pytest.raises(hybrid.RetrievalContractError, match='file inventory'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


def test_verify_rejects_offset_body_corruption(tmp_path: Path) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    windows_path = output_dir / 'windows.jsonl'
    rows = [
        json.loads(line)
        for line in windows_path.read_text(encoding='utf-8').splitlines()
    ]
    rows[1]['bodyOffset'] += 1
    write_jsonl(windows_path, rows)
    manifest_path = output_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest['files']['windows.jsonl'] = hybrid.sha256_file(windows_path)
    write_json(manifest_path, manifest)
    with pytest.raises(hybrid.RetrievalContractError, match='contiguous'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


def test_verify_rejects_body_tampering_after_manifest_rehash(tmp_path: Path) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    bodies_path = output_dir / 'bodies.utf8'
    bodies = bytearray(bodies_path.read_bytes())
    bodies[0] ^= 1
    bodies_path.write_bytes(bodies)
    refresh_index_hashes(output_dir)
    with pytest.raises(hybrid.RetrievalContractError, match='body closure'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


@pytest.mark.parametrize(
    ('field', 'value', 'message'),
    [
        ('contentHash', f'sha256:{"0" * 64}', 'runtime reference'),
        ('tokenCount', -1, 'runtime reference'),
    ],
)
def test_verify_retains_offline_window_semantic_checks(
    tmp_path: Path,
    field: str,
    value: object,
    message: str,
) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    windows_path = output_dir / 'windows.jsonl'
    rows = hybrid._read_jsonl(windows_path)
    rows[0][field] = value
    write_jsonl(windows_path, rows)
    refresh_index_hashes(output_dir)
    with pytest.raises(hybrid.RetrievalContractError, match=message):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


def test_verify_rejects_tampered_source_window_id(tmp_path: Path) -> None:
    runtime_root, output_dir, _, _, _ = build_fixture(tmp_path)
    windows_path = output_dir / 'windows.jsonl'
    rows = [
        json.loads(line)
        for line in windows_path.read_text(encoding='utf-8').splitlines()
    ]
    rows[0]['sourceWindowId'] = 'textbook-window:fixture-book@first/tampered'
    write_jsonl(windows_path, rows)
    manifest_path = output_dir / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['files']['windows.jsonl'] = hybrid.sha256_file(windows_path)
    write_json(manifest_path, manifest)
    with pytest.raises(hybrid.RetrievalContractError, match='runtime reference'):
        hybrid.verify_index(
            output_dir,
            runtime_root=runtime_root,
            expected_book_count=1,
        )


def test_vendor_request_contains_only_model_and_public_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = {}

    class Response:
        headers = {
            'x-siliconcloud-trace-id': 'siliconflow-trace-1047',
        }

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self):
            return json.dumps({
                'data': [{'index': 0, 'embedding': [3.0, 4.0]}],
                'usage': {'total_tokens': 7},
            }).encode()

    def fake_urlopen(request, timeout):
        captured['payload'] = json.loads(request.data.decode())
        captured['timeout'] = timeout
        return Response()

    monkeypatch.setattr(hybrid.urllib.request, 'urlopen', fake_urlopen)
    client = hybrid.SiliconFlowEmbeddingClient(
        'secret',
        'fixture/model',
        timeout=2.5,
    )
    vectors = client.embed(['公开教材正文'])
    assert captured == {
        'payload': {'model': 'fixture/model', 'input': ['公开教材正文']},
        'timeout': 2.5,
    }
    assert vectors == [[3.0, 4.0]]
    assert client.embed_with_usage(['公开教材正文']) == ([[3.0, 4.0]], 7)
    evidence = client.embed_with_evidence(['公开教材正文'])
    assert evidence['vectors'] == [[3.0, 4.0]]
    assert evidence['usageTokens'] == 7
    assert evidence['latencyMs'] >= 0
    assert evidence['traceId'] == 'siliconflow-trace-1047'
    assert 'learnerState' not in json.dumps(captured)


def test_vendor_error_does_not_expose_key_or_provider_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(*_args, **_kwargs):
        raise urllib.error.HTTPError(
            'https://api.siliconflow.cn/v1/embeddings',
            401,
            'provider-secret-body',
            {},
            None,
        )

    monkeypatch.setattr(hybrid.urllib.request, 'urlopen', fail)
    client = hybrid.SiliconFlowEmbeddingClient('top-secret-key', 'fixture/model')
    with pytest.raises(RuntimeError) as captured:
        client.embed(['公开教材正文'])
    message = str(captured.value)
    assert message == 'SiliconFlow embedding request failed'
    assert 'top-secret-key' not in message
    assert 'provider-secret-body' not in message


def test_vendor_retries_429_then_records_only_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0
    sleeps: list[float] = []

    class Response:
        headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def read(self):
            return json.dumps({
                'data': [{'index': 0, 'embedding': [3.0, 4.0]}],
                'usage': {'total_tokens': 7},
            }).encode()

    def fake_urlopen(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        if calls == 1:
            raise urllib.error.HTTPError(
                hybrid.DEFAULT_ENDPOINT,
                429,
                'rate limited',
                {'Retry-After': '0.01'},
                None,
            )
        return Response()

    monkeypatch.setattr(hybrid.urllib.request, 'urlopen', fake_urlopen)
    monkeypatch.setattr(hybrid.time, 'sleep', sleeps.append)
    client = hybrid.SiliconFlowEmbeddingClient('secret', 'fixture/model')
    evidence = client.embed_with_evidence(['公开教材正文'])
    assert calls == 2
    assert sleeps == [0.01]
    assert evidence['vectors'] == [[3.0, 4.0]]
    assert evidence['usageTokens'] == 7


def test_vendor_does_not_retry_non_retryable_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    def fake_urlopen(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        raise urllib.error.HTTPError(
            hybrid.DEFAULT_ENDPOINT,
            400,
            'bad request',
            {},
            None,
        )

    monkeypatch.setattr(hybrid.urllib.request, 'urlopen', fake_urlopen)
    monkeypatch.setattr(
        hybrid.time,
        'sleep',
        lambda _seconds: pytest.fail('400 response must not be retried'),
    )
    client = hybrid.SiliconFlowEmbeddingClient('secret', 'fixture/model')
    with pytest.raises(RuntimeError, match='SiliconFlow embedding request failed'):
        client.embed(['公开教材正文'])
    assert calls == 1


def test_cache_miss_without_key_or_provider_fails_closed(tmp_path: Path) -> None:
    runtime_root = runtime_fixture(tmp_path)
    with pytest.raises(hybrid.RetrievalContractError, match='provider is required'):
        hybrid.build_index(
            runtime_root,
            tmp_path / 'index',
            cache_root=tmp_path / 'cache',
            expected_book_count=1,
            embed=None,
        )


def test_provider_failure_does_not_publish_partial_index(tmp_path: Path) -> None:
    runtime_root = runtime_fixture(tmp_path)

    def fail(_):
        raise RuntimeError('provider unavailable')

    output_dir = tmp_path / 'index'
    with pytest.raises(RuntimeError, match='provider unavailable'):
        hybrid.build_index(
            runtime_root,
            output_dir,
            cache_root=tmp_path / 'cache',
            expected_book_count=1,
            embed=fail,
        )
    assert not output_dir.exists()


def test_retry_exhaustion_does_not_publish_partial_index(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    def fake_urlopen(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        raise urllib.error.HTTPError(
            hybrid.DEFAULT_ENDPOINT,
            503,
            'temporarily unavailable',
            {},
            None,
        )

    monkeypatch.setattr(hybrid.urllib.request, 'urlopen', fake_urlopen)
    monkeypatch.setattr(hybrid.time, 'sleep', lambda _seconds: None)
    client = hybrid.SiliconFlowEmbeddingClient('secret', 'fixture/model')
    output_dir = tmp_path / 'index'
    with pytest.raises(RuntimeError, match='SiliconFlow embedding request failed'):
        hybrid.build_index(
            runtime_fixture(tmp_path),
            output_dir,
            cache_root=tmp_path / 'cache',
            expected_book_count=1,
            embed=client.embed_with_evidence,
        )
    assert calls == hybrid.SILICONFLOW_MAX_RETRIES + 1
    assert not output_dir.exists()


def test_schema_cli_validates_generated_manifest_windows_and_report(
    tmp_path: Path,
) -> None:
    _, output_dir, _, _, _ = build_fixture(tmp_path)
    completed = subprocess.run(
        ['node', str(SCHEMA_CLI), '--index-dir', str(output_dir)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout
    report = json.loads(completed.stdout)
    assert report['failures'] == []
    assert report['recordsValidated'] == (
        2
        + len(hybrid._read_jsonl(output_dir / 'windows.jsonl'))
        + len(hybrid._read_jsonl(output_dir / 'lexical-terms.jsonl'))
    )


def test_schema_cli_rejects_tampered_source_window_id(tmp_path: Path) -> None:
    _, output_dir, _, _, _ = build_fixture(tmp_path)
    row = json.loads(
        (output_dir / 'windows.jsonl').read_text(encoding='utf-8').splitlines()[0],
    )
    row['sourceWindowId'] = 'textbook-window:fixture-book@first/tampered'
    fixture_path = tmp_path / 'tampered-window.json'
    write_json(fixture_path, row)
    completed = subprocess.run(
        ['node', str(SCHEMA_CLI), '--file', str(fixture_path)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 1
    assert 'source window identity' in completed.stdout


def test_real_benchmark_lock_has_complete_inventory_and_fields() -> None:
    benchmark, split, lock, lock_hash = hybrid._validate_benchmark_lock(
        BENCHMARK_ROOT / 'benchmark.jsonl',
        BENCHMARK_ROOT / 'split.json',
        BENCHMARK_ROOT / 'benchmark-lock.json',
    )
    assert len(benchmark) == 50
    assert len(split['tuningQueryIds']) == 39
    assert len(split['acceptanceQueryIds']) == 11
    assert lock['queryCount'] == 50
    assert lock_hash.startswith('sha256:')
    assert {record['queryId'] for record in benchmark} == {
        *split['tuningQueryIds'],
        *split['acceptanceQueryIds'],
    }
    assert lock['pricing'] == {
        'currency': 'CNY',
        'unit': 'per-million-input-tokens',
        'version': 'siliconflow-public-model-pricing-cny-2026-07-25',
        'checkedAt': '2026-07-25T00:00:00+08:00',
        'sourceUrl': 'https://siliconflow.cn/pricing',
        'inputCnyPerMillionTokens': {
            'BAAI/bge-m3': 0,
            'Qwen/Qwen3-Embedding-0.6B': 0.07,
            'Qwen/Qwen3-Embedding-4B': 0.14,
        },
    }
    history_root = BENCHMARK_ROOT / 'history' / 'v1-initial-holdout'
    history_benchmark, history_split, history_lock, _ = (
        hybrid._validate_benchmark_lock(
            history_root / 'benchmark.jsonl',
            history_root / 'split.json',
            history_root / 'benchmark-lock.json',
        )
    )
    assert len(history_benchmark) == 36
    assert len(history_split['tuningQueryIds']) == 29
    assert len(history_split['acceptanceQueryIds']) == 7
    assert history_lock['queryCount'] == 36


def test_model_selection_compares_exact_models_without_acceptance_text(
    tmp_path: Path,
) -> None:
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS
    ]
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    embedder = FakeQueryEmbedder()
    selection = hybrid.evaluate_models(
        index_dirs,
        benchmark_path,
        split_path,
        lock_path,
        embed=embedder,
        batch_size=1,
    )
    assert [candidate['model'] for candidate in selection['candidates']] == list(
        hybrid.DECLARED_MODELS,
    )
    assert selection['selectedModel'] == 'BAAI/bge-m3'
    assert selection['selectionRule'] == (
        'recall-and-resident-artifact-passing-apiCostCny-indexBytes-model'
    )
    assert selection['acceptanceEvaluated'] is False
    assert all(candidate['recallPassed'] is True
               for candidate in selection['candidates'])
    assert all(candidate['residentArtifactBudgetBytes']
               == hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES
               for candidate in selection['candidates'])
    assert all(candidate['residentArtifactPassed'] is True
               for candidate in selection['candidates'])
    assert all(candidate['corpusUsageTokens'] == 20
               for candidate in selection['candidates'])
    assert all(candidate['queryUsageTokens'] == 100
               for candidate in selection['candidates'])
    assert all(candidate['usageTokens'] == 120
               for candidate in selection['candidates'])
    assert all(candidate['providerTraceIds'] == [
        'build-trace-1',
        'build-trace-2',
        candidate['queryTraceIds'][0],
    ] for candidate in selection['candidates'])
    assert all(candidate['embeddingLatencyMs']['batchCount'] == 1
               for candidate in selection['candidates'])
    assert {text for _, texts in embedder.calls for text in texts} == {'反馈控制'}
    assert all(
        result['mode'] == 'lexical-vector-rrf'
        for candidate in selection['candidates']
        for result in candidate['results']
    )
    report_path = tmp_path / 'selection-report.json'
    write_json(report_path, selection)
    completed = subprocess.run(
        ['node', str(SCHEMA_CLI), '--selection-report', str(report_path)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout


def test_resident_artifact_bytes_matches_node_loader_file_set(tmp_path: Path) -> None:
    _, output_dir, _, _, _ = build_fixture(tmp_path)
    expected = sum(
        (output_dir / name).stat().st_size
        for name in (
            'manifest.json',
            'windows.jsonl',
            'lexical-terms.jsonl',
            'lexical-postings.bin',
            'build-report.json',
            'vectors.f32',
        )
    )
    assert hybrid._resident_artifact_bytes(output_dir) == expected
    assert (output_dir / 'bodies.utf8').stat().st_size > 0
    assert hybrid._resident_artifact_bytes(output_dir) < sum(
        path.stat().st_size for path in output_dir.iterdir() if path.is_file()
    )


def test_model_selection_excludes_high_recall_candidate_over_budget(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS
    ]
    resident_sizes = {
        index_dirs[0]: hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES + 1,
        index_dirs[1]: hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES,
        index_dirs[2]: hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES,
    }
    monkeypatch.setattr(
        hybrid,
        '_resident_artifact_bytes',
        lambda index_dir: resident_sizes[index_dir],
    )
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    selection = hybrid.evaluate_models(
        index_dirs,
        benchmark_path,
        split_path,
        lock_path,
        embed=FakeQueryEmbedder(),
    )
    rejected = selection['candidates'][0]
    assert rejected['recallPassed'] is True
    assert rejected['residentArtifactPassed'] is False
    assert rejected['passed'] is False
    assert selection['selectedModel'] == 'Qwen/Qwen3-Embedding-0.6B'


def test_model_selection_fails_closed_when_all_candidates_exceed_budget(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS
    ]
    monkeypatch.setattr(
        hybrid,
        '_resident_artifact_bytes',
        lambda _index_dir: hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES + 1,
    )
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    with pytest.raises(
        hybrid.RetrievalContractError,
        match='Recall@10 and resident artifact budget',
    ):
        hybrid.evaluate_models(
            index_dirs,
            benchmark_path,
            split_path,
            lock_path,
            embed=FakeQueryEmbedder(),
        )


def test_model_selection_accepts_exact_resident_artifact_budget_boundary(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS
    ]
    monkeypatch.setattr(
        hybrid,
        '_resident_artifact_bytes',
        lambda _index_dir: hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES,
    )
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    selection = hybrid.evaluate_models(
        index_dirs,
        benchmark_path,
        split_path,
        lock_path,
        embed=FakeQueryEmbedder(),
    )
    assert selection['selectedModel'] == 'BAAI/bge-m3'
    assert all(candidate['residentArtifactBytes']
               == hybrid.RESIDENT_ARTIFACT_BUDGET_BYTES
               for candidate in selection['candidates'])
    assert all(candidate['residentArtifactPassed'] is True
               and candidate['passed'] is True
               for candidate in selection['candidates'])


def test_model_selection_requires_exactly_three_declared_indexes(
    tmp_path: Path,
) -> None:
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS[:2]
    ]
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    with pytest.raises(hybrid.RetrievalContractError, match='exactly three'):
        hybrid.evaluate_models(
            index_dirs,
            benchmark_path,
            split_path,
            lock_path,
            embed=FakeQueryEmbedder(),
        )


def test_model_selection_rejects_different_derived_corpora(
    tmp_path: Path,
) -> None:
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS
    ]
    manifest_path = index_dirs[-1] / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['sourceRevision'] = 'different-revision'
    write_json(manifest_path, manifest)
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    with pytest.raises(hybrid.RetrievalContractError, match='same derived corpus'):
        hybrid.evaluate_models(
            index_dirs,
            benchmark_path,
            split_path,
            lock_path,
            embed=FakeQueryEmbedder(),
        )


def selection_and_lock_fixture(tmp_path: Path):
    index_dirs = [
        build_fixture(tmp_path, model=model)[1]
        for model in hybrid.DECLARED_MODELS
    ]
    benchmark_path, split_path, lock_path = evaluation_inputs(tmp_path)
    selection = hybrid.evaluate_models(
        index_dirs,
        benchmark_path,
        split_path,
        lock_path,
        embed=FakeQueryEmbedder(),
    )
    selected_dir = index_dirs[
        list(hybrid.DECLARED_MODELS).index(selection['selectedModel'])
    ]
    selection_path = tmp_path / 'selection-report.json'
    write_json(selection_path, selection)
    locked_path = tmp_path / 'locked-config.json'
    write_json(locked_path, {
        'locked': True,
        'selectionReportHash': hybrid.sha256_file(selection_path),
        'selectedModel': selection['selectedModel'],
        'selectedObservedDimension': selection['selectedObservedDimension'],
        'selectedNormalizationVersion': selection['selectedNormalizationVersion'],
        'selectedIndexManifestHash': selection['selectedIndexManifestHash'],
        'benchmarkHash': hybrid.sha256_file(benchmark_path),
        'splitHash': hybrid.sha256_file(split_path),
        'benchmarkLockHash': selection['benchmarkLockHash'],
    })
    return (
        selected_dir,
        benchmark_path,
        split_path,
        lock_path,
        selection_path,
        locked_path,
    )


def test_acceptance_binds_selection_and_validates_schema(tmp_path: Path) -> None:
    inputs = selection_and_lock_fixture(tmp_path)
    acceptance = hybrid.evaluate_acceptance(
        *inputs,
        embed=FakeQueryEmbedder(),
        batch_size=1,
    )
    assert acceptance['evaluatedQueries'] == 1
    assert acceptance['results'][0]['queryId'] == 'acceptance-query'
    assert acceptance['acceptanceEvaluated'] is True
    assert acceptance['queryUsageTokens'] == 100
    assert acceptance['usageTokens'] == 100
    assert acceptance['apiCostCny'] == acceptance['queryApiCostCny']
    assert acceptance['providerTraceIds'] == acceptance['queryTraceIds']
    report_path = tmp_path / 'acceptance-report.json'
    write_json(report_path, acceptance)
    completed = subprocess.run(
        ['node', str(SCHEMA_CLI), '--acceptance-report', str(report_path)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout


def test_acceptance_rejects_split_rewrite_even_with_legacy_hashes_recomputed(
    tmp_path: Path,
) -> None:
    inputs = list(selection_and_lock_fixture(tmp_path))
    split_path = inputs[2]
    locked_path = inputs[5]
    split = json.loads(split_path.read_text())
    split['tuningQueryIds'].append(split['acceptanceQueryIds'].pop())
    write_json(split_path, split)
    locked = json.loads(locked_path.read_text())
    locked['splitHash'] = hybrid.sha256_file(split_path)
    write_json(locked_path, locked)
    with pytest.raises(hybrid.RetrievalContractError, match='split|lock'):
        hybrid.evaluate_acceptance(
            *inputs,
            embed=FakeQueryEmbedder(),
        )


def test_schema_validator_rejects_wrong_selected_candidate(tmp_path: Path) -> None:
    inputs = selection_and_lock_fixture(tmp_path)
    selection = json.loads(inputs[4].read_text())
    selection['selectedModel'] = 'Qwen/Qwen3-Embedding-4B'
    report_path = tmp_path / 'invalid-selection.json'
    write_json(report_path, selection)
    completed = subprocess.run(
        ['node', str(SCHEMA_CLI), '--selection-report', str(report_path)],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 1
    assert 'deterministic rule' in completed.stdout
