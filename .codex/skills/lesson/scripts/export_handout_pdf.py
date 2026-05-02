#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
    from PIL import ImageDraw
except ImportError:  # pragma: no cover - optional dependency check at runtime
    Image = None
    ImageDraw = None

MARKDOWN_IMAGE_LINE_RE = re.compile(
    r'^(?P<indent>\s*)!\[(?P<alt>.*?)\]\((?P<src>[^)]+)\)(?P<attrs>\{[^}]*\})?\s*$'
)
MANUAL_FIGURE_CAPTION_RE = re.compile(r'^图\s*[0-9０-９]+\s*[.．、]\s*')
MANUAL_TABLE_CAPTION_RE = re.compile(
    r'^表\s*(?P<number>[0-9０-９]+)\s*[.．、]\s*(?P<title>.*?)(?:\s*(?:\\\{|\{)(?P<attrs>[^}]*)(?:\\\}|\}))?\s*$'
)
FENCED_BLOCK_LINE_RE = re.compile(r'^\s*(?P<fence>`{3,}|~{3,})')
INLINE_CODE_RE = re.compile(r'`[^`\n]*`')
INLINE_MATH_RE = re.compile(r'(?<!\\)\$[^$\n]+\$')
PROTECTED_SEGMENT_TOKEN_RE = re.compile(r'\x00PROTECTED(?P<index>\d+)\x00')
PDF_TABLE_COLS_COMMENT_RE = re.compile(r'^\s*<!--\s*pdf-table-cols:\s*(?P<cols>[0-9.,\s]+)\s*-->\s*$')


def strip_lesson_prefix(stem: str, lesson_id: str) -> str:
    prefix = f"{lesson_id}-"
    if stem.startswith(prefix):
        return stem[len(prefix):]
    return stem


def is_course_summary_asset(target: str, alt_text: str = "") -> bool:
    stem = Path(target).stem.lower()
    return any(token in stem for token in ("cover", "info")) or any(
        token in alt_text for token in ("封面", "信息图")
    )


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
    artifact_stem = strip_lesson_prefix(stem, lesson_id)
    if artifact_stem == "handout":
        return f"单元 {lesson_id} 讲义"
    if artifact_stem == "teacher-handout":
        return f"单元 {lesson_id} 教师课堂讲义"
    return f"单元 {lesson_id} {artifact_stem}"


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


def should_use_full_width_for_image(target: str, alt_text: str = "") -> bool:
    return is_course_summary_asset(target, alt_text)


def append_markdown_attribute(attr_block: str | None, attribute: str) -> str:
    if attr_block:
        inner = attr_block[1:-1].strip()
        if re.search(r"(^|\s)width\s*=", inner):
            return attr_block
        return "{" + (f"{inner} {attribute}" if inner else attribute) + "}"
    return "{" + attribute + "}"


def convert_markdown_width_to_latex(width_value: str) -> str | None:
    normalized = width_value.strip()
    percent_match = re.fullmatch(r"(\d+(?:\.\d+)?)%", normalized)
    if percent_match:
        ratio = float(percent_match.group(1)) / 100.0
        if abs(ratio - 1.0) < 1e-9:
            return r"width=\textwidth"
        ratio_text = f"{ratio:.4f}".rstrip("0").rstrip(".")
        return rf"width={ratio_text}\textwidth"
    return f"width={normalized}" if normalized else None


def collect_markdown_width_overrides(markdown: str) -> dict[str, str]:
    overrides: dict[str, str] = {}
    for line in markdown.splitlines():
        match = MARKDOWN_IMAGE_LINE_RE.match(line)
        if not match:
            continue
        attrs = match.group("attrs")
        if not attrs:
            continue
        width_match = re.search(r'(^|\s)width\s*=\s*("?)([^"\s}]+)\2', attrs[1:-1])
        if not width_match:
            continue
        latex_width = convert_markdown_width_to_latex(width_match.group(3))
        if latex_width:
            overrides[match.group("src")] = latex_width
            source_path = Path(match.group("src"))
            if source_path.suffix.lower() == ".svg":
                overrides[source_path.with_suffix(".pdf").as_posix()] = latex_width
    return overrides


