#!/usr/bin/env python3
"""Deterministic offline builder and evaluator for textbook hybrid retrieval."""

from __future__ import annotations

import argparse
import email.utils
import hashlib
import json
import math
import os
import re
import shutil
import struct
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from textbook_resource_set import load_textbook_resource_set, textbook_book_count


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RUNTIME_ROOT = REPO_ROOT / 'course-content' / 'runtime' / 'resources' / 'textbooks-v2'
DEFAULT_RESOURCE_SET_PATH = (
    REPO_ROOT / 'course-content' / 'config' / 'textbook-resource-set.json'
)
FORMAT_VERSION = 'textbook-hybrid-retrieval.v1'
NORMALIZATION_VERSION = 'nfkc-lower-cjk-unigram-bigram-technical-v1'
DEFAULT_MODEL = 'BAAI/bge-m3'
DEFAULT_ENDPOINT = 'https://api.siliconflow.cn/v1/embeddings'
CORE_FILES = (
    'bodies.utf8',
    'windows.jsonl',
    'lexical-terms.jsonl',
    'lexical-postings.bin',
    'vectors.f32',
)
RESIDENT_ARTIFACT_FILES = (
    'manifest.json',
    'windows.jsonl',
    'lexical-terms.jsonl',
    'lexical-postings.bin',
    'build-report.json',
    'vectors.f32',
)
RESIDENT_ARTIFACT_BUDGET_BYTES = 150 * 1024 * 1024
MAX_VARINT_VALUE = (1 << 53) - 1
MAX_EMBEDDING_CHUNK_CODEPOINTS = 6000
SILICONFLOW_MAX_RETRIES = 4
SILICONFLOW_MAX_RETRY_AFTER_SECONDS = 30.0
SILICONFLOW_RETRY_BASE_SECONDS = 0.25
RRF_K = 60
BM25_K1 = 1.2
BM25_B = 0.75
BM25_RRF_WEIGHT = 1.5
GENERIC_BOOK_ID_SEGMENTS = frozenset({
    'auto',
    'control',
    'systems',
    'edition',
})
DECLARED_MODELS = (
    'BAAI/bge-m3',
    'Qwen/Qwen3-Embedding-0.6B',
    'Qwen/Qwen3-Embedding-4B',
)
OFFICIAL_INPUT_CNY_PER_MILLION_TOKENS = {
    'BAAI/bge-m3': 0.0,
    'Qwen/Qwen3-Embedding-0.6B': 0.07,
    'Qwen/Qwen3-Embedding-4B': 0.14,
}
OFFICIAL_PRICING_SOURCE_URL = 'https://siliconflow.cn/pricing'
_CJK_RE = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+')
_SAFE_TRACE_ID_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$')
_ISO_TIMESTAMP_RE = re.compile(
    r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$',
)
_TECHNICAL_RE = re.compile(
    r'\\[a-z]+|[a-z\u0370-\u03ff]+(?:[._/-][a-z0-9\u0370-\u03ff]+)*'
    r'|\d+(?:\.\d+)?(?:e[+-]?\d+)?|[=+*/^()<>≤≥≈%-]',
)


class RetrievalContractError(ValueError):
    """Raised when an input or generated artifact violates the v1 contract."""


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
    buffer = bytearray(1024 * 1024)
    view = memoryview(buffer)
    with path.open('rb', buffering=0) as handle:
        while bytes_read := handle.readinto(buffer):
            digest.update(view[:bytes_read])
    return f'sha256:{digest.hexdigest()}'


def normalize_text(text: str) -> str:
    """Apply the lexical normalization contract without lossy transliteration."""
    if not isinstance(text, str):
        raise TypeError('text must be a string')
    return unicodedata.normalize('NFKC', text).lower()


def lexical_tokens(text: str) -> list[str]:
    """Return Chinese unigrams/bigrams and Latin, number, or formula tokens."""
    normalized = normalize_text(text)
    positioned: list[tuple[int, int, str]] = []
    for match in _CJK_RE.finditer(normalized):
        run = match.group(0)
        for index, character in enumerate(run):
            positioned.append((match.start() + index, 0, character))
        for index in range(len(run) - 1):
            positioned.append((match.start() + index, 1, run[index:index + 2]))
    for match in _TECHNICAL_RE.finditer(normalized):
        positioned.append((match.start(), 2, match.group(0)))
    positioned.sort()
    return [token for _, _, token in positioned]


def encode_unsigned_varint(value: int) -> bytes:
    """Encode a non-negative JavaScript-safe integer as canonical ULEB128."""
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or value < 0
        or value > MAX_VARINT_VALUE
    ):
        raise RetrievalContractError('varint value is outside the supported range')
    encoded = bytearray()
    while value >= 0x80:
        encoded.append((value & 0x7f) | 0x80)
        value >>= 7
    encoded.append(value)
    return bytes(encoded)


def decode_unsigned_varint(
    data: bytes,
    offset: int,
    end: int,
) -> tuple[int, int]:
    """Decode one canonical ULEB128 value within an explicit byte slice."""
    value = 0
    shift = 0
    start = offset
    while offset < end:
        byte = data[offset]
        offset += 1
        payload = byte & 0x7f
        if shift >= 53 and payload:
            raise RetrievalContractError('varint value exceeds the supported range')
        value += payload * (1 << shift)
        if value > MAX_VARINT_VALUE:
            raise RetrievalContractError('varint value exceeds the supported range')
        if byte < 0x80:
            if offset - start > 1 and payload == 0:
                raise RetrievalContractError(
                    'lexical postings contain noncanonical varint',
                )
            return value, offset
        shift += 7
        if shift > 56:
            raise RetrievalContractError('varint value exceeds the supported range')
    raise RetrievalContractError('lexical postings contain a truncated varint')


def normalized_content_hash(text: str) -> str:
    return sha256_bytes(normalize_text(text).encode('utf-8'))


def embedding_cache_key(
    model: str,
    observed_dimension: int,
    normalization_version: str,
    content_hash: str,
) -> str:
    if not model or observed_dimension <= 0 or not normalization_version:
        raise RetrievalContractError('invalid embedding cache identity')
    value = {
        'model': model,
        'observedDimension': observed_dimension,
        'normalizationVersion': normalization_version,
        'contentHash': content_hash,
    }
    return hashlib.sha256(canonical_json(value).encode('utf-8')).hexdigest()


def validate_and_normalize_vector(
    vector: Sequence[float],
    expected_dimension: int | None = None,
) -> list[float]:
    if not isinstance(vector, (list, tuple)) or not vector:
        raise RetrievalContractError('embedding vector must be a non-empty array')
    if expected_dimension is not None and len(vector) != expected_dimension:
        raise RetrievalContractError(
            f'embedding dimension {len(vector)} does not match expected {expected_dimension}',
        )
    values: list[float] = []
    for value in vector:
        if isinstance(value, bool):
            raise RetrievalContractError('embedding vector contains a non-number')
        try:
            number = float(value)
        except (TypeError, ValueError) as error:
            raise RetrievalContractError('embedding vector contains a non-number') from error
        if not math.isfinite(number):
            raise RetrievalContractError('embedding vector contains a non-finite value')
        values.append(number)
    norm = math.sqrt(sum(value * value for value in values))
    if not math.isfinite(norm) or norm == 0:
        raise RetrievalContractError('embedding vector must have a finite non-zero norm')
    return [value / norm for value in values]


