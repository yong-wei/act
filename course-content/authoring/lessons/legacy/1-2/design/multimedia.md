# 多模态资源设计 | 单元1-2：系统结构图与化简

> **资源总数**：13 项
> **生成方式分布**：代码直出图 4 项（sh-01~sh-04），互动前端绘制 9 项（ic-01~ic-07 含分组）

---

## 资源总表

| 编号 | 用途前缀 | 简短描述 | 生成方式 | 引用于 | 优先级 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | sh-01 | 结构图基本元素示意图 | 代码直出图 | handout.md §2.1 / interactive-page.md step-03 | P0 |
| 2 | sh-02 | 船舶航向控制系统结构图 | 代码直出图 | handout.md §2.1 / interactive-page.md step-02 | P0 |
| 3 | sh-03 | 等效变换规则对照图 | 代码直出图 | handout.md §2.3 / interactive-page.md step-08 | P0 |
| 4 | sh-04 | 信号流图示例 | 代码直出图 | handout.md §2.5 / interactive-page.md step-12 | P1 |
| 5 | ic-01 | 串联连接推导动画 | 前端绘制 | interactive-page.md step-04 | P0 |
| 6 | ic-02 | 并联连接推导动画 | 前端绘制 | interactive-page.md step-05 | P0 |
| 7 | ic-03 | 反馈连接推导动画 | 前端绘制 | interactive-page.md step-06 | P0 |
| 8 | ic-04 | 等效变换六规则动画 | 前端绘制 | interactive-page.md step-08 | P0 |
| 9 | ic-05 | 代数化简分步动画 | 前端绘制 | interactive-page.md step-10 | P0 |
| 10 | ic-06 | 结构图↔信号流图对照动画 | 前端绘制 | interactive-page.md step-12 | P1 |
| 11 | ic-07 | 梅森公式交互式求解 | 前端绘制 | interactive-page.md step-14 | P0 |
| 12 | ic-08 | 等效变换拖拽练习组件 | 前端绘制 | interactive-page.md step-09 | P1 |
| 13 | ic-09 | AI对话分区界面（手算+AI验证） | 前端绘制 | interactive-page.md step-11 | P0 |

---

## 逐项资源规格

### 代码直出图

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 sh-01 | 结构图基本元素示意图
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文件名：sh-01-block-diagram-elements.py / .svg
存放：raw/sh-01-block-diagram-elements.py → processed/sh-01-block-diagram-elements.svg
引用于：handout.md §2.1 / interactive-page.md step-03
尺寸：宽 800px，高 300px

【图片内容描述】
水平排列四种结构图基本元素，每种元素占据等宽区域，上方为图形符号，下方为名称和功能说明：
1. **方框（Block）**：矩形框内标注 $G(s)$，左侧输入箭头标 $X(s)$，右侧输出箭头标 $Y(s)$，下方公式 $Y=GX$
2. **信号线（Signal Line）**：带箭头的水平有向线段，箭头上方标注信号名 $X(s)$
3. **比较点（Summing Junction）**：圆圈内标"Σ"，上方输入标 $R(s)$（+），左侧输入标 $B(s)$（−），右侧输出标 $E(s)$，下方公式 $E=R-B$
4. **引出点（Pickoff Point）**：水平信号线上的实心黑点，从该点引出两条分支线（一条向右延续，一条向下分出），标注"各支路信号相同"

配色：方框填充浅蓝 #e8f4fd，比较点圆圈浅绿 #e8fde8，引出点实心黑色，信号线和箭头深灰 #333。各元素之间用浅灰竖虚线分隔。

