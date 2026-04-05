from __future__ import annotations

import os
from pathlib import Path

ROOT = Path('/Users/YW/Documents/Site/act.just.edu.cn')
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from PIL import Image


OUT_DIR = ROOT / 'course-content/authoring/lessons/3-7/media/processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False


def flatten_to_white(path: Path) -> None:
  image = Image.open(path).convert('RGBA')
  background = Image.new('RGBA', image.size, (255, 255, 255, 255))
  Image.alpha_composite(background, image).convert('RGB').save(path)


def save(fig: plt.Figure, filename: str) -> None:
  OUT_DIR.mkdir(parents=True, exist_ok=True)
  path = OUT_DIR / filename
  fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight', pad_inches=0.08)
  plt.close(fig)
  flatten_to_white(path)


def rounded_box(ax, x, y, w, h, title, body, color):
  box = FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.02,rounding_size=0.03',
                       linewidth=1.8, edgecolor=color, facecolor='white')
  ax.add_patch(box)
  ax.text(x + 0.03, y + h - 0.08, title, fontsize=15, fontweight='bold', color=color, va='top')
  ax.text(x + 0.03, y + h - 0.16, body, fontsize=11.5, color='#22313f', va='top', linespacing=1.5)


def render_cover() -> None:
  fig, ax = plt.subplots(figsize=(12.5, 7.0), dpi=220)
  ax.set_xlim(0, 1)
  ax.set_ylim(0, 1)
  ax.axis('off')

  ax.text(0.05, 0.92, '单元 3-7', fontsize=18, color='#52616b', fontweight='bold')
  ax.text(0.05, 0.84, '型别、积分环节与稳态改善', fontsize=28, color='#173f5f', fontweight='bold')
  ax.text(0.05, 0.77, '从误差来源、双通道列式到 PI 与滞后校正的低频补偿路径', fontsize=14, color='#52616b')

  rounded_box(ax, 0.05, 0.48, 0.2, 0.2, '误差从哪来', '系统结构决定能不能根本消掉误差；\n输入形式决定误差怎样暴露出来。', '#1f4e79')
  rounded_box(ax, 0.29, 0.48, 0.2, 0.2, '先分通道', '给定和扰动进入闭环的方式不同，\n总输出和总误差都要分通道建立。', '#2a9d8f')
  rounded_box(ax, 0.53, 0.48, 0.2, 0.2, '再选方法', '终值定理负责直接求解，\n型别与静态误差系数负责快速判断。', '#d97706')
  rounded_box(ax, 0.77, 0.48, 0.18, 0.2, '最后补偿', 'PI 改变型别，\n滞后重分配低频增益。', '#b42318')

  for x1, x2 in [(0.25, 0.29), (0.49, 0.53), (0.73, 0.77)]:
    ax.add_patch(FancyArrowPatch((x1, 0.58), (x2, 0.58), arrowstyle='-|>', mutation_scale=18,
                                 linewidth=1.8, color='#52616b'))

  ax.text(0.05, 0.28, '本讲关注两个判断：', fontsize=16, fontweight='bold', color='#173f5f')
  ax.text(0.08, 0.21, '1. 为什么系统已经稳定了，误差却还可能长期存在？', fontsize=13.5, color='#22313f')
  ax.text(0.08, 0.15, '2. 为什么同样是改善精度，PI 和滞后校正的代价并不一样？', fontsize=13.5, color='#22313f')

  save(fig, '3-7-cover-comic.png')


def render_info() -> None:
  fig, ax = plt.subplots(figsize=(12.5, 7.0), dpi=220)
  ax.set_xlim(0, 1)
  ax.set_ylim(0, 1)
  ax.axis('off')

  ax.text(0.05, 0.92, '本讲信息图总结', fontsize=24, fontweight='bold', color='#173f5f')
  rounded_box(ax, 0.05, 0.56, 0.42, 0.24, '误差分析主线',
              '先区分系统结构来源与输入信号来源；\n'
              '再把给定通道、扰动通道、总输出和总误差写清楚；\n'
              '最后再决定是直接用终值定理，还是先做型别判断。',
              '#1f4e79')
  rounded_box(ax, 0.53, 0.56, 0.42, 0.24, '两条稳态改善路径',
              'PI 通过积分把低频能力向上抬一层；\n'
              '滞后通过低频增益重分配，在不大幅牺牲裕度的前提下压小误差。\n'
              '二者都更准，但动态代价不同。',
              '#b42318')
  rounded_box(ax, 0.05, 0.22, 0.42, 0.24, '什么时候直接求',
              '含扰动、通道位置不直观、结构较复杂时，\n'
              '优先回到误差传递函数，再用终值定理求极限。',
              '#2a9d8f')
  rounded_box(ax, 0.53, 0.22, 0.42, 0.24, '什么时候快速判',
              '标准单位反馈、典型给定输入、只问稳态误差时，\n'
              '优先用型别与 Kp/Kv/Ka 快速判断，再回算具体数值。',
              '#d97706')

  save(fig, '3-7-info.png')


if __name__ == '__main__':
  render_cover()
  render_info()
  print(f'已生成 {OUT_DIR / "3-7-cover-comic.png"}')
  print(f'已生成 {OUT_DIR / "3-7-info.png"}')