def collect_markdown_table_ratio_overrides(markdown: str) -> dict[str, list[float]]:
    overrides: dict[str, list[float]] = {}
    pattern = re.compile(r"^Table:\s*(?P<title>.*?)(?:\s*\{(?P<attrs>[^}]*)\})?\s*$")
    for line in markdown.splitlines():
        match = pattern.match(line.strip())
        if not match:
            continue
        title = match.group("title").strip()
        _, ratios = parse_table_caption_attrs(match.group("attrs"))
        if title and ratios:
            overrides[title] = ratios
    return overrides


def protect_inline_markdown_segments(line: str) -> tuple[str, list[str]]:
    protected_segments: list[str] = []

    def replace(match: re.Match[str]) -> str:
        protected_segments.append(match.group(0))
        return f"\x00PROTECTED{len(protected_segments) - 1}\x00"

    protected_line = INLINE_CODE_RE.sub(replace, line)
    protected_line = INLINE_MATH_RE.sub(replace, protected_line)
    return protected_line, protected_segments


def restore_protected_segments(line: str, protected_segments: list[str]) -> str:
    def replace(match: re.Match[str]) -> str:
        return protected_segments[int(match.group("index"))]

    return PROTECTED_SEGMENT_TOKEN_RE.sub(replace, line)


def normalize_ascii_quotes_for_markdown_prose(markdown: str) -> tuple[str, list[int]]:
    normalized_lines: list[str] = []
    odd_quote_lines: list[int] = []
    in_fenced_block = False
    active_fence: str | None = None
    in_display_math_block = False

    for line_number, line in enumerate(markdown.splitlines(), start=1):
        stripped = line.strip()

        fence_match = FENCED_BLOCK_LINE_RE.match(line)
        if in_fenced_block:
            normalized_lines.append(line)
            if fence_match and fence_match.group("fence")[0] == active_fence:
                in_fenced_block = False
                active_fence = None
            continue
        if fence_match:
            in_fenced_block = True
            active_fence = fence_match.group("fence")[0]
            normalized_lines.append(line)
            continue

        if in_display_math_block:
            normalized_lines.append(line)
            if stripped == "$$":
                in_display_math_block = False
            continue
        if stripped == "$$":
            in_display_math_block = True
            normalized_lines.append(line)
            continue
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) > 4:
            normalized_lines.append(line)
            continue
        if MARKDOWN_IMAGE_LINE_RE.match(line):
            normalized_lines.append(line)
            continue

        protected_line, protected_segments = protect_inline_markdown_segments(line)
        quote_positions = [idx for idx, char in enumerate(protected_line) if char == '"']
        if not quote_positions:
            normalized_lines.append(line)
            continue

        rebuilt_parts: list[str] = []
        last_index = 0
        pairable_count = len(quote_positions) - (len(quote_positions) % 2)
        for quote_index, position in enumerate(quote_positions):
            rebuilt_parts.append(protected_line[last_index:position])
            if quote_index >= pairable_count:
                rebuilt_parts.append('"')
            elif quote_index % 2 == 0:
                rebuilt_parts.append('“')
            else:
                rebuilt_parts.append('”')
            last_index = position + 1
        rebuilt_parts.append(protected_line[last_index:])

        if len(quote_positions) % 2 == 1:
            odd_quote_lines.append(line_number)

        normalized_lines.append(
            restore_protected_segments("".join(rebuilt_parts), protected_segments)
        )

    normalized = "\n".join(normalized_lines)
    if markdown.endswith("\n"):
        normalized += "\n"
    return normalized, odd_quote_lines


def looks_like_inline_tex_math(content: str) -> bool:
    stripped = content.strip()
    if stripped.startswith(r'\(') and stripped.endswith(r'\)'):
        return True

    tex_markers = (
        r'\times',
        r'\text{',
        r'\omega',
        r'\phi',
        r'\zeta',
        r'\alpha',
        r'\beta',
        r'\le',
        r'\ge',
        r'\approx',
        r'\qquad',
        r'\,',
        r'\%',
        r'^\circ',
    )
    return any(marker in stripped for marker in tex_markers)


def convert_inline_tex_code_spans_to_math(line: str) -> str:
    def replace(match: re.Match[str]) -> str:
        raw = match.group(0)[1:-1]
        if not looks_like_inline_tex_math(raw):
            return match.group(0)

        stripped = raw.strip()
        if stripped.startswith(r'\(') and stripped.endswith(r'\)'):
            stripped = stripped[2:-2].strip()
        return f'${stripped}$'

    return INLINE_CODE_RE.sub(replace, line)


