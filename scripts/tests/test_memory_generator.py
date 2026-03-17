from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATOR = (
    REPO_ROOT
    / '.codex'
    / 'skills'
    / 'memory-maintenance'
    / 'scripts'
    / 'new_memory_file.py'
)


def run_generator(memory_root: Path, kind: str, path: str, title: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(GENERATOR),
            '--memory-root',
            str(memory_root),
            '--kind',
            kind,
            '--path',
            path,
            '--title',
            title,
        ],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_create_leaf_template() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        memory_root = Path(temp_dir) / 'memory'
        result = run_generator(memory_root, 'leaf', '20-architecture/example.md', '示例叶子文件')

        assert result.returncode == 0, result.stdout + result.stderr
        output_file = memory_root / '20-architecture' / 'example.md'
        assert output_file.exists()

        content = output_file.read_text(encoding='utf-8')
        assert '# 示例叶子文件' in content
        assert '状态: draft' in content
        assert '## 结论' in content
        assert '20-architecture/00-index.md' in content


def test_create_incident_template() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        memory_root = Path(temp_dir) / 'memory'
        result = run_generator(memory_root, 'incident', '60-incidents/2026-03-17-example.md', '2026-03-17 示例事故')

        assert result.returncode == 0, result.stdout + result.stderr
        output_file = memory_root / '60-incidents' / '2026-03-17-example.md'
        content = output_file.read_text(encoding='utf-8')

        assert '## 关键证据' in content
        assert '## 后续建议' in content
        assert '60-incidents/00-index.md' in content


def test_refuse_to_overwrite_existing_file() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        memory_root = Path(temp_dir) / 'memory'
        output_file = memory_root / '70-workflows' / 'flow.md'
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text('existing\n', encoding='utf-8')

        result = run_generator(memory_root, 'leaf', '70-workflows/flow.md', '流程模板')

        assert result.returncode != 0
        assert 'already exists' in result.stdout


def main() -> None:
    tests = [
        test_create_leaf_template,
        test_create_incident_template,
        test_refuse_to_overwrite_existing_file,
    ]

    for test in tests:
        test()

    print('memory generator tests passed')


if __name__ == '__main__':
    main()
