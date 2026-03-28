from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
QUESTION_ROOT = ROOT / 'course-content' / 'questions'
SOURCE_DOCX = QUESTION_ROOT / 'source' / '自动控制原理习题解析.docx'
SCRIPT = QUESTION_ROOT / 'scripts' / 'extract_docx_question_bank.py'


def test_extract_docx_generates_question_markdown_and_json(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '3',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    question_md = tmp_path / 'questions' / 'AC-Q-0001.md'
    question_json = tmp_path / 'questions' / 'AC-Q-0001.json'
    extraction_report = tmp_path / 'reports' / 'extraction-report.json'

    assert question_md.exists(), 'missing first extracted markdown'
    assert question_json.exists(), 'missing first extracted json'
    assert extraction_report.exists(), 'missing extraction report'

    markdown = question_md.read_text(encoding='utf-8')
    assert '## 题面' in markdown
    assert '## 答案解析' in markdown
    assert '## 行内得分点' in markdown
    assert '## 评分指南' in markdown

    payload = json.loads(question_json.read_text(encoding='utf-8'))
    assert payload['question_id'] == 'AC-Q-0001'
    assert payload['source_ref'].startswith('1-1')
    assert payload['chapter'] == 1
    assert isinstance(payload['stem_md'], str) and payload['stem_md']
    assert isinstance(payload['solution_md'], str) and payload['solution_md']
    assert isinstance(payload['inline_score_points'], list)
    assert isinstance(payload['rubric'], list)


def test_extract_docx_splits_malformed_question_headings(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '30',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    questions_dir = tmp_path / 'questions'
    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted(questions_dir.glob('AC-Q-*.json'))
    ]

    source_refs = {payload['source_ref'] for payload in payloads}
    assert '2-16不完整' in source_refs

    question_215 = next(payload for payload in payloads if payload['question_number'] == '2-15')
    assert '2-16不完整' not in question_215['solution_md']


def test_extract_docx_keeps_body_text_question_when_heading_is_missing(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '50',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    questions_dir = tmp_path / 'questions'
    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted(questions_dir.glob('AC-Q-*.json'))
    ]

    question_316 = next(payload for payload in payloads if payload['question_number'] == '3-16')
    assert question_316['source_ref'].startswith('3-16 已知单位反馈系统的开环传递函数')


def test_extract_docx_classifies_missing_figures_more_precisely(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '5',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted((tmp_path / 'questions').glob('AC-Q-*.json'))
    ]

    question_12 = next(payload for payload in payloads if payload['question_number'] == '1-2')
    assert question_12['figure_status'] == 'source_missing'
    assert question_12['figure_titles'] == ['图 1-2-1 仓库大门自动开闭控制系统方块图']
    assert question_12['figure_references'] == ['图1-22是仓库大门自动开闭控制系统原理图。试说明系统自动控制大门开闭的工作原理并画出系统方块图。']

    question_14 = next(payload for payload in payloads if payload['question_number'] == '1-4')
    assert question_14['figure_status'] == 'text_reference_only'
    assert question_14['figure_titles'] == []
    assert question_14['figure_references'] == [
        '图 1-24 为水温控制系统原理示意图。冷水在热交换器中由通入的蒸汽加热,从而得到一定温度的热水。冷水温度变化用流量计测量。试绘制系统方块图,并说明为了保持热水温度为期望值,系统是如何工作的?系统的被控对象和控制装置各是什么?'
    ]


def test_extract_docx_includes_images_embedded_in_tables(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '15',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    questions_dir = tmp_path / 'questions'
    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted(questions_dir.glob('AC-Q-*.json'))
    ]

    for question_number in ('2-2', '2-3', '2-4'):
        payload = next(item for item in payloads if item['question_number'] == question_number)
        assert payload['figure_assets'], f'{question_number} should export table-embedded images'
        assert payload['figure_status'] == 'complete'


def test_extract_docx_reports_missing_figure_summary_with_new_status_names(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '5',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    report = json.loads((tmp_path / 'reports' / 'extraction-report.json').read_text(encoding='utf-8'))
    assert report['missing_figure_questions'] == 3
    assert report['figure_status_breakdown']['source_missing'] == 2
    assert report['figure_status_breakdown']['text_reference_only'] == 1
    assert report['title_only_figures'] == report['missing_figure_questions']


def test_extract_docx_preserves_curated_question_content(tmp_path) -> None:
    questions_dir = tmp_path / 'questions'
    questions_dir.mkdir(parents=True, exist_ok=True)
    curated_path = questions_dir / 'AC-Q-0001.json'
    curated_path.write_text(
        json.dumps(
            {
                'question_id': 'AC-Q-0001',
                'source_ref': '1-1 24-25-2R',
                'question_number': '1-1',
                'chapter': 1,
                'section': '自动控制的一般概念',
                'stem_md': '人工修订题面',
                'solution_md': '人工修订解析',
                'inline_score_points': [{'points': 4, 'excerpt': '人工得分点'}],
                'rubric': [{'step': '步骤 1', 'points': 4, 'criteria': '人工得分点'}],
                'figure_titles': [],
                'figure_assets': [],
                'figure_status': 'none',
                'formula_status': 'clean',
                'usage_status': 'cleaned',
                'knowledge_tags': ['人工标签'],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding='utf-8',
    )

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '1',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payload = json.loads(curated_path.read_text(encoding='utf-8'))
    assert payload['usage_status'] == 'cleaned'
    assert payload['stem_md'] == '人工修订题面'
    assert payload['solution_md'] == '人工修订解析'
    assert payload['formula_status'] == 'clean'
    assert payload['knowledge_tags'] == ['人工标签']


def test_extract_docx_splits_solution_when_using_colon_or_proof_prefix(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '90',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted((tmp_path / 'questions').glob('AC-Q-*.json'))
    ]

    question_316 = next(payload for payload in payloads if payload['question_number'] == '3-16')
    assert question_316['solution_md'].startswith('解')
    assert '解：' not in question_316['stem_md']

    question_51 = next(payload for payload in payloads if payload['question_number'] == '5-1')
    assert question_51['solution_md'].startswith('证明')
    assert '证明 本题是为了加深对频率特性定义的理解。' not in question_51['stem_md']


def test_extract_docx_normalizes_bracket_wrapped_formulas(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '90',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted((tmp_path / 'questions').glob('AC-Q-*.json'))
    ]

    question_41 = next(payload for payload in payloads if payload['question_number'] == '4-1')
    combined = f"{question_41['stem_md']}\n{question_41['solution_md']}"
    assert '[ G(s)' not in combined
    assert '[ D(s)' not in combined
    assert r'\frac{K(3s+1)}{s(2s+1)}' in combined
    assert 'K$3s+1$' not in combined
    assert question_41['formula_status'] == 'clean'

    question_51 = next(payload for payload in payloads if payload['question_number'] == '5-1')
    combined_51 = f"{question_51['stem_md']}\n{question_51['solution_md']}"
    assert r'\cos(\omega t + \varphi)' in combined_51
    assert r'\cos$\omega t + \varphi$' not in combined_51


def test_extract_docx_keeps_parenthesized_groups_inside_fractions(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
            '--limit',
            '115',
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted((tmp_path / 'questions').glob('AC-Q-*.json'))
    ]

    question_524 = next(payload for payload in payloads if payload['question_number'] == '5-24')
    combined = f"{question_524['stem_md']}\n{question_524['solution_md']}"
    assert r'\frac{2}{(2s+1)(8s+1)}' in combined
    assert r'{$2s+1$' not in combined


def test_curated_formula_cleanup_batch_01_is_clean() -> None:
    expectations = {
        'AC-Q-0033': [
            r'1 - $L_1 + L_2 + L_3$ + L_1L_3',
        ],
        'AC-Q-0090': [
            '{ \\cos',
        ],
        'AC-Q-0134': [
            r'\frac{10K_1(s + K_2/K_1)}{s^2(s+10)} \quad \frac{10K_1(s+0.5)}{s^2(s+10)}',
            '$s^3$\t',
            r'$\sigma% = 14%',
        ],
    }

    for question_id, forbidden_snippets in expectations.items():
        payload = json.loads(
            (QUESTION_ROOT / 'questions' / f'{question_id}.json').read_text(encoding='utf-8')
        )
        combined = f"{payload['stem_md']}\n{payload['solution_md']}"
        assert payload['formula_status'] == 'clean', question_id
        assert payload['usage_status'] == 'cleaned', question_id
        for snippet in forbidden_snippets:
            assert snippet not in combined, f'{question_id}: unexpected snippet {snippet!r}'


def test_curated_formula_cleanup_batch_02_is_clean() -> None:
    expectations = {
        'AC-Q-0026': ['画出系统结构图$设', 'RC}_1 s ]'],
        'AC-Q-0030': [r'1 - $L_1 + L_2$'],
        'AC-Q-0032': ['] [ p_1 ='],
        'AC-Q-0054': ['| $s^3$ | $T_1 T_2$ | 1 | |'],
        'AC-Q-0065': [r'$$D(s) = $s+12$$s+2$ + K_a(s-4)$$'],
        'AC-Q-0087': ['] [ \\text{roots}(den);'],
        'AC-Q-0118': [r'$0.1s+1$$0.5s+1$'],
        'AC-Q-0125': [r'(0.01s + 1)$10s + 1$'],
        'AC-Q-0138': [r's(s+1)$s+2$'],
    }
    cleaned_ids = {
        'AC-Q-0026',
        'AC-Q-0030',
        'AC-Q-0032',
        'AC-Q-0054',
        'AC-Q-0056',
        'AC-Q-0057',
        'AC-Q-0062',
        'AC-Q-0063',
        'AC-Q-0064',
        'AC-Q-0065',
        'AC-Q-0068',
        'AC-Q-0073',
        'AC-Q-0079',
        'AC-Q-0081',
        'AC-Q-0087',
        'AC-Q-0089',
        'AC-Q-0095',
        'AC-Q-0103',
        'AC-Q-0113',
        'AC-Q-0116',
        'AC-Q-0118',
        'AC-Q-0125',
        'AC-Q-0138',
    }

    for question_id in cleaned_ids:
        payload = json.loads(
            (QUESTION_ROOT / 'questions' / f'{question_id}.json').read_text(encoding='utf-8')
        )
        combined = f"{payload['stem_md']}\n{payload['solution_md']}"
        assert payload['formula_status'] == 'clean', question_id
        assert payload['usage_status'] == 'cleaned', question_id
        for snippet in expectations.get(question_id, []):
            assert snippet not in combined, f'{question_id}: unexpected snippet {snippet!r}'


def test_extract_docx_does_not_treat_delta_annotations_as_mixed(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted((tmp_path / 'questions').glob('AC-Q-*.json'))
    ]

    for question_number in ('6-4', '6-13', '6-14', '6-21'):
        payload = next(item for item in payloads if item['question_number'] == question_number)
        combined = f"{payload['stem_md']}\n{payload['solution_md']}"
        assert r'(\Delta = 2%' in combined or r'(\Delta = 2%)' in combined
        assert payload['formula_status'] == 'clean', question_number


def test_extract_docx_does_not_treat_left_right_brackets_as_mixed(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-root',
            str(tmp_path),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    payloads = [
        json.loads(path.read_text(encoding='utf-8'))
        for path in sorted((tmp_path / 'questions').glob('AC-Q-*.json'))
    ]

    payload = next(item for item in payloads if item['question_number'] == '3-24')
    combined = f"{payload['stem_md']}\n{payload['solution_md']}"
    assert r'\left[' in combined and r'\right]' in combined
    assert payload['formula_status'] == 'clean'