def preprocess_markdown_for_pdf(markdown: str) -> str:
    processed_lines: list[str] = []
    last_nonempty_kind: str | None = None
    table_caption_re = re.compile(r"^(Table:\s*)(?P<title>.*?)(?:\s*\{(?P<attrs>[^}]*)\})?\s*$")
    pending_table_cols: str | None = None

    for line in markdown.splitlines():
        stripped = line.strip()
        pdf_table_cols_match = PDF_TABLE_COLS_COMMENT_RE.match(line)
        if pdf_table_cols_match:
            pending_table_cols = ", ".join(
                part.strip() for part in pdf_table_cols_match.group("cols").split(",") if part.strip()
            )
            continue

        line = convert_inline_tex_code_spans_to_math(line)
        stripped = line.strip()
        image_match = MARKDOWN_IMAGE_LINE_RE.match(line)
        if image_match:
            alt_text = image_match.group("alt")
            source = image_match.group("src")
            attrs = image_match.group("attrs")
            if should_use_full_width_for_image(source, alt_text):
                attrs = append_markdown_attribute(attrs, "width=100%")
            line = (
                f'{image_match.group("indent")}![{alt_text}]({source})'
                f"{attrs or ''}"
            )
            processed_lines.append(line)
            last_nonempty_kind = "image"
            continue

        table_caption_match = table_caption_re.match(line)
        if table_caption_match:
            title = table_caption_match.group('title').strip()
            attrs = table_caption_match.group('attrs')
            if pending_table_cols and not attrs:
                line = f"{table_caption_match.group(1)}{title} {{cols={pending_table_cols}}}"
                pending_table_cols = None
            else:
                line = f"{table_caption_match.group(1)}{title}"
            processed_lines.append(line)
            last_nonempty_kind = "other"
            continue

        manual_table_caption_match = MANUAL_TABLE_CAPTION_RE.match(stripped)
        if manual_table_caption_match:
            if pending_table_cols and not manual_table_caption_match.group("attrs"):
                number = manual_table_caption_match.group("number")
                title = manual_table_caption_match.group("title").strip()
                line = f"表 {number}. {title} {{cols={pending_table_cols}}}"
                pending_table_cols = None
            processed_lines.append(line)
            last_nonempty_kind = "other"
            continue

        pending_table_cols = None
        if stripped and last_nonempty_kind == "image" and MANUAL_FIGURE_CAPTION_RE.match(stripped):
            continue

        processed_lines.append(line)
        if stripped:
            last_nonempty_kind = "other"

    normalized = "\n".join(processed_lines)
    if markdown.endswith("\n"):
        normalized += "\n"
    normalized, odd_quote_lines = normalize_ascii_quotes_for_markdown_prose(normalized)
    if odd_quote_lines:
        joined_lines = ", ".join(str(line_no) for line_no in odd_quote_lines)
        print(
            f"提示：检测到未成对的英文双引号，已保留原样。请复核行号：{joined_lines}",
            file=sys.stderr,
        )
    return normalized


def make_draft_placeholder_image(output_path: Path, title: str, subtitle: str) -> None:
    if Image is None:
        raise SystemExit(
            "缺少依赖：Pillow\n"
            "请先安装后再导出 PDF：\n"
            "  python3 -m pip install Pillow"
        )

    image = Image.new("RGB", (2200, 1240), "white")
    draw = ImageDraw.Draw(image)
    draw.rectangle((80, 80, 2120, 1160), outline="#9aa4b2", width=8)
    draw.rectangle((120, 120, 2080, 1120), outline="#d7dce3", width=2)
    draw.text((180, 260), title, fill="#374151")
    draw.text((180, 420), subtitle, fill="#6b7280")
    draw.text((180, 560), "Draft PDF only. Final handout.pdf requires real asset backfill.", fill="#6b7280")
    image.save(output_path)


