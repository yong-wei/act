import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
HOST_STATE = ROOT / "scripts/runtime-release/runtime-release-host-state.py"
MODULE_SPEC = importlib.util.spec_from_file_location("runtime_blob_lifecycle_test_module", str(SCRIPT))
LIFECYCLE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(LIFECYCLE)


def identity(release_id, seed):
    return {
        "schemaVersion": "runtime-blob-release-identity.v1",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestSha256": seed * 64,
        "manifestWireSha256": ("a" if seed != "a" else "b") * 64,
        "manifestWireSizeBytes": 10,
        "treeSha256": ("c" if seed != "c" else "d") * 64,
    }


TYPESCRIPT_ARTIFACT_GENERATOR = """
import { writeFileSync } from 'node:fs';
import { openCutoverTransaction, applyJournaledMutation, sealCoordinatedActiveReceipt, type CutoverJournalStore, type CutoverSelectorStore } from '@/lib/latest-authority-oss-cutover/transaction';
import { buildCoordinatedRuntimeActiveReceiptBinding } from '@/lib/latest-authority-oss-cutover/runtime-binding';
import { sealCoordinatedCandidateReceipt, sealCoordinationAllocationRecord } from '@/lib/latest-authority-oss-cutover/envelope';

const H = (c: string) => c.repeat(64);
const allocation = sealCoordinationAllocationRecord({
  sealedAt: '2030-01-01T00:00:00.000Z',
  capture: {
    captureHash: H('a'),
    compatibility: {
      contract: 'authority-adapter-compatibility/v1',
      adapterContractVersion: 'existing-act-adapter',
      classification: 'COMPATIBLE',
      incompatibleReasons: [],
      captured: {
        schemaVersion: '0.3.0',
        schemaSha256: H('a'),
        contractVersion: 'actkg-public-bundle/2',
        requiredMembers: ['release'],
        profiles: ['runtime'],
        representativeParse: 'COMPLETE',
      },
    },
  },
  scopeHash: H('b'),
  denominatorHash: H('c'),
  policyVersions: { continuity: 'v1' },
  implementationIdentities: { builder: 'b1' },
});
const candidate = sealCoordinatedCandidateReceipt({
  sealedAt: '2030-01-01T00:00:00.000Z',
  allocation,
  authorityCaptureHash: H('a'),
  localeQualificationHash: H('d'),
  teachingProjectionHash: H('a'),
  teachingClosureReceiptHash: H('d'),
  formalResourceEnvelopeHash: H('c'),
  continuityReceiptHash: H('b'),
  derivationReceiptHash: H('d'),
  successorRuntimeManifestHash: H('b'),
  successorRuntimeMaterializationHash: H('c'),
  domainShardCatalogHash: H('a'),
  domainShardSetHash: H('b'),
  prerequisitePublicationHash: H('c'),
  consumerActivationHash: H('d'),
  predecessor: [
    { selectorId: 'authority:current', identity: 'auth-old' },
    { selectorId: 'runtime:desired', identity: 'runtime-old' },
  ],
  predecessorRuntimeLifecycleGeneration: 1,
  successorSelectorExpectations: [
    { selectorId: 'authority:current', expectedSuccessorIdentity: 'auth-new' },
    { selectorId: 'runtime:desired', expectedSuccessorIdentity: 'runtime-new' },
  ],
  transactionImplementationIdentity: 'cutover-tx/v1',
  rollbackPlanHash: H('a'),
  verificationPolicyHash: H('b'),
  innerBindings: [],
});
class Store implements CutoverSelectorStore {
  identity: string;
  constructor(readonly selectorId: string, initial: string) { this.identity = initial; }
  async readIdentity() { return this.identity; }
  async writeIdentity(next: string) { this.identity = next; }
}
const stores = [new Store('authority:current', 'auth-old'), new Store('runtime:desired', 'runtime-old')];
const journalStore: CutoverJournalStore = { append: async () => undefined, load: async () => null };
async function main() {
  const opened = await openCutoverTransaction({
    candidateReceipt: candidate,
    stores,
    orderedMutationPlans: [
      { selectorId: 'authority:current', expectedPredecessorIdentity: 'auth-old', successorIdentity: 'auth-new' },
      { selectorId: 'runtime:desired', expectedPredecessorIdentity: 'runtime-old', successorIdentity: 'runtime-new' },
    ],
    journalStore,
    openedAt: '2030-01-01T00:00:01.000Z',
  });
  const receipts = [
    await applyJournaledMutation(opened.journal, 0, stores[0], '2030-01-01T00:01:00.000Z'),
    await applyJournaledMutation(opened.journal, 1, stores[1], '2030-01-01T00:01:01.000Z'),
  ];
  const runtimeRelease = { releaseId: 'runtime-b', manifestSha256: H('e'), treeSha256: H('f') };
  const binding = buildCoordinatedRuntimeActiveReceiptBinding({
    transactionId: opened.journal.transactionId,
    candidateReceiptHash: candidate.receiptHash,
    runtimeRelease,
    materializationReceiptHash: H('c'),
  });
  const active = sealCoordinatedActiveReceipt({
    journal: opened.journal,
    candidateReceipt: candidate,
    observedSelectors: stores.map((store) => ({ selectorId: store.selectorId, identity: store.identity })),
    mutationReceipts: receipts,
    runtimeActiveReceiptHash: binding.bindingHash,
    sealedAt: '2030-01-01T00:02:00.000Z',
  });
  writeFileSync(process.argv[2], JSON.stringify(active));
  writeFileSync(process.argv[3], JSON.stringify(binding));
  writeFileSync(process.argv[4], JSON.stringify({ candidateReceiptHash: candidate.receiptHash, runtimeRelease }));
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
"""


