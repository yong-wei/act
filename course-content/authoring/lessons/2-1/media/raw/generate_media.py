from __future__ import annotations

import importlib.util
import math
from pathlib import Path
from textwrap import dedent

from PIL import Image, ImageDraw, ImageFont


def find_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / 'AGENTS.md').exists():
            return parent
    raise RuntimeError('Cannot locate repository root from generate_media.py')


ROOT = find_repo_root()
LESSON_DIR = ROOT / 'course-content/authoring/lessons/2-1'
RAW_DIR = LESSON_DIR / 'media/raw'
PROCESSED_DIR = LESSON_DIR / 'media/processed'
TIKZ_COMPILE = Path('/Users/YW/.cc-switch/skills/tikz-control-draw/scripts/compile_to_png.py')


def load_compiler():
    spec = importlib.util.spec_from_file_location('tikz_compile', TIKZ_COMPILE)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod.TikZCompiler()


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/Supplemental/Songti.ttc',
        '/System/Library/Fonts/Helvetica.ttc',
    ]
    index = 1 if bold else 0
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size, index=index)
        except Exception:
            continue
    return ImageFont.load_default()


def save_image(img: Image.Image, name: str) -> None:
    path = PROCESSED_DIR / name
    img.save(path)
    print(f'SAVED {path}')


def rounded_panel(draw: ImageDraw.ImageDraw, box, outline, width=4, fill='white', radius=28):
    draw.rounded_rectangle(box, radius=radius, outline=outline, width=width, fill=fill)


def wrap_text(draw, text, max_width, fnt):
    words = list(text)
    lines = []
    current = ''
    for ch in words:
        candidate = current + ch
        if draw.textlength(candidate, font=fnt) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    return lines


def render_cover():
    img = Image.new('RGB', (1600, 900), '#f6fbff')
    draw = ImageDraw.Draw(img)
    title_font = font(54, bold=True)
    sub_font = font(26)
    panel_title = font(28, bold=True)
    body_font = font(22)

    draw.rounded_rectangle((60, 40, 1540, 860), radius=38, outline='#7eb7e5', width=5, fill='#ffffff')
    draw.rounded_rectangle((95, 75, 1505, 165), radius=24, outline='#0d8fd8', width=0, fill='#0d8fd8')
    draw.text((800, 102), '2-1 讲义封面漫画', fill='white', font=title_font, anchor='mm')
    draw.text((800, 200), '从真实对象到统一分析对象', fill='#35516b', font=sub_font, anchor='mm')

    panels = [
        ((120, 255, 720, 525), '第一格', '真实系统先给你一条微分方程', '#f3fbff'),
        ((880, 255, 1480, 525), '第二格', '只盯着微分方程，连接一复杂就乱', '#fff8f1'),
        ((120, 585, 720, 835), '第三格', '拉氏变换把微分关系改写成统一对象', '#f5fff5'),
        ((880, 585, 1480, 835), '第四格', '传递函数加结构图，后续时域和频域都有起点', '#fff6fb'),
    ]

    for box, title, text, fill in panels:
        rounded_panel(draw, box, '#9fc0d8', width=3, fill=fill, radius=26)
        x1, y1, x2, y2 = box
        draw.text((x1 + 30, y1 + 28), title, fill='#0d8fd8', font=panel_title)
        lines = wrap_text(draw, text, x2 - x1 - 70, body_font)
        y = y1 + 95
        for line in lines:
            draw.text((x1 + 32, y), line, fill='#2a4258', font=body_font)
            y += 34

    # simple icons
    # Panel 1: equation + ship
    draw.line((220, 420, 420, 420), fill='#2a4258', width=4)
    draw.polygon([(450, 438), (565, 438), (615, 398), (488, 398)], outline='#0d8fd8', fill=None, width=4)
    draw.arc((500, 414, 620, 468), 180, 360, fill='#60a9d6', width=4)
    # Panel 2: tangled arrows
    draw.arc((1020, 342, 1180, 470), 10, 300, fill='#f28f3b', width=5)
    draw.arc((1120, 320, 1325, 500), 140, 430, fill='#e25d5d', width=5)
    draw.text((1180, 430), '?', fill='#e25d5d', font=font(58, bold=True), anchor='mm')
    # Panel 3: transform arrow
    draw.text((320, 730), '微分方程', fill='#2a4258', font=font(28, bold=True), anchor='mm')
    draw.line((410, 730, 515, 730), fill='#0d8fd8', width=6)
    draw.polygon([(515, 730), (485, 715), (485, 745)], fill='#0d8fd8')
    draw.text((625, 730), '传递函数', fill='#2a4258', font=font(28, bold=True), anchor='mm')
    # Panel 4: block diagram sketch
    draw.rectangle((1035, 710, 1120, 760), outline='#0d8fd8', width=4)
    draw.rectangle((1180, 710, 1265, 760), outline='#0d8fd8', width=4)
    draw.line((960, 735, 1035, 735), fill='#2a4258', width=4)
    draw.line((1120, 735, 1180, 735), fill='#2a4258', width=4)
    draw.line((1265, 735, 1340, 735), fill='#2a4258', width=4)
    draw.ellipse((920, 715, 960, 755), outline='#5cb85c', width=4)
    draw.line((938, 728, 954, 744), fill='#5cb85c', width=3)
    draw.line((954, 728, 938, 744), fill='#5cb85c', width=3)

    # arrows between panels
    arrows = [((735, 390), (860, 390)), ((1180, 540), (1180, 565)), ((865, 710), (735, 710))]
    for (x1, y1), (x2, y2) in arrows:
        draw.line((x1, y1, x2, y2), fill='#0d8fd8', width=5)
        ang = math.atan2(y2 - y1, x2 - x1)
        ahx = x2 - 18 * math.cos(ang - math.pi / 6)
        ahy = y2 - 18 * math.sin(ang - math.pi / 6)
        bhx = x2 - 18 * math.cos(ang + math.pi / 6)
        bhy = y2 - 18 * math.sin(ang + math.pi / 6)
        draw.polygon([(x2, y2), (ahx, ahy), (bhx, bhy)], fill='#0d8fd8')

    save_image(img, 'cover-comic.png')


