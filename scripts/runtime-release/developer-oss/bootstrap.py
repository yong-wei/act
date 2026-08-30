#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from common import (
    DEFAULT_READYZ_URL,
    DeveloperRuntimeError,
    IDENTITY_KEYS,
    READYZ_RUNTIME_KEYS,
    RELEASE_ID,
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
from credential import load_credential
from gateway_client import GatewayClient
from gateway_service import GatewayError
from shared_mount import (
    acquire_lease,
    adapter_locks,
    checkout_gateway_session_path,
    ensure_shared_mount,
    heartbeat_lease,
    is_fuse_readonly,
    is_mounted,
    is_readonly_mount,
    write_private_bytes,
    mount_fields,
    mount_helper_path,
    portable_start_payload,
    privileged_mount,
    live_lease_ids,
    mount_gateway_blobs,
    read_leases,
    refuse_legacy_checkout_mount,
    refuse_live_shared_for_checkout_topology,
    register_checkout_gateway_lease,
    release_lease,
    remove_ossfs_config as remove_config_file,
    shared_mount_dir,
    unmount,
    unmount_best_effort,
    unregister_checkout_gateway_lease,
    which,
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
    runtime = require_exact_keys(payload.get("runtime"), READYZ_RUNTIME_KEYS, "readiness.runtime")
    if runtime.get("required") is not True or runtime.get("ready") is not True:
        fail("readiness does not prove an active runtime")
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


def refuse_public_oss_data_plane(credential: dict[str, str] | None = None) -> None:
    if os.environ.get("ACT_RUNTIME_OSS_RAM_ROLE", "").strip():
        fail("workstation must not set ACT_RUNTIME_OSS_RAM_ROLE")
    if credential:
        serialized = json.dumps(credential)
        if "accessKey" in serialized or "LTAI" in serialized:
            fail("developer startup must not use an OSS AccessKey")
        url = credential.get("gatewayUrl") or ""
        if "oss-cn-hangzhou.aliyuncs.com" in url or "oss-cn-hangzhou-internal" in url:
            fail("developer startup must not use an OSS endpoint")


def caller_identity(credential: dict[str, str]) -> dict[str, Any]:
    fail("STS caller identity is not used by the developer gateway")
    return {}


def attach_gateway(credential: dict[str, str], identity: dict[str, str], checkout: Path) -> dict[str, Any]:
    refuse_public_oss_data_plane(credential)
    client = GatewayClient(credential["gatewayUrl"], credential["token"])
    try:
        issued = client.issue_lease(identity, checkout_id(checkout))
    except GatewayError:
        fail("developer runtime gateway refused the lease")
    return {"client": client, "lease": issued}


def fetch_release_documents(release_id: str, destination: Path, session: dict[str, Any]) -> tuple[Path, Path]:
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(destination, 0o700)
    client: GatewayClient = session["client"]
    lease = session["lease"]
    transport = lease["transport"]["token"]
    lease_id = lease["leaseId"]
    if lease.get("releaseId") != release_id:
        fail("gateway lease does not match readiness identity")
    manifest = destination / "manifest.json"
    receipt = destination / "receipt.json"
    try:
        manifest.write_bytes(client.get_manifest(lease_id, transport))
        receipt.write_bytes(client.get_receipt(lease_id, transport))
    except GatewayError:
        fail("developer runtime gateway could not serve release documents")
    for name, target in (("manifest.json", manifest), ("receipt.json", receipt)):
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
    refuse_public_oss_data_plane()
    if sys.platform != "linux":
        return {"architecture": machine or "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}
    fuse = Path("/dev/fuse")
    if not fuse.exists():
        fail("/dev/fuse is missing")
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
    return {"architecture": machine, "fuse": str(fuse), "adapter": "ecs-gateway"}


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
    if any(secret in serialized for secret in ("accessKey", "LTAI", "Secret", "Bearer")):
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
        payload = _selection_payload(
            checkout, readiness, blob_root, helper, selected, runtime_root, topology, mount_id,
        )
        write_selection_receipt(receipt_path, payload)
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
    linux_preflight(checkout)
    credential = load_credential(checkout)
    refuse_public_oss_data_plane(credential)
    readiness = fetch_readyz_identity(readyz_url)
    origin = credential["origin"]
    with adapter_locks(checkout):
        topology = topology_mode()
        state = checkout_state(checkout)
        receipt_path = state / "selection.json"
        existing = read_selection_receipt(receipt_path)
        runtime_root = checkout / "course-content" / "runtime"
        mount_id: str | None = None
        shared: dict[str, Any] | None = None
        if topology == TOPOLOGY_SHARED:
            refuse_legacy_checkout_mount(checkout)
            shared = ensure_shared_mount(credential)
            blob_root = Path(shared["mountpoint"])
            mount_id = str(shared["identityId"])
        else:
            refuse_live_shared_for_checkout_topology(origin)
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
                if topology == TOPOLOGY_SHARED and mount_id:
                    heartbeat_lease(checkout, mount_id, existing)
                return existing
        recovered = recover_live_checkout(
            checkout, readiness, runtime_root, blob_root, state / "materialized", topology, mount_id, receipt_path,
        )
        if recovered:
            return recovered
        session = attach_gateway(credential, readiness, checkout)
        register_checkout_gateway_lease(checkout, credential, session["lease"], mount_id)
        documents = state / "documents" / readiness["releaseId"]
        manifest_path, oss_receipt = fetch_release_documents(readiness["releaseId"], documents, session)
        verify_release_documents(readiness, manifest_path, oss_receipt)
        view_root = state / "materialized"
        helper = view_root / "views" / readiness["releaseId"] / ".act-runtime-blobs"
        acquired = False
        try:
            if topology == TOPOLOGY_CHECKOUT:
                blob_root.mkdir(mode=0o755, parents=True, exist_ok=True)
                cache_dir = checkout_state(checkout) / "cache"
                cache_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
                os.chmod(cache_dir, 0o700)
                mount_gateway_blobs(blob_root, checkout_gateway_session_path(checkout), cache_dir)
            view_root.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(view_root, 0o700)
            helper_mount = materialize_view(manifest_path, oss_receipt, blob_root, view_root, readiness["releaseId"])
            selected = view_root / "current"
            payload = _selection_payload(
                checkout, readiness, blob_root, helper_mount, selected, runtime_root, topology, mount_id,
            )
            if topology == TOPOLOGY_SHARED and mount_id:
                acquire_lease(checkout, mount_id, payload)
                acquired = True
            refuse_stacked_bind(runtime_root, "runtime")
            bind_runtime(selected, runtime_root)
            write_selection_receipt(receipt_path, payload)
            return payload
        except Exception:
            unmount_best_effort(runtime_root)
            unmount_best_effort(helper)
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


def notify_gateway_stop(checkout: Path) -> None:
    path = checkout_gateway_session_path(checkout)
    contact = os.environ.get("ACT_RUNTIME_DEV_ALLOW_NON_LINUX") != "1" or os.environ.get("ACT_RUNTIME_DEV_GATEWAY_HTTP")
    if contact and path.exists() and path.is_file() and not path.is_symlink():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            lease_id = payload.get("leaseId")
            gateway_url = payload.get("gatewayUrl")
            if isinstance(lease_id, str) and isinstance(gateway_url, str):
                credential = load_credential(checkout)
                GatewayClient(gateway_url, credential["token"]).stop_lease(lease_id)
        except (OSError, json.JSONDecodeError, KeyError, DeveloperRuntimeError, GatewayError, urllib.error.URLError):
            pass
    unregister_checkout_gateway_lease(checkout, None)


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
                notify_gateway_stop(checkout)
                if receipt.get("topology") == TOPOLOGY_SHARED and receipt.get("sharedMountId"):
                    unregister_checkout_gateway_lease(checkout, str(receipt["sharedMountId"]))
                    release_lease(checkout, str(receipt["sharedMountId"]), unmount)
                else:
                    unmount(Path(receipt["blobMount"]))
            else:
                notify_gateway_stop(checkout)
                sys.stderr.write("no checkout-owned runtime receipt; stopped services only\n")
        finally:
            remove_ossfs_config(state)
