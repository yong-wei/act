from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[5]
REPORT_DIR = ROOT / 'course-content' / 'authoring' / 'lessons' / '4-7' / 'reports'
DATA_DIR = REPORT_DIR / 'data'
FIGURE_DIR = REPORT_DIR / 'figures'
REPORT_PATH = REPORT_DIR / '4-7-destroyer-hifi-identification-report.md'
DATA_PATH = DATA_DIR / '4-7-destroyer-hifi-experiment.json'
CONTROLLER_IDS = (
    'direct_transfer',
    'fixed_lead',
    'pi_lead',
    'lag_lead',
    'filtered_pid',
)
SCENARIO_IDS = (
    'turn90',
    'obstacle',
    'circle',
    'switching20s',
)
SCENARIO_LABELS = {
    'turn90': '90-degree turn',
    'obstacle': 'Obstacle sequence',
    'circle': 'Circular track',
    'switching20s': '20 s switching',
}


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
    scenario = next(item for item in payload['validationScenarios'] if item['scenarioId'] == 'turn90')
    hifi = thin_trace(scenario['hifiTrace'])
    identified = thin_trace(scenario['identifiedTrace'])
    fig, axes = plt.subplots(2, 1, figsize=(8.5, 6.2), sharex=True)
    axes[0].plot([p['timeS'] for p in hifi], [p['headingDeg'] for p in hifi], label='MMG high-fidelity')
    axes[0].plot(
        [p['timeS'] for p in identified],
        [p['headingDeg'] for p in identified],
        '--',
        label='Identified transfer function',
    )
    axes[0].set_ylabel('Heading (deg)')
    axes[0].grid(True, alpha=0.25)
    axes[0].legend()
    axes[1].plot([p['timeS'] for p in hifi], [p['yawRateDegS'] for p in hifi], label='MMG high-fidelity')
    axes[1].plot(
        [p['timeS'] for p in identified],
        [p['yawRateDegS'] for p in identified],
        '--',
        label='Identified transfer function',
    )
    axes[1].set_xlabel('Time (s)')
    axes[1].set_ylabel('Yaw rate (deg/s)')
    axes[1].grid(True, alpha=0.25)
    fig.suptitle('055 Destroyer: high-fidelity vs identified model')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-hifi-vs-identified-response.png', dpi=180)
    plt.close(fig)


def plot_controller_comparison(payload: dict) -> None:
    rows = [
        row for row in payload['controllerComparison']
        if row['modelKind'] == 'hifi' and row['scenarioId'] == 'turn90'
        and not row['disturbanceEnabled']
    ]
    labels = [row['controllerId'] for row in rows]
    rmse = [row['trackingRmseDeg'] for row in rows]
    rudder = [row['maxRudderDeg'] for row in rows]
    fig, ax = plt.subplots(figsize=(8.4, 4.8))
    x = range(len(rows))
    ax.bar([i - 0.18 for i in x], rmse, width=0.36, label='Tracking RMSE (deg)')
    ax.bar([i + 0.18 for i in x], rudder, width=0.36, label='Max rudder (deg)')
    ax.set_xticks(list(x), labels, rotation=18, ha='right')
    ax.set_ylabel('Degree')
    ax.grid(True, axis='y', alpha=0.25)
    ax.legend()
    ax.set_title('Controller comparison on high-fidelity 90-degree turn')
    fig.tight_layout()
    fig.savefig(FIGURE_DIR / '4-7-controller-comparison.png', dpi=180)
    plt.close(fig)


