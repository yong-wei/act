from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from dataclasses import replace
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / 'course-content' / 'scripts' / 'structured_textbook_runtime.py'
CLI = REPO_ROOT / 'course-content' / 'scripts' / 'export_structured_textbook_runtime_v2.py'
SCHEMA_CLI = (
    REPO_ROOT
    / 'course-content'
    / 'scripts'
    / 'validate_structured_textbook_runtime_v2.mjs'
)


def load_module():
    spec = importlib.util.spec_from_file_location('structured_textbook_runtime', SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load {SCRIPT}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


runtime = load_module()


def parser_config(**updates: object) -> dict:
    config = {
        'configVersion': runtime.CONFIG_VERSION,
        'resourceId': 'fixture-book',
        'edition': 'first',
        'markdownHeadingLevels': {'1': 1, '2': 2, '3': 3, '4': 4},
        'enabledNumberingRules': [
            'english-chapter',
            'arabic-compound',
            'english-example',
            'chinese-example',
            'solution-boundary',
            'parenthesized',
        ],
        'retrievalWindow': {'beforeUnits': 1, 'afterUnits': 1, 'maxBytes': 12000},
        'auditThresholds': {'minimumUnitBytes': 0, 'maximumUnitBytes': 24000},
        'overrides': [],
    }
    config.update(updates)
    return config


def parse(markdown: str):
    return runtime.parse_markdown(
        book_id='fixture-book',
        edition='first',
        chapter_id='chapter-01',
        markdown=markdown,
        config=parser_config(),
        source_path='textbooks/fixture-book/chapter-01/textbook.md',
    )


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False) + '\n', encoding='utf-8')


def create_fixture(tmp_path: Path) -> tuple[Path, Path, Path]:
    authoring_root = tmp_path / 'authoring' / 'resources'
    book_dir = authoring_root / 'textbooks' / 'fixture-book'
    chapter_dir = book_dir / 'chapter-01'
    config_root = tmp_path / 'config'
    runtime_root = tmp_path / 'runtime'
    write_json(book_dir / 'manifest.json', {
        'bookId': 'fixture-book',
        'edition': 'first',
        'chapters': [{
            'id': 'chapter-01',
            'manifestPath': 'chapter-01/manifest.json',
            'textbookPath': 'chapter-01/textbook.md',
        }],
    })
    write_json(chapter_dir / 'manifest.json', {
        'id': 'chapter-01',
        'textbookPath': 'textbook.md',
    })
    (chapter_dir / 'textbook.md').write_text(
        '# Chapter 1 Basics\n\n## 1.1 Feedback\n\n正文含有汉字。\n'
        '\n$$\nx = 1 \\tag{1-1}\n$$\n'
        '\n![Figure 1.1](assets/figure.png)\n'
        '\n| input | output |\n| --- | --- |\n| r | c |\n',
        encoding='utf-8',
    )
    write_json(config_root / 'fixture-book.json', parser_config())
    return authoring_root, config_root, runtime_root


