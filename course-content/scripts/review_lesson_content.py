#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import yaml
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
from runtime_media_index import ensure_runtime_media_index  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Review lesson content and export reviewed runtime artifacts.')
    parser.add_argument('--lesson', required=True, help='Lesson id such as 1-2 or L-2d')
    parser.add_argument(
        '--skip-export',
        action='store_true',
        help='Only run review checks and generate intermediate outputs, do not invoke export_runtime.py',
    )
    parser.add_argument(
        '--strict-implementation-contract',
        action='store_true',
        help='Exit with non-zero status when authoring interactive contract and local implementation contract drift.',
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


def format_repo_path(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT)).replace('\\', '/')
    except ValueError:
        return path.as_posix()


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

    expected_by_output: dict[str, dict[str, Any]] = {}
    text = multimedia_path.read_text(encoding='utf-8')
    script_pattern = re.compile(
        r'`media/raw/(?P<script>[^`]+\.(?:py|m))`\s*->\s*`media/processed/(?P<output>[^`]+\.(?:svg|png|pdf|mp4|m4a))`'
    )
    asset_pattern = re.compile(
        r'(?<![A-Za-z0-9_./-])(?P<output>[A-Za-z0-9][A-Za-z0-9._-]+\.(?:svg|png|pdf|mp4|m4a))(?![A-Za-z0-9_./-])'
    )
    section_pattern = re.compile(r'^###\s+资源[^\n]*\n(?P<body>.*?)(?=^###\s+资源|\Z)', re.MULTILINE | re.DOTALL)
    formula_mode_pattern = re.compile(
        r'公式模式[^：:\n]*[：:]\s*`?(?P<mode>none|svg-mathtext|svg-latex-engine|page-katex-companion)`?'
    )
    page_formula_sources_pattern = re.compile(r'页面公式来源[^：:\n]*[：:]\s*(?P<sources>.+)')

    for match in script_pattern.finditer(text):
        script_name = Path(match.group('script')).name
        output_name = Path(match.group('output')).name
        expected_by_output[output_name] = {
            'script': script_name,
            'output': output_name,
            'formula_mode': 'none',
            'page_formula_sources': [],
        }

    for match in asset_pattern.finditer(text):
        output_name = Path(match.group('output')).name
        expected_by_output.setdefault(
            output_name,
            {
                'output': output_name,
                'formula_mode': 'none',
                'page_formula_sources': [],
            },
        )

    for section_match in section_pattern.finditer(text):
        body = section_match.group('body')
        storage_match = script_pattern.search(body)
        if not storage_match:
            continue

        output_name = Path(storage_match.group('output')).name
        expected = expected_by_output.setdefault(
            output_name,
            {
                'script': Path(storage_match.group('script')).name,
                'output': output_name,
                'formula_mode': 'none',
                'page_formula_sources': [],
            },
        )

        formula_mode_match = formula_mode_pattern.search(body)
        if formula_mode_match:
            expected['formula_mode'] = formula_mode_match.group('mode')

        sources_match = page_formula_sources_pattern.search(body)
        if sources_match:
            source_text = sources_match.group('sources')
            backtick_sources = re.findall(r'`([^`]+)`', source_text)
            if backtick_sources:
                expected['page_formula_sources'] = backtick_sources
            else:
                expected['page_formula_sources'] = [
                    source.strip()
                    for source in re.split(r'[，,]', source_text)
                    if source.strip()
                ]

    return list(expected_by_output.values())


def has_latex_formula_markers(text: str) -> bool:
    return '$' in text or '\\(' in text or '\\[' in text


def validate_formula_media_contract(expected_media: list[dict[str, Any]], lesson_dir: Path) -> list[str]:
    issues: list[str] = []
    for item in expected_media:
        output_name = item['output']
        formula_mode = item.get('formula_mode', 'none')
        page_formula_sources = item.get('page_formula_sources', [])

        if formula_mode in {'svg-mathtext', 'svg-latex-engine'} and not output_name.endswith('.svg'):
            issues.append(f'{output_name} 声明为 {formula_mode}，但输出格式不是 SVG')

        if formula_mode == 'page-katex-companion' and not page_formula_sources:
            issues.append(f'{output_name} 声明为 page-katex-companion，但未提供页面公式来源')

        for source in page_formula_sources:
            source_path = lesson_dir / source
            if not source_path.exists():
                issues.append(f'{output_name} 的页面公式来源 `{source}` 不存在')
                continue
            if not has_latex_formula_markers(source_path.read_text(encoding='utf-8')):
                issues.append(f'{output_name} 的页面公式来源 `{source}` 未检测到 LaTeX 公式标记')

    return issues


def build_primary_sources(lesson_id: str, unit_type: str) -> list[Path]:
    design_dir = get_authoring_lesson_dir(lesson_id) / 'design'
    sources: list[Path] = []
    handout = design_dir / 'handout.md'
    interactive_page = design_dir / 'interactive-page.md'
    practice_guide = design_dir / 'practice-guide.md'
    assessment_spec = design_dir / 'assessment-spec.md'

    if handout.exists():
        sources.append(handout)

    if interactive_page.exists():
        sources.append(interactive_page)

    if not sources:
        # 兼容旧式实践课：仍允许 practice-guide / assessment-spec 作为回退输入。
        if practice_guide.exists():
            sources.append(practice_guide)
        if assessment_spec.exists():
            sources.append(assessment_spec)

    return sources


