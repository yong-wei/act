#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
COURSE_ROOT = REPO_ROOT / 'course-content'
AUTHORING_ROOT = COURSE_ROOT / 'authoring'
RUNTIME_ROOT = COURSE_ROOT / 'runtime'

sys.path.insert(0, str(COURSE_ROOT / 'scripts'))
from lesson_id_map import (  # noqa: E402
    get_authoring_cards_dir,
    get_authoring_lesson_dir,
    get_runtime_lesson_dir,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Review lesson content and export reviewed runtime artifacts.')
    parser.add_argument('--lesson', required=True, help='Lesson id such as 1-2 or L-2d')
    parser.add_argument(
        '--skip-export',
        action='store_true',
        help='Only run review checks and generate intermediate outputs, do not invoke export_runtime.py',
    )
    return parser.parse_args()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def ensure_runtime_review_dir(lesson_id: str) -> Path:
    target = get_runtime_lesson_dir(lesson_id) / 'review'
    target.mkdir(parents=True, exist_ok=True)
    return target


def normalize_manual_review_text(markdown: str) -> list[str]:
    issues: list[str] = []
    if markdown.count('$$') % 2 != 0:
        issues.append('发现未成对的块级公式分隔符 $$')

    inline_count = 0
    escaped = False
    for char in markdown:
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
            continue
        if char == '$':
            inline_count += 1
    if inline_count % 2 != 0:
        issues.append('发现未成对的行内公式分隔符 $')

    if re.search(r'\\left(?!arrow)', markdown) and not re.search(r'\\right(?!arrow)', markdown):
        issues.append('发现疑似缺少 \\right 的公式')
    if re.search(r'\\right(?!arrow)', markdown) and not re.search(r'\\left(?!arrow)', markdown):
        issues.append('发现疑似缺少 \\left 的公式')

    return issues


def extract_expected_code_media(multimedia_path: Path) -> list[dict[str, str]]:
    if not multimedia_path.exists():
        return []

    expected_by_output: dict[str, dict[str, str]] = {}
    text = multimedia_path.read_text(encoding='utf-8')
    script_pattern = re.compile(
        r'`media/raw/(?P<script>[^`]+\.(?:py|m))`\s*->\s*`media/processed/(?P<output>[^`]+\.(?:svg|png|pdf|mp4|m4a))`'
    )
    asset_pattern = re.compile(
        r'(?<![A-Za-z0-9_./-])(?P<output>[A-Za-z0-9][A-Za-z0-9._-]+\.(?:svg|png|pdf|mp4|m4a))(?![A-Za-z0-9_./-])'
    )

    for match in script_pattern.finditer(text):
        script_name = Path(match.group('script')).name
        output_name = Path(match.group('output')).name
        expected_by_output[output_name] = {
            'script': script_name,
            'output': output_name,
        }

    for match in asset_pattern.finditer(text):
        output_name = Path(match.group('output')).name
        expected_by_output.setdefault(output_name, {'output': output_name})

    return list(expected_by_output.values())


def build_primary_sources(lesson_id: str, unit_type: str) -> list[Path]:
    design_dir = get_authoring_lesson_dir(lesson_id) / 'design'
    sources: list[Path] = []
    handout = design_dir / 'handout.md'
    practice_guide = design_dir / 'practice-guide.md'
    assessment_spec = design_dir / 'assessment-spec.md'

    if unit_type == '实践':
        if practice_guide.exists():
            sources.append(practice_guide)
        if assessment_spec.exists():
            sources.append(assessment_spec)
    elif handout.exists():
        sources.append(handout)

    return sources


def run_media_generation(lesson_id: str, expected_media: list[dict[str, str]]) -> dict[str, Any]:
    lesson_dir = get_authoring_lesson_dir(lesson_id)
    raw_dir = lesson_dir / 'media' / 'raw'
    processed_dir = lesson_dir / 'media' / 'processed'
    processed_dir.mkdir(parents=True, exist_ok=True)
    matplotlib_env = os.environ.copy()
    matplotlib_env['MPLBACKEND'] = 'Agg'
    matplotlib_env['MPLCONFIGDIR'] = str(raw_dir / '.matplotlib')
    Path(matplotlib_env['MPLCONFIGDIR']).mkdir(parents=True, exist_ok=True)

    generated_assets: list[str] = []
    missing_assets: list[str] = []
    executed_scripts: list[str] = []

    for item in expected_media:
        output_path = processed_dir / item['output']
        script_name = item.get('script')

        if output_path.exists():
            generated_assets.append(item['output'])
            continue

        if not script_name:
            missing_assets.append(item['output'])
            continue

        script_path = raw_dir / script_name
        if not script_path.exists():
            missing_assets.append(item['output'])
            continue

        if script_path.suffix == '.py':
            subprocess.run(
                ['python3', script_path.name, '--output', str(output_path)],
                cwd=str(raw_dir),
                check=True,
                env=matplotlib_env,
            )
        elif script_path.suffix == '.m':
            subprocess.run(
                ['octave', '-qf', script_path.name],
                cwd=str(raw_dir),
                check=True,
                env=matplotlib_env,
            )
        else:
            missing_assets.append(item['output'])
            continue

        executed_scripts.append(script_name)
        if output_path.exists():
            generated_assets.append(item['output'])
        else:
            missing_assets.append(item['output'])

    return {
        'lesson_id': lesson_id,
        'expected_assets': [item['output'] for item in expected_media],
        'generated_assets': generated_assets,
        'missing_assets': missing_assets,
        'executed_scripts': executed_scripts,
        'processed_dir': str(processed_dir.relative_to(REPO_ROOT)).replace('\\', '/'),
    }


def check_knowledge_cards(lesson_id: str) -> dict[str, Any]:
    sequence_path = get_authoring_cards_dir(lesson_id) / 'sequence.json'
    sequence = read_json(sequence_path)
    card_dir = AUTHORING_ROOT / 'knowledge' / 'cards' / 'nodes'

    node_ids = list(dict.fromkeys(
        [node_id for group in sequence.get('groups', []) for node_id in group.get('node_ids', [])]
        + list(sequence.get('card_order', []))
    ))

    missing_cards: list[str] = []
    missing_frontmatter_keys: dict[str, list[str]] = {}
    missing_sections: dict[str, list[str]] = {}

    for node_id in node_ids:
        card_path = card_dir / f'{node_id}.md'
        if not card_path.exists():
            missing_cards.append(node_id)
            continue

        text = card_path.read_text(encoding='utf-8')
        missing_keys = [
            key
            for key in ('node_id:', 'lesson_units:', 'source_docs:')
            if key not in text
        ]
        if missing_keys:
            missing_frontmatter_keys[node_id] = missing_keys

        missing_card_sections = [
            heading
            for heading in ('## 首页', '## 详情')
            if heading not in text
        ]
        if missing_card_sections:
            missing_sections[node_id] = missing_card_sections

    return {
        'lesson_id': lesson_id,
        'sequence_path': str(sequence_path.relative_to(REPO_ROOT)).replace('\\', '/'),
        'card_order': sequence.get('card_order', []),
        'missing_cards': missing_cards,
        'missing_frontmatter_keys': missing_frontmatter_keys,
        'missing_sections': missing_sections,
    }


def build_text_review(lesson_id: str, primary_sources: list[Path], boppps_path: Path) -> dict[str, Any]:
    findings: list[dict[str, Any]] = []
    for path in primary_sources + ([boppps_path] if boppps_path.exists() else []):
        issues = normalize_manual_review_text(path.read_text(encoding='utf-8'))
        findings.append({
            'path': str(path.relative_to(REPO_ROOT)).replace('\\', '/'),
            'issues': issues,
        })
    return {
        'lesson_id': lesson_id,
        'files': findings,
    }


def build_review_report(
    lesson_id: str,
    unit_type: str,
    primary_sources: list[Path],
    text_review: dict[str, Any],
    knowledge_check: dict[str, Any],
    multimedia_check: dict[str, Any],
) -> str:
    reviewed_paths = [
        str(path.relative_to(REPO_ROOT)).replace('\\', '/')
        for path in primary_sources
    ]
    reviewed_paths.append(
        str((get_authoring_lesson_dir(lesson_id) / 'design' / 'boppps.md').relative_to(REPO_ROOT)).replace('\\', '/')
    )

    issue_lines: list[str] = []
    for item in text_review['files']:
        if item['issues']:
            issue_lines.append(f"- `{item['path']}`：{'；'.join(item['issues'])}")

    if not issue_lines:
        issue_lines.append('- 未发现阻塞导出的公式配对问题。')

    missing_cards = knowledge_check['missing_cards']
    knowledge_summary = (
        '- 知识卡片已全部存在，且均包含 `## 首页` / `## 详情` 基本结构。'
        if not missing_cards and not knowledge_check['missing_frontmatter_keys'] and not knowledge_check['missing_sections']
        else '- 仍存在知识卡片缺失或结构异常，请先修复后再继续制作。'
    )

    multimedia_summary = (
        f"- 已识别并确认存在 {len(multimedia_check['generated_assets'])} 项正式媒体，未发现缺失。"
        if not multimedia_check['missing_assets']
        else f"- 正式媒体仍缺失：{', '.join(multimedia_check['missing_assets'])}"
    )

    return '\n'.join([
        f'# {lesson_id} 课程审查报告',
        '',
        '## 审查范围',
        f'- 课型：{unit_type}',
        *[f'- `{path}`' for path in reviewed_paths],
        '',
        '## 文本技术审查',
        *issue_lines,
        '',
        '## BOPPPS 对照',
        '- 已将 `design/boppps.md` 作为 runtime/review 产物导出，供课程制作技能直接读取。',
        '',
        '## knowledge-card-check',
        knowledge_summary,
        '',
        '## multimedia-check',
        multimedia_summary,
        '',
        '## 导出结论',
        '- authoring 已作为审查源保留；runtime 已输出 handout、media、review 索引，可直接供后续互动课程制作使用。',
    ]) + '\n'


def build_source_manifest(
    lesson_id: str,
    unit_type: str,
    primary_sources: list[Path],
    expected_media: list[dict[str, str]],
) -> dict[str, Any]:
    return {
        'lesson_id': lesson_id,
        'unit_type': unit_type,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'primary_sources': [
            str(path.relative_to(REPO_ROOT)).replace('\\', '/')
            for path in primary_sources
        ],
        'boppps_source': str((get_authoring_lesson_dir(lesson_id) / 'design' / 'boppps.md').relative_to(REPO_ROOT)).replace('\\', '/'),
        'sequence_source': str((get_authoring_cards_dir(lesson_id) / 'sequence.json').relative_to(REPO_ROOT)).replace('\\', '/'),
        'expected_code_media': expected_media,
    }


def main() -> None:
    args = parse_args()
    lesson_id = args.lesson
    lesson_dir = get_authoring_lesson_dir(lesson_id)
    manifest = read_json(lesson_dir / 'manifest.json')
    unit_type = str(manifest.get('unit_type', '理论'))
    design_dir = lesson_dir / 'design'

    primary_sources = build_primary_sources(lesson_id, unit_type)
    if not primary_sources:
        raise FileNotFoundError(f'No primary review sources found for lesson {lesson_id}')

    boppps_path = design_dir / 'boppps.md'
    multimedia_path = design_dir / 'multimedia.md'

    expected_media = extract_expected_code_media(multimedia_path)
    multimedia_check = run_media_generation(lesson_id, expected_media)
    knowledge_check = check_knowledge_cards(lesson_id)
    text_review = build_text_review(lesson_id, primary_sources, boppps_path)

    review_dir = ensure_runtime_review_dir(lesson_id)
    write_json(review_dir / 'knowledge-card-check.json', knowledge_check)
    write_json(review_dir / 'multimedia-check.json', multimedia_check)
    write_json(
        review_dir / 'source-manifest.json',
        build_source_manifest(lesson_id, unit_type, primary_sources, expected_media),
    )
    write_text(
        review_dir / 'review-report.md',
        build_review_report(
            lesson_id,
            unit_type,
            primary_sources,
            text_review,
            knowledge_check,
            multimedia_check,
        ),
    )

    if not args.skip_export:
        subprocess.run(
            ['python3', str(COURSE_ROOT / 'scripts' / 'export_runtime.py'), lesson_id],
            cwd=str(REPO_ROOT),
            check=True,
        )


if __name__ == '__main__':
    main()
