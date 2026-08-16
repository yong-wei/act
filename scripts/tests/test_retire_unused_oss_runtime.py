import hashlib
import importlib.util
import json
import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/retire-unused-oss-runtime.py"
LIFECYCLE_SCRIPT = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
MATERIALIZATION_TEST = ROOT / "scripts/tests/test_runtime_blob_materialization.py"


def load_fixture_module():
    spec = importlib.util.spec_from_file_location("materialization_fixture", str(MATERIALIZATION_TEST))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


FIXTURE = load_fixture_module()
LIFECYCLE_SPEC = importlib.util.spec_from_file_location("runtime_blob_lifecycle_for_retirement_test", str(LIFECYCLE_SCRIPT))
LIFECYCLE = importlib.util.module_from_spec(LIFECYCLE_SPEC)
LIFECYCLE_SPEC.loader.exec_module(LIFECYCLE)


def lifecycle_identity(release_id, seed):
    return {
        "schemaVersion": "runtime-blob-release-identity.v1",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestSha256": seed * 64,
        "manifestWireSha256": ("a" if seed != "a" else "b") * 64,
        "manifestWireSizeBytes": 10,
        "treeSha256": ("c" if seed != "c" else "d") * 64,
    }

FAKE_OSSUTIL = r"""#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

root = Path(os.environ["FAKE_OSS_ROOT"])
args = sys.argv[1:]
if args[:1] != ["api"]:
    sys.exit(10)
api = args[1]
bucket = args[args.index("--bucket") + 1]
if bucket != os.environ.get("FAKE_OSS_BUCKET", "test-bucket"):
    sys.exit(11)

def object_path(key):
    return root.joinpath(*key.split("/"))

def list_objects(prefix):
    entries = []
    if root.exists():
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            key = path.relative_to(root).as_posix()
            if key.startswith(prefix):
                entries.append({"Key": key, "Size": str(path.stat().st_size)})
    entries.sort(key=lambda item: item["Key"])
    token = args[args.index("--continuation-token") + 1] if "--continuation-token" in args else None
    start = int(token) if token else 0
    page_size = int(os.environ.get("FAKE_PAGE_SIZE", "1000"))
    page = entries[start:start + page_size]
    payload = {
        "Contents": page[0] if len(page) == 1 else page,
        "IsTruncated": "true" if start + len(page) < len(entries) else "false",
        "KeyCount": str(len(page)),
        "Name": bucket,
        "Prefix": prefix,
    }
    if payload["IsTruncated"] == "true":
        payload["NextContinuationToken"] = str(start + len(page))
    if os.environ.get("FAKE_OUTSIDE") == "1" and prefix == "runtime/releases/":
        payload["Contents"] = (page if isinstance(payload["Contents"], list) else [payload["Contents"]]) + [
            {"Key": "runtime/blobs/sha256/" + ("0" * 64), "Size": "1"}
        ]
        payload["KeyCount"] = str(int(payload["KeyCount"]) + 1)
    sys.stdout.write(json.dumps(payload))

if api == "list-objects-v2":
    list_objects(args[args.index("--prefix") + 1])
elif api == "get-object":
    path = object_path(args[args.index("--key") + 1])
    sys.stdout.buffer.write(path.read_bytes())
elif api == "delete-object":
    path = object_path(args[args.index("--key") + 1])
    if path.exists():
        path.unlink()
    sys.stdout.write("{}")
elif api == "delete-multiple-objects":
    spec = args[args.index("--delete") + 1]
    if not spec.startswith("file://"):
        sys.exit(13)
    payload = json.loads(Path(spec[7:]).read_text(encoding="utf-8"))
    deleted = []
    for item in payload.get("Object", []):
        path = object_path(item["Key"])
        if path.exists():
            path.unlink()
        deleted.append({"Key": item["Key"]})
    sys.stdout.write(json.dumps({"Deleted": deleted}))
else:
    sys.exit(12)
"""


