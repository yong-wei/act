# 多模态资源设计 | 单元 L-∑：设计可行域——让约束成为指南针

**生成日期**：2026-03-14
**资源总数**：9 项（全部为代码直出图）

---

## 资源总表

| 编号 | 用途前缀 | 文件名 | 简短描述 | 生成方式 | 引用于 | 优先级 |
|------|----------|--------|----------|----------|--------|--------|
| 01 | sh | sh-01-feasible-region-mp | 超调量约束图（阻尼比射线63°） | 代码直出 | handout §2.1 / interactive step-07 | P1 |
| 02 | sh | sh-02-feasible-region-ts | 调节时间约束图（实部垂线叠加） | 代码直出 | handout §2.1 / interactive step-07 | P1 |
| 03 | sh | sh-03-feasible-region-full | 复平面可行域全图（A/B/C三点） | 代码直出 | handout §2.2 / interactive step-07、step-08 | P1 |
| 04 | h | h-04-root-locus-feasible-arc | 根轨迹可行弧段图 | 代码直出 | handout §3.1 / interactive step-08 | P1 |
| 05 | h | h-05-time-domain-envelope | 时域响应包络图 | 代码直出 | handout §3.2 / interactive step-09 | P1 |
| 06 | h | h-06-bode-feasible-band | 频域可行带图（Bode幅频） | 代码直出 | handout §3.3 / interactive step-09 | P2 |
| 07 | h | h-07-example1-root-locus | 例题1根轨迹图（叠加可行域） | 代码直出 | handout §4例题1 / interactive step-11 | P1 |
| 08 | h | h-08-feasible-region-comparison | 可行域收窄对比图（例题2） | 代码直出 | handout §4例题2 | P2 |
| 09 | ic | ic-09-posttest-complex-plane | 后测题2用复平面图（A/B/C三点） | 代码直出 | interactive step-13 | P2 |

---

## 资源 sh-01 | 超调量约束图（阻尼比射线63°）

```
文件名：sh-01-feasible-region-mp.py / .svg
存放：raw/sh-01-feasible-region-mp.py → processed/sh-01-feasible-region-mp.svg
引用于：handout §2.1 / interactive-page step-07 阶段一
```

**图片内容描述**

复平面图。横轴 Re(s)（范围 -3 ~ 0.5），纵轴 Im(s)（范围 -2.5 ~ 2.5）。
- 从原点出发、与负实轴成 63° 的射线（上下各一条，对称），深蓝色实线
- 射线下方至负实轴的扇形区域（夹角 < 63°）填充浅蓝色（alpha=0.25），标注"满足 Mp ≤ 20%"
- 标注角度 63°（从负实轴到射线，弧线标注）
- 射线上方标注"×"（超调超标区），射线下方标注"•"（满足约束区）
- 图例：射线标注"ζ = 0.45，θ = 63°"

