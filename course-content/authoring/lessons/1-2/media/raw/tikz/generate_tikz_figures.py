#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "raw" / "tikz"
PROCESSED = ROOT / "processed"


PREAMBLE = r"""
\documentclass[tikz,border=7pt]{standalone}
\usepackage{amsmath}
\usepackage{fontspec}
\usepackage{xeCJK}
\setmainfont{PT Serif}
\setCJKmainfont{Noto Sans CJK SC}
\usetikzlibrary{arrows.meta,positioning,calc,fit,backgrounds}
\definecolor{blockblue}{HTML}{4A90D9}
\definecolor{sumgreen}{HTML}{5CB85C}
\definecolor{taporange}{HTML}{F0AD4E}
\definecolor{linegray}{HTML}{333333}
\definecolor{sfgpurple}{HTML}{9B59B6}
\definecolor{sfggreen}{HTML}{2ECC71}
\definecolor{sfgred}{HTML}{E74C3C}
\tikzset{
  block/.style={rectangle, draw=blockblue, fill=none, line width=1.2pt, minimum height=0.75cm, minimum width=1.4cm, inner sep=2pt, font=\footnotesize\bfseries, align=center},
  wideblock/.style={block, minimum width=2.4cm},
  sum/.style={circle, draw=sumgreen, fill=none, line width=1.2pt, minimum size=0.34cm, inner sep=0pt, path picture={\draw[line width=0.8pt, linegray] (path picture bounding box.south west) -- (path picture bounding box.north east); \draw[line width=0.8pt, linegray] (path picture bounding box.north west) -- (path picture bounding box.south east);}},
  tap/.style={circle, draw=taporange, fill=none, line width=1.2pt, minimum size=4pt, inner sep=0pt},
  signal/.style={-{Latex[length=2.2mm]}, line width=1.2pt, draw=linegray},
  plain/.style={line width=1.2pt, draw=linegray},
  signal label above/.style={fill=none, above=4pt, font=\footnotesize},
  signal label below/.style={fill=none, below=4pt, font=\footnotesize},
  neg sign/.style={fill=none, font=\footnotesize, very near end},
  note/.style={font=\footnotesize, align=center},
  sfgsource/.style={circle, draw=sfggreen, fill=none, line width=1.2pt, minimum size=0.86cm, font=\small\bfseries},
  sfgnode/.style={circle, draw=sfgpurple, fill=none, line width=1.2pt, minimum size=0.86cm, font=\small\bfseries},
  sfgsink/.style={circle, draw=sfgred, fill=none, line width=1.2pt, minimum size=0.86cm, font=\small\bfseries},
  sfgedge/.style={-{Latex[length=2.2mm]}, line width=1.2pt, draw={rgb,255:red,44;green,62;blue,80}},
  gain label above/.style={fill=none, above=3pt, font=\small\itshape},
  gain label below/.style={fill=none, below=3pt, font=\small\itshape},
}
\begin{document}
"""


