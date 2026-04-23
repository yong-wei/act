from __future__ import annotations

import json
import logging
import os
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import ticker
import numpy as np
from PIL import Image


DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-7-design-closure-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

COLORS = {
    'passenger': '#30638e',
    'destroyer_fixed': '#d1495b',
    'destroyer_final': '#2b8a3e',
    'grid': '#dddddd',
    'text_dim': '#58636b',
    'soft': '#f2f5f7',
    'hard': '#ffe6e1',
}


def load_payload() -> dict:
    with DATA_PATH.open(encoding='utf-8') as handle:
        return json.load(handle)


def flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def save(fig: plt.Figure, filename: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / filename
    fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    flatten_to_white(path)


def style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')
    ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, pos: f'{x:g}'))


def to_xy(series: dict) -> tuple[np.ndarray, np.ndarray]:
    return np.asarray(series['t'], dtype=float), np.asarray(series['y'], dtype=float)


def draw_card(ax: plt.Axes, x: float, y: float, w: float, h: float, title: str, lines: list[str], facecolor: str) -> None:
    rect = plt.Rectangle((x, y), w, h, facecolor=facecolor, edgecolor='#c8d2d8', linewidth=1.0)
    ax.add_patch(rect)
    ax.text(x + 0.03, y + h - 0.08, title, fontsize=12.5, fontweight='bold', va='top')
    cursor = y + h - 0.16
    for line in lines:
        ax.text(x + 0.03, cursor, line, fontsize=10.0, va='top', color='#1f2a30')
        cursor -= 0.08


def plot_task_contract(payload: dict) -> None:
    scenario_configs = payload['scenario_configs']
    objectives = payload['objective_contracts']
    constraints = payload['constraint_contracts']

    fig, ax = plt.subplots(figsize=(14.5, 8.4), dpi=220)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    passenger = scenario_configs['passenger_ship_heading_hold']
    destroyer = scenario_configs['destroyer_fast_heading_maneuver']

    draw_card(
        ax,
        0.04,
        0.54,
        0.42,
        0.40,
        '客船基线任务书',
        [
            '对象：航向保持，单次目标收敛。',
            '排序：平顺、控制量代价、稳健性、收敛速度。',
            '主判断：固定超前结构能否把收益解释回中频整形职责。',
            f"对象模型：{passenger['plant']['gain']:.5f}/[s(s+{passenger['plant']['slow_pole']})(s+{passenger['plant']['fast_pole']})]",
        ],
        COLORS['soft'],
    )
    draw_card(
        ax,
        0.54,
        0.54,
        0.42,
        0.40,
        '驱逐舰机动任务书',
        [
            '对象：同类航向回路，20 s 方波机动切换。',
            '排序：切换段误差、机动完成度、峰值动作、能量、稳健性。',
            '主判断：参数重排何时已经不够，何时才需要有限换结构。',
            f"对象模型：{destroyer['plant']['gain']:.5f}/[s(s+{destroyer['plant']['slow_pole']})(s+{destroyer['plant']['fast_pole']})]",
        ],
        COLORS['soft'],
    )
    draw_card(
        ax,
        0.04,
        0.08,
        0.42,
        0.34,
        '共用目标合同',
        [
            '客船基线复核：调节时间、ITAE、ITSE、控制能量。',
            '驱逐舰固定结构：切换段误差、跟踪误差、航迹偏离、控制能量。',
            '驱逐舰变结构：在上列基础上把峰值动作和稳健性也并列比较。',
            f"候选结构：{' / '.join(payload['candidate_structures'])}",
        ],
        COLORS['soft'],
    )
    draw_card(
        ax,
        0.54,
        0.08,
        0.42,
        0.34,
        '共用约束与决策门槛',
        [
            f"硬约束：M_p≤{constraints['common_hard_constraints']['overshoot_max_pct']:.0f}% , "
            f"|u|max≤{constraints['common_hard_constraints']['u_peak_max']:.1f} , "
            f"φ_m≥{constraints['common_hard_constraints']['phase_margin_min_deg']:.0f}°",
            f"驱逐舰筛选：切换段误差≤{constraints['destroyer_screening']['transition_error_max']:.0f} , "
            f"航迹偏离≤{constraints['destroyer_screening']['trajectory_error_max']:.0f}",
            '决策规则：先重排参数；只有固定结构无法守住主矛盾时，才做有限换结构。',
        ],
        COLORS['hard'],
    )

    ax.text(0.5, 0.98, '双场景统一任务书与设计合同', ha='center', va='top', fontsize=17, fontweight='bold')
    ax.text(
        0.5,
        0.47,
        '两侧对象同类，但任务排序与筛选线不同；因此 4-7 的比较对象不是“谁更强”，而是“哪条解释链还能闭合”。',
        ha='center',
        va='center',
        fontsize=10.3,
        color=COLORS['text_dim'],
    )
    save(fig, '4-7-dual-scenario-task-contract.png')


