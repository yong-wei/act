from __future__ import annotations

from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import zlib

import pytest


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / 'scripts'
    / 'textbook_visual_retrieval.py'
)
SPEC = importlib.util.spec_from_file_location('textbook_visual_retrieval', MODULE_PATH)
assert SPEC and SPEC.loader
visual = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(visual)
SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567'


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows),
        encoding='utf-8',
    )


def png_bytes(width: int = 128, height: int = 96, marker: bytes = b'') -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + kind
            + data
            + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
        )

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw_row = b'\x00' + (b'\x00\x00\x00' * width)
    pixels = raw_row * height
    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', ihdr)
        + chunk(b'tEXt', b'marker=' + marker)
        + chunk(b'IDAT', zlib.compress(pixels))
        + chunk(b'IEND', b'')
    )


def make_runtime_fixture(
    tmp_path: Path,
    *,
    ambiguous: bool = False,
) -> tuple[Path, Path]:
    v1_root = tmp_path / 'v1'
    v2_root = tmp_path / 'v2'
    book_id = 'fixture-book'
    v1_book = v1_root / book_id
    v2_book = v2_root / book_id
    edition = 'fixture edition'
    write_json(v1_book / 'manifest.json', {
        'version': 'textbook-resource-export.v1',
        'bookId': book_id,
        'edition': edition,
    })
    write_json(v2_book / 'manifest.json', {
        'recordType': 'export-manifest',
        'schemaVersion': 'structured-textbook-runtime.v2',
        'bookId': book_id,
        'edition': edition,
        'sourceRevision': 'fixture',
        'productionConnected': False,
    })
    labels = (
        ('root locus plot', 'root-locus'),
        ('Bode frequency response', 'frequency-domain'),
        ('unit step response curve', 'response-curve'),
        ('feedback block diagram', 'block-diagram'),
        ('servo mechanism', 'general'),
    )
    figures = []
    units = []
    anchors = []
    for index, (caption, _) in enumerate(labels, 1):
        chapter = f'chapter-{index:02d}'
        line = 10
        figure_id = f'fig-{index}'
        image = v1_book / 'assets' / chapter / f'{figure_id}.png'
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(png_bytes(marker=bytes([index])))
        digest = hashlib.sha256(image.read_bytes()).hexdigest()
        source_path = f'textbooks/{book_id}/{chapter}/textbook.md'
        unit_id = f'textbook-unit:{book_id}@fixture/{chapter}/section-{index}'
        anchor_id = f'{unit_id}#figure-{index}'
        figures.append({
            'id': figure_id,
            'bookId': book_id,
            'sectionId': f'section-{index}',
            'chapterId': chapter,
            'path': f'assets/{figure_id}.png',
            'exportPath': f'assets/{figure_id}.png',
            'runtimeAssetPath': (
                f'/course-runtime/resources/textbooks/{book_id}/assets/'
                f'{chapter}/{figure_id}.png'
            ),
            'assetStatus': 'available',
            'href': f'#figure-{index}',
            'alt': '',
            'caption': caption,
            'sourcePdfPage': index,
            'sha256': digest,
            'lineNumber': line,
        })
        units.append({
            'id': unit_id,
            'bookId': book_id,
            'edition': edition,
            'chapterId': chapter,
            'structuralPath': [chapter, f'section-{index}'],
            'parentId': None,
            'ancestorIds': [],
            'level': 2,
            'kind': 'section',
            'naturalNumber': str(index),
            'title': caption,
            'markdown': f'## {caption}\nRelevant bounded owning text.',
            'sourceSpan': {
                'sourcePath': source_path,
                'startLine': 5,
                'endLine': 15,
                'startByte': 0,
                'endByte': 100,
            },
            'fragmentAnchorIds': [anchor_id],
            'recordType': 'structure-unit',
            'schemaVersion': 'structured-textbook-runtime.v2',
        })
        anchors.append({
            'id': anchor_id,
            'owningUnitId': unit_id,
            'kind': 'figure',
            'naturalNumber': str(index),
            'ordinal': 1,
            'sourceSpan': {
                'sourcePath': source_path,
                'startLine': line,
                'endLine': line,
                'startByte': 20,
                'endByte': 30,
            },
            'recordType': 'fragment-anchor',
            'schemaVersion': 'structured-textbook-runtime.v2',
        })
    if ambiguous:
        duplicate = dict(anchors[0])
        duplicate['id'] = f'{units[0]["id"]}#figure-duplicate'
        anchors.append(duplicate)
    write_jsonl(v1_book / 'figure-index.jsonl', figures)
    write_jsonl(v2_book / 'units.jsonl', units)
    write_jsonl(v2_book / 'anchors.jsonl', anchors)
    return v1_root, v2_root


