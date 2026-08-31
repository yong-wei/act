import hashlib
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TRANSACTION = ROOT / "scripts/runtime-release/runtime-blob-activation-transaction.py"
LIFECYCLE = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
HOST_STATE = ROOT / "scripts/runtime-release/runtime-release-host-state.py"
JOURNAL = ".act-runtime-blob-activation.journal.json"


def identity(release_id):
    def digest(label):
        return hashlib.sha256((release_id + ":" + label).encode("utf-8")).hexdigest()

    return {
        "schemaVersion": "runtime-blob-release-identity.v1",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestSha256": digest("manifest"),
        "manifestWireSha256": digest("wire"),
        "manifestWireSizeBytes": 10,
        "treeSha256": digest("tree"),
    }


class RuntimeBlobActivationTransactionTests(unittest.TestCase):
    def setUp(self):
        self.compatibility_proofs = {}

    def call(self, script, *args, env=None, expect_ok=True):
        process_env = os.environ.copy()
        if env:
            process_env.update(env)
        result = subprocess.run(
            ["python3", str(script)] + list(args),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            env=process_env,
        )
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def write_identity(self, root, value):
        path = root / (value["releaseId"] + ".json")
        path.write_text(json.dumps(value), encoding="utf-8")
        return path

    def write_compatibility_proof(self, state, candidate, app_revision="b" * 40):
        proof = {
            "schemaVersion": "runtime-app-compatibility.v1",
            "runtime": {
                "releaseId": candidate["releaseId"],
                "sourceRevision": "a" * 40,
                "manifestSha256": candidate["manifestSha256"],
                "treeSha256": candidate["treeSha256"],
            },
            "application": {"revision": app_revision, "imageDigest": "sha256:" + "c" * 64},
            "consumerContract": "runtime-app-candidate-consumers.v1",
            "migrationSet": {"count": 1, "sha256": "d" * 64},
        }
        wire = json.dumps(proof, separators=(",", ":"), sort_keys=True).encode("utf-8") + b"\n"
        proof_sha = hashlib.sha256(wire).hexdigest()
        proof_dir = state / "runtime-app-compatibility"
        proof_dir.mkdir(exist_ok=True)
        (proof_dir / (proof_sha + ".json")).write_bytes(wire)
        self.compatibility_proofs[str(state)] = proof_sha
        return proof_sha

    def setup_transaction(self, root):
        state = root / "state"
        active = identity("runtime-a")
        candidate = identity("runtime-b")
        active_path = self.write_identity(root, active)
        candidate_path = self.write_identity(root, candidate)
        self.call(LIFECYCLE, "initialize-v2", "--state-dir", str(state), "--active-identity", str(active_path))
        verification = root / "runtime-a-verification.json"
        verification.write_text(json.dumps({
            "schemaVersion": "runtime-release-verification.v1",
            "releaseId": active["releaseId"],
            "manifestSha256": active["manifestSha256"],
            "treeSha256": active["treeSha256"],
        }), encoding="utf-8")
        self.call(HOST_STATE, "select", "--state-dir", str(state), "--expected-active-release", "none", "--verification-receipt", str(verification))
        self.call(HOST_STATE, "mark-active", "--state-dir", str(state), "--release-id", active["releaseId"])
        self.call(LIFECYCLE, "begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(candidate_path))
        self.call(LIFECYCLE, "set-desired", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(candidate_path))
        self.write_compatibility_proof(state, candidate)
        return state, active, candidate, active_path, candidate_path

    def transaction_args(self, state, command, *extra):
        return (TRANSACTION, command, "--state-dir", str(state), "--lifecycle-script", str(LIFECYCLE), "--host-state-script", str(HOST_STATE)) + extra

    def activate_args(self, state, candidate_path, expected_generation="3"):
        return self.transaction_args(
            state,
            "activate",
            "--expected-generation", expected_generation,
            "--identity", str(candidate_path),
            "--compatibility-proof-sha256", self.compatibility_proofs[str(state)],
        )

    def assert_projected(self, state, expected):
        lifecycle = self.call(LIFECYCLE, "inspect", "--state-dir", str(state))
        active = self.call(HOST_STATE, "active", "--state-dir", str(state))
        self.assertEqual(lifecycle["active"], expected)
        self.assertEqual(active["activeReleaseId"], expected["releaseId"])
        self.assertEqual(active["selection"]["manifestSha256"], expected["manifestSha256"])
        self.assertEqual(active["selection"]["treeSha256"], expected["treeSha256"])
        self.assertFalse((state / JOURNAL).exists())

    def test_normal_activation_and_recovery_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            state, _, candidate, _, candidate_path = self.setup_transaction(Path(directory))
            result = self.call(*self.activate_args(state, candidate_path))
            self.assertTrue(result["completed"])
            self.assert_projected(state, candidate)
            receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["compatibility"]["proofSha256"], self.compatibility_proofs[str(state)])
            recovered = self.call(*self.transaction_args(state, "recover"))
            self.assertEqual(recovered["active"]["releaseId"], candidate["releaseId"])
            self.assert_projected(state, candidate)
            recovered_receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(recovered_receipt["compatibility"]["proofSha256"], self.compatibility_proofs[str(state)])

    def test_daily_transaction_rejects_an_activation_without_a_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            state, _, _, _, candidate_path = self.setup_transaction(Path(directory))
            rejected = self.call(
                *self.transaction_args(
                    state,
                    "activate",
                    "--expected-generation", "3",
                    "--identity", str(candidate_path),
                ),
                expect_ok=False,
            )
            self.assertIn("daily Runtime activation requires a compatibility proof", rejected.stderr)

    def test_same_identity_requalification_reprojects_the_new_proof_without_lifecycle_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state, _, candidate, _, candidate_path = self.setup_transaction(root)
            self.call(*self.activate_args(state, candidate_path))
            active_before = self.call(LIFECYCLE, "inspect", "--state-dir", str(state))
            first_proof = self.compatibility_proofs[str(state)]
            second_proof = self.write_compatibility_proof(state, candidate, app_revision="e" * 40)
            self.assertNotEqual(first_proof, second_proof)

            result = self.call(
                *self.transaction_args(
                    state,
                    "requalify",
                    "--expected-generation", str(active_before["generation"]),
                    "--identity", str(candidate_path),
                    "--compatibility-proof-sha256", second_proof,
                ),
            )
            self.assertTrue(result["completed"])
            active_after = self.call(LIFECYCLE, "inspect", "--state-dir", str(state))
            self.assertEqual(active_after["generation"], active_before["generation"])
            self.assertEqual(active_after["active"], candidate)
            receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["compatibility"]["proofSha256"], second_proof)

            recovered_proof = self.write_compatibility_proof(state, candidate, app_revision="f" * 40)
            self.call(
                *self.transaction_args(
                    state,
                    "requalify",
                    "--expected-generation", str(active_before["generation"]),
                    "--identity", str(candidate_path),
                    "--compatibility-proof-sha256", recovered_proof,
                ),
                env={"ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT": "after-lifecycle"},
                expect_ok=False,
            )
            self.call(*self.transaction_args(state, "recover"))
            recovered_receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(recovered_receipt["compatibility"]["proofSha256"], recovered_proof)

    def test_candidate_readyz_receipt_is_scoped_to_the_selected_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state, active, candidate, _, _ = self.setup_transaction(root)
            verification = root / "runtime-b-verification.json"
            verification.write_text(json.dumps({
                "schemaVersion": "runtime-release-verification.v1",
                "releaseId": candidate["releaseId"],
                "manifestSha256": candidate["manifestSha256"],
                "treeSha256": candidate["treeSha256"],
            }), encoding="utf-8")
            self.call(
                HOST_STATE,
                "select",
                "--state-dir", str(state),
                "--expected-active-release", active["releaseId"],
                "--verification-receipt", str(verification),
            )
            receipt_dir = root / "candidate-receipt"
            receipt_dir.mkdir()
            receipt = self.call(
                HOST_STATE,
                "candidate-readyz-receipt",
                "--state-dir", str(state),
                "--release-id", candidate["releaseId"],
                "--manifest-sha256", candidate["manifestSha256"],
                "--tree-sha256", candidate["treeSha256"],
                "--receipt-dir", str(receipt_dir),
            )
            self.assertEqual(receipt["selection"]["releaseId"], candidate["releaseId"])
            active_after = self.call(HOST_STATE, "active", "--state-dir", str(state))
            self.assertEqual(active_after["activeReleaseId"], active["releaseId"])
            self.assertEqual(
                json.loads((receipt_dir / "act-runtime-active-receipt.json").read_text(encoding="utf-8")),
                receipt,
            )

    def test_recovery_preserves_v1_fallback_without_v2_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state"
            recovered = self.call(*self.transaction_args(state, "recover"))
            self.assertEqual(recovered, {"mode": "v1", "recovered": False})

    def test_crash_boundaries_recover_lifecycle_and_receipt_projection(self):
        boundaries = [
            ("after-lifecycle", None),
            ("after-lifecycle-journal", None),
            ("after-receipt-readback", None),
            ("after-receipt-committed", None),
            ("after-complete", None),
            ("after-lifecycle", "active-receipt-before-rename"),
            ("after-lifecycle", "active-receipt-after-rename"),
        ]
        for activation_stage, host_stage in boundaries:
            with self.subTest(activation_stage=activation_stage, host_stage=host_stage):
                with tempfile.TemporaryDirectory() as directory:
                    state, _, candidate, _, candidate_path = self.setup_transaction(Path(directory))
                    env = {"ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT": activation_stage}
                    if host_stage:
                        env["ACT_RUNTIME_HOST_STATE_CRASH_AT"] = host_stage
                    self.call(*self.activate_args(state, candidate_path), env=env, expect_ok=False)
                    self.call(*self.transaction_args(state, "recover"))
                    self.assert_projected(state, candidate)
                    self.call(*self.transaction_args(state, "recover"))
                    self.assert_projected(state, candidate)

    def test_recovery_repairs_missing_or_damaged_receipt_after_lifecycle_commit(self):
        for damaged in ("missing", "invalid"):
            with self.subTest(damaged=damaged):
                with tempfile.TemporaryDirectory() as directory:
                    state, _, candidate, _, candidate_path = self.setup_transaction(Path(directory))
                    self.call(*self.activate_args(state, candidate_path), env={"ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT": "after-lifecycle"}, expect_ok=False)
                    receipt = state / "act-runtime-active-receipt.json"
                    if damaged == "missing":
                        receipt.unlink()
                    else:
                        receipt.write_text("{", encoding="utf-8")
                    self.call(*self.transaction_args(state, "recover"))
                    self.assert_projected(state, candidate)

    def test_recovery_repairs_committed_lifecycle_when_intent_is_missing_or_invalid(self):
        for damaged in ("missing", "invalid"):
            with self.subTest(damaged=damaged):
                with tempfile.TemporaryDirectory() as directory:
                    state, _, candidate, _, candidate_path = self.setup_transaction(Path(directory))
                    self.call(
                        LIFECYCLE, "activate-and-project", "--state-dir", str(state),
                        "--expected-generation", "3", "--identity", str(candidate_path),
                        "--host-state-script", str(HOST_STATE),
                        env={"ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT": "after-lifecycle-journal"},
                        expect_ok=False,
                    )
                    journal = state / JOURNAL
                    if damaged == "missing":
                        journal.unlink()
                    else:
                        journal.write_text("{", encoding="utf-8")
                    self.call(*self.transaction_args(state, "recover"))
                    self.assert_projected(state, candidate)

    def test_recovery_discards_intent_with_wrong_lifecycle_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            state, _, candidate, _, candidate_path = self.setup_transaction(Path(directory))
            self.call(*self.activate_args(state, candidate_path), env={"ACT_RUNTIME_BLOB_ACTIVATION_CRASH_AT": "after-lifecycle-journal"}, expect_ok=False)
            journal = state / JOURNAL
            value = json.loads(journal.read_text(encoding="utf-8"))
            value["targetLifecycleSha256"] = "0" * 64
            journal.write_text(json.dumps(value), encoding="utf-8")
            self.call(*self.transaction_args(state, "recover"))
            self.assert_projected(state, candidate)

    def test_uncommitted_intent_is_aborted_and_generation_cas_is_fenced(self):
        with tempfile.TemporaryDirectory() as directory:
            state, active, candidate, _, _ = self.setup_transaction(Path(directory))
            journal_value = {
                "schemaVersion": "runtime-blob-activation-journal.v1",
                "status": "prepared",
                "transactionId": "1" * 32,
                "expectedGeneration": 3,
                "targetGeneration": 4,
                "previousIdentity": active,
                "targetIdentity": candidate,
                "targetLifecycleSha256": "",
            }
            (state / JOURNAL).write_text(json.dumps(journal_value), encoding="utf-8")
            recovered = self.call(*self.transaction_args(state, "recover"))
            self.assertEqual(recovered["active"]["releaseId"], active["releaseId"])
            self.assert_projected(state, active)
            stale = self.call(*self.activate_args(state, self.write_identity(Path(directory), candidate), expected_generation="2"), expect_ok=False)
            self.assertIn("generation", stale.stderr)
            self.assert_projected(state, active)

    def test_lifecycle_owned_activation_serializes_same_generation_and_rollback_projects(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state, _, candidate, _, candidate_path = self.setup_transaction(root)
            command = [
                "python3", str(TRANSACTION), "activate",
                "--state-dir", str(state),
                "--lifecycle-script", str(LIFECYCLE),
                "--host-state-script", str(HOST_STATE),
                "--expected-generation", "3",
                "--identity", str(candidate_path),
                "--compatibility-proof-sha256", self.compatibility_proofs[str(state)],
            ]
            first = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
            second = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
            first_result = first.communicate()
            second_result = second.communicate()
            self.assertEqual(sorted([first.returncode, second.returncode]), [0, 1])
            self.assert_projected(state, candidate)
            rollback_command = [
                "python3", str(TRANSACTION), "rollback",
                "--state-dir", str(state),
                "--lifecycle-script", str(LIFECYCLE),
                "--host-state-script", str(HOST_STATE),
                "--expected-generation", "4",
            ]
            rollback_first = subprocess.Popen(rollback_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
            rollback_second = subprocess.Popen(rollback_command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
            rollback_first_result = rollback_first.communicate()
            rollback_second_result = rollback_second.communicate()
            self.assertEqual(sorted([rollback_first.returncode, rollback_second.returncode]), [0, 1])
            self.assert_projected(state, identity("runtime-a"))


if __name__ == "__main__":
    unittest.main()
