from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


def load_review_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'review_lesson_content.py'
    spec = importlib.util.spec_from_file_location('review_lesson_content', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


review_lesson_content = load_review_module()


def test_review_revision_matches_exported_overlay_for_reconciled_lessons():
    for lesson_id in ('1-1', '4-2', '5-2'):
        check = review_lesson_content.check_knowledge_graph(lesson_id)
        overlay = json.loads(
            (review_lesson_content.RUNTIME_ROOT / 'lessons' / lesson_id / 'graph-overlay.json').read_text(encoding='utf-8')
        )
        assert check['blocking_issues'] == []
        assert check['overlay_revision'] == review_lesson_content.build_lesson_overlay_revision(overlay)['sha256']


def test_authoring_lesson_graph_nodes_use_canonical_id_field():
    lesson_root = Path(__file__).resolve().parents[1] / 'authoring' / 'lessons'
    offenders: list[str] = []
    for nodes_path in lesson_root.glob('*/graph/nodes.jsonl'):
        for line_number, line in enumerate(nodes_path.read_text(encoding='utf-8').splitlines(), start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            if 'node_id' in record or 'id' not in record:
                offenders.append(f'{nodes_path.relative_to(lesson_root.parents[1])}:{line_number}')

    assert offenders == []


def test_check_knowledge_graph_accepts_current_1_1_graph():
    check = review_lesson_content.check_knowledge_graph('1-1')

    assert check['node_count'] == 17
    assert check['relation_count'] == 16
    assert check['blocking_issues'] == []


def test_check_knowledge_graph_relation_names_match_node_ids():
    check = review_lesson_content.check_knowledge_graph('1-1')

    assert check['relation_issues'] == []


@pytest.mark.parametrize('relations', [
    [{'source_id': 'a', 'target_id': 'b', 'relation_type': ''}],
    [{'source_id': 'a', 'target_id': 'b', 'relation_type': 'unknown_type'}],
    [{'source_id': 'a', 'target_id': 'missing', 'relation_type': 'related'}],
    [
        {'source_id': 'a', 'target_id': 'b', 'relation_type': 'related'},
        {'source_id': 'a', 'target_id': 'b', 'relation_type': 'related'},
    ],
])
def test_check_knowledge_graph_blocks_malformed_relations(monkeypatch, tmp_path, relations):
    lesson_dir = tmp_path / 'lesson'
    graph_dir = lesson_dir / 'graph'
    cards_dir = lesson_dir / 'cards'
    graph_dir.mkdir(parents=True)
    cards_dir.mkdir()
    nodes = [
        {'id': node_id, 'name': node_id, 'category': '理论', 'knowledge_type': 'C', 'bloom_level': '理解', 'chapter': 1, 'definition': node_id}
        for node_id in ('a', 'b')
    ]
    (graph_dir / 'nodes.jsonl').write_text('\n'.join(json.dumps(item, ensure_ascii=False) for item in nodes))
    (graph_dir / 'relations.jsonl').write_text('\n'.join(json.dumps(item) for item in relations))
    (lesson_dir / 'manifest.json').write_text(json.dumps({
        'lesson_id': 'fixture', 'card_order': ['a', 'b'],
        'graph_order_policy': 'manifest-reviewed-no-sequence',
    }))
    monkeypatch.setattr(review_lesson_content, 'get_authoring_lesson_dir', lambda _id: lesson_dir)
    monkeypatch.setattr(review_lesson_content, 'get_authoring_cards_dir', lambda _id: cards_dir)
    monkeypatch.setattr(review_lesson_content, 'get_mapped_target_id', lambda _id: None)
    monkeypatch.setattr(review_lesson_content, 'load_combined_authoring_graph', lambda: ({item['id']: item for item in nodes}, relations))

    check = review_lesson_content.check_knowledge_graph('fixture')

    assert 'relation format or endpoint issues' in check['blocking_issues']


def test_extract_expected_code_media_reads_storage_lines():
    multimedia_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '2-2'
        / 'design'
        / '2-2-multimedia.md'
    )

    expected_media = review_lesson_content.extract_expected_code_media(multimedia_path)

    assert [item['output'] for item in expected_media] == [
        '2-2-td-01-time-domain-input-response-overview.svg',
        '2-2-td-02-first-order-step-time-constant.svg',
        '2-2-td-03-second-order-response-families.svg',
        '2-2-td-04-time-domain-indices-annotated.svg',
        '2-2-td-05-example-response-with-indices.svg',
        '2-2-td-06-time-spec-to-pole-region.svg',
        '2-2-cover-comic.png',
        '2-2-intro-video.mp4',
        '2-2-info.png',
        '2-2-slides.pdf',
        '2-2-course.mp4',
        '2-2-audio.m4a',
    ]


def test_extract_expected_code_media_reads_resource_table_assets():
    multimedia_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '3-1'
        / 'design'
        / '3-1-multimedia.md'
    )

    expected_media = review_lesson_content.extract_expected_code_media(multimedia_path)

    assert [item['output'] for item in expected_media] == [
        '3-1-cover-comic.png',
        '3-1-info.png',
        '3-1-slides.pdf',
        '3-1-intro-video.mp4',
        '3-1-course.mp4',
        '3-1-audio.m4a',
        '3-1-pp-01-stability-half-plane.svg',
        '3-1-pp-02-poles-and-modes.svg',
        '3-1-pp-03-dominant-pole-response-families.svg',
        '3-1-pp-04-modal-superposition-high-order.svg',
        '3-1-pp-05-bode-model-reduction.svg',
        '3-1-pp-06-convolution-step-from-impulse.svg',
    ]