def make_samples(repo_root: Path, count: int = 12) -> list[dict]:
    rows = []
    for index in range(count):
        stratum = visual.STRATA[index % len(visual.STRATA)]
        source = (
            repo_root
            / 'course-content'
            / 'runtime'
            / 'resources'
            / 'textbooks'
            / 'fixture'
            / 'assets'
            / 'chapter-01'
            / f'figure-{index}.png'
        )
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(png_bytes(marker=bytes([index])))
        rows.append({
            'recordType': 'visual-sample',
            'formatVersion': visual.FORMAT_VERSION,
            'sampleId': f'visual-sample:{index:064x}',
            'bookId': 'fixture',
            'edition': 'v1',
            'owningUnitId': f'textbook-unit:fixture/unit-{index}',
            'anchorId': f'textbook-unit:fixture/unit-{index}#figure-1',
            'title': f'{stratum} figure {index}',
            'description': None,
            'descriptionReviewState': 'unverified',
            'owningText': f'owning text {index}',
            'sourceImage': (
                f'resources/textbooks/fixture/assets/chapter-01/'
                f'figure-{index}.png'
            ),
            'sha256': visual.sha256_file(source),
            'stratum': stratum,
            'width': 128,
            'height': 96,
            'productionConnected': False,
        })
    return rows


def make_queries(samples: list[dict]) -> list[dict]:
    population_hash = visual.candidate_population_hash(samples)
    rows = []
    for index, stratum in enumerate(visual.STRATA):
        accepted = next(row for row in samples if row['stratum'] == stratum)
        rows.append({
            'recordType': 'visual-query',
            'formatVersion': visual.FORMAT_VERSION,
            'queryId': f'query-{index}',
            'query': f'find {stratum}',
            'stratum': stratum,
            'acceptedSampleIds': [accepted['sampleId']],
            'candidatePopulationHash': population_hash,
            'productionConnected': False,
        })
    return rows


class FakeClient:
    def __init__(self) -> None:
        self.inputs: list[tuple[str, object]] = []
        self.balance_calls = 0

    def embed_many(self, model: str, input_values: list[object]) -> dict:
        self.inputs.append((model, list(input_values)))
        vectors = []
        for input_value in input_values:
            digest = hashlib.sha256(
                visual.canonical_json(input_value).encode(),
            ).digest()
            vectors.append([digest[0] + 1, digest[1] + 1, digest[2] + 1])
        return {
            'vectors': vectors,
            'latencyMs': 2.5,
            'usageTokens': 7,
            'traceId': f'trace-{len(self.inputs)}',
        }

    def total_balance(self) -> Decimal:
        self.balance_calls += 1
        return Decimal('100') if self.balance_calls == 1 else Decimal('99.75')


def test_classification_priority_and_round_robin_are_deterministic() -> None:
    assert visual.classify_stratum(
        'block diagram with a root locus',
    ) == 'root-locus'
    assert visual.classify_stratum('Bode plot and step response') == 'frequency-domain'
    assert visual.classify_stratum('阶跃响应框图') == 'response-curve'
    candidates = []
    for stratum in visual.STRATA:
        for book in ('a', 'b', 'c'):
            for index in range(3):
                candidates.append({
                    'sampleId': f'{stratum}:{book}:{index}',
                    'bookId': book,
                    'stratum': stratum,
                })
    first = visual.stratified_sample(candidates, per_stratum=5, seed='fixed')
    second = visual.stratified_sample(list(reversed(candidates)), per_stratum=5, seed='fixed')
    assert [row['sampleId'] for row in first] == [row['sampleId'] for row in second]
    assert set(row['stratum'] for row in first) == set(visual.STRATA)
    assert all(
        len({row['bookId'] for row in first if row['stratum'] == stratum}) == 3
        for stratum in visual.STRATA
    )


