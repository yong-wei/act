# 单元 1-1 多模态资源设计 | 拉氏变换与传递函数

> **资源总数**：8 项
> **生成方式分布**：代码直出图 5 项，位图（AI生成）1 项，互动前端绘制 2 项

---

## 资源总表

| 序号 | 文件名 | 用途 | 生成方式 | 用于文档 | 描述 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | h-01-spring-mass-damper.py | 讲义 | 代码直出图 | handout.md 例题3 | 弹簧-质量-阻尼器系统示意图 |
| 2 | h-02-laplace-transform-flow.py | 讲义 | 代码直出图 | handout.md §2.1 | 拉氏变换降维流程图 |
| 3 | h-03-pole-response-family.py | 讲义 | 代码直出图 | handout.md §2.4 | 四种极点类型对应的响应曲线 |
| 4 | h-04-typical-elements.py | 讲义 | 代码直出图 | handout.md §2.5 | 五种典型环节的阶跃响应对比 |
| 5 | h-05-rc-circuit.py | 讲义 | 代码直出图 | handout.md 例题1 | RC低通电路示意图 |
| 6 | sh-01-mason-portrait.txt | 共用 | 位图（AI生成） | handout.md §四 | 梅森教授人物肖像（教学场景） |
| 7 | ic-05-pole-response-panel | 互动 | 前端绘制 | interactive-page.md 步骤10 | 极点-响应联动面板 |
| 8 | ic-06-typical-element-slider | 互动 | 前端绘制 | interactive-page.md 步骤13 | 典型环节参数滑块面板 |

---

## 资源制作规格

### h-01 弹簧-质量-阻尼器系统示意图

- **文件**：`media/raw/h-01-spring-mass-damper.py`
- **产出**：`media/processed/h-01-spring-mass-damper.svg`
- **内容描述**：水平放置的弹簧-质量-阻尼器系统。左侧固定墙，弹簧（锯齿形）和阻尼器（活塞形）并联连接到质量块 $m$。外力 $f(t)$ 从右侧作用于质量块，位移 $x(t)$ 标注在质量块上方。标注 $k$（弹簧）、$b$（阻尼器）、$m$（质量块）。
- **尺寸**：宽 600px，高 250px
- **配色**：弹簧蓝色，阻尼器红色，质量块灰色，力箭头绿色

```python
# h-01-spring-mass-damper.py
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np

fig, ax = plt.subplots(1, 1, figsize=(8, 3.5))

# 固定墙
ax.add_patch(patches.Rectangle((-0.5, 0), 0.3, 3, hatch='///', facecolor='lightgray', edgecolor='black'))

# 弹簧（锯齿形）
spring_x = np.array([0, 0.3, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 1.9, 2.0])
spring_y_top = np.array([2.3, 2.3, 2.6, 2.0, 2.6, 2.0, 2.6, 2.0, 2.6, 2.3, 2.3])
ax.plot(spring_x - 0.2, spring_y_top, 'b-', linewidth=2)
ax.text(0.9, 2.8, '$k$', fontsize=14, ha='center', color='blue')

# 阻尼器（活塞形）
ax.plot([0, 0.6], [0.8, 0.8], 'r-', linewidth=2)
ax.plot([0.6, 0.6], [0.5, 1.1], 'r-', linewidth=2)
ax.add_patch(patches.Rectangle((0.6, 0.55), 0.8, 0.5, facecolor='white', edgecolor='red', linewidth=2))
ax.plot([1.4, 2.0], [0.8, 0.8], 'r-', linewidth=2)
ax.text(0.9, 0.15, '$b$', fontsize=14, ha='center', color='red')

# 质量块
ax.add_patch(patches.FancyBboxPatch((2.0, 0.2), 1.0, 2.2, boxstyle="round,pad=0.05",
                                      facecolor='#cccccc', edgecolor='black', linewidth=2))
ax.text(2.5, 1.3, '$m$', fontsize=16, ha='center', va='center', fontweight='bold')

# 外力箭头
ax.annotate('', xy=(3.8, 1.3), xytext=(3.1, 1.3),
            arrowprops=dict(arrowstyle='->', color='green', lw=2.5))
ax.text(3.9, 1.3, '$f(t)$', fontsize=14, ha='left', color='green')

# 位移标注
ax.annotate('', xy=(3.0, 2.8), xytext=(2.0, 2.8),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
ax.text(2.5, 3.05, '$x(t)$', fontsize=14, ha='center')

ax.set_xlim(-0.8, 4.5)
ax.set_ylim(-0.3, 3.5)
ax.set_aspect('equal')
ax.axis('off')
plt.tight_layout()
plt.savefig('../processed/h-01-spring-mass-damper.svg', format='svg', bbox_inches='tight')
plt.show()
```