def materialize_draft_placeholders(markdown_path: Path, markdown: str) -> tuple[str, Path | None, list[str]]:
    placeholder_dir = markdown_path.with_name(f".{markdown_path.stem}-pdf-placeholders")
    rewritten_lines: list[str] = []
    used_placeholders: list[str] = []

    for line in markdown.splitlines():
        match = MARKDOWN_IMAGE_LINE_RE.match(line)
        if not match:
            rewritten_lines.append(line)
            continue

        source = match.group("src")
        alt_text = match.group("alt")
        source_path = (markdown_path.parent / source).resolve()
        if source_path.exists() or not is_course_summary_asset(source, alt_text):
            rewritten_lines.append(line)
            continue

        placeholder_dir.mkdir(parents=True, exist_ok=True)
        stem = Path(source).stem.lower()
        if "cover" in stem or "封面" in alt_text:
            title = "Cover comic pending"
            subtitle = "Draft export placeholder only"
        else:
            title = "Info graphic pending"
            subtitle = "Draft export placeholder only"

        placeholder_path = placeholder_dir / f"{Path(source).stem}-draft-placeholder.png"
        if not placeholder_path.exists():
            make_draft_placeholder_image(placeholder_path, title, subtitle)

        replacement = placeholder_path.relative_to(markdown_path.parent).as_posix()
        attrs = match.group("attrs") or ""
        rewritten_lines.append(
            f"{match.group('indent')}![{alt_text}]({replacement}){attrs}"
        )
        used_placeholders.append(source)

    rewritten = "\n".join(rewritten_lines)
    if markdown.endswith("\n"):
        rewritten += "\n"
    return rewritten, (placeholder_dir if used_placeholders else None), used_placeholders


def create_preprocessed_markdown(markdown_path: Path, draft_mode: bool = False) -> tuple[Path | None, list[Path], list[str]]:
    original = markdown_path.read_text(encoding="utf-8")
    normalized = preprocess_markdown_for_pdf(original)
    extra_paths: list[Path] = []
    used_placeholders: list[str] = []

    if draft_mode:
        normalized, placeholder_dir, used_placeholders = materialize_draft_placeholders(markdown_path, normalized)
        if placeholder_dir is not None:
            extra_paths.append(placeholder_dir)

    if normalized == original:
        return None, extra_paths, used_placeholders

    temp_path = markdown_path.with_name(f".{markdown_path.stem}-pdf-preprocessed.md")
    temp_path.write_text(normalized, encoding="utf-8")
    return temp_path, extra_paths, used_placeholders


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
        "markdown-smart+raw_tex+tex_math_dollars+pipe_tables",
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
        needs_regeneration = (
            not pdf_path.exists()
            or pdf_path.stat().st_mtime < svg_path.stat().st_mtime
        )
        if needs_regeneration:
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


def normalize_includegraphics_options(option_text: str) -> str:
    tokens = [token.strip() for token in option_text.split(",") if token.strip()]
    filtered_tokens = []
    for token in tokens:
        if token == r"height=\textheight":
            continue
        if token == r"width=1\textwidth":
            filtered_tokens.append(r"width=\textwidth")
            continue
        filtered_tokens.append(token)
    return ",".join(filtered_tokens)


def normalize_ascii_quotes_for_latex(tex_content: str) -> str:
    verbatim_envs = ("Verbatim", "verbatim", "Highlighting", "lstlisting")
    begin_patterns = tuple(rf"\begin{{{name}}}" for name in verbatim_envs)
    end_patterns = tuple(rf"\end{{{name}}}" for name in verbatim_envs)

    normalized_lines: list[str] = []
    in_verbatim = False
    for line in tex_content.splitlines():
        stripped = line.strip()
        if any(pattern in stripped for pattern in begin_patterns):
            in_verbatim = True
            normalized_lines.append(line)
            continue
        if any(pattern in stripped for pattern in end_patterns):
            in_verbatim = False
            normalized_lines.append(line)
            continue

        if in_verbatim:
            normalized_lines.append(line)
            continue

        normalized_lines.append(line.replace('"', r'\textquotedbl{}'))

    normalized = "\n".join(normalized_lines)
    if tex_content.endswith("\n"):
        normalized += "\n"
    return normalized


def build_longtable_spec_from_ratios(ratios: list[float]) -> str | None:
    if not ratios:
        return None
    column_count = len(ratios)
    horizontal_padding = 2 * (column_count - 1)
    columns = [
        (
            r"  >{\raggedright\arraybackslash}p{(\columnwidth - "
            + f"{horizontal_padding}"
            + r"\tabcolsep) * \real{"
            + f"{ratio:.4f}"
            + r"}}"
        )
        for ratio in ratios
    ]
    return "@{}\n" + "\n".join(columns) + "@{}"


