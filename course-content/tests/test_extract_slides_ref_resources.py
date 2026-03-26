from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path


def load_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'extract_slides_ref_resources.py'
    spec = importlib.util.spec_from_file_location('extract_slides_ref_resources', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


extractor = load_module()


def test_extract_tex_document_preserves_structure_and_tikz_blocks():
    tex_source = r"""
\title[自动控制原理]{自动控制原理}
\subtitle{第二章~~控制系统的数学模型}
\section{引言}
\subsection{建模方法}
\begin{frame}{建模方法}
\begin{block}{机理建模}
根据物理定律建立微分方程。
\end{block}
\begin{tikzpicture}
\draw (0,0) -- (1,1);
\end{tikzpicture}
\end{frame}
"""

    markdown = extractor.extract_tex_document(tex_source, 'sample.tex')

    assert '# sample' in markdown
    assert '自动控制原理' in markdown
    assert '第二章 控制系统的数学模型' in markdown
    assert '## 引言' in markdown
    assert '### 建模方法' in markdown
    assert '#### 幻灯片：建模方法' in markdown
    assert '根据物理定律建立微分方程。' in markdown
    assert '```tex' in markdown
    assert '\\begin{tikzpicture}' in markdown


def test_build_pdf_markdown_formats_page_sections():
    markdown = extractor.build_pdf_markdown(
        source_name='sample.pdf',
        page_texts=['第一页 标题\n正文', '第二页 公式 G(s)=1/(Ts+1)'],
    )

    assert '# sample' in markdown
    assert '- 来源文件：`sample.pdf`' in markdown
    assert '- 页数：2' in markdown
    assert '## 第 1 页' in markdown
    assert '第一页 标题' in markdown
    assert '## 第 2 页' in markdown
    assert 'G(s)=1/(Ts+1)' in markdown


def test_extract_tex_document_cleans_layout_commands_and_preserves_display_math():
    tex_source = r"""
\title{演示课件}
\begin{frame}{\example{RC 电路}{ex:rc}}
\begin{columns}[T]
\column{.5\textwidth}
\begin{block}{结论~~~~\tikz{\draw (0,0)--(1,0);}}
稳态输出可由频率特性直接读取。
\end{block}
$$G(j\omega)=\frac{1}{1+j\omega T}$$
\end{columns}
\end{frame}
"""

    markdown = extractor.extract_tex_document(tex_source, 'layout.tex')

    assert '#### 幻灯片：RC 电路' in markdown
    assert '稳态输出可由频率特性直接读取。' in markdown
    assert 'columns' not in markdown
    assert '.5\\textwidth' not in markdown
    assert '```tex' in markdown
    assert 'G(j\\omega)=\\frac{1}{1+j\\omega T}' in markdown


def test_run_exports_tex_pdf_and_indexes():
    with tempfile.TemporaryDirectory() as temp_dir:
        root = Path(temp_dir)
        slides_root = root / 'slides-ref'
        slides_root.mkdir()

        tex_path = slides_root / 'Demo.tex'
        tex_path.write_text(
            r"""
\title{演示课件}
\section{总览}
\begin{frame}{第一页}
正文内容
\end{frame}
""".strip()
            + '\n',
            encoding='utf-8',
        )

        pdf_markdown_path = slides_root / '讲义.pdf.md'
        pdf_markdown_path.write_text('# 假 PDF 抽取\n', encoding='utf-8')

        output_root = slides_root / 'resource-library'
        extractor.run_export(slides_root=slides_root, output_root=output_root)

        tex_output = output_root / 'tex' / 'Demo.md'
        pdf_output = output_root / 'pdf' / '讲义.pdf.md'
        index_output = output_root / 'index.md'
        manifest_output = output_root / 'manifest.json'

        assert tex_output.exists()
        assert pdf_output.exists()
        assert index_output.exists()
        assert manifest_output.exists()

        manifest = json.loads(manifest_output.read_text(encoding='utf-8'))
        assert manifest['counts']['tex'] == 1
        assert manifest['counts']['pdf'] == 1
        assert manifest['outputs']['tex'][0]['source'] == 'Demo.tex'
        assert manifest['outputs']['pdf'][0]['source'] == '讲义.pdf.md'