class RetireUnusedOssRuntimeTests(unittest.TestCase):
    def write_oss(self, root: Path, key: str, body: bytes) -> None:
        path = root.joinpath(*key.split("/"))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)

    def proof(self, directory: Path, active: str, rollback: str, extra=None) -> Path:
        payload = {
            "schemaVersion": "act-runtime-unused-oss-retirement-serving-proof.v1",
            "mode": "v2",
            "activeReleaseId": active,
            "rollbackReleaseId": rollback,
            "readyzHttpStatus": 200,
            "v1OssfsMounted": False,
        }
        if extra:
            payload["protectedReleaseIds"] = extra
        path = directory / "serving-proof.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        return path

    def call(self, *args, env=None, expect_ok=True):
        result = subprocess.run(
            ["python3", str(SCRIPT), *args],
            text=True,
            capture_output=True,
            env=env or os.environ.copy(),
        )
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def write_lifecycle(self, directory: Path, active: str, rollback: str, publishing=None):
        state = directory / "state"
        after = {
            "schemaVersion": "runtime-blob-release-lifecycle.v2",
            "generation": 1,
            "transactionId": "a" * 32,
            "desired": None,
            "active": lifecycle_identity(active, "a"),
            "rollback": lifecycle_identity(rollback, "b"),
            "publishing": [
                lifecycle_identity(item, chr(ord("c") + index))
                for index, item in enumerate(publishing or [])
            ],
            "retained": [],
        }
        LIFECYCLE.transaction(state, after)
        return state

    def common_args(self, store, proof, state):
        return [
            "--bucket", "test-bucket",
            "--state-dir", str(state),
            "--expected-active-release", store["active"],
            "--expected-rollback-release", store["rollback"],
            "--serving-proof", str(proof),
            "--ossutil-path", str(store["fake"]),
        ]

    def setup_store(self, directory: Path):
        oss = directory / "oss"
        oss.mkdir()
        scratch = directory / "scratch"
        scratch.mkdir()
        active_root = scratch / "active"
        rollback_root = scratch / "rollback"
        stale_root = scratch / "stale"
        blob_root, active_manifest, active_receipt, active_id = FIXTURE.write_release(
            active_root, {"lessons/1-1/active.txt": b"active-body"}
        )
        _, rollback_manifest, rollback_receipt, rollback_id = FIXTURE.write_release(
            rollback_root, {"lessons/1-1/rollback.txt": b"rollback-body", "shared.txt": b"shared-body"}
        )
        _, stale_manifest, stale_receipt, stale_id = FIXTURE.write_release(
            stale_root, {"lessons/1-1/stale.txt": b"stale-body"}
        )
        shared_sha = hashlib.sha256(b"shared-body").hexdigest()
        self.write_oss(oss, "runtime/blob-releases/%s/manifest.json" % active_id, active_manifest.read_bytes())
        self.write_oss(oss, "runtime/blob-releases/%s/receipt.json" % active_id, active_receipt.read_bytes())
        self.write_oss(oss, "runtime/blob-releases/%s/manifest.json" % rollback_id, rollback_manifest.read_bytes())
        self.write_oss(oss, "runtime/blob-releases/%s/receipt.json" % rollback_id, rollback_receipt.read_bytes())
        self.write_oss(oss, "runtime/blob-releases/%s/manifest.json" % stale_id, stale_manifest.read_bytes())
        self.write_oss(oss, "runtime/blob-releases/%s/receipt.json" % stale_id, stale_receipt.read_bytes())
        for source in (active_root / "blobs", rollback_root / "blobs", stale_root / "blobs"):
            for blob in source.iterdir():
                self.write_oss(oss, "runtime/blobs/sha256/%s" % blob.name, blob.read_bytes())
        self.write_oss(oss, "runtime/releases/runtime-old/lesson.json", b"legacy")
        self.write_oss(oss, "runtime/releases/runtime-old/media.bin", b"12345")
        self.write_oss(oss, "runtime/releases/runtime-old/knowledge/cards/nodes/A_D转换器.md", b"card")
        fake = directory / "fake-ossutil"
        fake.write_text(FAKE_OSSUTIL, encoding="utf-8")
        os.chmod(fake, stat.S_IRWXU)
        return {
            "oss": oss,
            "fake": fake,
            "active": active_id,
            "rollback": rollback_id,
            "stale": stale_id,
            "shared": shared_sha,
        }

    def test_plan_lists_v1_prefixes_and_only_unreachable_blobs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = self.setup_store(root)
            state = self.write_lifecycle(root, store["active"], store["rollback"])
            proof = self.proof(root, store["active"], store["rollback"])
            plan_path = root / "plan.json"
            env = os.environ.copy()
            env["FAKE_OSS_ROOT"] = str(store["oss"])
            env["FAKE_OSS_BUCKET"] = "test-bucket"
            summary = self.call(
                "plan",
                *self.common_args(store, proof, state),
                "--output", str(plan_path),
                env=env,
            )
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            self.assertEqual(summary["v1ObjectCount"], 3)
            self.assertEqual(summary["v1TotalBytes"], 15)
            self.assertEqual(plan["v1Prefixes"][0]["prefix"], "runtime/releases/runtime-old/")
            stale_sha = hashlib.sha256(b"stale-body").hexdigest()
            self.assertEqual(plan["unreachableBlobCount"], 1)
            self.assertEqual(plan["unreachableBlobs"][0]["sha256"], stale_sha)
            protected = {item["releaseId"] for item in plan["protectedIdentities"]}
            self.assertEqual(protected, {store["active"], store["rollback"]})
            self.assertNotIn(store["shared"], [item["sha256"] for item in plan["unreachableBlobs"]])

    def test_plan_fails_closed_when_listing_escapes_v1_prefix(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = self.setup_store(root)
            state = self.write_lifecycle(root, store["active"], store["rollback"])
            proof = self.proof(root, store["active"], store["rollback"])
            env = os.environ.copy()
            env["FAKE_OSS_ROOT"] = str(store["oss"])
            env["FAKE_OSS_BUCKET"] = "test-bucket"
            env["FAKE_OUTSIDE"] = "1"
            result = self.call(
                "plan",
                *self.common_args(store, proof, state),
                "--output", str(root / "plan.json"),
                env=env,
                expect_ok=False,
            )
            self.assertIn("outside", result.stderr)

    def test_execute_requires_authorization_and_preserves_protected_objects(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = self.setup_store(root)
            state = self.write_lifecycle(root, store["active"], store["rollback"])
            proof = self.proof(root, store["active"], store["rollback"])
            plan_path = root / "plan.json"
            env = os.environ.copy()
            env["FAKE_OSS_ROOT"] = str(store["oss"])
            env["FAKE_OSS_BUCKET"] = "test-bucket"
            common = self.common_args(store, proof, state)
            self.call("plan", *common, "--output", str(plan_path), env=env)
            denied = self.call("execute", *common, "--plan", str(plan_path), "--receipt-output", str(root / "receipt.json"), env=env, expect_ok=False)
            self.assertIn("authorize-unused-oss-runtime-deletion", denied.stderr)
            receipt = self.call(
                "execute",
                *common,
                "--plan", str(plan_path),
                "--authorize-unused-oss-runtime-deletion", "yes",
                "--receipt-output", str(root / "receipt.json"),
                env=env,
            )
            self.assertEqual(receipt["deletedV1ObjectCount"], 3)
            self.assertEqual(receipt["deletedUnreachableBlobCount"], 1)
            self.assertFalse((store["oss"] / "runtime/releases/runtime-old/lesson.json").exists())
            self.assertTrue((store["oss"] / "runtime/blob-releases" / store["active"] / "manifest.json").exists())
            self.assertTrue((store["oss"] / "runtime/blob-releases" / store["rollback"] / "receipt.json").exists())
            active_sha = hashlib.sha256(b"active-body").hexdigest()
            rollback_sha = hashlib.sha256(b"rollback-body").hexdigest()
            stale_sha = hashlib.sha256(b"stale-body").hexdigest()
            self.assertTrue((store["oss"] / "runtime/blobs/sha256" / active_sha).exists())
            self.assertTrue((store["oss"] / "runtime/blobs/sha256" / rollback_sha).exists())
            self.assertTrue((store["oss"] / "runtime/blobs/sha256" / store["shared"]).exists())
            self.assertFalse((store["oss"] / "runtime/blobs/sha256" / stale_sha).exists())

    def test_plan_protects_publishing_roots_even_when_serving_proof_omits_them(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = self.setup_store(root)
            state = self.write_lifecycle(root, store["active"], store["rollback"], publishing=[store["stale"]])
            proof = self.proof(root, store["active"], store["rollback"])
            plan_path = root / "plan.json"
            env = os.environ.copy()
            env["FAKE_OSS_ROOT"] = str(store["oss"])
            env["FAKE_OSS_BUCKET"] = "test-bucket"
            self.call("plan", *self.common_args(store, proof, state), "--output", str(plan_path), env=env)
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            self.assertEqual(plan["unreachableBlobCount"], 0)
            self.assertEqual(set(plan["protectedReleaseIds"]), {store["active"], store["rollback"], store["stale"]})
            self.assertEqual(plan["lifecycleGeneration"], 1)

    def test_execute_fails_closed_when_lifecycle_generation_drifts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = self.setup_store(root)
            state = self.write_lifecycle(root, store["active"], store["rollback"])
            proof = self.proof(root, store["active"], store["rollback"])
            plan_path = root / "plan.json"
            env = os.environ.copy()
            env["FAKE_OSS_ROOT"] = str(store["oss"])
            env["FAKE_OSS_BUCKET"] = "test-bucket"
            common = self.common_args(store, proof, state)
            self.call("plan", *common, "--output", str(plan_path), env=env)
            current = LIFECYCLE.read_v2(state)
            after = dict(current)
            after["generation"] = current["generation"] + 1
            after["transactionId"] = "b" * 32
            LIFECYCLE.transaction(state, after)
            rejected = self.call(
                "execute",
                *common,
                "--plan", str(plan_path),
                "--authorize-unused-oss-runtime-deletion", "yes",
                "--receipt-output", str(root / "receipt.json"),
                env=env,
                expect_ok=False,
            )
            self.assertIn("stale", rejected.stderr)

    def test_plan_rejects_hand_filled_proof_ids_outside_the_lifecycle_set(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            store = self.setup_store(root)
            state = self.write_lifecycle(root, store["active"], store["rollback"])
            proof = self.proof(root, store["active"], store["rollback"], extra=[store["active"], store["rollback"], "runtime-not-in-lifecycle"])
            env = os.environ.copy()
            env["FAKE_OSS_ROOT"] = str(store["oss"])
            env["FAKE_OSS_BUCKET"] = "test-bucket"
            rejected = self.call(
                "plan",
                *self.common_args(store, proof, state),
                "--output", str(root / "plan.json"),
                env=env,
                expect_ok=False,
            )
            self.assertIn("subset", rejected.stderr)


if __name__ == "__main__":
    unittest.main()
