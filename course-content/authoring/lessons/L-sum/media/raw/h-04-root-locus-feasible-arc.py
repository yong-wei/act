import numpy as np
import matplotlib.pyplot as plt
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'h-04-root-locus-feasible-arc.svg')

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

x_vals = np.linspace(-3, sigma_min, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.15)

ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.6)
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.6)
ax.axvline(x=sigma_min, color='#e07b00', lw=1.5, alpha=0.6)

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

im_arc = np.linspace(0.01, 1.96, 100)
ax.plot(-np.ones_like(im_arc), im_arc, color='#6b4fb5', lw=4.5, alpha=0.85,
        label='可行弧段', zorder=4)
ax.plot(-np.ones_like(im_arc), -im_arc, color='#6b4fb5', lw=4.5, alpha=0.85, zorder=4)
ax.text(-1.55, 1.0, '可行弧段', fontsize=9, color='#6b4fb5', rotation=90, va='center')

ax.plot(0, 0, 'kx', markersize=10, markeredgewidth=2.5, zorder=6)
ax.plot(-2, 0, 'kx', markersize=10, markeredgewidth=2.5, zorder=6)
ax.plot(-1, 0, 's', color='gray', markersize=7, zorder=6, label='分叉点 s=-1')
ax.text(0.05, -0.22, 's=0', fontsize=8, color='gray')
ax.text(-2.35, -0.25, 's=-2', fontsize=8, color='gray')

ax.plot(-1, 0.4, 'o', color='#2c6fad', markersize=9, zorder=7)
ax.text(-0.88, 0.45, 'A', fontsize=9, color='#2c6fad', fontweight='bold')
ax.plot(-1, 1.0, 'o', color='green', markersize=9, zorder=7)
ax.text(-0.88, 1.05, r'B（K≈2）', fontsize=9, color='green', fontweight='bold')
ax.plot(-1, 1.96, 'o', color='#e07b00', markersize=9, zorder=7)
ax.text(-0.88, 2.02, r'C（$K_{\max}$≈4.84）', fontsize=9, color='#e07b00', fontweight='bold')

ax.legend(loc='lower right', fontsize=8.5)
ax.set_title(r'根轨迹 + 可行域 → 可行弧段', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
