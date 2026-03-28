#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


OBJECTIVE_KINDS = {'single', 'multiple', 'fill_blank'}
SOURCE_PREFIX_RE = re.compile(r'^U\d+\.\s*')
TAG_RULES: tuple[tuple[tuple[str, ...], tuple[str, ...], tuple[str, ...]], ...] = (
    (('奈奎斯特', 'Nyquist', '\\Gamma_{GH}', '负实轴', '围包'), ('频域分析', 'Nyquist稳定判据'), ('frequency',)),
    (('带宽', '对数幅频', '幅频', '相频', 'Bode', 'bode', '伯德', 'L_a(', 'dB/dec', '交接频率'), ('频域分析', 'Bode图', '对数幅频渐近线'), ('frequency',)),
    (('Z变换', '采样', 'E(z)', 'zE(z)', 'z E(z)', 'e(nT)', 'e(NT)'), ('离散系统分析', 'Z变换'), ('discrete',)),
    (('终值定理',), ('终值定理',), ('discrete',)),
    (('反变换', '部分分式', '采样序列'), ('Z反变换',), ('discrete',)),
    (('相角', '\\angle s', 'arctg', '复数', 'a+jb'), ('复数基础', '相角计算'), ('complex',)),
    (('调节时间', '超调', '阻尼比', '时域', '响应速度', 't_s', '\\omega_d', '\\zeta'), ('线性系统的时域分析法',), ('time',)),
    (('阻尼比', '\\zeta'), ('阻尼比',), ('time',)),
    (('调节时间', 't_s'), ('调节时间',), ('time',)),
    (('阻尼振荡频率', '\\omega_d'), ('阻尼振荡频率',), ('time',)),
    (('传递函数', '开环'), ('传递函数',), ()),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Build pure-text objective bank from iCourse repair pack.')
    parser.add_argument('--repair-root', required=True, help='Path to repair pack root.')
    parser.add_argument('--formula-map', required=True, help='Path to curated formula map JSON.')
    parser.add_argument('--output-root', required=True, help='Output directory for objective bank artifacts.')
    parser.add_argument('--bank-slug', default='icourse-bank-bankType4', help='Output file prefix.')
    return parser.parse_args()


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def normalize_text(text: str) -> str:
    return ' '.join(str(text).split())


def dedupe_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            ordered.append(item)
    return ordered


def strip_source_prefix(text: str) -> str:
    return SOURCE_PREFIX_RE.sub('', text.strip(), count=1)


def derive_export_kind(original_kind: str, correct_answers: list[str]) -> str:
    if original_kind == 'fill_blank':
        return 'fill_blank'
    return 'single' if len(correct_answers) <= 1 else 'multiple'


def derive_choice_mode(question_kind: str, correct_answers: list[str]) -> str | None:
    if question_kind == 'fill_blank':
        return None
    return 'single' if len(correct_answers) <= 1 else 'multiple'


def derive_tags_and_domains(
    *,
    stem: str,
    options: list[dict[str, object]],
    question_kind: str,
) -> tuple[list[str], list[str]]:
    corpus = '\n'.join([stem, *(str(option.get('text') or '') for option in options)])
    tags: list[str] = []

    domains: list[str] = []
    for keywords, matched_tags, matched_domains in TAG_RULES:
        if any(keyword in corpus for keyword in keywords):
            tags.extend(matched_tags)
            domains.extend(matched_domains)

    if not tags:
        tags.append('自动控制原理')

    if question_kind == 'single':
        tags.append('单选题')
    elif question_kind == 'multiple':
        tags.append('多选题')
    elif question_kind == 'fill_blank':
        tags.append('填空题')

    return dedupe_keep_order(tags), dedupe_keep_order(domains) or ['general']


def derive_difficulty_seed(
    *,
    question_kind: str,
    domains: list[str],
    tags: list[str],
    formula_count: int,
) -> float:
    difficulty = 0.3 if question_kind == 'fill_blank' else 0.35
    if question_kind == 'multiple':
        difficulty += 0.1
    if len(domains) >= 2:
        difficulty += 0.1
    if any(tag in {'奈奎斯特判据', 'Z变换'} for tag in tags):
        difficulty += 0.1
    if formula_count >= 4:
        difficulty += 0.05
    return round(min(difficulty, 0.8), 2)


def compute_formula_hash(repair_root: Path, formula: dict[str, object]) -> str:
    existing = str(formula.get('hash') or '').strip()
    if existing:
        return existing
    relative_path = str(formula.get('relative_path') or '').strip()
    if not relative_path:
        return ''
    target = repair_root / relative_path
    if not target.exists():
        return ''
    return hashlib.sha256(target.read_bytes()).hexdigest()


def replace_formulas(
    text: str,
    formulas: list[dict[str, object]],
    formula_map: dict[str, dict[str, object]],
    repair_root: Path,
) -> tuple[str, list[dict[str, object]]]:
    rendered = text
    unresolved: list[dict[str, object]] = []
    for formula in formulas:
        placeholder = str(formula.get('placeholder') or '')
        formula_hash = compute_formula_hash(repair_root, formula)
        replacement = ''
        if formula_hash:
            replacement = str(formula_map.get(formula_hash, {}).get('text') or '').strip()
        if replacement:
            rendered = rendered.replace(placeholder, replacement)
        elif placeholder:
            unresolved.append({
                'placeholder': placeholder,
                'hash': formula_hash,
                'relative_path': formula.get('relative_path'),
            })
    return strip_source_prefix(normalize_text(rendered)), unresolved


def build_search_text(entry: dict[str, object]) -> str:
    option_text = ' '.join(str(option.get('text') or '') for option in entry.get('options', []))
    tags = ' '.join(str(tag) for tag in entry.get('knowledge_tags', []))
    answers = ' '.join(str(answer) for answer in entry.get('correct_answers', []))
    domains = ' '.join(str(domain) for domain in entry.get('adaptive_metadata', {}).get('domains', []))
    source_bundle = entry.get('source_bundle') or {}
    source_text = ' '.join(
        str(source_bundle.get(key) or '')
        for key in ('kind', 'platform', 'bank_type')
    )
    return '\n'.join(
        [
            str(entry.get('question_id') or ''),
            str(entry.get('source_question_id') or ''),
            str(entry.get('source_platform') or ''),
            str(entry.get('source_bank_type') or ''),
            str(entry.get('question_kind') or ''),
            str(entry.get('choice_mode') or ''),
            str(entry.get('stem') or ''),
            option_text,
            answers,
            tags,
            domains,
            source_text,
        ]
    )


def build_overview(entries: list[dict[str, object]], bank_slug: str) -> str:
    lines = [
        f'# {bank_slug}',
        '',
        f'- 题目总数：{len(entries)}',
        '',
        '## 题目列表',
        '',
    ]
    for entry in entries:
        lines.append(f"### {entry['question_id']} | {entry['question_kind']} | {entry['choice_mode'] or 'none'}")
        lines.append('')
        lines.append(entry['stem'])
        lines.append('')
        for option in entry.get('options', []):
            lines.append(f"- {option['key']}. {option['text']}")
        if not entry.get('options'):
            lines.append('- 无选项')
        lines.append('')
        lines.append(f"正确答案：{'、'.join(entry.get('correct_answers', [])) if entry.get('correct_answers') else '未提供'}")
        lines.append(f"标签：{'、'.join(entry.get('knowledge_tags', [])) if entry.get('knowledge_tags') else '暂无'}")
        domains = entry.get('adaptive_metadata', {}).get('domains', [])
        lines.append(f"域标签：{'、'.join(domains) if domains else '暂无'}")
        lines.append('')
    return '\n'.join(lines).strip() + '\n'


def build_objective_bank(
    *,
    repair_root: str | Path,
    formula_map_path: str | Path,
    output_root: str | Path,
    bank_slug: str,
) -> dict[str, object]:
    repair_dir = Path(repair_root)
    output_dir = Path(output_root)
    output_dir.mkdir(parents=True, exist_ok=True)
    formula_map = json.loads(Path(formula_map_path).read_text(encoding='utf-8'))

    entries: list[dict[str, object]] = []
    excluded_questions: list[dict[str, object]] = []
    unresolved_formulas: list[dict[str, object]] = []

    for path in sorted((repair_dir / 'question-manifests').glob('*.json')):
        question = json.loads(path.read_text(encoding='utf-8'))
        original_kind = str(question.get('question_kind') or '')
        if original_kind not in OBJECTIVE_KINDS:
            excluded_questions.append({
                'question_id': question.get('question_id'),
                'question_kind': original_kind,
            })
            continue

        formulas = list(question.get('formulas') or [])
        correct_answers = list(question.get('correct_answers') or [])
        question_kind = derive_export_kind(original_kind, correct_answers)
        choice_mode = derive_choice_mode(question_kind, correct_answers)
        stem_formulas = [
            formula
            for formula in formulas
            if str(formula.get('scope') or '') == 'stem'
        ]
        stem_text, stem_unresolved = replace_formulas(
            str(question.get('stem_text') or ''),
            stem_formulas,
            formula_map,
            repair_dir,
        )
        options: list[dict[str, object]] = []
        for option in question.get('options', []):
            option_key = str(option.get('key') or '')
            option_formulas = [
                formula
                for formula in formulas
                if str(formula.get('scope') or '') == 'option' and str(formula.get('option_key') or '') == option_key
            ]
            option_text, option_unresolved = replace_formulas(
                str(option.get('text') or ''),
                option_formulas,
                formula_map,
                repair_dir,
            )
            options.append(
                {
                    'key': option_key,
                    'text': option_text,
                    'is_correct': bool(option.get('is_correct')),
                }
            )
            unresolved_formulas.extend(
                {
                    'question_id': question.get('question_id'),
                    'location': f'option:{option_key}',
                    **item,
                }
                for item in option_unresolved
            )

        unresolved_formulas.extend(
            {
                'question_id': question.get('question_id'),
                'location': 'stem',
                **item,
            }
            for item in stem_unresolved
        )
        knowledge_tags, domains = derive_tags_and_domains(
            stem=stem_text,
            options=options,
            question_kind=question_kind,
        )
        formula_hashes = dedupe_keep_order(
            [compute_formula_hash(repair_dir, formula) for formula in formulas if compute_formula_hash(repair_dir, formula)]
        )
        difficulty_seed = derive_difficulty_seed(
            question_kind=question_kind,
            domains=domains,
            tags=knowledge_tags,
            formula_count=len(formula_hashes),
        )

        entry = {
            'question_id': question.get('question_id'),
            'source_question_id': question.get('source_question_id'),
            'source_platform': 'icourse163',
            'source_bank_type': 4,
            'question_kind': question_kind,
            'choice_mode': choice_mode,
            'stem': stem_text,
            'options': options,
            'correct_answers': correct_answers,
            'correct_answer_count': len(correct_answers),
            'knowledge_tags': knowledge_tags,
            'source_bundle': {
                'kind': 'icourse-bank',
                'platform': 'icourse163',
                'bank_type': 4,
                'source_question_id': question.get('source_question_id'),
            },
            'formula_hashes': formula_hashes,
            'adaptive_metadata': {
                'domains': domains,
                'difficulty_seed': difficulty_seed,
                'review_status': 'verified',
                'formula_text_mode': 'inline-latex',
            },
        }
        entry['search_text'] = build_search_text(entry)
        entries.append(entry)

    jsonl_path = output_dir / f'{bank_slug}.jsonl'
    jsonl_path.write_text(
        ''.join(json.dumps(entry, ensure_ascii=False) + '\n' for entry in entries),
        encoding='utf-8',
    )
    index_payload = {
        'bank_slug': bank_slug,
        'question_count': len(entries),
        'by_kind': {
            kind: sum(1 for entry in entries if entry['question_kind'] == kind)
            for kind in sorted(OBJECTIVE_KINDS)
        },
        'by_choice_mode': {
            mode: sum(1 for entry in entries if entry.get('choice_mode') == mode)
            for mode in ['single', 'multiple']
        },
        'top_tags': [
            {'tag': tag, 'count': count}
            for tag, count in sorted(
                {
                    tag: sum(1 for entry in entries if tag in entry.get('knowledge_tags', []))
                    for tag in dedupe_keep_order([tag for entry in entries for tag in entry.get('knowledge_tags', [])])
                }.items(),
                key=lambda item: (-item[1], item[0]),
            )[:30]
        ],
    }
    write_json(output_dir / f'{bank_slug}.index.json', index_payload)
    (output_dir / f'{bank_slug}.overview.md').write_text(build_overview(entries, bank_slug), encoding='utf-8')
    write_json(
        output_dir / f'{bank_slug}.errors.json',
        {
            'excluded_questions': excluded_questions,
            'unresolved_formulas': unresolved_formulas,
        },
    )
    return {
        'question_count': len(entries),
        'objective_question_count': len(entries),
        'excluded_question_count': len(excluded_questions),
    }


def main() -> None:
    args = parse_args()
    result = build_objective_bank(
        repair_root=args.repair_root,
        formula_map_path=args.formula_map,
        output_root=args.output_root,
        bank_slug=args.bank_slug,
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
