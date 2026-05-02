from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA = RAW / "generated-data" / "5-4-model-mismatch-prediction.csv"
OUT = ROOT / "processed" / "5-4-model-mismatch-prediction.png"


def main() -> None:
    df = pd.read_csv(DATA)

    plt.rcParams.update(
        {
            "font.sans-serif": ["Arial Unicode MS", "PingFang SC", "Heiti TC", "DejaVu Sans"],
            "axes.unicode_minus": False,
            "font.size": 10,
        }
    )

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
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=220)


if __name__ == "__main__":
    main()
