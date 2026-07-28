#!/usr/bin/env python3
"""Disconnected textbook illustration retrieval evaluation.

The module intentionally uses only the Python standard library.  It builds a
small, reviewable dataset from the v1 figure indexes and v2 structure runtime,
then evaluates three embedding variants without connecting any artifact to the
production application.
"""

from __future__ import annotations

import argparse
import base64
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
import email.utils
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import time
from typing import Any, Iterable, Sequence
import urllib.error
import urllib.request
import zlib


REPO_ROOT = Path(__file__).resolve().parents[2]
COURSE_ROOT = REPO_ROOT / 'course-content'
DEFAULT_V1_ROOT = COURSE_ROOT / 'runtime' / 'resources' / 'textbooks'
DEFAULT_V2_ROOT = COURSE_ROOT / 'runtime' / 'resources' / 'textbooks-v2'
DEFAULT_CACHE_DIR = (
    COURSE_ROOT
    / 'runtime'
    / 'resources'
    / 'textbook-visual-retrieval-experiment'
)
FORMAT_VERSION = 'textbook-visual-retrieval-evaluation.v1'
TEXT_MODEL = 'BAAI/bge-m3'
VL_MODEL = 'Qwen/Qwen3-VL-Embedding-8B'
TOP_K = 10
DEFAULT_PER_STRATUM = 20
DEFAULT_BATCH_SIZE = 4
MAX_OWNING_TEXT = 2000
DEFAULT_ENDPOINT = 'https://api.siliconflow.cn/v1/embeddings'
DEFAULT_USER_INFO_ENDPOINT = 'https://api.siliconflow.cn/v1/user/info'
MAX_RETRIES = 4
RETRY_BASE_SECONDS = 0.25
MAX_RETRY_AFTER_SECONDS = 30.0
STRATA = (
    'root-locus',
    'frequency-domain',
    'response-curve',
    'block-diagram',
    'general',
)
FUSION_CONTRACT = (
    'qwen-image-and-description-text-or-title-when-description-is-null-'
    'vectors-are-individually-l2-normalized-then-arithmetic-meaned-and-'
    'l2-normalized-v1'
)
_SAFE_TRACE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$')
_SHA256 = re.compile(r'^(?:sha256:)?[0-9a-f]{64}$')
_GIT_REVISION = re.compile(r'^[0-9a-f]{40}$')
_RFC3339 = re.compile(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
    r'(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$',
)
_SAMPLE_KEYS = {
    'recordType',
    'formatVersion',
    'sampleId',
    'bookId',
    'edition',
    'owningUnitId',
    'anchorId',
    'title',
    'description',
    'descriptionReviewState',
    'owningText',
    'sourceImage',
    'sha256',
    'stratum',
    'width',
    'height',
    'productionConnected',
}
_QUERY_KEYS = {
    'recordType',
    'formatVersion',
    'queryId',
    'query',
    'stratum',
    'acceptedSampleIds',
    'candidatePopulationHash',
    'productionConnected',
}
_STRATIFICATION_REVIEW_KEYS = {
    'recordType',
    'formatVersion',
    'sampleId',
    'assignedStratum',
    'reviewActor',
    'reviewedAt',
    'imageQuality',
    'queryable',
    'productionConnected',
}


class VisualRetrievalContractError(ValueError):
    """Raised when source or experiment evidence violates the contract."""


class ProviderFailure(RuntimeError):
    """A provider failure containing only safe diagnostic evidence."""

    def __init__(self, failure_type: str, trace_id: str | None = None) -> None:
        super().__init__('SiliconFlow request failed')
        self.failure_type = failure_type
        self.trace_id = _safe_trace(trace_id)


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(',', ':'),
    )


def sha256_bytes(value: bytes) -> str:
    return f'sha256:{hashlib.sha256(value).hexdigest()}'


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return f'sha256:{digest.hexdigest()}'


def _safe_trace(value: Any) -> str | None:
    return value if isinstance(value, str) and _SAFE_TRACE_ID.fullmatch(value) else None


def validate_source_revision(value: Any) -> str:
    if not isinstance(value, str) or not _GIT_REVISION.fullmatch(value):
        raise VisualRetrievalContractError(
            'source revision must be a 40-character lowercase Git commit',
        )
    return value