class RuntimeBlobLifecycleTests(unittest.TestCase):
    def call(self, *args, expect_ok=True):
        result = subprocess.run(["python3", str(SCRIPT), *args], text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def write_identity(self, root, release_id, seed):
        path = root / (release_id + ".json")
        path.write_text(json.dumps(identity(release_id, seed)), encoding="utf-8")
        return path

    def coordinated_receipt_and_binding(self, root, candidate_identity, candidate_receipt_hash):
        """Build a graph receipt and runtime binding with genuine
        content-addressed hashes over the same canonical JSON the lifecycle
        gate recomputes."""
        binding = {
            "contract": "coordinated-runtime-active-receipt-binding/v1",
            "transactionId": "tx-1",
            "candidateReceiptHash": candidate_receipt_hash,
            "runtimeRelease": {
                "releaseId": candidate_identity["releaseId"],
                "manifestSha256": candidate_identity["manifestSha256"],
                "treeSha256": candidate_identity["treeSha256"],
            },
            "materializationReceiptHash": "3" * 64,
            "bindingHash": "",
        }
        binding["bindingHash"] = LIFECYCLE.canonical_digest({
            "transactionId": binding["transactionId"],
            "candidateReceiptHash": binding["candidateReceiptHash"],
            "runtimeRelease": binding["runtimeRelease"],
            "materializationReceiptHash": binding["materializationReceiptHash"],
        })
        receipt = {
            "contract": "coordinated-active-receipt/v1",
            "receiptId": "",
            "sealedAt": "2030-01-01T00:00:00Z",
            "transactionId": "tx-1",
            "journalHash": "1" * 64,
            "candidateReceiptHash": candidate_receipt_hash,
            "committedSelectors": [{"selectorId": "authority:current", "identity": "auth-new"}],
            "mutationReceiptHashes": ["2" * 64],
            "runtimeActiveReceiptHash": binding["bindingHash"],
            "receiptHash": "",
        }
        payload_hash = LIFECYCLE.coordinated_active_receipt_payload_hash(receipt)
        receipt["receiptHash"] = payload_hash
        receipt["receiptId"] = "act-" + payload_hash[:24]
        receipt_path = root / "graph-receipt.json"
        receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
        binding_path = root / "runtime-binding.json"
        binding_path.write_text(json.dumps(binding), encoding="utf-8")
        return receipt_path, binding_path

    def write_v1_state(self, root):
        selection = {
            "schemaVersion": "runtime-release-selection.v1",
            "generation": 1,
            "releaseId": "runtime-v1",
            "manifestSha256": "d" * 64,
            "treeSha256": "e" * 64,
        }
        selection_path = root / "v1-selection.json"
        receipt_path = root / "v1-active.json"
        selection_path.write_text(json.dumps(selection), encoding="utf-8")
        receipt_path.write_text(json.dumps({"schemaVersion": "runtime-release-active-receipt.v1", "selection": selection, "healthCheck": "readyz"}), encoding="utf-8")
        return selection_path, receipt_path

    def write_v1_authority(self, root, release, generation=1):
        selection = {
            "schemaVersion": "runtime-release-selection.v1",
            "generation": generation,
            "releaseId": release["releaseId"],
            "manifestSha256": release["manifestSha256"],
            "treeSha256": release["treeSha256"],
        }
        selection_path = root / (release["releaseId"] + "-selection.json")
        receipt_path = root / (release["releaseId"] + "-active-receipt.json")
        selection_path.write_text(json.dumps(selection), encoding="utf-8")
        receipt_path.write_text(json.dumps({"schemaVersion": "runtime-release-active-receipt.v1", "selection": selection, "healthCheck": "readyz"}), encoding="utf-8")
        return selection_path, receipt_path

    def write_transition_boundary(self, state, stage):
        """Simulate each durable write boundary of one v2 transaction."""
        active = identity("runtime-a", "a")
        candidate = identity("runtime-b", "b")
        after = {
            "schemaVersion": "runtime-blob-release-lifecycle.v2",
            "generation": 2,
            "transactionId": "b" * 32,
            "desired": None,
            "active": candidate,
            "rollback": active,
            "publishing": [],
            "retained": [],
        }
        after = LIFECYCLE.lifecycle(after)
        after_sha = LIFECYCLE.digest(after)
        marker = {
            "schemaVersion": "runtime-release-authority.v2",
            "mode": "v2",
            "generation": after["generation"],
            "lifecycleSha256": after_sha,
        }
        journal = {
            "schemaVersion": "runtime-blob-release-lifecycle-journal.v1",
            "status": "prepared",
            "transactionId": after["transactionId"],
            "afterLifecycle": after,
            "afterLifecycleSha256": after_sha,
            "afterMarker": marker,
        }
        state.mkdir(parents=True, exist_ok=True)
        if stage >= 0:
            (state / "act-runtime-blob-lifecycle.journal.json").write_text(json.dumps(journal), encoding="utf-8")
        if stage >= 1:
            (state / "act-runtime-blob-lifecycle.v2.json").write_text(json.dumps(after), encoding="utf-8")
        if stage >= 2:
            (state / "act-runtime-authority.v2.json").write_text(json.dumps(marker), encoding="utf-8")
        if stage >= 3:
            journal["status"] = "committed"
            (state / "act-runtime-blob-lifecycle.journal.json").write_text(json.dumps(journal), encoding="utf-8")

    def active_transition(self, command, state, expected_generation, identity_path=None, now=None):
        args = [
            command, "--state-dir", str(state),
            "--expected-generation", str(expected_generation),
            "--host-state-script", str(HOST_STATE),
        ]
        if identity_path is not None:
            args.extend(["--identity", str(identity_path)])
        if now is not None:
            args.extend(["--now", now])
        result = self.call(*args)
        return result["active"]

    def test_preserves_desired_active_divergence_and_protects_all_lifecycle_roots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            a = self.write_identity(root, "runtime-a", "a")
            b = self.write_identity(root, "runtime-b", "b")
            c = self.write_identity(root, "runtime-c", "c")
            d = self.write_identity(root, "runtime-d", "d")
            initialized = self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(a), "--desired-identity", str(b))
            self.assertEqual(initialized["generation"], 1)
            inspected = self.call("inspect", "--state-dir", str(state))
            self.assertEqual(inspected["active"]["releaseId"], "runtime-a")
            self.assertEqual(inspected["desired"]["releaseId"], "runtime-b")
            protected = self.call("protected-set", "--state-dir", str(state))
            self.assertEqual(protected["releaseIds"], ["runtime-a", "runtime-b"])
            activated = self.active_transition("activate", state, 1, b)
            self.assertEqual(activated["active"]["releaseId"], "runtime-b")
            self.assertEqual(activated["rollback"]["releaseId"], "runtime-a")
            publishing = self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(c))
            self.assertEqual(publishing["publishing"][0]["releaseId"], "runtime-c")
            candidate = self.call("set-desired", "--state-dir", str(state), "--expected-generation", "3", "--identity", str(c))
            self.assertEqual(candidate["desired"]["releaseId"], "runtime-c")
            protected = self.call("protected-set", "--state-dir", str(state))
            self.assertEqual(protected["releaseIds"], ["runtime-a", "runtime-b", "runtime-c"])
            rollback = self.active_transition("rollback", state, 4)
            self.assertEqual(rollback["active"]["releaseId"], "runtime-a")
            self.assertEqual(rollback["rollback"]["releaseId"], "runtime-b")
            self.assertEqual(rollback["desired"]["releaseId"], "runtime-c")
            stale = self.call("cancel-desired", "--state-dir", str(state), "--expected-generation", "4", expect_ok=False)
            self.assertIn("generation", stale.stderr)
            retained = self.call("retain", "--state-dir", str(state), "--expected-generation", "5", "--identity", str(d))
            self.assertEqual(retained["retained"][0]["identity"]["releaseId"], "runtime-d")
            self.assertEqual(retained["retained"][0]["signedUrlMaxSeconds"], 300)
            protected = self.call("protected-set", "--state-dir", str(state))
            self.assertEqual(protected["releaseIds"], ["runtime-a", "runtime-b", "runtime-c", "runtime-d"])
            released = self.call("release-retained", "--state-dir", str(state), "--expected-generation", "6", "--identity", str(d), "--now", "2030-01-01T00:00:00Z")
            self.assertEqual(released["retained"], [])

    def test_recovers_v2_only_from_matching_journal_and_cleans_pre_marker_interruption_to_v1(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            a = self.write_identity(root, "runtime-a", "a")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(a))
            lifecycle = state / "act-runtime-blob-lifecycle.v2.json"
            lifecycle.write_text("{broken", encoding="utf-8")
            recovered = self.call("recover", "--state-dir", str(state))
            self.assertEqual(recovered, {"mode": "v2", "generation": 1, "recovered": True})
            (state / "act-runtime-blob-lifecycle.journal.json").unlink()
            lifecycle.write_text("{broken", encoding="utf-8")
            blocked = self.call("recover", "--state-dir", str(state), expect_ok=False)
            self.assertIn("no matching committed journal", blocked.stderr)

            interrupted = root / "interrupted"
            interrupted.mkdir()
            journal = state / "act-runtime-blob-lifecycle.journal.json"
            source = root / "state" / "act-runtime-blob-lifecycle.journal.json"
            self.assertFalse(source.exists())
            prepared = {
                "schemaVersion": "runtime-blob-release-lifecycle-journal.v1",
                "status": "prepared",
                "transactionId": "a" * 32,
                "afterLifecycle": {
                    "schemaVersion": "runtime-blob-release-lifecycle.v2",
                    "generation": 1,
                    "transactionId": "a" * 32,
                    "desired": None,
                    "active": identity("runtime-a", "a"),
                    "rollback": None,
                    "publishing": [],
                    "retained": [],
                },
            }
            prepared["afterLifecycleSha256"] = __import__("hashlib").sha256(json.dumps(prepared["afterLifecycle"], separators=(",", ":"), sort_keys=True).encode()).hexdigest()
            prepared["afterMarker"] = {"schemaVersion": "runtime-release-authority.v2", "mode": "v2", "generation": 1, "lifecycleSha256": prepared["afterLifecycleSha256"]}
            (interrupted / "act-runtime-blob-lifecycle.journal.json").write_text(json.dumps(prepared), encoding="utf-8")
            (interrupted / "act-runtime-blob-lifecycle.v2.json").write_text(json.dumps(prepared["afterLifecycle"]), encoding="utf-8")
            cleaned = self.call("recover", "--state-dir", str(interrupted))
            self.assertEqual(cleaned, {"mode": "v1", "recovered": True})
            self.assertFalse((interrupted / "act-runtime-blob-lifecycle.v2.json").exists())

    def test_recovers_every_v2_transaction_write_boundary(self):
        for stage in range(4):
            with self.subTest(stage=stage), tempfile.TemporaryDirectory() as directory:
                state = Path(directory) / "state"
                self.write_transition_boundary(state, stage)
                recovered = self.call("recover", "--state-dir", str(state))
                if stage < 2:
                    self.assertEqual(recovered, {"mode": "v1", "recovered": True})
                    self.assertFalse((state / "act-runtime-authority.v2.json").exists())
                    self.assertFalse((state / "act-runtime-blob-lifecycle.v2.json").exists())
                    self.assertFalse((state / "act-runtime-blob-lifecycle.journal.json").exists())
                else:
                    self.assertEqual(recovered["mode"], "v2")
                    self.assertEqual(recovered["generation"], 2)
                    self.assertEqual(recovered["recovered"], stage == 2)
                    journal = json.loads((state / "act-runtime-blob-lifecycle.journal.json").read_text(encoding="utf-8"))
                    self.assertEqual(journal["status"], "committed")

    def test_cancels_and_replaces_desired_candidates_only_through_explicit_transactions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            candidate_b = self.write_identity(root, "runtime-b", "b")
            candidate_c = self.write_identity(root, "runtime-c", "c")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(candidate_b))
            desired_b = self.call("set-desired", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(candidate_b))
            self.assertEqual(desired_b["desired"]["releaseId"], "runtime-b")
            cancelled = self.call("cancel-desired", "--state-dir", str(state), "--expected-generation", "3")
            self.assertIsNone(cancelled["desired"])
            rejected = self.call("set-desired", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(candidate_b), expect_ok=False)
            self.assertIn("publishing identity", rejected.stderr)
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(candidate_b))
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "5", "--identity", str(candidate_b))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "6", "--identity", str(candidate_c))
            replaced = self.call("set-desired", "--state-dir", str(state), "--expected-generation", "7", "--identity", str(candidate_c))
            self.assertEqual(replaced["desired"]["releaseId"], "runtime-c")
            self.assertNotIn("runtime-b", self.call("protected-set", "--state-dir", str(state))["releaseIds"])

    def test_generation_fenced_publishing_cleanup_only_removes_exact_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            candidate_b = self.write_identity(root, "runtime-b", "b")
            candidate_c = self.write_identity(root, "runtime-c", "c")
            candidate_d = self.write_identity(root, "runtime-d", "d")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(candidate_b))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(candidate_c))

            # A stale cleanup attempt must fail closed and leave every root
            # untouched, including another publisher's candidate.
            stale = self.call(
                "cancel-publishing", "--state-dir", str(state),
                "--expected-generation", "2", "--identity", str(candidate_b), expect_ok=False,
            )
            self.assertIn("generation", stale.stderr)
            inspected = self.call("inspect", "--state-dir", str(state))
            self.assertEqual([item["releaseId"] for item in inspected["publishing"]], ["runtime-b", "runtime-c"])

            cancelled = self.call(
                "cancel-publishing", "--state-dir", str(state),
                "--expected-generation", "3", "--identity", str(candidate_b),
            )
            self.assertEqual([item["releaseId"] for item in cancelled["publishing"]], ["runtime-c"])

            # A different candidate can proceed after the failed publication
            # root is explicitly cancelled, while the other publisher remains.
            continued = self.call(
                "begin-publish", "--state-dir", str(state),
                "--expected-generation", "4", "--identity", str(candidate_d),
            )
            self.assertEqual(
                [item["releaseId"] for item in continued["publishing"]],
                ["runtime-c", "runtime-d"],
            )

            # Cancellation cannot remove a candidate after it has become a
            # desired root, even when the identity file is still available.
            self.call(
                "set-desired", "--state-dir", str(state),
                "--expected-generation", "5", "--identity", str(candidate_c),
            )
            protected = self.call(
                "cancel-publishing", "--state-dir", str(state),
                "--expected-generation", "6", "--identity", str(candidate_c), expect_ok=False,
            )
            self.assertIn("publishing identity", protected.stderr)
            final_state = self.call("inspect", "--state-dir", str(state))
            self.assertEqual(final_state["desired"]["releaseId"], "runtime-c")
            self.assertEqual([item["releaseId"] for item in final_state["publishing"]], ["runtime-d"])

    def test_persists_v1_rollback_marker_instead_of_deleting_v2_authority_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            a = self.write_identity(root, "runtime-a", "a")
            selection, receipt = self.write_v1_state(root)
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(a))
            marker = self.call(
                "rollback-to-v1", "--state-dir", str(state), "--expected-generation", "1",
                "--v1-selection-file", str(selection), "--v1-active-receipt-file", str(receipt),
            )
            self.assertEqual(marker["mode"], "v1-rollback")
            verified = self.call("verify-v1-rollback", "--state-dir", str(state), "--v1-selection-file", str(selection), "--v1-active-receipt-file", str(receipt))
            self.assertEqual(verified["mode"], "v1-rollback")
            self.assertTrue((state / "act-runtime-blob-lifecycle.v2.json").exists())
            receipt.write_text(json.dumps({"schemaVersion": "runtime-release-active-receipt.v1"}), encoding="utf-8")
            rejected = self.call("verify-v1-rollback", "--state-dir", str(state), "--v1-selection-file", str(selection), "--v1-active-receipt-file", str(receipt), expect_ok=False)
            self.assertIn("active receipt", rejected.stderr)

    def test_finishes_v1_rollback_journal_after_marker_write_crash(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            selection, receipt = self.write_v1_state(root)
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("rollback-to-v1", "--state-dir", str(state), "--expected-generation", "1", "--v1-selection-file", str(selection), "--v1-active-receipt-file", str(receipt))
            journal_path = state / "act-runtime-blob-lifecycle.journal.json"
            journal = json.loads(journal_path.read_text(encoding="utf-8"))
            journal["status"] = "prepared"
            journal_path.write_text(json.dumps(journal), encoding="utf-8")
            recovered = self.call("recover", "--state-dir", str(state))
            self.assertEqual(recovered["mode"], "v1-rollback")
            self.assertTrue(recovered["recovered"])
            self.assertEqual(json.loads(journal_path.read_text(encoding="utf-8"))["status"], "committed")

    def test_retention_lease_deadline_duplicate_extension_and_release_cutoff(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            retained = self.write_identity(root, "runtime-retained", "d")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            first = self.call("retain", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(retained), "--now", "2030-01-01T00:00:00Z", "--signed-url-max-seconds", "300")
            self.assertEqual(first["retained"][0]["retainedAt"], "2030-01-01T00:00:00Z")
            self.assertEqual(first["retained"][0]["notBeforeReleaseAt"], "2030-01-01T00:05:00Z")
            extended = self.call("retain", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(retained), "--now", "2030-01-01T00:01:00Z", "--signed-url-max-seconds", "300")
            self.assertEqual(extended["retained"][0]["retainedAt"], "2030-01-01T00:01:00Z")
            self.assertEqual(extended["retained"][0]["notBeforeReleaseAt"], "2030-01-01T00:06:00Z")
            unchanged = self.call("retain", "--state-dir", str(state), "--expected-generation", "3", "--identity", str(retained), "--now", "2030-01-01T00:00:30Z", "--signed-url-max-seconds", "300")
            self.assertEqual(unchanged["retained"][0]["retainedAt"], "2030-01-01T00:01:00Z")
            low_ttl = self.call("retain", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(retained), "--now", "2030-01-01T00:02:00Z", "--signed-url-max-seconds", "299", expect_ok=False)
            self.assertIn("signedUrlMaxSeconds", low_ttl.stderr)
            before_deadline = self.call("release-retained", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(retained), "--now", "2030-01-01T00:05:59Z", expect_ok=False)
            self.assertIn("release deadline", before_deadline.stderr)
            released = self.call("release-retained", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(retained), "--now", "2030-01-01T00:06:00Z")
            self.assertEqual(released["retained"], [])

    def test_python_gate_accepts_typescript_coordinated_artifacts(self):
        """The lifecycle gate must parse the artifacts exactly as the
        TypeScript library serializes them (contract discriminator and
        content-addressed hashes)."""
        if shutil.which("npx") is None:
            self.skipTest("npx is unavailable")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ts_script = root / "generate.ts"
            receipt_path = root / "ts-graph-receipt.json"
            binding_path = root / "ts-runtime-binding.json"
            summary_path = root / "ts-summary.json"
            ts_script.write_text(TYPESCRIPT_ARTIFACT_GENERATOR, encoding="utf-8")
            result = subprocess.run(
                ["npx", "tsx", "--tsconfig", str(ROOT / "tsconfig.json"),
                 str(ts_script), str(receipt_path), str(binding_path), str(summary_path)],
                cwd=str(ROOT), text=True, capture_output=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
            binding = json.loads(binding_path.read_text(encoding="utf-8"))
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            parsed_receipt = LIFECYCLE.coordinated_graph_receipt(receipt)
            parsed_binding = LIFECYCLE.coordinated_runtime_binding(binding)
            self.assertEqual(parsed_receipt["candidateReceiptHash"], summary["candidateReceiptHash"])
            self.assertEqual(parsed_receipt["runtimeActiveReceiptHash"], parsed_binding["bindingHash"])
            self.assertEqual(parsed_binding["runtimeRelease"]["releaseId"], summary["runtimeRelease"]["releaseId"])

    def test_attach_coordinated_declaration_to_existing_desired_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            candidate = self.write_identity(root, "runtime-b", "b")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(candidate))
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(candidate))
            identity_b = json.loads(candidate.read_text(encoding="utf-8"))
            declaration = root / "coordinated-cutover.json"
            declaration.write_text(json.dumps({
                "contract": "runtime-blob-coordinated-cutover.v1",
                "releaseId": "runtime-b",
                "manifestSha256": identity_b["manifestSha256"],
                "treeSha256": identity_b["treeSha256"],
                "candidateReceiptHash": "e" * 64,
            }), encoding="utf-8")
            attached = self.call(
                "attach-coordinated-desired", "--state-dir", str(state),
                "--expected-generation", "3", "--identity", str(candidate),
                "--coordinated-cutover", str(declaration),
            )
            self.assertEqual(attached["generation"], 4)
            self.assertTrue((state / "coordinated-cutover.json").exists())
            # The identical declaration is idempotent and does not create an
            # extra lifecycle generation that could race the final activation.
            repeated = self.call(
                "attach-coordinated-desired", "--state-dir", str(state),
                "--expected-generation", "4", "--identity", str(candidate),
                "--coordinated-cutover", str(declaration),
            )
            self.assertEqual(repeated["generation"], 4)
            other = self.write_identity(root, "runtime-c", "c")
            rejected = self.call(
                "attach-coordinated-desired", "--state-dir", str(state),
                "--expected-generation", "4", "--identity", str(other),
                "--coordinated-cutover", str(declaration), expect_ok=False,
            )
            self.assertIn("exact current desired identity", rejected.stderr)

    def test_coordinated_cutover_successor_requires_matching_graph_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            candidate_b = self.write_identity(root, "runtime-b", "b")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(candidate_b))
            identity_b = json.loads(candidate_b.read_text(encoding="utf-8"))
            declaration = root / "coordinated-cutover.json"
            declaration.write_text(json.dumps({
                "contract": "runtime-blob-coordinated-cutover.v1",
                "releaseId": "runtime-b",
                "manifestSha256": identity_b["manifestSha256"],
                "treeSha256": identity_b["treeSha256"],
                "candidateReceiptHash": "e" * 64,
            }), encoding="utf-8")
            # A declaration that does not match the desired identity is
            # rejected before the lifecycle state changes.
            mismatched = root / "coordinated-cutover-mismatch.json"
            mismatched.write_text(json.dumps({
                "contract": "runtime-blob-coordinated-cutover.v1",
                "releaseId": "runtime-c",
                "manifestSha256": identity_b["manifestSha256"],
                "treeSha256": identity_b["treeSha256"],
                "candidateReceiptHash": "e" * 64,
            }), encoding="utf-8")
            rejected_decl = self.call(
                "set-desired", "--state-dir", str(state), "--expected-generation", "2",
                "--identity", str(candidate_b), "--coordinated-cutover", str(mismatched), expect_ok=False,
            )
            self.assertIn("must match the desired identity", rejected_decl.stderr)
            self.call(
                "set-desired", "--state-dir", str(state), "--expected-generation", "2",
                "--identity", str(candidate_b), "--coordinated-cutover", str(declaration),
            )
            # Activation of the declared coordinated successor without the
            # committed graph receipt fails closed.
            rejected_activate = self.call(
                "activate", "--state-dir", str(state), "--expected-generation", "3",
                "--identity", str(candidate_b), "--host-state-script", str(HOST_STATE), expect_ok=False,
            )
            self.assertIn("--coordinated-graph-receipt", rejected_activate.stderr)
            # A graph receipt whose own content-addressed hash is forged, or
            # that binds a different candidate, is rejected.
            receipt, binding = self.coordinated_receipt_and_binding(root, identity_b, "e" * 64)
            forged = json.loads(receipt.read_text(encoding="utf-8"))
            forged["candidateReceiptHash"] = "9" * 64
            forged_path = root / "graph-receipt-forged.json"
            forged_path.write_text(json.dumps(forged), encoding="utf-8")
            rejected_forged = self.call(
                "activate", "--state-dir", str(state), "--expected-generation", "3",
                "--identity", str(candidate_b), "--host-state-script", str(HOST_STATE),
                "--coordinated-graph-receipt", str(forged_path),
                "--coordinated-runtime-binding", str(binding), expect_ok=False,
            )
            self.assertIn("does not match its own content-addressed hash", rejected_forged.stderr)
            foreign = json.loads(receipt.read_text(encoding="utf-8"))
            foreign["candidateReceiptHash"] = "9" * 64
            foreign["receiptHash"] = LIFECYCLE.coordinated_active_receipt_payload_hash(foreign)
            foreign["receiptId"] = "act-" + foreign["receiptHash"][:24]
            foreign_path = root / "graph-receipt-foreign.json"
            foreign_path.write_text(json.dumps(foreign), encoding="utf-8")
            rejected_foreign = self.call(
                "activate", "--state-dir", str(state), "--expected-generation", "3",
                "--identity", str(candidate_b), "--host-state-script", str(HOST_STATE),
                "--coordinated-graph-receipt", str(foreign_path),
                "--coordinated-runtime-binding", str(binding), expect_ok=False,
            )
            self.assertIn("different candidate", rejected_foreign.stderr)
            # A valid receipt without the runtime binding still fails closed.
            rejected_no_binding = self.call(
                "activate", "--state-dir", str(state), "--expected-generation", "3",
                "--identity", str(candidate_b), "--host-state-script", str(HOST_STATE),
                "--coordinated-graph-receipt", str(receipt), expect_ok=False,
            )
            self.assertIn("--coordinated-runtime-binding", rejected_no_binding.stderr)
            # The matching committed graph receipt and runtime binding
            # unlock the activation.
            activated = self.call(
                "activate", "--state-dir", str(state), "--expected-generation", "3",
                "--identity", str(candidate_b), "--host-state-script", str(HOST_STATE),
                "--coordinated-graph-receipt", str(receipt),
                "--coordinated-runtime-binding", str(binding),
            )
            self.assertEqual(activated["active"]["active"]["releaseId"], "runtime-b")
            # The declaration stays as evidence and constrains only the
            # release it names: an ordinary later candidate activates
            # without the coordinated gate.
            self.assertTrue((state / "coordinated-cutover.json").exists())
            candidate_d = self.write_identity(root, "runtime-d", "d")
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(candidate_d))
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "5", "--identity", str(candidate_d))
            ordinary = self.call(
                "activate", "--state-dir", str(state), "--expected-generation", "6",
                "--identity", str(candidate_d), "--host-state-script", str(HOST_STATE),
            )
            self.assertEqual(ordinary["active"]["active"]["releaseId"], "runtime-d")
            # Cancelling a declared desired candidate removes the declaration.
            candidate_e = self.write_identity(root, "runtime-e", "e")
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "7", "--identity", str(candidate_e))
            identity_e = json.loads(candidate_e.read_text(encoding="utf-8"))
            declaration_e = root / "coordinated-cutover-e.json"
            declaration_e.write_text(json.dumps({
                "contract": "runtime-blob-coordinated-cutover.v1",
                "releaseId": "runtime-e",
                "manifestSha256": identity_e["manifestSha256"],
                "treeSha256": identity_e["treeSha256"],
                "candidateReceiptHash": "e" * 64,
            }), encoding="utf-8")
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "8", "--identity", str(candidate_e), "--coordinated-cutover", str(declaration_e))
            self.call("cancel-desired", "--state-dir", str(state), "--expected-generation", "9")
            self.assertFalse((state / "coordinated-cutover.json").exists())

    def test_activate_and_retire_rollback_automatically_create_leases(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            candidate_b = self.write_identity(root, "runtime-b", "b")
            candidate_c = self.write_identity(root, "runtime-c", "c")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(candidate_b))
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(candidate_b))
            self.active_transition("activate", state, 3, candidate_b, "2030-01-01T00:00:00Z")
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(candidate_c))
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "5", "--identity", str(candidate_c))
            activated = self.active_transition("activate", state, 6, candidate_c, "2030-01-01T00:00:00Z")
            self.assertEqual([item["identity"]["releaseId"] for item in activated["retained"]], ["runtime-a"])
            self.assertEqual(activated["retained"][0]["notBeforeReleaseAt"], "2030-01-01T00:05:00Z")
            swapped = self.active_transition("rollback", state, 7)
            self.assertEqual([item["identity"]["releaseId"] for item in swapped["retained"]], ["runtime-a"])
            retired = self.call("retire-rollback", "--state-dir", str(state), "--expected-generation", "8", "--now", "2030-01-01T00:10:00Z", "--signed-url-max-seconds", "600")
            self.assertEqual([item["identity"]["releaseId"] for item in retired["retained"]], ["runtime-a", "runtime-c"])
            self.assertEqual(retired["retained"][1]["notBeforeReleaseAt"], "2030-01-01T00:20:00Z")

    def test_corrupt_retention_lease_fails_closed_and_recovery_preserves_it(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            retained = self.write_identity(root, "runtime-retained", "d")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("retain", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(retained), "--now", "2030-01-01T00:00:00Z")
            journal_path = state / "act-runtime-blob-lifecycle.journal.json"
            journal = json.loads(journal_path.read_text(encoding="utf-8"))
            journal["status"] = "prepared"
            journal_path.write_text(json.dumps(journal), encoding="utf-8")
            recovered = self.call("recover", "--state-dir", str(state))
            self.assertTrue(recovered["recovered"])
            self.assertEqual(json.loads((state / "act-runtime-blob-lifecycle.v2.json").read_text(encoding="utf-8"))["retained"][0]["identity"]["releaseId"], "runtime-retained")
            lifecycle_path = state / "act-runtime-blob-lifecycle.v2.json"
            current = json.loads(lifecycle_path.read_text(encoding="utf-8"))
            current["retained"][0]["signedUrlMaxSeconds"] = 299
            lifecycle_path.write_text(json.dumps(current), encoding="utf-8")
            marker_path = state / "act-runtime-authority.v2.json"
            marker = json.loads(marker_path.read_text(encoding="utf-8"))
            marker["lifecycleSha256"] = LIFECYCLE.digest(current)
            marker_path.write_text(json.dumps(marker), encoding="utf-8")
            rejected = self.call("protected-set", "--state-dir", str(state), expect_ok=False)
            self.assertIn("signedUrlMaxSeconds", rejected.stderr)

    def test_imports_v1_active_receipt_and_divergent_desired_selector_before_v2_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active_path = self.write_identity(root, "runtime-a", "a")
            desired_path = self.write_identity(root, "runtime-b", "b")
            active = json.loads(active_path.read_text(encoding="utf-8"))
            desired = json.loads(desired_path.read_text(encoding="utf-8"))
            active_selection, active_receipt = self.write_v1_authority(root, active, generation=7)
            desired_selection, _ = self.write_v1_authority(root, desired, generation=8)
            imported = self.call(
                "initialize-v2-from-v1", "--state-dir", str(state),
                "--v1-active-selection-file", str(active_selection),
                "--v1-active-receipt-file", str(active_receipt),
                "--active-identity-file", str(active_path),
                "--v1-desired-selection-file", str(desired_selection),
                "--desired-identity-file", str(desired_path),
            )
            self.assertEqual(imported["generation"], 1)
            self.assertEqual(imported["active"]["releaseId"], "runtime-a")
            self.assertEqual(imported["desired"]["releaseId"], "runtime-b")
            protected = self.call("protected-set", "--state-dir", str(state))
            self.assertEqual(protected["releaseIds"], ["runtime-a", "runtime-b"])

    def test_v1_import_rejects_identity_mismatch_or_unclosed_desired_divergence_before_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            active_path = self.write_identity(root, "runtime-a", "a")
            wrong_path = self.write_identity(root, "runtime-b", "b")
            active = json.loads(active_path.read_text(encoding="utf-8"))
            wrong = json.loads(wrong_path.read_text(encoding="utf-8"))
            active_selection, active_receipt = self.write_v1_authority(root, active)
            mismatch = self.call(
                "initialize-v2-from-v1", "--state-dir", str(root / "mismatch"),
                "--v1-active-selection-file", str(active_selection),
                "--v1-active-receipt-file", str(active_receipt),
                "--active-identity-file", str(wrong_path), expect_ok=False,
            )
            self.assertIn("does not bind", mismatch.stderr)
            self.assertFalse((root / "mismatch" / "act-runtime-authority.v2.json").exists())
            desired_selection, _ = self.write_v1_authority(root, wrong, generation=2)
            missing_desired = self.call(
                "initialize-v2-from-v1", "--state-dir", str(root / "missing-desired"),
                "--v1-active-selection-file", str(active_selection),
                "--v1-active-receipt-file", str(active_receipt),
                "--active-identity-file", str(active_path),
                "--v1-desired-selection-file", str(desired_selection), expect_ok=False,
            )
            self.assertIn("desired-identity-file", missing_desired.stderr)

    def test_resumes_v2_from_verified_v1_rollback_without_deleting_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            v1_active = self.write_identity(root, "runtime-v1", "d")
            v2_active = self.write_identity(root, "runtime-v2", "e")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(v1_active))
            v1_selection, v1_receipt = self.write_v1_state(root)
            rolled = self.call(
                "rollback-to-v1",
                "--state-dir", str(state),
                "--expected-generation", "1",
                "--v1-selection-file", str(v1_selection),
                "--v1-active-receipt-file", str(v1_receipt),
            )
            self.assertEqual(rolled["mode"], "v1-rollback")
            self.assertEqual(rolled["generation"], 2)
            resumed = self.call(
                "resume-v2-from-v1-rollback",
                "--state-dir", str(state),
                "--expected-generation", "2",
                "--v1-selection-file", str(v1_selection),
                "--v1-active-receipt-file", str(v1_receipt),
                "--active-identity", str(v2_active),
            )
            self.assertEqual(resumed["generation"], 3)
            self.assertEqual(resumed["active"]["releaseId"], "runtime-v2")
            marker = json.loads((state / "act-runtime-authority.v2.json").read_text(encoding="utf-8"))
            self.assertEqual(marker["mode"], "v2")
            self.assertEqual(marker["generation"], 3)
            rejected = self.call(
                "resume-v2-from-v1-rollback",
                "--state-dir", str(state),
                "--expected-generation", "3",
                "--v1-selection-file", str(v1_selection),
                "--v1-active-receipt-file", str(v1_receipt),
                "--active-identity", str(v1_active),
                expect_ok=False,
            )
            self.assertIn("v1 rollback authority marker is absent", rejected.stderr)

    def test_resumes_v2_from_v1_rollback_preserving_rollback_publishing_and_retained(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            state = root / "state"
            active = self.write_identity(root, "runtime-a", "a")
            candidate = self.write_identity(root, "runtime-b", "b")
            publishing = self.write_identity(root, "runtime-c", "c")
            retained = self.write_identity(root, "runtime-d", "d")
            self.call("initialize-v2", "--state-dir", str(state), "--active-identity", str(active))
            self.call("retain", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(retained), "--now", "2030-01-01T00:00:00Z")
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(publishing))
            self.call("begin-publish", "--state-dir", str(state), "--expected-generation", "3", "--identity", str(candidate))
            self.call("set-desired", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(candidate))
            self.active_transition("activate", state, 5, candidate)
            v1_selection, v1_receipt = self.write_v1_state(root)
            rolled = self.call(
                "rollback-to-v1",
                "--state-dir", str(state),
                "--expected-generation", "6",
                "--v1-selection-file", str(v1_selection),
                "--v1-active-receipt-file", str(v1_receipt),
            )
            self.assertEqual(rolled["generation"], 7)
            resumed = self.call(
                "resume-v2-from-v1-rollback",
                "--state-dir", str(state),
                "--expected-generation", "7",
                "--v1-selection-file", str(v1_selection),
                "--v1-active-receipt-file", str(v1_receipt),
                "--active-identity", str(candidate),
            )
            self.assertEqual(resumed["generation"], 8)
            self.assertEqual(resumed["active"]["releaseId"], "runtime-b")
            self.assertEqual(resumed["rollback"]["releaseId"], "runtime-a")
            self.assertEqual([item["releaseId"] for item in resumed["publishing"]], ["runtime-c"])
            self.assertEqual([item["identity"]["releaseId"] for item in resumed["retained"]], ["runtime-d"])
            protected = self.call("protected-set", "--state-dir", str(state))
            self.assertEqual(protected["releaseIds"], ["runtime-a", "runtime-b", "runtime-c", "runtime-d"])


if __name__ == "__main__":
    unittest.main()
