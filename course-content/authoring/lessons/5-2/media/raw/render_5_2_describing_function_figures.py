from pathlib import Path

import matplotlib.patches as patches
import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "processed"
DATA = PROCESSED / "5-2-describing-function-data"


def load(name: str) -> np.ndarray:
    return np.loadtxt(DATA / name, delimiter=",")


def style() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": ["Arial Unicode MS", "PingFang SC", "Heiti SC", "DejaVu Sans"],
            "axes.unicode_minus": False,
            "figure.dpi": 150,
            "savefig.dpi": 240,
            "axes.grid": True,
            "grid.alpha": 0.24,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "legend.frameon": False,
        }
    )


def render_static_characteristics() -> None:
    static = load("static_memoryless.csv")
    hyst = load("static_hysteresis_relay.csv")
    back = load("static_backlash.csv")
    x = static[:, 0]
    titles = ["饱和", "死区", "理想继电", "死区继电", "死区饱和", "滞环继电", "间隙"]
    fig, axes = plt.subplots(2, 4, figsize=(15.4, 7.2), constrained_layout=True)
    axes = axes.ravel()
    for ax in axes:
        ax.axhline(0, color="#555", lw=0.8)
        ax.axvline(0, color="#555", lw=0.8)
        ax.set_xlim(-2.1, 2.1)
        ax.set_ylim(-1.6, 1.6)
        ax.set_xlabel("输入 e")
        ax.set_ylabel("输出 x")
    axes[0].plot(x, static[:, 1], color="#1f77b4", lw=2.2)
    axes[0].annotate("a", xy=(1, 0), xytext=(1, -0.28), ha="center")
    axes[0].annotate("ka", xy=(0, 1), xytext=(0.18, 1.1))
    axes[0].set_title(titles[0])
    axes[1].plot(x, static[:, 2], color="#2ca02c", lw=2.2)
    axes[1].annotate(r"$\Delta$", xy=(0.55, 0), xytext=(0.55, -0.28), ha="center")
    axes[1].annotate(r"$-\Delta$", xy=(-0.55, 0), xytext=(-0.55, 0.18), ha="center")
    axes[1].set_title(titles[1])
    axes[2].plot(x, static[:, 3], color="#d62728", lw=2.2)
    axes[2].annotate("M", xy=(0, 1), xytext=(0.16, 1.08))
    axes[2].annotate("-M", xy=(0, -1), xytext=(0.16, -1.22))
    axes[2].set_title(titles[2])
    axes[3].plot(x, static[:, 4], color="#9467bd", lw=2.2)
    axes[3].annotate("a", xy=(0.55, 0), xytext=(0.55, -0.28), ha="center")
    axes[3].annotate("M", xy=(0, 1), xytext=(0.18, 1.08))
    axes[3].set_title(titles[3])
    axes[4].plot(x, static[:, 5], color="#7f7f7f", lw=2.2)
    axes[4].annotate(r"$\Delta$", xy=(0.35, 0), xytext=(0.35, -0.28), ha="center")
    axes[4].annotate("a", xy=(1.35, 0), xytext=(1.35, -0.28), ha="center")
    axes[4].set_title(titles[4])
    axes[5].plot(hyst[:, 0], hyst[:, 1], color="#8c564b", lw=2.2)
    axes[5].annotate("h", xy=(0.45, 0), xytext=(0.45, -0.28), ha="center")
    axes[5].annotate("-h", xy=(-0.45, 0), xytext=(-0.45, 0.18), ha="center")
    axes[5].annotate("M", xy=(0, 1), xytext=(0.18, 1.08))
    axes[5].set_title(titles[5])
    axes[6].plot(back[:, 0], back[:, 1], color="#17becf", lw=2.2)
    axes[6].annotate("b", xy=(0.45, 0), xytext=(0.45, -0.28), ha="center")
    axes[6].annotate("-b", xy=(-0.45, 0), xytext=(-0.45, 0.18), ha="center")
    axes[6].set_title(titles[6])
    fig.delaxes(axes[7])
    fig.suptitle("常见非线性环节的输入输出关系与参数标注", fontsize=15)
    fig.savefig(PROCESSED / "5-2-static-nonlinearity-characteristics.png", bbox_inches="tight")
    plt.close(fig)


