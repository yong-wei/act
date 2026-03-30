from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from PIL import ImageDraw, ImageFont
from fontTools.ttLib import TTCollection, TTFont


class FontSpec:
    __slots__ = ('path', 'face_index')

    def __init__(self, path: Path | str, face_index: int = 0) -> None:
        self.path = Path(path)
        self.face_index = face_index

    def __repr__(self) -> str:
        return f'FontSpec(path={self.path!r}, face_index={self.face_index!r})'


UNSTABLE_GLYPH_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ('asᵐ⁺¹', 'a s^(m+1)'),
    ('bsᵐ⁻¹', 'b s^(m-1)'),
    ('sᵐ⁺¹', 's^(m+1)'),
    ('sᵐ⁻¹', 's^(m-1)'),
    ('b₁', 'b1'),
    ('b₂', 'b2'),
    ('sᵐ', 's^m'),
    ('s²', 's^2'),
    ('s¹', 's^1'),
    ('s⁰', 's^0'),
    ('⋯', '...'),
)


def normalize_math_text(text: str) -> str:
    normalized = text
    for source, target in UNSTABLE_GLYPH_REPLACEMENTS:
        normalized = normalized.replace(source, target)
    return normalized


@lru_cache(maxsize=None)
def _load_cmap(path_str: str, face_index: int) -> frozenset[int]:
    path = Path(path_str)
    if not path.exists():
        return frozenset()

    if path.suffix.lower() == '.ttc':
        font = TTCollection(str(path)).fonts[face_index]
    else:
        font = TTFont(str(path))

    cmap: set[int] = set()
    for table in font['cmap'].tables:
        cmap.update(table.cmap)
    return frozenset(cmap)


def find_unresolved_glyphs(text: str, font_specs: list[FontSpec]) -> set[str]:
    coverage: set[int] = set()
    for spec in font_specs:
        coverage.update(_load_cmap(str(spec.path), spec.face_index))

    unresolved = {
        char
        for char in text
        if not char.isspace() and ord(char) not in coverage
    }
    return unresolved


def _font_exists(spec: FontSpec) -> bool:
    return spec.path.exists()


def choose_cjk_font_specs(bold: bool = False) -> list[FontSpec]:
    if bold:
        return [
            FontSpec(Path('/System/Library/Fonts/STHeiti Medium.ttc'), face_index=1),
            FontSpec(Path('/System/Library/Fonts/Hiragino Sans GB.ttc'), face_index=2),
            FontSpec(Path('/System/Library/Fonts/STHeiti Light.ttc'), face_index=1),
        ]
    return [
        FontSpec(Path('/System/Library/Fonts/STHeiti Light.ttc'), face_index=1),
        FontSpec(Path('/System/Library/Fonts/Hiragino Sans GB.ttc'), face_index=0),
        FontSpec(Path('/System/Library/Fonts/STHeiti Medium.ttc'), face_index=1),
    ]


def choose_symbol_font_specs(bold: bool = False) -> list[FontSpec]:
    del bold
    return [
        FontSpec(Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')),
        FontSpec(Path('/Library/Fonts/Arial Unicode.ttf')),
        FontSpec(Path('/System/Library/Fonts/Apple Symbols.ttf')),
    ]


def load_font_from_specs(specs: list[FontSpec], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for spec in specs:
        if not _font_exists(spec):
            continue
        try:
            return ImageFont.truetype(str(spec.path), size=size, index=spec.face_index)
        except Exception:
            continue
    return ImageFont.load_default()


def _choose_font_for_char(
    char: str,
    primary_specs: list[FontSpec],
    fallback_specs: list[FontSpec],
    primary_font: ImageFont.ImageFont,
    fallback_font: ImageFont.ImageFont,
) -> ImageFont.ImageFont:
    codepoint = ord(char)
    for spec in primary_specs:
        if codepoint in _load_cmap(str(spec.path), spec.face_index):
            return primary_font
    for spec in fallback_specs:
        if codepoint in _load_cmap(str(spec.path), spec.face_index):
            return fallback_font
    return primary_font


def draw_text_with_fallback(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    primary_font: ImageFont.ImageFont,
    fallback_font: ImageFont.ImageFont,
    fill: str,
    primary_specs: list[FontSpec],
    fallback_specs: list[FontSpec],
    line_gap: int = 0,
) -> int:
    x, y = xy
    for line in text.splitlines():
        cursor_x = x
        for char in line:
            font = _choose_font_for_char(char, primary_specs, fallback_specs, primary_font, fallback_font)
            draw.text((cursor_x, y), char, font=font, fill=fill)
            cursor_x += font.getlength(char)
        y += max(primary_font.size, fallback_font.size) + line_gap
    return y
