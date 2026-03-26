import argparse
import math
from pathlib import Path

import matplotlib.pyplot as plt

from matplotlib_font import configure_matplotlib_for_cjk
from td_math import second_order_step_response


ZETA = 0.4
WN = 5.0
WD = WN * math.sqrt(1.0 - ZETA * ZETA)
TR = (math.pi - math.acos(ZETA)) / WD
TP = math.pi / WD
MP = math.exp(-(ZETA * math.pi) / math.sqrt(1.0 - ZETA * ZETA)) * 100.0
TS = 4.0 / (ZETA * WN)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate 2-2 td-05 example response with indices SVG.')
    parser.add_argument(
        '--output',
        type=Path,
        default=Path(__file__).resolve().parent.parent / 'processed' / '2-2-td-05-example-response-with-indices.svg',
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    configure_matplotlib_for_cjk()

    t, y = second_order_step_response(zeta=ZETA, wn=WN, duration=3.0, dt=0.0008)
    peak_y = 1.0 + MP / 100.0
    upper = 1.02
    lower = 0.98

    fig = plt.figure(figsize=(12.0, 6.2), facecolor='#f8fafc')
    gs = fig.add_gridspec(1, 2, width_ratios=[2.2, 1.0], wspace=0.12)
    ax = fig.add_subplot(gs[0, 0])
    card = fig.add_subplot(gs[0, 1])

    ax.set_facecolor('#f8fafc')
    ax.plot(t, y, color='#0284c7', linewidth=2.5)
    ax.axhline(1.0, color='#64748b', linestyle='--', linewidth=1.1)
    ax.axhline(upper, color='#cbd5e1', linestyle=':', linewidth=1.0)
    ax.axhline(lower, color='#cbd5e1', linestyle=':', linewidth=1.0)
    ax.fill_between(t, lower, upper, color='#e2e8f0', alpha=0.45)

    ax.vlines(TR, 0.0, 1.0, color='#0f766e', linestyle=':', linewidth=1.4)
    ax.vlines(TP, 0.0, peak_y, color='#ea580c', linestyle=':', linewidth=1.4)
    ax.vlines(TS, 0.0, 1.0, color='#7c3aed', linestyle=':', linewidth=1.4)
    ax.plot([TR], [1.0], 'o', color='#0f766e', markersize=7)
    ax.plot([TP], [peak_y], 'o', color='#ea580c', markersize=7)
    ax.plot([TS], [1.0], 'o', color='#7c3aed', markersize=7)

    ax.annotate('上升时间 $t_r$', xy=(TR, 1.0), xytext=(TR + 0.18, 0.35),
                fontsize=10, color='#0f766e',
                arrowprops=dict(arrowstyle='->', color='#0f766e', lw=1.4))
    ax.annotate('峰值时间 $t_p$', xy=(TP, peak_y), xytext=(TP + 0.16, peak_y + 0.08),
                fontsize=10, color='#ea580c',
                arrowprops=dict(arrowstyle='->', color='#ea580c', lw=1.4))
    ax.annotate('调节时间 $t_s$', xy=(TS, 1.0), xytext=(TS + 0.12, 0.2),
                fontsize=10, color='#7c3aed',
                arrowprops=dict(arrowstyle='->', color='#7c3aed', lw=1.4))
    ax.annotate('', xy=(TP + 0.12, peak_y), xytext=(TP + 0.12, 1.0),
                arrowprops=dict(arrowstyle='<->', color='#dc2626', lw=1.6))
    ax.text(TP + 0.18, (peak_y + 1.0) / 2.0, '超调量 $M_p$', fontsize=10, color='#dc2626', va='center')

    ax.text(2.96, upper + 0.012, '2% 误差带', fontsize=9, color='#475569', ha='right')
    ax.set_title('例题一：$\zeta = 0.4,\ \omega_n = 5$ 时的单位阶跃响应', fontsize=14, fontweight='bold', pad=12)
    ax.set_xlabel('时间 t / s')
    ax.set_ylabel('输出 c(t)')
    ax.set_xlim(0.0, 3.0)
    ax.set_ylim(0.0, 1.36)
    ax.grid(True, color='#e2e8f0')

    card.set_facecolor('#eff6ff')
    card.set_xticks([])
    card.set_yticks([])
    for spine in card.spines.values():
        spine.set_color('#bfdbfe')
        spine.set_linewidth(1.2)

    lines = [
        '参数识别',
        r'$\omega_n = 5$',
        r'$\zeta = 0.4$',
        r'$\omega_d \approx 4.583$',
        '',
        '指标结果',
        rf'$t_r \approx {TR:.3f}\,s$',
        rf'$t_p \approx {TP:.3f}\,s$',
        rf'$M_p \approx {MP:.1f}\%$',
        rf'$t_s \approx {TS:.1f}\,s$',
        '',
        '工程解释',
        '起步较快，',
        '但超调明显，',
        '最终约 2 s 内回稳。',
    ]

    y0 = 0.93
    for text in lines:
        if text == '':
            y0 -= 0.06
            continue
        style = dict(fontsize=11, color='#0f172a')
        if text in {'参数识别', '指标结果', '工程解释'}:
            style.update(fontweight='bold', color='#1d4ed8')
        card.text(0.08, y0, text, transform=card.transAxes, **style)
        y0 -= 0.065

    fig.text(0.5, 0.02, '“算出来的四个数”必须重新落回“看得见的同一条曲线”。', ha='center', fontsize=10, color='#475569')
    fig.subplots_adjust(left=0.06, right=0.97, bottom=0.10, top=0.90, wspace=0.12)
    plt.savefig(args.output, format='svg', bbox_inches='tight')
    print(f'已生成：{args.output}')


if __name__ == '__main__':
    main()