def build_rebalanced_longtable_spec(column_count: int) -> str | None:
    if column_count <= 1:
        return None

    if column_count == 2:
        first_ratio = 0.30
    elif column_count == 3:
        first_ratio = 0.22
    elif column_count == 4:
        first_ratio = 0.18
    else:
        first_ratio = 0.14

    usable_ratio = 0.96
    first_ratio = min(first_ratio, usable_ratio - 0.12 * (column_count - 1))
    remaining_ratio = (usable_ratio - first_ratio) / (column_count - 1)
    ratios = [first_ratio] + [remaining_ratio] * (column_count - 1)
    return build_longtable_spec_from_ratios(ratios)


def count_longtable_columns(spec: str) -> int:
    lines = [line.strip() for line in spec.splitlines() if line.strip()]
    begin_index = next(
        (index for index, line in enumerate(lines) if line.startswith(r"\begin{longtable}")),
        None,
    )
    if begin_index is not None:
        collected: list[str] = []
        for line in lines[begin_index:]:
            if line.startswith(r"\caption{") or line.startswith(r"\toprule"):
                break
            collected.append(line)
        joined = "".join(collected)
        joined = re.sub(r'^\\begin\{longtable\}\[\]\{', '', joined)
        joined = re.sub(r'\}\s*$', '', joined)
        spec = joined
    else:
        spec = spec.strip()

    p_count = spec.count("p{")
    if p_count:
        return p_count

    cleaned = re.sub(r'@{[^}]*}', '', spec)
    cleaned = re.sub(r'>\{[^}]*\}', '', cleaned)
    cleaned = re.sub(r'<\{[^}]*\}', '', cleaned)
    return len(re.findall(r'[lcr]', cleaned))


def parse_table_caption_attrs(attrs_text: str | None) -> tuple[str | None, list[float] | None]:
    if not attrs_text:
        return None, None

    label_match = re.search(r'#(tbl:[^\s}]+)', attrs_text)
    label = label_match.group(1) if label_match else None

    cols_match = re.search(r'cols\s*=\s*([0-9.,\s]+)', attrs_text)
    if not cols_match:
        return label, None

    raw_parts = [part.strip() for part in cols_match.group(1).split(",") if part.strip()]
    try:
        ratios = [float(part) for part in raw_parts]
    except ValueError:
        return label, None
    if not ratios or any(ratio <= 0 for ratio in ratios):
        return label, None
    return label, ratios


def split_existing_latex_table_caption(caption_text: str) -> tuple[str, list[float] | None]:
    stripped = caption_text.strip()
    attr_match = re.search(r'(?P<title>.*?)(?:\\\{|{)(?P<attrs>[^}]*)\}?\s*$', stripped)
    if not attr_match:
        return stripped, None

    title = attr_match.group("title").rstrip()
    _, ratios = parse_table_caption_attrs(attr_match.group("attrs"))
    if ratios:
        return title, ratios
    return stripped, None


def rewrite_longtable_preambles(
    tex_content: str,
    table_ratio_overrides: dict[str, list[float]] | None = None,
) -> str:
    lines = tex_content.splitlines(keepends=True)
    rewritten: list[str] = []
    auto_index = 0
    index = 0
    pending_caption: tuple[str, str, list[float] | None] | None = None

    while index < len(lines):
        match = MANUAL_TABLE_CAPTION_RE.match(lines[index].strip())
        if match:
            next_index = index + 1
            while next_index < len(lines) and not lines[next_index].strip():
                next_index += 1

            if next_index < len(lines) and lines[next_index].lstrip().startswith(r"\begin{longtable}"):
                auto_index += 1
                title = re.sub(r"\s*\\\s*$", "", match.group("title").strip())
                label, ratios = parse_table_caption_attrs(match.group("attrs"))
                label = label or f"tbl:auto-{auto_index}"
                pending_caption = (title, label, ratios)
                index = next_index
                continue

        if not lines[index].lstrip().startswith(r"\begin{longtable}"):
            rewritten.append(lines[index])
            index += 1
            continue

        preamble_lines = [lines[index]]
        index += 1
        while index < len(lines) and r"\toprule" not in lines[index]:
            preamble_lines.append(lines[index])
            index += 1

        column_count = count_longtable_columns("".join(preamble_lines))
        custom_ratios = pending_caption[2] if pending_caption else None
        existing_caption_lines = [line for line in preamble_lines[1:] if line.lstrip().startswith(r"\caption{")]
        cleaned_caption_line: str | None = None
        if not custom_ratios and existing_caption_lines and table_ratio_overrides:
            caption_match = re.match(r'\\caption\{(?P<title>.*)\}\\tabularnewline\s*$', existing_caption_lines[0].strip())
            if caption_match:
                caption_title, caption_ratios = split_existing_latex_table_caption(
                    caption_match.group("title").strip()
                )
                cleaned_caption_line = rf"\caption{{{caption_title}}}\tabularnewline"
                custom_ratios = caption_ratios or table_ratio_overrides.get(caption_title)
        elif existing_caption_lines:
            caption_match = re.match(r'\\caption\{(?P<title>.*)\}\\tabularnewline\s*$', existing_caption_lines[0].strip())
            if caption_match:
                caption_title, _ = split_existing_latex_table_caption(
                    caption_match.group("title").strip()
                )
                cleaned_caption_line = rf"\caption{{{caption_title}}}\tabularnewline"
        if custom_ratios and len(custom_ratios) == column_count:
            new_spec = build_longtable_spec_from_ratios(custom_ratios)
        else:
            new_spec = build_rebalanced_longtable_spec(column_count)
        if new_spec:
            rewritten.append(rf"\begin{{longtable}}[]{{{new_spec}}}" + "\n")
            if pending_caption:
                title, label, _ = pending_caption
                rewritten.append(rf"\caption{{{title}}}\label{{{label}}}\\" + "\n")
                pending_caption = None
            else:
                for line in preamble_lines[1:]:
                    if line.lstrip().startswith(r"\caption{"):
                        if cleaned_caption_line:
                            rewritten.append(cleaned_caption_line + "\n")
                        else:
                            rewritten.append(line)
        else:
            for line in preamble_lines:
                if cleaned_caption_line and line.lstrip().startswith(r"\caption{"):
                    rewritten.append(cleaned_caption_line + "\n")
                else:
                    rewritten.append(line)

        if index < len(lines):
            rewritten.append(lines[index])
            index += 1

    return "".join(rewritten)


