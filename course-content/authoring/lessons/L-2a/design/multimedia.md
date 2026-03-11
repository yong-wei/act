# L-2a 多模态资源设计
## 单元：三张面孔，同一系统——时域直觉速通

**生成日期**：2026-03-10
**资源总数**：5项（4幅 matplotlib 图 + 1幅 Midjourney 场景图）

---

## 资源扫描清单

- [x] **资源1**：船舶航向阶跃响应曲线（标注Mₚ、tₛ、tᵣ）→ matplotlib
- [x] **资源2**：四种极点配置与对应响应曲线族（双面板）→ matplotlib
- [x] **资源3**：ζ变化的曲线族（5条，0.1~1.0）→ matplotlib
- [x] **资源4**：ωₙ变化的曲线族（4条）→ matplotlib
- [x] **资源5**：船舶转向引入场景图（Midjourney）

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 #1 | 船舶航向阶跃响应曲线（带标注）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**所在讲义位置**：Section 一 / 引入案例
**资源类型**：Python matplotlib 图表
**用途**：讲义正文插图；帮助学生在具体工程场景中识读三个性能指标

【场景描述（中文）】
横轴时间（s），纵轴航向角（°），目标值10°。曲线从0起步，约t=25s时到达9°（上升时间），在t≈30s冲至约12°（峰值），随后振荡衰减，t≈90s进入±2%误差带（调节时间）。图上需用箭头和标注明确标出：tᵣ（10%~90%区间）、Mₚ（峰值超出量）、tₛ（进入误差带时刻）、±2%误差带的虚线。配色：曲线用深蓝色，误差带用灰色填充，标注用红色。

【Python 代码草稿】
```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal
import matplotlib.patches as patches

# 设定中文字体（根据系统调整）
plt.rcParams['font.family'] = ['SimHei', 'Arial']
plt.rcParams['axes.unicode_minus'] = False

# 二阶系统参数（对应船舶案例）
zeta = 0.45  # 阻尼比（对应约20%超调）
omega_n = 0.18  # 自然频率 rad/s（对应ts≈90s）

# 构建传递函数并计算阶跃响应
num = [omega_n**2]
den = [1, 2*zeta*omega_n, omega_n**2]
sys = signal.TransferFunction(num, den)
t = np.linspace(0, 150, 1000)
t, y = signal.step(sys, T=t)
y_final = 10.0  # 目标航向（°）
y_response = y * y_final

# 找关键时间点
y_90 = 0.9 * y_final
y_10 = 0.1 * y_final
idx_10 = np.argmax(y_response >= y_10)
idx_90 = np.argmax(y_response >= y_90)
t_r = t[idx_90] - t[idx_10]

y_max = np.max(y_response)
t_peak = t[np.argmax(y_response)]
Mp = (y_max - y_final) / y_final * 100

band = 0.02 * y_final
for i in range(len(y_response)-1, -1, -1):
    if abs(y_response[i] - y_final) > band:
        t_s = t[i+1] if i+1 < len(t) else t[-1]
        break

fig, ax = plt.subplots(figsize=(10, 5))

# 误差带填充
ax.axhspan(y_final - band, y_final + band, alpha=0.15, color='gray', label='±2% 误差带')

# 目标值虚线
ax.axhline(y=y_final, color='gray', linestyle='--', linewidth=1, alpha=0.7)

# 响应曲线
ax.plot(t, y_response, color='#1a6bb5', linewidth=2.5, label=f'航向角响应 (ζ={zeta}, ωₙ={omega_n})')

# 标注 Mₚ
ax.annotate('', xy=(t_peak, y_max), xytext=(t_peak, y_final),
            arrowprops=dict(arrowstyle='<->', color='red', lw=1.5))
ax.text(t_peak + 2, (y_max + y_final) / 2, f'$M_p$ ≈ {Mp:.0f}%', color='red', fontsize=11)

# 标注 tᵣ（用括号标记10%~90%区间）
ax.annotate('', xy=(t[idx_90], y_90), xytext=(t[idx_10], y_10),
            arrowprops=dict(arrowstyle='<->', color='darkorange', lw=1.5))
ax.text((t[idx_10] + t[idx_90])/2, y_10 - 0.8,
        f'$t_r$ ≈ {t_r:.0f}s', color='darkorange', fontsize=11, ha='center')

# 标注 tₛ
ax.axvline(x=t_s, color='red', linestyle=':', linewidth=1.5)
ax.text(t_s + 1, 2, f'$t_s$ ≈ {t_s:.0f}s', color='red', fontsize=11)

ax.set_xlabel('时间 (s)', fontsize=12)
ax.set_ylabel('航向角 (°)', fontsize=12)
ax.set_title('船舶航向控制 — 阶跃响应曲线（目标：右转10°）', fontsize=13)
ax.set_xlim(0, 150)
ax.set_ylim(-1, 14)
ax.legend(fontsize=10, loc='lower right')
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('step_response_ship.png', dpi=150)
plt.show()
```

