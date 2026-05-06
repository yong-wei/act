#!/usr/bin/env python3
"""Render publication figures for unit 5-6 from Octave-generated CSV files."""

from __future__ import annotations

import csv
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.patches import Circle, FancyArrowPatch, FancyBboxPatch, Rectangle


RAW_DIR = Path(__file__).resolve().parent
MEDIA_DIR = RAW_DIR.parent
OUT_DIR = MEDIA_DIR / 'processed'

SCENARIO_LABELS = {
    'E1': 'E1 常规日',
    'E2': 'E2 入库高峰',
    'E3': 'E3 未见扰动',
}
METHOD_LABELS = {
    'classic': '经典 PI/PID',
    'data': '数据驱动预测补偿',
    'policy': '策略学习监督层',
}
METHOD_COLORS = {
    'classic': '#2f5d7c',
    'data': '#26856b',
    'policy': '#a65f2b',
}


def setup_style() -> None:
    plt.rcParams.update(
        {
            'font.sans-serif': ['Hiragino Sans GB', 'Arial Unicode MS', 'SimHei', 'DejaVu Sans'],
            'font.family': 'sans-serif',
            'axes.unicode_minus': False,
            'figure.dpi': 150,
            'savefig.dpi': 220,
            'axes.edgecolor': '#2c3440',
            'axes.labelcolor': '#24303a',
            'xtick.color': '#24303a',
            'ytick.color': '#24303a',
        }
    )