def test_extract_expected_code_media_reads_formula_metadata(tmp_path):
    multimedia_path = tmp_path / 'multimedia.md'
    multimedia_path.write_text(
        '\n'.join(
            [
                '### 资源 td-05 | 例题一响应曲线与指标结果',
                '- **存放**：`media/raw/example.py` -> `media/processed/example.svg`',
                '- **公式模式**：`svg-mathtext`',
                '- **页面公式来源**：`design/demo-0-handout.md`, `design/demo-0-interactive-page.md`',
                '',
            ]
        ),
        encoding='utf-8',
    )

    expected_media = review_lesson_content.extract_expected_code_media(multimedia_path)

    assert expected_media == [
        {
            'script': 'example.py',
            'output': 'example.svg',
            'formula_mode': 'svg-mathtext',
            'page_formula_sources': ['design/demo-0-handout.md', 'design/demo-0-interactive-page.md'],
        }
    ]


def test_validate_formula_media_contract_flags_non_svg_and_missing_formula_sources(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-1'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)
    (design_dir / 'demo-1-handout.md').write_text('这里只是普通文字，没有公式。', encoding='utf-8')

    issues = review_lesson_content.validate_formula_media_contract(
        [
            {
                'script': 'example.py',
                'output': 'example.png',
                'formula_mode': 'svg-mathtext',
                'page_formula_sources': ['design/demo-1-handout.md', 'design/demo-1-interactive-page.md'],
            }
        ],
        lesson_dir,
    )

    assert issues == [
        'example.png 声明为 svg-mathtext，但输出格式不是 SVG',
        'example.png 的页面公式来源 `design/demo-1-handout.md` 未检测到 LaTeX 公式标记',
        'example.png 的页面公式来源 `design/demo-1-interactive-page.md` 不存在',
    ]


def test_extract_expected_code_media_reads_3_2_svg_formula_assets():
    multimedia_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '3-2'
        / 'design'
        / '3-2-multimedia.md'
    )

    expected_media = {
        item['output']: item
        for item in review_lesson_content.extract_expected_code_media(multimedia_path)
    }

    assert expected_media['3-2-special-cases-card.svg']['formula_mode'] == 'svg-mathtext'
    assert expected_media['3-2-special-cases-card.svg']['page_formula_sources'] == [
        'design/3-2-handout.md',
        'design/3-2-interactive-page.md',
    ]
    assert expected_media['3-2-parameter-range-flow.svg']['formula_mode'] == 'svg-mathtext'
    assert expected_media['3-2-parameter-range-flow.svg']['page_formula_sources'] == [
        'design/3-2-handout.md',
        'design/3-2-interactive-page.md',
    ]


def test_validate_formula_media_contract_accepts_3_2_formula_svg_assets():
    lesson_dir = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '3-2'
    )
    multimedia_path = lesson_dir / 'design' / '3-2-multimedia.md'

    issues = review_lesson_content.validate_formula_media_contract(
        review_lesson_content.extract_expected_code_media(multimedia_path),
        lesson_dir,
    )

    assert issues == []


def test_build_primary_sources_includes_interactive_page_for_theory_lesson():
    sources = review_lesson_content.build_primary_sources('2-1', '理论')

    assert [str(path.relative_to(Path(__file__).resolve().parents[1])) for path in sources] == [
        'authoring/lessons/2-1/design/2-1-handout.md',
        'authoring/lessons/2-1/design/2-1-interactive-page.md',
    ]


def test_build_source_manifest_records_interactive_page_source_for_theory_lesson():
    primary_sources = review_lesson_content.build_primary_sources('2-1', '理论')

    source_manifest = review_lesson_content.build_source_manifest('2-1', '理论', primary_sources, [])

    assert source_manifest['interactive_page_source'] == 'course-content/authoring/lessons/2-1/design/2-1-interactive-page.md'
    assert source_manifest['interactive_contract_source'] == 'course-content/authoring/lessons/2-1/design/2-1-interactive-contract.yaml'


def test_build_review_report_adds_interactive_page_section():
    primary_sources = review_lesson_content.build_primary_sources('2-1', '理论')

    report = review_lesson_content.build_review_report(
        '2-1',
        '理论',
        primary_sources,
        {
            'lesson_id': '2-1',
            'files': [{'path': 'course-content/authoring/lessons/2-1/design/2-1-handout.md', 'issues': []}],
        },
        {
            'lesson_id': '2-1',
            'sequence_path': 'course-content/authoring/knowledge/cards/lessons/2-1/sequence.json',
            'card_order': [],
            'missing_cards': [],
            'missing_frontmatter_keys': {},
            'missing_sections': {},
        },
        {
            'lesson_id': '2-1',
            'expected_assets': [],
            'generated_assets': [],
            'missing_assets': [],
            'executed_scripts': [],
            'processed_dir': 'course-content/authoring/lessons/2-1/media/processed',
            'formula_contract_issues': [],
            'formula_media': [],
        },
        {
            'lesson_id': '2-1',
            'source_path': 'course-content/authoring/lessons/2-1/design/2-1-interactive-page.md',
            'step_count': 16,
            'teacher_block_count': 16,
            'student_block_count': 16,
            'mapping_section_present': False,
            'issues': [],
            'warnings': ['未找到“讲义核心内容映射”章节'],
            'summary': [],
            'missing': ['未找到“讲义核心内容映射”章节'],
        },
    )

    assert '## 互动页覆盖审查' in report
    assert '未找到“讲义核心内容映射”章节' in report


def test_build_primary_sources_includes_interactive_page_for_theory_lessons():
    sources = review_lesson_content.build_primary_sources('2-1', '理论')

    assert [
        str(path.relative_to(review_lesson_content.REPO_ROOT)).replace('\\', '/')
        for path in sources
    ] == [
        'course-content/authoring/lessons/2-1/design/2-1-handout.md',
        'course-content/authoring/lessons/2-1/design/2-1-interactive-page.md',
    ]


