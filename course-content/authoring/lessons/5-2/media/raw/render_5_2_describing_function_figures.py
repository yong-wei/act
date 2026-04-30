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


def inv_from_N(A: np.ndarray, N: np.ndarray) -> np.ndarray:
    valid = np.isfinite(N) & (np.abs(N) > 1e-10)
    Z = np.full_like(N, np.nan + 1j * np.nan, dtype=complex)
    Z[valid] = -1 / N[valid]
    return np.column_stack([A[valid], Z[valid].real, Z[valid].imag])


def N_sat_py(A: np.ndarray, k: float, a: float) -> np.ndarray:
    N = k * np.ones_like(A)
    idx = A > a
    r = a / A[idx]
    N[idx] = (2 * k / np.pi) * (np.arcsin(r) + r * np.sqrt(1 - r**2))
    return N.astype(complex)


def N_deadzone_py(A: np.ndarray, k: float, d: float) -> np.ndarray:
    N = np.zeros_like(A, dtype=complex)
    idx = A > d
    r = d / A[idx]
    N[idx] = (2 * k / np.pi) * (np.pi / 2 - np.arcsin(r) - r * np.sqrt(1 - r**2))
    return N


def N_relay_py(A: np.ndarray, M: float) -> np.ndarray:
    return (4 * M / (np.pi * A)).astype(complex)


def N_dzrelay_py(A: np.ndarray, M: float, d: float) -> np.ndarray:
    N = np.zeros_like(A, dtype=complex)
    idx = A > d
    r = d / A[idx]
    N[idx] = (4 * M / (np.pi * A[idx])) * np.sqrt(1 - r**2)
    return N


def N_hystrelay_py(A: np.ndarray, M: float, h: float) -> np.ndarray:
    N = np.zeros_like(A, dtype=complex)
    idx = A > h
    r = h / A[idx]
    N[idx] = (4 * M / (np.pi * A[idx])) * (np.sqrt(1 - r**2) - 1j * r)
    return N


def N_backlash_py(A: np.ndarray, k: float, b: float) -> np.ndarray:
    N = np.zeros_like(A, dtype=complex)
    idx = A > b
    r = b / A[idx]
    real_part = (k / np.pi) * (
        np.pi / 2 + np.arcsin(1 - 2 * r) + 2 * (1 - 2 * r) * np.sqrt(r * (1 - r))
    )
    imag_part = (4 * k * b / (np.pi * A[idx])) * (r - 1)
    N[idx] = real_part + 1j * imag_part
    return N


def N_dzsat_py(A: np.ndarray, k: float, d: float, a: float) -> np.ndarray:
    N = np.zeros_like(A, dtype=complex)
    mid = (A > d) & (A <= a)
    r = d / A[mid]
    N[mid] = (2 * k / np.pi) * (np.pi / 2 - np.arcsin(r) - r * np.sqrt(1 - r**2))
    high = A > a
    rd = d / A[high]
    ra = a / A[high]
    N[high] = (2 * k / np.pi) * (
        np.arcsin(ra)
        - np.arcsin(rd)
        + ra * np.sqrt(1 - ra**2)
        - rd * np.sqrt(1 - rd**2)
    )
    return N


