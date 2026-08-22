import hashlib
import json
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/materialize-runtime-blob-release.py"
LOCAL_RECEIPT = ".act-runtime-release-materialization.v1.json"
HELPER_NAME = ".act-runtime-blobs"
TEXTBOOK_CACHE_PATHS = (
    "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8",
    "resources/textbook-hybrid-retrieval/bge-m3/lexical-postings.bin",
    "resources/textbook-hybrid-retrieval/bge-m3/vectors.f32",
)
LEGACY_TEXTBOOK_CACHE_PATHS = (
    "resources/textbook-retrieval/bodies.utf8",
    "resources/textbook-retrieval/lexical-postings.bin",
    "resources/textbook-retrieval/vectors.f32",
)
TEXTBOOK_CACHE_CONTENTS = {
    "lessons/1-1/lesson.json": b'{"lesson":"1-1"}\n',
    "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8": b"body-one\n",
    "resources/textbook-hybrid-retrieval/bge-m3/lexical-postings.bin": b"postings\n",
    "resources/textbook-hybrid-retrieval/bge-m3/vectors.f32": b"vector\n",
}


def canonical(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def write_release(root: Path, contents, sources=None, source_provenance_proof_sha256=None):
    sources = sources or {}
    blob_root = root / "blobs"
    blob_root.mkdir(parents=True)
    files = []
    for relative, body in sorted(contents.items()):
        sha = hashlib.sha256(body).hexdigest()
        (blob_root / sha).write_bytes(body)
        item = {
            "path": relative,
            "objectKey": "runtime/blobs/sha256/" + sha,
            "sizeBytes": len(body),
            "sha256": sha,
        }
        if relative in sources:
            item["source"] = sources[relative]
        files.append(item)
    tree = digest([{"path": item["path"], "sizeBytes": item["sizeBytes"], "sha256": item["sha256"]} for item in files])
    source_revision = "a" * 40
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
    manifest_wire = canonical(manifest) + b"\n"
    receipt = {
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
        "blobs": sorted({(item["objectKey"], item["sizeBytes"], item["sha256"]) for item in files}),
    }
    receipt["blobs"] = [{"objectKey": key, "sizeBytes": size, "sha256": sha} for key, size, sha in receipt["blobs"]]
    if source_provenance_proof_sha256 is not None:
        receipt["sourceProvenanceProofSha256"] = source_provenance_proof_sha256
    receipt["receiptSha256"] = digest(receipt)
    manifest_path = root / "manifest.json"
    receipt_path = root / "receipt.json"
    manifest_path.write_bytes(manifest_wire)
    receipt_path.write_bytes(canonical(receipt) + b"\n")
    return blob_root, manifest_path, receipt_path, release_id


def make_view_writable(view: Path):
    for candidate in sorted(view.rglob("*"), key=lambda path: len(path.parts), reverse=True):
        if candidate.is_dir() and not candidate.is_symlink():
            os.chmod(candidate, 0o755)
    os.chmod(view, 0o755)


def relative_helper_link(logical_path: str, file_sha: str) -> str:
    return ("%s%s/%s" % ("../" * logical_path.count("/"), HELPER_NAME, file_sha))


def no_cache_materialization_receipt(manifest_path: Path):
    wire = manifest_path.read_bytes()
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
    return dict(base, materializationSha256=digest(base))


def legacy_cache_materialization_receipt(manifest_path: Path):
    wire = manifest_path.read_bytes()
    manifest = json.loads(wire.decode("utf-8"))
    base = {
        "schemaVersion": "runtime-blob-materialization.v2",
        "releaseId": manifest["releaseId"],
        "manifestVersion": "act-runtime-release.v2",
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
        "cachedLogicalPaths": list(LEGACY_TEXTBOOK_CACHE_PATHS),
        "textbookRetrievalCacheEnabled": True,
    }
    return dict(base, materializationSha256=digest(base))


class RuntimeBlobMaterializationTests(unittest.TestCase):
    def call(self, *args, expect_ok=True):
        result = subprocess.run(["python3", str(SCRIPT), *args], text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def attach_helper(self, view_root: Path, release_id: str, blob_root: Path):
        return self.call(
            "attach-helper",
            "--view-root", str(view_root),
            "--release-id", release_id,
            "--blob-root", str(blob_root),
            "--test-fixture",
        )

    def test_materializes_duplicate_blobs_as_read_only_logical_symlinks_and_selects_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {
                "lessons/1-1/lesson.json": b'{"lesson":"1-1"}\n',
                "lessons/1-1/media/copy.json": b'{"lesson":"1-1"}\n',
                "resources/textbook-hybrid-retrieval/bge-m3/manifest.json": b'{"version":1}\n',
            })
            view_root = root / "views-root"
            prepared = self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertTrue(prepared["prepared"])
            self.assertFalse(prepared["reused"])
            self.assertEqual(prepared["verifiedChangedPathCount"], 3)
            self.assertEqual(prepared["verifiedChangedBlobCount"], 2)
            self.assertEqual(prepared["verifiedChangedBodyBytes"], len(b'{"lesson":"1-1"}\n') + len(b'{"version":1}\n'))
            view = view_root / "views" / release_id
            helper = view / HELPER_NAME
            self.assertTrue(helper.is_dir())
            self.assertFalse(helper.is_symlink())
            self.assertTrue((view / "lessons/1-1").is_dir())
            self.assertTrue((view / "lessons/1-1/lesson.json").is_symlink())
            self.assertTrue((view / "lessons/1-1/media/copy.json").is_symlink())
            lesson_sha = hashlib.sha256(b'{"lesson":"1-1"}\n').hexdigest()
            self.assertEqual(os.readlink(view / "lessons/1-1/lesson.json"), relative_helper_link("lessons/1-1/lesson.json", lesson_sha))
            self.assertEqual(os.readlink(view / "lessons/1-1/media/copy.json"), relative_helper_link("lessons/1-1/media/copy.json", lesson_sha))
            self.assertFalse(os.path.isabs(os.readlink(view / "lessons/1-1/lesson.json")))
            self.assertNotIn("/app", os.readlink(view / "lessons/1-1/lesson.json"))
            self.assertFalse((view / ".act-runtime-release.v2.json").is_symlink())
            self.assertEqual(stat.S_IMODE((view / ".act-runtime-release.v2.json").stat().st_mode), 0o444)
            local_receipt = json.loads((view / LOCAL_RECEIPT).read_text(encoding="utf-8"))
            self.assertEqual(local_receipt["schemaVersion"], "runtime-blob-materialization.v1")
            self.assertNotIn("textbookRetrievalCacheEnabled", local_receipt)
            self.assertNotIn("cachedLogicalPaths", local_receipt)
            reused = self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertTrue(reused["reused"])
            missing_helper = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertTrue("helper target is missing" in missing_helper.stderr or "blob must be a regular" in missing_helper.stderr)
            fixture_only = self.call(
                "attach-helper", "--release-id", release_id, "--view-root", str(view_root),
                "--blob-root", str(blob_root), expect_ok=False,
            )
            self.assertIn("fixture-only", fixture_only.stderr)
            external = self.call("verify", "--release-id", release_id, "--blob-root", str(blob_root), "--view-root", str(view_root), expect_ok=False)
            self.assertIn("helper root", external.stderr)
            attached = self.attach_helper(view_root, release_id, blob_root)
            self.assertTrue(attached["attached"])
            self.assertEqual(len(list(helper.iterdir())), 2)
            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["releaseId"], release_id)
            sample = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "sample")
            self.assertEqual(sample["releaseId"], release_id)
            self.assertGreaterEqual(sample["elapsedMilliseconds"], 0)
            full = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "full")
            self.assertEqual(full["auditedBlobCount"], 2)
            self.assertEqual(full["auditedBytes"], len(b'{"lesson":"1-1"}\n') + len(b'{"version":1}\n'))
            self.assertGreaterEqual(full["elapsedMilliseconds"], 0)
            selected = self.call("select", "--release-id", release_id, "--view-root", str(view_root))
            self.assertTrue(selected["selected"])
            self.assertEqual(os.readlink(view_root / "current"), "views/" + release_id)
            self.assertEqual(self.call("active", "--view-root", str(view_root))["activeReleaseId"], release_id)

    def test_materializes_receipt_with_source_provenance_proof_and_rejects_invalid_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            proof = "f" * 64
            blob_root, manifest, receipt, release_id = write_release(
                root,
                {"lessons/1-1/lesson.json": b'{"lesson":"1-1"}\n'},
                source_provenance_proof_sha256=proof,
            )
            view_root = root / "views-root"
            prepared = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
            )
            self.assertTrue(prepared["prepared"])
            self.assertEqual(json.loads(receipt.read_text(encoding="utf-8"))["sourceProvenanceProofSha256"], proof)

            invalid = json.loads(receipt.read_text(encoding="utf-8"))
            invalid["sourceProvenanceProofSha256"] = "not-a-sha256"
            invalid["receiptSha256"] = digest({key: value for key, value in invalid.items() if key != "receiptSha256"})
            invalid_path = root / "invalid-receipt.json"
            invalid_path.write_bytes(canonical(invalid) + b"\n")
            rejected = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(invalid_path),
                "--blob-root", str(blob_root), "--view-root", str(root / "invalid-view"),
                expect_ok=False,
            )
            self.assertIn("sourceProvenanceProofSha256 must be a SHA-256 digest", rejected.stderr)

    def test_accepts_external_input_source_identity_and_rejects_mixed_or_extra_shapes(self):
        external_source = {
            "externalInputId": "textbook-runtime-generated-v1",
            "externalInputManifestObjectId": "b" * 40,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(
                root,
                {"resources/textbooks-v2/book.json": b"generated\n"},
                {"resources/textbooks-v2/book.json": external_source},
            )
            view_root = root / "views-root"
            prepared = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
            )
            self.assertTrue(prepared["prepared"])
            materialized_manifest = json.loads(
                (view_root / "views" / release_id / ".act-runtime-release.v2.json").read_text(encoding="utf-8")
            )
            self.assertEqual(materialized_manifest["files"][0]["source"], external_source)

        strict_source = {
            **external_source,
            "bundleSemanticSha256": "c" * 64,
            "bundleWireSha256": "d" * 64,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(
                root,
                {"resources/textbooks-v2/book.json": b"generated\n"},
                {"resources/textbooks-v2/book.json": strict_source},
            )
            view_root = root / "views-root"
            prepared = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
            )
            self.assertTrue(prepared["prepared"])
            materialized_manifest = json.loads(
                (view_root / "views" / release_id / ".act-runtime-release.v2.json").read_text(encoding="utf-8")
            )
            self.assertEqual(materialized_manifest["files"][0]["source"], strict_source)

        invalid_sources = [
            {
                "gitObjectId": "a" * 40,
                "externalInputId": "textbook-runtime-generated-v1",
                "externalInputManifestObjectId": "b" * 40,
            },
            {
                "externalInputId": "textbook-runtime-generated-v1",
                "externalInputManifestObjectId": "b" * 40,
                "extra": True,
            },
            {
                "externalInputId": "textbook-runtime-generated-v1",
                "externalInputManifestObjectId": "b" * 40,
                "bundleSemanticSha256": "c" * 64,
            },
        ]
        for index, invalid_source in enumerate(invalid_sources):
            with self.subTest(index=index), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                blob_root, manifest, receipt, _ = write_release(
                    root,
                    {"resources/textbooks-v2/book.json": b"generated\n"},
                    {"resources/textbooks-v2/book.json": invalid_source},
                )
                rejected = self.call(
                    "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                    "--blob-root", str(blob_root), "--view-root", str(root / "views-root"),
                    expect_ok=False,
                )
                self.assertIn("unsupported or missing fields", rejected.stderr)

    def test_rejects_corrupted_blob_receipt_and_out_of_tree_logical_link_before_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {"lessons/1-1/lesson.json": b"ok\n"})
            view_root = root / "views-root"
            damaged = json.loads(receipt.read_text(encoding="utf-8"))
            damaged["manifestWireSha256"] = "f" * 64
            receipt.write_bytes(canonical(damaged) + b"\n")
            rejected = self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root), expect_ok=False)
            self.assertIn("wire identity", rejected.stderr)
            blob_root, manifest, receipt, release_id = write_release(root / "valid", {"lessons/1-1/lesson.json": b"ok\n"})
            self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.attach_helper(view_root, release_id, blob_root)
            logical = view_root / "views" / release_id / "lessons/1-1/lesson.json"
            os.chmod(logical.parent, 0o755)
            logical.unlink()
            logical.symlink_to(root / "outside")
            rejected = self.call("select", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("relative helper-root link", rejected.stderr)

    def test_default_prepare_keeps_textbook_retrieval_files_as_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            prepared = self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertTrue(prepared["prepared"])
            self.assertNotIn("textbookRetrievalCacheEnabled", prepared)
            view = view_root / "views" / release_id
            for relative in TEXTBOOK_CACHE_PATHS:
                logical = view / relative
                self.assertTrue(logical.is_symlink(), relative)
            self.assertTrue((view / "lessons/1-1/lesson.json").is_symlink())
            local_receipt = json.loads((view / LOCAL_RECEIPT).read_text(encoding="utf-8"))
            self.assertEqual(local_receipt, no_cache_materialization_receipt(manifest))
            self.attach_helper(view_root, release_id, blob_root)
            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["schemaVersion"], "runtime-blob-materialization.v1")

    def test_parent_view_delta_reuses_unchanged_paths_without_reading_their_blob(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent_blob_root, parent_manifest, parent_receipt, parent_release_id = write_release(root / "parent", {
                "lessons/1-1/unchanged.json": b'{"stable":true}\n',
                "lessons/1-1/changed.json": b'{"version":1}\n',
            })
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(parent_manifest), "--receipt", str(parent_receipt),
                "--blob-root", str(parent_blob_root), "--view-root", str(view_root),
            )
            target_blob_root, target_manifest, target_receipt, _ = write_release(root / "target", {
                "lessons/1-1/unchanged.json": b'{"stable":true}\n',
                "lessons/1-1/changed.json": b'{"version":2}\n',
            })
            unchanged_sha = hashlib.sha256(b'{"stable":true}\n').hexdigest()
            (target_blob_root / unchanged_sha).unlink()
            prepared = self.call(
                "prepare", "--manifest", str(target_manifest), "--receipt", str(target_receipt),
                "--blob-root", str(target_blob_root), "--view-root", str(view_root),
                "--parent-view", str(view_root / "views" / parent_release_id),
            )
            self.assertEqual(prepared["inheritedPathCount"], 1)
            self.assertEqual(prepared["verifiedChangedPathCount"], 1)
            self.assertEqual(prepared["verifiedChangedBytes"], len(b'{"version":2}\n'))

    def test_cache_textbook_retrieval_copies_only_the_hot_set(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            prepared = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.assertTrue(prepared["textbookRetrievalCacheEnabled"])
            self.assertEqual(prepared["cachedLogicalPaths"], list(TEXTBOOK_CACHE_PATHS))
            view = view_root / "views" / release_id
            for relative in TEXTBOOK_CACHE_PATHS:
                logical = view / relative
                self.assertFalse(logical.is_symlink(), relative)
                self.assertTrue(logical.is_file(), relative)
                self.assertEqual(stat.S_IMODE(logical.stat().st_mode), 0o444)
                self.assertEqual(logical.read_bytes(), TEXTBOOK_CACHE_CONTENTS[relative])
            self.assertTrue((view / "lessons/1-1/lesson.json").is_symlink())
            local_receipt = json.loads((view / LOCAL_RECEIPT).read_text(encoding="utf-8"))
            self.assertEqual(local_receipt["schemaVersion"], "runtime-blob-materialization.v2")
            self.assertEqual(local_receipt["cachedLogicalPaths"], list(TEXTBOOK_CACHE_PATHS))
            self.attach_helper(view_root, release_id, blob_root)
            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["cachedLogicalPaths"], list(TEXTBOOK_CACHE_PATHS))
            reused = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.assertTrue(reused["reused"])
            mismatched = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                expect_ok=False,
            )
            self.assertIn("cache binding", mismatched.stderr)

    def test_accepts_legacy_cache_receipt_for_existing_materialized_view(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            legacy_contents = {
                "lessons/1-1/lesson.json": TEXTBOOK_CACHE_CONTENTS["lessons/1-1/lesson.json"],
                LEGACY_TEXTBOOK_CACHE_PATHS[0]: b"body-one\n",
                LEGACY_TEXTBOOK_CACHE_PATHS[1]: b"postings\n",
                LEGACY_TEXTBOOK_CACHE_PATHS[2]: b"vector\n",
            }
            blob_root, manifest, receipt, release_id = write_release(root, legacy_contents)
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
            )
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            for relative in LEGACY_TEXTBOOK_CACHE_PATHS:
                logical = view / relative
                body = (blob_root / hashlib.sha256(legacy_contents[relative]).hexdigest()).read_bytes()
                logical.unlink()
                logical.write_bytes(body)
                os.chmod(logical, 0o444)
            receipt_path = view / LOCAL_RECEIPT
            os.chmod(receipt_path, 0o644)
            receipt_path.write_bytes(canonical(legacy_cache_materialization_receipt(manifest)) + b"\n")
            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["cachedLogicalPaths"], list(LEGACY_TEXTBOOK_CACHE_PATHS))
            full = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "full")
            self.assertEqual(full["auditedBlobCount"], 4)

    def test_rejects_altered_textbook_cache_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            cached = view / "resources/textbook-hybrid-retrieval/bge-m3/vectors.f32"
            os.chmod(cached, 0o644)
            cached.write_bytes(b"tampered-vector\n")
            rejected = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("does not match manifest content", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            cached = view / "resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8"
            cached.unlink()
            os.symlink(str(blob_root / hashlib.sha256(TEXTBOOK_CACHE_CONTENTS["resources/textbook-hybrid-retrieval/bge-m3/bodies.utf8"]).hexdigest()), str(cached))
            rejected = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("declared cache entry is not a regular file", rejected.stderr)

    def test_rejects_cache_receipt_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            receipt_path = view / LOCAL_RECEIPT
            os.chmod(receipt_path, 0o644)
            receipt_path.write_bytes(canonical(no_cache_materialization_receipt(manifest)) + b"\n")
            rejected = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("non-symlink logical file", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            prepared = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            view = view_root / "views" / release_id
            make_view_writable(view)
            damaged = dict(prepared)
            damaged.pop("prepared", None)
            damaged.pop("reused", None)
            damaged.pop("viewPath", None)
            damaged["cachedLogicalPaths"] = [TEXTBOOK_CACHE_PATHS[0]]
            damaged.pop("materializationSha256")
            damaged["materializationSha256"] = digest(damaged)
            receipt_path = view / LOCAL_RECEIPT
            os.chmod(receipt_path, 0o644)
            receipt_path.write_bytes(canonical(damaged) + b"\n")
            rejected = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("materialization receipt does not match manifest", rejected.stderr)

    def test_rejects_arbitrary_regular_file_in_default_and_cache_views(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            (view / "extra.txt").write_text("extra", encoding="utf-8")
            rejected = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("non-symlink logical file", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            (view / "resources/textbook-hybrid-retrieval/bge-m3/extra.bin").write_bytes(b"extra\n")
            rejected = self.call("verify", "--release-id", release_id, "--view-root", str(view_root), expect_ok=False)
            self.assertIn("non-symlink logical file", rejected.stderr)

    def test_rejects_reserved_helper_path_in_manifest_and_excludes_helper_from_file_set(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {"lessons/1-1/lesson.json": b"ok\n"})
            payload = json.loads(manifest.read_text(encoding="utf-8"))
            payload["files"][0]["path"] = HELPER_NAME + "/lesson.json"
            payload.pop("manifestSha256")
            payload["manifestSha256"] = digest(payload)
            manifest.write_bytes(canonical(payload) + b"\n")
            rejected = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(root / "views-root"),
                expect_ok=False,
            )
            self.assertIn("safe logical runtime path", rejected.stderr)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {
                "lessons/1-1/lesson.json": b"ok\n",
                "resources/textbook-hybrid-retrieval/bge-m3/manifest.json": b"{}\n",
            })
            view_root = root / "views-root"
            self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            attached = self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            self.assertGreater(attached["blobCount"], 0)
            self.assertTrue((view / HELPER_NAME / hashlib.sha256(b"ok\n").hexdigest()).is_file())
            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["fileCount"], 2)
            self.assertNotIn(HELPER_NAME, verified)

    def test_audit_keeps_sample_and_full_body_reads_outside_daily_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {
                "lessons/1-1/a.json": b"a\n",
                "lessons/1-1/b.json": b"b\n",
                "lessons/1-1/c.json": b"c\n",
            })
            view_root = root / "views-root"
            self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.attach_helper(view_root, release_id, blob_root)
            sampled = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "sample", "--sample-size", "2")
            self.assertEqual(sampled["schemaVersion"], "runtime-blob-audit.v1")
            self.assertEqual(sampled["uniqueBlobCount"], 3)
            self.assertEqual(sampled["auditedBlobCount"], 2)
            full = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "full")
            self.assertEqual(full["auditedBlobCount"], 3)

            damaged = view_root / "views" / release_id / HELPER_NAME / hashlib.sha256(b"b\n").hexdigest()
            os.chmod(damaged, 0o644)
            damaged.write_bytes(b"broken\n")
            rejected = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "full", expect_ok=False)
            self.assertIn("audit content", rejected.stderr)

    def test_verify_checks_blob_topology_without_rehashing_every_logical_blob(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {
                "lessons/1-1/a.json": b"a\\n",
                "lessons/1-1/b.json": b"b\\n",
                "lessons/1-1/c.json": b"c\\n",
            })
            view_root = root / "views-root"
            self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.attach_helper(view_root, release_id, blob_root)

            damaged = view_root / "views" / release_id / HELPER_NAME / hashlib.sha256(b"b\\n").hexdigest()
            os.chmod(damaged, 0o644)
            damaged.write_bytes(b"x\\n")
            os.chmod(damaged, 0o444)

            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["releaseId"], release_id)
            rejected = self.call("audit", "--release-id", release_id, "--view-root", str(view_root), "--mode", "full", expect_ok=False)
            self.assertIn("audit content", rejected.stderr)

    def test_replace_existing_rebuilds_stale_textbook_cache_from_blobs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, TEXTBOOK_CACHE_CONTENTS)
            view_root = root / "views-root"
            self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval",
            )
            self.attach_helper(view_root, release_id, blob_root)
            view = view_root / "views" / release_id
            make_view_writable(view)
            cached = view / TEXTBOOK_CACHE_PATHS[0]
            os.chmod(cached, 0o644)
            cached.write_bytes(b"stale-parent-cache\n")
            rebuilt = self.call(
                "prepare", "--manifest", str(manifest), "--receipt", str(receipt),
                "--blob-root", str(blob_root), "--view-root", str(view_root),
                "--cache-textbook-retrieval", "--replace-existing", "--parent-view", str(view),
            )
            self.assertTrue(rebuilt["prepared"])
            self.assertFalse(rebuilt["reused"])
            self.attach_helper(view_root, release_id, blob_root)
            self.assertEqual((view / TEXTBOOK_CACHE_PATHS[0]).read_bytes(), b"body-one\n")
            verified = self.call("verify", "--release-id", release_id, "--view-root", str(view_root))
            self.assertEqual(verified["releaseId"], release_id)


if __name__ == "__main__":
    unittest.main()
