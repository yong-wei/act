#!/usr/bin/env python3
"""Stage public scene WebP assets from a verified application revision for ESA."""

import argparse
import hashlib
import io
import json
import re
import shlex
import subprocess
import tarfile
from pathlib import PurePosixPath

ASSET_ROOT = 'public/assets/simulation-scene'
PUBLIC_ROOT = '/var/www/act-public-program/app-static'
ASSET_PATH = re.compile(r'(environment|textures)/[a-z0-9-]+\.webp')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('revision', help='Full Git revision already deployed on the target')
    parser.add_argument('target', help='SSH destination for the production static origin')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}', args.revision):
        parser.error('A full lowercase Git revision is required')
    if args.target.startswith('-'):
        parser.error('The SSH destination cannot be an option')

    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', args.target]
    revision = subprocess.check_output(ssh + ['podman exec act-obe-app cat /app/.app-revision'], text=True).strip()
    if revision != args.revision:
        raise SystemExit('Deployment revision does not match the requested asset revision')
    tracked = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', '-z', revision, ASSET_ROOT])
    relative = [PurePosixPath(item.decode()).relative_to(ASSET_ROOT).as_posix() for item in tracked.split(b'\0') if item]
    paths = sorted(item for item in relative if ASSET_PATH.fullmatch(item))
    if not paths:
        raise SystemExit('The deployed revision has no recognized WebP scene assets')

    archive = io.BytesIO()
    inventory = []
    with tarfile.open(fileobj=archive, mode='w:gz') as bundle:
        for relative in paths:
            data = subprocess.check_output(['git', 'show', f'{revision}:{ASSET_ROOT}/{relative}'])
            entry = tarfile.TarInfo(relative)
            entry.size = len(data)
            entry.mode = 0o644
            bundle.addfile(entry, io.BytesIO(data))
            inventory.append({'path': relative, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})

    destination = f'{PUBLIC_ROOT}/{revision}/assets/simulation-scene'
    command = f'destination={shlex.quote(destination)}\n' + r'''
set -eu
parent=${destination%/*}
umask 022
mkdir -p "$parent"
candidate=$(mktemp -d "$parent/.scene-XXXXXXXX")
trap 'rm -rf -- "$candidate"' EXIT
chmod 755 "$candidate"
tar -xzf - -C "$candidate"
if test -e "$destination"; then
  diff -qr -- "$destination" "$candidate"
else
  mv -T --no-clobber "$candidate" "$destination"
  if test -d "$candidate"; then diff -qr -- "$destination" "$candidate"; fi
fi
'''
    subprocess.run(ssh + [command], input=archive.getvalue(), check=True)
    print(json.dumps({'revision': revision, 'destination': destination, 'objects': inventory}, indent=2))


if __name__ == '__main__':
    main()