def render_info():
    img = Image.new('RGB', (1400, 1100), '#ffffff')
    save_image(img, 'info.png')


def block_doc(body: str) -> str:
    return dedent(f"""
    \\documentclass[tikz,border=8pt]{{standalone}}
    \\usepackage{{amsmath}}
    \\usepackage{{CJKutf8}}
    \\usepackage{{tikz}}
    \\usetikzlibrary{{shapes,arrows,positioning,calc,fit}}
    \\input{{styles/block_styles}}
    \\begin{{document}}
    \\begin{{CJK*}}{{UTF8}}{{gbsn}}
    \\begin{{tikzpicture}}[auto, >=stealth]
    {body}
    \\end{{tikzpicture}}
    \\end{{CJK*}}
    \\end{{document}}
    """).strip() + '\n'


def sfg_doc(body: str) -> str:
    return dedent(f"""
    \\documentclass[tikz,border=8pt]{{standalone}}
    \\usepackage{{amsmath}}
    \\usepackage{{CJKutf8}}
    \\usepackage{{tikz}}
    \\definecolor{{labelcolor}}{{RGB}}{{0,0,0}}
    \\usetikzlibrary{{shapes,arrows,positioning,calc,fit}}
    \\input{{styles/signal_styles}}
    \\begin{{document}}
    \\begin{{CJK*}}{{UTF8}}{{gbsn}}
    \\begin{{tikzpicture}}[auto]
    {body}
    \\end{{tikzpicture}}
    \\end{{CJK*}}
    \\end{{document}}
    """).strip() + '\n'


def save_tikz_source(name: str, doc: str):
    path = RAW_DIR / f'{name}.tex'
    path.write_text(doc, encoding='utf-8')
    print(f'SAVED {path}')


def render_tikz(name: str, doc: str):
    save_tikz_source(name, doc)
    compiler = load_compiler()
    ok, msg = compiler.compile_tikz_to_png(doc, str(PROCESSED_DIR / f'{name}.png'), dpi=300)
    compiler.cleanup()
    if not ok:
        raise RuntimeError(msg)
    print(msg)


