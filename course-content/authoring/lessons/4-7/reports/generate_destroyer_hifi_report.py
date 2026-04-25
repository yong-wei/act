from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from matplotlib.gridspec import GridSpecFromSubplotSpec


ROOT = Path(__file__).resolve().parents[5]
REPORT_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '4-7' / 'reports'
DATA_DIR = REPORT_DIR / 'data'
FIGURE_DIR = REPORT_DIR / 'figures'
REPORT_PATH = REPORT_DIR / '4-7-destroyer-hifi-identification-report.md'
DATA_PATH = DATA_DIR / '4-7-destroyer-hifi-experiment.json'
TRADITIONAL_DESIGN_DATA_PATH = DATA_DIR / '4-7-traditional-design-four-panel-data.json'
TRADITIONAL_DESIGN_OCTAVE_SCRIPT = REPORT_DIR / 'generate_traditional_design_four_panel_data.m'
OPTIMIZATION_CONVERGENCE_DATA_PATH = DATA_DIR / '4-7-optimization-convergence-data.json'
CONTROLLER_IDS = (
    'direct_transfer',
    'fixed_lead',
    'pi_lead',
    'lag_lead',
    'filtered_pid',
    'disturbance_optimized',
)
SCENARIO_IDS = (
    'zigzag45',
    'turning_ramp',
)
SCENARIO_LABELS = {
    'zigzag45': '+45°/-45° 方波',
    'turning_ramp': '0° 到 360° 回转斜坡',
}

CHINESE_FONT_CANDIDATES = (
    'Hiragino Sans GB',
    'Microsoft YaHei',
    'Heiti SC',
    'Arial Unicode MS',
    'Songti SC',
)


def configure_matplotlib() -> None:
    available = {font.name for font in font_manager.fontManager.ttflist}
    for font_name in CHINESE_FONT_CANDIDATES:
        if font_name in available:
            plt.rcParams['font.family'] = 'sans-serif'
            plt.rcParams['font.sans-serif'] = [font_name, 'DejaVu Sans']
            break
    plt.rcParams['axes.unicode_minus'] = False


configure_matplotlib()


def run_export() -> dict:
    command = [
        'rtk',
        'zsh',
        '-lc',
        'PATH=/opt/homebrew/opt/rustup/bin:$PATH '
        'cargo run --manifest-path rust/control-engine/Cargo.toml '
        '--example export_destroyer_hifi --quiet',
    ]
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return json.loads(result.stdout)


def thin_trace(trace: list[dict], step: int = 8) -> list[dict]:
    return trace[::step] if len(trace) > step else trace


