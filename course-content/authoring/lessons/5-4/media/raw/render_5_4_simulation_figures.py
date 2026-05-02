from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA_DIR = RAW / "generated-data"
PREDICTION_DATA = DATA_DIR / "5-4-model-mismatch-prediction.csv"
CLOSED_LOOP_DATA = DATA_DIR / "5-4-mpc-drift-comparison.csv"
METRICS_DATA = DATA_DIR / "5-4-mpc-drift-metrics.csv"
OUT_DIR = ROOT / "processed"


METHOD_LABELS = {
    "traditional_fixed": "传统固定控制",
    "nominal_model_mpc": "名义模型 MPC",
    "data_driven_model_mpc": "数据驱动模型 MPC",
}


def configure_matplotlib() -> None:
    plt.rcParams.update(
        {
            "font.sans-serif": ["Arial Unicode MS", "PingFang SC", "Heiti TC", "DejaVu Sans"],
            "axes.unicode_minus": False,
            "font.size": 10,
        }
    )


def soften_axes(ax: plt.Axes) -> None:
    for spine in ax.spines.values():
        spine.set_color("#6b7280")
        spine.set_linewidth(0.7)


def save(fig: plt.Figure, filename: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT_DIR / filename, dpi=220)
    plt.close(fig)


def plot_prediction_mismatch() -> None:
    df = pd.read_csv(PREDICTION_DATA)

    fig, axes = plt.subplots(2, 1, figsize=(9.6, 6.2), sharex=True)
    ax = axes[0]
    ax.plot(df["t"], df["psi_actual"], color="#1f2937", linewidth=2.4, label="真实对象")
    ax.plot(df["t"], df["psi_nominal"], color="#dc2626", linewidth=1.9, linestyle="--", label="名义模型预测")
    ax.plot(df["t"], df["psi_fitted"], color="#2563eb", linewidth=1.9, label="数据修正预测")
    ax.set_ylabel("航向角 / deg")
    ax.set_title("同一舵角序列下的模型预测偏差")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    ax.legend(loc="upper left", frameon=False, ncol=3)

    ax = axes[1]
    ax.plot(df["t"], df["err_nominal"], color="#dc2626", linewidth=1.8, linestyle="--", label="名义模型误差")
    ax.plot(df["t"], df["err_fitted"], color="#2563eb", linewidth=1.8, label="数据修正误差")
    ax.axhline(0, color="#6b7280", linewidth=0.9)
    ax.axvspan(0, 32, color="#dbeafe", alpha=0.45, label="用于修正的早段数据")
    ax.set_xlabel("时间 / s")
    ax.set_ylabel("预测误差 / deg")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    ax.legend(loc="upper left", frameon=False, ncol=3)

    fig.text(
        0.02,
        0.01,
        "简化航向模型：真实对象的增益和时间常数偏离名义模型；数据修正只用早段数据拟合有效参数。",
        fontsize=9,
        color="#4b5563",
    )
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    save(fig, "5-4-model-mismatch-prediction.png")


def add_environment_marks(ax: plt.Axes) -> None:
    ax.axvspan(28, 108, color="#fef3c7", alpha=0.48, label="模型漂移")
    for marker in (45, 78, 122, 152):
        ax.axvline(marker, color="#7c3aed", linewidth=0.9, linestyle=":", alpha=0.7)
    ax.set_xlim(0, 180)


def plot_model_parameter_drift() -> None:
    df = pd.read_csv(CLOSED_LOOP_DATA)

    fig, axes = plt.subplots(2, 1, figsize=(9.8, 6.6), sharex=True)
    ax = axes[0]
    add_environment_marks(ax)
    ax.plot(df["t"], [0.18] * len(df), color="#f59e0b", linewidth=1.8, linestyle="--", label="名义参数")
    ax.plot(df["t"], df["K_actual"], color="#111827", linewidth=2.1, label="实际漂移参数")
    ax.plot(df["t"], df["K_est_data"], color="#2563eb", linewidth=1.9, label="数据驱动推断参数")
    ax.set_title("长时模型漂移下的参数真实值与在线推断值")
    ax.set_ylabel("增益 K")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    ax.legend(loc="upper right", frameon=False, ncol=3)
    soften_axes(ax)

    ax = axes[1]
    add_environment_marks(ax)
    ax.plot(df["t"], [8.0] * len(df), color="#f59e0b", linewidth=1.8, linestyle="--", label="名义参数")
    ax.plot(df["t"], df["T_actual"], color="#111827", linewidth=2.1, label="实际漂移参数")
    ax.plot(df["t"], df["T_est_data"], color="#2563eb", linewidth=1.9, label="数据驱动推断参数")
    ax.set_xlabel("时间 / s")
    ax.set_ylabel("时间常数 T / s")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    soften_axes(ax)

    fig.text(
        0.02,
        0.01,
        "在线推断只使用已发生的闭环运行数据；为避免激励不足造成跳变，估计值经过投影、平滑和保守预测处理。",
        fontsize=9,
        color="#4b5563",
    )
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    save(fig, "5-4-model-parameter-drift.png")


