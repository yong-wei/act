"""Keep the authoritative host selection lock while a local writer uses OSS."""

import json
from pathlib import Path
import shlex
import subprocess

import runtime_media_storage as MEDIA


class HostStorageLock:
    def __init__(self, args):
        self.args = args
        self.process = None
        self.snapshot = None

    def send(self, value):
        self.process.stdin.write(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
        self.process.stdin.flush()

    def receive(self, field):
        line = self.process.stdout.readline()
        if not line:
            # Host diagnostics are restricted to stable error codes by its CLI.
            detail = self.process.stderr.read().strip()
            raise MEDIA.MediaStorageError('host-storage-lock-failed: ' + detail)
        result = json.loads(line)
        if result.get(field) is not True:
            raise MEDIA.MediaStorageError('invalid-host-storage-lock-response')
        return result

    def __enter__(self):
        args = self.args
        remote = getattr(args, 'lifecycle_host', None)
        production = bool(remote) or Path(args.state_dir).name == 'blob-views'
        script = args.lifecycle_script if remote else str(Path(__file__).with_name('storage-lifecycle.py'))
        command = ['python3', script, 'hold-maintenance', '--state-dir', args.state_dir, '--store-dir', args.store_dir]
        if production:
            if remote and remote.startswith('-'):
                raise MEDIA.MediaStorageError('invalid-lifecycle-host')
            if not remote and args.no_session_refs:
                raise MEDIA.MediaStorageError('production-session-discovery-required')
            command.extend(['--production', '--db-container', args.db_container,
                            '--developer-lease-store', args.developer_lease_store or '/var/lib/act-runtime-developer-gateway/leases.json', '--require-developer-leases'])
        elif args.no_session_refs:
            command.append('--no-session-refs')
        for release in args.pin:
            command.extend(['--pin', release])
        for release in args.session_release:
            command.extend(['--session-release', release])
        if not production and args.developer_lease_store:
            command.extend(['--developer-lease-store', args.developer_lease_store])
        for option in ('media_root', 'blob_root'):
            value = getattr(args, option, None)
            if value:
                command.extend(['--' + option.replace('_', '-'), value])
        if remote:
            command = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remote,
                       ' '.join(shlex.quote(part) for part in command)]
        self.process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, universal_newlines=True)
        try:
            self.send({'protectDatabaseWrites': bool(getattr(args, 'execute', False)) or getattr(args, 'command', '') == 'retire'})
            self.snapshot = self.receive('held')
        except Exception:
            self.close()
            raise
        return self

    def prepare_migration(self, catalog, action='prepare-migration'):
        self.send({'action': action, 'catalog': catalog,
                   'expectedCatalogSha256': self.snapshot['catalogSha256']})
        self.snapshot = self.receive('prepared')

    def complete(self, catalog=None):
        self.send({'complete': True, 'catalog': catalog,
                   'expectedCatalogSha256': self.snapshot['catalogSha256']})
        self.receive('completed')

    def close(self):
        if self.process is not None:
            try:
                self.process.stdin.close()
            except BrokenPipeError:
                pass
            try:
                self.process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                self.process.terminate()
                self.process.wait(timeout=10)
            self.process.stdout.close()
            self.process.stderr.close()

    def __exit__(self, exc_type, exc, traceback):
        self.close()
        return False


def add_host_arguments(parser):
    parser.add_argument('--lifecycle-host')
    parser.add_argument('--lifecycle-script', default='/home/projects/act/scripts/runtime-release/storage-lifecycle.py')
    parser.add_argument('--db-container', default='act-obe-postgres')
    parser.add_argument('--developer-lease-store', default=None)
