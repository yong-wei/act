from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path


def load_export_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'export_textbook_resources.py'
    spec = importlib.util.spec_from_file_location('export_textbook_resources', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


export_textbook_resources = load_export_module()


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def read_jsonl(path: Path) -> list[dict]:
    return [
        json.loads(line)
        for line in path.read_text(encoding='utf-8').splitlines()
        if line.strip()
    ]


def create_textbook_fixture(root: Path) -> tuple[Path, Path]:
    authoring_root = root / 'authoring' / 'resources' / 'textbooks'
    runtime_root = root / 'runtime' / 'resources' / 'textbooks'
    book_dir = authoring_root / 'dorf-modern-control-systems'
    chapter_dir = book_dir / 'chapter-01'
    assets_dir = chapter_dir / 'assets'
    assets_dir.mkdir(parents=True)
    (assets_dir / 'fig-01-01.png').write_bytes(b'figure-1')
    (assets_dir / 'fig-01-02.png').write_bytes(b'figure-2')
    (assets_dir / 'fig-01-03.png').write_bytes(b'figure-3')

    write_json(book_dir / 'manifest.json', {
        'bookId': 'dorf-modern-control-systems',
        'title': 'Modern Control Systems',
        'authors': ['Richard C. Dorf', 'Robert H. Bishop'],
        'edition': '14th Global Edition',
        'source': {'workspace': 'DocProcess'},
        'chapters': [
            {
                'id': 'chapter-01',
                'number': 1,
                'title': 'Introduction to Control Systems',
                'textbookPath': 'chapter-01/textbook.md',
                'manifestPath': 'chapter-01/manifest.json',
                'assetsPath': 'chapter-01/assets/',
            },
        ],
    })
    write_json(chapter_dir / 'manifest.json', {
        'id': 'chapter-01',
        'number': 1,
        'title': 'Introduction to Control Systems',
        'textbookPath': 'textbook.md',
        'assetsPath': 'assets/',
        'images': [
            {
                'index': 1,
                'exportPath': 'assets/fig-01-01.png',
                'caption': 'Figure 1.1 Process to be controlled.',
                'sourcePdfPage': 32,
                'sha256': 'sha-fig-1',
                'bytes': 8,
            },
            {
                'index': 2,
                'exportPath': 'assets/fig-01-02.png',
                'caption': None,
                'sourcePdfPage': 33,
                'sha256': 'sha-fig-2',
                'bytes': 8,
            },
            {
                'index': 3,
                'exportPath': 'assets/fig-01-03.png',
                'originalRelativePath': 'assets/processed/figure-01-03-with-reference-64.png',
                'caption': 'Figure 1.3 Bracketed citation.',
                'sourcePdfPage': 34,
                'sha256': 'sha-fig-3',
                'bytes': 8,
            },
        ],
    })
    (chapter_dir / 'textbook.md').write_text(
        '\n'.join([
            '# Chapter 1 Introduction to Control Systems',
            '',
            '## PREVIEW',
            '',
            'This preview should be searchable but should not become a path-planning node.',
            '',
            '## 1.1 Introduction',
            '',
            'Control systems use feedback to compare desired and actual response.',
            '',
            '![Figure 1.1 Process to be controlled.](assets/fig-01-01.png)',
            '',
            'More explanation about open-loop and closed-loop control.',
            '',
            '## EXAMPLE 1.1 Automated vehicles',
            '',
            'Automated vehicles combine sensing, control, and actuation.',
            '',
            '![](assets/fig-01-02.png)',
            '',
            '![Figure 1.3 Diagram with reference [64].](assets/processed/figure-01-03-with-reference-64.png)',
            '',
            '## SKILLS CHECK',
            '',
            'Explain the difference between open-loop and closed-loop systems.',
        ]) + '\n',
        encoding='utf-8',
    )
    return authoring_root, runtime_root


def test_check_mode_parses_textbook_without_writing_runtime_files(tmp_path):
    authoring_root, runtime_root = create_textbook_fixture(tmp_path)

    audit = export_textbook_resources.export_book(
        book_id='dorf-modern-control-systems',
        authoring_root=authoring_root,
        runtime_root=runtime_root,
        write=False,
    )

    assert audit == {
        'bookId': 'dorf-modern-control-systems',
        'chapters': 1,
        'sections': 4,
        'pathEligibleSections': 2,
        'chunks': 4,
        'figures': 3,
        'figuresMissingCaption': 1,
        'missingFigureAssets': 0,
        'searchDocuments': 7,
    }
    assert not (runtime_root / 'dorf-modern-control-systems').exists()


def test_export_writes_sections_chunks_citation_map_and_search_documents(tmp_path):
    authoring_root, runtime_root = create_textbook_fixture(tmp_path)

    counts = export_textbook_resources.export_book(
        book_id='dorf-modern-control-systems',
        authoring_root=authoring_root,
        runtime_root=runtime_root,
        write=True,
    )

    output_dir = runtime_root / 'dorf-modern-control-systems'
    assert counts['sections'] == 4
    assert (output_dir / 'manifest.json').exists()
    assert (output_dir / 'sections' / 'ch01-sec01.md').exists()
    assert (output_dir / 'chunks' / 'ch01-sec01__chunk-001.md').exists()
    assert (output_dir / 'assets' / 'chapter-01' / 'fig-01-01.png').read_bytes() == b'figure-1'
    assert (output_dir / 'assets' / 'chapter-01' / 'fig-01-03.png').read_bytes() == b'figure-3'

    section_markdown = (output_dir / 'sections' / 'ch01-sec01.md').read_text(encoding='utf-8')
    assert '<!-- citation-target: ch01-sec01 -->' in section_markdown
    assert '<a id="fig-01-01"></a>' in section_markdown
    assert '/course-runtime/resources/textbooks/dorf-modern-control-systems/assets/chapter-01/fig-01-01.png' in section_markdown
    assert '](assets/fig-01-01.png)' not in section_markdown
    example_markdown = (output_dir / 'sections' / 'ch01-example-0101.md').read_text(encoding='utf-8')
    assert '<a id="fig-01-03"></a>' in example_markdown
    assert 'Figure 1.3 Diagram with reference [64].' in example_markdown
    assert '](assets/processed/figure-01-03-with-reference-64.png)' not in example_markdown
    assert '/course-runtime/resources/textbooks/dorf-modern-control-systems/assets/chapter-01/fig-01-03.png' in example_markdown

    section_index = read_jsonl(output_dir / 'section-index.jsonl')
    section_by_id = {section['id']: section for section in section_index}
    assert section_by_id['ch01-sec01']['pathPlanning']['pathEligible'] is True
    assert section_by_id['ch01-example-0101']['pathPlanning']['pathEligible'] is True
    assert section_by_id['ch01-preview-001']['pathPlanning']['pathEligible'] is False
    assert section_by_id['ch01-skills-check-004']['pathPlanning']['pathEligible'] is False

    citation_map = json.loads((output_dir / 'citation-map.json').read_text(encoding='utf-8'))
    assert citation_map['targets']['ch01-sec01']['href'].endswith('/sections/ch01-sec01.md')
    assert citation_map['targets']['fig-01-01'] == {
        'kind': 'image',
        'href': '/course-runtime/resources/textbooks/dorf-modern-control-systems/sections/ch01-sec01.md#fig-01-01',
        'sourceRefId': 'fig-01-01',
        'locator': 'fig-01-01',
        'contentHash': 'sha-fig-1',
    }

    search_documents = read_jsonl(output_dir / 'search-documents.jsonl')
    chunk_document = next(document for document in search_documents if document['id'] == 'ch01-sec01__chunk-001')
    assert chunk_document['sourceType'] == 'textbook-content'
    assert chunk_document['resourceProjection']['segmentRef'] == 'ch01-sec01'
    assert chunk_document['citationAddress']['sourceRefId'] == 'ch01-sec01__chunk-001'
    figure_document = next(document for document in search_documents if document['id'] == 'fig-01-01__figure')
    assert figure_document['citationAddress']['kind'] == 'image'
    captionless_figure_document = next(document for document in search_documents if document['id'] == 'fig-01-02__figure')
    assert captionless_figure_document['title'] == 'Automated vehicles figure fig-01-02'
    assert captionless_figure_document['metadata']['captionMissing'] is True
    bracketed_figure_document = next(document for document in search_documents if document['id'] == 'fig-01-03__figure')
    assert bracketed_figure_document['title'] == 'Figure 1.3 Bracketed citation.'


def test_runtime_resource_exports_are_ignored_by_git():
    repo_root = Path(__file__).resolve().parents[2]
    gitignore = repo_root / '.gitignore'

    assert 'course-content/runtime/resources/' in gitignore.read_text(encoding='utf-8')
    result = subprocess.run(
        ['git', 'check-ignore', 'course-content/runtime/resources/textbooks/example/manifest.json'],
        cwd=repo_root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0


def test_real_dorf_export_maps_every_markdown_image_and_runtime_asset(tmp_path):
    repo_root = Path(__file__).resolve().parents[2]
    authoring_root = repo_root / 'course-content' / 'authoring' / 'resources' / 'textbooks'
    runtime_root = tmp_path / 'runtime' / 'resources' / 'textbooks'

    counts = export_textbook_resources.export_book(
        book_id='dorf-modern-control-systems',
        authoring_root=authoring_root,
        runtime_root=runtime_root,
        write=True,
    )

    output_dir = runtime_root / 'dorf-modern-control-systems'
    authoring_images = 0
    for markdown_path in authoring_root.glob('dorf-modern-control-systems/chapter-*/textbook.md'):
        authoring_images += len(export_textbook_resources.scan_markdown_images(markdown_path.read_text(encoding='utf-8')))
    figure_records = read_jsonl(output_dir / 'figure-index.jsonl')
    search_documents = read_jsonl(output_dir / 'search-documents.jsonl')
    figure_search_documents = [document for document in search_documents if document['kind'] == 'figure']

    assert counts['figures'] == authoring_images == len(figure_records)
    assert counts['figures'] == len(figure_search_documents)
    assert counts['assets'] == len([record for record in figure_records if record['assetStatus'] == 'available'])
    assert counts['figures'] == counts['assets'] + counts['missingFigureAssets']
    for markdown_path in [*(output_dir / 'sections').glob('*.md'), *(output_dir / 'chunks').glob('*.md')]:
        assert '](assets/' not in markdown_path.read_text(encoding='utf-8')
    for record in figure_records:
        if record['assetStatus'] == 'missing-source':
            assert record['runtimeAssetPath'] is None
            continue
        runtime_asset_path = record['runtimeAssetPath'].removeprefix('/course-runtime/resources/textbooks/dorf-modern-control-systems/')
        assert (output_dir / runtime_asset_path).exists()
