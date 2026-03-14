import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'sh-01-feasible-region-mp.svg')

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

ax.plot([-r*np.cos(theta), 0], [r*np.sin(theta), 0], 'b-', linewidth=2,
        label=r'$\zeta=0.45,\ \theta=63°$')
ax.plot([-r*np.cos(theta), 0], [-r*np.sin(theta), 0], 'b-', linewidth=2)

angles = np.linspace(-theta, theta, 300)
poly_x = [0] + list(-r * np.cos(angles)) + [0]
poly_y = [0] + list(r * np.sin(angles)) + [0]
ax.fill(poly_x, poly_y, color='#4a90d9', alpha=0.20)
rect_x = [-r*np.cos(theta), -3, -3, -r*np.cos(theta)]
rect_y  = [r*np.sin(theta), 2.5, -2.5, -r*np.sin(theta)]
ax.fill(rect_x, rect_y, color='#4a90d9', alpha=0.20)

angle_arc = mpatches.Arc((0, 0), 0.8, 0.8, angle=0,
                          theta1=180-63, theta2=180, color='gray', linewidth=1.2)
ax.add_patch(angle_arc)
ax.text(-0.55, 0.22, '63°', fontsize=10, color='gray')

ax.plot(-0.8, 1.8, 'rx', markersize=10, markeredgewidth=2)
ax.text(-0.7, 1.9, '超调超标', fontsize=9, color='red')
ax.plot(-1.5, 0.5, 'g.', markersize=14)
ax.text(-1.4, 0.6, '满足约束', fontsize=9, color='green')

ax.text(-2.5, -1.9, r'满足 $M_p \leq 20\%$', fontsize=10, color='#2c6fad', alpha=0.85,
        bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.7))
ax.legend(loc='lower right', fontsize=9)
ax.set_title(r'超调量约束：$M_p \leq 20\%$', fontsize=12, pad=10)

plt.tight_layout()
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
