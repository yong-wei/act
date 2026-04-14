from pathlib import Path
import subprocess
import sys


ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
TEX_PATH = ROOT / 'course-content/authoring/lessons/3-4/media/raw/3-4-local-feedback-block.tex'
OUT_PATH = ROOT / 'course-content/authoring/lessons/3-4/media/processed/3-4-local-feedback-block.png'
COMPILER = Path('/Users/YW/.cc-switch/skills/tikz-control-draw/scripts/compile_to_png.py')


def main() -> int:
    cmd = [
        'python3',
        str(COMPILER),
        str(TEX_PATH),
        str(OUT_PATH),
        '300',
    ]
    result = subprocess.run(cmd, cwd=ROOT)
    return result.returncode


if __name__ == '__main__':
    sys.exit(main())