def draw_direction_arrow(ax, data: np.ndarray, xlim, ylim, color: str) -> None:
    if len(data) < 6:
        return
    visible = np.where(
        (data[:, 1] >= xlim[0]) & (data[:, 1] <= xlim[1]) &
        (data[:, 2] >= ylim[0]) & (data[:, 2] <= ylim[1])
    )[0]
    if len(visible) < 6:
        return
    start = visible[max(1, len(visible) // 4)]
    end = visible[min(len(visible) - 2, len(visible) // 4 + max(4, len(visible) // 10))]
    ax.annotate(
        "",
        xy=(data[end, 1], data[end, 2]),
        xytext=(data[start, 1], data[start, 2]),
        arrowprops={"arrowstyle": "->", "lw": 1.0, "color": color},
    )


def draw_start_circle(ax, data: np.ndarray, xlim, ylim, color: str) -> None:
    visible = np.where(
        (data[:, 1] >= xlim[0]) & (data[:, 1] <= xlim[1]) &
        (data[:, 2] >= ylim[0]) & (data[:, 2] <= ylim[1])
    )[0]
    if len(visible) == 0:
        return
    idx = visible[0]
    ax.scatter(
        [data[idx, 1]],
        [data[idx, 2]],
        s=38,
        facecolors="white",
        edgecolors=color,
        linewidths=1.2,
        zorder=5,
    )


def render_negative_inverse_summary() -> None:
    A = np.linspace(0.02, 8.0, 1600)
    colors = ["#1f77b4", "#ff7f0e", "#2ca02c"]
    specs = [
        {
            "title": "饱和：k 增大，起点向原点靠近",
            "params": [(0.7, "k=0.7"), (1.0, "k=1.0"), (1.4, "k=1.4")],
            "curve": lambda p: inv_from_N(A, N_sat_py(A, p, 1.0)),
            "xlim": (-7.0, 0.25),
            "ylim": (-0.7, 0.7),
        },
        {
            "title": "死区：Δ 增大，曲线出现门槛右移",
            "params": [(0.35, "Δ=0.35"), (0.65, "Δ=0.65"), (1.00, "Δ=1.00")],
            "curve": lambda p: inv_from_N(A, N_deadzone_py(A, 1.0, p)),
            "xlim": (-8.0, 0.25),
            "ylim": (-0.7, 0.7),
        },
        {
            "title": "理想继电：M 增大，同一 A 下曲线靠近原点",
            "params": [(0.7, "M=0.7"), (1.0, "M=1.0"), (1.4, "M=1.4")],
            "curve": lambda p: inv_from_N(A, N_relay_py(A, p)),
            "xlim": (-6.5, 0.25),
            "ylim": (-0.7, 0.7),
        },
        {
            "title": "死区继电：d 增大，折返点左移",
            "params": [(0.35, "d=0.35"), (0.65, "d=0.65"), (1.00, "d=1.00")],
            "curve": lambda p: inv_from_N(A, N_dzrelay_py(A, 1.0, p)),
            "xlim": (-6.5, 0.25),
            "ylim": (-0.7, 0.7),
        },
        {
            "title": "滞环继电：h 增大，水平线下移",
            "params": [(0.25, "h=0.25"), (0.55, "h=0.55"), (0.90, "h=0.90")],
            "curve": lambda p: inv_from_N(A, N_hystrelay_py(A, 1.0, p)),
            "xlim": (-6.5, 0.25),
            "ylim": (-1.0, 0.35),
        },
        {
            "title": "间隙：b 增大，曲线更深进入第四象限",
            "params": [(0.25, "b=0.25"), (0.55, "b=0.55"), (0.90, "b=0.90")],
            "curve": lambda p: inv_from_N(A, N_backlash_py(A, 1.0, p)),
            "xlim": (-6.5, 0.25),
            "ylim": (-4.2, 0.35),
        },
        {
            "title": "死区饱和：Δ 增大，起始段左移并延后出现",
            "params": [(0.25, "Δ=0.25"), (0.45, "Δ=0.45"), (0.65, "Δ=0.65")],
            "curve": lambda p: inv_from_N(A, N_dzsat_py(A, 1.0, p, 1.35)),
            "xlim": (-8.0, 0.25),
            "ylim": (-0.7, 0.7),
        },
    ]
    fig, axes = plt.subplots(4, 2, figsize=(11.2, 12.6), constrained_layout=True)
    axes = axes.ravel()
    for ax, spec in zip(axes, specs):
        setup_complex(ax, spec["title"])
        ax.set_xlim(*spec["xlim"])
        ax.set_ylim(*spec["ylim"])
        ax.set_aspect("auto")
        for (param, label), color in zip(spec["params"], colors):
            data = spec["curve"](param)
            ax.plot(data[:, 1], data[:, 2], color=color, lw=1.9, label=label)
            draw_start_circle(ax, data, spec["xlim"], spec["ylim"], color)
            draw_direction_arrow(ax, data, spec["xlim"], spec["ylim"], color)
        ax.legend(fontsize=8, loc="upper left")
    axes[-1].axis("off")
    fig.suptitle("常见描述函数的负倒曲线：子图内同时标注参数变化", fontsize=15)
    fig.savefig(PROCESSED / "5-2-negative-inverse-summary.png", bbox_inches="tight")
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
    # This figure is an intentionally schematic TikZ diagram. It is compiled
    # from 5-2-small-perturbation-method.tex so that the illustrated
    # intersections and enclosed region stay pedagogically controlled.
    return
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
    render_small_perturbation()
    render_examples()
    render_ship_case_simulation()
