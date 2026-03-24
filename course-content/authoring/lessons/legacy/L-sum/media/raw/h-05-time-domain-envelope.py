import argparse
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
from scipy import signal

from matplotlib_font import configure_matplotlib_for_cjk


def resolve_output_path() -> Path:
    default_output = Path(__file__).resolve().parent.parent / 'processed' / 'h-05-time-domain-envelope.svg'
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(default_output))
    return Path(parser.parse_args().output)


out_path = resolve_output_path()
out_path.parent.mkdir(parents=True, exist_ok=True)
configure_matplotlib_for_cjk()

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
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
