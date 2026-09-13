#!/usr/bin/env python3
"""Transcribe NotebookLM course videos (`<unit>-course.mp4`) with the frozen
local ASR processor pair used by the 2026-08-23 audio batch:

  Fun-ASR-Nano-2512 (funasr, MPS, hotwords) + Qwen3-ForcedAligner-0.6B-hf (CPU)

Run with the isolated runtime interpreter, never the project Python:

  /Users/YW/LocalLLM/funasr-runtime/bin/python \
      scripts/knowledge/media-transcripts/transcribe_course_videos.py --units 3-8

Outputs per unit under the batch directory (default
`course-content/authoring/knowledge/formal-resource-remediation/20260913-course-video-asr/`):

  transcripts/<unit>.json       remediation-asr-transcript/v1 (+ sourceSha256, durationSeconds)
  word-timestamps/<unit>.json   remediation-asr-word-timestamps/v1
  segments/<unit>.json          remediation-audio-semantic-segments/v1 (nodeBindings left empty)
  run-summary.json              processor identity + per-unit stats
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_BATCH_DIR = REPO_ROOT / 'course-content/authoring/knowledge/formal-resource-remediation/20260913-course-video-asr'
AUDIO_BATCH_DIR = REPO_ROOT / 'course-content/authoring/knowledge/formal-resource-remediation/20260823-asr-batch'
LESSONS_RUNTIME = REPO_ROOT / 'course-content/runtime/lessons'
FUNASR_MODEL_DIR = Path('/Users/YW/LocalLLM/funasr-models/Fun-ASR-Nano-2512')
ALIGNER_MODEL_DIR = Path('/Users/YW/LocalLLM/funasr-models/Qwen3-ForcedAligner-0.6B-hf')

SAMPLE_RATE = 16000
CHUNK_MAX_SECONDS = 28.0
SEGMENT_MIN_SECONDS = 8.0
SEGMENT_MAX_SECONDS = 25.0
SENTENCE_END = set('。！？!?；;')

PROCESSOR_IDENTITY = (
    'fun-asr-nano+qwen3-forcedaligner+fsmn-vad '
    '(registry 61a631d0 + VAD addendum; course-video reuse 2026-09-13)'
)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return float(out)


def extract_wav(src: Path, dst: Path) -> None:
    subprocess.run(
        ['ffmpeg', '-y', '-v', 'error', '-i', str(src), '-vn', '-ac', '1', '-ar', str(SAMPLE_RATE), '-f', 'wav', str(dst)],
        check=True,
    )


def load_hotwords(unit: str) -> list[str]:
    path = AUDIO_BATCH_DIR / 'transcripts' / f'{unit}.json'
    if not path.exists():
        return []
    data = json.loads(path.read_text('utf-8'))
    return [str(x) for x in data.get('hotwords', []) if str(x).strip()]


def merge_vad_chunks(vad_segments_ms: list[list[int]], total_seconds: float) -> list[tuple[float, float]]:
    """Merge VAD speech segments into consecutive chunks of at most CHUNK_MAX_SECONDS.
    Chunk boundaries fall in silence, so ASR context is not cut mid-word."""
    chunks: list[tuple[float, float]] = []
    cur_start: float | None = None
    cur_end: float | None = None
    for s_ms, e_ms in vad_segments_ms:
        s, e = s_ms / 1000.0, e_ms / 1000.0
        if cur_start is None:
            cur_start, cur_end = s, e
            continue
        if e - cur_start <= CHUNK_MAX_SECONDS:
            cur_end = e
        else:
            chunks.append((cur_start, cur_end))
            cur_start, cur_end = s, e
    if cur_start is not None:
        chunks.append((cur_start, min(cur_end or total_seconds, total_seconds)))
    # A single speech segment longer than the cap is split evenly.
    out: list[tuple[float, float]] = []
    for s, e in chunks:
        if e - s <= CHUNK_MAX_SECONDS:
            out.append((s, e))
            continue
        n = int((e - s) // CHUNK_MAX_SECONDS) + 1
        step = (e - s) / n
        for i in range(n):
            out.append((s + i * step, s + (i + 1) * step))
    return out


def build_segments(words: list[dict], duration: float) -> list[dict]:
    """Sentence-end + 8s min / 25s max windows over word timestamps (same rule as the audio batch)."""
    segments: list[dict] = []
    buf: list[dict] = []
    seg_start: float | None = None

    def flush(end_time: float) -> None:
        nonlocal buf, seg_start
        if not buf:
            return
        text = ''.join(w['w'] + w.get('punct', '') for w in buf)
        segments.append({'text': text, 'startSeconds': round(seg_start or 0.0, 2), 'endSeconds': round(end_time, 2), 'nodeBindings': []})
        buf = []
        seg_start = None

    for i, w in enumerate(words):
        if seg_start is None:
            seg_start = w['s']
        buf.append(w)
        elapsed = w['e'] - seg_start
        next_start = words[i + 1]['s'] if i + 1 < len(words) else duration
        at_sentence_end = w['w'] in SENTENCE_END or (w.get('punct') in SENTENCE_END)
        if (at_sentence_end and elapsed >= SEGMENT_MIN_SECONDS) or elapsed >= SEGMENT_MAX_SECONDS:
            flush(next_start)
    flush(duration)
    return segments


def split_transcript_units(text: str) -> tuple[list[str], list[str]]:
    """Return alignable units (CJK chars / latin words / digits) and the punctuation that
    follows each unit, so punctuation can be re-attached to timestamps."""
    tokens = re.findall(r'[A-Za-z]+(?:\'[A-Za-z]+)?|\d+(?:[.,]\d+)?|[\u4e00-\u9fff\u3400-\u4dbf]|[^\sA-Za-z0-9\u4e00-\u9fff\u3400-\u4dbf]', text)
    units: list[str] = []
    puncts: list[str] = []
    for tok in tokens:
        if re.fullmatch(r'[A-Za-z]+(?:\'[A-Za-z]+)?|\d+(?:[.,]\d+)?|[\u4e00-\u9fff\u3400-\u4dbf]', tok):
            units.append(tok)
            puncts.append('')
        elif units:
            puncts[-1] += tok
    return units, puncts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--units', nargs='*', help='unit ids like 3-8; default all units with a course video')
    parser.add_argument('--batch-dir', default=str(DEFAULT_BATCH_DIR))
    parser.add_argument('--force', action='store_true', help='re-run units that already have outputs')
    args = parser.parse_args()

    batch_dir = Path(args.batch_dir)
    for sub in ('transcripts', 'word-timestamps', 'segments'):
        (batch_dir / sub).mkdir(parents=True, exist_ok=True)

    if args.units:
        units = args.units
    else:
        units = sorted(
            p.parent.parent.name for p in LESSONS_RUNTIME.glob('*/media/*-course.mp4')
        )

    import numpy as np  # noqa: WPS433 (runtime-only dependency)
    import soundfile as sf
    import torch
    from funasr import AutoModel
    from transformers import AutoModelForTokenClassification, AutoProcessor

    print(f'[init] loading fsmn-vad / Fun-ASR-Nano / ForcedAligner', flush=True)
    vad = AutoModel(model='fsmn-vad', device='cpu', disable_update=True, disable_pbar=True, disable_log=True)
    asr = AutoModel(
        model=str(FUNASR_MODEL_DIR),
        init_param=str(FUNASR_MODEL_DIR / 'model.pt'),
        llm_conf={'init_param_path': str(FUNASR_MODEL_DIR / 'Qwen3-0.6B')},
        device='mps',
        disable_update=True,
        disable_pbar=True,
        disable_log=True,
    )
    aligner_processor = AutoProcessor.from_pretrained(str(ALIGNER_MODEL_DIR))
    aligner = AutoModelForTokenClassification.from_pretrained(str(ALIGNER_MODEL_DIR), dtype=torch.float32)
    aligner.eval()

    summary_path = batch_dir / 'run-summary.json'
    summary = json.loads(summary_path.read_text('utf-8')) if summary_path.exists() else {
        'contract': 'remediation-asr-course-video-run/v1',
        'processorIdentity': PROCESSOR_IDENTITY,
        'processorRegistryRef': str(AUDIO_BATCH_DIR.relative_to(REPO_ROOT) / 'processor-registry.json'),
        'vadModel': 'fsmn-vad (modelscope)',
        'chunkMaxSeconds': CHUNK_MAX_SECONDS,
        'segmentRule': f'sentence-end + {SEGMENT_MIN_SECONDS:.0f}s min / {SEGMENT_MAX_SECONDS:.0f}s max windows over word timestamps',
        'units': {},
    }

    for unit in units:
        src = LESSONS_RUNTIME / unit / 'media' / f'{unit}-course.mp4'
        if not src.exists():
            print(f'[skip] {unit}: no course video', flush=True)
            continue
        out_transcript = batch_dir / 'transcripts' / f'{unit}.json'
        if out_transcript.exists() and not args.force:
            print(f'[skip] {unit}: already transcribed', flush=True)
            continue

        t0 = time.time()
        sha = sha256_file(src)
        duration = ffprobe_duration(src)
        hotwords = load_hotwords(unit)
        with tempfile.TemporaryDirectory(prefix=f'act-asr-{unit}-') as tmp:
            wav_path = Path(tmp) / f'{unit}.wav'
            extract_wav(src, wav_path)
            audio, sr = sf.read(str(wav_path), dtype='float32')
            assert sr == SAMPLE_RATE
            if audio.ndim > 1:
                audio = audio.mean(axis=1)

            vad_res = vad.generate(input=str(wav_path))
            vad_segments = vad_res[0]['value'] if vad_res and 'value' in vad_res[0] else []
            chunks = merge_vad_chunks(vad_segments, duration)
            print(f'[{unit}] duration={duration:.1f}s vad_segments={len(vad_segments)} chunks={len(chunks)} hotwords={len(hotwords)}', flush=True)

            words: list[dict] = []
            texts: list[str] = []
            for ci, (cs, ce) in enumerate(chunks):
                a0, a1 = int(cs * SAMPLE_RATE), int(ce * SAMPLE_RATE)
                chunk_audio = audio[a0:a1]
                if len(chunk_audio) < SAMPLE_RATE // 4:
                    continue
                chunk_path = Path(tmp) / f'{unit}-chunk-{ci:03d}.wav'
                sf.write(str(chunk_path), chunk_audio, SAMPLE_RATE)
                gen_kwargs = {'input': str(chunk_path), 'batch_size_s': 60}
                if hotwords:
                    gen_kwargs['hotwords'] = ','.join(hotwords)
                res = asr.generate(**gen_kwargs)
                text = (res[0].get('text') or '').strip() if res else ''
                if not text:
                    continue
                texts.append(text)

                units_list, puncts = split_transcript_units(text)
                if not units_list:
                    continue
                al_inputs, word_lists = aligner_processor.prepare_forced_aligner_inputs(
                    audio=chunk_audio, transcript=' '.join(units_list), language='Chinese',
                )
                with torch.inference_mode():
                    out = aligner(**al_inputs)
                stamps = aligner_processor.decode_forced_alignment(
                    logits=out.logits,
                    input_ids=al_inputs['input_ids'],
                    word_lists=word_lists,
                    timestamp_token_id=aligner.config.timestamp_token_id,
                )[0]
                # Re-attach punctuation to the preceding aligned unit by order; the aligner
                # keeps the unit sequence, so a positional zip is safe when lengths agree.
                punct_iter = puncts if len(stamps) == len(units_list) else [''] * len(stamps)
                for item, punct in zip(stamps, punct_iter):
                    words.append({
                        'w': item['text'],
                        's': round(cs + float(item['start_time']), 2),
                        'e': round(cs + float(item['end_time']), 2),
                        **({'punct': punct} if punct else {}),
                    })
                if ci % 5 == 0:
                    print(f'[{unit}] chunk {ci + 1}/{len(chunks)} ({ce:.0f}s) words={len(words)}', flush=True)

        full_text = ' '.join(texts)
        segments = build_segments(words, duration)
        elapsed = time.time() - t0

        (batch_dir / 'transcripts' / f'{unit}.json').write_text(json.dumps({
            'contract': 'remediation-asr-transcript/v1',
            'unit': unit,
            'sourceMedia': str(src.relative_to(REPO_ROOT)),
            'sourceSha256': sha,
            'durationSeconds': round(duration, 3),
            'hotwords': hotwords,
            'processorIdentity': PROCESSOR_IDENTITY,
            'asrSeconds': round(elapsed, 1),
            'text': full_text,
        }, ensure_ascii=False, indent=1) + '\n', 'utf-8')
        (batch_dir / 'word-timestamps' / f'{unit}.json').write_text(json.dumps({
            'contract': 'remediation-asr-word-timestamps/v1',
            'unit': unit,
            'sourceSha256': sha,
            'durationSeconds': round(duration, 3),
            'wordCount': len(words),
            'words': words,
        }, ensure_ascii=False) + '\n', 'utf-8')
        (batch_dir / 'segments' / f'{unit}.json').write_text(json.dumps({
            'contract': 'remediation-audio-semantic-segments/v1',
            'unit': unit,
            'sourceSha256': sha,
            'segmentCount': len(segments),
            'boundSegmentCount': 0,
            'bindingModel': 'pending: terminology overlap assigned by the anchor builder',
            'segments': segments,
        }, ensure_ascii=False, indent=1) + '\n', 'utf-8')

        summary['units'][unit] = {
            'sourceSha256': sha,
            'durationSeconds': round(duration, 3),
            'chars': len(full_text),
            'words': len(words),
            'segments': len(segments),
            'chunks': len(chunks),
            'asrSeconds': round(elapsed, 1),
        }
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=1) + '\n', 'utf-8')
        print(f'[{unit}] done in {elapsed:.1f}s: {len(full_text)} chars, {len(words)} words, {len(segments)} segments', flush=True)

    return 0


if __name__ == '__main__':
    sys.exit(main())