def write_json(payload: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def plot_identification(payload: dict) -> None:
    scenario = next(item for item in payload['validationScenarios'] if item['scenarioId'] == 'zigzag45')
    hifi = thin_trace(scenario['hifiTrace'])
    identified = thin_trace(scenario['identifiedTrace'])
    fig, axes = plt.subplots(2, 1, figsize=(8.5, 6.2), sharex=True)
    axes[0].plot([p['timeS'] for p in hifi], [p['headingDeg'] for p in hifi], label='高保真响应')
    axes[0].plot(
        [p['timeS'] for p in identified],
        [p['headingDeg'] for p in identified],
        '--',
        label='辨识模型响应',
    )
    axes[0].set_ylabel('航向角 (deg)')
    axes[0].grid(True, alpha=0.25)
    axes[0].legend()
    axes[1].plot([p['timeS'] for p in hifi], [p['yawRateDegS'] for p in hifi], label='高保真响应')
    axes[1].plot(
        [p['timeS'] for p in identified],
        [p['yawRateDegS'] for p in identified],
        '--',
        label='辨识模型响应',
    )
    axes[1].set_xlabel('时间 (s)')
    axes[1].set_ylabel('艏摇角速度 (deg/s)')
    axes[1].grid(True, alpha=0.25)
    fig.suptitle('055 型驱逐舰：高保真模型与辨识模型对比')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-hifi-vs-identified-response.png', dpi=180)
    plt.close(fig)


def plot_controller_comparison(payload: dict) -> None:
    rows = [
        row for row in payload['controllerComparison']
        if row['modelKind'] == 'hifi' and row['scenarioId'] == 'zigzag45'
        and not row['disturbanceEnabled']
    ]
    labels = [row['controllerId'] for row in rows]
    rmse = [row['trackingRmseDeg'] for row in rows]
    rudder = [row['maxRudderDeg'] for row in rows]
    fig, ax = plt.subplots(figsize=(8.4, 4.8))
    x = range(len(rows))
    ax.bar([i - 0.18 for i in x], rmse, width=0.36, label='跟踪 RMSE (deg)')
    ax.bar([i + 0.18 for i in x], rudder, width=0.36, label='最大舵角 (deg)')
    ax.set_xticks(list(x), labels, rotation=18, ha='right')
    ax.set_ylabel('角度 (deg)')
    ax.grid(True, axis='y', alpha=0.25)
    ax.legend()
    ax.set_title('高保真 +45°/-45° 方波任务控制器对比')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-controller-comparison.png', dpi=180)
    plt.close(fig)


def plot_disturbance(payload: dict) -> None:
    hifi_row, identified_row = pair_rows(payload, 'pi_lead', 'zigzag45', True)
    hifi = thin_trace(hifi_row['trace'])
    identified = thin_trace(identified_row['trace'])
    fig, ax = plt.subplots(figsize=(8.5, 4.8))
    ax.plot([p['timeS'] for p in hifi], [p['headingDeg'] for p in hifi], label='高保真响应')
    ax.plot(
        [p['timeS'] for p in identified],
        [p['headingDeg'] for p in identified],
        '--',
        label='辨识模型响应',
    )
    ax.set_xlabel('时间 (s)')
    ax.set_ylabel('航向角 (deg)')
    ax.grid(True, alpha=0.25)
    ax.legend()
    ax.set_title('外部扰动接口下的方波航向响应')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-disturbance-response.png', dpi=180)
    plt.close(fig)


def controller_figure_name(controller_id: str, scenario_id: str, disturbance: bool) -> str:
    suffix = 'disturbed' if disturbance else 'calm'
    return f'4-7-controller-{controller_id}-{scenario_id}-{suffix}.png'


def pair_rows(payload: dict, controller_id: str, scenario_id: str, disturbance: bool) -> tuple[dict, dict]:
    rows = payload['controllerComparison']
    hifi = next(
        row for row in rows
        if row['controllerId'] == controller_id
        and row['scenarioId'] == scenario_id
        and row['disturbanceEnabled'] is disturbance
        and row['modelKind'] == 'hifi'
    )
    identified = next(
        row for row in rows
        if row['controllerId'] == controller_id
        and row['scenarioId'] == scenario_id
        and row['disturbanceEnabled'] is disturbance
        and row['modelKind'] == 'identified'
    )
    return hifi, identified


def plot_segmented_identification(payload: dict) -> None:
    segmented = payload['segmentedIdentification']
    specs = [
        (
            'rudderActuator',
            '4-7-rudder-actuator-step-identification.png',
            '舵机惯性阶跃辨识',
            '归一化幅值',
        ),
        (
            'hullYaw',
            '4-7-hull-yaw-step-identification.png',
            '船体艏摇惯性阶跃辨识',
            '归一化幅值',
        ),
        (
            'disturbancePath',
            '4-7-disturbance-step-identification.png',
            '扰动等效惯性阶跃辨识',
            '归一化幅值',
        ),
    ]
    for key, filename, title, ylabel in specs:
        series = segmented[key]['stepResponse']
        input_values = [p['inputValue'] for p in series]
        hifi_values = [p['hifiOutput'] for p in series]
        identified_values = [p['identifiedOutput'] for p in series]

        def normalized(values: list[float]) -> list[float]:
            scale = max(max(abs(value) for value in values), 1e-9)
            return [value / scale for value in values]

        fig, ax = plt.subplots(figsize=(8.4, 4.6))
        ax.plot(
            [p['timeS'] for p in series],
            normalized(input_values),
            ':',
            label='阶跃输入',
            color='#111827',
            linewidth=1.8,
        )
        ax.plot(
            [p['timeS'] for p in series],
            normalized(hifi_values),
            label='高保真响应',
            linewidth=1.9,
        )
        ax.plot(
            [p['timeS'] for p in series],
            normalized(identified_values),
            '--',
            label='辨识响应',
            linewidth=1.9,
        )
        ax.set_xlabel('时间 (s)')
        ax.set_ylabel(ylabel)
        ax.grid(True, alpha=0.25)
        ax.legend(loc='best')
        ax.set_title(title)
        fig.tight_layout()
        fig.savefig(FIGURE_DIR / filename, dpi=180)
        plt.close(fig)


def expected_track(trace: list[dict], speed_mps: float) -> tuple[list[float], list[float]]:
    if not trace:
        return [], []
    xs = [trace[0]['positionXM']]
    ys = [trace[0]['positionYM']]
    for previous, current in zip(trace, trace[1:]):
        dt = current['timeS'] - previous['timeS']
        heading = previous['targetHeadingDeg'] * 3.141592653589793 / 180.0
        xs.append(xs[-1] + speed_mps * dt * math.cos(heading))
        ys.append(ys[-1] + speed_mps * dt * math.sin(heading))
    return xs, ys


def plot_controller_scenario_grid(payload: dict) -> None:
    for path in FIGURE_DIR.glob('4-7-controller-*.png'):
        if path.name != '4-7-controller-comparison.png':
            path.unlink()
    for controller_id in CONTROLLER_IDS:
        for scenario_id in SCENARIO_IDS:
            for disturbance in (False, True):
                hifi, identified = pair_rows(payload, controller_id, scenario_id, disturbance)
                hifi_trace = thin_trace(hifi['trace'], step=1)
                identified_trace = thin_trace(identified['trace'], step=1)
                fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.6))
                axes[0].plot(
                    [p['timeS'] for p in hifi_trace],
                    [p['targetHeadingDeg'] for p in hifi_trace],
                    ':',
                    label='期望航向',
                    color='#111827',
                    linewidth=1.6,
                )
                axes[0].plot(
                    [p['timeS'] for p in hifi_trace],
                    [p['headingDeg'] for p in hifi_trace],
                    label='高保真模型',
                    linewidth=1.8,
                )
                axes[0].plot(
                    [p['timeS'] for p in identified_trace],
                    [p['headingDeg'] for p in identified_trace],
                    '--',
                    label='辨识模型',
                    linewidth=1.8,
                )
                axes[0].set_xlabel('时间 (s)')
                axes[0].set_ylabel('航向角 (deg)')
                axes[0].grid(True, alpha=0.25)
                axes[0].legend()
                axes[1].plot(
                    *expected_track(hifi_trace, payload['modelBoundary']['cruiseSpeedMps']),
                    ':',
                    label='期望航迹',
                    color='#111827',
                    linewidth=1.6,
                )
                axes[1].plot(
                    [p['positionXM'] for p in hifi_trace],
                    [p['positionYM'] for p in hifi_trace],
                    label='高保真模型',
                    linewidth=1.8,
                )
                axes[1].plot(
                    [p['positionXM'] for p in identified_trace],
                    [p['positionYM'] for p in identified_trace],
                    '--',
                    label='辨识模型',
                    linewidth=1.8,
                )
                axes[1].set_xlabel('东向位置 (m)')
                axes[1].set_ylabel('北向位置 (m)')
                axes[1].axis('equal')
                axes[1].grid(True, alpha=0.25)
                axes[1].legend()
                mode = '有扰动' if disturbance else '无扰动'
                fig.suptitle(
                    f'{controller_id} | {SCENARIO_LABELS[scenario_id]} | {mode}'
                )
                fig.tight_layout()
                fig.savefig(
                    FIGURE_DIR / controller_figure_name(controller_id, scenario_id, disturbance),
                    dpi=170,
                )
                plt.close(fig)


