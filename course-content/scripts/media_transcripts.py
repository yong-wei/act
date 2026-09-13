"""Export media transcripts as runtime companions of lesson audio/video.

Every `<unit>-audio.m4a`, `<unit>-intro-video.mp4` and `<unit>-course.mp4` in a runtime
lesson media directory gets a sibling `<unit>-<kind>.transcript.json`
(contract `act-media-transcript/v1`) bound to the media bytes by sha256. Sources:

  audio        2026-08-23 ASR batch (Fun-ASR-Nano + Qwen3-ForcedAligner, sealed)
  course       2026-09-13 course-video ASR batch (same processor pair)
  intro-video  Videos project production script (`captions.generated.ts`), shifted by the
               composition intro offset so cue times are on the mp4 timeline

Transcripts serve anchor generation and player seeking only; they are not path-planning
resources and are not indexed for retrieval.

Called from export_runtime.generate_runtime_media(); also runnable standalone:
  python3 course-content/scripts/media_transcripts.py [--all | <unit> ...]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
COURSE_CONTENT = SCRIPT_DIR.parent
REPO = COURSE_CONTENT.parent
KNOWLEDGE = COURSE_CONTENT / 'authoring' / 'knowledge'
AUDIO_BATCH = KNOWLEDGE / 'formal-resource-remediation' / '20260823-asr-batch'
COURSE_VIDEO_BATCH = KNOWLEDGE / 'formal-resource-remediation' / '20260913-course-video-asr'
VIDEOS_PROJECT = Path('/Users/YW/Documents/Project/Videos/src/projects')
RUNTIME_LESSONS = COURSE_CONTENT / 'runtime' / 'lessons'

CONTRACT = 'act-media-transcript/v1'
AUDIO_PROCESSOR = 'fun-asr-nano+qwen3-forcedaligner+vad (registry 61a631d0 + VAD addendum)'


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
        return round(float(out), 3)
    except Exception:
        return None


def read_json(path: Path):
    return json.loads(path.read_text('utf-8')) if path.exists() else None


def write_if_changed(path: Path, payload: dict) -> bool:
    content = json.dumps(payload, ensure_ascii=False) + '\n'
    if path.exists() and path.read_text('utf-8') == content:
        return False
    path.write_text(content, 'utf-8')
    return True


# ------------------------------------------------------------ Videos captions

def parse_captions_module(path: Path) -> tuple[list[dict], float | None]:
    src = path.read_text('utf-8')
    m = re.search(r'export const captions\s*=\s*\[', src)
    cues: list[dict] = []
    if m:
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

    def grab(name: str, default: int) -> int:
        m = re.search(name + r'\s*=\s*(\d+)', src)
        return int(m.group(1)) if m else default

    return grab('FPS', 30), grab('INTRO_FRAMES', 300), grab('OUTRO_FRAMES', 360)


# ------------------------------------------------------------ builders

def build_from_asr_batch(unit: str, kind: str, media_path: Path, batch: Path, segments_dir: str, processor: str) -> dict | None:
    transcript = read_json(batch / 'transcripts' / f'{unit}.json')
    words = read_json(batch / 'word-timestamps' / f'{unit}.json')
    segments = read_json(batch / segments_dir / f'{unit}.json')
    if not transcript:
        return None
    return {
        'contract': CONTRACT,
        'unit': unit,
        'mediaId': f'{unit}-{kind}',
        'kind': 'audio' if kind == 'audio' else 'video',
        'runtimePath': f'lessons/{unit}/media/{media_path.name}',
        'sha256': sha256_file(media_path),
        'durationSeconds': ffprobe_duration(media_path),
        'language': 'zh-CN',
        'processorIdentity': transcript.get('processorIdentity') or processor,
        'source': {
            'kind': 'asr-batch',
            'ref': str((batch / 'transcripts' / f'{unit}.json').relative_to(REPO)),
            'sourceSha256': transcript.get('sourceSha256'),
        },
        'hotwords': transcript.get('hotwords', []),
        'text': transcript.get('text', ''),
        'words': (words or {}).get('words', []),
        'segments': [
            {'startSeconds': s['startSeconds'], 'endSeconds': s['endSeconds'], 'text': s.get('text', '')}
            for s in (segments or {}).get('segments', [])
        ],
    }


def build_from_production_script(unit: str, media_path: Path) -> dict | None:
    captions_path = VIDEOS_PROJECT / f'lesson-{unit}' / 'assets' / 'audio' / 'captions.generated.ts'
    if not captions_path.exists():
        return None
    cues, narration = parse_captions_module(captions_path)
    fps, intro, outro = parse_wiring(VIDEOS_PROJECT / f'lesson-{unit}' / 'captions.ts')
    offset = intro / fps
    duration = ffprobe_duration(media_path)
    expected = round((narration or 0) + offset + outro / fps, 3)
    shifted = [{'start': round(c['start'] + offset, 3), 'end': round(c['end'] + offset, 3), 'text': c['text']} for c in cues]
    return {
        'contract': CONTRACT,
        'unit': unit,
        'mediaId': f'{unit}-intro-video',
        'kind': 'video',
        'runtimePath': f'lessons/{unit}/media/{media_path.name}',
        'sha256': sha256_file(media_path),
        'durationSeconds': duration,
        'language': 'zh-CN',
        'processorIdentity': 'videos-project production script (captions.generated.ts)',
        'source': {
            'kind': 'production-script',
            'ref': f'videos-project:lesson-{unit}/assets/audio/captions.generated.ts',
            'narrationDurationSeconds': narration,
            'introOffsetSeconds': offset,
            'outroSeconds': outro / fps,
            'expectedDurationSeconds': expected,
            'offsetVerified': duration is not None and narration is not None and abs(expected - duration) <= 1.5,
        },
        'text': ''.join(c['text'] for c in cues),
        'cues': shifted,
        'segments': [],
    }


def export_media_transcripts(lesson_id: str, output_dir: Path | None = None) -> list[str]:
    output_dir = output_dir or (RUNTIME_LESSONS / lesson_id / 'media')
    written: list[str] = []
    if not output_dir.exists():
        return written
    plans = [
        ('audio', output_dir / f'{lesson_id}-audio.m4a',
         lambda p: build_from_asr_batch(lesson_id, 'audio', p, AUDIO_BATCH, 'audio-semantic-segments', AUDIO_PROCESSOR)),
        ('course', output_dir / f'{lesson_id}-course.mp4',
         lambda p: build_from_asr_batch(lesson_id, 'course', p, COURSE_VIDEO_BATCH, 'segments', AUDIO_PROCESSOR)),
        ('intro-video', output_dir / f'{lesson_id}-intro-video.mp4',
         lambda p: build_from_production_script(lesson_id, p)),
    ]
    for kind, media_path, builder in plans:
        target = output_dir / f'{lesson_id}-{kind}.transcript.json'
        if not media_path.exists():
            if target.exists():
                target.unlink()
            continue
        payload = builder(media_path)
        if payload is None:
            continue
        if write_if_changed(target, payload):
            written.append(target.name)
    return written


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('units', nargs='*')
    parser.add_argument('--all', action='store_true')
    args = parser.parse_args()
    units = args.units
    if args.all or not units:
        units = sorted(p.name for p in RUNTIME_LESSONS.iterdir() if (p / 'media').is_dir())
    total = 0
    for unit in units:
        written = export_media_transcripts(unit)
        total += len(written)
        present = sorted(p.name for p in (RUNTIME_LESSONS / unit / 'media').glob('*.transcript.json'))
        print(f'[{unit}] transcripts={present} changed={written}')
    print(f'[done] {total} transcript files written/updated')
    return 0


if __name__ == '__main__':
    sys.exit(main())