def plot_disturbance(payload: dict) -> None:
    scenario = next(item for item in payload['validationScenarios'] if item['scenarioId'] == 'obstacle')
    hifi = thin_trace(scenario['hifiTrace'])
    identified = thin_trace(scenario['identifiedTrace'])
    fig, ax = plt.subplots(figsize=(8.5, 4.8))
    ax.plot([p['timeS'] for p in hifi], [p['headingDeg'] for p in hifi], label='MMG with disturbance')
    ax.plot(
        [p['timeS'] for p in identified],
        [p['headingDeg'] for p in identified],
        '--',
        label='Identified model with equivalent disturbance path',
    )
    ax.set_xlabel('Time (s)')
    ax.set_ylabel('Heading (deg)')
    ax.grid(True, alpha=0.25)
    ax.legend()
    ax.set_title('Obstacle heading sequence under external disturbance interface')
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
            'Rudder actuator inertia identification',
            'Actual rudder angle (deg)',
        ),
        (
            'hullYaw',
            '4-7-hull-yaw-step-identification.png',
            'Hull yaw inertia identification',
            'Yaw rate (deg/s)',
        ),
        (
            'disturbancePath',
            '4-7-disturbance-step-identification.png',
            'Equivalent disturbance inertia identification',
            'Yaw rate (deg/s)',
        ),
    ]
    for key, filename, title, ylabel in specs:
        series = segmented[key]['stepResponse']
        fig, ax = plt.subplots(figsize=(8.4, 4.6))
        ax.plot(
            [p['timeS'] for p in series],
            [p['hifiOutput'] for p in series],
            label='High-fidelity step response',
            linewidth=1.9,
        )
        ax.plot(
            [p['timeS'] for p in series],
            [p['identifiedOutput'] for p in series],
            '--',
            label='Identified inertia element',
            linewidth=1.9,
        )
        ax_input = ax.twinx()
        ax_input.step(
            [p['timeS'] for p in series],
            [p['inputValue'] for p in series],
            where='post',
            color='#111827',
            linestyle=':',
            linewidth=1.6,
            label='Step input',
        )
        ax.set_xlabel('Time (s)')
        ax.set_ylabel(ylabel)
        ax_input.set_ylabel('Step input')
        ax.grid(True, alpha=0.25)
        lines, labels = ax.get_legend_handles_labels()
        input_lines, input_labels = ax_input.get_legend_handles_labels()
        ax.legend(lines + input_lines, labels + input_labels, loc='best')
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
                    label='Reference heading',
                    color='#111827',
                    linewidth=1.6,
                )
                axes[0].plot(
                    [p['timeS'] for p in hifi_trace],
                    [p['headingDeg'] for p in hifi_trace],
                    label='High-fidelity MMG',
                    linewidth=1.8,
                )
                axes[0].plot(
                    [p['timeS'] for p in identified_trace],
                    [p['headingDeg'] for p in identified_trace],
                    '--',
                    label='Identified model',
                    linewidth=1.8,
                )
                axes[0].set_xlabel('Time (s)')
                axes[0].set_ylabel('Heading angle (deg)')
                axes[0].grid(True, alpha=0.25)
                axes[0].legend()
                axes[1].plot(
                    *expected_track(hifi_trace, payload['modelBoundary']['cruiseSpeedMps']),
                    ':',
                    label='Expected track from reference heading',
                    color='#111827',
                    linewidth=1.6,
                )
                axes[1].plot(
                    [p['positionXM'] for p in hifi_trace],
                    [p['positionYM'] for p in hifi_trace],
                    label='High-fidelity MMG',
                    linewidth=1.8,
                )
                axes[1].plot(
                    [p['positionXM'] for p in identified_trace],
                    [p['positionYM'] for p in identified_trace],
                    '--',
                    label='Identified model',
                    linewidth=1.8,
                )
                axes[1].set_xlabel('East position (m)')
                axes[1].set_ylabel('North position (m)')
                axes[1].axis('equal')
                axes[1].grid(True, alpha=0.25)
                axes[1].legend()
                mode = 'with disturbance' if disturbance else 'without disturbance'
                fig.suptitle(
                    f'{controller_id} | {SCENARIO_LABELS[scenario_id]} | {mode}'
                )
                fig.tight_layout()
                fig.savefig(
                    FIGURE_DIR / controller_figure_name(controller_id, scenario_id, disturbance),
                    dpi=170,
                )
                plt.close(fig)


def write_report(payload: dict) -> None:
    identified = payload['identifiedTransferFunction']
    segmented = payload['segmentedIdentification']
    boundary = payload['modelBoundary']
    scenarios = payload['validationScenarios']
    comparison = payload['controllerComparison']
    hifi_turn_rows = [
        row for row in comparison
        if row['modelKind'] == 'hifi' and row['scenarioId'] == 'turn90'
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
        '本报告为 4-7 讲义的高保真辨识与控制器对比附证包。讲义精选其中的分段辨识、典型航迹和扰动边界结论，完整 40 张控制器对比图保留在本报告中。',
        '',
        '## 模型边界',
        '',
        f"- 高保真模型：{boundary['shipName']}，{boundary['modelFamily']}。",
        f"- 重建口径：{boundary['sourcePolicy']}。",
        f"- 尺度参数：船长 {boundary['lengthM']:.0f} m，型宽 {boundary['beamM']:.0f} m，吃水 {boundary['draftM']:.1f} m，排水量 {boundary['displacementT']:.0f} t。",
        f"- 任务速度：{boundary['cruiseSpeedMps']:.1f} m/s；舵角限制 {boundary['maxRudderDeg']:.0f} deg，舵速限制 {boundary['maxRudderRateDegS']:.1f} deg/s。",
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
        '90 度转向、障碍规避、近似回旋与 20 s 目标切换共同覆盖了讲义中的典型航迹测试。结果显示，辨识模型能跟随主趋势，但在扰动和快速切换下与高保真模型存在可见差异，这正是后续讲义需要暴露给学生的设计局限。',
        '',
        '![外部扰动接口下的障碍规避响应](figures/4-7-disturbance-response.png)',
        '',
        '## 控制器对比',
        '',
        '| 控制器 | 90 度转向 RMSE | 最大舵角 | 舵角总变化 |',
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
        '## 外部扰动接口',
        '',
        f"外部扰动接口字段为 `{', '.join(payload['disturbanceInterface']['vectorFields'])}`，单位为 `{', '.join(payload['disturbanceInterface']['units'])}`。实验把横向风浪等效为缓变横向力与艏摇力矩，保留纵向力入口，便于未来迁移到统一 Rust 驱动引擎时由环境模块注入。",
        '',
        f"扰动控制器对比样本数：{len(disturbance_rows)}。扰动下的结果说明，即使辨识模型加入了等效扰动惯性通道，低阶模型仍不能完全表达横荡、艏摇、航速和舵效耦合带来的偏差。",
        '',
        '## 五种结构的 40 组航向角与航迹图',
        '',
        '以下 40 张图均使用面向辨识模型设计的控制器，并同时在辨识模型与高保真模型上运行。每张图左侧为给定航向、高保真航向和辨识模型航向，单位 deg；右侧为期望航迹、高保真航迹和辨识模型航迹，单位 m。每个控制结构覆盖 4 个场景，每个场景分别给出无扰动和有扰动两种情况。',
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
    write_report(payload)


if __name__ == '__main__':
    main()