【替代方案】
若代码运行环境受限：用 Python turtle 绘制简化示意图，或直接从 MATLAB Control System Toolbox 导出图片。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 #2 | 四种极点配置与响应曲线族（双面板）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**所在讲义位置**：Section 二 / 响应曲线的四个家族
**资源类型**：Python matplotlib 图表（2×4 双面板）
**用途**：直观建立"极点位置↔响应形状"的跨域映射直觉

【场景描述（中文）】
左列（列1）：四张子图，显示复平面上的极点位置（×标记）
右列（列2）：四张对应子图，显示对应的阶跃响应曲线
四行分别对应：①过阻尼（两负实极点）②欠阻尼（共轭复极点，左半平面）③临界稳定（虚轴上）④不稳定（右半平面）
配色：稳定系统用蓝色，临界用橙色，不稳定用红色。

【Python 代码草稿】
```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

plt.rcParams['font.family'] = ['SimHei', 'Arial']
plt.rcParams['axes.unicode_minus'] = False

fig, axes = plt.subplots(4, 2, figsize=(12, 14))
fig.suptitle('极点位置与对应时域响应', fontsize=14, y=0.98)

cases = [
    {'label': '①过阻尼（两负实极点）',
     'poles': [(-1, 0), (-3, 0)],
     'num': [3], 'den': [1, 4, 3],  # (s+1)(s+3)
     'color': '#1a6bb5', 'stable': True},
    {'label': '②欠阻尼（共轭复极点，左半平面）',
     'poles': [(-0.5, 2), (-0.5, -2)],
     'num': [4.25], 'den': [1, 1, 4.25],
     'color': '#1a6bb5', 'stable': True},
    {'label': '③临界稳定（虚轴上）',
     'poles': [(0, 2), (0, -2)],
     'num': [4], 'den': [1, 0, 4],
     'color': '#e07b00', 'stable': False},
    {'label': '④不稳定（右半平面极点）',
     'poles': [(0.5, 2), (0.5, -2)],
     'num': [4.25], 'den': [1, -1, 4.25],  # 正号系数
     'color': '#c0392b', 'stable': False},
]

t = np.linspace(0, 12, 500)

for i, case in enumerate(cases):
    # 左列：极点位置
    ax_left = axes[i, 0]
    ax_left.axhline(0, color='k', lw=0.8)
    ax_left.axvline(0, color='k', lw=0.8)
    for p in case['poles']:
        ax_left.plot(p[0], p[1], 'x', markersize=12,
                    markeredgewidth=2.5, color=case['color'])
    ax_left.set_xlim(-5, 2)
    ax_left.set_ylim(-3.5, 3.5)
    ax_left.set_xlabel('实部 σ', fontsize=9)
    ax_left.set_ylabel('虚部 jω', fontsize=9)
    ax_left.set_title(f'{case["label"]}\n复平面极点位置', fontsize=9)
    ax_left.grid(True, alpha=0.3)
    ax_left.fill_betweenx([-3.5, 3.5], -5, 0, alpha=0.05, color='green')

    # 右列：时域响应
    ax_right = axes[i, 1]
    try:
        sys = signal.TransferFunction(case['num'], case['den'])
        _, y = signal.step(sys, T=t)
        y_plot = np.clip(y, -2, 5)  # 防止发散过大
        ax_right.plot(t, y_plot, color=case['color'], linewidth=2)
        if case['stable']:
            ax_right.axhline(1, color='gray', linestyle='--', lw=1, alpha=0.7)
    except:
        ax_right.text(0.5, 0.5, '（发散，截断显示）',
                     ha='center', va='center', transform=ax_right.transAxes)
    ax_right.set_xlabel('时间 (s)', fontsize=9)
    ax_right.set_ylabel('响应', fontsize=9)
    ax_right.set_title(f'{case["label"]}\n时域响应', fontsize=9)
    ax_right.grid(True, alpha=0.3)

plt.tight_layout(rect=[0, 0, 1, 0.96])
plt.savefig('four_families.png', dpi=150)
plt.show()
```

