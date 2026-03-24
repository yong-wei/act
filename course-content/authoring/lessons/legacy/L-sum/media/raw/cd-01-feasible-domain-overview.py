import argparse
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from matplotlib_font import configure_matplotlib_for_cjk


def resolve_output_path() -> Path:
    default_output = Path(__file__).resolve().parent.parent / 'processed' / 'cd-01-feasible-domain-overview.svg'
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(default_output))
    return Path(parser.parse_args().output)


out_path = resolve_output_path()
out_path.parent.mkdir(parents=True, exist_ok=True)
configure_matplotlib_for_cjk()

fig, ax = plt.subplots(figsize=(9, 4.8))
ax.set_xlim(0, 16)
ax.set_ylim(0, 10)
ax.axis('off')


def panel(x: float, y: float, width: float, height: float, title: str, lines: list[str], fc: str, ec: str) -> None:
    box = FancyBboxPatch(
        (x, y),
        width,
        height,
        boxstyle='round,pad=0.28,rounding_size=0.28',
        facecolor=fc,
        edgecolor=ec,
        linewidth=2,
    )
    ax.add_patch(box)
    ax.text(x + 0.35, y + height - 0.65, title, fontsize=13, fontweight='bold', color=ec, va='top')
    for index, line in enumerate(lines):
        ax.text(x + 0.35, y + height - 1.5 - index * 0.72, line, fontsize=10.5, color='#243447', va='top')


def arrow(start: tuple[float, float], end: tuple[float, float], text: str, color: str, text_offset: tuple[float, float] = (0, 0)) -> None:
    patch = FancyArrowPatch(start, end, arrowstyle='-|>', mutation_scale=18, linewidth=2, color=color)
    ax.add_patch(patch)
    center_x = (start[0] + end[0]) / 2 + text_offset[0]
    center_y = (start[1] + end[1]) / 2 + text_offset[1]
    ax.text(center_x, center_y, text, fontsize=10.5, color=color, ha='center', va='center', fontweight='bold')


panel(
    0.8,
    6.0,
    3.7,
    2.8,
    '性能约束',
    ['Mp ≤ 20%', 'ts ≤ 5 s', '目标：先验收，再调参'],
    fc='#fdf4d7',
    ec='#b7791f',
)
panel(
    5.8,
    5.2,
    4.2,
    4.0,
    '复平面可行域',
    ['阻尼比射线', '实部垂线', '根轨迹与扇形求交'],
    fc='#e9eefc',
    ec='#3657a7',
)
panel(
    11.1,
    6.3,
    3.8,
    2.2,
    '时域响应包络',
    ['Kmin 与 Kmax', '围成响应“管道”'],
    fc='#e6f7ed',
    ec='#2f855a',
)
panel(
    11.1,
    3.2,
    3.8,
    2.2,
    '频域可行带',
    ['Bode 上下边界', '带宽与裕度折中'],
    fc='#f2e8ff',
    ec='#6b46c1',
)
panel(
    5.9,
    1.1,
    4.1,
    2.2,
    '设计可行域',
    ['K ∈ [Kmin, Kmax]', '范围内再选推荐工作点'],
    fc='#ffe8e8',
    ec='#c05656',
)

arrow((4.55, 7.4), (5.75, 7.2), '几何翻译', '#b7791f', (0, 0.38))
arrow((8.0, 5.1), (8.0, 3.45), '读出 K 范围', '#3657a7', (1.2, 0))
arrow((10.05, 7.6), (11.0, 7.4), '时域投影', '#2f855a', (0, 0.34))
arrow((10.05, 4.2), (11.0, 4.2), '频域投影', '#6b46c1', (0, 0.34))

ax.text(7.9, 9.4, '设计可行域三域映射关系', fontsize=16, fontweight='bold', color='#1f2937', ha='center')
ax.text(7.9, 8.9, '同一组满足约束的 K 值，在三张图上留下不同但一致的“允许区域”', fontsize=10.5, color='#4b5563', ha='center')
ax.text(8.0, 0.45, '约束收紧 → 复平面扇形收缩 → K 范围变窄 → 时域/频域允许带同步收缩', fontsize=10.2, color='#6b7280', ha='center')

plt.tight_layout()
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