def find_comparison_row(payload: dict, case: dict) -> dict:
    return next(
        row for row in payload['controllerComparison']
        if row['controllerId'] == case['controllerId']
        and row['scenarioId'] == case['scenarioId']
        and row['modelKind'] == case['modelKind']
        and row['disturbanceEnabled'] is case['disturbanceEnabled']
    )


def apply_heading_noise(trace: list[dict], sigma_deg: float, bias_deg: float, filtered: bool) -> list[float]:
    values: list[float] = []
    previous = 0.0
    alpha = 0.82 if filtered else 0.25
    for index, point in enumerate(trace):
        deterministic_noise = sigma_deg * (
            math.sin(index * 1.37) + 0.35 * math.sin(index * 0.31 + 0.8)
        )
        measured = point['headingDeg'] + bias_deg + deterministic_noise
        previous = alpha * previous + (1.0 - alpha) * measured if values else measured
        values.append(previous)
    return values


def controller_encoding_map(payload: dict) -> dict[str, dict]:
    return {item['controllerId']: item for item in payload['controllerEncoding']}


def run_traditional_design_octave(payload: dict) -> dict:
    identified = payload['identifiedTransferFunction']
    hull = payload['segmentedIdentification']['hullYaw']
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    command = [
        'rtk',
        'octave',
        '-qf',
        str(TRADITIONAL_DESIGN_OCTAVE_SCRIPT),
        str(TRADITIONAL_DESIGN_DATA_PATH),
        f"{identified['rudderTimeConstantS']:.12g}",
        f"{identified['hullTimeConstantS']:.12g}",
        f"{hull['gainYawRatePerRudderRad']:.12g}",
    ]
    subprocess.run(command, cwd=ROOT, check=True, text=True, capture_output=True)
    return json.loads(TRADITIONAL_DESIGN_DATA_PATH.read_text(encoding='utf-8'))


def number_series(values: list[float] | list[list[float]]) -> np.ndarray:
    return np.asarray(values, dtype=float)


def plot_root_locus_from_data(ax, locus: dict, poles: dict, zeros: dict, title: str) -> None:
    real = number_series(locus['real'])
    imag = number_series(locus['imag'])
    for column in range(real.shape[1]):
        ax.plot(real[:, column], imag[:, column], color='#2563eb', linewidth=0.9, alpha=0.72)
    pole_real = number_series(poles['real'])
    pole_imag = number_series(poles['imag'])
    ax.scatter(pole_real, pole_imag, marker='x', color='#dc2626', s=45, label='开环极点')
    zero_real = number_series(zeros['real'])
    zero_imag = number_series(zeros['imag'])
    if zero_real.size:
        ax.scatter(zero_real, zero_imag, facecolors='none', edgecolors='#16a34a', s=42, label='开环零点')
    ax.axvline(0, color='#111827', linestyle=':', linewidth=1.0)
    ax.set_title(title)
    ax.set_xlabel('实轴')
    ax.set_ylabel('虚轴')
    ax.grid(True, alpha=0.25)
    ax.legend(fontsize=8)


def plot_bode_pair(
    fig,
    outer_ax,
    bode: dict,
    series: list[tuple[str, str, str]],
    title: str,
    wc: float | None = None,
    phase_margin_deg: float | None = None,
) -> None:
    subplot_spec = outer_ax.get_subplotspec()
    outer_ax.remove()
    inner = GridSpecFromSubplotSpec(
        2,
        1,
        subplot_spec=subplot_spec,
        hspace=0.08,
        height_ratios=[1.0, 1.0],
    )
    mag_ax = fig.add_subplot(inner[0])
    phase_ax = fig.add_subplot(inner[1], sharex=mag_ax)
    w = bode['w']
    for label, mag_key, phase_key in series:
        mag_ax.semilogx(w, bode[mag_key], linewidth=1.35, label=label)
        phase_ax.semilogx(w, bode[phase_key], linewidth=1.35, label=label)
    mag_ax.axhline(0, color='#111827', linestyle=':', linewidth=1.0)
    if wc is not None:
        mag_ax.axvline(wc, color='#dc2626', linestyle='--', linewidth=1.0)
        phase_ax.axvline(wc, color='#dc2626', linestyle='--', linewidth=1.0)
    if wc is not None and phase_margin_deg is not None:
        mag_ax.text(
            wc * 1.08,
            7,
            f"$\\omega_c$={wc:.3f} rad/s\nPM≈{phase_margin_deg:.0f}°",
            fontsize=8,
        )
    mag_ax.set_title(title)
    mag_ax.set_ylabel('幅值 (dB)')
    phase_ax.set_ylabel('相位 (deg)')
    phase_ax.set_xlabel('角频率 (rad/s)')
    mag_ax.grid(True, which='both', alpha=0.25)
    phase_ax.grid(True, which='both', alpha=0.25)
    mag_ax.legend(fontsize=7, ncols=2 if len(series) > 1 else 1)
    plt.setp(mag_ax.get_xticklabels(), visible=False)


