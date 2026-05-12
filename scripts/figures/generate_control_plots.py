#!/Library/Frameworks/Python.framework/Versions/3.11/bin/python3
"""
Control System Teaching Plots
Generates time-domain, frequency-domain, and root locus plots for teaching.
Run:  python3 scripts/figures/generate_control_plots.py
"""
import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import control
from pathlib import Path

# ─── Style ────────────────────────────────────────────────────────────────────
plt.rcParams.update({
    'font.family': 'DejaVu Sans',
    'font.size': 13,
    'axes.titlesize': 15,
    'axes.labelsize': 13,
    'axes.linewidth': 1.4,
    'lines.linewidth': 2.5,
    'grid.alpha': 0.4,
    'grid.linewidth': 0.8,
    'legend.fontsize': 12,
    'figure.dpi': 150,
    'savefig.dpi': 150,
    'savefig.bbox': 'tight',
    'savefig.pad_inches': 0.2,
})

OUT = Path(__file__).resolve().parents[2] / 'images'
OUT.mkdir(exist_ok=True)

COLORS = ['#2563EB', '#DC2626', '#16A34A', '#9333EA', '#EA580C']

# ─── 1. Step Response  (1st & 2nd order) ─────────────────────────────────────
def plot_step_response():
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    fig.suptitle('Step Response  (Unit Step Input)', fontsize=17, fontweight='bold', y=1.02)

    # --- 1st order ---
    ax = axes[0]
    ax.set_title('1st-Order System:  G(s) = 1/(Ts+1)', pad=10)
    t = np.linspace(0, 25, 1000)
    for i, T in enumerate([1, 2, 4, 8]):
        sys = control.tf([1], [T, 1])
        t_out, y_out = control.step_response(sys, T=t)
        ax.plot(t_out, y_out, color=COLORS[i], label=f'T = {T} s')
    ax.axhline(1.0, color='gray', ls='--', lw=1.5, label='Steady state = 1')
    ax.axhline(0.632, color='gray', ls=':', lw=1.2, alpha=0.7)
    ax.text(0.3, 0.645, '63.2%  (one time-constant)', fontsize=10, color='gray')
    ax.set_xlabel('Time  (s)')
    ax.set_ylabel('Output  y(t)')
    ax.set_xlim(0, 25)
    ax.set_ylim(0, 1.15)
    ax.legend(loc='lower right')
    ax.grid(True)

    # --- 2nd order ---
    ax = axes[1]
    ax.set_title(r'2nd-Order System:  G(s) = $\omega_n^2\,/\,(s^2+2\zeta\omega_n s+\omega_n^2)$', pad=10)
    wn = 2.0
    t = np.linspace(0, 10, 1000)
    zetas = [0.1, 0.3, 0.5, 0.7, 1.0, 1.5]
    for i, zeta in enumerate(zetas):
        sys = control.tf([wn**2], [1, 2*zeta*wn, wn**2])
        t_out, y_out = control.step_response(sys, T=t)
        ls = '-' if zeta <= 1.0 else '--'
        label = f'ζ = {zeta}' + (' (critically damped)' if zeta == 1.0 else
                                   ' (overdamped)' if zeta > 1.0 else '')
        ax.plot(t_out, y_out, color=COLORS[min(i, 4)], ls=ls, label=label)

    ax.axhline(1.0, color='gray', ls='--', lw=1.5)
    ax.axhline(1.05, color='salmon', ls=':', lw=1.2, alpha=0.8)
    ax.axhline(0.95, color='salmon', ls=':', lw=1.2, alpha=0.8)
    ax.text(8.2, 1.055, '+5%', fontsize=9, color='salmon')
    ax.text(8.2, 0.942, '−5%', fontsize=9, color='salmon')
    ax.set_xlabel('Time  (s)')
    ax.set_ylabel('Output  y(t)')
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 1.7)
    ax.legend(loc='upper right', fontsize=10)
    ax.grid(True)

    plt.tight_layout()
    fig.savefig(OUT / '01_step_response.png')
    plt.close(fig)
    print('✓  01_step_response.png')


