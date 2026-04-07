from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[5]
RAW_DIR = ROOT / 'course-content/authoring/lessons/3-7/media/raw'
OUT_DIR = ROOT / 'course-content/authoring/lessons/3-7/media/processed'
TEX_FILES = [
  RAW_DIR / '3-7-error-dual-channel.tex',
  RAW_DIR / '3-7-example2-structure.tex',
]


def run(cmd: list[str], cwd: Path) -> None:
  subprocess.run(cmd, cwd=cwd, check=True)


def render_tex(tex_path: Path) -> tuple[Path, Path]:
  with tempfile.TemporaryDirectory() as tmp:
    build_dir = Path(tmp)
    tex_copy = build_dir / tex_path.name
    shutil.copy2(tex_path, tex_copy)

    run(
      [
        'xelatex',
        '-interaction=nonstopmode',
        '-halt-on-error',
        tex_copy.name,
      ],
      cwd=build_dir,
    )

    pdf_path = build_dir / tex_path.with_suffix('.pdf').name
    out_pdf = OUT_DIR / pdf_path.name
    out_png = OUT_DIR / tex_path.with_suffix('.png').name
    shutil.copy2(pdf_path, out_pdf)

    run(
      [
        'magick',
        '-density',
        '300',
        str(pdf_path),
        '-background',
        'white',
        '-alpha',
        'remove',
        '-alpha',
        'off',
        str(out_png),
      ],
      cwd=build_dir,
    )

  return out_pdf, out_png


def main() -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  for tex_path in TEX_FILES:
    out_pdf, out_png = render_tex(tex_path)
    print(f'已生成 {out_pdf}')
    print(f'已生成 {out_png}')


if __name__ == '__main__':
  main()
