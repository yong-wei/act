# 多模态资源设计 | 单元 L-2b：根轨迹直觉速通——极点迁移的几何感知

---

## 资源总表

| 编号 | 用途 | 简短描述 | 生成方式 | 优先级 |
|:---:|:---:|----------|:---:|:---:|
| sh-01 | sh | 极点随K变化的轨迹图（T形分叉） | 代码直出 | P1 |
| sh-02 | sh | 根轨迹叠加性能分区标注图 | 代码直出 | P1 |
| sh-03 | sh | 根轨迹+45°射线几何定位图 | 代码直出 | P1 |
| h-04 | h | 例题1读图用根轨迹（零点-3，极点0/-5） | 代码直出 | P2 |
| h-05 | h/ic | 含虚轴穿越的三阶系统根轨迹（例题2） | 代码直出 | P2 |
| ic-06 | ic | 根轨迹拖动交互面板（广播/独立双模式） | 前端绘制 | P1 |
| ic-07 | ic | 反馈框图SVG（可点击高亮） | 前端绘制 | P2 |
| ic-08 | ic | 课程知识地图（含完成状态高亮） | 前端绘制 | P2 |

---

## 资源 sh-01｜极点随K变化的轨迹图（T形分叉）

```
文件名：sh-01-pole-migration-locus.py / .svg
存放：media/raw/sh-01-pole-migration-locus.py
      media/processed/sh-01-pole-migration-locus.svg
引用于：handout.md §2.2（插图1）/ interactive-page.md step-08（数值表配图）
```

**图片内容描述**：

复平面坐标系，展示系统 $G(s)=K/[s(s+2)]$ 的根轨迹。

- 横轴：复平面实部 $\sigma$，范围 [-3, 0.5]，标注"实部 σ"
- 纵轴：复平面虚部 $j\omega$，范围 [-3.5, 3.5]，标注"虚部 jω"
- 虚轴以浅灰色虚线标注（稳定边界）
- 根轨迹路径：
  - 两个起始点（K=0）：实心圆 ×，分别在 (0,0) 和 (-2,0)，标注"K=0"
  - 两段实轴轨迹（从两端向中心汇合），用青色实线绘制，箭头指向 (-1,0)
  - 分叉点 (-1,0)：标注"K=1，分叉点"，菱形标记
  - 分叉后两支向上/下垂直延伸，实部固定在 -1，虚部±方向各延伸到约 ±3
- 关键K值标注点（带引线文字）：
  - (-1, +1)：标注"K=2，ζ=0.707"（青色高亮点）
  - (-1, +2)：标注"K=5，超调≈20%"
- 箭头：沿轨迹方向标注"K增大"方向
- 图注（图下方）："图1：船舶航向控制系统 G(s)=K/[s(s+2)] 的根轨迹。两极点从实轴出发，在(-1,0)相遇后分叉，实部固定为-1。"

**示例代码**：