def load_summary() -> pd.DataFrame:
    data = pd.read_csv(OUT_DIR / '5-6-cold-chain-summary.csv')
    records = data.to_dict(orient='records')
    (OUT_DIR / '5-6-cold-chain-summary.json').write_text(
        json.dumps(records, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    return data


def load_trace(scenario: str, method: str) -> pd.DataFrame:
    return pd.read_csv(OUT_DIR / f'5-6-{scenario}-{method}-trace.csv')


def render_temperature_log() -> None:
    trace = load_trace('E2', 'data')
    hours = trace['minute'] / 60.0
    fig, axes = plt.subplots(3, 1, figsize=(11.4, 8.2), sharex=True, gridspec_kw={'height_ratios': [2.3, 1.0, 1.0]})
    ax = axes[0]
    ax.axhspan(2, 8, color='#d9efe7', alpha=0.65, label='2°C-8°C 合格温区')
    ax.plot(hours, trace['air_C'], color='#1d5f87', lw=1.9, label='空气温度')
    ax.plot(hours, trace['product_C'], color='#7d4e9f', lw=1.9, label='货品核心温度')
    ax.plot(hours, trace['ambient_C'], color='#8b8f97', lw=1.0, alpha=0.75, label='外界温度')
    ax.set_ylabel('温度 / °C')
    ax.set_title('48 小时冷链仓库运行日志：入库高峰与预测预冷')
    ax.legend(ncol=4, loc='upper left', frameon=False)
    ax.grid(True, alpha=0.22)

    axes[1].fill_between(hours, 0, trace['door_heat'], color='#d17f45', alpha=0.78)
    axes[1].set_ylabel('开门扰动')
    axes[1].grid(True, alpha=0.22)

    axes[2].plot(hours, trace['load_heat'], color='#b64f5c', lw=1.5, label='入库热负荷')
    axes[2].plot(hours, trace['compressor_duty'], color='#244a68', lw=1.2, label='压缩机占空比')
    axes[2].set_xlabel('时间 / h')
    axes[2].set_ylabel('归一化量')
    axes[2].legend(ncol=2, loc='upper right', frameon=False)
    axes[2].grid(True, alpha=0.22)

    fig.tight_layout()
    fig.savefig(OUT_DIR / '5-6-temperature-log.png', bbox_inches='tight')
    plt.close(fig)


def render_two_state_model() -> None:
    fig, ax = plt.subplots(figsize=(10.8, 6.6))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis('off')

    def box(x: float, y: float, w: float, h: float, text: str, color: str) -> None:
        patch = FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0.02,rounding_size=0.08', fc=color, ec='#2c3440', lw=1.2)
        ax.add_patch(patch)
        ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=13, color='#17212b')

    box(3.55, 3.75, 2.45, 1.0, '空气温度 $T_a$', '#dfeff4')
    box(3.55, 1.35, 2.45, 1.0, '货品核心温度 $T_p$', '#efe4f5')
    box(0.45, 3.75, 2.1, 1.0, '外界温度\n$T_{amb}$', '#f1f4f6')
    box(0.55, 1.35, 2.0, 1.0, '开门与入库\n热负荷', '#f7e4d3')
    box(7.0, 3.75, 2.05, 1.0, '压缩机占空比\n$u_k$', '#dce9f7')
    box(7.0, 1.35, 2.05, 1.0, '温区约束\n$2°C \\leq T \\leq 8°C$', '#e2f0df')

    arrows = [
        ((2.55, 4.25), (3.55, 4.25), '环境换热'),
        ((2.55, 1.85), (3.55, 3.85), '热负荷'),
        ((4.78, 3.75), (4.78, 2.35), '空气-货品换热'),
        ((6.0, 4.25), (7.0, 4.25), '控制作用'),
        ((6.0, 1.85), (7.0, 1.85), '越界判断'),
    ]
    for start, end, label in arrows:
        arrow = FancyArrowPatch(start, end, arrowstyle='-|>', mutation_scale=15, lw=1.4, color='#35495d')
        ax.add_patch(arrow)
        xm = (start[0] + end[0]) / 2
        ym = (start[1] + end[1]) / 2
        ax.text(xm, ym + 0.18, label, ha='center', va='bottom', fontsize=10.5, color='#374151')

    ax.text(
        5.05,
        0.35,
        r'$T_a(k+1)=T_a(k)+f(T_{amb},T_p,q_{door},q_{load},u_k)$，'
        r'$T_p(k+1)=T_p(k)+g(T_a,T_p,q_{load})$',
        ha='center',
        fontsize=12,
        color='#1f2937',
    )
    fig.savefig(OUT_DIR / '5-6-two-state-thermal-model.png', bbox_inches='tight')
    plt.close(fig)


def render_three_route_comparison(summary: pd.DataFrame) -> None:
    scenario = 'E2'
    fig, axes = plt.subplots(2, 2, figsize=(12.0, 8.4))
    ax = axes[0, 0]
    for method in METHOD_LABELS:
        trace = load_trace(scenario, method)
        ax.plot(trace['minute'] / 60.0, trace['air_C'], lw=1.8, color=METHOD_COLORS[method], label=METHOD_LABELS[method])
    ax.axhspan(2, 8, color='#d9efe7', alpha=0.55)
    ax.set_title('入库高峰空气温度对照')
    ax.set_ylabel('空气温度 / °C')
    ax.grid(True, alpha=0.22)
    ax.legend(frameon=False, fontsize=10)

    ax = axes[0, 1]
    for method in METHOD_LABELS:
        trace = load_trace(scenario, method)
        ax.plot(trace['minute'] / 60.0, trace['product_C'], lw=1.8, color=METHOD_COLORS[method], label=METHOD_LABELS[method])
    ax.axhspan(2, 8, color='#d9efe7', alpha=0.55)
    ax.set_title('入库高峰货品核心温度对照')
    ax.set_ylabel('核心温度 / °C')
    ax.grid(True, alpha=0.22)

    subset = summary[summary['scenario'] == scenario].set_index('method').loc[list(METHOD_LABELS.keys())]
    x = np.arange(len(subset))
    ax = axes[1, 0]
    recovery_bars = ax.bar(x - 0.18, subset['recovery_min'], width=0.36, color='#b64f5c', label='恢复时间')
    for bar, value in zip(recovery_bars, subset['recovery_min']):
        if value == 0:
            y0 = max(ax.get_ylim()[1] * 0.015, 0.35)
            ax.plot(
                [bar.get_x() + 0.04, bar.get_x() + bar.get_width() - 0.04],
                [y0, y0],
                color='#b64f5c',
                lw=2.0,
            )
            ax.text(
                bar.get_x() + bar.get_width() / 2.0,
                y0 + 0.55,
                '0 min',
                ha='center',
                va='bottom',
                fontsize=8.5,
                color='#8f3342',
            )
    ax2 = ax.twinx()
    energy_bars = ax2.bar(x + 0.18, subset['energy_norm_h'], width=0.36, color='#2f5d7c', label='能耗')
    ax.set_xticks(x, [METHOD_LABELS[m] for m in subset.index], rotation=15, ha='right')
    ax.set_ylabel('恢复时间 / min')
    ax2.set_ylabel('归一化能耗 / h')
    ax.set_title('恢复收益与能耗代价同时出现')
    ax.grid(True, axis='y', alpha=0.22)
    handles = [recovery_bars[0], energy_bars[0]]
    labels = ['恢复时间', '能耗']
    ax.legend(handles, labels, frameon=False, fontsize=9, loc='upper center', ncol=2)

    ax = axes[1, 1]
    width = 0.34
    ax.bar(x - width / 2.0, subset['compressor_switches'], width=width, color='#527a9a', label='压缩机切换')
    verify_score = subset['verify_load'].map({'低': 1, '中': 2, '高': 3})
    ax.bar(x + width / 2.0, verify_score, width=width, color='#77718a', label='路线验证负担')
    ax.set_xticks(x, [METHOD_LABELS[m] for m in subset.index], rotation=15, ha='right')
    ax.set_ylabel('切换次数或等级')
    ax.set_title('压缩机切换与路线验证负担')
    ax.grid(True, axis='y', alpha=0.22)
    ax.legend(frameon=False, fontsize=9)

    fig.suptitle('三路线同题比较：同一冷链入库高峰，不只比较温度曲线', fontsize=15, y=0.995)
    fig.tight_layout()
    fig.savefig(OUT_DIR / '5-6-three-route-comparison.png', bbox_inches='tight')
    plt.close(fig)


def render_risk_verification_matrix(summary: pd.DataFrame) -> None:
    risks = ['可解释性', '数据覆盖', '边界工况', '安全壳', '部署监控']
    methods = list(METHOD_LABELS.keys())
    values = np.array(
        [
            [1, 2, 2, 1, 1],
            [2, 3, 3, 2, 2],
            [3, 3, 4, 4, 4],
        ],
        dtype=float,
    )
    fig, ax = plt.subplots(figsize=(10.8, 6.4))
    im = ax.imshow(values, cmap='YlOrRd', vmin=1, vmax=4)
    ax.set_xticks(np.arange(len(risks)), risks)
    ax.set_yticks(np.arange(len(methods)), [METHOD_LABELS[m] for m in methods])
    ax.set_title('路线证据要求矩阵：越依赖数据和策略，越需要额外证明')
    for i in range(values.shape[0]):
        for j in range(values.shape[1]):
            ax.text(j, i, f'{int(values[i, j])}', ha='center', va='center', color='#17212b', fontsize=13, fontweight='bold')
    cbar = fig.colorbar(im, ax=ax, shrink=0.82)
    cbar.set_label('证据要求等级')

    e3 = summary[summary['scenario'] == 'E3'].set_index('method')
    note = (
        f"E3 压力测试：经典越界 {int(e3.loc['classic', 'out_of_range_min'])} min，"
        f"数据驱动 {int(e3.loc['data', 'out_of_range_min'])} min，"
        f"策略监督层 {int(e3.loc['policy', 'out_of_range_min'])} min。"
        "安全壳与独立测试比单次性能更关键。"
    )
    ax.text(0.5, -0.24, note, transform=ax.transAxes, ha='center', va='top', fontsize=11.5, color='#374151')
    fig.tight_layout()
    fig.savefig(OUT_DIR / '5-6-risk-verification-matrix.png', bbox_inches='tight')
    plt.close(fig)


def write_media_index() -> None:
    path = OUT_DIR / '5-6-media.md'
    existing = path.read_text(encoding='utf-8') if path.exists() else ''
    required = [
        '## 5-6-intro-video.mp4',
        '## 5-6-slides.pdf',
        '## 5-6-course.mp4',
        '## 5-6-audio.m4a',
        '## handout.md',
    ]
    additions = [section for section in required if section not in existing]
    if additions:
        content = existing.rstrip() + ('\n\n' if existing.strip() else '# 单元 5-6 媒体链接\n\n')
        content += '\n\n'.join(additions) + '\n'
        path.write_text(content, encoding='utf-8')


def main() -> None:
    setup_style()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = load_summary()
    render_temperature_log()
    render_two_state_model()
    render_three_route_comparison(summary)
    render_risk_verification_matrix(summary)
    write_media_index()


if __name__ == '__main__':
    main()