# ─── 2. Impulse Response ─────────────────────────────────────────────────────
def plot_impulse_response():
    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.set_title(r'Impulse Response  —  2nd-Order System  ($\omega_n=2$ rad/s)', fontsize=15, fontweight='bold')
    wn = 2.0
    t = np.linspace(0, 12, 1000)
    for i, zeta in enumerate([0.1, 0.3, 0.7, 1.0]):
        sys = control.tf([wn**2], [1, 2*zeta*wn, wn**2])
        t_out, y_out = control.impulse_response(sys, T=t)
        ax.plot(t_out, y_out, color=COLORS[i], label=f'ζ = {zeta}')
    ax.axhline(0, color='black', lw=1.0)
    ax.set_xlabel('Time  (s)')
    ax.set_ylabel('Output  y(t)')
    ax.legend()
    ax.grid(True)
    plt.tight_layout()
    fig.savefig(OUT / '02_impulse_response.png')
    plt.close(fig)
    print('✓  02_impulse_response.png')


# ─── 3. Bode Plot ────────────────────────────────────────────────────────────
def plot_bode():
    # G(s) = 10 / (s(s+1)(s+5))
    sys = control.tf([10], [1, 6, 5, 0])

    fig, (ax_mag, ax_phase) = plt.subplots(2, 1, figsize=(11, 8), sharex=True)
    fig.suptitle('Bode Plot  —  G(s) = 10 / [s(s+1)(s+5)]',
                 fontsize=16, fontweight='bold', y=1.01)

    omega = np.logspace(-2, 2, 2000)
    mag, phase, omega_out = control.bode(sys, omega=omega, plot=False)

    mag_db = 20 * np.log10(mag)
    phase_deg = np.degrees(phase)

    # Magnitude
    ax_mag.semilogx(omega_out, mag_db, color=COLORS[0], lw=2.5)
    ax_mag.axhline(0, color='gray', ls='--', lw=1.2, alpha=0.7, label='0 dB')
    ax_mag.set_ylabel('Magnitude  (dB)')
    ax_mag.grid(True, which='both', alpha=0.4)
    ax_mag.legend()

    # Phase
    ax_phase.semilogx(omega_out, phase_deg, color=COLORS[1], lw=2.5)
    ax_phase.axhline(-180, color='gray', ls='--', lw=1.2, alpha=0.7, label='-180°')
    ax_phase.set_ylabel('Phase  (deg)')
    ax_phase.set_xlabel('Frequency  ω  (rad/s)')
    ax_phase.grid(True, which='both', alpha=0.4)
    ax_phase.legend()

    # ── Gain Margin & Phase Margin ──
    try:
        gm, pm, wg, wp = control.margin(sys)
        if gm is not None and not np.isinf(gm):
            gm_db = 20 * np.log10(gm)
            ax_mag.axvline(wg, color='darkorange', ls=':', lw=1.8)
            ax_mag.annotate(f'GM = {gm_db:.1f} dB\n(ω = {wg:.2f} r/s)',
                            xy=(wg, 0), xytext=(wg*2.5, 15),
                            arrowprops=dict(arrowstyle='->', color='darkorange'),
                            color='darkorange', fontsize=10)
        if pm is not None:
            ax_phase.axvline(wp, color='seagreen', ls=':', lw=1.8)
            ax_phase.annotate(f'PM = {pm:.1f}°\n(ω = {wp:.2f} r/s)',
                              xy=(wp, -180 + pm), xytext=(wp*3, -160),
                              arrowprops=dict(arrowstyle='->', color='seagreen'),
                              color='seagreen', fontsize=10)
    except Exception:
        pass

    plt.tight_layout()
    fig.savefig(OUT / '03_bode_plot.png')
    plt.close(fig)
    print('✓  03_bode_plot.png')


# ─── 4. Nyquist Plot ─────────────────────────────────────────────────────────
def plot_nyquist():
    sys = control.tf([10], [1, 6, 5, 0])

    fig, ax = plt.subplots(figsize=(9, 8))
    ax.set_title('Nyquist Plot  —  G(s) = 10 / [s(s+1)(s+5)]',
                 fontsize=15, fontweight='bold')

    omega = np.logspace(-2, 2, 5000)
    mag, phase, _ = control.bode(sys, omega=omega, plot=False)
    re = mag * np.cos(phase)
    im = mag * np.sin(phase)

    ax.plot(re, im, color=COLORS[0], lw=2.5, label='G(jω)  (ω: 0 → +∞)')
    ax.plot(re, -im, color=COLORS[0], lw=1.5, ls='--', alpha=0.5, label='Conjugate  (ω: 0 → −∞)')
    ax.plot(-1, 0, 'r+', ms=16, mew=3, label='Critical point  (−1, 0)')
    ax.axhline(0, color='black', lw=0.8)
    ax.axvline(0, color='black', lw=0.8)

    # Arrows indicating direction
    mid = len(re) // 4
    ax.annotate('', xy=(re[mid+5], im[mid+5]), xytext=(re[mid], im[mid]),
                arrowprops=dict(arrowstyle='->', color=COLORS[0], lw=2))

    ax.set_xlabel('Real Axis')
    ax.set_ylabel('Imaginary Axis')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.4)
    ax.set_xlim(-4, 3)
    ax.set_ylim(-4, 4)
    plt.tight_layout()
    fig.savefig(OUT / '04_nyquist_plot.png')
    plt.close(fig)
    print('✓  04_nyquist_plot.png')