【替代方案】
若需要更精美的双面板联动效果，可使用 Manim 制作动画版本（极点移动时曲线实时变化），适合互动页面嵌入。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 #3 | ζ 变化曲线族（5条，固定 ωₙ）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**所在讲义位置**：Section 四 / 4.4 响应族：直观对比（图2）
**资源类型**：Python matplotlib 图表
**用途**：直观展示 ζ 改变曲线形状但不改变时间尺度参考

【场景描述（中文）】
5条曲线，ζ = 0.1、0.3、0.5、0.7、1.0，ωₙ = 2 rad/s 固定。颜色从深到浅（ζ小→大）。图例标注每条曲线的 ζ 值和对应 Mₚ 近似值。用虚线标出稳态值1.0。特别标注 ζ=0.7 曲线（工程黄金点，用加粗线区分）。

【Python 代码草稿】
```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

plt.rcParams['font.family'] = ['SimHei', 'Arial']
plt.rcParams['axes.unicode_minus'] = False

omega_n = 2.0  # rad/s，固定
zetas = [0.1, 0.3, 0.5, 0.7, 1.0]
colors = ['#d62728', '#ff7f0e', '#2ca02c', '#1f77b4', '#7f7f7f']
t = np.linspace(0, 15, 1000)

# 理论超调量
def Mp_theory(z):
    if z >= 1:
        return 0
    return np.exp(-np.pi * z / np.sqrt(1 - z**2)) * 100

fig, ax = plt.subplots(figsize=(9, 5.5))

for z, c in zip(zetas, colors):
    num = [omega_n**2]
    den = [1, 2*z*omega_n, omega_n**2]
    sys = signal.TransferFunction(num, den)
    _, y = signal.step(sys, T=t)
    mp = Mp_theory(z)
    lw = 3.0 if z == 0.7 else 1.8
    label = f'ζ = {z}，$M_p$ ≈ {mp:.0f}%'
    if z == 0.7:
        label += '  ← 工程黄金点'
    ax.plot(t, y, color=c, linewidth=lw, label=label)

ax.axhline(1.0, color='k', linestyle='--', linewidth=1, alpha=0.5)
ax.axhline(1.02, color='gray', linestyle=':', linewidth=0.8, alpha=0.7)
ax.axhline(0.98, color='gray', linestyle=':', linewidth=0.8, alpha=0.7, label='±2% 误差带')

ax.set_xlabel('时间 (s)', fontsize=12)
ax.set_ylabel('归一化响应', fontsize=12)
ax.set_title(f'阻尼比 ζ 对响应的影响（ωₙ = {omega_n} rad/s 固定）', fontsize=13)
ax.set_xlim(0, 15)
ax.set_ylim(0, 1.7)
ax.legend(fontsize=10, loc='upper right')
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('zeta_family.png', dpi=150)
plt.show()
```

【替代方案】
用 Desmos（在线交互工具）可生成可调 ζ 的实时曲线，适合学生自主探索（与课后思考题联动）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 #4 | ωₙ 变化曲线族（4条，固定 ζ）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**所在讲义位置**：Section 四 / 4.4 响应族：直观对比（图3）
**资源类型**：Python matplotlib 图表
**用途**：展示 ωₙ 只改变时间尺度（曲线形状不变，仅压缩/拉伸）

