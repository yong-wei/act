from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FixedFormatter, FixedLocator, NullFormatter


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "processed"
DATA = PROCESSED / "5-1-boundary-data"


def setup_style() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": [
                "PingFang SC",
                "Hiragino Sans GB",
                "Songti SC",
                "Arial Unicode MS",
                "DejaVu Sans",
            ],
            "axes.unicode_minus": False,
            "figure.dpi": 150,
            "savefig.dpi": 220,
            "axes.edgecolor": "#333333",
            "axes.linewidth": 0.9,
            "grid.color": "#d7dde5",
            "grid.linewidth": 0.6,
        }
    )


def apply_axes_base(ax: plt.Axes, xlim=(-2, 2), ylim=(-1.6, 1.6)) -> None:
    ax.axhline(0, color="#444444", linewidth=0.7)
    ax.axvline(0, color="#444444", linewidth=0.7)
    ax.grid(True)
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_xlabel("输入")
    ax.set_ylabel("输出")


def save_static_characteristics() -> None:
    data = np.loadtxt(DATA / "static_characteristics.csv", delimiter=",")
    x = data[:, 0]
    y_linear = data[:, 1]
    panels = [
        ("饱和：幅值被截断", [(data[:, 2], "#1f77b4", "饱和")], None),
        ("死区：小信号无动作", [(data[:, 3], "#2ca02c", "死区")], (-0.35, 0.35)),
        ("继电器：阈值通断", [(data[:, 4], "#9467bd", "继电器")], None),
        (
            "滞环继电器：回程不同",
            [(data[:, 5], "#8c564b", "上行"), (data[:, 6], "#e377c2", "下行")],
            None,
        ),
        (
            "间隙：路径记忆",
            [(data[:, 7], "#d62728", "上行"), (data[:, 8], "#ff7f0e", "下行")],
            None,
        ),
        ("摩擦：启动需克服阻力", [(data[:, 9], "#7f7f7f", "摩擦")], None),
        ("速率限制：变化量受限", [(data[:, 10], "#17becf", "速率限制")], None),
        ("量化：输出分级", [(data[:, 11], "#bcbd22", "量化")], None),
        ("平滑非线性：局部斜率变化", [(data[:, 12], "#1b9e77", "平滑非线性")], None),
        ("分段增益：模式内斜率不同", [(data[:, 13], "#e6550d", "分段增益")], None),
    ]

    fig, axes = plt.subplots(2, 5, figsize=(16, 8.8), constrained_layout=True)
    for ax, (title, series, span) in zip(axes.flat, panels):
        apply_axes_base(ax)
        ax.plot(x, y_linear, "--", color="#8b96a7", linewidth=1.7, label="线性假设")
        for y, color, label in series:
            ax.plot(x, y, color=color, linewidth=2.1, label=label)
        if span is not None:
            ax.axvspan(span[0], span[1], color="#2ca02c", alpha=0.12)
        if "继电器" in title:
            ax.set_ylim(-1.25, 1.25)
        ax.set_title(title, fontsize=12.5)
        ax.legend(frameon=False, loc="upper left", fontsize=8)

    fig.suptitle("典型非线性环节的边界特性对照", fontsize=17, fontweight="bold")
    fig.savefig(PROCESSED / "5-1-boundary-static-characteristics.png", bbox_inches="tight")
    plt.close(fig)


