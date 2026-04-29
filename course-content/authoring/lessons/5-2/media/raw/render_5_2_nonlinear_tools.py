from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "processed"
DATA = PROCESSED / "5-2-nonlinear-tools-data"


def load_csv(name: str) -> np.ndarray:
    return np.loadtxt(DATA / name, delimiter=",")


def apply_style() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": ["Arial Unicode MS", "PingFang SC", "Heiti SC", "DejaVu Sans"],
            "axes.unicode_minus": False,
            "figure.dpi": 150,
            "savefig.dpi": 220,
            "axes.grid": True,
            "grid.alpha": 0.25,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "legend.frameon": False,
        }
    )


def render_tool_comparison() -> None:
    local = load_csv("local_linearization.csv")
    phase_field = load_csv("phase_field.csv")
    nyquist = load_csv("describing_nyquist.csv")
    desc = load_csv("saturation_describing_function.csv")

    fig, axes = plt.subplots(1, 3, figsize=(14, 4.4), constrained_layout=True)

    ax = axes[0]
    ax.plot(local[:, 0], local[:, 1], color="#1f77b4", lw=2.4, label=r"$y=\tanh x$")
    ax.plot(local[:, 0], local[:, 2], color="#d62728", lw=1.8, ls="--", label="工作点 x0=0 的线性化")
    ax.plot(local[:, 0], local[:, 3], color="#2ca02c", lw=1.8, ls="--", label="工作点 x0=1 的线性化")
    ax.scatter([0, 1], [0, np.tanh(1)], color=["#d62728", "#2ca02c"], zorder=5)
    ax.set_xlim(-2.5, 2.5)
    ax.set_ylim(-1.5, 1.5)
    ax.set_title("局部线性化：工作点附近的近似")
    ax.set_xlabel("输入 x")
    ax.set_ylabel("输出 y")
    ax.legend(fontsize=8, loc="lower right")

    ax = axes[1]
    ax.quiver(
        phase_field[:, 0],
        phase_field[:, 1],
        phase_field[:, 2],
        phase_field[:, 3],
        color="#b0b0b0",
        alpha=0.75,
        scale=34,
        width=0.003,
    )
    colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd"]
    for i, color in enumerate(colors, start=1):
        traj = load_csv(f"phase_trajectory_{i}.csv")
        ax.plot(traj[:, 1], traj[:, 2], color=color, lw=1.7)
        ax.scatter(traj[0, 1], traj[0, 2], color=color, s=22)
    ax.set_xlim(-3, 3)
    ax.set_ylim(-4, 4)
    ax.set_title("相平面：状态轨迹与吸引行为")
    ax.set_xlabel("状态 x")
    ax.set_ylabel(r"速度 $\dot{x}$")

    ax = axes[2]
    ax.plot(nyquist[:, 1], nyquist[:, 2], color="#1f77b4", lw=2.0, label=r"$G(j\omega)$")
    ax.plot(desc[:, 2], np.zeros_like(desc[:, 2]), color="#d62728", lw=2.0, label=r"$-1/N(A)$")
    ax.axhline(0, color="#444444", lw=0.8)
    ax.axvline(0, color="#444444", lw=0.8)
    crossing = load_csv("nyquist_negative_real_crossing.csv")
    ax.scatter([crossing[1]], [crossing[2]], color="#111111", s=28, zorder=5)
    ax.annotate(
        "近似交点",
        xy=(crossing[1], crossing[2]),
        xytext=(-2.7, 1.0),
        arrowprops={"arrowstyle": "->", "lw": 0.9, "color": "#333333"},
        fontsize=9,
    )
    ax.set_xlim(-6, 1.2)
    ax.set_ylim(-3.4, 3.4)
    ax.set_aspect("equal", adjustable="box")
    ax.set_title("描述函数：频域中的近似边界")
    ax.set_xlabel("实部")
    ax.set_ylabel("虚部")
    ax.legend(fontsize=8, loc="lower left")

    fig.suptitle("三种非线性边界工具看到的对象不同", fontsize=15, y=1.03)
    fig.savefig(PROCESSED / "5-2-nonlinear-tool-comparison.png", bbox_inches="tight")
    plt.close(fig)


def render_phase_focus() -> None:
    phase_field = load_csv("phase_field.csv")
    fig, ax = plt.subplots(figsize=(7.2, 5.2), constrained_layout=True)
    ax.quiver(
        phase_field[:, 0],
        phase_field[:, 1],
        phase_field[:, 2],
        phase_field[:, 3],
        color="#b5b5b5",
        alpha=0.78,
        scale=34,
        width=0.003,
    )
    colors = ["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd"]
    labels = ["小偏差出发", "大位移出发", "反向扰动出发", "速度扰动出发"]
    for i, (color, label) in enumerate(zip(colors, labels), start=1):
        traj = load_csv(f"phase_trajectory_{i}.csv")
        ax.plot(traj[:, 1], traj[:, 2], color=color, lw=1.9, label=label)
        ax.scatter(traj[0, 1], traj[0, 2], color=color, s=28)
    ax.set_xlim(-3, 3)
    ax.set_ylim(-4, 4)
    ax.set_xlabel("状态 x")
    ax.set_ylabel(r"速度 $\dot{x}$")
    ax.set_title(r"Van der Pol 振子相平面：不同初始条件趋向共同周期行为")
    ax.legend(loc="upper right", fontsize=9)
    fig.savefig(PROCESSED / "5-2-phase-plane-limit-cycle.png", bbox_inches="tight")
    plt.close(fig)


def render_describing_detail() -> None:
    nyquist = load_csv("describing_nyquist.csv")
    desc = load_csv("saturation_describing_function.csv")
    fig, ax = plt.subplots(figsize=(7.4, 5.2), constrained_layout=True)
    ax.plot(nyquist[:, 1], nyquist[:, 2], color="#1f77b4", lw=2.0, label=r"线性部分 $G(j\omega)$")
    ax.plot(nyquist[:, 1], -nyquist[:, 2], color="#1f77b4", lw=1.0, alpha=0.35)
    ax.plot(desc[:, 2], np.zeros_like(desc[:, 2]), color="#d62728", lw=2.2, label=r"饱和环节 $-1/N(A)$")
    crossing = load_csv("nyquist_negative_real_crossing.csv")
    ax.scatter([crossing[1]], [crossing[2]], color="#111111", s=32, zorder=5)
    ax.annotate(
        rf"$\omega\approx {crossing[0]:.2f}$ rad/s",
        xy=(crossing[1], crossing[2]),
        xytext=(-3.8, 1.3),
        arrowprops={"arrowstyle": "->", "lw": 0.9, "color": "#333333"},
        fontsize=9,
    )
    ax.axhline(0, color="#555555", lw=0.8)
    ax.axvline(0, color="#555555", lw=0.8)
    ax.set_xlim(-7, 1)
    ax.set_ylim(-4, 4)
    ax.set_aspect("equal", adjustable="box")
    ax.set_xlabel("实部")
    ax.set_ylabel("虚部")
    ax.set_title("描述函数判据中的曲线交点代表可能周期运动")
    ax.legend(loc="lower left", fontsize=9)
    fig.savefig(PROCESSED / "5-2-describing-function-boundary.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    apply_style()
    render_tool_comparison()
    render_phase_focus()
    render_describing_detail()