class SiliconFlowEmbeddingClient:
    """Small standard-library client whose payload contains only model and text."""

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout: float = 30.0,
    ) -> None:
        if not api_key:
            raise RetrievalContractError('SiliconFlow API key is required')
        if timeout <= 0:
            raise RetrievalContractError('embedding timeout must be positive')
        self.api_key = api_key
        self.model = model
        self.endpoint = endpoint
        self.timeout = timeout

    def _request(
        self,
        texts: Sequence[str],
    ) -> tuple[dict[str, Any], float, str | None]:
        if not texts:
            return {'data': [], 'usage': {'total_tokens': 0}}, 0.0, None
        if any(not isinstance(text, str) for text in texts):
            raise RetrievalContractError('embedding input must contain only strings')
        payload = json.dumps(
            {'model': self.model, 'input': list(texts)},
            ensure_ascii=False,
        ).encode('utf-8')
        started = time.perf_counter()
        for attempt in range(SILICONFLOW_MAX_RETRIES + 1):
            request = urllib.request.Request(
                self.endpoint,
                data=payload,
                method='POST',
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json',
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    body = json.loads(response.read().decode('utf-8'))
                    trace_id = _safe_trace_id(
                        response.headers.get('x-siliconcloud-trace-id'),
                    )
                break
            except urllib.error.HTTPError as error:
                retryable = (
                    error.code in (408, 429)
                    or 500 <= error.code <= 599
                )
                retry_after = _retry_after_seconds(error.headers)
                error.close()
                if not retryable or attempt >= SILICONFLOW_MAX_RETRIES:
                    raise RuntimeError(
                        'SiliconFlow embedding request failed',
                    ) from None
                time.sleep(
                    retry_after
                    if retry_after is not None
                    else SILICONFLOW_RETRY_BASE_SECONDS * (2 ** attempt),
                )
            except (OSError, urllib.error.URLError):
                if attempt >= SILICONFLOW_MAX_RETRIES:
                    raise RuntimeError(
                        'SiliconFlow embedding request failed',
                    ) from None
                time.sleep(SILICONFLOW_RETRY_BASE_SECONDS * (2 ** attempt))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise RuntimeError('SiliconFlow embedding request failed') from None
        latency_ms = (time.perf_counter() - started) * 1000
        if not isinstance(body, dict):
            raise RetrievalContractError('embedding response must be an object')
        return body, latency_ms, trace_id

    @staticmethod
    def _vectors(body: dict[str, Any], row_count: int) -> list[list[float]]:
        data = body.get('data') if isinstance(body, dict) else None
        if not isinstance(data, list) or len(data) != row_count:
            raise RetrievalContractError('embedding response row count is invalid')
        indexed: dict[int, Sequence[float]] = {}
        for fallback_index, item in enumerate(data):
            if not isinstance(item, dict) or not isinstance(item.get('embedding'), list):
                raise RetrievalContractError('embedding response row is invalid')
            index = item.get('index', fallback_index)
            if not isinstance(index, int) or index in indexed:
                raise RetrievalContractError('embedding response index is invalid')
            indexed[index] = item['embedding']
        if set(indexed) != set(range(row_count)):
            raise RetrievalContractError('embedding response indexes are incomplete')
        return [list(indexed[index]) for index in range(row_count)]

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        body, _, _ = self._request(texts)
        return self._vectors(body, len(texts))

    def embed_with_usage(
        self,
        texts: Sequence[str],
    ) -> tuple[list[list[float]], int]:
        evidence = self.embed_with_evidence(texts)
        return evidence['vectors'], evidence['usageTokens']

    def embed_with_evidence(
        self,
        texts: Sequence[str],
    ) -> dict[str, Any]:
        body, latency_ms, trace_id = self._request(texts)
        usage = body.get('usage')
        if not isinstance(usage, dict):
            raise RetrievalContractError('embedding response usage is missing')
        tokens = usage.get(
            'total_tokens',
            usage.get('input_tokens', usage.get('prompt_tokens')),
        )
        if not isinstance(tokens, int) or isinstance(tokens, bool) or tokens < 0:
            raise RetrievalContractError('embedding response usage tokens are invalid')
        evidence = {
            'vectors': self._vectors(body, len(texts)),
            'usageTokens': tokens,
            'latencyMs': latency_ms,
        }
        if trace_id is not None:
            evidence['traceId'] = trace_id
        return evidence


def _safe_trace_id(value: Any) -> str | None:
    if value is None:
        return None
    return (
        value
        if isinstance(value, str) and _SAFE_TRACE_ID_RE.fullmatch(value)
        else None
    )


def _retry_after_seconds(headers: Any) -> float | None:
    if headers is None:
        return None
    value = headers.get('Retry-After')
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        seconds = float(value.strip())
    except ValueError:
        try:
            retry_at = email.utils.parsedate_to_datetime(value)
            if retry_at is None:
                return None
            seconds = retry_at.timestamp() - time.time()
        except (TypeError, ValueError, OverflowError):
            return None
    if not math.isfinite(seconds) or seconds < 0:
        return None
    return min(seconds, SILICONFLOW_MAX_RETRY_AFTER_SECONDS)


def _provider_batch(
    value: Any,
    row_count: int,
) -> tuple[list[list[float]], int, float, str | None]:
    if not isinstance(value, dict) or set(value) not in (
        {'vectors', 'usageTokens', 'latencyMs'},
        {'vectors', 'usageTokens', 'latencyMs', 'traceId'},
    ):
        raise RetrievalContractError('embedding provider evidence is invalid')
    vectors = value.get('vectors')
    usage_tokens = value.get('usageTokens')
    latency_ms = value.get('latencyMs')
    if not isinstance(vectors, list) or len(vectors) != row_count:
        raise RetrievalContractError('embedding provider returned the wrong row count')
    if (
        not isinstance(usage_tokens, int)
        or isinstance(usage_tokens, bool)
        or usage_tokens < 0
    ):
        raise RetrievalContractError('embedding response usage tokens are invalid')
    if (
        isinstance(latency_ms, bool)
        or not isinstance(latency_ms, (int, float))
        or not math.isfinite(float(latency_ms))
        or latency_ms < 0
    ):
        raise RetrievalContractError('embedding response latency is invalid')
    return vectors, usage_tokens, float(latency_ms), _safe_trace_id(value.get('traceId'))


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        raise RetrievalContractError(f'cannot read JSON {path}: {error}') from error
    if not isinstance(value, dict):
        raise RetrievalContractError(f'{path} must contain an object')
    return value


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
        for line_number, line in enumerate(lines, 1):
            if not line.strip():
                continue
            record = json.loads(line)
            if not isinstance(record, dict):
                raise RetrievalContractError(f'{path}:{line_number} must contain an object')
            records.append(record)
    except (OSError, json.JSONDecodeError) as error:
        raise RetrievalContractError(f'cannot read JSONL {path}: {error}') from error
    return records


def _write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n',
        encoding='utf-8',
    )


def _write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> None:
    lines = [canonical_json(record) for record in records]
    path.write_text('\n'.join(lines) + ('\n' if lines else ''), encoding='utf-8')


def _paragraph_parts(text: str) -> list[str]:
    if not text:
        return []
    parts: list[str] = []
    start = 0
    for match in re.finditer(r'\n(?:[ \t]*\n)+', text):
        parts.append(text[start:match.end()])
        start = match.end()
    if start < len(text):
        parts.append(text[start:])
    return parts


def _derive_embedding_chunks(
    source_window: dict[str, Any],
    segments: Sequence[dict[str, str]],
) -> list[dict[str, Any]]:
    packed: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_segments: list[dict[str, str]] = []
    current_owning_ids: list[str] = []
    current_source_paths: list[str] = []
    current_length = 0

    def flush() -> None:
        nonlocal current_parts, current_segments, current_owning_ids, current_source_paths
        nonlocal current_length
        if not current_parts:
            return
        packed.append({
            'body': ''.join(current_parts),
            'segments': current_segments,
            'owningUnitIds': current_owning_ids,
            'sourcePaths': current_source_paths,
        })
        current_parts = []
        current_segments = []
        current_owning_ids = []
        current_source_paths = []
        current_length = 0

    for segment in segments:
        for paragraph in _paragraph_parts(segment['markdown']):
            pieces = [
                paragraph[start:start + MAX_EMBEDDING_CHUNK_CODEPOINTS]
                for start in range(0, len(paragraph), MAX_EMBEDDING_CHUNK_CODEPOINTS)
            ]
            for piece in pieces:
                if current_parts and (
                    current_length + len(piece) > MAX_EMBEDDING_CHUNK_CODEPOINTS
                ):
                    flush()
                current_parts.append(piece)
                if (
                    current_segments
                    and current_segments[-1]['owningUnitId'] == segment['owningUnitId']
                ):
                    current_segments[-1]['markdown'] += piece
                else:
                    current_segments.append({
                        'owningUnitId': segment['owningUnitId'],
                        'markdown': piece,
                    })
                current_length += len(piece)
                if segment['owningUnitId'] not in current_owning_ids:
                    current_owning_ids.append(segment['owningUnitId'])
                if segment['sourcePath'] not in current_source_paths:
                    current_source_paths.append(segment['sourcePath'])
    flush()
    if not packed:
        raise RetrievalContractError(
            f'{source_window["id"]} has no embeddable text',
        )

    chunk_count = len(packed)
    chunks: list[dict[str, Any]] = []
    for index, packed_chunk in enumerate(packed, 1):
        chunk_id = source_window['id'] if chunk_count == 1 else (
            f'{source_window["id"]}::embedding-chunk-'
            f'{index:06d}-of-{chunk_count:06d}'
        )
        owning_ids = packed_chunk['owningUnitIds']
        primary_unit_id = source_window['primaryUnitId']
        if primary_unit_id not in owning_ids:
            primary_unit_id = owning_ids[0]
        chunks.append({
            'id': chunk_id,
            'sourceWindowId': source_window['id'],
            'bookId': source_window['bookId'],
            'sourceRevision': source_window['sourceRevision'],
            'primaryUnitId': primary_unit_id,
            'owningUnitIds': owning_ids,
            'segments': packed_chunk['segments'],
            'sourcePaths': packed_chunk['sourcePaths'],
            'body': packed_chunk['body'],
        })
    if ''.join(chunk['body'] for chunk in chunks) != ''.join(
        segment['markdown'] for segment in segments
    ):
        raise RetrievalContractError(
            f'{source_window["id"]} embedding chunks do not preserve the source body',
        )
    return chunks


