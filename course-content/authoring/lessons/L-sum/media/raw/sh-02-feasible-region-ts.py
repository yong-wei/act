import numpy as np
import matplotlib.pyplot as plt
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'sh-02-feasible-region-ts.svg')

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

angles = np.linspace(-theta, theta, 300)
poly_x = [0] + list(-r*np.cos(angles)) + [0]
poly_y = [0] + list(r*np.sin(angles)) + [0]
ax.fill(poly_x, poly_y, color='#4a90d9', alpha=0.12)
rect_x = [-r*np.cos(theta), -3, -3, -r*np.cos(theta)]
rect_y  = [r*np.sin(theta), 2.5, -2.5, -r*np.sin(theta)]
ax.fill(rect_x, rect_y, color='#4a90d9', alpha=0.12)
ax.plot([-r*np.cos(theta), 0], [r*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.5)
ax.plot([-r*np.cos(theta), 0], [-r*np.sin(theta), 0], 'b-', lw=1.5, alpha=0.5)

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
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