def test_build_review_report_includes_interactive_page_coverage_section(tmp_path):
    handout_path = tmp_path / 'handout.md'
    interactive_page_path = tmp_path / 'interactive-page.md'
    handout_path.write_text('$$G(s)$$', encoding='utf-8')
    interactive_page_path.write_text('$$G(s)$$', encoding='utf-8')

    report = review_lesson_content.build_review_report(
        '2-1',
        '理论',
        [handout_path, interactive_page_path],
        {
            'files': [
                {'path': 'handout.md', 'issues': []},
                {'path': 'interactive-page.md', 'issues': []},
            ]
        },
        {
            'missing_cards': [],
            'missing_frontmatter_keys': {},
            'missing_sections': {},
        },
        {
            'generated_assets': ['2-1-cover-comic.png'],
            'missing_assets': [],
            'formula_contract_issues': [],
        },
        {
            'status': 'pass',
            'summary': ['已覆盖讲义中的核心公式与静态承载内容。'],
            'missing': [],
            'warnings': [],
            'issues': [],
        },
    )

    assert '## 互动页覆盖审查' in report
    assert '已覆盖讲义中的核心公式与静态承载内容。' in report


def test_build_review_report_does_not_claim_missing_design_sources_passed(tmp_path):
    handout_path = tmp_path / 'handout.md'
    handout_path.write_text('$$G(s)$$', encoding='utf-8')

    report = review_lesson_content.build_review_report(
        '1-4',
        '理论',
        [handout_path],
        {'files': [{'path': 'handout.md', 'issues': []}]},
        {
            'missing_cards': [],
            'missing_frontmatter_keys': {},
            'missing_sections': {},
        },
        {
            'accepted_infographs': [],
            'missing_infographs': [],
            'pending_review': [],
            'broken_review_files': {},
        },
        {
            'generated_assets': [],
            'missing_assets': [],
            'formula_contract_issues': [],
        },
        {
            'summary': [],
            'warnings': [],
            'blocking_issues': ['缺少 design/1-4-interactive-page.md'],
        },
    )

    assert '未提供 `design/1-4-boppps.md`' in report
    assert '缺少 design/1-4-interactive-page.md' in report
    assert '已纳入审查，并满足' not in report


def test_2_2_interactive_page_contract_passes_review():
    primary_sources = review_lesson_content.build_primary_sources('2-2', '理论')

    check = review_lesson_content.build_interactive_page_check('2-2', primary_sources)

    assert check['source_path'] == 'course-content/authoring/lessons/2-2/design/2-2-interactive-page.md'
    assert check['contract_path'] == 'course-content/authoring/lessons/2-2/design/2-2-interactive-contract.yaml'
    assert check['contract_required_fields'] == [
        'layout',
        'modules',
        'content_blocks',
        'interaction_spec',
        'teacher_controls',
        'telemetry_spec',
        'teacher_insight_spec',
        'ai_context_spec',
        'preview_contract',
        'acceptance_checks',
    ]
    assert check['issues'] == []
    assert check['summary'] == [
        '已覆盖讲义中的核心公式与静态承载内容。',
        '已检测到 `2-2` 的 V2 互动契约，步骤字段完整。',
        '已检测到 `2-2` 的本地实现契约与作者态互动契约一致。',
    ]

def test_theory_review_contract_includes_interactive_page_source_and_section():
    primary_sources = review_lesson_content.build_primary_sources('2-1', '理论')
    manifest = review_lesson_content.build_source_manifest('2-1', '理论', primary_sources, [])
    report = review_lesson_content.build_review_report(
        '2-1',
        '理论',
        primary_sources,
        {
            'lesson_id': '2-1',
            'files': [{'path': path.as_posix(), 'issues': []} for path in primary_sources],
        },
        {
            'lesson_id': '2-1',
            'sequence_path': 'course-content/authoring/knowledge/cards/lessons/2-1/sequence.json',
            'card_order': [],
            'missing_cards': [],
            'missing_frontmatter_keys': {},
            'missing_sections': {},
        },
        {
            'lesson_id': '2-1',
            'expected_assets': [],
            'generated_assets': [],
            'missing_assets': [],
            'executed_scripts': [],
            'processed_dir': 'course-content/authoring/lessons/2-1/media/processed',
            'formula_contract_issues': [],
        },
        {
            'lesson_id': '2-1',
            'source_path': 'course-content/authoring/lessons/2-1/design/2-1-interactive-page.md',
            'summary': ['已覆盖讲义中的核心公式与静态承载内容。'],
            'warnings': [],
            'missing': [],
            'issues': [],
        },
    )

    assert manifest['interactive_page_source'] == 'course-content/authoring/lessons/2-1/design/2-1-interactive-page.md'
    assert manifest['interactive_contract_source'] == 'course-content/authoring/lessons/2-1/design/2-1-interactive-contract.yaml'
    assert '## 互动页覆盖审查' in report