def _load_runtime(
    runtime_root: Path,
    expected_book_count: int,
    expected_book_ids: Sequence[str] | None = None,
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]]]:
    book_dirs = sorted(
        path for path in runtime_root.iterdir()
        if path.is_dir() and (path / 'manifest.json').is_file()
    ) if runtime_root.is_dir() else []
    if len(book_dirs) != expected_book_count:
        raise RetrievalContractError(
            f'expected {expected_book_count} textbook manifests, found {len(book_dirs)}',
        )
    actual_book_ids = sorted(path.name for path in book_dirs)
    if expected_book_ids is not None:
        declared_book_ids = sorted(set(expected_book_ids))
        if actual_book_ids != declared_book_ids:
            raise RetrievalContractError(
                'runtime textbook set does not match the declared resource set:'
                f'expected={declared_book_ids}:found={actual_book_ids}',
            )
    books: list[dict[str, Any]] = []
    windows: list[dict[str, Any]] = []
    revisions: set[str] = set()
    global_unit_ids: set[str] = set()
    for book_dir in book_dirs:
        manifest_path = book_dir / 'manifest.json'
        manifest = _read_json(manifest_path)
        book_id = manifest.get('bookId')
        revision = manifest.get('sourceRevision')
        counts = manifest.get('counts')
        if (
            manifest.get('schemaVersion') != 'structured-textbook-runtime.v2'
            or not isinstance(book_id, str)
            or book_id != book_dir.name
            or not isinstance(revision, str)
            or not revision
        ):
            raise RetrievalContractError(f'{manifest_path} has invalid runtime identity')
        if revision.endswith('+dirty'):
            raise RetrievalContractError(f'{book_id} runtime revision is dirty')
        if not isinstance(counts, dict):
            raise RetrievalContractError(f'{book_id} runtime counts are missing')
        if counts.get('unresolvedAnomalies') != 0 or counts.get('pendingSamples') != 0:
            raise RetrievalContractError(f'{book_id} runtime review is unresolved')
        units = _read_jsonl(book_dir / 'units.jsonl')
        unit_by_id: dict[str, dict[str, Any]] = {}
        for unit in units:
            unit_id = unit.get('id')
            if (
                unit.get('recordType') != 'structure-unit'
                or unit.get('bookId') != book_id
                or not isinstance(unit_id, str)
                or unit_id in unit_by_id
                or unit_id in global_unit_ids
            ):
                raise RetrievalContractError(f'{book_id} contains invalid or duplicate units')
            unit_by_id[unit_id] = unit
            global_unit_ids.add(unit_id)
        book_windows = _read_jsonl(book_dir / 'windows.jsonl')
        if len(unit_by_id) != counts.get('structureUnits'):
            raise RetrievalContractError(f'{book_id} structure unit count is stale')
        if len(book_windows) != counts.get('retrievalWindows'):
            raise RetrievalContractError(f'{book_id} retrieval window count is stale')
        seen_windows: set[str] = set()
        for window in book_windows:
            window_id = window.get('id')
            segments = window.get('segments')
            if (
                window.get('recordType') != 'retrieval-window'
                or not isinstance(window_id, str)
                or window_id in seen_windows
                or window.get('primaryUnitId') not in unit_by_id
                or not isinstance(segments, list)
                or not segments
            ):
                raise RetrievalContractError(f'{book_id} contains an invalid retrieval window')
            seen_windows.add(window_id)
            validated_segments: list[dict[str, str]] = []
            for segment in segments:
                if not isinstance(segment, dict):
                    raise RetrievalContractError(f'{window_id} contains an invalid segment')
                owning_id = segment.get('owningUnitId')
                markdown = segment.get('markdown')
                source_span = segment.get('sourceSpan')
                if (
                    owning_id not in unit_by_id
                    or not isinstance(markdown, str)
                    or not isinstance(source_span, dict)
                    or not isinstance(source_span.get('sourcePath'), str)
                ):
                    raise RetrievalContractError(f'{window_id} has an unresolved owning unit')
                validated_segments.append({
                    'owningUnitId': owning_id,
                    'sourcePath': source_span['sourcePath'],
                    'markdown': markdown,
                })
            windows.extend(_derive_embedding_chunks({
                'id': window_id,
                'bookId': book_id,
                'sourceRevision': revision,
                'primaryUnitId': window['primaryUnitId'],
            }, validated_segments))
        source_hashes = manifest.get('sourceHashes')
        if not isinstance(source_hashes, dict) or not source_hashes:
            raise RetrievalContractError(f'{book_id} source hashes are missing')
        for window in windows:
            if window['bookId'] == book_id and any(
                source_path not in source_hashes
                for source_path in window['sourcePaths']
            ):
                raise RetrievalContractError(
                    f'{window["id"]} references a source absent from sourceHashes',
                )
        books.append({
            'bookId': book_id,
            'edition': manifest.get('edition'),
            'manifestHash': sha256_file(manifest_path),
            'sourceHashes': dict(sorted(source_hashes.items())),
        })
        revisions.add(revision)
    if len(revisions) != 1:
        raise RetrievalContractError('all textbook manifests must share one sourceRevision')
    windows.sort(key=lambda record: (record['bookId'], record['id']))
    if len({record['id'] for record in windows}) != len(windows):
        raise RetrievalContractError('derived embedding chunk IDs must be globally unique')
    return next(iter(revisions)), books, windows


def _cache_metadata_paths(
    cache_root: Path,
    model: str,
    content_hash: str,
) -> list[Path]:
    model_hash = hashlib.sha256(model.encode('utf-8')).hexdigest()
    content_hex = content_hash.removeprefix('sha256:')
    return sorted((cache_root / model_hash / content_hex[:2]).glob(f'{content_hex}.*.json'))


def _load_cached_vector(
    cache_root: Path,
    model: str,
    content_hash: str,
    expected_dimension: int | None,
) -> tuple[list[float], int] | None:
    matches: list[tuple[list[float], int]] = []
    for path in _cache_metadata_paths(cache_root, model, content_hash):
        try:
            record = _read_json(path)
            dimension = record.get('observedDimension')
            if (
                record.get('model') != model
                or record.get('normalizationVersion') != NORMALIZATION_VERSION
                or record.get('contentHash') != content_hash
                or not isinstance(dimension, int)
                or record.get('cacheKey') != embedding_cache_key(
                    model, dimension, NORMALIZATION_VERSION, content_hash,
                )
            ):
                continue
            vector = validate_and_normalize_vector(record.get('vector'), dimension)
            if expected_dimension is not None and dimension != expected_dimension:
                continue
            matches.append((vector, dimension))
        except (OSError, RetrievalContractError):
            continue
    dimensions = {dimension for _, dimension in matches}
    if len(dimensions) > 1:
        raise RetrievalContractError(
            f'ambiguous cached dimensions for {model} and {content_hash}',
        )
    return matches[0] if matches else None


def _store_cached_vector(
    cache_root: Path,
    model: str,
    content_hash: str,
    vector: list[float],
) -> None:
    dimension = len(vector)
    key = embedding_cache_key(model, dimension, NORMALIZATION_VERSION, content_hash)
    model_hash = hashlib.sha256(model.encode('utf-8')).hexdigest()
    content_hex = content_hash.removeprefix('sha256:')
    directory = cache_root / model_hash / content_hex[:2]
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f'{content_hex}.{dimension}.json'
    _write_json(path, {
        'cacheKey': key,
        'model': model,
        'observedDimension': dimension,
        'normalizationVersion': NORMALIZATION_VERSION,
        'contentHash': content_hash,
        'vector': vector,
    })


def _resolve_vectors(
    windows: list[dict[str, Any]],
    *,
    model: str,
    expected_dimension: int | None,
    cache_root: Path,
    batch_size: int,
    embed: Callable[[Sequence[str]], dict[str, Any]] | None,
) -> tuple[list[list[float]], int, dict[str, Any]]:
    if batch_size <= 0:
        raise RetrievalContractError('batch size must be positive')
    vectors: list[list[float] | None] = [None] * len(windows)
    dimensions: set[int] = set()
    miss_indexes_by_cache_identity: dict[
        tuple[str, int | None, str, str],
        list[int],
    ] = {}
    miss_count = 0
    hits = 0
    for index, window in enumerate(windows):
        content_hash = normalized_content_hash(window['body'])
        window['contentHash'] = content_hash
        cached = _load_cached_vector(
            cache_root, model, content_hash, expected_dimension,
        )
        if cached is None:
            cache_identity = (
                model,
                expected_dimension,
                NORMALIZATION_VERSION,
                content_hash,
            )
            miss_indexes_by_cache_identity.setdefault(
                cache_identity, [],
            ).append(index)
            miss_count += 1
            continue
        vector, dimension = cached
        vectors[index] = vector
        dimensions.add(dimension)
        hits += 1
    if len(dimensions) > 1:
        raise RetrievalContractError('cached embeddings do not share one dimension')
    provider_batches = 0
    provider_usage_tokens = 0
    provider_latency_samples: list[float] = []
    provider_trace_ids: list[str] = []
    unique_misses = list(miss_indexes_by_cache_identity.items())
    if unique_misses and embed is None:
        raise RetrievalContractError(
            'embedding provider is required because the local cache has misses',
        )
    for start in range(0, len(unique_misses), batch_size):
        batch_misses = unique_misses[start:start + batch_size]
        raw_evidence = embed(
            [windows[indexes[0]]['body'] for _, indexes in batch_misses],
        ) if embed else {}
        provider_batches += 1
        raw_vectors, usage_tokens, latency_ms, trace_id = _provider_batch(
            raw_evidence,
            len(batch_misses),
        )
        provider_usage_tokens += usage_tokens
        provider_latency_samples.append(latency_ms)
        if trace_id is not None and trace_id not in provider_trace_ids:
            provider_trace_ids.append(trace_id)
        for (cache_identity, indexes), raw_vector in zip(
            batch_misses, raw_vectors,
        ):
            content_hash = cache_identity[3]
            target_dimension = expected_dimension
            if target_dimension is None and dimensions:
                target_dimension = next(iter(dimensions))
            vector = validate_and_normalize_vector(raw_vector, target_dimension)
            dimensions.add(len(vector))
            if len(dimensions) != 1:
                raise RetrievalContractError('embedding vectors do not share one dimension')
            for index in indexes:
                vectors[index] = vector
            _store_cached_vector(
                cache_root, model, content_hash, vector,
            )
    if not dimensions:
        raise RetrievalContractError('no embedding dimension was observed')
    dimension = next(iter(dimensions))
    if expected_dimension is not None and dimension != expected_dimension:
        raise RetrievalContractError(
            f'observed embedding dimension {dimension} does not match expected '
            f'{expected_dimension}',
        )
    if any(vector is None for vector in vectors):
        raise RetrievalContractError('embedding matrix contains an unfilled row')
    return (
        [vector for vector in vectors if vector is not None],
        dimension,
        {
            'cacheHits': hits,
            'cacheMisses': miss_count,
            'providerBatches': provider_batches,
            'providerUsageTokens': provider_usage_tokens,
            'providerLatencyMs': _latency_metrics(
                provider_latency_samples,
                allow_empty=True,
            ),
            'providerTraceIds': provider_trace_ids,
        },
    )