def extract_markdown_headings(markdown: str) -> set[str]:
    headings: set[str] = set()
    for line in markdown.splitlines():
        match = re.match(r'^(#{2,4})\s+(.+?)\s*$', line.strip())
        if match:
            headings.add(f'{match.group(1)} {match.group(2)}')
    return headings


def split_handout_anchor(anchor_text: str) -> list[str]:
    cleaned = anchor_text.strip().strip('`').strip()
    if not cleaned:
        return []
    return [part.strip() for part in re.split(r'\s+/\s+', cleaned) if part.strip()]


def normalize_formula_text(text: str) -> str:
    normalized = re.sub(r'\s+', '', text)
    normalized = normalized.replace('\\\\', '\\')
    normalized = normalized.replace(r'\dfrac', r'\frac')
    normalized = normalized.replace(r'\left', '')
    normalized = normalized.replace(r'\right', '')
    return normalized


def extract_formula_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for pattern in (r'\$\$(.+?)\$\$', r'(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)'):
        for match in re.finditer(pattern, text, re.DOTALL):
            token = normalize_formula_text(match.group(1))
            if token and token not in tokens:
                tokens.append(token)
    return tokens


def formula_is_covered(required_formula: str, static_formulas: list[str], normalized_static_text: str) -> bool:
    if any(required_formula in static_formula for static_formula in static_formulas):
        return True
    if required_formula in normalized_static_text:
        return True
    if '=' in required_formula:
        rhs = required_formula.split('=')[-1]
        if rhs and any(rhs in static_formula for static_formula in static_formulas):
            return True
        if rhs and rhs in normalized_static_text:
            return True
    return False