```python
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)
r = 2.8

# 阻尼比射线
ax.plot([-r*np.cos(theta), 0], [r*np.sin(theta), 0], 'b-', linewidth=2,
        label=r'$\zeta=0.45,\ \theta=63°$')
ax.plot([-r*np.cos(theta), 0], [-r*np.sin(theta), 0], 'b-', linewidth=2)

# 填充可行扇形区域
angles = np.linspace(-theta, theta, 300)
poly_x = [0] + list(-r * np.cos(angles)) + [0]
poly_y = [0] + list(r * np.sin(angles)) + [0]
ax.fill(poly_x, poly_y, color='#4a90d9', alpha=0.20)
# 延伸至左侧边界
rect_x = [-r*np.cos(theta), -3, -3, -r*np.cos(theta)]
rect_y  = [r*np.sin(theta), 2.5, -2.5, -r*np.sin(theta)]
ax.fill(rect_x, rect_y, color='#4a90d9', alpha=0.20)

# 角度标注
angle_arc = mpatches.Arc((0, 0), 0.8, 0.8, angle=0,
                          theta1=180-63, theta2=180, color='gray', linewidth=1.2)
ax.add_patch(angle_arc)
ax.text(-0.55, 0.22, '63°', fontsize=10, color='gray')

# 代表点
ax.plot(-0.8, 1.8, 'rx', markersize=10, markeredgewidth=2)
ax.text(-0.7, 1.9, '超调超标', fontsize=9, color='red')
ax.plot(-1.5, 0.5, 'g.', markersize=14)
ax.text(-1.4, 0.6, '满足约束', fontsize=9, color='green')

ax.text(-2.5, -1.9, r'满足 $M_p \leq 20\%$', fontsize=10, color='#2c6fad', alpha=0.85,
        bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.7))
ax.legend(loc='lower right', fontsize=9)
ax.set_title(r'超调量约束：$M_p \leq 20\%$', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig('processed/sh-01-feasible-region-mp.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 sh-02 | 调节时间约束图（实部垂线叠加）

```
文件名：sh-02-feasible-region-ts.py / .svg
存放：raw/sh-02-feasible-region-ts.py → processed/sh-02-feasible-region-ts.svg
引用于：handout §2.1 / interactive-page step-07 阶段二
```

**图片内容描述**

在 sh-01 基础上叠加调节时间约束：
- 保留蓝色扇形区域和阻尼比射线（略淡，作为背景）
- 新增垂线 Re(s) = -0.8，橙色实线
- 垂线左侧区域填充浅橙色（alpha=0.20），标注"满足 ts ≤ 5s"
- 垂线处标注"Re(s) = -0.8"（旋转90°）和"σ = 0.8"

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)
r = 2.8

# 背景蓝色扇形（浅）
angles = np.linspace(-theta, theta, 300)
poly_x = [0] + list(-r*np.cos(angles)) + [0]
poly_y = [0] + list(r*np.sin(angles)) + [0]
ax.fill(poly_x, poly_y, color='#4a90d9', alpha=0.12)
rect_x = [-r*np.cos(theta), -3, -3, -r*np.cos(theta)]
rect_y  = [r*np.sin(theta), 2.5, -2.5, -r*np.sin(theta)]
ax.fill(rect_x, rect_y, color='#4a90d9', alpha=0.12)
ax.plot([-r*np.cos(theta), 0], [r*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.5)
ax.plot([-r*np.cos(theta), 0], [-r*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.5)

# 橙色垂线
ax.axvline(x=-0.8, color='#e07b00', linewidth=2.2,
           label=r'$\sigma=0.8$，$t_s \leq 5\mathrm{s}$')
ax.fill_betweenx([-2.5, 2.5], -3, -0.8, color='#f5a623', alpha=0.18)

ax.text(-1.05, 2.1, r'$\mathrm{Re}(s)=-0.8$', fontsize=9, color='#e07b00',
        rotation=90, va='top')
ax.text(-2.6, -2.0, r'满足 $t_s \leq 5\mathrm{s}$', fontsize=10, color='#b05e00',
        bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.7))

ax.legend(loc='lower right', fontsize=9)
ax.set_title(r'调节时间约束叠加：$t_s \leq 5\mathrm{s}$', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig('processed/sh-02-feasible-region-ts.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 sh-03 | 复平面可行域全图（A/B/C三点）

```
文件名：sh-03-feasible-region-full.py / .svg
存放：raw/sh-03-feasible-region-full.py → processed/sh-03-feasible-region-full.svg
引用于：handout §2.2 / interactive-page step-07 阶段三、step-08 阶段一
```

**图片内容描述**

两约束区域交集全图：
- 蓝色扇形（θ≤63°）+ 橙色矩形（Re≤-0.8）交集，双重阴影叠加（蓝橙混合紫色）
- 标注三个典型极点：
  - A：s = -1.0+j0.4（可行域内偏慢）→ 蓝点，标"A（慢，满足）"
  - B：s = -1.5+j1.0（可行域中部）→ 绿点，标"B（最优区）"
  - C：s = -1.5+j2.2（超出阻尼线）→ 红叉，标"C（超调超标）"
- 图注："可行域 = 双重约束的交集"

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)
sigma_min = -0.8

# 蓝色扇形（全部，浅）
angles = np.linspace(-theta, theta, 300)
poly_x = [0] + list(-2.8*np.cos(angles)) + [0]
poly_y = [0] + list(2.8*np.sin(angles)) + [0]
ax.fill(poly_x, poly_y, color='#4a90d9', alpha=0.15)
rect_x = [-2.8*np.cos(theta), -3, -3, -2.8*np.cos(theta)]
rect_y  = [2.8*np.sin(theta), 2.5, -2.5, -2.8*np.sin(theta)]
ax.fill(rect_x, rect_y, color='#4a90d9', alpha=0.15)

# 橙色（Re≤-0.8，浅）
ax.fill_betweenx([-2.5, 2.5], -3, sigma_min, color='#f5a623', alpha=0.15)

# 交集（深色）：扇形 ∩ Re≤-0.8
x_vals = np.linspace(-3, sigma_min, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.30,
                label='可行域（双重约束交集）')

# 约束线
ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=2,
        label=r'$\zeta=0.45$，$\theta=63°$')
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=2)
ax.axvline(x=sigma_min, color='#e07b00', lw=2,
           label=r'$\sigma=0.8$，$t_s\leq5\mathrm{s}$')

# 三点
ax.plot(-1.0, 0.4, 'o', color='#2c6fad', markersize=9, zorder=5)
ax.annotate('A（慢，满足）', xy=(-1.0, 0.4), xytext=(-0.2, 0.7),
            fontsize=9, color='#2c6fad',
            arrowprops=dict(arrowstyle='->', color='#2c6fad', lw=1.2))

ax.plot(-1.5, 1.0, 'o', color='green', markersize=9, zorder=5)
ax.annotate('B（最优区）', xy=(-1.5, 1.0), xytext=(-0.4, 1.35),
            fontsize=9, color='green',
            arrowprops=dict(arrowstyle='->', color='green', lw=1.2))

ax.plot(-1.5, 2.2, 'x', color='red', markersize=11, markeredgewidth=2.5, zorder=5)
ax.annotate('C（超调超标）', xy=(-1.5, 2.2), xytext=(-0.3, 2.2),
            fontsize=9, color='red',
            arrowprops=dict(arrowstyle='->', color='red', lw=1.2))

ax.text(-2.9, -2.2, '可行域 = 双重约束的交集', fontsize=9,
        bbox=dict(boxstyle='round,pad=0.3', fc='#f0eaff', ec='#6b4fb5', alpha=0.9))

ax.legend(loc='upper right', fontsize=8.5, framealpha=0.8)
ax.set_title('复平面可行域全图', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig('processed/sh-03-feasible-region-full.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 h-04 | 根轨迹可行弧段图

```
文件名：h-04-root-locus-feasible-arc.py / .svg
存放：raw/h-04-root-locus-feasible-arc.py → processed/h-04-root-locus-feasible-arc.svg
引用于：handout §3.1 / interactive-page step-08 阶段一
```

**图片内容描述**

系统 G(s)=K/[s(s+2)] 根轨迹，叠加复平面可行域（Mp≤20%，ts≤5s）：
- 根轨迹：实轴段（s=0 到 s=-2）+ Re=-1 垂线段（分叉后）
- 可行域：θ=63° 射线 + Re=-0.8 垂线 + 交集浅紫色
- 可行弧段（Re=-1，Im 从 0 到 1.96）加粗为紫色
- 典型极点 A（K偏小）、B（K≈2，推荐）、C（K_max≈4.84）
- 开环极点 s=0、s=-2 标"×"，分叉点 s=-1 标"□"

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)
sigma_min = -0.8

# 可行域背景
x_vals = np.linspace(-3, sigma_min, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.15)

# 约束线（细）
ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.6)
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.6)
ax.axvline(x=sigma_min, color='#e07b00', lw=1.5, alpha=0.6)

# 根轨迹
ax.plot([0, -2], [0, 0], 'k-', lw=2)
ax.annotate('', xy=(-1.5, 0), xytext=(-0.5, 0),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, 'k-', lw=2)
ax.plot(-np.ones_like(im_vals), -im_vals, 'k-', lw=2)
ax.annotate('', xy=(-1, 1.8), xytext=(-1, 0.8),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
ax.annotate('', xy=(-1, -1.8), xytext=(-1, -0.8),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))

# 可行弧段（加粗紫色）
im_arc = np.linspace(0.01, 1.96, 100)
ax.plot(-np.ones_like(im_arc), im_arc, color='#6b4fb5', lw=4.5, alpha=0.85,
        label='可行弧段', zorder=4)
ax.plot(-np.ones_like(im_arc), -im_arc, color='#6b4fb5', lw=4.5, alpha=0.85, zorder=4)
ax.text(-1.55, 1.0, '可行弧段', fontsize=9, color='#6b4fb5', rotation=90, va='center')

# 开环极点和分叉点
ax.plot(0, 0, 'kx', markersize=10, markeredgewidth=2.5, zorder=6)
ax.plot(-2, 0, 'kx', markersize=10, markeredgewidth=2.5, zorder=6)
ax.plot(-1, 0, 's', color='gray', markersize=7, zorder=6, label='分叉点 s=-1')
ax.text(0.05, -0.22, 's=0', fontsize=8, color='gray')
ax.text(-2.35, -0.25, 's=-2', fontsize=8, color='gray')

# 典型极点
ax.plot(-1, 0.4, 'o', color='#2c6fad', markersize=9, zorder=7)
ax.text(-0.88, 0.45, 'A', fontsize=9, color='#2c6fad', fontweight='bold')

ax.plot(-1, 1.0, 'o', color='green', markersize=9, zorder=7)
ax.text(-0.88, 1.05, r'B（K≈2）', fontsize=9, color='green', fontweight='bold')

ax.plot(-1, 1.96, 'o', color='#e07b00', markersize=9, zorder=7)
ax.text(-0.88, 2.02, r'C（$K_{\max}$≈4.84）', fontsize=9, color='#e07b00', fontweight='bold')

ax.legend(loc='lower right', fontsize=8.5)
ax.set_title(r'根轨迹 + 可行域 → 可行弧段', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig('processed/h-04-root-locus-feasible-arc.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 h-05 | 时域响应包络图

```
文件名：h-05-time-domain-envelope.py / .svg
存放：raw/h-05-time-domain-envelope.py → processed/h-05-time-domain-envelope.svg
引用于：handout §3.2 / interactive-page step-09 阶段一
```

**图片内容描述**

阶跃响应包络图（归一化），闭环 H(s)=K/(s²+2s+K)：
- 横轴：时间 t（0~15s），纵轴：y(t)（0~1.35）
- K_min 示意（K=0.5，慢速无超调）：蓝色实线，下边界
- K_max（K=4.84，超调约20%）：橙色实线，上边界
- 两曲线间浅紫色填充，标注"响应包络（可行域）"
- K=2 典型曲线：绿色虚线
- 目标值 y=1.0 黑色虚线，±2% 稳定带灰色虚线

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

fig, ax = plt.subplots(figsize=(7, 4.5))

t = np.linspace(0, 15, 1000)

def step_response(K, t):
    sys = signal.TransferFunction([K], [1, 2, K])
    _, y = signal.step(sys, T=t)
    return y

y_min = step_response(0.5, t)
y_max = step_response(4.84, t)
y_opt = step_response(2.0, t)

ax.fill_between(t, y_min, y_max, color='#9b7fd4', alpha=0.20, label='响应包络（可行域）')
ax.plot(t, y_max, color='#e07b00', lw=2, label=r'$K_{\max}$≈4.84（超调≈20%）')
ax.plot(t, y_min, color='#2c6fad', lw=2, label=r'$K_{\min}$示意（偏慢）')
ax.plot(t, y_opt, color='green', lw=2, linestyle='--',
        label=r'$K$=2（推荐，$\zeta$≈0.707）')

ax.axhline(1.0, color='black', lw=1.2, linestyle='--', alpha=0.7)
ax.axhline(1.02, color='gray', lw=0.8, linestyle=':', alpha=0.6)
ax.axhline(0.98, color='gray', lw=0.8, linestyle=':', alpha=0.6)
ax.text(14.5, 1.03, '±2%', fontsize=8, color='gray', ha='right')

ax.set_xlabel('时间 $t$ / s', fontsize=11)
ax.set_ylabel('归一化输出 $y(t)$', fontsize=11)
ax.set_xlim(0, 15)
ax.set_ylim(0, 1.35)
ax.legend(loc='upper right', fontsize=8.5, framealpha=0.85)
ax.set_title('时域响应包络（可行域在时域的投影）', fontsize=12, pad=10)
ax.grid(True, alpha=0.25)

plt.tight_layout()
plt.savefig('processed/h-05-time-domain-envelope.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 h-06 | 频域可行带图（Bode幅频）

```
文件名：h-06-bode-feasible-band.py / .svg
存放：raw/h-06-bode-feasible-band.py → processed/h-06-bode-feasible-band.svg
引用于：handout §3.3 / interactive-page step-09 阶段二
```

**图片内容描述**

Bode 幅频图（仅幅频），开环 G(s)=K/[s(s+2)]：
- 横轴：ω（对数坐标，0.03~15 rad/s），纵轴：幅值（dB）
- K_min 示意（K=0.5）曲线：蓝色，下边界
- K_max（K=4.84）曲线：橙色，上边界
- 两曲线间浅紫色填充，标注"频域可行带"
- K=2 典型曲线：绿色虚线
- 标注 ω_c,min 和 ω_c,max（穿越频率，即各曲线过 0dB 处）
- 0dB 基准线：黑色虚线

```python
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