def make_block_diagrams():
    render_tikz('md-02-series-equivalent', block_doc(r"""
      \node (rin) at (0,1.0) {$R$};
      \node[block] (g1) at (1.6,1.0) {$G_1$};
      \node[block] (g2) at (3.0,1.0) {$G_2$};
      \node (yout) at (4.6,1.0) {$Y$};
      \draw[signal] (rin) -- (g1);
      \draw[signal] (g1) -- (g2);
      \draw[signal] (g2) -- (yout);
      \node at (5.6,1.0) {$\Longrightarrow$};
      \node (rin2) at (0,-0.6) {$R$};
      \node[block large] (geq) at (2.3,-0.6) {$G_1G_2$};
      \node (yout2) at (4.6,-0.6) {$Y$};
      \draw[signal] (rin2) -- (geq);
      \draw[signal] (geq) -- (yout2);
    """))

    render_tikz('md-03-parallel-equivalent', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[tap] (tap1) at (1.1,0) {};
      \node[sum] (sum2) at (4.8,0) {};
      \node (yout) at (6.1,0) {$Y$};
      \node[block] (g1) at (2.9,0.9) {$G_1$};
      \node[block] (g2) at (2.9,-0.9) {$G_2$};
      \draw[signal] (rin) -- (tap1);
      \draw[signal] (tap1) |- (g1);
      \draw[signal] (tap1) |- (g2);
      \draw[signal] (g1) -| (sum2);
      \draw[signal] (g2) -| (sum2);
      \draw[signal] (sum2) -- (yout);
      \node at (7.1,0) {$\Longrightarrow$};
      \node (rin2) at (0,-2.3) {$R$};
      \node[block large] (geq) at (2.4,-2.3) {$G_1+G_2$};
      \node (yout2) at (4.8,-2.3) {$Y$};
      \draw[signal] (rin2) -- (geq);
      \draw[signal] (geq) -- (yout2);
    """))

    render_tikz('md-04-feedback-equivalent', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large] (g) at (2.8,0) {$G$};
      \node[tap] (tap1) at (4.3,0) {};
      \node (yout) at (5.5,0) {$Y$};
      \node[block] (h) at (2.8,-1.5) {$H$};
      \draw[signal] (rin) -- (sum1) -- (g) -- (tap1) -- (yout);
      \draw[signal] (tap1) |- (h);
      \draw[signal] (h) -| node[neg sign, left] {$-$} (sum1.south);
      \node at (6.5,0) {$\Longrightarrow$};
      \node (rin2) at (0,-3.0) {$R$};
      \node[block large] (geq) at (2.7,-3.0) {$\dfrac{G}{1+GH}$};
      \node (yout2) at (5.5,-3.0) {$Y$};
      \draw[signal] (rin2) -- (geq);
      \draw[signal] (geq) -- (yout2);
    """))

    render_tikz('md-05-ship-heading-physical-blocks', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.4,0) {};
      \node[block large] (gc) at (3.2,0) {$G_c$};
      \node[block large] (ga) at (5.4,0) {$G_a$};
      \node[block large] (gp) at (7.8,0) {$G_p$};
      \node[tap] (tap1) at (9.3,0) {};
      \node (yout) at (10.7,0) {$Y$};
      \node[block large] (h) at (5.6,-2.2) {$H$};
      \draw[signal] (rin) -- (sum1) -- (gc) -- (ga) -- (gp) -- (tap1) -- (yout);
      \draw[signal] (tap1) |- (h);
      \draw[signal] (h) -| node[neg sign, left] {$-$} (sum1.south);
      \node[font=\scriptsize] at (3.2,-0.8) {航向控制器};
      \node[font=\scriptsize] at (5.4,-0.8) {舵机伺服};
      \node[font=\scriptsize] at (7.8,-0.8) {船体对象};
      \node[font=\scriptsize] at (5.6,-3.0) {罗经反馈};
    """))

    render_tikz('md-06-block-vs-sfg', dedent(r"""
    \documentclass[tikz,border=8pt]{standalone}
    \usepackage{amsmath}
    \usepackage{CJKutf8}
    \usepackage{tikz}
    \definecolor{labelcolor}{RGB}{0,0,0}
    \usetikzlibrary{shapes,arrows,positioning,calc,fit}
    \input{styles/block_styles}
    \input{styles/signal_styles}
    \begin{document}
    \begin{CJK*}{UTF8}{gbsn}
    \begin{tikzpicture}[auto, >=stealth]
      \begin{scope}[shift={(0,0)}]
        \node at (3.2,1.8) {\footnotesize 方框图};
        \node (rin) at (0,0) {$R$};
        \node[sum] (sum1) at (1.2,0) {};
        \node[block large] (g) at (3.0,0) {$G$};
        \node[tap] (tap1) at (4.6,0) {};
        \node (yout) at (6.0,0) {$Y$};
        \node[block] (h) at (3.0,-1.8) {$H$};
        \draw[signal] (rin) -- (sum1) -- (g) -- (tap1) -- (yout);
        \node[font=\scriptsize] at (2.05,0.35) {$E$};
        \draw[signal] (tap1) |- (h);
        \draw[signal] (h) -| node[neg sign, left] {$-$} (sum1.south);
      \end{scope}
      \draw[dashed, gray] (7.2,-2.4) -- (7.2,2.0);
      \begin{scope}[shift={(9.0,0)}]
        \node at (3.1,1.8) {\footnotesize 信号流图};
        \node[sfgsource] (r) at (0,0) {$R$};
        \node[sfgnode] (e) at (2.0,0) {$E$};
        \node[sfgnode] (y) at (4.2,0) {$Y$};
        \node[sfgsink] (out) at (6.4,0) {$Y_o$};
        \draw[sfgedge] (r) -- node[gain label above] {$1$} (e);
        \draw[sfgedge] (e) -- node[gain label above] {$G$} (y);
        \draw[sfgedge] (y) -- node[gain label above] {$1$} (out);
        \draw[sfgedge, out=-70, in=-110, looseness=1.05] (y) to node[gain label below] {$-H$} (e);
      \end{scope}
    \end{tikzpicture}
    \end{CJK*}
    \end{document}
    """).strip() + "\n")

    render_tikz('md-07-example-ship-loop', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large] (gc) at (2.5,0) {$K_c$};
      \node[block large] (ga) at (4.6,0) {$\dfrac{1}{T_a s+1}$};
      \node[block large] (gp) at (7.1,0) {$\dfrac{K_p}{s(T_p s+1)}$};
      \node[tap] (tap1) at (8.8,0) {};
      \node (yout) at (10.0,0) {$Y$};
      \node[block large] (h) at (5.1,-2.0) {$K_h$};
      \draw[signal] (rin) -- (sum1) -- (gc) -- (ga) -- (gp) -- (tap1) -- (yout);
      \draw[signal] (tap1) |- (h);
      \draw[signal] (h) -| node[neg sign, left] {$-$} (sum1.south);
      \node[font=\scriptsize] at (0.5,0.35) {$R$};
      \node[font=\scriptsize] at (1.65,0.35) {$E$};
      \node[font=\scriptsize] at (3.55,0.35) {$U$};
      \node[font=\scriptsize] at (5.95,0.35) {$\delta$};
      \node[font=\scriptsize] at (9.35,0.35) {$Y$};
      \node[font=\scriptsize] at (2.2,-1.25) {$B$};
    """))

    render_tikz('md-09-example2-original', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large] (g1) at (2.6,0) {$G_1$};
      \node[tap] (tap1) at (4.0,0) {};
      \node[sum] (sum2) at (5.1,1.6) {};
      \node[block large] (g2) at (6.9,1.6) {$G_2$};
      \node[tap] (tap2) at (8.3,1.6) {};
      \node[block large] (g3) at (6.9,-1.8) {$G_3$};
      \node[sum] (sum3) at (10.0,0) {};
      \node[tap] (tap3) at (11.3,0) {};
      \node (yout) at (12.5,0) {$Y$};
      \node[block] (h1) at (6.9,0.0) {$H_1$};
      \node[block] (h2) at (6.4,-3.6) {$H_2$};
      \draw[signal] (rin) -- (sum1) -- (g1) -- (tap1);
      \draw[signal] (tap1) |- (sum2);
      \draw[signal] (sum2) -- (g2) -- (tap2) -| (sum3);
      \draw[signal] (tap1) |- (g3);
      \draw[signal] (g3) -| (sum3);
      \draw[signal] (sum3) -- (tap3) -- (yout);
      \draw[signal] (tap2) |- (h1);
      \draw[signal] (h1) -| node[neg sign, right] {$-$} (sum2.south);
      \draw[signal] (tap3) |- (h2);
      \draw[signal] (h2) -| node[neg sign, left] {$-$} (sum1.south);
    """))

    render_tikz('md-10-example2-step1', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large] (g1) at (2.6,0) {$G_1$};
      \node[tap] (tap1) at (4.0,0) {};
      \node[block large] (gu) at (6.9,1.3) {$\dfrac{G_2}{1+G_2H_1}$};
      \node[block large] (g3) at (6.9,-1.5) {$G_3$};
      \node[sum] (sum3) at (9.8,0) {};
      \node[tap] (tap3) at (11.0,0) {};
      \node (yout) at (12.2,0) {$Y$};
      \node[block] (h2) at (6.3,-3.3) {$H_2$};
      \draw[signal] (rin) -- (sum1) -- (g1) -- (tap1);
      \draw[signal] (tap1) |- (gu);
      \draw[signal] (tap1) |- (g3);
      \draw[signal] (gu) -| (sum3);
      \draw[signal] (g3) -| (sum3);
      \draw[signal] (sum3) -- (tap3) -- (yout);
      \draw[signal] (tap3) |- (h2);
      \draw[signal] (h2) -| node[neg sign, left] {$-$} (sum1.south);
    """))

    render_tikz('md-11-example2-step2', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large] (g1) at (2.5,0) {$G_1$};
      \node[block large, minimum width=3.0cm] (gp) at (5.4,0)
      {\(\scriptstyle \frac{G_2}{1+G_2H_1}+G_3\)};
      \node[tap] (tap3) at (7.1,0) {};
      \node (yout) at (8.2,0) {$Y$};
      \node[block] (h2) at (5.0,-2.4) {$H_2$};
      \draw[signal] (rin) -- (sum1) -- (g1) -- (gp) -- (tap3) -- (yout);
      \draw[signal] (tap3) |- (h2);
      \draw[signal] (h2) -| node[neg sign, left] {$-$} (sum1.south);
    """))

    render_tikz('md-12-example2-step3', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large, minimum width=3.9cm] (g) at (3.6,0)
      {\(\scriptstyle G_1\left[\frac{G_2}{1+G_2H_1}+G_3\right]\)};
      \node[tap] (tap3) at (5.9,0) {};
      \node (yout) at (7.0,0) {$Y$};
      \node[block] (h2) at (4.0,-2.2) {$H_2$};
      \draw[signal] (rin) -- (sum1) -- (g) -- (tap3) -- (yout);
      \draw[signal] (tap3) |- (h2);
      \draw[signal] (h2) -| node[neg sign, left] {$-$} (sum1.south);
    """))

    # Simple line diagram for example1 SFG
    render_tikz('md-08-example-ship-sfg', sfg_doc(r"""
      \node[sfgsource] (r) at (0,0) {$R$};
      \node[sfgnode] (e) at (1.8,0) {$E$};
      \node[sfgnode] (u) at (3.7,0) {$U$};
      \node[sfgnode] (d) at (5.8,0) {$\delta$};
      \node[sfgnode] (y) at (8.1,0) {$Y$};
      \node[sfgnode] (b) at (4.8,-1.8) {$B$};
      \node[sfgsink] (out) at (10.2,0) {$Y_o$};
      \draw[sfgedge] (r) -- node[gain label above] {$1$} (e);
      \draw[sfgedge] (e) -- node[gain label above] {$K_c$} (u);
      \draw[sfgedge] (u) -- node[gain label above] {$\frac{1}{T_as+1}$} (d);
      \draw[sfgedge] (d) -- node[gain label above] {$\frac{K_p}{s(T_ps+1)}$} (y);
      \draw[sfgedge] (y) -- node[gain label above] {$1$} (out);
      \draw[sfgedge, out=-95, in=0, looseness=1.15] (y) to node[gain label below] {$K_h$} (b);
      \draw[sfgedge, out=180, in=-95, looseness=1.1] (b) to node[gain label below] {$-1$} (e);
    """))

    render_tikz('md-13-example2-labeled-block', block_doc(r"""
      \node (rin) at (0,0) {$R$};
      \node[sum] (sum1) at (1.0,0) {};
      \node[block large] (g1) at (2.6,0) {$G_1$};
      \node[tap] (tap1) at (4.0,0) {};
      \node[sum] (sum2) at (5.1,1.6) {};
      \node[block large] (g2) at (6.9,1.6) {$G_2$};
      \node[tap] (tap2) at (8.6,1.6) {};
      \node[block large] (g3) at (6.9,-1.8) {$G_3$};
      \node[sum] (sum3) at (10.3,0) {};
      \node[tap] (tap3) at (11.6,0) {};
      \node (yout) at (12.9,0) {$Y_o$};
      \node[block] (h1) at (6.9,0.0) {$H_1$};
      \node[block] (h2) at (6.6,-3.7) {$H_2$};
      \draw[signal] (rin) -- (sum1) -- (g1) -- (tap1);
      \draw[signal] (tap1) |- (sum2);
      \draw[signal] (sum2) -- (g2) -- (tap2) -| (sum3);
      \draw[signal] (tap1) |- (g3);
      \draw[signal] (g3) -| (sum3);
      \draw[signal] (sum3) -- (tap3) -- (yout);
      \draw[signal] (tap2) |- (h1);
      \draw[signal] (h1) -| node[neg sign, right] {$-$} (sum2.south);
      \draw[signal] (tap3) |- (h2);
      \draw[signal] (h2) -| node[neg sign, left] {$-$} (sum1.south);
      \node[font=\scriptsize] at (0.4,0.35) {$R$};
      \node[font=\scriptsize] at (1.75,0.35) {$E$};
      \node[font=\scriptsize] at (4.2,0.35) {$A$};
      \node[font=\scriptsize] at (5.8,2.0) {$U$};
      \node[font=\scriptsize] at (8.1,2.0) {$B$};
      \node[font=\scriptsize] at (8.0,-1.35) {$C$};
      \node[font=\scriptsize] at (10.9,0.35) {$Y$};
    """))

    render_tikz('md-14-example2-sfg', sfg_doc(r"""
      \node[sfgsource] (r) at (0,0) {$R$};
      \node[sfgnode] (e) at (1.8,0) {$E$};
      \node[sfgnode] (a) at (3.8,0) {$A$};
      \node[sfgnode] (u) at (5.6,1.3) {$U$};
      \node[sfgnode] (b) at (8.2,1.3) {$B$};
      \node[sfgnode] (c) at (7.0,-1.4) {$C$};
      \node[sfgnode] (y) at (10.2,0) {$Y$};
      \node[sfgsink] (out) at (12.2,0) {$Y_o$};
      \draw[sfgedge] (r) -- node[gain label above] {$1$} (e);
      \draw[sfgedge] (e) -- node[gain label above] {$G_1$} (a);
      \draw[sfgedge] (a) -- node[gain label above] {$1$} (u);
      \draw[sfgedge] (u) -- node[gain label above] {$G_2$} (b);
      \draw[sfgedge] (a) -- node[gain label below] {$G_3$} (c);
      \draw[sfgedge] (b) -- node[gain label above] {$1$} (y);
      \draw[sfgedge] (c) -- node[gain label below] {$1$} (y);
      \draw[sfgedge] (y) -- node[gain label above] {$1$} (out);
      \draw[sfgedge, bend left=28] (b) to node[gain label below] {$-H_1$} (u);
      \draw[sfgedge, out=-90, in=-90, looseness=1.25] (y) to node[gain label below] {$-H_2$} (e);
    """))


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    render_info()
    make_block_diagrams()


if __name__ == '__main__':
    main()
