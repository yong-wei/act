import json
import hashlib
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/runtime-release-host-state.py"
MATERIALIZER = ROOT / "scripts/runtime-release/materialize-runtime-blob-release.py"
LOCAL_RECEIPT = ".act-runtime-release-materialization.v1.json"
HELPER_NAME = ".act-runtime-blobs"
TEXTBOOK_CACHE_PATHS = (
    "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8",
    "resources/textbook-hybrid-retrieval/bge-m3/lexical-postings.bin",
    "resources/textbook-hybrid-retrieval/bge-m3/vectors.f32",
)
TEXTBOOK_CACHE_CONTENTS = {
    "lessons/1-1/lesson.json": b'{"lesson":"1-1"}\n',
    "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8": b"body-one\n",
    "resources/textbook-hybrid-retrieval/bge-m3/lexical-postings.bin": b"postings\n",
    "resources/textbook-hybrid-retrieval/bge-m3/vectors.f32": b"vector\n",
}


class RuntimeReleaseHostStateTests(unittest.TestCase):
    def call(self, *args: str, expect_ok: bool = True):
        result = subprocess.run(["python3", str(SCRIPT), *args], text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def call_materializer(self, *args: str, expect_ok: bool = True):
        result = subprocess.run(["python3", str(MATERIALIZER), *args], text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def receipt(self, root: Path, release_id: str, digest: str):
        path = root / f"{release_id}.json"
        path.write_text(json.dumps({
            "schemaVersion": "runtime-release-verification.v1",
            "releaseId": release_id,
            "manifestSha256": digest,
            "treeSha256": "b" * 64,
        }), encoding="utf-8")
        return path

    def v2_release(self, root: Path, contents, cache_textbook_retrieval: bool = False):
        blob_root = root / "blob-root"
        blob_root.mkdir(parents=True)
        files = []
        for relative, body in sorted(contents.items()):
            file_sha = hashlib.sha256(body).hexdigest()
            (blob_root / file_sha).write_bytes(body)
            files.append({
                "path": relative,
                "objectKey": "runtime/blobs/sha256/" + file_sha,
                "sizeBytes": len(body),
                "sha256": file_sha,
            })
        tree = hashlib.sha256(json.dumps(
            [{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files],
            separators=(",", ":"), sort_keys=True, ensure_ascii=False,
        ).encode("utf-8")).hexdigest()
        source_revision = "a" * 40
        release_id = "runtime-" + hashlib.sha256(json.dumps(
            {"sourceRevision": source_revision, "treeSha256": tree},
            separators=(",", ":"), sort_keys=True, ensure_ascii=False,
        ).encode("utf-8")).hexdigest()[:55]
        manifest = {
            "schemaVersion": "act-runtime-release.v2",
            "releaseId": release_id,
            "sourceRevision": source_revision,
            "fileCount": len(files),
            "totalBytes": sum(item["sizeBytes"] for item in files),
            "treeSha256": tree,
            "files": files,
        }
        manifest["manifestSha256"] = hashlib.sha256(json.dumps(
            manifest, separators=(",", ":"), sort_keys=True, ensure_ascii=False,
        ).encode("utf-8")).hexdigest()
        manifest_wire = json.dumps(manifest, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n"
        manifest_path = root / "manifest.json"
        manifest_path.write_bytes(manifest_wire)
        release_receipt = root / "release-receipt.json"
        release_payload = {
            "schemaVersion": "act-runtime-release-receipt.v2",
            "releaseId": release_id,
            "manifestVersion": "act-runtime-release.v2",
            "manifestObjectKey": "runtime/blob-releases/%s/manifest.json" % release_id,
            "manifestSha256": manifest["manifestSha256"],
            "manifestWireSha256": hashlib.sha256(manifest_wire).hexdigest(),
            "manifestWireSizeBytes": len(manifest_wire),
            "treeSha256": tree,
            "fileCount": manifest["fileCount"],
            "totalBytes": manifest["totalBytes"],
            "blobs": sorted({
                (item["objectKey"], item["sizeBytes"], item["sha256"])
                for item in files
            }),
        }
        release_payload["blobs"] = [
            {"objectKey": key, "sizeBytes": size, "sha256": file_sha}
            for key, size, file_sha in release_payload["blobs"]
        ]
        release_payload["receiptSha256"] = hashlib.sha256(json.dumps(
            release_payload, separators=(",", ":"), sort_keys=True, ensure_ascii=False,
        ).encode("utf-8")).hexdigest()
        release_receipt.write_bytes(json.dumps(release_payload, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n")
        verification_receipt = root / "verification-receipt.json"
        verification_receipt.write_bytes(json.dumps({
            "schemaVersion": "runtime-release-verification.v2",
            "releaseId": release_id,
            "manifestObjectKey": "runtime/blob-releases/%s/manifest.json" % release_id,
            "manifestSha256": manifest["manifestSha256"],
            "wireSha256": hashlib.sha256(manifest_wire).hexdigest(),
            "wireSizeBytes": len(manifest_wire),
            "treeSha256": tree,
            "fileCount": manifest["fileCount"],
            "totalBytes": manifest["totalBytes"],
        }, separators=(",", ":"), sort_keys=True).encode("utf-8") + b"\n")
        view_root = root / "view-root"
        prepare_args = [
            "prepare", "--manifest", str(manifest_path), "--receipt", str(release_receipt),
            "--blob-root", str(blob_root), "--view-root", str(view_root),
        ]
        if cache_textbook_retrieval:
            prepare_args.append("--cache-textbook-retrieval")
        self.call_materializer(*prepare_args)
        view = view_root / "views" / release_id
        self.call_materializer(
            "attach-helper",
            "--view-root", str(view_root),
            "--release-id", release_id,
            "--blob-root", str(blob_root),
            "--test-fixture",
        )
        return {
            "blob_root": blob_root,
            "view": view,
            "helper": view / HELPER_NAME,
            "release_id": release_id,
            "release_receipt": release_receipt,
            "verification_receipt": verification_receipt,
            "manifest_path": manifest_path,
        }

    def make_view_writable(self, view: Path):
        for candidate in sorted(view.rglob("*"), key=lambda path: len(path.parts), reverse=True):
            if candidate.is_dir() and not candidate.is_symlink():
                os.chmod(candidate, 0o755)
        os.chmod(view, 0o755)

    def test_fenced_selection_and_failed_candidate_preserve_active_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            a_receipt = self.receipt(root, "runtime-a", "a" * 64)
            b_receipt = self.receipt(root, "runtime-b", "c" * 64)
            first = self.call("select", "--state-dir", str(state), "--expected-active-release", "none", "--verification-receipt", str(a_receipt))
            self.assertEqual(first["generation"], 1)
            self.call("mark-active", "--state-dir", str(state), "--release-id", "runtime-a")
            self.call("select", "--state-dir", str(state), "--expected-active-release", "runtime-a", "--verification-receipt", str(b_receipt))
            active = self.call("active", "--state-dir", str(state))
            self.assertEqual(active["activeReleaseId"], "runtime-a")
            self.assertEqual(active["selection"]["manifestSha256"], "a" * 64)
            rollback = self.call("select", "--state-dir", str(state), "--expected-active-release", "runtime-a", "--verification-receipt", str(a_receipt))
            self.assertEqual(rollback["generation"], 3)
            stale = self.call("select", "--state-dir", str(state), "--expected-active-release", "runtime-b", "--verification-receipt", str(a_receipt), expect_ok=False)
            self.assertIn("expected active release", stale.stderr)

    def test_rejects_symlinked_state_and_mismatched_active_mark(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            receipt = self.receipt(root, "runtime-a", "a" * 64)
            self.call("select", "--state-dir", str(state), "--expected-active-release", "none", "--verification-receipt", str(receipt))
            mismatch = self.call("mark-active", "--state-dir", str(state), "--release-id", "runtime-b", expect_ok=False)
            self.assertIn("does not match desired selection", mismatch.stderr)
            (state / "act-runtime-active-receipt.json").symlink_to(root / "missing.json")
            invalid = self.call("active", "--state-dir", str(state), expect_ok=False)
            self.assertIn("must not be a symlink", invalid.stderr)

    def test_records_complete_deployment_proof_with_active_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            receipt = self.receipt(root, "runtime-a", "a" * 64)
            self.call("select", "--state-dir", str(state), "--expected-active-release", "none", "--verification-receipt", str(receipt))
            self.call(
                "mark-active", "--state-dir", str(state), "--release-id", "runtime-a",
                "--app-revision", "c" * 40,
                "--image-digest", "sha256:" + "d" * 64,
                "--release-locator-sha256", "e" * 64,
            )
            active = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(active["deployment"]["appRevision"], "c" * 40)
            self.assertEqual(active["deployment"]["imageDigest"], "sha256:" + "d" * 64)
            incomplete = self.call(
                "mark-active", "--state-dir", str(state), "--release-id", "runtime-a",
                "--app-revision", "c" * 40,
                expect_ok=False,
            )
            self.assertIn("deployment proof is incomplete", incomplete.stderr)

    def test_active_receipt_is_world_readable_for_container_bind(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            receipt = self.receipt(root, "runtime-a", "a" * 64)
            self.call("select", "--state-dir", str(state), "--expected-active-release", "none", "--verification-receipt", str(receipt))
            self.assertEqual(os.stat(state / "act-runtime-selection.json").st_mode & 0o777, 0o600)
            self.call("mark-active", "--state-dir", str(state), "--release-id", "runtime-a")
            self.assertEqual(os.stat(state / "act-runtime-active-receipt.json").st_mode & 0o777, 0o644)
            self.assertEqual(os.stat(state / "act-runtime-selection.json").st_mode & 0o777, 0o600)

    def test_verifies_mounted_file_set_and_representative_content_against_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            runtime.mkdir()
            (runtime / "课程.json").write_text('{"id":"1-1"}\n', encoding="utf-8")
            body = (runtime / "课程.json").read_bytes()
            file_digest = hashlib.sha256(body).hexdigest()
            files = [{
                "path": "课程.json",
                "objectKey": "runtime/releases/runtime-a/课程.json",
                "sizeBytes": len(body),
                "sha256": file_digest,
            }]
            tree = hashlib.sha256(json.dumps([{"path": "课程.json", "sizeBytes": len(body), "sha256": file_digest}], separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
            manifest = {
                "schemaVersion": "act-runtime-release.v1",
                "releaseId": "runtime-a",
                "sourceRevision": "a" * 40,
                "fileCount": 1,
                "totalBytes": len(body),
                "treeSha256": tree,
                "files": files,
            }
            manifest["manifestSha256"] = hashlib.sha256(json.dumps(manifest, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
            (runtime / ".act-runtime-release.v1.json").write_text(json.dumps(manifest), encoding="utf-8")
            receipt = self.receipt(root, "runtime-a", manifest["manifestSha256"])
            receipt_value = json.loads(receipt.read_text(encoding="utf-8"))
            receipt_value["treeSha256"] = tree
            receipt.write_text(json.dumps(receipt_value), encoding="utf-8")
            verified = self.call("verify-mounted", "--runtime-root", str(runtime), "--release-id", "runtime-a", "--verification-receipt", str(receipt))
            self.assertEqual(verified["fileCount"], 1)
            self.assertEqual(verified["representativeSampleCount"], 1)
            (runtime / "unexpected.txt").write_text("unexpected", encoding="utf-8")
            rejected = self.call("verify-mounted", "--runtime-root", str(runtime), "--release-id", "runtime-a", "--verification-receipt", str(receipt), expect_ok=False)
            self.assertIn("file set differs", rejected.stderr)

    def test_v1_mounted_symlink_remains_rejected_by_default(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            runtime.mkdir()
            body = b"v1\n"
            logical = runtime / "lesson.json"
            logical.write_bytes(body)
            file_digest = hashlib.sha256(body).hexdigest()
            tree = hashlib.sha256(json.dumps(
                [{"path": "lesson.json", "sizeBytes": len(body), "sha256": file_digest}],
                separators=(",", ":"), sort_keys=True,
            ).encode("utf-8")).hexdigest()
            manifest = {
                "schemaVersion": "act-runtime-release.v1",
                "releaseId": "runtime-a",
                "sourceRevision": "a" * 40,
                "fileCount": 1,
                "totalBytes": len(body),
                "treeSha256": tree,
                "files": [{
                    "path": "lesson.json",
                    "objectKey": "runtime/releases/runtime-a/lesson.json",
                    "sizeBytes": len(body),
                    "sha256": file_digest,
                }],
            }
            manifest["manifestSha256"] = hashlib.sha256(json.dumps(
                manifest, separators=(",", ":"), sort_keys=True,
            ).encode("utf-8")).hexdigest()
            (runtime / ".act-runtime-release.v1.json").write_text(json.dumps(manifest), encoding="utf-8")
            receipt = self.receipt(root, "runtime-a", manifest["manifestSha256"])
            receipt_value = json.loads(receipt.read_text(encoding="utf-8"))
            receipt_value["treeSha256"] = tree
            receipt.write_text(json.dumps(receipt_value), encoding="utf-8")
            root_link = root / "runtime-link"
            root_link.symlink_to(runtime, target_is_directory=True)
            rejected_root = self.call(
                "verify-mounted", "--runtime-root", str(root_link), "--release-id", "runtime-a",
                "--verification-receipt", str(receipt), expect_ok=False,
            )
            self.assertIn("mounted runtime root is invalid", rejected_root.stderr)
            outside = root / "outside.txt"
            outside.write_bytes(body)
            logical.unlink()
            logical.symlink_to(outside)
            rejected = self.call(
                "verify-mounted", "--runtime-root", str(runtime), "--release-id", "runtime-a",
                "--verification-receipt", str(receipt), expect_ok=False,
            )
            self.assertIn("non-regular file", rejected.stderr)

    def test_v2_accepts_duplicate_blob_symlink_view_and_release_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {
                "lessons/1-1/lesson.json": b"duplicate\n",
                "lessons/1-1/media/copy.json": b"duplicate\n",
            })
            self.assertTrue((fixture["view"] / "lessons/1-1/lesson.json").is_symlink())
            self.assertEqual(
                os.path.realpath(fixture["view"] / "lessons/1-1/lesson.json"),
                os.path.realpath(fixture["view"] / "lessons/1-1/media/copy.json"),
            )
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
            )
            self.assertEqual(verified["releaseId"], fixture["release_id"])
            self.assertEqual(verified["fileCount"], 2)
            self.assertGreater(verified["wireSizeBytes"], 0)
            helper_verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--blob-root", str(fixture["helper"]), "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
            )
            self.assertEqual(helper_verified["treeSha256"], verified["treeSha256"])
            release_verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["release_receipt"]),
            )
            self.assertEqual(release_verified["treeSha256"], verified["treeSha256"])
            external = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--blob-root", str(fixture["blob_root"]), "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
                expect_ok=False,
            )
            self.assertIn("helper root", external.stderr)

    def test_v2_rejects_missing_helper_targets_and_ignores_helper_namespace_files(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {"lessons/1-1/lesson.json": b"ok\n"})
            self.make_view_writable(fixture["view"])
            extra = fixture["helper"] / ("f" * 64)
            extra.write_bytes(b"not-a-manifest-blob\n")
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
            )
            self.assertEqual(verified["fileCount"], 1)
            for child in fixture["helper"].iterdir():
                if child.name != extra.name:
                    child.unlink()
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
                expect_ok=False,
            )
            self.assertTrue(
                "helper target is missing" in rejected.stderr
                or "blob must be a regular" in rejected.stderr
            )

    def test_v2_mounted_verification_reads_changed_paths_and_representative_samples_only(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent_root = root / "parent"
            candidate_root = root / "candidate"
            parent_root.mkdir()
            candidate_root.mkdir()
            parent = self.v2_release(parent_root, {
                "lessons/1-1/a.json": b"a\n",
                "lessons/1-1/b.json": b"b\n",
                "lessons/1-1/c.json": b"c\n",
                "lessons/1-1/d.json": b"d\n",
                "lessons/1-1/e.json": b"e\n",
            })
            candidate = self.v2_release(candidate_root, {
                "lessons/1-1/a.json": b"a\n",
                "lessons/1-1/b.json": b"changed\n",
                "lessons/1-1/c.json": b"c\n",
                "lessons/1-1/d.json": b"d\n",
                "lessons/1-1/e.json": b"e\n",
            })
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(candidate["view"]),
                "--parent-runtime-root", str(parent["view"]),
                "--release-id", candidate["release_id"],
                "--verification-receipt", str(candidate["verification_receipt"]),
            )
            self.assertEqual(verified["inheritedPathCount"], 4)
            self.assertEqual(verified["changedPathCount"], 1)
            self.assertEqual(verified["changedBodyReadCount"], 1)
            self.assertEqual(verified["representativeSampleCount"], 3)
            self.assertEqual(verified["helperLookupCount"], 4)

    def test_v2_verification_receipt_can_fence_host_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {"lessons/1-1/lesson.json": b"ok\n"})
            selection = self.call(
                "select", "--state-dir", str(Path(directory) / "state"),
                "--expected-active-release", "none",
                "--verification-receipt", str(fixture["verification_receipt"]),
            )
            self.assertEqual(selection["releaseId"], fixture["release_id"])

    def test_v2_rejects_blob_escape_and_directory_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {"lessons/1-1/lesson.json": b"ok\n"})
            self.make_view_writable(fixture["view"])
            logical = fixture["view"] / "lessons/1-1/lesson.json"
            outside = Path(directory) / "outside.txt"
            outside.write_bytes(b"ok\n")
            logical.unlink()
            logical.symlink_to(outside)
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("relative helper-root link", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {"lessons/1-1/lesson.json": b"ok\n"})
            self.make_view_writable(fixture["view"])
            lesson_dir = fixture["view"] / "lessons/1-1"
            (lesson_dir / "lesson.json").unlink()
            lesson_dir.rmdir()
            lesson_dir.symlink_to(Path(directory) / "outside-dir", target_is_directory=True)
            (Path(directory) / "outside-dir").mkdir()
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertTrue("symlinked directory" in rejected.stderr or "file set differs" in rejected.stderr)

    def test_v2_rejects_extra_file_and_mismatched_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {"lesson.json": b"ok\n"})
            self.make_view_writable(fixture["view"])
            (fixture["view"] / "extra.txt").write_text("extra", encoding="utf-8")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("non-symlink logical file", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), {"lesson.json": b"ok\n"})
            damaged = json.loads(fixture["verification_receipt"].read_text(encoding="utf-8"))
            damaged["manifestSha256"] = "f" * 64
            fixture["verification_receipt"].write_text(json.dumps(damaged), encoding="utf-8")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("identity does not match", rejected.stderr)

    def test_v2_accepts_textbook_retrieval_hot_cache_view(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            for relative in TEXTBOOK_CACHE_PATHS:
                logical = fixture["view"] / relative
                self.assertFalse(logical.is_symlink(), relative)
                self.assertTrue(logical.is_file(), relative)
            self.assertTrue((fixture["view"] / "lessons/1-1/lesson.json").is_symlink())
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
            )
            self.assertEqual(verified["releaseId"], fixture["release_id"])
            self.assertEqual(verified["fileCount"], 4)
            local_receipt = fixture["view"] / LOCAL_RECEIPT
            receipt_verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(local_receipt),
            )
            self.assertEqual(receipt_verified["treeSha256"], verified["treeSha256"])

    def test_v2_rejects_regular_textbook_file_when_cache_disabled(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS)
            self.assertTrue((fixture["view"] / TEXTBOOK_CACHE_PATHS[0]).is_symlink())
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]),
            )
            self.assertEqual(verified["fileCount"], 4)
            self.make_view_writable(fixture["view"])
            cached = fixture["view"] / TEXTBOOK_CACHE_PATHS[2]
            target = (cached.parent / os.readlink(cached)).resolve()
            cached.unlink()
            cached.write_bytes(target.read_bytes())
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("non-symlink logical file", rejected.stderr)

    def test_v2_rejects_altered_textbook_cache_file(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(fixture["view"])
            cached = fixture["view"] / TEXTBOOK_CACHE_PATHS[2]
            os.chmod(cached, 0o644)
            cached.write_bytes(b"tampered-vector\n")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("does not match manifest content", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(fixture["view"])
            cached = fixture["view"] / TEXTBOOK_CACHE_PATHS[0]
            body = TEXTBOOK_CACHE_CONTENTS[TEXTBOOK_CACHE_PATHS[0]]
            cached.unlink()
            cached.symlink_to(fixture["blob_root"] / hashlib.sha256(body).hexdigest())
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("declared cache entry is not a regular file", rejected.stderr)

    def test_v2_rejects_textbook_cache_receipt_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(fixture["view"])
            wire = fixture["manifest_path"].read_bytes()
            manifest = json.loads(wire.decode("utf-8"))
            base = {
                "schemaVersion": "runtime-blob-materialization.v1",
                "releaseId": manifest["releaseId"],
                "manifestVersion": "act-runtime-release.v2",
                "manifestSha256": manifest["manifestSha256"],
                "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
                "treeSha256": manifest["treeSha256"],
                "fileCount": manifest["fileCount"],
                "totalBytes": manifest["totalBytes"],
            }
            no_cache = dict(base, materializationSha256=hashlib.sha256(json.dumps(
                base, separators=(",", ":"), sort_keys=True, ensure_ascii=False,
            ).encode("utf-8")).hexdigest())
            mismatched = Path(directory) / "no-cache-materialization.json"
            mismatched.write_bytes(json.dumps(no_cache, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(mismatched), expect_ok=False,
            )
            self.assertIn("does not match the mounted view", rejected.stderr)

            receipt_path = fixture["view"] / LOCAL_RECEIPT
            os.chmod(receipt_path, 0o644)
            receipt_path.write_bytes(json.dumps(no_cache, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n")
            rejected_view = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("non-symlink logical file", rejected_view.stderr)

    def test_v2_rejects_arbitrary_regular_file_with_textbook_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(fixture["view"])
            (fixture["view"] / "resources/textbook-hybrid-retrieval/bge-m3/extra.bin").write_bytes(b"extra\n")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("non-symlink logical file", rejected.stderr)

    def test_restore_overlays_keeps_candidate_textbook_cache(self):
        overlay_path = "knowledge/projection/current.json"
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent = self.v2_release(root / "parent", {
                **TEXTBOOK_CACHE_CONTENTS,
                "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8": b"old-body\n",
            }, cache_textbook_retrieval=True)
            candidate = self.v2_release(root / "candidate", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(parent["view"])
            overlay = parent["view"] / overlay_path
            overlay.parent.mkdir(parents=True, exist_ok=True)
            overlay.write_text('{"selector":"v0.18"}\n', encoding="utf-8")
            restored = self.call(
                "restore-overlays",
                "--parent-runtime-root", str(parent["view"]),
                "--candidate-runtime-root", str(candidate["view"]),
            )
            self.assertEqual(restored["copied"], [overlay_path])
            self.assertIn(TEXTBOOK_CACHE_PATHS[0], restored["skipped"])
            self.assertEqual(
                (candidate["view"] / overlay_path).read_text(encoding="utf-8"),
                '{"selector":"v0.18"}\n',
            )
            self.assertEqual((candidate["view"] / TEXTBOOK_CACHE_PATHS[0]).read_bytes(), b"body-one\n")
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(candidate["view"]),
                "--release-id", candidate["release_id"],
                "--verification-receipt", str(candidate["verification_receipt"]),
            )
            self.assertEqual(verified["releaseId"], candidate["release_id"])

    def test_restore_overlays_copies_selector_payload_closure(self):
        projection_id = "proj-" + ("a" * 64)
        overlay_path = "knowledge/projection/current.json"
        catalog_path = "knowledge/authority-domain-catalog/current.json"
        payload_path = "knowledge/projection/releases/%s/projection-manifest.json" % projection_id
        catalog_payload = "knowledge/authority-domain-catalog/catalog.json"
        pointer = {
            "contract": "act-teaching-projection-current/v1",
            "projectionId": projection_id,
            "projectionHash": "b" * 64,
            "authorityReleaseId": "ctr:release:control-theory-engineering-v0.18",
            "activatedAt": "2026-08-16T00:00:00.000Z",
        }
        catalog_pointer = {
            "contract": "act-authority-domain-display-catalog-current/v1",
            "catalogId": "adc-" + ("c" * 64),
            "catalogHash": "d" * 64,
            "snapshotId": "snap-" + ("e" * 64),
            "snapshotHash": "f" * 64,
            "releaseId": "ctr:release:control-theory-engineering-v0.18",
            "activatedAt": "2026-08-16T00:00:00.000Z",
        }
        catalog_runtime = {
            "catalogId": catalog_pointer["catalogId"],
            "catalogHash": catalog_pointer["catalogHash"],
            "authorityBinding": {
                "snapshotId": catalog_pointer["snapshotId"],
                "snapshotHash": catalog_pointer["snapshotHash"],
                "releaseId": catalog_pointer["releaseId"],
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent = self.v2_release(root / "parent", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            candidate = self.v2_release(root / "candidate", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(parent["view"])
            overlay = parent["view"] / overlay_path
            overlay.parent.mkdir(parents=True, exist_ok=True)
            overlay.write_text(json.dumps(pointer) + "\n", encoding="utf-8")
            payload = parent["view"] / payload_path
            payload.parent.mkdir(parents=True, exist_ok=True)
            payload.write_text('{"projectionId":"%s"}\n' % projection_id, encoding="utf-8")
            catalog = parent["view"] / catalog_path
            catalog.parent.mkdir(parents=True, exist_ok=True)
            catalog.write_text(json.dumps(catalog_pointer) + "\n", encoding="utf-8")
            (parent["view"] / catalog_payload).write_text(json.dumps(catalog_runtime) + "\n", encoding="utf-8")
            restored = self.call(
                "restore-overlays",
                "--parent-runtime-root", str(parent["view"]),
                "--candidate-runtime-root", str(candidate["view"]),
            )
            self.assertEqual(sorted(restored["copied"]), sorted([
                overlay_path, payload_path, catalog_path, catalog_payload,
            ]))
            self.assertEqual(
                (candidate["view"] / payload_path).read_text(encoding="utf-8"),
                '{"projectionId":"%s"}\n' % projection_id,
            )
            self.assertEqual(
                (candidate["view"] / catalog_payload).read_text(encoding="utf-8"),
                json.dumps(catalog_runtime) + "\n",
            )
            self.assertEqual((candidate["view"] / TEXTBOOK_CACHE_PATHS[0]).read_bytes(), b"body-one\n")
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(candidate["view"]),
                "--release-id", candidate["release_id"],
                "--verification-receipt", str(candidate["verification_receipt"]),
            )
            self.assertEqual(verified["releaseId"], candidate["release_id"])

    def test_post_overlay_verification_rejects_authority_catalog_pointer_mismatch(self):
        catalog_path = "knowledge/authority-domain-catalog/current.json"
        catalog_payload = "knowledge/authority-domain-catalog/catalog.json"
        pointer = {
            "contract": "act-authority-domain-display-catalog-current/v1",
            "catalogId": "adc-" + ("c" * 64),
            "catalogHash": "d" * 64,
            "snapshotId": "snap-" + ("e" * 64),
            "snapshotHash": "f" * 64,
            "releaseId": "ctr:release:control-theory-engineering-v0.18",
        }
        stale_runtime = {
            "catalogId": "adc-" + ("a" * 64),
            "catalogHash": "b" * 64,
            "authorityBinding": {
                "snapshotId": "snap-" + ("1" * 64),
                "snapshotHash": "2" * 64,
                "releaseId": "ctr:release:control-theory-engineering-v0.9",
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(fixture["view"])
            current = fixture["view"] / catalog_path
            current.parent.mkdir(parents=True, exist_ok=True)
            current.write_text(json.dumps(pointer) + "\n", encoding="utf-8")
            payload = fixture["view"] / catalog_payload
            payload.write_text(json.dumps(stale_runtime) + "\n", encoding="utf-8")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("control-plane authority catalog runtime does not match current pointer", rejected.stderr)

    def test_restore_overlays_copies_cutover_transaction_closure(self):
        transaction_id = "v018-cutover-aaaaaaaa"
        marker_path = "knowledge/production-cutover-transactions/current.json"
        receipt_path = "knowledge/production-cutover-transactions/%s.json" % transaction_id
        journal_path = "knowledge/consumer-activation/first-activation-transactions/%s.json" % transaction_id
        marker = {
            "contract": "act-production-cutover-marker/v1",
            "transactionId": transaction_id,
            "status": "COMMITTED",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent = self.v2_release(root / "parent", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            candidate = self.v2_release(root / "candidate", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(parent["view"])
            marker_file = parent["view"] / marker_path
            marker_file.parent.mkdir(parents=True, exist_ok=True)
            marker_file.write_text(json.dumps(marker) + "\n", encoding="utf-8")
            (parent["view"] / receipt_path).write_text('{"transactionId":"%s","status":"COMMITTED"}\n' % transaction_id, encoding="utf-8")
            journal = parent["view"] / journal_path
            journal.parent.mkdir(parents=True, exist_ok=True)
            journal.write_text('{"transactionId":"%s"}\n' % transaction_id, encoding="utf-8")
            restored = self.call(
                "restore-overlays",
                "--parent-runtime-root", str(parent["view"]),
                "--candidate-runtime-root", str(candidate["view"]),
            )
            self.assertEqual(sorted(restored["copied"]), sorted([marker_path, receipt_path, journal_path]))
            verified = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(candidate["view"]),
                "--release-id", candidate["release_id"],
                "--verification-receipt", str(candidate["verification_receipt"]),
            )
            self.assertEqual(verified["releaseId"], candidate["release_id"])

    def test_restore_overlays_rejects_cutover_marker_without_receipt(self):
        transaction_id = "v018-cutover-aaaaaaaa"
        marker_path = "knowledge/production-cutover-transactions/current.json"
        marker = {
            "contract": "act-production-cutover-marker/v1",
            "transactionId": transaction_id,
            "status": "COMMITTED",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent = self.v2_release(root / "parent", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            candidate = self.v2_release(root / "candidate", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(parent["view"])
            marker_file = parent["view"] / marker_path
            marker_file.parent.mkdir(parents=True, exist_ok=True)
            marker_file.write_text(json.dumps(marker) + "\n", encoding="utf-8")
            rejected = self.call(
                "restore-overlays",
                "--parent-runtime-root", str(parent["view"]),
                "--candidate-runtime-root", str(candidate["view"]),
                expect_ok=False,
            )
            self.assertIn("control-plane overlay payload is missing", rejected.stderr)

    def test_restore_overlays_rejects_selector_without_payload(self):
        projection_id = "proj-" + ("a" * 64)
        overlay_path = "knowledge/projection/current.json"
        pointer = {
            "contract": "act-teaching-projection-current/v1",
            "projectionId": projection_id,
            "projectionHash": "b" * 64,
            "authorityReleaseId": "ctr:release:control-theory-engineering-v0.18",
            "activatedAt": "2026-08-16T00:00:00.000Z",
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent = self.v2_release(root / "parent", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            candidate = self.v2_release(root / "candidate", TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(parent["view"])
            overlay = parent["view"] / overlay_path
            overlay.parent.mkdir(parents=True, exist_ok=True)
            overlay.write_text(json.dumps(pointer) + "\n", encoding="utf-8")
            rejected = self.call(
                "restore-overlays",
                "--parent-runtime-root", str(parent["view"]),
                "--candidate-runtime-root", str(candidate["view"]),
                expect_ok=False,
            )
            self.assertIn("control-plane overlay payload is missing", rejected.stderr)

    def test_post_overlay_verification_rejects_stale_textbook_cache(self):
        overlay_path = "knowledge/consumer-activation/current.json"
        with tempfile.TemporaryDirectory() as directory:
            fixture = self.v2_release(Path(directory), TEXTBOOK_CACHE_CONTENTS, cache_textbook_retrieval=True)
            self.make_view_writable(fixture["view"])
            overlay = fixture["view"] / overlay_path
            overlay.parent.mkdir(parents=True, exist_ok=True)
            overlay.write_text('{"selector":"ok"}\n', encoding="utf-8")
            cached = fixture["view"] / TEXTBOOK_CACHE_PATHS[2]
            os.chmod(cached, 0o644)
            cached.write_bytes(b"stale-parent-cache\n")
            rejected = self.call(
                "verify-mounted", "--format", "v2", "--runtime-root", str(fixture["view"]),
                "--release-id", fixture["release_id"],
                "--verification-receipt", str(fixture["verification_receipt"]), expect_ok=False,
            )
            self.assertIn("does not match manifest content", rejected.stderr)


if __name__ == "__main__":
    unittest.main()