# ─── 5. Root Locus ───────────────────────────────────────────────────────────
def plot_root_locus():
    # Open-loop: G(s) = K / [s(s+2)(s+4)]
    sys = control.tf([1], [1, 6, 8, 0])

    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_title('Root Locus  —  G(s) = K / [s(s+2)(s+4)]',
                 fontsize=15, fontweight='bold')

    rlist, klist = control.root_locus(sys, plot=False)

    for i in range(rlist.shape[1]):
        branch = rlist[:, i]
        ax.plot(branch.real, branch.imag, color=COLORS[i % len(COLORS)], lw=2.5)

    # Poles & zeros
    poles = control.poles(sys)
    zeros = control.zeros(sys)
    ax.plot(poles.real, poles.imag, 'rx', ms=14, mew=3, label='Open-loop poles  (×)')
    if len(zeros):
        ax.plot(zeros.real, zeros.imag, 'bo', ms=12, mew=2, fillstyle='none', label='Open-loop zeros  (○)')

    # Mark some K values on the dominant branch
    ks_of_interest = [0, 2, 8, 20, 48]
    for k_val in ks_of_interest:
        idx = np.argmin(np.abs(klist - k_val))
        branch_idx = 1  # dominant complex branch
        if rlist.shape[1] > branch_idx:
            r = rlist[idx, branch_idx]
            ax.plot(r.real, r.imag, 'k.', ms=8)
            ax.annotate(f'K={k_val}', xy=(r.real, r.imag),
                        xytext=(r.real + 0.2, r.imag + 0.2), fontsize=9, color='#444')

    ax.axvline(0, color='black', lw=0.8)
    ax.axhline(0, color='black', lw=0.8)
    ax.set_xlabel('Real Axis')
    ax.set_ylabel('Imaginary Axis')
    ax.legend()
    ax.grid(True, alpha=0.4)
    ax.set_xlim(-6, 2)
    plt.tight_layout()
    fig.savefig(OUT / '05_root_locus.png')
    plt.close(fig)
    print('✓  05_root_locus.png')


# ─── 6. Pole-Zero Map ────────────────────────────────────────────────────────
def plot_pzmap():
    systems = {
        'Overdamped  (ζ=1.5)': control.tf([4], [1, 6, 4]),
        'Critically  (ζ=1.0)': control.tf([4], [1, 4, 4]),
        'Underdamped (ζ=0.5)': control.tf([4], [1, 2, 4]),
        'Undamped    (ζ=0)':   control.tf([4], [1, 0, 4]),
    }

    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle('Pole-Zero Map  —  2nd-Order System  G(s) = 4 / (s²+2ζ·2s+4)',
                 fontsize=15, fontweight='bold', y=1.01)

    for ax, (title, sys) in zip(axes.flat, systems.items()):
        poles = control.poles(sys)
        zeros = control.zeros(sys)
        ax.set_title(title, fontsize=12)
        ax.axvline(0, color='black', lw=1.2)
        ax.axhline(0, color='black', lw=1.2)

        ax.plot(poles.real, poles.imag, 'rx', ms=14, mew=3, label='Poles')
        if len(zeros):
            ax.plot(zeros.real, zeros.imag, 'bo', ms=12, mew=2, fillstyle='none', label='Zeros')

        # Stability region shading
        ax.axvspan(-6, 0, alpha=0.06, color='green')
        ax.text(-5.5, 2.6, 'Stable region', fontsize=9, color='green', alpha=0.8)

        for p in poles:
            ax.annotate(f'  ({p.real:.2f}{p.imag:+.2f}j)', xy=(p.real, p.imag), fontsize=9)

        ax.set_xlim(-6, 2)
        ax.set_ylim(-3, 3)
        ax.set_xlabel('σ  (Real part)')
        ax.set_ylabel('jω  (Imag part)')
        ax.legend(loc='upper right', fontsize=10)
        ax.grid(True, alpha=0.4)

    plt.tight_layout()
    fig.savefig(OUT / '06_pzmap.png')
    plt.close(fig)
    print('✓  06_pzmap.png')


