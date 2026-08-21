#!/usr/bin/env python3
"""Deterministic core parser for the disconnected structured textbook runtime v2."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, field
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from textbook_resource_set import load_textbook_resource_set


SCHEMA_VERSION = 'structured-textbook-runtime.v2'
CONFIG_VERSION = 'textbook-structure-parser.v2'
REPO_ROOT = Path(__file__).resolve().parents[2]
COURSE_ROOT = REPO_ROOT / 'course-content'
CONFIG_ROOT = Path(__file__).resolve().parents[1] / 'config' / 'textbook-structure-v2'
DEFAULT_AUTHORING_ROOT = COURSE_ROOT / 'authoring' / 'resources'
DEFAULT_RUNTIME_ROOT = COURSE_ROOT / 'runtime' / 'resources' / 'textbooks-v2'
SCHEMA_PATH = COURSE_ROOT / 'contracts' / 'structured-textbook-runtime-v2.schema.json'

_CHINESE_DIGITS = {
    '零': 0, '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
}


class StructureAmbiguityError(ValueError):
    """A bounded source location whose hierarchy cannot be assigned uniquely."""


@dataclass(frozen=True)
class SourceSpan:
    sourcePath: str
    startLine: int
    endLine: int
    startByte: int
    endByte: int


@dataclass
class StructureUnit:
    id: str
    bookId: str
    edition: str
    chapterId: str
    structuralPath: list[str]
    parentId: str | None
    ancestorIds: list[str]
    level: int
    kind: str
    naturalNumber: str | None
    title: str
    markdown: str
    sourceSpan: SourceSpan
    fragmentAnchorIds: list[str] = field(default_factory=list)
    recordType: str = field(default='structure-unit', init=False)
    schemaVersion: str = field(default=SCHEMA_VERSION, init=False)


@dataclass(frozen=True)
class FragmentAnchor:
    id: str
    owningUnitId: str
    kind: str
    naturalNumber: str | None
    ordinal: int
    sourceSpan: SourceSpan
    recordType: str = field(default='fragment-anchor', init=False)
    schemaVersion: str = field(default=SCHEMA_VERSION, init=False)


@dataclass(frozen=True)
class ParseResult:
    units: list[StructureUnit]
    anchors: list[FragmentAnchor]

    def as_records(self) -> dict[str, list[dict[str, Any]]]:
        return {
            'units': [asdict(unit) for unit in self.units],
            'anchors': [asdict(anchor) for anchor in self.anchors],
        }


@dataclass(frozen=True)
class WindowSegment:
    owningUnitId: str
    markdown: str
    sourceSpan: SourceSpan


@dataclass(frozen=True)
class RetrievalWindow:
    id: str
    primaryUnitId: str
    segments: list[WindowSegment]
    citationTarget: bool = field(default=False, init=False)
    recordType: str = field(default='retrieval-window', init=False)
    schemaVersion: str = field(default=SCHEMA_VERSION, init=False)


@dataclass(frozen=True)
class NavigationEntry:
    unitId: str
    parentId: str | None
    childIds: list[str]
    previousUnitId: str | None
    nextUnitId: str | None
    contentByteIndex: SourceSpan


@dataclass(frozen=True)
class StructureAnomaly:
    id: str
    kind: str
    severity: str
    message: str
    sourceSpan: SourceSpan
    unitId: str | None
    disposition: str
    dispositionReason: str | None
    dispositionRule: str | None
    recordType: str = field(default='structure-anomaly', init=False)
    schemaVersion: str = field(default=SCHEMA_VERSION, init=False)


@dataclass(frozen=True)
class StructureSample:
    id: str
    chapterId: str
    unitId: str
    reasons: list[str]
    sourceSpan: SourceSpan
    reviewStatus: str
    reviewEvidence: str | None
    recordType: str = field(default='structure-sample', init=False)
    schemaVersion: str = field(default=SCHEMA_VERSION, init=False)


@dataclass(frozen=True)
class ExportResult:
    manifest: dict[str, Any]
    units: list[StructureUnit]
    anchors: list[FragmentAnchor]
    windows: list[RetrievalWindow]
    navigation: dict[str, Any]
    anomalies: list[StructureAnomaly]
    samples: list[StructureSample]


@dataclass(frozen=True)
class _Boundary:
    line_index: int
    byte_offset: int
    level: int
    kind: str
    title: str
    natural_number: str | None
    path_component: str
    allow_level_skip: bool = False
    parent_line: int | None = None


def load_parser_config(resource_id: str, config_root: Path = CONFIG_ROOT) -> dict[str, Any]:
    path = config_root / f'{resource_id}.json'
    if not path.is_file():
        raise FileNotFoundError(f'No structured textbook parser config for {resource_id}: {path}')
    config = json.loads(path.read_text(encoding='utf-8'))
    if config.get('configVersion') != CONFIG_VERSION:
        raise ValueError(f'Unsupported parser config version in {path}')
    if config.get('resourceId') != resource_id:
        raise ValueError(f'Parser config resourceId mismatch in {path}')
    if config.get('allowLevelSkips') is True:
        raise ValueError(
            f'{path}: global allowLevelSkips=true is forbidden; use an exact override'
        )
    if config.get('anomalyPolicy'):
        raise ValueError(
            f'{path}: type-level anomalyPolicy is forbidden; use an exact review ledger'
        )
    review_source_digest = config.get('reviewSourceDigest')
    if review_source_digest is not None and not re.fullmatch(
        r'sha256:[0-9a-f]{64}',
        str(review_source_digest),
    ):
        raise ValueError(f'{path}: reviewSourceDigest must be a sha256 digest')
    ledger_path = config.get('reviewLedger')
    if ledger_path is not None:
        if not isinstance(ledger_path, str) or not ledger_path:
            raise ValueError(f'{path}: reviewLedger must be a non-empty relative path')
        resolved_ledger = (path.parent / ledger_path).resolve()
        if path.parent.resolve() not in resolved_ledger.parents:
            raise ValueError(f'{path}: reviewLedger must remain inside the config directory')
        ledger = _read_json(resolved_ledger)
        if ledger.get('resourceId') != resource_id:
            raise ValueError(f'{resolved_ledger}: review ledger resourceId mismatch')
        config['_reviewLedger'] = ledger
    for index, override in enumerate(config.get('overrides', [])):
        if not isinstance(override, dict):
            raise ValueError(f'{path}: override {index} must be an object')
        selector = override.get('selector')
        if not isinstance(selector, dict):
            raise ValueError(f'{path}: override {index} requires selector')
        by_location = (
            isinstance(selector.get('sourcePath'), str)
            and isinstance(selector.get('line'), int)
        )
        by_title = isinstance(selector.get('title'), str) and bool(selector['title'])
        if not by_location and not by_title:
            raise ValueError(
                f'{path}: override {index} must select exact sourcePath+line or title'
            )
        parent_line = override.get('parentLine')
        if parent_line is not None:
            if override.get('action') != 'set-boundary':
                raise ValueError(
                    f'{path}: override {index} parentLine requires set-boundary'
                )
            if not by_location:
                raise ValueError(
                    f'{path}: override {index} parentLine requires exact sourcePath+line'
                )
            if type(parent_line) is not int or parent_line <= 0:
                raise ValueError(
                    f'{path}: override {index} parentLine must be a positive integer'
                )
            if parent_line >= selector['line']:
                raise ValueError(
                    f'{path}: override {index} parentLine must precede selector line'
                )
    return config


def _selector_matches(
    selector: dict[str, Any],
    *,
    source_path: str,
    line: int,
    title: str,
) -> bool:
    if 'sourcePath' in selector and selector.get('sourcePath') != source_path:
        return False
    if 'line' in selector and selector.get('line') != line:
        return False
    if 'title' in selector and selector.get('title') != title:
        return False
    return True


def _boundary_override(
    *,
    config: dict[str, Any],
    source_path: str,
    line: int,
    title: str,
    level: int,
    kind: str,
    component: str,
) -> tuple[int, str, str, bool, bool, int | None]:
    matched: list[dict[str, Any]] = []
    boundary_actions = {
        'allow-level-skip',
        'ignore-boundary',
        'set-boundary',
    }
    for override in config.get('overrides', []):
        if override.get('action') not in boundary_actions:
            continue
        if _selector_matches(
            override['selector'],
            source_path=source_path,
            line=line,
            title=title,
        ):
            matched.append(override)
    if len(matched) > 1:
        raise StructureAmbiguityError(
            f'{source_path}:{line}: multiple parser overrides match {title[:120]}'
        )
    if not matched:
        return level, kind, component, False, False, None
    override = matched[0]
    action = override['action']
    if action == 'ignore-boundary':
        return level, kind, component, False, True, None
    if action == 'allow-level-skip':
        return level, kind, component, True, False, None
    updated_level = int(override.get('level', level))
    updated_kind = str(override.get('kind', kind))
    updated_component = str(override.get('pathComponent', component))
    if updated_level < 1 or not updated_component:
        raise ValueError(f'{source_path}:{line}: invalid set-boundary override')
    return updated_level, updated_kind, updated_component, bool(
        override.get('allowLevelSkip', False)
    ), False, override.get('parentLine')


def _chinese_integer(value: str) -> int:
    if not value or any(char not in _CHINESE_DIGITS and char not in {'十', '百'} for char in value):
        raise ValueError(f'Unsupported Chinese integer: {value}')
    total = 0
    current = 0
    for char in value:
        if char in _CHINESE_DIGITS:
            current = _CHINESE_DIGITS[char]
        elif char == '十':
            total += (current or 1) * 10
            current = 0
        else:
            total += (current or 1) * 100
            current = 0
    return total + current


def _normalize_number(value: str) -> str:
    value = value.strip().lower()
    value = value.replace('．', '.').replace('。', '.')
    value = re.sub(r'[－—–-]', '.', value)
    value = re.sub(r'\s+', '', value)
    return value.strip('.')


def _identity_token(value: str) -> str:
    normalized = value.casefold().strip()
    normalized = re.sub(r'[^a-z0-9\u4e00-\u9fff.]+', '-', normalized)
    return normalized.strip('-') or 'root'


def stable_unit_id(book_id: str, edition: str, structural_path: list[str]) -> str:
    """Return an identity that is independent of mutable title and body text."""
    edition_token = _identity_token(edition)
    path = '/'.join(_identity_token(part) for part in structural_path)
    return f'textbook-unit:{_identity_token(book_id)}@{edition_token}/{path}'


def _rule_boundary(text: str, enabled: set[str]) -> tuple[int, str, str, str] | None:
    stripped = text.strip()
    if 'chinese-chapter' in enabled:
        match = re.match(r'^第([一二三四五六七八九十百〇零]+)章(?:\s+|$)(.*)$', stripped)
        if match:
            number = str(_chinese_integer(match.group(1)))
            return 1, 'chapter', match.group(2).strip() or stripped, f'chapter-{number}'
    if 'english-chapter' in enabled:
        match = re.match(r'^chapter\s+(\d+)\b[:.\s-]*(.*)$', stripped, re.IGNORECASE)
        if match:
            number = str(int(match.group(1)))
            return 1, 'chapter', match.group(2).strip() or stripped, f'chapter-{number}'
    if 'english-example' in enabled:
        match = re.match(r'^example\s+(\d+(?:[.－—–-]\d+)+)\b[:.\s-]*(.*)$', stripped, re.IGNORECASE)
        if match:
            if match.group(2).lstrip().startswith(','):
                return None
            number = _normalize_number(match.group(1))
            return 3, 'example', match.group(2).strip() or stripped, f'example-{number}'
    if 'chinese-example' in enabled:
        match = re.match(
            r'^例\s*(\d+(?:\s*[.．－—–-]\s*\d+)+)\s*(.*)$',
            stripped,
        )
        if match:
            number = _normalize_number(match.group(1))
            return 3, 'example', match.group(2).strip() or stripped, f'example-{number}'
    if 'solution-boundary' in enabled:
        match = re.match(r'^(解|证明)(?=\s|[：:（(]|$)[：:]?\s*(.*)$', stripped)
        if match:
            return 4, 'solution', match.group(2).strip() or match.group(1), 'solution'
    if 'arabic-compound' in enabled:
        match = re.match(r'^(\d+(?:\s*[.．－—–-]\s*\d+)+)\s+(.+)$', stripped)
        if match:
            number = _normalize_number(match.group(1))
            level = min(len(number.split('.')), 6)
            return level, 'section' if level == 2 else 'subsection', match.group(2).strip(), f'section-{number}'
        compact_exercise = re.match(
            r'^(\d+[－—–-]\d+)([\u4e00-\u9fff].+)$',
            stripped,
        )
        if compact_exercise:
            number = _normalize_number(compact_exercise.group(1))
            return 2, 'exercise', compact_exercise.group(2).strip(), f'exercise-{number}'
    if 'arabic-ordinal' in enabled:
        match = re.match(r'^(\d+)[.．、]\s*(\S.*)$', stripped)
        if match:
            number = str(int(match.group(1)))
            return 3, 'subsection', match.group(2).strip(), f'item-{number}'
    if 'parenthesized' in enabled:
        match = re.match(r'^[（(]([0-9一二三四五六七八九十]+)[）)]\s*(\S.*)$', stripped)
        if match:
            if match.group(2).startswith(('$', r'\(', r'\[')):
                return None
            raw = match.group(1)
            number = str(int(raw)) if raw.isdigit() else str(_chinese_integer(raw))
            return 4, 'item', match.group(2).strip(), f'item-{number}'
    return None


def _line_offsets(markdown: str) -> tuple[list[str], list[int]]:
    lines = markdown.splitlines(keepends=True)
    offsets = [0]
    for line in lines:
        offsets.append(offsets[-1] + len(line.encode('utf-8')))
    return lines, offsets


def _collect_boundaries(markdown: str, config: dict[str, Any], source_path: str) -> list[_Boundary]:
    lines, offsets = _line_offsets(markdown)
    enabled = set(config.get('enabledNumberingRules', []))
    heading_levels = {
        int(key): int(value)
        for key, value in config.get('markdownHeadingLevels', {}).items()
    }
    boundaries: list[_Boundary] = []
    unnumbered_counts: dict[tuple[str, ...], int] = {}
    stack: list[_Boundary] = []
    boundary_chains: dict[int, list[_Boundary]] = {}
    in_fence = False
    in_display_math = False

    for index, raw_line in enumerate(lines):
        stripped = raw_line.rstrip('\r\n')
        if re.match(r'^\s*```', stripped):
            in_fence = not in_fence
            continue
        if not in_fence and stripped.strip() == '$$':
            in_display_math = not in_display_math
            continue
        if in_fence or in_display_math or not stripped.strip():
            continue

        heading = re.match(r'^(#{1,6})\s+(.+?)\s*#*\s*$', stripped)
        visible = heading.group(2).strip() if heading else stripped.strip()
        recognized = _rule_boundary(visible, enabled)
        if (
            recognized
            and not heading
            and recognized[1] not in {'example', 'solution'}
            and len(visible) > 200
        ):
            recognized = None
        if (
            recognized
            and not heading
            and (
                re.search(r'\.{3,}\s*\d+\s*$', visible)
                or (
                    index < 25
                    and re.match(r'^\d+(?:[.．－—–-]\d+)+\s+.+\s+\d+\s*$', visible)
                )
            )
        ):
            # A numbered table-of-contents entry is navigation prose, not the
            # canonical boundary repeated later in the chapter body.
            continue
        if recognized:
            level, kind, title, component = recognized
            if kind == 'solution' and stack:
                semantic_parent = next(
                    (
                        candidate
                        for candidate in reversed(stack)
                        if candidate.kind not in {'item', 'solution'}
                    ),
                    stack[-1],
                )
                level = semantic_parent.level + 1
            if (
                kind == 'item'
                and stack
                and stack[-1].kind == 'solution'
                and level > stack[-1].level
            ):
                component = f'solution-{component}'
        elif heading:
            level = heading_levels.get(len(heading.group(1)), len(heading.group(1)))
            kind = 'unnumbered'
            title = visible
            parent_key = tuple(item.path_component for item in stack if item.level < level)
            unnumbered_counts[parent_key] = unnumbered_counts.get(parent_key, 0) + 1
            component = f'unnumbered-{unnumbered_counts[parent_key]:03d}'
        else:
            explicit_boundaries = [
                override
                for override in config.get('overrides', [])
                if (
                    override.get('action') == 'set-boundary'
                    and _selector_matches(
                        override['selector'],
                        source_path=source_path,
                        line=index + 1,
                        title=visible,
                    )
                )
            ]
            if len(explicit_boundaries) > 1:
                raise StructureAmbiguityError(
                    f'{source_path}:{index + 1}: multiple parser overrides '
                    f'match {visible[:120]}'
                )
            if not explicit_boundaries:
                continue
            explicit = explicit_boundaries[0]
            level = int(explicit.get('level', 0))
            kind = str(explicit.get('kind', 'unnumbered'))
            title = visible
            component = str(explicit.get('pathComponent', ''))

        (
            level,
            kind,
            component,
            allow_level_skip,
            ignore,
            parent_line,
        ) = _boundary_override(
            config=config,
            source_path=source_path,
            line=index + 1,
            title=visible,
            level=level,
            kind=kind,
            component=component,
        )
        if ignore:
            continue
        if parent_line is not None:
            if type(parent_line) is not int or parent_line <= 0:
                raise StructureAmbiguityError(
                    f'{source_path}:{index + 1}: parentLine must be a positive integer'
                )
            if parent_line >= index + 1:
                raise StructureAmbiguityError(
                    f'{source_path}:{index + 1}: parentLine {parent_line} '
                    'must identify an earlier structural boundary'
                )
            parent_chain = boundary_chains.get(parent_line)
            if parent_chain is None:
                raise StructureAmbiguityError(
                    f'{source_path}:{index + 1}: parentLine {parent_line} '
                    'does not identify an earlier structural boundary'
                )
            parent_boundary = parent_chain[-1]
            expected_level = parent_boundary.level + 1
            if level != expected_level:
                raise StructureAmbiguityError(
                    f'{source_path}:{index + 1}: explicit level {level} does not '
                    f'match parentLine {parent_line} level {parent_boundary.level}'
                )
            stack = list(parent_chain)
        elif recognized and stack:
            if (
                kind == 'item'
                and boundaries
                and boundaries[-1].kind == 'item'
                and not heading
            ):
                level = boundaries[-1].level
            elif kind == 'item' and level > stack[-1].level + 1:
                level = stack[-1].level + 1
            if (
                heading
                and component.startswith('item-')
                and stack[-1].path_component.startswith('section-')
                and level <= stack[-1].level
            ):
                level = stack[-1].level + 1
            elif (
                heading
                and component.startswith('item-')
                and boundaries
                and boundaries[-1].kind == 'item'
            ):
                level = boundaries[-1].level
            if (
                not heading
                and kind in {'section', 'subsection'}
                and re.search(
                    r'\b(review questions|problems|exercises)\b|习\s*题',
                    stack[-1].title,
                    re.IGNORECASE,
                )
            ):
                level = stack[-1].level + 1
                kind = 'exercise'
                component = f'exercise-{recognized[3].rsplit("-", 1)[-1]}'
            elif (
                not heading
                and kind in {'section', 'subsection'}
                and boundaries
                and boundaries[-1].kind == 'exercise'
            ):
                level = boundaries[-1].level
                kind = 'exercise'
                component = f'exercise-{recognized[3].rsplit("-", 1)[-1]}'
        while stack and stack[-1].level >= level:
            stack.pop()
        inherited_level_skip = bool(
            boundaries
            and boundaries[-1].level == level
            and boundaries[-1].allow_level_skip
        )
        if not stack and level > 2 and not allow_level_skip:
            raise StructureAmbiguityError(
                f'{source_path}:{index + 1}: hierarchy jumps from implicit chapter '
                f'level 1 to {level}: {visible[:120]}'
            )
        if (
            stack
            and level > stack[-1].level + 1
            and not allow_level_skip
            and not inherited_level_skip
        ):
            raise StructureAmbiguityError(
                f'{source_path}:{index + 1}: hierarchy jumps from level '
                f'{stack[-1].level} to {level}: {visible[:120]}'
            )
        boundary = _Boundary(
            index,
            offsets[index],
            level,
            kind,
            title,
            component.rsplit('-', 1)[-1] if recognized else None,
            component,
            allow_level_skip or inherited_level_skip,
            parent_line,
        )
        boundaries.append(boundary)
        stack.append(boundary)
        boundary_chains[index + 1] = list(stack)
    return boundaries


def _span(source_path: str, lines: list[str], offsets: list[int], start: int, end: int) -> SourceSpan:
    return SourceSpan(
        sourcePath=source_path,
        startLine=start + 1,
        endLine=max(start + 1, end),
        startByte=offsets[start],
        endByte=offsets[end],
    )


def _anchor_candidates(markdown: str) -> list[tuple[str, str | None, int, int]]:
    candidates: list[tuple[str, str | None, int, int]] = []
    caption_patterns = {
        'figure': re.compile(
            r'^(?:图|fig(?:ure)?[.]?)\s*([0-9]+(?:[.－—–-][0-9]+)+)\b',
            re.IGNORECASE | re.MULTILINE,
        ),
        'table': re.compile(
            r'^(?:表|table[.]?)\s*([0-9]+(?:[.－—–-][0-9]+)+)\b',
            re.IGNORECASE | re.MULTILINE,
        ),
    }
    caption_offsets: dict[str, list[int]] = {'figure': [], 'table': []}
    for kind, pattern in caption_patterns.items():
        for match in pattern.finditer(markdown):
            caption_offsets[kind].append(match.start())
            candidates.append((
                kind,
                _normalize_number(match.group(1)),
                match.start(),
                match.end(),
            ))

    for match in re.finditer(r'!\[[^\]]*]\([^)]+\)', markdown):
        if not any(abs(offset - match.end()) <= 500 for offset in caption_offsets['figure']):
            candidates.append(('figure', None, match.start(), match.end()))
    for match in re.finditer(r'(?:^\s*\|.*\|\s*(?:\n|$)){2,}', markdown, re.MULTILINE):
        if not any(0 <= match.start() - offset <= 500 for offset in caption_offsets['table']):
            candidates.append(('table', None, match.start(), match.end()))
    for match in re.finditer(r'\$\$(.+?)\$\$|\\\[(.+?)\\\]', markdown, re.DOTALL):
        body = next((group for group in match.groups() if group), '')
        tag = re.search(r'\\tag\{([^}]+)\}', body)
        candidates.append((
            'formula',
            _normalize_number(tag.group(1)) if tag else None,
            match.start(),
            match.end(),
        ))
    return sorted(candidates, key=lambda item: (item[2], item[3], item[0]))


def _fragment_anchors(unit: StructureUnit, source_path: str) -> list[FragmentAnchor]:
    counts = {'formula': 0, 'figure': 0, 'table': 0}
    natural_occurrences: dict[tuple[str, str], int] = {}
    anchors: list[FragmentAnchor] = []
    for kind, natural, char_start, char_end in _anchor_candidates(unit.markdown):
        counts[kind] += 1
        token = natural or f'{counts[kind]:03d}'
        if natural:
            key = (kind, token)
            occurrence = natural_occurrences.get(key, 0) + 1
            natural_occurrences[key] = occurrence
            if occurrence > 1:
                token = f'{token}-occurrence-{occurrence}'
        anchor_id = f'{unit.id}#{kind}-{_identity_token(token)}'
        prefix = unit.markdown[:char_start]
        fragment = unit.markdown[char_start:char_end]
        start_line = unit.sourceSpan.startLine + prefix.count('\n')
        anchors.append(FragmentAnchor(
            id=anchor_id,
            owningUnitId=unit.id,
            kind=kind,
            naturalNumber=natural,
            ordinal=counts[kind],
            sourceSpan=SourceSpan(
                sourcePath=source_path,
                startLine=start_line,
                endLine=start_line + fragment.count('\n'),
                startByte=unit.sourceSpan.startByte + len(prefix.encode('utf-8')),
                endByte=unit.sourceSpan.startByte + len((prefix + fragment).encode('utf-8')),
            ),
        ))
    return anchors


def parse_markdown(
    *,
    book_id: str,
    edition: str,
    chapter_id: str,
    markdown: str,
    config: dict[str, Any],
    source_path: str = '<memory>',
) -> ParseResult:
    """Parse one canonical chapter into non-overlapping citation units and anchors."""
    if config.get('resourceId') != book_id:
        raise ValueError(f'Config {config.get("resourceId")} does not match {book_id}')
    lines, offsets = _line_offsets(markdown)
    boundaries = _collect_boundaries(markdown, config, source_path)
    root_component = f'chapter-{_identity_token(chapter_id)}'
    root_id = stable_unit_id(book_id, edition, [root_component])
    first_boundary_is_root = bool(
        boundaries
        and boundaries[0].line_index == 0
        and boundaries[0].level == 1
    )
    root_boundary = boundaries[0] if first_boundary_is_root else None
    remaining_boundaries = boundaries[1:] if first_boundary_is_root else boundaries
    root_end = (
        remaining_boundaries[0].line_index
        if remaining_boundaries
        else len(lines)
    )
    units = [StructureUnit(
        id=root_id,
        bookId=book_id,
        edition=edition,
        chapterId=chapter_id,
        structuralPath=[root_component],
        parentId=None,
        ancestorIds=[],
        level=1,
        kind=root_boundary.kind if root_boundary else 'chapter',
        naturalNumber=root_boundary.natural_number if root_boundary else chapter_id,
        title=root_boundary.title if root_boundary else chapter_id,
        markdown=''.join(lines[:root_end]),
        sourceSpan=_span(source_path, lines, offsets, 0, root_end),
    )]
    stack: list[StructureUnit] = [units[0]]
    unit_chains: dict[int, list[StructureUnit]] = {}
    if root_boundary is not None:
        unit_chains[root_boundary.line_index + 1] = [units[0]]

    seen_ids = {root_id}
    seen_paths = {(book_id, edition, tuple(units[0].structuralPath))}
    repeated_paths: dict[tuple[str, ...], int] = {}
    for index, boundary in enumerate(remaining_boundaries):
        if boundary.parent_line is not None:
            parent_chain = unit_chains.get(boundary.parent_line)
            if parent_chain is None:
                raise StructureAmbiguityError(
                    f'{source_path}:{boundary.line_index + 1}: parentLine '
                    f'{boundary.parent_line} has no emitted structural unit'
                )
            stack = list(parent_chain)
            parent = stack[-1]
            if boundary.level != parent.level + 1:
                raise StructureAmbiguityError(
                    f'{source_path}:{boundary.line_index + 1}: explicit level '
                    f'{boundary.level} does not match parentLine '
                    f'{boundary.parent_line} level {parent.level}'
                )
        else:
            while len(stack) > 1 and stack[-1].level >= boundary.level:
                stack.pop()
            parent = stack[-1]
            if boundary.level <= parent.level:
                parent = units[0]
                stack = [parent]
        path = [*parent.structuralPath, boundary.path_component]
        unit_id = stable_unit_id(book_id, edition, path)
        natural_path = (book_id, edition, tuple(path))
        if unit_id in seen_ids or natural_path in seen_paths:
            base_path = tuple(path)
            occurrence = repeated_paths.get(base_path, 1) + 1
            repeated_paths[base_path] = occurrence
            path[-1] = f'{path[-1]}-occurrence-{occurrence}'
            unit_id = stable_unit_id(book_id, edition, path)
            natural_path = (book_id, edition, tuple(path))
            if unit_id in seen_ids or natural_path in seen_paths:
                raise StructureAmbiguityError(
                    f'{source_path}:{boundary.line_index + 1}: repeated structural '
                    f'path could not be disambiguated: {"/".join(path)}'
                )
        seen_ids.add(unit_id)
        seen_paths.add(natural_path)
        end = (
            remaining_boundaries[index + 1].line_index
            if index + 1 < len(remaining_boundaries)
            else len(lines)
        )
        unit = StructureUnit(
            id=unit_id,
            bookId=book_id,
            edition=edition,
            chapterId=chapter_id,
            structuralPath=path,
            parentId=parent.id,
            ancestorIds=[*parent.ancestorIds, parent.id],
            level=boundary.level,
            kind=boundary.kind,
            naturalNumber=boundary.natural_number,
            title=boundary.title,
            markdown=''.join(lines[boundary.line_index:end]),
            sourceSpan=_span(source_path, lines, offsets, boundary.line_index, end),
        )
        units.append(unit)
        stack.append(unit)
        unit_chains[boundary.line_index + 1] = list(stack)

    anchors: list[FragmentAnchor] = []
    for unit in units:
        owned = _fragment_anchors(unit, source_path)
        unit.fragmentAnchorIds.extend(anchor.id for anchor in owned)
        anchors.extend(owned)
    _validate_partition(units, len(markdown.encode('utf-8')), source_path)
    return ParseResult(units=units, anchors=anchors)


def _validate_partition(units: list[StructureUnit], total_bytes: int, source_path: str) -> None:
    ordered = sorted(units, key=lambda unit: unit.sourceSpan.startByte)
    cursor = 0
    for unit in ordered:
        if unit.sourceSpan.startByte != cursor:
            raise AssertionError(f'{source_path}: structure units overlap or leave a gap at byte {cursor}')
        if unit.sourceSpan.endByte < unit.sourceSpan.startByte:
            raise AssertionError(f'{source_path}: inverted unit span for {unit.id}')
        cursor = unit.sourceSpan.endByte
    if cursor != total_bytes:
        raise AssertionError(f'{source_path}: structure units end at {cursor}, expected {total_bytes}')


def config_digest(config: dict[str, Any]) -> str:
    payload = json.dumps(
        {
            key: value
            for key, value in config.items()
            if not key.startswith('_')
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(',', ':'),
    )
    return f'sha256:{hashlib.sha256(payload.encode("utf-8")).hexdigest()}'


def source_hashes_digest(source_hashes: dict[str, str]) -> str:
    payload = json.dumps(
        dict(sorted(source_hashes.items())),
        ensure_ascii=False,
        separators=(',', ':'),
    )
    return f'sha256:{hashlib.sha256(payload.encode("utf-8")).hexdigest()}'


def build_retrieval_windows(
    units: list[StructureUnit],
    config: dict[str, Any],
) -> list[RetrievalWindow]:
    settings = config.get('retrievalWindow', {})
    before_units = max(0, int(settings.get('beforeUnits', 1)))
    after_units = max(0, int(settings.get('afterUnits', 1)))
    max_bytes = max(1, int(settings.get('maxBytes', 12000)))
    windows: list[RetrievalWindow] = []
    by_chapter: dict[str, list[StructureUnit]] = {}
    for unit in units:
        by_chapter.setdefault(unit.chapterId, []).append(unit)
    for chapter_units in by_chapter.values():
        for primary_index, primary in enumerate(chapter_units):
            selected: list[StructureUnit] = [primary]
            total = len(primary.markdown.encode('utf-8'))
            for distance in range(1, max(before_units, after_units) + 1):
                candidates: list[StructureUnit] = []
                if distance <= before_units and primary_index - distance >= 0:
                    candidates.append(chapter_units[primary_index - distance])
                if distance <= after_units and primary_index + distance < len(chapter_units):
                    candidates.append(chapter_units[primary_index + distance])
                for candidate in candidates:
                    size = len(candidate.markdown.encode('utf-8'))
                    if total + size <= max_bytes:
                        selected.append(candidate)
                        total += size
            selected.sort(key=lambda unit: unit.sourceSpan.startByte)
            windows.append(RetrievalWindow(
                id=(
                    'textbook-window:'
                    f'{primary.id.removeprefix("textbook-unit:")}'
                ),
                primaryUnitId=primary.id,
                segments=[
                    WindowSegment(
                        owningUnitId=unit.id,
                        markdown=unit.markdown,
                        sourceSpan=unit.sourceSpan,
                    )
                    for unit in selected
                ],
            ))
    return windows


def build_navigation(units: list[StructureUnit], book_id: str) -> dict[str, Any]:
    children: dict[str, list[str]] = {unit.id: [] for unit in units}
    for unit in units:
        if unit.parentId is not None:
            children[unit.parentId].append(unit.id)
    entries = [
        NavigationEntry(
            unitId=unit.id,
            parentId=unit.parentId,
            childIds=children[unit.id],
            previousUnitId=units[index - 1].id if index else None,
            nextUnitId=units[index + 1].id if index + 1 < len(units) else None,
            contentByteIndex=unit.sourceSpan,
        )
        for index, unit in enumerate(units)
    ]
    return {
        'recordType': 'navigation-index',
        'schemaVersion': SCHEMA_VERSION,
        'bookId': book_id,
        'entries': [asdict(entry) for entry in entries],
    }


def _body_without_boundary(markdown: str) -> str:
    lines = markdown.splitlines()
    if lines and (
        re.match(r'^#{1,6}\s+', lines[0])
        or re.match(
            r'^(?:第[一二三四五六七八九十百〇零]+章|chapter\s+\d+|'
            r'例\s*\d+(?:[.．－—–-]\d+)+|(?:解|证明)(?:\s|[：:]|$)|'
            r'\d+(?:[.．－—–-]\d+)+|[（(][0-9一二三四五六七八九十]+[）)])',
            lines[0].strip(),
            re.IGNORECASE,
        )
    ):
        lines = lines[1:]
    return re.sub(r'[\s#*_`>-]+', '', '\n'.join(lines))


def _number_parts(value: str | None) -> tuple[tuple[int, ...], tuple[int, ...]] | None:
    if not value or not re.fullmatch(r'\d+(?:\.\d+)*', value):
        return None
    parts = tuple(int(part) for part in value.split('.'))
    return parts[:-1], parts


def _configured_nesting_exception(
    config: dict[str, Any],
    unit: StructureUnit,
) -> bool:
    for override in config.get('overrides', []):
        if override.get('action') not in {'allow-level-skip', 'set-boundary'}:
            continue
        if not (
            override.get('action') == 'allow-level-skip'
            or override.get('allowLevelSkip') is True
        ):
            continue
        if _selector_matches(
            override['selector'],
            source_path=unit.sourceSpan.sourcePath,
            line=unit.sourceSpan.startLine,
            title=unit.title,
        ):
            return True
    return False


def _anomaly_disposition(
    config: dict[str, Any],
    *,
    anomaly_id: str,
    kind: str,
    source_path: str,
    line: int,
) -> tuple[str, str | None, str | None]:
    if config.get('_reviewSourceMatches') is False:
        return 'unresolved', None, None
    ledger_entries = config.get('_reviewLedger', {}).get('anomalies', [])
    matched = [
        entry
        for entry in ledger_entries
        if entry.get('id') == anomaly_id
    ]
    if not matched:
        matched = [
            entry
            for entry in ledger_entries
            if (
                entry.get('sourcePath') == source_path
                and entry.get('line') == line
                and entry.get('kind') == kind
            )
        ]
    decisions = {
        (entry.get('disposition'), entry.get('reason'))
        for entry in matched
    }
    if len(decisions) > 1:
        raise StructureAmbiguityError(
            f'{source_path}:{line}: conflicting anomaly dispositions match {kind}'
        )
    if not matched:
        return 'unresolved', None, None
    disposition = str(matched[0].get('disposition', '')).strip()
    reason = str(matched[0].get('reason', '')).strip()
    if disposition not in {
        'accepted-structure',
        'false-positive',
        'parser-corrected',
        'source-corrected',
    } or not reason:
        raise ValueError(
            f'{source_path}:{line}: reviewed anomaly disposition requires '
            'a supported disposition and reason'
        )
    return disposition, reason, f'exact-ledger:{anomaly_id}'


def detect_anomalies(
    *,
    units: list[StructureUnit],
    markdown_by_source: dict[str, str],
    config: dict[str, Any],
) -> list[StructureAnomaly]:
    thresholds = config.get('auditThresholds', {})
    minimum_bytes = max(0, int(thresholds.get('minimumUnitBytes', 32)))
    maximum_bytes = max(minimum_bytes + 1, int(
        thresholds.get('maximumUnitBytes', 24000)
    ))
    units_by_id = {unit.id: unit for unit in units}
    raw: list[tuple[str, str, SourceSpan, StructureUnit | None]] = []

    for unit in units:
        size = unit.sourceSpan.endByte - unit.sourceSpan.startByte
        if not _body_without_boundary(unit.markdown):
            raw.append(('empty-unit', 'unit contains no body after its boundary', unit.sourceSpan, unit))
        elif size < minimum_bytes:
            raw.append((
                'undersized-unit',
                f'unit contains {size} bytes; minimum is {minimum_bytes}',
                unit.sourceSpan,
                unit,
            ))
        if size > maximum_bytes:
            raw.append((
                'oversized-unit',
                f'unit contains {size} bytes; maximum is {maximum_bytes}',
                unit.sourceSpan,
                unit,
            ))
        if unit.parentId is not None:
            parent = units_by_id[unit.parentId]
            if unit.level > parent.level + 1 and not _configured_nesting_exception(config, unit):
                raw.append((
                    'unexpected-nesting',
                    f'unit level {unit.level} follows parent level {parent.level}',
                    unit.sourceSpan,
                    unit,
                ))

    siblings: dict[tuple[str, str], list[StructureUnit]] = {}
    for unit in units:
        siblings.setdefault((unit.chapterId, unit.parentId or ''), []).append(unit)
    for group in siblings.values():
        numbered = [
            (unit, _number_parts(unit.naturalNumber))
            for unit in group
        ]
        numbered = [(unit, parts) for unit, parts in numbered if parts is not None]
        for (previous, previous_parts), (current, current_parts) in zip(
            numbered,
            numbered[1:],
        ):
            assert previous_parts is not None and current_parts is not None
            if (
                previous_parts[0] == current_parts[0]
                and current_parts[1][-1] != previous_parts[1][-1] + 1
            ):
                raw.append((
                    'number-discontinuity',
                    f'{previous.naturalNumber} is followed by {current.naturalNumber}',
                    current.sourceSpan,
                    current,
                ))

    enabled = set(config.get('enabledNumberingRules', []))
    broad_numbering = re.compile(
        r'^(?:#{1,6}\s+)?(?:第[一二三四五六七八九十百〇零]+章|'
        r'chapter\s+\d+|example\s+\d+(?:[.．－—–-]\d+)+|'
        r'\d+(?:[.．－—–-]\d+)+|[（(][0-9一二三四五六七八九十]+[）)])',
        re.IGNORECASE,
    )
    for source_path, markdown in markdown_by_source.items():
        lines, offsets = _line_offsets(markdown)
        in_fence = False
        in_display_math = False
        for index, line in enumerate(lines):
            visible = line.rstrip('\r\n')
            if re.match(r'^\s*```', visible):
                in_fence = not in_fence
                continue
            if not in_fence and visible.strip() == '$$':
                in_display_math = not in_display_math
                continue
            if in_fence or in_display_math:
                continue
            heading = re.match(r'^(#{1,6})\s+(.+?)\s*#*\s*$', visible)
            candidate = heading.group(2).strip() if heading else visible.strip()
            if (
                candidate
                and len(candidate) <= 200
                and broad_numbering.match(visible.strip())
                and _rule_boundary(candidate, enabled) is None
            ):
                span = _span(source_path, lines, offsets, index, index + 1)
                raw.append((
                    'unrecognized-natural-numbering',
                    f'number-like boundary was not recognized: {candidate[:120]}',
                    span,
                    None,
                ))

    anomalies: list[StructureAnomaly] = []
    for kind, message, span, unit in raw:
        identity = (
            f'{kind}\0{span.sourcePath}\0{span.startLine}\0'
            f'{unit.id if unit else ""}'
        )
        anomaly_id = f'textbook-anomaly:{hashlib.sha256(identity.encode()).hexdigest()[:20]}'
        disposition, reason, rule = _anomaly_disposition(
            config,
            anomaly_id=anomaly_id,
            kind=kind,
            source_path=span.sourcePath,
            line=span.startLine,
        )
        anomalies.append(StructureAnomaly(
            id=anomaly_id,
            kind=kind,
            severity='error' if disposition == 'unresolved' else 'reviewed',
            message=message,
            sourceSpan=span,
            unitId=unit.id if unit else None,
            disposition=disposition,
            dispositionReason=reason,
            dispositionRule=rule,
        ))
    return sorted(
        anomalies,
        key=lambda anomaly: (
            anomaly.sourceSpan.sourcePath,
            anomaly.sourceSpan.startByte,
            anomaly.kind,
        ),
    )


def build_distributed_samples(
    units: list[StructureUnit],
    config: dict[str, Any],
) -> list[StructureSample]:
    samples: list[StructureSample] = []
    chapters: dict[str, list[StructureUnit]] = {}
    for unit in units:
        chapters.setdefault(unit.chapterId, []).append(unit)
    for chapter_id, chapter_units in chapters.items():
        selected: dict[str, set[str]] = {}

        def add(unit: StructureUnit, reason: str) -> None:
            selected.setdefault(unit.id, set()).add(reason)

        add(chapter_units[0], 'boundary-start')
        add(chapter_units[-1], 'boundary-end')
        deepest_level = max(unit.level for unit in chapter_units)
        deepest = [unit for unit in chapter_units if unit.level == deepest_level]
        for index in sorted({0, len(deepest) // 2, len(deepest) - 1}):
            add(deepest[index], 'deepest-distributed')
        numbering_groups: dict[
            tuple[str | None, str, tuple[int, ...]],
            list[StructureUnit],
        ] = {}
        for unit in chapter_units:
            parts = _number_parts(unit.naturalNumber)
            if parts is None:
                continue
            numbering_groups.setdefault(
                (unit.parentId, unit.kind, parts[0]),
                [],
            ).append(unit)
        for group in numbering_groups.values():
            add(group[0], 'numbering-sequence-start')
            add(group[-1], 'numbering-sequence-end')
        by_size = sorted(
            chapter_units,
            key=lambda unit: (
                unit.sourceSpan.endByte - unit.sourceSpan.startByte,
                unit.sourceSpan.startByte,
            ),
        )
        add(by_size[0], 'minimum-size')
        add(by_size[-1], 'maximum-size')
        for unit in chapter_units:
            if unit.id not in selected:
                continue
            identity = f'{chapter_id}\0{unit.id}'
            sample_id = f'textbook-sample:{hashlib.sha256(identity.encode()).hexdigest()[:20]}'
            ledger_entry = None
            if config.get('_reviewSourceMatches') is not False:
                ledger_entry = next((
                    entry
                    for entry in config.get('_reviewLedger', {}).get('samples', [])
                    if (
                        entry.get('id') == sample_id
                        and entry.get('sourcePath') == unit.sourceSpan.sourcePath
                        and entry.get('line') == unit.sourceSpan.startLine
                    )
                ), None)
            samples.append(StructureSample(
                id=sample_id,
                chapterId=chapter_id,
                unitId=unit.id,
                reasons=sorted(selected[unit.id]),
                sourceSpan=unit.sourceSpan,
                reviewStatus='reviewed' if ledger_entry else 'pending',
                reviewEvidence=(
                    str(ledger_entry.get('evidence'))
                    if ledger_entry and ledger_entry.get('evidence')
                    else None
                ),
            ))
    return samples


def _read_json(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError(f'Expected JSON object: {path}')
    return data


def _manifest_resource_id(manifest: dict[str, Any]) -> str:
    resource_id = manifest.get('bookId') or manifest.get('referenceId')
    if not isinstance(resource_id, str) or not resource_id:
        raise ValueError('Resource manifest must define bookId or referenceId')
    return resource_id


def _manifest_units(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    raw = manifest.get('chapters')
    if not isinstance(raw, list):
        raw = manifest.get('sections')
    if not isinstance(raw, list):
        return []
    return [unit for unit in raw if isinstance(unit, dict)]


def _source_book_dir(
    authoring_root: Path,
    book_id: str,
    source_kind: str,
) -> Path:
    category = 'references' if source_kind == 'reference-collection' else 'textbooks'
    candidate = authoring_root / category / book_id
    if candidate.is_dir():
        return candidate
    direct = authoring_root / book_id
    if direct.is_dir():
        return direct
    raise FileNotFoundError(f'Missing authoring source for {book_id}: {candidate}')


def _resolve_unit_source(
    book_dir: Path,
    unit: dict[str, Any],
) -> tuple[Path, Path]:
    unit_id = str(unit.get('id') or unit.get('slug') or '')
    directory = str(unit.get('directory') or unit_id)
    unit_dir = book_dir / directory
    manifest_name = Path(str(unit.get('manifestPath') or 'manifest.json')).name
    unit_manifest_path = unit_dir / manifest_name
    unit_manifest = _read_json(unit_manifest_path)
    declared = (
        unit.get('textbookPath')
        or unit.get('referencePath')
        or unit_manifest.get('textbookPath')
        or unit_manifest.get('referencePath')
        or ('reference.md' if 'referenceId' in unit_manifest else 'textbook.md')
    )
    declared_path = Path(str(declared))
    candidates = [
        book_dir / declared_path,
        unit_dir / declared_path.name,
    ]
    markdown_path = next((path for path in candidates if path.is_file()), candidates[-1])
    if not markdown_path.is_file():
        raise FileNotFoundError(f'Missing canonical Markdown: {markdown_path}')
    return unit_manifest_path, markdown_path


def _sha256_file(path: Path) -> str:
    return f'sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}'


def _git_revision() -> str:
    result = subprocess.run(
        ['git', 'rev-parse', 'HEAD'],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def _json_record(value: Any) -> dict[str, Any]:
    return asdict(value) if hasattr(value, '__dataclass_fields__') else value


def validate_export_closure(result: ExportResult) -> None:
    manifest = result.manifest
    units = result.units
    anchors = result.anchors
    windows = result.windows
    navigation_entries = result.navigation.get('entries', [])
    unit_by_id = {unit.id: unit for unit in units}
    if len(unit_by_id) != len(units):
        raise ValueError('closure: duplicate structure unit ids')
    natural_paths = {
        (unit.bookId, unit.edition, tuple(unit.structuralPath))
        for unit in units
    }
    if len(natural_paths) != len(units):
        raise ValueError('closure: duplicate structure natural paths')
    if any(unit.bookId != manifest['bookId'] for unit in units):
        raise ValueError('closure: structure unit belongs to another book')

    anchor_by_id = {anchor.id: anchor for anchor in anchors}
    if len(anchor_by_id) != len(anchors):
        raise ValueError('closure: duplicate fragment anchor ids')
    for unit in units:
        if unit.parentId is not None and unit.parentId not in unit_by_id:
            raise ValueError(f'closure: missing parent {unit.parentId}')
        if any(ancestor_id not in unit_by_id for ancestor_id in unit.ancestorIds):
            raise ValueError(f'closure: missing ancestor for {unit.id}')
        for anchor_id in unit.fragmentAnchorIds:
            anchor = anchor_by_id.get(anchor_id)
            if anchor is None or anchor.owningUnitId != unit.id:
                raise ValueError(f'closure: invalid anchor reference {anchor_id}')
    for anchor in anchors:
        if anchor.owningUnitId not in unit_by_id:
            raise ValueError(f'closure: missing anchor owner {anchor.id}')

    window_ids = {window.id for window in windows}
    if len(window_ids) != len(windows):
        raise ValueError('closure: duplicate retrieval window ids')
    if window_ids & (set(unit_by_id) | set(anchor_by_id)):
        raise ValueError('closure: retrieval window is a citation identity')
    for window in windows:
        if window.citationTarget is not False:
            raise ValueError(f'closure: window is citation target {window.id}')
        if window.primaryUnitId not in unit_by_id:
            raise ValueError(f'closure: missing primary unit for {window.id}')
        if not window.segments:
            raise ValueError(f'closure: empty retrieval window {window.id}')
        for segment in window.segments:
            owner = unit_by_id.get(segment.owningUnitId)
            if owner is None or segment.sourceSpan != owner.sourceSpan:
                raise ValueError(f'closure: invalid window segment in {window.id}')

    navigation_by_id = {
        entry.get('unitId'): entry
        for entry in navigation_entries
        if isinstance(entry, dict)
    }
    if set(navigation_by_id) != set(unit_by_id):
        raise ValueError('closure: navigation does not cover exactly the unit set')
    for unit_id, entry in navigation_by_id.items():
        unit = unit_by_id[unit_id]
        if entry.get('parentId') != unit.parentId:
            raise ValueError(f'closure: navigation parent mismatch for {unit_id}')
        if any(child_id not in unit_by_id for child_id in entry.get('childIds', [])):
            raise ValueError(f'closure: missing navigation child for {unit_id}')
        for key in ('previousUnitId', 'nextUnitId'):
            value = entry.get(key)
            if value is not None and value not in unit_by_id:
                raise ValueError(f'closure: missing {key} for {unit_id}')
        if entry.get('contentByteIndex') != asdict(unit.sourceSpan):
            raise ValueError(f'closure: byte index mismatch for {unit_id}')

    for anomaly in result.anomalies:
        if anomaly.unitId is not None and anomaly.unitId not in unit_by_id:
            raise ValueError(f'closure: anomaly references missing unit {anomaly.id}')
    for sample in result.samples:
        if sample.unitId not in unit_by_id:
            raise ValueError(f'closure: sample references missing unit {sample.id}')

    expected_counts = {
        'structureUnits': len(units),
        'fragmentAnchors': len(anchors),
        'retrievalWindows': len(windows),
        'navigationEntries': len(navigation_entries),
        'anomalies': len(result.anomalies),
        'unresolvedAnomalies': sum(
            anomaly.disposition == 'unresolved'
            for anomaly in result.anomalies
        ),
        'samples': len(result.samples),
        'pendingSamples': sum(
            sample.reviewStatus == 'pending'
            for sample in result.samples
        ),
    }
    if manifest.get('counts') != expected_counts:
        raise ValueError('closure: manifest counts do not match export records')


def build_export(
    *,
    book_id: str,
    authoring_root: Path = DEFAULT_AUTHORING_ROOT,
    config_root: Path = CONFIG_ROOT,
    source_revision: str | None = None,
) -> ExportResult:
    config = load_parser_config(book_id, config_root)
    book_dir = _source_book_dir(
        authoring_root,
        book_id,
        str(config.get('sourceKind', 'textbook')),
    )
    manifest_path = book_dir / 'manifest.json'
    source_manifest = _read_json(manifest_path)
    if _manifest_resource_id(source_manifest) != book_id:
        raise ValueError(f'Authoring manifest identity mismatch: {manifest_path}')
    edition = str(config.get('edition') or source_manifest.get('edition') or '')
    if not edition:
        raise ValueError(f'Missing edition for {book_id}')

    units: list[StructureUnit] = []
    anchors: list[FragmentAnchor] = []
    markdown_by_source: dict[str, str] = {}
    source_files = [manifest_path]
    manifest_units = _manifest_units(source_manifest)
    if not manifest_units:
        raise ValueError(f'No chapters or sections declared by {manifest_path}')
    for index, source_unit in enumerate(manifest_units, start=1):
        chapter_id = str(
            source_unit.get('id')
            or source_unit.get('slug')
            or f'chapter-{index:02d}'
        )
        unit_manifest_path, markdown_path = _resolve_unit_source(book_dir, source_unit)
        source_files.extend([unit_manifest_path, markdown_path])
        source_path = markdown_path.relative_to(authoring_root).as_posix()
        markdown = markdown_path.read_text(encoding='utf-8')
        parsed = parse_markdown(
            book_id=book_id,
            edition=edition,
            chapter_id=chapter_id,
            markdown=markdown,
            config=config,
            source_path=source_path,
        )
        units.extend(parsed.units)
        anchors.extend(parsed.anchors)
        markdown_by_source[source_path] = markdown

    unit_ids = [unit.id for unit in units]
    if len(unit_ids) != len(set(unit_ids)):
        raise StructureAmbiguityError(f'{book_id}: duplicate structure unit ids across sources')
    natural_paths = [
        (unit.bookId, unit.edition, tuple(unit.structuralPath))
        for unit in units
    ]
    if len(natural_paths) != len(set(natural_paths)):
        raise StructureAmbiguityError(f'{book_id}: duplicate natural paths across sources')

    source_hashes = {
        path.relative_to(authoring_root).as_posix(): _sha256_file(path)
        for path in sorted(set(source_files))
    }
    configured_review_digest = config.get('reviewSourceDigest')
    config['_reviewSourceMatches'] = (
        isinstance(configured_review_digest, str)
        and configured_review_digest == source_hashes_digest(source_hashes)
    )
    windows = build_retrieval_windows(units, config)
    navigation = build_navigation(units, book_id)
    anomalies = detect_anomalies(
        units=units,
        markdown_by_source=markdown_by_source,
        config=config,
    )
    samples = build_distributed_samples(units, config)
    by_disposition: dict[str, int] = {}
    for anomaly in anomalies:
        by_disposition[anomaly.disposition] = (
            by_disposition.get(anomaly.disposition, 0) + 1
        )
    counts = {
        'structureUnits': len(units),
        'fragmentAnchors': len(anchors),
        'retrievalWindows': len(windows),
        'navigationEntries': len(navigation['entries']),
        'anomalies': len(anomalies),
        'unresolvedAnomalies': by_disposition.get('unresolved', 0),
        'samples': len(samples),
        'pendingSamples': sum(
            sample.reviewStatus == 'pending'
            for sample in samples
        ),
    }
    manifest = {
        'recordType': 'export-manifest',
        'schemaVersion': SCHEMA_VERSION,
        'bookId': book_id,
        'edition': edition,
        'sourceRevision': source_revision or _git_revision(),
        'sourceHashes': source_hashes,
        'parserConfigHash': config_digest(config),
        'counts': counts,
        'anomalyDisposition': {
            'status': (
                'unresolved'
                if counts['unresolvedAnomalies']
                else 'reviewed'
            ),
            'byDisposition': dict(sorted(by_disposition.items())),
        },
        'sampleReview': {
            'status': 'pending' if counts['pendingSamples'] else 'reviewed',
            'reviewed': counts['samples'] - counts['pendingSamples'],
            'pending': counts['pendingSamples'],
        },
        'outputs': {
            'units': 'units.jsonl',
            'anchors': 'anchors.jsonl',
            'windows': 'windows.jsonl',
            'navigation': 'navigation.json',
            'anomalies': 'anomalies.jsonl',
            'samples': 'samples.jsonl',
        },
        'productionConnected': False,
    }
    result = ExportResult(
        manifest=manifest,
        units=units,
        anchors=anchors,
        windows=windows,
        navigation=navigation,
        anomalies=anomalies,
        samples=samples,
    )
    validate_export_closure(result)
    return result


def _write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def _write_jsonl(path: Path, values: list[Any]) -> None:
    content = '\n'.join(
        json.dumps(_json_record(value), ensure_ascii=False)
        for value in values
    )
    path.write_text(f'{content}\n' if content else '', encoding='utf-8')


def write_export(result: ExportResult, runtime_root: Path = DEFAULT_RUNTIME_ROOT) -> Path:
    runtime_root.mkdir(parents=True, exist_ok=True)
    output_dir = runtime_root / result.manifest['bookId']
    temporary = Path(tempfile.mkdtemp(
        prefix=f'.{result.manifest["bookId"]}-',
        dir=runtime_root,
    ))
    try:
        _write_jsonl(temporary / 'units.jsonl', result.units)
        _write_jsonl(temporary / 'anchors.jsonl', result.anchors)
        _write_jsonl(temporary / 'windows.jsonl', result.windows)
        _write_json(temporary / 'navigation.json', result.navigation)
        _write_jsonl(temporary / 'anomalies.jsonl', result.anomalies)
        _write_jsonl(temporary / 'samples.jsonl', result.samples)
        _write_json(temporary / 'manifest.json', result.manifest)
        validate_written_export(temporary)
        if output_dir.exists():
            shutil.rmtree(output_dir)
        os.replace(temporary, output_dir)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return output_dir


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in path.read_text(encoding='utf-8').splitlines()
        if line.strip()
    ]


def _source_span_from_record(value: dict[str, Any]) -> SourceSpan:
    return SourceSpan(**value)


def validate_written_export(output_dir: Path) -> None:
    manifest = _read_json(output_dir / 'manifest.json')
    units = [
        StructureUnit(
            **{
                key: value
                for key, value in record.items()
                if key not in {'recordType', 'schemaVersion', 'sourceSpan'}
            },
            sourceSpan=_source_span_from_record(record['sourceSpan']),
        )
        for record in _read_jsonl(output_dir / 'units.jsonl')
    ]
    anchors = [
        FragmentAnchor(
            **{
                key: value
                for key, value in record.items()
                if key not in {'recordType', 'schemaVersion', 'sourceSpan'}
            },
            sourceSpan=_source_span_from_record(record['sourceSpan']),
        )
        for record in _read_jsonl(output_dir / 'anchors.jsonl')
    ]
    windows = [
        RetrievalWindow(
            id=record['id'],
            primaryUnitId=record['primaryUnitId'],
            segments=[
                WindowSegment(
                    owningUnitId=segment['owningUnitId'],
                    markdown=segment['markdown'],
                    sourceSpan=_source_span_from_record(segment['sourceSpan']),
                )
                for segment in record['segments']
            ],
        )
        for record in _read_jsonl(output_dir / 'windows.jsonl')
    ]
    anomalies = [
        StructureAnomaly(
            **{
                key: value
                for key, value in record.items()
                if key not in {'recordType', 'schemaVersion', 'sourceSpan'}
            },
            sourceSpan=_source_span_from_record(record['sourceSpan']),
        )
        for record in _read_jsonl(output_dir / 'anomalies.jsonl')
    ]
    samples = [
        StructureSample(
            **{
                key: value
                for key, value in record.items()
                if key not in {'recordType', 'schemaVersion', 'sourceSpan'}
            },
            sourceSpan=_source_span_from_record(record['sourceSpan']),
        )
        for record in _read_jsonl(output_dir / 'samples.jsonl')
    ]
    validate_export_closure(ExportResult(
        manifest=manifest,
        units=units,
        anchors=anchors,
        windows=windows,
        navigation=_read_json(output_dir / 'navigation.json'),
        anomalies=anomalies,
        samples=samples,
    ))


def _relevant_input_paths(
    *,
    result: ExportResult,
    authoring_root: Path,
    config_root: Path,
) -> list[Path]:
    paths = [
        Path(__file__).resolve(),
        Path(__file__).with_name('export_structured_textbook_runtime_v2.py').resolve(),
        Path(__file__).with_name('validate_structured_textbook_runtime_v2.mjs').resolve(),
        SCHEMA_PATH.resolve(),
        (config_root / f'{result.manifest["bookId"]}.json').resolve(),
    ]
    config = load_parser_config(result.manifest['bookId'], config_root)
    if config.get('reviewLedger'):
        paths.append((config_root / str(config['reviewLedger'])).resolve())
    paths.extend(
        (authoring_root / source_path).resolve()
        for source_path in result.manifest['sourceHashes']
    )
    return paths


def _dirty_relevant_inputs(paths: list[Path]) -> list[str]:
    repo_root = REPO_ROOT.resolve()
    repo_paths = [
        path
        for path in paths
        if path == repo_root or repo_root in path.parents
    ]
    if not repo_paths:
        return []
    result = subprocess.run(
        ['git', 'status', '--porcelain=v1', '--', *map(str, repo_paths)],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(line for line in result.stdout.splitlines() if line.strip())


def export_resources(
    *,
    book_ids: list[str],
    authoring_root: Path = DEFAULT_AUTHORING_ROOT,
    runtime_root: Path = DEFAULT_RUNTIME_ROOT,
    config_root: Path = CONFIG_ROOT,
    audit_only: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    reports: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    source_revision = _git_revision()
    built: list[ExportResult] = []
    for book_id in book_ids:
        try:
            result = build_export(
                book_id=book_id,
                authoring_root=authoring_root,
                config_root=config_root,
                source_revision=source_revision,
            )
            built.append(result)
            reports.append({
                'bookId': book_id,
                'auditOnly': audit_only,
                'sourceRevision': result.manifest['sourceRevision'],
                'counts': result.manifest['counts'],
                'anomalyDisposition': result.manifest['anomalyDisposition'],
                'sampleReview': result.manifest['sampleReview'],
            })
        except Exception as error:
            failures.append({
                'bookId': book_id,
                'errorType': type(error).__name__,
                'error': str(error),
            })
    if failures:
        return reports, failures
    relevant_paths = [
        path
        for result in built
        for path in _relevant_input_paths(
            result=result,
            authoring_root=authoring_root,
            config_root=config_root,
        )
    ]
    dirty_inputs = _dirty_relevant_inputs(relevant_paths)
    if dirty_inputs:
        if audit_only:
            for result in built:
                result.manifest['sourceRevision'] = f'{source_revision}+dirty'
            for report in reports:
                report['sourceRevision'] = f'{source_revision}+dirty'
        else:
            return reports, [{
                'bookId': '*',
                'errorType': 'DirtyInputError',
                'error': (
                    'write export requires clean parser, schema, config, review ledger, '
                    f'and authoring inputs: {"; ".join(dirty_inputs)}'
                ),
            }]
    unresolved = [
        result
        for result in built
        if (
            result.manifest['counts']['unresolvedAnomalies'] > 0
            or result.manifest['counts']['pendingSamples'] > 0
        )
    ]
    if unresolved and not audit_only:
        return reports, [{
            'bookId': result.manifest['bookId'],
            'errorType': 'UnresolvedReviewError',
            'error': (
                f'{result.manifest["counts"]["unresolvedAnomalies"]} unresolved anomalies; '
                f'{result.manifest["counts"]["pendingSamples"]} pending samples'
            ),
        } for result in unresolved]
    if not audit_only:
        for result in built:
            write_export(result, runtime_root)
    return reports, failures


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Export disconnected structured textbook runtime v2 artifacts.',
    )
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--book', action='append', dest='books')
    selection.add_argument('--resource-set', type=Path)
    parser.add_argument('--audit-only', action='store_true')
    parser.add_argument('--authoring-root', type=Path)
    parser.add_argument('--runtime-root', type=Path, default=DEFAULT_RUNTIME_ROOT)
    parser.add_argument('--config-root', type=Path, default=CONFIG_ROOT)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.resource_set is not None:
        resource_set = load_textbook_resource_set(args.resource_set)
        book_ids = resource_set['books']
        config_root = Path.cwd() / resource_set['configRoot']
        authoring_root = (
            args.authoring_root
            if args.authoring_root is not None
            else Path.cwd() / resource_set['sourceRoot']
        )
    else:
        book_ids = args.books
        config_root = args.config_root
        authoring_root = args.authoring_root or DEFAULT_AUTHORING_ROOT
    reports, failures = export_resources(
        book_ids=book_ids,
        authoring_root=authoring_root,
        runtime_root=args.runtime_root,
        config_root=config_root,
        audit_only=args.audit_only,
    )
    print(json.dumps(
        {'reports': reports, 'failures': failures},
        ensure_ascii=False,
        indent=2,
    ))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
