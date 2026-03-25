#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(
            f"缺少依赖：{name}\n"
            "请先安装对应工具后再导出 PDF。macOS 推荐：\n"
            "  brew install pandoc librsvg\n"
            "并确认 TeX Live / xelatex 已可用。"
        )
    return path


def derive_lesson_id(markdown_path: Path) -> str:
    parts = markdown_path.parts
    if "lessons" in parts:
        idx = parts.index("lessons")
        if idx + 1 < len(parts):
            lesson_id = parts[idx + 1]
            if lesson_id not in {"legacy", "design"}:
                return lesson_id
    return "未命名单元"


def derive_right_header(stem: str, lesson_id: str) -> str:
    if stem == "handout":
        return f"单元 {lesson_id} 讲义"
    if stem == "teacher-handout":
        return f"单元 {lesson_id} 教师课堂讲义"
    return f"单元 {lesson_id} {stem}"


def derive_pdf_title(markdown_path: Path) -> str:
    for line in markdown_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return markdown_path.stem


def render_style(
    template_path: Path,
    output_path: Path,
    header_left: str,
    header_right: str,
    pdf_title: str,
) -> None:
    content = template_path.read_text(encoding="utf-8")
    content = content.replace("__HEADER_LEFT__", header_left)
    content = content.replace("__HEADER_RIGHT__", header_right)
    content = content.replace("__PDF_TITLE__", pdf_title)
    output_path.write_text(content, encoding="utf-8")


def run_pandoc(markdown_path: Path, style_path: Path, output_pdf: Path) -> None:
    cmd = [
        require_binary("pandoc"),
        markdown_path.name,
        "-o",
        output_pdf.name,
        "--from",
        "markdown+tex_math_dollars",
        "--pdf-engine",
        require_binary("xelatex"),
        "-H",
        style_path.name,
        "-V",
        "documentclass=article",
        "-V",
        "classoption=11pt",
    ]
    subprocess.run(cmd, cwd=markdown_path.parent, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="把讲义 Markdown 稳定导出为同目录 PDF。")
    parser.add_argument("markdown", help="要导出的 Markdown 文件路径，例如 handout.md 或 teacher-handout.md")
    parser.add_argument("--header-left", default="自动控制原理", help="页眉左侧文字")
    parser.add_argument("--header-right", help="页眉右侧文字；默认按文件名与单元号自动生成")
    parser.add_argument("--pdf-title", help="PDF 元数据标题；默认读取文档一级标题")
    parser.add_argument(
        "--refresh-style",
        action="store_true",
        help="无论目标样式文件是否已存在，都用技能模板重新生成",
    )
    args = parser.parse_args()

    markdown_path = Path(args.markdown).resolve()
    if not markdown_path.exists():
        raise SystemExit(f"Markdown 文件不存在：{markdown_path}")
    if markdown_path.suffix.lower() != ".md":
        raise SystemExit("只支持导出 .md 文件。")

    require_binary("rsvg-convert")

    lesson_id = derive_lesson_id(markdown_path)
    header_right = args.header_right or derive_right_header(markdown_path.stem, lesson_id)
    pdf_title = args.pdf_title or derive_pdf_title(markdown_path)
    output_pdf = markdown_path.with_suffix(".pdf")
    style_path = markdown_path.with_name(f"{markdown_path.stem}-pdf-style.tex")
    template_path = Path(__file__).resolve().parent.parent / "templates" / "handout-pdf-style.tex.tpl"

    if args.refresh_style or not style_path.exists():
        render_style(template_path, style_path, args.header_left, header_right, pdf_title)

    run_pandoc(markdown_path, style_path, output_pdf)

    print(f"PDF 导出完成：{output_pdf}")
    print(f"样式文件：{style_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"pandoc/xelatex 导出失败，退出码：{exc.returncode}", file=sys.stderr)
        raise
