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
        ("inv_saturation.csv", "饱和：k=1, a=1", "#1f77b4", (-7.2, 0.4), (-0.8, 0.8), "起点 $-1/k$"),
        ("inv_deadzone.csv", "死区：k=1, Δ=0.55", "#2ca02c", (-8.2, 0.4), (-0.8, 0.8), "A>Δ 后出现"),
        ("inv_relay.csv", "理想继电：M=1", "#d62728", (-6.8, 0.4), (-0.8, 0.8), "$-\\pi A/(4M)$"),
        ("inv_deadzone_relay.csv", "死区继电：M=1, d=0.55", "#9467bd", (-6.8, 0.4), (-0.8, 0.8), "A>d 后出现"),
        ("inv_hysteresis_relay.csv", "滞环继电：M=1, h=0.45", "#8c564b", (-6.8, 0.4), (-1.1, 0.4), "虚部为负常数"),
        ("inv_backlash.csv", "间隙：k=1, b=0.45", "#17becf", (-6.8, 0.4), (-4.5, 0.4), "进入第四象限"),
        ("inv_deadzone_saturation.csv", "死区饱和：Δ=0.35, a=1.35", "#7f7f7f", (-8.2, 0.4), (-0.8, 0.8), "死区与限幅叠加"),
    ]
    fig, axes = plt.subplots(4, 2, figsize=(10.8, 12.2), constrained_layout=True)
    axes = axes.ravel()
    for ax, (file, title, color, xlim, ylim, note) in zip(axes, curves):
        data = load(file)
        plot_complex(ax, data, "", color)
        setup_complex(ax, title)
        ax.set_xlim(*xlim)
        ax.set_ylim(*ylim)
        ax.set_aspect("auto")
        ax.text(0.04, 0.86, note, transform=ax.transAxes, fontsize=9)
        if len(data) > 0:
            idx = min(80, len(data) - 1)
            ax.scatter([data[idx, 1]], [data[idx, 2]], color=color, s=20, zorder=4)
            ax.annotate(f"A={data[idx,0]:.2g}", xy=(data[idx, 1], data[idx, 2]),
                        xytext=(0.58, 0.14), textcoords="axes fraction",
                        arrowprops={"arrowstyle": "->", "lw": 0.8}, fontsize=8)
    axes[-1].axis("off")
    fig.suptitle("常见描述函数的负倒曲线：按非线性类型分别绘制", fontsize=15)
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


def points_inside_polygon(points: np.ndarray, polygon: np.ndarray) -> np.ndarray:
    x = points[:, 0]
    y = points[:, 1]
    xp = polygon[:, 0]
    yp = polygon[:, 1]
    inside = np.zeros(len(points), dtype=bool)
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = xp[i], yp[i]
        xj, yj = xp[j], yp[j]
        intersects = ((yi > y) != (yj > y)) & (
            x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi
        )
        inside ^= intersects
        j = i
    return inside


def shade_inside_region(ax, polygon: np.ndarray, xlim, ylim) -> None:
    xs = np.linspace(xlim[0], xlim[1], 360)
    ys = np.linspace(ylim[0], ylim[1], 260)
    xx, yy = np.meshgrid(xs, ys)
    mask = points_inside_polygon(np.column_stack([xx.ravel(), yy.ravel()]), polygon).reshape(xx.shape)
    ax.contourf(xx, yy, mask.astype(float), levels=[0.5, 1.5], colors=["#d7e8ff"], alpha=0.55)


