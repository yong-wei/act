#!/usr/bin/env python3
from __future__ import annotations

import hashlib
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
    mount_fields,
    parse_readyz_identity,
    prepare,
    stop,
    unmount,
    verify_release_documents,
    write_selection_receipt,
)
from common import DeveloperRuntimeError, redact  # noqa: E402
from credential import assert_developer_principal, install_credential, parse_credential  # noqa: E402
from policy import load_and_validate, validate_policy  # noqa: E402


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
                install_credential(checkout, {
                    "schemaVersion": "act-runtime-dev-read-credential.v1",
                    "accountId": "123456789012",
                    "accessKeyId": "LTAIexamplekeyid01",
                    "accessKeySecret": "super-secret-value-1234",
                    "region": "cn-hangzhou",
                })
            with self.assertRaises(ValueError):
                parse_credential({
                    "schemaVersion": "act-runtime-dev-read-credential.v1",
                    "accountId": "123456789012",
                    "accessKeyId": "LTAIexamplekeyid01",
                    "accessKeySecret": "super-secret-value-1234",
                    "region": "cn-hangzhou",
                    "extra": "nope",
                })
            message = redact("accessKeySecret=super-secret-value-1234 LTAIexamplekeyid01")
            self.assertNotIn("super-secret-value-1234", message)
            self.assertNotIn("LTAIexamplekeyid01", message)

    def test_publisher_principal_is_rejected(self):
        credential = {
            "schemaVersion": "act-runtime-dev-read-credential.v1",
            "accountId": "123456789012",
            "accessKeyId": "LTAIexamplekeyid01",
            "accessKeySecret": "super-secret-value-1234",
            "region": "cn-hangzhou",
        }
        with self.assertRaises(DeveloperRuntimeError):
            assert_developer_principal({
                "AccountId": "123456789012",
                "Arn": "acs:ram::123456789012:user/act-runtime-publisher-local",
                "UserId": "1",
            }, credential)
        with self.assertRaises(DeveloperRuntimeError):
            assert_developer_principal({
                "AccountId": "123456789012",
                "Arn": "acs:ram::123456789012:role/act-runtime-oss-read",
                "UserId": "1",
            }, credential)
        assert_developer_principal({
            "AccountId": "123456789012",
            "Arn": "acs:ram::123456789012:user/act-runtime-dev-read",
            "UserId": "1",
        }, credential)

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
            install_credential(checkout, {
                "schemaVersion": "act-runtime-dev-read-credential.v1",
                "accountId": "123456789012",
                "accessKeyId": "LTAIexamplekeyid01",
                "accessKeySecret": "super-secret-value-1234",
                "region": "cn-hangzhou",
            })
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
                    mock.patch("bootstrap.caller_identity", return_value=identity), \
                    mock.patch("bootstrap.fetch_readyz_identity", return_value=payload["runtime"]["identity"]), \
                    mock.patch("bootstrap.is_fuse_readonly", return_value=True), \
                    mock.patch("bootstrap.is_readonly_mount", return_value=True), \
                    mock.patch("bootstrap.fetch_release_documents") as fetch, \
                    mock.patch("bootstrap.mount_blobs") as mount_blobs, \
                    mock.patch("bootstrap.materialize_view") as materialize, \
                    mock.patch("bootstrap.bind_runtime") as bind:
                from common import checkout_state
                write_selection_receipt(checkout_state(checkout) / "selection.json", selection)
                reused = prepare(checkout)
                self.assertEqual(reused["releaseId"], manifest["releaseId"])
                fetch.assert_not_called()
                mount_blobs.assert_not_called()
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
        self.assertIn("act-runtime-dev-mount", source)
        self.assertNotIn('privileged(["true"])', source)
        self.assertNotIn("NOPASSWD: /usr/bin/mount, /usr/bin/umount", source)

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

            with mock.patch("bootstrap.mount_fields", side_effect=[("ext4", "ro"), ("", "")]):
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


if __name__ == "__main__":
    unittest.main()
