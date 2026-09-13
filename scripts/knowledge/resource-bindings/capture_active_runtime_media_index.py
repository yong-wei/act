#!/usr/bin/env python3
"""Capture the media object identities of the currently activated production Runtime
release into a small committed index used by the anchored resource binding release.

Flow: production `/api/readyz` -> active releaseId -> read-only OSS GET of
`runtime/blob-releases/<releaseId>/manifest.json` with the developer read credential
(`~/.config/act/runtime-dev-read.env`, ossutil in `~/.config/act/tools`) -> write
`course-content/authoring/knowledge/resource-bindings/active-runtime-media-index.json`
containing only lesson media / handout / transcript objects (path, sha256, sizeBytes).

The full manifest is cached outside the repo. Nothing is written to OSS.

Usage: python3 scripts/knowledge/resource-bindings/capture_active_runtime_media_index.py [--manifest /path/to/manifest.json]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
OUT_PATH = REPO / 'course-content/authoring/knowledge/resource-bindings/active-runtime-media-index.json'
CACHE_DIR = Path.home() / '.cache/act-runtime'
READYZ_URL = 'https://act.adapt-learn.online/api/readyz'
DEV_READ_ENV = Path.home() / '.config/act/runtime-dev-read.env'
OSSUTIL = Path.home() / '.config/act/tools/ossutil'
MEDIA_PATH = re.compile(r'^lessons/[^/]+/(media/[^/]+\.(mp4|webm|m4a|mp3|wav|pdf|transcript\.json)|[^/]*handout\.md)$')


def read_dev_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in DEV_READ_ENV.read_text('utf-8').splitlines():
        m = re.match(r'\s*export\s+(\w+)=(.*)', line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return env


def active_release_id() -> str:
    with urllib.request.urlopen(READYZ_URL, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
    identity = data['runtime']['identity']
    return identity['releaseId']


def fetch_manifest(release_id: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / f'{release_id}.manifest.json'
    if target.exists():
        return target
    env = read_dev_env()
    key = f"oss://{env['ACT_RUNTIME_OSS_BUCKET']}/runtime/blob-releases/{release_id}/manifest.json"
    subprocess.run([
        str(OSSUTIL), 'cp', '-f', key, str(target),
        '-e', env['ACT_RUNTIME_OSS_ENDPOINT'], '--region', env['ACT_RUNTIME_OSS_REGION'],
        '-i', env['ALIBABA_CLOUD_ACCESS_KEY_ID'], '-k', env['ALIBABA_CLOUD_ACCESS_KEY_SECRET'],
    ], check=True, capture_output=True)
    return target


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', help='use an already downloaded release manifest instead of fetching')
    args = parser.parse_args()

    if args.manifest:
        manifest_path = Path(args.manifest)
    else:
        release_id = active_release_id()
        manifest_path = fetch_manifest(release_id)
    manifest = json.loads(manifest_path.read_text('utf-8'))
    files = [
        {'path': f['path'], 'sha256': f['sha256'], 'sizeBytes': f.get('sizeBytes')}
        for f in manifest['files'] if MEDIA_PATH.match(f['path'])
    ]
    files.sort(key=lambda f: f['path'])
    out = {
        'contract': 'act-active-runtime-media-index/v1',
        'runtimeReleaseId': manifest['releaseId'],
        'manifestSha256': manifest.get('manifestSha256'),
        'treeSha256': manifest.get('treeSha256'),
        'sourceRevision': manifest.get('sourceRevision'),
        'fileCount': len(files),
        'files': files,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1) + '\n', 'utf-8')
    print(f'[capture] {manifest["releaseId"]}: {len(files)} media objects -> {OUT_PATH.relative_to(REPO)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