FIGURES: dict[str, str] = {
    "1-2-fig-01-modeling-paths": r"""
\begin{tikzpicture}[x=1cm,y=1cm]
  \node[wideblock, minimum width=2.6cm] (obj) at (0,0) {真实对象};
  \node[wideblock] (law) at (-2.35,-1.35) {物理定律};
  \node[wideblock] (ode) at (-2.35,-2.55) {微分方程};
  \node[wideblock] (tf) at (-2.35,-3.75) {传递函数};
  \node[wideblock] (data) at (2.35,-1.35) {输入输出数据};
  \node[wideblock] (fit) at (2.35,-2.55) {算法学习};
  \node[wideblock] (pred) at (2.35,-3.75) {预测模型};
  \draw[signal] (obj.south west) -- (law.north);
  \draw[signal] (law) -- (ode);
  \draw[signal] (ode) -- (tf);
  \draw[signal] (obj.south east) -- (data.north);
  \draw[signal] (data) -- (fit);
  \draw[signal] (fit) -- (pred);
  \node[note] at (-4.65,-2.55) {机理建模\\可解释\\依赖机理};
  \node[note] at (4.65,-2.55) {数据驱动建模\\易接入\\依赖数据覆盖};
  \node[note, font=\small\bfseries] at (0,-4.55) {目标：把对象变成可以分析、比较和设计的模型};
\end{tikzpicture}
""",
    "1-2-fig-04-transform-chain": r"""
\begin{tikzpicture}[x=1cm,y=1cm]
  \node[wideblock, minimum width=3.2cm] (ode) at (0,0) {$J\ddot{\theta}+B\dot{\theta}=Ku$};
  \node[wideblock, minimum width=3.6cm] (lap) at (5.0,0) {$Js^2\Theta(s)+Bs\Theta(s)=KU(s)$};
  \node[wideblock, minimum width=3.8cm] (tf) at (10.6,0) {$G(s)=\dfrac{\Theta(s)}{U(s)}=\dfrac{K}{Js^2+Bs}$};
  \draw[signal] (ode) -- node[signal label above] {拉氏变换} (lap);
  \draw[signal] (lap) -- node[signal label above] {提取比值} (tf);
  \node[note] at (5.0,-1.05) {$\dot f(t)\mapsto sF(s)$,\quad $\ddot f(t)\mapsto s^2F(s)$（零初值）};
\end{tikzpicture}
""",
    "1-2-fig-05-closed-loop-block": r"""
\begin{tikzpicture}[x=1cm,y=1cm]
  \node[note] (r) at (0,0) {$r(t)$};
  \node[sum] (sum) at (1.2,0) {};
  \node[block] (c) at (2.8,0) {控制器};
  \node[block] (a) at (5.15,0) {执行器};
  \node[block] (g) at (7.3,0) {被控对象};
  \node[tap] (tap) at (9.05,0) {};
  \node[note] (y) at (10.05,0) {$y(t)$};
  \node[block] (h) at (5.15,-1.55) {传感器};
  \draw[signal] (r) -- (sum);
  \draw[signal] (sum) -- node[signal label above] {$e(t)$} (c);
  \draw[signal] (c) -- node[signal label above] {$u(t)$} (a);
  \draw[signal] (a) -- (g);
  \draw[signal] (g) -- (tap) -- (y);
  \draw[signal] (tap) |- (h.east);
  \draw[signal] (h.west) -| node[neg sign, left] {$-$} (sum.south);
  \node[note] at (2.1,-0.55) {比较点};
\end{tikzpicture}
""",
    "1-2-fig-06-basic-connections": r"""
\begin{tikzpicture}[x=1cm,y=1cm]
  \node[note] at (-0.6,1.8) {串联};
  \node[block] (g1) at (1.0,1.8) {$G_1$};
  \node[block] (g2) at (3.0,1.8) {$G_2$};
  \draw[signal] (-0.1,1.8) -- (g1) -- (g2) -- (4.2,1.8);
  \node[note] at (6.0,1.8) {$G=G_1G_2$};

  \node[note] at (-0.6,0) {并联};
  \node[tap] (tap) at (0.5,0) {};
  \node[block] (p1) at (2.2,0.75) {$G_1$};
  \node[block] (p2) at (2.2,-0.75) {$G_2$};
  \node[sum] (psum) at (4.0,0) {};
  \draw[signal] (-0.1,0) -- (tap);
  \draw[signal] (tap) |- (p1);
  \draw[signal] (tap) |- (p2);
  \draw[signal] (p1) -| (psum);
  \draw[signal] (p2) -| (psum);
  \draw[signal] (psum) -- (4.8,0);
  \node[note] at (6.0,0) {$G=G_1+G_2$};

  \node[note] at (-0.6,-2.1) {反馈};
  \node[sum] (fsum) at (0.5,-2.1) {};
  \node[block] (fg) at (2.3,-2.1) {$G$};
  \node[tap] (ftap) at (4.0,-2.1) {};
  \node[block] (fh) at (2.3,-3.4) {$H$};
  \draw[signal] (-0.1,-2.1) -- (fsum);
  \draw[signal] (fsum) -- (fg) -- (ftap) -- (4.8,-2.1);
  \draw[signal] (ftap) |- (fh.east);
  \draw[signal] (fh.west) -| node[neg sign, left] {$-$} (fsum.south);
  \node[note] at (6.0,-2.1) {$\Phi=\dfrac{G}{1+GH}$};
\end{tikzpicture}
""",
    "1-2-fig-07-block-to-sfg": r"""
\begin{tikzpicture}[x=1cm,y=1cm]
  \node[sum] (sum) at (0,1.25) {};
  \node[block] (g) at (1.8,1.25) {$G(s)$};
  \node[tap] (tap) at (3.2,1.25) {};
  \node[block] (h) at (1.8,0.1) {$H(s)$};
  \draw[signal] (-0.75,1.25) -- node[signal label above] {$R$} (sum);
  \draw[signal] (sum) -- node[signal label above] {$E$} (g);
  \draw[signal] (g) -- (tap) -- node[signal label above] {$Y$} (4.1,1.25);
  \draw[signal] (tap) |- (h.east);
  \draw[signal] (h.west) -| node[neg sign, left] {$-$} (sum.south);

  \node[sfgsource] (r) at (0,-1.85) {$R$};
  \node[sfgnode] (e) at (2.0,-1.85) {$E$};
  \node[sfgsink] (y) at (4.0,-1.85) {$Y$};
  \draw[sfgedge] (r) -- node[gain label above] {$1$} (e);
  \draw[sfgedge] (e) -- node[gain label above] {$G(s)$} (y);
  \draw[sfgedge, out=-90, in=-90, looseness=1.25] (y) to node[gain label below] {$-H(s)$} (e);
  \node[note] at (6.0,1.25) {方框图：环节视角};
  \node[note] at (6.0,-1.85) {信号流图：变量视角};
\end{tikzpicture}
""",
}


def compile_one(stem: str, body: str) -> None:
    tex_path = RAW / f"{stem}.tex"
    pdf_path = RAW / f"{stem}.pdf"
    png_path = PROCESSED / f"{stem}.png"
    tex_path.write_text(PREAMBLE + body + "\n\\end{document}\n", encoding="utf-8")
    subprocess.run(
        ["/Library/TeX/texbin/xelatex", "-interaction=nonstopmode", tex_path.name],
        cwd=RAW,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        [
            "magick",
            "-density",
            "300",
            str(pdf_path),
            "-background",
            "white",
            "-alpha",
            "remove",
            "-alpha",
            "off",
            "-quality",
            "95",
            str(png_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    for stem, body in FIGURES.items():
        compile_one(stem, body)
        print(f"generated {stem}")


if __name__ == "__main__":
    main()