def rewrite_latex_for_pdf_layout(
    tex_content: str,
    width_overrides: dict[str, str] | None = None,
    table_ratio_overrides: dict[str, list[float]] | None = None,
) -> str:
    tex_content = normalize_ascii_quotes_for_latex(tex_content)
    tex_content = rewrite_longtable_preambles(
        tex_content,
        table_ratio_overrides=table_ratio_overrides,
    )
    tex_content = re.sub(r"\\begin{figure}(?:\[[^\]]*\])?", r"\\begin{figure}[H]", tex_content)
    tex_content = re.sub(
        r"^\s*\\setkeys{Gin}{width=\\maxwidth,height=\\maxheight,keepaspectratio}\s*$",
        "",
        tex_content,
        flags=re.MULTILINE,
    )
    pattern = re.compile(r"\\includegraphics(?P<opts>\[[^\]]*\])?{(?P<target>[^}]+)}")

    def replace(match: re.Match[str]) -> str:
        target = match.group("target")
        options = match.group("opts")
        normalized_options = ""
        if options:
            normalized_options = normalize_includegraphics_options(options[1:-1])
        elif width_overrides:
            normalized_options = width_overrides.get(target, "")
        if not normalized_options and should_use_full_width_for_image(target):
            normalized_options = r"width=\textwidth"
        if not normalized_options:
            normalized_options = r"width=\textwidth"
        if normalized_options:
            return rf"\includegraphics[{normalized_options}]{{{target}}}"
        return rf"\includegraphics{{{target}}}"

    return pattern.sub(replace, tex_content)


def rewrite_latex_file_for_pdf_layout(
    tex_path: Path,
    width_overrides: dict[str, str] | None = None,
    table_ratio_overrides: dict[str, list[float]] | None = None,
) -> None:
    tex_path.write_text(
        rewrite_latex_for_pdf_layout(
            tex_path.read_text(encoding="utf-8"),
            width_overrides=width_overrides,
            table_ratio_overrides=table_ratio_overrides,
        ),
        encoding="utf-8",
    )