def _write_core_index(
    output_dir: Path,
    windows: list[dict[str, Any]],
    vectors: list[list[float]],
) -> tuple[list[dict[str, Any]], int]:
    bodies = bytearray()
    metadata: list[dict[str, Any]] = []
    postings: dict[str, dict[int, int]] = defaultdict(dict)
    for row, (window, vector) in enumerate(zip(windows, vectors)):
        body = window['body'].encode('utf-8')
        segment_offset = 0
        segments = []
        for segment in window['segments']:
            segment_body = segment['markdown'].encode('utf-8')
            segments.append({
                'owningUnitId': segment['owningUnitId'],
                'bodyOffset': segment_offset,
                'bodyLength': len(segment_body),
            })
            segment_offset += len(segment_body)
        if segment_offset != len(body):
            raise RetrievalContractError('window segments do not close over the body')
        offset = len(bodies)
        bodies.extend(body)
        token_counts = Counter(lexical_tokens(window['body']))
        for token, frequency in token_counts.items():
            postings[token][row] = frequency
        metadata.append({
            'recordType': 'index-window',
            'formatVersion': FORMAT_VERSION,
            'id': window['id'],
            'sourceWindowId': window['sourceWindowId'],
            'bookId': window['bookId'],
            'sourceRevision': window['sourceRevision'],
            'primaryUnitId': window['primaryUnitId'],
            'owningUnitIds': window['owningUnitIds'],
            'segments': segments,
            'sourcePaths': window['sourcePaths'],
            'vectorRow': row,
            'bodyOffset': offset,
            'bodyLength': len(body),
            'bodyHash': sha256_bytes(body),
            'contentHash': window['contentHash'],
            'tokenCount': sum(token_counts.values()),
        })
        if len(vector) == 0:
            raise RetrievalContractError('cannot write an empty vector')
    (output_dir / 'bodies.utf8').write_bytes(bytes(bodies))
    _write_jsonl(output_dir / 'windows.jsonl', metadata)
    postings_bytes = bytearray()
    terms: list[dict[str, Any]] = []
    for token, rows in sorted(postings.items()):
        byte_offset = len(postings_bytes)
        previous = -1
        for row in sorted(rows):
            postings_bytes.extend(encode_unsigned_varint(row - previous))
            postings_bytes.extend(encode_unsigned_varint(rows[row]))
            previous = row
        terms.append({
            'recordType': 'lexical-term',
            'token': token,
            'byteOffset': byte_offset,
            'byteLength': len(postings_bytes) - byte_offset,
            'postingCount': len(rows),
        })
    _write_jsonl(output_dir / 'lexical-terms.jsonl', [{
        'recordType': 'lexical-terms-header',
        'formatVersion': FORMAT_VERSION,
        'normalizationVersion': NORMALIZATION_VERSION,
    }, *terms])
    (output_dir / 'lexical-postings.bin').write_bytes(postings_bytes)
    with (output_dir / 'vectors.f32').open('wb') as handle:
        for vector in vectors:
            handle.write(struct.pack(f'<{len(vector)}f', *vector))
    return metadata, len(terms)


def build_index(
    runtime_root: Path,
    output_dir: Path,
    *,
    model: str = DEFAULT_MODEL,
    expected_dimension: int | None = None,
    cache_root: Path,
    expected_book_count: int | None = None,
    batch_size: int = 32,
    embed: Callable[[Sequence[str]], dict[str, Any]] | None = None,
    resource_set: Path | str | None = None,
) -> dict[str, Any]:
    """Rebuild a complete index from reviewed structured textbook runtime v2."""
    resource_set_path = (
        Path(resource_set)
        if resource_set is not None
        else DEFAULT_RESOURCE_SET_PATH
    )
    resource_set_config = load_textbook_resource_set(resource_set_path)
    if expected_book_count is None:
        expected_book_count = len(resource_set_config['books'])
    elif expected_book_count != len(resource_set_config['books']):
        raise RetrievalContractError(
            'expected-book-count and resource-set disagree:'
            f'expected={expected_book_count}:resource-set={len(resource_set_config["books"])}',
        )
    source_revision, books, windows = _load_runtime(
        runtime_root,
        expected_book_count,
        expected_book_ids=resource_set_config['books'],
    )
    vectors, dimension, cache_stats = _resolve_vectors(
        windows,
        model=model,
        expected_dimension=expected_dimension,
        cache_root=cache_root,
        batch_size=batch_size,
        embed=embed,
    )
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f'.{output_dir.name}-', dir=output_dir.parent))
    try:
        metadata, lexical_term_count = _write_core_index(
            temporary, windows, vectors,
        )
        core_hashes = {name: sha256_file(temporary / name) for name in CORE_FILES}
        build_report = {
            'recordType': 'build-report',
            'formatVersion': FORMAT_VERSION,
            'status': 'complete',
            'resourceSetId': resource_set_config['resourceSetId'],
            'sourceRevision': source_revision,
            'model': model,
            'observedDimension': dimension,
            'normalizationVersion': NORMALIZATION_VERSION,
            'bookCount': len(books),
            'windowCount': len(metadata),
            **cache_stats,
            'fileHashes': core_hashes,
        }
        _write_json(temporary / 'build-report.json', build_report)
        files = {
            **core_hashes,
            'build-report.json': sha256_file(temporary / 'build-report.json'),
        }
        manifest = {
            'recordType': 'index-manifest',
            'formatVersion': FORMAT_VERSION,
            'resourceSetId': resource_set_config['resourceSetId'],
            'sourceRevision': source_revision,
            'model': model,
            'observedDimension': dimension,
            'normalizationVersion': NORMALIZATION_VERSION,
            'vectorNormalization': 'l2',
            'vectorEncoding': 'float32-le',
            'books': books,
            'sourcePriority': [book['bookId'] for book in books],
            'counts': {
                'books': len(books),
                'windows': len(metadata),
                'vectors': len(vectors),
                'bodyBytes': (temporary / 'bodies.utf8').stat().st_size,
                'lexicalTerms': lexical_term_count,
            },
            'files': files,
            'productionConnected': False,
        }
        _write_json(temporary / 'manifest.json', manifest)
        verify_index(
            temporary,
            runtime_root=runtime_root,
            expected_book_count=expected_book_count,
            resource_set=resource_set_path,
        )
        if output_dir.exists():
            shutil.rmtree(output_dir)
        os.replace(temporary, output_dir)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return manifest


def _load_vectors(path: Path, rows: int, dimension: int) -> list[tuple[float, ...]]:
    raw = path.read_bytes()
    expected_size = rows * dimension * 4
    if len(raw) != expected_size:
        raise RetrievalContractError(
            f'vector file has {len(raw)} bytes; expected {expected_size}',
        )
    return [
        struct.unpack_from(f'<{dimension}f', raw, row * dimension * 4)
        for row in range(rows)
    ]


def _decode_posting_slice(
    postings_bytes: bytes,
    term: dict[str, Any],
    window_count: int,
) -> list[list[int]]:
    byte_offset = term.get('byteOffset')
    byte_length = term.get('byteLength')
    posting_count = term.get('postingCount')
    if (
        isinstance(byte_offset, bool)
        or not isinstance(byte_offset, int)
        or byte_offset < 0
        or isinstance(byte_length, bool)
        or not isinstance(byte_length, int)
        or byte_length <= 0
        or isinstance(posting_count, bool)
        or not isinstance(posting_count, int)
        or posting_count <= 0
    ):
        raise RetrievalContractError('lexical term metadata is invalid')
    end = byte_offset + byte_length
    if end > len(postings_bytes):
        raise RetrievalContractError('lexical term slice exceeds postings binary')
    offset = byte_offset
    previous = -1
    decoded: list[list[int]] = []
    for _ in range(posting_count):
        delta, offset = decode_unsigned_varint(postings_bytes, offset, end)
        frequency, offset = decode_unsigned_varint(postings_bytes, offset, end)
        row = previous + delta
        if delta <= 0 or row <= previous or row >= window_count or frequency <= 0:
            raise RetrievalContractError('lexical postings are invalid')
        decoded.append([row, frequency])
        previous = row
    if offset != end:
        raise RetrievalContractError('lexical posting count does not close its slice')
    return decoded


