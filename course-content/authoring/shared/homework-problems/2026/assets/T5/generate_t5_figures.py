#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import subprocess
import tempfile
import textwrap


ROOT = Path(__file__).resolve().parent


PREAMBLE = r"""
\documentclass[tikz,border=6pt]{standalone}
\usepackage{amsmath}
\usepackage{xcolor}
\usepackage[UTF8]{ctex}
\setCJKmainfont{Songti SC}
\usetikzlibrary{arrows.meta,positioning,calc}
\definecolor{blockblue}{HTML}{4A90D9}
\definecolor{sumgreen}{HTML}{5CB85C}
\definecolor{taporange}{HTML}{F0AD4E}
\definecolor{linegray}{HTML}{333333}
\tikzset{
  block/.style={rectangle, draw=blockblue, fill=none, line width=1.2pt,
    minimum height=0.9cm, minimum width=1.45cm, align=center,
    font=\footnotesize\bfseries},
  wideblock/.style={rectangle, draw=blockblue, fill=none, line width=1.2pt,
    minimum height=0.92cm, minimum width=2.55cm, align=center,
    font=\footnotesize\bfseries},
  equipblock/.style={rectangle, draw=blockblue, fill=none, line width=1.2pt,
    minimum height=0.9cm, minimum width=1.9cm, align=center,
    font=\footnotesize\bfseries},
  sum/.style={circle, draw=sumgreen, fill=none, line width=1.2pt,
    minimum size=0.46cm, inner sep=0pt,
    path picture={
      \draw[line width=0.9pt, sumgreen]
        (path picture bounding box.south west) -- (path picture bounding box.north east)
        (path picture bounding box.north west) -- (path picture bounding box.south east);
    }},
  tap/.style={circle, draw=taporange, fill=none, line width=1.2pt,
    minimum size=4.5pt, inner sep=0pt},
  signal/.style={-{Stealth[length=2.2mm]}, line width=1.2pt, draw=linegray},
  wire/.style={line width=1.2pt, draw=linegray},
  dashedbox/.style={rectangle, draw=linegray, dashed, line width=0.9pt,
    inner sep=7pt, rounded corners=1pt},
  lab/.style={font=\footnotesize},
  neg/.style={font=\footnotesize, fill=white, inner sep=1pt}
}
\begin{document}
"""

POSTAMBLE = r"\end{document}" + "\n"


