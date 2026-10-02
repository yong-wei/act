#!/usr/bin/env python3
"""Reject old application images after legacy public media bodies are retired."""

import argparse
import os
import json
from pathlib import Path
import sys
import subprocess

sys.path.insert(0, str(Path(__file__).resolve().parent))
import runtime_media_storage as MEDIA


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--capability', default='')
    parser.add_argument('--media-helper')
    args = parser.parse_args()
    try:
        state_file = Path(args.directory).with_name('storage-state.json')
        required = False
        if state_file.exists():
            if state_file.is_symlink():
                raise MEDIA.MediaStorageError('unsafe-media-storage-state')
            state = json.loads(state_file.read_text())
            if state.get('schemaVersion') != 'act-runtime-media-storage-state.v1' or not isinstance(state.get('ready'), bool):
                raise MEDIA.MediaStorageError('invalid-media-storage-state')
            required = state['ready']
        catalog, canonical = MEDIA.load_catalog(args.directory, required=required)
        if canonical and not catalog['legacyCopiesAvailable'] and args.capability != '1':
            raise MEDIA.MediaStorageError('image lacks canonical media support; restore legacy copies before rollback')
        if canonical and catalog['objects'] and args.media_helper:
            helper = Path(args.media_helper)
            if helper.is_symlink() or not os.path.ismount(str(helper)):
                raise MEDIA.MediaStorageError('canonical-media-helper-not-mounted')
            mount = subprocess.run(['findmnt', '-rn', '-M', str(helper), '-o', 'FSTYPE,OPTIONS'],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
            fields = mount.stdout.strip().split()
            if mount.returncode or len(fields) != 2 or not fields[0].startswith('fuse') or 'ro' not in fields[1].split(','):
                raise MEDIA.MediaStorageError('canonical-media-helper-must-be-readonly-fuse')
    except (MEDIA.MediaStorageError, OSError, ValueError) as error:
        sys.stderr.write('media storage image gate failed: %s\n' % str(error))
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