```python
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch

fig, ax = plt.subplots(figsize=(7, 8))
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

# 坐标轴设置
ax.axhline(0, color='white', linewidth=0.5, alpha=0.4)
ax.axvline(0, color='#f87171', linewidth=1.2, linestyle='--', alpha=0.7, label='虚轴（稳定边界）')
ax.set_xlim(-3, 0.8)
ax.set_ylim(-3.5, 3.5)
ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=12)
ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=12)
ax.tick_params(colors='#64748b')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')

CYAN = '#22d3ee'
WHITE = '#f1f5f9'

# K=0~1：两段实轴轨迹
K_real = np.linspace(0, 1, 100)
sigma1 = -1 + np.sqrt(1 - K_real)   # 从 0 到 -1
sigma2 = -1 - np.sqrt(1 - K_real)   # 从 -2 到 -1
ax.plot(sigma1, np.zeros_like(sigma1), color=CYAN, linewidth=2.5)
ax.plot(sigma2, np.zeros_like(sigma2), color=CYAN, linewidth=2.5)

# K=1~10：复数极点，实部=-1，虚部增大
K_complex = np.linspace(1, 10, 200)
omega = np.sqrt(K_complex - 1)
ax.plot(-np.ones_like(omega), omega, color=CYAN, linewidth=2.5)
ax.plot(-np.ones_like(omega), -omega, color=CYAN, linewidth=2.5)

# 箭头：K增大方向
ax.annotate('', xy=(-1, 2.2), xytext=(-1, 1.2),
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.8))
ax.annotate('', xy=(-1, -2.2), xytext=(-1, -1.2),
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.8))
ax.annotate('', xy=(-0.3, 0), xytext=(-0.9, 0),
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.8))
ax.annotate('', xy=(-1.7, 0), xytext=(-1.1, 0),
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.8))

# 关键点标注
# K=0 起点
ax.plot(0, 0, 'x', color=WHITE, markersize=10, markeredgewidth=2.5)
ax.annotate('K=0\n(0, 0)', xy=(0, 0), xytext=(0.15, 0.3),
            color=WHITE, fontsize=9, ha='left')
ax.plot(-2, 0, 'x', color=WHITE, markersize=10, markeredgewidth=2.5)
ax.annotate('K=0\n(-2, 0)', xy=(-2, 0), xytext=(-2.9, 0.3),
            color=WHITE, fontsize=9, ha='left')

# 分叉点 K=1
ax.plot(-1, 0, 'D', color='#fbbf24', markersize=9)
ax.annotate('K=1\n分叉点(-1, 0)', xy=(-1, 0), xytext=(-2.8, -0.6),
            color='#fbbf24', fontsize=9,
            arrowprops=dict(arrowstyle='->', color='#fbbf24', lw=1.2))

# K=2，ζ=0.707
ax.plot(-1, 1, 'o', color=CYAN, markersize=10, zorder=5)
ax.annotate('K=2\nζ=0.707\n(-1, +j)', xy=(-1, 1), xytext=(-2.8, 1.5),
            color=CYAN, fontsize=9,
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.2))

# K=5
ax.plot(-1, 2, 'o', color='#f59e0b', markersize=8, zorder=5)
ax.annotate('K=5\n超调≈20%\n(-1, +2j)', xy=(-1, 2), xytext=(-2.8, 2.6),
            color='#f59e0b', fontsize=9,
            arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.2))

# 对称下半部分对应点（简洁标注）
ax.plot(-1, -1, 'o', color=CYAN, markersize=10, zorder=5)
ax.plot(-1, -2, 'o', color='#f59e0b', markersize=8, zorder=5)

# K增大文字
ax.text(-0.6, 2.8, 'K 增大 →', color=CYAN, fontsize=9, rotation=90, va='bottom')

ax.set_title('根轨迹：$G(s)=K/[s(s+2)]$\n极点随增益K的迁移路径',
             color=WHITE, fontsize=11, pad=12)
ax.legend(loc='lower right', fontsize=8,
          facecolor='#1e293b', edgecolor='#334155', labelcolor='#94a3b8')

plt.tight_layout()
plt.savefig('sh-01-pole-migration-locus.svg', format='svg',
            dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.show()
```

---

## 资源 sh-02｜根轨迹叠加性能分区标注图

```
文件名：sh-02-root-locus-performance-zones.py / .svg
存放：media/raw/sh-02-root-locus-performance-zones.py
      media/processed/sh-02-root-locus-performance-zones.svg
引用于：handout.md §2.3（插图2）/ interactive-page.md step-10
```

**图片内容描述**：

在 sh-01 根轨迹图基础上，叠加三个性能区域的背景色块，并标注工程意义。

- 背景色块（半透明）：
  - **区域①**（实部-1，虚部 0~0.5 段附近）：绿色半透明 → 标注"慢，无超调"
  - **区域②**（虚部 0.7~1.5 段，即ζ≈0.5~0.9）：青色半透明 → 标注"✓ 理想工作区"
  - **区域③**（虚部 2.5 以上）：橙色半透明 → 标注"超调大，接近边界"
- 根轨迹曲线叠加在色块上（同 sh-01 样式）
- 虚轴红色虚线，右半平面标注"不稳定区域"（浅红色背景）
- 图注："图2：根轨迹上的性能分区。工程师在'理想工作区'（青色）挑选增益K。"

**示例代码**：