fig, ax = plt.subplots(figsize=(7, 4))

omega = np.logspace(-1.5, 1.2, 500)

def bode_mag_db(K, omega):
    w, mag, _ = signal.bode(signal.TransferFunction([K], [1, 2, 0]), w=omega)
    return w, mag

w, mag_min = bode_mag_db(0.5, omega)
_, mag_max = bode_mag_db(4.84, omega)
_, mag_opt = bode_mag_db(2.0, omega)

ax.fill_between(w, mag_min, mag_max, color='#9b7fd4', alpha=0.20, label='频域可行带')
ax.semilogx(w, mag_max, color='#e07b00', lw=2, label=r'$K_{\max}$≈4.84（带宽较高）')
ax.semilogx(w, mag_min, color='#2c6fad', lw=2, label=r'$K_{\min}$示意（带宽较低）')
ax.semilogx(w, mag_opt, color='green', lw=2, linestyle='--', label=r'$K$=2（推荐）')

ax.axhline(0, color='black', lw=1, linestyle='--', alpha=0.5)
ax.text(10, 1.5, '0 dB', fontsize=8.5, color='black', alpha=0.6)

for K, color, label in [(0.5, '#2c6fad', r'$\omega_{c,\min}$'),
                         (4.84, '#e07b00', r'$\omega_{c,\max}$')]:
    _, mag_arr = bode_mag_db(K, omega)
    idx = np.argmin(np.abs(mag_arr))
    wc = omega[idx]
    ax.axvline(wc, color=color, lw=1, linestyle=':', alpha=0.7)
    ax.text(wc*1.05, -28, label, fontsize=8.5, color=color)