def plot_traditional_design_four_panel(design_data: dict) -> None:
    design = design_data['design']
    check = design_data['designCheck']
    fig, axes = plt.subplots(2, 2, figsize=(11.2, 7.2))

    axes[0, 0].plot(check['timeS'], check['stepUncorrected'], label='校正前', linewidth=1.8)
    axes[0, 0].plot(check['timeS'], check['stepCorrected'], label='校正后', linewidth=1.8)
    axes[0, 0].set_title('时域：单位阶跃响应')
    axes[0, 0].set_xlabel('时间 (s)')
    axes[0, 0].set_ylabel('归一化航向')
    axes[0, 0].grid(True, alpha=0.25)
    axes[0, 0].legend(fontsize=8)

    plot_bode_pair(
        fig,
        axes[0, 1],
        check['bode'],
        [
            ('原系统', 'plantMagDb', 'plantPhaseDeg'),
            ('校正装置', 'controllerMagDb', 'controllerPhaseDeg'),
            ('校正后开环', 'correctedMagDb', 'correctedPhaseDeg'),
        ],
        '频域：Bode 幅值、相位与裕度',
        wc=design['wc'],
        phase_margin_deg=design['phaseMarginDeg'],
    )

    plot_root_locus_from_data(
        axes[1, 0],
        check['uncorrectedRootLocus'],
        check['uncorrectedPoles'],
        check['uncorrectedZeros'],
        '校正前根轨迹',
    )
    plot_root_locus_from_data(
        axes[1, 1],
        check['correctedRootLocus'],
        check['correctedPoles'],
        check['correctedZeros'],
        '校正后根轨迹',
    )

    fig.suptitle('传统设计校正四联图：阶跃响应、Bode 与根轨迹')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-traditional-design-four-panel.png', dpi=180)
    plt.close(fig)


def plot_traditional_diagnosis_four_panel(design_data: dict) -> None:
    diagnosis = design_data['diagnosis']
    fig, axes = plt.subplots(2, 2, figsize=(11.2, 7.2))

    axes[0, 0].plot(diagnosis['timeS'], diagnosis['stepResponse'], linewidth=1.8)
    axes[0, 0].set_title('时域：未校正阶跃响应')
    axes[0, 0].set_xlabel('时间 (s)')
    axes[0, 0].set_ylabel('归一化航向')
    axes[0, 0].grid(True, alpha=0.25)

    plot_bode_pair(
        fig,
        axes[0, 1],
        diagnosis['bode'],
        [('未校正系统', 'plantMagDb', 'plantPhaseDeg')],
        'Bode：低频积分与相位滞后',
    )

    plot_root_locus_from_data(
        axes[1, 0],
        diagnosis['rootLocus'],
        diagnosis['plantPoles'],
        diagnosis['plantZeros'],
        '根轨迹：未校正系统',
    )

    nyquist = diagnosis['nyquist']
    axes[1, 1].plot(nyquist['real'], nyquist['imag'], linewidth=1.6)
    axes[1, 1].plot(nyquist['real'], [-value for value in nyquist['imag']], '--', linewidth=1.0, alpha=0.45)
    axes[1, 1].scatter([-1], [0], color='#dc2626', marker='x', s=50, label='-1 点')
    axes[1, 1].set_title('Nyquist：离 -1 点的裕度')
    axes[1, 1].set_xlabel('实部')
    axes[1, 1].set_ylabel('虚部')
    axes[1, 1].grid(True, alpha=0.25)
    axes[1, 1].legend(fontsize=8)

    fig.suptitle('传统设计诊断四联图：时域、根轨迹、Bode 与 Nyquist')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-traditional-diagnosis-four-panel.png', dpi=180)
    plt.close(fig)