【示例代码（Python/matplotlib）】
```python
# sh-01-block-diagram-elements.py
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch

plt.rcParams['font.family'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

fig, ax = plt.subplots(figsize=(12, 4.5))

# ── 元素1：方框（Block）──
bx, by = 0.5, 1.5
ax.add_patch(patches.FancyBboxPatch((bx, by), 1.6, 0.9,
             boxstyle="round,pad=0.05", facecolor='#e8f4fd',
             edgecolor='#2196F3', linewidth=2))
ax.text(bx + 0.8, by + 0.45, '$G(s)$', fontsize=14,
        ha='center', va='center')
ax.annotate('', xy=(bx, by + 0.45), xytext=(bx - 0.8, by + 0.45),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#333'))
ax.text(bx - 0.9, by + 0.45, '$X(s)$', fontsize=11, ha='right', va='center')
ax.annotate('', xy=(bx + 2.4, by + 0.45), xytext=(bx + 1.6, by + 0.45),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#333'))
ax.text(bx + 2.5, by + 0.45, '$Y(s)$', fontsize=11, ha='left', va='center')
ax.text(bx + 0.8, by - 0.3, '$Y = G \\cdot X$', fontsize=10,
        ha='center', va='top', color='#666')
ax.text(bx + 0.8, 3.2, '方框 Block', fontsize=12,
        ha='center', fontweight='bold')

# ── 元素2：信号线（Signal Line）──
sx = 4.2
ax.annotate('', xy=(sx + 2.0, 1.95), xytext=(sx, 1.95),
            arrowprops=dict(arrowstyle='->', lw=2.2, color='#333'))
ax.text(sx + 1.0, 2.25, '$X(s)$', fontsize=12, ha='center', va='bottom')
ax.text(sx + 1.0, 1.4, '单向传递', fontsize=10,
        ha='center', va='top', color='#666')
ax.text(sx + 1.0, 3.2, '信号线 Signal Line', fontsize=12,
        ha='center', fontweight='bold')

# ── 元素3：比较点（Summing Junction）──
cx, cy = 8.0, 1.95
circle = plt.Circle((cx, cy), 0.35, facecolor='#e8fde8',
                     edgecolor='#4CAF50', linewidth=2)
ax.add_patch(circle)
ax.text(cx, cy, 'Σ', fontsize=13, ha='center', va='center', fontweight='bold')
# 输入 R(s) 从左
ax.annotate('', xy=(cx - 0.35, cy), xytext=(cx - 1.3, cy),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#333'))
ax.text(cx - 1.4, cy, '$R$', fontsize=11, ha='right', va='center')
ax.text(cx - 0.5, cy + 0.2, '$+$', fontsize=10, color='#4CAF50')
# 输入 B(s) 从下
ax.annotate('', xy=(cx, cy - 0.35), xytext=(cx, cy - 1.1),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#333'))
ax.text(cx + 0.25, cy - 0.95, '$B$', fontsize=11, ha='left', va='center')
ax.text(cx + 0.2, cy - 0.5, '$-$', fontsize=10, color='red')
# 输出 E(s) 向右
ax.annotate('', xy=(cx + 1.3, cy), xytext=(cx + 0.35, cy),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#333'))
ax.text(cx + 1.4, cy, '$E$', fontsize=11, ha='left', va='center')
ax.text(cx, 1.0, '$E = R - B$', fontsize=10, ha='center', va='top', color='#666')
ax.text(cx, 3.2, '比较点 Summing Junc.', fontsize=12,
        ha='center', fontweight='bold')

# ── 元素4：引出点（Pickoff Point）──
px, py = 11.0, 1.95
ax.plot([px - 0.8, px + 1.2], [py, py], '-', color='#333', linewidth=2)
ax.plot(px, py, 'ko', markersize=10, zorder=5)
ax.plot([px, px], [py, py - 0.9], '-', color='#333', linewidth=1.8)
ax.annotate('', xy=(px + 0.6, py - 0.9), xytext=(px, py - 0.9),
            arrowprops=dict(arrowstyle='->', lw=1.5, color='#333'))
ax.text(px, 1.0, '各支路信号相同', fontsize=10,
        ha='center', va='top', color='#666')
ax.text(px, 3.2, '引出点 Pickoff Point', fontsize=12,
        ha='center', fontweight='bold')

# 分隔虚线
for xv in [3.6, 7.0, 10.0]:
    ax.axvline(x=xv, color='#ccc', linestyle='--', linewidth=1)

ax.set_xlim(-1, 12.5)
ax.set_ylim(0.3, 3.6)
ax.set_aspect('equal')
ax.axis('off')
plt.tight_layout()
plt.savefig('../processed/sh-01-block-diagram-elements.svg',
            format='svg', bbox_inches='tight')
plt.show()
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 sh-02 | 船舶航向控制系统结构图
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文件名：sh-02-ship-heading-control.py / .svg
存放：raw/sh-02-ship-heading-control.py → processed/sh-02-ship-heading-control.svg
引用于：handout.md §2.1 / interactive-page.md step-02
尺寸：宽 900px，高 350px

【图片内容描述】
标准负反馈闭环结构图，前向通路包含三个串联方框，反馈通路一个方框：
- 输入 $R(s)$（期望航向）→ 比较点（+/−）→ $E(s)$（偏差）→ 方框 $G_c(s)$（控制器/PID）→ 方框 $G_a(s)$（舵机）→ 方框 $G_p(s)$（船体）→ 输出 $Y(s)$（实际航向）
- 从 $Y(s)$ 引出点 → 方框 $H(s)$（罗经）→ $B(s)$（反馈信号）→ 回到比较点负输入端
每个方框下方用小字标注对应的物理含义。前向通路用蓝色系，反馈通路用橙色系。比较点处标注 +/− 号。

配色：前向通路方框填充 #e3f2fd（浅蓝），反馈方框填充 #fff3e0（浅橙），信号线深灰 #333，比较点浅绿。

【示例代码（Python/matplotlib）】
```python
# sh-02-ship-heading-control.py
import matplotlib.pyplot as plt
import matplotlib.patches as patches