### h-02 拉氏变换降维流程图

- **文件**：`media/raw/h-02-laplace-transform-flow.py`
- **产出**：`media/processed/h-02-laplace-transform-flow.svg`
- **内容描述**：四步循环流程图。左上"时域微分方程"，右上"s域代数方程"，右下"s域解 Y(s)"，左下"时域解 y(t)"。四条箭头：上→拉氏变换，右→代数求解，下→拉氏反变换，左→（虚线）直接求解（困难）。
- **尺寸**：宽 500px，高 400px

```python
# h-02-laplace-transform-flow.py
import matplotlib.pyplot as plt
import matplotlib.patches as patches

fig, ax = plt.subplots(figsize=(7, 5.5))

# 四个方框
boxes = {
    'tl': (0.5, 3.5, '时域微分方程\n$a_n y^{(n)} + \\cdots = b_m u^{(m)} + \\cdots$'),
    'tr': (5.0, 3.5, '$s$域代数方程\n$A(s)Y(s) = B(s)U(s)$'),
    'br': (5.0, 0.5, '$s$域解\n$Y(s) = G(s) \\cdot U(s)$'),
    'bl': (0.5, 0.5, '时域解\n$y(t) = \\mathcal{L}^{-1}[Y(s)]$'),
}

for key, (x, y, text) in boxes.items():
    ax.add_patch(patches.FancyBboxPatch((x-0.1, y-0.1), 3.2, 1.2,
                 boxstyle="round,pad=0.1", facecolor='#e8f4fd', edgecolor='#2196F3', linewidth=2))
    ax.text(x + 1.5, y + 0.5, text, fontsize=10, ha='center', va='center')

# 箭头
ax.annotate('', xy=(4.8, 4.1), xytext=(3.8, 4.1),
            arrowprops=dict(arrowstyle='->', color='#4CAF50', lw=2.5))
ax.text(4.3, 4.45, '拉氏变换', fontsize=11, ha='center', color='#4CAF50', fontweight='bold')

ax.annotate('', xy=(6.6, 1.8), xytext=(6.6, 3.4),
            arrowprops=dict(arrowstyle='->', color='#2196F3', lw=2.5))
ax.text(7.3, 2.6, '代数求解', fontsize=11, ha='center', color='#2196F3', fontweight='bold', rotation=90)

ax.annotate('', xy=(3.8, 1.1), xytext=(4.8, 1.1),
            arrowprops=dict(arrowstyle='->', color='#FF9800', lw=2.5))
ax.text(4.3, 0.7, '拉氏反变换', fontsize=11, ha='center', color='#FF9800', fontweight='bold')

ax.annotate('', xy=(1.5, 1.8), xytext=(1.5, 3.4),
            arrowprops=dict(arrowstyle='->', color='gray', lw=1.5, linestyle='dashed'))
ax.text(0.3, 2.6, '直接求解\n（困难）', fontsize=10, ha='center', color='gray', rotation=90)

ax.set_xlim(-0.5, 8.5)
ax.set_ylim(-0.2, 5.2)
ax.axis('off')
plt.tight_layout()
plt.savefig('../processed/h-02-laplace-transform-flow.svg', format='svg', bbox_inches='tight')
plt.show()
```

### h-03 四种极点类型对应的响应曲线

