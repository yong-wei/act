from __future__ import annotations

import shutil
from pathlib import Path

from matplotlib import font_manager, rcParams


SYSTEM_CJK_FONT_PATHS = [
    Path('/System/Library/Fonts/Hiragino Sans GB.ttc'),
    Path('/System/Library/Fonts/STHeiti Light.ttc'),
]

COMPLEX_FORMULA_TOKENS = (
    r'\begin{',
    r'\left',
    r'\right',
    r'\overset',
    r'\underset',
    r'\operatorname',
    r'\cases',
    r'\matrix',
    '&',
    r'\\',
)


def is_complex_formula(formula: str) -> bool:
    normalized = formula.strip()
    return any(token in normalized for token in COMPLEX_FORMULA_TOKENS)


def tex_toolchain_available() -> bool:
    return any(shutil.which(name) for name in ('latexmk', 'pdflatex', 'xelatex', 'lualatex', 'dvisvgm'))


def choose_formula_mode(formulas: list[str]) -> str:
    if not formulas:
        return 'none'
    return 'svg-latex-engine' if any(is_complex_formula(formula) for formula in formulas) else 'svg-mathtext'


def configure_matplotlib_for_formula_svg(
    *,
    svg_hashsalt: str = 'python-media-formula',
    use_tex: bool = False,
    extra_cjk_paths: list[Path] | None = None,
) -> str:
    candidates = list(extra_cjk_paths or []) + SYSTEM_CJK_FONT_PATHS
    for font_path in candidates:
        if not font_path.exists():
            continue

        font_manager.fontManager.addfont(str(font_path))
        font_name = font_manager.FontProperties(fname=str(font_path)).get_name()
        rcParams['font.family'] = [font_name]
        rcParams['axes.unicode_minus'] = False
        rcParams['svg.fonttype'] = 'path'
        rcParams['svg.hashsalt'] = svg_hashsalt
        rcParams['text.usetex'] = use_tex
        if use_tex:
            rcParams['text.latex.preamble'] = r'\usepackage{amsmath}\usepackage{amssymb}'
        return font_name

    available_paths = ', '.join(str(path) for path in candidates)
    raise FileNotFoundError(f'No system CJK font found. Tried: {available_paths}')
