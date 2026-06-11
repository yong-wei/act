from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import os


def load_module():
    module_path = Path(__file__).resolve().parents[2] / '.agents' / 'skills' / 'lesson' / 'scripts' / 'export_handout_pdf.py'
    spec = importlib.util.spec_from_file_location('export_handout_pdf', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


exporter = load_module()


def test_preprocess_markdown_applies_full_width_defaults_and_drops_duplicate_figure_titles():
    markdown = """![封面漫画：从真实对象到统一分析对象](../media/processed/2-1-cover-comic.png){fig-pos="H"}

图1. 单元 2-1 封面漫画：从真实对象到统一分析对象。

![串联连接的方框图与等效化简结果](../media/processed/2-1-md-02-series-equivalent.png){width=40%}

图2. 串联连接的方框图与等效化简结果。

![本讲信息图总结](../media/processed/2-1-info.png)

图9. 单元 2-1 信息图总结。
"""

    normalized = exporter.preprocess_markdown_for_pdf(markdown)

    assert '图1.' not in normalized
    assert '图2.' not in normalized
    assert '图9.' not in normalized
    assert '2-1-cover-comic.png){fig-pos="H" width=100%}' in normalized
    assert '2-1-md-02-series-equivalent.png){width=40%}' in normalized
    assert '2-1-info.png){width=100%}' in normalized


def test_preprocess_markdown_drops_duplicate_figure_titles_with_space_after_tu():
    markdown = """![方波谐波分解与系统滤波后重构效果示意图](../media/processed/2-3-fr-02-square-wave-harmonics.svg){width=100%}

图 3. 方波谐波分解与系统滤波后重构效果示意
"""

    normalized = exporter.preprocess_markdown_for_pdf(markdown)

    assert '图 3.' not in normalized
    assert '2-3-fr-02-square-wave-harmonics.svg){width=100%}' in normalized


def test_preprocess_markdown_converts_paired_ascii_quotes_to_cn_quotes_but_skips_protected_segments():
    markdown = """普通正文里的"对象构建课"应转成中文双引号。

行内代码 `print("hello")` 不应被改写。

行内公式 $H(s) = "quoted"$ 不应被改写。

```python
print("hello")
```

![封面漫画：从真实对象到统一分析对象](../media/processed/2-1-cover-comic.png){fig-pos="H"}
"""

    normalized = exporter.preprocess_markdown_for_pdf(markdown)

    assert '普通正文里的“对象构建课”应转成中文双引号。' in normalized
    assert '`print("hello")`' in normalized
    assert '$H(s) = "quoted"$' in normalized
    assert 'print("hello")' in normalized
    assert 'fig-pos="H" width=100%' in normalized


def test_preprocess_markdown_converts_inline_tex_code_spans_to_math():
    markdown = """若要求 `\\(M_p \\le 20\\%\\)`，则希望 `\\(t_s \\approx 40\\,\\text{s}\\)`。

表中读数包括 `1.96\\times10^{-4}`、`0.18\\ \\text{rad/s}` 和 `49^\\circ`。

普通代码 `print("hello")` 不应被改写。
"""

    normalized = exporter.preprocess_markdown_for_pdf(markdown)

    assert '`\\(M_p \\le 20\\%\\)`' not in normalized
    assert '`\\(t_s \\approx 40\\,\\text{s}\\)`' not in normalized
    assert '$M_p \\le 20\\%$' in normalized
    assert '$t_s \\approx 40\\,\\text{s}$' in normalized
    assert '$1.96\\times10^{-4}$' in normalized
    assert '$0.18\\ \\text{rad/s}$' in normalized
    assert '$49^\\circ$' in normalized
    assert '`print("hello")`' in normalized


def test_preprocess_markdown_applies_hidden_pdf_table_cols_comment_to_next_manual_caption():
    markdown = """<!-- pdf-table-cols: 0.14, 0.38, 0.28, 0.20 -->
表 2. 复合结构的常见写法与适用情形

| 形式 | 一般表达式 | 更适合解决的问题 | 结构分工 |
| --- | --- | --- | --- |
| A | B | C | D |
"""

    normalized = exporter.preprocess_markdown_for_pdf(markdown)

    assert '<!-- pdf-table-cols:' not in normalized
    assert '表 2. 复合结构的常见写法与适用情形 {cols=0.14, 0.38, 0.28, 0.20}' in normalized


def test_normalize_ascii_quotes_for_markdown_prose_reports_unmatched_quotes():
    markdown = '这一句有"未闭合引号。\n下一句有"一对"引号。\n'

    normalized, odd_lines = exporter.normalize_ascii_quotes_for_markdown_prose(markdown)

    assert '这一句有"未闭合引号。' in normalized
    assert '下一句有“一对”引号。' in normalized
    assert odd_lines == [1]


def test_rewrite_includegraphics_options_keeps_requested_width_without_textheight_distortion():
    tex = r"""
\setkeys{Gin}{width=\maxwidth,height=\maxheight,keepaspectratio}
\begin{figure}
\centering
\includegraphics[width=1\textwidth,height=\textheight]{../media/processed/2-1-cover-comic.png}
\caption{封面漫画：从真实对象到统一分析对象}
\end{figure}
\begin{figure}
\centering
\includegraphics[width=0.4\textwidth,height=\textheight]{../media/processed/2-1-md-02-series-equivalent.png}
\caption{串联连接的方框图与等效化简结果}
\end{figure}
"""

    rewritten = exporter.rewrite_latex_for_pdf_layout(tex)

    assert r'\setkeys{Gin}{width=\maxwidth,height=\maxheight,keepaspectratio}' not in rewritten
    assert r'\includegraphics[width=\textwidth]{../media/processed/2-1-cover-comic.png}' in rewritten
    assert r'\includegraphics[width=0.4\textwidth]{../media/processed/2-1-md-02-series-equivalent.png}' in rewritten
    assert r'height=\textheight' not in rewritten


def test_handout_style_template_redefines_blockquote_as_tinted_callout():
    template_path = Path(__file__).resolve().parents[2] / '.agents' / 'skills' / 'lesson' / 'templates' / 'handout-pdf-style.tex.tpl'
    template = template_path.read_text(encoding='utf-8')

    assert '\\usepackage[most]{tcolorbox}' in template
    assert '\\renewenvironment{quote}' in template
    assert 'colback=TitleBlue!6!white' in template


def test_handout_style_template_uses_unit_prefixed_numbering_and_body_sized_code():
    template_path = Path(__file__).resolve().parents[2] / '.agents' / 'skills' / 'lesson' / 'templates' / 'handout-pdf-style.tex.tpl'
    template = template_path.read_text(encoding='utf-8')

    assert r'\renewcommand{\thefigure}{__LESSON_ID__-\arabic{figure}}' in template
    assert r'\renewcommand{\thetable}{__LESSON_ID__-\arabic{table}}' in template
    assert r'\renewcommand{\theequation}{__LESSON_ID__-\arabic{equation}}' in template
    assert r'fontsize=\normalsize' in template
    assert r'fontsize=\small' not in template
    assert r'\setlist[itemize]' in template
    assert 'leftmargin=2.4em' in template


def test_build_latex_disables_pandoc_smart_quotes(monkeypatch, tmp_path):
    markdown_path = tmp_path / 'sample.md'
    style_path = tmp_path / 'style.tex'
    output_tex = tmp_path / 'sample.tex'
    markdown_path.write_text('微分方程擅长描述"系统如何运动"。\n', encoding='utf-8')
    style_path.write_text('% style\n', encoding='utf-8')

    captured = {}

    def fake_run(cmd, cwd, check):
        captured['cmd'] = cmd
        captured['cwd'] = cwd
        captured['check'] = check
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(exporter, 'require_binary', lambda name: f'/usr/bin/{name}')
    monkeypatch.setattr(exporter.subprocess, 'run', fake_run)

    exporter.build_latex(markdown_path, style_path, output_tex)

    from_index = captured['cmd'].index('--from') + 1
    assert captured['cmd'][from_index] == 'markdown-smart+raw_tex+tex_math_dollars+pipe_tables'


def test_normalize_ascii_quotes_for_latex_rewrites_prose_but_skips_verbatim():
    tex = r"""
正文里的"对象构建课"需要保留普通双引号。
\begin{Verbatim}
print("hello")
\end{Verbatim}
\caption{微分方程擅长描述"系统如何运动"}
"""

    normalized = exporter.normalize_ascii_quotes_for_latex(tex)

    assert '正文里的\\textquotedbl{}对象构建课\\textquotedbl{}需要保留普通双引号。' in normalized
    assert '\\caption{微分方程擅长描述\\textquotedbl{}系统如何运动\\textquotedbl{}}' in normalized
    assert 'print("hello")' in normalized


def test_rewrite_svg_includes_to_pdf_regenerates_stale_pdf(monkeypatch, tmp_path):
    tex_path = tmp_path / 'sample.tex'
    svg_path = tmp_path / 'figure.svg'
    pdf_path = tmp_path / 'figure.pdf'
    tex_path.write_text(r'\includesvg{figure.svg}', encoding='utf-8')
    svg_path.write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>', encoding='utf-8')
    pdf_path.write_text('stale', encoding='utf-8')

    stale_time = 1_700_000_000
    fresh_time = stale_time + 60
    os.utime(pdf_path, (stale_time, stale_time))
    os.utime(svg_path, (fresh_time, fresh_time))

    calls = []

    def fake_run(cmd, check, cwd):
        calls.append((cmd, cwd))
        pdf_path.write_text('fresh', encoding='utf-8')
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(exporter, 'require_binary', lambda name: f'/usr/bin/{name}')
    monkeypatch.setattr(exporter.subprocess, 'run', fake_run)

    exporter.rewrite_svg_includes_to_pdf(tex_path)

    assert len(calls) == 1
    assert calls[0][0][:4] == ['/usr/bin/rsvg-convert', '-f', 'pdf', '-o']
    assert pdf_path.read_text(encoding='utf-8') == 'fresh'
    assert tex_path.read_text(encoding='utf-8') == r'\includegraphics{figure.pdf}'


def test_collect_markdown_width_overrides_maps_percent_widths_to_textwidth():
    markdown = """![图A](../media/processed/fig-a.svg){width=100%}
![图B](../media/processed/fig-b.png){width=40%}
![图C](../media/processed/fig-c.pdf){width=1.5in}
"""

    overrides = exporter.collect_markdown_width_overrides(markdown)

    assert overrides['../media/processed/fig-a.svg'] == r'width=\textwidth'
    assert overrides['../media/processed/fig-b.png'] == r'width=0.4\textwidth'
    assert overrides['../media/processed/fig-c.pdf'] == 'width=1.5in'


def test_rewrite_latex_for_pdf_layout_applies_markdown_width_override_when_pandoc_drops_it():
    tex = r"""
\begin{figure}
\centering
\includegraphics{../media/processed/fig-a.pdf}
\caption{示意图}
\end{figure}
"""

    rewritten = exporter.rewrite_latex_for_pdf_layout(
        tex,
        width_overrides={'../media/processed/fig-a.pdf': r'width=\textwidth'},
    )

    assert r'\includegraphics[width=\textwidth]{../media/processed/fig-a.pdf}' in rewritten


def test_rewrite_latex_for_pdf_layout_forces_figures_to_use_H_placement():
    tex = r"""
\begin{figure}
\centering
\includegraphics{../media/processed/fig-a.pdf}
\caption{示意图A}
\end{figure}
\begin{figure}[htbp]
\centering
\includegraphics{../media/processed/fig-b.pdf}
\caption{示意图B}
\end{figure}
"""

    rewritten = exporter.rewrite_latex_for_pdf_layout(tex)

    assert r'\begin{figure}[H]' in rewritten
    assert r'\begin{figure}[htbp]' not in rewritten


def test_number_display_equations_converts_pandoc_display_math_but_skips_code():
    tex = r"""
\[
G(s)=\frac{1}{s+1}
\]
\begin{Verbatim}
\[
not math
\]
\end{Verbatim}
"""

    rewritten = exporter.number_display_equations(tex)

    assert r'\begin{equation}' in rewritten
    assert r'\end{equation}' in rewritten
    assert r'\begin{Verbatim}' in rewritten
    assert 'not math' in rewritten


def test_tikz_rewrite_embeds_source_without_resizebox_and_normalizes_font_size(tmp_path):
    design_dir = tmp_path / 'lessons' / '1-1' / 'design'
    processed_dir = tmp_path / 'lessons' / '1-1' / 'media' / 'processed'
    raw_tikz_dir = tmp_path / 'lessons' / '1-1' / 'media' / 'raw' / 'tikz'
    design_dir.mkdir(parents=True)
    processed_dir.mkdir(parents=True)
    raw_tikz_dir.mkdir(parents=True)
    (processed_dir / '1-1-block.png').write_bytes(b'placeholder')
    (raw_tikz_dir / '1-1-block.tex').write_text(
        r"""
\documentclass{standalone}
\begin{document}
\begin{tikzpicture}[auto]
\tikzset{
  block/.style={rectangle, draw, font=\footnotesize\bfseries},
  label/.style={font=\scriptsize, fill=none}
}
\node[block] {控制器};
\end{tikzpicture}
\end{document}
""",
        encoding='utf-8',
    )
    tex_path = design_dir / 'sample.tex'
    tex_path.write_text(
        r'\includegraphics[width=0.75\linewidth]{../media/processed/1-1-block.png}',
        encoding='utf-8',
    )

    fragment_dir = exporter.rewrite_tikz_png_includes(tex_path)
    rewritten = tex_path.read_text(encoding='utf-8')
    fragment = (fragment_dir / '1-1-block.tikz').read_text(encoding='utf-8')

    assert r'\resizebox' not in rewritten
    assert r'\input{.sample-tikz-fragments/1-1-block.tikz}' in rewritten
    assert r'font=\footnotesize' not in fragment
    assert r'font=\scriptsize' not in fragment
    assert r'font=\bfseries' in fragment


def test_rewrite_image_includes_prefers_same_stem_vector_pdf(tmp_path):
    tex_path = tmp_path / 'sample.tex'
    image_path = tmp_path / 'media' / 'processed' / 'figure.png'
    vector_path = tmp_path / 'media' / 'processed' / 'figure.pdf'
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b'png')
    vector_path.write_bytes(b'%PDF')
    tex_path.write_text(
        r'\includegraphics[width=0.8\linewidth]{media/processed/figure.png}',
        encoding='utf-8',
    )

    exporter.rewrite_image_includes_to_vector_pdf_when_available(tex_path)

    assert tex_path.read_text(encoding='utf-8') == (
        r'\includegraphics[width=0.8\linewidth]{media/processed/figure.pdf}'
    )