- **文件**：`media/raw/h-03-pole-response-family.py`
- **产出**：`media/processed/h-03-pole-response-family.svg`
- **内容描述**：2×2 子图，每个子图展示一种极点类型的阶跃响应。左上：负实极点（单调上升）；右上：共轭复极点（振荡衰减）；左下：纯虚极点（持续振荡）；右下：正实部极点（发散）。每个子图标注极点位置和对应的 L-2a 家族编号。

```python
# h-03-pole-response-family.py
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

fig, axes = plt.subplots(2, 2, figsize=(10, 8))
t = np.linspace(0, 10, 1000)

# 家族1：负实极点 p=-2
sys1 = signal.TransferFunction([2], [1, 2])
_, y1 = signal.step(sys1, T=t)
axes[0,0].plot(t, y1, 'b-', linewidth=2)
axes[0,0].set_title('家族1：负实极点 $p=-2$\n单调上升', fontsize=12)
axes[0,0].axhline(y=1, color='gray', linestyle='--', alpha=0.5)
axes[0,0].set_xlabel('$t$ (s)')
axes[0,0].set_ylabel('$y(t)$')
axes[0,0].grid(True, alpha=0.3)

# 家族2：共轭复极点 p=-1±2j
sys2 = signal.TransferFunction([5], [1, 2, 5])
_, y2 = signal.step(sys2, T=t)
axes[0,1].plot(t, y2, 'r-', linewidth=2)
axes[0,1].set_title('家族2：共轭复极点 $p=-1\\pm 2j$\n振荡衰减', fontsize=12)
axes[0,1].axhline(y=1, color='gray', linestyle='--', alpha=0.5)
axes[0,1].set_xlabel('$t$ (s)')
axes[0,1].set_ylabel('$y(t)$')
axes[0,1].grid(True, alpha=0.3)

# 家族3：纯虚极点 p=±2j
sys3 = signal.TransferFunction([4], [1, 0, 4])
_, y3 = signal.step(sys3, T=t)
axes[1,0].plot(t, y3, 'g-', linewidth=2)
axes[1,0].set_title('家族3：纯虚极点 $p=\\pm 2j$\n持续振荡', fontsize=12)
axes[1,0].axhline(y=1, color='gray', linestyle='--', alpha=0.5)
axes[1,0].set_xlabel('$t$ (s)')
axes[1,0].set_ylabel('$y(t)$')
axes[1,0].grid(True, alpha=0.3)

# 家族4：正实部极点 p=+0.5
t4 = np.linspace(0, 5, 500)
sys4 = signal.TransferFunction([-0.5], [1, -0.5])
_, y4 = signal.step(sys4, T=t4)
axes[1,1].plot(t4, y4, 'm-', linewidth=2)
axes[1,1].set_title('家族4：正实部极点 $p=+0.5$\n发散', fontsize=12)
axes[1,1].set_xlabel('$t$ (s)')
axes[1,1].set_ylabel('$y(t)$')
axes[1,1].grid(True, alpha=0.3)

plt.suptitle('四种极点类型与响应家族', fontsize=14, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('../processed/h-03-pole-response-family.svg', format='svg', bbox_inches='tight')
plt.show()
```

### h-04 五种典型环节的阶跃响应对比

- **文件**：`media/raw/h-04-typical-elements.py`
- **产出**：`media/processed/h-04-typical-elements.svg`
- **内容描述**：单图多曲线，展示比例、积分、惯性、振荡四种环节的阶跃响应（微分环节为脉冲，单独小图）。

