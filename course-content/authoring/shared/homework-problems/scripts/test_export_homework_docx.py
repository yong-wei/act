#!/usr/bin/env python3
from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from docx import Document

import export_homework_docx


class ExportHomeworkDocxTest(unittest.TestCase):
    def test_pandoc_export_converts_tables_and_math(self) -> None:
        if shutil.which('pandoc') is None:
            self.skipTest('pandoc is not installed')

        markdown = """# 测试

$$
G(s)=\\frac{1}{s+1}.
$$

| 项目 | 值 |
|---|---:|
| 增益 | $K_p=1$ |
"""

        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            output_path = tmp_path / 'sample.docx'
            export_homework_docx.render_markdown(markdown, output_path, tmp_path)

            doc = Document(str(output_path))
            self.assertGreaterEqual(len(doc.tables), 1)

            with ZipFile(output_path) as archive:
                xml = archive.read('word/document.xml').decode('utf-8')

            self.assertIn('<m:oMath', xml)
            self.assertNotIn('\\frac', xml)


if __name__ == '__main__':
    unittest.main()
