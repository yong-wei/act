#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse
from urllib.request import urlopen


ImageFetcher = Callable[[str], bytes]


class FormulaRef(dict):
    def __init__(
        self,
        *,
        placeholder: str,
        source_url: str,
        relative_path: str,
        scope: str,
        option_key: str | None = None,
    ) -> None:
        super().__init__(
            placeholder=placeholder,
            source_url=source_url,
            relative_path=relative_path,
            scope=scope,
            option_key=option_key,
        )


class RenderedHtml(dict):
    def __init__(self, *, text: str, formulas: list[FormulaRef]) -> None:
        super().__init__(text=text, formulas=formulas)


class FormulaHtmlParser(HTMLParser):
    def __init__(self, scope: str, question_id: str, option_key: str | None = None) -> None:
        super().__init__(convert_charrefs=True)
        self.scope = scope
        self.question_id = question_id
        self.option_key = option_key
        self._chunks: list[str] = []
        self._formulas: list[FormulaRef] = []
        self._counter = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {'p', 'div', 'li'}:
            self._append_block_break()
            return
        if tag == 'br':
            self._chunks.append('\n')
            return
        if tag != 'img':
            return

        attr_map = dict(attrs)
        src = attr_map.get('src')
        if not src:
            return

        self._counter += 1
        file_stem = self.scope if self.option_key is None else f'{self.scope}-{self.option_key}'
        filename = f'{file_stem}-{self._counter:02d}{guess_suffix(src)}'
        relative_path = f'images/{self.question_id}/{filename}'
        placeholder = f'[FORMULA:{filename.rsplit(".", 1)[0]}]'
        self._chunks.append(placeholder)
        self._formulas.append(
            FormulaRef(
                placeholder=placeholder,
                source_url=src,
                relative_path=relative_path,
                scope=self.scope,
                option_key=self.option_key,
            )
        )

    def handle_endtag(self, tag: str) -> None:
        if tag in {'p', 'div', 'li'}:
            self._append_block_break()

    def handle_data(self, data: str) -> None:
        if data:
            self._chunks.append(data)

    def render(self) -> RenderedHtml:
        return RenderedHtml(text=normalize_text(''.join(self._chunks)), formulas=list(self._formulas))

    def _append_block_break(self) -> None:
        if self._chunks and not self._chunks[-1].endswith('\n'):
            self._chunks.append('\n')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Build repair pack for iCourse question bank export.')
    parser.add_argument('--input', required=True, help='Path to exported question bank JSON.')
    parser.add_argument('--output-root', required=True, help='Directory for repair pack output.')
    return parser.parse_args()


