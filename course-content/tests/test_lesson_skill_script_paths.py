from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'Unable to load module from {path}')
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def test_lesson_skill_kg_query_reads_course_content_authoring() -> None:
    module = load_module(
        'lesson_kg_query',
        ROOT / '.agents' / 'skills' / 'lesson' / 'scripts' / 'kg_query.py',
    )

    assert module.COURSE_ROOT == ROOT / 'course-content'
    assert module.KG_FILE.exists()
    assert module.REL_FILE.exists()
    assert module.UNIT_TO_CHAPTERS['3-6'] == [4, 5, 6]
    assert module.UNIT_TO_CHAPTERS['3-9'] == [3, 4, 5, 6]
    assert module.UNIT_TO_CHAPTERS['5-1'] == [7]
    assert module.UNIT_TO_CHAPTERS['5-6'] == [9, 10]


def test_lesson_skill_kg_add_writes_course_content_authoring() -> None:
    module = load_module(
        'lesson_kg_add',
        ROOT / '.agents' / 'skills' / 'lesson' / 'scripts' / 'kg_add.py',
    )

    assert module.COURSE_ROOT == ROOT / 'course-content'
    assert module.KG_FILE == ROOT / 'course-content' / 'authoring' / 'knowledge' / 'base' / 'knowledge_graph.json'
    assert module.REL_FILE == ROOT / 'course-content' / 'authoring' / 'knowledge' / 'base' / 'relations.jsonl'
    assert module.NEW_NODES_FILE == ROOT / 'course-content' / 'authoring' / 'knowledge' / 'base' / 'new_nodes.jsonl'
    assert module.NEW_RELS_FILE == ROOT / 'course-content' / 'authoring' / 'knowledge' / 'base' / 'new_relations.jsonl'
    assert module.KG_FILE.exists()
    assert module.REL_FILE.exists()


def test_lesson_skill_sync_overlays_discovers_real_lesson_graphs() -> None:
    module = load_module(
        'lesson_sync_overlays',
        ROOT / '.agents' / 'skills' / 'lesson' / 'scripts' / 'sync_overlays.py',
    )

    lessons = module.discover_lessons()

    assert module.COURSE_ROOT == ROOT / 'course-content'
    assert '4-2' in lessons
    assert len(lessons) >= 20
