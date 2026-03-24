from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
MAP_PATH = REPO_ROOT / 'course-content' / 'authoring' / 'shared' / 'lesson-id-map.json'


@lru_cache(maxsize=1)
def load_lesson_id_map() -> dict[str, Any]:
    return json.loads(MAP_PATH.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def build_request_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for entry in load_lesson_id_map().get('entries', []):
        for request_id in entry.get('request_ids', []):
            index[str(request_id)] = entry
    return index


def get_lesson_entry(lesson_id: str) -> dict[str, Any]:
    entry = build_request_index().get(lesson_id)
    if entry is None:
        raise KeyError(f'Unknown lesson id: {lesson_id}')
    return entry


def get_storage_fragment(lesson_id: str, key: str) -> str:
    entry = get_lesson_entry(lesson_id)
    value = entry.get(key)
    if not value:
        raise KeyError(f'Lesson id {lesson_id} has no storage key {key}')
    return str(value)


def get_authoring_lesson_dir(lesson_id: str) -> Path:
    return REPO_ROOT / 'course-content' / 'authoring' / 'lessons' / get_storage_fragment(
        lesson_id, 'authoring_lesson_dir'
    )


def get_authoring_cards_dir(lesson_id: str) -> Path:
    return REPO_ROOT / 'course-content' / 'authoring' / 'knowledge' / 'cards' / 'lessons' / get_storage_fragment(
        lesson_id, 'authoring_cards_dir'
    )


def get_authoring_overlays_dir(lesson_id: str) -> Path:
    return REPO_ROOT / 'course-content' / 'authoring' / 'knowledge' / 'overlays' / get_storage_fragment(
        lesson_id, 'authoring_overlays_dir'
    )


def get_runtime_lesson_dir(lesson_id: str) -> Path:
    return REPO_ROOT / 'course-content' / 'runtime' / 'lessons' / get_storage_fragment(
        lesson_id, 'runtime_lesson_dir'
    )


def is_generation_allowed(lesson_id: str) -> bool:
    return bool(get_lesson_entry(lesson_id).get('generation_allowed'))


def get_mapped_target_id(lesson_id: str) -> str | None:
    value = get_lesson_entry(lesson_id).get('mapped_target_id')
    return str(value) if value else None


def get_status(lesson_id: str) -> str:
    return str(get_lesson_entry(lesson_id).get('status'))