```python
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

fig, ax = plt.subplots(figsize=(7, 8))
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

CYAN = '#22d3ee'
WHITE = '#f1f5f9'

# 性能分区色块
# 不稳定区（右半平面）
ax.axvspan(0, 0.8, alpha=0.12, color='#ef4444')
ax.text(0.2, 3.0, '不稳定\n区域', color='#f87171', fontsize=9, ha='center')

# 区域①：慢，无超调（虚部 0~0.8）
ax.fill_between([-1.8, -0.2], [0, 0], [0.8, 0.8], alpha=0.15, color='#22c55e')
ax.fill_between([-1.8, -0.2], [-0.8, -0.8], [0, 0], alpha=0.15, color='#22c55e')
ax.text(-1.5, 0.35, '① 慢，无超调', color='#86efac', fontsize=8.5)

# 区域②：理想工作区（虚部 0.8~1.8）
ax.fill_between([-1.8, -0.2], [0.8, 0.8], [1.8, 1.8], alpha=0.2, color='#22d3ee')
ax.fill_between([-1.8, -0.2], [-1.8, -1.8], [-0.8, -0.8], alpha=0.2, color='#22d3ee')
ax.text(-1.5, 1.25, '② ✓ 理想工作区', color=CYAN, fontsize=8.5, fontweight='bold')

# 区域③：超调大（虚部 1.8以上）
ax.fill_between([-1.8, -0.2], [1.8, 1.8], [3.5, 3.5], alpha=0.12, color='#f59e0b')
ax.fill_between([-1.8, -0.2], [-3.5, -3.5], [-1.8, -1.8], alpha=0.12, color='#f59e0b')
ax.text(-1.5, 2.5, '③ 超调大\n接近边界', color='#fcd34d', fontsize=8.5)

# 根轨迹
K_real = np.linspace(0, 1, 100)
sigma1 = -1 + np.sqrt(1 - K_real)
sigma2 = -1 - np.sqrt(1 - K_real)
ax.plot(sigma1, np.zeros_like(sigma1), color=CYAN, linewidth=2.5)
ax.plot(sigma2, np.zeros_like(sigma2), color=CYAN, linewidth=2.5)

K_complex = np.linspace(1, 12, 300)
omega = np.sqrt(K_complex - 1)
ax.plot(-np.ones_like(omega), omega, color=CYAN, linewidth=2.5)
ax.plot(-np.ones_like(omega), -omega, color=CYAN, linewidth=2.5)

# 虚轴
ax.axvline(0, color='#f87171', linewidth=1.5, linestyle='--', alpha=0.8)
ax.axhline(0, color=WHITE, linewidth=0.5, alpha=0.3)

# K=2点高亮
ax.plot(-1, 1, 'o', color=CYAN, markersize=11, zorder=6)
ax.plot(-1, -1, 'o', color=CYAN, markersize=11, zorder=6)
ax.annotate('K=2，ζ=0.707', xy=(-1, 1), xytext=(-2.7, 1.4),
            color=CYAN, fontsize=9,
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.2))

ax.set_xlim(-3, 0.8)
ax.set_ylim(-3.5, 3.5)
ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=12)
ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=12)
ax.tick_params(colors='#64748b')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')

ax.set_title('根轨迹性能分区图\n理想工作区：快速响应 + 小超调',
             color=WHITE, fontsize=11, pad=12)
plt.tight_layout()
plt.savefig('sh-02-root-locus-performance-zones.svg', format='svg',
            dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.show()
```

---

## 资源 sh-03｜根轨迹+45°射线几何定位图

```
文件名：sh-03-root-locus-optimal-damping.py / .svg
存放：media/raw/sh-03-root-locus-optimal-damping.py
      media/processed/sh-03-root-locus-optimal-damping.svg
引用于：handout.md §2.4（插图3）/ interactive-page.md step-14
```

**图片内容描述**：

根轨迹图叠加 ζ=0.707 射线，精确标注交点和几何关系。

- 根轨迹曲线（同 sh-01）
- 从原点 (0,0) 出发、与负实轴成 45° 的射线（橙色虚线），延伸到 (-3, -3) 方向
- 上半射线：从原点到 (-3, +3)（标注"ζ=0.707 线（θ=45°）"）
- 射线与根轨迹的交点 (-1, +1) 和 (-1, -1)：
  - 大号青色实心圆，标注"目标极点 s = -1 ± j"