def render_small_perturbation() -> None:
    g = load("small_perturbation_nyquist.csv")
    inv = load("inv_hysteresis_relay.csv")
    pos = np.column_stack([g[:, 1], g[:, 2]])
    neg = np.column_stack([g[::-1, 1], -g[::-1, 2]])
    poly = np.vstack([pos, neg])
    inv_pts = np.column_stack([inv[:, 1], inv[:, 2]])
    inside = points_inside_polygon(inv_pts, poly)
    transitions = np.where(inside[1:] != inside[:-1])[0]
    a1, a2 = transitions[0], transitions[1]
    picks = {
        "A1": a1 + 1,
        "A2": a2 + 1,
        "B1": a1 + 22,
        "C1": max(a1 - 22, 0),
        "B2": a2 - 22,
        "C2": min(a2 + 22, len(inv) - 1),
    }
    colors = {"A1": "#111", "A2": "#111", "B1": "#2ca02c", "B2": "#2ca02c", "C1": "#ff7f0e", "C2": "#ff7f0e"}

    fig, axes = plt.subplots(1, 2, figsize=(12.4, 4.9), constrained_layout=True)
    for ax, title, zoom in [
        (axes[0], "I 型三阶系统的包围区域与两个交点", False),
        (axes[1], "A1 非稳定、A2 稳定：B 在区内，C 在区外", True),
    ]:
        xlim = (-2.75, 0.25) if not zoom else (-2.55, -0.55)
        ylim = (-1.35, 1.35) if not zoom else (-0.78, 0.12)
        shade_inside_region(ax, poly, xlim, ylim)
        ax.plot(g[:, 1], g[:, 2], color="#1f77b4", lw=2.0, label=r"$G(j\omega)$")
        ax.plot(g[:, 1], -g[:, 2], color="#1f77b4", lw=1.4, alpha=0.72)
        ax.plot(inv[:, 1], inv[:, 2], color="#d62728", lw=2.2, label=r"$-1/N(A)$（滞环继电）")
        for name, idx in picks.items():
            ax.scatter([inv[idx, 1]], [inv[idx, 2]], s=36, color=colors[name], zorder=5)
            ax.annotate(name, xy=(inv[idx, 1], inv[idx, 2]),
                        xytext=(6, 8 if name.startswith("A") else -14),
                        textcoords="offset points", fontsize=9,
                        arrowprops={"arrowstyle": "-", "lw": 0.6})
        ax.annotate("A 增大方向", xy=(inv[a2 + 120, 1], inv[a2 + 120, 2]),
                    xytext=(inv[a2 + 35, 1], inv[a2 + 35, 2] + 0.38),
                    arrowprops={"arrowstyle": "->", "lw": 1.0}, fontsize=9)
        setup_complex(ax, title)
        ax.set_aspect("auto")
        ax.set_xlim(*xlim)
        ax.set_ylim(*ylim)
    axes[0].legend(fontsize=9, loc="lower left")
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
    ax.plot(relay_sim[:, 0], relay_sim[:, 1], color="#7f7f7f", lw=1.2, label="短脉冲 r(t)")
    ax.plot(relay_sim[:, 0], relay_sim[:, 3], color="#d62728", lw=1.1, alpha=0.78, label="非线性输出 u(t)")
    ax.plot(relay_sim[:, 0], relay_sim[:, 4], color="#1f77b4", lw=1.7, label="线性输出 c(t)")
    ax.set_xlim(0, 35)
    ax.set_title("例题 1 仿真：0 时刻短脉冲触发自振")
    ax.set_xlabel("时间 / s"); ax.set_ylabel("幅值")
    ax.legend(fontsize=9)
    fig.savefig(PROCESSED / "5-2-example-relay-limit-cycle.png", bbox_inches="tight")
    plt.close(fig)

    fig = plt.figure(figsize=(12.4, 6.4), constrained_layout=True)
    gs = fig.add_gridspec(2, 2, width_ratios=[1.05, 1.0])
    ax = fig.add_subplot(gs[:, 0])
    ax.plot(sat_g[:, 1], sat_g[:, 2], color="#2ca02c", lw=1.9, label="K=4")
    ax.plot(sat_g[:, 3], sat_g[:, 4], color="#1f77b4", lw=2.1, label="K=9")
    ax.plot(sat_inv[:, 1], sat_inv[:, 2], color="#d62728", lw=2.1, label=r"$-1/N(A)$")
    ax.scatter([sat_point[1]], [sat_point[2]], color="#111", s=34, zorder=5)
    ax.annotate(r"$\omega\approx2.24,\ A\approx1.81$", xy=(sat_point[1], sat_point[2]), xytext=(-5.2, 1.2),
                arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
    setup_complex(ax, "例题 2：饱和环节的增益条件")
    ax.set_xlim(-7, 0.8); ax.set_ylim(-3.8, 3.8); ax.legend(fontsize=9)
    for ax, sim, title in [
        (fig.add_subplot(gs[0, 1]), sat_k4, "K=4：短脉冲后衰减"),
        (fig.add_subplot(gs[1, 1]), sat_k9, "K=9：短脉冲后进入周期响应"),
    ]:
        ax.plot(sim[:, 0], sim[:, 1], color="#7f7f7f", lw=1.1, label="短脉冲 r(t)")
        ax.plot(sim[:, 0], sim[:, 3], color="#d62728", lw=1.0, alpha=0.78, label="非线性输出 u(t)")
        ax.plot(sim[:, 0], sim[:, 4], color="#1f77b4", lw=1.5, label="线性输出 c(t)")
        ax.set_xlim(0, 45)
        ax.set_title(title)
        ax.set_xlabel("时间 / s")
        ax.set_ylabel("幅值")
        ax.legend(fontsize=8, ncol=3, loc="upper right")
    fig.savefig(PROCESSED / "5-2-example-saturation-gain-compare.png", bbox_inches="tight")
    plt.close(fig)


def render_ship_case_simulation() -> None:
    g = load("case_ship_nyquist.csv")
    inv = load("case_ship_dzsat_inv.csv")
    point = load("case_ship_point.csv")
    sim_ok = load("case_ship_sim_k5.csv")
    sim_bad = load("case_ship_sim_k10.csv")
    fig = plt.figure(figsize=(12.4, 6.4), constrained_layout=True)
    gs = fig.add_gridspec(2, 2, width_ratios=[1.05, 1.0])
    ax = fig.add_subplot(gs[:, 0])
    ax.plot(g[:, 1], g[:, 2], color="#2ca02c", lw=1.9, label="整改后 K=5")
    ax.plot(g[:, 3], g[:, 4], color="#1f77b4", lw=2.1, label="原参数 K=10")
    ax.plot(inv[:, 1], inv[:, 2], color="#d62728", lw=2.0, label=r"$-1/N(A)$")
    ax.scatter([point[1]], [point[2]], color="#111", s=34, zorder=5)
    ax.annotate(r"$\omega\approx2.24,\ A\approx%.2f$" % point[3],
                xy=(point[1], point[2]), xytext=(-5.5, 1.1),
                arrowprops={"arrowstyle": "->", "lw": 0.9}, fontsize=9)
    setup_complex(ax, "舵机死区饱和案例：原参数形成候选交点")
    ax.set_xlim(-7, 0.8)
    ax.set_ylim(-3.8, 3.8)
    ax.legend(fontsize=9)
    for ax, sim, title in [
        (fig.add_subplot(gs[0, 1]), sim_bad, "原参数 K=10：短脉冲后自振"),
        (fig.add_subplot(gs[1, 1]), sim_ok, "整改后 K=5：短脉冲后衰减"),
    ]:
        ax.plot(sim[:, 0], sim[:, 1], color="#7f7f7f", lw=1.1, label="短脉冲 r(t)")
        ax.plot(sim[:, 0], sim[:, 3], color="#d62728", lw=1.0, alpha=0.78, label="阀后非线性输出 u(t)")
        ax.plot(sim[:, 0], sim[:, 4], color="#1f77b4", lw=1.5, label="航向输出 ψ(t)")
        ax.set_xlim(0, 55)
        ax.set_title(title)
        ax.set_xlabel("时间 / s")
        ax.set_ylabel("幅值")
        ax.legend(fontsize=8, ncol=3, loc="upper right")
    fig.savefig(PROCESSED / "5-2-ship-rudder-actuator-case-sim.png", bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    style()
    render_static_characteristics()
    render_negative_inverse_summary()
    render_parameter_effects()
    render_small_perturbation()
    render_examples()
    render_ship_case_simulation()
