#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt


HEADING_SIZES = {
    1: 16,
    2: 13,
    3: 12,
    4: 11,
}


def set_run_font(run, size: int, bold: bool = False, math: bool = False) -> None:
    font_name = 'Arial Unicode MS' if math else 'Microsoft YaHei'
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), font_name)
    run.font.size = Pt(size)
    run.bold = bold


def add_heading(doc: Document, text: str, level: int) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(8 if level > 1 else 0)
    paragraph.paragraph_format.space_after = Pt(6)
    if level == 1:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run(text)
    set_run_font(run, HEADING_SIZES.get(level, 11), bold=True)


def add_paragraph(doc: Document, text: str, *, style: str | None = None, center: bool = False, math: bool = False) -> None:
    paragraph = doc.add_paragraph(style=style)
    paragraph.paragraph_format.space_after = Pt(4)
    if center:
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run(text)
    set_run_font(run, 10 if math else 11, bold=False, math=math)


def add_image(doc: Document, image_path: Path, alt_text: str) -> None:
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run()
    run.add_picture(str(image_path), width=Inches(6.0))
    if alt_text:
        caption = doc.add_paragraph()
        caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
        caption.paragraph_format.space_after = Pt(6)
        caption_run = caption.add_run(alt_text)
        set_run_font(caption_run, 9, bold=False)


def flush_paragraph(doc: Document, buffer: list[str]) -> None:
    if not buffer:
        return
    text = ' '.join(part.strip() for part in buffer if part.strip())
    if text:
        add_paragraph(doc, text)
    buffer.clear()


def render_markdown(markdown: str, output_path: Path, base_dir: Path) -> None:
    doc = Document()

    paragraph_buffer: list[str] = []
    math_buffer: list[str] = []
    in_math = False

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()

        if stripped == '$$':
            flush_paragraph(doc, paragraph_buffer)
            if in_math:
                for math_line in math_buffer:
                    add_paragraph(doc, math_line, center=True, math=True)
                math_buffer.clear()
                in_math = False
            else:
                in_math = True
            continue

        if in_math:
            if stripped:
                math_buffer.append(stripped)
            continue

        if not stripped:
            flush_paragraph(doc, paragraph_buffer)
            continue

        if stripped == '---':
            flush_paragraph(doc, paragraph_buffer)
            doc.add_paragraph()
            continue

        heading_match = re.match(r'^(#{1,4})\s+(.*)$', stripped)
        if heading_match:
            flush_paragraph(doc, paragraph_buffer)
            level = len(heading_match.group(1))
            add_heading(doc, heading_match.group(2), level)
            continue

        image_match = re.match(r'^!\[(.*?)\]\((.*?)\)$', stripped)
        if image_match:
            flush_paragraph(doc, paragraph_buffer)
            alt_text = image_match.group(1) or Path(image_match.group(2)).name
            image_path = (base_dir / image_match.group(2)).resolve()
            if image_path.is_file():
                add_image(doc, image_path, alt_text)
            else:
                add_paragraph(doc, f'[图片缺失] {alt_text}: {image_match.group(2)}')
            continue

        bullet_match = re.match(r'^-\s+(.*)$', stripped)
        if bullet_match:
            flush_paragraph(doc, paragraph_buffer)
            add_paragraph(doc, bullet_match.group(1), style='List Bullet')
            continue

        numbered_match = re.match(r'^\d+\.\s+(.*)$', stripped)
        if numbered_match:
            flush_paragraph(doc, paragraph_buffer)
            add_paragraph(doc, numbered_match.group(1), style='List Number')
            continue

        paragraph_buffer.append(stripped)

    flush_paragraph(doc, paragraph_buffer)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output_path)


def main() -> int:
    parser = argparse.ArgumentParser(description='Export homework markdown to a simple DOCX file.')
    parser.add_argument('markdown_path', help='Input markdown path')
    parser.add_argument('output_path', nargs='?', help='Optional output .docx path')
    args = parser.parse_args()

    markdown_path = Path(args.markdown_path).resolve()
    output_path = Path(args.output_path).resolve() if args.output_path else markdown_path.with_suffix('.docx')
    render_markdown(markdown_path.read_text(encoding='utf-8'), output_path, markdown_path.parent)
    print(output_path)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