def guess_suffix(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix or '.bin'


def normalize_text(text: str) -> str:
    lines = [re.sub(r'\s+', ' ', line).strip() for line in text.splitlines()]
    cleaned = '\n'.join(line for line in lines if line)
    return re.sub(r'\n{3,}', '\n\n', cleaned).strip()


def render_html_fragment(html: str, scope: str, question_id: str, option_key: str | None = None) -> RenderedHtml:
    parser = FormulaHtmlParser(scope=scope, question_id=question_id, option_key=option_key)
    parser.feed(html or '')
    parser.close()
    return parser.render()


def infer_choice_mode(question: dict[str, object], correct_answers: list[str]) -> str:
    type_label = str(question.get('typeLabel') or '').strip().lower()
    type_code = int(question.get('typeCode') or 0)
    if type_label in {'single', 'multiple'}:
        return type_label
    if type_code == 1:
        return 'single'
    if type_code == 2:
        return 'multiple'
    return 'single' if len(correct_answers) <= 1 else 'multiple'


def derive_question_kind(question: dict[str, object]) -> str:
    type_label = str(question.get('typeLabel') or '').strip().lower()
    if type_label in {'single', 'multiple', 'essay', 'fill_blank'}:
        return type_label
    type_code = int(question.get('typeCode') or 0)
    if type_code == 1:
        return 'single'
    if type_code == 2:
        return 'multiple'
    if type_code == 3:
        return 'fill_blank'
    if type_code == 10:
        return 'essay'
    return 'unknown'


def default_image_fetcher(url: str) -> bytes:
    with urlopen(url) as response:
        return response.read()


def question_code(bank_type: str, seq: int) -> str:
    return f'IC-B{bank_type}-{seq:04d}'


def ensure_dirs(output_root: Path) -> None:
    for name in ['drafts', 'images', 'question-manifests']:
        (output_root / name).mkdir(parents=True, exist_ok=True)


def build_question_draft(
    *,
    question_id: str,
    question_kind: str,
    stem_text: str,
    options: list[dict[str, object]],
    correct_answers: list[str],
    choice_mode: str | None,
    source_id: object,
) -> str:
    option_lines = '\n'.join(
        f"- {option['key']}. {option['text']}".rstrip()
        for option in options
    ) or '- 无选项'
    if question_kind == 'single':
        mode_label = '单选题'
    elif question_kind == 'multiple':
        mode_label = '多选题'
    elif question_kind == 'essay':
        mode_label = '主观题'
    elif question_kind == 'fill_blank':
        mode_label = '填空题'
    else:
        mode_label = '未分类题目'
    answers_text = (
        '、'.join(correct_answers)
        if correct_answers
        else ('平台未提供结构化正确答案' if choice_mode is None else '未标注')
    )
    return (
        f'# {question_id}\n\n'
        f'## 题型\n\n'
        f'{mode_label}\n\n'
        f'## 题面\n\n'
        f'{stem_text or "（空）"}\n\n'
        f'## 选项\n\n'
        f'{option_lines}\n\n'
        f'## 正确答案\n\n'
        f'正确答案：{answers_text}\n\n'
        f'## 来源元数据\n\n'
        f'- 平台题目 ID：`{source_id}`\n'
    )


def build_repair_pack(
    *,
    input_path: str | Path,
    output_root: str | Path,
    image_fetcher: ImageFetcher | None = None,
) -> dict[str, object]:
    input_file = Path(input_path)
    output_dir = Path(output_root)
    ensure_dirs(output_dir)
    payload = json.loads(input_file.read_text(encoding='utf-8'))
    source = payload.get('source', {})
    bank_type = str(source.get('bankType', 'unknown'))
    fetcher = image_fetcher or default_image_fetcher
    download_cache: dict[str, bytes] = {}
    question_manifests: list[dict[str, object]] = []
    questions_with_formulas = 0

    for question in payload.get('questions', []):
        seq = int(question.get('seq') or len(question_manifests) + 1)
        current_question_id = question_code(bank_type, seq)
        question_kind = derive_question_kind(question)
        stem = render_html_fragment(str(question.get('titleHtml') or ''), scope='stem', question_id=current_question_id)
        if not stem['text']:
            stem = RenderedHtml(
                text=str(question.get('plainTextTitle') or '').strip(),
                formulas=stem['formulas'],
            )

        option_payloads: list[dict[str, object]] = []
        formulas: list[FormulaRef] = list(stem['formulas'])
        correct_answers: list[str] = []
        for option in question.get('options', []):
            option_key = str(option.get('key') or '').strip() or '?'
            rendered_option = render_html_fragment(
                str(option.get('contentHtml') or ''),
                scope='option',
                question_id=current_question_id,
                option_key=option_key,
            )
            option_text = rendered_option['text'] or str(option.get('contentHtml') or '').strip()
            is_correct = bool(option.get('answer'))
            if is_correct:
                correct_answers.append(option_key)
            option_payloads.append(
                {
                    'key': option_key,
                    'text': option_text,
                    'is_correct': is_correct,
                }
            )
            formulas.extend(rendered_option['formulas'])

        choice_mode = infer_choice_mode(question, correct_answers) if question_kind in {'single', 'multiple'} else None
        if formulas:
            questions_with_formulas += 1

        for formula in formulas:
            image_bytes = download_cache.get(str(formula['source_url']))
            if image_bytes is None:
                image_bytes = fetcher(str(formula['source_url']))
                download_cache[str(formula['source_url'])] = image_bytes
            target = output_dir / str(formula['relative_path'])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(image_bytes)

        question_manifest = {
            'question_id': current_question_id,
            'source_question_id': question.get('id'),
            'seq': seq,
            'type_code': question.get('typeCode'),
            'type_label': question.get('typeLabel'),
            'question_kind': question_kind,
            'choice_mode': choice_mode,
            'correct_answers': correct_answers,
            'formulas': [
                {
                    'placeholder': formula['placeholder'],
                    'source_url': formula['source_url'],
                    'relative_path': formula['relative_path'],
                    'scope': formula['scope'],
                    'option_key': formula['option_key'],
                }
                for formula in formulas
            ],
            'stem_text': stem['text'],
            'options': option_payloads,
        }
        question_manifests.append(question_manifest)

        draft_path = output_dir / 'drafts' / f'{current_question_id}.md'
        draft_path.write_text(
            build_question_draft(
                question_id=current_question_id,
                question_kind=question_kind,
                stem_text=stem['text'],
                options=option_payloads,
                correct_answers=correct_answers,
                choice_mode=choice_mode,
                source_id=question.get('id'),
            ),
            encoding='utf-8',
        )

        manifest_path = output_dir / 'question-manifests' / f'{current_question_id}.json'
        manifest_path.write_text(
            json.dumps(question_manifest, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8',
        )

    manifest = {
        'input_path': str(input_file),
        'question_count': len(question_manifests),
        'downloaded_formula_count': len(download_cache),
        'questions_with_formulas': questions_with_formulas,
        'source': source,
        'questions': [
            {
                'question_id': question_manifest['question_id'],
                'choice_mode': question_manifest['choice_mode'],
                'correct_answers': question_manifest['correct_answers'],
                'formula_count': len(question_manifest['formulas']),
            }
            for question_manifest in question_manifests
        ],
    }
    (output_dir / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    return {'manifest': manifest, 'question_manifests': question_manifests}


def main() -> None:
    args = parse_args()
    result = build_repair_pack(input_path=args.input, output_root=args.output_root)
    print(json.dumps(result['manifest'], ensure_ascii=False))


if __name__ == '__main__':
    main()