def test_handout_style_template_uses_publication_font_stack():
    template_path = Path(__file__).resolve().parents[2] / '.agents' / 'skills' / 'lesson' / 'templates' / 'handout-pdf-style.tex.tpl'
    template = template_path.read_text(encoding='utf-8')

    assert r'\usepackage{unicode-math}' in template
    assert 'texgyretermes-regular.otf' in template
    assert r'\setmathfont{texgyretermes-math.otf}' in template
    assert r'\setCJKmainfont{Songti SC}' in template
    assert r'\setCJKmonofont{Noto Sans CJK SC}[Scale=0.88]' in template


def test_align_matlab_comment_columns_in_fenced_blocks():
    markdown = """```matlab
G = tf(1, [1 2 0]); % 建立对象
step(G); % 观察响应
% section comment stays
```
"""

    normalized = exporter.align_matlab_comment_columns(markdown)
    lines = normalized.splitlines()

    assert lines[1].find('%') == lines[2].find('%')
    assert lines[3].startswith('% section')


def test_align_matlab_comment_columns_ignores_percent_inside_strings():
    markdown = """```octave
fprintf("value %.2f%%", ratio);
G = tf(1, [1 2 0]); % 建立对象
step(G);             % 观察响应
```
"""

    normalized = exporter.align_matlab_comment_columns(markdown)
    lines = normalized.splitlines()

    assert '%.2f%%' in lines[1]
    assert lines[2].find('%') == lines[3].find('%')


def test_single_panel_analysis_figures_are_capped_to_sixty_percent_width():
    tex = r'\includegraphics[width=0.8\linewidth,keepaspectratio]{../media/processed/1-1-example-openloop-step.pdf}'

    rewritten = exporter.rewrite_latex_for_pdf_layout(tex)

    assert r'width=0.6\textwidth' in rewritten


def test_bode_analysis_figures_keep_full_width_as_two_panel_figures():
    tex = r'\includegraphics[width=0.8\linewidth,keepaspectratio]{../media/processed/1-1-bode-example.pdf}'

    rewritten = exporter.rewrite_latex_for_pdf_layout(tex)

    assert r'width=0.6\textwidth' not in rewritten
    assert r'width=0.8\linewidth' in rewritten