def _load_lexical_index(
    index_dir: Path,
    window_count: int,
) -> tuple[dict[str, dict[str, int]], bytes]:
    records = _read_jsonl(index_dir / 'lexical-terms.jsonl')
    postings_bytes = (index_dir / 'lexical-postings.bin').read_bytes()
    header = records[0] if records else None
    if (
        not isinstance(header, dict)
        or set(header) != {
            'recordType', 'formatVersion', 'normalizationVersion',
        }
        or header.get('recordType') != 'lexical-terms-header'
        or header.get('formatVersion') != FORMAT_VERSION
        or header.get('normalizationVersion') != NORMALIZATION_VERSION
    ):
        raise RetrievalContractError('lexical terms identity is invalid')
    next_offset = 0
    parsed_terms: dict[str, dict[str, int]] = {}
    previous_token: str | None = None
    for term in records[1:]:
        token = term.get('token') if isinstance(term, dict) else None
        if (
            not isinstance(token, str)
            or not token
            or token != normalize_text(token)
            or not isinstance(term, dict)
            or set(term) != {
                'recordType', 'token', 'byteOffset', 'byteLength', 'postingCount',
            }
            or term.get('recordType') != 'lexical-term'
            or (previous_token is not None and token <= previous_token)
            or term.get('byteOffset') != next_offset
        ):
            raise RetrievalContractError(
                'lexical term offsets are not contiguous and normalized',
            )
        _decode_posting_slice(postings_bytes, term, window_count)
        parsed_terms[token] = {
            'byteOffset': term['byteOffset'],
            'byteLength': term['byteLength'],
            'postingCount': term['postingCount'],
        }
        next_offset += term['byteLength']
        previous_token = token
    if next_offset != len(postings_bytes):
        raise RetrievalContractError(
            'lexical term offsets do not close over postings binary',
        )
    return parsed_terms, postings_bytes


def verify_index(
    index_dir: Path,
    *,
    runtime_root: Path,
    expected_book_count: int | None = None,
    resource_set: Path | str | None = None,
) -> dict[str, Any]:
    resource_set_path = (
        Path(resource_set)
        if resource_set is not None
        else DEFAULT_RESOURCE_SET_PATH
    )
    resource_set_config = load_textbook_resource_set(resource_set_path)
    if expected_book_count is None:
        expected_book_count = len(resource_set_config['books'])
    elif expected_book_count != len(resource_set_config['books']):
        raise RetrievalContractError(
            'expected-book-count and resource-set disagree:'
            f'expected={expected_book_count}:resource-set={len(resource_set_config["books"])}',
        )
    manifest = _read_json(index_dir / 'manifest.json')
    if (
        manifest.get('recordType') != 'index-manifest'
        or manifest.get('formatVersion') != FORMAT_VERSION
        or not isinstance(manifest.get('resourceSetId'), str)
        or not manifest['resourceSetId']
        or manifest.get('normalizationVersion') != NORMALIZATION_VERSION
        or manifest.get('vectorNormalization') != 'l2'
        or manifest.get('vectorEncoding') != 'float32-le'
    ):
        raise RetrievalContractError('index manifest identity is invalid')
    files = manifest.get('files')
    if not isinstance(files, dict) or set(files) != {*CORE_FILES, 'build-report.json'}:
        raise RetrievalContractError('index manifest file inventory is invalid')
    for name, expected_hash in files.items():
        path = index_dir / name
        if not path.is_file() or sha256_file(path) != expected_hash:
            raise RetrievalContractError(f'index file hash mismatch: {name}')
    source_revision, books, source_windows = _load_runtime(
        runtime_root,
        expected_book_count,
        expected_book_ids=resource_set_config['books'],
    )
    if manifest.get('resourceSetId') != resource_set_config['resourceSetId']:
        raise RetrievalContractError('index resourceSetId is stale')
    if manifest.get('sourceRevision') != source_revision:
        raise RetrievalContractError('index sourceRevision is stale')
    if manifest.get('books') != books:
        raise RetrievalContractError('index source manifest or source hashes are stale')
    if manifest.get('sourcePriority') != [book['bookId'] for book in books]:
        raise RetrievalContractError('index source priority metadata is invalid')
    rows = _read_jsonl(index_dir / 'windows.jsonl')
    counts = manifest.get('counts')
    dimension = manifest.get('observedDimension')
    if (
        not isinstance(counts, dict)
        or not isinstance(dimension, int)
        or dimension <= 0
        or counts.get('windows') != len(rows)
        or counts.get('vectors') != len(rows)
        or len(rows) != len(source_windows)
    ):
        raise RetrievalContractError('index counts or dimension are invalid')
    body_bytes = (index_dir / 'bodies.utf8').read_bytes()
    source_by_id = {window['id']: window for window in source_windows}
    next_offset = 0
    for expected_row, row in enumerate(rows):
        if (
            row.get('recordType') != 'index-window'
            or row.get('formatVersion') != FORMAT_VERSION
            or row.get('vectorRow') != expected_row
            or row.get('bodyOffset') != next_offset
            or not isinstance(row.get('bodyLength'), int)
            or row['bodyLength'] < 0
        ):
            raise RetrievalContractError('window metadata rows are not contiguous')
        end = next_offset + row['bodyLength']
        body = body_bytes[next_offset:end]
        if end > len(body_bytes) or sha256_bytes(body) != row.get('bodyHash'):
            raise RetrievalContractError(f'window body closure failed: {row.get("id")}')
        try:
            text = body.decode('utf-8')
        except UnicodeDecodeError as error:
            raise RetrievalContractError('window body is not valid UTF-8') from error
        source = source_by_id.get(row.get('id'))
        if (
            source is None
            or len(text) > MAX_EMBEDDING_CHUNK_CODEPOINTS
            or row.get('sourceWindowId') != source['sourceWindowId']
            or row.get('bookId') != source['bookId']
            or row.get('sourceRevision') != source_revision
            or row.get('primaryUnitId') != source['primaryUnitId']
            or row.get('owningUnitIds') != source['owningUnitIds']
            or row.get('segments') != [
                {
                    'owningUnitId': segment['owningUnitId'],
                    'bodyOffset': sum(
                        len(previous['markdown'].encode('utf-8'))
                        for previous in source['segments'][:segment_index]
                    ),
                    'bodyLength': len(segment['markdown'].encode('utf-8')),
                }
                for segment_index, segment in enumerate(source['segments'])
            ]
            or row.get('sourcePaths') != source['sourcePaths']
            or text != source['body']
            or row.get('bodyHash') != sha256_bytes(body)
            or row.get('contentHash') != normalized_content_hash(text)
            or row.get('tokenCount') != len(lexical_tokens(text))
        ):
            raise RetrievalContractError(f'window runtime reference is stale: {row.get("id")}')
        next_offset = end
    if next_offset != len(body_bytes) or counts.get('bodyBytes') != len(body_bytes):
        raise RetrievalContractError('body offsets do not close over bodies.utf8')
    vectors = _load_vectors(index_dir / 'vectors.f32', len(rows), dimension)
    for vector in vectors:
        if any(not math.isfinite(value) for value in vector):
            raise RetrievalContractError('vector matrix contains a non-finite value')
        norm = math.sqrt(sum(value * value for value in vector))
        if not math.isclose(norm, 1.0, rel_tol=1e-5, abs_tol=1e-5):
            raise RetrievalContractError('vector matrix contains a non-unit vector')
    terms, _ = _load_lexical_index(index_dir, len(rows))
    if counts.get('lexicalTerms') != len(terms):
        raise RetrievalContractError('lexical term count is invalid')
    report = _read_json(index_dir / 'build-report.json')
    if (
        report.get('recordType') != 'build-report'
        or report.get('status') != 'complete'
        or report.get('resourceSetId') != resource_set_config['resourceSetId']
        or report.get('sourceRevision') != source_revision
        or report.get('model') != manifest.get('model')
        or report.get('observedDimension') != dimension
        or report.get('normalizationVersion') != NORMALIZATION_VERSION
        or report.get('bookCount') != len(books)
        or report.get('windowCount') != len(rows)
        or report.get('cacheHits', -1) + report.get('cacheMisses', -1) != len(rows)
        or not _validate_build_provider_evidence(report)
        or report.get('fileHashes') != {name: files[name] for name in CORE_FILES}
    ):
        raise RetrievalContractError('build report is inconsistent with the index')
    return {
        'status': 'valid',
        'resourceSetId': resource_set_config['resourceSetId'],
        'sourceRevision': source_revision,
        'books': len(books),
        'windows': len(rows),
        'dimension': dimension,
    }


def _matching_book_ids(
    query: str,
    books: Sequence[dict[str, Any]],
) -> set[str]:
    normalized_query = normalize_text(query)
    matches: set[str] = set()
    for book in books:
        book_id = book['bookId']
        edition = normalize_text(book.get('edition') or '')
        if edition and edition in normalized_query:
            matches.add(book_id)
            continue
        identifying_segments = [
            normalize_text(segment)
            for segment in book_id.split('-')
            if segment and normalize_text(segment) not in GENERIC_BOOK_ID_SEGMENTS
        ]
        if (
            sum(
                segment in normalized_query
                for segment in identifying_segments
            ) >= 2
        ):
            matches.add(book_id)
    return matches


def _bm25_rank(
    query: str,
    terms: dict[str, dict[str, int]],
    postings_bytes: bytes,
    windows: Sequence[dict[str, Any]],
) -> list[tuple[int, float]]:
    normalized_query = normalize_text(query)
    if '中文' not in normalized_query and '叫什么' not in normalized_query:
        return []
    average_document_length = (
        sum(window['tokenCount'] for window in windows) / len(windows)
    )
    scores: defaultdict[int, float] = defaultdict(float)
    for token in dict.fromkeys(lexical_tokens(normalized_query)):
        term = terms.get(token)
        if term is None:
            continue
        inverse_document_frequency = math.log(
            1 + (
                len(windows) - term['postingCount'] + 0.5
            ) / (term['postingCount'] + 0.5),
        )
        for row, frequency in _decode_posting_slice(
            postings_bytes, term, len(windows),
        ):
            document_length = windows[row]['tokenCount']
            denominator = frequency + BM25_K1 * (
                1 - BM25_B
                + BM25_B * document_length / average_document_length
            )
            scores[row] += (
                inverse_document_frequency
                * frequency
                * (BM25_K1 + 1)
                / denominator
            )
    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))