def plot_complex(ax, data, label, color=None, **kwargs):
    ax.plot(data[:, 1], data[:, 2], label=label, color=color, lw=2.0, **kwargs)


def setup_complex(ax, title):
    ax.axhline(0, color="#555", lw=0.8)
    ax.axvline(0, color="#555", lw=0.8)
    ax.set_xlabel("实部")
    ax.set_ylabel("虚部")
    ax.set_title(title)
    ax.set_aspect("equal", adjustable="box")


def render_negative_inverse_summary() -> None:
    curves = [
        ("inv_saturation.csv", "饱和", "#1f77b4"),
        ("inv_deadzone.csv", "死区", "#2ca02c"),
        ("inv_relay.csv", "理想继电", "#d62728"),
        ("inv_deadzone_relay.csv", "死区继电", "#9467bd"),
        ("inv_hysteresis_relay.csv", "滞环继电", "#8c564b"),
        ("inv_backlash.csv", "间隙", "#17becf"),
        ("inv_deadzone_saturation.csv", "死区饱和", "#7f7f7f"),
    ]
    fig, ax = plt.subplots(figsize=(8.0, 5.6), constrained_layout=True)
    for file, label, color in curves:
        data = load(file)
        plot_complex(ax, data, label, color)
    setup_complex(ax, "常见描述函数的负倒曲线")
    ax.set_xlim(-9, 0.8)
    ax.set_ylim(-4.6, 1.4)
    ax.legend(ncol=2, fontsize=9, loc="lower right")
    fig.savefig(PROCESSED / "5-2-negative-inverse-summary.png", bbox_inches="tight")
    plt.close(fig)


def render_parameter_effects() -> None:
    fig, axes = plt.subplots(2, 2, figsize=(11.2, 7.4), constrained_layout=True)
    specs = [
        (axes[0, 0], "family_sat_k_", ["0.7", "1.0", "1.4"], "饱和：k 增大，起点向右靠近原点", "k"),
        (axes[0, 1], "family_deadzone_d_", ["0.35", "0.65", "1.00"], "死区：Δ 增大，起始幅值右移", "Δ"),
        (axes[1, 0], "family_hysteresis_h_", ["0.25", "0.55", "0.90"], "滞环继电：h 增大，虚部下移", "h"),
        (axes[1, 1], "family_backlash_b_", ["0.25", "0.55", "0.90"], "间隙：b 增大，曲线更深进入第四象限", "b"),
    ]
    colors = ["#1f77b4", "#ff7f0e", "#2ca02c"]
    for ax, prefix, vals, title, symbol in specs:
        for val, color in zip(vals, colors):
            file = f"{prefix}{val}.csv"
            data = load(file)
            plot_complex(ax, data, f"{symbol}={val}", color)
        setup_complex(ax, title)
        ax.set_aspect("auto")
        ax.legend(fontsize=9)
    axes[0, 0].set_xlim(-7, 0.4); axes[0, 0].set_ylim(-1, 1)
    axes[0, 1].set_xlim(-8, 0.4); axes[0, 1].set_ylim(-1, 1)
    axes[1, 0].set_xlim(-7, 0.4); axes[1, 0].set_ylim(-3.8, 0.8)
    axes[1, 1].set_xlim(-7, 0.4); axes[1, 1].set_ylim(-4.5, 0.8)
    fig.suptitle("参数变化对负倒描述函数的影响", fontsize=15)
    fig.savefig(PROCESSED / "5-2-negative-inverse-parameter-effects.png", bbox_inches="tight")
    plt.close(fig)


