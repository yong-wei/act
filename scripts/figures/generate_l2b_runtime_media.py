from __future__ import annotations

import subprocess
import sys
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / 'L-2b' / 'media' / 'raw'
RUNTIME_DIR = ROOT / 'course-content' / 'runtime' / 'lessons' / 'L-2b' / 'media'

GENERATORS = [
    ('sh-01-pole-migration-locus.py', 'sh-01-pole-migration-locus.svg'),
    ('sh-02-root-locus-performance-zones.py', 'sh-02-root-locus-performance-zones.svg'),
    ('sh-03-root-locus-optimal-damping.py', 'sh-03-root-locus-optimal-damping.svg'),
    ('h-04-example1-root-locus.py', 'h-04-example1-root-locus.svg'),
    ('h-05-example2-root-locus-crossing.py', 'h-05-example2-root-locus-crossing.svg'),
]


def main() -> int:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    mpl_config_dir = ROOT / '.tmp' / 'matplotlib'
    mpl_config_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env['MPLBACKEND'] = 'Agg'
    env['MPLCONFIGDIR'] = str(mpl_config_dir)

    for script_name, output_name in GENERATORS:
        script_path = RAW_DIR / script_name
        output_path = RUNTIME_DIR / output_name
        subprocess.run(
            [sys.executable, str(script_path), '--output', str(output_path)],
            check=True,
            cwd=ROOT,
            env=env,
        )
        print(f'generated {output_path.relative_to(ROOT)}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
