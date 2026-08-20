#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import hmac
import importlib.util
import json
import os
import shutil
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
    BLOB_PREFIX,
    DEFAULT_READYZ_URL,
    DeveloperRuntimeError,
    IDENTITY_KEYS,
    OSS_BUCKET,
    PUBLIC_OSS_ENDPOINT,
    READYZ_RUNTIME_KEYS,
    RELEASE_ID,
    RELEASE_PREFIX,
    SELECTION_SCHEMA,
    SHA256,
    checkout_state,
    fail,
    redact,
    require_exact_keys,
    require_mode,
)
from credential import assert_developer_principal, load_credential
from policy import load_and_validate

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


def which(name: str) -> str:
    path = shutil.which(name)
    if not path:
        fail("required tool is missing: %s" % name)
    return path


MOUNT_HELPER = Path(__file__).with_name("privileged-mount.py")


def mount_helper_path() -> str:
    configured = os.environ.get("ACT_RUNTIME_DEV_MOUNT_HELPER")
    if configured:
        return configured
    installed = Path("/usr/local/sbin/act-runtime-dev-mount")
    if installed.exists():
        return str(installed)
    fail("install /usr/local/sbin/act-runtime-dev-mount; do not grant unrestricted mount sudo")
    return ""


def privileged_mount(args: list[str]) -> list[str]:
    helper = mount_helper_path() if os.geteuid() != 0 else sys.executable
    if os.geteuid() == 0:
        return [sys.executable, str(MOUNT_HELPER), *args]
    return [which("sudo"), "-n", helper, *args]


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


def write_ossfs_config(path: Path, credential: dict[str, str]) -> None:
    lines = [
        "--oss_endpoint=%s" % PUBLIC_OSS_ENDPOINT,
        "--oss_bucket=%s" % OSS_BUCKET,
        "--oss_region=cn-hangzhou",
        "--oss_access_key_id=%s" % credential["accessKeyId"],
        "--oss_access_key_secret=%s" % credential["accessKeySecret"],
        "--oss_bucket_prefix=%s" % BLOB_PREFIX,
        "--ro=true",
        "--allow_other=true",
        "--file_mode=0644",
        "--dir_mode=0755",
    ]
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(descriptor, ("\n".join(lines) + "\n").encode("utf-8"))
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)


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
        return {"architecture": machine or "fixture", "fuse": "fixture"}
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
    return {"architecture": machine, "fuse": str(fuse)}


def mount_fields(path: Path) -> tuple[str, str]:
    helper = os.environ.get("ACT_RUNTIME_DEV_FINDMNT")
    command = [helper or which("findmnt"), "-n", "-o", "FSTYPE,OPTIONS", str(path)]
    completed = subprocess.run(command, capture_output=True, text=True)
    output = (completed.stdout or "").strip()
    if completed.returncode != 0 or not output:
        return "", ""
    fields = output.split(None, 1)
    fstype = fields[0] if fields else ""
    options = fields[1] if len(fields) > 1 else ""
    return fstype, options


def is_fuse_readonly(path: Path) -> bool:
    fstype, options = mount_fields(path)
    return "fuse" in fstype.lower() and "ro" in options.split(",")


def is_readonly_mount(path: Path) -> bool:
    _, options = mount_fields(path)
    return "ro" in options.split(",")


def mount_blobs(blob_root: Path, config_path: Path) -> None:
    blob_root.mkdir(mode=0o755, parents=True, exist_ok=True)
    ossfs = which("ossfs2")
    run([ossfs, "-c", str(config_path), str(blob_root)])
    if not is_fuse_readonly(blob_root):
        fail("blob mount must be a read-only FUSE filesystem")


def bind_runtime(view: Path, runtime_root: Path) -> None:
    runtime_root.mkdir(parents=True, exist_ok=True)
    run(privileged_mount(["bind", str(view), str(runtime_root)]))
    run(privileged_mount(["remount-ro", str(runtime_root)]))
    if not Path(runtime_root, ".act-runtime-release.v2.json").is_file():
        fail("checkout runtime bind is missing the selected view identity")
    if not is_readonly_mount(runtime_root):
        fail("checkout runtime bind must be read-only")


def unmount(path: Path) -> None:
    fstype, _ = mount_fields(path)
    if not fstype:
        return
    if "fuse" in fstype.lower():
        fusermount = shutil.which("fusermount")
        if fusermount:
            subprocess.run([fusermount, "-u", str(path)], check=False, capture_output=True)
    subprocess.run(privileged_mount(["umount", str(path)]), check=False, capture_output=True)
    remaining, _ = mount_fields(path)
    if remaining:
        fail("failed to unmount a checkout-owned mount")


def unmount_best_effort(path: Path) -> None:
    try:
        unmount(path)
    except DeveloperRuntimeError:
        return


def write_selection_receipt(path: Path, payload: dict[str, Any]) -> None:
    require_exact_keys(payload, (
        "schemaVersion", "releaseId", "manifestSha256", "treeSha256", "blobMount", "helperMount", "viewRoot", "runtimeRoot", "startedAt",
    ), "selection receipt")
    serialized = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if any(secret in serialized for secret in ("accessKey", "LTAI", "Secret")):
        fail("selection receipt must not contain credentials")
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(descriptor, serialized.encode("utf-8"))
        os.fchmod(descriptor, 0o600)
    finally:
        os.close(descriptor)


