from __future__ import annotations

import re
from pathlib import Path


HANDOUT_PATH = (
    Path(__file__).resolve().parents[2]
    / 'course-content'
    / 'authoring'
    / 'lessons'
    / '4-4'
    / 'design'
    / '4-4-handout.md'
)


def extract_table5_block(markdown: str) -> str:
    match = re.search(
        r'(?ms)^表 5\.\s*起始方案与三组无约束权重方案的频域回读.*?(?=\n## |\n### |\Z)',
        markdown,
    )
    if match is None:
        raise AssertionError('未找到 4-4 讲义中的表 5 区块')
    return match.group(0)


def test_table5_has_four_rows_and_three_decimal_metrics():
    markdown = HANDOUT_PATH.read_text(encoding='utf-8')
    block = extract_table5_block(markdown)

    assert '截止频率 $\\omega_c$ / rad/s' in block
    assert '相角裕度 / deg' in block
    assert '控制峰值' in block

    data_rows = [
        line for line in block.splitlines()
        if line.startswith('| 起始方案')
        or line.startswith('| 速度优先 $A$')
        or line.startswith('| 平衡权重 $B$')
        or line.startswith('| 能量优先 $C$')
    ]
    assert len(data_rows) == 4

    numeric_pattern = re.compile(r'(?<![\d.])\d+\.\d+(?!\d)')
    for row in data_rows:
        numbers = numeric_pattern.findall(row)
        assert len(numbers) == 4, f'表 5 每行应有 4 个数值列: {row}'
        assert all(len(number.split('.')[1]) == 3 for number in numbers), row