def test_parser_emits_non_overlapping_units_and_anchors() -> None:
    markdown = (
        '# Chapter 1 Basics\n\n'
        '## 1.1 Feedback\n\n正文。\n\n'
        '（1）闭环系统\n内容。\n\n'
        '$$\ny = r \\tag{1-1}\n$$\n\n'
        '![Figure 1.1](figure.png)\n\n'
        '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    )
    result = parse(markdown)
    assert [unit.sourceSpan.startByte for unit in result.units] == [
        0,
        result.units[0].sourceSpan.endByte,
        result.units[1].sourceSpan.endByte,
    ]
    assert result.units[-1].sourceSpan.endByte == len(markdown.encode('utf-8'))
    assert {anchor.kind for anchor in result.anchors} == {'formula', 'figure', 'table'}
    assert all(anchor.owningUnitId in {unit.id for unit in result.units} for anchor in result.anchors)


def test_numbered_unit_id_is_stable_across_title_and_body_edits() -> None:
    before = parse('# Chapter 1 Basics\n\n## 1.1 Old title\n\nold body\n')
    after = parse('# Chapter 1 Revised\n\n## 1.1 New title\n\nnew body with UTF-8 中文\n')
    before_id = next(unit.id for unit in before.units if unit.naturalNumber == '1.1')
    after_id = next(unit.id for unit in after.units if unit.naturalNumber == '1.1')
    assert before_id == after_id


def test_repeated_natural_number_uses_stable_occurrence_identity() -> None:
    before = parse(
        '# Chapter 1 Basics\n\n## 1.1 First\n\nbody\n\n'
        '## 1.1 Repeated context\n\nother body\n'
    )
    after = parse(
        '# Chapter 1 Revised\n\n## 1.1 Renamed\n\nchanged\n\n'
        '## 1.1 Repeated renamed\n\nchanged again\n'
    )
    assert [unit.id for unit in before.units] == [unit.id for unit in after.units]
    assert before.units[-1].structuralPath[-1] == 'section-1.1-occurrence-2'


def test_compact_dash_exercise_is_a_boundary() -> None:
    result = parse('# Chapter 1 Basics\n\n1－2绘制系统框图。\n\n正文。\n')
    exercise = result.units[-1]
    assert exercise.kind == 'exercise'
    assert exercise.naturalNumber == '1.2'
    assert exercise.structuralPath[-1] == 'exercise-1.2'


def test_exact_anomaly_ledger_preserves_disposition_and_reason() -> None:
    config = parser_config(
        auditThresholds={'minimumUnitBytes': 1000, 'maximumUnitBytes': 2000},
    )
    markdown = '# Chapter 1 Basics\n\nbody\n'
    parsed = runtime.parse_markdown(
        book_id='fixture-book',
        edition='first',
        chapter_id='chapter-01',
        markdown=markdown,
        config=config,
        source_path='textbooks/fixture-book/chapter-01/textbook.md',
    )
    anomalies = runtime.detect_anomalies(
        units=parsed.units,
        markdown_by_source={'textbooks/fixture-book/chapter-01/textbook.md': markdown},
        config=config,
    )
    assert anomalies[0].disposition == 'unresolved'
    config['_reviewLedger'] = {
        'anomalies': [{
            'id': anomalies[0].id,
            'sourcePath': anomalies[0].sourceSpan.sourcePath,
            'line': anomalies[0].sourceSpan.startLine,
            'kind': anomalies[0].kind,
            'disposition': 'accepted-structure',
            'reason': 'Reviewed deterministic fixture boundary.',
        }],
    }
    anomalies = runtime.detect_anomalies(
        units=parsed.units,
        markdown_by_source={'textbooks/fixture-book/chapter-01/textbook.md': markdown},
        config=config,
    )
    assert anomalies[0].disposition == 'accepted-structure'
    assert anomalies[0].dispositionRule.startswith('exact-ledger:')
    assert anomalies[0].dispositionReason == 'Reviewed deterministic fixture boundary.'
    moved_markdown = '\n' + markdown
    moved = runtime.parse_markdown(
        book_id='fixture-book',
        edition='first',
        chapter_id='chapter-01',
        markdown=moved_markdown,
        config=config,
        source_path='textbooks/fixture-book/chapter-01/textbook.md',
    )
    moved_anomalies = runtime.detect_anomalies(
        units=moved.units,
        markdown_by_source={
            'textbooks/fixture-book/chapter-01/textbook.md': moved_markdown,
        },
        config=config,
    )
    assert moved_anomalies[0].disposition == 'unresolved'


def test_type_level_anomaly_policy_is_rejected(tmp_path: Path) -> None:
    config = parser_config(anomalyPolicy={
        'undersized-unit': {
            'disposition': 'accepted-structure',
            'reason': 'This must not review future anomalies.',
        },
    })
    write_json(tmp_path / 'fixture-book.json', config)
    with pytest.raises(ValueError, match='type-level anomalyPolicy is forbidden'):
        runtime.load_parser_config('fixture-book', tmp_path)


def test_duplicate_natural_anchor_gets_occurrence_suffix() -> None:
    markdown = (
        '# Chapter 1 Basics\n\n'
        '$$\nx = 1 \\tag{1-1}\n$$\n\n'
        '$$\ny = 2 \\tag{1-1}\n$$\n'
    )
    result = parse(markdown)
    assert len(result.anchors) == len(runtime._anchor_candidates(markdown)) == 2
    assert result.anchors[0].id.endswith('#formula-1.1')
    assert result.anchors[1].id.endswith('#formula-1.1-occurrence-2')


def test_chinese_example_and_solution_are_minimal_units() -> None:
    result = parse(
        '# Chapter 1 Basics\n\n'
        '## 2.1 基础\n\n'
        '例 2－1 求系统响应。\n\n题目正文。\n\n'
        '解 根据定义可得。\n\n解答正文。\n\n'
        '例2.2 证明稳定性。\n\n证明 由判据可知。\n'
    )
    assert [unit.kind for unit in result.units] == [
        'chapter',
        'section',
        'example',
        'solution',
        'example',
        'solution',
    ]
    examples = [unit for unit in result.units if unit.kind == 'example']
    assert [unit.naturalNumber for unit in examples] == ['2.1', '2.2']


def test_numbering_samples_are_grouped_and_default_pending() -> None:
    parsed = parse(
        '# Chapter 1 Basics\n\n'
        '## 1.1 Parent\n\nbody\n\n'
        '### 1.1.1 First\n\nbody\n\n'
        '### 1.1.3 Last\n\nbody\n\n'
        '## 1.2 Sibling\n\nbody\n'
    )
    samples = runtime.build_distributed_samples(parsed.units, parser_config())
    by_unit = {sample.unitId: sample for sample in samples}
    first = next(unit for unit in parsed.units if unit.naturalNumber == '1.1.1')
    last = next(unit for unit in parsed.units if unit.naturalNumber == '1.1.3')
    assert 'numbering-sequence-start' in by_unit[first.id].reasons
    assert 'numbering-sequence-end' in by_unit[last.id].reasons
    assert all(sample.reviewStatus == 'pending' for sample in samples)
    assert all(sample.reviewEvidence is None for sample in samples)


def test_source_spans_use_utf8_byte_offsets() -> None:
    markdown = '# Chapter 1 中文\n\n## 1.1 小节\n\n内容🙂\n'
    result = parse(markdown)
    second = result.units[1]
    expected = len('# Chapter 1 中文\n\n'.encode('utf-8'))
    assert second.sourceSpan.startByte == expected
    assert second.sourceSpan.endByte == len(markdown.encode('utf-8'))


def test_windows_retain_ownership_and_are_not_citation_targets() -> None:
    result = parse(
        '# Chapter 1 Basics\n\n## 1.1 First\n\nfirst\n\n'
        '## 1.2 Second\n\nsecond\n'
    )
    windows = runtime.build_retrieval_windows(result.units, parser_config())
    unit_ids = {unit.id for unit in result.units}
    assert all(window.citationTarget is False for window in windows)
    assert all(segment.owningUnitId in unit_ids for window in windows for segment in window.segments)
    assert not ({window.id for window in windows} & unit_ids)


def test_navigation_and_closure_cover_exact_unit_set(tmp_path: Path) -> None:
    authoring_root, config_root, _ = create_fixture(tmp_path)
    result = runtime.build_export(
        book_id='fixture-book',
        authoring_root=authoring_root,
        config_root=config_root,
        source_revision='test-revision',
    )
    runtime.validate_export_closure(result)
    assert {entry['unitId'] for entry in result.navigation['entries']} == {
        unit.id for unit in result.units
    }
    invalid_window = result.windows[0]
    object.__setattr__(invalid_window, 'citationTarget', True)
    broken = replace(result, windows=[invalid_window, *result.windows[1:]])
    with pytest.raises(ValueError, match='citation target'):
        runtime.validate_export_closure(broken)


def test_manifest_and_written_export_round_trip(tmp_path: Path) -> None:
    authoring_root, config_root, runtime_root = create_fixture(tmp_path)
    result = runtime.build_export(
        book_id='fixture-book',
        authoring_root=authoring_root,
        config_root=config_root,
        source_revision='test-revision',
    )
    output_dir = runtime.write_export(result, runtime_root)
    runtime.validate_written_export(output_dir)
    manifest = json.loads((output_dir / 'manifest.json').read_text(encoding='utf-8'))
    assert manifest['schemaVersion'] == runtime.SCHEMA_VERSION
    assert manifest['productionConnected'] is False
    assert manifest['sourceRevision'] == 'test-revision'
    assert manifest['counts']['structureUnits'] == len(result.units)


def test_cli_audit_only_fixture_reports_revision_without_writing(tmp_path: Path) -> None:
    authoring_root, config_root, runtime_root = create_fixture(tmp_path)
    completed = subprocess.run(
        [
            sys.executable,
            str(CLI),
            '--book',
            'fixture-book',
            '--authoring-root',
            str(authoring_root),
            '--config-root',
            str(config_root),
            '--runtime-root',
            str(runtime_root),
            '--audit-only',
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout
    report = json.loads(completed.stdout)
    assert report['failures'] == []
    assert report['reports'][0]['bookId'] == 'fixture-book'
    revision = subprocess.run(
        ['git', 'rev-parse', 'HEAD'],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    assert report['reports'][0]['sourceRevision'].startswith(revision)
    assert not (runtime_root / 'fixture-book').exists()


def test_unresolved_review_fails_before_existing_runtime_is_changed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    authoring_root, config_root, runtime_root = create_fixture(tmp_path)
    output_dir = runtime_root / 'fixture-book'
    output_dir.mkdir(parents=True)
    marker = output_dir / 'manifest.json'
    marker.write_bytes(b'original-runtime\n')
    original_hash = runtime._sha256_file(marker)
    monkeypatch.setattr(runtime, '_dirty_relevant_inputs', lambda paths: [])
    _, failures = runtime.export_resources(
        book_ids=['fixture-book'],
        authoring_root=authoring_root,
        config_root=config_root,
        runtime_root=runtime_root,
        audit_only=False,
    )
    assert failures[0]['errorType'] == 'UnresolvedReviewError'
    assert runtime._sha256_file(marker) == original_hash


def test_dirty_input_fails_before_existing_runtime_is_changed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    authoring_root, config_root, runtime_root = create_fixture(tmp_path)
    output_dir = runtime_root / 'fixture-book'
    output_dir.mkdir(parents=True)
    marker = output_dir / 'manifest.json'
    marker.write_bytes(b'original-runtime\n')
    original_hash = runtime._sha256_file(marker)
    monkeypatch.setattr(
        runtime,
        '_dirty_relevant_inputs',
        lambda paths: [' M course-content/scripts/structured_textbook_runtime.py'],
    )
    _, failures = runtime.export_resources(
        book_ids=['fixture-book'],
        authoring_root=authoring_root,
        config_root=config_root,
        runtime_root=runtime_root,
        audit_only=False,
    )
    assert failures[0]['errorType'] == 'DirtyInputError'
    assert runtime._sha256_file(marker) == original_hash


def test_schema_validation_cli_validates_every_written_record(tmp_path: Path) -> None:
    authoring_root, config_root, runtime_root = create_fixture(tmp_path)
    result = runtime.build_export(
        book_id='fixture-book',
        authoring_root=authoring_root,
        config_root=config_root,
        source_revision='test-revision',
    )
    output_dir = runtime.write_export(result, runtime_root)
    completed = subprocess.run(
        [
            'node',
            str(SCHEMA_CLI),
            '--runtime-dir',
            str(output_dir),
        ],
        cwd=REPO_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr or completed.stdout
    report = json.loads(completed.stdout)
    expected = sum(result.manifest['counts'][key] for key in (
        'structureUnits',
        'fragmentAnchors',
        'retrievalWindows',
        'anomalies',
        'samples',
    )) + 2
    assert report['recordsValidated'] == expected
    assert report['failures'] == []


@pytest.mark.parametrize('book_id', [
    'hu-shousong-auto-control-7th',
    'hu-shousong-auto-control-8th',
    'hu-shousong-exercise-analysis-3rd',
    'liu-sheng-auto-control-2015',
])
def test_real_chinese_sources_emit_example_or_solution_units(book_id: str) -> None:
    result = runtime.build_export(book_id=book_id, source_revision='test-revision')
    config = runtime.load_parser_config(book_id)
    ignored_boundaries = {
        (
            override['selector']['sourcePath'],
            override['selector']['line'],
        )
        for override in config.get('overrides', [])
        if (
            override.get('action') == 'ignore-boundary'
            and 'sourcePath' in override.get('selector', {})
            and 'line' in override.get('selector', {})
        )
    }
    source_paths = [
        runtime.DEFAULT_AUTHORING_ROOT / source_path
        for source_path in result.manifest['sourceHashes']
        if source_path.endswith('/textbook.md')
    ]
    solution_markers = sum(
        sum(
            bool(re.match(
                r'^(?:解|证明)(?=\s|[：:（(]|$)',
                re.sub(r'^#{1,6}\s+', '', line.strip()),
            ))
            and (
                path.relative_to(runtime.DEFAULT_AUTHORING_ROOT).as_posix(),
                line_number,
            ) not in ignored_boundaries
            for line_number, line in enumerate(
                path.read_text(encoding='utf-8').splitlines(),
                start=1,
            )
        )
        for path in source_paths
    )
    assert sum(unit.kind == 'solution' for unit in result.units) == solution_markers
    if book_id != 'hu-shousong-exercise-analysis-3rd':
        example_markers = sum(
            sum(
                bool(re.match(
                    r'^例\s*\d+(?:\s*[.．－—–-]\s*\d+)+',
                    re.sub(r'^#{1,6}\s+', '', line.strip()),
                ))
                and (
                    path.relative_to(runtime.DEFAULT_AUTHORING_ROOT).as_posix(),
                    line_number,
                ) not in ignored_boundaries
                for line_number, line in enumerate(
                    path.read_text(encoding='utf-8').splitlines(),
                    start=1,
                )
            )
            for path in source_paths
        )
        assert sum(unit.kind == 'example' for unit in result.units) == example_markers


def test_solution_units_belong_to_their_exercise_not_the_last_question_item() -> None:
    result = parse(
        '# Chapter 3 Exercises\n\n'
        '3－24 机器人控制系统。要求：\n'
        '（1）建立模型。\n'
        '（2）分析稳定性。\n'
        '解（1）模型如下。\n'
        '解（2）系统稳定。\n'
    )
    exercise = next(unit for unit in result.units if unit.kind == 'exercise')
    solutions = [unit for unit in result.units if unit.kind == 'solution']
    assert len(solutions) == 2
    assert {unit.parentId for unit in solutions} == {exercise.id}


def test_exact_parent_line_restores_an_earlier_parent_chain_and_stable_ids() -> None:
    source_path = 'textbooks/fixture-book/chapter-01/textbook.md'
    config = parser_config(overrides=[{
        'action': 'set-boundary',
        'selector': {'sourcePath': source_path, 'line': 8},
        'level': 3,
        'kind': 'exercise',
        'pathComponent': 'exercise-restored',
        'parentLine': 3,
    }])
    before_markdown = (
        '# Chapter 1 Basics\n'
        '\n'
        '## 1.1 Stable section\n'
        '\n'
        '### Example 1.1 Temporary example\n'
        'Example body.\n'
        '\n'
        'Restored exercise\n'
        '\n'
        '（1）First item\n'
        'Item body.\n'
    )
    after_markdown = before_markdown.replace(
        'Example body.',
        'Edited example body.',
    ).replace(
        'Item body.',
        'Edited item body.',
    )

    def parse_with_parent_line(markdown: str):
        return runtime.parse_markdown(
            book_id='fixture-book',
            edition='first',
            chapter_id='chapter-01',
            markdown=markdown,
            config=config,
            source_path=source_path,
        )

    before = parse_with_parent_line(before_markdown)
    after = parse_with_parent_line(after_markdown)
    by_line = {unit.sourceSpan.startLine: unit for unit in before.units}

    assert by_line[8].parentId == by_line[3].id
    assert by_line[8].ancestorIds == [by_line[1].id, by_line[3].id]
    assert by_line[10].parentId == by_line[8].id
    assert {
        unit.sourceSpan.startLine: (unit.id, unit.parentId, unit.structuralPath)
        for unit in before.units
    } == {
        unit.sourceSpan.startLine: (unit.id, unit.parentId, unit.structuralPath)
        for unit in after.units
    }


@pytest.mark.parametrize(
    ('parent_line', 'level', 'message'),
    [
        (0, 3, 'parentLine must be a positive integer'),
        (8, 3, 'must identify an earlier structural boundary'),
        (7, 3, 'does not identify an earlier structural boundary'),
        (3, 4, 'does not match parentLine 3 level 2'),
    ],
)
def test_exact_parent_line_fails_closed_for_invalid_targets_or_level(
    parent_line: int,
    level: int,
    message: str,
) -> None:
    source_path = 'textbooks/fixture-book/chapter-01/textbook.md'
    config = parser_config(overrides=[{
        'action': 'set-boundary',
        'selector': {'sourcePath': source_path, 'line': 8},
        'level': level,
        'kind': 'exercise',
        'pathComponent': 'exercise-restored',
        'parentLine': parent_line,
    }])
    markdown = (
        '# Chapter 1 Basics\n'
        '\n'
        '## 1.1 Stable section\n'
        '\n'
        '### Example 1.1 Temporary example\n'
        'Example body.\n'
        '\n'
        'Restored exercise\n'
    )

    with pytest.raises(runtime.StructureAmbiguityError, match=message):
        runtime.parse_markdown(
            book_id='fixture-book',
            edition='first',
            chapter_id='chapter-01',
            markdown=markdown,
            config=config,
            source_path=source_path,
        )


def test_parent_line_config_requires_exact_set_boundary_selector(tmp_path: Path) -> None:
    write_json(tmp_path / 'fixture-book.json', parser_config(overrides=[{
        'action': 'set-boundary',
        'selector': {'title': 'Restored exercise'},
        'level': 3,
        'kind': 'exercise',
        'pathComponent': 'exercise-restored',
        'parentLine': 3,
    }]))
    with pytest.raises(ValueError, match='requires exact sourcePath\\+line'):
        runtime.load_parser_config('fixture-book', tmp_path)


@pytest.mark.parametrize(
    ('book_id', 'proof_line', 'theorem_line', 'item_three_line', 'item_four_line'),
    [
        ('hu-shousong-auto-control-7th', 1774, 1731, 2674, 2795),
        ('hu-shousong-auto-control-8th', 1720, 1680, 2609, 2730),
    ],
)
def test_real_theorem_proofs_and_following_items_keep_their_semantic_parents(
    book_id: str,
    proof_line: int,
    theorem_line: int,
    item_three_line: int,
    item_four_line: int,
) -> None:
    result = runtime.build_export(book_id=book_id, source_revision='test-revision')
    chapter_units = {
        unit.sourceSpan.startLine: unit
        for unit in result.units
        if unit.sourceSpan.sourcePath.endswith('/chapter-10/textbook.md')
    }
    assert chapter_units[proof_line].parentId == chapter_units[theorem_line].id
    assert chapter_units[item_four_line].parentId == chapter_units[item_three_line].parentId


@pytest.mark.parametrize(
    ('book_id', 'chapter_id', 'solution_line', 'example_line'),
    [
        ('hu-shousong-auto-control-7th', 'chapter-07', 3903, 3804),
        ('hu-shousong-auto-control-7th', 'chapter-08', 2492, 2450),
        ('hu-shousong-auto-control-8th', 'chapter-02', 142, 123),
    ],
)
def test_real_solution_after_figure_heading_restores_its_example_parent(
    book_id: str,
    chapter_id: str,
    solution_line: int,
    example_line: int,
) -> None:
    result = runtime.build_export(book_id=book_id, source_revision='test-revision')
    chapter_units = {
        unit.sourceSpan.startLine: unit
        for unit in result.units
        if unit.sourceSpan.sourcePath.endswith(f'/{chapter_id}/textbook.md')
    }
    assert chapter_units[solution_line].parentId == chapter_units[example_line].id


def test_review_ledger_is_invalidated_when_source_content_changes(tmp_path: Path) -> None:
    authoring_root, config_root, _ = create_fixture(tmp_path)
    config_path = config_root / 'fixture-book.json'
    config = parser_config(
        auditThresholds={'minimumUnitBytes': 1000, 'maximumUnitBytes': 24000},
    )
    write_json(config_path, config)
    initial = runtime.build_export(
        book_id='fixture-book',
        authoring_root=authoring_root,
        config_root=config_root,
        source_revision='test-revision',
    )
    config['reviewSourceDigest'] = runtime.source_hashes_digest(
        initial.manifest['sourceHashes']
    )
    config['reviewLedger'] = 'review-ledgers/fixture-book.json'
    write_json(config_path, config)
    write_json(config_root / 'review-ledgers' / 'fixture-book.json', {
        'resourceId': 'fixture-book',
        'anomalies': [{
            'id': anomaly.id,
            'sourcePath': anomaly.sourceSpan.sourcePath,
            'line': anomaly.sourceSpan.startLine,
            'kind': anomaly.kind,
            'disposition': 'accepted-structure',
            'reason': 'Reviewed fixture content.',
        } for anomaly in initial.anomalies],
        'samples': [{
            'id': sample.id,
            'sourcePath': sample.sourceSpan.sourcePath,
            'line': sample.sourceSpan.startLine,
            'evidence': 'Reviewed fixture sample.',
        } for sample in initial.samples],
    })
    reviewed = runtime.build_export(
        book_id='fixture-book',
        authoring_root=authoring_root,
        config_root=config_root,
        source_revision='test-revision',
    )
    assert reviewed.manifest['counts']['unresolvedAnomalies'] == 0
    assert reviewed.manifest['counts']['pendingSamples'] == 0

    markdown_path = (
        authoring_root
        / 'textbooks'
        / 'fixture-book'
        / 'chapter-01'
        / 'textbook.md'
    )
    markdown_path.write_text(
        markdown_path.read_text(encoding='utf-8').replace(
            '正文含有汉字。',
            '正文已替换为新的待审核结构。',
        ),
        encoding='utf-8',
    )
    stale = runtime.build_export(
        book_id='fixture-book',
        authoring_root=authoring_root,
        config_root=config_root,
        source_revision='test-revision',
    )
    assert stale.manifest['counts']['unresolvedAnomalies'] > 0
    assert stale.manifest['counts']['pendingSamples'] > 0


def test_global_level_skip_is_rejected(tmp_path: Path) -> None:
    config = parser_config(allowLevelSkips=True)
    write_json(tmp_path / 'fixture-book.json', config)
    with pytest.raises(ValueError, match='global allowLevelSkips=true is forbidden'):
        runtime.load_parser_config('fixture-book', tmp_path)
