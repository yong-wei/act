from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
VALIDATOR = (
    REPO_ROOT
    / '.codex'
    / 'skills'
    / 'memory-maintenance'
    / 'scripts'
    / 'validate_memory.py'
)


def write_markdown(path: Path, title: str, *, summary: str = '测试摘要', include_header: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if include_header:
        path.write_text(
            '\n'.join(
                [
                    f'# {title}',
                    '',
                    '状态: active',
                    '最后更新: 2026-03-17',
                    f'摘要: {summary}',
                    '上游:',
                    '- []',
                    '下游:',
                    '- []',
                    '相关:',
                    '- []',
                    '',
                    '## 正文',
                    '',
                    '测试内容',
                ]
            ),
            encoding='utf-8',
        )
        return

    path.write_text(f'# {title}\n\n无效文件\n', encoding='utf-8')


def build_valid_memory_tree(root: Path) -> None:
    write_markdown(root / 'README.md', 'Memory README')
    write_markdown(root / '00-index.md', 'Root Index')
    write_markdown(root / '01-reading-map.md', 'Reading Map')
    write_markdown(root / '10-project' / '00-index.md', 'Project Index')
    write_markdown(root / '10-project' / '10-current-state.md', 'Current State')
    write_markdown(root / '90-archive' / 'README.md', 'Archive Readme')


def run_validator(memory_root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(VALIDATOR), str(memory_root)],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def test_valid_tree_passes() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        memory_root = Path(temp_dir) / 'memory'
        build_valid_memory_tree(memory_root)

        result = run_validator(memory_root)

        assert result.returncode == 0, result.stdout + result.stderr
        assert 'memory validation passed' in result.stdout


def test_missing_directory_index_fails() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        memory_root = Path(temp_dir) / 'memory'
        build_valid_memory_tree(memory_root)
        (memory_root / '10-project' / '00-index.md').unlink()

        result = run_validator(memory_root)

        assert result.returncode != 0
        assert '10-project' in result.stdout
        assert '00-index.md' in result.stdout


def test_missing_header_fields_fails() -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        memory_root = Path(temp_dir) / 'memory'
        build_valid_memory_tree(memory_root)
        write_markdown(
            memory_root / '20-architecture' / '00-index.md',
            'Architecture Index',
            include_header=False,
        )

        result = run_validator(memory_root)

        assert result.returncode != 0
        assert '20-architecture/00-index.md' in result.stdout
        assert '状态:' in result.stdout


def main() -> None:
    tests = [
        test_valid_tree_passes,
        test_missing_directory_index_fails,
        test_missing_header_fields_fails,
    ]

    for test in tests:
        test()

    print('memory validator tests passed')


if __name__ == '__main__':
    main()