def normalize_raster_includes(tex_path: Path) -> Path | None:
    pattern = r"\\includegraphics(?:\[[^\]]*\])?{([^}]+\.(?:png|jpe?g))}"
    content = tex_path.read_text(encoding="utf-8")
    matches = list(dict.fromkeys(re.findall(pattern, content, flags=re.IGNORECASE)))
    if not matches:
        return None

    if Image is None:
        raise SystemExit(
            "缺少依赖：Pillow\n"
            "请先安装后再导出 PDF：\n"
            "  python3 -m pip install Pillow"
        )

    asset_dir = tex_path.parent / f".{tex_path.stem}-assets"
    if asset_dir.exists():
        shutil.rmtree(asset_dir)
    asset_dir.mkdir(parents=True, exist_ok=True)

    rewrite_map: dict[str, str] = {}
    for index, target in enumerate(matches, start=1):
        source_path = (tex_path.parent / target).resolve()
        if not source_path.exists():
            raise SystemExit(f"引用的图片不存在：{source_path}")

        output_name = f"{source_path.stem}-normalized-{index}.pdf"
        output_path = asset_dir / output_name
        with Image.open(source_path) as image:
            rgba_image = image.convert("RGBA")
            flattened = Image.new("RGB", rgba_image.size, "white")
            flattened.paste(rgba_image, mask=rgba_image.getchannel("A"))
            # 统一转为 PDF，避免部分查看器对直接嵌入 PNG/JPEG 的兼容性差异。
            flattened.save(output_path, "PDF", resolution=300.0)

        rewrite_map[target] = f"{asset_dir.name}/{output_name}"

    content = re.sub(
        pattern,
        lambda match: match.group(0).replace(match.group(1), rewrite_map[match.group(1)]),
        content,
        flags=re.IGNORECASE,
    )
    tex_path.write_text(content, encoding="utf-8")
    return asset_dir


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


def cleanup_latex_artifacts(tex_path: Path, extra_paths: list[Path] | None = None) -> None:
    for suffix in (".aux", ".log", ".out", ".toc"):
        artifact = tex_path.with_suffix(suffix)
        if artifact.exists():
            artifact.unlink()
    if tex_path.exists():
        tex_path.unlink()
    for extra_path in extra_paths or []:
        if extra_path.is_dir():
            shutil.rmtree(extra_path, ignore_errors=True)
        elif extra_path.exists():
            extra_path.unlink()


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
    parser.add_argument(
        "--draft-mode",
        action="store_true",
        help="草稿导出模式：允许封面漫画与信息图缺失，并仅在临时目录生成占位图；输出文件名为 *-draft.pdf",
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
    output_pdf = (
        markdown_path.with_name(f"{markdown_path.stem}-draft.pdf")
        if args.draft_mode
        else markdown_path.with_suffix(".pdf")
    )
    style_path = markdown_path.with_name(f"{markdown_path.stem}-pdf-style.tex")
    template_path = Path(__file__).resolve().parent.parent / "templates" / "handout-pdf-style.tex.tpl"
    repo_root = Path(__file__).resolve().parents[4]
    header_logo_left = (repo_root / "public/images/extracted/校徽校名组合-横版-提取.pdf").as_posix()
    header_logo_right = (repo_root / "public/images/CAlogo128.png").as_posix()
    tex_path = markdown_path.with_name(f"{markdown_path.stem}-pandoc-export.tex")
    original_markdown = markdown_path.read_text(encoding="utf-8")
    preprocessed_markdown_path, extra_cleanup_paths, used_placeholders = create_preprocessed_markdown(
        markdown_path,
        draft_mode=args.draft_mode,
    )
    markdown_input_path = preprocessed_markdown_path or markdown_path
    width_overrides = collect_markdown_width_overrides(
        markdown_input_path.read_text(encoding="utf-8")
    )
    table_ratio_overrides = collect_markdown_table_ratio_overrides(original_markdown)

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

    build_latex(markdown_input_path, style_path, tex_path)
    rewrite_svg_includes_to_pdf(tex_path)
    normalized_asset_dir = normalize_raster_includes(tex_path)
    rewrite_latex_file_for_pdf_layout(
        tex_path,
        width_overrides=width_overrides,
        table_ratio_overrides=table_ratio_overrides,
    )
    try:
        compile_pdf_from_tex(tex_path, output_pdf)
    except Exception:
        raise
    else:
        cleanup_latex_artifacts(
            tex_path,
            extra_paths=[
                path
                for path in (normalized_asset_dir, preprocessed_markdown_path, *extra_cleanup_paths)
                if path is not None
            ] or None,
        )

    print(f"PDF 导出完成：{output_pdf}")
    print(f"样式文件：{style_path}")
    if used_placeholders:
        joined = "、".join(used_placeholders)
        print(f"提示：本次为草稿导出，以下图片使用了临时占位，不会回写媒体目录：{joined}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"pandoc/xelatex 导出失败，退出码：{exc.returncode}", file=sys.stderr)
        raise
