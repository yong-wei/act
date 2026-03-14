import numpy as np
import matplotlib.pyplot as plt
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'h-08-feasible-region-comparison.svg')

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

x_orig = np.linspace(-3.5, -1.0, 300)
y_up_orig = np.minimum(-x_orig * np.tan(theta), 2.5)
y_lo_orig = np.maximum(x_orig * np.tan(theta), -2.5)
ax.fill_between(x_orig, y_lo_orig, y_up_orig, color='#b0b0b0', alpha=0.35,
                label=r'原可行域（$t_s\leq4\mathrm{s}$）')

x_new = np.linspace(-3.5, -2.0, 300)
y_up_new = np.minimum(-x_new * np.tan(theta), 2.5)
y_lo_new = np.maximum(x_new * np.tan(theta), -2.5)
ax.fill_between(x_new, y_lo_new, y_up_new, color='#6b4fb5', alpha=0.45,
                label=r'新可行域（$t_s\leq2\mathrm{s}$）')

ax.plot([-3.2*np.cos(theta), 0], [3.2*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7,
        label=r'$\theta=63°$（$M_p$约束，不变）')
ax.plot([-3.2*np.cos(theta), 0], [-3.2*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7)

ax.axvline(x=-1.0, color='gray', lw=1.8, linestyle='--', alpha=0.8,
           label=r'$\mathrm{Re}(s)=-1$（原，$\sigma=1$）')
ax.axvline(x=-2.0, color='#6b4fb5', lw=2.0, alpha=0.9,
           label=r'$\mathrm{Re}(s)=-2$（新，$\sigma=2$）')

im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, color='gray', lw=2, alpha=0.6)
ax.plot(-np.ones_like(im_vals), -im_vals, color='gray', lw=2, alpha=0.6)

ax.annotate('', xy=(-2.4, 1.6), xytext=(-1.3, 1.6),
            arrowprops=dict(arrowstyle='->', color='#6b4fb5', lw=2))
ax.text(-1.85, 1.78, '可行域收窄', fontsize=9, color='#6b4fb5', ha='center')

ax.legend(loc='lower right', fontsize=8, framealpha=0.85)
ax.set_title('可行域收窄对比（例题2）', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
