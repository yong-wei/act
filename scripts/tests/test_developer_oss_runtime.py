#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
DEV = ROOT / "scripts/runtime-release/developer-oss"
sys.path.insert(0, str(DEV))

from bootstrap import (  # noqa: E402
    export_resource_index_revision,
    linux_preflight,
    materialize_view,
    mount_fields,
    parse_readyz_identity,
    prepare,
    refuse_public_oss_data_plane,
    start,
    stop,
    unmount,
    verify_release_manifest,
    write_selection_receipt,
)
from shared_mount import (  # noqa: E402
    cache_usage_bytes,
    fixture_cache_object,
    live_lease_ids,
    parse_ossfs2_version,
    parse_ossfs_log,
    quarantine_cache_entry,
    read_blob_with_evidence,
    read_leases,
    read_shared_record,
    reclaim_stale_leases,
    require_ossfs2_version,
    summarize_transfers,
    verify_blob_bytes,
    write_ossfs_config,
)
from common import (  # noqa: E402
    GATEWAY_PRINCIPAL,
    DeveloperRuntimeError,
    authority_id,
    authority_identity,
    checkout_id,
    checkout_state,
    redact,
)
from credential import install_credential, parse_credential  # noqa: E402
from policy import load_and_validate, validate_policy  # noqa: E402


GATEWAY_CREDENTIAL = {
    "schemaVersion": "act-runtime-dev-gateway-credential.v1",
    "gatewayUrl": "https://runtime-dev.adapt-learn.online",
    "token": "c" * 32,
}
GATEWAY_ORIGIN = "https://runtime-dev.adapt-learn.online"