plt.rcParams['font.family'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

fig, ax = plt.subplots(figsize=(13, 5))

# 信号标注
labels = {
    'R': (-0.3, 2.5, '$R(s)$\n期望航向'),
    'E': (2.2, 2.85, '$E(s)$'),
    'Y': (12.0, 2.5, '$Y(s)$\n实际航向'),
    'B': (1.5, 0.6, '$B(s)$'),
}
for key, (x, y, txt) in labels.items():
    ax.text(x, y, txt, fontsize=11, ha='center', va='center')

# 比较点
circle = plt.Circle((1.5, 2.5), 0.3, facecolor='#e8fde8',
                     edgecolor='#4CAF50', linewidth=2)
ax.add_patch(circle)
ax.text(1.5, 2.5, 'Σ', fontsize=12, ha='center', va='center',
        fontweight='bold')
ax.text(1.15, 2.75, '$+$', fontsize=10, color='#4CAF50')
ax.text(1.15, 2.15, '$-$', fontsize=10, color='red')

# 输入箭头 R → 比较点
ax.annotate('', xy=(1.2, 2.5), xytext=(0.2, 2.5),
            arrowprops=dict(arrowstyle='->', lw=2, color='#333'))

# 前向通路方框
fwd_boxes = [
    (3.0, 2.1, '$G_c(s)$', '控制器(PID)'),
    (5.5, 2.1, '$G_a(s)$', '舵机'),
    (8.0, 2.1, '$G_p(s)$', '船体'),
]
for bx, by, label, desc in fwd_boxes:
    ax.add_patch(patches.FancyBboxPatch((bx, by), 1.6, 0.8,
                 boxstyle="round,pad=0.05", facecolor='#e3f2fd',
                 edgecolor='#1976D2', linewidth=2))
    ax.text(bx + 0.8, by + 0.4, label, fontsize=13,
            ha='center', va='center')
    ax.text(bx + 0.8, by - 0.25, desc, fontsize=9,
            ha='center', va='top', color='#666')

# 比较点 → Gc
ax.annotate('', xy=(3.0, 2.5), xytext=(1.8, 2.5),
            arrowprops=dict(arrowstyle='->', lw=2, color='#333'))
# Gc → Ga
ax.annotate('', xy=(5.5, 2.5), xytext=(4.6, 2.5),
            arrowprops=dict(arrowstyle='->', lw=2, color='#333'))
# Ga → Gp
ax.annotate('', xy=(8.0, 2.5), xytext=(7.1, 2.5),
            arrowprops=dict(arrowstyle='->', lw=2, color='#333'))
# Gp → Y
ax.annotate('', xy=(11.5, 2.5), xytext=(9.6, 2.5),
            arrowprops=dict(arrowstyle='->', lw=2, color='#333'))

# 引出点
ax.plot(10.5, 2.5, 'ko', markersize=8, zorder=5)

# 反馈通路
ax.plot([10.5, 10.5], [2.5, 0.9], '-', color='#E65100', linewidth=1.8)
ax.add_patch(patches.FancyBboxPatch((5.5, 0.5), 1.6, 0.8,
             boxstyle="round,pad=0.05", facecolor='#fff3e0',
             edgecolor='#E65100', linewidth=2))
ax.text(6.3, 0.9, '$H(s)$', fontsize=13, ha='center', va='center')
ax.text(6.3, 0.3, '罗经', fontsize=9, ha='center', va='top', color='#666')

ax.annotate('', xy=(5.5, 0.9), xytext=(10.5, 0.9),
            arrowprops=dict(arrowstyle='<-', lw=1.8, color='#E65100'))
ax.plot([1.5, 5.5], [0.9, 0.9], '-', color='#E65100', linewidth=1.8)
ax.annotate('', xy=(1.5, 2.2), xytext=(1.5, 0.9),
            arrowprops=dict(arrowstyle='->', lw=1.8, color='#E65100'))

ax.set_xlim(-1, 13)
ax.set_ylim(-0.2, 3.8)
ax.set_aspect('equal')
ax.axis('off')
ax.set_title('船舶航向控制系统结构图', fontsize=14, fontweight='bold', pad=10)
plt.tight_layout()
plt.savefig('../processed/sh-02-ship-heading-control.svg',
            format='svg', bbox_inches='tight')
plt.show()
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 sh-03 | 等效变换规则对照图
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文件名：sh-03-equivalent-transform-rules.py / .svg
存放：raw/sh-03-equivalent-transform-rules.py → processed/sh-03-equivalent-transform-rules.svg
引用于：handout.md §2.3 / interactive-page.md step-08
尺寸：宽 900px，高 700px

【图片内容描述】
6 行 × 2 列对照图，每行展示一条等效变换规则的"变换前"（左列）和"变换后"（右列），中间用"⟹"箭头连接。每行左侧标注规则序号和名称。

- 行1：比较点前移——比较点从方框 $G(s)$ 后方移到前方，移动支路串联 $G(s)$（红色高亮）
- 行2：比较点后移——比较点从方框 $G(s)$ 前方移到后方，移动支路串联 $1/G(s)$（红色高亮）
- 行3：引出点前移——引出点从方框 $G(s)$ 后方移到前方，移动支路串联 $1/G(s)$（红色高亮）
- 行4：引出点后移——引出点从方框 $G(s)$ 前方移到后方，移动支路串联 $G(s)$（红色高亮）
- 行5：相邻比较点交换——两个比较点位置互换，无补偿
- 行6：相邻引出点交换——两个引出点位置互换，无补偿

每行右下角标注记忆口诀（如"逆流补乘 $G$"）。补偿环节方框用红色边框和浅红填充突出显示。

【示例代码（Python/matplotlib）】
```python
# sh-03-equivalent-transform-rules.py
import matplotlib.pyplot as plt
import matplotlib.patches as patches

plt.rcParams['font.family'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

fig, axes = plt.subplots(6, 2, figsize=(14, 18))
fig.suptitle('等效变换规则对照表', fontsize=16, fontweight='bold', y=0.98)

rules = [
    ('规则1：比较点前移', '逆流 → 补乘 $G$'),
    ('规则2：比较点后移', '顺流 → 补除 $G$'),
    ('规则3：引出点前移', '逆流 → 补除 $G$'),
    ('规则4：引出点后移', '顺流 → 补乘 $G$'),
    ('规则5：比较点交换', '加法交换律'),
    ('规则6：引出点交换', '同一信号'),
]

def draw_block(ax, x, y, label, color='#e3f2fd', ec='#1976D2'):
    ax.add_patch(patches.FancyBboxPatch((x, y), 0.8, 0.4,
                 boxstyle="round,pad=0.03", facecolor=color,
                 edgecolor=ec, linewidth=1.5))
    ax.text(x + 0.4, y + 0.2, label, fontsize=10,
            ha='center', va='center')

def draw_summing(ax, x, y):
    c = plt.Circle((x, y), 0.15, facecolor='#e8fde8',
                   edgecolor='#4CAF50', linewidth=1.5)
    ax.add_patch(c)
    ax.text(x, y, 'Σ', fontsize=9, ha='center', va='center')

def draw_pickoff(ax, x, y):
    ax.plot(x, y, 'ko', markersize=6, zorder=5)

def draw_arrow(ax, x1, y1, x2, y2, color='#333'):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', lw=1.3, color=color))

for i, (title, memo) in enumerate(rules):
    for j in range(2):
        ax = axes[i][j]
        ax.set_xlim(-0.5, 4.5)
        ax.set_ylim(-0.5, 1.5)
        ax.set_aspect('equal')
        ax.axis('off')

    axes[i][0].set_title(f'{title} — 变换前', fontsize=10, loc='left')
    axes[i][1].set_title('变换后', fontsize=10, loc='left')
    axes[i][1].text(4.3, -0.3, memo, fontsize=9, ha='right',
                    va='top', color='#c62828', style='italic')

    # ── 规则1：比较点前移 ──
    if i == 0:
        # 变换前：X → G → Σ(+, R from below) → Y
        ax = axes[0][0]
        draw_arrow(ax, 0, 0.7, 0.5, 0.7)
        draw_block(ax, 0.5, 0.5, '$G$')
        draw_arrow(ax, 1.3, 0.7, 1.8, 0.7)
        draw_summing(ax, 2.0, 0.7)
        draw_arrow(ax, 2.15, 0.7, 2.8, 0.7)
        draw_arrow(ax, 2.0, 0.0, 2.0, 0.55)
        ax.text(2.3, 0.0, '$R$', fontsize=9)
        ax.text(-0.1, 0.7, '$X$', fontsize=9, ha='right')
        ax.text(2.9, 0.7, '$Y$', fontsize=9)
        # 变换后：Σ(X+, R·1/G from below) → G → Y
        ax = axes[0][1]
        draw_summing(ax, 0.5, 0.7)
        draw_arrow(ax, 0, 0.7, 0.35, 0.7)
        draw_arrow(ax, 0.65, 0.7, 1.2, 0.7)
        draw_block(ax, 1.2, 0.5, '$G$')
        draw_arrow(ax, 2.0, 0.7, 2.8, 0.7)
        draw_arrow(ax, 0.5, 0.0, 0.5, 0.55)
        draw_block(ax, 0.9, -0.3, '$G$', '#ffebee', '#c62828')
        draw_arrow(ax, 1.7, -0.1, 2.2, -0.1)
        ax.text(2.3, -0.1, '$R$', fontsize=9)
        ax.text(2.9, 0.7, '$Y$', fontsize=9)

    # ── 规则2：比较点后移 ──
    elif i == 1:
        ax = axes[1][0]
        draw_arrow(ax, 0, 0.7, 0.5, 0.7)
        draw_summing(ax, 0.7, 0.7)
        draw_arrow(ax, 0.85, 0.7, 1.4, 0.7)
        draw_block(ax, 1.4, 0.5, '$G$')
        draw_arrow(ax, 2.2, 0.7, 2.8, 0.7)
        draw_arrow(ax, 0.7, 0.0, 0.7, 0.55)
        ax.text(0.9, 0.0, '$R$', fontsize=9)
        ax.text(2.9, 0.7, '$Y$', fontsize=9)
        ax = axes[1][1]
        draw_arrow(ax, 0, 0.7, 0.5, 0.7)
        draw_block(ax, 0.5, 0.5, '$G$')
        draw_arrow(ax, 1.3, 0.7, 1.8, 0.7)
        draw_summing(ax, 2.0, 0.7)
        draw_arrow(ax, 2.15, 0.7, 2.8, 0.7)
        draw_arrow(ax, 2.0, 0.0, 2.0, 0.55)
        draw_block(ax, 2.4, -0.3, '$1/G$', '#ffebee', '#c62828')
        draw_arrow(ax, 3.2, -0.1, 3.6, -0.1)
        ax.text(3.7, -0.1, '$R$', fontsize=9)
        ax.text(2.9, 0.7, '$Y$', fontsize=9)

    # ── 规则3：引出点前移 ──
    elif i == 2:
        ax = axes[2][0]
        draw_arrow(ax, 0, 0.7, 0.5, 0.7)
        draw_block(ax, 0.5, 0.5, '$G$')
        draw_arrow(ax, 1.3, 0.7, 2.5, 0.7)
        draw_pickoff(ax, 2.0, 0.7)
        ax.plot([2.0, 2.0], [0.7, 0.1], '-', color='#333', lw=1.3)
        draw_arrow(ax, 2.0, 0.1, 2.8, 0.1)
        ax.text(2.9, 0.7, '$Y$', fontsize=9)
        ax = axes[2][1]
        draw_pickoff(ax, 0.3, 0.7)
        draw_arrow(ax, 0, 0.7, 0.8, 0.7)
        draw_block(ax, 0.8, 0.5, '$G$')
        draw_arrow(ax, 1.6, 0.7, 2.5, 0.7)
        ax.plot([0.3, 0.3], [0.7, 0.1], '-', color='#333', lw=1.3)
        draw_arrow(ax, 0.3, 0.1, 0.8, 0.1)
        draw_block(ax, 0.8, -0.1, '$1/G$', '#ffebee', '#c62828')
        draw_arrow(ax, 1.6, 0.1, 2.2, 0.1)
        ax.text(2.6, 0.7, '$Y$', fontsize=9)

    # ── 规则4：引出点后移 ──
    elif i == 3:
        ax = axes[3][0]
        draw_pickoff(ax, 0.3, 0.7)
        draw_arrow(ax, 0, 0.7, 0.8, 0.7)
        draw_block(ax, 0.8, 0.5, '$G$')
        draw_arrow(ax, 1.6, 0.7, 2.5, 0.7)
        ax.plot([0.3, 0.3], [0.7, 0.1], '-', color='#333', lw=1.3)
        draw_arrow(ax, 0.3, 0.1, 2.0, 0.1)
        ax.text(2.6, 0.7, '$Y$', fontsize=9)
        ax = axes[3][1]
        draw_arrow(ax, 0, 0.7, 0.5, 0.7)
        draw_block(ax, 0.5, 0.5, '$G$')
        draw_arrow(ax, 1.3, 0.7, 2.5, 0.7)
        draw_pickoff(ax, 2.0, 0.7)
        ax.plot([2.0, 2.0], [0.7, 0.1], '-', color='#333', lw=1.3)
        draw_arrow(ax, 2.0, 0.1, 2.5, 0.1)
        draw_block(ax, 2.5, -0.1, '$G$', '#ffebee', '#c62828')
        draw_arrow(ax, 3.3, 0.1, 3.8, 0.1)
        ax.text(2.6, 0.7, '$Y$', fontsize=9)

    # ── 规则5：比较点交换 ──
    elif i == 4:
        ax = axes[4][0]
        draw_summing(ax, 1.0, 0.7); draw_summing(ax, 2.5, 0.7)
        draw_arrow(ax, 0, 0.7, 0.85, 0.7)
        draw_arrow(ax, 1.15, 0.7, 2.35, 0.7)
        draw_arrow(ax, 2.65, 0.7, 3.5, 0.7)
        ax.text(1.0, 1.1, '$Σ_1$', fontsize=9, ha='center')
        ax.text(2.5, 1.1, '$Σ_2$', fontsize=9, ha='center')
        ax = axes[4][1]
        draw_summing(ax, 1.0, 0.7); draw_summing(ax, 2.5, 0.7)
        draw_arrow(ax, 0, 0.7, 0.85, 0.7)
        draw_arrow(ax, 1.15, 0.7, 2.35, 0.7)
        draw_arrow(ax, 2.65, 0.7, 3.5, 0.7)
        ax.text(1.0, 1.1, '$Σ_2$', fontsize=9, ha='center')
        ax.text(2.5, 1.1, '$Σ_1$', fontsize=9, ha='center')

    # ── 规则6：引出点交换 ──
    elif i == 5:
        ax = axes[5][0]
        draw_arrow(ax, 0, 0.7, 3.5, 0.7)
        draw_pickoff(ax, 1.0, 0.7); draw_pickoff(ax, 2.5, 0.7)
        ax.text(1.0, 1.0, '$P_1$', fontsize=9, ha='center')
        ax.text(2.5, 1.0, '$P_2$', fontsize=9, ha='center')
        ax = axes[5][1]
        draw_arrow(ax, 0, 0.7, 3.5, 0.7)
        draw_pickoff(ax, 1.0, 0.7); draw_pickoff(ax, 2.5, 0.7)
        ax.text(1.0, 1.0, '$P_2$', fontsize=9, ha='center')
        ax.text(2.5, 1.0, '$P_1$', fontsize=9, ha='center')

plt.tight_layout(rect=[0, 0, 1, 0.96])
plt.savefig('../processed/sh-03-equivalent-transform-rules.svg',
            format='svg', bbox_inches='tight')
plt.show()
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 sh-04 | 信号流图示例（船舶航向控制系统）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
文件名：sh-04-signal-flow-graph.py / .svg
存放：raw/sh-04-signal-flow-graph.py → processed/sh-04-signal-flow-graph.svg
引用于：handout.md §2.5 / interactive-page.md step-12
尺寸：宽 800px，高 300px

【图片内容描述】
与 sh-02 船舶航向控制系统对应的信号流图。水平排列 5 个节点（圆点+标签）：
- $R(s)$ → $E(s)$ → $U_1(s)$ → $U_2(s)$ → $Y(s)$
节点间有向支路标注增益：
- $R \to E$：增益 $1$
- $E \to U_1$：增益 $G_c(s)$
- $U_1 \to U_2$：增益 $G_a(s)$
- $U_2 \to Y$：增益 $G_p(s)$
- $Y \to E$：增益 $-H(s)$（反馈回路，用橙色弧线从 $Y$ 回到 $E$，标注负号）

节点用实心圆点表示，支路用弧形箭头连接。前向支路蓝色，反馈支路橙色。

【示例代码（Python/matplotlib）】
```python
# sh-04-signal-flow-graph.py
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch
import numpy as np

plt.rcParams['font.family'] = ['SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

fig, ax = plt.subplots(figsize=(12, 4.5))

# 节点位置
nodes = {
    'R': (1, 2), 'E': (3, 2), 'U1': (5, 2),
    'U2': (7, 2), 'Y': (9, 2),
}
node_labels = {
    'R': '$R(s)$', 'E': '$E(s)$', 'U1': '$U_1(s)$',
    'U2': '$U_2(s)$', 'Y': '$Y(s)$',
}

# 绘制节点
for key, (x, y) in nodes.items():
    ax.plot(x, y, 'ko', markersize=10, zorder=5)
    ax.text(x, y - 0.45, node_labels[key], fontsize=11,
            ha='center', va='top')

# 前向支路（蓝色）
fwd_edges = [
    ('R', 'E', '$1$'),
    ('E', 'U1', '$G_c(s)$'),
    ('U1', 'U2', '$G_a(s)$'),
    ('U2', 'Y', '$G_p(s)$'),
]
for src, dst, label in fwd_edges:
    x1, y1 = nodes[src]
    x2, y2 = nodes[dst]
    ax.annotate('', xy=(x2 - 0.15, y2), xytext=(x1 + 0.15, y1),
                arrowprops=dict(arrowstyle='->', lw=2,
                                color='#1976D2'))
    mx = (x1 + x2) / 2
    ax.text(mx, y1 + 0.3, label, fontsize=10, ha='center',
            va='bottom', color='#1976D2')

# 反馈支路（橙色弧线）
x_y, y_y = nodes['Y']
x_e, y_e = nodes['E']
arc = FancyArrowPatch(
    (x_y, y_y - 0.15), (x_e, y_e - 0.15),
    connectionstyle="arc3,rad=0.4",
    arrowstyle='->', mutation_scale=15,
    color='#E65100', linewidth=2)
ax.add_patch(arc)
ax.text(5, 0.5, '$-H(s)$', fontsize=11, ha='center',
        va='center', color='#E65100',
        bbox=dict(boxstyle='round,pad=0.2', facecolor='#fff3e0',
                  edgecolor='#E65100', alpha=0.9))

ax.set_xlim(0, 10.5)
ax.set_ylim(0, 3.2)
ax.set_aspect('equal')
ax.axis('off')
ax.set_title('船舶航向控制系统 — 信号流图', fontsize=14,
             fontweight='bold', pad=10)
plt.tight_layout()
plt.savefig('../processed/sh-04-signal-flow-graph.svg',
            format='svg', bbox_inches='tight')
plt.show()
```

---

### 互动前端绘制需求

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-01~ic-03 | 三种基本连接推导动画（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md 对应步骤中标注。
引用于：interactive-page.md step-04（串联）、step-05（并联）、step-06（反馈）

【交互需求描述】
三个独立的步进式推导动画组件，教师点击"下一步"逐帧推进：

**ic-01 串联连接动画**（step-04）：
1. 帧1：展示两个方框 $G_1(s)$、$G_2(s)$ 首尾相接，标注输入 $X(s)$、中间信号 $Z(s)$、输出 $Y(s)$
2. 帧2：高亮中间信号，显示 $Z(s) = G_1(s) \cdot X(s)$
3. 帧3：高亮输出，显示 $Y(s) = G_2(s) \cdot Z(s) = G_1 G_2 \cdot X(s)$
4. 帧4：两个方框合并动画 → 单个方框 $G_1 G_2$，口诀卡片弹出"串联相乘"

**ic-02 并联连接动画**（step-05）：
1. 帧1：输入 $X(s)$ 分两路进入 $G_1(s)$ 和 $G_2(s)$，输出在比较点汇合
2. 帧2：高亮两路输出 $G_1 X$ 和 $G_2 X$
3. 帧3：比较点求和 $Y = (G_1 \pm G_2) X$
4. 帧4：合并为单个方框 $G_1 \pm G_2$，口诀卡片弹出"并联相加"

**ic-03 反馈连接动画**（step-06）：
1. 帧1：标准负反馈结构图，信号流动路径用彩色箭头动态标注
2. 帧2：写出 $E(s) = R(s) - H(s)Y(s)$
3. 帧3：代入 $Y = GE$，展开
4. 帧4：整理得 $\Phi(s) = G/(1+GH)$
5. 帧5：合并为单个方框，口诀卡片弹出"前向除以（1+开环）"

技术建议：使用 React + SVG 动画（framer-motion 或 CSS transitions），方框和信号线用 SVG path 绘制，公式用 KaTeX 渲染。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-04 | 等效变换六规则动画（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md step-08 中标注。
引用于：interactive-page.md step-08

【交互需求描述】
教师逐条推进的动画组件，共 6 条规则。每条规则展示：
1. 变换前结构图（静态）
2. 点击后播放过渡动画：被移动的元素（引出点/比较点）沿信号线滑动到新位置
3. 补偿环节方框从无到有渐入（红色高亮），标注 $G(s)$ 或 $1/G(s)$
4. 变换后结构图稳定展示

底部常驻"统一记忆法"卡片：逆流补乘 / 顺流补除。当前规则对应的行高亮。

技术建议：SVG 元素的 transform 动画实现滑动效果，补偿方框用 opacity 渐入。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-05 | 代数化简分步动画（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md step-10 中标注。
引用于：interactive-page.md step-10

【交互需求描述】
双环系统（例题2）的逐步化简动画，教师步进控制，共 4 步：
1. Step 1：内环反馈回路高亮（$G_1$ 与 $G_3$），收缩动画合并为 $G_1' = 10/(s+20)$
2. Step 2：$G_1'$ 与 $G_2$ 串联高亮，合并为 $G' = 10/[(s+20)(s+5)]$
3. Step 3：外环反馈回路高亮（$G'$ 与 $H$），收缩动画
4. Step 4：最终结果 $\Phi(s) = 10/(s^2+25s+105)$ 高亮展示

每步右侧同步显示对应的公式推导（KaTeX 渲染），变化部分用红色标注。
底部显示工程意义提示框（Step 4 完成后渐入）。

技术建议：结构图用 SVG 绘制，方框合并用 CSS scale + opacity 动画，公式区域独立渲染。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-06 | 结构图↔信号流图对照动画（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md step-12 中标注。
引用于：interactive-page.md step-12

【交互需求描述】
左右双栏对照展示，左侧为船舶航向控制系统结构图，右侧为等价信号流图：
1. 教师点击"开始转换"，结构图中的元素逐一高亮，右侧信号流图对应元素同步出现
2. 鼠标悬停任一侧元素，另一侧对应元素高亮闪烁（颜色映射一致）
3. 转换规则文字提示随当前高亮元素动态更新

颜色映射：方框 $G_c$ ↔ 支路 $G_c$（蓝色），$G_a$（绿色），$G_p$（紫色），$H$（橙色）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-07 | 梅森公式交互式求解（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md step-14 中标注。
引用于：interactive-page.md step-14

【交互需求描述】
5 节点信号流图（例题3）的梅森公式交互式求解组件：
1. 上方展示信号流图（5 节点 8 支路），节点和支路可点击
2. Step 1 — 找前向通路：学生点击节点序列标记前向通路，系统验证并高亮（绿色），自动计算 $P_k$
3. Step 2 — 找回路：学生点击节点序列标记回路，系统验证并高亮（红色），自动计算 $L_i$
4. Step 3 — 判断不接触：系统自动检测回路对的接触关系，用连线标注公共节点
5. Step 4 — 计算结果：自动代入梅森公式，逐项展示 $\Delta$、$\Delta_k$、最终结果

支持"提示"按钮：点击后高亮下一条未发现的通路/回路。
支持"自动求解"按钮：跳过手动标记，直接展示完整求解过程。

技术建议：信号流图用 SVG + D3.js 绘制，节点点击事件记录路径，路径验证逻辑在前端实现。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-08 | 等效变换拖拽练习组件（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md step-09 中标注。
引用于：interactive-page.md step-09

【交互需求描述】
拖拽式等效变换练习：
1. 展示一个结构图，引出点在方框 $G(s)$ 之后
2. 学生可拖动引出点图标到方框前方
3. 拖动完成后弹出选择题："引出支路需要串联什么补偿？"（$G$ / $1/G$ / 无需补偿）
4. 选择正确后，补偿方框自动出现在引出支路上，变换前后信号值验证动画播放
5. 支持多题切换（比较点前移、引出点后移等不同规则的练习）

技术建议：使用 react-dnd 或原生 drag API，拖拽区域限制在信号线上。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 ic-09 | AI对话分区界面（前端绘制）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
不产生媒体文件，在 interactive-page.md step-11 中标注。
引用于：interactive-page.md step-11

【交互需求描述】
左右分区界面，用于代数化简练习 + AI 验证：
- 左侧：手算草稿区，支持 LaTeX 公式输入（KaTeX 实时预览），分步填写化简过程
- 右侧：AI 对话区（初始锁定，灰色遮罩 + "完成手算后解锁"提示）
- 学生提交手算结果后，右侧解锁，预设提问按钮可一键发送验证请求
- AI 返回结果后，底部弹出反思问题卡片（3 道）
- 反思问题支持选择题和开放文本框混合

技术建议：复用平台已有的 AI 对话组件（控灵），左侧公式输入使用 mathquill 或 mathlive。

---

## 引用回写清单

| 文档 | 位置 | 插入内容 |
|:---:|:---:|:---:|
| handout.md | §2.1 基本元素表后（现有占位行44） | `![结构图基本元素示意图](../media/processed/sh-01-block-diagram-elements.svg)` |
| handout.md | §2.1 船舶结构图后（现有占位行62） | `![船舶航向控制系统结构图](../media/processed/sh-02-ship-heading-control.svg)` |
| handout.md | §2.3 等效变换规则表后（现有占位行150） | `![等效变换规则对照图](../media/processed/sh-03-equivalent-transform-rules.svg)` |
| handout.md | §2.5 信号流图转换规则后（现有占位行222） | `![信号流图示例](../media/processed/sh-04-signal-flow-graph.svg)` |
| interactive-page.md | step-03 右侧结构图区域 | 引用 sh-01 作为静态底图 |
| interactive-page.md | step-02 渐变动画终态 | 引用 sh-02 作为结构图终态 |
| interactive-page.md | step-08 规则展示区域 | 引用 sh-03 作为静态参考（动画版由 ic-04 实现） |
| interactive-page.md | step-12 右侧信号流图 | 引用 sh-04 作为静态参考（动画版由 ic-06 实现） |
