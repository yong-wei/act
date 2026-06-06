from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT / ".agents/skills/lesson/scripts/export_handout_pdf.py"


def load_exporter_module():
    spec = importlib.util.spec_from_file_location("export_handout_pdf", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_regular_images_default_to_text_width() -> None:
    exporter = load_exporter_module()
    tex = r"\includegraphics{../media/processed/3-1-pp-02-poles-and-modes.pdf}"

    rewritten = exporter.rewrite_latex_for_pdf_layout(tex)

    assert (
        rewritten
        == r"\includegraphics[width=\textwidth]{../media/processed/3-1-pp-02-poles-and-modes.pdf}"
    )


def test_cover_images_stay_full_width() -> None:
    exporter = load_exporter_module()
    tex = r"\includegraphics{../media/processed/3-1-cover-comic.png}"

    rewritten = exporter.rewrite_latex_for_pdf_layout(tex)

    assert (
        rewritten
        == r"\includegraphics[width=\textwidth]{../media/processed/3-1-cover-comic.png}"
    )


def test_prefixed_handout_keeps_clean_header() -> None:
    exporter = load_exporter_module()

    assert exporter.derive_right_header("4-7-handout", "4-7") == "单元 4-7 讲义"
    assert exporter.derive_right_header("4-7-teacher-handout", "4-7") == "单元 4-7 教师课堂讲义"


def main() -> None:
    test_regular_images_default_to_text_width()
    test_cover_images_stay_full_width()
    test_prefixed_handout_keeps_clean_header()
    print("test_export_handout_pdf passed")


if __name__ == "__main__":
    main()
