from __future__ import annotations

import importlib.util
from pathlib import Path


def load_module():
    module_path = (
        Path(__file__).resolve().parents[2]
        / '.codex'
        / 'skills'
        / 'lesson'
        / 'scripts'
        / 'render_pdf_review_pages.py'
    )
    spec = importlib.util.spec_from_file_location('render_pdf_review_pages', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


renderer = load_module()


XPDF_HELP = """pdftoppm version 4.05 [www.xpdfreader.com]
Usage: pdftoppm [options] <PDF-file> <PPM-root>
  -f <int>          : first page to print
  -l <int>          : last page to print
  -gray             : generate a grayscale PGM file
"""


POPPLER_HELP = """pdftoppm version 24.08.0
Usage: pdftoppm [options] [PDF-file [PPM-file-prefix]]
  -png              : generate a PNG file
  -jpeg             : generate a JPEG file
  -jpegopt <string> : jpeg options
"""


def test_detect_pdftoppm_formats_distinguishes_xpdf_and_poppler():
    assert renderer.detect_pdftoppm_formats(XPDF_HELP) == set()
    assert renderer.detect_pdftoppm_formats(POPPLER_HELP) == {'jpeg', 'png'}


def test_choose_render_plan_prefers_native_jpeg_when_available():
    plan = renderer.choose_render_plan(
        supported_formats={'jpeg', 'png'},
        requested_format='jpeg',
        has_sips=True,
        has_magick=True,
        has_convert=True,
    )

    assert plan.mode == 'pdftoppm-direct'
    assert plan.output_format == 'jpeg'
    assert plan.converter is None


def test_choose_render_plan_falls_back_to_ppm_plus_sips_for_xpdf():
    plan = renderer.choose_render_plan(
        supported_formats=set(),
        requested_format='jpeg',
        has_sips=True,
        has_magick=True,
        has_convert=True,
    )

    assert plan.mode == 'ppm-plus-converter'
    assert plan.output_format == 'jpeg'
    assert plan.converter == 'sips'


def test_choose_render_plan_falls_back_to_magick_when_sips_missing():
    plan = renderer.choose_render_plan(
        supported_formats=set(),
        requested_format='png',
        has_sips=False,
        has_magick=True,
        has_convert=True,
    )

    assert plan.mode == 'ppm-plus-converter'
    assert plan.output_format == 'png'
    assert plan.converter == 'magick'


def test_choose_render_plan_keeps_ppm_when_no_converter_exists():
    plan = renderer.choose_render_plan(
        supported_formats=set(),
        requested_format='jpeg',
        has_sips=False,
        has_magick=False,
        has_convert=False,
    )

    assert plan.mode == 'ppm-direct'
    assert plan.output_format == 'ppm'
    assert plan.converter is None


def test_build_pdftoppm_output_path_matches_xpdf_numbering():
    output = renderer.build_pdftoppm_output_path(
        root=Path('/tmp/review/page2'),
        page=2,
        output_format='ppm',
    )

    assert output == Path('/tmp/review/page2-000002.ppm')
