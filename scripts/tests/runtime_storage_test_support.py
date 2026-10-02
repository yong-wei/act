"""Transport fixtures; the actual publisher, host lock and lease code still run."""

import os
from pathlib import Path
import stat

ROOT = Path(__file__).resolve().parents[2]


def coordinated_oss_transport(root, bucket, ossutil=None):
    root = Path(root)
    binary = root / 'bin'
    binary.mkdir(exist_ok=True)
    ssh = binary / 'ssh'
    ssh.write_text('''#!/usr/bin/env python3
import os,shlex,sys
args=shlex.split(sys.argv[-1])
args[1]=SCRIPT
filtered=[]
skip=False
for value in args:
    if skip:
        skip=False
        continue
    if value in ('--production','--require-developer-leases'):
        continue
    if value in ('--db-container','--developer-lease-store'):
        skip=True
        continue
    filtered.append(value)
filtered.append('--no-session-refs')
os.execvp(filtered[0],filtered)
'''.replace('SCRIPT', repr(str(ROOT / 'scripts/runtime-release/storage-lifecycle.py'))))
    ssh.chmod(ssh.stat().st_mode | stat.S_IEXEC)
    env = os.environ.copy()
    env['PATH'] = str(binary) + os.pathsep + env['PATH']
    arguments = ['--lifecycle-host', 'fixture-host', '--state-dir', str(root / 'state'),
                 '--lifecycle-store-dir', str(root / 'oss' / bucket)]
    if ossutil:
        arguments += ['--ossutil', str(ossutil)]
    return arguments, env