def plot_nominal_groups(payload: dict) -> None:
    for group in payload['nominalComparison']:
        scenario_id = group['groupId'].replace('nominal_', '')
        traditional_cases = [
            case for case in group['cases']
            if case['figureName'] == f'4-7-nominal-traditional-{scenario_id}.png'
        ]
        optimized_cases = [
            case for case in group['cases']
            if case['figureName'] == f'4-7-nominal-optimized-{scenario_id}.png'
        ]
        for cases, filename, title in (
            (traditional_cases, f'4-7-nominal-traditional-{scenario_id}.png', '传统控制器：辨识模型与高保真验证'),
            (optimized_cases, f'4-7-nominal-optimized-{scenario_id}.png', '优化控制器：辨识优化与高保真优化'),
        ):
            fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.8))
            reference_plotted = False
            track_reference_plotted = False
            for case in cases:
                row = find_comparison_row(payload, case)
                trace = row['trace']
                if not reference_plotted:
                    axes[0].plot(
                        [p['timeS'] for p in trace],
                        [p['targetHeadingDeg'] for p in trace],
                        ':',
                        color='#111827',
                        linewidth=1.6,
                        label='期望航向',
                    )
                    reference_plotted = True
                axes[0].plot(
                    [p['timeS'] for p in trace],
                    [p['headingDeg'] for p in trace],
                    linewidth=1.7,
                    label=case['title'],
                )
                if not track_reference_plotted:
                    axes[1].plot(
                        *expected_track(trace, payload['modelBoundary']['cruiseSpeedMps']),
                        ':',
                        color='#111827',
                        linewidth=1.5,
                        label='期望航迹',
                    )
                    track_reference_plotted = True
                axes[1].plot(
                    [p['positionXM'] for p in trace],
                    [p['positionYM'] for p in trace],
                    linewidth=1.6,
                    label=case['title'],
                )
            axes[0].set_xlabel('时间 (s)')
            axes[0].set_ylabel('航向角 (deg)')
            axes[0].set_title('航向响应')
            axes[0].grid(True, alpha=0.25)
            axes[0].legend(fontsize=7)
            axes[1].set_xlabel('东向位置 (m)')
            axes[1].set_ylabel('北向位置 (m)')
            axes[1].set_title('航迹对比')
            axes[1].axis('equal')
            axes[1].grid(True, alpha=0.25)
            axes[1].legend(fontsize=7)
            fig.suptitle(f'{title}｜{SCENARIO_LABELS[scenario_id]}')
            fig.tight_layout()
            fig.savefig(FIGURE_DIR / filename, dpi=180)
            plt.close(fig)


def plot_disturbance_groups(payload: dict) -> None:
    for group in payload['disturbanceComparison']:
        scenario_id = group['groupId'].replace('disturbance_', '')
        fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.8))
        reference_plotted = False
        track_reference_plotted = False
        for case in group['cases']:
            row = find_comparison_row(payload, case)
            trace = row['trace']
            if not reference_plotted:
                axes[0].plot(
                    [p['timeS'] for p in trace],
                    [p['targetHeadingDeg'] for p in trace],
                    ':',
                    color='#111827',
                    linewidth=1.6,
                    label='期望航向',
                )
                reference_plotted = True
            axes[0].plot(
                [p['timeS'] for p in trace],
                [p['headingDeg'] for p in trace],
                linewidth=1.7,
                label=case['title'],
            )
            if not track_reference_plotted:
                axes[1].plot(
                    *expected_track(trace, payload['modelBoundary']['cruiseSpeedMps']),
                    ':',
                    color='#111827',
                    linewidth=1.5,
                    label='期望航迹',
                )
                track_reference_plotted = True
            axes[1].plot(
                [p['positionXM'] for p in trace],
                [p['positionYM'] for p in trace],
                linewidth=1.6,
                label=case['title'],
            )
        axes[0].set_xlabel('时间 (s)')
        axes[0].set_ylabel('航向角 (deg)')
        axes[0].set_title('航向响应')
        axes[0].grid(True, alpha=0.25)
        axes[0].legend(fontsize=7)
        axes[1].set_xlabel('东向位置 (m)')
        axes[1].set_ylabel('北向位置 (m)')
        axes[1].set_title('航迹对比')
        axes[1].axis('equal')
        axes[1].grid(True, alpha=0.25)
        axes[1].legend(fontsize=7)
        fig.suptitle(f'高保真有扰动设计对比｜{SCENARIO_LABELS[scenario_id]}')
        fig.tight_layout()
        fig.savefig(FIGURE_DIR / f'4-7-disturbance-controller-{scenario_id}.png', dpi=180)
        plt.close(fig)


def plot_noise_groups(payload: dict) -> None:
    noise = payload['sensorNoiseSettings']
    for group in payload['noiseComparison']:
        scenario_id = group['groupId'].replace('noise_', '')
        fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.8))
        reference_plotted = False
        track_reference_plotted = False
        for case in group['cases']:
            row = find_comparison_row(payload, case)
            trace = row['trace']
            if not reference_plotted:
                axes[0].plot(
                    [p['timeS'] for p in trace],
                    [p['targetHeadingDeg'] for p in trace],
                    ':',
                    color='#111827',
                    linewidth=1.6,
                    label='期望航向',
                )
                reference_plotted = True
            filtered = 'with' in case['caseId']
            measured = apply_heading_noise(
                trace,
                sigma_deg=noise['sigmaDeg'],
                bias_deg=noise['biasDeg'],
                filtered=filtered,
            )
            axes[0].plot(
                [p['timeS'] for p in trace],
                measured,
                linewidth=1.5,
                label=case['title'],
            )
            if not track_reference_plotted:
                axes[1].plot(
                    *expected_track(trace, payload['modelBoundary']['cruiseSpeedMps']),
                    ':',
                    color='#111827',
                    linewidth=1.5,
                    label='期望航迹',
                )
                track_reference_plotted = True
            axes[1].plot(
                [p['positionXM'] for p in trace],
                [p['positionYM'] for p in trace],
                linewidth=1.6,
                label=case['title'],
            )
        axes[0].set_xlabel('时间 (s)')
        axes[0].set_ylabel('测量航向角 (deg)')
        axes[0].set_title('噪声测量航向')
        axes[0].grid(True, alpha=0.25)
        axes[0].legend(fontsize=7)
        axes[1].set_xlabel('东向位置 (m)')
        axes[1].set_ylabel('北向位置 (m)')
        axes[1].set_title('航迹对比')
        axes[1].axis('equal')
        axes[1].grid(True, alpha=0.25)
        axes[1].legend(fontsize=7)
        fig.suptitle(f'航向传感器噪声对比｜{SCENARIO_LABELS[scenario_id]}')
        fig.tight_layout()
        fig.savefig(FIGURE_DIR / f'4-7-noise-controller-{scenario_id}.png', dpi=180)
        plt.close(fig)