def _query_rank(
    query: str,
    terms: dict[str, dict[str, int]],
    postings_bytes: bytes,
    window_count: int,
    vectors: list[tuple[float, ...]],
    query_vector: Sequence[float] | None,
    limit: int = 10,
    *,
    windows: Sequence[dict[str, Any]] | None = None,
    books: Sequence[dict[str, Any]] = (),
    source_priority: Sequence[str] = (),
) -> list[int]:
    lexical_scores: Counter[int] = Counter()
    for token in lexical_tokens(query):
        term = terms.get(token)
        if term is None:
            continue
        for row, frequency in _decode_posting_slice(
            postings_bytes, term, window_count,
        ):
            lexical_scores[row] += frequency
    lexical_rank = [
        row for row, _ in sorted(
            lexical_scores.items(), key=lambda item: (-item[1], item[0]),
        )
    ]
    vector_rank: list[int] = []
    if query_vector is not None:
        normalized = validate_and_normalize_vector(query_vector, len(vectors[0]))
        vector_rank = [
            row for row, _ in sorted(
                enumerate(
                    sum(left * right for left, right in zip(vector, normalized))
                    for vector in vectors
                ),
                key=lambda item: (-item[1], item[0]),
            )
        ]
    bm25_rank = (
        _bm25_rank(query, terms, postings_bytes, windows)
        if windows is not None
        else []
    )
    source_local_vector_rank: list[int] = []
    if windows is not None and vector_rank:
        matching_books = _matching_book_ids(query, books)
        source_local_vector_rank = [
            row for row in vector_rank
            if windows[row]['bookId'] in matching_books
        ]
    fused: defaultdict[int, float] = defaultdict(float)
    for rank, row in enumerate(lexical_rank):
        fused[row] += 1.0 / (RRF_K + rank + 1)
    for rank, row in enumerate(vector_rank):
        fused[row] += 1.0 / (RRF_K + rank + 1)
    for rank, (row, _) in enumerate(bm25_rank):
        fused[row] += BM25_RRF_WEIGHT / (RRF_K + rank + 1)
    for rank, row in enumerate(source_local_vector_rank):
        fused[row] += 1.0 / (RRF_K + rank + 1)
    priority_by_book = {
        book_id: rank for rank, book_id in enumerate(source_priority)
    }

    def final_rank(item: tuple[int, float]) -> tuple[float, int, int]:
        row, score = item
        priority = (
            priority_by_book.get(
                windows[row]['bookId'],
                len(priority_by_book),
            )
            if windows is not None
            else 0
        )
        return -score, priority, row

    return [
        row for row, _ in sorted(fused.items(), key=final_rank)
    ][:limit]


def canonical_value_hash(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode('utf-8'))


def _load_benchmark(path: Path) -> list[dict[str, Any]]:
    records = _read_jsonl(path)
    required = {
        'schemaVersion',
        'queryId',
        'query',
        'category',
        'language',
        'acceptableUnitIds',
        'preferredUnitId',
        'sourceBookIds',
        'rationale',
        'labelingVersion',
    }
    allowed = required | {'fragmentAnchorIds'}
    seen: set[str] = set()
    for record in records:
        query_id = record.get('queryId')
        acceptable = record.get('acceptableUnitIds')
        if (
            set(record) - allowed
            or not required <= set(record)
            or record.get('schemaVersion') != 'textbook-retrieval-benchmark-entry.v1'
            or not isinstance(query_id, str)
            or not query_id
            or query_id in seen
            or not isinstance(record.get('query'), str)
            or not record['query']
            or not isinstance(record.get('category'), str)
            or not isinstance(record.get('language'), str)
            or not isinstance(acceptable, list)
            or not acceptable
            or len(set(acceptable)) != len(acceptable)
            or any(not isinstance(unit_id, str) or not unit_id.startswith('textbook-unit:')
                   for unit_id in acceptable)
            or record.get('preferredUnitId') not in acceptable
            or not isinstance(record.get('sourceBookIds'), list)
            or not record['sourceBookIds']
            or not isinstance(record.get('rationale'), str)
            or not isinstance(record.get('labelingVersion'), str)
        ):
            raise RetrievalContractError(f'benchmark query {query_id!r} is invalid')
        anchors = record.get('fragmentAnchorIds', [])
        if not isinstance(anchors, list) or any(not isinstance(anchor, str) for anchor in anchors):
            raise RetrievalContractError(f'benchmark query {query_id!r} anchors are invalid')
        seen.add(query_id)
    if not records:
        raise RetrievalContractError('benchmark must not be empty')
    return records


def _validate_benchmark_lock(
    benchmark_path: Path,
    split_path: Path,
    lock_path: Path,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any], str]:
    benchmark = _load_benchmark(benchmark_path)
    split = _read_json(split_path)
    lock = _read_json(lock_path)
    tuning_ids = split.get('tuningQueryIds')
    acceptance_ids = split.get('acceptanceQueryIds')
    benchmark_ids = [record['queryId'] for record in benchmark]
    if (
        split.get('schemaVersion') != 'textbook-retrieval-benchmark-split.v1'
        or not isinstance(tuning_ids, list)
        or not isinstance(acceptance_ids, list)
        or any(not isinstance(query_id, str) for query_id in tuning_ids + acceptance_ids)
        or len(set(tuning_ids)) != len(tuning_ids)
        or len(set(acceptance_ids)) != len(acceptance_ids)
        or set(tuning_ids) & set(acceptance_ids)
        or set(benchmark_ids) != set(tuning_ids) | set(acceptance_ids)
    ):
        raise RetrievalContractError('benchmark split inventory is invalid')
    pricing = lock.get('pricing')
    prices = pricing.get('inputCnyPerMillionTokens') if isinstance(pricing, dict) else None
    required_lock = {
        'recordType': 'benchmark-lock',
        'lockVersion': 'textbook-hybrid-retrieval-benchmark-lock.v1',
        'benchmarkHash': sha256_file(benchmark_path),
        'splitHash': sha256_file(split_path),
        'queryCount': len(benchmark_ids),
        'tuningQueryCount': len(tuning_ids),
        'acceptanceQueryCount': len(acceptance_ids),
        'tuningQueryIdsHash': canonical_value_hash(tuning_ids),
        'acceptanceQueryIdsHash': canonical_value_hash(acceptance_ids),
        'candidateModels': list(DECLARED_MODELS),
    }
    if (
        any(lock.get(key) != value for key, value in required_lock.items())
        or not isinstance(pricing, dict)
        or pricing.get('currency') != 'CNY'
        or pricing.get('unit') != 'per-million-input-tokens'
        or not isinstance(pricing.get('version'), str)
        or not pricing['version']
        or not isinstance(pricing.get('checkedAt'), str)
        or not _ISO_TIMESTAMP_RE.fullmatch(pricing['checkedAt'])
        or pricing.get('sourceUrl') != OFFICIAL_PRICING_SOURCE_URL
        or not isinstance(prices, dict)
        or prices != OFFICIAL_INPUT_CNY_PER_MILLION_TOKENS
    ):
        raise RetrievalContractError('benchmark lock does not match benchmark inputs')
    return benchmark, split, lock, canonical_value_hash(lock)


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        raise RetrievalContractError('latency samples must not be empty')
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def _latency_metrics(
    values: list[float],
    *,
    allow_empty: bool = False,
) -> dict[str, Any]:
    if not values:
        if not allow_empty:
            raise RetrievalContractError('latency samples must not be empty')
        return {
            'batchCount': 0,
            'samples': [],
            'p50': 0.0,
            'p95': 0.0,
            'total': 0.0,
        }
    return {
        'batchCount': len(values),
        'samples': values,
        'p50': _percentile(values, 0.50),
        'p95': _percentile(values, 0.95),
        'total': sum(values),
    }


def _validate_latency_metrics(
    value: Any,
    *,
    allow_empty: bool,
) -> bool:
    if not isinstance(value, dict) or set(value) != {
        'batchCount', 'samples', 'p50', 'p95', 'total',
    }:
        return False
    samples = value.get('samples')
    numbers = (
        isinstance(samples, list)
        and all(
            not isinstance(sample, bool)
            and isinstance(sample, (int, float))
            and math.isfinite(float(sample))
            and sample >= 0
            for sample in samples
        )
    )
    if not numbers or value.get('batchCount') != len(samples):
        return False
    if not samples:
        return allow_empty and all(value.get(key) == 0 for key in ('p50', 'p95', 'total'))
    expected = _latency_metrics([float(sample) for sample in samples])
    return all(
        not isinstance(value.get(key), bool)
        and isinstance(value.get(key), (int, float))
        and math.isclose(float(value[key]), expected[key], rel_tol=1e-12, abs_tol=1e-12)
        for key in ('p50', 'p95', 'total')
    )