def plot_convergence(payload: dict) -> None:
    history = payload['convergence_history']
    steps = np.asarray(history['steps'], dtype=float)
    coarse = history['coarse_global_search']
    shortlist = history['shortlist_refine']

    fig, axes = plt.subplots(1, 2, figsize=(14.2, 5.6), dpi=220)
    for ax in axes:
        style_axis(ax)

    axes[0].plot(steps, np.asarray(coarse['ga_best'], dtype=float), color='#2b8a3e', linewidth=2.2, label='GA 粗搜')
    axes[0].plot(steps, np.asarray(coarse['pso_best'], dtype=float), color='#f58518', linewidth=2.2, label='PSO 粗搜')
    axes[0].set_title('混合编码全局粗搜')
    axes[0].set_xlabel('迭代轮次')
    axes[0].set_ylabel('综合代价')
    axes[0].legend(frameon=False, fontsize=9)

    refine_steps = np.arange(1, len(shortlist['destroyer_fixed']) + 1)
    axes[1].plot(refine_steps, np.asarray(shortlist['destroyer_fixed'], dtype=float), color=COLORS['destroyer_fixed'], linewidth=2.2, label='固定结构精修')
    axes[1].plot(refine_steps, np.asarray(shortlist['destroyer_final'], dtype=float), color=COLORS['destroyer_final'], linewidth=2.2, label='PI + 超前 精修')
    axes[1].set_title('shortlist 局部精修')
    axes[1].set_xlabel('精修轮次')
    axes[1].set_ylabel('综合代价')
    axes[1].legend(frameon=False, fontsize=9)

    fig.suptitle('4-7 设计闭环中的搜索与精修证据', fontsize=16, y=1.02)
    fig.text(
        0.5,
        -0.03,
        '先用混合编码粗搜识别结构 shortlist，再用局部精修确认固定结构与有限换结构哪一条证据链更完整。',
        ha='center',
        fontsize=9.5,
        color=COLORS['text_dim'],
    )
    save(fig, '4-7-ship-heading-design-closure-convergence.png')