INTERACTIVE_CONTRACT_REQUIRED_STEP_FIELDS = [
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

IMPLEMENTATION_CONTRACT_REGISTRY: dict[str, dict[str, Any]] = {
    '2-1': {
        'course_lib_path': REPO_ROOT / 'src' / 'lib' / 'unit-2-1-course.ts',
        'page_contracts_const': 'UNIT_2_1_PAGE_CONTRACTS',
        'lesson_steps_const': 'UNIT_2_1_LESSON_STEPS',
        'source_path': 'src/lib/unit-2-1-course.ts',
    },
    '2-2': {
        'course_lib_path': REPO_ROOT / 'src' / 'lib' / 'unit-2-2-course.ts',
        'page_contracts_const': 'UNIT_2_2_PAGE_CONTRACTS',
        'lesson_steps_const': 'UNIT_2_2_LESSON_STEPS',
        'source_path': 'src/lib/unit-2-2-course.ts',
    },
    '4-1': {
        'course_lib_path': REPO_ROOT / 'src' / 'lib' / 'unit-4-1-course.ts',
        'page_contracts_const': 'UNIT_4_1_PAGE_CONTRACTS',
        'lesson_steps_const': 'UNIT_4_1_LESSON_STEPS',
        'source_path': 'src/lib/unit-4-1-course.ts',
    },
    '3-6': {
        'course_lib_path': REPO_ROOT / 'src' / 'lib' / 'unit-3-6-course.ts',
        'page_contracts_const': 'UNIT_3_6_PAGE_CONTRACTS',
        'lesson_steps_const': 'UNIT_3_6_LESSON_STEPS',
        'source_path': 'src/lib/unit-3-6-course.ts',
    },
}

TYPESCRIPT_EXPORT_EXTRACTOR = r"""
const fs = require('node:fs');
const ts = require('typescript');

const [filePath, exportName] = process.argv.slice(1);
const sourceText = fs.readFileSync(filePath, 'utf8');
const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function unwrap(node) {
  while (
    ts.isAsExpression(node) ||
    (typeof ts.isSatisfiesExpression === 'function' && ts.isSatisfiesExpression(node)) ||
    ts.isParenthesizedExpression(node)
  ) {
    node = node.expression;
  }
  return node;
}

function evaluate(node) {
  node = unwrap(node);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(evaluate);
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const name = prop.name;
        const key = ts.isIdentifier(name) ? name.text : ts.isStringLiteral(name) ? name.text : name.getText(sourceFile);
        out[key] = evaluate(prop.initializer);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        out[prop.name.text] = `__SHORTHAND__:${prop.name.text}`;
      } else if (ts.isSpreadAssignment(prop)) {
        out[`__SPREAD__${Object.keys(out).length}`] = `__EXPR__:${prop.expression.getText(sourceFile)}`;
      }
    }
    return out;
  }
  if (ts.isPrefixUnaryExpression(node)) {
    const value = evaluate(node.operand);
    if (node.operator === ts.SyntaxKind.MinusToken && typeof value === 'number') {
      return -value;
    }
    return value;
  }
  return `__EXPR__:${node.getText(sourceFile)}`;
}

let result = null;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === exportName && node.initializer) {
    result = evaluate(node.initializer);
  }
  ts.forEachChild(node, visit);
}

visit(sourceFile);

if (result === null) {
  console.error(`EXPORT_NOT_FOUND:${exportName}`);
  process.exit(2);
}

process.stdout.write(JSON.stringify(result));
"""


def load_interactive_contract(contract_path: Path) -> tuple[dict[str, Any] | None, list[str]]:
    if not contract_path.exists():
        return None, []

    try:
        payload = yaml.safe_load(contract_path.read_text(encoding='utf-8'))
    except yaml.YAMLError as exc:
        return None, [f'interactive-contract.yaml 解析失败：{exc}']

    if not isinstance(payload, dict):
        return None, ['interactive-contract.yaml 顶层必须是对象']

    return payload, []


def validate_interactive_contract(
    lesson_id: str,
    step_sections: dict[str, dict[str, str]],
    contract_path: Path,
) -> tuple[list[str], list[str], list[str], list[str]]:
    payload, contract_load_issues = load_interactive_contract(contract_path)
    if contract_load_issues:
        return contract_load_issues, [], [], INTERACTIVE_CONTRACT_REQUIRED_STEP_FIELDS
    if payload is None:
        return [], [], [], INTERACTIVE_CONTRACT_REQUIRED_STEP_FIELDS

    issues: list[str] = []
    warnings: list[str] = []
    summary: list[str] = []

    required_step_fields = payload.get('required_step_fields')
    if isinstance(required_step_fields, list) and required_step_fields:
        normalized_required_fields = [
            str(field).strip()
            for field in required_step_fields
            if str(field).strip()
        ]
    else:
        normalized_required_fields = INTERACTIVE_CONTRACT_REQUIRED_STEP_FIELDS

    steps = payload.get('steps')
    if not isinstance(steps, dict):
        return ['interactive-contract.yaml 缺少 `steps` 对象'], warnings, summary, normalized_required_fields

    missing_contract_steps = [
        step_id for step_id in step_sections.keys()
        if step_id not in steps
    ]
    if missing_contract_steps:
        issues.append(f'互动契约缺少步骤：{", ".join(missing_contract_steps)}')

    for step_id, step_payload in steps.items():
        if not isinstance(step_payload, dict):
            issues.append(f'步骤 `{step_id}` 的互动契约必须是对象')
            continue

        missing_fields = [
            field for field in normalized_required_fields
            if field not in step_payload
        ]
        if missing_fields:
            issues.append(f'步骤 `{step_id}` 的互动契约缺少字段：{", ".join(missing_fields)}')

    if not issues:
        summary.append(f'已检测到 `{lesson_id}` 的 V2 互动契约，步骤字段完整。')

    return issues, warnings, summary, normalized_required_fields


def load_typescript_export_value(ts_path: Path, export_name: str) -> tuple[Any | None, list[str]]:
    if not ts_path.exists():
        return None, [f'本地实现契约源码不存在：{format_repo_path(ts_path)}']

    completed = subprocess.run(
        ['node', '-e', TYPESCRIPT_EXPORT_EXTRACTOR, str(ts_path), export_name],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.strip()
        message = stderr or completed.stdout.strip() or 'unknown error'
        if message.startswith('EXPORT_NOT_FOUND:'):
            missing_export = message.split(':', 1)[-1]
            return None, [f'本地实现契约源码缺少导出：{missing_export}']
        return None, [f'解析本地实现契约失败：{message}']

    try:
        return json.loads(completed.stdout), []
    except json.JSONDecodeError as exc:
        return None, [f'本地实现契约导出不是合法 JSON：{exc.msg}']


def compare_contract_field(
    issues: list[str],
    step_id: str,
    field_name: str,
    expected: Any,
    actual: Any,
) -> None:
    if expected == actual:
        return
    issues.append(
        '步骤 `{step}` 的实现契约字段 `{field}` 与作者态不一致：expected={expected} actual={actual}'.format(
            step=step_id,
            field=field_name,
            expected=json.dumps(expected, ensure_ascii=False),
            actual=json.dumps(actual, ensure_ascii=False),
        )
    )


def normalize_optional_required_fields(payload: dict[str, Any], field_name: str) -> list[str]:
    raw_fields = payload.get(field_name)
    if not isinstance(raw_fields, list):
        return []
    return [
        str(field).strip()
        for field in raw_fields
        if str(field).strip()
    ]


def has_nested_contract_field(payload: Any, field_path: str) -> bool:
    current = payload
    for segment in field_path.split('.'):
        if not isinstance(current, dict) or segment not in current:
            return False
        current = current.get(segment)
    return True


def collect_missing_nested_contract_fields(
    container_name: str,
    container_payload: Any,
    required_fields: list[str],
) -> list[str]:
    if not required_fields:
        return []
    if not isinstance(container_payload, dict):
        return [f'{container_name}.{field_name}' for field_name in required_fields]
    return [
        f'{container_name}.{field_name}'
        for field_name in required_fields
        if not has_nested_contract_field(container_payload, field_name)
    ]


def build_implementation_contract_check(lesson_id: str, contract_path: Path) -> tuple[str | None, list[str], list[str]]:
    config = IMPLEMENTATION_CONTRACT_REGISTRY.get(lesson_id)
    if not config:
        return None, [], []

    payload, contract_load_issues = load_interactive_contract(contract_path)
    if contract_load_issues:
        return config.get('source_path'), contract_load_issues, []
    if payload is None:
        return config.get('source_path'), [], []

    steps = payload.get('steps')
    if not isinstance(steps, dict):
        return config.get('source_path'), ['interactive-contract.yaml 缺少 `steps` 对象'], []

    page_contracts, page_contract_load_issues = load_typescript_export_value(
        Path(config['course_lib_path']),
        str(config['page_contracts_const']),
    )
    lesson_steps, lesson_steps_load_issues = load_typescript_export_value(
        Path(config['course_lib_path']),
        str(config['lesson_steps_const']),
    )
    load_issues = page_contract_load_issues + lesson_steps_load_issues
    if load_issues:
        return config.get('source_path'), load_issues, []

    if not isinstance(page_contracts, dict):
        return config.get('source_path'), ['本地实现契约导出的页面契约不是对象'], []
    if not isinstance(lesson_steps, list):
        return config.get('source_path'), ['本地实现契约导出的步骤定义不是数组'], []

    issues: list[str] = []
    step_by_id = {
        step.get('id'): step for step in lesson_steps
        if isinstance(step, dict) and isinstance(step.get('id'), str)
    }

    for step_id, step_payload in steps.items():
        if not isinstance(step_payload, dict):
            continue

        local_step = step_by_id.get(step_id)
        local_page_contract = page_contracts.get(step_id)

        if local_step is None:
            issues.append(f'本地实现缺少步骤定义：{step_id}')
            continue
        if not isinstance(local_page_contract, dict):
            issues.append(f'本地实现缺少页面契约：{step_id}')
            continue

        interaction_spec = step_payload.get('interaction_spec')
        layout = step_payload.get('layout')
        preview_contract = step_payload.get('preview_contract')
        teacher_insight_spec = step_payload.get('teacher_insight_spec')
        telemetry_spec = step_payload.get('telemetry_spec')
        ai_context_spec = step_payload.get('ai_context_spec')
        interactive_figure_spec = step_payload.get('interactive_figure_spec')

        interaction_kind = (
            interaction_spec.get('interaction_kind')
            if isinstance(interaction_spec, dict)
            else None
        )
        compare_contract_field(issues, step_id, 'title', step_payload.get('title'), local_step.get('title'))
        local_page_type = local_step.get('pageType')
        if interaction_kind == 'none':
            if local_page_type not in {'display', 'summary'}:
                issues.append(
                    '步骤 `{step}` 的实现契约字段 `pageType` 与作者态不一致：expected="display|summary" actual={actual}'.format(
                        step=step_id,
                        actual=json.dumps(local_page_type, ensure_ascii=False),
                    )
                )
        else:
            compare_contract_field(
                issues,
                step_id,
                'pageType',
                interaction_kind,
                local_page_type,
            )
        compare_contract_field(
            issues,
            step_id,
            'interactionKind',
            interaction_kind,
            local_page_contract.get('interactionKind'),
        )
        if isinstance(layout, dict):
            compare_contract_field(
                issues,
                step_id,
                'layout.template',
                layout.get('template'),
                (local_page_contract.get('layout') or {}).get('template'),
            )
            compare_contract_field(
                issues,
                step_id,
                'layout.regions',
                layout.get('regions', []),
                (local_page_contract.get('layout') or {}).get('regions', []),
            )
            if 'reading_order' in layout:
                compare_contract_field(
                    issues,
                    step_id,
                    'layout.reading_order',
                    layout.get('reading_order', []),
                    (local_page_contract.get('layout') or {}).get('readingOrder', []),
                )
        if isinstance(interaction_spec, dict) and 'interaction_archetype' in interaction_spec:
            compare_contract_field(
                issues,
                step_id,
                'interaction_archetype',
                interaction_spec.get('interaction_archetype'),
                local_page_contract.get('interactionArchetype'),
            )
        if isinstance(preview_contract, dict):
            compare_contract_field(
                issues,
                step_id,
                'previewDemoPath',
                preview_contract.get('demo_path'),
                local_page_contract.get('previewDemoPath'),
            )
        if isinstance(teacher_insight_spec, dict):
            compare_contract_field(
                issues,
                step_id,
                'teacherInsightWidgets',
                teacher_insight_spec.get('widgets', []),
                local_page_contract.get('teacherInsightWidgets', []),
            )
        if isinstance(telemetry_spec, dict):
            compare_contract_field(
                issues,
                step_id,
                'telemetrySummaryFields',
                telemetry_spec.get('summary_fields', []),
                local_page_contract.get('telemetrySummaryFields', []),
            )
            compare_contract_field(
                issues,
                step_id,
                'misconceptionTags',
                telemetry_spec.get('misconception_tags', []),
                local_page_contract.get('misconceptionTags', []),
            )
        if isinstance(ai_context_spec, dict) and 'delivery_mode' in ai_context_spec:
            local_ai_context = local_step.get('aiContext') if isinstance(local_step.get('aiContext'), dict) else {}
            compare_contract_field(
                issues,
                step_id,
                'ai_context_spec.delivery_mode',
                ai_context_spec.get('delivery_mode'),
                local_ai_context.get('deliveryMode') or local_page_contract.get('aiDeliveryMode'),
            )
        if isinstance(interactive_figure_spec, dict):
            if 'layout_mirror' in interactive_figure_spec:
                compare_contract_field(
                    issues,
                    step_id,
                    'interactive_figure_spec.layout_mirror',
                    interactive_figure_spec.get('layout_mirror'),
                    local_page_contract.get('figureLayoutMirror'),
                )
            controls = interactive_figure_spec.get('controls')
            if isinstance(controls, dict):
                if 'placement' in controls:
                    compare_contract_field(
                        issues,
                        step_id,
                        'interactive_figure_spec.controls.placement',
                        controls.get('placement'),
                        local_page_contract.get('controlsPlacement'),
                    )
                if 'collapsed_by_default' in controls:
                    compare_contract_field(
                        issues,
                        step_id,
                        'interactive_figure_spec.controls.collapsed_by_default',
                        controls.get('collapsed_by_default'),
                        local_page_contract.get('controlsCollapsedByDefault'),
                    )

    summary = []
    if not issues:
        summary.append(f'已检测到 `{lesson_id}` 的本地实现契约与作者态互动契约一致。')

    return config.get('source_path'), issues, summary


def parse_markdown_table(rows: list[str]) -> list[dict[str, str]]:
    if len(rows) < 3:
        return []

    headers = [cell.strip() for cell in rows[0].strip('|').split('|')]
    parsed_rows: list[dict[str, str]] = []
    for row in rows[2:]:
        cells = [cell.strip() for cell in row.strip('|').split('|')]
        if len(cells) != len(headers):
            continue
        parsed_rows.append(dict(zip(headers, cells)))
    return parsed_rows


def extract_step_sections(markdown: str) -> dict[str, dict[str, str]]:
    step_sections: dict[str, dict[str, str]] = {}
    step_pattern = re.compile(
        r'^##\s+(?:步骤\s+|step-)([0-9]+)｜.*?(?=^##\s+(?:步骤\s+|step-)[0-9]+｜|\Z)',
        re.MULTILINE | re.DOTALL,
    )
    for match in step_pattern.finditer(markdown):
        step_num = match.group(1)
        step_id = f'step-{int(step_num):02d}'
        block = match.group(0)
        static_match = re.search(
            r'###\s+(?:静态承载内容|固定内容|固定证据)\s*\n(?P<body>.*?)(?=\n###\s+(?:互动升级点|互动与反馈)|\Z)',
            block,
            re.DOTALL,
        )
        upgrade_match = re.search(
            r'###\s+(?:互动升级点|互动与反馈)\s*\n(?P<body>.*?)(?=\n###\s+|\Z)',
            block,
            re.DOTALL,
        )
        step_sections[step_id] = {
            'block': block,
            'static': static_match.group('body').strip() if static_match else '',
            'upgrade': upgrade_match.group('body').strip() if upgrade_match else '',
            'has_reading_order': '主阅读顺序' in block,
            'has_curve_figure_mirror': '曲线互动镜像说明' in block,
        }
    return step_sections


def build_interactive_page_check(lesson_id: str, primary_sources: list[Path]) -> dict[str, Any]:
    lesson_dir = get_authoring_lesson_dir(lesson_id)
    interactive_page = lesson_dir / 'design' / 'interactive-page.md'
    interactive_contract = lesson_dir / 'design' / 'interactive-contract.yaml'
    handout_path = lesson_dir / 'design' / 'handout.md'
    if not interactive_page.exists():
        return {
            'lesson_id': lesson_id,
            'source_path': None,
            'contract_path': format_repo_path(interactive_contract),
            'implementation_contract_source': None,
            'contract_required_fields': INTERACTIVE_CONTRACT_REQUIRED_STEP_FIELDS,
            'included_in_primary_sources': False,
            'mapping_contract_mode': 'core_items',
            'has_core_mapping_section': False,
            'mapping_columns_present': [],
            'missing_mapping_columns': [],
            'invalid_handout_anchors': [],
            'missing_target_steps': [],
            'formula_mapping_issues': [],
            'step_static_blocks_missing': [],
            'step_upgrade_blocks_missing': [],
            'step_reading_order_missing': [],
            'curve_figure_steps_missing_mirror': [],
            'curve_figure_steps_missing_contract': [],
            'missing_contract_fields': [],
            'step_contract_issues': [],
            'implementation_contract_summary': [],
            'implementation_contract_issues': [],
            'summary': [],
            'warnings': [],
            'missing': ['缺少 design/interactive-page.md'],
            'issues': ['缺少 design/interactive-page.md'],
        }

    text = interactive_page.read_text(encoding='utf-8')
    issues: list[str] = []
    core_mapping_columns = [
        'handout_anchor',
        'core_item_type',
        'must_appear_content',
        'target_step',
        'page_mode',
        'interaction_upgrade',
        'media_or_table_ref',
        'acceptance_note',
    ]
    evidence_mapping_columns = [
        'handout_anchor',
        'evidence_unit_id',
        'evidence_kind',
        'must_appear_content',
        'target_step',
        'page_mode',
        'interaction_archetype',
        'media_or_table_ref',
        'acceptance_note',
    ]
    upgrade_decision_columns = [
        'evidence_unit_id',
        'handout_anchor',
        'evidence_kind',
        'target_steps',
        'upgrade_mode',
        'keep_elements',
        'non_reducible',
        'acceptance_checks',
    ]
    mapping_match = re.search(
        r'##\s+(?P<title>讲义核心内容映射|讲义证据单元映射|证据单元升级决策表)\s*\n(?P<body>.*?)(?=\n##\s+|\Z)',
        text,
        re.DOTALL,
    )
    mapping_columns_present: list[str] = []
    mapping_rows: list[dict[str, str]] = []
    mapping_contract_mode = 'core_items'
    if mapping_match:
        if mapping_match.group('title') == '讲义证据单元映射':
            mapping_contract_mode = 'evidence_units'
        elif mapping_match.group('title') == '证据单元升级决策表':
            mapping_contract_mode = 'upgrade_table'
        else:
            mapping_contract_mode = 'core_items'
        rows = [line.strip() for line in mapping_match.group('body').splitlines() if line.strip().startswith('|')]
        if len(rows) >= 2:
            mapping_columns_present = [cell.strip() for cell in rows[0].strip('|').split('|')]
            mapping_rows = parse_markdown_table(rows)
        else:
            issues.append(f'{mapping_match.group("title")}存在，但缺少表头或数据行')
    else:
        issues.append('缺少“讲义核心内容映射”“讲义证据单元映射”或“证据单元升级决策表”章节')

    if mapping_contract_mode == 'evidence_units':
        required_mapping_columns = evidence_mapping_columns
    elif mapping_contract_mode == 'upgrade_table':
        required_mapping_columns = upgrade_decision_columns
    else:
        required_mapping_columns = core_mapping_columns
    missing_mapping_columns = [
        column for column in required_mapping_columns if column not in mapping_columns_present
    ]
    if missing_mapping_columns:
        issues.append(f'讲义映射合同缺少列：{", ".join(missing_mapping_columns)}')

    step_pattern = re.compile(
        r'^##\s+(?:步骤\s+|step-)[0-9]+｜.*?(?=^##\s+(?:步骤\s+|step-)[0-9]+｜|\Z)',
        re.MULTILINE | re.DOTALL,
    )
    step_static_blocks_missing: list[str] = []
    step_upgrade_blocks_missing: list[str] = []
    step_reading_order_missing: list[str] = []
    for step_block in step_pattern.finditer(text):
        block = step_block.group(0)
        title_line = block.splitlines()[0].strip()
        if '静态承载内容' not in block and '固定内容' not in block and '固定证据' not in block:
            step_static_blocks_missing.append(title_line)
        if '互动升级点' not in block and '互动与反馈' not in block:
            step_upgrade_blocks_missing.append(title_line)
        if mapping_contract_mode == 'evidence_units' and '主阅读顺序' not in block:
            step_reading_order_missing.append(title_line)

    if step_static_blocks_missing:
        issues.append(f'以下步骤缺少“静态承载内容”：{", ".join(step_static_blocks_missing)}')
    if step_upgrade_blocks_missing:
        issues.append(f'以下步骤缺少“互动升级点”：{", ".join(step_upgrade_blocks_missing)}')
    if step_reading_order_missing:
        issues.append(f'以下步骤缺少“主阅读顺序”：{", ".join(step_reading_order_missing)}')

    handout_headings = extract_markdown_headings(handout_path.read_text(encoding='utf-8')) if handout_path.exists() else set()
    step_sections = extract_step_sections(text)
    invalid_handout_anchors: list[str] = []
    missing_target_steps: list[str] = []
    formula_mapping_issues: list[str] = []
    curve_figure_steps_missing_mirror: list[str] = []

    if mapping_contract_mode in {'core_items', 'evidence_units'}:
        for row in mapping_rows:
            handout_anchor = row.get('handout_anchor', '').strip()
            target_step = row.get('target_step', '').strip().strip('`')
            core_item_type = row.get('core_item_type', '').strip()
            evidence_kind = row.get('evidence_kind', '').strip()
            must_appear_content = row.get('must_appear_content', '').strip()
            kind_text = '/'.join(part for part in [core_item_type, evidence_kind] if part)

            for anchor in split_handout_anchor(handout_anchor):
                if handout_headings and anchor not in handout_headings and anchor not in invalid_handout_anchors:
                    invalid_handout_anchors.append(anchor)

            if target_step and target_step not in step_sections and target_step not in missing_target_steps:
                missing_target_steps.append(target_step)
                continue

            if 'curve_figure' in kind_text and target_step and target_step in step_sections:
                if not step_sections[target_step]['has_curve_figure_mirror'] and target_step not in curve_figure_steps_missing_mirror:
                    curve_figure_steps_missing_mirror.append(target_step)

            if 'formula' not in kind_text or not target_step or target_step not in step_sections:
                continue

            static_content = step_sections[target_step]['static']
            static_formulas = extract_formula_tokens(static_content)
            normalized_static_text = normalize_formula_text(static_content)
            required_formulas = extract_formula_tokens(must_appear_content)

            if required_formulas:
                missing_formulas = [
                    formula for formula in required_formulas
                    if not formula_is_covered(formula, static_formulas, normalized_static_text)
                ]
                if missing_formulas:
                    formula_mapping_issues.append(
                        f'步骤 `{target_step}` 的“静态承载内容”未显式覆盖公式型映射：{", ".join(missing_formulas)}'
                    )
            elif not has_latex_formula_markers(static_content):
                formula_mapping_issues.append(
                    f'步骤 `{target_step}` 的“静态承载内容”缺少公式型映射所需的 LaTeX 公式。'
                )

    if invalid_handout_anchors:
        issues.append(f'以下 handout_anchor 未在讲义标题中命中：{", ".join(invalid_handout_anchors)}')
    if missing_target_steps:
        issues.append(f'以下 target_step 未在步骤正文中命中：{", ".join(missing_target_steps)}')
    if formula_mapping_issues:
        issues.extend(formula_mapping_issues)
    if curve_figure_steps_missing_mirror:
        issues.append(f'以下曲线图步骤缺少“曲线互动镜像说明”：{", ".join(curve_figure_steps_missing_mirror)}')

    contract_issues, contract_warnings, contract_summary, contract_required_fields = validate_interactive_contract(
        lesson_id,
        step_sections,
        interactive_contract,
    )
    issues.extend(contract_issues)
    implementation_contract_source, implementation_contract_issues, implementation_contract_summary = build_implementation_contract_check(
        lesson_id,
        interactive_contract,
    )
    issues.extend(implementation_contract_issues)

    curve_figure_steps_missing_contract: list[str] = []
    nested_render_contract_fields_missing: list[str] = []
    payload, _ = load_interactive_contract(interactive_contract)
    if isinstance(payload, dict) and mapping_contract_mode in {'core_items', 'evidence_units'}:
        contract_steps = payload.get('steps')
        required_curve_figure_fields = normalize_optional_required_fields(payload, 'required_curve_figure_fields')
        required_native_figure_fields = normalize_optional_required_fields(payload, 'required_native_figure_fields')
        required_native_table_fields = normalize_optional_required_fields(payload, 'required_native_table_fields')
        if isinstance(contract_steps, dict):
            missing_nested_fields_by_step: dict[str, list[str]] = {}
            for row in mapping_rows:
                target_step = row.get('target_step', '').strip().strip('`')
                evidence_kind = row.get('evidence_kind', '').strip()
                core_item_type = row.get('core_item_type', '').strip()
                kind_text = '/'.join(part for part in [core_item_type, evidence_kind] if part)
                if not target_step:
                    continue
                step_payload = contract_steps.get(target_step)
                if not isinstance(step_payload, dict):
                    continue
                if 'curve_figure' in kind_text and 'interactive_figure_spec' not in step_payload and target_step not in curve_figure_steps_missing_contract:
                    curve_figure_steps_missing_contract.append(target_step)
                missing_nested_fields: list[str] = []
                if 'curve_figure' in kind_text:
                    missing_nested_fields = collect_missing_nested_contract_fields(
                        'interactive_figure_spec',
                        step_payload.get('interactive_figure_spec'),
                        required_curve_figure_fields,
                    )
                elif 'table' in kind_text:
                    missing_nested_fields = collect_missing_nested_contract_fields(
                        'native_table_spec',
                        step_payload.get('native_table_spec'),
                        required_native_table_fields,
                    )
                elif 'figure' in kind_text:
                    missing_nested_fields = collect_missing_nested_contract_fields(
                        'native_figure_spec',
                        step_payload.get('native_figure_spec'),
                        required_native_figure_fields,
                    )

                if missing_nested_fields:
                    existing_fields = missing_nested_fields_by_step.setdefault(target_step, [])
                    for field_name in missing_nested_fields:
                        if field_name not in existing_fields:
                            existing_fields.append(field_name)

            for step_id, field_names in missing_nested_fields_by_step.items():
                issue = f'步骤 `{step_id}` 的互动契约缺少字段：{", ".join(field_names)}'
                issues.append(issue)
                nested_render_contract_fields_missing.extend(field_names)

    if curve_figure_steps_missing_contract:
        issues.append(f'以下曲线图步骤的互动契约缺少 `interactive_figure_spec`：{", ".join(curve_figure_steps_missing_contract)}')

    summary = []
    warnings: list[str] = []
    if not issues:
        if mapping_contract_mode == 'evidence_units':
            summary.append('已覆盖讲义中的核心证据单元、主阅读顺序与曲线图镜像要求。')
        elif mapping_contract_mode == 'upgrade_table':
            summary.append('已识别证据单元升级决策表、混合证据顺序与曲线运行时合同。')
        else:
            summary.append('已覆盖讲义中的核心公式与静态承载内容。')
    else:
        warnings.extend(issues)
    summary.extend(contract_summary)
    summary.extend(implementation_contract_summary)
    warnings.extend(contract_warnings)

    return {
        'lesson_id': lesson_id,
        'source_path': format_repo_path(interactive_page),
        'contract_path': format_repo_path(interactive_contract),
        'implementation_contract_source': implementation_contract_source,
        'contract_required_fields': contract_required_fields,
        'included_in_primary_sources': interactive_page in primary_sources,
        'mapping_contract_mode': mapping_contract_mode,
        'has_core_mapping_section': bool(mapping_match),
        'mapping_columns_present': mapping_columns_present,
        'missing_mapping_columns': missing_mapping_columns,
        'invalid_handout_anchors': invalid_handout_anchors,
        'missing_target_steps': missing_target_steps,
        'formula_mapping_issues': formula_mapping_issues,
        'step_static_blocks_missing': step_static_blocks_missing,
        'step_upgrade_blocks_missing': step_upgrade_blocks_missing,
        'step_reading_order_missing': step_reading_order_missing,
        'curve_figure_steps_missing_mirror': curve_figure_steps_missing_mirror,
        'curve_figure_steps_missing_contract': curve_figure_steps_missing_contract,
        'missing_contract_fields': nested_render_contract_fields_missing,
        'step_contract_issues': contract_issues,
        'implementation_contract_summary': implementation_contract_summary,
        'implementation_contract_issues': implementation_contract_issues,
        'summary': summary,
        'warnings': warnings,
        'missing': issues,
        'issues': issues,
    }


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


def build_runtime_asset_check(lesson_id: str, lesson_dir: Path) -> dict[str, Any]:
    runtime_dir = get_runtime_lesson_dir(lesson_id)
    media_index_filename = f'{lesson_id}-media.md'
    media_index_path = runtime_dir / 'media' / media_index_filename
    ensure_runtime_media_index(media_index_path, lesson_id)

    handout_pdf_source = lesson_dir / 'design' / 'handout.pdf'
    expected_assets = ['handout.pdf', media_index_filename]
    generated_assets: list[str] = []
    missing_assets: list[str] = []

    if handout_pdf_source.exists():
        generated_assets.append('handout.pdf')
    else:
        missing_assets.append('handout.pdf')

    if media_index_path.exists():
        generated_assets.append(media_index_filename)
    else:
        missing_assets.append(media_index_filename)

    return {
        'expected_assets': expected_assets,
        'generated_assets': generated_assets,
        'missing_assets': missing_assets,
        'media_index_path': format_repo_path(media_index_path),
        'handout_pdf_source': format_repo_path(handout_pdf_source) if handout_pdf_source.exists() else None,
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
    interactive_page_check: dict[str, Any],
) -> str:
    reviewed_paths = [format_repo_path(path) for path in primary_sources]
    reviewed_paths.append(
        format_repo_path(get_authoring_lesson_dir(lesson_id) / 'design' / 'boppps.md')
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
    if multimedia_check['formula_contract_issues']:
        multimedia_summary += '\n' + '\n'.join(
            f"- 公式媒体契约异常：{issue}" for issue in multimedia_check['formula_contract_issues']
        )

    interactive_page_lines = []
    for summary in interactive_page_check.get('summary', []):
        interactive_page_lines.append(f'- {summary}')
    for warning in interactive_page_check.get('warnings', []):
        interactive_page_lines.append(f'- {warning}')
    if not interactive_page_lines:
        interactive_page_lines.append(
            '- `interactive-page.md` 已纳入审查，并满足讲义核心内容映射与步骤级“静态承载内容 / 互动升级点”基本契约。'
        )
    interactive_page_summary = '\n'.join(interactive_page_lines)

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
        '## 互动页覆盖审查',
        interactive_page_summary,
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
    interactive_page = get_authoring_lesson_dir(lesson_id) / 'design' / 'interactive-page.md'
    interactive_contract = get_authoring_lesson_dir(lesson_id) / 'design' / 'interactive-contract.yaml'
    handout_pdf = get_authoring_lesson_dir(lesson_id) / 'design' / 'handout.pdf'
    return {
        'lesson_id': lesson_id,
        'unit_type': unit_type,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'primary_sources': [
            format_repo_path(path)
            for path in primary_sources
        ],
        'interactive_page_source': (
            format_repo_path(interactive_page)
            if interactive_page.exists()
            else None
        ),
        'interactive_contract_source': (
            format_repo_path(interactive_contract)
            if interactive_contract.exists()
            else format_repo_path(interactive_contract)
        ),
        'handout_pdf_source': format_repo_path(handout_pdf) if handout_pdf.exists() else None,
        'boppps_source': format_repo_path(get_authoring_lesson_dir(lesson_id) / 'design' / 'boppps.md'),
        'sequence_source': format_repo_path(get_authoring_cards_dir(lesson_id) / 'sequence.json'),
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
    multimedia_check.update(build_runtime_asset_check(lesson_id, lesson_dir))
    multimedia_check['formula_contract_issues'] = validate_formula_media_contract(expected_media, lesson_dir)
    multimedia_check['formula_media'] = [
        item for item in expected_media
        if item.get('formula_mode', 'none') != 'none' or item.get('page_formula_sources')
    ]
    knowledge_check = check_knowledge_cards(lesson_id)
    text_review = build_text_review(lesson_id, primary_sources, boppps_path)
    interactive_page_check = build_interactive_page_check(lesson_id, primary_sources)

    review_dir = ensure_runtime_review_dir(lesson_id)
    write_json(review_dir / 'knowledge-card-check.json', knowledge_check)
    write_json(review_dir / 'multimedia-check.json', multimedia_check)
    write_json(review_dir / 'interactive-page-check.json', interactive_page_check)
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
            interactive_page_check,
        ),
    )

    if args.strict_implementation_contract and interactive_page_check.get('implementation_contract_issues'):
        raise SystemExit(
            'interactive implementation contract drift detected:\n- '
            + '\n- '.join(interactive_page_check['implementation_contract_issues'])
        )

    if not args.skip_export:
        subprocess.run(
            ['python3', str(COURSE_ROOT / 'scripts' / 'export_runtime.py'), lesson_id],
            cwd=str(REPO_ROOT),
            check=True,
        )


if __name__ == '__main__':
    main()