```python
# h-04-typical-elements.py
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5), gridspec_kw={'width_ratios': [3, 1]})
t = np.linspace(0, 8, 1000)

# 比例环节 G(s)=2
y_prop = 2 * np.ones_like(t)
ax1.plot(t, y_prop, 'k-', linewidth=2, label='比例 $G=2$')

# 积分环节 G(s)=1/s
y_int = t
ax1.plot(t, y_int, 'b--', linewidth=2, label='积分 $G=1/s$')

# 惯性环节 G(s)=1/(s+1)
sys_inertia = signal.TransferFunction([1], [1, 1])
_, y_inertia = signal.step(sys_inertia, T=t)
ax1.plot(t, y_inertia, 'r-', linewidth=2, label='惯性 $G=1/(s+1)$')

# 振荡环节 G(s)=4/(s^2+s+4)
sys_osc = signal.TransferFunction([4], [1, 1, 4])
_, y_osc = signal.step(sys_osc, T=t)
ax1.plot(t, y_osc, 'g-', linewidth=2, label='振荡 $G=4/(s^2+s+4)$')

ax1.set_xlabel('$t$ (s)', fontsize=12)
ax1.set_ylabel('$y(t)$', fontsize=12)
ax1.set_title('典型环节阶跃响应对比', fontsize=13, fontweight='bold')
ax1.legend(fontsize=11, loc='upper left')
ax1.grid(True, alpha=0.3)
ax1.set_ylim(-0.5, 8.5)

# 微分环节（脉冲响应）
t_diff = np.linspace(-0.5, 3, 500)
y_diff = np.zeros_like(t_diff)
y_diff[np.argmin(np.abs(t_diff))] = 10  # 脉冲近似
ax2.stem([0], [1], linefmt='m-', markerfmt='mo', basefmt='k-')
ax2.set_xlabel('$t$ (s)', fontsize=12)
ax2.set_ylabel('$y(t)$', fontsize=12)
ax2.set_title('微分 $G=s$\n（脉冲响应）', fontsize=12, fontweight='bold')
ax2.grid(True, alpha=0.3)
ax2.set_xlim(-0.5, 2)

plt.tight_layout()
plt.savefig('../processed/h-04-typical-elements.svg', format='svg', bbox_inches='tight')
plt.show()
```

### h-05 RC低通电路示意图

- **文件**：`media/raw/h-05-rc-circuit.py`
- **产出**：`media/processed/h-05-rc-circuit.svg`
- **内容描述**：简单RC低通电路。输入电压 $u_i(t)$ 在左侧，电阻 $R$ 水平放置，电容 $C$ 竖直放置，输出电压 $u_o(t)$ 在电容两端。标注电流方向。
- **尺寸**：宽 400px，高 250px

```python
# h-05-rc-circuit.py
# 使用 schemdraw 或 matplotlib 绘制
# 此处提供 matplotlib 版本
import matplotlib.pyplot as plt
import matplotlib.patches as patches

fig, ax = plt.subplots(figsize=(6, 4))

# 输入端
ax.plot([0, 1], [3, 3], 'k-', linewidth=2)
ax.text(-0.3, 3, '$u_i(t)$', fontsize=14, ha='right', va='center')
ax.text(-0.3, 0, '$-$', fontsize=14, ha='right', va='center')
ax.text(-0.3, 3.2, '$+$', fontsize=12, ha='right', va='bottom')

# 电阻
ax.add_patch(patches.FancyBboxPatch((1, 2.7), 2, 0.6,
             boxstyle="square,pad=0", facecolor='white', edgecolor='black', linewidth=2))
ax.text(2, 3, '$R$', fontsize=14, ha='center', va='center')

# 连接线
ax.plot([3, 4.5], [3, 3], 'k-', linewidth=2)
ax.plot([4.5, 4.5], [3, 2], 'k-', linewidth=2)

# 电容
ax.plot([4.0, 5.0], [2, 2], 'k-', linewidth=3)
ax.plot([4.0, 5.0], [1.5, 1.5], 'k-', linewidth=3)
ax.text(5.3, 1.75, '$C$', fontsize=14, ha='left', va='center')

# 下方连接
ax.plot([4.5, 4.5], [1.5, 0], 'k-', linewidth=2)
ax.plot([0, 4.5], [0, 0], 'k-', linewidth=2)
ax.plot([0, 0], [0, 3], 'k-', linewidth=2)

# 输出标注
ax.text(5.5, 3, '$+$', fontsize=12, ha='left', va='bottom')
ax.text(5.5, 0, '$-$', fontsize=12, ha='left', va='top')
ax.annotate('', xy=(5.5, 2.8), xytext=(5.5, 0.2),
            arrowprops=dict(arrowstyle='<->', color='red', lw=1.5))
ax.text(6.0, 1.5, '$u_o(t)$', fontsize=14, ha='left', va='center', color='red')

# 电流方向
ax.annotate('', xy=(2.5, 3.6), xytext=(1.5, 3.6),
            arrowprops=dict(arrowstyle='->', color='blue', lw=1.5))
ax.text(2.0, 3.85, '$i(t)$', fontsize=12, ha='center', color='blue')

ax.set_xlim(-1, 7)
ax.set_ylim(-0.5, 4.5)
ax.set_aspect('equal')
ax.axis('off')
plt.tight_layout()
plt.savefig('../processed/h-05-rc-circuit.svg', format='svg', bbox_inches='tight')
plt.show()
```