def render_small_perturbation() -> None:
    fig, axes = plt.subplots(1, 2, figsize=(12.0, 4.6), constrained_layout=True)
    for ax, stable in zip(axes, [True, False]):
        t = np.linspace(0, 1, 200)
        g_x = -4.6 + 4.2 * t
        g_y = -3.0 + 4.4 * t - 2.1 * t**2
        inv_x = -5.0 + 4.3 * t
        inv_y = -3.5 + 3.4 * t + (0.35 if stable else -0.35) * np.sin(np.pi * t)
        ax.fill_between(g_x, g_y, 1.6, color="#d7e8ff", alpha=0.55, label="被 G(jω) 包围区域")
        ax.plot(g_x, g_y, color="#1f77b4", lw=2.4, label=r"$G(j\omega)$")
        ax.plot(inv_x, inv_y, color="#d62728", lw=2.4, label=r"$-1/N(A)$")
        idx = 116 if stable else 80
        ax.scatter([inv_x[idx]], [inv_y[idx]], color="#111", s=32, zorder=5)
        ax.annotate("交点 A0", xy=(inv_x[idx], inv_y[idx]), xytext=(inv_x[idx] + 0.25, inv_y[idx] + 0.55),
                    arrowprops={"arrowstyle": "->", "lw": 0.9})
        if stable:
            ax.annotate("A减小：进入不稳定区，振幅增大", xy=(inv_x[idx+18], inv_y[idx+18]), xytext=(-5.4, 1.0),
                        arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
            ax.annotate("A增大：离开包围区，振幅减小", xy=(inv_x[idx-18], inv_y[idx-18]), xytext=(-5.4, 0.35),
                        arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
            ax.set_title("稳定自振点：扰动后回到交点")
        else:
            ax.annotate("A减小：离开包围区，继续减小", xy=(inv_x[idx-18], inv_y[idx-18]), xytext=(-5.4, 1.0),
                        arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
            ax.annotate("A增大：进入不稳定区，继续增大", xy=(inv_x[idx+18], inv_y[idx+18]), xytext=(-5.4, 0.35),
                        arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
            ax.set_title("非稳定交点：扰动后远离交点")
        setup_complex(ax, ax.get_title())
        ax.set_xlim(-5.8, 0.4)
        ax.set_ylim(-4.0, 1.8)
    axes[0].legend(fontsize=9, loc="lower right")
    fig.savefig(PROCESSED / "5-2-small-perturbation-method.png", bbox_inches="tight")
    plt.close(fig)


def render_examples() -> None:
    relay_g = load("example_relay_nyquist.csv")
    relay_inv = load("example_relay_inv.csv")
    relay_point = load("example_relay_point.csv")
    relay_sim = load("example_relay_sim.csv")
    sat_g = load("example_saturation_nyquist.csv")
    sat_inv = load("example_saturation_inv.csv")
    sat_point = load("example_saturation_point.csv")
    sat_k4 = load("example_saturation_sim_k4.csv")
    sat_k9 = load("example_saturation_sim_k9.csv")

    fig, axes = plt.subplots(1, 2, figsize=(12.2, 4.8), constrained_layout=True)
    ax = axes[0]
    ax.plot(relay_g[:, 1], relay_g[:, 2], color="#1f77b4", lw=2.1, label=r"$G(j\omega)$")
    ax.plot(relay_inv[:, 1], relay_inv[:, 2], color="#d62728", lw=2.1, label=r"$-1/N(A)$")
    ax.scatter([relay_point[1]], [relay_point[2]], color="#111", s=34, zorder=5)
    ax.annotate(r"$\omega=2,\ A\approx0.796$", xy=(relay_point[1], relay_point[2]), xytext=(-2.9, 0.42),
                arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
    setup_complex(ax, "例题 1：理想继电的自振交点")
    ax.set_xlim(-4, 0.8); ax.set_ylim(-1.5, 1.5); ax.legend(fontsize=9)
    ax = axes[1]
    ax.plot(relay_sim[:, 0], relay_sim[:, 1], color="#1f77b4", lw=1.7, label="输出 c(t)")
    ax.plot(relay_sim[:, 0], relay_sim[:, 4], color="#d62728", lw=1.1, alpha=0.8, label="继电输出")
    ax.set_xlim(10, 35)
    ax.set_title("例题 1 仿真：响应进入稳定周期运动")
    ax.set_xlabel("时间 / s"); ax.set_ylabel("幅值")
    ax.legend(fontsize=9)
    fig.savefig(PROCESSED / "5-2-example-relay-limit-cycle.png", bbox_inches="tight")
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(12.2, 4.8), constrained_layout=True)
    ax = axes[0]
    ax.plot(sat_g[:, 1], sat_g[:, 2], color="#2ca02c", lw=1.9, label="K=4")
    ax.plot(sat_g[:, 3], sat_g[:, 4], color="#1f77b4", lw=2.1, label="K=9")
    ax.plot(sat_inv[:, 1], sat_inv[:, 2], color="#d62728", lw=2.1, label=r"$-1/N(A)$")
    ax.scatter([sat_point[1]], [sat_point[2]], color="#111", s=34, zorder=5)
    ax.annotate(r"$\omega\approx2.24,\ A\approx1.81$", xy=(sat_point[1], sat_point[2]), xytext=(-5.2, 1.2),
                arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
    setup_complex(ax, "例题 2：饱和环节的增益条件")
    ax.set_xlim(-7, 0.8); ax.set_ylim(-3.8, 3.8); ax.legend(fontsize=9)
    ax = axes[1]
    ax.plot(sat_k4[:, 0], sat_k4[:, 1], color="#2ca02c", lw=1.7, label="K=4：衰减")
    ax.plot(sat_k9[:, 0], sat_k9[:, 1], color="#1f77b4", lw=1.7, label="K=9：周期响应")
    ax.set_xlim(5, 45)
    ax.set_title("例题 2 仿真：不同 K 下的零输入响应")
    ax.set_xlabel("时间 / s"); ax.set_ylabel("输出 c(t)")
    ax.legend(fontsize=9)
    fig.savefig(PROCESSED / "5-2-example-saturation-gain-compare.png", bbox_inches="tight")
    plt.close(fig)


def render_ship_actuator_case() -> None:
    fig, ax = plt.subplots(figsize=(11.5, 4.6), constrained_layout=True)
    ax.set_axis_off()
    blocks = [
        ("航向误差\n$e(t)$", 0.05, 0.55, 0.11, 0.22),
        ("PI 控制器\n$G_c(s)$", 0.20, 0.55, 0.13, 0.22),
        ("放大器\n饱和 $\\pm 10V$", 0.38, 0.55, 0.16, 0.22),
        ("电液伺服阀\n死区 $\\Delta$", 0.60, 0.55, 0.15, 0.22),
        ("液压舵机\n舵角 $\\delta$", 0.80, 0.55, 0.15, 0.22),
    ]
    for text, x, y, w, h in blocks:
        rect = patches.FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.015,rounding_size=0.015",
                                      edgecolor="#345995", facecolor="white", lw=1.6)
        ax.add_patch(rect)
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=11)
    for i in range(len(blocks) - 1):
        x0 = blocks[i][1] + blocks[i][3]
        y0 = blocks[i][2] + blocks[i][4] / 2
        x1 = blocks[i + 1][1]
        ax.annotate("", xy=(x1, y0), xytext=(x0, y0),
                    arrowprops={"arrowstyle": "->", "lw": 1.5, "color": "#333"})
    ax.annotate("舵角反馈", xy=(0.105, 0.55), xytext=(0.875, 0.28),
                arrowprops={"arrowstyle": "->", "lw": 1.5, "color": "#333", "connectionstyle": "angle3,angleA=-90,angleB=180"},
                ha="center", fontsize=10)
    ax.text(0.43, 0.33, "饱和限制会削平大幅控制电压", ha="center", fontsize=10, color="#7a3b00")
    ax.text(0.675, 0.33, "死区会吞掉小幅修正", ha="center", fontsize=10, color="#7a3b00")
    ax.text(0.50, 0.12, "描述函数法把饱和/死区的基波近似与线性部分 $G(j\\omega)$ 比较，判断是否存在自振边界。", ha="center", fontsize=11)
    fig.savefig(PROCESSED / "5-2-ship-rudder-actuator-case.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    style()
    render_static_characteristics()
    render_negative_inverse_summary()
    render_parameter_effects()
    render_small_perturbation()
    render_examples()
    render_ship_actuator_case()
