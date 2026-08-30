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
    linux_preflight,
    mount_fields,
    parse_readyz_identity,
    prepare,
    refuse_public_oss_data_plane,
    start,
    stop,
    unmount,
    verify_release_documents,
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
from common import DeveloperRuntimeError, authority_id, checkout_id, redact  # noqa: E402
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
        verify_release_documents(identity, manifest_path, receipt_path)
        identity["manifestSha256"] = "f" * 64
        with self.assertRaises(Exception):
            verify_release_documents(identity, manifest_path, receipt_path)

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
            identity = {
                "AccountId": "123456789012",
                "Arn": "acs:ram::123456789012:user/act-runtime-dev-read",
                "UserId": "1",
            }
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
                    mock.patch("bootstrap.fetch_release_documents") as fetch, \
                    mock.patch("bootstrap.materialize_view") as materialize, \
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
        script = ROOT / "scripts/runtime-release/materialize-runtime-blob-release.py"
        subprocess.run([sys.executable, str(script), "prepare", "--manifest", str(manifest_path), "--receipt", str(receipt_path), "--blob-root", str(blob_root), "--view-root", str(view_root)], check=True, capture_output=True)
        view = view_root / "views" / manifest["releaseId"]
        for candidate in sorted(view.rglob("*"), key=lambda path: len(path.parts), reverse=True):
            if candidate.is_dir() and not candidate.is_symlink():
                os.chmod(candidate, 0o755)
        os.chmod(view, 0o755)
        for command in (
            [sys.executable, str(script), "attach-helper", "--release-id", manifest["releaseId"], "--view-root", str(view_root), "--blob-root", str(blob_root), "--test-fixture"],
            [sys.executable, str(script), "verify", "--release-id", manifest["releaseId"], "--view-root", str(view_root)],
            [sys.executable, str(script), "select", "--release-id", manifest["releaseId"], "--view-root", str(view_root)],
        ):
            subprocess.run(command, check=True, capture_output=True)
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
                mock.patch("bootstrap.fetch_release_documents", return_value=documents), \
                mock.patch("bootstrap.verify_release_documents", return_value=manifest), \
                mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
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
                    mock.patch("bootstrap.fetch_release_documents", return_value=(manifest_path, receipt_path)), \
                    mock.patch("bootstrap.verify_release_documents", return_value=manifest), \
                    mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
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
                    mock.patch("bootstrap.fetch_release_documents", return_value=(manifest_path, receipt_path)), \
                    mock.patch("bootstrap.verify_release_documents", return_value=manifest), \
                    mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
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
                        mock.patch("bootstrap.fetch_release_documents", return_value=(manifest_path, receipt_path)), \
                        mock.patch("bootstrap.verify_release_documents", return_value=manifest), \
                        mock.patch("bootstrap.materialize_view", return_value=checkout / "helper"), \
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
                    mock.patch("bootstrap.fetch_release_documents") as fetch, \
                    mock.patch("bootstrap.materialize_view") as materialize, \
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
                    mock.patch("bootstrap.fetch_release_documents") as fetch, \
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


if __name__ == "__main__":
    unittest.main()
