import argparse
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk


def resolve_output_path() -> Path:
    default_output = Path(__file__).resolve().parent.parent / 'processed' / 'ic-09-posttest-complex-plane.svg'
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(default_output))
    return Path(parser.parse_args().output)


out_path = resolve_output_path()
out_path.parent.mkdir(parents=True, exist_ok=True)
configure_matplotlib_for_cjk()

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

x_vals = np.linspace(-3, sigma_min, 300)
y_upper = np.minimum(-x_vals * np.tan(theta), 2.5)
y_lower = np.maximum(x_vals * np.tan(theta), -2.5)
ax.fill_between(x_vals, y_lower, y_upper, color='#6b4fb5', alpha=0.18)

ax.plot([-2.8*np.cos(theta), 0], [2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7,
        label=r'$\theta=63°$（$M_p\leq20\%$）')
ax.plot([-2.8*np.cos(theta), 0], [-2.8*np.sin(theta), 0], 'b-', lw=1.8, alpha=0.7)
ax.axvline(x=sigma_min, color='#e07b00', lw=1.8, alpha=0.8,
           label=r'$\mathrm{Re}(s)=-1$（$t_s\leq4\mathrm{s}$）')

im_vals = np.linspace(0, 2.4, 200)
ax.plot(-np.ones_like(im_vals), im_vals, color='gray', lw=1.8, alpha=0.5)
ax.plot(-np.ones_like(im_vals), -im_vals, color='gray', lw=1.8, alpha=0.5)

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
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
