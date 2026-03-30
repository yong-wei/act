from pathlib import Path
import sys

COURSE_CONTENT_ROOT = Path(__file__).resolve().parents[5]
if str(COURSE_CONTENT_ROOT / 'scripts') not in sys.path:
    sys.path.insert(0, str(COURSE_CONTENT_ROOT / 'scripts'))

from python_media_formula import configure_matplotlib_for_formula_svg  # noqa: E402


def configure_matplotlib_for_cjk() -> str:
    return configure_matplotlib_for_formula_svg(svg_hashsalt='lesson-2-2-system-font', use_tex=False)
