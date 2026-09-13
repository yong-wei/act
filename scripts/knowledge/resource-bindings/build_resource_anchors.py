#!/usr/bin/env python3
"""Build authoring truth for the anchored resource binding release.

Produces, under course-content/authoring/knowledge/resource-bindings/:

  course-node-crosswalk.jsonl   course node (名称_章_序号) -> canonical ids, or `unmapped`
  unit-scope/<unit>.json        canonical knowledge scope of one unit and where it came from
  anchors/<unit>.json           step / handout heading / media segment anchors with candidate
                                canonical nodes and provenance
  anchors-summary.json          coverage statistics

Deterministic: no timestamps, stable ordering. Inputs are the v0.37-r6 release label
indexes, course-order topics, lesson manifests/sequence, runtime handouts and interactive
manifests, the 2026-08-23 audio ASR batch, the 2026-09-13 course-video ASR batch, and the
Videos project caption scripts for intro videos.

Usage: python3 scripts/knowledge/resource-bindings/build_resource_anchors.py [--units 3-8 ...]
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
RELEASE_DIR = REPO / 'course-content/authoring/knowledge/releases/control-theory-engineering-v0.37-r6'
AUTHORING_KNOWLEDGE = REPO / 'course-content/authoring/knowledge'
OUT_DIR = AUTHORING_KNOWLEDGE / 'resource-bindings'
LESSONS_AUTHORING = REPO / 'course-content/authoring/lessons'
LESSONS_RUNTIME = REPO / 'course-content/runtime/lessons'
COURSE_ORDER = AUTHORING_KNOWLEDGE / 'teaching-projection/course-order'
AUDIO_BATCH = AUTHORING_KNOWLEDGE / 'formal-resource-remediation/20260823-asr-batch'
COURSE_VIDEO_BATCH = AUTHORING_KNOWLEDGE / 'formal-resource-remediation/20260913-course-video-asr'
PREREQ_RUNTIME = REPO / 'course-content/runtime/knowledge/prerequisites'
VIDEOS_PROJECT = Path('/Users/YW/Documents/Project/Videos/src/projects')

SEGMENT_MIN_SECONDS = 8.0
SEGMENT_MAX_SECONDS = 25.0
SENTENCE_END = set('。！？!?；;')
INTRO_OFFSET_TOLERANCE_SECONDS = 1.5
TOP_K_PER_CHUNK = 3
LONG_CHUNK_TOP_K = 5
CJK = re.compile(r'[\u4e00-\u9fff]')

# Labels too generic to anchor a passage on their own. Kept explicit for audit.
DEFAULT_STOPLIST = [
    '系统', '模型', '对象', '信号', '输入', '输出', '参数', '方法', '条件', '结构', '性能', '设计',
    '控制', '过程', '状态', '函数', '方程', '曲线', '矩阵', '向量', '误差', '时间', '频率', '响应',
    '稳定', '变量', '常数', '关系', '问题', '目标', '任务', '数据', '算法', '实验', '仿真',
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def ffprobe_duration(path: Path) -> float | None:
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
            check=True, capture_output=True, text=True,
        ).stdout.strip()
        return float(out)
    except Exception:
        return None


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    for line in path.read_text('utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        rows.append(json.loads(line))
    return rows


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + '\n', 'utf-8')


ID_PREFIX_RANKS = ('ctkg:v3e-canonical-', 'ctc:', 'ctkg:v3e-object-', 'ctkg:domainconcept:', 'ctkg:m3-', 'ctkg:')


def id_prefix_rank(entity_id: str) -> int:
    for rank, prefix in enumerate(ID_PREFIX_RANKS):
        if entity_id.startswith(prefix):
            return rank
    return len(ID_PREFIX_RANKS)


def slugify_heading(title: str) -> str:
    t = re.sub(r'^[一二三四五六七八九十]+、\s*', '', title)
    t = re.sub(r'^\d+(\.\d+)*\s*', '', t)
    t = re.sub(r'[\s:：、，,。.（）()《》「」【】\[\]—–\-/]+', '-', t).strip('-')
    return t[:32] or 'section'


# ---------------------------------------------------------------- label table

class LabelTable:
    def __init__(self) -> None:
        self.labels: dict[str, list[tuple[str, str, str]]] = collections.defaultdict(list)  # entity -> (label, kind, lang)
        self.entity_types: dict[str, str] = {}
        self.display: dict[str, str] = {}
        self.zh_index: dict[str, set[str]] = collections.defaultdict(set)
        self.ambiguous_labels: dict[str, list[str]] = {}
        stop_path = OUT_DIR / 'label-stoplist.json'
        self.stoplist = set(json.loads(stop_path.read_text('utf-8'))) if stop_path.exists() else set(DEFAULT_STOPLIST)
        if not stop_path.exists():
            write_json(stop_path, sorted(self.stoplist))
        for row in read_jsonl(RELEASE_DIR / 'multilingual-label-index.jsonl'):
            kind = 'preferred' if row['label_type'] == 'canonical_preferred' else 'alias'
            self._add(row['entity_id'], row['label'], kind, row['language'])
        for row in read_jsonl(RELEASE_DIR / 'localized-content-index.jsonl'):
            if row.get('field_path') not in ('name', 'alias') or row.get('value_kind') != 'plain_text':
                continue
            kind = 'preferred' if row['field_path'] == 'name' else 'alias'
            self._add(row['target_id'], row['value'], kind, row['locale'])
        dp = json.loads((RELEASE_DIR / 'domain-projection.json').read_text('utf-8'))
        for node in dp['nodes']:
            self.entity_types[node['entity_id']] = node.get('entity_type') or ''
            self.display[node['entity_id']] = node.get('display_name') or ''
        for row in read_jsonl(OUT_DIR / 'label-aliases.jsonl'):
            for alias in row.get('aliases', []):
                self._add(row['canonicalId'], alias, 'alias', row.get('language', 'zh-CN'))

    def _add(self, entity: str, label: str, kind: str, lang: str) -> None:
        label = (label or '').strip()
        if not label:
            return
        key = (label, kind, lang)
        if key in self.labels[entity]:
            return
        self.labels[entity].append(key)
        if lang == 'zh-CN':
            self.zh_index[label].add(entity)

    def resolve_name(self, name: str) -> set[str]:
        return set(self.zh_index.get(name, set()))

    def _entries(self) -> tuple[list[tuple[str, str, str]], list[tuple[str, str, str, re.Pattern]]]:
        if hasattr(self, '_zh_entries'):
            return self._zh_entries, self._en_entries
        zh: list[tuple[str, str, str]] = []
        en: list[tuple[str, str, str, re.Pattern]] = []
        for entity, labels in self.labels.items():
            for label, kind, lang in labels:
                if label in self.stoplist:
                    continue
                if lang == 'zh-CN' or CJK.search(label):
                    if len(label) >= 2:
                        zh.append((label, entity, kind))
                elif len(label) >= 5:
                    en.append((label.lower(), entity, kind, re.compile(r'(?<![a-z0-9])' + re.escape(label.lower()) + r'(?![a-z0-9])')))
        self._zh_entries, self._en_entries = zh, en
        return zh, en

    def match(self, text: str, scope: set[str], top_k: int = TOP_K_PER_CHUNK) -> list[dict]:
        """Deterministic label-occurrence matching. In-scope entities may match on labels of
        length >= 2 (2-char labels need >= 3 occurrences); out-of-scope entities only on
        specific labels (zh >= 4 chars, en >= 6 chars). One entity per matched label:
        DomainConcept first, then in-scope, then lexicographic id. Returns top-K by score."""
        if not text:
            return []
        lowered = text.lower()
        zh_entries, en_entries = self._entries()
        per_label: dict[str, list[tuple[float, str, str]]] = collections.defaultdict(list)
        for label, entity, kind in zh_entries:
            in_scope = entity in scope
            n = len(label)
            if not in_scope and n < 4:
                continue
            count = text.count(label)
            if count == 0 or (n == 2 and count < 3):
                continue
            score = count * n * (2 if kind == 'preferred' else 1) * (2 if in_scope else 1)
            per_label[label].append((score, entity, kind))
        for label, entity, kind, pattern in en_entries:
            in_scope = entity in scope
            if len(label) < (5 if in_scope else 6) or label not in lowered:
                continue
            count = len(pattern.findall(lowered))
            if count == 0:
                continue
            score = count * min(len(label), 12) * (2 if kind == 'preferred' else 1) * 0.5 * (2 if in_scope else 1)
            per_label[label].append((score, entity, kind))

        chosen: dict[str, tuple[float, str, str]] = {}
        for label, candidates in per_label.items():
            candidates.sort(key=lambda c: (
                0 if c[1] in scope else 1,
                0 if self.entity_types.get(c[1]) == 'DomainConcept' else 1,
                id_prefix_rank(c[1]),
                -c[0],
                c[1],
            ))
            score, entity, kind = candidates[0]
            # Same label, same scope status, same type, same id family, none in scope:
            # identity is ambiguous and must not create a binding.
            if entity not in scope and len(candidates) > 1:
                second = candidates[1]
                if (
                    second[1] not in scope
                    and self.entity_types.get(second[1]) == self.entity_types.get(entity)
                    and id_prefix_rank(second[1]) == id_prefix_rank(entity)
                ):
                    self.ambiguous_labels[label] = sorted(c[1] for c in candidates)
                    continue
            if entity not in chosen or chosen[entity][0] < score:
                chosen[entity] = (score, label, kind)
        ranked = sorted(chosen.items(), key=lambda item: (-item[1][0], item[0]))
        if not ranked:
            return []
        best_score = ranked[0][1][0]
        out = []
        for entity, (score, label, kind) in ranked[:top_k]:
            if score < best_score * 0.2:
                break
            out.append({
                'canonicalId': entity,
                'matchedLabel': label,
                'labelKind': kind,
                'inScope': entity in scope,
                'score': round(score, 2),
            })
        return out


# ---------------------------------------------------------------- crosswalk

def build_crosswalk(table: LabelTable, topics: list[dict]) -> list[dict]:
    canonical_nodes = json.loads((AUTHORING_KNOWLEDGE / 'canonical-nodes.json').read_text('utf-8'))['nodes']
    topic_by_label = {t['label']: t for t in topics}
    c2a_path = AUDIO_BATCH / 'course-to-authority-map.json'
    course_to_authority = json.loads(c2a_path.read_text('utf-8')) if c2a_path.exists() else {}
    manual = {r['courseNodeId']: r for r in read_jsonl(OUT_DIR / 'course-node-crosswalk.manual.jsonl')}
    rows = []
    for node in sorted(canonical_nodes, key=lambda n: n['canonical_node_id']):
        node_id = node['canonical_node_id']
        name = node['canonical_name']
        aliases = [a for a in node.get('aliases', []) if a]
        method = None
        ids: list[str] = []
        if node_id in manual:
            ids = list(manual[node_id].get('canonicalIds', []))
            method = 'manual'
        if not ids:
            for candidate in [name, *aliases]:
                if candidate in topic_by_label:
                    ids = list(topic_by_label[candidate]['canonicalIds'])
                    method = 'course-order-topic'
                    break
        if not ids:
            for candidate in [name, *aliases]:
                if candidate in course_to_authority:
                    ids = [course_to_authority[candidate]]
                    method = 'course-to-authority-map'
                    break
        if not ids:
            for candidate in [name, *aliases]:
                found = table.resolve_name(candidate)
                if len(found) == 1:
                    ids = sorted(found)
                    method = 'label-exact-unique'
                    break
                if len(found) > 1:
                    # Prefer a DomainConcept when the label is shared with statements/conditions.
                    concepts = sorted(e for e in found if table.entity_types.get(e) == 'DomainConcept')
                    if len(concepts) == 1:
                        ids = concepts
                        method = 'label-exact-domain-concept'
                        break
        rows.append({
            'courseNodeId': node_id,
            'courseName': name,
            'aliases': aliases,
            'ownerLesson': node.get('owner_lesson'),
            'canonicalIds': ids,
            'method': method,
            'status': 'mapped' if ids else 'unmapped',
        })
    return rows


# ---------------------------------------------------------------- unit scope

def load_prereq_core_nodes() -> list[dict]:
    current = json.loads((PREREQ_RUNTIME / 'current.json').read_text('utf-8'))
    release_dir = PREREQ_RUNTIME / 'releases' / current['publicationId']
    data = json.loads((release_dir / 'projection-core-nodes.json').read_text('utf-8'))
    return data if isinstance(data, list) else (data.get('coreNodes') or data.get('nodes') or [])


def build_unit_scope(unit: str, topics: list[dict], crosswalk: dict[str, dict], core_nodes: list[dict], lesson: dict) -> dict:
    sources: dict[str, set[str]] = collections.defaultdict(set)
    for t in topics:
        if unit in t.get('units', []):
            for cid in t['canonicalIds']:
                sources[cid].add(f'topic:{t["key"]}')
    marker = f'/lessons/{unit}/'
    for c in core_nodes:
        if any(marker in ev for ev in c.get('sourceEvidence', [])):
            sources[c['canonicalId']].add('prerequisite-core-evidence')
    for field in ('focus_node_ids', 'reuse_node_ids', 'entry_nodes', 'summary_nodes'):
        for node_id in lesson.get(field, []):
            row = crosswalk.get(node_id)
            if row and row['status'] == 'mapped':
                for cid in row['canonicalIds']:
                    sources[cid].add(f'{field}:{node_id}')
    return {
        'contract': 'act-resource-binding-unit-scope/v1',
        'unit': unit,
        'canonicalIds': sorted(sources),
        'sources': {cid: sorted(v) for cid, v in sorted(sources.items())},
    }


# ---------------------------------------------------------------- anchors

def collect_strings(value, out: list[str]) -> None:
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, dict):
        for k, v in value.items():
            if k in ('src', 'path', 'id', 'kind', 'template', 'region', 'legacyKind', 'presentation', 'semanticRole', 'block_key', 'type'):
                continue
            collect_strings(v, out)
    elif isinstance(value, list):
        for v in value:
            collect_strings(v, out)


def step_anchors(unit: str, lesson: dict, table: LabelTable, scope: set[str], crosswalk: dict[str, dict]) -> list[dict]:
    manifest_path = LESSONS_RUNTIME / unit / 'interactive-manifest.json'
    if not manifest_path.exists():
        return []
    manifest = json.loads(manifest_path.read_text('utf-8'))
    steps = manifest.get('steps') or {}
    step_items = list(steps.items()) if isinstance(steps, dict) else [(s.get('id') or s.get('stepId'), s) for s in steps]
    group_by_step: dict[str, dict] = {}
    for group in (lesson.get('sequence') or {}).get('groups', []):
        for sid in group.get('step_ids', []):
            group_by_step[sid] = group
    out = []
    for index, (step_id, step) in enumerate(step_items):
        texts: list[str] = []
        collect_strings({'title': step.get('title'), 'modules': step.get('modules'), 'content_blocks': step.get('content_blocks')}, texts)
        text = '\n'.join(texts)
        candidates: dict[str, dict] = {}
        group = group_by_step.get(step_id)
        if group:
            for node_id in group.get('node_ids', []):
                row = crosswalk.get(node_id)
                if row and row['status'] == 'mapped':
                    for cid in row['canonicalIds']:
                        candidates.setdefault(cid, {'canonicalId': cid, 'provenance': 'sequence-crosswalk', 'courseNodeId': node_id})
        for hit in table.match(text, scope, top_k=LONG_CHUNK_TOP_K):
            candidates.setdefault(hit['canonicalId'], {**hit, 'provenance': 'step-terminology'})
        out.append({
            'stepId': step_id,
            'index': index,
            'title': step.get('title'),
            'groupName': group.get('group_name') if group else None,
            'textChars': len(text),
            'canonical': sorted(candidates.values(), key=lambda c: c['canonicalId']),
        })
    return out


def handout_anchors(unit: str, table: LabelTable, scope: set[str]) -> tuple[list[dict], dict]:
    candidates = [LESSONS_RUNTIME / unit / f'{unit}-handout.md', LESSONS_RUNTIME / unit / 'handout.md']
    path = next((p for p in candidates if p.exists()), None)
    if path is None:
        return [], {}
    markdown = path.read_text('utf-8')
    lines = markdown.splitlines()
    headings = []
    for line_no, line in enumerate(lines):
        m = re.match(r'^(#{2,3})\s+(.+?)\s*$', line)
        if m:
            headings.append((line_no, len(m.group(1)), m.group(2).strip()))
    sections = []
    for i, (line_no, level, title) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(lines)
        body = '\n'.join(lines[line_no + 1:end])
        heading_id = f'h{i + 1}-{slugify_heading(title)}'
        hits = table.match(title + '\n' + body, scope, top_k=LONG_CHUNK_TOP_K)
        sections.append({
            'headingId': heading_id,
            'order': i + 1,
            'level': level,
            'title': title,
            'startLine': line_no + 1,
            'endLine': end,
            'bodyChars': len(body),
            'canonical': [{**h, 'provenance': 'heading-terminology'} for h in hits],
        })
    meta = {'runtimePath': str(path.relative_to(REPO / 'course-content/runtime')), 'sha256': sha256_file(path)}
    return sections, meta


def group_cues(cues: list[dict], duration: float) -> list[dict]:
    """Group short caption cues into 8–25 s windows ending at sentence ends."""
    segments = []
    buf: list[dict] = []
    for i, cue in enumerate(cues):
        buf.append(cue)
        start = buf[0]['start']
        elapsed = cue['end'] - start
        text = cue['text'].strip()
        ends_sentence = bool(text) and text[-1] in SENTENCE_END
        last = i == len(cues) - 1
        if (ends_sentence and elapsed >= SEGMENT_MIN_SECONDS) or elapsed >= SEGMENT_MAX_SECONDS or last:
            segments.append({
                'startSeconds': round(start, 2),
                'endSeconds': round(min(cue['end'], duration), 2),
                'text': ''.join(c['text'] for c in buf),
            })
            buf = []
    return segments


def media_from_asr_segments(unit: str, kind: str, runtime_path: Path, segments_file: Path, table: LabelTable, scope: set[str], provenance: str) -> dict | None:
    if not runtime_path.exists() or not segments_file.exists():
        return None
    data = json.loads(segments_file.read_text('utf-8'))
    duration = ffprobe_duration(runtime_path)
    sha = sha256_file(runtime_path)
    source_sha = data.get('sourceSha256')
    segments = []
    clamped = 0
    for index, seg in enumerate(data.get('segments', [])):
        start, end = float(seg['startSeconds']), float(seg['endSeconds'])
        # Forced alignment can overrun the media tail by a few seconds; anchors must stay
        # inside the media, so overrunning tails are clamped and fully-outside segments dropped.
        if duration is not None:
            if start >= duration - 0.5:
                clamped += 1
                continue
            if end > duration:
                end = round(duration, 2)
                clamped += 1
        if end <= start:
            continue
        hits = table.match(seg.get('text', ''), scope)
        segments.append({
            'index': index,
            'startSeconds': start,
            'endSeconds': end,
            'textPreview': (seg.get('text') or '')[:40],
            'canonical': [{**h, 'provenance': provenance} for h in hits],
        })
    return {
        'mediaId': f'{unit}-{kind}',
        'kind': 'audio' if kind == 'audio' else 'video',
        'runtimePath': str(runtime_path.relative_to(REPO / 'course-content/runtime')),
        'sha256': sha,
        'durationSeconds': duration,
        'transcriptSource': str(segments_file.relative_to(REPO)),
        'transcriptSourceSha256': source_sha,
        'transcriptMatchesMedia': (source_sha == sha) if source_sha else None,
        'offsetSeconds': 0.0,
        'offsetVerified': True,
        'clampedSegments': clamped,
        'segments': segments,
    }


def parse_captions_module(path: Path) -> tuple[list[dict], float | None]:
    src = path.read_text('utf-8')
    m = re.search(r'export const captions\s*=\s*\[', src)
    cues: list[dict] = []
    if m:
        # Find the matching closing bracket of the array literal (string-aware).
        depth = 0
        i = m.end() - 1
        in_str: str | None = None
        while i < len(src):
            ch = src[i]
            if in_str:
                if ch == '\\':
                    i += 1
                elif ch == in_str:
                    in_str = None
            elif ch in ('"', "'", '`'):
                in_str = ch
            elif ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    break
            i += 1
        body = src[m.end() - 1:i + 1]
        cue_re = re.compile(
            r'\{\s*(?:"?start"?|start)\s*:\s*([\d.]+)\s*,\s*(?:"?end"?|end)\s*:\s*([\d.]+)\s*,\s*(?:"?text"?|text)\s*:\s*("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')',
            re.S,
        )
        for sm in cue_re.finditer(body):
            raw = sm.group(3)
            text = json.loads(raw) if raw.startswith('"') else raw[1:-1].replace("\\'", "'")
            cues.append({'start': float(sm.group(1)), 'end': float(sm.group(2)), 'text': text})
    d = re.search(r'narrationDurationSeconds\s*=\s*([\d.]+)', src)
    return cues, (float(d.group(1)) if d else None)


def parse_wiring(path: Path) -> tuple[int, int, int]:
    src = path.read_text('utf-8') if path.exists() else ''
    fps = int(re.search(r'FPS\s*=\s*(\d+)', src).group(1)) if re.search(r'FPS\s*=\s*(\d+)', src) else 30
    intro = int(re.search(r'INTRO_FRAMES\s*=\s*(\d+)', src).group(1)) if re.search(r'INTRO_FRAMES\s*=\s*(\d+)', src) else 300
    outro = int(re.search(r'OUTRO_FRAMES\s*=\s*(\d+)', src).group(1)) if re.search(r'OUTRO_FRAMES\s*=\s*(\d+)', src) else 360
    return fps, intro, outro


def media_from_intro_captions(unit: str, table: LabelTable, scope: set[str]) -> dict | None:
    runtime_path = LESSONS_RUNTIME / unit / 'media' / f'{unit}-intro-video.mp4'
    captions_path = VIDEOS_PROJECT / f'lesson-{unit}' / 'assets' / 'audio' / 'captions.generated.ts'
    if not runtime_path.exists():
        return None
    duration = ffprobe_duration(runtime_path)
    sha = sha256_file(runtime_path)
    base = {
        'mediaId': f'{unit}-intro-video',
        'kind': 'video',
        'runtimePath': str(runtime_path.relative_to(REPO / 'course-content/runtime')),
        'sha256': sha,
        'durationSeconds': duration,
    }
    if not captions_path.exists():
        return {**base, 'transcriptSource': None, 'offsetVerified': False, 'offsetStatus': 'missing-production-script', 'segments': []}
    cues, narration = parse_captions_module(captions_path)
    fps, intro, outro = parse_wiring(captions_path.parent.parent.parent / 'captions.ts')
    offset = intro / fps
    expected = (narration or 0) + offset + outro / fps
    verified = duration is not None and narration is not None and abs(expected - duration) <= INTRO_OFFSET_TOLERANCE_SECONDS
    shifted = [{'start': c['start'] + offset, 'end': c['end'] + offset, 'text': c['text']} for c in cues]
    segments = []
    if verified:
        for index, seg in enumerate(group_cues(shifted, duration or expected)):
            hits = table.match(seg['text'], scope)
            segments.append({
                'index': index,
                'startSeconds': seg['startSeconds'],
                'endSeconds': seg['endSeconds'],
                'textPreview': seg['text'][:40],
                'canonical': [{**h, 'provenance': 'caption-terminology'} for h in hits],
            })
    return {
        **base,
        'transcriptSource': f'videos-project:lesson-{unit}/assets/audio/captions.generated.ts',
        'narrationDurationSeconds': narration,
        'offsetSeconds': offset,
        'expectedDurationSeconds': round(expected, 3),
        'offsetVerified': verified,
        'offsetStatus': 'verified' if verified else 'offset-unverified',
        'cueCount': len(cues),
        'segments': segments,
    }


# ---------------------------------------------------------------- active release reconciliation

def load_active_media_index() -> dict:
    path = OUT_DIR / 'active-runtime-media-index.json'
    if not path.exists():
        return {'runtimeReleaseId': None, 'files': []}
    return json.loads(path.read_text('utf-8'))


def reconcile_with_active_release(media: dict, active_index: dict) -> dict:
    """Bindings may only anchor media bytes that the activated production Runtime serves.
    Local media that differ from the active object keep their transcript but lose their
    time anchors until a Runtime release carrying the local bytes is activated."""
    by_path = {f['path']: f for f in active_index.get('files', [])}
    active = by_path.get(media['runtimePath'])
    media['activeReleaseSha256'] = active['sha256'] if active else None
    if active is None:
        media['status'] = 'missing-in-active-release'
        media['segments'] = []
    elif active['sha256'] != media['sha256']:
        media['status'] = 'media-drift-vs-active-release'
        media['segments'] = []
    elif not media.get('offsetVerified', True):
        media['status'] = media.get('offsetStatus') or 'offset-unverified'
    else:
        media['status'] = 'anchored' if media.get('segments') else 'no-segments'
    return media


# ---------------------------------------------------------------- main

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--units', nargs='*')
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    table = LabelTable()
    topics = read_jsonl(COURSE_ORDER / 'topics.jsonl')
    units_order = [r['unitId'] for r in read_jsonl(COURSE_ORDER / 'units.jsonl')]

    crosswalk_rows = build_crosswalk(table, topics)
    (OUT_DIR / 'course-node-crosswalk.jsonl').write_text(
        '\n'.join(json.dumps(r, ensure_ascii=False) for r in crosswalk_rows) + '\n', 'utf-8')
    crosswalk = {r['courseNodeId']: r for r in crosswalk_rows}
    mapped = sum(1 for r in crosswalk_rows if r['status'] == 'mapped')
    print(f'[crosswalk] {mapped}/{len(crosswalk_rows)} course nodes mapped; methods: '
          + json.dumps(collections.Counter(r['method'] for r in crosswalk_rows if r['method']), ensure_ascii=False))

    core_nodes = load_prereq_core_nodes()
    active_index = load_active_media_index()
    units = args.units or [u for u in units_order if (LESSONS_RUNTIME / u / 'lesson.json').exists()]
    summary = {'contract': 'act-resource-anchors-summary/v1', 'units': {}, 'crosswalk': {'mapped': mapped, 'total': len(crosswalk_rows)}}

    for unit in units:
        lesson_path = LESSONS_RUNTIME / unit / 'lesson.json'
        if not lesson_path.exists():
            print(f'[skip] {unit}: no runtime lesson.json')
            continue
        lesson = json.loads(lesson_path.read_text('utf-8'))
        scope_doc = build_unit_scope(unit, topics, crosswalk, core_nodes, lesson)
        write_json(OUT_DIR / 'unit-scope' / f'{unit}.json', scope_doc)
        scope = set(scope_doc['canonicalIds'])

        steps = step_anchors(unit, lesson, table, scope, crosswalk)
        sections, handout_meta = handout_anchors(unit, table, scope)
        media = []
        audio = media_from_asr_segments(
            unit, 'audio', LESSONS_RUNTIME / unit / 'media' / f'{unit}-audio.m4a',
            AUDIO_BATCH / 'audio-semantic-segments' / f'{unit}.json', table, scope, 'asr-terminology')
        if audio:
            # The audio batch predates sha capture; bind to the current runtime object.
            audio['transcriptMatchesMedia'] = None
            media.append(audio)
        intro = media_from_intro_captions(unit, table, scope)
        if intro:
            media.append(intro)
        course = media_from_asr_segments(
            unit, 'course', LESSONS_RUNTIME / unit / 'media' / f'{unit}-course.mp4',
            COURSE_VIDEO_BATCH / 'segments' / f'{unit}.json', table, scope, 'asr-terminology')
        if course:
            media.append(course)

        media = [reconcile_with_active_release(m, active_index) for m in media]
        doc = {
            'contract': 'act-resource-anchors/v1',
            'unit': unit,
            'unitIndex': units_order.index(unit) if unit in units_order else None,
            'activeRuntimeReleaseId': active_index.get('runtimeReleaseId'),
            'handout': handout_meta or None,
            'steps': steps,
            'handoutSections': sections,
            'media': media,
        }
        write_json(OUT_DIR / 'anchors' / f'{unit}.json', doc)

        stats = {
            'scope': len(scope),
            'steps': len(steps),
            'stepsWithCanonical': sum(1 for s in steps if s['canonical']),
            'sections': len(sections),
            'sectionsWithCanonical': sum(1 for s in sections if s['canonical']),
            'media': {
                m['mediaId']: {
                    'segments': len(m.get('segments', [])),
                    'bound': sum(1 for s in m.get('segments', []) if s['canonical']),
                    'offsetVerified': m.get('offsetVerified'),
                    'status': m.get('status'),
                } for m in media
            },
        }
        summary['units'][unit] = stats
        print(f'[{unit}] scope={stats["scope"]} steps={stats["stepsWithCanonical"]}/{stats["steps"]} '
              f'sections={stats["sectionsWithCanonical"]}/{stats["sections"]} media='
              + json.dumps(stats['media'], ensure_ascii=False))

    summary['ambiguousLabels'] = dict(sorted(table.ambiguous_labels.items()))
    write_json(OUT_DIR / 'anchors-summary.json', summary)
    return 0


if __name__ == '__main__':
    sys.exit(main())
