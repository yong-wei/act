import argparse
from pathlib import Path

import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk
from td_math import second_order_step_response, time_domain_metrics


SETTLE_BAND = 0.02


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate td-04 time-domain indices SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / 'td-04-time-domain-indices-annotated.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t, y = second_order_step_response(zeta=0.45, wn=1.8, duration=7.0, dt=0.002)
    metrics = time_domain_metrics(t, y, settle_band=SETTLE_BAND)
    final_value = metrics['final_value']
    upper = final_value * (1 + SETTLE_BAND)
    lower = final_value * (1 - SETTLE_BAND)

    fig, ax = plt.subplots(figsize=(11.0, 6.0))
    fig.patch.set_facecolor('#f8fafc')
    ax.set_facecolor('#f8fafc')

    ax.plot(t, y, color='#0284c7', linewidth=2.6)
    ax.axhline(final_value, color='#64748b', linestyle='--', linewidth=1.1)
    ax.axhline(upper, color='#94a3b8', linestyle=':', linewidth=1.1)
    ax.axhline(lower, color='#94a3b8', linestyle=':', linewidth=1.1)
    ax.fill_between(t, lower, upper, color='#cbd5e1', alpha=0.28)

    rise_t = metrics['rise_time']
    peak_t = metrics['peak_time']
    settle_t = metrics['settling_time']
    peak_y = metrics['peak_value']

    ax.plot([rise_t], [final_value], 'o', color='#0f766e', markersize=7)
    ax.plot([peak_t], [peak_y], 'o', color='#ea580c', markersize=7)
    ax.plot([settle_t], [y[metrics['settling_index']]], 'o', color='#7c3aed', markersize=7)

    ax.vlines(rise_t, 0.0, final_value, color='#0f766e', linestyle=':', linewidth=1.4)
    ax.vlines(peak_t, 0.0, peak_y, color='#ea580c', linestyle=':', linewidth=1.4)
    ax.vlines(settle_t, 0.0, y[metrics['settling_index']], color='#7c3aed', linestyle=':', linewidth=1.4)

    ax.annotate('上升时间 $t_r$', xy=(rise_t, final_value), xytext=(rise_t + 0.35, 0.34),
                fontsize=10, color='#0f766e',
                arrowprops=dict(arrowstyle='->', color='#0f766e', lw=1.5))
    ax.annotate('峰值时间 $t_p$', xy=(peak_t, peak_y), xytext=(peak_t + 0.28, peak_y + 0.12),
                fontsize=10, color='#ea580c',
                arrowprops=dict(arrowstyle='->', color='#ea580c', lw=1.5))
    ax.annotate('调节时间 $t_s$', xy=(settle_t, y[metrics['settling_index']]), xytext=(settle_t + 0.25, 0.2),
                fontsize=10, color='#7c3aed',
                arrowprops=dict(arrowstyle='->', color='#7c3aed', lw=1.5))

    ax.annotate('', xy=(peak_t + 0.18, peak_y), xytext=(peak_t + 0.18, final_value),
                arrowprops=dict(arrowstyle='<->', color='#dc2626', lw=1.6))
    ax.text(peak_t + 0.26, (peak_y + final_value) / 2, '超调量 $M_p$', color='#dc2626', fontsize=10, va='center')

    ax.text(t[-1] - 0.1, upper + 0.02, '2% 误差带', ha='right', fontsize=9, color='#475569')
    summary = (
        rf'$t_r \approx {rise_t:.2f}\,s$'
        rf'    $t_p \approx {peak_t:.2f}\,s$'
        rf'    $M_p \approx {metrics["overshoot_percent"]:.1f}\%$'
        rf'    $t_s \approx {settle_t:.2f}\,s$'
    )
    ax.text(
        0.02,
        0.94,
        summary,
        transform=ax.transAxes,
        fontsize=10.5,
        color='#0f172a',
        bbox=dict(boxstyle='round,pad=0.35', facecolor='white', edgecolor='#cbd5e1'),
    )

    ax.set_title('欠阻尼响应上的四个动态性能指标', fontsize=14, fontweight='bold', pad=12)
    ax.set_xlabel('时间 t / s')
    ax.set_ylabel('输出 c(t)')
    ax.set_xlim(0.0, t[-1])
    ax.set_ylim(0.0, max(1.32, peak_y + 0.08))
    ax.grid(True, color='#e2e8f0')

    plt.tight_layout()
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
