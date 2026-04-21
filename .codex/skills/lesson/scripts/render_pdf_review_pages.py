#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import NamedTuple


class RenderPlan(NamedTuple):
    mode: str
    output_format: str
    converter: str | None = None


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f'缺少依赖：{name}')
    return path


def detect_pdftoppm_formats(help_text: str) -> set[str]:
    formats: set[str] = set()
    for output_format in ('png', 'jpeg'):
        if re.search(rf'(^|\n)\s*-{output_format}\b', help_text):
            formats.add(output_format)
    return formats


def choose_render_plan(
    supported_formats: set[str],
    requested_format: str,
    has_sips: bool,
    has_magick: bool,
    has_convert: bool,
) -> RenderPlan:
    if requested_format in supported_formats:
        return RenderPlan(mode='pdftoppm-direct', output_format=requested_format)

    if has_sips:
        return RenderPlan(mode='ppm-plus-converter', output_format=requested_format, converter='sips')
    if has_magick:
        return RenderPlan(mode='ppm-plus-converter', output_format=requested_format, converter='magick')
    if has_convert:
        return RenderPlan(mode='ppm-plus-converter', output_format=requested_format, converter='convert')

    return RenderPlan(mode='ppm-direct', output_format='ppm')


def build_pdftoppm_output_path(root: Path, page: int, output_format: str) -> Path:
    suffix_map = {
        'ppm': '.ppm',
        'png': '.png',
        'jpeg': '.jpg',
    }
    if output_format not in suffix_map:
        raise ValueError(f'Unsupported output format: {output_format}')
    return root.with_name(f'{root.name}-{page:06d}{suffix_map[output_format]}')


def read_pdftoppm_help(pdftoppm_path: str) -> str:
    result = subprocess.run(
        [pdftoppm_path, '-h'],
        check=False,
        capture_output=True,
        text=True,
    )
    return '\n'.join(part for part in (result.stdout, result.stderr) if part)


def run_quietly(command: list[str]) -> None:
    result = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        details = '\n'.join(part.strip() for part in (result.stdout, result.stderr) if part.strip())
        raise SystemExit(f'命令失败：{" ".join(command)}\n{details}')


def convert_ppm_image(source_path: Path, output_path: Path, converter: str) -> None:
    if converter == 'sips':
        run_quietly(
            [require_binary('sips'), '-s', 'format', output_path.suffix[1:], str(source_path), '--out', str(output_path)],
        )
        return

    run_quietly(
        [require_binary(converter), str(source_path), str(output_path)],
    )


def render_pdf_review_page(
    pdf_path: Path,
    page: int,
    requested_format: str,
    output_dir: Path,
    dpi: int,
    render_plan: RenderPlan,
    pdftoppm_path: str,
) -> Path:
    output_root = output_dir / f'{pdf_path.stem}-page-{page}'
    output_dir.mkdir(parents=True, exist_ok=True)

    if render_plan.mode == 'pdftoppm-direct':
        run_quietly(
            [
                pdftoppm_path,
                f'-{render_plan.output_format}',
                '-r',
                str(dpi),
                '-f',
                str(page),
                '-l',
                str(page),
                str(pdf_path),
                str(output_root),
            ]
        )
        return build_pdftoppm_output_path(output_root, page, render_plan.output_format)

    run_quietly(
        [
            pdftoppm_path,
            '-r',
            str(dpi),
            '-f',
            str(page),
            '-l',
            str(page),
            str(pdf_path),
            str(output_root),
        ]
    )
    ppm_path = build_pdftoppm_output_path(output_root, page, 'ppm')

    if render_plan.mode == 'ppm-direct':
        return ppm_path

    converted_path = output_root.with_name(f'{output_root.name}-{page:06d}.{render_plan.output_format}')
    convert_ppm_image(ppm_path, converted_path, render_plan.converter or '')
    return converted_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='把 PDF 指定页渲染成便于人工抽查的图片。')
    parser.add_argument('pdf', type=Path, help='待抽查的 PDF 路径')
    parser.add_argument('--pages', type=int, nargs='+', required=True, help='要渲染的页码，使用 1 基编号')
    parser.add_argument(
        '--format',
        choices=('jpeg', 'png'),
        default='jpeg',
        help='期望输出格式；脚本会按本机能力自动降级',
    )
    parser.add_argument('--dpi', type=int, default=150, help='渲染 DPI，默认 150')
    parser.add_argument('--output-dir', type=Path, help='输出目录；默认写入临时目录')
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = args.pdf.resolve()
    if not pdf_path.exists():
        raise SystemExit(f'PDF 不存在：{pdf_path}')

    pdftoppm_path = require_binary('pdftoppm')
    help_text = read_pdftoppm_help(pdftoppm_path)
    supported_formats = detect_pdftoppm_formats(help_text)
    render_plan = choose_render_plan(
        supported_formats=supported_formats,
        requested_format=args.format,
        has_sips=shutil.which('sips') is not None,
        has_magick=shutil.which('magick') is not None,
        has_convert=shutil.which('convert') is not None,
    )

    output_dir = args.output_dir
    if output_dir is None:
        output_dir = Path(tempfile.mkdtemp(prefix=f'{pdf_path.stem}-review-'))

    print(
        f'PDF 抽查渲染方案：mode={render_plan.mode}, '
        f'output={render_plan.output_format}, '
        f'converter={render_plan.converter or "none"}, '
        f'output_dir={output_dir}'
    )
    for page in args.pages:
        if page <= 0:
            raise SystemExit(f'页码必须从 1 开始：{page}')
        output_path = render_pdf_review_page(
            pdf_path=pdf_path,
            page=page,
            requested_format=args.format,
            output_dir=output_dir,
            dpi=args.dpi,
            render_plan=render_plan,
            pdftoppm_path=pdftoppm_path,
        )
        print(f'page {page}: {output_path}')


if __name__ == '__main__':
    main()
