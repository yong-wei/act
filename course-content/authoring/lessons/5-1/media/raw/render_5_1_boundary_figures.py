from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


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


def save_static_characteristics() -> None:
    x, y_linear, y_saturation, y_deadzone, y_hyst_up, y_hyst_down = np.loadtxt(
        DATA / "static_characteristics.csv", delimiter=",", unpack=True
    )

    fig, axes = plt.subplots(1, 3, figsize=(12, 3.6), constrained_layout=True)
    for ax in axes:
        ax.axhline(0, color="#444444", linewidth=0.7)
        ax.axvline(0, color="#444444", linewidth=0.7)
        ax.grid(True)
        ax.set_xlim(-2, 2)
        ax.set_ylim(-1.6, 1.6)
        ax.set_xlabel("输入")
        ax.set_ylabel("输出")

    axes[0].plot(x, y_linear, "--", color="#8592a3", label="线性假设")
    axes[0].plot(x, y_saturation, color="#1f77b4", linewidth=2.2, label="饱和")
    axes[0].set_title("饱和：输出被边界截断")
    axes[0].legend(frameon=False, loc="upper left")

    axes[1].plot(x, y_linear, "--", color="#8592a3", label="线性假设")
    axes[1].plot(x, y_deadzone, color="#2ca02c", linewidth=2.2, label="死区")
    axes[1].axvspan(-0.35, 0.35, color="#2ca02c", alpha=0.12)
    axes[1].set_title("死区：小信号被吞掉")
    axes[1].legend(frameon=False, loc="upper left")

    axes[2].plot(x, y_linear, "--", color="#8592a3", label="线性假设")
    axes[2].plot(x, y_hyst_up, color="#d62728", linewidth=2.2, label="上行路径")
    axes[2].plot(x, y_hyst_down, color="#ff7f0e", linewidth=2.2, label="下行路径")
    axes[2].fill_between(x, y_hyst_up, y_hyst_down, color="#d62728", alpha=0.10)
    axes[2].set_title("滞回/间隙：路径不再唯一")
    axes[2].legend(frameon=False, loc="upper left")

    fig.suptitle("典型边界环节的静态特性对照", fontsize=15, fontweight="bold")
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


def main() -> None:
    setup_style()
    PROCESSED.mkdir(parents=True, exist_ok=True)
    save_static_characteristics()
    save_saturation_response()
    print(f"5-1 figures generated in {PROCESSED}")


if __name__ == "__main__":
    main()
