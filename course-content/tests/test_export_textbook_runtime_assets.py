import hashlib
import importlib.util
import json
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[1]
    / 'scripts'
    / 'export_textbook_runtime_assets.py'
)
SPEC = importlib.util.spec_from_file_location(
    'export_textbook_runtime_assets',
    MODULE_PATH,
)
assert SPEC and SPEC.loader
assets_exporter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(assets_exporter)


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding='utf-8')


def test_export_book_assets_only_copies_manifest_declared_assets(tmp_path: Path) -> None:
    authoring_root = tmp_path / 'authoring'
    book_root = authoring_root / 'textbooks' / 'sample-book'
    source_asset = book_root / 'chapter-01' / 'assets' / 'figure.png'
    source_asset.parent.mkdir(parents=True)
    source_asset.write_bytes(b'figure-v1')
    digest = hashlib.sha256(source_asset.read_bytes()).hexdigest()

    write_json(book_root / 'manifest.json', {
        'chapters': [{
            'id': 'chapter-01',
            'manifestPath': 'chapter-01/manifest.json',
        }],
    })
    write_json(book_root / 'chapter-01' / 'manifest.json', {
        'images': [{
            'exportPath': 'assets/figure.png',
            'sha256': digest,
        }],
    })
    config_path = tmp_path / 'sample-book.json'
    write_json(config_path, {
        'resourceId': 'sample-book',
        'sourceKind': 'textbook',
    })

    output_root = tmp_path / 'runtime' / 'textbooks'
    copied = assets_exporter.export_book_assets(
        authoring_root=authoring_root,
        config_path=config_path,
        output_root=output_root,
    )

    assert copied == 1
    assert (
        output_root
        / 'sample-book'
        / 'assets'
        / 'chapter-01'
        / 'figure.png'
    ).read_bytes() == b'figure-v1'
    assert sorted(
        path.relative_to(output_root).as_posix()
        for path in output_root.rglob('*')
        if path.is_file()
    ) == ['sample-book/assets/chapter-01/figure.png']