def test_description_is_bound_to_exact_image_and_does_not_cross_next_image() -> None:
    markdown = """\
![](assets/first.png)

> Image description: first line
> continuation
caption for the next image
![](assets/second.png)

> Image description: second only
![](assets/third.png)

No description here.
"""
    assert visual.extract_image_description(markdown, 'first.png') == (
        'first line continuation'
    )
    assert visual.extract_image_description(markdown, 'second.png') == 'second only'
    assert visual.extract_image_description(markdown, 'third.png') is None
    assert visual.extract_image_description(markdown, 'missing.png') is None


def test_build_dataset_joins_exact_anchor_and_preserves_unverified_description(
    tmp_path: Path,
) -> None:
    v1_root, v2_root = make_runtime_fixture(tmp_path)
    output = tmp_path / 'dataset'
    summary, samples = visual.build_dataset(
        output,
        v1_root=v1_root,
        v2_root=v2_root,
        per_stratum=1,
    )
    assert summary['physicalImageRecords'] == 5
    assert summary['selectedRecords'] == 5
    assert summary['selectedByStratum'] == {stratum: 1 for stratum in visual.STRATA}
    assert len(samples) == 5
    assert all(row['description'] is None for row in samples)
    assert all(row['descriptionReviewState'] == 'unverified' for row in samples)
    assert all(row['productionConnected'] is False for row in samples)
    assert visual._read_jsonl(output / 'sample.jsonl') == samples


def make_stratification_review(
    candidates: list[dict],
    *,
    actor: str = 'reviewer@example',
) -> list[dict]:
    ordered = list(reversed(candidates))
    assigned = list(visual.STRATA[1:]) + [visual.STRATA[0]]
    return [
        {
            'recordType': 'visual-stratification-review',
            'formatVersion': visual.FORMAT_VERSION,
            'sampleId': sample['sampleId'],
            'assignedStratum': stratum,
            'reviewActor': actor,
            'reviewedAt': '2026-07-26T12:30:00+08:00',
            'imageQuality': 'pass',
            'queryable': True,
            'productionConnected': False,
        }
        for sample, stratum in zip(ordered, assigned)
    ]


def test_build_dataset_accepts_reviewed_stratification_in_review_order(
    tmp_path: Path,
) -> None:
    v1_root, v2_root = make_runtime_fixture(tmp_path)
    candidates, _ = visual.inventory_figures(v1_root, v2_root)
    review_rows = make_stratification_review(candidates)
    review_path = tmp_path / 'stratification-review.jsonl'
    write_jsonl(review_path, review_rows)

    summary, samples = visual.build_dataset(
        tmp_path / 'reviewed-dataset',
        v1_root=v1_root,
        v2_root=v2_root,
        per_stratum=1,
        stratification_review=review_path,
    )

    assert [row['sampleId'] for row in samples] == [
        row['sampleId'] for row in review_rows
    ]
    assert [row['stratum'] for row in samples] == [
        row['assignedStratum'] for row in review_rows
    ]
    assert summary['sampling'] == {
        'algorithm': 'reviewed-stratification-v1',
        'perStratum': 1,
        'reviewFileHash': visual.sha256_file(review_path),
        'reviewActors': ['reviewer@example'],
    }


