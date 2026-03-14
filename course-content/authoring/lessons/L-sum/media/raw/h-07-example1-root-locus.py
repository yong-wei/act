import numpy as np
import matplotlib.pyplot as plt
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'h-07-example1-root-locus.svg')

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

x_vals = np.linspace(-3, -1.0, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.18, label='可行域')

ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7,
        label=r'$\theta=63°$（$M_p\leq20\%$）')
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7)
ax.axvline(x=-1.0, color='#e07b00', lw=1.8, linestyle='--', alpha=0.8,
           label=r'$\mathrm{Re}(s)=-1$（$t_s\leq4\mathrm{s}$）')

ax.plot([0, -2], [0, 0], 'k-', lw=2.2)
im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, 'k-', lw=2.2)
ax.plot(-np.ones_like(im_vals), -im_vals, 'k-', lw=2.2)
ax.annotate('', xy=(-1, 1.8), xytext=(-1, 0.9),
            arrowprops=dict(arrowstyle='->', color='black', lw=1.5))
ax.text(-0.55, 1.5, r'$\mathrm{Re}(s)\equiv-1$', fontsize=8.5, color='black',
        rotation=90, va='center')

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
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
