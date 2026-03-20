from pathlib import Path

from matplotlib import font_manager, rcParams


SYSTEM_CJK_FONT_PATHS = [
    Path('/System/Library/Fonts/Hiragino Sans GB.ttc'),
    Path('/System/Library/Fonts/STHeiti Light.ttc'),
]


def configure_matplotlib_for_cjk() -> str:
    for font_path in SYSTEM_CJK_FONT_PATHS:
        if not font_path.exists():
            continue

        font_manager.fontManager.addfont(str(font_path))
        font_name = font_manager.FontProperties(fname=str(font_path)).get_name()
        rcParams['font.family'] = [font_name]
        rcParams['axes.unicode_minus'] = False
        rcParams['svg.fonttype'] = 'path'
        rcParams['svg.hashsalt'] = 'l2b-system-font'
        return font_name

    available_paths = ', '.join(str(path) for path in SYSTEM_CJK_FONT_PATHS)
    raise FileNotFoundError(f'No system CJK font found. Tried: {available_paths}')
