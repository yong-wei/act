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


def canonical(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def write_release(root: Path, contents):
    blob_root = root / "blobs"
    blob_root.mkdir(parents=True)
    files = []
    for relative, body in sorted(contents.items()):
        sha = hashlib.sha256(body).hexdigest()
        (blob_root / sha).write_bytes(body)
        files.append({
            "path": relative,
            "objectKey": "runtime/blobs/sha256/" + sha,
            "sizeBytes": len(body),
            "sha256": sha,
        })
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
        "manifestObjectKey": "runtime/releases/%s/manifest.json" % release_id,
        "manifestSha256": manifest["manifestSha256"],
        "manifestWireSha256": hashlib.sha256(manifest_wire).hexdigest(),
        "manifestWireSizeBytes": len(manifest_wire),
        "treeSha256": tree,
        "fileCount": manifest["fileCount"],
        "totalBytes": manifest["totalBytes"],
        "blobs": sorted({(item["objectKey"], item["sizeBytes"], item["sha256"]) for item in files}),
    }
    receipt["blobs"] = [{"objectKey": key, "sizeBytes": size, "sha256": sha} for key, size, sha in receipt["blobs"]]
    receipt["receiptSha256"] = digest(receipt)
    manifest_path = root / "manifest.json"
    receipt_path = root / "receipt.json"
    manifest_path.write_bytes(manifest_wire)
    receipt_path.write_bytes(canonical(receipt) + b"\n")
    return blob_root, manifest_path, receipt_path, release_id


class RuntimeBlobMaterializationTests(unittest.TestCase):
    def call(self, *args, expect_ok=True):
        result = subprocess.run(["python3", str(SCRIPT), *args], text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def test_materializes_duplicate_blobs_as_read_only_logical_symlinks_and_selects_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            blob_root, manifest, receipt, release_id = write_release(root, {
                "lessons/1-1/lesson.json": b'{"lesson":"1-1"}\n',
                "lessons/1-1/media/copy.json": b'{"lesson":"1-1"}\n',
                "resources/textbook-retrieval/manifest.json": b'{"version":1}\n',
            })
            view_root = root / "views-root"
            prepared = self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertTrue(prepared["prepared"])
            self.assertFalse(prepared["reused"])
            view = view_root / "views" / release_id
            self.assertTrue((view / "lessons/1-1").is_dir())
            self.assertTrue((view / "lessons/1-1/lesson.json").is_symlink())
            self.assertTrue((view / "lessons/1-1/media/copy.json").is_symlink())
            self.assertFalse((view / ".act-runtime-release.v2.json").is_symlink())
            self.assertEqual(stat.S_IMODE((view / ".act-runtime-release.v2.json").stat().st_mode), 0o444)
            reused = self.call("prepare", "--manifest", str(manifest), "--receipt", str(receipt), "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertTrue(reused["reused"])
            verified = self.call("verify", "--release-id", release_id, "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertEqual(verified["releaseId"], release_id)
            selected = self.call("select", "--release-id", release_id, "--blob-root", str(blob_root), "--view-root", str(view_root))
            self.assertTrue(selected["selected"])
            self.assertEqual(os.readlink(view_root / "current"), "views/" + release_id)
            self.assertEqual(self.call("active", "--view-root", str(view_root))["activeReleaseId"], release_id)

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
            logical = view_root / "views" / release_id / "lessons/1-1/lesson.json"
            os.chmod(logical.parent, 0o755)
            logical.unlink()
            logical.symlink_to(root / "outside")
            rejected = self.call("select", "--release-id", release_id, "--blob-root", str(blob_root), "--view-root", str(view_root), expect_ok=False)
            self.assertIn("manifest blob", rejected.stderr)


if __name__ == "__main__":
    unittest.main()
