from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import matplotlib

ROOT = Path(__file__).resolve().parents[6]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.cache' / 'matplotlib'))
matplotlib.use('Agg')

import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

RAW_DIR = Path(__file__).resolve().parent
DATA_PATH = RAW_DIR / 'generated-data' / '4-3-compound-control-case-data.json'
OUT_DIR = RAW_DIR.parent / 'processed'

matplotlib.rcParams['font.family'] = 'sans-serif'
matplotlib.rcParams['font.sans-serif'] = ['Hiragino Sans GB', 'STHeiti', 'Arial Unicode MS', 'Arial Unicode', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'dejavusans'

COLORS = {
    'before': '#1f4e79',
    'after': '#d94801',
    'controller': '#2b8a3e',
    'reference': '#222222',
    'disturbance': '#6f6f6f',
    'limit': '#777777',
    'grid': '#dddddd',
}


def load_payload() -> dict:
    return json.loads(DATA_PATH.read_text(encoding='utf-8'))


def arr(block: dict, key: str = 'y') -> np.ndarray:
    return np.asarray(block[key], dtype=float)


def flatten_to_white(path: Path) -> None:
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, (255, 255, 255, 255))
    Image.alpha_composite(background, image).convert('RGB').save(path)


def save_plot(fig: plt.Figure, filename: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / filename
    fig.savefig(path, dpi=220, facecolor='white', bbox_inches='tight')
    plt.close(fig)
    flatten_to_white(path)


def style_axis(ax: plt.Axes) -> None:
    ax.grid(True, color=COLORS['grid'], linewidth=0.7)
    ax.set_facecolor('white')


def normalized_disturbance(d: np.ndarray) -> np.ndarray:
    span = np.max(d) - np.min(d)
    if span < 1e-12:
        return np.zeros_like(d)
    return (d - np.min(d)) / span


def plot_two_panel(block: dict, filename: str, title_left: str, title_right: str, label_before: str, label_after: str) -> None:
    t = arr(block['reference'], 't')
    r = arr(block['reference'])
    d = arr(block['disturbance'])
    y_before = arr(block['before_y'])
    y_after = arr(block['after_y'])
    u_before = arr(block['before_u'])
    u_after = arr(block['after_u'])
    has_full = 'full_y' in block and 'full_u' in block
    if has_full:
        y_full = arr(block['full_y'])
        u_full = arr(block['full_u'])

    fig, (ax_y, ax_u) = plt.subplots(1, 2, figsize=(12.8, 4.8), dpi=220)
    style_axis(ax_y)
    ax_y.plot(t, y_before, color=COLORS['before'], linewidth=1.9, label=label_before)
    ax_y.plot(t, y_after, color=COLORS['after'], linewidth=1.9, label=label_after)
    if has_full:
        ax_y.plot(t, y_full, color=COLORS['controller'], linewidth=1.6, linestyle='-.', label='100%前馈强度')
    ax_y.plot(t, r, color=COLORS['reference'], linewidth=1.4, linestyle='--', label='参考信号')
    ax_y.plot(t, normalized_disturbance(d), color=COLORS['disturbance'], linewidth=1.2, linestyle=':', label='扰动信号(归一化)')
    ax_y.set_title(title_left)
    ax_y.set_xlabel('时间 / s')
    ax_y.set_ylabel('航向响应 / 归一化')
    ax_y.legend(frameon=False, fontsize=8.4, loc='best')

    style_axis(ax_u)
    ax_u.plot(t, u_before, color=COLORS['before'], linewidth=1.8, label=label_before)
    ax_u.plot(t, u_after, color=COLORS['after'], linewidth=1.8, label=label_after)
    if has_full:
        ax_u.plot(t, u_full, color=COLORS['controller'], linewidth=1.6, linestyle='-.', label='100%前馈强度')
    ax_u.axhline(0, color=COLORS['limit'], linewidth=0.8, linestyle=':')
    ax_u.set_title(title_right)
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('舵角指令 / 归一化')
    ax_u.legend(frameon=False, fontsize=8.4, loc='best')
    save_plot(fig, filename)


def plot_antiwindup(block: dict) -> None:
    t = arr(block['reference'], 't')
    r = arr(block['reference'])
    d = arr(block['disturbance'])
    y_before = arr(block['before_y'])
    y_after = arr(block['after_y'])
    u_before = arr(block['before_u'])
    u_after = arr(block['after_u'])

    fig, (ax_y, ax_u) = plt.subplots(1, 2, figsize=(12.8, 4.8), dpi=220)
    style_axis(ax_y)
    ax_y.plot(t, y_before, color=COLORS['before'], linewidth=1.8, label='无抗饱和')
    ax_y.plot(t, y_after, color=COLORS['after'], linewidth=1.9, label='反算抗饱和')
    ax_y.plot(t, r, color=COLORS['reference'], linewidth=1.4, linestyle='--', label='参考信号')
    ax_y.plot(t, normalized_disturbance(d), color=COLORS['disturbance'], linewidth=1.2, linestyle=':', label='扰动信号(归一化)')
    ax_y.set_title('饱和场景下的航向响应')
    ax_y.set_xlabel('时间 / s')
    ax_y.set_ylabel('航向响应 / 归一化')
    ax_y.legend(frameon=False, fontsize=8.4, loc='best')

    style_axis(ax_u)
    ax_u.plot(t, u_before, color=COLORS['before'], linewidth=1.8, label='无抗饱和')
    ax_u.plot(t, u_after, color=COLORS['after'], linewidth=1.8, label='反算抗饱和')
    ax_u.axhline(2.4, color=COLORS['limit'], linewidth=0.9, linestyle='--', label='限幅')
    ax_u.axhline(-2.4, color=COLORS['limit'], linewidth=0.9, linestyle='--')
    ax_u.set_title('舵角限幅与恢复过程')
    ax_u.set_xlabel('时间 / s')
    ax_u.set_ylabel('实际舵角指令 / 归一化')
    ax_u.legend(frameon=False, fontsize=8.4, loc='best')
    save_plot(fig, '4-3-antiwindup-comparison.png')


def tex_document(body: str) -> str:
    header = r'''\documentclass[tikz,border=8pt]{standalone}
\usepackage[UTF8]{ctex}
\usepackage{amsmath}
\usepackage{tikz}
\usetikzlibrary{arrows.meta,positioning,calc,fit}
\definecolor{blockblue}{HTML}{4A90D9}
\definecolor{sumgreen}{HTML}{5CB85C}
\definecolor{taporange}{HTML}{F0AD4E}
\definecolor{signalgray}{HTML}{333333}
\tikzset{
  block/.style={rectangle, draw=blockblue, fill=none, minimum width=2.25cm, minimum height=0.82cm, align=center, line width=1.2pt, font=\scriptsize\bfseries},
  wideblock/.style={block, minimum width=2.95cm},
  sum/.style={circle, draw=sumgreen, fill=none, minimum size=6.3mm, inner sep=0pt, line width=1.2pt,
    path picture={\draw[sumgreen,line width=1.0pt] (path picture bounding box.south west) -- (path picture bounding box.north east);
    \draw[sumgreen,line width=1.0pt] (path picture bounding box.north west) -- (path picture bounding box.south east);}},
  tap/.style={circle, draw=taporange, fill=none, minimum size=4.5pt, inner sep=0pt, line width=1.2pt},
  signal/.style={-{Stealth[length=2.7mm,width=1.9mm]}, draw=signalgray, line width=1.2pt},
  label/.style={font=\scriptsize, align=center},
  smalllabel/.style={font=\tiny, align=center}
}
\begin{document}
'''
    return header + body + '\n\\end{document}\n'


def diagram_general() -> str:
    return tex_document(r'''\begin{tikzpicture}
  \tikzset{
    sum/.style={circle, draw=sumgreen, fill=none, minimum size=4.75mm, inner sep=0pt, line width=1.0pt,
      path picture={\draw[sumgreen,line width=0.8pt] (path picture bounding box.south west) -- (path picture bounding box.north east);
      \draw[sumgreen,line width=0.8pt] (path picture bounding box.north west) -- (path picture bounding box.south east);}},
    tap/.style={circle, draw=taporange, fill=none, minimum size=3.8pt, inner sep=0pt, line width=1.1pt},
    siglabel/.style={font=\tiny, fill=white, inner sep=1pt, align=center, yshift=2.2pt}
  }
  \node[label] (r) at (0,0) {参考\\$r$};
  \node[tap] (rtap) at (0.9,0) {};
  \node[block, minimum width=1.85cm] (qf) at (2.35,0) {给定滤波\\$Q_f(s)$};
  \node[sum] (se) at (4.15,0) {};
  \node[wideblock, minimum width=1.95cm] (cb) at (6.0,0) {串联校正\\$C_b(s)$};
  \node[sum] (su) at (7.85,0) {};
  \node[wideblock, minimum width=2.15cm] (sat) at (9.85,0) {限幅/斜率限制\\$\operatorname{sat},\dot u_{\max}$};
  \node[block, minimum width=1.75cm] (ga) at (12.45,0) {执行器\\$G_a(s)$};
  \node[sum] (sd) at (14.15,0) {};
  \node[block, minimum width=1.75cm] (gp) at (15.75,0) {对象\\$G_p(s)$};
  \node[tap] (ytap) at (16.95,0) {};
  \node[label] (y) at (18.05,0) {输出\\$y$};
  \node[block, minimum width=1.85cm] (fr) at (4.15,1.68) {参考前馈\\$F_r(s)$};
  \node[block, minimum width=1.85cm] (fd) at (11.05,1.68) {扰动前馈\\$F_d(s)$};
  \node[label] (d) at (12.65,3.35) {扰动\\$d$};
  \coordinate (frbend) at (6.95,1.68);
  \coordinate (fdbend) at (8.78,1.68);
  \node[tap] (dtap) at (12.65,1.68) {};
  \coordinate (dinbend) at (14.15,1.68);

  \draw[signal] (r) -- (rtap) -- (qf);
  \draw[signal] (qf) -- node[siglabel, above, pos=0.38] {$r_f$} (se);
  \draw[signal] (se) -- node[siglabel, above, pos=0.62] {$e$} (cb);
  \draw[signal] (cb) -- node[siglabel, above, pos=0.42] {$u_b$} (su);
  \draw[signal] (su) -- node[siglabel, above, pos=0.48] {$u_c$} (sat);
  \draw[signal] (sat) -- node[siglabel, above, pos=0.5] {$u_{\mathrm{lim}}$} (ga);
  \draw[signal] (ga) -- node[siglabel, above, pos=0.48] {$u_a$} (sd);
  \draw[signal] (sd) -- node[siglabel, above, pos=0.48] {$v$} (gp);
  \draw[signal] (gp) -- (ytap) -- (y);
  \draw[signal] (rtap) |- (fr.west);
  \draw[signal] (fr.east) -- node[siglabel, above] {$u_r$} (frbend) -- (su.145);
  \draw[signal] (d) -- (dtap) -- node[siglabel, above] {$d$} (dinbend) -- (sd.north);
  \draw[signal] (dtap) -- node[siglabel, above] {$d$} (fd.east);
  \draw[signal] (fd.west) -- node[siglabel, above] {$u_d$} (fdbend) -- (su.35);
  \draw[signal] (ytap) |- node[siglabel, near start, right] {$y$} ($(se)+(0,-1.32)$) -| (se.south);
  \node[smalllabel] at ($(se)+(-0.22,0.24)$) {$+$};
  \node[smalllabel] at ($(se)+(0.22,-0.24)$) {$-$};
  \node[smalllabel] at ($(su)+(-0.22,0.24)$) {$+$};
  \node[smalllabel] at ($(su)+(0.0,0.27)$) {$+$};
  \node[smalllabel] at ($(su)+(0.22,0.20)$) {$+$};
  \node[smalllabel] at ($(sd)+(-0.22,0.24)$) {$+$};
  \node[smalllabel] at ($(sd)+(0.22,0.24)$) {$+$};
\end{tikzpicture}''')


def diagram_disturbance() -> str:
    return tex_document(r'''\begin{tikzpicture}
  \tikzset{
    sum/.style={circle, draw=sumgreen, fill=none, minimum size=3.15mm, inner sep=0pt, line width=0.9pt,
      path picture={\draw[sumgreen,line width=0.7pt] (path picture bounding box.south west) -- (path picture bounding box.north east);
      \draw[sumgreen,line width=0.7pt] (path picture bounding box.north west) -- (path picture bounding box.south east);}},
    tap/.style={circle, draw=taporange, fill=none, minimum size=3.4pt, inner sep=0pt, line width=1.0pt}
  }
  \node[label] (r) at (0,0) {$r$};
  \node[sum] (se) at (1.25,0) {};
  \node[wideblock, minimum width=2.35cm] (cb) at (3.25,0) {反馈主结构\\$C_b(s)$};
  \node[sum] (su) at (5.2,0) {};
  \node[block, minimum width=1.7cm] (ga) at (7.05,0) {执行器\\$G_a(s)$};
  \node[sum] (sd) at (8.65,0) {};
  \node[block, minimum width=1.7cm] (gp) at (10.25,0) {对象\\$G_p(s)$};
  \node[tap] (ytap) at (11.45,0) {};
  \node[label] (y) at (12.2,0) {$y$};
  \node[label] (d) at (8.65,2.55) {扰动\\$d$};
  \node[tap] (dtap) at (8.65,1.35) {};
  \node[block, minimum width=1.75cm] (fd) at (6.55,1.35) {扰动前馈\\$F_d(s)$};
  \draw[signal] (r) -- (se);
  \draw[signal] (se) -- (cb);
  \draw[signal] (cb) -- (su);
  \draw[signal] (su) -- (ga);
  \draw[signal] (ga) -- (sd);
  \draw[signal] (sd) -- (gp);
  \draw[signal] (gp) -- (ytap) -- (y);
  \draw[signal] (d) -- (dtap) -- (sd.north);
  \draw[signal] (dtap) -- (fd.east);
  \draw[signal] (fd.west) -| (su.north);
  \draw[signal] (ytap) |- ($(se)+(0,-1.25)$) -| (se.south);
  \node[smalllabel] at ($(se)+(-0.25,0.28)$) {$+$};
  \node[smalllabel] at ($(se)+(0.25,-0.28)$) {$-$};
  \node[smalllabel] at ($(su)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(su)+(0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(0.28,0.28)$) {$+$};
\end{tikzpicture}''')


def diagram_reference() -> str:
    return tex_document(r'''\begin{tikzpicture}
  \tikzset{
    sum/.style={circle, draw=sumgreen, fill=none, minimum size=3.15mm, inner sep=0pt, line width=0.9pt,
      path picture={\draw[sumgreen,line width=0.7pt] (path picture bounding box.south west) -- (path picture bounding box.north east);
      \draw[sumgreen,line width=0.7pt] (path picture bounding box.north west) -- (path picture bounding box.south east);}},
    tap/.style={circle, draw=taporange, fill=none, minimum size=3.4pt, inner sep=0pt, line width=1.0pt}
  }
  \node[label] (r) at (0,0) {$r$};
  \node[tap] (rtap) at (0.85,0) {};
  \node[sum] (se) at (2.0,0) {};
  \node[wideblock, minimum width=2.15cm] (cb) at (3.95,0) {$C_b(s)$};
  \node[sum] (su) at (5.85,0) {};
  \node[block, minimum width=1.65cm] (ga) at (7.65,0) {$G_a(s)$};
  \node[sum] (sd) at (9.25,0) {};
  \node[block, minimum width=1.65cm] (gp) at (10.85,0) {$G_p(s)$};
  \node[tap] (ytap) at (12.0,0) {};
  \node[label] (y) at (12.7,0) {$y$};
  \node[block, minimum width=1.8cm] (fr) at (2.7,1.5) {参考前馈\\$F_r(s)$};
  \node[label] (d) at (9.25,2.55) {$d$};
  \node[tap] (dtap) at (9.25,1.42) {};
  \node[block, minimum width=1.65cm] (fd) at (7.25,1.42) {$F_d(s)$};
  \draw[signal] (r) -- (rtap) -- (se);
  \draw[signal] (rtap) |- (fr.west);
  \draw[signal] (fr.east) -- (5.1,1.5) -- (su.145);
  \draw[signal] (se) -- (cb);
  \draw[signal] (cb) -- (su);
  \draw[signal] (su) -- (ga);
  \draw[signal] (ga) -- (sd);
  \draw[signal] (sd) -- (gp);
  \draw[signal] (gp) -- (ytap) -- (y);
  \draw[signal] (d) -- (dtap) -- (sd.north);
  \draw[signal] (dtap) -- (fd.east);
  \draw[signal] (fd.west) -- (6.35,1.42) -- (su.35);
  \draw[signal] (ytap) |- ($(se)+(0,-1.25)$) -| (se.south);
  \node[smalllabel] at ($(se)+(-0.25,0.28)$) {$+$};
  \node[smalllabel] at ($(se)+(0.25,-0.28)$) {$-$};
  \node[smalllabel] at ($(su)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(su)+(0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(0.28,0.28)$) {$+$};
\end{tikzpicture}''')


def diagram_setpoint_filter() -> str:
    return tex_document(r'''\begin{tikzpicture}
  \tikzset{
    sum/.style={circle, draw=sumgreen, fill=none, minimum size=3.15mm, inner sep=0pt, line width=0.9pt,
      path picture={\draw[sumgreen,line width=0.7pt] (path picture bounding box.south west) -- (path picture bounding box.north east);
      \draw[sumgreen,line width=0.7pt] (path picture bounding box.north west) -- (path picture bounding box.south east);}}
  }
  \node[label] (r) at (0,0) {$r$};
  \node[tap] (rtap) at (0.85,0) {};
  \node[block, minimum width=1.8cm] (qf) at (2.25,0) {给定滤波\\$Q_f(s)$};
  \node[sum] (se) at (3.95,0) {};
  \node[wideblock, minimum width=2.1cm] (cb) at (5.85,0) {$C_b(s)$};
  \node[sum] (su) at (7.75,0) {};
  \node[block, minimum width=1.65cm] (ga) at (9.55,0) {$G_a(s)$};
  \node[sum] (sd) at (11.15,0) {};
  \node[block, minimum width=1.65cm] (gp) at (12.75,0) {$G_p(s)$};
  \node[tap] (ytap) at (13.9,0) {};
  \node[label] (y) at (14.6,0) {$y$};
  \node[block, minimum width=1.65cm] (fr) at (2.95,1.45) {$F_r(s)$};
  \node[label] (d) at (11.15,3.4) {$d$};
  \node[tap] (dtap) at (11.15,1.45) {};
  \node[block, minimum width=1.65cm] (fd) at (9.1,1.45) {$F_d(s)$};
  \draw[signal] (r) -- (rtap) -- (qf);
  \draw[signal] (qf) -- (se);
  \draw[signal] (rtap) |- (fr);
  \draw[signal] (fr.east) -- (7.05,1.45) -- (su.145);
  \draw[signal] (se) -- (cb);
  \draw[signal] (cb) -- (su);
  \draw[signal] (su) -- (ga);
  \draw[signal] (ga) -- (sd);
  \draw[signal] (sd) -- (gp);
  \draw[signal] (gp) -- (ytap) -- (y);
  \draw[signal] (d) -- (dtap) -- (sd.north);
  \draw[signal] (dtap) -- (fd.east);
  \draw[signal] (fd.west) -- (8.2,1.45) -- (su.35);
  \draw[signal] (ytap) |- ($(se)+(0,-1.3)$) -| (se.south);
  \node[smalllabel] at ($(se)+(-0.25,0.28)$) {$+$};
  \node[smalllabel] at ($(se)+(0.25,-0.28)$) {$-$};
  \node[smalllabel] at ($(su)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(su)+(0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(0.28,0.28)$) {$+$};
\end{tikzpicture}''')


def diagram_antiwindup() -> str:
    return tex_document(r'''\begin{tikzpicture}
  \tikzset{
    sum/.style={circle, draw=sumgreen, fill=none, minimum size=3.15mm, inner sep=0pt, line width=0.9pt,
      path picture={\draw[sumgreen,line width=0.7pt] (path picture bounding box.south west) -- (path picture bounding box.north east);
      \draw[sumgreen,line width=0.7pt] (path picture bounding box.north west) -- (path picture bounding box.south east);}},
    tap/.style={circle, draw=taporange, fill=none, minimum size=3.4pt, inner sep=0pt, line width=1.0pt}
  }
  \node[label] (r) at (0,0) {$r$};
  \node[tap] (rtap) at (1.1,0) {};
  \node[block, minimum width=1.45cm] (qf) at (2.45,0) {$Q_f(s)$};
  \node[sum] (se) at (4.0,0) {};
  \node[wideblock, minimum width=2.25cm] (pid) at (5.95,0) {带滤波 PID\\$C_{\mathrm{PIDf}}$};
  \node[sum] (su) at (8.0,0) {};
  \node[wideblock, minimum width=2.35cm] (sat) at (10.25,0) {限幅 + 斜率限制};
  \node[block, minimum width=1.45cm] (ga) at (12.65,0) {$G_a(s)$};
  \node[sum] (sd) at (14.2,0) {};
  \node[block, minimum width=1.45cm] (gp) at (15.75,0) {$G_p(s)$};
  \node[tap] (ytap) at (16.95,0) {};
  \node[label] (y) at (17.75,0) {$y$};
  \node[block, minimum width=1.65cm] (fr) at (3.05,1.45) {$F_r(s)$};
  \node[label] (d) at (14.2,2.7) {$d$};
  \node[tap] (dtap) at (14.2,1.45) {};
  \node[block, minimum width=1.65cm] (fd) at (12.15,1.45) {$F_d(s)$};
  \node[wideblock, minimum width=3.2cm] (aw) at (8.0,-1.62) {抗积分饱和\\$\dot x_i=e+\dfrac{u_{act}-u_{raw}}{T_{aw}}$};
  \draw[signal] (r) -- (rtap) -- (qf);
  \draw[signal] (qf) -- (se);
  \draw[signal] (rtap) |- (fr);
  \draw[signal] (fr.east) -- (7.2,1.45) -- (su.145);
  \draw[signal] (se) -- (pid);
  \draw[signal] (pid) -- (su);
  \draw[signal] (su) -- (sat);
  \draw[signal] (sat) -- (ga);
  \draw[signal] (ga) -- (sd);
  \draw[signal] (sd) -- (gp);
  \draw[signal] (gp) -- (ytap) -- (y);
  \draw[signal] (d) -- (dtap) -- (sd.north);
  \draw[signal] (dtap) -- (fd.east);
  \draw[signal] (fd.west) -- (9.05,1.45) -- (su.35);
  \draw[signal] (sat.south) |- (aw.east);
  \draw[signal] (aw.west) -| (pid.south);
  \draw[signal] (ytap) |- ($(se)+(0,-2.55)$) -| (se.south);
  \node[smalllabel] at ($(se)+(-0.25,0.28)$) {$+$};
  \node[smalllabel] at ($(se)+(0.25,-0.28)$) {$-$};
  \node[smalllabel] at ($(su)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(su)+(0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(-0.28,0.28)$) {$+$};
  \node[smalllabel] at ($(sd)+(0.28,0.28)$) {$+$};
\end{tikzpicture}''')


DIAGRAMS = {
    '4-3-classic-compound-control-structure': diagram_general,
    '4-3-disturbance-feedforward-structure': diagram_disturbance,
    '4-3-reference-feedforward-structure': diagram_reference,
    '4-3-setpoint-filter-structure': diagram_setpoint_filter,
    '4-3-antiwindup-implementation-structure': diagram_antiwindup,
}


def compile_tex(name: str, tex: str) -> None:
    tex_path = RAW_DIR / f'{name}.tex'
    tex_path.write_text(tex, encoding='utf-8')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='unit43-tikz-') as tmp:
        tmp_path = Path(tmp)
        work_tex = tmp_path / f'{name}.tex'
        work_tex.write_text(tex, encoding='utf-8')
        subprocess.run(
            ['xelatex', '-interaction=nonstopmode', '-halt-on-error', work_tex.name],
            cwd=tmp_path,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        pdf_path = tmp_path / f'{name}.pdf'
        png_path = OUT_DIR / f'{name}.png'
        subprocess.run(
            ['convert', '-density', '300', str(pdf_path), '-quality', '100', str(png_path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
    flatten_to_white(OUT_DIR / f'{name}.png')


def main() -> None:
    payload = load_payload()
    plot_two_panel(
        payload['disturbance_ff'],
        '4-3-disturbance-feedforward-comparison.png',
        '扰动前馈加入前后的航向响应',
        '舵角响应对比',
        '无扰动前馈',
        '加入扰动前馈',
    )
    plot_two_panel(
        payload['reference_ff'],
        '4-3-reference-feedforward-comparison.png',
        '参考前馈加入前后的航向响应',
        '舵角响应对比',
        '无参考前馈',
        '加入参考前馈',
    )
    plot_two_panel(
        payload['setpoint_filter'],
        '4-3-setpoint-filter-comparison.png',
        '给定滤波加入前后的航向响应',
        '舵角响应对比',
        '无给定滤波',
        '加入给定滤波',
    )
    plot_antiwindup(payload['antiwindup'])
    for name, maker in DIAGRAMS.items():
        compile_tex(name, maker())


if __name__ == '__main__':
    main()
