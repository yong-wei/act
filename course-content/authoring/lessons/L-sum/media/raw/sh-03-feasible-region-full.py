import numpy as np
import matplotlib.pyplot as plt
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'sh-03-feasible-region-full.svg')

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

angles = np.linspace(-theta, theta, 300)
poly_x = [0] + list(-2.8*np.cos(angles)) + [0]
poly_y = [0] + list(2.8*np.sin(angles)) + [0]
ax.fill(poly_x, poly_y, color='#4a90d9', alpha=0.15)
rect_x = [-2.8*np.cos(theta), -3, -3, -2.8*np.cos(theta)]
rect_y  = [2.8*np.sin(theta), 2.5, -2.5, -2.8*np.sin(theta)]
ax.fill(rect_x, rect_y, color='#4a90d9', alpha=0.15)

ax.fill_betweenx([-2.5, 2.5], -3, sigma_min, color='#f5a623', alpha=0.15)

x_vals = np.linspace(-3, sigma_min, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.30,
                label='可行域（双重约束交集）')

ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=2,
        label=r'$\zeta=0.45$，$\theta=63°$')
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=2)
ax.axvline(x=sigma_min, color='#e07b00', lw=2,
           label=r'$\sigma=0.8$，$t_s\leq5\mathrm{s}$')

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
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