# ─── 7. PID Step Response comparison ─────────────────────────────────────────
def plot_pid_comparison():
    plant = control.tf([1], [1, 2, 1, 0])   # integrating 3rd-order plant
    t = np.linspace(0, 20, 2000)

    configs = [
        ('P  only  (Kp=5)',         control.tf([5], [1])),
        ('PD  (Kp=5, Kd=3)',        control.tf([3, 5], [1])),
        ('PI  (Kp=5, Ki=2)',        control.tf([5, 2], [1, 0])),
        ('PID (Kp=5, Ki=2, Kd=3)', control.tf([3, 5, 2], [1, 0])),
    ]

    fig, ax = plt.subplots(figsize=(11, 6))
    ax.set_title('PID Control  —  Step Response Comparison\n'
                 'Plant:  G(s) = 1 / [s(s+1)²]', fontsize=15, fontweight='bold')

    for i, (label, ctrl) in enumerate(configs):
        cl = control.feedback(ctrl * plant, 1)
        try:
            t_out, y_out = control.step_response(cl, T=t)
            ax.plot(t_out, y_out, color=COLORS[i], label=label, lw=2.5)
        except Exception as e:
            print(f'  [skip] {label}: {e}')

    ax.axhline(1.0, color='gray', ls='--', lw=1.5, label='Reference = 1')
    ax.axhline(1.05, color='salmon', ls=':', lw=1.0, alpha=0.7)
    ax.axhline(0.95, color='salmon', ls=':', lw=1.0, alpha=0.7)
    ax.set_xlabel('Time  (s)')
    ax.set_ylabel('Output  y(t)')
    ax.set_xlim(0, 20)
    ax.set_ylim(-0.1, 2.0)
    ax.legend(loc='upper right')
    ax.grid(True)
    plt.tight_layout()
    fig.savefig(OUT / '07_pid_comparison.png')
    plt.close(fig)
    print('✓  07_pid_comparison.png')


# ─── 8. Nichols Chart ────────────────────────────────────────────────────────
def plot_nichols():
    sys = control.tf([10], [1, 6, 5, 0])

    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_title('Nichols Chart  —  G(s) = 10 / [s(s+1)(s+5)]',
                 fontsize=15, fontweight='bold')

    omega = np.logspace(-2, 2, 3000)
    mag, phase, _ = control.bode(sys, omega=omega, plot=False)
    mag_db = 20 * np.log10(mag)
    phase_deg = np.degrees(phase)

    sc = ax.scatter(phase_deg, mag_db, c=np.log10(omega),
                    cmap='viridis', s=8, zorder=3)
    plt.colorbar(sc, ax=ax, label='log₁₀(ω)  [rad/s]')

    ax.plot(phase_deg, mag_db, color='#2563EB', lw=2.0, zorder=2)

    # Mark gain & phase crossover
    try:
        gm, pm, wg, wp = control.margin(sys)
        if gm is not None and not np.isinf(gm):
            ax.plot(-180, 0, 'r^', ms=12, label=f'Gain crossover  (GM = {20*np.log10(gm):.1f} dB)')
        if pm is not None:
            idx = np.argmin(np.abs(omega - wp))
            ax.plot(phase_deg[idx], mag_db[idx], 'gs', ms=12, label=f'Phase crossover  (PM = {pm:.1f}°)')
    except Exception:
        pass

    ax.axhline(0, color='gray', ls='--', lw=1.2)
    ax.axvline(-180, color='gray', ls='--', lw=1.2)
    ax.set_xlabel('Phase  (deg)')
    ax.set_ylabel('Magnitude  (dB)')
    ax.legend()
    ax.grid(True, alpha=0.4)
    plt.tight_layout()
    fig.savefig(OUT / '08_nichols_chart.png')
    plt.close(fig)
    print('✓  08_nichols_chart.png')


# ─── Run all ──────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f'Generating plots → {OUT}\n')
    plot_step_response()
    plot_impulse_response()
    plot_bode()
    plot_nyquist()
    plot_root_locus()
    plot_pzmap()
    plot_pid_comparison()
    plot_nichols()
    print(f'\nDone!  {len(list(OUT.glob("*.png")))} PNG files saved.')
