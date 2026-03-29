#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
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
    header_logo_left: str,
    header_logo_right: str,
) -> None:
    content = template_path.read_text(encoding="utf-8")
    content = content.replace("__HEADER_LEFT__", header_left)
    content = content.replace("__HEADER_RIGHT__", header_right)
    content = content.replace("__PDF_TITLE__", pdf_title)
    content = content.replace("__HEADER_LOGO_LEFT__", header_logo_left)
    content = content.replace("__HEADER_LOGO_RIGHT__", header_logo_right)
    output_path.write_text(content, encoding="utf-8")


def build_latex(markdown_path: Path, style_path: Path, output_tex: Path) -> None:
    cmd = [
        require_binary("pandoc"),
        markdown_path.name,
        "-o",
        output_tex.name,
        "--standalone",
        "--to",
        "latex",
        "--from",
        "markdown+raw_tex+tex_math_dollars+pipe_tables",
        "--citeproc",
        "-H",
        style_path.name,
        "-V",
        "documentclass=article",
        "-V",
        "classoption=11pt",
    ]
    subprocess.run(cmd, cwd=markdown_path.parent, check=True)


def rewrite_svg_includes_to_pdf(tex_path: Path) -> None:
    content = tex_path.read_text(encoding="utf-8")
    matches = re.findall(r"\\includesvg(?:\[[^\]]*\])?{([^}]+)\.svg}", content)
    if not matches:
        return

    rsvg_convert = require_binary("rsvg-convert")
    for base in matches:
        svg_path = (tex_path.parent / f"{base}.svg").resolve()
        pdf_path = svg_path.with_suffix(".pdf")
        if not pdf_path.exists():
            subprocess.run(
                [rsvg_convert, "-f", "pdf", "-o", str(pdf_path), str(svg_path)],
                check=True,
                cwd=tex_path.parent,
            )

    content = re.sub(
        r"\\includesvg(?:\[[^\]]*\])?{([^}]+)\.svg}",
        lambda m: rf"\includegraphics{{{m.group(1)}.pdf}}",
        content,
    )
    tex_path.write_text(content, encoding="utf-8")


def xelatex_log_has_unresolved_refs(log_text: str) -> bool:
    patterns = [
        r"undefined references",
        r"Reference `[^`]+` .* undefined",
        r"There were undefined references",
        r"Label\(s\) may have changed",
    ]
    return any(re.search(pattern, log_text) for pattern in patterns)


def compile_pdf_from_tex(tex_path: Path, output_pdf: Path) -> None:
    xelatex = require_binary("xelatex")
    cwd = tex_path.parent
    log_path = tex_path.with_suffix(".log")

    for _ in range(3):
        cmd = [
            xelatex,
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-shell-escape",
            tex_path.name,
        ]
        try:
            subprocess.run(cmd, cwd=cwd, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        except subprocess.CalledProcessError as exc:
            log_excerpt = log_path.read_text(encoding="utf-8", errors="ignore")[-4000:] if log_path.exists() else exc.stdout[-4000:]
            raise SystemExit(f"xelatex 编译失败，日志摘录：\n{log_excerpt}") from exc
        log_text = log_path.read_text(encoding="utf-8", errors="ignore") if log_path.exists() else ""
        if not xelatex_log_has_unresolved_refs(log_text):
            break

    generated_pdf = tex_path.with_suffix(".pdf")
    if not generated_pdf.exists():
        raise SystemExit(f"未生成 PDF：{generated_pdf}")
    if generated_pdf.resolve() != output_pdf.resolve():
        generated_pdf.replace(output_pdf)


def cleanup_latex_artifacts(tex_path: Path) -> None:
    for suffix in (".aux", ".log", ".out", ".toc"):
        artifact = tex_path.with_suffix(suffix)
        if artifact.exists():
            artifact.unlink()
    if tex_path.exists():
        tex_path.unlink()


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
    repo_root = Path(__file__).resolve().parents[4]
    header_logo_left = (repo_root / "public/images/extracted/校徽校名组合-横版-提取.pdf").as_posix()
    header_logo_right = (repo_root / "public/images/CAlogo128.png").as_posix()
    tex_path = markdown_path.with_name(f"{markdown_path.stem}-pandoc-export.tex")

    if args.refresh_style or not style_path.exists():
        render_style(
            template_path,
            style_path,
            args.header_left,
            header_right,
            pdf_title,
            header_logo_left,
            header_logo_right,
        )

    build_latex(markdown_path, style_path, tex_path)
    rewrite_svg_includes_to_pdf(tex_path)
    try:
        compile_pdf_from_tex(tex_path, output_pdf)
    except Exception:
        raise
    else:
        cleanup_latex_artifacts(tex_path)

    print(f"PDF 导出完成：{output_pdf}")
    print(f"样式文件：{style_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"pandoc/xelatex 导出失败，退出码：{exc.returncode}", file=sys.stderr)
        raise
