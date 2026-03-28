from __future__ import annotations

import importlib.util
from pathlib import Path


def load_export_module():
    module_path = Path(__file__).resolve().parents[1] / 'scripts' / 'export_runtime.py'
    spec = importlib.util.spec_from_file_location('export_runtime', module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


export_runtime = load_export_module()


def test_copy_media_assets_includes_m4a_audio(tmp_path):
    source_dir = tmp_path / 'source'
    destination_dir = tmp_path / 'dest'
    source_dir.mkdir()
    destination_dir.mkdir()

    (source_dir / 'lesson-audio.m4a').write_bytes(b'audio')
    (source_dir / 'lesson-slides.pdf').write_bytes(b'pdf')

    copied = export_runtime.copy_media_assets(source_dir, destination_dir)

    assert 'lesson-audio.m4a' in copied
    assert (destination_dir / 'lesson-audio.m4a').exists()
    assert (destination_dir / 'lesson-slides.pdf').exists()
