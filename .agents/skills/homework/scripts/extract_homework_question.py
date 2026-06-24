#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


HEADER_RE = re.compile(
    r'^####\s+(T\d+-\d+)\s+\[([CXD])\]\s+([⭐]+)\s+(.+?)$',
    re.MULTILINE,
)

FIELD_MAP = {
    '所属作业': 'assignment',
    '对应模块与单元': 'module_units',
    '题型定位': 'question_positioning',
    '考查能力': 'ability',
    '先备知识': 'prerequisites',
    '禁止使用知识': 'forbidden_knowledge',
    '题目边界': 'boundary',
    '题面构成要求': 'stem_contract',
    '允许参数化': 'parameterization_policy',
    '标准解法范围': 'allowed_methods',
    '评分锚点': 'scoring_anchors',
    '常见误区': 'common_pitfalls',
    '题目梗概': 'synopsis',
    '适合期末的理由': 'why_for_exam',
}

LIST_FIELDS = {
    '先备知识',
    '禁止使用知识',
    '题面构成要求',
    '标准解法范围',
    '评分锚点',
    '常见误区',
}

FIELD_RE = re.compile(
    r'^\*\*(所属作业|对应模块与单元|题型定位|考查能力|先备知识|禁止使用知识|题目边界|题面构成要求|允许参数化|标准解法范围|评分锚点|常见误区|题目梗概|适合期末的理由)\*\*：(?:\s*(.*))?$',
    re.MULTILINE,
)


def extract_question_block(content: str, question_id: str) -> tuple[dict[str, str], str]:
    matches = list(HEADER_RE.finditer(content))
    for index, match in enumerate(matches):
        if match.group(1) != question_id:
            continue
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        block = content[start:end].strip()
        return {
            'question_id': match.group(1),
            'question_type': match.group(2),
            'difficulty': match.group(3),
            'title': match.group(4).strip(),
        }, block
    raise ValueError(f'Question ID not found: {question_id}')


def infer_score_policy(question_id: str, assignment: str) -> dict[str, int | str]:
    match = re.match(r'^T(\d+)-(\d+)$', question_id)
    if not match:
        raise ValueError(f'Unable to infer score policy for question ID: {question_id}')
    homework_number = int(match.group(1))
    question_number = int(match.group(2))
    if assignment == 'HW7' or homework_number == 7:
        policy = 'HW7: 25 + 25 + 50'
        question_score = 25 if question_number <= 2 else 50
    else:
        policy = 'HW1-HW6: 20 + 20 + 20 + 40'
        question_score = 20 if question_number <= 3 else 40
    return {
        'assignment_total_score': 100,
        'assignment_score_policy': policy,
        'question_score': question_score,
    }


def parse_list_value(raw: str) -> list[str]:
    items: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith('- '):
            items.append(stripped[2:].strip())
            continue
        numbered = re.match(r'^\d+\.\s+(.*)$', stripped)
        if numbered:
            items.append(numbered.group(1).strip())
            continue
        items.append(stripped)
    return items


def normalize_field_value(label: str, inline_value: str | None, trailing_block: str) -> str | list[str]:
    parts: list[str] = []
    if inline_value and inline_value.strip():
        parts.append(inline_value.strip())
    trailing = trailing_block.strip()
    if trailing:
        parts.append(trailing)
    raw = '\n'.join(parts).strip()
    if not raw:
        raise ValueError(f'Empty field "{label}" in question block')
    if label in LIST_FIELDS:
        return parse_list_value(raw)
    return raw.replace('\r\n', '\n').strip()


def extract_fields(block: str) -> dict[str, str | list[str]]:
    matches = list(FIELD_RE.finditer(block))
    fields: dict[str, str | list[str]] = {}
    for index, match in enumerate(matches):
        label = match.group(1)
        line_end = block.find('\n', match.end())
        if line_end == -1:
            line_end = len(block)
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(block)
        trailing_block = block[line_end:next_start]
        fields[FIELD_MAP[label]] = normalize_field_value(label, match.group(2), trailing_block)

    missing = [json_key for _, json_key in FIELD_MAP.items() if json_key not in fields]
    if missing:
        raise ValueError(f'Missing fields in question block: {", ".join(missing)}')
    return fields


def build_payload(framework_path: Path, question_id: str) -> dict[str, str]:
    content = framework_path.read_text(encoding='utf-8')
    header, block = extract_question_block(content, question_id)
    fields = extract_fields(block)
    score_policy = infer_score_policy(
        header['question_id'],
        str(fields.get('assignment', '')),
    )
    payload = {
        **header,
        **fields,
        **score_policy,
        'source_excerpt': block,
        'framework_path': str(framework_path),
    }
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Extract a normalized homework-question specification from the framework markdown.',
    )
    parser.add_argument('--framework', required=True, help='Path to homework-framework.md')
    parser.add_argument('--question-id', required=True, help='Question ID, e.g. T3-2')
    args = parser.parse_args()

    framework_path = Path(args.framework).expanduser().resolve()
    if not framework_path.is_file():
        raise FileNotFoundError(f'Framework file not found: {framework_path}')

    payload = build_payload(framework_path, args.question_id.strip())
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write('\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
