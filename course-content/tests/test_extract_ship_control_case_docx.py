from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DOCX = ROOT / 'course-content' / 'questions' / 'source' / '船舶控制案例20240116.docx'
SCRIPT = ROOT / 'course-content' / 'resource-library' / 'scripts' / 'extract_ship_control_case_docx.py'


def load_script_module():
    spec = importlib.util.spec_from_file_location('extract_ship_control_case_docx', SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_normalize_equation_tags_rewrites_word_equation_numbers() -> None:
    module = load_script_module()
    source = '\n'.join(
        [
            '$$\\begin{array}{r}',
            'm\\dot{x} + cx = f(t)\\#(2.1.1)',
            '\\end{array}$$',
        ]
    )

    normalized = module.normalize_equation_tags(source)

    assert '#(2.1.1)' not in normalized
    assert '\\tag{2.1.1}' in normalized
    assert 'm\\dot{x} + cx = f(t)' in normalized


def test_rewrite_section_media_relabels_img_blocks_and_records_mapping() -> None:
    module = load_script_module()
    source = '\n'.join(
        [
            '引导段落',
            '',
            '<img src="tmp/ship-case-preview/media/media/image3.png" style="width:5.7in;height:1.5in" />',
            '',
            '图2.1.3 船舶航行控制系统原理图',
            '',
            '后续段落',
        ]
    )

    rewritten, mappings = module.rewrite_section_media(
        source,
        section_slug='2.1-船舶航向控制建模实例',
        image_prefix='../assets/processed',
    )

    assert '<img' not in rewritten
    assert '![图2.1.3 船舶航行控制系统原理图](../assets/processed/2.1-船舶航向控制建模实例-figure-01.png)' in rewritten
    assert mappings == [
        {
            'raw_name': 'image3.png',
            'processed_name': '2.1-船舶航向控制建模实例-figure-01.png',
            'caption': '图2.1.3 船舶航行控制系统原理图',
        }
    ]


def test_extract_ship_control_case_docx_generates_resource_package(tmp_path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            '--source',
            str(SOURCE_DOCX),
            '--output-dir',
            str(tmp_path / 'ship-control-cases'),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr or result.stdout

    package_dir = tmp_path / 'ship-control-cases'
    assert (package_dir / 'README.md').exists()
    assert (package_dir / 'extracted.md').exists()
    assert (package_dir / 'indexes' / 'raw-paragraphs.md').exists()
    assert (package_dir / 'indexes' / 'media-map.md').exists()
    assert (package_dir / 'indexes' / 'section-map.md').exists()

    section_file = package_dir / 'sections' / '2.1-船舶航向控制建模实例.md'
    assert section_file.exists()

    section_markdown = section_file.read_text(encoding='utf-8')
    assert '\\tag{2.1.1}' in section_markdown
    assert '../assets/processed/2.1-船舶航向控制建模实例-figure-01.png' in section_markdown
    assert '<img' not in section_markdown

    readme = (package_dir / 'README.md').read_text(encoding='utf-8')
    assert '船舶教学案例汇编' in readme
    assert '提取章节数：21' in readme

    processed_images = list((package_dir / 'assets' / 'processed').glob('*'))
    assert len(processed_images) >= 90
    assert {path.suffix.lower() for path in processed_images} == {'.png'}

    all_sections_text = '\n'.join(path.read_text(encoding='utf-8') for path in (package_dir / 'sections').glob('*.md'))
    assert '<img' not in all_sections_text
    assert '.emf' not in all_sections_text
