#!/usr/bin/env python3
"""Remove stale layer records from containers/storage overlay-layers metadata.

A layer record is stale when its overlay/<id> directory no longer exists
(deleted as orphan). Stale records make podman load reuse phantom layers
and fail with 'Stat .../diff: no such file or directory'.

Backs up layers.json / volatile-layers.json beside the originals before
rewriting. Also prunes broken symlinks under overlay/l/.
"""
import json
import os
import shutil
import sys

STORAGE = '/var/lib/containers/storage'
OV = os.path.join(STORAGE, 'overlay')
LAYERS_JSON = os.path.join(STORAGE, 'overlay-layers', 'layers.json')
VOLATILE_JSON = os.path.join(STORAGE, 'overlay-layers', 'volatile-layers.json')


def filter_stale(path):
    with open(path) as f:
        entries = json.load(f)
    kept, dropped = [], []
    for e in entries:
        lid = e.get('id', '')
        if os.path.isdir(os.path.join(OV, lid)):
            kept.append(e)
        else:
            dropped.append(lid)
    return entries, kept, dropped


def main():
    do_write = '--write' in sys.argv

    entries, kept, dropped = filter_stale(LAYERS_JSON)
    print('layers.json: total=%d keep=%d stale=%d' % (len(entries), len(kept), len(dropped)))

    v_entries = v_kept = []
    if os.path.isfile(VOLATILE_JSON):
        v_entries, v_kept, _ = filter_stale(VOLATILE_JSON)
        print('volatile-layers.json: total=%d keep=%d' % (len(v_entries), len(v_kept)))

    # parent-integrity check: every kept entry's parent must also be kept
    kept_ids = {e['id'] for e in kept}
    bad = [e['id'] for e in kept if e.get('parent') and e['parent'] not in kept_ids]
    if bad:
        print('ABORT: kept layers reference stale parents: %s' % bad)
        sys.exit(1)

    # broken symlinks under overlay/l
    links_dir = os.path.join(OV, 'l')
    broken = []
    for name in os.listdir(links_dir):
        p = os.path.join(links_dir, name)
        if not os.path.exists(os.path.realpath(p)):
            broken.append(p)
    print('broken links in overlay/l: %d' % len(broken))

    if not do_write:
        print('dry-run only; pass --write to apply')
        return

    shutil.copy2(LAYERS_JSON, LAYERS_JSON + '.bak-orphan-fix')
    with open(LAYERS_JSON, 'w') as f:
        json.dump(kept, f)
    if os.path.isfile(VOLATILE_JSON):
        shutil.copy2(VOLATILE_JSON, VOLATILE_JSON + '.bak-orphan-fix')
        with open(VOLATILE_JSON, 'w') as f:
            json.dump(v_kept, f)
    for p in broken:
        os.unlink(p)
    print('applied: layers.json rewritten, %d broken links removed' % len(broken))


if __name__ == '__main__':
    main()