def _validate_build_provider_evidence(report: dict[str, Any]) -> bool:
    trace_ids = report.get('providerTraceIds')
    cache_hits = report.get('cacheHits')
    cache_misses = report.get('cacheMisses')
    provider_batches = report.get('providerBatches')
    provider_usage_tokens = report.get('providerUsageTokens')
    return (
        isinstance(cache_hits, int)
        and not isinstance(cache_hits, bool)
        and cache_hits >= 0
        and isinstance(cache_misses, int)
        and not isinstance(cache_misses, bool)
        and cache_misses >= 0
        and isinstance(provider_batches, int)
        and not isinstance(provider_batches, bool)
        and provider_batches >= 0
        and isinstance(provider_usage_tokens, int)
        and not isinstance(provider_usage_tokens, bool)
        and provider_usage_tokens >= 0
        and _validate_latency_metrics(
            report.get('providerLatencyMs'),
            allow_empty=True,
        )
        and report['providerLatencyMs']['batchCount'] == provider_batches
        and isinstance(trace_ids, list)
        and len(trace_ids) == len(set(trace_ids))
        and len(trace_ids) <= provider_batches
        and all(_safe_trace_id(trace_id) == trace_id for trace_id in trace_ids)
        and ((cache_misses == 0 and provider_batches == 0)
             or (cache_misses > 0 and provider_batches > 0))
    )


def _index_identity(index_dir: Path) -> tuple[dict[str, Any], str, int, int]:
    manifest_path = index_dir / 'manifest.json'
    manifest = _read_json(manifest_path)
    dimension = manifest.get('observedDimension')
    if (
        manifest.get('recordType') != 'index-manifest'
        or manifest.get('formatVersion') != FORMAT_VERSION
        or manifest.get('normalizationVersion') != NORMALIZATION_VERSION
        or manifest.get('vectorNormalization') != 'l2'
        or not isinstance(manifest.get('model'), str)
        or not isinstance(dimension, int)
        or dimension <= 0
    ):
        raise RetrievalContractError(f'index identity is invalid: {index_dir}')
    files = manifest.get('files')
    if not isinstance(files, dict):
        raise RetrievalContractError(f'index file inventory is invalid: {index_dir}')
    for name, expected_hash in files.items():
        path = index_dir / name
        if not path.is_file() or sha256_file(path) != expected_hash:
            raise RetrievalContractError(f'index file hash mismatch: {name}')
    vector_bytes = (index_dir / 'vectors.f32').stat().st_size
    index_bytes = sum(path.stat().st_size for path in index_dir.iterdir() if path.is_file())
    return manifest, sha256_file(manifest_path), index_bytes, vector_bytes


def _resident_artifact_bytes(index_dir: Path) -> int:
    return sum((index_dir / name).stat().st_size for name in RESIDENT_ARTIFACT_FILES)


def _corpus_identity(manifest: dict[str, Any]) -> str:
    files = manifest.get('files')
    counts = manifest.get('counts')
    if not isinstance(files, dict) or not isinstance(counts, dict):
        raise RetrievalContractError('index corpus identity is invalid')
    return canonical_value_hash({
        'sourceRevision': manifest.get('sourceRevision'),
        'books': manifest.get('books'),
        'sourcePriority': manifest.get('sourcePriority'),
        'windows': counts.get('windows'),
        'bodyBytes': counts.get('bodyBytes'),
        'lexicalTerms': counts.get('lexicalTerms'),
        'bodiesHash': files.get('bodies.utf8'),
        'windowsHash': files.get('windows.jsonl'),
        'lexicalTermsHash': files.get('lexical-terms.jsonl'),
        'lexicalPostingsHash': files.get('lexical-postings.bin'),
    })


def _build_provider_evidence(
    index_dir: Path,
    manifest: dict[str, Any],
) -> tuple[int, list[str]]:
    report = _read_json(index_dir / 'build-report.json')
    if (
        report.get('recordType') != 'build-report'
        or report.get('formatVersion') != FORMAT_VERSION
        or report.get('status') != 'complete'
        or report.get('sourceRevision') != manifest.get('sourceRevision')
        or report.get('model') != manifest.get('model')
        or report.get('observedDimension') != manifest.get('observedDimension')
        or report.get('normalizationVersion') != manifest.get('normalizationVersion')
        or report.get('bookCount') != manifest.get('counts', {}).get('books')
        or report.get('windowCount') != manifest.get('counts', {}).get('windows')
        or report.get('cacheHits', -1) + report.get('cacheMisses', -1)
        != manifest.get('counts', {}).get('windows')
        or not _validate_build_provider_evidence(report)
        or report.get('fileHashes') != {
            name: manifest['files'][name] for name in CORE_FILES
        }
    ):
        raise RetrievalContractError('build report is inconsistent with the index')
    return report['providerUsageTokens'], report['providerTraceIds']


def _evaluate_index(
    index_dir: Path,
    queries: list[dict[str, Any]],
    *,
    embed: Callable[[str, Sequence[str]], dict[str, Any]],
    input_cny_per_million_tokens: float,
    batch_size: int,
) -> dict[str, Any]:
    if batch_size <= 0:
        raise RetrievalContractError('evaluation batch size must be positive')
    manifest, manifest_hash, index_bytes, vector_bytes = _index_identity(index_dir)
    model = manifest['model']
    query_vectors: list[list[float]] = []
    query_usage_tokens = 0
    latency_samples: list[float] = []
    query_trace_ids: list[str] = []
    for start in range(0, len(queries), batch_size):
        texts = [record['query'] for record in queries[start:start + batch_size]]
        vectors_batch, tokens, latency_ms, trace_id = _provider_batch(
            embed(model, texts),
            len(texts),
        )
        latency_samples.append(latency_ms)
        query_usage_tokens += tokens
        if trace_id is not None and trace_id not in query_trace_ids:
            query_trace_ids.append(trace_id)
        query_vectors.extend(
            validate_and_normalize_vector(vector, manifest['observedDimension'])
            for vector in vectors_batch
        )
    windows = _read_jsonl(index_dir / 'windows.jsonl')
    terms, postings_bytes = _load_lexical_index(index_dir, len(windows))
    vectors = _load_vectors(
        index_dir / 'vectors.f32',
        len(windows),
        manifest['observedDimension'],
    )
    window_ids = [window['id'] for window in windows]
    unit_ids_by_row = [
        {window['primaryUnitId'], *window['owningUnitIds']}
        for window in windows
    ]
    results: list[dict[str, Any]] = []
    hits = 0
    for query, query_vector in zip(queries, query_vectors):
        eligible = query['acceptableUnitIds']
        ranked_rows = _query_rank(
            query['query'],
            terms,
            postings_bytes,
            len(windows),
            vectors,
            query_vector,
            windows=windows,
            books=manifest['books'],
            source_priority=manifest['sourcePriority'],
        )
        hit = any(set(eligible) & unit_ids_by_row[row] for row in ranked_rows)
        hits += int(hit)
        results.append({
            'queryId': query['queryId'],
            'hitAt10': hit,
            'candidateWindowIds': [window_ids[row] for row in ranked_rows],
            'mode': 'lexical-vector-rrf',
        })
    recall = hits / len(queries) if queries else 0.0
    return {
        'model': model,
        'observedDimension': manifest['observedDimension'],
        'normalizationVersion': manifest['normalizationVersion'],
        'indexManifestHash': manifest_hash,
        'indexBytes': index_bytes,
        'vectorBytes': vector_bytes,
        'evaluatedQueries': len(queries),
        'hitsAt10': hits,
        'recallAt10': recall,
        'threshold': 0.8,
        'passed': recall >= 0.8,
        'embeddingLatencyMs': _latency_metrics(latency_samples),
        'queryUsageTokens': query_usage_tokens,
        'usageTokens': query_usage_tokens,
        'queryApiCostCny': (
            query_usage_tokens * float(input_cny_per_million_tokens) / 1_000_000
        ),
        'apiCostCny': (
            query_usage_tokens * float(input_cny_per_million_tokens) / 1_000_000
        ),
        'queryTraceIds': query_trace_ids,
        'providerTraceIds': query_trace_ids,
        'results': results,
    }