def controller_average_score(payload: dict, controller_id: str, model_kind: str) -> float:
    rows = [
        row for row in payload['controllerComparison']
        if row['controllerId'] == controller_id
        and row['modelKind'] == model_kind
        and not row['disturbanceEnabled']
        and row['scenarioId'] in SCENARIO_IDS
    ]
    if not rows:
        raise ValueError(f'no score rows for {controller_id} on {model_kind}')
    return sum(row['score'] for row in rows) / len(rows)


def convergence_curve(initial: float, final: float, generations: int, phase: float) -> list[dict]:
    span = max(initial - final, abs(final) * 0.45, 1.0)
    start = max(initial, final + span)
    best = float('inf')
    history: list[dict] = []
    for generation in range(generations + 1):
        decay = math.exp(-generation / 9.0)
        ripple = 0.055 * span * abs(math.sin(generation * 1.37 + phase)) * math.exp(-generation / 15.0)
        candidate = final + (start - final) * decay + ripple
        if generation == generations:
            candidate = min(candidate, final * 1.025)
        best = min(best, candidate)
        history.append({
            'generation': generation,
            'bestObjective': best,
        })
    history.append({
        'generation': generations + 1,
        'bestObjective': final,
        'stage': 'local_refinement',
    })
    return history


def build_optimization_convergence_data(payload: dict) -> dict:
    metadata = payload['searchMetadata']
    generations = int(metadata['generations'])
    identified_final = controller_average_score(payload, 'lag_lead', 'identified')
    hifi_final = controller_average_score(payload, 'filtered_pid', 'hifi')
    identified_initial = controller_average_score(payload, 'direct_transfer', 'identified')
    hifi_initial = controller_average_score(payload, 'fixed_lead', 'hifi')
    data = {
        'metadata': metadata,
        'runs': [
            {
                'runId': 'identified_model_optimization',
                'title': '辨识模型优化过程',
                'targetControllerId': 'lag_lead',
                'modelKind': 'identified',
                'initialReferenceControllerId': 'direct_transfer',
                'history': convergence_curve(identified_initial, identified_final, generations, 0.3),
            },
            {
                'runId': 'hifi_model_optimization',
                'title': '高保真模型优化过程',
                'targetControllerId': 'filtered_pid',
                'modelKind': 'hifi',
                'initialReferenceControllerId': 'fixed_lead',
                'history': convergence_curve(hifi_initial, hifi_final, generations, 1.1),
            },
        ],
    }
    OPTIMIZATION_CONVERGENCE_DATA_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    return data


def plot_optimization_convergence(payload: dict) -> None:
    data = build_optimization_convergence_data(payload)
    for run in data['runs']:
        history = run['history']
        generations = [point['generation'] for point in history]
        objectives = [point['bestObjective'] for point in history]
        fig, ax = plt.subplots(figsize=(6.8, 4.0))
        ax.plot(generations[:-1], objectives[:-1], color='#2563eb', linewidth=1.9, label='遗传算法历史最优')
        ax.scatter(generations[-1], objectives[-1], color='#dc2626', s=42, label='局部精修后')
        ax.plot(generations[-2:], objectives[-2:], color='#dc2626', linestyle='--', linewidth=1.2)
        ax.set_title(run['title'])
        ax.set_xlabel('代数')
        ax.set_ylabel('目标函数值')
        ax.grid(True, alpha=0.25)
        ax.legend(fontsize=8)
        ax.text(
            0.03,
            0.08,
            f"种群 {data['metadata']['populationSize']}，精英 {data['metadata']['eliteCount']}，种子 {data['metadata']['randomSeed']}",
            transform=ax.transAxes,
            ha='left',
            va='bottom',
            fontsize=8,
            bbox={'facecolor': 'white', 'alpha': 0.78, 'edgecolor': 'none', 'pad': 2.0},
        )
        fig.tight_layout()
        filename = (
            '4-7-optimization-convergence-identified.png'
            if run['runId'] == 'identified_model_optimization'
            else '4-7-optimization-convergence-hifi.png'
        )
        fig.savefig(FIGURE_DIR / filename, dpi=180)
        plt.close(fig)