def save_saturation_response() -> None:
    data = np.loadtxt(DATA / "saturation_response.csv", delimiter=",")
    t = data[:, 0]
    y_lin_small, y_sat_small = data[:, 1], data[:, 2]
    u_lin_small, u_sat_small = data[:, 3], data[:, 4]
    y_lin_large, y_sat_large = data[:, 5], data[:, 6]
    u_lin_large, u_sat_large = data[:, 7], data[:, 8]

    fig, axes = plt.subplots(2, 2, figsize=(11.5, 6.8), constrained_layout=True)
    panels = [
        (axes[0, 0], y_lin_small, y_sat_small, "小阶跃输出：线性预测仍接近真实响应", "输出"),
        (axes[1, 0], u_lin_small, u_sat_small, "小阶跃控制量：未触碰执行器边界", "控制量"),
        (axes[0, 1], y_lin_large, y_sat_large, "大阶跃输出：饱和使过程明显变慢", "输出"),
        (axes[1, 1], u_lin_large, u_sat_large, "大阶跃控制量：线性预测越过边界", "控制量"),
    ]

    for ax, linear, saturated, title, ylabel in panels:
        ax.plot(t, linear, color="#8592a3", linestyle="--", linewidth=2, label="线性预测")
        ax.plot(t, saturated, color="#1f77b4", linewidth=2.2, label="含饱和响应")
        if ylabel == "控制量":
            ax.axhline(1.2, color="#d62728", linewidth=1, linestyle=":", label="执行器上限")
            ax.axhline(-1.2, color="#d62728", linewidth=1, linestyle=":")
        ax.grid(True)
        ax.set_xlabel("时间 / s")
        ax.set_ylabel(ylabel)
        ax.set_title(title)
        ax.legend(frameon=False, loc="best")

    fig.suptitle("同一线性设计在小信号与大信号下的边界差异", fontsize=15, fontweight="bold")
    fig.savefig(PROCESSED / "5-1-saturation-response-compare.png", bbox_inches="tight")
    plt.close(fig)


def save_linearization_compare(
    time_file: str,
    bode_file: str,
    output_name: str,
    title: str,
    nonlinear_label: str,
    large_label: str,
) -> None:
    time_data = np.loadtxt(DATA / time_file, delimiter=",")
    bode_data = np.loadtxt(DATA / bode_file, delimiter=",")
    t = time_data[:, 0]
    w = bode_data[:, 0]
    colors = {"小阶跃": "#1f77b4", "大阶跃": "#d62728", "正弦": "#2ca02c"}

    fig = plt.figure(figsize=(14, 6.4), constrained_layout=True)
    gs = fig.add_gridspec(1, 2, width_ratios=[1.05, 1])
    ax_time = fig.add_subplot(gs[0, 0])
    right = gs[0, 1].subgridspec(2, 1, hspace=0.12)
    ax_mag = fig.add_subplot(right[0, 0])
    ax_phase = fig.add_subplot(right[1, 0], sharex=ax_mag)

    cases = [
        ("小阶跃", time_data[:, 1], time_data[:, 2], 0.0),
        ("大阶跃", time_data[:, 3], time_data[:, 4], 1.7),
        ("正弦", time_data[:, 5], time_data[:, 6], 3.4),
    ]
    for label, nonlinear, linear, offset in cases:
        ax_time.plot(t, nonlinear + offset, color=colors[label], linewidth=2.1, label=f"{label} 原始系统")
        ax_time.plot(
            t,
            linear + offset,
            color=colors[label],
            linestyle="--",
            linewidth=1.8,
            label=f"{label} 线性化系统",
        )
        ax_time.text(t[-1] + 0.15, offset, label, va="center", fontsize=10)
    ax_time.set_xlim(0, 18.8)
    ax_time.set_xlabel("时间 / s")
    ax_time.set_ylabel("输出（分层显示）")
    ax_time.set_title("三类典型输入下的时域响应")
    ax_time.grid(True)
    ax_time.legend(frameon=False, fontsize=8, ncol=2, loc="upper right")

    ax_mag.semilogx(w, bode_data[:, 1], color="#333333", linewidth=2.2, label="线性化传函")
    ax_mag.semilogx(w, bode_data[:, 3], color="#1f77b4", linewidth=1.9, label=f"{nonlinear_label} 小幅扫频")
    ax_mag.semilogx(w, bode_data[:, 5], color="#d62728", linewidth=1.9, label=large_label)
    ax_mag.set_ylabel("幅值 / dB")
    ax_mag.set_title("Bode 幅值对比")
    ax_mag.grid(True, which="both")
    ax_mag.legend(frameon=False, fontsize=8, loc="best")

    ax_phase.semilogx(w, bode_data[:, 2], color="#333333", linewidth=2.2, label="线性化传函")
    ax_phase.semilogx(w, bode_data[:, 4], color="#1f77b4", linewidth=1.9, label=f"{nonlinear_label} 小幅扫频")
    ax_phase.semilogx(w, bode_data[:, 6], color="#d62728", linewidth=1.9, label=large_label)
    ax_phase.set_xlabel("频率 / rad/s")
    ax_phase.set_ylabel("相位 / deg")
    ax_phase.set_title("Bode 相位对比")
    ax_phase.grid(True, which="both")
    for ax in (ax_mag, ax_phase):
        ax.xaxis.set_major_locator(FixedLocator([0.1, 1, 10]))
        ax.xaxis.set_minor_formatter(NullFormatter())
    ax_mag.xaxis.set_major_formatter(NullFormatter())
    ax_phase.xaxis.set_major_formatter(FixedFormatter(["0.1", "1", "10"]))
    ax_phase.tick_params(axis="x", which="major", labelbottom=True)

    fig.suptitle(title, fontsize=15, fontweight="bold")
    fig.savefig(PROCESSED / output_name, bbox_inches="tight")
    plt.close(fig)