@pytest.mark.parametrize(
    'failure',
    ('unknown', 'duplicate', 'quality', 'quota'),
)
def test_reviewed_stratification_rejects_invalid_or_unclosed_review(
    tmp_path: Path,
    failure: str,
) -> None:
    v1_root, v2_root = make_runtime_fixture(tmp_path)
    candidates, _ = visual.inventory_figures(v1_root, v2_root)
    review_rows = make_stratification_review(candidates)
    if failure == 'unknown':
        review_rows[0]['sampleId'] = 'visual-sample:' + 'f' * 64
    elif failure == 'duplicate':
        review_rows[1]['sampleId'] = review_rows[0]['sampleId']
    elif failure == 'quality':
        review_rows[0]['imageQuality'] = 'fail'
    else:
        review_rows.pop()
    review_path = tmp_path / f'{failure}.jsonl'
    write_jsonl(review_path, review_rows)

    with pytest.raises(visual.VisualRetrievalContractError):
        visual.build_dataset(
            tmp_path / f'dataset-{failure}',
            v1_root=v1_root,
            v2_root=v2_root,
            per_stratum=1,
            stratification_review=review_path,
        )


def test_inventory_stratifies_from_illustration_metadata_not_neighboring_text(
    tmp_path: Path,
) -> None:
    v1_root, v2_root = make_runtime_fixture(tmp_path)
    units_path = v2_root / 'fixture-book' / 'units.jsonl'
    units = visual._read_jsonl(units_path)
    units[3]['markdown'] += '\nNearby discussion of a root locus.'
    units_path.write_text(
        ''.join(
            json.dumps(row, ensure_ascii=False) + '\n'
            for row in units
        ),
        encoding='utf-8',
    )

    samples, _ = visual.inventory_figures(v1_root, v2_root)

    block_sample = next(
        sample
        for sample in samples
        if 'block diagram' in sample['title']
    )
    assert block_sample['stratum'] == 'block-diagram'


def test_build_dataset_fails_closed_on_ambiguous_figure_anchor(tmp_path: Path) -> None:
    v1_root, v2_root = make_runtime_fixture(tmp_path, ambiguous=True)
    samples, summary = visual.inventory_figures(v1_root, v2_root)
    assert summary['rejectedByReason']['ambiguous-or-missing-v2-join'] == 1
    assert len(samples) == 4
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='all five strata',
    ):
        visual.build_dataset(
            tmp_path / 'dataset',
            v1_root=v1_root,
            v2_root=v2_root,
            per_stratum=1,
        )


def test_evaluate_uses_same_population_top10_fusion_usage_trace_and_cost(
    tmp_path: Path,
) -> None:
    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    output = tmp_path / 'report.json'
    cache = tmp_path / 'cache'
    client = FakeClient()
    report = visual.evaluate(
        samples,
        queries,
        output,
        cache,
        client=client,
        source_revision=SOURCE_REVISION,
        repo_root=repo_root,
    )
    expected_ids = sorted(row['sampleId'] for row in samples)
    assert [variant['name'] for variant in report['variants']] == [
        'text',
        'image',
        'multimodal',
    ]
    assert all(variant['candidateSampleIds'] == expected_ids for variant in report['variants'])
    assert all(
        len(result['ranked']) == 12
        for variant in report['variants']
        for result in variant['rawRankings']
    )
    assert report['topK'] == 10
    assert report['batchSize'] == 4
    assert report['sourceRevision'] == SOURCE_REVISION
    assert report['totalEvaluationLatencyMs'] >= 0
    assert all(
        variant['endToEndLatencyMs'] >= 0
        for variant in report['variants']
    )
    assert report['fusionContract'] == visual.FUSION_CONTRACT
    assert report['cost'] == {
        'status': 'available',
        'currency': 'CNY',
        'balanceDelta': '0.25',
    }
    assert all(operation['usageTokens'] == 7 for operation in report['providerOperations'])
    assert all('traceId' in operation for operation in report['providerOperations'])
    payloads = [value for _, values in client.inputs for value in values]
    assert any(isinstance(value, str) for value in payloads)
    assert any(
        isinstance(value, dict) and 'image' in value
        for value in payloads
    )
    assert any(
        isinstance(value, dict) and set(value) == {'text'}
        for value in payloads
    )
    assert all(1 <= len(values) <= 4 for _, values in client.inputs)
    serialized = output.read_text(encoding='utf-8')
    assert 'data:image/png;base64' not in serialized
    assert str(repo_root) not in serialized
    visual.validate_artifacts(
        _write_rows(tmp_path / 'sample.jsonl', samples),
        _write_rows(tmp_path / 'benchmark.jsonl', queries),
        output,
    )
    report['providerOperations'][0]['cacheHit'] = True
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='provider operation',
    ):
        visual.validate_report(report, samples, queries)
    report['providerOperations'][0]['cacheHit'] = False
    report['variants'][0]['endToEndLatencyMs'] = -1
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='variant latency',
    ):
        visual.validate_report(report, samples, queries)