def plot_closed_loop_comparison() -> None:
    df = pd.read_csv(CLOSED_LOOP_DATA)
    metrics = pd.read_csv(METRICS_DATA)
    metrics["label"] = metrics["method"].map(METHOD_LABELS)

    colors = {
        "traditional": "#dc2626",
        "nominal": "#f59e0b",
        "data": "#2563eb",
    }

    fig = plt.figure(figsize=(10.4, 8.0))
    gs = fig.add_gridspec(3, 2, height_ratios=[1.25, 0.95, 0.95], hspace=0.38, wspace=0.28)

    ax = fig.add_subplot(gs[0, :])
    add_environment_marks(ax)
    ax.plot(df["t"], df["ref"], color="#111827", linewidth=2.2, linestyle=":", label="参考航向")
    ax.plot(df["t"], df["psi_traditional"], color=colors["traditional"], linewidth=1.75, label="传统固定控制")
    ax.plot(df["t"], df["psi_mpc_nominal"], color=colors["nominal"], linewidth=1.85, label="名义模型 MPC")
    ax.plot(df["t"], df["psi_mpc_data"], color=colors["data"], linewidth=2.0, label="数据驱动模型 MPC")
    ax.set_title("模型漂移与环境信息变化下的闭环航向跟踪")
    ax.set_ylabel("航向角 / deg")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    ax.legend(loc="upper left", frameon=False, ncol=4)
    soften_axes(ax)

    ax = fig.add_subplot(gs[1, :])
    add_environment_marks(ax)
    ax.plot(df["t"], df["u_traditional"], color=colors["traditional"], linewidth=1.55, label="传统固定控制")
    ax.plot(df["t"], df["u_mpc_nominal"], color=colors["nominal"], linewidth=1.65, label="名义模型 MPC")
    ax.plot(df["t"], df["u_mpc_data"], color=colors["data"], linewidth=1.8, label="数据驱动模型 MPC")
    ax.axhline(12, color="#6b7280", linewidth=0.9, linestyle="--")
    ax.axhline(-12, color="#6b7280", linewidth=0.9, linestyle="--")
    ax.set_ylabel("舵角 / deg")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    soften_axes(ax)

    ax = fig.add_subplot(gs[2, 0])
    add_environment_marks(ax)
    ax.plot(df["t"], df["err_traditional"].abs(), color=colors["traditional"], linewidth=1.55, label="传统固定控制")
    ax.plot(df["t"], df["err_mpc_nominal"].abs(), color=colors["nominal"], linewidth=1.65, label="名义模型 MPC")
    ax.plot(df["t"], df["err_mpc_data"].abs(), color=colors["data"], linewidth=1.8, label="数据驱动模型 MPC")
    ax.set_xlabel("时间 / s")
    ax.set_ylabel("绝对误差 / deg")
    ax.grid(True, color="#e5e7eb", linewidth=0.8)
    soften_axes(ax)

    ax = fig.add_subplot(gs[2, 1])
    bar_colors = [colors["traditional"], colors["nominal"], colors["data"]]
    ax.bar(metrics["label"], metrics["IAE"], color=bar_colors, alpha=0.9)
    for index, row in metrics.iterrows():
        ax.text(index, row["IAE"] + 8, f'{row["IAE"]:.0f}', ha="center", va="bottom", fontsize=9)
    ax.set_title("累计绝对误差 IAE")
    ax.set_ylabel("deg·s")
    ax.grid(True, axis="y", color="#e5e7eb", linewidth=0.8)
    ax.tick_params(axis="x", rotation=12)
    soften_axes(ax)

    fig.text(
        0.02,
        0.01,
        "传统控制使用固定名义参数；名义模型 MPC 显式处理舵角约束但仍按旧模型预测；数据驱动模型 MPC 使用运行数据滚动修正有效模型。",
        fontsize=9,
        color="#4b5563",
    )
    fig.subplots_adjust(top=0.90, bottom=0.12, left=0.08, right=0.98, hspace=0.52, wspace=0.30)
    save(fig, "5-4-mpc-drift-comparison.png")


def main() -> None:
    configure_matplotlib()
    plot_prediction_mismatch()
    plot_model_parameter_drift()
    plot_closed_loop_comparison()


if __name__ == "__main__":
    main()
