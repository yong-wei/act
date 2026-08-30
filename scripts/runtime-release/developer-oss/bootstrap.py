#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import hmac
import importlib.util
import json
import os
import subprocess
import sys
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from common import (
    DEFAULT_READYZ_URL,
    DeveloperRuntimeError,
    IDENTITY_KEYS,
    OSS_BUCKET,
    PUBLIC_OSS_ENDPOINT,
    READYZ_RUNTIME_KEYS,
    RELEASE_ID,
    RELEASE_PREFIX,
    SELECTION_SCHEMA,
    SELECTION_SCHEMA_V2,
    SELECTION_V1_KEYS,
    SELECTION_V2_KEYS,
    SHA256,
    TOPOLOGY_CHECKOUT,
    TOPOLOGY_SHARED,
    checkout_id,
    checkout_state,
    fail,
    redact,
    require_exact_keys,
    require_mode,
    topology_mode,
    use_real_fuse,
)
from consumer_readiness import (
    ConsumerVerificationError,
    DEV_DELIVERY_FILENAME,
    RECEIPT_FILENAME,
    load_runtime_requirements,
    read_verification_receipt,
    receipt_matches_binding,
    verify_consumer_view,
    write_verification_receipt,
)
from credential import assert_developer_principal, load_credential
from policy import load_and_validate
from shared_mount import (
    acquire_lease,
    adapter_locks,
    ensure_shared_mount,
    heartbeat_lease,
    is_fuse_readonly,
    is_mounted,
    is_readonly_mount,
    mount_blobs,
    write_private_bytes,
    mount_fields,
    mount_helper_path,
    portable_start_payload,
    privileged_mount,
    live_lease_ids,
    read_leases,
    refuse_legacy_checkout_mount,
    refuse_live_shared_for_checkout_topology,
    release_lease,
    remove_ossfs_config as remove_config_file,
    require_ossfs2_version,
    shared_mount_dir,
    unmount,
    unmount_best_effort,
    which,
    write_ossfs_config,
)

REQUIRED_ARCH = {"x86_64", "amd64", "aarch64", "arm64"}
MATERIALIZER_NAME = "materialize-runtime-blob-release.py"


def load_materializer():
    path = Path(__file__).resolve().parent.parent / MATERIALIZER_NAME
    spec = importlib.util.spec_from_file_location("act_runtime_materializer", path)
    if spec is None or spec.loader is None:
        fail("runtime materializer is missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(command: list[str], env: dict[str, str] | None = None, cwd: Path | None = None) -> str:
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=env,
            cwd=str(cwd) if cwd else None,
        )
    except subprocess.CalledProcessError as error:
        fail("%s failed" % command[0])
        raise error
    return completed.stdout