def plot_final_evidence(payload: dict) -> None:
    responses = payload['time_response']
    metrics = payload['comparison_metrics']
    freq = payload['frequency_response']

    fig, axes = plt.subplots(2, 2, figsize=(14.8, 10.8), dpi=220)
    for ax in axes.flat:
        style_axis(ax)

    t_p, r_p = to_xy(responses['passenger_baseline']['reference'])
    _, y_p = to_xy(responses['passenger_baseline']['output'])
    axes[0, 0].plot(t_p, r_p, color='#999999', linestyle='--', linewidth=1.2, label='客船参考')
    axes[0, 0].plot(t_p, y_p, color=COLORS['passenger'], linewidth=2.1, label='客船基线')
    axes[0, 0].set_title('客船基线复核')
    axes[0, 0].set_xlabel('时间 / s')
    axes[0, 0].set_ylabel('航向 / rad')
    axes[0, 0].legend(frameon=False, fontsize=8.8)

    t_d, r_d = to_xy(responses['destroyer_fixed_structure']['reference'])
    _, y_fixed = to_xy(responses['destroyer_fixed_structure']['output'])
    _, y_final = to_xy(responses['destroyer_final']['output'])
    axes[0, 1].step(t_d, r_d, where='post', color='#999999', linestyle='--', linewidth=1.2, label='驱逐舰参考')
    axes[0, 1].plot(t_d, y_fixed, color=COLORS['destroyer_fixed'], linewidth=2.0, label='固定结构')
    axes[0, 1].plot(t_d, y_final, color=COLORS['destroyer_final'], linewidth=2.0, label='最终方案')
    axes[0, 1].set_title('驱逐舰机动跟踪')
    axes[0, 1].set_xlabel('时间 / s')
    axes[0, 1].set_ylabel('航向 / rad')
    axes[0, 1].legend(frameon=False, fontsize=8.8)

    traj_fixed = responses['destroyer_fixed_structure']
    traj_final = responses['destroyer_final']
    exp_x = np.asarray(traj_fixed['trajectory_expected']['x'], dtype=float)
    exp_y = np.asarray(traj_fixed['trajectory_expected']['y'], dtype=float)
    act_fixed_x = np.asarray(traj_fixed['trajectory_actual']['x'], dtype=float)
    act_fixed_y = np.asarray(traj_fixed['trajectory_actual']['y'], dtype=float)
    act_final_x = np.asarray(traj_final['trajectory_actual']['x'], dtype=float)
    act_final_y = np.asarray(traj_final['trajectory_actual']['y'], dtype=float)
    axes[1, 0].plot(exp_x, exp_y, color='#999999', linestyle='--', linewidth=1.1, label='期望航迹')
    axes[1, 0].plot(act_fixed_x, act_fixed_y, color=COLORS['destroyer_fixed'], linewidth=2.0, label='固定结构')
    axes[1, 0].plot(act_final_x, act_final_y, color=COLORS['destroyer_final'], linewidth=2.0, label='最终方案')
    axes[1, 0].set_title('驱逐舰期望航迹与实际航迹')
    axes[1, 0].set_xlabel('x / m')
    axes[1, 0].set_ylabel('y / m')
    axes[1, 0].set_aspect('equal', adjustable='box')
    axes[1, 0].legend(frameon=False, fontsize=8.8)

    evidence_names = ['切换段误差', '航迹偏离', '峰值动作', '控制能量', '相角裕度']
    fixed_values = [
        metrics['destroyer_fixed_structure']['time_domain']['transition_error'],
        metrics['destroyer_fixed_structure']['mission_completion']['trajectory_error'],
        metrics['destroyer_fixed_structure']['control_effort']['u_max'],
        metrics['destroyer_fixed_structure']['control_effort']['control_energy'],
        metrics['destroyer_fixed_structure']['frequency_domain']['phase_margin_deg'],
    ]
    final_values = [
        metrics['destroyer_final']['time_domain']['transition_error'],
        metrics['destroyer_final']['mission_completion']['trajectory_error'],
        metrics['destroyer_final']['control_effort']['u_max'],
        metrics['destroyer_final']['control_effort']['control_energy'],
        metrics['destroyer_final']['frequency_domain']['phase_margin_deg'],
    ]
    x = np.arange(len(evidence_names))
    width = 0.34
    axes[1, 1].bar(x - width / 2, fixed_values, width=width, color=COLORS['destroyer_fixed'], label='固定结构')
    axes[1, 1].bar(x + width / 2, final_values, width=width, color=COLORS['destroyer_final'], label='最终方案')
    axes[1, 1].set_title('五类证据并排比较')
    axes[1, 1].set_xticks(x, evidence_names, rotation=15)
    axes[1, 1].legend(frameon=False, fontsize=8.8)
    axes[1, 1].text(
        0.02,
        0.96,
        f"最终方案相角裕度 {freq['destroyer_final']['margin']['phase_margin_deg']:.1f}°，"
        f"固定结构 {freq['destroyer_fixed_structure']['margin']['phase_margin_deg']:.1f}°",
        transform=axes[1, 1].transAxes,
        va='top',
        fontsize=8.6,
    )

    fig.suptitle('双场景最终证据比较', fontsize=16, y=1.01)
    fig.text(
        0.5,
        -0.02,
        '证据比较的目的不是做排名，而是解释排序为什么变化，以及何时只是重排参数、何时必须有限换结构。',
        ha='center',
        fontsize=9.5,
        color=COLORS['text_dim'],
    )
    save(fig, '4-7-ship-heading-final-evidence-compare.png')


def plot_controller_decode(payload: dict) -> None:
    decoded = payload['decoded_controllers']
    fig, axes = plt.subplots(1, 3, figsize=(15.2, 5.8), dpi=220)

    for ax, key, title, color in (
        (axes[0], 'passenger_baseline', '客船基线', COLORS['passenger']),
        (axes[1], 'destroyer_fixed_structure', '驱逐舰固定结构', COLORS['destroyer_fixed']),
        (axes[2], 'destroyer_final', '驱逐舰最终方案', COLORS['destroyer_final']),
    ):
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        item = decoded[key]
        ax.add_patch(plt.Rectangle((0.03, 0.04), 0.94, 0.92, facecolor='#f8fbfc', edgecolor='#c7d4db', linewidth=1.0))
        ax.text(0.07, 0.90, title, fontsize=13, fontweight='bold', color=color)
        ax.text(0.07, 0.82, item['structure_name'], fontsize=12, fontweight='bold')
        ax.text(0.07, 0.73, item['controller_tex'], fontsize=9.3, wrap=True)
        ax.text(0.07, 0.60, '参数', fontsize=10.8, fontweight='bold')
        cursor = 0.54
        for name, value in item['parameters'].items():
            ax.text(0.09, cursor, f'{name} = {value:.4f}', fontsize=9.6)
            cursor -= 0.06
        ax.text(0.07, 0.30, '职责分工', fontsize=10.8, fontweight='bold')
        cursor = 0.24
        for duty in item['duty_split']:
            ax.text(0.09, cursor, f'• {duty}', fontsize=9.4, wrap=True)
            cursor -= 0.10

    fig.suptitle('从搜索结果回到经典控制器职责', fontsize=16, y=1.02)
    save(fig, '4-7-ship-heading-final-controller-decode.png')


def main() -> None:
    payload = load_payload()
    plot_task_contract(payload)
    plot_convergence(payload)
    plot_final_evidence(payload)
    plot_controller_decode(payload)


if __name__ == '__main__':
    main()