### sh-01 梅森教授人物肖像

- **文件**：`media/raw/sh-01-mason-portrait.txt`
- **产出**：`media/processed/sh-01-mason-portrait.png`
- **生成方式**：AI 生图
- **场景描述**：1960年代 MIT 教室场景，一位中年男性教授站在黑板前，黑板上画着信号流图。教授穿着衬衫打领带，表情温和而专注，正在向学生讲解。教室氛围温暖，有自然光从窗户照入。
- **英文生图提示词**：

```
A warm 1960s MIT classroom scene. A middle-aged male professor in a white dress shirt and tie stands at a large blackboard covered with signal flow graph diagrams. He gestures toward the board with chalk in hand, his expression warm and focused. Soft natural light streams through tall windows. The atmosphere is scholarly yet inviting. Photorealistic style, warm color palette, 16:9 aspect ratio.
```

### ic-05 极点-响应联动面板（前端绘制需求）

- **类型**：互动前端组件
- **无媒体文件**，由前端实时绘制
- **功能需求**：
  1. 左侧 $s$ 平面（复平面网格），可拖动极点标记
  2. 右侧实时阶跃响应曲线（随极点位置变化实时更新）
  3. 底部极点类型标签自动识别（负实/共轭复/纯虚/正实）
  4. 四个预设场景快捷按钮
  5. 支持添加/删除零点（步骤11扩展）
- **技术建议**：使用 React + D3.js 或 Recharts，阶跃响应通过前端数值积分计算

### ic-06 典型环节参数滑块面板（前端绘制需求）

- **类型**：互动前端组件
- **无媒体文件**，由前端实时绘制
- **功能需求**：
  1. 环节选择器（比例/积分/惯性/振荡/微分）
  2. 参数滑块（惯性：$T$ 滑块；振荡：$\omega_n$ 和 $\zeta$ 双滑块）
  3. 实时阶跃响应曲线
  4. 传递函数公式实时更新显示
  5. 极点位置在 $s$ 平面上实时标注
- **技术建议**：复用 ic-05 的绘图引擎

---

## 引用回写清单

以下引用路径需插入对应文档：

| 文件 | 插入位置 | 引用 |
|:---:|:---:|:---:|
| handout.md | §2.1 降维逻辑后 | `![拉氏变换降维流程](../media/processed/h-02-laplace-transform-flow.svg)` |
| handout.md | §2.4 极点对应表后 | `![四种极点类型与响应家族](../media/processed/h-03-pole-response-family.svg)` |
| handout.md | §2.5 典型环节表后 | `![典型环节阶跃响应对比](../media/processed/h-04-typical-elements.svg)` |
| handout.md | 例题1 RC电路 | `![RC低通电路](../media/processed/h-05-rc-circuit.svg)` |
| handout.md | 例题3 弹簧系统 | `![弹簧-质量-阻尼器系统](../media/processed/h-01-spring-mass-damper.svg)` |
| handout.md | §四 梅森 | `![梅森教授](../media/processed/sh-01-mason-portrait.png)` |
