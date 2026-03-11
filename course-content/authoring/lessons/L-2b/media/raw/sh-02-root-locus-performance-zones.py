import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

fig, ax = plt.subplots(figsize=(7, 8))
ax.set_facecolor('#0f172a')
fig.patch.set_facecolor('#0f172a')

CYAN = '#22d3ee'
WHITE = '#f1f5f9'

# 性能分区色块
# 不稳定区（右半平面）
ax.axvspan(0, 0.8, alpha=0.12, color='#ef4444')
ax.text(0.2, 3.0, '不稳定\n区域', color='#f87171', fontsize=9, ha='center')

# 区域①：慢，无超调（虚部 0~0.8）
ax.fill_between([-1.8, -0.2], [0, 0], [0.8, 0.8], alpha=0.15, color='#22c55e')
ax.fill_between([-1.8, -0.2], [-0.8, -0.8], [0, 0], alpha=0.15, color='#22c55e')
ax.text(-1.5, 0.35, '① 慢，无超调', color='#86efac', fontsize=8.5)

# 区域②：理想工作区（虚部 0.8~1.8）
ax.fill_between([-1.8, -0.2], [0.8, 0.8], [1.8, 1.8], alpha=0.2, color='#22d3ee')
ax.fill_between([-1.8, -0.2], [-1.8, -1.8], [-0.8, -0.8], alpha=0.2, color='#22d3ee')
ax.text(-1.5, 1.25, '② ✓ 理想工作区', color=CYAN, fontsize=8.5, fontweight='bold')

# 区域③：超调大（虚部 1.8以上）
ax.fill_between([-1.8, -0.2], [1.8, 1.8], [3.5, 3.5], alpha=0.12, color='#f59e0b')
ax.fill_between([-1.8, -0.2], [-3.5, -3.5], [-1.8, -1.8], alpha=0.12, color='#f59e0b')
ax.text(-1.5, 2.5, '③ 超调大\n接近边界', color='#fcd34d', fontsize=8.5)

# 根轨迹
K_real = np.linspace(0, 1, 100)
sigma1 = -1 + np.sqrt(1 - K_real)
sigma2 = -1 - np.sqrt(1 - K_real)
ax.plot(sigma1, np.zeros_like(sigma1), color=CYAN, linewidth=2.5)
ax.plot(sigma2, np.zeros_like(sigma2), color=CYAN, linewidth=2.5)

K_complex = np.linspace(1, 12, 300)
omega = np.sqrt(K_complex - 1)
ax.plot(-np.ones_like(omega), omega, color=CYAN, linewidth=2.5)
ax.plot(-np.ones_like(omega), -omega, color=CYAN, linewidth=2.5)

# 虚轴
ax.axvline(0, color='#f87171', linewidth=1.5, linestyle='--', alpha=0.8)
ax.axhline(0, color=WHITE, linewidth=0.5, alpha=0.3)

# K=2点高亮
ax.plot(-1, 1, 'o', color=CYAN, markersize=11, zorder=6)
ax.plot(-1, -1, 'o', color=CYAN, markersize=11, zorder=6)
ax.annotate('K=2，ζ=0.707', xy=(-1, 1), xytext=(-2.7, 1.4),
            color=CYAN, fontsize=9,
            arrowprops=dict(arrowstyle='->', color=CYAN, lw=1.2))

ax.set_xlim(-3, 0.8)
ax.set_ylim(-3.5, 3.5)
ax.set_xlabel('实部 σ', color='#94a3b8', fontsize=12)
ax.set_ylabel('虚部 jω', color='#94a3b8', fontsize=12)
ax.tick_params(colors='#64748b')
for spine in ax.spines.values():
    spine.set_edgecolor('#334155')

ax.set_title('根轨迹性能分区图\n理想工作区：快速响应 + 小超调',
             color=WHITE, fontsize=11, pad=12)
plt.tight_layout()
plt.savefig('sh-02-root-locus-performance-zones.svg', format='svg',
            dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
plt.show()