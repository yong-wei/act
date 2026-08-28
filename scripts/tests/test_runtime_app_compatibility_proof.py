#!/usr/bin/env python3
import json
import importlib.util
import subprocess
import tempfile
import unittest
from hashlib import sha256
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / "scripts/runtime-release/runtime-app-compatibility-proof.py"
RUNTIME_REVISION = "a" * 40
APP_REVISION = "b" * 40
MANIFEST_SHA = "c" * 64
TREE_SHA = "d" * 64
IMAGE_DIGEST = "sha256:" + "e" * 64
MIGRATION_SHA = "f" * 64


def canonical(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()


def load_helper():
    spec = importlib.util.spec_from_file_location("runtime_app_compatibility_proof", HELPER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class RuntimeAppCompatibilityProofTest(unittest.TestCase):
    def write_fixture(self, directory: Path):
        manifest = {
            "schemaVersion": "act-runtime-release.v2",
            "releaseId": "runtime-test-release",
            "sourceRevision": RUNTIME_REVISION,
            "manifestSha256": MANIFEST_SHA,
            "treeSha256": TREE_SHA,
        }
        proof = {
            "schemaVersion": "runtime-app-compatibility.v1",
            "runtime": {
                "releaseId": "runtime-test-release",
                "sourceRevision": RUNTIME_REVISION,
                "manifestSha256": MANIFEST_SHA,
                "treeSha256": TREE_SHA,
            },
            "application": {"revision": APP_REVISION, "imageDigest": IMAGE_DIGEST},
            "consumerContract": "runtime-app-candidate-consumers.v1",
            "migrationSet": {"count": 3, "sha256": MIGRATION_SHA},
        }
        manifest_path = directory / "manifest.json"
        proof_path = directory / "proof.json"
        manifest_path.write_bytes(canonical(manifest) + b"\n")
        proof_path.write_bytes(canonical(proof) + b"\n")
        return manifest_path, proof_path

    def inspect(self, manifest_path: Path, proof_path: Path):
        return subprocess.run(
            [
                "python3", str(HELPER), "inspect",
                "--release-id", "runtime-test-release",
                "--manifest", str(manifest_path),
                "--proof", str(proof_path),
            ],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def test_accepts_independent_main_and_integration_revisions(self):
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path, proof_path = self.write_fixture(Path(temporary))
            result = self.inspect(manifest_path, proof_path)
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual(receipt["runtime"]["sourceRevision"], RUNTIME_REVISION)
        self.assertEqual(receipt["application"]["revision"], APP_REVISION)
        self.assertNotEqual(RUNTIME_REVISION, APP_REVISION)

    def test_rejects_proof_for_different_runtime_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path, proof_path = self.write_fixture(Path(temporary))
            proof = json.loads(proof_path.read_text())
            proof["runtime"]["manifestSha256"] = "0" * 64
            proof_path.write_bytes(canonical(proof) + b"\n")
            result = self.inspect(manifest_path, proof_path)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match runtime manifest", result.stderr)

    def test_rejects_noncanonical_proof(self):
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path, proof_path = self.write_fixture(Path(temporary))
            proof_path.write_text(json.dumps(json.loads(proof_path.read_text()), indent=2) + "\n")
            result = self.inspect(manifest_path, proof_path)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not canonical", result.stderr)

    def test_content_addressed_proof_storage_keeps_each_application_qualification(self):
        with tempfile.TemporaryDirectory() as temporary:
            output_dir = Path(temporary) / "proofs"
            helper = load_helper()
            _, proof_path = self.write_fixture(Path(temporary))
            first = json.loads(proof_path.read_text(encoding="utf-8"))
            second = json.loads(proof_path.read_text(encoding="utf-8"))
            second["application"]["revision"] = "1" * 40
            second["application"]["imageDigest"] = "sha256:" + "2" * 64
            first_path = helper.proof_path(output_dir, first)
            second_path = helper.proof_path(output_dir, second)
            self.assertNotEqual(first_path, second_path)
            helper.write_immutable(first_path, first)
            helper.write_immutable(second_path, second)
            self.assertEqual(first_path.read_bytes(), canonical(first) + b"\n")
            self.assertEqual(second_path.read_bytes(), canonical(second) + b"\n")
            second_path.unlink()
            second_path.symlink_to(output_dir / "missing-proof.json")
            with self.assertRaisesRegex(ValueError, "already contains different content"):
                helper.write_immutable(second_path, second)


if __name__ == "__main__":
    unittest.main()
