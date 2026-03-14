import numpy as np
import matplotlib.pyplot as plt
from scipy import signal
import os

os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'processed'), exist_ok=True)
out_path = os.path.join(os.path.dirname(__file__), '..', 'processed', 'h-06-bode-feasible-band.svg')

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
plt.savefig(out_path, format='svg', bbox_inches='tight')
print(f'Saved: {out_path}')