def https_get(url: str) -> bytes:
    if not url.startswith("https://"):
        fail("readiness URL must be HTTPS")
    helper = os.environ.get("ACT_RUNTIME_DEV_HTTP_GET")
    if helper:
        return subprocess.check_output([helper, url])
    request = urllib.request.Request(url, method="GET", headers={"Cache-Control": "no-store"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.URLError:
        fail("readiness endpoint is unavailable")
    return b""


def parse_readyz_identity(payload: Any) -> dict[str, str]:
    if not isinstance(payload, dict):
        fail("readiness response is invalid")
    extra = set(payload) - {
        "app", "db", "redis", "mathDocumentGradingWorker", "runtime", "timestamp", "version",
    }
    if extra:
        fail("readiness response has unknown fields")
    runtime = payload.get("runtime")
    if (
        not isinstance(runtime, dict)
        or not {"required", "ready", "identity"} <= set(runtime)
        or set(runtime) - set(READYZ_RUNTIME_KEYS)
    ):
        fail("readiness runtime projection is invalid")
    if runtime.get("required") is not True or runtime.get("ready") is not True:
        fail("readiness does not prove an active runtime")
    # filesystem 为可选：identity 真源可能是尚未升级的旧版生产 readyz；
    # 一旦出现则严格校验，防止半可用状态伪装为就绪。
    filesystem = runtime.get("filesystem")
    if filesystem is not None:
        if not isinstance(filesystem, dict) or set(filesystem) - {"ready", "failureClass"}:
            fail("readiness runtime filesystem projection is invalid")
        if filesystem.get("ready") is not True:
            if not isinstance(filesystem.get("failureClass"), str) or not filesystem.get("failureClass"):
                fail("readiness filesystem failure requires a credential-safe failure class")
            fail("readiness runtime filesystem verification is not ready")
    identity = require_exact_keys(runtime.get("identity"), IDENTITY_KEYS, "readiness.runtime.identity")
    schema = identity["schemaVersion"]
    release_id = identity["releaseId"]
    manifest_sha = identity["manifestSha256"]
    tree_sha = identity["treeSha256"]
    if schema != "act-runtime-release.v2":
        fail("readiness runtime schema is unsupported")
    if not isinstance(release_id, str) or not RELEASE_ID.fullmatch(release_id):
        fail("readiness release ID is invalid")
    if not isinstance(manifest_sha, str) or not SHA256.fullmatch(manifest_sha):
        fail("readiness manifest digest is invalid")
    if not isinstance(tree_sha, str) or not SHA256.fullmatch(tree_sha):
        fail("readiness tree digest is invalid")
    return {
        "schemaVersion": schema,
        "releaseId": release_id,
        "manifestSha256": manifest_sha,
        "treeSha256": tree_sha,
    }


def fetch_readyz_identity(url: str = DEFAULT_READYZ_URL) -> dict[str, str]:
    try:
        payload = json.loads(https_get(url).decode("utf-8"))
    except json.JSONDecodeError:
        fail("readiness response is invalid")
    return parse_readyz_identity(payload)


def caller_identity(credential: dict[str, str]) -> dict[str, Any]:
    helper = os.environ.get("ACT_RUNTIME_DEV_STS_GET")
    if helper:
        env = os.environ.copy()
        env["ALIBABA_CLOUD_ACCESS_KEY_ID"] = credential["accessKeyId"]
        env["ALIBABA_CLOUD_ACCESS_KEY_SECRET"] = credential["accessKeySecret"]
        raw = json.loads(subprocess.check_output([helper], env=env).decode("utf-8"))
        assert_developer_principal(raw, credential)
        return raw
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    params = {
        "AccessKeyId": credential["accessKeyId"],
        "Action": "GetCallerIdentity",
        "Format": "JSON",
        "SignatureMethod": "HMAC-SHA1",
        "SignatureNonce": str(uuid.uuid4()),
        "SignatureVersion": "1.0",
        "Timestamp": timestamp,
        "Version": "2015-04-01",
    }
    canonical_query = "&".join(
        "%s=%s" % (urllib.parse.quote(key, safe=""), urllib.parse.quote(params[key], safe=""))
        for key in sorted(params)
    )
    string_to_sign = "GET&%2F&%s" % urllib.parse.quote(canonical_query, safe="")
    signature = base64.b64encode(
        hmac.new((credential["accessKeySecret"] + "&").encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")
    url = "https://sts.aliyuncs.com/?%s&Signature=%s" % (canonical_query, urllib.parse.quote(signature, safe=""))
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            raw = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError:
        fail("caller identity request failed")
    assert_developer_principal({
        "AccountId": raw.get("AccountId"),
        "Arn": raw.get("Arn"),
        "UserId": raw.get("UserId"),
    }, credential)
    return {
        "AccountId": raw["AccountId"],
        "Arn": raw["Arn"],
        "UserId": raw["UserId"],
    }


def oss_object_key(release_id: str, name: str) -> str:
    return "%s%s/%s" % (RELEASE_PREFIX, release_id, name)


def fetch_release_documents(release_id: str, destination: Path, credential: dict[str, str]) -> tuple[Path, Path]:
    ossutil = which("ossutil")
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(destination, 0o700)
    env = os.environ.copy()
    env["OSS_ACCESS_KEY_ID"] = credential["accessKeyId"]
    env["OSS_ACCESS_KEY_SECRET"] = credential["accessKeySecret"]
    manifest = destination / "manifest.json"
    receipt = destination / "receipt.json"
    for name, target in (("manifest.json", manifest), ("receipt.json", receipt)):
        uri = "oss://%s/%s" % (OSS_BUCKET, oss_object_key(release_id, name))
        run([
            ossutil, "cp", uri, str(target),
            "--endpoint", PUBLIC_OSS_ENDPOINT,
            "--region", "cn-hangzhou",
            "--force",
        ], env=env)
        if not target.is_file() or target.is_symlink():
            fail("%s must be a regular file" % name)
    return manifest, receipt


def verify_release_documents(identity: dict[str, str], manifest_path: Path, receipt_path: Path) -> dict[str, Any]:
    materializer = load_materializer()
    manifest, wire = materializer.parse_manifest(manifest_path)
    if (
        manifest["releaseId"] != identity["releaseId"]
        or manifest["manifestSha256"] != identity["manifestSha256"]
        or manifest["treeSha256"] != identity["treeSha256"]
    ):
        fail("fetched manifest does not match readiness identity")
    if hashlib.sha256(wire).hexdigest() != hashlib.sha256(manifest_path.read_bytes()).hexdigest():
        fail("manifest wire digest drifted")
    receipt = materializer.parse_receipt(receipt_path, manifest, wire)
    if receipt["manifestSha256"] != identity["manifestSha256"] or receipt["treeSha256"] != identity["treeSha256"]:
        fail("fetched receipt does not match readiness identity")
    return manifest


def linux_preflight(checkout: Path) -> dict[str, str]:
    import platform
    machine = platform.machine().lower()
    if machine not in REQUIRED_ARCH:
        fail("unsupported architecture")
    if sys.platform != "linux" and os.environ.get("ACT_RUNTIME_DEV_ALLOW_NON_LINUX") != "1":
        fail("developer OSS runtime requires the Linux execution layer")
    if sys.platform != "linux":
        return {"architecture": machine or "fixture", "fuse": "fixture", "ossfs2": require_ossfs2_version()}
    fuse = Path("/dev/fuse")
    if not fuse.exists():
        fail("/dev/fuse is missing")
    which("ossfs2")
    which("ossutil")
    which("python3")
    which("node")
    which("mount")
    which("findmnt")
    which("umount")
    if os.geteuid() != 0:
        which("sudo")
        try:
            run([which("sudo"), "-n", mount_helper_path(), "--help"])
        except DeveloperRuntimeError:
            fail("passwordless sudo is required for /usr/local/sbin/act-runtime-dev-mount")
    if not os.access(checkout, os.W_OK):
        fail("checkout is not writable")
    return {"architecture": machine, "fuse": str(fuse), "ossfs2": require_ossfs2_version()}


def bind_runtime(view: Path, runtime_root: Path) -> None:
    runtime_root.mkdir(parents=True, exist_ok=True)
    run(privileged_mount(["bind", str(view), str(runtime_root)]))
    run(privileged_mount(["remount-ro", str(runtime_root)]))
    if not Path(runtime_root, ".act-runtime-release.v2.json").is_file():
        fail("checkout runtime bind is missing the selected view identity")
    if not is_readonly_mount(runtime_root):
        fail("checkout runtime bind must be read-only")


def write_selection_receipt(path: Path, payload: dict[str, Any]) -> None:
    schema = payload.get("schemaVersion")
    keys = SELECTION_V2_KEYS if schema == SELECTION_SCHEMA_V2 else SELECTION_V1_KEYS
    require_exact_keys(payload, keys, "selection receipt")
    serialized = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if any(secret in serialized for secret in ("accessKey", "LTAI", "Secret")):
        fail("selection receipt must not contain credentials")
    write_private_bytes(path, serialized.encode("utf-8"))


def read_selection_receipt(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    require_mode(path, 0o600, "selection receipt")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def materialize_view(manifest_path: Path, receipt_path: Path, blob_root: Path, view_root: Path, release_id: str) -> Path:
    materializer = Path(__file__).resolve().parent.parent / MATERIALIZER_NAME
    python = sys.executable
    run([python, str(materializer), "prepare", "--manifest", str(manifest_path), "--receipt", str(receipt_path), "--blob-root", str(blob_root), "--view-root", str(view_root), "--skip-blob-hash"])
    helper = view_root / "views" / release_id / ".act-runtime-blobs"
    if os.environ.get("ACT_RUNTIME_DEV_ALLOW_NON_LINUX") == "1":
        run([python, str(materializer), "attach-helper", "--release-id", release_id, "--view-root", str(view_root), "--blob-root", str(blob_root), "--test-fixture"])
    elif is_mounted(helper):
        if not is_readonly_mount(helper):
            fail("helper blob bind must be read-only")
    else:
        run(privileged_mount(["bind", str(blob_root), str(helper)]))
        run(privileged_mount(["remount-ro", str(helper)]))
        if not is_readonly_mount(helper):
            fail("helper blob bind must be read-only")
    run([python, str(materializer), "verify", "--release-id", release_id, "--view-root", str(view_root)])
    run([python, str(materializer), "select", "--release-id", release_id, "--view-root", str(view_root)])
    return helper


def consumer_gate(selected: Path, readiness: dict[str, str]) -> dict[str, Any]:
    """Issue #1713 门禁：以消费者身份验证完整 manifest 叶节点与必需治理工件。

    物化器的 verify 只证明链接形状与大小；这里以与 frontend/worker 相同的
    UID/GID 实际打开每个叶节点内容并核对 registry 治理工件，任何失败都以
    credential-safe 分类阻止启动。
    """
    materializer_module = load_materializer()
    manifest, _wire = materializer_module.parse_manifest(selected / materializer_module.LOCAL_MANIFEST)
    if (
        manifest["releaseId"] != readiness["releaseId"]
        or manifest["manifestSha256"] != readiness["manifestSha256"]
        or manifest["treeSha256"] != readiness["treeSha256"]
    ):
        fail("consumer verification view does not match the pinned readiness identity")
    try:
        return verify_consumer_view(selected, manifest, load_runtime_requirements())
    except ConsumerVerificationError as error:
        fail("consumer runtime verification failed (%s): %s" % (error.failure_class, redact(error.detail)))


def verification_receipt_path(checkout: Path) -> Path:
    return checkout / "course-content" / RECEIPT_FILENAME


def dev_delivery_marker_path(checkout: Path) -> Path:
    return checkout / "course-content" / DEV_DELIVERY_FILENAME


def _path_owned_by_checkout(path: Path, state: Path, receipt: dict[str, Any]) -> bool:
    """repair 卸载的归属证明（Issue #1713 P1）：可信根只有本 checkout 的私有
    state 目录。selection 回执自身字段（viewRoot 等）未经独立验证，不得作为
    可信根——陈旧/损坏回执可能把 viewRoot 与 helperMount 同时指到其他工作树
    的视图。归属无法证明时停止而不卸载。"""
    del receipt  # 明确不采信回执字段作为归属证据
    resolved = path.resolve()
    try:
        resolved.relative_to(state.resolve())
    except ValueError:
        return False
    return True


def write_dev_delivery_marker(checkout: Path, readiness: dict[str, str]) -> None:
    """Developer OSS 交付的显式标记（Issue #1713 P1）：readyz 据此区分生产形态与
    Developer 交付；标记一经写入持久存在，失败清理只删验证回执，因此"服务运行中
    回执被清"绝不会退化为生产语义而误报就绪。"""
    write_verification_receipt(dev_delivery_marker_path(checkout), {
        "releaseId": readiness["releaseId"],
        "manifestSha256": readiness["manifestSha256"],
        "treeSha256": readiness["treeSha256"],
    })


def start_services(checkout: Path) -> None:
    npm = which("npm")
    run([npm, "run", "startup"], cwd=checkout)


def stop_services(checkout: Path) -> None:
    npm = which("npm")
    run([npm, "run", "shutdown"], cwd=checkout)


def remove_ossfs_config(state: Path) -> None:
    remove_config_file(state / "ossfs.conf")


def read_bound_identity(runtime_root: Path) -> dict[str, str] | None:
    path = runtime_root / ".act-runtime-release.v2.json"
    if not path.is_file() or path.is_symlink():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(raw, dict):
        return None
    release_id = raw.get("releaseId")
    manifest_sha = raw.get("manifestSha256")
    tree_sha = raw.get("treeSha256")
    if not isinstance(release_id, str) or not isinstance(manifest_sha, str) or not isinstance(tree_sha, str):
        return None
    return {"releaseId": release_id, "manifestSha256": manifest_sha, "treeSha256": tree_sha}


def refuse_stacked_bind(path: Path, label: str) -> None:
    if use_real_fuse() and is_mounted(path):
        fail("refusing to stack a %s bind; unmount only %s" % (label, path))


def recover_live_checkout(
    checkout: Path,
    readiness: dict[str, str],
    runtime_root: Path,
    blob_root: Path,
    view_root: Path,
    topology: str,
    mount_id: str | None,
    receipt_path: Path,
) -> dict[str, Any] | None:
    bound = read_bound_identity(runtime_root)
    lease = None
    if topology == TOPOLOGY_SHARED and mount_id:
        lease = read_leases(mount_id).get("leases", {}).get(checkout_id(checkout))
    matches = (
        bound is not None
        and bound["releaseId"] == readiness["releaseId"]
        and bound["manifestSha256"] == readiness["manifestSha256"]
        and bound["treeSha256"] == readiness["treeSha256"]
    )
    if lease and matches:
        if use_real_fuse() and not is_readonly_mount(runtime_root):
            fail("shared lease exists but the runtime bind is not read-only; unmount only %s" % runtime_root)
        helper = Path(str(lease.get("helperMount") or view_root / "views" / readiness["releaseId"] / ".act-runtime-blobs"))
        selected = Path(str(lease.get("viewRoot") or view_root / "current"))
        # 复用前重跑消费者门禁（Issue #1713）：复用不豁免可读性与工件完整性。
        verified = consumer_gate(selected, readiness)
        payload = _selection_payload(
            checkout, readiness, blob_root, helper, selected, runtime_root, topology, mount_id,
        )
        write_selection_receipt(receipt_path, payload)
        write_verification_receipt(verification_receipt_path(checkout), {
            **verified,
            "viewRoot": str(selected),
            "runtimeRoot": str(runtime_root),
            "blobMount": str(blob_root),
        })
        write_dev_delivery_marker(checkout, readiness)
        heartbeat_lease(checkout, mount_id, payload)
        return payload
    if use_real_fuse() and is_mounted(runtime_root):
        fail("checkout runtime bind exists without a matching receipt; unmount only %s" % runtime_root)
    return None


def _selection_payload(
    checkout: Path,
    readiness: dict[str, str],
    blob_root: Path,
    helper_mount: Path,
    selected: Path,
    runtime_root: Path,
    topology: str,
    mount_id: str | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "schemaVersion": SELECTION_SCHEMA_V2 if topology == TOPOLOGY_SHARED else SELECTION_SCHEMA,
        "releaseId": readiness["releaseId"],
        "manifestSha256": readiness["manifestSha256"],
        "treeSha256": readiness["treeSha256"],
        "blobMount": str(blob_root),
        "helperMount": str(helper_mount),
        "viewRoot": str(selected),
        "runtimeRoot": str(runtime_root),
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    if topology == TOPOLOGY_SHARED:
        payload["checkoutId"] = checkout_id(checkout)
        payload["sharedMountId"] = mount_id
        payload["topology"] = TOPOLOGY_SHARED
    return payload


def prepare(checkout: Path, readyz_url: str = DEFAULT_READYZ_URL) -> dict[str, Any]:
    load_and_validate()
    linux_preflight(checkout)
    credential = load_credential(checkout)
    identity = caller_identity(credential)
    assert_developer_principal(identity, credential)
    readiness = fetch_readyz_identity(readyz_url)
    with adapter_locks(checkout):
        return _prepare_locked(checkout, readiness, credential)


def _prepare_locked(checkout: Path, readiness: dict[str, str], credential: dict[str, str]) -> dict[str, Any]:
    """prepare 的锁内主体；调用方必须已持有 adapter_locks(checkout)。"""
    topology = topology_mode()
    account_id = credential["accountId"]
    state = checkout_state(checkout)
    receipt_path = state / "selection.json"
    existing = read_selection_receipt(receipt_path)
    runtime_root = checkout / "course-content" / "runtime"
    mount_id: str | None = None
    shared: dict[str, Any] | None = None
    if topology == TOPOLOGY_SHARED:
        refuse_legacy_checkout_mount(checkout)
        shared = ensure_shared_mount(credential, account_id)
        blob_root = Path(shared["mountpoint"])
        mount_id = str(shared["identityId"])
    else:
        refuse_live_shared_for_checkout_topology(account_id)
        blob_root = state / "blobs"
    existing_topology = (existing or {}).get("topology") or TOPOLOGY_CHECKOUT
    if (
        existing
        and existing.get("releaseId") == readiness["releaseId"]
        and existing.get("manifestSha256") == readiness["manifestSha256"]
        and existing_topology == topology
    ):
        blob_mount = Path(existing["blobMount"])
        if topology == TOPOLOGY_SHARED and existing.get("sharedMountId") not in (None, mount_id):
            fail("checkout selection does not match the shared mount identity")
        if is_fuse_readonly(blob_mount) and is_readonly_mount(runtime_root):
            # 复用不豁免消费者门禁（Issue #1713）：升级代码后的常见路径正是这里，
            # 不可读或缺工件的旧视图必须被拒绝并提示 repair，而不是照常启动。
            # 失败同时清除旧回执，防止 readyz 凭同 Release 旧回执误判 ready。
            reused_view = Path(existing["viewRoot"])
            try:
                verified = consumer_gate(reused_view, readiness)
            except Exception:
                verification_receipt_path(checkout).unlink(missing_ok=True)
                raise
            if topology == TOPOLOGY_SHARED and mount_id:
                heartbeat_lease(checkout, mount_id, existing)
            write_verification_receipt(verification_receipt_path(checkout), {
                **verified,
                "viewRoot": str(reused_view),
                "runtimeRoot": str(runtime_root),
                "blobMount": str(blob_mount),
            })
            write_dev_delivery_marker(checkout, readiness)
            return existing
    try:
        recovered = recover_live_checkout(
            checkout, readiness, runtime_root, blob_root, state / "materialized", topology, mount_id, receipt_path,
        )
    except Exception:
        # crash-recovery 复用路径的门禁失败同样清除旧回执：旧服务仍在运行且失败为
        # digest/version 等读取类漂移时，readyz 有界探测仍可能成功，残留回执会误报就绪。
        verification_receipt_path(checkout).unlink(missing_ok=True)
        raise
    if recovered:
        return recovered
    documents = state / "documents" / readiness["releaseId"]
    manifest_path, oss_receipt = fetch_release_documents(readiness["releaseId"], documents, credential)
    verify_release_documents(readiness, manifest_path, oss_receipt)
    view_root = state / "materialized"
    helper = view_root / "views" / readiness["releaseId"] / ".act-runtime-blobs"
    acquired = False
    try:
        if topology == TOPOLOGY_CHECKOUT:
            config_path = state / "ossfs.conf"
            write_ossfs_config(config_path, credential)
            require_mode(config_path, 0o600, "ossfs config")
            mount_blobs(blob_root, config_path)
        view_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(view_root, 0o700)
        helper_mount = materialize_view(manifest_path, oss_receipt, blob_root, view_root, readiness["releaseId"])
        selected = view_root / "current"
        verified = consumer_gate(selected, readiness)
        payload = _selection_payload(
            checkout, readiness, blob_root, helper_mount, selected, runtime_root, topology, mount_id,
        )
        if topology == TOPOLOGY_SHARED and mount_id:
            acquire_lease(checkout, mount_id, payload)
            acquired = True
        refuse_stacked_bind(runtime_root, "runtime")
        bind_runtime(selected, runtime_root)
        write_selection_receipt(receipt_path, payload)
        write_verification_receipt(verification_receipt_path(checkout), {
            **verified,
            "viewRoot": str(selected),
            "runtimeRoot": str(runtime_root),
            "blobMount": str(blob_root),
        })
        write_dev_delivery_marker(checkout, readiness)
        return payload
    except Exception:
        unmount_best_effort(runtime_root)
        unmount_best_effort(helper)
        verification_receipt_path(checkout).unlink(missing_ok=True)
        if acquired and mount_id:
            release_lease(checkout, mount_id, unmount_best_effort)
        elif topology == TOPOLOGY_CHECKOUT:
            unmount_best_effort(blob_root)
            remove_ossfs_config(state)
        elif mount_id and not live_lease_ids(mount_id):
            unmount_best_effort(blob_root)
            remove_config_file(shared_mount_dir(mount_id) / "ossfs.conf")
        raise


def start(checkout: Path, readyz_url: str = DEFAULT_READYZ_URL) -> dict[str, Any]:
    payload = prepare(checkout, readyz_url)
    start_services(checkout)
    mount_id = payload.get("sharedMountId")
    if payload.get("topology") == TOPOLOGY_SHARED and isinstance(mount_id, str):
        heartbeat_lease(checkout, mount_id, payload)
    sys.stdout.write(json.dumps(portable_start_payload(payload), sort_keys=True) + "\n")
    return payload


def repair(checkout: Path, readyz_url: str = DEFAULT_READYZ_URL) -> dict[str, Any]:
    """Issue #1713：checkout 限域重建事务。

    整个事务在 adapter_locks 下执行（与 prepare/stop 互斥，防止基于过期 lease
    覆盖其他工作树的 live 状态）：校验回执所有权 → best-effort 停消费者 → 按回执
    卸载 bind → 锁内重新执行 _prepare_locked（物化、消费者门禁、回执全量重跑）
    → 锁外重启。共享 mount 仅在确认无其他 live lease 时释放；所有权不确定即
    停止且不删除现场。
    """
    load_and_validate()
    linux_preflight(checkout)
    credential = load_credential(checkout)
    caller_identity(credential)
    readiness = fetch_readyz_identity(readyz_url)
    with adapter_locks(checkout):
        receipt = read_selection_receipt(checkout_state(checkout) / "selection.json")
        if not receipt:
            raise DeveloperRuntimeError(
                "repair requires an existing checkout-owned selection receipt; refusing to touch uncertain state",
            )
        runtime_root = checkout / "course-content" / "runtime"
        if Path(receipt["runtimeRoot"]).resolve() != runtime_root.resolve():
            raise DeveloperRuntimeError("repair receipt does not own this checkout runtime path")
        try:
            stop_services(checkout)
        except DeveloperRuntimeError:
            # 消费者可能已因 runtime 不可读而不可停止；重建不依赖停止成功，
            # 后续 bind 卸载仍由回执所有权证明。
            pass
        unmount(Path(receipt["runtimeRoot"]))
        state = checkout_state(checkout)
        helper_mount = Path(receipt.get("helperMount") or str(Path(receipt["viewRoot"]) / ".act-runtime-blobs"))
        if not _path_owned_by_checkout(helper_mount, state, receipt):
            raise DeveloperRuntimeError(
                "repair refused to unmount helper mount outside this checkout's owned state; uncertain ownership",
            )
        unmount(helper_mount)
        if receipt.get("topology") == TOPOLOGY_SHARED and receipt.get("sharedMountId"):
            release_lease(checkout, str(receipt["sharedMountId"]), unmount)
        else:
            blob_mount = Path(receipt["blobMount"])
            if not _path_owned_by_checkout(blob_mount, state, receipt):
                raise DeveloperRuntimeError(
                    "repair refused to unmount blob mount outside this checkout's owned state; uncertain ownership",
                )
            unmount(blob_mount)
        remove_ossfs_config(checkout_state(checkout))
        verification_receipt_path(checkout).unlink(missing_ok=True)
        payload = _prepare_locked(checkout, readiness, credential)
    start_services(checkout)
    mount_id = payload.get("sharedMountId")
    if payload.get("topology") == TOPOLOGY_SHARED and isinstance(mount_id, str):
        heartbeat_lease(checkout, mount_id, payload)
    sys.stdout.write(json.dumps(portable_start_payload(payload), sort_keys=True) + "\n")
    return payload


def stop(checkout: Path) -> None:
    with adapter_locks(checkout):
        state = checkout_state(checkout)
        try:
            stop_services(checkout)
            receipt = read_selection_receipt(state / "selection.json")
            runtime_root = checkout / "course-content" / "runtime"
            if receipt:
                if Path(receipt["runtimeRoot"]).resolve() != runtime_root.resolve():
                    fail("shutdown refused to unmount an unknown runtime path")
                unmount(Path(receipt["runtimeRoot"]))
                helper_mount = receipt.get("helperMount") or str(Path(receipt["viewRoot"]) / ".act-runtime-blobs")
                unmount(Path(helper_mount))
                if receipt.get("topology") == TOPOLOGY_SHARED and receipt.get("sharedMountId"):
                    release_lease(checkout, str(receipt["sharedMountId"]), unmount)
                else:
                    unmount(Path(receipt["blobMount"]))
            else:
                sys.stderr.write("no checkout-owned runtime receipt; stopped services only\n")
        finally:
            remove_ossfs_config(state)