FIGURES: dict[str, str] = {
    "T5-3-stem-plant-context": r"""
\begin{tikzpicture}[auto, node distance=1.35cm]
  \node[lab] (r) at (0,0) {速度给定 $r(t)$};
  \node[sum] (sum_e) at (1.65,0) {};
  \node[wideblock] (controller) at (4.0,0) {待选经典\\复合控制器};
  \node[wideblock] (act) at (6.9,0) {执行机构\\$\dfrac{1.8}{0.08s+1}$};
  \node[sum] (sum_l) at (9.15,0) {};
  \node[wideblock] (load) at (11.65,0) {负载结构\\$\dfrac{1}{0.18s+1}e^{-0.04s}$};
  \node[tap] (ytap) at (13.15,0) {};
  \node[lab] (y) at (15.0,0) {辊筒速度 $\omega(t)$};

  \node[lab] (d) at (9.15,1.65) {负载扰动};
  \node[block] (hm) at (7.25,-1.85) {测速环节\\$H_m(s)$};

  \draw[signal] (r) -- node[lab, above] {$+$} (sum_e);
  \draw[signal] (sum_e) -- (controller);
  \draw[signal] (controller) -- (act);
  \draw[signal] (act) -- (sum_l);
  \draw[signal] (sum_l) -- (load);
  \draw[wire] (load) -- (ytap);
  \draw[signal] (ytap) -- (y);
  \draw[signal] (d) -- node[lab, right] {$-$} (sum_l.north);
  \draw[signal] (ytap) |- (hm);
  \draw[wire] (hm) -| (1.65,-1.85);
  \draw[signal] (1.65,-1.85) -- node[neg, left, near end] {$-$} (sum_e.south);
  \draw[dashedbox] ($(controller.north west)+(-0.15,0.15)$) rectangle
    ($(controller.south east)+(0.15,-0.15)$);
\end{tikzpicture}
""",
    "T5-3-answer-route-feedforward": r"""
\begin{tikzpicture}[auto, node distance=1.3cm]
  \node[lab] (r) at (0,0) {速度给定};
  \node[tap] (rtap) at (1.25,0) {};
  \node[sum] (sum_e) at (2.25,0) {};
  \node[block] (cpi) at (3.75,0) {速度反馈\\$PI$};
  \node[sum] (sum_u) at (5.45,0) {};
  \node[block] (sat) at (6.85,0) {限幅\\抗饱和};
  \node[equipblock] (act) at (8.95,0) {执行机构};
  \node[sum] (sum_l) at (10.65,0) {};
  \node[equipblock] (load) at (12.4,0) {负载结构};
  \node[tap] (ytap) at (13.6,0) {};
  \node[lab] (y) at (14.85,0) {速度};

  \node[block] (fr) at (3.75,1.85) {给定前馈\\$F_r(s)$};
  \node[block] (fd) at (7.45,1.85) {扰动前馈\\$F_d(s)$};
  \node[lab] (dlabel) at (10.65,3.0) {实际扰动};
  \coordinate (dtop) at (10.65,2.72);
  \node[tap] (dtap) at (10.65,1.85) {};

  \draw[wire] (r) -- (rtap);
  \draw[signal] (rtap) -- node[lab, above] {$+$} (sum_e);
  \draw[signal] (sum_e) -- (cpi);
  \draw[signal] (cpi) -- (sum_u);
  \draw[signal] (sum_u) -- (sat);
  \draw[signal] (sat) -- (act);
  \draw[signal] (act) -- (sum_l);
  \draw[signal] (sum_l) -- (load);
  \draw[wire] (load) -- (ytap);
  \draw[signal] (ytap) -- (y);
  \draw[wire] (ytap) |- (2.25,-2.75);
  \draw[signal] (2.25,-2.75) -- node[neg, left, near end] {$-$} (sum_e.south);

  \draw[signal] (rtap) |- (fr);
  \draw[signal] (fr.east) -- (4.55,1.85) -- node[lab, near end, left] {$+$} (sum_u.north west);
  \draw[wire] (dtop) -- (dtap);
  \draw[signal] (dtap) -- node[lab, near end, right] {$-$} (sum_l.north);
  \draw[signal] (dtap) -- (fd.east);
  \draw[signal] (fd.west) -- (6.65,1.85) -- node[lab, near end, right] {$+$} (sum_u.north east);
\end{tikzpicture}
""",
    "T5-3-answer-route-cascade": r"""
\begin{tikzpicture}[auto, node distance=1.3cm]
  \node[lab] (r) at (0,0) {速度给定};
  \node[sum] (sum_w) at (1.2,0) {};
  \node[block] (csp) at (2.75,0) {速度外环\\$C_\omega$};
  \node[sum] (sum_i) at (5.25,0) {};
  \node[block] (ci) at (6.65,0) {转矩内环\\$C_i$};
  \node[equipblock] (act) at (8.75,0) {执行机构};
  \node[sum] (sum_l) at (10.6,0) {};
  \node[equipblock] (load) at (12.35,0) {负载结构};
  \node[tap] (ytap) at (13.55,0) {};
  \node[lab] (y) at (14.8,0) {速度};

  \node[tap] (ttap) at (9.9,0) {};
  \node[lab] (d) at (10.6,1.55) {负载扰动};

  \draw[signal] (r) -- node[lab, above] {$+$} (sum_w);
  \draw[signal] (sum_w) -- (csp);
  \draw[signal] (csp) -- node[lab, above=4pt] {转矩给定} (sum_i);
  \draw[signal] (sum_i) -- (ci);
  \draw[signal] (ci) -- (act);
  \draw[wire] (act) -- (ttap);
  \draw[signal] (ttap) -- (sum_l);
  \draw[signal] (sum_l) -- (load);
  \draw[wire] (load) -- (ytap);
  \draw[signal] (ytap) -- (y);
  \draw[wire] (ytap) |- (1.2,-2.45);
  \draw[signal] (1.2,-2.45) -- node[neg, left, near end] {$-$} (sum_w.south);
  \draw[wire] (ttap) |- node[lab, near start, right] {转矩反馈} (5.25,-1.45);
  \draw[signal] (5.25,-1.45) -- node[neg, left, near end] {$-$} (sum_i.south);
  \draw[signal] (d) -- node[lab, right] {$-$} (sum_l.north);
\end{tikzpicture}
""",
    "T5-3-answer-route-filter-notch": r"""
\begin{tikzpicture}[auto, node distance=1.3cm]
  \node[lab] (r) at (0,0) {速度给定};
  \node[sum] (sum_e) at (1.2,0) {};
  \node[block] (c) at (2.65,0) {反馈控制\\$PID$};
  \node[block] (q) at (4.45,0) {校正/陷波\\$Q(s)$};
  \node[block] (lim) at (6.25,0) {限幅};
  \node[equipblock] (act) at (8.75,0) {执行机构};
  \node[sum] (sum_l) at (10.6,0) {};
  \node[equipblock] (load) at (12.35,0) {负载结构};
  \node[tap] (ytap) at (13.55,0) {};
  \node[lab] (y) at (14.8,0) {速度};

  \node[block] (hf) at (6.7,-1.65) {测速滤波\\$H_f(s)$};
  \node[lab] (d) at (10.6,1.65) {负载扰动};

  \draw[signal] (r) -- node[lab, above] {$+$} (sum_e);
  \draw[signal] (sum_e) -- (c);
  \draw[signal] (c) -- (q);
  \draw[signal] (q) -- (lim);
  \draw[signal] (lim) -- (act);
  \draw[signal] (act) -- (sum_l);
  \draw[signal] (sum_l) -- (load);
  \draw[wire] (load) -- (ytap);
  \draw[signal] (ytap) -- (y);
  \draw[signal] (ytap) |- (hf);
  \draw[wire] (hf) -| (1.2,-1.65);
  \draw[signal] (1.2,-1.65) -- node[neg, left, near end] {$-$} (sum_e.south);
  \draw[signal] (d) -- node[lab, right] {$-$} (sum_l.north);
\end{tikzpicture}
""",
    "O5-example-structure": r"""
\begin{tikzpicture}[auto, node distance=1.3cm]
  \node[lab] (r) at (0,0) {给定输入};
  \node[tap] (rtap) at (1.05,0) {};
  \node[sum] (sum_e) at (1.9,0) {};
  \node[block] (cpi) at (3.35,0) {$PI$\\$1.2+\dfrac{0.8}{s}$};
  \node[sum] (sum_u) at (5.15,0) {};
  \node[block] (act) at (6.55,0) {执行机构};
  \node[sum] (sum_l) at (8.45,0) {};
  \node[wideblock] (plant) at (10.45,0) {对象/负载\\$\dfrac{1}{0.35s+1}$};
  \node[tap] (ytap) at (11.95,0) {};
  \node[lab] (y) at (13.2,0) {转速};

  \node[block] (fr) at (3.35,1.85) {给定滤波\\$\dfrac{1}{0.12s+1}$};
  \node[block] (fd) at (6.65,1.85) {扰动前馈\\$\dfrac{0.8}{0.25s+1}$};
  \node[lab] (dlabel) at (8.45,3.0) {负载扰动};
  \coordinate (dtop) at (8.45,2.72);
  \node[tap] (dtap) at (8.45,1.85) {};

  \draw[wire] (r) -- (rtap);
  \draw[signal] (rtap) -- node[lab, above] {$+$} (sum_e);
  \draw[signal] (sum_e) -- (cpi);
  \draw[signal] (cpi) -- (sum_u);
  \draw[signal] (sum_u) -- (act);
  \draw[signal] (act) -- (sum_l);
  \draw[signal] (sum_l) -- (plant);
  \draw[wire] (plant) -- (ytap);
  \draw[signal] (ytap) -- (y);
  \draw[wire] (ytap) |- (1.9,-2.65);
  \draw[signal] (1.9,-2.65) -- node[neg, left, near end] {$-$} (sum_e.south);

  \draw[signal] (rtap) |- (fr);
  \draw[signal] (fr.east) -- (4.25,1.85) -- node[lab, near end, left] {$+$} (sum_u.north west);
  \draw[wire] (dtop) -- (dtap);
  \draw[signal] (dtap) -- node[lab, near end, right] {$-$} (sum_l.north);
  \draw[signal] (dtap) -- (fd.east);
  \draw[signal] (fd.west) -- (5.9,1.85) -- node[lab, near end, right] {$+$} (sum_u.north east);
\end{tikzpicture}
""",
}


def compile_tikz(name: str, body: str) -> None:
    tex_path = ROOT / f"{name}.tex"
    png_path = ROOT / f"{name}.png"
    tex_path.write_text(PREAMBLE + textwrap.dedent(body) + POSTAMBLE, encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix="t5_tikz_") as tmp:
      cmd = [
          "xelatex",
          "-interaction=nonstopmode",
          "-halt-on-error",
          f"-output-directory={tmp}",
          str(tex_path),
      ]
      subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
      pdf_path = Path(tmp) / f"{name}.pdf"
      subprocess.run(
          [
              "convert",
              "-density",
              "300",
              "-background",
              "white",
              "-flatten",
              "-alpha",
              "off",
              str(pdf_path),
              str(png_path),
          ],
          check=True,
          stdout=subprocess.PIPE,
          stderr=subprocess.PIPE,
          text=True,
      )


def main() -> None:
    for name, body in FIGURES.items():
        compile_tikz(name, body)
        print(ROOT / f"{name}.png")


if __name__ == "__main__":
    main()
