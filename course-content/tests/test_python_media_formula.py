from __future__ import annotations

import importlib.util
from pathlib import Path

from matplotlib import rcParams


def load_formula_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'python_media_formula.py'
    spec = importlib.util.spec_from_file_location('python_media_formula', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


python_media_formula = load_formula_module()


def test_is_complex_formula_distinguishes_simple_and_latex_heavy_cases():
    assert python_media_formula.is_complex_formula(r'\zeta = 0.4,\ \omega_n = 5') is False
    assert python_media_formula.is_complex_formula(r'\begin{aligned}t_r &= \frac{\pi-\theta}{\omega_d}\end{aligned}') is True


def test_configure_matplotlib_for_formula_svg_sets_svg_safe_defaults():
    font_name = python_media_formula.configure_matplotlib_for_formula_svg(svg_hashsalt='test-python-media-formula')

    assert font_name
    assert rcParams['svg.fonttype'] == 'path'
    assert rcParams['axes.unicode_minus'] is False
    assert rcParams['text.usetex'] is False