- 几何角度标注：在原点处画出 45° 弧度标记，标注"θ = 45°"
- 直角三角形辅助线：从原点到 (-1,+1)，从 (-1,+1) 垂直到实轴，标注两直角边均为 1
- 计算结果标注框（图右侧）：
  ```
  ζ = cos 45° = 0.707
  极点：s = -1 ± j
  K = σ² + ωd² = 1² + 1² = 2
  ```
- 图注："图3：45°射线与根轨迹的交点即为ζ=0.707的目标极点，对应K=2。"

**示例代码**：

```python
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Arc, FancyArrowPatch

fig, ax = plt.subplots(figsize=(7, 8))
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

CYAN = '#22d3ee'
WHITE = '#f1f5f9'
ORANGE = '#fb923c'

# 根轨迹
K_real = np.linspace(0.001, 1, 100)
sigma1 = -1 + np.sqrt(1 - K_real)
sigma2 = -1 - np.sqrt(1 - K_real)
ax.plot(sigma1, np.zeros_like(sigma1), color=CYAN, linewidth=2.5, alpha=0.7)
ax.plot(sigma2, np.zeros_like(sigma2), color=CYAN, linewidth=2.5, alpha=0.7)

K_complex = np.linspace(1, 12, 300)
omega = np.sqrt(K_complex - 1)
ax.plot(-np.ones_like(omega), omega, color=CYAN, linewidth=2.5, alpha=0.7, label='根轨迹')
ax.plot(-np.ones_like(omega), -omega, color=CYAN, linewidth=2.5, alpha=0.7)

# 45° 射线（ζ=0.707线）
t = np.linspace(0, 3.2, 100)
ax.plot(-t, t, color=ORANGE, linewidth=2, linestyle='--', label='ζ=0.707线（θ=45°）')
ax.plot(-t, -t, color=ORANGE, linewidth=2, linestyle='--')

# 45° 角弧标注
arc = Arc((0, 0), 0.6, 0.6, angle=0, theta1=135, theta2=180, color=ORANGE, lw=1.5)
ax.add_patch(arc)
ax.text(-0.45, 0.18, '45°', color=ORANGE, fontsize=9)

# 辅助直角三角形
ax.plot([-1, -1], [0, 1], color='#94a3b8', linewidth=1.2, linestyle=':')
ax.plot([0, -1], [0, 0], color='#94a3b8', linewidth=1.2, linestyle=':')
ax.text(-0.55, -0.2, '1', color='#94a3b8', fontsize=9, ha='center')
ax.text(-1.18, 0.5, '1', color='#94a3b8', fontsize=9, ha='right')
# 直角标记
ax.plot([-1, -0.88], [0.12, 0.12], color='#94a3b8', lw=1)
ax.plot([-0.88, -0.88], [0, 0.12], color='#94a3b8', lw=1)

# 交点高亮
ax.plot(-1, 1, 'o', color=CYAN, markersize=14, zorder=6)
ax.plot(-1, -1, 'o', color=CYAN, markersize=14, zorder=6)
ax.annotate('目标极点\ns = -1 + j\n（K=2，ζ=0.707）',
            xy=(-1, 1), xytext=(-2.9, 2.2),
            color=CYAN, fontsize=9.5, fontweight='bold',
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.5))

# 结果标注框
result_text = ('$\\zeta = \\cos 45° = 0.707$\n'
               '极点：$s = -1 \\pm j$\n'
               '$K = \\sigma^2 + \\omega_d^2 = 2$')
ax.text(0.05, -2.5, result_text, color=WHITE, fontsize=9,
        bbox=dict(boxstyle='round,pad=0.5', facecolor='#1e293b',
                  edgecolor=CYAN, alpha=0.9))

# 原点和虚轴
ax.plot(0, 0, 'o', color=WHITE, markersize=6, zorder=5)
ax.axvline(0, color='#f87171', linewidth=1, linestyle='--', alpha=0.5)
ax.axhline(0, color=WHITE, linewidth=0.5, alpha=0.3)

ax.set_xlim(-3.2, 0.8)
ax.set_ylim(-3.5, 3.5)
ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=12)
ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=12)
ax.tick_params(colors='#64748b')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')

ax.legend(loc='lower right', fontsize=8.5,
          facecolor='#1e293b', edgecolor='#334155', labelcolor='#94a3b8')
ax.set_title('45°射线定位最佳阻尼比（ζ=0.707）\n射线与根轨迹交点对应 K=2',
             color=WHITE, fontsize=11, pad=12)
plt.tight_layout()
plt.savefig('sh-03-root-locus-optimal-damping.svg', format='svg',
            dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.show()
```

