import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/runtime-blob-release-gc.py"
LIFECYCLE = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
HOST_STATE = ROOT / "scripts/runtime-release/runtime-release-host-state.py"
MATERIALIZATION_TEST = ROOT / "scripts/tests/test_runtime_blob_materialization.py"


def load_fixture_module():
    spec = importlib.util.spec_from_file_location("materialization_fixture", str(MATERIALIZATION_TEST))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


FIXTURE = load_fixture_module()


class RuntimeBlobGcTests(unittest.TestCase):
    def call(self, *args, expect_ok=True):
        result = subprocess.run(["python3", str(SCRIPT), *args], text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def release(self, root, manifests, mirror, name, body):
        release_root = root / name
        blob_root, manifest, receipt, release_id = FIXTURE.write_release(release_root, {"lessons/1-1/%s.txt" % name: body})
        target = manifests / release_id
        target.mkdir(parents=True)
        shutil.copyfile(manifest, target / "manifest.json")
        shutil.copyfile(receipt, target / "receipt.json")
        for blob in blob_root.iterdir():
            shutil.copyfile(blob, mirror / blob.name)
        raw = json.loads(manifest.read_text(encoding="utf-8"))
        return {
            "schemaVersion": "runtime-blob-release-identity.v1",
            "releaseId": release_id,
            "manifestVersion": "act-runtime-release.v2",
            "manifestSha256": raw["manifestSha256"],
            "manifestWireSha256": json.loads(receipt.read_text(encoding="utf-8"))["manifestWireSha256"],
            "manifestWireSizeBytes": len(manifest.read_bytes()),
            "treeSha256": raw["treeSha256"],
        }, raw["files"][0]

    def test_deletes_only_unreachable_blobs_from_a_generation_fenced_plan(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests = root / "manifests"
            mirror = root / "mirror"
            manifests.mkdir()
            mirror.mkdir()
            active, active_blob = self.release(root, manifests, mirror, "active", b"active")
            desired, desired_blob = self.release(root, manifests, mirror, "desired", b"desired")
            _, stale_blob = self.release(root, manifests, mirror, "stale", b"stale")
            state = root / "state"
            active_identity = root / "active.json"
            desired_identity = root / "desired.json"
            active_identity.write_text(json.dumps(active), encoding="utf-8")
            desired_identity.write_text(json.dumps(desired), encoding="utf-8")
            lifecycle = LIFECYCLE
            initialized = subprocess.run(["python3", str(lifecycle), "initialize-v2", "--state-dir", str(state), "--active-identity", str(active_identity), "--desired-identity", str(desired_identity)], text=True, capture_output=True)
            self.assertEqual(initialized.returncode, 0, initialized.stderr)
            protected = subprocess.run(["python3", str(lifecycle), "protected-set", "--state-dir", str(state)], text=True, capture_output=True)
            self.assertEqual(protected.returncode, 0, protected.stderr)
            protected = json.loads(protected.stdout)
            index = {
                "schemaVersion": "runtime-blob-gc-object-index.v1",
                "lifecycleGeneration": protected["generation"],
                "lifecycleSha256": protected["lifecycleSha256"],
                "objects": sorted([
                    {key: item[key] for key in ("objectKey", "sizeBytes", "sha256")}
                    for item in (active_blob, desired_blob, stale_blob)
                ], key=lambda item: item["objectKey"]),
            }
            index_path = root / "object-index.json"
            index_path.write_text(json.dumps(index), encoding="utf-8")
            plan_path = root / "plan.json"
            plan = self.call("plan", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--output", str(plan_path))
            self.assertEqual([entry["sha256"] for entry in plan["deleteCandidates"]], [stale_blob["sha256"]])
            receipt_path = root / "receipt.json"
            receipt = self.call("execute", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--plan", str(plan_path), "--delete-root", str(mirror), "--receipt-output", str(receipt_path))
            self.assertEqual(len(receipt["deleted"]), 1)
            self.assertEqual(receipt["plannedDeleteCandidates"], plan["deleteCandidates"])
            self.assertEqual(receipt["protectedReleaseIds"], plan["protectedReleaseIds"])
            self.assertEqual(receipt["postOperation"]["verifiedProtectedBlobCount"], 2)
            self.assertEqual(json.loads(receipt_path.read_text(encoding="utf-8")), receipt)
            self.assertFalse((mirror / stale_blob["sha256"]).exists())
            self.assertTrue((mirror / active_blob["sha256"]).exists())
            self.assertTrue((mirror / desired_blob["sha256"]).exists())
            advanced = subprocess.run(["python3", str(lifecycle), "activate-and-project", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(desired_identity), "--host-state-script", str(HOST_STATE)], text=True, capture_output=True)
            self.assertEqual(advanced.returncode, 0, advanced.stderr)
            stale = self.call("execute", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--plan", str(plan_path), "--delete-root", str(mirror), "--receipt-output", str(root / "stale-receipt.json"), expect_ok=False)
            self.assertIn("fenced", stale.stderr)

    def test_protects_all_lifecycle_roots_and_never_deletes_release_manifests(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests = root / "manifests"
            mirror = root / "mirror"
            manifests.mkdir()
            mirror.mkdir()
            releases = {}
            for name, body in (("active", b"active"), ("candidate", b"candidate"), ("publishing", b"publishing"), ("desired", b"desired"), ("retained", b"retained"), ("stale", b"stale")):
                releases[name] = self.release(root, manifests, mirror, name, body)
            state = root / "state"
            identities = {}
            for name in ("active", "candidate", "publishing", "desired", "retained"):
                path = root / (name + "-identity.json")
                path.write_text(json.dumps(releases[name][0]), encoding="utf-8")
                identities[name] = path
            lifecycle = LIFECYCLE
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "initialize-v2", "--state-dir", str(state), "--active-identity", str(identities["active"])], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "begin-publish", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(identities["candidate"])], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "set-desired", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(identities["candidate"])], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "activate-and-project", "--state-dir", str(state), "--expected-generation", "3", "--identity", str(identities["candidate"]), "--host-state-script", str(HOST_STATE)], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "begin-publish", "--state-dir", str(state), "--expected-generation", "4", "--identity", str(identities["publishing"])], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "begin-publish", "--state-dir", str(state), "--expected-generation", "5", "--identity", str(identities["desired"])], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "set-desired", "--state-dir", str(state), "--expected-generation", "6", "--identity", str(identities["desired"])], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "retain", "--state-dir", str(state), "--expected-generation", "7", "--identity", str(identities["retained"])], text=True, capture_output=True).returncode, 0)
            protected = json.loads(subprocess.run(["python3", str(lifecycle), "protected-set", "--state-dir", str(state)], text=True, capture_output=True).stdout)
            self.assertEqual(len(protected["releaseIds"]), 5)
            index = {
                "schemaVersion": "runtime-blob-gc-object-index.v1",
                "lifecycleGeneration": protected["generation"],
                "lifecycleSha256": protected["lifecycleSha256"],
                "objects": sorted([
                    {key: item[key] for key in ("objectKey", "sizeBytes", "sha256")}
                    for item in (value[1] for value in releases.values())
                ], key=lambda item: item["objectKey"]),
            }
            index_path = root / "object-index.json"
            index_path.write_text(json.dumps(index), encoding="utf-8")
            plan_path = root / "plan.json"
            plan = self.call("plan", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--output", str(plan_path))
            self.assertEqual([item["sha256"] for item in plan["deleteCandidates"]], [releases["stale"][1]["sha256"]])
            receipt = self.call("execute", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--plan", str(plan_path), "--delete-root", str(mirror), "--receipt-output", str(root / "receipt.json"))
            self.assertEqual(receipt["protectedReleaseIds"], plan["protectedReleaseIds"])
            self.assertFalse((mirror / releases["stale"][1]["sha256"]).exists())
            for name in ("active", "candidate", "publishing", "desired", "retained"):
                self.assertTrue((mirror / releases[name][1]["sha256"]).exists())
                release_id = releases[name][0]["releaseId"]
                self.assertTrue((manifests / release_id / "manifest.json").exists())
                self.assertTrue((manifests / release_id / "receipt.json").exists())

    def test_generation_drift_aborts_before_deleting_any_candidate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests = root / "manifests"
            mirror = root / "mirror"
            manifests.mkdir()
            mirror.mkdir()
            active, active_blob = self.release(root, manifests, mirror, "active", b"active")
            desired, desired_blob = self.release(root, manifests, mirror, "desired", b"desired")
            _, stale_blob = self.release(root, manifests, mirror, "stale", b"stale")
            state = root / "state"
            active_path = root / "active.json"
            desired_path = root / "desired.json"
            active_path.write_text(json.dumps(active), encoding="utf-8")
            desired_path.write_text(json.dumps(desired), encoding="utf-8")
            lifecycle = LIFECYCLE
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "initialize-v2", "--state-dir", str(state), "--active-identity", str(active_path), "--desired-identity", str(desired_path)], text=True, capture_output=True).returncode, 0)
            protected = json.loads(subprocess.run(["python3", str(lifecycle), "protected-set", "--state-dir", str(state)], text=True, capture_output=True).stdout)
            index = {
                "schemaVersion": "runtime-blob-gc-object-index.v1",
                "lifecycleGeneration": protected["generation"],
                "lifecycleSha256": protected["lifecycleSha256"],
                "objects": sorted([{key: item[key] for key in ("objectKey", "sizeBytes", "sha256")} for item in (active_blob, desired_blob, stale_blob)], key=lambda item: item["objectKey"]),
            }
            index_path = root / "object-index.json"
            index_path.write_text(json.dumps(index), encoding="utf-8")
            plan_path = root / "plan.json"
            self.call("plan", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--output", str(plan_path))
            advanced = subprocess.run(["python3", str(lifecycle), "activate-and-project", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(desired_path), "--host-state-script", str(HOST_STATE)], text=True, capture_output=True)
            self.assertEqual(advanced.returncode, 0, advanced.stderr)
            rejected = self.call("execute", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--plan", str(plan_path), "--delete-root", str(mirror), "--receipt-output", str(root / "receipt.json"), expect_ok=False)
            self.assertIn("fenced", rejected.stderr)
            self.assertTrue((mirror / stale_blob["sha256"]).exists())

    def test_rejects_malformed_object_index_before_planning(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests = root / "manifests"
            mirror = root / "mirror"
            manifests.mkdir()
            mirror.mkdir()
            active, active_blob = self.release(root, manifests, mirror, "active", b"active")
            state = root / "state"
            active_path = root / "active.json"
            active_path.write_text(json.dumps(active), encoding="utf-8")
            lifecycle = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "initialize-v2", "--state-dir", str(state), "--active-identity", str(active_path)], text=True, capture_output=True).returncode, 0)
            protected = json.loads(subprocess.run(["python3", str(lifecycle), "protected-set", "--state-dir", str(state)], text=True, capture_output=True).stdout)
            malformed = {
                "schemaVersion": "runtime-blob-gc-object-index.v1",
                "lifecycleGeneration": protected["generation"],
                "lifecycleSha256": protected["lifecycleSha256"],
                "objects": [{"objectKey": "runtime/releases/not-a-blob/manifest.json", "sizeBytes": active_blob["sizeBytes"], "sha256": active_blob["sha256"]}],
            }
            index_path = root / "object-index.json"
            index_path.write_text(json.dumps(malformed), encoding="utf-8")
            rejected = self.call("plan", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--output", str(root / "plan.json"), expect_ok=False)
            self.assertIn("non-blob", rejected.stderr)

    def test_retention_lease_protects_blob_until_explicit_post_deadline_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifests = root / "manifests"
            mirror = root / "mirror"
            manifests.mkdir()
            mirror.mkdir()
            active, active_blob = self.release(root, manifests, mirror, "active", b"active")
            retained, retained_blob = self.release(root, manifests, mirror, "retained", b"retained")
            state = root / "state"
            active_path = root / "active.json"
            retained_path = root / "retained.json"
            active_path.write_text(json.dumps(active), encoding="utf-8")
            retained_path.write_text(json.dumps(retained), encoding="utf-8")
            lifecycle = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "initialize-v2", "--state-dir", str(state), "--active-identity", str(active_path)], text=True, capture_output=True).returncode, 0)
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "retain", "--state-dir", str(state), "--expected-generation", "1", "--identity", str(retained_path), "--now", "2030-01-01T00:00:00Z"], text=True, capture_output=True).returncode, 0)
            protected = json.loads(subprocess.run(["python3", str(lifecycle), "protected-set", "--state-dir", str(state)], text=True, capture_output=True).stdout)
            index = {
                "schemaVersion": "runtime-blob-gc-object-index.v1",
                "lifecycleGeneration": protected["generation"],
                "lifecycleSha256": protected["lifecycleSha256"],
                "objects": sorted([{key: item[key] for key in ("objectKey", "sizeBytes", "sha256")} for item in (active_blob, retained_blob)], key=lambda item: item["objectKey"]),
            }
            index_path = root / "object-index.json"
            index_path.write_text(json.dumps(index), encoding="utf-8")
            plan_path = root / "plan.json"
            plan = self.call("plan", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--output", str(plan_path))
            self.assertEqual(plan["deleteCandidates"], [])
            self.assertEqual(plan["retainedLeases"][0]["notBeforeReleaseAt"], "2030-01-01T00:05:00Z")
            self.assertEqual(subprocess.run(["python3", str(lifecycle), "release-retained", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(retained_path), "--now", "2030-01-01T00:04:59Z"], text=True, capture_output=True).returncode, 1)
            released = subprocess.run(["python3", str(lifecycle), "release-retained", "--state-dir", str(state), "--expected-generation", "2", "--identity", str(retained_path), "--now", "2030-01-01T00:05:00Z"], text=True, capture_output=True)
            self.assertEqual(released.returncode, 0, released.stderr)
            protected = json.loads(subprocess.run(["python3", str(lifecycle), "protected-set", "--state-dir", str(state)], text=True, capture_output=True).stdout)
            index["lifecycleGeneration"] = protected["generation"]
            index["lifecycleSha256"] = protected["lifecycleSha256"]
            index_path.write_text(json.dumps(index), encoding="utf-8")
            plan_after_release = self.call("plan", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--output", str(root / "plan-after-release.json"))
            self.assertEqual([item["sha256"] for item in plan_after_release["deleteCandidates"]], [retained_blob["sha256"]])
            self.call("execute", "--state-dir", str(state), "--manifests-root", str(manifests), "--object-index", str(index_path), "--plan", str(root / "plan-after-release.json"), "--delete-root", str(mirror), "--receipt-output", str(root / "receipt-after-release.json"))
            self.assertFalse((mirror / retained_blob["sha256"]).exists())
            self.assertTrue((mirror / active_blob["sha256"]).exists())


if __name__ == "__main__":
    unittest.main()
