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
import control as ct
from scipy.optimize import minimize
from PIL import Image

DATA_PATH = Path(__file__).resolve().parent / 'generated-data' / '4-4-optimization-data.json'
OUT_DIR = Path(__file__).resolve().parent.parent / 'processed'

matplotlib.rcParams['font.family'] = 'Hiragino Sans GB'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'Arial Unicode MS', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'
warnings.filterwarnings('ignore', message=r"Font 'default' does not have a glyph for .*")
logging.getLogger('matplotlib').setLevel(logging.ERROR)

COLORS = {
    'initial': '#4c78a8',
    'optimized': '#d95f02',
    'uncontrolled': '#8f8f8f',
    'weight_a': '#d95f02',
    'weight_b': '#2a9d8f',
    'weight_c': '#8c5fbf',
    'pareto': '#cc6f00',
    'pareto_mid': '#2a9d8f',
    'pareto_slow': '#5c677d',
    'grid': '#dddddd',
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
    formatter = ticker.FuncFormatter(lambda x, pos: f'{x:g}')
    ax.yaxis.set_major_formatter(formatter)


def _settling_time(t: np.ndarray, y: np.ndarray, tol: float = 0.02) -> float:
    final_value = float(y[-1])
    band = tol * max(abs(final_value), 1e-12)
    idx = np.where(np.abs(y - final_value) > band)[0]
    if len(idx) == 0:
        return 0.0
    j = idx[-1]
    return float(t[min(j + 1, len(t) - 1)])


def _heading_controller(x: np.ndarray) -> ct.TransferFunction:
    k, t_const, alpha = x
    s = ct.TransferFunction.s
    return k * (t_const * s + 1) / (alpha * t_const * s + 1)


def _heading_payload_from_x(label: str, x: np.ndarray) -> dict:
    s = ct.TransferFunction.s
    plant = 0.01715 / (s * (s + 0.1) * (s + 2.14375))
    t = np.arange(0.0, 200.0 + 1e-9, 0.1)
    omega = np.logspace(-3, 1, 500)
    controller = _heading_controller(x)
    closed_loop = ct.feedback(controller * plant, 1)
    control_loop = ct.feedback(controller, plant)
    tout, y = ct.step_response(closed_loop, T=t)
    _, u = ct.step_response(control_loop, T=t)
    mag, phase, w = ct.frequency_response(controller * plant, omega)
    gm, pm, wg, wc = ct.margin(controller * plant)
    y = np.asarray(y, dtype=float).reshape(-1)
    u = np.asarray(u, dtype=float).reshape(-1)
    tout = np.asarray(tout, dtype=float).reshape(-1)
    mag = np.asarray(mag, dtype=float).reshape(-1)
    phase = np.asarray(phase, dtype=float).reshape(-1)
    error_signal = 1 - y
    return {
        'label': label,
        'parameters': {
            'K': float(x[0]),
            'T': float(x[1]),
            'alpha': float(x[2]),
            'alphaT': float(x[1] * x[2]),
        },
        'controller_tex': f'C(s)={x[0]:.4f}({x[1]:.4f}s+1)/({x[1] * x[2]:.4f}s+1)',
        'response': {'t': tout.tolist(), 'y': y.tolist()},
        'control': {'t': tout.tolist(), 'y': u.tolist()},
        'open_loop': {
            'w': np.asarray(w, dtype=float).reshape(-1).tolist(),
            'mag_db': (20 * np.log10(np.maximum(mag, 1e-12))).tolist(),
            'phase_deg': (np.unwrap(phase) * 180 / np.pi).tolist(),
        },
        'metrics': {
            'final_value': float(y[-1]),
            'overshoot': max(0.0, (float(np.max(y)) - float(y[-1])) / max(abs(float(y[-1])), 1e-12) * 100.0),
            'settling_time': _settling_time(tout, y),
            'itae': float(np.trapz(tout * np.abs(error_signal), tout)),
            'itse': float(np.trapz(tout * (error_signal ** 2), tout)),
            'control_energy': float(np.trapz(u ** 2, tout)),
            'control_peak': float(np.max(np.abs(u))),
            'phase_margin': float(pm),
            'gain_margin': float(gm),
            'crossover': float(wc),
            'phase_cross': float(wg),
        },
    }


def _compute_ship_supplemental(ship_payload: dict) -> tuple[dict, list[dict], list[dict], list[dict]]:
    if ship_payload.get('unconstrained_weight_scan') and ship_payload.get('pareto_front') and ship_payload.get('pareto_examples'):
        scans = ship_payload['unconstrained_weight_scan']
        front = ship_payload['pareto_front']
        examples = ship_payload['pareto_examples']
        return ship_payload['initial'], scans, front, examples

    initial = ship_payload['initial']
    refs = {
        'ts': initial['metrics']['settling_time'],
        'itae': initial['metrics']['itae'],
        'itse': initial['metrics']['itse'],
        'eu': initial['metrics']['control_energy'],
    }
    bounds = [(1.0, 6.0), (4.0, 15.0), (0.15, 0.85)]
    x0 = np.array([initial['parameters']['K'], initial['parameters']['T'], initial['parameters']['alpha']], dtype=float)

    def bound_penalty(x: np.ndarray) -> float:
        under = np.maximum(0.0, np.array([1.0, 4.0, 0.15]) - x)
        over = np.maximum(0.0, x - np.array([6.0, 15.0, 0.85]))
        return 200.0 * float(np.sum((under + over) ** 2))

    def objective(weights: np.ndarray):
        def inner(x_vec: np.ndarray) -> float:
            payload = _heading_payload_from_x('tmp', np.asarray(x_vec, dtype=float))
            m = payload['metrics']
            return (
                weights[0] * (m['settling_time'] / 40.0) +
                weights[1] * (m['itae'] / refs['itae']) +
                weights[2] * (m['itse'] / refs['itse']) +
                weights[3] * (m['control_energy'] / refs['eu']) +
                bound_penalty(np.asarray(x_vec, dtype=float))
            )
        return inner

    scan_defs = [
        ('speed_first', '速度优先无约束方案', np.array([0.40, 0.30, 0.20, 0.10])),
        ('balanced', '平衡偏好无约束方案', np.array([0.30, 0.30, 0.20, 0.20])),
        ('energy_first', '动作代价优先无约束方案', np.array([0.20, 0.25, 0.25, 0.30])),
    ]
    scans = []
    seed = x0.copy()
    for case_id, label, weights in scan_defs:
        res = minimize(objective(weights), x0=seed, bounds=bounds, method='L-BFGS-B', options={'maxiter': 80})
        payload = _heading_payload_from_x(label, res.x)
        payload['case_id'] = case_id
        payload['weights'] = weights.tolist()
        payload['weights_label'] = f'[{weights[0]:.2f}, {weights[1]:.2f}, {weights[2]:.2f}, {weights[3]:.2f}]'
        payload['score'] = float(res.fun)
        scans.append(payload)
        seed = np.asarray(res.x, dtype=float)

    pareto_all = []
    seed = x0.copy()
    for lam in np.linspace(0.0, 1.0, 11):
        weights = np.array([0.0, lam, 0.0, 1.0 - lam])
        res = minimize(objective(weights), x0=seed, bounds=bounds, method='L-BFGS-B', options={'maxiter': 80})
        payload = _heading_payload_from_x(f'Pareto 候选 {lam:.2f}', res.x)
        payload['pareto_lambda'] = float(lam)
        pareto_all.append(payload)
        seed = np.asarray(res.x, dtype=float)

    front = []
    for current in pareto_all:
        dominated = False
        for other in pareto_all:
            if other is current:
                continue
            if (
                other['metrics']['itae'] <= current['metrics']['itae'] and
                other['metrics']['control_energy'] <= current['metrics']['control_energy'] and
                (
                    other['metrics']['itae'] < current['metrics']['itae'] or
                    other['metrics']['control_energy'] < current['metrics']['control_energy']
                )
            ):
                dominated = True
                break
        if not dominated:
            front.append(current)
    front.sort(key=lambda item: item['metrics']['itae'])
    example_indices = sorted(set([0, len(front) // 2, len(front) - 1]))
    example_labels = ['快速端', '中间点', '节能端']
    examples = []
    for label, idx in zip(example_labels, example_indices):
        item = dict(front[idx])
        item['example_label'] = label
        examples.append(item)
    return initial, scans, front, examples


def plot_ship_heading_compare(payload: dict) -> None:
    initial = payload['ship']['initial']
    optimized = payload['ship']['optimized']
    selected_weights = payload['ship']['selected_weights']

    fig, axes = plt.subplots(2, 2, figsize=(13.2, 9.2), dpi=220)
    ax_step, ax_mag = axes[0]
    ax_u, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
      style_axis(ax)
    for ax in (ax_mag, ax_phase):
      style_axis(ax)
      ax.set_xscale('log')

    step_series = [
        ('初始方案', initial, COLORS['initial']),
        ('优化方案', optimized, COLORS['optimized']),
    ]

    for label, item, color in step_series:
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        tu = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        w = np.asarray(item['open_loop']['w'], dtype=float)
        mag_db = np.asarray(item['open_loop']['mag_db'], dtype=float)
        phase_deg = np.asarray(item['open_loop']['phase_deg'], dtype=float)

        ax_step.plot(t, y, color=color, linewidth=2.1, label=label)
        ax_u.plot(tu, u, color=color, linewidth=2.1, label=label)
        ax_mag.plot(w, mag_db, color=color, linewidth=2.1, label=label)
        ax_phase.plot(w, phase_deg, color=color, linewidth=2.1, label=label)

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 120)
    ax_step.legend(frameon=False, fontsize=9)

    limit = payload['ship']['thresholds']['control_peak']
    ax_u.axhline(limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.axhline(-limit, color='#444444', linestyle='--', linewidth=0.9)
    ax_u.set_title('控制量响应')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('控制量')
    ax_u.set_xlim(0, 120)

    ax_mag.axhline(0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    fig.suptitle(
        '客船航向保持：4-3 初始方案与 4-4 优化结果对比\n'
        f'选定权重 = [{selected_weights[0]:.2f}, {selected_weights[1]:.2f}, '
        f'{selected_weights[2]:.2f}, {selected_weights[3]:.2f}]',
        fontsize=15,
        y=0.98,
    )
    save(fig, '4-4-ship-heading-optimization-compare.png')


def plot_roll_optimization_compare(payload: dict) -> None:
    roll = payload['roll']
    uncontrolled = roll['uncontrolled']
    initial = roll['initial']
    optimized = roll['optimized']
    threshold = float(roll['thresholds']['control_peak'])

    fig, axes = plt.subplots(1, 3, figsize=(15.2, 4.8), dpi=220)
    ax_mag, ax_y, ax_u = axes

    for ax in axes:
        style_axis(ax)

    ax_mag.set_xscale('log')
    for label, item, color in (
        ('未补偿', uncontrolled, COLORS['uncontrolled']),
        ('初始抗扰起点', initial, COLORS['initial']),
        ('优化结果', optimized, COLORS['optimized']),
    ):
        w = np.asarray(item['channel']['w'], dtype=float)
        mag_db = np.asarray(item['channel']['mag_db'], dtype=float)
        ax_mag.plot(w, mag_db, color=color, linewidth=2.0, label=label)
    ax_mag.set_title('扰动通道幅频对比')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')
    ax_mag.legend(frameon=False, fontsize=9)

    for label, item, color in (
        ('未补偿', uncontrolled, COLORS['uncontrolled']),
        ('初始抗扰起点', initial, COLORS['initial']),
        ('优化结果', optimized, COLORS['optimized']),
    ):
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        ax_y.plot(t, y, color=color, linewidth=2.0, label=label)
    ax_y.set_title('同频海浪激励下的横摇角')
    ax_y.set_xlabel('时间 / s')
    ax_y.set_ylabel('归一化横摇角')
    ax_y.set_xlim(0, 60)

    for label, item, color in (
        ('初始抗扰起点', initial, COLORS['initial']),
        ('优化结果', optimized, COLORS['optimized']),
    ):
        t = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        ax_u.plot(t, u, color=color, linewidth=2.0, label=label)
    ax_u.axhline(threshold, color='#666666', linestyle='--', linewidth=0.9)
    ax_u.axhline(-threshold, color='#666666', linestyle='--', linewidth=0.9)
    ax_u.set_title('减摇鳍动作对比')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('归一化鳍角命令')
    ax_u.set_xlim(0, 60)
    ax_u.legend(frameon=False, fontsize=9)

    init_metrics = initial['metrics']
    opt_metrics = optimized['metrics']
    fig.suptitle(
        '横摇边界案例：任务从航向跟踪改成抗扰后，目标函数随之重写\n'
        f'初始 k = {initial["parameters"]["k"]:.2f}, 优化后 k = {optimized["parameters"]["k"]:.3f}, '
        f'峰值 {init_metrics["resonance_peak_db"]:.2f} dB -> {opt_metrics["resonance_peak_db"]:.2f} dB',
        fontsize=14,
        y=1.02,
    )
    save(fig, '4-4-roll-optimization-compare.png')


def plot_ship_unconstrained_weight_compare(payload: dict) -> None:
    ship = payload['ship']
    initial, scan_entries, _, _ = _compute_ship_supplemental(ship)
    scans = {entry['case_id']: entry for entry in scan_entries}
    series = [
        ('起始方案', initial, COLORS['initial']),
        ('速度优先 A', scans['speed_first'], COLORS['weight_a']),
        ('平衡偏好 B', scans['balanced'], COLORS['weight_b']),
        ('动作代价优先 C', scans['energy_first'], COLORS['weight_c']),
    ]

    fig, axes = plt.subplots(2, 2, figsize=(13.8, 9.4), dpi=220)
    ax_step, ax_u = axes[0]
    ax_mag, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
        style_axis(ax)
    for ax in (ax_mag, ax_phase):
        style_axis(ax)
        ax.set_xscale('log')

    for label, item, color in series:
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        tu = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        w = np.asarray(item['open_loop']['w'], dtype=float)
        mag_db = np.asarray(item['open_loop']['mag_db'], dtype=float)
        phase_deg = np.asarray(item['open_loop']['phase_deg'], dtype=float)
        ax_step.plot(t, y, color=color, linewidth=2.0, label=label)
        ax_u.plot(tu, u, color=color, linewidth=2.0, label=label)
        ax_mag.plot(w, mag_db, color=color, linewidth=2.0, label=label)
        ax_phase.plot(w, phase_deg, color=color, linewidth=2.0, label=label)

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 100)
    ax_step.legend(frameon=False, fontsize=9, ncol=2)

    ax_u.set_title('控制量响应')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('控制量')
    ax_u.set_xlim(0, 100)

    ax_mag.axhline(0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    fig.suptitle(
        '主案例：起始方案与三组无约束权重方案的时域、频域对比',
        fontsize=15,
        y=0.98,
    )
    save(fig, '4-4-ship-heading-unconstrained-weight-compare.png')


def plot_pareto_front(payload: dict) -> None:
    ship = payload['ship']
    initial, _, front, examples = _compute_ship_supplemental(ship)

    fig, ax = plt.subplots(figsize=(8.8, 6.4), dpi=220)
    style_axis(ax)

    x = [item['metrics']['control_energy'] for item in front]
    y = [item['metrics']['itae'] for item in front]
    ax.plot(x, y, color=COLORS['pareto'], linewidth=1.6, alpha=0.8)
    ax.scatter(x, y, color=COLORS['pareto'], s=42, zorder=4, label='Pareto front')
    ax.scatter(
        [initial['metrics']['control_energy']],
        [initial['metrics']['itae']],
        color=COLORS['initial'],
        s=64,
        zorder=5,
        label='起始方案',
    )

    example_colors = [COLORS['weight_a'], COLORS['pareto_mid'], COLORS['pareto_slow']]
    for idx, (item, color) in enumerate(zip(examples, example_colors), start=1):
        ax.scatter(
            [item['metrics']['control_energy']],
            [item['metrics']['itae']],
            color=color,
            s=92,
            zorder=6,
        )
        ax.annotate(
            f'P{idx}',
            (item['metrics']['control_energy'], item['metrics']['itae']),
            xytext=(8, -10 if idx == 2 else 10),
            textcoords='offset points',
            fontsize=11,
            color=color,
            weight='bold',
        )

    ax.set_xlabel('控制能量 $E_u$')
    ax.set_ylabel('累计拖尾指标 ITAE')
    ax.set_title('主案例的 Pareto front')
    ax.legend(frameon=False, fontsize=9)
    fig.suptitle(
        '二目标取舍：降低拖尾通常意味着抬高动作代价',
        fontsize=14,
        y=0.98,
    )
    save(fig, '4-4-pareto-front.png')


def plot_pareto_response_compare(payload: dict) -> None:
    ship = payload['ship']
    initial, _, _, examples = _compute_ship_supplemental(ship)
    labels = ['起始方案', 'P1 快速端', 'P2 中间点', 'P3 节能端']
    colors = [COLORS['initial'], COLORS['weight_a'], COLORS['pareto_mid'], COLORS['pareto_slow']]
    items = [initial, *examples]

    fig, axes = plt.subplots(2, 2, figsize=(13.8, 9.4), dpi=220)
    ax_step, ax_u = axes[0]
    ax_mag, ax_phase = axes[1]

    for ax in (ax_step, ax_u):
        style_axis(ax)
    for ax in (ax_mag, ax_phase):
        style_axis(ax)
        ax.set_xscale('log')

    for label, item, color in zip(labels, items, colors):
        t = np.asarray(item['response']['t'], dtype=float)
        y = np.asarray(item['response']['y'], dtype=float)
        tu = np.asarray(item['control']['t'], dtype=float)
        u = np.asarray(item['control']['y'], dtype=float)
        w = np.asarray(item['open_loop']['w'], dtype=float)
        mag_db = np.asarray(item['open_loop']['mag_db'], dtype=float)
        phase_deg = np.asarray(item['open_loop']['phase_deg'], dtype=float)
        ax_step.plot(t, y, color=color, linewidth=2.0, label=label)
        ax_u.plot(tu, u, color=color, linewidth=2.0, label=label)
        ax_mag.plot(w, mag_db, color=color, linewidth=2.0, label=label)
        ax_phase.plot(w, phase_deg, color=color, linewidth=2.0, label=label)

    ax_step.axhline(1.0, color='#666666', linestyle='--', linewidth=0.9)
    ax_step.set_title('闭环输出阶跃响应')
    ax_step.set_xlabel('时间 / s')
    ax_step.set_ylabel('输出')
    ax_step.set_xlim(0, 120)
    ax_step.legend(frameon=False, fontsize=9, ncol=2)

    ax_u.set_title('控制量响应')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('控制量')
    ax_u.set_xlim(0, 120)

    ax_mag.axhline(0, color='#666666', linestyle='--', linewidth=0.9)
    ax_mag.set_title('开环幅频特性')
    ax_mag.set_xlabel(r'$\omega$ / rad/s')
    ax_mag.set_ylabel('幅值 / dB')

    ax_phase.axhline(-180, color='#666666', linestyle='--', linewidth=0.9)
    ax_phase.set_title('开环相频特性')
    ax_phase.set_xlabel(r'$\omega$ / rad/s')
    ax_phase.set_ylabel('相位 / deg')

    fig.suptitle(
        'Pareto 前沿上的典型候选：它们在不同目标上同样值得保留',
        fontsize=15,
        y=0.98,
    )
    save(fig, '4-4-pareto-response-compare.png')


def main() -> None:
    payload = load_payload()
    plot_ship_heading_compare(payload)
    plot_ship_unconstrained_weight_compare(payload)
    plot_pareto_front(payload)
    plot_pareto_response_compare(payload)
    plot_roll_optimization_compare(payload)


if __name__ == '__main__':
    main()
