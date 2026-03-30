from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


def load_font_helper_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'pillow_font_fallback.py'
    spec = importlib.util.spec_from_file_location('pillow_font_fallback', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


font_helper = load_font_helper_module()


def test_normalize_math_text_rewrites_unstable_unicode_math_glyphs():
    source = 'b₁ = 0, b₂ ≠ 0；sᵐ 行全零；A(s)=asᵐ⁺¹+bsᵐ⁻¹+⋯；s²、s¹、s⁰ 行'

    normalized = font_helper.normalize_math_text(source)

    assert normalized == 'b1 = 0, b2 ≠ 0；s^m 行全零；A(s)=a s^(m+1)+b s^(m-1)+...；s^2、s^1、s^0 行'


def test_find_unresolved_glyphs_accepts_3_2_card_text_after_normalization():
    primary_font = Path('/System/Library/Fonts/Hiragino Sans GB.ttc')
    fallback_font = Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')
    if not primary_font.exists() or not fallback_font.exists():
        pytest.skip('System CJK fallback fonts are unavailable in this environment')

    text = '\n'.join(
        [
            '劳斯表特殊情况处理方法卡',
            'b₁ = 0, b₂ ≠ 0',
            'sᵐ 行全零',
            'A(s)=asᵐ⁺¹+bsᵐ⁻¹+⋯',
            's²、s¹、s⁰ 行',
            '参数可行域求解流程图',
            '先辨识结构，再进入对应算法',
        ]
    )

    unresolved = font_helper.find_unresolved_glyphs(
        font_helper.normalize_math_text(text),
        [
            font_helper.FontSpec(primary_font, face_index=0),
            font_helper.FontSpec(fallback_font, face_index=0),
        ],
    )

    assert unresolved == set()