def canonical(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def write_release(root: Path):
    blob_root = root / "blobs"
    blob_root.mkdir(parents=True)
    body = b'{"lesson":"1-1"}\n'
    sha = hashlib.sha256(body).hexdigest()
    (blob_root / sha).write_bytes(body)
    files = [{
        "path": "lessons/1-1/lesson.json",
        "objectKey": "runtime/blobs/sha256/" + sha,
        "sizeBytes": len(body),
        "sha256": sha,
    }]
    tree = digest([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files])
    source_revision = "a" * 40
    release_id = "runtime-" + digest({"sourceRevision": source_revision, "treeSha256": tree})[:55]
    manifest = {
        "schemaVersion": "act-runtime-release.v2",
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": 1,
        "totalBytes": len(body),
        "treeSha256": tree,
        "files": files,
    }
    manifest["manifestSha256"] = digest(manifest)
    wire = canonical(manifest) + b"\n"
    receipt = {
        "schemaVersion": "act-runtime-release-receipt.v2",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestObjectKey": "runtime/blob-releases/%s/manifest.json" % release_id,
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
        "manifestWireSizeBytes": len(wire),
        "treeSha256": tree,
        "fileCount": 1,
        "totalBytes": len(body),
        "blobs": [{"objectKey": files[0]["objectKey"], "sizeBytes": len(body), "sha256": sha}],
    }
    receipt["receiptSha256"] = digest(receipt)
    manifest_path = root / "manifest.json"
    receipt_path = root / "receipt.json"
    manifest_path.write_bytes(wire)
    receipt_path.write_bytes(canonical(receipt) + b"\n")
    return manifest, manifest_path, receipt_path


def readyz_payload(manifest):
    return {
        "app": True,
        "db": True,
        "redis": True,
        "mathDocumentGradingWorker": {"required": False, "ready": True, "configReady": True, "capabilities": None, "missing": []},
        "runtime": {
            "required": True,
            "ready": True,
            "identity": {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
            },
            "filesystem": {"ready": True},
        },
        "timestamp": "2026-08-20T00:00:00.000Z",
        "version": "test",
    }


class DeveloperOssRuntimeTests(unittest.TestCase):
    def setUp(self):
        self._env = os.environ.copy()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._env)

    def test_policy_template_is_read_only(self):
        document = load_and_validate()
        dumped = json.dumps(document)
        self.assertNotIn("PutObject", dumped)
        self.assertNotIn("DeleteObject", dumped)
        self.assertNotIn("AssumeRole", dumped)

    def test_policy_rejects_write_actions(self):
        document = load_and_validate()
        document["Statement"][0]["Action"].append("oss:PutObject")
        with self.assertRaises(ValueError):
            validate_policy(document)

    def test_unsafe_credential_paths_and_fields_fail_closed(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(checkout / "inside")
            with self.assertRaises(DeveloperRuntimeError):
                install_credential(checkout, GATEWAY_CREDENTIAL)
            with self.assertRaises(DeveloperRuntimeError):
                parse_credential({**GATEWAY_CREDENTIAL, "extra": "nope"})
            with self.assertRaises(DeveloperRuntimeError):
                parse_credential({
                    "schemaVersion": "act-runtime-dev-read-credential.v1",
                    "accountId": "123456789012",
                    "accessKeyId": "LTAIexamplekeyid01",
                    "accessKeySecret": "super-secret-value-1234",
                    "region": "cn-hangzhou",
                })
            message = redact("token=super-secret-value-1234 Bearer abc LTAIexamplekeyid01")
            self.assertNotIn("super-secret-value-1234", message)
            self.assertNotIn("LTAIexamplekeyid01", message)
            self.assertNotIn(" abc", message.replace("Bearer <redacted>", ""))

    def test_publisher_principal_is_rejected(self):
        with self.assertRaises(DeveloperRuntimeError):
            parse_credential({
                "schemaVersion": "act-runtime-dev-gateway-credential.v1",
                "gatewayUrl": "https://oss-cn-hangzhou.aliyuncs.com",
                "token": "c" * 32,
            })
        with self.assertRaises(DeveloperRuntimeError):
            parse_credential({
                "schemaVersion": "act-runtime-dev-gateway-credential.v1",
                "gatewayUrl": "https://runtime-dev.adapt-learn.online",
                "token": "LTAI" + ("c" * 28),
            })
        parsed = parse_credential(GATEWAY_CREDENTIAL)
        self.assertEqual(parsed["origin"], "https://runtime-dev.adapt-learn.online")

    def test_export_resource_index_revision_uses_pinned_source_when_git_missing(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            manifest, _, _ = write_release(Path(raw) / "release")
            runtime = checkout / "course-content" / "runtime"
            runtime.mkdir(parents=True)
            (runtime / ".act-runtime-release.v2.json").write_text(json.dumps(manifest), encoding="utf-8")
            pin = export_resource_index_revision(checkout)
            self.assertEqual(pin["APP_REVISION"], "a" * 40)
            self.assertEqual((checkout_state(checkout) / "app-revision").read_text(encoding="utf-8").strip(), "a" * 40)
            readiness = json.loads((checkout_state(checkout) / "resource-index-revision.json").read_text(encoding="utf-8"))
            self.assertEqual(readiness["revision"], "a" * 40)
            self.assertFalse(readiness["dirty"])

    def test_export_resource_index_revision_records_dirty_git_head(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            subprocess.run(["git", "init"], cwd=checkout, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "dev@example.com"], cwd=checkout, check=True)
            subprocess.run(["git", "config", "user.name", "dev"], cwd=checkout, check=True)
            (checkout / "tracked.txt").write_text("ok\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.txt"], cwd=checkout, check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=checkout, check=True, capture_output=True)
            (checkout / "tracked.txt").write_text("dirty\n", encoding="utf-8")
            sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip().lower()
            pin = export_resource_index_revision(checkout)
            self.assertEqual(pin["APP_REVISION"], sha)
            readiness = json.loads((checkout_state(checkout) / "resource-index-revision.json").read_text(encoding="utf-8"))
            self.assertTrue(readiness["dirty"])
            self.assertEqual(readiness["revision"], sha)

    def test_export_resource_index_revision_rejects_head_pin_drift(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            subprocess.run(["git", "init"], cwd=checkout, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "dev@example.com"], cwd=checkout, check=True)
            subprocess.run(["git", "config", "user.name", "dev"], cwd=checkout, check=True)
            (checkout / "tracked.txt").write_text("ok\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.txt"], cwd=checkout, check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=checkout, check=True, capture_output=True)
            manifest, _, _ = write_release(Path(raw) / "release")
            runtime = checkout / "course-content" / "runtime"
            runtime.mkdir(parents=True)
            (runtime / ".act-runtime-release.v2.json").write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaises(DeveloperRuntimeError):
                export_resource_index_revision(checkout)

    def test_export_resource_index_revision_accepts_matching_dirty_pin(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            subprocess.run(["git", "init"], cwd=checkout, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.email", "dev@example.com"], cwd=checkout, check=True)
            subprocess.run(["git", "config", "user.name", "dev"], cwd=checkout, check=True)
            (checkout / "tracked.txt").write_text("ok\n", encoding="utf-8")
            subprocess.run(["git", "add", "tracked.txt"], cwd=checkout, check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "init"], cwd=checkout, check=True, capture_output=True)
            sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=checkout, text=True).strip().lower()
            manifest, _, _ = write_release(Path(raw) / "release")
            manifest["sourceRevision"] = sha
            runtime = checkout / "course-content" / "runtime"
            runtime.mkdir(parents=True)
            (runtime / ".act-runtime-release.v2.json").write_text(json.dumps(manifest), encoding="utf-8")
            (checkout / "tracked.txt").write_text("dirty\n", encoding="utf-8")
            pin = export_resource_index_revision(checkout)
            self.assertEqual(pin["APP_REVISION"], sha)
            readiness = json.loads((checkout_state(checkout) / "resource-index-revision.json").read_text(encoding="utf-8"))
            self.assertTrue(readiness["dirty"])
            self.assertEqual(readiness["revision"], sha)

    def test_readyz_unknown_fields_and_http_fail_closed(self):
        manifest, _, _ = write_release(Path(tempfile.mkdtemp()))
        payload = readyz_payload(manifest)
        parse_readyz_identity(payload)
        payload["runtime"]["identity"]["objectKey"] = "runtime/blobs/sha256/abc"
        with self.assertRaises(DeveloperRuntimeError):
            parse_readyz_identity(payload)
        broken = readyz_payload(manifest)
        broken["runtime"]["ready"] = False
        with self.assertRaises(DeveloperRuntimeError):
            parse_readyz_identity(broken)

    def test_manifest_receipt_must_match_readiness(self):
        root = Path(tempfile.mkdtemp())
        manifest, manifest_path, receipt_path = write_release(root)
        identity = {
            "schemaVersion": "act-runtime-release.v2",
            "releaseId": manifest["releaseId"],
            "manifestSha256": manifest["manifestSha256"],
            "treeSha256": manifest["treeSha256"],
        }
        verify_release_manifest(identity, manifest_path)
        identity["manifestSha256"] = "f" * 64
        with self.assertRaises(Exception):
            verify_release_manifest(identity, manifest_path)

    def test_prepare_reuses_matching_state_and_stop_only_owned_mounts(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(Path(raw) / "xdg-config")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            os.environ["ACT_RUNTIME_DEV_CACHE_HOME"] = str(Path(raw) / "xdg-cache")
            os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
            os.environ["ACT_RUNTIME_DEV_MOUNT_TOPOLOGY"] = "checkout"
            install_credential(checkout, GATEWAY_CREDENTIAL)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            payload = readyz_payload(manifest)
            selection = {
                "schemaVersion": "act-runtime-dev-selection.v1",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
                "blobMount": str(Path(raw) / "blobs"),
                "helperMount": str(Path(raw) / "helper"),
                "viewRoot": str(Path(raw) / "view"),
                "runtimeRoot": str(checkout / "course-content" / "runtime"),
                "startedAt": "2026-08-20T00:00:00Z",
            }
            (checkout / "course-content" / "runtime").mkdir(parents=True)
            Path(raw, "blobs").mkdir()
            Path(raw, "view").mkdir()
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture"}), \
                    mock.patch("bootstrap.attach_gateway") as attach, \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=payload["runtime"]["identity"]), \
                    mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                    mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                    mock.patch("bootstrap.fetch_release_manifest") as fetch, \
                    mock.patch("bootstrap.materialize_view") as materialize, \
                    mock.patch(
                        "bootstrap.consumer_gate",
                        return_value={
                            "schemaVersion": "act-runtime-consumer-verification.v1",
                            "verifierVersion": "consumer-verification.v1",
                            "leafCount": 1,
                            "requiredArtifactSetDigest": "0" * 64,
                        },
                    ), \
                    mock.patch("bootstrap.bind_runtime") as bind:
                from common import checkout_state
                write_selection_receipt(checkout_state(checkout) / "selection.json", selection)
                reused = prepare(checkout)
                self.assertEqual(reused["releaseId"], manifest["releaseId"])
                fetch.assert_not_called()
                attach.assert_not_called()
                materialize.assert_not_called()
                bind.assert_not_called()

            with mock.patch("bootstrap.stop_services") as stopped, \
                    mock.patch("bootstrap.unmount") as unmounted:
                stop(checkout)
                stopped.assert_called_once()
                self.assertEqual(unmounted.call_count, 3)
                self.assertEqual(
                    [call.args[0] for call in unmounted.call_args_list],
                    [Path(selection["runtimeRoot"]), Path(selection["helperMount"]), Path(selection["blobMount"])],
                )

    def test_materialized_view_files_are_readable_and_readonly_dir_rejects_writes(self):
        root = Path(tempfile.mkdtemp())
        manifest, manifest_path, receipt_path = write_release(root)
        blob_root = root / "blobs"
        view_root = root / "materialized"
        view_root.mkdir()
        os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
        materialize_view(manifest_path, blob_root, view_root, manifest["releaseId"])
        view = view_root / "views" / manifest["releaseId"]
        for candidate in sorted(view.rglob("*"), key=lambda path: len(path.parts), reverse=True):
            if candidate.is_dir() and not candidate.is_symlink():
                os.chmod(candidate, 0o755)
        os.chmod(view, 0o755)
        selected = view_root / "current"
        lesson = selected / "lessons" / "1-1" / "lesson.json"
        self.assertEqual(lesson.read_bytes(), b'{"lesson":"1-1"}\n')
        os.chmod(selected, 0o555)
        with self.assertRaises(OSError):
            (selected / "should-not-write.txt").write_text("nope")

    def test_stop_derives_helper_mount_from_legacy_receipt(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            runtime = checkout / "course-content" / "runtime"
            runtime.mkdir(parents=True)
            view = Path(raw) / "view"
            helper = view / ".act-runtime-blobs"
            helper.mkdir(parents=True)
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            from common import checkout_state
            write_selection_receipt(checkout_state(checkout) / "selection.json", {
                "schemaVersion": "act-runtime-dev-selection.v1",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
                "blobMount": str(Path(raw) / "blobs"),
                "helperMount": "",
                "viewRoot": str(view),
                "runtimeRoot": str(runtime),
                "startedAt": "2026-08-20T00:00:00Z",
            })
            receipt_path = checkout_state(checkout) / "selection.json"
            payload = json.loads(receipt_path.read_text())
            payload.pop("helperMount")
            receipt_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
            os.chmod(receipt_path, 0o600)
            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount") as unmounted:
                stop(checkout)
            self.assertEqual(unmounted.call_args_list[1].args[0], helper)

    def test_preflight_uses_path_limited_mount_helper(self):
        source = (DEV / "bootstrap.py").read_text(encoding="utf-8")
        helper = (DEV / "privileged-mount.py").read_text(encoding="utf-8")
        self.assertIn("act-runtime-dev-mount", source)
        self.assertNotIn('privileged(["true"])', source)
        self.assertNotIn("NOPASSWD: /usr/bin/mount, /usr/bin/umount", source)
        self.assertIn("/proc/self/fd/", helper)
        self.assertIn("O_NOFOLLOW", helper)
        self.assertIn("pass_fds", helper)

    def test_privileged_mount_helper_rejects_arbitrary_paths(self):
        helper = DEV / "privileged-mount.py"
        with tempfile.TemporaryDirectory() as raw:
            outside = Path(raw) / "not-allowed"
            outside.mkdir()
            result = subprocess.run(
                [sys.executable, str(helper), "bind", str(outside), str(outside)],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("allowlist", result.stderr)
            self.assertNotIn("super-secret", result.stderr)
            help_result = subprocess.run(
                [sys.executable, str(helper), "--help"],
                capture_output=True,
                text=True,
            )
            self.assertEqual(help_result.returncode, 0)

    def test_privileged_mount_helper_rejects_symlink_escape(self):
        helper = DEV / "privileged-mount.py"
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            runtime = checkout / "course-content" / "runtime"
            runtime.parent.mkdir(parents=True)
            target = Path(raw) / "etc"
            target.mkdir()
            runtime.symlink_to(target)
            result = subprocess.run(
                [sys.executable, str(helper), "bind", str(runtime), str(runtime)],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("allowlist", result.stderr)

    def test_privileged_mount_helper_pins_inode_across_parent_swap(self):
        spec = importlib.util.spec_from_file_location("privileged_mount", DEV / "privileged-mount.py")
        helper = importlib.util.module_from_spec(spec)
        assert spec is not None and spec.loader is not None
        spec.loader.exec_module(helper)
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw) / "state" / "act-runtime-dev-read"
            target = root / "blobs"
            target.mkdir(parents=True)
            fd = helper.pin_allowed_dir(str(target))
            try:
                self.assertEqual(helper.fd_path(fd).resolve(), target.resolve())
                evil = Path(raw) / "etc"
                evil.mkdir()
                backup = Path(raw) / "backup"
                root.rename(backup)
                root.symlink_to(evil)
                self.assertEqual(helper.fd_path(fd).resolve(), (backup / "blobs").resolve())
                swapped = Path(os.path.realpath(str(target)))
                self.assertNotEqual(swapped, (backup / "blobs").resolve())
                self.assertFalse(helper.allowed_runtime_or_state(swapped))
            finally:
                os.close(fd)

    def test_missing_mountpoint_does_not_block_restart(self):
        with tempfile.TemporaryDirectory() as raw:
            fake = Path(raw) / "findmnt"
            fake.write_text("#!/bin/sh\nexit 1\n")
            fake.chmod(0o755)
            os.environ["ACT_RUNTIME_DEV_FINDMNT"] = str(fake)
            self.assertEqual(mount_fields(Path(raw) / "not-mounted"), ("", ""))

    def test_bind_unmount_uses_umount_not_fusermount(self):
        with tempfile.TemporaryDirectory() as raw:
            bin_dir = Path(raw) / "bin"
            bin_dir.mkdir()
            log = Path(raw) / "log.txt"
            for name, script in (
                ("findmnt", "#!/bin/sh\nif [ \"$4\" = fuse.ossfs2 ]; then echo fuse.ossfs2 rw; else echo ext4 ro; fi\n"),
                ("fusermount", "#!/bin/sh\necho fusermount \"$@\" >> \"%s\"\nexit 1\n" % log),
                ("umount", "#!/bin/sh\necho umount \"$@\" >> \"%s\"\n" % log),
            ):
                path = bin_dir / name
                path.write_text(script.replace(log.name, str(log)))
                path.chmod(0o755)
            os.environ["PATH"] = "%s:%s" % (bin_dir, os.environ.get("PATH", ""))
            os.environ.pop("ACT_RUNTIME_DEV_FINDMNT", None)
            (bin_dir / "findmnt").write_text("#!/bin/sh\necho ext4 ro\n")
            target = Path(raw) / "runtime"
            target.mkdir()
            calls = []

            def fake_run(command, check=False, capture_output=True, text=False, env=None, cwd=None):
                calls.append(command)
                class Result:
                    returncode = 0
                    stdout = ""
                    stderr = ""
                return Result()

            with mock.patch("shared_mount.mount_fields", side_effect=[("ext4", "ro"), ("", "")]):
                with mock.patch("os.geteuid", return_value=0):
                    with mock.patch("shutil.which", side_effect=lambda name: str(bin_dir / name) if (bin_dir / name).exists() else None):
                        with mock.patch("subprocess.run", side_effect=fake_run):
                            unmount(target)
            self.assertTrue(
                any(
                    command
                    and any("privileged-mount.py" in str(part) for part in command)
                    and "umount" in command
                    for command in calls
                )
            )
            self.assertFalse(any(command and str(command[0]).endswith("fusermount") for command in calls if command))

    def test_interrupted_unknown_runtime_path_is_not_recursively_deleted(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            other = Path(raw) / "other-worktree" / "course-content" / "runtime"
            other.mkdir(parents=True)
            (other / "keep.txt").write_text("stay")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            config = Path(raw) / "xdg-state" / "checkouts"
            # ensure stop still removes leftover ossfs.conf without a receipt
            from common import checkout_state
            state = checkout_state(checkout)
            state.mkdir(parents=True)
            os.chmod(state, 0o700)
            leftover = state / "ossfs.conf"
            leftover.write_text("secret-should-go")
            os.chmod(leftover, 0o600)
            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount") as unmounted:
                stop(checkout)
                unmounted.assert_not_called()
            self.assertTrue((other / "keep.txt").exists())
            self.assertFalse(leftover.exists())

    def test_stop_removes_ossfs_conf_when_unmount_fails(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            runtime = checkout / "course-content" / "runtime"
            runtime.mkdir(parents=True)
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            from common import checkout_state
            state = checkout_state(checkout)
            write_selection_receipt(state / "selection.json", {
                "schemaVersion": "act-runtime-dev-selection.v1",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
                "blobMount": str(Path(raw) / "blobs"),
                "helperMount": str(Path(raw) / "helper"),
                "viewRoot": str(Path(raw) / "view"),
                "runtimeRoot": str(runtime),
                "startedAt": "2026-08-20T00:00:00Z",
            })
            leftover = state / "ossfs.conf"
            leftover.write_text("secret-should-go")
            os.chmod(leftover, 0o600)
            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount", side_effect=DeveloperRuntimeError("busy")):
                with self.assertRaises(DeveloperRuntimeError):
                    stop(checkout)
            self.assertFalse(leftover.exists())

    def test_stop_removes_ossfs_conf_when_services_fail(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            runtime = checkout / "course-content" / "runtime"
            runtime.mkdir(parents=True)
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            from common import checkout_state
            state = checkout_state(checkout)
            write_selection_receipt(state / "selection.json", {
                "schemaVersion": "act-runtime-dev-selection.v1",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
                "blobMount": str(Path(raw) / "blobs"),
                "helperMount": str(Path(raw) / "helper"),
                "viewRoot": str(Path(raw) / "view"),
                "runtimeRoot": str(runtime),
                "startedAt": "2026-08-20T00:00:00Z",
            })
            leftover = state / "ossfs.conf"
            leftover.write_text("secret-should-go")
            os.chmod(leftover, 0o600)
            with mock.patch("bootstrap.stop_services", side_effect=DeveloperRuntimeError("shutdown failed")), mock.patch("bootstrap.unmount") as unmounted:
                with self.assertRaises(DeveloperRuntimeError):
                    stop(checkout)
                unmounted.assert_not_called()
            self.assertFalse(leftover.exists())

    def _shared_env(self, raw: str, checkout: Path):
        os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(Path(raw) / "xdg-config")
        os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
        os.environ["ACT_RUNTIME_DEV_CACHE_HOME"] = str(Path(raw) / "xdg-cache")
        os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
        os.environ["ACT_RUNTIME_DEV_MOUNT_TOPOLOGY"] = "shared"
        install_credential(checkout, GATEWAY_CREDENTIAL)
        return parse_credential(GATEWAY_CREDENTIAL)

    def _prepare_checkout(self, checkout: Path, manifest: dict, identity: dict, documents):
        payload = readyz_payload(manifest)
        (checkout / "course-content" / "runtime").mkdir(parents=True, exist_ok=True)
        with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                mock.patch("bootstrap.attach_gateway", return_value={"client": object(), "lease": {"leaseId": "lease", "releaseId": manifest["releaseId"], "transport": {"token": "t"}}}), \
                mock.patch("bootstrap.fetch_readyz_identity", return_value=payload["runtime"]["identity"]), \
                mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                mock.patch("bootstrap.fetch_release_manifest", return_value=documents[0]), \
                mock.patch("bootstrap.verify_release_manifest", return_value=manifest), \
                mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
                mock.patch(
                    "bootstrap.consumer_gate",
                    return_value={
                        "schemaVersion": "act-runtime-consumer-verification.v1",
                        "verifierVersion": "consumer-verification.v1",
                        "leafCount": 1,
                        "requiredArtifactSetDigest": "0" * 64,
                    },
                ), \
                mock.patch("bootstrap.bind_runtime"):
            (checkout / "helper").mkdir(exist_ok=True)
            return prepare(checkout)

    def test_two_worktrees_share_one_mount_and_second_read_has_no_body_transfer(self):
        with tempfile.TemporaryDirectory() as raw:
            first = Path(raw) / "repo-a"
            second = Path(raw) / "repo-b"
            first.mkdir()
            second.mkdir()
            identity = self._shared_env(raw, first)
            install_credential(second, GATEWAY_CREDENTIAL)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            blob_sha = manifest["files"][0]["sha256"]
            source = Path(raw) / "release" / "blobs" / blob_sha
            prepared_a = self._prepare_checkout(first, manifest, identity, (manifest_path, receipt_path))
            prepared_b = self._prepare_checkout(second, manifest, identity, (manifest_path, receipt_path))
            self.assertEqual(prepared_a["sharedMountId"], prepared_b["sharedMountId"])
            self.assertEqual(prepared_a["releaseId"], prepared_b["releaseId"])
            self.assertEqual(prepared_a["blobMount"], prepared_b["blobMount"])
            self.assertNotEqual(prepared_a["runtimeRoot"], prepared_b["runtimeRoot"])
            record = read_shared_record(prepared_a["sharedMountId"])
            self.assertEqual(record["adapter"], "ecs-gateway")
            self.assertNotIn("token", json.dumps(record))
            self.assertNotIn("accessKey", json.dumps(record))
            mount_id = prepared_a["sharedMountId"]
            first_read = read_blob_with_evidence(mount_id, blob_sha, source)
            second_read = read_blob_with_evidence(mount_id, blob_sha, source)
            self.assertEqual(first_read, second_read)
            summary = summarize_transfers(mount_id)
            self.assertEqual(summary["bodyTransfers"].get(blob_sha), 1)
            self.assertEqual(summary["cacheHits"].get(blob_sha), 1)

            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount") as unmounted:
                stop(first)
            unmounted_paths = [call.args[0] for call in unmounted.call_args_list]
            self.assertIn(Path(prepared_a["runtimeRoot"]), unmounted_paths)
            self.assertNotIn(Path(prepared_a["blobMount"]), unmounted_paths)
            self.assertEqual(live_lease_ids(mount_id), [checkout_id(second)])
            self.assertTrue(fixture_cache_object(mount_id, blob_sha).exists())

            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount") as unmounted:
                stop(second)
            self.assertIn(Path(prepared_b["blobMount"]), [call.args[0] for call in unmounted.call_args_list])
            self.assertTrue(fixture_cache_object(mount_id, blob_sha).exists())
            self.assertEqual(live_lease_ids(mount_id), [])

    def test_different_releases_keep_independent_views(self):
        with tempfile.TemporaryDirectory() as raw:
            first = Path(raw) / "repo-a"
            second = Path(raw) / "repo-b"
            first.mkdir()
            second.mkdir()
            identity = self._shared_env(raw, first)
            install_credential(second, GATEWAY_CREDENTIAL)
            first_manifest, first_docs, first_receipt = write_release(Path(raw) / "release-a")
            second_root = Path(raw) / "release-b"
            second_manifest, second_docs, second_receipt = write_release(second_root)
            second_manifest["releaseId"] = "runtime-" + ("d" * 55)
            second_manifest["manifestSha256"] = digest(second_manifest)
            second_docs.write_bytes(canonical(second_manifest) + b"\n")
            prepared_a = self._prepare_checkout(first, first_manifest, identity, (first_docs, first_receipt))
            prepared_b = self._prepare_checkout(second, second_manifest, identity, (second_docs, second_receipt))
            self.assertEqual(prepared_a["sharedMountId"], prepared_b["sharedMountId"])
            self.assertNotEqual(prepared_a["releaseId"], prepared_b["releaseId"])
            self.assertNotEqual(prepared_a["viewRoot"], prepared_b["viewRoot"])

    def test_identity_drift_and_writable_mount_fail_closed(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            mount_id = authority_id(GATEWAY_ORIGIN)
            record = read_shared_record(mount_id)
            record["identity"]["principal"] = "act-runtime-publisher-local"
            from shared_mount import write_private_json, record_path
            write_private_json(record_path(mount_id), record)
            with self.assertRaises(DeveloperRuntimeError):
                self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))

    def test_live_shared_session_token_is_not_replaced(self):
        from shared_mount import gateway_session_path, write_shared_gateway_session
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            self._shared_env(raw, checkout)
            credential = parse_credential(GATEWAY_CREDENTIAL)
            from shared_mount import ensure_shared_mount
            ensure_shared_mount(credential)
            mount_id = authority_id(GATEWAY_ORIGIN)
            path = gateway_session_path(mount_id)
            live_token = json.loads(path.read_text(encoding="utf-8"))["token"]
            other = {**credential, "token": "b" * 32}
            with mock.patch("shared_mount.use_real_fuse", return_value=True), \
                    mock.patch("shared_mount.is_mounted", return_value=True):
                with self.assertRaises(DeveloperRuntimeError) as raised:
                    write_shared_gateway_session(mount_id, other)
            self.assertIn("must not be replaced", str(raised.exception))
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["token"], live_token)

    def test_stale_lease_is_reclaimed_without_deleting_cache(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            prepared = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            mount_id = prepared["sharedMountId"]
            blob_sha = manifest["files"][0]["sha256"]
            read_blob_with_evidence(mount_id, blob_sha, Path(raw) / "release" / "blobs" / blob_sha)
            leases = read_leases(mount_id)
            key = next(iter(leases["leases"]))
            leases["leases"][key]["pids"] = [99999999]
            leases["leases"][key]["runtimeRoot"] = str(Path(raw) / "missing-runtime")
            from shared_mount import write_leases
            write_leases(mount_id, leases)
            reclaimed = reclaim_stale_leases(mount_id)
            self.assertEqual(reclaimed, [key])
            self.assertTrue(fixture_cache_object(mount_id, blob_sha).exists())

    def test_corrupt_cache_entry_is_quarantined(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            self._shared_env(raw, checkout)
            digest_value = "a" * 64
            mount_id = authority_id("https://runtime-dev.adapt-learn.online")
            from shared_mount import ensure_shared_mount
            ensure_shared_mount(parse_credential(GATEWAY_CREDENTIAL))
            cached = fixture_cache_object(mount_id, digest_value)
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_bytes(b"bad")
            with self.assertRaises(DeveloperRuntimeError):
                verify_blob_bytes(cached.read_bytes(), digest_value, 3)
            quarantined = quarantine_cache_entry(mount_id, digest_value)
            self.assertTrue(quarantined.exists())
            self.assertFalse(cached.exists())
            sibling = fixture_cache_object(mount_id, "b" * 64)
            sibling.write_bytes(b"keep")
            self.assertTrue(sibling.exists())
            self.assertGreater(cache_usage_bytes(mount_id), 0)

    def test_checkout_topology_preserves_shared_cache(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            prepared = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            mount_id = prepared["sharedMountId"]
            blob_sha = manifest["files"][0]["sha256"]
            read_blob_with_evidence(mount_id, blob_sha, Path(raw) / "release" / "blobs" / blob_sha)
            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount"):
                stop(checkout)
            os.environ["ACT_RUNTIME_DEV_MOUNT_TOPOLOGY"] = "checkout"
            self.assertTrue(fixture_cache_object(mount_id, blob_sha).exists())
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                    mock.patch("bootstrap.attach_gateway", return_value={"client": object(), "lease": {"leaseId": "lease", "releaseId": manifest["releaseId"], "transport": {"token": "t"}}}), \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=readyz_payload(manifest)["runtime"]["identity"]), \
                    mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                    mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                    mock.patch("bootstrap.fetch_release_manifest", return_value=manifest_path), \
                    mock.patch("bootstrap.verify_release_manifest", return_value=manifest), \
                    mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
                    mock.patch(
                        "bootstrap.consumer_gate",
                        return_value={
                            "schemaVersion": "act-runtime-consumer-verification.v1",
                            "verifierVersion": "consumer-verification.v1",
                            "leafCount": 1,
                            "requiredArtifactSetDigest": "0" * 64,
                        },
                    ), \
                mock.patch(
                    "bootstrap.consumer_gate",
                    return_value={
                        "schemaVersion": "act-runtime-consumer-verification.v1",
                        "verifierVersion": "consumer-verification.v1",
                        "leafCount": 1,
                        "requiredArtifactSetDigest": "0" * 64,
                    },
                ), \
                    mock.patch("bootstrap.bind_runtime"):
                rolled = prepare(checkout)
            self.assertEqual(rolled["schemaVersion"], "act-runtime-dev-selection.v1")
            self.assertNotIn("sharedMountId", rolled)
            self.assertTrue(fixture_cache_object(mount_id, blob_sha).exists())

    def test_checkout_topology_mounts_gateway_adapter(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(Path(raw) / "xdg-config")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            os.environ["ACT_RUNTIME_DEV_CACHE_HOME"] = str(Path(raw) / "xdg-cache")
            os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
            os.environ["ACT_RUNTIME_DEV_MOUNT_TOPOLOGY"] = "checkout"
            install_credential(checkout, GATEWAY_CREDENTIAL)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                    mock.patch("bootstrap.attach_gateway", return_value={"client": object(), "lease": {"leaseId": "lease", "releaseId": manifest["releaseId"], "transport": {"token": "t"}, "blobSizes": {manifest["files"][0]["sha256"]: manifest["files"][0]["sizeBytes"]}}}), \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=readyz_payload(manifest)["runtime"]["identity"]), \
                    mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                    mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                    mock.patch("bootstrap.fetch_release_manifest", return_value=manifest_path), \
                    mock.patch("bootstrap.verify_release_manifest", return_value=manifest), \
                    mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
                    mock.patch(
                        "bootstrap.consumer_gate",
                        return_value={
                            "schemaVersion": "act-runtime-consumer-verification.v1",
                            "verifierVersion": "consumer-verification.v1",
                            "leafCount": 1,
                            "requiredArtifactSetDigest": "0" * 64,
                        },
                    ), \
                    mock.patch("bootstrap.bind_runtime"), \
                    mock.patch("bootstrap.mount_gateway_blobs") as mounted:
                (checkout / "course-content" / "runtime").mkdir(parents=True)
                (checkout / "helper").mkdir()
                prepare(checkout)
            mounted.assert_called_once()
            blob_root, session_path, cache_dir = mounted.call_args[0]
            self.assertEqual(blob_root.name, "blobs")
            self.assertEqual(session_path.name, "gateway-session.json")
            self.assertEqual(cache_dir.name, "cache")
            session = json.loads(session_path.read_text(encoding="utf-8"))
            self.assertEqual(session.get("token"), GATEWAY_CREDENTIAL["token"])
            self.assertEqual(session.get("gatewayUrl"), GATEWAY_CREDENTIAL["gatewayUrl"])

    def test_portable_start_output_omits_paths_and_secrets(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            with mock.patch("bootstrap.start_services"), \
                    mock.patch("sys.stdout") as stdout:
                with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                        mock.patch("bootstrap.attach_gateway", return_value={"client": object(), "lease": {"leaseId": "lease", "releaseId": manifest["releaseId"], "transport": {"token": "t"}}}), \
                        mock.patch("bootstrap.fetch_readyz_identity", return_value=readyz_payload(manifest)["runtime"]["identity"]), \
                        mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                        mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                        mock.patch("bootstrap.fetch_release_manifest", return_value=manifest_path), \
                        mock.patch("bootstrap.verify_release_manifest", return_value=manifest), \
                        mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
                    mock.patch(
                        "bootstrap.consumer_gate",
                        return_value={
                            "schemaVersion": "act-runtime-consumer-verification.v1",
                            "verifierVersion": "consumer-verification.v1",
                            "leafCount": 1,
                            "requiredArtifactSetDigest": "0" * 64,
                        },
                    ), \
                mock.patch(
                    "bootstrap.consumer_gate",
                    return_value={
                        "schemaVersion": "act-runtime-consumer-verification.v1",
                        "verifierVersion": "consumer-verification.v1",
                        "leafCount": 1,
                        "requiredArtifactSetDigest": "0" * 64,
                    },
                ), \
                        mock.patch("bootstrap.bind_runtime"):
                    (checkout / "course-content" / "runtime").mkdir(parents=True)
                    (checkout / "helper").mkdir()
                    start(checkout)
            written = "".join(call.args[0] for call in stdout.write.call_args_list)
            self.assertNotIn("c" * 32, written)
            self.assertNotIn("Bearer", written)
            self.assertNotIn(str(checkout), written)
            payload = json.loads(written.strip().splitlines()[-1])
            self.assertEqual(payload["topology"], "shared")
            self.assertEqual(payload["cachePolicy"], "on-demand")
            self.assertTrue(payload["ready"])

    def test_unmounted_shared_record_is_remounted(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            prepared = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            with mock.patch("bootstrap.stop_services"), mock.patch("bootstrap.unmount"):
                stop(checkout)
            mount_id = prepared["sharedMountId"]
            self.assertEqual(read_shared_record(mount_id)["status"], "unmounted")
            from shared_mount import ensure_shared_mount
            with mock.patch("shared_mount.use_real_fuse", return_value=True), \
                    mock.patch("shared_mount.is_mounted", return_value=False), \
                    mock.patch("shared_mount.mount_gateway_blobs") as mount_gateway, \
                    mock.patch("shared_mount.is_fuse_readonly", return_value=True), \
                    mock.patch("shared_mount.shutil.disk_usage", return_value=type("U", (), {"free": 10 * 1024 ** 3})()), \
                    mock.patch("shared_mount.mount_fields", return_value=("fuse.gateway", "ro")):
                ensure_shared_mount(parse_credential(GATEWAY_CREDENTIAL))
            mount_gateway.assert_called_once()
            self.assertEqual(read_shared_record(mount_id)["status"], "mounted")

    def test_missing_receipt_reuses_live_bind_and_lease(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            prepared = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            from common import checkout_state
            (checkout_state(checkout) / "selection.json").unlink()
            runtime = checkout / "course-content" / "runtime"
            (runtime / ".act-runtime-release.v2.json").write_text(json.dumps({
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
            }), encoding="utf-8")
            payload = readyz_payload(manifest)
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                    mock.patch("bootstrap.attach_gateway") as attach, \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=payload["runtime"]["identity"]), \
                    mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                    mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                    mock.patch("bootstrap.fetch_release_manifest") as fetch, \
                    mock.patch("bootstrap.materialize_view") as materialize, \
                    mock.patch(
                        "bootstrap.consumer_gate",
                        return_value={
                            "schemaVersion": "act-runtime-consumer-verification.v1",
                            "verifierVersion": "consumer-verification.v1",
                            "leafCount": 1,
                            "requiredArtifactSetDigest": "0" * 64,
                        },
                    ), \
                    mock.patch("bootstrap.bind_runtime") as bind:
                reused = prepare(checkout)
            fetch.assert_not_called()
            materialize.assert_not_called()
            bind.assert_not_called()
            attach.assert_not_called()
            self.assertEqual(reused["releaseId"], prepared["releaseId"])
            self.assertTrue((checkout_state(checkout) / "selection.json").exists())

    def test_truncated_receipt_enters_crash_recovery(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            prepared = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            from common import checkout_state
            broken = checkout_state(checkout) / "selection.json"
            broken.write_text("{", encoding="utf-8")
            os.chmod(broken, 0o600)
            runtime = checkout / "course-content" / "runtime"
            (runtime / ".act-runtime-release.v2.json").write_text(json.dumps({
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
            }), encoding="utf-8")
            payload = readyz_payload(manifest)
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                    mock.patch("bootstrap.attach_gateway") as attach, \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=payload["runtime"]["identity"]), \
                    mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                    mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                    mock.patch("bootstrap.fetch_release_manifest") as fetch, \
                    mock.patch(
                        "bootstrap.consumer_gate",
                        return_value={
                            "schemaVersion": "act-runtime-consumer-verification.v1",
                            "verifierVersion": "consumer-verification.v1",
                            "leafCount": 1,
                            "requiredArtifactSetDigest": "0" * 64,
                        },
                    ), \
                    mock.patch("bootstrap.bind_runtime") as bind:
                reused = prepare(checkout)
            fetch.assert_not_called()
            bind.assert_not_called()
            attach.assert_not_called()
            self.assertEqual(reused["releaseId"], prepared["releaseId"])
            restored = json.loads(broken.read_text(encoding="utf-8"))
            self.assertEqual(restored["releaseId"], prepared["releaseId"])

    def test_reuse_rebuilds_missing_lease(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            identity = self._shared_env(raw, checkout)
            manifest, manifest_path, receipt_path = write_release(Path(raw) / "release")
            prepared = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            mount_id = prepared["sharedMountId"]
            from shared_mount import write_leases
            write_leases(mount_id, {"schemaVersion": "act-runtime-dev-shared-lease.v1", "leases": {}})
            self.assertEqual(live_lease_ids(mount_id), [])
            reused = self._prepare_checkout(checkout, manifest, identity, (manifest_path, receipt_path))
            self.assertEqual(reused["releaseId"], prepared["releaseId"])
            self.assertEqual(live_lease_ids(mount_id), [checkout_id(checkout)])

    def test_prepare_abort_releases_issued_gateway_lease(self):
        from shared_mount import gateway_session_path, live_shared_session_lease_rows
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            self._shared_env(raw, checkout)
            manifest, _, _ = write_release(Path(raw) / "release")
            (checkout / "course-content" / "runtime").mkdir(parents=True, exist_ok=True)
            client = mock.Mock()
            payload = readyz_payload(manifest)
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture", "adapter": "ecs-gateway"}), \
                    mock.patch("bootstrap.attach_gateway", return_value={
                        "client": client,
                        "lease": {
                            "leaseId": "orphan-lease",
                            "releaseId": manifest["releaseId"],
                            "transport": {"token": "t"},
                            "blobSizes": {},
                        },
                    }), \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=payload["runtime"]["identity"]), \
                    mock.patch("bootstrap.fetch_release_manifest", side_effect=DeveloperRuntimeError("documents failed")):
                with self.assertRaises(DeveloperRuntimeError):
                    prepare(checkout)
            client.stop_lease.assert_called_with("orphan-lease")
            mount_id = authority_id(GATEWAY_ORIGIN)
            self.assertEqual(live_lease_ids(mount_id), [])
            session_path = gateway_session_path(mount_id)
            leases = {}
            if session_path.exists():
                loaded = json.loads(session_path.read_text(encoding="utf-8"))
                leases = loaded.get("leases") or {}
            live, dead = live_shared_session_lease_rows(mount_id, leases)
            self.assertEqual(live, [])
            self.assertEqual(dead, [])

    def test_prove_read_rejects_digest_mismatch(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            self._shared_env(raw, checkout)
            from shared_mount import ensure_shared_mount
            ensure_shared_mount(parse_credential(GATEWAY_CREDENTIAL))
            source = Path(raw) / "blob"
            source.write_bytes(b"not-the-declared-digest")
            with self.assertRaises(DeveloperRuntimeError):
                read_blob_with_evidence(authority_id(GATEWAY_ORIGIN), "a" * 64, source)

    def test_ossfs2_version_and_log_parser_are_credential_safe(self):
        self.assertEqual(parse_ossfs2_version("ossfs2 version 2.0.8"), (2, 0, 8))
        with self.assertRaises(DeveloperRuntimeError):
            parse_ossfs2_version("not-a-version")
        with self.assertRaises(DeveloperRuntimeError):
            require_ossfs2_version()
        operations = parse_ossfs_log(
            'GetObject runtime/blobs/sha256/abc\ncache hit\nAuthorization: accessKeySecret=super-secret-value-1234\n'
        )
        dumped = json.dumps(operations)
        self.assertNotIn("super-secret", dumped)
        self.assertEqual([row["opClass"] for row in operations], ["gateway-body-transfer", "cache-hit"])

    def test_startup_refuses_public_oss_ram_role_and_legacy_reader(self):
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
            os.environ["ACT_RUNTIME_OSS_RAM_ROLE"] = "act-runtime-oss-read"
            with self.assertRaises(DeveloperRuntimeError):
                refuse_public_oss_data_plane()
            with self.assertRaises(DeveloperRuntimeError):
                linux_preflight(checkout)
            os.environ.pop("ACT_RUNTIME_OSS_RAM_ROLE")
            with self.assertRaises(DeveloperRuntimeError):
                parse_credential({
                    "schemaVersion": "act-runtime-dev-read-credential.v1",
                    "accountId": "123456789012",
                    "accessKeyId": "LTAIexamplekeyid01",
                    "accessKeySecret": "super-secret-value-1234",
                    "region": "cn-hangzhou",
                })
            with self.assertRaises(DeveloperRuntimeError):
                write_ossfs_config(Path(raw) / "ossfs.conf", GATEWAY_CREDENTIAL)




def write_release_with_governance(root: Path):
    """Issue #1713 fixture：普通 lesson 叶节点 + registry 要求的治理工件。"""
    blob_root = root / "blobs"
    blob_root.mkdir(parents=True)
    lesson_body = b'{"lesson":"1-1"}\n'
    lesson_sha = hashlib.sha256(lesson_body).hexdigest()
    (blob_root / lesson_sha).write_bytes(lesson_body)
    projection_body = json.dumps({
        "version": "micro-tutoring-resource-projection.v2",
        "resources": [{"optionId": "opt-b"}],
    }, sort_keys=True).encode("utf-8")
    projection_sha = hashlib.sha256(projection_body).hexdigest()
    (blob_root / projection_sha).write_bytes(projection_body)
    files = [
        {
            "path": "lessons/1-1/lesson.json",
            "objectKey": "runtime/blobs/sha256/" + lesson_sha,
            "sizeBytes": len(lesson_body),
            "sha256": lesson_sha,
        },
        {
            "path": "resource-governance/micro-tutoring-resource-projection-v2.json",
            "objectKey": "runtime/blobs/sha256/" + projection_sha,
            "sizeBytes": len(projection_body),
            "sha256": projection_sha,
        },
    ]
    tree = digest([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files])
    source_revision = "b" * 40
    release_id = "runtime-" + digest({"sourceRevision": source_revision, "treeSha256": tree})[:55]
    manifest = {
        "schemaVersion": "act-runtime-release.v2",
        "releaseId": release_id,
        "sourceRevision": source_revision,
        "fileCount": len(files),
        "totalBytes": sum(item["sizeBytes"] for item in files),
        "treeSha256": tree,
        "files": files,
    }
    manifest["manifestSha256"] = digest(manifest)
    wire = canonical(manifest) + b"\n"
    receipt = {
        "schemaVersion": "act-runtime-release-receipt.v2",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestObjectKey": "runtime/blob-releases/%s/manifest.json" % release_id,
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
        "manifestWireSizeBytes": len(wire),
        "treeSha256": tree,
        "fileCount": len(files),
        "totalBytes": sum(item["sizeBytes"] for item in files),
        "blobs": sorted(
            (
                {"objectKey": item["objectKey"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]}
                for item in files
            ),
            key=lambda item: (item["objectKey"], item["sizeBytes"], item["sha256"]),
        ),
    }
    receipt["receiptSha256"] = digest(receipt)
    manifest_path = root / "manifest.json"
    receipt_path = root / "receipt.json"
    manifest_path.write_bytes(wire)
    receipt_path.write_bytes(canonical(receipt) + b"\n")
    return manifest, manifest_path, receipt_path


GOVERNANCE_REGISTRY = {
    "schemaVersion": "act-runtime-requirements.v1",
    "capabilities": {
        "micro-tutoring-v2": {
            "artifacts": [
                {
                    "path": "resource-governance/micro-tutoring-resource-projection-v2.json",
                    "requireVersion": True,
                    "exactVersion": "micro-tutoring-resource-projection.v2",
                    "references": [],
                },
            ],
        },
    },
}


def materialize_fixture_view(root, manifest, manifest_path, receipt_path):
    os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
    view_root = root / "materialized"
    view_root.mkdir(parents=True, exist_ok=True)
    materialize_view(manifest_path, root / "blobs", view_root, manifest["releaseId"])
    return view_root / "current"


class DeveloperOssConsumerGateTests(unittest.TestCase):
    def setUp(self):
        self._env = os.environ.copy()
        os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._env)

    def _run_gate(self, selected, manifest, registry_path):
        from consumer_readiness import load_runtime_requirements, verify_consumer_view
        requirements = load_runtime_requirements(registry_path)
        return verify_consumer_view(selected, manifest, requirements)

    def test_consumer_gate_accepts_complete_view_and_writes_credential_free_receipt(self):
        import consumer_readiness
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps(GOVERNANCE_REGISTRY))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            readiness = {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
            }
            verified = self._run_gate(selected, manifest, registry_path)
            self.assertEqual(verified["releaseId"], manifest["releaseId"])
            self.assertEqual(verified["leafCount"], 2)
            self.assertEqual(verified["hashedLeafCount"], 0)
            self.assertEqual(verified["consumerUid"], os.geteuid())
            self.assertEqual(len(verified["requiredArtifacts"]), 1)
            receipt_path_target = root / "course-content" / consumer_readiness.RECEIPT_FILENAME
            consumer_readiness.write_verification_receipt(receipt_path_target, {
                **verified, "viewRoot": str(selected), "runtimeRoot": str(root / "course-content" / "runtime"),
            })
            receipt = json.loads(receipt_path_target.read_text())
            self.assertNotIn("accessKeyId", receipt)
            self.assertNotIn("Secret", json.dumps(receipt))
            self.assertTrue(consumer_readiness.receipt_matches_binding(
                receipt,
                release_id=manifest["releaseId"],
                manifest_sha256=manifest["manifestSha256"],
                tree_sha256=manifest["treeSha256"],
                runtime_root=root / "course-content" / "runtime",
                consumer_uid=os.geteuid(),
            ))
            self.assertFalse(consumer_readiness.receipt_matches_binding(
                receipt,
                release_id=manifest["releaseId"],
                manifest_sha256=manifest["manifestSha256"],
                tree_sha256=manifest["treeSha256"],
                runtime_root=root / "course-content" / "runtime",
                consumer_uid=os.geteuid() + 1,
            ))

    def test_consumer_gate_does_not_open_manifest_leaf_bodies(self):
        import builtins
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps(GOVERNANCE_REGISTRY))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            lesson = selected / "lessons" / "1-1" / "lesson.json"
            blob = Path(os.path.realpath(lesson))
            opened: list[str] = []
            real_open = builtins.open

            def wrapped(path, *args, **kwargs):
                try:
                    resolved = os.path.realpath(os.fspath(path))
                except (OSError, TypeError):
                    return real_open(path, *args, **kwargs)
                if resolved == str(blob.resolve()):
                    opened.append(resolved)
                return real_open(path, *args, **kwargs)

            with mock.patch("builtins.open", wrapped):
                verified = self._run_gate(selected, manifest, registry_path)
            self.assertEqual(opened, [])
            self.assertEqual(verified["hashedLeafCount"], 0)

    def test_consumer_gate_rejects_unreadable_blob_as_permission_denied(self):
        from bootstrap import consumer_gate
        from consumer_readiness import ConsumerVerificationError
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps(GOVERNANCE_REGISTRY))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            lesson_sha = manifest["files"][0]["sha256"]
            helper_blob = root / "release" / "materialized" / "views" / manifest["releaseId"] / ".act-runtime-blobs" / lesson_sha
            os.chmod(helper_blob, 0o000)
            try:
                readiness = {
                    "schemaVersion": "act-runtime-release.v2",
                    "releaseId": manifest["releaseId"],
                    "manifestSha256": manifest["manifestSha256"],
                    "treeSha256": manifest["treeSha256"],
                }
                with self.assertRaises(ConsumerVerificationError) as raised:
                    self._run_gate(selected, manifest, registry_path)
                self.assertEqual(raised.exception.failure_class, "permission-denied")
            finally:
                os.chmod(helper_blob, 0o644)

    def test_consumer_gate_requires_registered_artifact(self):
        from bootstrap import consumer_gate
        from consumer_readiness import ConsumerVerificationError
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps({
                "schemaVersion": "act-runtime-requirements.v1",
                "capabilities": {"micro-tutoring-v2": {"artifacts": [
                    {"path": "resource-governance/micro-tutoring-validation-registry-v2.json"},
                ]}},
            }))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            readiness = {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
            }
            with self.assertRaises(ConsumerVerificationError) as raised:
                self._run_gate(selected, manifest, registry_path)
            self.assertEqual(raised.exception.failure_class, "artifact-missing")

    def test_consumer_gate_rejects_blob_target_replacement_escape(self):
        from bootstrap import consumer_gate
        from consumer_readiness import ConsumerVerificationError
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps(GOVERNANCE_REGISTRY))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            outside = root / "outside-body.json"
            outside.write_bytes(b'{"evil":true}\n')
            view_root = root / "release" / "materialized" / "views" / manifest["releaseId"]
            os.chmod(view_root / "lessons" / "1-1", 0o755)
            link = selected / "lessons" / "1-1" / "lesson.json"
            link.unlink()
            link.symlink_to(outside)
            readiness = {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
            }
            with self.assertRaises(ConsumerVerificationError) as raised:
                self._run_gate(selected, manifest, registry_path)
            self.assertEqual(raised.exception.failure_class, "link-escape")

    def test_consumer_gate_rejects_version_drift(self):
        from consumer_readiness import ConsumerVerificationError, load_runtime_requirements, verify_consumer_view
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps(GOVERNANCE_REGISTRY))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            # 篡改视图内治理工件版本（内容与 manifest hash 由 fixture attach-helper 复制，
            # 需同步改 blob 与 manifest 不可行——直接改视图副本并接受 hash 差异，
            # version 校验先于 leaf digest 前提是 leaf 校验已通过；改为独立调用工件校验器）
            requirements = load_runtime_requirements(registry_path)
            artifact_path = selected / "resource-governance" / "micro-tutoring-resource-projection-v2.json"
            drifted = json.loads(artifact_path.read_text())
            drifted["version"] = "micro-tutoring-resource-projection.v1"
            artifact_path.write_text(json.dumps(drifted, sort_keys=True))
            with self.assertRaises(ConsumerVerificationError) as raised:
                from consumer_readiness import verify_required_artifacts
                verify_required_artifacts(selected, requirements)
            self.assertEqual(raised.exception.failure_class, "version-drift")

    def test_consumer_gate_rejects_reference_drift(self):
        from consumer_readiness import ConsumerVerificationError, load_runtime_requirements, verify_required_artifacts
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps({
                "schemaVersion": "act-runtime-requirements.v1",
                "capabilities": {"micro-tutoring-v2": {"artifacts": [
                    {
                        "path": "resource-governance/micro-tutoring-assessment-baseline-v2.json",
                        "requireVersion": True,
                        "exactVersion": "micro-tutoring-assessment-baseline.v2",
                    },
                    {
                        "path": "resource-governance/micro-tutoring-option-attributions-v2.json",
                        "requireVersion": True,
                        "exactVersion": "micro-tutoring-option-attributions.v3",
                        "references": [
                            {"field": "baselineVersion", "artifact": "resource-governance/micro-tutoring-assessment-baseline-v2.json"},
                        ],
                    },
                ]}},
            }))
            view = root / "view"
            (view / "resource-governance").mkdir(parents=True)
            (view / "resource-governance" / "micro-tutoring-assessment-baseline-v2.json").write_text(json.dumps({
                "version": "micro-tutoring-assessment-baseline.v2",
            }))
            (view / "resource-governance" / "micro-tutoring-option-attributions-v2.json").write_text(json.dumps({
                "version": "micro-tutoring-option-attributions.v3",
                "baselineVersion": "micro-tutoring-assessment-baseline.v0",
            }))
            requirements = load_runtime_requirements(registry_path)
            with self.assertRaises(ConsumerVerificationError) as raised:
                verify_required_artifacts(view, requirements)
            self.assertEqual(raised.exception.failure_class, "reference-drift")

    def test_repair_requires_owned_selection_receipt(self):
        from bootstrap import repair
        from common import DeveloperRuntimeError
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            with self.assertRaises(DeveloperRuntimeError):
                repair(checkout)

    def test_readyz_identity_accepts_legacy_runtime_without_filesystem_and_rejects_not_ready(self):
        manifest, _manifest_path, _receipt_path = write_release(Path(tempfile.mkdtemp()))
        legacy = readyz_payload(manifest)
        legacy["runtime"].pop("filesystem")
        self.assertEqual(parse_readyz_identity(legacy)["releaseId"], manifest["releaseId"])

        not_ready = readyz_payload(manifest)
        not_ready["runtime"]["filesystem"] = {"ready": False, "failureClass": "permission-denied"}
        with self.assertRaises(DeveloperRuntimeError):
            parse_readyz_identity(not_ready)

        invalid = readyz_payload(manifest)
        invalid["runtime"]["filesystem"] = {"ready": False}
        with self.assertRaises(DeveloperRuntimeError):
            parse_readyz_identity(invalid)

    def test_prepare_reuse_reruns_consumer_gate_and_fails_closed_on_broken_view(self):
        """Issue #1713 P1：升级代码后走 selection 复用分支时，不可读/缺工件的旧视图必须被拒绝。"""
        import consumer_readiness
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            checkout = root / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(root / "xdg-config")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(root / "xdg-state")
            os.environ["ACT_RUNTIME_DEV_ALLOW_NON_LINUX"] = "1"
            os.environ["ACT_RUNTIME_DEV_MOUNT_TOPOLOGY"] = "checkout"
            install_credential(checkout, GATEWAY_CREDENTIAL)
            registry_path = root / "requirements.json"
            registry_path.write_text(json.dumps(GOVERNANCE_REGISTRY))
            manifest, manifest_path, receipt_path = write_release_with_governance(root / "release")
            selected = materialize_fixture_view(root / "release", manifest, manifest_path, receipt_path)
            from consumer_readiness import load_runtime_requirements
            runtime_root = checkout / "course-content" / "runtime"
            runtime_root.mkdir(parents=True)
            selection = {
                "schemaVersion": "act-runtime-dev-selection.v1",
                "releaseId": manifest["releaseId"],
                "manifestSha256": manifest["manifestSha256"],
                "treeSha256": manifest["treeSha256"],
                "blobMount": str(root / "release" / "blobs"),
                "helperMount": str(selected / ".act-runtime-blobs"),
                "viewRoot": str(selected),
                "runtimeRoot": str(runtime_root),
                "startedAt": "2026-08-30T00:00:00Z",
            }
            from common import checkout_state
            write_selection_receipt(checkout_state(checkout) / "selection.json", selection)

            def run_prepare():
                with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture"}), \
                        mock.patch("bootstrap.fetch_readyz_identity", return_value={
                            "schemaVersion": "act-runtime-release.v2",
                            "releaseId": manifest["releaseId"],
                            "manifestSha256": manifest["manifestSha256"],
                            "treeSha256": manifest["treeSha256"],
                        }), \
                        mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                        mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                        mock.patch(
                            "bootstrap.load_runtime_requirements",
                            return_value=load_runtime_requirements(registry_path),
                        ):
                    return prepare(checkout)

            reused = run_prepare()
            self.assertEqual(reused["releaseId"], manifest["releaseId"])
            receipt = json.loads((checkout / "course-content" / consumer_readiness.RECEIPT_FILENAME).read_text())
            self.assertEqual(receipt["releaseId"], manifest["releaseId"])
            self.assertEqual(receipt["consumerUid"], os.geteuid())

            projection_sha = manifest["files"][1]["sha256"]
            helper_blob = selected / ".act-runtime-blobs" / projection_sha
            os.chmod(helper_blob, 0o000)
            try:
                with self.assertRaises(DeveloperRuntimeError) as raised:
                    run_prepare()
                self.assertIn("permission-denied", str(raised.exception))
                self.assertFalse(
                    (checkout / "course-content" / consumer_readiness.RECEIPT_FILENAME).exists(),
                )
            finally:
                os.chmod(helper_blob, 0o644)

    def test_repair_refuses_helper_mount_outside_owned_state(self):
        """Issue #1713 P1：陈旧回执的 helperMount 指向他人视图时，repair 必须拒绝卸载。"""
        from bootstrap import repair
        from common import DeveloperRuntimeError
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            foreign = Path(raw) / "other-worktree" / "views" / "runtime-x" / ".act-runtime-blobs"
            foreign.mkdir(parents=True)
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(Path(raw) / "xdg-config")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            install_credential(checkout, GATEWAY_CREDENTIAL)
            from common import checkout_state
            state = checkout_state(checkout)
            write_selection_receipt(state / "selection.json", {
                "schemaVersion": "act-runtime-dev-selection.v1",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
                "blobMount": str(state / "blobs"),
                "helperMount": str(foreign),
                "viewRoot": str(state / "materialized" / "current"),
                "runtimeRoot": str(checkout / "course-content" / "runtime"),
                "startedAt": "2026-08-30T00:00:00Z",
            })
            readiness = {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
            }
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture"}), \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=readiness), \
                    mock.patch("bootstrap.stop_services"):
                with self.assertRaises(DeveloperRuntimeError) as raised:
                    repair(checkout)
            self.assertIn("uncertain ownership", str(raised.exception))
            # 他人视图未被破坏：目录仍然存在
            self.assertTrue(foreign.exists())

    def test_shared_release_rejects_noncanonical_mount_id_even_with_valid_record_and_lease(self):
        """Issue #1713 P1 回归：非规范 sharedMountId 即使 record/lease 其余证据均合法也必须拒绝。"""
        from shared_mount import options_digest, verify_shared_release
        with tempfile.TemporaryDirectory() as raw:
            foreign_mount = "deadbeef00deadbeef00deadbeef"
            state = Path(raw) / "shared" / "mounts" / foreign_mount
            state.mkdir(parents=True)
            (state / "mount.json").write_text(json.dumps({
                "schemaVersion": "act-runtime-dev-shared-mount.v2",
                "identity": authority_identity(GATEWAY_ORIGIN),
                "mountpoint": str(Path(raw) / "shared" / "mounts" / foreign_mount / "blobs"),
                "optionsDigest": options_digest(),
                "principal": GATEWAY_PRINCIPAL,
            }))
            (state / "leases.json").write_text(json.dumps({
                "schemaVersion": "act-runtime-dev-shared-lease.v1",
                "leases": {"checkout-abc": {"releaseId": "runtime-" + ("a" * 55)}},
            }))
            canonical = authority_id(GATEWAY_ORIGIN)
            with mock.patch("shared_mount.read_shared_record", return_value=json.loads(
                (state / "mount.json").read_text(),
            )), mock.patch("shared_mount.read_leases", return_value=json.loads(
                (state / "leases.json").read_text(),
            )), mock.patch("shared_mount.use_real_fuse", return_value=False):
                with self.assertRaises(ValueError) as raised:
                    verify_shared_release(
                        foreign_mount,
                        GATEWAY_ORIGIN,
                        "checkout-abc",
                        "runtime-" + ("a" * 55),
                    )
            self.assertIn("canonical mount", str(raised.exception))
            with mock.patch("shared_mount.read_shared_record", return_value=None):
                with self.assertRaises(ValueError) as raised_canonical:
                    verify_shared_release(
                        canonical,
                        GATEWAY_ORIGIN,
                        "checkout-abc",
                        "runtime-" + ("a" * 55),
                    )
            self.assertIn("record is missing", str(raised_canonical.exception))

    def test_repair_refuses_shared_release_without_proven_identity_and_lease(self):
        """Issue #1713 P1：repair 释放共享 mount 前必须证明 identity 归属与本 checkout lease。"""
        from bootstrap import repair
        from common import DeveloperRuntimeError, authority_id, checkout_state
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(Path(raw) / "xdg-config")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            install_credential(checkout, GATEWAY_CREDENTIAL)
            state = checkout_state(checkout)
            own_mount = authority_id(GATEWAY_ORIGIN)
            runtime_root = checkout / "course-content" / "runtime"
            readiness = {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
            }
            base = {
                "schemaVersion": "act-runtime-dev-selection.v2",
                "releaseId": readiness["releaseId"],
                "manifestSha256": readiness["manifestSha256"],
                "treeSha256": readiness["treeSha256"],
                "blobMount": str(state / "blobs"),
                "helperMount": str(state / "materialized" / "current" / ".act-runtime-blobs"),
                "viewRoot": str(state / "materialized" / "current"),
                "runtimeRoot": str(runtime_root),
                "checkoutId": checkout_id(checkout),
                "sharedMountId": "",
                "topology": "shared",
                "startedAt": "2026-08-30T00:00:00Z",
            }

            def run_repair_with(shared_mount_id, leases):
                selection = {**base, "sharedMountId": shared_mount_id}
                from common import checkout_id as _cid
                del _cid
                write_selection_receipt(state / "selection.json", selection)
                with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture"}), \
                        mock.patch("bootstrap.fetch_readyz_identity", return_value=readiness), \
                        mock.patch("bootstrap.stop_services"), \
                        mock.patch("bootstrap.read_leases", return_value=leases), \
                        mock.patch("bootstrap.release_lease") as released:
                    with self.assertRaises(DeveloperRuntimeError) as raised:
                        repair(checkout)
                self.assertIn("refused", str(raised.exception))
                released.assert_not_called()

            # 场景 1：sharedMountId 指向其他 credential 的共享 mount
            run_repair_with(authority_id("https://other-gateway.example"), {"schemaVersion": "act-runtime-dev-shared-lease.v1", "leases": {}})
            # 场景 2：identity 正确但无本 checkout 的 live lease（空/仅 stale 记录）
            run_repair_with(own_mount, {"schemaVersion": "act-runtime-dev-shared-lease.v1", "leases": {}})
            # 场景 3：lease 存在但绑定不同 Release
            run_repair_with(own_mount, {
                "schemaVersion": "act-runtime-dev-shared-lease.v1",
                "leases": {checkout_id(checkout): {"releaseId": "runtime-" + ("f" * 55)}},
            })

    def test_repair_refuses_drifted_shared_mount_record(self):
        """Issue #1713 P1：identity 与 lease 均匹配但共享 mount.json 记录漂移时，release 前必须拒绝。"""
        from bootstrap import repair
        from common import DeveloperRuntimeError, authority_id, authority_identity, checkout_id, checkout_state
        from shared_mount import options_digest
        with tempfile.TemporaryDirectory() as raw:
            checkout = Path(raw) / "repo"
            checkout.mkdir()
            os.environ["ACT_RUNTIME_DEV_CONFIG_HOME"] = str(Path(raw) / "xdg-config")
            os.environ["ACT_RUNTIME_DEV_STATE_HOME"] = str(Path(raw) / "xdg-state")
            install_credential(checkout, GATEWAY_CREDENTIAL)
            state = checkout_state(checkout)
            own_mount = authority_id(GATEWAY_ORIGIN)
            readiness = {
                "schemaVersion": "act-runtime-release.v2",
                "releaseId": "runtime-" + ("a" * 55),
                "manifestSha256": "b" * 64,
                "treeSha256": "c" * 64,
            }
            write_selection_receipt(state / "selection.json", {
                "schemaVersion": "act-runtime-dev-selection.v2",
                "releaseId": readiness["releaseId"],
                "manifestSha256": readiness["manifestSha256"],
                "treeSha256": readiness["treeSha256"],
                "blobMount": str(state / "blobs"),
                "helperMount": str(state / "materialized" / "current" / ".act-runtime-blobs"),
                "viewRoot": str(state / "materialized" / "current"),
                "runtimeRoot": str(checkout / "course-content" / "runtime"),
                "checkoutId": checkout_id(checkout),
                "sharedMountId": own_mount,
                "topology": "shared",
                "startedAt": "2026-08-30T00:00:00Z",
            })
            # identity/options/principal 全部合法，仅 mountpoint 漂移到未知挂载——
            # 专测 mountpoint 校验（verify_shared_identity 不覆盖该字段）。
            drifted_record = {
                "schemaVersion": "act-runtime-dev-shared-mount.v2",
                "identity": authority_identity(GATEWAY_ORIGIN),
                "mountpoint": str(Path(raw) / "somewhere-else" / "blobs"),
                "optionsDigest": options_digest(),
                "principal": GATEWAY_PRINCIPAL,
            }
            with mock.patch("bootstrap.linux_preflight", return_value={"architecture": "fixture", "fuse": "fixture"}), \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=readiness), \
                    mock.patch("bootstrap.stop_services"), \
                    mock.patch("bootstrap.read_leases", return_value={
                        "schemaVersion": "act-runtime-dev-shared-lease.v1",
                        "leases": {checkout_id(checkout): {"releaseId": readiness["releaseId"]}},
                    }), \
                    mock.patch("shared_mount.read_shared_record", return_value=drifted_record), \
                    mock.patch("bootstrap.release_lease") as released:
                with self.assertRaises(DeveloperRuntimeError):
                    repair(checkout)
            released.assert_not_called()

    def test_mount_process_provenance_requires_exact_gateway_session_binding(self):
        """活数据面归属 = 持有 mountinfo 报告的 fuse fd + Python 解释器 exe
        + argv 精确绑定 gateway_fuse.py / --session / --mount。ossfs2 持有同一
        connection 必须失败关闭。"""
        from shared_mount import verify_mount_process_provenance
        with tempfile.TemporaryDirectory() as raw:
            mountpoint = Path(raw) / "shared" / "mount-1" / "blobs"
            session = Path(raw) / "shared" / "mount-1" / "gateway-session.json"
            helper = Path(raw) / "gateway_fuse.py"
            helper.write_text("#!/usr/bin/env python3\n")
            fake_ossfs2 = Path(raw) / "bin" / "ossfs2"
            fake_ossfs2.parent.mkdir(parents=True)
            fake_ossfs2.write_text("#!/bin/sh\n")
            fake_python = Path(raw) / "bin" / "python3"
            fake_python.write_text("#!/bin/sh\n")
            argv_ok = (str(helper), "--mount", str(mountpoint), "--session", str(session), "--cache-dir", "/tmp/cache")

            def proc_root_with(*entries, with_fuse_fd=None) -> str:
                root = Path(tempfile.mkdtemp(dir=raw))
                for pid, exe_target, cmdline in entries:
                    proc = root / str(pid)
                    proc.mkdir()
                    os.symlink(str(exe_target), str(proc / "exe"))
                    (proc / "cmdline").write_bytes(b"\x00".join(arg.encode() for arg in cmdline) + b"\x00")
                    if with_fuse_fd is not None:
                        (proc / "fd").mkdir()
                        os.symlink("/dev/fuse", str(proc / "fd" / str(with_fuse_fd)))
                return str(root)

            def entry(exe_target, *argv):
                return (100, exe_target, argv)

            good = proc_root_with(
                entry(fake_python, str(fake_python), *argv_ok),
                with_fuse_fd=3,
            )
            verify_mount_process_provenance(mountpoint, session, proc_root=good, fuse_fd=3)

            ossfs_owner = proc_root_with(
                entry(fake_ossfs2, "/usr/local/bin/ossfs2", "-c", "/tmp/ossfs.conf", str(mountpoint)),
                with_fuse_fd=3,
            )
            with self.assertRaises(ValueError) as raised_ossfs:
                verify_mount_process_provenance(mountpoint, session, proc_root=ossfs_owner, fuse_fd=3)
            self.assertIn("ossfs2", str(raised_ossfs.exception))

            argv0_spoof = proc_root_with(
                entry(fake_python, "ossfs2", "-c", str(session), str(mountpoint)),
                with_fuse_fd=3,
            )
            with self.assertRaises(ValueError):
                verify_mount_process_provenance(mountpoint, session, proc_root=argv0_spoof, fuse_fd=3)

            no_fd = proc_root_with(
                entry(fake_python, str(fake_python), *argv_ok),
            )
            with self.assertRaises(ValueError):
                verify_mount_process_provenance(mountpoint, session, proc_root=no_fd, fuse_fd=3)

            session_prefix = proc_root_with(
                entry(fake_python, str(fake_python), str(helper), "--mount", str(mountpoint), "--session", str(session) + ".bak", "--cache-dir", "/tmp/cache"),
                with_fuse_fd=3,
            )
            with self.assertRaises(ValueError):
                verify_mount_process_provenance(mountpoint, session, proc_root=session_prefix, fuse_fd=3)

            point_prefix = proc_root_with(
                entry(fake_python, str(fake_python), str(helper), "--mount", str(mountpoint) + "-other", "--session", str(session), "--cache-dir", "/tmp/cache"),
                with_fuse_fd=3,
            )
            with self.assertRaises(ValueError):
                verify_mount_process_provenance(mountpoint, session, proc_root=point_prefix, fuse_fd=3)

            other_point = proc_root_with(
                entry(fake_python, str(fake_python), str(helper), "--mount", "/elsewhere/blobs", "--session", str(session), "--cache-dir", "/tmp/cache"),
                with_fuse_fd=3,
            )
            with self.assertRaises(ValueError):
                verify_mount_process_provenance(mountpoint, session, proc_root=other_point, fuse_fd=3)


if __name__ == "__main__":
    unittest.main()