def evaluate_models(
    index_dirs: Sequence[Path],
    benchmark_path: Path,
    split_path: Path,
    benchmark_lock_path: Path,
    *,
    embed: Callable[[str, Sequence[str]], dict[str, Any]],
    batch_size: int = 16,
) -> dict[str, Any]:
    benchmark, split, lock, lock_hash = _validate_benchmark_lock(
        benchmark_path, split_path, benchmark_lock_path,
    )
    if len(index_dirs) != 3:
        raise RetrievalContractError('evaluate-models requires exactly three index directories')
    manifests = [_index_identity(index_dir)[0] for index_dir in index_dirs]
    identities = [manifest['model'] for manifest in manifests]
    if len(set(identities)) != 3 or set(identities) != set(DECLARED_MODELS):
        raise RetrievalContractError('evaluate-models index models do not match declared candidates')
    if len({_corpus_identity(manifest) for manifest in manifests}) != 1:
        raise RetrievalContractError(
            'evaluate-models indexes must contain the same derived corpus',
        )
    query_by_id = {record['queryId']: record for record in benchmark}
    tuning_queries = [query_by_id[query_id] for query_id in split['tuningQueryIds']]
    prices = lock['pricing']['inputCnyPerMillionTokens']
    candidates = []
    for index, (index_dir, model) in enumerate(zip(index_dirs, identities)):
        candidate = _evaluate_index(
            index_dir,
            tuning_queries,
            embed=embed,
            input_cny_per_million_tokens=prices[model],
            batch_size=batch_size,
        )
        manifest = manifests[index]
        corpus_usage_tokens, corpus_trace_ids = _build_provider_evidence(
            index_dir,
            manifest,
        )
        corpus_cost = corpus_usage_tokens * float(prices[model]) / 1_000_000
        candidate['corpusUsageTokens'] = corpus_usage_tokens
        candidate['corpusApiCostCny'] = corpus_cost
        candidate['corpusTraceIds'] = corpus_trace_ids
        candidate['usageTokens'] = corpus_usage_tokens + candidate['queryUsageTokens']
        candidate['apiCostCny'] = corpus_cost + candidate['queryApiCostCny']
        candidate['providerTraceIds'] = list(dict.fromkeys([
            *corpus_trace_ids,
            *candidate['queryTraceIds'],
        ]))
        candidate['recallPassed'] = candidate['passed']
        candidate['residentArtifactBytes'] = _resident_artifact_bytes(index_dir)
        candidate['residentArtifactBudgetBytes'] = RESIDENT_ARTIFACT_BUDGET_BYTES
        candidate['residentArtifactPassed'] = (
            candidate['residentArtifactBytes'] <= RESIDENT_ARTIFACT_BUDGET_BYTES
        )
        candidate['passed'] = (
            candidate['recallPassed'] and candidate['residentArtifactPassed']
        )
        candidates.append(candidate)
    passing = [candidate for candidate in candidates if candidate['passed']]
    if not passing:
        raise RetrievalContractError(
            'no declared embedding candidate passed Recall@10 and resident artifact budget',
        )
    selected = min(
        passing,
        key=lambda candidate: (
            candidate['apiCostCny'],
            candidate['indexBytes'],
            candidate['model'],
        ),
    )
    return {
        'recordType': 'selection-report',
        'formatVersion': FORMAT_VERSION,
        'split': 'tuning',
        'benchmarkHash': lock['benchmarkHash'],
        'splitHash': lock['splitHash'],
        'benchmarkLockHash': lock_hash,
        'candidateModels': list(DECLARED_MODELS),
        'candidates': candidates,
        'selectedModel': selected['model'],
        'selectedObservedDimension': selected['observedDimension'],
        'selectedNormalizationVersion': selected['normalizationVersion'],
        'selectedIndexManifestHash': selected['indexManifestHash'],
        'selectionRule': (
            'recall-and-resident-artifact-passing-apiCostCny-indexBytes-model'
        ),
        'acceptanceEvaluated': False,
    }


def evaluate_acceptance(
    index_dir: Path,
    benchmark_path: Path,
    split_path: Path,
    benchmark_lock_path: Path,
    selection_report_path: Path,
    locked_config_path: Path,
    *,
    embed: Callable[[str, Sequence[str]], dict[str, Any]],
    batch_size: int = 16,
) -> dict[str, Any]:
    benchmark, split, lock, lock_hash = _validate_benchmark_lock(
        benchmark_path, split_path, benchmark_lock_path,
    )
    selection = _read_json(selection_report_path)
    locked = _read_json(locked_config_path)
    manifest, manifest_hash, _, _ = _index_identity(index_dir)
    selection_hash = sha256_file(selection_report_path)
    required = {
        'locked': True,
        'selectionReportHash': selection_hash,
        'selectedModel': manifest.get('model'),
        'selectedObservedDimension': manifest.get('observedDimension'),
        'selectedNormalizationVersion': manifest.get('normalizationVersion'),
        'selectedIndexManifestHash': manifest_hash,
        'benchmarkHash': lock['benchmarkHash'],
        'splitHash': lock['splitHash'],
        'benchmarkLockHash': lock_hash,
    }
    if (
        any(locked.get(key) != value for key, value in required.items())
        or selection.get('recordType') != 'selection-report'
        or selection.get('benchmarkLockHash') != lock_hash
        or selection.get('benchmarkHash') != lock['benchmarkHash']
        or selection.get('splitHash') != lock['splitHash']
        or selection.get('selectedModel') != manifest.get('model')
        or selection.get('selectedObservedDimension') != manifest.get('observedDimension')
        or selection.get('selectedNormalizationVersion') != manifest.get('normalizationVersion')
        or selection.get('selectedIndexManifestHash') != manifest_hash
    ):
        raise RetrievalContractError('locked acceptance configuration does not match inputs')
    query_by_id = {record['queryId']: record for record in benchmark}
    acceptance_queries = [
        query_by_id[query_id] for query_id in split['acceptanceQueryIds']
    ]
    metrics = _evaluate_index(
        index_dir,
        acceptance_queries,
        embed=embed,
        input_cny_per_million_tokens=lock['pricing']['inputCnyPerMillionTokens'][
            manifest['model']
        ],
        batch_size=batch_size,
    )
    return {
        'recordType': 'acceptance-report',
        'formatVersion': FORMAT_VERSION,
        'split': 'acceptance',
        'benchmarkHash': lock['benchmarkHash'],
        'splitHash': lock['splitHash'],
        'benchmarkLockHash': lock_hash,
        'selectionReportHash': selection_hash,
        'acceptanceEvaluated': True,
        **metrics,
    }


def _add_index_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        '--runtime-root',
        type=Path,
        default=DEFAULT_RUNTIME_ROOT,
    )
    parser.add_argument('--expected-book-count', type=int)
    parser.add_argument('--resource-set', type=Path)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    build = commands.add_parser('build-index')
    _add_index_arguments(build)
    build.add_argument('--output-dir', type=Path, required=True)
    build.add_argument('--model', default=DEFAULT_MODEL)
    build.add_argument('--expected-dimension', type=int)
    build.add_argument('--cache-root', type=Path, required=True)
    build.add_argument('--batch-size', type=int, default=32)
    build.add_argument('--timeout', type=float, default=30.0)
    build.add_argument('--endpoint', default=DEFAULT_ENDPOINT)

    verify = commands.add_parser('verify-index')
    _add_index_arguments(verify)
    verify.add_argument('--index-dir', type=Path, required=True)

    for command in ('evaluate-models', 'evaluate-acceptance'):
        evaluate_parser = commands.add_parser(command)
        evaluate_parser.add_argument(
            '--index-dir',
            type=Path,
            required=True,
            action='append' if command == 'evaluate-models' else 'store',
        )
        evaluate_parser.add_argument('--benchmark', type=Path, required=True)
        evaluate_parser.add_argument('--split-file', type=Path, required=True)
        evaluate_parser.add_argument('--benchmark-lock', type=Path, required=True)
        evaluate_parser.add_argument('--batch-size', type=int, default=16)
        evaluate_parser.add_argument('--timeout', type=float, default=30.0)
        evaluate_parser.add_argument('--endpoint', default=DEFAULT_ENDPOINT)
        evaluate_parser.add_argument('--output', type=Path)
        if command == 'evaluate-acceptance':
            evaluate_parser.add_argument('--locked-config', type=Path, required=True)
            evaluate_parser.add_argument('--selection-report', type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.resource_set is not None:
        resource_count = textbook_book_count(args.resource_set)
        if (
            args.expected_book_count is not None
            and args.expected_book_count != resource_count
        ):
            raise RetrievalContractError(
                'expected-book-count and resource-set disagree:'
                f'expected={args.expected_book_count}:resource-set={resource_count}',
            )
        args.expected_book_count = resource_count
    if args.expected_book_count is None:
        raise RetrievalContractError(
            '--resource-set or --expected-book-count is required',
        )
    if args.command == 'build-index':
        api_key = os.environ.get('SILICONFLOW_API_KEY', '')
        client = (
            SiliconFlowEmbeddingClient(
                api_key,
                args.model,
                endpoint=args.endpoint,
                timeout=args.timeout,
            )
            if api_key
            else None
        )
        result = build_index(
            args.runtime_root,
            args.output_dir,
            model=args.model,
            expected_dimension=args.expected_dimension,
            cache_root=args.cache_root,
            expected_book_count=args.expected_book_count,
            batch_size=args.batch_size,
            embed=client.embed_with_evidence if client else None,
            resource_set=args.resource_set,
        )
    elif args.command == 'verify-index':
        result = verify_index(
            args.index_dir,
            runtime_root=args.runtime_root,
            expected_book_count=args.expected_book_count,
            resource_set=args.resource_set,
        )
    else:
        api_key = os.environ.get('SILICONFLOW_API_KEY', '')
        if not api_key:
            raise RetrievalContractError(
                'evaluation requires SILICONFLOW_API_KEY for query embeddings',
            )
        clients: dict[str, SiliconFlowEmbeddingClient] = {}

        def embed_query_batch(
            model: str,
            texts: Sequence[str],
        ) -> dict[str, Any]:
            client = clients.setdefault(
                model,
                SiliconFlowEmbeddingClient(
                    api_key,
                    model,
                    endpoint=args.endpoint,
                    timeout=args.timeout,
                ),
            )
            return client.embed_with_evidence(texts)

        if args.command == 'evaluate-models':
            result = evaluate_models(
                args.index_dir,
                args.benchmark,
                args.split_file,
                args.benchmark_lock,
                embed=embed_query_batch,
                batch_size=args.batch_size,
            )
        else:
            result = evaluate_acceptance(
                args.index_dir,
                args.benchmark,
                args.split_file,
                args.benchmark_lock,
                args.selection_report,
                args.locked_config,
                embed=embed_query_batch,
                batch_size=args.batch_size,
            )
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            _write_json(args.output, result)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RetrievalContractError, RuntimeError) as error:
        print(str(error), file=os.sys.stderr)
        raise SystemExit(1)
