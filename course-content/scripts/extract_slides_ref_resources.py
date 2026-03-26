#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SLIDES_ROOT = REPO_ROOT / 'course-content' / 'slides-ref'
DEFAULT_OUTPUT_ROOT = DEFAULT_SLIDES_ROOT / 'resource-library'

SIMPLE_COMMAND_PATTERN = re.compile(r'\\[A-Za-z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}')
BLOCK_TITLE_PATTERN = re.compile(r'\\begin\{block\}\{([^{}]+)\}')
OVERLAY_COMMAND_PATTERN = re.compile(r'\\(?:onslide|only|uncover)(?:\+?<[^>]+>)?\{([^{}]*)\}')
WRAPPER_COMMANDS = ('alert', 'emph', 'textbf', 'textit', 'textrm', 'textsf', 'texttt', 'text', 'mbox')
BLOCK_PATTERNS = [
    (r'\$\$.*?\$\$', '原始公式代码'),
    (r'\\begin\{tikzpicture\}.*?\\end\{tikzpicture\}', '原始绘图代码'),
    (r'\\begin\{figure\}.*?\\end\{figure\}', '原始图示代码'),
    (r'\\begin\{wrapfigure\}.*?\\end\{wrapfigure\}', '原始图示代码'),
    (r'\\begin\{table\}.*?\\end\{table\}', '原始表格代码'),
    (r'\\begin\{align\*?\}.*?\\end\{align\*?\}', '原始公式代码'),
    (r'\\begin\{equation\*?\}.*?\\end\{equation\*?\}', '原始公式代码'),
    (r'\\begin\{eqnarray\*?\}.*?\\end\{eqnarray\*?\}', '原始公式代码'),
    (r'\\begin\{flalign\*?\}.*?\\end\{flalign\*?\}', '原始公式代码'),
    (r'\\begin\{gather\*?\}.*?\\end\{gather\*?\}', '原始公式代码'),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Extract TeX and PDF slides into a Markdown resource library.')
    parser.add_argument('--slides-root', type=Path, default=DEFAULT_SLIDES_ROOT, help='Source directory of .tex/.pdf slides')
    parser.add_argument('--output-root', type=Path, default=DEFAULT_OUTPUT_ROOT, help='Output directory for extracted markdown resources')
    return parser.parse_args()


def read_text(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def strip_comments(text: str) -> str:
    cleaned: list[str] = []
    for line in text.splitlines():
        if '%' in line:
            prefix, _, _ = line.partition('%')
            cleaned.append(prefix)
        else:
            cleaned.append(line)
    return '\n'.join(cleaned)


def find_first(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text, re.S)
    if not match:
        return None
    return match.group(1).strip()


def extract_document_body(text: str) -> str:
    body = find_first(r'\\begin\{document\}(.*)\\end\{document\}', text)
    return body if body is not None else text


def extract_braced_content(text: str, start_index: int) -> tuple[str, int] | None:
    if start_index >= len(text) or text[start_index] != '{':
        return None
    depth = 0
    for idx in range(start_index, len(text)):
        char = text[idx]
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return text[start_index + 1:idx], idx + 1
    return None


def clean_inline_tex(text: str) -> str:
    inline_math_placeholders: dict[str, str] = {}
    def protect_inline_math(match: re.Match[str]) -> str:
        token = f'__INLINE_MATH_{len(inline_math_placeholders)}__'
        inline_math_placeholders[token] = match.group(0)
        return token

    text = re.sub(r'(?<!\$)\$(?!\$).*?(?<!\$)\$(?!\$)', protect_inline_math, text)
    text = re.sub(r'\\tikz\{.*?\}', '', text, flags=re.S)
    text = re.sub(r'\\(?:vspace|vs)\*?(?:\[[^\]]*\])?\{[^{}]*\}', '', text)
    text = re.sub(r'\\includegraphics(?:\[[^\]]*\])?\{([^{}]+)\}', r'图像引用：\1', text)
    text = re.sub(r'\\example\{([^{}]*)\}\{[^{}]*\}', r'\1', text)
    text = OVERLAY_COMMAND_PATTERN.sub(r'\1', text)
    for command in WRAPPER_COMMANDS:
        text = re.sub(rf'\\{command}\{{([^{{}}]*)\}}', r'\1', text)
    previous = None
    while previous != text:
        previous = text
        text = SIMPLE_COMMAND_PATTERN.sub(r'\1', text)
    text = re.sub(r'\\(?:pause|centering|centerline|small|large|Large|LARGE|huge|Huge|bfseries|itshape|rmfamily|sffamily|ttfamily)\b', '', text)
    text = re.sub(r'\\[A-Za-z]+\*?(?:\[[^\]]*\])?', '', text)
    text = text.replace('~', ' ')
    text = text.replace('{', '').replace('}', '')
    text = re.sub(r'\s+', ' ', text)
    for token, formula in inline_math_placeholders.items():
        text = text.replace(token, formula)
    return text.strip()


def replace_block_titles(text: str) -> str:
    marker = r'\begin{block}'
    pieces: list[str] = []
    cursor = 0
    while True:
        index = text.find(marker, cursor)
        if index == -1:
            pieces.append(text[cursor:])
            break
        pieces.append(text[cursor:index])
        pos = index + len(marker)
        if pos < len(text) and text[pos] == '[':
            optional_end = text.find(']', pos)
            pos = optional_end + 1 if optional_end != -1 else pos
        parsed = extract_braced_content(text, pos)
        if parsed is None:
            pieces.append(marker)
            cursor = pos
            continue
        title, cursor = parsed
        pieces.append(f'**{clean_inline_tex(title)}**')
    return ''.join(pieces)


def tex_to_plain_text(text: str) -> str:
    inline_math_placeholders: dict[str, str] = {}
    def protect_inline_math(match: re.Match[str]) -> str:
        token = f'__INLINE_MATH_{len(inline_math_placeholders)}__'
        inline_math_placeholders[token] = match.group(0)
        return token

    text = re.sub(r'(?<!\$)\$(?!\$).*?(?<!\$)\$(?!\$)', protect_inline_math, text)
    text = text.replace('\\par', '\n\n')
    text = text.replace('\\\\', '\n')
    text = replace_block_titles(text)
    text = re.sub(r'\\end\{block\}', '', text)
    text = re.sub(r'\\example\{([^{}]*)\}\{[^{}]*\}', r'\1', text)
    text = OVERLAY_COMMAND_PATTERN.sub(r'\1', text)
    text = re.sub(r'\\tableofcontents(?:\[[^\]]*\])?', '', text)
    text = re.sub(r'\\(?:pause|titlepage|maketitle)\b', '', text)
    text = re.sub(r'\\lecture\{[^{}]*\}\{[^{}]*\}', '', text)
    text = re.sub(r'\\includeonlylecture\{[^{}]*\}', '', text)
    text = re.sub(r'\\begin\{(?:columns|description|itemize|enumerate|center)\}(?:\[[^\]]*\])?', '', text)
    text = re.sub(r'\\end\{(?:columns|description|itemize|enumerate|center)\}', '', text)
    text = re.sub(r'\\column(?:\[[^\]]*\])?\{[^{}]*\}', '', text)
    text = re.sub(r'\\begin\{wrapfigure\}(?:\[[^\]]*\])?\{[^{}]*\}\{[^{}]*\}', '', text)
    text = re.sub(r'\\end\{wrapfigure\}', '', text)
    text = re.sub(r'\\(?:vspace|vs)\*?(?:\[[^\]]*\])?\{[^{}]*\}', '', text)
    text = re.sub(r'\\item\[(.*?)\]', lambda match: f"- **{clean_inline_tex(match.group(1))}** ", text)
    text = re.sub(r'\\item\b', '- ', text)
    text = re.sub(r'\\caption\{([^{}]*)\}', r'图题：\1', text)
    text = re.sub(r'\\label\{[^{}]*\}', '', text)
    text = re.sub(r'\\includegraphics(?:\[[^\]]*\])?\{([^{}]+)\}', r'图像引用：\1', text)
    previous = None
    while previous != text:
        previous = text
        text = SIMPLE_COMMAND_PATTERN.sub(r'\1', text)
    text = re.sub(r'\\(?:small|large|Large|LARGE|huge|Huge|centering|centerline|bfseries|itshape|rmfamily|sffamily|ttfamily)\b', '', text)
    text = re.sub(r'\\[A-Za-z]+\*?(?:\[[^\]]*\])?', '', text)
    text = text.replace('~', ' ')
    text = text.replace('{', '').replace('}', '')
    text = re.sub(r'\n{3,}', '\n\n', text)
    for token, formula in inline_math_placeholders.items():
        text = text.replace(token, formula)
    lines = [line.rstrip() for line in text.splitlines()]
    return '\n'.join(line for line in lines if line.strip()).strip()


def extract_tex_blocks(frame_body: str) -> tuple[list[str], str]:
    blocks: list[str] = []
    working = frame_body
    for pattern, label in BLOCK_PATTERNS:
        for match in re.finditer(pattern, working, re.S):
            code = match.group(0).strip()
            if label == '原始图示代码':
                body = re.sub(r'\\begin\{wrapfigure\}.*?\}|\\end\{wrapfigure\}', '', code, flags=re.S).strip()
                if not body:
                    continue
            blocks.append(f'**{label}**\n\n```tex\n{code}\n```')
        working = re.sub(pattern, '', working, flags=re.S)
    return blocks, working


def extract_tex_document(tex_source: str, source_name: str) -> str:
    text = extract_document_body(strip_comments(tex_source))
    source_stem = Path(source_name).stem
    title = find_first(r'\\title(?:\[[^\]]*\])?\{([^{}]*)\}', tex_source)
    subtitle = find_first(r'\\subtitle\{([^{}]*)\}', tex_source)

    lines: list[str] = [f'# {source_stem}', '']
    lines.append(f'- 来源文件：`{source_name}`')
    if title:
        lines.append(f'- 课程标题：{clean_inline_tex(title)}')
    if subtitle:
        lines.append(f'- 副标题：{clean_inline_tex(subtitle)}')
    lines.append('')

    token_pattern = re.compile(r'\\section\{([^{}]+)\}|\\subsection\{([^{}]+)\}|\\begin\{frame\}', re.S)

    position = 0
    while True:
        match = token_pattern.search(text, position)
        if not match:
            break
        if match.group(1):
            lines.extend([f'## {match.group(1).strip()}', ''])
            position = match.end()
            continue
        if match.group(2):
            lines.extend([f'### {match.group(2).strip()}', ''])
            position = match.end()
            continue

        frame_pos = match.end()
        if frame_pos < len(text) and text[frame_pos] == '[':
            optional_end = text.find(']', frame_pos)
            frame_pos = optional_end + 1 if optional_end != -1 else frame_pos
        frame_title = '未命名页'
        parsed_title = extract_braced_content(text, frame_pos)
        body_start = frame_pos
        if parsed_title is not None:
            raw_title, body_start = parsed_title
            frame_title = clean_inline_tex(raw_title) or '未命名页'
        frame_end = text.find(r'\end{frame}', body_start)
        if frame_end == -1:
            frame_end = len(text)
        frame_body = text[body_start:frame_end]
        blocks, residual = extract_tex_blocks(frame_body)
        plain = tex_to_plain_text(residual)
        if plain or blocks:
            lines.extend([f'#### 幻灯片：{frame_title}', ''])
            if plain:
                lines.extend([plain, ''])
            if blocks:
                for block in blocks:
                    lines.extend([block, ''])
        position = frame_end + len(r'\end{frame}')

    return '\n'.join(lines).rstrip() + '\n'


def normalize_pdf_text(text: str) -> str:
    text = text.replace('\x00', ' ')
    lines = [line.strip() for line in text.splitlines()]
    collapsed = '\n'.join(line for line in lines if line)
    collapsed = re.sub(r'[ \t]+', ' ', collapsed)
    return collapsed.strip()


def build_pdf_markdown(source_name: str, page_texts: list[str]) -> str:
    source_stem = Path(source_name).stem
    lines: list[str] = [f'# {source_stem}', '']
    lines.append(f'- 来源文件：`{source_name}`')
    lines.append(f'- 页数：{len(page_texts)}')
    lines.append('')

    for idx, page_text in enumerate(page_texts, start=1):
        lines.extend([f'## 第 {idx} 页', ''])
        cleaned = normalize_pdf_text(page_text)
        lines.extend([cleaned or '（本页未提取到可读文本）', ''])

    return '\n'.join(lines).rstrip() + '\n'


def extract_pdf_markdown(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    page_texts = [(page.extract_text() or '') for page in reader.pages]
    return build_pdf_markdown(pdf_path.name, page_texts)


def build_index(manifest: dict[str, object]) -> str:
    outputs = manifest['outputs']
    counts = manifest['counts']
    lines = ['# Slides Ref 资源库', '']
    lines.append(f"- TeX 资源：{counts['tex']} 项")
    lines.append(f"- PDF 资源：{counts['pdf']} 项")
    lines.append('')
    lines.append('本目录面向后续大纲重构、讲义设计和媒体策划，优先提供“可搜索、可引用”的素材索引，而不是最终排版稿。')
    lines.append('')
    lines.append('## TeX 资源')
    lines.append('')
    lines.append('### 老版 TeX 源课件')
    lines.append('')
    for item in outputs['tex']:
        lines.append(f"- `{item['source']}` -> [tex/{item['output']}]({item['tex_link']})")
    lines.append('')
    lines.append('## PDF 资源')
    lines.append('')
    lines.append('### 中文编号系列 PDF')
    lines.append('')
    numbered_pdfs = [item for item in outputs['pdf'] if item['source'][0].isdigit()]
    other_pdfs = [item for item in outputs['pdf'] if not item['source'][0].isdigit()]
    for item in numbered_pdfs:
        lines.append(f"- `{item['source']}` -> [pdf/{item['output']}]({item['pdf_link']})")
    if other_pdfs:
        lines.extend(['', '### 其他 PDF / 编译产物', ''])
        for item in other_pdfs:
            lines.append(f"- `{item['source']}` -> [pdf/{item['output']}]({item['pdf_link']})")
    lines.append('')
    return '\n'.join(lines)


def run_export(slides_root: Path, output_root: Path) -> dict[str, object]:
    slides_root = slides_root.resolve()
    output_root = output_root.resolve()
    tex_root = output_root / 'tex'
    pdf_root = output_root / 'pdf'
    tex_root.mkdir(parents=True, exist_ok=True)
    pdf_root.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, object] = {
        'slides_root': str(slides_root),
        'output_root': str(output_root),
        'counts': {'tex': 0, 'pdf': 0},
        'outputs': {'tex': [], 'pdf': []},
    }

    for tex_path in sorted(slides_root.glob('*.tex')):
        markdown = extract_tex_document(read_text(tex_path), tex_path.name)
        output_name = f'{tex_path.stem}.md'
        output_path = tex_root / output_name
        write_text(output_path, markdown)
        manifest['outputs']['tex'].append({
            'source': tex_path.name,
            'output': output_name,
            'tex_link': f'tex/{output_name}',
        })

    for pdf_path in sorted(slides_root.iterdir()):
        if pdf_path.is_dir() or pdf_path == output_root:
            continue
        if pdf_path.suffix.lower() == '.pdf':
            markdown = extract_pdf_markdown(pdf_path)
            output_name = f'{pdf_path.stem}.md'
        elif pdf_path.name.endswith('.pdf.md'):
            markdown = read_text(pdf_path)
            output_name = pdf_path.name
        else:
            continue
        output_path = pdf_root / output_name
        write_text(output_path, markdown)
        manifest['outputs']['pdf'].append({
            'source': pdf_path.name,
            'output': output_name,
            'pdf_link': f'pdf/{output_name}',
        })

    manifest['counts']['tex'] = len(manifest['outputs']['tex'])
    manifest['counts']['pdf'] = len(manifest['outputs']['pdf'])

    write_text(output_root / 'manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    write_text(output_root / 'index.md', build_index(manifest) + '\n')
    write_text(
        output_root / 'README.md',
        '# Slides Ref 教学资源库\n\n'
        '本目录保存从 `course-content/slides-ref/` 抽取出的 Markdown 参考资源，供大纲重构、讲义撰写和课程内容设计引用。\n\n'
        '## 目录结构\n\n'
        '- `tex/`：从老版 TeX 源课件抽取的 Markdown，尽量保留章节、页标题、文本、公式块和绘图代码。\n'
        '- `pdf/`：从中文系列 PDF 或历史编译产物按页抽取的 Markdown，便于检索主题、术语和例题位置。\n'
        '- `index.md`：总索引，按来源类型分组。\n'
        '- `manifest.json`：机器可读的来源-输出映射。\n\n'
        '## 使用边界\n\n'
        '- TeX 抽取优先保留教学内容，不追求完全还原 Beamer 版式命令。\n'
        '- PDF 抽取以文本检索为主，图示和复杂公式可能只保留局部字符信息。\n'
        '- 该资源库是参考素材库，不替代正式讲义、教案或互动课程成稿。\n',
    )
    return manifest


def main() -> int:
    args = parse_args()
    manifest = run_export(args.slides_root, args.output_root)
    print(
        json.dumps(
            {
                'counts': manifest['counts'],
                'output_root': str(args.output_root),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
