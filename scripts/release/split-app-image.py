#!/usr/bin/env python3
"""Split a buildx docker-save image into a reusable runner-os image and an app bundle.

The runner-os image is the Node base plus the Chromium/LibreOffice apt layer.
The app bundle is the later layers only. Remote assembly mounts the runner-os
image and extracts this bundle; it does not build from source.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import os
import shutil
import stat
import sys
import tarfile
import tempfile
from pathlib import Path

BUNDLE_SCHEMA = 'act.app-image-bundle.v1'
POLICY_SCHEMA = 'act.app-image-packaging-policy.v1'
RUNNER_OS_MARKER = 'usr/local/share/act-runner-os-rev'
APP_ENV_KEYS = {
    'NODE_ENV',
    'NEXT_TELEMETRY_DISABLED',
    'RUN_MIGRATIONS_ON_START',
    'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
    'APP_REVISION',
    'HOME',
    'WOLFRAM_CLOUD_MCP_URL',
    'PORT',
    'HOSTNAME',
}


class ImageSplitError(Exception):
    pass


def fail(message: str) -> None:
    raise ImageSplitError(message)


def parse_args(argv: list[str]) -> tuple[str, dict[str, str]]:
    if len(argv) < 2:
        fail('缺少子命令')
    command = argv[1]
    options: dict[str, str] = {}
    index = 2
    while index < len(argv):
        token = argv[index]
        if not token.startswith('--'):
            fail(f'无法识别的参数: {token}')
        name = token[2:]
        if index + 1 >= len(argv):
            fail(f'缺少 --{name} 的值')
        options[name] = argv[index + 1]
        index += 2
    return command, options


def require(options: dict[str, str], name: str) -> str:
    value = options.get(name)
    if not value:
        fail(f'缺少 --{name}')
    return value


def load_policy(path: str) -> dict:
    payload = json.loads(Path(path).read_text(encoding='utf-8'))
    if payload.get('schema') != POLICY_SCHEMA:
        fail(f'打包策略 schema 不匹配: {path}')
    prefixes = payload.get('imagePathPrefixes')
    if not isinstance(prefixes, list) or not prefixes:
        fail('打包策略缺少 imagePathPrefixes')
    return payload


def forbidden(rel: str, prefixes: list[str]) -> bool:
    for prefix in prefixes:
        normalized = prefix.strip('/')
        if rel == normalized or rel.startswith(f'{normalized}/'):
            return True
    return False


def normalize_name(name: str) -> str:
    rel = name.replace('\\', '/').lstrip('./')
    while rel.startswith('/'):
        rel = rel[1:]
    if rel in ('', '.'):
        return ''
    if any(part == '..' for part in rel.split('/')):
        fail(f'镜像层路径越界: {name}')
    return rel


def whiteout_kind(rel: str) -> tuple[str, str] | None:
    parent, _, name = rel.rpartition('/')
    if name == '.wh..wh..opq':
        return ('opaque', parent)
    if name.startswith('.wh.'):
        target = name[len('.wh.'):]
        return ('file', f'{parent}/{target}' if parent else target)
    return None


class Pushback:
    def __init__(self, raw, prefix: bytes):
        self.raw = raw
        self.prefix = prefix

    def readable(self) -> bool:
        return True

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            data = self.prefix + (self.raw.read() or b'')
            self.prefix = b''
            return data
        if n <= 0:
            return b''
        if self.prefix:
            if n <= len(self.prefix):
                data = self.prefix[:n]
                self.prefix = self.prefix[n:]
                return data
            take = self.prefix
            self.prefix = b''
            rest = self.raw.read(n - len(take)) or b''
            return take + rest
        return self.raw.read(n) or b''


def open_layer(stream) -> tarfile.TarFile:
    magic = stream.read(2) or b''
    pushed = Pushback(stream, magic)
    if magic == b'\x1f\x8b':
        pushed = gzip.GzipFile(fileobj=pushed)
    return tarfile.open(fileobj=pushed, mode='r|')


def member_map(image: tarfile.TarFile) -> dict[str, tarfile.TarInfo]:
    return {member.name: member for member in image.getmembers()}


def read_json_member(image: tarfile.TarFile, info: tarfile.TarInfo):
    extracted = image.extractfile(info)
    if extracted is None:
        fail(f'无法读取 {info.name}')
    return json.load(extracted)


def load_docker_image(path: str) -> tuple[tarfile.TarFile, dict, dict, list[str]]:
    image = tarfile.open(path, 'r:*')
    members = member_map(image)
    manifest_info = members.get('manifest.json')
    if manifest_info is None:
        image.close()
        fail(f'不是 docker save 镜像: {path}')
    manifest = read_json_member(image, manifest_info)
    if not isinstance(manifest, list) or len(manifest) != 1:
        image.close()
        fail('docker save manifest 必须只包含一个镜像')
    entry = manifest[0]
    config_name = entry['Config']
    layers = list(entry['Layers'])
    config_info = members.get(config_name)
    if config_info is None:
        image.close()
        fail(f'缺少镜像配置 {config_name}')
    config = read_json_member(image, config_info)
    return image, members, config, layers


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def gzip_bytes(payload: bytes) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', mtime=0) as handle:
        handle.write(payload)
    return buffer.getvalue()


def layer_blob(uncompressed: bytes) -> tuple[str, str, bytes]:
    diff_id = f'sha256:{sha256_bytes(uncompressed)}'
    compressed = gzip_bytes(uncompressed)
    digest = sha256_bytes(compressed)
    return diff_id, digest, compressed


def add_bytes(image: tarfile.TarFile, name: str, payload: bytes) -> None:
    info = tarfile.TarInfo(name)
    info.size = len(payload)
    info.mode = 0o644
    info.mtime = 0
    image.addfile(info, io.BytesIO(payload))


def write_docker_image(
    path: str,
    config: dict,
    layer_digests: list[str],
    blobs: list[tuple[str, bytes]],
    tag: str,
) -> None:
    config_bytes = json.dumps(config, separators=(',', ':')).encode('utf-8')
    config_digest = sha256_bytes(config_bytes)
    manifest = [{
        'Config': f'blobs/sha256/{config_digest}',
        'RepoTags': [tag],
        'Layers': [f'blobs/sha256/{digest}' for digest in layer_digests],
    }]
    temporary = f'{path}.tmp-{os.getpid()}'
    with tarfile.open(temporary, 'w') as image:
        add_bytes(image, 'manifest.json', json.dumps(manifest).encode('utf-8'))
        add_bytes(image, f'blobs/sha256/{config_digest}', config_bytes)
        for digest, payload in blobs:
            add_bytes(image, f'blobs/sha256/{digest}', payload)
    os.replace(temporary, path)


def iter_layer_members(image: tarfile.TarFile, members: dict[str, tarfile.TarInfo], layer_name: str):
    info = members.get(layer_name)
    if info is None:
        fail(f'缺少层 {layer_name}')
    extracted = image.extractfile(info)
    if extracted is None:
        fail(f'无法读取层 {layer_name}')
    layer = open_layer(extracted)
    try:
        for member in layer:
            yield member, layer
    finally:
        layer.close()


def apply_tree(index: dict[str, str], rel: str, kind: str) -> None:
    index[rel] = kind


def remove_tree(index: dict[str, str], rel: str) -> None:
    prefix = f'{rel}/'
    for key in [item for item in index if item == rel or item.startswith(prefix)]:
        index.pop(key, None)


def scan_prefix(image, members, layers: list[str]) -> tuple[int, dict[str, str], str]:
    index: dict[str, str] = {}
    marker_at = None
    marker_text = ''
    for layer_index, layer_name in enumerate(layers):
        saw_marker = False
        for member, layer in iter_layer_members(image, members, layer_name):
            rel = normalize_name(member.name)
            if not rel:
                continue
            kind = whiteout_kind(rel)
            if kind is not None:
                mode, target = kind
                if mode == 'opaque':
                    prefix = f'{target}/' if target else ''
                    for key in [item for item in index if prefix and item.startswith(prefix)]:
                        index.pop(key, None)
                else:
                    remove_tree(index, target)
                continue
            if member.isdir():
                apply_tree(index, rel, 'dir')
            elif member.issym():
                apply_tree(index, rel, 'symlink')
            elif member.isfile() or member.islnk():
                apply_tree(index, rel, 'file')
            if rel == RUNNER_OS_MARKER and member.isfile():
                extracted = layer.extractfile(member)
                marker_text = (extracted.read() if extracted else b'').decode('utf-8').strip()
                saw_marker = True
        if saw_marker:
            if marker_at is not None:
                fail('运行系统标记出现在多个层中')
            marker_at = layer_index
            break
    if marker_at is None or not marker_text:
        fail('镜像中找不到运行系统修订标记 usr/local/share/act-runner-os-rev')
    return marker_at, index, marker_text


def ensure_parent(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def remove_extracted(root: str, rel: str) -> None:
    target = os.path.join(root, rel)
    if os.path.lexists(target) or os.path.islink(target):
        if os.path.isdir(target) and not os.path.islink(target):
            shutil.rmtree(target)
        else:
            os.remove(target)


def extract_member(root: str, rel: str, member: tarfile.TarInfo, layer: tarfile.TarFile) -> None:
    destination = os.path.join(root, rel)
    ensure_parent(destination)
    exists = os.path.lexists(destination) or os.path.islink(destination)
    if member.isdir():
        # Later COPY layers repeat parent directories. Replacing an existing
        # directory would drop files copied by earlier layers.
        if exists and not (os.path.isdir(destination) and not os.path.islink(destination)):
            remove_extracted(root, rel)
        os.makedirs(destination, exist_ok=True)
        return
    if exists:
        remove_extracted(root, rel)
    if member.issym():
        os.symlink(member.linkname, destination)
        return
    if member.islnk():
        target_rel = normalize_name(member.linkname)
        target = os.path.join(root, target_rel)
        if not os.path.exists(target):
            fail(f'硬链接目标不存在: {rel} -> {target_rel}')
        os.link(target, destination)
        return
    if not member.isfile():
        fail(f'不支持的层成员类型: {rel}')
    extracted = layer.extractfile(member)
    if extracted is None:
        fail(f'无法读取文件 {rel}')
    with open(destination, 'wb') as handle:
        shutil.copyfileobj(extracted, handle)
    os.chmod(destination, member.mode & 0o777)


def apply_app_layers(
    image,
    members,
    layers: list[str],
    prefixes: list[str],
    base_paths: dict[str, str],
    root: str,
) -> tuple[list[str], dict[str, tarfile.TarInfo]]:
    deletions = set()
    metadata: dict[str, tarfile.TarInfo] = {}
    order: list[str] = []

    def remember(rel: str, member: tarfile.TarInfo) -> None:
        metadata[rel] = member
        if rel not in order:
            order.append(rel)
        deletions.discard(rel)

    for layer_name in layers:
        for member, layer in iter_layer_members(image, members, layer_name):
            rel = normalize_name(member.name)
            if not rel:
                continue
            kind = whiteout_kind(rel)
            if kind is not None:
                mode, target = kind
                if mode == 'opaque':
                    prefix = f'{target}/' if target else ''
                    victims = [
                        item for item in list(base_paths)
                        if prefix and item.startswith(prefix)
                    ]
                    victims.extend(
                        item for item in list(metadata)
                        if prefix and item.startswith(prefix)
                    )
                    for item in victims:
                        if item in base_paths:
                            deletions.add(item)
                        metadata.pop(item, None)
                        if item in order:
                            order.remove(item)
                        remove_extracted(root, item)
                else:
                    if target in base_paths:
                        deletions.add(target)
                    prefix = f'{target}/'
                    for item in [key for key in metadata if key == target or key.startswith(prefix)]:
                        metadata.pop(item, None)
                        if item in order:
                            order.remove(item)
                        remove_extracted(root, item)
                    deletions.add(target) if target in base_paths else None
                continue
            if forbidden(rel, prefixes):
                fail(f'应用层包含禁止打包的路径: {rel}')
            extract_member(root, rel, member, layer)
            remember(rel, member)
            if rel in base_paths:
                deletions.discard(rel)
    return sorted(deletions), metadata | {'__order__': order}  # type: ignore[operator]


def write_rootfs(root: str, order: list[str], metadata: dict[str, tarfile.TarInfo], destination: str) -> None:
    seen_inode: dict[tuple[int, int], str] = {}
    temporary = f'{destination}.tmp-{os.getpid()}'
    with gzip.GzipFile(filename='', fileobj=open(temporary, 'wb'), mode='wb', mtime=0, compresslevel=6) as compressed:
        with tarfile.open(fileobj=compressed, mode='w|') as archive:
            for rel in order:
                source = os.path.join(root, rel)
                info = metadata[rel]
                st = os.lstat(source)
                tar_info = tarfile.TarInfo(rel)
                tar_info.mode = info.mode & 0o777
                tar_info.uid = info.uid
                tar_info.gid = info.gid
                tar_info.mtime = info.mtime
                tar_info.uname = info.uname or ''
                tar_info.gname = info.gname or ''
                if stat.S_ISLNK(st.st_mode):
                    tar_info.type = tarfile.SYMTYPE
                    tar_info.linkname = os.readlink(source)
                    archive.addfile(tar_info)
                    continue
                if stat.S_ISDIR(st.st_mode):
                    tar_info.type = tarfile.DIRTYPE
                    archive.addfile(tar_info)
                    continue
                if not stat.S_ISREG(st.st_mode):
                    fail(f'增量根文件系统包含不支持的文件: {rel}')
                inode_key = (st.st_dev, st.st_ino)
                if st.st_nlink > 1 and inode_key in seen_inode:
                    tar_info.type = tarfile.LNKTYPE
                    tar_info.linkname = seen_inode[inode_key]
                    archive.addfile(tar_info)
                    continue
                if st.st_nlink > 1:
                    seen_inode[inode_key] = rel
                tar_info.type = tarfile.REGTYPE
                tar_info.size = st.st_size
                with open(source, 'rb') as handle:
                    archive.addfile(tar_info, handle)
    os.replace(temporary, destination)


def history_alignment(config: dict, layer_count: int) -> list[int]:
    history = config.get('history') or []
    nonempty = [index for index, entry in enumerate(history) if not entry.get('empty_layer')]
    diff_ids = (config.get('rootfs') or {}).get('diff_ids') or []
    if len(nonempty) != layer_count or len(diff_ids) != layer_count:
        fail(
            '镜像 history、diff_id 与层数量不一致: '
            f'history={len(nonempty)} diff={len(diff_ids)} layers={layer_count}',
        )
    return nonempty


def base_env(env: list[str]) -> list[str]:
    kept = []
    for entry in env:
        key = entry.split('=', 1)[0]
        if key not in APP_ENV_KEYS:
            kept.append(entry)
    return kept


def carve_runner_os(config: dict, marker_at: int, nonempty: list[int], rev: str, tag: str) -> dict:
    history = config.get('history') or []
    created_by = history[nonempty[marker_at]].get('created_by') or ''
    if 'chromium' not in created_by or 'libreoffice' not in created_by:
        fail('运行系统层的构建指令里没有同时出现 chromium 与 libreoffice')
    history_end = nonempty[marker_at] + 1
    final_env = list((config.get('config') or {}).get('Env') or [])
    return {
        'architecture': config.get('architecture') or 'amd64',
        'os': config.get('os') or 'linux',
        'config': {
            'User': '',
            'Env': base_env(final_env),
            'Entrypoint': ['docker-entrypoint.sh'],
            'Cmd': ['node'],
            'WorkingDir': '/',
            'Labels': {'io.act.runner-os-rev': rev},
        },
        'rootfs': {
            'type': 'layers',
            'diff_ids': list(config['rootfs']['diff_ids'][: marker_at + 1]),
        },
        'history': history[:history_end],
        'repoTag': tag,
    }


def copy_layer_blobs(image: tarfile.TarFile, members: dict[str, tarfile.TarInfo], layers: list[str]) -> list[tuple[str, bytes]]:
    blobs = []
    for layer_name in layers:
        info = members[layer_name]
        extracted = image.extractfile(info)
        if extracted is None:
            fail(f'无法复制层 {layer_name}')
        payload = extracted.read()
        digest = layer_name.rsplit('/', 1)[-1]
        actual = sha256_bytes(payload)
        if actual != digest:
            fail(f'层摘要与内容不一致: {layer_name}')
        blobs.append((digest, payload))
    return blobs


def write_bundle(path: str, meta: dict, rootfs_path: str) -> None:
    temporary = f'{path}.tmp-{os.getpid()}'
    meta_bytes = json.dumps(meta, ensure_ascii=False, indent=2).encode('utf-8') + b'\n'
    with tarfile.open(temporary, 'w') as bundle:
        add_bytes(bundle, 'app-meta.json', meta_bytes)
        info = tarfile.TarInfo('app-rootfs.tar.gz')
        stat_result = os.stat(rootfs_path)
        info.size = stat_result.st_size
        info.mode = 0o644
        info.mtime = 0
        with open(rootfs_path, 'rb') as handle:
            bundle.addfile(info, handle)
    os.replace(temporary, path)


def read_bundle_meta(path: str) -> dict:
    with tarfile.open(path, 'r:*') as bundle:
        try:
            extracted = bundle.extractfile('app-meta.json')
        except KeyError:
            fail(f'不是应用增量包: {path}')
        if extracted is None:
            fail(f'无法读取应用元数据: {path}')
        meta = json.load(extracted)
    if meta.get('schema') != BUNDLE_SCHEMA:
        fail(f'应用增量包 schema 不匹配: {path}')
    return meta


def command_kind(path: str) -> str:
    with tarfile.open(path, 'r:*') as bundle:
        names = {member.name for member in bundle.getmembers()}
    if 'app-meta.json' in names and 'app-rootfs.tar.gz' in names:
        return 'bundle'
    if 'manifest.json' in names:
        return 'docker-image'
    fail(f'无法识别的镜像包: {path}')
    return 'unknown'


def public_config(config: dict) -> dict:
    section = config.get('config') or {}
    return {
        'User': section.get('User') or '',
        'Env': list(section.get('Env') or []),
        'Entrypoint': list(section.get('Entrypoint') or []),
        'Cmd': list(section.get('Cmd') or []),
        'WorkingDir': section.get('WorkingDir') or '/app',
        'ExposedPorts': section.get('ExposedPorts') or {},
        'Labels': section.get('Labels') or {},
    }


def split_image(options: dict[str, str]) -> None:
    image_tar = require(options, 'image-tar')
    policy = load_policy(require(options, 'policy'))
    bundle_tar = require(options, 'bundle-tar')
    runner_os_tar = require(options, 'runner-os-tar')
    expected_revision = require(options, 'expected-revision')
    expected_rev = require(options, 'expected-runner-os-rev')
    image, members, config, layers = load_docker_image(image_tar)
    root = tempfile.mkdtemp(prefix='act-app-rootfs-', dir=os.path.dirname(os.path.abspath(bundle_tar)) or None)
    rootfs_path = os.path.join(root, 'app-rootfs.tar.gz')
    try:
        nonempty = history_alignment(config, len(layers))
        marker_at, base_paths, marker_text = scan_prefix(image, members, layers)
        if marker_text != expected_rev:
            fail(f'运行系统修订不一致: 镜像={marker_text} 期望={expected_rev}')
        labels = (config.get('config') or {}).get('Labels') or {}
        revision = labels.get('org.opencontainers.image.revision')
        if revision != expected_revision:
            fail(f'镜像修订标签不一致: 镜像={revision} 期望={expected_revision}')
        tag = f'localhost/act-obe-runner-os:{marker_text}'
        carved = carve_runner_os(config, marker_at, nonempty, marker_text, tag)
        prefix_layers = layers[: marker_at + 1]
        app_layers = layers[marker_at + 1 :]
        order_and_meta = apply_app_layers(
            image,
            members,
            app_layers,
            list(policy['imagePathPrefixes']),
            base_paths,
            root,
        )
        deletions, metadata = order_and_meta
        order = metadata.pop('__order__')
        write_rootfs(root, order, metadata, rootfs_path)
        blobs = copy_layer_blobs(image, members, prefix_layers)
        runner_config = {key: value for key, value in carved.items() if key != 'repoTag'}
        write_docker_image(
            runner_os_tar,
            runner_config,
            [digest for digest, _payload in blobs],
            blobs,
            tag,
        )
        meta = {
            'schema': BUNDLE_SCHEMA,
            'runnerOsRev': marker_text,
            'runnerOsImage': tag,
            'runnerOsDiffIds': runner_config['rootfs']['diff_ids'],
            'appRevision': expected_revision,
            'config': public_config(config),
            'deletions': deletions,
        }
        write_bundle(bundle_tar, meta, rootfs_path)
        monolith_size = os.path.getsize(image_tar)
        bundle_size = os.path.getsize(bundle_tar)
        runner_size = os.path.getsize(runner_os_tar)
        sys.stdout.write(
            'packaging '
            f'monolith={monolith_size} bundle={bundle_size} runner_os={runner_size} '
            f'base_layers={len(prefix_layers)} app_layers={len(app_layers)} '
            f'deletions={len(deletions)}\n'
        )
    finally:
        image.close()
        shutil.rmtree(root, ignore_errors=True)


def tar_bytes(entries: list[tuple[str, bytes | None, dict]]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w') as archive:
        for name, payload, fields in entries:
            info = tarfile.TarInfo(name)
            info.mtime = 0
            info.mode = int(fields.get('mode', 0o644 if payload is not None else 0o755))
            info.uid = int(fields.get('uid', 0))
            info.gid = int(fields.get('gid', 0))
            if fields.get('link'):
                info.type = tarfile.LNKTYPE
                info.linkname = fields['link']
                archive.addfile(info)
                continue
            if payload is None:
                info.type = tarfile.DIRTYPE
                archive.addfile(info)
                continue
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
    return buffer.getvalue()


def command_write_fixture(options: dict[str, str]) -> None:
    destination = require(options, 'dest')
    revision = require(options, 'revision')
    runner_rev = require(options, 'runner-os-rev')
    poison = options.get('poison-path')
    base_entries: list[tuple[str, bytes | None, dict]] = [
        ('usr', None, {'mode': 0o755}),
        ('usr/bin', None, {'mode': 0o755}),
        ('usr/local', None, {'mode': 0o755}),
        ('usr/local/share', None, {'mode': 0o755}),
        ('usr/bin/chromium', b'chromium\n', {'mode': 0o755}),
        ('usr/bin/keep', b'base\n', {}),
        (RUNNER_OS_MARKER, f'{runner_rev}\n'.encode('utf-8'), {}),
    ]
    app_entries: list[tuple[str, bytes | None, dict]] = [
        ('usr/bin/.wh.keep', b'', {}),
        ('app', None, {'mode': 0o755}),
        ('app/hello.txt', b'hi\n', {'mode': 0o644, 'uid': 1001, 'gid': 1001}),
        ('app/link.txt', None, {'link': 'app/hello.txt', 'uid': 1001, 'gid': 1001}),
    ]
    if poison:
        app_entries.append((poison, b'leak\n', {}))
    later_entries: list[tuple[str, bytes | None, dict]] = [
        ('app', None, {'mode': 0o755}),
        ('app/later.txt', b'later\n', {'mode': 0o644, 'uid': 1001, 'gid': 1001}),
    ]
    base_tar = tar_bytes(base_entries)
    app_tar = tar_bytes(app_entries)
    later_tar = tar_bytes(later_entries)
    base_diff, base_digest, base_blob = layer_blob(base_tar)
    app_diff, app_digest, app_blob = layer_blob(app_tar)
    later_diff, later_digest, later_blob = layer_blob(later_tar)
    created_by = (
        'RUN /bin/sh -c apt-get install -y --no-install-recommends chromium libreoffice '
        '&& printf act-runner-os-rev'
    )
    config = {
        'architecture': 'amd64',
        'os': 'linux',
        'config': {
            'User': 'nextjs',
            'Env': [
                'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                'NODE_ENV=production',
                f'APP_REVISION={revision}',
            ],
            'Entrypoint': ['./docker-entrypoint.sh'],
            'Cmd': ['node', 'server.js'],
            'WorkingDir': '/app',
            'ExposedPorts': {'3000/tcp': {}},
            'Labels': {
                'org.opencontainers.image.revision': revision,
                'io.act.runtime-media-storage.version': '1',
            },
        },
        'rootfs': {'type': 'layers', 'diff_ids': [base_diff, app_diff, later_diff]},
        'history': [
            {'created_by': created_by, 'empty_layer': False},
            {'created_by': 'COPY app/hello.txt', 'empty_layer': False},
            {'created_by': 'COPY app/later.txt', 'empty_layer': False},
        ],
    }
    ensure_parent(destination)
    write_docker_image(
        destination,
        config,
        [base_digest, app_digest, later_digest],
        [(base_digest, base_blob), (app_digest, app_blob), (later_digest, later_blob)],
        'localhost/act-obe-platform:fixture',
    )


def command_inspect_bundle(path: str) -> None:
    meta = read_bundle_meta(path)
    with tarfile.open(path, 'r:*') as bundle:
        extracted = bundle.extractfile('app-rootfs.tar.gz')
        if extracted is None:
            fail('缺少 app-rootfs.tar.gz')
        with gzip.GzipFile(fileobj=extracted) as compressed:
            with tarfile.open(fileobj=compressed, mode='r|') as rootfs:
                files = []
                for member in rootfs:
                    member_type = member.type.decode('ascii') if isinstance(member.type, bytes) else member.type
                    files.append({
                        'name': member.name,
                        'type': member_type,
                        'linkname': member.linkname,
                        'uid': member.uid,
                    })
    sys.stdout.write(json.dumps({
        'runnerOsRev': meta['runnerOsRev'],
        'runnerOsImage': meta['runnerOsImage'],
        'runnerOsDiffIds': meta['runnerOsDiffIds'],
        'appRevision': meta['appRevision'],
        'deletions': meta['deletions'],
        'labels': meta['config']['Labels'],
        'user': meta['config']['User'],
        'entrypoint': meta['config']['Entrypoint'],
        'files': files,
    }, ensure_ascii=False) + '\n')


def main() -> None:
    command, options = parse_args(sys.argv)
    if command == 'kind':
        sys.stdout.write(command_kind(require(options, 'image-tar')) + '\n')
        return
    if command == 'print-field':
        meta = read_bundle_meta(require(options, 'bundle'))
        field = require(options, 'field')
        value = meta.get(field)
        if value is None:
            fail(f'元数据没有字段 {field}')
        if isinstance(value, str):
            sys.stdout.write(value + '\n')
        else:
            sys.stdout.write(json.dumps(value, ensure_ascii=False) + '\n')
        return
    if command == 'split':
        split_image(options)
        return
    if command == 'write-fixture':
        command_write_fixture(options)
        return
    if command == 'inspect-bundle':
        command_inspect_bundle(require(options, 'bundle'))
        return
    fail(f'未知子命令: {command}')


if __name__ == '__main__':
    try:
        main()
    except ImageSplitError as error:
        sys.stderr.write(f'{error}\n')
        sys.exit(1)
