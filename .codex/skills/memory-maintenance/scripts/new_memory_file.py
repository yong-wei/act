from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='为 .codex/memory 生成最小模板文件。'
    )
    parser.add_argument(
        '--memory-root',
        default='.codex/memory',
        help='memory 根目录，默认 .codex/memory',
    )
    parser.add_argument(
        '--kind',
        required=True,
        choices=('leaf', 'index', 'incident', 'decision'),
        help='模板类型',
    )
    parser.add_argument(
        '--path',
        required=True,
        help='相对于 memory 根目录的目标路径，例如 20-architecture/example.md',
    )
    parser.add_argument(
        '--title',
        required=True,
        help='文件标题',
    )
    return parser.parse_args()


def infer_parent_index(relative_path: Path) -> str:
    if len(relative_path.parts) <= 1:
        return '../00-index.md'
    directory = relative_path.parent.as_posix()
    if directory == '90-archive':
        return f'{directory}/README.md'
    return f'{directory}/00-index.md'


def build_header(title: str, parent_link: str) -> list[str]:
    today = date.today().isoformat()
    return [
        f'# {title}',
        '',
        '状态: draft',
        f'最后更新: {today}',
        '摘要: 待补充。说明该文件回答什么问题，以及为什么值得跨会话保留。',
        '上游:',
        f'- [{parent_link}]',
        '下游:',
        '- []',
        '相关:',
        '- []',
        '',
    ]


def build_body(kind: str) -> list[str]:
    if kind == 'index':
        return [
            '## 何时读这里',
            '',
            '- 待补充',
            '',
            '## 目录内容',
            '',
            '- 待补充',
            '',
        ]

    if kind == 'incident':
        return [
            '## 结论',
            '',
            '- 待补充',
            '',
            '## 关键证据',
            '',
            '- 待补充',
            '',
            '## 后续建议',
            '',
            '- 待补充',
            '',
        ]

    if kind == 'decision':
        return [
            '## 背景',
            '',
            '- 待补充',
            '',
            '## 决策',
            '',
            '- 待补充',
            '',
            '## 影响',
            '',
            '- 待补充',
            '',
        ]

    return [
        '## 结论',
        '',
        '- 待补充',
        '',
        '## 关键事实',
        '',
        '- 待补充',
        '',
        '## 风险或后续动作',
        '',
        '- 待补充',
        '',
    ]


def main() -> int:
    args = parse_args()
    memory_root = Path(args.memory_root).resolve()
    relative_path = Path(args.path)
    output_path = memory_root / relative_path

    if output_path.exists():
        print(f'file already exists: {output_path}')
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    parent_link = infer_parent_index(relative_path)
    content = '\n'.join(build_header(args.title, parent_link) + build_body(args.kind))
    output_path.write_text(content, encoding='utf-8')

    print(f'created memory file: {output_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