def save_feedback_compare(
    data_file: str,
    output_name: str,
    title: str,
    nonlinear_label: str,
    control_label: str,
    extra_control_index: int | None = None,
    extra_control_label: str | None = None,
) -> None:
    data = np.loadtxt(DATA / data_file, delimiter=",")
    t = data[:, 0]
    y_linear = data[:, 1]
    y_nonlinear = data[:, 2]
    u_linear = data[:, 3]
    u_nonlinear = data[:, 4]

    fig, axes = plt.subplots(2, 1, figsize=(11, 6.8), constrained_layout=True, sharex=True)

    axes[0].plot(t, y_linear, color="#8592a3", linestyle="--", linewidth=2, label="忽略非线性预测")
    axes[0].plot(t, y_nonlinear, color="#1f77b4", linewidth=2.2, label=nonlinear_label)
    axes[0].set_ylabel("输出")
    axes[0].set_title("输出响应对比")
    axes[0].grid(True)
    axes[0].legend(frameon=False, loc="best")

    axes[1].plot(t, u_linear, color="#8592a3", linestyle="--", linewidth=2, label="忽略非线性控制量")
    axes[1].plot(t, u_nonlinear, color="#d62728", linewidth=2.1, label=control_label)
    if extra_control_index is not None and extra_control_label is not None:
        axes[1].plot(
            t,
            data[:, extra_control_index],
            color="#2ca02c",
            linewidth=1.7,
            linestyle=":",
            label=extra_control_label,
        )
    axes[1].set_xlabel("时间 / s")
    axes[1].set_ylabel("控制量")
    axes[1].set_title("控制量对比")
    axes[1].grid(True)
    axes[1].legend(frameon=False, loc="best")

    fig.suptitle(title, fontsize=15, fontweight="bold")
    fig.savefig(PROCESSED / output_name, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    setup_style()
    PROCESSED.mkdir(parents=True, exist_ok=True)
    save_static_characteristics()
    save_saturation_response()
    save_linearization_compare(
        "smooth_linearization_time.csv",
        "smooth_linearization_bode.csv",
        "5-1-local-linearization-smooth-compare.png",
        "合理局部线性化：平滑非线性在工作点附近可近似",
        "原始平滑系统",
        "原始系统 大幅扫频",
    )
    save_linearization_compare(
        "relay_bad_linearization_time.csv",
        "relay_bad_linearization_bode.csv",
        "5-1-local-linearization-relay-bad-compare.png",
        "不合理线性化：继电器切换不能被单一斜率替代",
        "继电器系统",
        "继电器系统 大幅扫频",
    )
    save_feedback_compare(
        "deadzone_feedback_compare.csv",
        "5-1-deadzone-feedback-compare.png",
        "死区执行机构：忽略小信号无动作会高估修正能力",
        "含死区实际响应",
        "死区后实际控制量",
    )
    save_feedback_compare(
        "relay_hysteresis_feedback_compare.csv",
        "5-1-relay-hysteresis-feedback-compare.png",
        "滞环继电器控制：忽略开关动作会掩盖周期摆动",
        "含滞环继电器响应",
        "继电器输出",
    )
    save_feedback_compare(
        "rate_limit_feedback_compare.csv",
        "5-1-rate-limit-feedback-compare.png",
        "速率限制舵机：忽略变化率边界会高估初段动作",
        "含速率限制响应",
        "实际执行器输出",
        extra_control_index=5,
        extra_control_label="控制器期望输出",
    )
    print(f"5-1 figures generated in {PROCESSED}")


if __name__ == "__main__":
    main()