---

## 资源 h-04｜例题1根轨迹图（零点-3，极点0/-5）

```
文件名：h-04-example1-root-locus.py / .svg
存放：media/raw/h-04-example1-root-locus.py
      media/processed/h-04-example1-root-locus.svg
引用于：handout.md §三·例题1
```

**图片内容描述**：

开环零点 z=-3，开环极点 p1=0, p2=-5 的系统根轨迹示意图。

- 横轴实部范围 [-6, 1]，纵轴虚部范围 [-4, 4]
- 开环极点：× 符号，在 (0,0) 和 (-5,0)
- 开环零点：○ 符号，在 (-3,0)
- 实轴根轨迹：[-5,-3] 段和 [0,+∞) 左侧（实际在右半平面无意义，仅标注[-5,-3]）
- 复数极点段：从(-2.5,0)分叉，向上下延伸为共轭复数对
- 轨迹趋向零点 (-3,0)（一支终止）和趋向无穷（另一支沿渐近线）
- 标注分离点约 (-2.5,0)
- 图注供例题读图使用，三个问题的答案对应区域用不同颜色淡色背景标注

**示例代码**：

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

fig, ax = plt.subplots(figsize=(7, 6))
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

CYAN = '#22d3ee'
WHITE = '#f1f5f9'

# 用matplotlib的根轨迹思路手动绘制
# 特征方程：s(s+5) + K(s+3) = 0 → s²+(5+K)s+3K=0
K_vals = np.linspace(0, 50, 2000)
roots_upper, roots_lower = [], []

for K in K_vals:
    coeffs = [1, 5 + K, 3 * K]
    r = np.roots(coeffs)
    # 取虚部>=0的根
    r_sorted = sorted(r, key=lambda x: x.imag)
    roots_lower.append(r_sorted[0])
    roots_upper.append(r_sorted[1])

ru = np.array(roots_upper)
rl = np.array(roots_lower)

ax.plot(ru.real, ru.imag, color=CYAN, linewidth=2.5)
ax.plot(rl.real, rl.imag, color=CYAN, linewidth=2.5)

# 开环极点和零点
ax.plot(0, 0, 'x', color=WHITE, markersize=12, markeredgewidth=2.5, label='开环极点 ×')
ax.plot(-5, 0, 'x', color=WHITE, markersize=12, markeredgewidth=2.5)
ax.plot(-3, 0, 'o', color='#fbbf24', markersize=10,
        markerfacecolor='none', markeredgewidth=2.5, label='开环零点 ○')

# 标注
ax.annotate('p₁=(0,0)', xy=(0,0), xytext=(0.15, 0.4), color=WHITE, fontsize=9)
ax.annotate('p₂=(-5,0)', xy=(-5,0), xytext=(-5.5, 0.4), color=WHITE, fontsize=9)
ax.annotate('z=(-3,0)', xy=(-3,0), xytext=(-3.5, -0.6), color='#fbbf24', fontsize=9)

# 分离点
ax.plot(-2.5, 0, 'D', color='#f59e0b', markersize=8)
ax.annotate('分离点≈(-2.5, 0)', xy=(-2.5,0), xytext=(-5, -1.5),
            color='#f59e0b', fontsize=8.5,
            arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1))

ax.axvline(0, color='#f87171', linewidth=1, linestyle='--', alpha=0.5)
ax.axhline(0, color=WHITE, linewidth=0.5, alpha=0.3)
ax.set_xlim(-6.5, 1)
ax.set_ylim(-4, 4)
ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=11)
ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=11)
ax.tick_params(colors='#64748b')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')
ax.legend(loc='upper right', fontsize=8.5,
          facecolor='#1e293b', edgecolor='#334155', labelcolor='#94a3b8')
ax.set_title('例题1：根轨迹图（开环零点z=-3，极点p=0,-5）',
             color=WHITE, fontsize=10, pad=10)