def _write_rows(path: Path, rows: list[dict]) -> Path:
    write_jsonl(path, rows)
    return path


def test_archive_report_is_one_line_semantically_identical_and_rejects_invalid_source(
    tmp_path: Path,
) -> None:
    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    sample_path = _write_rows(tmp_path / 'sample.jsonl', samples)
    benchmark_path = _write_rows(tmp_path / 'benchmark.jsonl', queries)
    source_path = tmp_path / 'source-report.json'
    source = visual.evaluate(
        samples,
        queries,
        source_path,
        tmp_path / 'cache',
        client=FakeClient(),
        source_revision=SOURCE_REVISION,
        repo_root=repo_root,
    )
    output_path = tmp_path / 'archive' / 'report.json'

    archived = visual.archive_report(
        sample_path,
        benchmark_path,
        source_path,
        output_path,
    )

    assert archived == source
    archived_bytes = output_path.read_bytes()
    assert archived_bytes.endswith(b'\n')
    assert archived_bytes.count(b'\n') == 1
    assert json.loads(archived_bytes) == json.loads(source_path.read_text())

    invalid = dict(source)
    invalid['topK'] = 9
    write_json(source_path, invalid)
    rejected_output = tmp_path / 'rejected.json'
    with pytest.raises(visual.VisualRetrievalContractError):
        visual.archive_report(
            sample_path,
            benchmark_path,
            source_path,
            rejected_output,
        )
    assert not rejected_output.exists()


def test_formal_evaluate_rejects_preexisting_vector_cache_before_provider(
    tmp_path: Path,
) -> None:
    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    cache = tmp_path / 'cache'
    input_value = {'text': 'already cached'}
    visual._store_cache(
        cache,
        visual.VL_MODEL,
        visual.sha256_bytes(visual.canonical_json(input_value).encode()),
        [1, 0],
    )
    client = FakeClient()
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='cold vector cache',
    ):
        visual.evaluate(
            samples,
            queries,
            tmp_path / 'report.json',
            cache,
            client=client,
            source_revision=SOURCE_REVISION,
            repo_root=repo_root,
        )
    assert client.inputs == []
    assert client.balance_calls == 0


def test_failed_partial_run_cache_cannot_be_reused_as_formal_evidence(
    tmp_path: Path,
) -> None:
    class FailSecondBatch(FakeClient):
        def __init__(self) -> None:
            super().__init__()
            self.batch_calls = 0

        def embed_many(self, model: str, input_values: list[object]) -> dict:
            self.batch_calls += 1
            if self.batch_calls == 2:
                self.inputs.append((model, list(input_values)))
                raise visual.ProviderFailure('http-500', 'failed-batch')
            return super().embed_many(model, input_values)

    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    cache = tmp_path / 'cache'
    with pytest.raises(visual.ProviderFailure):
        visual.evaluate(
            samples,
            queries,
            tmp_path / 'failed.json',
            cache,
            client=FailSecondBatch(),
            source_revision=SOURCE_REVISION,
            repo_root=repo_root,
        )
    assert any(path.is_file() for path in (cache / 'vectors').rglob('*'))

    retry_client = FakeClient()
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='cold vector cache',
    ):
        visual.evaluate(
            samples,
            queries,
            tmp_path / 'retry.json',
            cache,
            client=retry_client,
            source_revision=SOURCE_REVISION,
            repo_root=repo_root,
        )
    assert retry_client.inputs == []
    assert retry_client.balance_calls == 0