def read_selection_receipt(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    require_mode(path, 0o600, "selection receipt")
    return json.loads(path.read_text(encoding="utf-8"))


def acquire_lock(checkout: Path) -> int:
    import fcntl
    state = checkout_state(checkout)
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(state, 0o700)
    lock_path = state / "prepare.lock"
    descriptor = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    fcntl.flock(descriptor, fcntl.LOCK_EX)
    return descriptor


def materialize_view(manifest_path: Path, receipt_path: Path, blob_root: Path, view_root: Path, release_id: str) -> Path:
    materializer = Path(__file__).resolve().parent.parent / MATERIALIZER_NAME
    python = sys.executable
    run([python, str(materializer), "prepare", "--manifest", str(manifest_path), "--receipt", str(receipt_path), "--blob-root", str(blob_root), "--view-root", str(view_root), "--skip-blob-hash"])
    helper = view_root / "views" / release_id / ".act-runtime-blobs"
    if os.environ.get("ACT_RUNTIME_DEV_ALLOW_NON_LINUX") == "1":
        run([python, str(materializer), "attach-helper", "--release-id", release_id, "--view-root", str(view_root), "--blob-root", str(blob_root), "--test-fixture"])
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


def prepare(checkout: Path, readyz_url: str = DEFAULT_READYZ_URL) -> dict[str, Any]:
    load_and_validate()
    linux_preflight(checkout)
    credential = load_credential(checkout)
    identity = caller_identity(credential)
    assert_developer_principal(identity, credential)
    readiness = fetch_readyz_identity(readyz_url)
    lock = acquire_lock(checkout)
    try:
        state = checkout_state(checkout)
        receipt_path = state / "selection.json"
        existing = read_selection_receipt(receipt_path)
        runtime_root = checkout / "course-content" / "runtime"
        if existing and existing.get("releaseId") == readiness["releaseId"] and existing.get("manifestSha256") == readiness["manifestSha256"]:
            blob_mount = Path(existing["blobMount"])
            if is_fuse_readonly(blob_mount) and is_readonly_mount(runtime_root):
                return existing
        documents = state / "documents" / readiness["releaseId"]
        manifest_path, oss_receipt = fetch_release_documents(readiness["releaseId"], documents, credential)
        verify_release_documents(readiness, manifest_path, oss_receipt)
        blob_root = state / "blobs"
        config_path = state / "ossfs.conf"
        write_ossfs_config(config_path, credential)
        require_mode(config_path, 0o600, "ossfs config")
        view_root = state / "materialized"
        try:
            mount_blobs(blob_root, config_path)
            view_root.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(view_root, 0o700)
            helper_mount = materialize_view(manifest_path, oss_receipt, blob_root, view_root, readiness["releaseId"])
            selected = view_root / "current"
            bind_runtime(selected, runtime_root)
            payload = {
                "schemaVersion": SELECTION_SCHEMA,
                "releaseId": readiness["releaseId"],
                "manifestSha256": readiness["manifestSha256"],
                "treeSha256": readiness["treeSha256"],
                "blobMount": str(blob_root),
                "helperMount": str(helper_mount),
                "viewRoot": str(selected),
                "runtimeRoot": str(runtime_root),
                "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            write_selection_receipt(receipt_path, payload)
            return payload
        except Exception:
            helper = view_root / "views" / readiness["releaseId"] / ".act-runtime-blobs"
            unmount_best_effort(runtime_root)
            unmount_best_effort(helper)
            unmount_best_effort(blob_root)
            remove_ossfs_config(state)
            raise
    finally:
        os.close(lock)


def start(checkout: Path, readyz_url: str = DEFAULT_READYZ_URL) -> dict[str, Any]:
    payload = prepare(checkout, readyz_url)
    start_services(checkout)
    sys.stdout.write(json.dumps({
        "schemaVersion": payload["schemaVersion"],
        "releaseId": payload["releaseId"],
        "manifestSha256": payload["manifestSha256"],
        "treeSha256": payload["treeSha256"],
        "ready": True,
    }, sort_keys=True) + "\n")
    return payload


def remove_ossfs_config(state: Path) -> None:
    config_path = state / "ossfs.conf"
    if config_path.exists() and config_path.is_file() and not config_path.is_symlink():
        os.remove(config_path)


def stop(checkout: Path) -> None:
    lock = acquire_lock(checkout)
    try:
        stop_services(checkout)
        state = checkout_state(checkout)
        try:
            receipt = read_selection_receipt(state / "selection.json")
            runtime_root = checkout / "course-content" / "runtime"
            if receipt:
                if Path(receipt["runtimeRoot"]).resolve() != runtime_root.resolve():
                    fail("shutdown refused to unmount an unknown runtime path")
                unmount(Path(receipt["runtimeRoot"]))
                helper_mount = receipt.get("helperMount") or str(Path(receipt["viewRoot"]) / ".act-runtime-blobs")
                unmount(Path(helper_mount))
                unmount(Path(receipt["blobMount"]))
            else:
                sys.stderr.write("no checkout-owned runtime receipt; stopped services only\n")
        finally:
            remove_ossfs_config(state)
    finally:
        os.close(lock)