plt.tight_layout()
plt.savefig('h-04-example1-root-locus.svg', format='svg',
            dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.show()
```

---

## 资源 h-05｜三阶系统含虚轴穿越根轨迹（例题2）

```
文件名：h-05-example2-root-locus-crossing.py / .svg
存放：media/raw/h-05-example2-root-locus-crossing.py
      media/processed/h-05-example2-root-locus-crossing.svg
引用于：handout.md §三·例题2 / interactive-page.md step-11
```

**图片内容描述**：

系统 $G(s)=K/[s(s+1)(s+3)]$ 的根轨迹，展示三支轨迹和虚轴穿越点。

- 三个开环极点：(0,0)、(-1,0)、(-3,0)，× 标注
- 三支根轨迹：
  - 一支沿负实轴向左延伸到 -∞
  - 另两支从实轴出发，在某分离点分叉后进入复平面，并在 K=Kc=12 时穿越虚轴到 $s = \pm j\sqrt{3}$
- 虚轴穿越点：红色高亮圆点，坐标 $(0, \pm j\sqrt{3} \approx \pm 1.73)$，标注"Kc=12，临界稳定"
- 右半平面部分轨迹以红色虚线绘制（不稳定区域）
- 右半平面背景浅红色
- 图注："图5：三阶系统根轨迹。K>12时轨迹进入右半平面，系统不稳定。"

**示例代码**：

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(7, 7))
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

CYAN = '#22d3ee'
WHITE = '#f1f5f9'

# 特征方程：s(s+1)(s+3) + K = 0 → s³+4s²+3s+K=0
K_vals = np.linspace(0.01, 80, 5000)
all_roots = []
for K in K_vals:
    r = np.roots([1, 4, 3, K])
    all_roots.append(sorted(r, key=lambda x: x.imag))

all_roots = np.array(all_roots)

for i in range(3):
    branch = all_roots[:, i]
    # 左半平面：青色；右半平面：红色虚线
    stable_mask = branch.real <= 0
    unstable_mask = branch.real > 0
    ax.plot(branch[stable_mask].real, branch[stable_mask].imag,
            color=CYAN, linewidth=2.2)
    if unstable_mask.any():
        ax.plot(branch[unstable_mask].real, branch[unstable_mask].imag,
                color='#f87171', linewidth=2, linestyle='--')

# 不稳定区域背景
ax.axvspan(0, 5, alpha=0.08, color='#ef4444')
ax.text(1.5, 3.5, '不稳定\n区域', color='#f87171', fontsize=9, ha='center')

# 虚轴
ax.axvline(0, color='#f87171', linewidth=1.5, linestyle='--', alpha=0.7)
ax.axhline(0, color=WHITE, linewidth=0.5, alpha=0.3)

# 穿越点
cross_omega = np.sqrt(3)
ax.plot(0, cross_omega, 'o', color='#ef4444', markersize=12, zorder=6)
ax.plot(0, -cross_omega, 'o', color='#ef4444', markersize=12, zorder=6)
ax.annotate(f'Kc=12，临界稳定\ns = ±j√3 ≈ ±j1.73',
            xy=(0, cross_omega), xytext=(-3.5, 2.8),
            color='#f87171', fontsize=9,
            arrowprops=dict(arrowstyle='->', color='#f87171', lw=1.5))

# 开环极点
for p, label in [(0,0,'p=0'), (-1,0,'p=-1'), (-3,0,'p=-3')]:
    ax.plot(p, 0, 'x', color=WHITE, markersize=11, markeredgewidth=2.5)
    ax.annotate(label, xy=(p,0), xytext=(p-0.1, -0.4),
                color=WHITE, fontsize=8.5, ha='center')

ax.set_xlim(-5, 5)
ax.set_ylim(-4.5, 4.5)
ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=11)
ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=11)
ax.tick_params(colors='#64748b')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')
ax.set_title('例题2：三阶系统根轨迹\n$G(s)=K/[s(s+1)(s+3)]$，临界增益 $K_c=12$',
             color=WHITE, fontsize=10, pad=10)
plt.tight_layout()
plt.savefig('h-05-example2-root-locus-crossing.svg', format='svg',
            dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.show()
```

---

## 资源 ic-06｜根轨迹拖动交互面板（前端绘制）

```
不产生媒体文件，在 interactive-page.md step-07、step-14 中标注 [前端绘制]
```

**交互需求描述**：

- **图表类型**：复平面图（根轨迹路径）+ 时域响应曲线，纵向排列
- **可变参数**：
  - 增益 K，范围 [0, 12]，控件：全宽水平滑块，步长 0.1
  - 可选：45°射线叠加开关（Toggle，step-14 专用）
- **输出量（实时计算）**：
  - 闭环极点坐标 $s = -1 \pm j\sqrt{K-1}$（K>1时）或两实极点（K≤1时）
  - 阻尼比 $\zeta = 1/\sqrt{K}$（K>1时）
  - 超调量估算 $M_p = e^{-\pi\zeta/\sqrt{1-\zeta^2}} \times 100\%$
  - 调节时间估算 $t_s \approx 4/\sigma = 4s$
- **交互行为**：
  - 滑块移动时，复平面图中青色极点实时移动，轨迹路径保留（虚线）
  - 时域曲线同步更新（用解析公式计算欠阻尼二阶响应）
  - 三个关键K值（1/2/5）触发吸附高亮：滑块接近时自动吸附并弹出信息卡
  - **广播模式**（step-07）：教师端操作，通过 `postMessage` 广播当前K值；学生端只读，显示"跟随教师"标识
  - **独立模式**（step-14）：学生端独立操作，与教师端完全隔离
- **推荐前端实现**：
  - 复平面图：Canvas API 或 SVG + React state
  - 时域曲线：Recharts LineChart，数据由解析公式实时生成
  - 状态管理：Zustand store 区分广播/独立两种模式
  - 公式计算：纯 JS（无需后端）
- **移动端适配**：
  - 滑块高度 ≥ 44px，拇指可操作
  - 复平面图和时域曲线纵向排列，各自宽度 = 100vw - padding
  - 首次加载显示引导动画（滑块轻微抖动）

---

## 资源 ic-07｜反馈框图SVG（可点击高亮，前端绘制）

```
不产生媒体文件，在 interactive-page.md step-06 中标注 [前端绘制]
```

**交互需求描述**：

- **图表类型**：控制框图（SVG），四个可点击方块
- **方块内容**：
  - [+] 误差求和节点
  - [K] 控制器增益（点击 → 高亮青色，弹出"开环增益：你的旋钮"）
  - [G(s)] 被控对象-船（点击 → 高亮绿色，弹出"被控对象：船舶动力学"）
  - [H(s)] 传感器反馈（点击 → 高亮橙色，弹出"反馈传感器：测量实际航向"）
  - 整个闭合回路（点击空白区域 → 弹出"闭环极点描述整个回路的系统状态"）
- **弹出信息**：Toast 形式，显示在触控点上方，2秒后自动消失
- **推荐实现**：纯 SVG + React onClick 事件，无需外部库
- **移动端适配**：各可点击区域触控热区 ≥ 44×44px，方块间距足够宽松

---

## 资源 ic-08｜课程知识地图（完成状态高亮，前端绘制）

```
不产生媒体文件，在 interactive-page.md step-01、step-17 中标注 [前端绘制]
```

**交互需求描述**：

- **图表类型**：线性进度地图（横向节点链）
- **节点状态**（由 props 传入）：
  - `completed`：白色实心圆 + 白色文字
  - `current`：青色实心圆 + 青色文字 + 发光效果
  - `upcoming`：灰色空心圆 + 灰色文字
- **节点列表**（L-2b 课程视角）：
  ```
  L-0 → L-1 → L-2a[completed] → L-2b[current] → L-2c → L-∑
  ```
- **连接线**：已完成段为白色实线，未完成段为灰色虚线
- **step-17 状态**：L-2b 变为 `completed`，L-2c 变为 `upcoming`（高亮预告）
- **点击节点**：弹出该单元标题和简短描述（一句话）
- **推荐实现**：SVG 或 Tailwind flex 布局，节点状态由父组件 prop 控制
- **移动端适配**：横向可滑动（overflow-x: auto）；节点圆圈直径 ≥ 40px；文字在圆圈下方，字号 ≥ 12px