def clean_git_source_revision(
    repo_root: Path,
    paths: Sequence[Path],
) -> str:
    root = repo_root.resolve()
    relatives: list[str] = []
    for path in paths:
        resolved = path.resolve()
        try:
            relative = resolved.relative_to(root).as_posix()
        except ValueError as error:
            raise VisualRetrievalContractError(
                'source-bound input is outside the Git repository',
            ) from error
        relatives.append(relative)
    try:
        revision_result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as error:
        raise VisualRetrievalContractError('cannot resolve source Git revision') from error
    revision = validate_source_revision(revision_result.stdout.strip())
    for relative in relatives:
        tracked = subprocess.run(
            ['git', 'ls-files', '--error-unmatch', '--', relative],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
        if tracked.returncode != 0:
            raise VisualRetrievalContractError(
                'source-bound input is not tracked at the source revision',
            )
    status = subprocess.run(
        ['git', 'status', '--porcelain', '--untracked-files=all', '--', *relatives],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    if status.returncode != 0:
        raise VisualRetrievalContractError('cannot verify source-bound Git status')
    if status.stdout.strip():
        raise VisualRetrievalContractError(
            'source-bound input differs from the source revision',
        )
    return revision


def _require_record(value: Any, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise VisualRetrievalContractError(f'{name} must be an object')
    return value


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise VisualRetrievalContractError(f'{path} is not valid JSON') from error
    return _require_record(value, str(path))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except (OSError, UnicodeDecodeError) as error:
        raise VisualRetrievalContractError(f'{path} is not readable JSONL') from error
    rows: list[dict[str, Any]] = []
    for number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            rows.append(_require_record(json.loads(line), f'{path}:{number}'))
        except json.JSONDecodeError as error:
            raise VisualRetrievalContractError(
                f'{path}:{number} is not valid JSON',
            ) from error
    return rows


def _atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f'.{path.name}.',
        suffix='.tmp',
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, 'wb') as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def _jsonl_bytes(rows: Iterable[dict[str, Any]]) -> bytes:
    content = '\n'.join(
        json.dumps(row, ensure_ascii=False, sort_keys=True)
        for row in rows
    )
    return (f'{content}\n' if content else '').encode('utf-8')


def _bounded_text(value: Any, limit: int = MAX_OWNING_TEXT) -> str:
    if not isinstance(value, str):
        return ''
    compact = re.sub(r'\s+', ' ', value).strip()
    return compact[:limit]


def png_dimensions(path: Path) -> tuple[int, int]:
    try:
        content = path.read_bytes()
    except OSError as error:
        raise VisualRetrievalContractError('source image is unreadable') from error
    if len(content) < 33 or content[:8] != b'\x89PNG\r\n\x1a\n':
        raise VisualRetrievalContractError('source image is not a valid PNG')
    offset = 8
    width = height = 0
    saw_ihdr = False
    saw_iend = False
    while offset < len(content):
        if offset + 12 > len(content):
            raise VisualRetrievalContractError('source image is a truncated PNG')
        length = struct.unpack('>I', content[offset:offset + 4])[0]
        chunk_type = content[offset + 4:offset + 8]
        data_start = offset + 8
        data_end = data_start + length
        crc_end = data_end + 4
        if crc_end > len(content):
            raise VisualRetrievalContractError('source image is a truncated PNG')
        declared_crc = struct.unpack('>I', content[data_end:crc_end])[0]
        observed_crc = zlib.crc32(chunk_type + content[data_start:data_end]) & 0xffffffff
        if declared_crc != observed_crc:
            raise VisualRetrievalContractError('source image has an invalid PNG checksum')
        if not saw_ihdr:
            if chunk_type != b'IHDR' or length != 13:
                raise VisualRetrievalContractError('source image has an invalid PNG header')
            width, height = struct.unpack('>II', content[data_start:data_start + 8])
            saw_ihdr = True
        if chunk_type == b'IEND':
            if length != 0 or crc_end != len(content):
                raise VisualRetrievalContractError('source image has an invalid PNG ending')
            saw_iend = True
            break
        offset = crc_end
    if not saw_ihdr or not saw_iend:
        raise VisualRetrievalContractError('source image is not a complete PNG')
    if width <= 0 or height <= 0:
        raise VisualRetrievalContractError('source image has invalid dimensions')
    return width, height


def classify_stratum(*texts: str) -> str:
    haystack = ' '.join(texts).casefold()
    patterns = (
        ('root-locus', r'root[\s-]*locus|root loci|根轨迹'),
        (
            'frequency-domain',
            r'bode|nyquist|nichols|frequency response|frequency-domain|'
            r'频率响应|频域|伯德|奈奎斯特|尼柯尔斯|幅相',
        ),
        (
            'response-curve',
            r'step response|impulse response|transient response|response curve|'
            r'unit[- ]step|阶跃响应|脉冲响应|瞬态响应|响应曲线',
        ),
        (
            'block-diagram',
            r'block diagram|block-diagram|signal.flow graph|'
            r'方框图|框图|结构图|信号流图',
        ),
    )
    for stratum, pattern in patterns:
        if re.search(pattern, haystack):
            return stratum
    return 'general'


def extract_image_description(markdown: str, image_basename: str) -> str | None:
    """Return only the description block belonging to an exact image basename."""
    if not isinstance(markdown, str) or not image_basename:
        return None
    image_pattern = re.compile(
        r'!\[[^\]]*\]\((?:[^)\s]*/)?'
        + re.escape(image_basename)
        + r'(?:\s+["\'][^"\']*["\'])?\)\s*$',
    )
    lines = markdown.splitlines()
    matches = [index for index, line in enumerate(lines) if image_pattern.search(line.strip())]
    if len(matches) != 1:
        return None
    index = matches[0] + 1
    while index < len(lines) and not lines[index].strip():
        index += 1
    if index >= len(lines):
        return None
    first = re.fullmatch(r'>\s*Image description:\s*(.*)', lines[index].strip())
    if first is None:
        return None
    parts = [first.group(1).strip()]
    index += 1
    while index < len(lines):
        continuation = re.fullmatch(r'>\s?(.*)', lines[index])
        if continuation is None:
            break
        parts.append(continuation.group(1).strip())
        index += 1
    description = _bounded_text(' '.join(part for part in parts if part), 2000)
    return description or None


def _source_image_path(book_dir: Path, row: dict[str, Any]) -> Path:
    chapter = row.get('chapterId')
    export_path = row.get('exportPath')
    if not isinstance(chapter, str) or not isinstance(export_path, str):
        raise VisualRetrievalContractError('figure source path is invalid')
    name = Path(export_path).name
    if not name or Path(name).suffix.lower() != '.png':
        raise VisualRetrievalContractError('figure source image must be PNG')
    path = book_dir / 'assets' / chapter / name
    try:
        path.resolve().relative_to(book_dir.resolve())
    except ValueError as error:
        raise VisualRetrievalContractError('figure source escapes its runtime book') from error
    return path


def _runtime_relative(book_id: str, chapter_id: str, path: Path) -> str:
    return (
        Path('resources')
        / 'textbooks'
        / book_id
        / 'assets'
        / chapter_id
        / path.name
    ).as_posix()


def _load_v2_book(book_dir: Path) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    manifest = _read_json(book_dir / 'manifest.json')
    if (
        manifest.get('recordType') != 'export-manifest'
        or manifest.get('schemaVersion') != 'structured-textbook-runtime.v2'
        or manifest.get('productionConnected') is not False
        or manifest.get('bookId') != book_dir.name
    ):
        raise VisualRetrievalContractError(f'{book_dir}: invalid v2 manifest')
    units = _read_jsonl(book_dir / 'units.jsonl')
    anchors = _read_jsonl(book_dir / 'anchors.jsonl')
    unit_ids = {unit.get('id') for unit in units}
    if len(unit_ids) != len(units) or None in unit_ids:
        raise VisualRetrievalContractError(f'{book_dir}: duplicate or missing unit id')
    for anchor in anchors:
        if anchor.get('owningUnitId') not in unit_ids:
            raise VisualRetrievalContractError(f'{book_dir}: orphan fragment anchor')
    return manifest, units, anchors


def inventory_figures(
    v1_root: Path = DEFAULT_V1_ROOT,
    v2_root: Path = DEFAULT_V2_ROOT,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not v1_root.is_dir() or not v2_root.is_dir():
        raise VisualRetrievalContractError('both v1 and v2 runtime roots are required')
    samples: list[dict[str, Any]] = []
    rejected: Counter[str] = Counter()
    physical_records = 0
    books: dict[str, dict[str, Any]] = {}
    for v1_book in sorted(path for path in v1_root.iterdir() if path.is_dir()):
        figure_index = v1_book / 'figure-index.jsonl'
        v2_book = v2_root / v1_book.name
        if not figure_index.is_file() or not v2_book.is_dir():
            continue
        v1_manifest = _read_json(v1_book / 'manifest.json')
        v2_manifest, units, anchors = _load_v2_book(v2_book)
        if (
            v1_manifest.get('bookId') != v1_book.name
            or v2_manifest.get('bookId') != v1_book.name
            or (
                v1_manifest.get('edition') is not None
                and v1_manifest.get('edition') != v2_manifest.get('edition')
            )
        ):
            raise VisualRetrievalContractError(f'{v1_book.name}: runtime identity drift')
        by_chapter_units: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for unit in units:
            if unit.get('bookId') != v1_book.name:
                raise VisualRetrievalContractError(f'{v1_book.name}: unit book drift')
            chapter = unit.get('chapterId')
            if isinstance(chapter, str):
                by_chapter_units[chapter].append(unit)
        anchors_by_line: dict[tuple[str, int], list[dict[str, Any]]] = defaultdict(list)
        for anchor in anchors:
            if anchor.get('kind') != 'figure':
                continue
            span = anchor.get('sourceSpan')
            if isinstance(span, dict):
                source_path = span.get('sourcePath')
                line = span.get('startLine')
                if isinstance(source_path, str) and isinstance(line, int):
                    anchors_by_line[(source_path, line)].append(anchor)

        book_rows = _read_jsonl(figure_index)
        physical_records += len(book_rows)
        eligible_before_sampling = 0
        for row in book_rows:
            if row.get('bookId') != v1_book.name:
                raise VisualRetrievalContractError(f'{figure_index}: book id drift')
            if row.get('assetStatus') != 'available':
                rejected['unavailable-asset'] += 1
                continue
            line = row.get('lineNumber')
            chapter = row.get('chapterId')
            if not isinstance(line, int) or line < 1 or not isinstance(chapter, str):
                rejected['invalid-source-locator'] += 1
                continue
            image_path = _source_image_path(v1_book, row)
            if not image_path.is_file():
                rejected['missing-image'] += 1
                continue
            try:
                width, height = png_dimensions(image_path)
            except VisualRetrievalContractError:
                rejected['bad-image'] += 1
                continue
            if min(width, height) < 64:
                rejected['undersized-image'] += 1
                continue
            digest = sha256_file(image_path)
            declared_digest = row.get('sha256')
            if (
                not isinstance(declared_digest, str)
                or digest.removeprefix('sha256:') != declared_digest.removeprefix('sha256:')
            ):
                rejected['image-hash-drift'] += 1
                continue
            containing = []
            for unit in by_chapter_units.get(chapter, []):
                span = unit.get('sourceSpan')
                if (
                    isinstance(span, dict)
                    and isinstance(span.get('sourcePath'), str)
                    and isinstance(span.get('startLine'), int)
                    and isinstance(span.get('endLine'), int)
                    and span['startLine'] <= line <= span['endLine']
                ):
                    containing.append(unit)
            pairs: list[tuple[dict[str, Any], dict[str, Any]]] = []
            for unit in containing:
                span = unit['sourceSpan']
                for anchor in anchors_by_line.get((span['sourcePath'], line), []):
                    if anchor.get('owningUnitId') == unit.get('id'):
                        pairs.append((unit, anchor))
            if len(pairs) != 1:
                rejected['ambiguous-or-missing-v2-join'] += 1
                continue
            unit, anchor = pairs[0]
            title = _bounded_text(row.get('caption'), 1000)
            description = extract_image_description(unit.get('markdown', ''), image_path.name)
            description_value = description or ''
            owning_text = _bounded_text(unit.get('markdown'))
            sample_id = 'visual-sample:' + hashlib.sha256(
                canonical_json({
                    'bookId': v1_book.name,
                    'figureId': row.get('id'),
                    'anchorId': anchor.get('id'),
                    'sha256': digest,
                }).encode('utf-8'),
            ).hexdigest()
            sample = {
                'recordType': 'visual-sample',
                'formatVersion': FORMAT_VERSION,
                'sampleId': sample_id,
                'bookId': v1_book.name,
                'edition': v2_manifest.get('edition'),
                'owningUnitId': unit.get('id'),
                'anchorId': anchor.get('id'),
                'title': title,
                'description': description,
                'descriptionReviewState': 'unverified',
                'owningText': owning_text,
                'sourceImage': _runtime_relative(v1_book.name, chapter, image_path),
                'sha256': digest,
                # Stratification describes the illustration itself.  Owning text
                # often discusses several nearby figures and creates false
                # cross-stratum matches, so it is intentionally excluded here.
                'stratum': classify_stratum(title, description_value),
                'width': width,
                'height': height,
                'productionConnected': False,
            }
            validate_sample(sample)
            samples.append(sample)
            eligible_before_sampling += 1
        books[v1_book.name] = {
            'edition': v2_manifest.get('edition'),
            'physicalRecords': len(book_rows),
            'eligibleRecords': eligible_before_sampling,
            'v1FigureIndexHash': sha256_file(figure_index),
            'v2ManifestHash': sha256_file(v2_book / 'manifest.json'),
            'v2UnitsHash': sha256_file(v2_book / 'units.jsonl'),
            'v2AnchorsHash': sha256_file(v2_book / 'anchors.jsonl'),
        }
    if not books:
        raise VisualRetrievalContractError('no joined textbook runtime books found')
    sample_ids = [row['sampleId'] for row in samples]
    if len(sample_ids) != len(set(sample_ids)):
        raise VisualRetrievalContractError('joined sample identities are not unique')
    summary = {
        'recordType': 'visual-inventory-summary',
        'formatVersion': FORMAT_VERSION,
        'physicalImageRecords': physical_records,
        'eligibleRecords': len(samples),
        'rejectedByReason': dict(sorted(rejected.items())),
        'books': books,
        'productionConnected': False,
    }
    return samples, summary


def stratified_sample(
    candidates: Sequence[dict[str, Any]],
    per_stratum: int = DEFAULT_PER_STRATUM,
    seed: str = FORMAT_VERSION,
) -> list[dict[str, Any]]:
    if isinstance(per_stratum, bool) or not isinstance(per_stratum, int) or per_stratum <= 0:
        raise VisualRetrievalContractError('per-stratum must be a positive integer')
    selected: list[dict[str, Any]] = []
    for stratum in STRATA:
        by_book: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for candidate in candidates:
            if candidate.get('stratum') == stratum:
                by_book[candidate['bookId']].append(candidate)
        for book_rows in by_book.values():
            book_rows.sort(
                key=lambda row: (
                    hashlib.sha256(
                        f'{seed}\0{stratum}\0{row["sampleId"]}'.encode(),
                    ).hexdigest(),
                    row['sampleId'],
                ),
            )
        books = sorted(
            by_book,
            key=lambda book: (
                hashlib.sha256(f'{seed}\0{stratum}\0{book}'.encode()).hexdigest(),
                book,
            ),
        )
        offsets = {book: 0 for book in books}
        while len([row for row in selected if row['stratum'] == stratum]) < per_stratum:
            progressed = False
            for book in books:
                offset = offsets[book]
                if offset >= len(by_book[book]):
                    continue
                selected.append(by_book[book][offset])
                offsets[book] += 1
                progressed = True
                if len([row for row in selected if row['stratum'] == stratum]) >= per_stratum:
                    break
            if not progressed:
                break
    return selected


def _valid_reviewed_at(value: Any) -> bool:
    if not isinstance(value, str) or not _RFC3339.fullmatch(value):
        return False
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return False
    return True


def reviewed_stratified_sample(
    candidates: Sequence[dict[str, Any]],
    review_rows: Sequence[dict[str, Any]],
    per_stratum: int,
) -> tuple[list[dict[str, Any]], list[str]]:
    if isinstance(per_stratum, bool) or not isinstance(per_stratum, int) or per_stratum <= 0:
        raise VisualRetrievalContractError('per-stratum must be a positive integer')
    candidates_by_id = {row['sampleId']: row for row in candidates}
    if len(candidates_by_id) != len(candidates):
        raise VisualRetrievalContractError('candidate sample ids must be unique')
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    actors: set[str] = set()
    counts: Counter[str] = Counter()
    for row in review_rows:
        if set(row) != _STRATIFICATION_REVIEW_KEYS:
            raise VisualRetrievalContractError(
                'stratification review row has unexpected fields',
            )
        sample_id = row.get('sampleId')
        actor = row.get('reviewActor')
        stratum = row.get('assignedStratum')
        if (
            row.get('recordType') != 'visual-stratification-review'
            or row.get('formatVersion') != FORMAT_VERSION
            or not isinstance(sample_id, str)
            or not sample_id
            or sample_id not in candidates_by_id
            or sample_id in seen
            or stratum not in STRATA
            or not isinstance(actor, str)
            or not actor.strip()
            or not _valid_reviewed_at(row.get('reviewedAt'))
            or row.get('imageQuality') != 'pass'
            or row.get('queryable') is not True
            or row.get('productionConnected') is not False
        ):
            raise VisualRetrievalContractError(
                'stratification review row is invalid or not admissible',
            )
        reviewed_sample = dict(candidates_by_id[sample_id])
        reviewed_sample['stratum'] = stratum
        validate_sample(reviewed_sample)
        selected.append(reviewed_sample)
        seen.add(sample_id)
        actors.add(actor.strip())
        counts[stratum] += 1
    expected = {stratum: per_stratum for stratum in STRATA}
    if dict(counts) != expected or len(selected) != per_stratum * len(STRATA):
        raise VisualRetrievalContractError(
            'stratification review does not close every stratum quota',
        )
    return selected, sorted(actors)


def candidate_population_hash(samples: Sequence[dict[str, Any]]) -> str:
    return sha256_bytes(
        canonical_json(sorted(row['sampleId'] for row in samples)).encode('utf-8'),
    )


def validate_sample(row: dict[str, Any]) -> None:
    if set(row) != _SAMPLE_KEYS:
        raise VisualRetrievalContractError('sample has unexpected fields')
    required_strings = (
        'sampleId',
        'bookId',
        'edition',
        'owningUnitId',
        'anchorId',
        'sourceImage',
        'sha256',
        'stratum',
    )
    if any(not isinstance(row.get(key), str) or not row[key] for key in required_strings):
        raise VisualRetrievalContractError('sample string identity is invalid')
    if not isinstance(row.get('title'), str) or not isinstance(row.get('owningText'), str):
        raise VisualRetrievalContractError('sample text fields are invalid')
    if row['recordType'] != 'visual-sample' or row['formatVersion'] != FORMAT_VERSION:
        raise VisualRetrievalContractError('sample format identity is invalid')
    if row['description'] is not None and not isinstance(row['description'], str):
        raise VisualRetrievalContractError('sample description is invalid')
    if row['descriptionReviewState'] != 'unverified':
        raise VisualRetrievalContractError(
            'structure review must not approve an image description',
        )
    if row['stratum'] not in STRATA:
        raise VisualRetrievalContractError('sample stratum is invalid')
    if (
        not isinstance(row['width'], int)
        or isinstance(row['width'], bool)
        or not isinstance(row['height'], int)
        or isinstance(row['height'], bool)
        or min(row['width'], row['height']) < 64
    ):
        raise VisualRetrievalContractError('sample dimensions are invalid')
    if not _SHA256.fullmatch(row['sha256']) or not row['sha256'].startswith('sha256:'):
        raise VisualRetrievalContractError('sample sha256 is invalid')
    if (
        Path(row['sourceImage']).is_absolute()
        or '..' in Path(row['sourceImage']).parts
        or not row['sourceImage'].startswith('resources/textbooks/')
    ):
        raise VisualRetrievalContractError('sample source image is not runtime-relative')
    if len(row['owningText']) > MAX_OWNING_TEXT:
        raise VisualRetrievalContractError('sample owning text exceeds its bound')
    if row['productionConnected'] is not False:
        raise VisualRetrievalContractError('sample must remain production disconnected')


def validate_samples(samples: Sequence[dict[str, Any]]) -> str:
    if not samples:
        raise VisualRetrievalContractError('sample dataset must not be empty')
    for row in samples:
        validate_sample(row)
    ids = [row['sampleId'] for row in samples]
    if len(ids) != len(set(ids)):
        raise VisualRetrievalContractError('sample ids must be unique')
    if set(row['stratum'] for row in samples) != set(STRATA):
        raise VisualRetrievalContractError('sample dataset must contain all five strata')
    return candidate_population_hash(samples)


def build_dataset(
    output_dir: Path,
    *,
    v1_root: Path = DEFAULT_V1_ROOT,
    v2_root: Path = DEFAULT_V2_ROOT,
    per_stratum: int = DEFAULT_PER_STRATUM,
    seed: str = FORMAT_VERSION,
    stratification_review: Path | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    candidates, summary = inventory_figures(v1_root, v2_root)
    if stratification_review is None:
        samples = stratified_sample(candidates, per_stratum, seed)
        sampling = {
            'algorithm': 'stable-hash-per-book-round-robin-v1',
            'seed': seed,
            'perStratum': per_stratum,
        }
    else:
        review_rows = _read_jsonl(stratification_review)
        samples, actors = reviewed_stratified_sample(
            candidates,
            review_rows,
            per_stratum,
        )
        sampling = {
            'algorithm': 'reviewed-stratification-v1',
            'perStratum': per_stratum,
            'reviewFileHash': sha256_file(stratification_review),
            'reviewActors': actors,
        }
    population_hash = validate_samples(samples)
    sample_bytes = _jsonl_bytes(samples)
    summary = {
        **summary,
        'sampling': sampling,
        'selectedRecords': len(samples),
        'selectedByStratum': dict(sorted(Counter(row['stratum'] for row in samples).items())),
        'candidatePopulationHash': population_hash,
        'sampleFileHash': sha256_bytes(sample_bytes),
    }
    _atomic_write(output_dir / 'sample.jsonl', sample_bytes)
    _atomic_write(output_dir / 'inventory-summary.json', _json_bytes(summary))
    written = _read_jsonl(output_dir / 'sample.jsonl')
    if validate_samples(written) != population_hash:
        raise VisualRetrievalContractError('written dataset failed closure validation')
    return summary, samples


def validate_benchmark(
    queries: Sequence[dict[str, Any]],
    samples: Sequence[dict[str, Any]],
) -> str:
    population_hash = validate_samples(samples)
    if not queries:
        raise VisualRetrievalContractError('benchmark must not be empty')
    sample_ids = {row['sampleId'] for row in samples}
    query_ids: set[str] = set()
    for row in queries:
        if set(row) != _QUERY_KEYS:
            raise VisualRetrievalContractError('benchmark query has unexpected fields')
        if (
            row.get('recordType') != 'visual-query'
            or row.get('formatVersion') != FORMAT_VERSION
            or row.get('productionConnected') is not False
            or row.get('candidatePopulationHash') != population_hash
            or row.get('stratum') not in STRATA
            or not isinstance(row.get('queryId'), str)
            or not row['queryId']
            or not isinstance(row.get('query'), str)
            or not row['query'].strip()
        ):
            raise VisualRetrievalContractError('benchmark query identity is invalid')
        accepted = row.get('acceptedSampleIds')
        if (
            not isinstance(accepted, list)
            or not accepted
            or any(not isinstance(value, str) for value in accepted)
            or len(accepted) != len(set(accepted))
            or not set(accepted) <= sample_ids
        ):
            raise VisualRetrievalContractError('benchmark accepted sample ids are invalid')
        accepted_strata = {
            sample['stratum']
            for sample in samples
            if sample['sampleId'] in accepted
        }
        if accepted_strata != {row['stratum']}:
            raise VisualRetrievalContractError('benchmark query stratum does not match labels')
        if row['queryId'] in query_ids:
            raise VisualRetrievalContractError('benchmark query ids must be unique')
        query_ids.add(row['queryId'])
    if {row['stratum'] for row in queries} != set(STRATA):
        raise VisualRetrievalContractError('benchmark must contain all five strata')
    return sha256_bytes(_jsonl_bytes(queries))


def _validate_vector(vector: Sequence[Any], dimension: int | None = None) -> list[float]:
    if not isinstance(vector, (list, tuple)) or not vector:
        raise VisualRetrievalContractError('embedding vector must be non-empty')
    if dimension is not None and len(vector) != dimension:
        raise VisualRetrievalContractError('embedding dimension drift')
    values: list[float] = []
    for item in vector:
        if isinstance(item, bool):
            raise VisualRetrievalContractError('embedding contains a non-number')
        try:
            value = float(item)
        except (TypeError, ValueError) as error:
            raise VisualRetrievalContractError('embedding contains a non-number') from error
        if not math.isfinite(value):
            raise VisualRetrievalContractError('embedding contains a non-finite number')
        values.append(value)
    norm = math.sqrt(sum(value * value for value in values))
    if norm == 0 or not math.isfinite(norm):
        raise VisualRetrievalContractError('embedding has zero or invalid norm')
    return [value / norm for value in values]


def fuse_vectors(image: Sequence[Any], description: Sequence[Any]) -> list[float]:
    image_vector = _validate_vector(image)
    description_vector = _validate_vector(description, len(image_vector))
    return _validate_vector([
        (left + right) / 2
        for left, right in zip(image_vector, description_vector)
    ])


def cosine_rank(
    query_vector: Sequence[Any],
    candidate_vectors: dict[str, Sequence[Any]],
) -> list[dict[str, Any]]:
    query = _validate_vector(query_vector)
    ranked = []
    for sample_id, candidate in candidate_vectors.items():
        normalized = _validate_vector(candidate, len(query))
        score = sum(left * right for left, right in zip(query, normalized))
        ranked.append({'sampleId': sample_id, 'score': score})
    ranked.sort(key=lambda row: (-row['score'], row['sampleId']))
    return ranked


def _retry_after(headers: Any) -> float | None:
    if headers is None:
        return None
    raw = headers.get('Retry-After')
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        seconds = float(raw)
    except ValueError:
        try:
            target = email.utils.parsedate_to_datetime(raw)
            seconds = target.timestamp() - time.time()
        except (TypeError, ValueError, OverflowError):
            return None
    if not math.isfinite(seconds) or seconds < 0:
        return None
    return min(seconds, MAX_RETRY_AFTER_SECONDS)


class SiliconFlowVisualClient:
    """Standard-library client that exposes only safe embedding evidence."""

    def __init__(
        self,
        api_key: str,
        *,
        endpoint: str = DEFAULT_ENDPOINT,
        user_info_endpoint: str = DEFAULT_USER_INFO_ENDPOINT,
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise VisualRetrievalContractError('SiliconFlow API key is required')
        self._api_key = api_key
        self._endpoint = endpoint
        self._user_info_endpoint = user_info_endpoint
        self._timeout = timeout

    def _open(self, request: urllib.request.Request) -> tuple[dict[str, Any], float, str | None]:
        started = time.perf_counter()
        for attempt in range(MAX_RETRIES + 1):
            try:
                with urllib.request.urlopen(request, timeout=self._timeout) as response:
                    body = json.loads(response.read().decode('utf-8'))
                    trace = _safe_trace(
                        response.headers.get('x-siliconcloud-trace-id')
                        or response.headers.get('x-request-id')
                        or response.headers.get('x-trace-id'),
                    )
                if not isinstance(body, dict):
                    raise ProviderFailure('invalid-response', trace)
                return body, (time.perf_counter() - started) * 1000, trace
            except urllib.error.HTTPError as error:
                trace = _safe_trace(
                    error.headers.get('x-siliconcloud-trace-id')
                    if error.headers else None,
                )
                retryable = error.code in (408, 429) or 500 <= error.code <= 599
                delay = _retry_after(error.headers)
                error.close()
                if not retryable or attempt == MAX_RETRIES:
                    raise ProviderFailure(f'http-{error.code}', trace) from None
                time.sleep(delay if delay is not None else RETRY_BASE_SECONDS * (2 ** attempt))
            except ProviderFailure:
                raise
            except (OSError, urllib.error.URLError):
                if attempt == MAX_RETRIES:
                    raise ProviderFailure('transport-error') from None
                time.sleep(RETRY_BASE_SECONDS * (2 ** attempt))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise ProviderFailure('invalid-response') from None
        raise ProviderFailure('transport-error')

    def embed_many(self, model: str, input_values: Sequence[Any]) -> dict[str, Any]:
        if not input_values:
            raise VisualRetrievalContractError('embedding batch must not be empty')
        body = json.dumps(
            {'model': model, 'input': list(input_values)},
            ensure_ascii=False,
        ).encode('utf-8')
        request = urllib.request.Request(
            self._endpoint,
            data=body,
            method='POST',
            headers={
                'Authorization': f'Bearer {self._api_key}',
                'Content-Type': 'application/json',
            },
        )
        response, latency, trace = self._open(request)
        data = response.get('data')
        if not isinstance(data, list) or len(data) != len(input_values):
            raise ProviderFailure('invalid-response', trace)
        usage = response.get('usage')
        if not isinstance(usage, dict):
            raise ProviderFailure('invalid-response', trace)
        response_model = response.get('model')
        if response_model is not None and response_model != model:
            raise ProviderFailure('model-mismatch', trace)
        tokens = usage.get('total_tokens', usage.get('input_tokens', usage.get('prompt_tokens')))
        if not isinstance(tokens, int) or isinstance(tokens, bool) or tokens < 0:
            raise ProviderFailure('invalid-response', trace)
        indexed: dict[int, list[float]] = {}
        dimension: int | None = None
        for fallback_index, row in enumerate(data):
            if not isinstance(row, dict) or not isinstance(row.get('embedding'), list):
                raise ProviderFailure('invalid-response', trace)
            index = row.get('index', fallback_index)
            if (
                not isinstance(index, int)
                or isinstance(index, bool)
                or index < 0
                or index >= len(input_values)
                or index in indexed
            ):
                raise ProviderFailure('invalid-response', trace)
            try:
                normalized = _validate_vector(row['embedding'], dimension)
            except VisualRetrievalContractError:
                raise ProviderFailure('dimension-or-vector-drift', trace) from None
            dimension = len(normalized)
            indexed[index] = normalized
        if set(indexed) != set(range(len(input_values))):
            raise ProviderFailure('invalid-response', trace)
        result = {
            'vectors': [indexed[index] for index in range(len(input_values))],
            'latencyMs': latency,
            'usageTokens': tokens,
        }
        if trace is not None:
            result['traceId'] = trace
        return result

    def embed(self, model: str, input_value: Any) -> dict[str, Any]:
        evidence = self.embed_many(model, [input_value])
        return {
            'vector': evidence['vectors'][0],
            'latencyMs': evidence['latencyMs'],
            'usageTokens': evidence['usageTokens'],
            **(
                {'traceId': evidence['traceId']}
                if 'traceId' in evidence
                else {}
            ),
        }

    def total_balance(self) -> Decimal:
        request = urllib.request.Request(
            self._user_info_endpoint,
            method='GET',
            headers={'Authorization': f'Bearer {self._api_key}'},
        )
        response, _, trace = self._open(request)
        data = response.get('data')
        value = data.get('totalBalance') if isinstance(data, dict) else None
        try:
            balance = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise ProviderFailure('balance-invalid-response', trace) from None
        if not balance.is_finite():
            raise ProviderFailure('balance-invalid-response', trace)
        return balance


def _cache_key(model: str, input_hash: str) -> str:
    return hashlib.sha256(f'{model}\0{input_hash}'.encode()).hexdigest()


def _load_cache(cache_dir: Path, model: str, input_hash: str) -> list[float] | None:
    path = cache_dir / 'vectors' / f'{_cache_key(model, input_hash)}.json'
    if not path.exists():
        return None
    record = _read_json(path)
    if set(record) != {'formatVersion', 'model', 'inputHash', 'dimension', 'vector'}:
        raise VisualRetrievalContractError('embedding cache record has unexpected fields')
    if (
        record.get('formatVersion') != FORMAT_VERSION
        or record.get('model') != model
        or record.get('inputHash') != input_hash
        or not isinstance(record.get('dimension'), int)
    ):
        raise VisualRetrievalContractError('embedding cache identity drift')
    return _validate_vector(record.get('vector'), record['dimension'])


def _store_cache(
    cache_dir: Path,
    model: str,
    input_hash: str,
    vector: Sequence[Any],
) -> None:
    normalized = _validate_vector(vector)
    record = {
        'formatVersion': FORMAT_VERSION,
        'model': model,
        'inputHash': input_hash,
        'dimension': len(normalized),
        'vector': normalized,
    }
    path = cache_dir / 'vectors' / f'{_cache_key(model, input_hash)}.json'
    if path.exists():
        existing = _load_cache(cache_dir, model, input_hash)
        if existing != normalized:
            raise VisualRetrievalContractError('embedding cache vector drift')
        return
    _atomic_write(path, _json_bytes(record))


def _prepare_cache(
    cache_dir: Path,
    population_hash: str,
    sample_hash: str,
    benchmark_hash: str,
    source_revision: str,
) -> None:
    manifest_path = cache_dir / 'manifest.json'
    expected = {
        'recordType': 'visual-evaluation-cache',
        'formatVersion': FORMAT_VERSION,
        'candidatePopulationHash': population_hash,
        'sampleHash': sample_hash,
        'benchmarkHash': benchmark_hash,
        'sourceRevision': validate_source_revision(source_revision),
        'models': {'text': TEXT_MODEL, 'visionLanguage': VL_MODEL},
        'productionConnected': False,
    }
    if manifest_path.exists():
        if _read_json(manifest_path) != expected:
            raise VisualRetrievalContractError('experiment cache manifest drift')
    else:
        _atomic_write(manifest_path, _json_bytes(expected))


def _description_text(sample: dict[str, Any]) -> str:
    return _bounded_text(sample['description'] or sample['title'], 2000)


def _baseline_text(sample: dict[str, Any]) -> str:
    return _bounded_text(
        ' '.join(
            value
            for value in (
                sample['title'],
                sample['description'] or '',
                sample['owningText'],
            )
            if value
        ),
        MAX_OWNING_TEXT + 2000,
    )


def _image_input(sample: dict[str, Any], repo_root: Path) -> dict[str, str]:
    path = repo_root / 'course-content' / 'runtime' / sample['sourceImage']
    if sha256_file(path) != sample['sha256']:
        raise VisualRetrievalContractError('source image hash drift before provider call')
    mime = 'image/png'
    return {'image': f'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}'}


def _embed_group(
    client: Any,
    cache_dir: Path,
    model: str,
    entries: Sequence[tuple[str, Any]],
    *,
    channel: str,
    batch_size: int,
    operations: list[dict[str, Any]],
    read_cache: bool = True,
) -> dict[str, list[float]]:
    if not 1 <= batch_size <= 16:
        raise VisualRetrievalContractError('batch size must be between 1 and 16')
    if len({input_id for input_id, _ in entries}) != len(entries):
        raise VisualRetrievalContractError('embedding input ids must be unique per channel')
    resolved: dict[str, list[float]] = {}
    grouped: dict[str, dict[str, Any]] = {}
    for input_id, input_value in entries:
        canonical_input = canonical_json(input_value)
        input_hash = sha256_bytes(canonical_input.encode('utf-8'))
        existing = grouped.get(input_hash)
        if existing is None:
            grouped[input_hash] = {
                'inputHash': input_hash,
                'canonicalInput': canonical_input,
                'inputValue': input_value,
                'inputIds': [input_id],
            }
        else:
            if existing['canonicalInput'] != canonical_input:
                raise VisualRetrievalContractError('embedding input hash collision')
            existing['inputIds'].append(input_id)
    misses: list[dict[str, Any]] = []
    dimension: int | None = None
    for input_hash, group in grouped.items():
        cached = (
            _load_cache(cache_dir, model, input_hash)
            if read_cache
            else None
        )
        if cached is None:
            misses.append(group)
            continue
        cached = _validate_vector(cached, dimension)
        dimension = len(cached)
        for input_id in group['inputIds']:
            resolved[input_id] = cached
        operations.append({
            'channel': channel,
            'inputIds': group['inputIds'],
            'uniqueInputCount': 1,
            'cacheHit': True,
            'latencyMs': 0.0,
            'usageTokens': 0,
        })
    for offset in range(0, len(misses), batch_size):
        batch = misses[offset:offset + batch_size]
        input_ids = [
            input_id
            for group in batch
            for input_id in group['inputIds']
        ]
        try:
            evidence = client.embed_many(
                model,
                [group['inputValue'] for group in batch],
            )
        except ProviderFailure as error:
            failure = {
                'channel': channel,
                'inputIds': input_ids,
                'uniqueInputCount': len(batch),
                'failureType': error.failure_type,
            }
            if error.trace_id is not None:
                failure['traceId'] = error.trace_id
            operations.append(failure)
            raise
        if not isinstance(evidence, dict):
            raise VisualRetrievalContractError('provider evidence must be an object')
        vectors = evidence.get('vectors')
        latency = evidence.get('latencyMs')
        usage = evidence.get('usageTokens')
        if (
            not isinstance(vectors, list)
            or len(vectors) != len(batch)
            or not isinstance(latency, (int, float))
            or isinstance(latency, bool)
            or not math.isfinite(float(latency))
            or latency < 0
            or not isinstance(usage, int)
            or isinstance(usage, bool)
            or usage < 0
        ):
            raise VisualRetrievalContractError('provider batch evidence is invalid')
        normalized_batch: list[list[float]] = []
        for vector in vectors:
            normalized = _validate_vector(vector, dimension)
            dimension = len(normalized)
            normalized_batch.append(normalized)
        operation = {
            'channel': channel,
            'inputIds': input_ids,
            'uniqueInputCount': len(batch),
            'cacheHit': False,
            'latencyMs': float(latency),
            'usageTokens': usage,
        }
        trace = _safe_trace(evidence.get('traceId'))
        if trace is not None:
            operation['traceId'] = trace
        operations.append(operation)
        for group, vector in zip(batch, normalized_batch):
            for input_id in group['inputIds']:
                resolved[input_id] = vector
            _store_cache(cache_dir, model, group['inputHash'], vector)
    if set(resolved) != {input_id for input_id, _ in entries}:
        raise VisualRetrievalContractError('embedding group did not resolve every input')
    return resolved


def _require_cold_cache(cache_dir: Path) -> None:
    vectors_dir = cache_dir / 'vectors'
    if vectors_dir.is_dir() and any(path.is_file() for path in vectors_dir.rglob('*')):
        raise VisualRetrievalContractError(
            'formal evaluation requires a cold vector cache',
        )


def _metrics(
    rankings: Sequence[dict[str, Any]],
    queries: Sequence[dict[str, Any]],
) -> dict[str, Any]:
    query_by_id = {row['queryId']: row for row in queries}
    recalls: list[float] = []
    by_stratum: dict[str, list[float]] = defaultdict(list)
    for result in rankings:
        query = query_by_id[result['queryId']]
        accepted = set(query['acceptedSampleIds'])
        returned = {row['sampleId'] for row in result['ranked'][:TOP_K]}
        recall = len(accepted & returned) / len(accepted)
        recalls.append(recall)
        by_stratum[query['stratum']].append(recall)
    return {
        'overallRecallAt10': sum(recalls) / len(recalls),
        'perStratumRecallAt10': {
            stratum: sum(values) / len(values)
            for stratum, values in sorted(by_stratum.items())
        },
    }


def _variant(
    name: str,
    query_vectors: dict[str, Sequence[Any]],
    candidate_vectors: dict[str, Sequence[Any]],
    queries: Sequence[dict[str, Any]],
) -> dict[str, Any]:
    rankings = [
        {
            'queryId': query['queryId'],
            'ranked': cosine_rank(query_vectors[query['queryId']], candidate_vectors),
        }
        for query in queries
    ]
    return {
        'name': name,
        'candidateSampleIds': sorted(candidate_vectors),
        'rawRankings': rankings,
        'metrics': _metrics(rankings, queries),
    }


def _cost_start(client: Any) -> tuple[Decimal | None, str | None]:
    try:
        return client.total_balance(), None
    except (ProviderFailure, AttributeError):
        return None, 'balance-endpoint-unavailable'


def _cost_finish(
    client: Any,
    start: Decimal | None,
    start_failure: str | None,
) -> dict[str, Any]:
    if start is None:
        return {'status': 'unavailable', 'reason': start_failure}
    try:
        finish = client.total_balance()
    except (ProviderFailure, AttributeError):
        return {'status': 'unavailable', 'reason': 'balance-endpoint-unavailable'}
    delta = start - finish
    if delta < 0:
        return {'status': 'unavailable', 'reason': 'account-balance-drift'}
    return {
        'status': 'available',
        'currency': 'CNY',
        'balanceDelta': str(delta),
    }


def evaluate(
    samples: Sequence[dict[str, Any]],
    queries: Sequence[dict[str, Any]],
    output: Path,
    cache_dir: Path = DEFAULT_CACHE_DIR,
    *,
    client: Any,
    source_revision: str,
    repo_root: Path = REPO_ROOT,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> dict[str, Any]:
    evaluation_started = time.perf_counter()
    source_revision = validate_source_revision(source_revision)
    if not 1 <= batch_size <= 16:
        raise VisualRetrievalContractError('batch size must be between 1 and 16')
    population_hash = validate_samples(samples)
    benchmark_hash = validate_benchmark(queries, samples)
    sample_hash = sha256_bytes(_jsonl_bytes(samples))
    _require_cold_cache(cache_dir)
    _prepare_cache(
        cache_dir,
        population_hash,
        sample_hash,
        benchmark_hash,
        source_revision,
    )
    operations: list[dict[str, Any]] = []
    balance_start, balance_failure = _cost_start(client)

    stage_started = time.perf_counter()
    text_candidates = _embed_group(
        client,
        cache_dir,
        TEXT_MODEL,
        [(sample['sampleId'], _baseline_text(sample)) for sample in samples],
        channel='text-candidate',
        batch_size=batch_size,
        operations=operations,
        read_cache=False,
    )
    text_candidate_latency = (time.perf_counter() - stage_started) * 1000
    stage_started = time.perf_counter()
    image_candidates = _embed_group(
        client,
        cache_dir,
        VL_MODEL,
        [
            (sample['sampleId'], _image_input(sample, repo_root))
            for sample in samples
        ],
        channel='image-candidate',
        batch_size=batch_size,
        operations=operations,
        read_cache=False,
    )
    image_candidate_latency = (time.perf_counter() - stage_started) * 1000
    stage_started = time.perf_counter()
    description_candidates = _embed_group(
        client,
        cache_dir,
        VL_MODEL,
        [
            (sample['sampleId'], {'text': _description_text(sample)})
            for sample in samples
        ],
        channel='description-candidate',
        batch_size=batch_size,
        operations=operations,
        read_cache=False,
    )
    description_candidate_latency = (time.perf_counter() - stage_started) * 1000
    stage_started = time.perf_counter()
    multimodal_candidates = {
        sample['sampleId']: fuse_vectors(
            image_candidates[sample['sampleId']],
            description_candidates[sample['sampleId']],
        )
        for sample in samples
    }
    fusion_latency = (time.perf_counter() - stage_started) * 1000

    stage_started = time.perf_counter()
    text_queries = _embed_group(
        client,
        cache_dir,
        TEXT_MODEL,
        [(query['queryId'], query['query']) for query in queries],
        channel='text-query',
        batch_size=batch_size,
        operations=operations,
        read_cache=False,
    )
    text_query_latency = (time.perf_counter() - stage_started) * 1000
    stage_started = time.perf_counter()
    vl_queries = _embed_group(
        client,
        cache_dir,
        VL_MODEL,
        [(query['queryId'], {'text': query['query']}) for query in queries],
        channel='vl-query',
        batch_size=batch_size,
        operations=operations,
        read_cache=False,
    )
    vl_query_latency = (time.perf_counter() - stage_started) * 1000

    stage_started = time.perf_counter()
    text_variant = _variant('text', text_queries, text_candidates, queries)
    text_ranking_latency = (time.perf_counter() - stage_started) * 1000
    text_variant['endToEndLatencyMs'] = (
        text_candidate_latency + text_query_latency + text_ranking_latency
    )
    stage_started = time.perf_counter()
    image_variant = _variant('image', vl_queries, image_candidates, queries)
    image_ranking_latency = (time.perf_counter() - stage_started) * 1000
    image_variant['endToEndLatencyMs'] = (
        image_candidate_latency + vl_query_latency + image_ranking_latency
    )
    stage_started = time.perf_counter()
    multimodal_variant = _variant(
        'multimodal',
        vl_queries,
        multimodal_candidates,
        queries,
    )
    multimodal_ranking_latency = (time.perf_counter() - stage_started) * 1000
    multimodal_variant['endToEndLatencyMs'] = (
        image_candidate_latency
        + description_candidate_latency
        + fusion_latency
        + vl_query_latency
        + multimodal_ranking_latency
    )
    total_evaluation_latency = (time.perf_counter() - evaluation_started) * 1000

    report = {
        'recordType': 'visual-evaluation-report',
        'formatVersion': FORMAT_VERSION,
        'candidatePopulationHash': population_hash,
        'sampleHash': sample_hash,
        'benchmarkHash': benchmark_hash,
        'sourceRevision': source_revision,
        'queryIds': [query['queryId'] for query in queries],
        'acceptedAnswers': {
            query['queryId']: query['acceptedSampleIds']
            for query in queries
        },
        'topK': TOP_K,
        'batchSize': batch_size,
        'models': {'text': TEXT_MODEL, 'visionLanguage': VL_MODEL},
        'fusionContract': FUSION_CONTRACT,
        'variants': [
            text_variant,
            image_variant,
            multimodal_variant,
        ],
        'totalEvaluationLatencyMs': total_evaluation_latency,
        'providerOperations': operations,
        'providerFailures': [],
        'cost': _cost_finish(client, balance_start, balance_failure),
        'productionConnected': False,
    }
    validate_report(report, samples, queries)
    _atomic_write(output, _json_bytes(report))
    return report


def validate_report(
    report: dict[str, Any],
    samples: Sequence[dict[str, Any]],
    queries: Sequence[dict[str, Any]],
) -> None:
    population_hash = validate_samples(samples)
    benchmark_hash = validate_benchmark(queries, samples)
    expected_keys = {
        'recordType',
        'formatVersion',
        'candidatePopulationHash',
        'sampleHash',
        'benchmarkHash',
        'sourceRevision',
        'queryIds',
        'acceptedAnswers',
        'topK',
        'batchSize',
        'models',
        'fusionContract',
        'variants',
        'totalEvaluationLatencyMs',
        'providerOperations',
        'providerFailures',
        'cost',
        'productionConnected',
    }
    if set(report) != expected_keys:
        raise VisualRetrievalContractError('report has unexpected fields')
    query_ids = [query['queryId'] for query in queries]
    accepted = {query['queryId']: query['acceptedSampleIds'] for query in queries}
    if (
        report.get('recordType') != 'visual-evaluation-report'
        or report.get('formatVersion') != FORMAT_VERSION
        or report.get('candidatePopulationHash') != population_hash
        or report.get('sampleHash') != sha256_bytes(_jsonl_bytes(samples))
        or report.get('benchmarkHash') != benchmark_hash
        or not isinstance(report.get('sourceRevision'), str)
        or not _GIT_REVISION.fullmatch(report['sourceRevision'])
        or report.get('queryIds') != query_ids
        or report.get('acceptedAnswers') != accepted
        or report.get('topK') != TOP_K
        or not isinstance(report.get('batchSize'), int)
        or isinstance(report.get('batchSize'), bool)
        or not 1 <= report['batchSize'] <= 16
        or report.get('models') != {'text': TEXT_MODEL, 'visionLanguage': VL_MODEL}
        or report.get('fusionContract') != FUSION_CONTRACT
        or not isinstance(report.get('totalEvaluationLatencyMs'), (int, float))
        or isinstance(report.get('totalEvaluationLatencyMs'), bool)
        or not math.isfinite(float(report['totalEvaluationLatencyMs']))
        or report['totalEvaluationLatencyMs'] < 0
        or report.get('productionConnected') is not False
        or report.get('providerFailures') != []
    ):
        raise VisualRetrievalContractError('report comparison contract is invalid')
    variants = report.get('variants')
    if not isinstance(variants, list) or [item.get('name') for item in variants] != [
        'text',
        'image',
        'multimodal',
    ]:
        raise VisualRetrievalContractError('report variants are invalid')
    sample_ids = sorted(row['sampleId'] for row in samples)
    for variant in variants:
        if set(variant) != {
            'name',
            'candidateSampleIds',
            'rawRankings',
            'metrics',
            'endToEndLatencyMs',
        }:
            raise VisualRetrievalContractError('report variant has unexpected fields')
        if (
            not isinstance(variant['endToEndLatencyMs'], (int, float))
            or isinstance(variant['endToEndLatencyMs'], bool)
            or not math.isfinite(float(variant['endToEndLatencyMs']))
            or variant['endToEndLatencyMs'] < 0
        ):
            raise VisualRetrievalContractError('report variant latency is invalid')
        if variant.get('candidateSampleIds') != sample_ids:
            raise VisualRetrievalContractError('report candidate population drift')
        rankings = variant.get('rawRankings')
        if not isinstance(rankings, list) or [
            item.get('queryId') for item in rankings
        ] != query_ids:
            raise VisualRetrievalContractError('report query population drift')
        for ranking in rankings:
            ranked = ranking.get('ranked')
            if (
                not isinstance(ranked, list)
                or sorted(item.get('sampleId') for item in ranked) != sample_ids
                or any(
                    set(item) != {'sampleId', 'score'}
                    or not isinstance(item['score'], (int, float))
                    or isinstance(item['score'], bool)
                    or not math.isfinite(float(item['score']))
                    for item in ranked
                )
            ):
                raise VisualRetrievalContractError('report raw ranking is invalid')
            ordering = [
                (-float(item['score']), item['sampleId'])
                for item in ranked
            ]
            if ordering != sorted(ordering):
                raise VisualRetrievalContractError('report ranking order is invalid')
        expected_metrics = _metrics(rankings, queries)
        if variant.get('metrics') != expected_metrics:
            raise VisualRetrievalContractError('report recall metrics are invalid')
    operations = report.get('providerOperations')
    if not isinstance(operations, list):
        raise VisualRetrievalContractError('report provider operations are invalid')
    for operation in operations:
        allowed = {
            'channel',
            'inputIds',
            'uniqueInputCount',
            'cacheHit',
            'latencyMs',
            'usageTokens',
            'traceId',
        }
        if (
            not isinstance(operation, dict)
            or not set(operation) <= allowed
            or not {
                'channel',
                'inputIds',
                'uniqueInputCount',
                'cacheHit',
                'latencyMs',
                'usageTokens',
            } <= set(operation)
            or not isinstance(operation['inputIds'], list)
            or not operation['inputIds']
            or any(not isinstance(value, str) or not value for value in operation['inputIds'])
            or len(operation['inputIds']) != len(set(operation['inputIds']))
            or not isinstance(operation['uniqueInputCount'], int)
            or isinstance(operation['uniqueInputCount'], bool)
            or not 1 <= operation['uniqueInputCount'] <= report['batchSize']
            or operation['uniqueInputCount'] > len(operation['inputIds'])
            or not isinstance(operation['cacheHit'], bool)
            or operation['cacheHit'] is not False
            or not isinstance(operation['usageTokens'], int)
            or isinstance(operation['usageTokens'], bool)
            or operation['usageTokens'] < 0
            or not isinstance(operation['latencyMs'], (int, float))
            or isinstance(operation['latencyMs'], bool)
            or operation['latencyMs'] < 0
            or ('traceId' in operation and _safe_trace(operation['traceId']) is None)
        ):
            raise VisualRetrievalContractError('report provider operation is invalid')
    cost = report.get('cost')
    if not isinstance(cost, dict) or cost.get('status') not in {'available', 'unavailable'}:
        raise VisualRetrievalContractError('report cost evidence is invalid')
    if cost['status'] == 'available':
        if set(cost) != {'status', 'currency', 'balanceDelta'} or cost['currency'] != 'CNY':
            raise VisualRetrievalContractError('available cost evidence is invalid')
        try:
            delta = Decimal(cost['balanceDelta'])
        except (InvalidOperation, ValueError, TypeError) as error:
            raise VisualRetrievalContractError('cost delta is invalid') from error
        if not delta.is_finite():
            raise VisualRetrievalContractError('cost delta is invalid')
    elif set(cost) != {'status', 'reason'}:
        raise VisualRetrievalContractError('unavailable cost evidence is invalid')
    forbidden_keys = {
        'apiKey',
        'authorization',
        'requestBody',
        'providerBody',
        'sourceImageBytes',
        'absolutePath',
        'vector',
        'embedding',
        'totalBalanceBefore',
        'totalBalanceAfter',
    }

    def contains_forbidden_key(value: Any) -> bool:
        if isinstance(value, dict):
            return bool(set(value) & forbidden_keys) or any(
                contains_forbidden_key(item) for item in value.values()
            )
        if isinstance(value, list):
            return any(contains_forbidden_key(item) for item in value)
        return False

    if contains_forbidden_key(report):
        raise VisualRetrievalContractError('report contains forbidden provider evidence')


def validate_artifacts(sample_path: Path, benchmark_path: Path, report_path: Path) -> None:
    samples = _read_jsonl(sample_path)
    queries = _read_jsonl(benchmark_path)
    report = _read_json(report_path)
    validate_report(report, samples, queries)


def archive_report(
    sample_path: Path,
    benchmark_path: Path,
    report_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    validate_artifacts(sample_path, benchmark_path, report_path)
    samples = _read_jsonl(sample_path)
    queries = _read_jsonl(benchmark_path)
    source_report = _read_json(report_path)
    content = (canonical_json(source_report) + '\n').encode('utf-8')
    _atomic_write(output_path, content)
    archived_report = _read_json(output_path)
    validate_report(archived_report, samples, queries)
    if archived_report != source_report:
        raise VisualRetrievalContractError(
            'archived report is not semantically identical to its source',
        )
    return archived_report


def verify_isolation(repo_root: Path = REPO_ROOT) -> dict[str, Any]:
    scanned: list[Path] = []
    src_root = repo_root / 'src'
    if src_root.is_dir():
        scanned.extend(path for path in src_root.rglob('*') if path.is_file())
    for relative in (
        'package.json',
        'next.config.js',
        'Dockerfile',
        'docker-entrypoint.sh',
        'scripts/build.sh',
    ):
        path = repo_root / relative
        if path.is_file():
            scanned.append(path)
    forbidden = (
        'textbook_visual_retrieval',
        'textbook-visual-retrieval-evaluation',
        'textbook-visual-retrieval-experiment',
        'visual-evaluation-report',
    )
    findings = []
    for path in sorted(set(scanned)):
        try:
            text = path.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        for number, line in enumerate(text.splitlines(), 1):
            tokens = [token for token in forbidden if token in line]
            if tokens:
                findings.append({
                    'path': path.relative_to(repo_root).as_posix(),
                    'line': number,
                    'tokens': tokens,
                })
    return {
        'recordType': 'visual-evaluation-isolation',
        'formatVersion': FORMAT_VERSION,
        'passed': not findings,
        'scannedFiles': len(set(scanned)),
        'findings': findings,
        'productionConnected': False,
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest='command', required=True)
    build = subparsers.add_parser('build-dataset')
    build.add_argument('--v1-root', type=Path, default=DEFAULT_V1_ROOT)
    build.add_argument('--v2-root', type=Path, default=DEFAULT_V2_ROOT)
    build.add_argument('--output-dir', type=Path, required=True)
    build.add_argument('--per-stratum', type=int, default=DEFAULT_PER_STRATUM)
    build.add_argument('--seed', default=FORMAT_VERSION)
    build.add_argument('--stratification-review', type=Path)

    validate = subparsers.add_parser('validate')
    validate.add_argument('--sample', type=Path, required=True)
    validate.add_argument('--benchmark', type=Path, required=True)
    validate.add_argument('--report', type=Path, required=True)

    archive = subparsers.add_parser('archive-report')
    archive.add_argument('--sample', type=Path, required=True)
    archive.add_argument('--benchmark', type=Path, required=True)
    archive.add_argument('--report', type=Path, required=True)
    archive.add_argument('--output', type=Path, required=True)

    evaluation = subparsers.add_parser('evaluate')
    evaluation.add_argument('--sample', type=Path, required=True)
    evaluation.add_argument('--benchmark', type=Path, required=True)
    evaluation.add_argument('--output', type=Path, required=True)
    evaluation.add_argument('--cache-dir', type=Path, default=DEFAULT_CACHE_DIR)
    evaluation.add_argument('--batch-size', type=int, default=DEFAULT_BATCH_SIZE)
    evaluation.add_argument('--endpoint', default=DEFAULT_ENDPOINT)
    evaluation.add_argument('--user-info-endpoint', default=DEFAULT_USER_INFO_ENDPOINT)

    isolation = subparsers.add_parser('verify-isolation')
    isolation.add_argument('--repo-root', type=Path, default=REPO_ROOT)
    isolation.add_argument('--output', type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == 'build-dataset':
            summary, _ = build_dataset(
                args.output_dir,
                v1_root=args.v1_root,
                v2_root=args.v2_root,
                per_stratum=args.per_stratum,
                seed=args.seed,
                stratification_review=args.stratification_review,
            )
            print(json.dumps(summary, ensure_ascii=False))
        elif args.command == 'validate':
            validate_artifacts(args.sample, args.benchmark, args.report)
            print(json.dumps({'valid': True, 'productionConnected': False}))
        elif args.command == 'archive-report':
            report = archive_report(
                args.sample,
                args.benchmark,
                args.report,
                args.output,
            )
            print(json.dumps({
                'archived': str(args.output),
                'candidatePopulationHash': report['candidatePopulationHash'],
                'productionConnected': False,
            }))
        elif args.command == 'evaluate':
            source_revision = clean_git_source_revision(
                REPO_ROOT,
                [Path(__file__), args.sample, args.benchmark],
            )
            api_key = os.environ.get('SILICONFLOW_API_KEY', '').strip()
            client = SiliconFlowVisualClient(
                api_key,
                endpoint=args.endpoint,
                user_info_endpoint=args.user_info_endpoint,
            )
            samples = _read_jsonl(args.sample)
            queries = _read_jsonl(args.benchmark)
            report = evaluate(
                samples,
                queries,
                args.output,
                args.cache_dir,
                client=client,
                source_revision=source_revision,
                batch_size=args.batch_size,
            )
            print(json.dumps({
                'report': str(args.output),
                'candidatePopulationHash': report['candidatePopulationHash'],
                'productionConnected': False,
            }))
        else:
            result = verify_isolation(args.repo_root)
            if args.output:
                _atomic_write(args.output, _json_bytes(result))
            print(json.dumps(result, ensure_ascii=False))
            return 0 if result['passed'] else 1
    except (VisualRetrievalContractError, ProviderFailure) as error:
        failure_type = (
            error.failure_type if isinstance(error, ProviderFailure)
            else 'contract-error'
        )
        print(json.dumps({
            'ok': False,
            'failureType': failure_type,
            'productionConnected': False,
        }))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