【场景描述（中文）】
4条曲线，ωₙ = 0.5、1、2、4 rad/s，ζ = 0.5 固定。统一时间窗口（0~30s），不归一化。关键视觉效果：4条曲线形状相似（超调比例相同），但快的曲线在相同窗口内振荡次数更多，直接体现"自然频率"的含义。图注说明此现象。

【Python 代码草稿】
```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

plt.rcParams['font.family'] = ['SimHei', 'Arial']
plt.rcParams['axes.unicode_minus'] = False

zeta = 0.5  # 固定
omegas = [0.5, 1.0, 2.0, 4.0]
colors = ['#7f7f7f', '#1f77b4', '#2ca02c', '#d62728']
t = np.linspace(0, 30, 2000)

fig, ax = plt.subplots(figsize=(9, 5.5))

for omega, c in zip(omegas, colors):
    num = [omega**2]
    den = [1, 2*zeta*omega, omega**2]
    sys = signal.TransferFunction(num, den)
    _, y = signal.step(sys, T=t)
    ax.plot(t, y, color=c, linewidth=2,
            label=f'ωₙ = {omega} rad/s')

ax.axhline(1.0, color='k', linestyle='--', linewidth=1, alpha=0.5)
ax.text(28, 1.03, '稳态值', fontsize=9, color='gray')

ax.set_xlabel('时间 (s)（统一窗口，不归一化）', fontsize=12)
ax.set_ylabel('归一化响应', fontsize=12)
ax.set_title(f'自然频率 ωₙ 对响应的影响（ζ = {zeta} 固定）\n— 形状不变，时间尺度随 ωₙ 压缩', fontsize=13)
ax.set_xlim(0, 30)
ax.set_ylim(0, 1.5)
ax.legend(fontsize=10, loc='lower right')
ax.grid(True, alpha=0.3)

# 添加说明文字
ax.annotate('同一时间窗口内\nωₙ=4的曲线振荡次数最多\n→ 这就是"自然频率"的直觉',
           xy=(8, 1.3), fontsize=9, color='#d62728',
           bbox=dict(boxstyle='round,pad=0.3', facecolor='lightyellow', edgecolor='orange'))

plt.tight_layout()
plt.savefig('omega_family.png', dpi=150)
plt.show()
```

【替代方案】
若需要动态演示 ωₙ 连续变化的效果，可使用 matplotlib.animation 制作 GIF 动画，适合互动页面。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资源 #5 | 船舶转向引入场景图
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**所在讲义位置**：Section 一 / 引入案例（可选，讲义中已有文字，图为增强）
**资源类型**：Midjourney 场景图片
**用途**：课件封面或章节引入，建立工程背景的视觉感知

【场景描述（中文）】
俯视角度的货船在平静海面右转10°航向，船尾激起转向浪花，船头方向有轻微的"超过目标后回正"的航迹痕迹（弧线轨迹），体现阶跃响应超调的物理直觉。画面风格偏写实，蓝色海面，白色船体，灰色天空，光线自然。

【AI 生成提示词（英文）】
主工具：Midjourney v6
Prompt：
"""
Aerial top-down view of a large cargo ship making a precise 10-degree starboard turn on calm blue ocean,
wake pattern showing slight overshoot in the turning trajectory before stabilizing on new heading,
white ship hull with bridge superstructure visible, subtle curved wake trail indicating oscillating
course correction, photorealistic maritime photography style, overcast natural lighting,
cinematic composition, --ar 16:9 --style raw --v 6
"""

【替代方案】
若 Midjourney 效果不理想：使用 Freepik / Unsplash 搜索 "cargo ship turning" 关键词获取版权友好图片，添加航迹轨迹标注后使用；或改用课件中常见的船舶俯视简笔示意图（2-3分钟可在 PowerPoint 绘制）。

---

## 制作优先级建议

| 优先级 | 资源 | 原因 |
|:------:|------|------|
| P1 | 资源#1（船舶响应曲线） | 讲义核心引入，必须 |
| P1 | 资源#3（ζ曲线族） | 课后思考题直接引用 |
| P1 | 资源#4（ωₙ曲线族） | 课后思考题直接引用 |
| P2 | 资源#2（四族双面板） | 重要直觉，可用简化版 |
| P3 | 资源#5（场景图片） | 美化效果，可用文字代替 |
