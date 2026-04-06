from __future__ import annotations

import importlib.util
from pathlib import Path


def load_review_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'review_lesson_content.py'
    spec = importlib.util.spec_from_file_location('review_lesson_content', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


review_lesson_content = load_review_module()


def test_extract_expected_code_media_reads_storage_lines():
    multimedia_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '2-2'
        / 'design'
        / 'multimedia.md'
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
        / 'multimedia.md'
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
                '- **页面公式来源**：`design/handout.md`, `design/interactive-page.md`',
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
            'page_formula_sources': ['design/handout.md', 'design/interactive-page.md'],
        }
    ]


def test_validate_formula_media_contract_flags_non_svg_and_missing_formula_sources(tmp_path):
    lesson_dir = tmp_path / 'authoring' / 'lessons' / 'demo-1'
    design_dir = lesson_dir / 'design'
    design_dir.mkdir(parents=True)
    (design_dir / 'handout.md').write_text('这里只是普通文字，没有公式。', encoding='utf-8')

    issues = review_lesson_content.validate_formula_media_contract(
        [
            {
                'script': 'example.py',
                'output': 'example.png',
                'formula_mode': 'svg-mathtext',
                'page_formula_sources': ['design/handout.md', 'design/interactive-page.md'],
            }
        ],
        lesson_dir,
    )

    assert issues == [
        'example.png 声明为 svg-mathtext，但输出格式不是 SVG',
        'example.png 的页面公式来源 `design/handout.md` 未检测到 LaTeX 公式标记',
        'example.png 的页面公式来源 `design/interactive-page.md` 不存在',
    ]


def test_extract_expected_code_media_reads_3_2_svg_formula_assets():
    multimedia_path = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '3-2'
        / 'design'
        / 'multimedia.md'
    )

    expected_media = {
        item['output']: item
        for item in review_lesson_content.extract_expected_code_media(multimedia_path)
    }

    assert expected_media['3-2-special-cases-card.svg']['formula_mode'] == 'svg-mathtext'
    assert expected_media['3-2-special-cases-card.svg']['page_formula_sources'] == [
        'design/handout.md',
        'design/interactive-page.md',
    ]
    assert expected_media['3-2-parameter-range-flow.svg']['formula_mode'] == 'svg-mathtext'
    assert expected_media['3-2-parameter-range-flow.svg']['page_formula_sources'] == [
        'design/handout.md',
        'design/interactive-page.md',
    ]


def test_validate_formula_media_contract_accepts_3_2_formula_svg_assets():
    lesson_dir = (
        Path(__file__).resolve().parents[1]
        / 'authoring'
        / 'lessons'
        / '3-2'
    )
    multimedia_path = lesson_dir / 'design' / 'multimedia.md'

    issues = review_lesson_content.validate_formula_media_contract(
        review_lesson_content.extract_expected_code_media(multimedia_path),
        lesson_dir,
    )

    assert issues == []


def test_build_primary_sources_includes_interactive_page_for_theory_lesson():
    sources = review_lesson_content.build_primary_sources('2-1', '理论')

    assert [str(path.relative_to(Path(__file__).resolve().parents[1])) for path in sources] == [
        'authoring/lessons/2-1/design/handout.md',
        'authoring/lessons/2-1/design/interactive-page.md',
    ]


def test_build_source_manifest_records_interactive_page_source_for_theory_lesson():
    primary_sources = review_lesson_content.build_primary_sources('2-1', '理论')

    source_manifest = review_lesson_content.build_source_manifest('2-1', '理论', primary_sources, [])

    assert source_manifest['interactive_page_source'] == 'course-content/authoring/lessons/2-1/design/interactive-page.md'
    assert source_manifest['interactive_contract_source'] == 'course-content/authoring/lessons/2-1/design/interactive-contract.yaml'


def test_build_review_report_adds_interactive_page_section():
    primary_sources = review_lesson_content.build_primary_sources('2-1', '理论')

    report = review_lesson_content.build_review_report(
        '2-1',
        '理论',
        primary_sources,
        {
            'lesson_id': '2-1',
            'files': [{'path': 'course-content/authoring/lessons/2-1/design/handout.md', 'issues': []}],
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
            'source_path': 'course-content/authoring/lessons/2-1/design/interactive-page.md',
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
        'course-content/authoring/lessons/2-1/design/handout.md',
        'course-content/authoring/lessons/2-1/design/interactive-page.md',
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


def test_2_2_interactive_page_contract_passes_review():
    primary_sources = review_lesson_content.build_primary_sources('2-2', '理论')

    check = review_lesson_content.build_interactive_page_check('2-2', primary_sources)

    assert check['source_path'] == 'course-content/authoring/lessons/2-2/design/interactive-page.md'
    assert check['contract_path'] == 'course-content/authoring/lessons/2-2/design/interactive-contract.yaml'
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
            'source_path': 'course-content/authoring/lessons/2-1/design/interactive-page.md',
            'summary': ['已覆盖讲义中的核心公式与静态承载内容。'],
            'warnings': [],
            'missing': [],
            'issues': [],
        },
    )

    assert manifest['interactive_page_source'] == 'course-content/authoring/lessons/2-1/design/interactive-page.md'
    assert manifest['interactive_contract_source'] == 'course-content/authoring/lessons/2-1/design/interactive-contract.yaml'
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


def test_ensure_runtime_media_index_creates_standard_sections(tmp_path):
    media_index_path = tmp_path / 'runtime' / 'lessons' / '2-1' / 'media' / '2-1-media.md'

    review_lesson_content.ensure_runtime_media_index(media_index_path, '2-1')

    assert media_index_path.read_text(encoding='utf-8') == '\n'.join(
        [
            '# 2-1-intro-video.mp4',
            '',
            '',
            '# 2-1-audio.m4a',
            '',
            '',
            '# 2-1-slides.pdf',
            '',
            '',
            '# 2-1-course.mp4',
            '',
            '',
        ]
    )


def test_ensure_runtime_media_index_preserves_existing_links_and_order(tmp_path):
    media_index_path = tmp_path / 'runtime' / 'lessons' / '2-1' / 'media' / '2-1-media.md'
    media_index_path.parent.mkdir(parents=True, exist_ok=True)
    media_index_path.write_text(
        '\n'.join(
            [
                '# 2-1-course.mp4',
                '',
                'https://example.com/course',
                '',
                '# 2-1-intro-video.mp4',
                '',
                'https://example.com/intro',
                '',
            ]
        ),
        encoding='utf-8',
    )

    review_lesson_content.ensure_runtime_media_index(media_index_path, '2-1')

    assert media_index_path.read_text(encoding='utf-8') == '\n'.join(
        [
            '# 2-1-intro-video.mp4',
            '',
            'https://example.com/intro',
            '',
            '# 2-1-audio.m4a',
            '',
            '',
            '# 2-1-slides.pdf',
            '',
            '',
            '# 2-1-course.mp4',
            '',
            'https://example.com/course',
            '',
        ]
    )