def test_build_interactive_page_check_flags_unknown_handout_anchor(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-1'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'
    handout_path.write_text(
        '\n'.join(
            [
                '# demo',
                '',
                '## 真实标题',
                '',
                '这里是讲义正文。',
            ]
        ),
        encoding='utf-8',
    )
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义核心内容映射',
                '| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|',
                '| `## 不存在的标题` | `concept` | 关键内容 | `step-01` | `static` | 无，保持静态展示 | 无 | 页面应出现关键内容 |',
                '',
                '## 步骤 01｜示例',
                '### 静态承载内容',
                '这里有关键内容。',
                '### 互动升级点',
                '无，保持静态展示。',
            ]
        ),
        encoding='utf-8',
    )

    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    try:
        review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
        check = review_lesson_content.build_interactive_page_check(
            'demo-1',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert '以下 handout_anchor 未在讲义标题中命中：## 不存在的标题' in check['issues']


def test_build_interactive_page_check_flags_formula_mapping_without_static_formula(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-2'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'
    handout_path.write_text(
        '\n'.join(
            [
                '# demo',
                '',
                '## 真实标题',
                '',
                '$$G(s)=\\frac{1}{Ts+1}$$',
            ]
        ),
        encoding='utf-8',
    )
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义核心内容映射',
                '| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|',
                '| `## 真实标题` | `formula/conclusion` | $G(s)=\\frac{1}{Ts+1}$ | `step-01` | `static+interactive` | 用判断题核对对象含义 | 无 | 页面显式出现公式 |',
                '',
                '## 步骤 01｜示例',
                '### 静态承载内容',
                '这里只写概念解释，没有公式本体。',
                '### 互动升级点',
                '用判断题核对对象含义。',
            ]
        ),
        encoding='utf-8',
    )

    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    try:
        review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
        check = review_lesson_content.build_interactive_page_check(
            'demo-2',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert (
        '步骤 `step-01` 的“静态承载内容”未显式覆盖公式型映射：G(s)=\\frac{1}{Ts+1}'
        in check['issues']
    )


def test_build_interactive_page_check_flags_missing_v2_contract_fields(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-3'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'
    interactive_contract_path = design_dir / 'interactive-contract.yaml'

    handout_path.write_text(
        '\n'.join(
            [
                '# demo',
                '',
                '## 示例标题',
                '',
                '$$G(s)=K$$',
            ]
        ),
        encoding='utf-8',
    )
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义核心内容映射',
                '| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|',
                '| `## 示例标题` | `formula/conclusion` | $G(s)=K$ | `step-01` | `static+interactive` | 用拖拽配对 | 无 | 页面显式出现公式 |',
                '',
                '## 步骤 01｜示例',
                '### 静态承载内容',
                '$$G(s)=K$$',
                '### 互动升级点',
                '用拖拽配对。',
            ]
        ),
        encoding='utf-8',
    )
    interactive_contract_path.write_text(
        '{\n'
        '  "lesson_id": "demo-3",\n'
        '  "steps": {\n'
        '    "step-01": {\n'
        '      "layout": {"template": "concept-slide"}\n'
        '    }\n'
        '  }\n'
        '}\n',
        encoding='utf-8',
    )

    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    try:
        review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
        check = review_lesson_content.build_interactive_page_check(
            'demo-3',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert check['contract_path'].endswith('interactive-contract.yaml')
    assert '步骤 `step-01` 的互动契约缺少字段：modules, content_blocks, interaction_spec, teacher_controls, telemetry_spec, teacher_insight_spec, ai_context_spec, preview_contract, acceptance_checks' in check['issues']


def test_build_interactive_page_check_supports_step_prefix_and_fixed_content_sections(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-5'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'

    handout_path.write_text(
        '\n'.join(
            [
                '# demo',
                '',
                '## 示例标题',
                '',
                '$$G(s)=K$$',
            ]
        ),
        encoding='utf-8',
    )
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义核心内容映射',
                '| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|',
                '| `## 示例标题` | `formula/conclusion` | $G(s)=K$ | `step-01` | `static+interactive` | 用判断题核对对象含义 | 无 | 页面显式出现公式 |',
                '',
                '## step-01｜示例',
                '### 固定内容',
                '$$G(s)=K$$',
                '### 互动与反馈',
                '用判断题核对对象含义。',
            ]
        ),
        encoding='utf-8',
    )

    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    try:
        review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
        check = review_lesson_content.build_interactive_page_check(
            'demo-5',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert check['missing_target_steps'] == []
    assert check['step_static_blocks_missing'] == []
    assert check['step_upgrade_blocks_missing'] == []
    assert check['formula_mapping_issues'] == []


def test_build_interactive_page_check_reports_clean_implementation_contract_for_2_1():
    primary_sources = review_lesson_content.build_primary_sources('2-1', '理论')

    check = review_lesson_content.build_interactive_page_check('2-1', primary_sources)

    assert check['implementation_contract_source'] == 'src/lib/unit-2-1-course.ts'
    assert check['implementation_contract_issues'] == []


def test_build_interactive_page_check_flags_implementation_contract_drift(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-4'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'
    interactive_contract_path = design_dir / 'interactive-contract.yaml'
    impl_path = tmp_path / 'src' / 'lib' / 'demo-course.ts'
    impl_path.parent.mkdir(parents=True)

    handout_path.write_text('# demo\n\n## 示例标题\n\n$$G(s)=K$$\n', encoding='utf-8')
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义核心内容映射',
                '| handout_anchor | core_item_type | must_appear_content | target_step | page_mode | interaction_upgrade | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|',
                '| `## 示例标题` | `formula/conclusion` | $G(s)=K$ | `step-01` | `static` | 无 | 无 | 页面显式出现公式 |',
                '',
                '## 步骤 01｜示例',
                '### 静态承载内容',
                '$$G(s)=K$$',
                '### 互动升级点',
                '无。',
            ]
        ),
        encoding='utf-8',
    )
    interactive_contract_path.write_text(
        '{\n'
        '  "lesson_id": "demo-4",\n'
        '  "steps": {\n'
        '    "step-01": {\n'
        '      "title": "示例",\n'
        '      "layout": {"template": "concept-slide", "regions": [{"id": "header", "width": "full", "order": 1}]},\n'
        '      "modules": [],\n'
        '      "content_blocks": [],\n'
        '      "interaction_spec": {"interaction_kind": "none"},\n'
        '      "teacher_controls": [],\n'
        '      "telemetry_spec": {"summary_fields": ["viewed"], "misconception_tags": ["contract-tag"]},\n'
        '      "teacher_insight_spec": {"widgets": ["view_count"]},\n'
        '      "ai_context_spec": {},\n'
        '      "preview_contract": {"route_kind": "student_demo", "demo_path": "/demo?step=step-01"},\n'
        '      "acceptance_checks": []\n'
        '    }\n'
        '  }\n'
        '}\n',
        encoding='utf-8',
    )
    impl_path.write_text(
        '\n'.join(
            [
                "export const DEMO_PAGE_CONTRACTS = {",
                "  'step-01': {",
                "    layout: { template: 'other-template', regions: [{ id: 'lead', width: 'full', order: 1 }] },",
                "    interactionKind: 'none',",
                "    teacherInsightWidgets: ['other_widget'],",
                "    telemetrySummaryFields: ['other_field'],",
                "    misconceptionTags: ['other_tag'],",
                "    previewDemoPath: '/other?step=step-01',",
                '  },',
                '};',
                '',
                'export const DEMO_LESSON_STEPS = [',
                "  { id: 'step-01', title: '示例', pageType: 'display' },",
                '];',
            ]
        ),
        encoding='utf-8',
    )

    original_registry = getattr(review_lesson_content, 'IMPLEMENTATION_CONTRACT_REGISTRY', {}).copy()
    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
    review_lesson_content.IMPLEMENTATION_CONTRACT_REGISTRY = {
        'demo-4': {
            'course_lib_path': impl_path,
            'page_contracts_const': 'DEMO_PAGE_CONTRACTS',
            'lesson_steps_const': 'DEMO_LESSON_STEPS',
            'source_path': 'src/lib/demo-course.ts',
        }
    }

    try:
        check = review_lesson_content.build_interactive_page_check(
            'demo-4',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.IMPLEMENTATION_CONTRACT_REGISTRY = original_registry
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert check['implementation_contract_source'] == 'src/lib/demo-course.ts'
    assert any('layout.template' in issue for issue in check['implementation_contract_issues'])


def test_build_interactive_page_check_flags_missing_evidence_review_fields_for_curve_figures(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-6'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'

    handout_path.write_text(
        '\n'.join(
            [
                '# demo',
                '',
                '## 示例标题',
                '',
                '![示例图](../media/processed/demo-6-quad.png)',
            ]
        ),
        encoding='utf-8',
    )
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义证据单元映射',
                '| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|---|',
                '| `## 示例标题` | `eu-01` | `curve_figure` | 基线图组与关键曲线 | `step-01` | `static+interactive` | `parametric_sim` | `demo-6-quad.png` | 默认状态复现基线图组 |',
                '',
                '## step-01｜示例',
                '### 页面骨架',
                '- 模板：`curve_board`',
                '### 固定内容',
                '- 保留基线图组。',
                '### 互动与反馈',
                '- 主类型：`parametric_sim`',
            ]
        ),
        encoding='utf-8',
    )

    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    try:
        review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
        check = review_lesson_content.build_interactive_page_check(
            'demo-6',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert check['mapping_contract_mode'] == 'evidence_units'
    assert '## step-01｜示例' in check['step_reading_order_missing']
    assert 'step-01' in check['curve_figure_steps_missing_mirror']


def test_build_interactive_page_check_flags_component_level_implementation_drift_for_new_fields(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-7'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'
    interactive_contract_path = design_dir / 'interactive-contract.yaml'
    impl_path = tmp_path / 'src' / 'lib' / 'demo-course-7.ts'
    impl_path.parent.mkdir(parents=True)

    handout_path.write_text('# demo\n\n## 示例标题\n\n![图](../media/processed/demo-7-quad.png)\n', encoding='utf-8')
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义证据单元映射',
                '| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|---|',
                '| `## 示例标题` | `eu-01` | `curve_figure` | 基线图组与关键曲线 | `step-01` | `static+interactive` | `parametric_sim` | `demo-7-quad.png` | 默认状态复现基线图组 |',
                '',
                '## step-01｜示例',
                '### 页面骨架',
                '- 模板：`curve_board`',
                '- 主阅读顺序：',
                '  - `对象/背景`',
                '  - `图像与曲线`',
                '### 固定内容',
                '- 保留基线图组。',
                '### 互动与反馈',
                '- 主类型：`parametric_sim`',
                '### 曲线互动镜像说明',
                '- 对应静态图：`demo-7-quad.png`',
                '- 基线状态：`K=1`',
                '- 图组排布：`2x2`',
                '- 控件策略：`单滑块`',
                '- 折叠策略：`图下折叠控件栏`',
            ]
        ),
        encoding='utf-8',
    )
    interactive_contract_path.write_text(
        '{\n'
        '  "lesson_id": "demo-7",\n'
        '  "steps": {\n'
        '    "step-01": {\n'
        '      "title": "示例",\n'
        '      "layout": {\n'
        '        "template": "curve_board",\n'
        '        "regions": [{"id": "figure", "width": "full", "order": 1}],\n'
        '        "reading_order": ["对象/背景", "图像与曲线"]\n'
        '      },\n'
        '      "modules": [],\n'
        '      "evidence_units": [{"id": "eu-01", "kind": "curve_figure"}],\n'
        '      "content_blocks": [],\n'
        '      "interaction_spec": {"interaction_kind": "parameter_slider", "interaction_archetype": "parametric_sim"},\n'
        '      "teacher_controls": [],\n'
        '      "telemetry_spec": {"summary_fields": ["viewed"], "misconception_tags": []},\n'
        '      "teacher_insight_spec": {"widgets": ["view_count"]},\n'
        '      "ai_context_spec": {"delivery_mode": "hidden_page_context"},\n'
        '      "interactive_figure_spec": {\n'
        '        "layout_mirror": "2x2",\n'
        '        "controls": {"placement": "below_figure", "collapsed_by_default": true}\n'
        '      },\n'
        '      "preview_contract": {"route_kind": "student_demo", "demo_path": "/demo?step=step-01"},\n'
        '      "acceptance_checks": []\n'
        '    }\n'
        '  }\n'
        '}\n',
        encoding='utf-8',
    )
    impl_path.write_text(
        '\n'.join(
            [
                "export const DEMO_7_PAGE_CONTRACTS = {",
                "  'step-01': {",
                "    layout: { template: 'curve_board', regions: [{ id: 'figure', width: 'full', order: 1 }], readingOrder: ['图像与曲线', '对象/背景'] },",
                "    interactionKind: 'parameter_slider',",
                "    interactionArchetype: 'evidence_board',",
                "    teacherInsightWidgets: ['view_count'],",
                "    telemetrySummaryFields: ['viewed'],",
                "    previewDemoPath: '/demo?step=step-01',",
                "    figureLayoutMirror: 'single',",
                "    controlsPlacement: 'side_panel',",
                "    controlsCollapsedByDefault: false,",
                '  },',
                '};',
                '',
                'export const DEMO_7_LESSON_STEPS = [',
                "  { id: 'step-01', title: '示例', pageType: 'parameter_slider', aiContext: { deliveryMode: 'visible_panel' } },",
                '];',
            ]
        ),
        encoding='utf-8',
    )

    original_registry = getattr(review_lesson_content, 'IMPLEMENTATION_CONTRACT_REGISTRY', {}).copy()
    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
    review_lesson_content.IMPLEMENTATION_CONTRACT_REGISTRY = {
        'demo-7': {
            'course_lib_path': impl_path,
            'page_contracts_const': 'DEMO_7_PAGE_CONTRACTS',
            'lesson_steps_const': 'DEMO_7_LESSON_STEPS',
            'source_path': 'src/lib/demo-course-7.ts',
        }
    }

    try:
        check = review_lesson_content.build_interactive_page_check(
            'demo-7',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.IMPLEMENTATION_CONTRACT_REGISTRY = original_registry
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert check['implementation_contract_source'] == 'src/lib/demo-course-7.ts'
    assert any('layout.reading_order' in issue for issue in check['implementation_contract_issues'])
    assert any('interaction_archetype' in issue for issue in check['implementation_contract_issues'])
    assert any('ai_context_spec.delivery_mode' in issue for issue in check['implementation_contract_issues'])
    assert any('interactive_figure_spec.layout_mirror' in issue for issue in check['implementation_contract_issues'])
    assert any('interactive_figure_spec.controls.placement' in issue for issue in check['implementation_contract_issues'])


def test_build_implementation_contract_check_registers_unit_4_1():
    contract_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '4-1'
        / 'design'
        / 'interactive-contract.yaml'
    )

    source_path, issues, summary = review_lesson_content.build_implementation_contract_check('4-1', contract_path)

    assert source_path == 'src/lib/unit-4-1-course.ts'
    assert issues == []
    assert summary == ['已检测到 `4-1` 的本地实现契约与作者态互动契约一致。']