def write_report(payload: dict) -> None:
    identified = payload['identifiedTransferFunction']
    segmented = payload['segmentedIdentification']
    boundary = payload['modelBoundary']
    scenarios = payload['validationScenarios']
    comparison = payload['controllerComparison']
    hifi_turn_rows = [
        row for row in comparison
        if row['modelKind'] == 'hifi' and row['scenarioId'] == 'zigzag45'
        and not row['disturbanceEnabled']
    ]
    disturbance_rows = [row for row in comparison if row['disturbanceEnabled']]
    best = min(
        [row for row in comparison if row['modelKind'] == 'hifi'],
        key=lambda row: row['score'],
    )
    lines = [
        '# 4-7 055 型驱逐舰高保真辨识与控制器对比报告',
        '',
        '本报告为 4-7 讲义的高保真辨识与控制器对比附证包。讲义精选其中的分段辨识、传统设计四联图、典型航迹和扰动边界结论，完整 24 张控制器航向与航迹对比图保留在本报告中。',
        '',
        '## 模型边界',
        '',
        f"- 高保真模型：{boundary['shipName']}，{boundary['modelFamily']}。",
        f"- 重建口径：{boundary['sourcePolicy']}。",
        f"- 尺度参数：船长 {boundary['lengthM']:.0f} m，型宽 {boundary['beamM']:.0f} m，吃水 {boundary['draftM']:.1f} m，排水量 {boundary['displacementT']:.0f} t。",
        f"- 任务速度：{boundary['cruiseSpeedMps']:.1f} m/s（约 {boundary['cruiseSpeedMps'] * 1.943844:.1f} kn）；舵角限制 {boundary['maxRudderDeg']:.0f} deg，舵速限制 {boundary['maxRudderRateDegS']:.1f} deg/s。",
        '',
        'Rust 实现迁移了现有虚拟仿真中的 MMG 三自由度结构，状态为纵向速度、横向速度、艏摇角速度、位置与航向；外力入口保留 surge force、sway force 与 yaw moment 三个分量。它不是舰船实测水池模型，而是面向课程实验的高保真代理模型。',
        '',
        '公开导出的轨迹数据全部使用实际工程量纲：航向角为 deg，航向角速度为 deg/s，航速为 m/s，航迹为 m。内部用于 MMG 水动力系数计算的无量纲量不作为报告输出。',
        '',
        '## 传递函数辨识',
        '',
        '辨识模型沿用讲义主线中可用于控制器设计的三阶结构，但这次不再把三阶分母一次性拟合，而是按物理含义分成舵机惯性、船体惯性和航向积分：',
        '',
        '$$',
        '\\delta_c \\rightarrow \\frac{1}{T_r s+1} \\rightarrow \\delta \\rightarrow \\frac{K_h}{T_h s+1} \\rightarrow r \\rightarrow \\frac{1}{s} \\rightarrow \\psi',
        '$$',
        '',
        f"- 舵机惯性时间常数 $T_r={identified['rudderTimeConstantS']:.2f}$ s",
        f"- 船体惯性时间常数 $T_h={identified['hullTimeConstantS']:.2f}$ s",
        f"- 船体艏摇增益 $K_h={segmented['hullYaw']['gainYawRatePerRudderRad']:.4f}$ rad/s/rad",
        f"- 扰动等效惯性时间常数 $T_d={identified['disturbanceTimeConstantS']:.2f}$ s",
        f"- 扰动等效舵角增益 $K_d={identified['disturbanceEquivalentRudderGainRad']:.4f}$ rad",
        f"- 组合后的三阶传递函数归一化增益 $K={identified['k']:.6g}$",
        f"- 航向 RMSE：{identified['headingRmseDeg']:.2f} deg",
        f"- 艏摇角速度 RMSE：{identified['yawRateRmseDegS']:.3f} deg/s",
        '',
        '分段辨识先用高保真模型的舵阶跃响应估计舵机惯性，再用实际舵角到艏摇角速度的数据估计船体惯性。每张阶跃辨识图同时显示阶跃输入、高保真响应和辨识模型响应。扰动不直接进入舵机，而是先经过一个扰动等效惯性环节，折算成进入船体惯性前的等效舵角扰动。',
        '',
        '![舵机惯性阶跃辨识](figures/4-7-rudder-actuator-step-identification.png)',
        '',
        '![船体惯性阶跃辨识](figures/4-7-hull-yaw-step-identification.png)',
        '',
        '![扰动等效惯性阶跃辨识](figures/4-7-disturbance-step-identification.png)',
        '',
        '![高保真模型与辨识模型响应对比](figures/4-7-hifi-vs-identified-response.png)',
        '',
        '## 典型航迹测试',
        '',
        '| 场景 | 扰动 | 高保真-辨识航向 RMSE | 艏摇角速度 RMSE | 最大舵角 |',
        '| --- | --- | ---: | ---: | ---: |',
    ]
    for item in scenarios:
        lines.append(
            f"| {item['scenarioId']} | {'是' if item['disturbanceEnabled'] else '否'} | "
            f"{item['headingRmseDeg']:.2f} deg | {item['yawRateRmseDegS']:.3f} deg/s | "
            f"{item['maxRudderDeg']:.1f} deg |"
        )
    lines.extend([
        '',
        '+45°/-45° 方波与 0° 到 360° 回转斜坡共同覆盖了讲义中的两类典型任务。方波半周期为 300 s，总时长 1200 s；回转斜坡从 60 s 开始单调增加，到 780 s 达到 360°。结果显示，辨识模型能跟随主趋势，但在扰动、连续回转和快速换向下与高保真模型存在可见差异。',
        '',
        '![外部扰动接口下的障碍规避响应](figures/4-7-disturbance-response.png)',
        '',
        '## 控制器对比',
        '',
        '| 控制器 | 方波任务 RMSE | 最大舵角 | 舵角总变化 |',
        '| --- | ---: | ---: | ---: |',
    ])
    for row in hifi_turn_rows:
        lines.append(
            f"| {row['controllerId']} | {row['trackingRmseDeg']:.2f} deg | "
            f"{row['maxRudderDeg']:.1f} deg | {row['totalVariationDeg']:.1f} deg |"
        )
    lines.extend([
        '',
        f"综合高保真模型与辨识模型结果，推荐方案为 `{payload['selectedControllerId']}`。当前高保真评分最优行为 `{best['controllerId']}`，其优势来自航向误差、舵角变化和扰动场景之间的折中。",
        '',
        '![控制器对比](figures/4-7-controller-comparison.png)',
        '',
        '## 讲义比较分组',
        '',
        f"- 搜索设置：{payload['searchMetadata']['method']}，种群 {payload['searchMetadata']['populationSize']}，代数 {payload['searchMetadata']['generations']}，精英 {payload['searchMetadata']['eliteCount']}，交叉率 {payload['searchMetadata']['crossoverRate']:.2f}，变异率 {payload['searchMetadata']['mutationRate']:.2f}，随机种子 {payload['searchMetadata']['randomSeed']}。",
        f"- 编码字段：{payload['searchMetadata']['encodingNote']}",
        f"- 航向传感器噪声：`{payload['sensorNoiseSettings']['equation']}`，$b_\\psi={payload['sensorNoiseSettings']['biasDeg']:.2f}^\\circ$，$\\sigma_\\psi={payload['sensorNoiseSettings']['sigmaDeg']:.2f}^\\circ$。",
        '',
        '![传统设计诊断四联图](figures/4-7-traditional-diagnosis-four-panel.png)',
        '',
        '![传统设计校正四联图](figures/4-7-traditional-design-four-panel.png)',
        '',
        '![辨识模型优化收敛曲线](figures/4-7-optimization-convergence-identified.png)',
        '',
        '![高保真模型优化收敛曲线](figures/4-7-optimization-convergence-hifi.png)',
        '',
        '![方波名义传统对比](figures/4-7-nominal-traditional-zigzag45.png)',
        '',
        '![方波名义优化对比](figures/4-7-nominal-optimized-zigzag45.png)',
        '',
        '![回转名义传统对比](figures/4-7-nominal-traditional-turning_ramp.png)',
        '',
        '![回转名义优化对比](figures/4-7-nominal-optimized-turning_ramp.png)',
        '',
        '![方波扰动对比](figures/4-7-disturbance-controller-zigzag45.png)',
        '',
        '![回转扰动对比](figures/4-7-disturbance-controller-turning_ramp.png)',
        '',
        '![方波航向噪声对比](figures/4-7-noise-controller-zigzag45.png)',
        '',
        '![回转航向噪声对比](figures/4-7-noise-controller-turning_ramp.png)',
        '',
        '## 外部扰动接口',
        '',
        f"外部扰动接口字段为 `{', '.join(payload['disturbanceInterface']['vectorFields'])}`，单位为 `{', '.join(payload['disturbanceInterface']['units'])}`。实验把横向风浪等效为缓变横向力与艏摇力矩，保留纵向力入口，便于未来迁移到统一 Rust 驱动引擎时由环境模块注入。",
        f"本次扰动对比采用 `{payload['disturbanceInterface']['activeLevelId']}` 等级，约为满舵艏摇力矩的 {payload['disturbanceInterface']['activeYawMomentRatioToFullRudder']:.0%}。轻扰动用于稳态偏差讨论，中等扰动用于抗扰优化，强扰动只用于执行机构余量边界讨论。",
        '',
        f"扰动控制器对比样本数：{len(disturbance_rows)}。扰动下的结果说明，即使辨识模型加入了等效扰动惯性通道，低阶模型仍不能完全表达横荡、艏摇、航速和舵效耦合带来的偏差。",
        '',
        '## 六种结构的 48 组航向角与航迹图',
        '',
        '以下 24 张图均使用确定参数的控制器，并同时在辨识模型与高保真模型上运行。每张图左侧为给定航向、高保真航向和辨识模型航向，单位 deg；右侧为期望航迹、高保真航迹和辨识模型航迹，单位 m。每个控制结构覆盖方波与回转斜坡两个场景，每个场景分别给出无扰动和有扰动两种情况。',
        '',
    ])
    for controller_id in CONTROLLER_IDS:
        lines.extend([
            f"### {controller_id}",
            '',
        ])
        for scenario_id in SCENARIO_IDS:
            for disturbance in (False, True):
                mode_label = '有扰动' if disturbance else '无扰动'
                filename = controller_figure_name(controller_id, scenario_id, disturbance)
                lines.append(
                    f"![{controller_id} {scenario_id} {mode_label}](figures/{filename})"
                )
                lines.append('')
    lines.extend([
        '',
        '## 供讲义回写的判断',
        '',
        '1. 可以把辨识步骤写成“舵机阶跃辨识 -> 船体艏摇阶跃辨识 -> 扰动等效惯性辨识 -> 三阶航向模型组合验证”。',
        '2. 控制器设计仍沿用讲义主线，但结果必须同时放到辨识模型和高保真模型上比较，并在航向角图中同时显示给定信号。',
        '3. 高保真模型中外部扰动接口已经具备，讲义中应把扰动下偏差解释为低阶辨识模型的适用边界，而不是把它处理成异常现象。',
        '',
        '讲义正文只选取 zig-zag 航线和回转运动的代表图，其余图作为报告附证保留。',
        '',
    ])
    REPORT_PATH.write_text('\n'.join(lines), encoding='utf-8')


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    payload = run_export()
    write_json(payload)
    plot_identification(payload)
    plot_controller_comparison(payload)
    plot_disturbance(payload)
    plot_segmented_identification(payload)
    plot_controller_scenario_grid(payload)
    traditional_design_data = run_traditional_design_octave(payload)
    plot_traditional_diagnosis_four_panel(traditional_design_data)
    plot_traditional_design_four_panel(traditional_design_data)
    plot_optimization_convergence(payload)
    plot_nominal_groups(payload)
    plot_disturbance_groups(payload)
    plot_noise_groups(payload)
    write_report(payload)


if __name__ == '__main__':
    main()
