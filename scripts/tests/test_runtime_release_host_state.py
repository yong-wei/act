import json
import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/runtime-release-host-state.py"


class RuntimeReleaseHostStateTests(unittest.TestCase):
    def call(self, *args: str, expect_ok: bool = True):
        result = subprocess.run(["python3", str(SCRIPT), *args], text=True, capture_output=True)
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
            self.assertEqual(self.call("active", "--state-dir", str(state))["activeReleaseId"], "runtime-a")
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

    def test_verifies_mounted_file_set_and_hashes_against_receipt(self):
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
            (runtime / "unexpected.txt").write_text("unexpected", encoding="utf-8")
            rejected = self.call("verify-mounted", "--runtime-root", str(runtime), "--release-id", "runtime-a", "--verification-receipt", str(receipt), expect_ok=False)
            self.assertIn("file set differs", rejected.stderr)


if __name__ == "__main__":
    unittest.main()