ax.set_xlabel(r'频率 $\omega$ / (rad/s)', fontsize=11)
ax.set_ylabel('幅值 / dB', fontsize=11)
ax.set_xlim(omega[0], omega[-1])
ax.legend(loc='upper right', fontsize=8.5, framealpha=0.85)
ax.set_title('Bode 幅频可行带（可行域在频域的投影）', fontsize=12, pad=10)
ax.grid(True, which='both', alpha=0.25)

plt.tight_layout()
plt.savefig('processed/h-06-bode-feasible-band.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 h-07 | 例题1根轨迹图（叠加可行域）

```
文件名：h-07-example1-root-locus.py / .svg
存放：raw/h-07-example1-root-locus.py → processed/h-07-example1-root-locus.svg
引用于：handout §4例题1 / interactive-page step-11
```

**图片内容描述**

系统 G(s)=K/[s(s+2)] 根轨迹，叠加例题1可行域（Mp≤20%，ts≤4s）：
- 根轨迹同 h-04
- 可行域：θ=63° 射线 + Re=-1 垂线（ts≤4s，与根轨迹重合，橙色虚线）
- 交集填充浅紫色（Re≤-1 且在扇形内）
- 标注：K=1（分叉点）、K=2（s=-1+j1，推荐）、K≈4.84（阻尼线边界，K_max）
- 注释"根轨迹实部恒为 -1"

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)