def test_validate_implementation_acceptance_allows_missing_content_source_completeness_for_legacy_payload(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-impl-1'
    notes_dir = lesson_dir / 'notes'
    notes_dir.mkdir(parents=True)

    acceptance_path = notes_dir / 'interactive-implementation-acceptance.json'
    acceptance_path.write_text(
        json.dumps(
            {
                'acceptance_version': 1,
                'lesson_id': 'demo-impl-1',
                'status': 'accepted',
                'accepted_at': '2026-04-20T00:00:00+08:00',
                'review_mode': 'subagent',
                'reviewed_runtime_artifacts': [
                    'course-content/runtime/lessons/4-1/review/review-report.md',
                    'course-content/runtime/lessons/4-1/review/interactive-page-check.json',
                ],
                'checks': {
                    'inline_ai_visibility': {'status': 'pass', 'step_ids': [], 'evidence': []},
                    'static_media_downgrade': {'status': 'pass', 'step_ids': [], 'evidence': []},
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )

    path, _payload, issues, _summary, _artifacts, findings = review_lesson_content.validate_implementation_acceptance(
        'demo-impl-1',
        lesson_dir,
        required=True,
    )

    assert path == acceptance_path
    assert '互动实现接受文件缺少 `checks.content_source_completeness`' not in issues
    assert 'content_source_completeness' not in findings


def test_build_acceptance_hard_gate_issues_includes_content_source_insufficient():
    contract_steps = {
        'step-01': {
            'interaction_spec': {'interaction_kind': 'none'},
            'content_blocks': [{'id': 'body', 'type': 'plain_text', 'body': '示例正文'}],
        }
    }

    hard_gate_issues = review_lesson_content.build_acceptance_hard_gate_issues(
        contract_steps,
        {
            'content_source_completeness': {
                'status': 'fail',
                'step_ids': ['step-01'],
                'evidence': ['实现稿新增大段设计稿未给出的正文。'],
            }
        },
    )

    assert any(issue['code'] == 'content_source_insufficient' for issue in hard_gate_issues)
    assert any('内容真源不足' in issue['message'] for issue in hard_gate_issues)
    assert any(issue['step_ids'] == ['step-01'] for issue in hard_gate_issues)


def test_build_interactive_page_check_reads_unit_4_1_evidence_contract():
    primary_sources = review_lesson_content.build_primary_sources('4-1', '理论')

    check = review_lesson_content.build_interactive_page_check('4-1', primary_sources)

    assert check['mapping_contract_mode'] == 'evidence_units'
    assert check['missing_mapping_columns'] == []
    assert check['step_reading_order_missing'] == []
    assert check['curve_figure_steps_missing_mirror'] == []
    assert check['curve_figure_steps_missing_contract'] == []
    assert check['implementation_contract_source'] == 'src/lib/unit-4-1-course.ts'
    assert check['implementation_contract_issues'] == []
    assert check['implementation_contract_summary'] == ['已检测到 `4-1` 的本地实现契约与作者态互动契约一致。']


def test_build_interactive_page_check_validates_optional_nested_render_contracts(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-8'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)

    handout_path = design_dir / 'handout.md'
    interactive_page_path = design_dir / 'interactive-page.md'
    interactive_contract_path = design_dir / 'interactive-contract.yaml'

    handout_path.write_text(
        '\n'.join(
            [
                '# demo',
                '',
                '## 曲线图',
                '',
                '## 示意图',
                '',
                '## 表格',
            ]
        ),
        encoding='utf-8',
    )
    interactive_page_path.write_text(
        '\n'.join(
            [
                '## 讲义证据单元映射',
                '| handout_anchor | evidence_unit_id | evidence_kind | must_appear_content | target_step | page_mode | interaction_archetype | media_or_table_ref | acceptance_note |',
                '|---|---|---|---|---|---|---|---|---|',
                '| `## 曲线图` | `eu-01` | `curve_figure` | 曲线图基线 | `step-01` | `static+interactive` | `parametric_sim` | `demo-8-curve.png` | 曲线镜像 |',
                '| `## 示意图` | `eu-02` | `structure_figure` | 示意图逐步呈现 | `step-02` | `static+interactive` | `evidence_board` | `demo-8-figure.png` | 原生示意图 |',
                '| `## 表格` | `eu-03` | `table` | 表格公式保留 | `step-03` | `static+interactive` | `evidence_board` | `表 1` | 原生表格 |',
                '',
                '## step-01｜曲线图',
                '### 页面骨架',
                '- 模板：`curve_board`',
                '### 主阅读顺序',
                '- `对象` -> `图像与曲线`',
                '### 固定内容',
                '- 保留曲线图基线。',
                '### 互动升级点',
                '- 主类型：`parametric_sim`',
                '### 曲线互动镜像说明',
                '- 基线参数：`K=2.00`',
                '',
                '## step-02｜示意图',
                '### 页面骨架',
                '- 模板：`figure_board`',
                '### 主阅读顺序',
                '- `对象` -> `示意图`',
                '### 固定内容',
                '- 保留示意图。',
                '### 互动升级点',
                '- 主类型：`evidence_board`',
                '',
                '## step-03｜表格',
                '### 页面骨架',
                '- 模板：`table_board`',
                '### 主阅读顺序',
                '- `对象` -> `表格`',
                '### 固定内容',
                '- 保留表格。',
                '### 互动升级点',
                '- 主类型：`evidence_board`',
            ]
        ),
        encoding='utf-8',
    )
    interactive_contract_path.write_text(
        json.dumps(
            {
                'lesson_id': 'demo-8',
                'required_curve_figure_fields': [
                    'engine_family',
                    'request_contract',
                    'subplot_mapping',
                    'axis_policy',
                    'panel_overlay',
                    'reference_signal',
                    'sampling_policy',
                    'precision_policy',
                ],
                'required_native_figure_fields': [
                    'render_mode',
                    'progressive_reveal',
                    'interaction_carrier',
                ],
                'required_native_table_fields': [
                    'render_mode',
                    'formula_rendering',
                ],
                'steps': {
                    'step-01': {
                        'title': '曲线图',
                        'layout': {'template': 'curve_board', 'regions': []},
                        'modules': [],
                        'content_blocks': [],
                        'interaction_spec': {'interaction_kind': 'parameter_slider', 'interaction_archetype': 'parametric_sim'},
                        'teacher_controls': [],
                        'telemetry_spec': {'summary_fields': [], 'misconception_tags': []},
                        'teacher_insight_spec': {'widgets': []},
                        'ai_context_spec': {'delivery_mode': 'hidden_page_context'},
                        'preview_contract': {'route_kind': 'student_demo', 'demo_path': '/demo?step=step-01'},
                        'acceptance_checks': [],
                        'interactive_figure_spec': {
                            'layout_mirror': '2x2',
                            'controls': {'placement': 'below_figure', 'collapsed_by_default': True},
                        },
                    },
                    'step-02': {
                        'title': '示意图',
                        'layout': {'template': 'figure_board', 'regions': []},
                        'modules': [],
                        'content_blocks': [],
                        'interaction_spec': {'interaction_kind': 'none'},
                        'teacher_controls': [],
                        'telemetry_spec': {'summary_fields': [], 'misconception_tags': []},
                        'teacher_insight_spec': {'widgets': []},
                        'ai_context_spec': {'delivery_mode': 'hidden_page_context'},
                        'preview_contract': {'route_kind': 'student_demo', 'demo_path': '/demo?step=step-02'},
                        'acceptance_checks': [],
                        'native_figure_spec': {
                            'render_mode': 'native_svg',
                        },
                    },
                    'step-03': {
                        'title': '表格',
                        'layout': {'template': 'table_board', 'regions': []},
                        'modules': [],
                        'content_blocks': [],
                        'interaction_spec': {'interaction_kind': 'none'},
                        'teacher_controls': [],
                        'telemetry_spec': {'summary_fields': [], 'misconception_tags': []},
                        'teacher_insight_spec': {'widgets': []},
                        'ai_context_spec': {'delivery_mode': 'hidden_page_context'},
                        'preview_contract': {'route_kind': 'student_demo', 'demo_path': '/demo?step=step-03'},
                        'acceptance_checks': [],
                        'native_table_spec': {
                            'render_mode': 'native_table',
                        },
                    },
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )

    original_get_lesson_dir = review_lesson_content.get_authoring_lesson_dir
    try:
        review_lesson_content.get_authoring_lesson_dir = lambda _: lesson_dir
        check = review_lesson_content.build_interactive_page_check(
            'demo-8',
            [handout_path, interactive_page_path],
        )
    finally:
        review_lesson_content.get_authoring_lesson_dir = original_get_lesson_dir

    assert any('interactive_figure_spec.engine_family' in issue for issue in check['issues'])
    assert any('native_figure_spec.progressive_reveal' in issue for issue in check['issues'])
    assert any('native_table_spec.formula_rendering' in issue for issue in check['issues'])


def test_ensure_runtime_media_index_creates_standard_sections(tmp_path):
    media_index_path = tmp_path / 'runtime' / 'lessons' / '2-1' / 'media' / '2-1-media.md'

    review_lesson_content.ensure_runtime_media_index(media_index_path, '2-1')

    assert media_index_path.read_text(encoding='utf-8') == '\n'.join(
        [
            '# 2-1-intro-video.mp4',
            '',
            '# 2-1-slides.pdf',
            '',
            '# 2-1-course.mp4',
            '',
            '# 2-1-audio.m4a',
            '',
            '# 2-1-handout.md',
            '',
        ]
    )
    assert (
        tmp_path
        / 'authoring'
        / 'lessons'
        / '2-1'
        / 'media'
        / 'processed'
        / '2-1-media.md'
    ).read_text(encoding='utf-8') == media_index_path.read_text(encoding='utf-8')


def test_ensure_runtime_media_index_preserves_existing_links_and_order(tmp_path):
    media_index_path = tmp_path / 'runtime' / 'lessons' / '2-1' / 'media' / '2-1-media.md'
    media_index_path.parent.mkdir(parents=True, exist_ok=True)
    existing_content = '\n'.join(
        [
            '# 2-1-course.mp4',
            '',
            '- 旧课程视频标题',
            '',
            'https://example.com/course',
            '',
            '# 2-1-intro-video.mp4',
            '',
            '- 旧导入视频标题',
            '',
            'https://example.com/intro',
            '',
            '# handout.md',
            '',
            '旧讲义摘要，应当保留。',
            '',
        ]
    )
    media_index_path.write_text(existing_content, encoding='utf-8')

    review_lesson_content.ensure_runtime_media_index(media_index_path, '2-1')

    assert media_index_path.read_text(encoding='utf-8') == existing_content


def test_ensure_runtime_media_index_does_not_merge_existing_authoring_into_runtime(tmp_path):
    lesson_id = 'demo-4'
    media_index_path = tmp_path / 'runtime' / 'lessons' / lesson_id / 'media' / f'{lesson_id}-media.md'
    processed_media_index_path = (
        tmp_path
        / 'authoring'
        / 'lessons'
        / lesson_id
        / 'media'
        / 'processed'
        / f'{lesson_id}-media.md'
    )
    media_index_path.parent.mkdir(parents=True)
    processed_media_index_path.parent.mkdir(parents=True)
    runtime_content = '\n'.join(
        [
            '# demo-4-intro-video.mp4',
            '',
            '# demo-4-slides.pdf',
            '',
            '# demo-4-course.mp4',
            '',
            '# demo-4-audio.m4a',
            '',
            '# handout.md',
            '',
        ]
    )
    authoring_content = '\n'.join(
        [
            '# demo-4-intro-video.mp4',
            '',
            '- 已写好的导入视频标题',
            '',
            '# demo-4-slides.pdf',
            '',
            '# demo-4-course.mp4',
            '',
            '# demo-4-audio.m4a',
            '',
            '# handout.md',
            '',
            '已写好的讲义摘要，不能被运行态空骨架覆盖。',
            '',
        ]
    )
    media_index_path.write_text(runtime_content, encoding='utf-8')
    processed_media_index_path.write_text(authoring_content, encoding='utf-8')

    review_lesson_content.ensure_runtime_media_index(media_index_path, lesson_id)

    assert media_index_path.read_text(encoding='utf-8') == runtime_content
    assert processed_media_index_path.read_text(encoding='utf-8') == authoring_content


def test_ensure_runtime_media_index_does_not_complete_existing_authoring_index(tmp_path):
    lesson_id = 'demo-5'
    media_index_path = tmp_path / 'runtime' / 'lessons' / lesson_id / 'media' / f'{lesson_id}-media.md'
    processed_media_index_path = (
        tmp_path
        / 'authoring'
        / 'lessons'
        / lesson_id
        / 'media'
        / 'processed'
        / f'{lesson_id}-media.md'
    )
    processed_media_index_path.parent.mkdir(parents=True)
    authoring_content = '\n'.join(
        [
            '# demo-5-intro-video.mp4',
            '',
            '- 保留已有导入标题',
            '',
            'https://example.com/intro',
            '',
        ]
    )
    processed_media_index_path.write_text(authoring_content, encoding='utf-8')

    review_lesson_content.ensure_runtime_media_index(media_index_path, lesson_id)

    expected_runtime_content = '\n'.join(
        [
            '# demo-5-intro-video.mp4',
            '',
            '# demo-5-slides.pdf',
            '',
            '# demo-5-course.mp4',
            '',
            '# demo-5-audio.m4a',
            '',
            '# demo-5-handout.md',
            '',
        ]
    )
    assert media_index_path.read_text(encoding='utf-8') == expected_runtime_content
    assert processed_media_index_path.read_text(encoding='utf-8') == authoring_content


def test_ensure_runtime_media_index_restores_runtime_without_rewriting_authoring(tmp_path):
    lesson_id = 'demo-6'
    media_index_path = tmp_path / 'runtime' / 'lessons' / lesson_id / 'media' / f'{lesson_id}-media.md'
    processed_media_index_path = (
        tmp_path
        / 'authoring'
        / 'lessons'
        / lesson_id
        / 'media'
        / 'processed'
        / f'{lesson_id}-media.md'
    )
    processed_media_index_path.parent.mkdir(parents=True)
    runtime_content = '\n'.join(
        [
            '# demo-6-course.mp4',
            '',
            '- runtime 中已有的课程视频标题',
            '',
            'https://example.com/runtime-course',
            '',
        ]
    )
    authoring_content = '\n'.join(
        [
            '# demo-6-intro-video.mp4',
            '',
            '- 作者态已有导入标题',
            '',
            '# demo-6-handout.md',
            '',
            '作者态已有讲义摘要。',
            '',
        ]
    )
    processed_media_index_path.write_text(authoring_content, encoding='utf-8')

    review_lesson_content.ensure_runtime_media_index(media_index_path, lesson_id, runtime_content)

    assert media_index_path.read_text(encoding='utf-8') == runtime_content
    assert processed_media_index_path.read_text(encoding='utf-8') == authoring_content
