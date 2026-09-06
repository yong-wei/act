#!/usr/bin/env python3
"""Identify orphaned overlay layer dirs in podman/containers storage.

Live set = UpperDir of every image and every container, plus every parent
layer reachable by following each layer's `lower` file (l/<link> refs).
Anything else under storage/overlay/ is garbage from interrupted loads.

Usage: overlay-orphan-scan.py [--delete]
"""
import os
import subprocess
import sys

STORAGE = '/var/lib/containers/storage'
OV = os.path.join(STORAGE, 'overlay')


def out(cmd):
    r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                       universal_newlines=True)
    return r.stdout


def layer_id_of(diff_path):
    return os.path.basename(os.path.dirname(diff_path.rstrip('/')))


def collect_tops():
    tops = []
    image_ids = out(['podman', 'images', '-q']).split()
    for iid in image_ids:
        d = out(['podman', 'image', 'inspect', iid, '--format',
                 '{{index .GraphDriver.Data "UpperDir"}}']).strip()
        if d:
            tops.append(d)
    container_ids = out(['podman', 'ps', '-aq']).split()
    for cid in container_ids:
        d = out(['podman', 'container', 'inspect', cid, '--format',
                 '{{index .GraphDriver.Data "UpperDir"}}']).strip()
        if d:
            tops.append(d)
    # buildah working containers share this storage
    try:
        bh = subprocess.run(['buildah', 'containers', '-q'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, universal_newlines=True)
    except OSError:
        bh = None
    if bh is not None and bh.returncode == 0:
        for bid in bh.stdout.split():
            d = out(['buildah', 'inspect', '-f', '{{index .GraphDriver.Data "UpperDir"}}', bid]).strip()
            if d:
                tops.append(d)
    return image_ids, container_ids, tops


def main():
    do_delete = '--delete' in sys.argv
    image_ids, container_ids, tops = collect_tops()

    live = set()
    stack = [layer_id_of(t) for t in tops]
    while stack:
        lid = stack.pop()
        if lid in live:
            continue
        live.add(lid)
        lower_file = os.path.join(OV, lid, 'lower')
        if os.path.isfile(lower_file):
            with open(lower_file) as f:
                refs = f.read().strip().split(':')
            for ref in refs:
                if not ref:
                    continue
                target = os.path.realpath(os.path.join(OV, ref))
                stack.append(layer_id_of(target))

    all_dirs = {d for d in os.listdir(OV)
                if d != 'l' and os.path.isdir(os.path.join(OV, d))}
    missing = {l for l in live if l not in all_dirs}
    orphans = sorted(all_dirs - live)

    print(f'images={len(image_ids)} containers={len(container_ids)} tops={len(tops)}')
    print(f'live_layers={len(live)} overlay_dirs={len(all_dirs)} orphans={len(orphans)}')
    if missing:
        print(f'WARNING: {len(missing)} live layers missing on disk: {sorted(missing)}')

    total = 0
    sizes = []
    for o in orphans:
        path = os.path.join(OV, o)
        sz = int(subprocess.run(['du', '-sb', path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, universal_newlines=True).stdout.split()[0])
        sizes.append((sz, o))
        total += sz
    for sz, o in sorted(sizes, reverse=True)[:10]:
        print(f'  {sz / 2**30:6.2f} GiB  {o}')
    print(f'orphan total: {total / 2**30:.2f} GiB across {len(orphans)} dirs')

    if do_delete:
        if missing:
            print('ABORT: live layers missing, refusing to delete')
            sys.exit(1)
        import shutil
        for o in orphans:
            shutil.rmtree(os.path.join(OV, o))
        print(f'deleted {len(orphans)} orphan dirs')


if __name__ == '__main__':
    main()