def test_provider_failure_does_not_publish_report_or_leak_payload(
    tmp_path: Path,
) -> None:
    class FailingClient(FakeClient):
        def embed_many(self, model: str, input_values: list[object]) -> dict:
            raise visual.ProviderFailure('http-429', 'safe-trace')

    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    output = tmp_path / 'report.json'
    with pytest.raises(visual.ProviderFailure) as raised:
        visual.evaluate(
            samples,
            queries,
            output,
            tmp_path / 'cache',
            client=FailingClient(),
            source_revision=SOURCE_REVISION,
            repo_root=repo_root,
        )
    assert raised.value.failure_type == 'http-429'
    assert str(raised.value) == 'SiliconFlow request failed'
    assert not output.exists()


def test_source_revision_is_strict_and_rejected_before_provider(
    tmp_path: Path,
) -> None:
    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    client = FakeClient()
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='40-character lowercase',
    ):
        visual.evaluate(
            samples,
            queries,
            tmp_path / 'report.json',
            tmp_path / 'cache',
            client=client,
            source_revision='ABC123',
            repo_root=repo_root,
        )
    assert client.inputs == []
    assert not (tmp_path / 'report.json').exists()
    cache = tmp_path / 'revision-cache'
    visual._prepare_cache(
        cache,
        visual.candidate_population_hash(samples),
        visual.sha256_bytes(visual._jsonl_bytes(samples)),
        visual.validate_benchmark(queries, samples),
        SOURCE_REVISION,
    )
    drift_client = FakeClient()
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='cache manifest drift',
    ):
        visual.evaluate(
            samples,
            queries,
            tmp_path / 'revision-report.json',
            cache,
            client=drift_client,
            source_revision='f' * 40,
            repo_root=repo_root,
        )
    assert drift_client.inputs == []
    assert drift_client.balance_calls == 0


def test_clean_git_source_revision_rejects_dirty_and_untracked_inputs(
    tmp_path: Path,
) -> None:
    repo = tmp_path / 'repo'
    repo.mkdir()

    def git(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ['git', *args],
            cwd=repo,
            check=True,
            capture_output=True,
            text=True,
        )

    git('init', '-q')
    git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'user.name', 'Fixture')
    script = repo / 'tool.py'
    sample = repo / 'sample.jsonl'
    benchmark = repo / 'benchmark.jsonl'
    script.write_text('print("fixture")\n')
    sample.write_text('{}\n')
    benchmark.write_text('{}\n')
    git('add', 'tool.py', 'sample.jsonl', 'benchmark.jsonl')
    git('commit', '-qm', 'fixture')

    revision = visual.clean_git_source_revision(
        repo,
        [script, sample, benchmark],
    )
    assert revision == git('rev-parse', 'HEAD').stdout.strip()
    assert len(revision) == 40

    sample.write_text('{"dirty":true}\n')
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='differs',
    ):
        visual.clean_git_source_revision(repo, [script, sample, benchmark])
    git('checkout', '--', 'sample.jsonl')

    untracked = repo / 'untracked.jsonl'
    untracked.write_text('{}\n')
    with pytest.raises(
        visual.VisualRetrievalContractError,
        match='not tracked',
    ):
        visual.clean_git_source_revision(repo, [script, untracked, benchmark])