# 可行域（Re≤-1 且在扇形内）
x_vals = np.linspace(-3, -1.0, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.18, label='可行域')

# 约束线
ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7,
        label=r'$\theta=63°$（$M_p\leq20\%$）')
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7)
ax.axvline(x=-1.0, color='#e07b00', lw=1.8, linestyle='--', alpha=0.8,
           label=r'$\mathrm{Re}(s)=-1$（$t_s\leq4\mathrm{s}$）')

# 根轨迹
ax.plot([0, -2], [0, 0], 'k-', lw=2.2)
im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, 'k-', lw=2.2)
ax.plot(-np.ones_like(im_vals), -im_vals, 'k-', lw=2.2)
ax.annotate('', xy=(-1, 1.8), xytext=(-1, 0.9),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
ax.text(-0.55, 1.5, r'$\mathrm{Re}(s)\equiv-1$', fontsize=8.5, color='black',
        rotation=90, va='center')

# 极点
ax.plot(0, 0, 'kx', markersize=11, markeredgewidth=2.5, zorder=6)
ax.plot(-2, 0, 'kx', markersize=11, markeredgewidth=2.5, zorder=6)
ax.text(0.05, -0.22, 's=0', fontsize=8, color='gray')
ax.text(-2.4, -0.25, 's=-2', fontsize=8, color='gray')

ax.plot(-1, 0, 's', color='gray', markersize=8, zorder=7)
ax.text(-1.45, -0.25, 'K=1\n(分叉)', fontsize=8, color='gray', ha='center')

ax.plot(-1, 1.0, 'o', color='green', markersize=9, zorder=7)
ax.annotate(r'K=2，$\zeta$≈0.707', xy=(-1, 1.0), xytext=(-0.25, 1.2),
            fontsize=8.5, color='green',
            arrowprops=dict(arrowstyle='->', color='green', lw=1.2))

ax.plot(-1, 1.96, 'o', color='#e07b00', markersize=9, zorder=7)
ax.annotate(r'$K_{\max}$≈4.84', xy=(-1, 1.96), xytext=(-0.2, 2.15),
            fontsize=8.5, color='#e07b00',
            arrowprops=dict(arrowstyle='->', color='#e07b00', lw=1.2))

ax.legend(loc='lower right', fontsize=8.5, framealpha=0.85)
ax.set_title(r'例题1：$G(s)=K/[s(s+2)]$ 根轨迹 + 可行域', fontsize=11, pad=10)

plt.tight_layout()
plt.savefig('processed/h-07-example1-root-locus.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 h-08 | 可行域收窄对比图（例题2）

```
文件名：h-08-feasible-region-comparison.py / .svg
存放：raw/h-08-feasible-region-comparison.py → processed/h-08-feasible-region-comparison.svg
引用于：handout §4例题2
```

**图片内容描述**

复平面对比两个可行域：
- 原可行域（ts≤4s，Re≤-1）：浅灰色填充，灰色虚线垂线
- 新可行域（ts≤2s，Re≤-2）：深紫色填充，紫色实线垂线
- 阻尼比射线（θ=63°，蓝色）不变
- 根轨迹（Re=-1垂线，灰色）叠加显示
- 箭头标注"可行域收窄方向（→ 左移）"

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3.5, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)

# 原可行域（Re≤-1，浅灰）
x_orig = np.linspace(-3.5, -1.0, 300)
y_up_orig = np.minimum(-x_orig * np.tan(theta), 2.5)
y_lo_orig = np.maximum(x_orig * np.tan(theta), -2.5)
ax.fill_between(x_orig, y_lo_orig, y_up_orig, color='#b0b0b0', alpha=0.35,
                label=r'原可行域（$t_s\leq4\mathrm{s}$）')

# 新可行域（Re≤-2，深紫）
x_new = np.linspace(-3.5, -2.0, 300)
y_up_new = np.minimum(-x_new * np.tan(theta), 2.5)
y_lo_new = np.maximum(x_new * np.tan(theta), -2.5)
ax.fill_between(x_new, y_lo_new, y_up_new, color='#6b4fb5', alpha=0.45,
                label=r'新可行域（$t_s\leq2\mathrm{s}$）')

# 阻尼比射线
ax.plot([-3.2*np.cos(theta), 0], [3.2*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7,
        label=r'$\theta=63°$（$M_p$约束，不变）')
ax.plot([-3.2*np.cos(theta), 0], [-3.2*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7)

# 垂线
ax.axvline(x=-1.0, color='gray', lw=1.8, linestyle='--', alpha=0.8,
           label=r'$\mathrm{Re}(s)=-1$（原，$\sigma=1$）')
ax.axvline(x=-2.0, color='#6b4fb5', lw=2.0, alpha=0.9,
           label=r'$\mathrm{Re}(s)=-2$（新，$\sigma=2$）')

# 根轨迹（Re=-1）
im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, color='gray', lw=2, alpha=0.6)
ax.plot(-np.ones_like(im_vals), -im_vals, color='gray', lw=2, alpha=0.6)

# 收窄方向箭头
ax.annotate('', xy=(-2.4, 1.6), xytext=(-1.3, 1.6),
            arrowprops=dict(arrowstyle='->', color='#6b4fb5', lw=2))
ax.text(-1.85, 1.78, '可行域收窄', fontsize=9, color='#6b4fb5', ha='center')

ax.legend(loc='lower right', fontsize=8, framealpha=0.85)
ax.set_title('可行域收窄对比（例题2）', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig('processed/h-08-feasible-region-comparison.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 资源 ic-09 | 后测题2用复平面图（A/B/C三点）

```
文件名：ic-09-posttest-complex-plane.py / .svg
存放：raw/ic-09-posttest-complex-plane.py → processed/ic-09-posttest-complex-plane.svg
引用于：interactive-page step-13 题2
```

**图片内容描述**

后测题2配套复平面图（不显示答案）：
- 阻尼比射线（θ=63°）+ 实部垂线（Re=-1，ts≤4s）+ 可行域浅紫色
- 根轨迹（Re=-1 垂线段）
- 三个极点只标字母（不标判断结果）：
  - A：s = -0.5+j0.3（可行域外，Re>-1）→ 红点
  - B：s = -1.5+j0.8（可行域内）→ 绿点
  - C：s = -1.2+j2.0（可行域外，超出阻尼线）→ 蓝点
- 答案：仅 B 满足（不在图上标注）

```python
import numpy as np
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 5))

ax.spines['left'].set_position('zero')
ax.spines['bottom'].set_position('zero')
ax.spines['right'].set_visible(False)
ax.spines['top'].set_visible(False)
ax.set_xlim(-3, 0.5)
ax.set_ylim(-2.5, 2.5)
ax.set_xlabel('Re(s)', loc='right', fontsize=11)
ax.set_ylabel('Im(s)', loc='top', fontsize=11, rotation=0)

theta = np.radians(63)
sigma_min = -1.0

# 可行域
x_vals = np.linspace(-3, sigma_min, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.18)

# 约束线
ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7,
        label=r'$\theta=63°$（$M_p\leq20\%$）')
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7)
ax.axvline(x=sigma_min, color='#e07b00', lw=1.8, alpha=0.8,
           label=r'$\mathrm{Re}(s)=-1$（$t_s\leq4\mathrm{s}$）')

# 根轨迹
im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, color='gray', lw=1.8, alpha=0.5)
ax.plot(-np.ones_like(im_vals), -im_vals, color='gray', lw=1.8, alpha=0.5)

# 三个极点（只标字母）
points = [('A', -0.5, 0.3, '#e05555'),
          ('B', -1.5, 0.8, '#2c8a2c'),
          ('C', -1.2, 2.0, '#2c6fad')]
for label, x, y, color in points:
    ax.plot(x, y, 'o', color=color, markersize=11, zorder=7,
            markeredgecolor='white', markeredgewidth=1.5)
    ax.text(x + 0.1, y + 0.12, label, fontsize=12, fontweight='bold', color=color)

ax.legend(loc='lower right', fontsize=8.5, framealpha=0.85)
ax.set_title('后测题2：哪些极点满足双重约束？', fontsize=11, pad=10)

plt.tight_layout()
plt.savefig('processed/ic-09-posttest-complex-plane.svg', format='svg', bbox_inches='tight')
plt.show()
```

---

## 回写记录

以下引用路径已在对应文档中写入：

### handout.md 已有引用（Step 3 阶段写入，格式已符合规范）

| 文件名 | 引用位置 |
|--------|----------|
| sh-01-feasible-region-mp.svg | §2.1 超调量约束 |
| sh-02-feasible-region-ts.svg | §2.1 调节时间约束 |
| sh-03-feasible-region-full.svg | §2.2 可行域全图 |
| h-04-root-locus-feasible-arc.svg | §3.1 根轨迹可行弧段 |
| h-05-time-domain-envelope.svg | §3.2 时域响应包络 |
| h-06-bode-feasible-band.svg | §3.3 频域可行带 |
| h-07-example1-root-locus.svg | §4 例题1 |
| h-08-feasible-region-comparison.svg | §4 例题2 |

### interactive-page.md 占位符（待前端实现时替换为实际图片引用）

| 文件名 | 所在步骤 |
|--------|----------|
| sh-01-feasible-region-mp.svg | step-07 阶段一 |
| sh-02-feasible-region-ts.svg | step-07 阶段二 |
| sh-03-feasible-region-full.svg | step-07 阶段三、step-08 阶段一 |
| h-04-root-locus-feasible-arc.svg | step-08 阶段一 |
| h-05-time-domain-envelope.svg | step-09 阶段一 |
| h-06-bode-feasible-band.svg | step-09 阶段二 |
| h-07-example1-root-locus.svg | step-11 段一 |
| ic-09-posttest-complex-plane.svg | step-13 题2 |