def test_provider_batch_restores_index_order_and_rejects_drift(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = []

    class Response:
        headers = {'x-siliconcloud-trace-id': 'trace-batch'}

        def __init__(self, body: dict) -> None:
            self.body = body

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self) -> bytes:
            return json.dumps(self.body).encode()

    bodies = [{
        'model': visual.VL_MODEL,
        'data': [
            {'index': 1, 'embedding': [0, 2]},
            {'index': 0, 'embedding': [3, 0]},
        ],
        'usage': {'total_tokens': 9},
    }]

    def urlopen(request, timeout):
        captured.append(json.loads(request.data.decode()))
        return Response(bodies.pop(0))

    monkeypatch.setattr(visual.urllib.request, 'urlopen', urlopen)
    client = visual.SiliconFlowVisualClient('secret')
    evidence = client.embed_many(visual.VL_MODEL, [{'text': 'a'}, {'text': 'b'}])
    assert captured[0]['input'] == [{'text': 'a'}, {'text': 'b'}]
    assert evidence['vectors'] == [[1.0, 0.0], [0.0, 1.0]]

    bodies.append({
        'model': 'wrong-model',
        'data': [{'index': 0, 'embedding': [1, 0]}],
        'usage': {'total_tokens': 1},
    })
    with pytest.raises(visual.ProviderFailure) as model_error:
        client.embed_many(visual.VL_MODEL, [{'text': 'a'}])
    assert model_error.value.failure_type == 'model-mismatch'

    bodies.append({
        'model': visual.VL_MODEL,
        'data': [
            {'index': 0, 'embedding': [1, 0]},
            {'index': 1, 'embedding': [1, 0, 0]},
        ],
        'usage': {'total_tokens': 1},
    })
    with pytest.raises(visual.ProviderFailure) as dimension_error:
        client.embed_many(visual.VL_MODEL, [{'text': 'a'}, {'text': 'b'}])
    assert dimension_error.value.failure_type == 'dimension-or-vector-drift'


def test_embed_group_deduplicates_identical_inputs_and_fans_out_cache(
    tmp_path: Path,
) -> None:
    client = FakeClient()
    operations: list[dict] = []
    entries = [
        ('logical-a', {'text': 'identical'}),
        ('logical-b', {'text': 'identical'}),
    ]

    resolved = visual._embed_group(
        client,
        tmp_path / 'cache',
        visual.VL_MODEL,
        entries,
        channel='description-candidate',
        batch_size=1,
        operations=operations,
    )

    assert len(client.inputs) == 1
    assert client.inputs[0][1] == [{'text': 'identical'}]
    assert resolved['logical-a'] == resolved['logical-b']
    assert operations[0]['inputIds'] == ['logical-a', 'logical-b']
    assert operations[0]['uniqueInputCount'] == 1
    assert operations[0]['cacheHit'] is False

    cached_operations: list[dict] = []
    cached = visual._embed_group(
        FakeClient(),
        tmp_path / 'cache',
        visual.VL_MODEL,
        entries,
        channel='description-candidate',
        batch_size=1,
        operations=cached_operations,
    )
    assert cached == resolved
    assert cached_operations == [{
        'channel': 'description-candidate',
        'inputIds': ['logical-a', 'logical-b'],
        'uniqueInputCount': 1,
        'cacheHit': True,
        'latencyMs': 0.0,
        'usageTokens': 0,
    }]


def test_negative_balance_delta_is_unavailable() -> None:
    class BalanceClient:
        def total_balance(self) -> Decimal:
            return Decimal('101')

    assert visual._cost_finish(BalanceClient(), Decimal('100'), None) == {
        'status': 'unavailable',
        'reason': 'account-balance-drift',
    }


def test_validate_rejects_population_or_label_drift(tmp_path: Path) -> None:
    repo_root = tmp_path / 'repo'
    samples = make_samples(repo_root)
    queries = make_queries(samples)
    queries[0]['candidatePopulationHash'] = 'sha256:' + '0' * 64
    with pytest.raises(visual.VisualRetrievalContractError):
        visual.validate_benchmark(queries, samples)
    samples[0]['descriptionReviewState'] = 'reviewed'
    with pytest.raises(visual.VisualRetrievalContractError, match='must not approve'):
        visual.validate_samples(samples)


def test_verify_isolation_scans_production_entries_only(tmp_path: Path) -> None:
    (tmp_path / 'src').mkdir()
    (tmp_path / 'src' / 'safe.ts').write_text('export const safe = true;\n')
    write_json(tmp_path / 'package.json', {'scripts': {'build': 'next build'}})
    assert visual.verify_isolation(tmp_path)['passed'] is True
    (tmp_path / 'src' / 'unsafe.ts').write_text(
        "export const path = 'textbook-visual-retrieval-experiment';\n",
    )
    result = visual.verify_isolation(tmp_path)
    assert result['passed'] is False
    assert result['findings'] == [{
        'path': 'src/unsafe.ts',
        'line': 1,
        'tokens': ['textbook-visual-retrieval-experiment'],
    }]
