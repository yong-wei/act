import json
import os
import stat
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INSTALLER = ROOT / "scripts/knowledge-cutover/install-successor-control-plane-overlays.py"


def write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(value, bytes):
        path.write_bytes(value)
    else:
        path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(path, 0o644)


def pointer(projection_id: str, projection_hash: str, release_id: str) -> dict:
    return {
        "contract": "act-teaching-projection-current/v1",
        "projectionId": projection_id,
        "projectionHash": projection_hash,
        "authorityReleaseId": release_id,
        "activatedAt": "2026-08-26T07:21:00.000Z",
    }


def catalog_pointer(catalog_id: str, catalog_hash: str, snapshot: str, release_id: str) -> dict:
    return {
        "contract": "act-authority-domain-display-catalog-current/v1",
        "catalogId": catalog_id,
        "catalogHash": catalog_hash,
        "snapshotId": "snap-" + snapshot,
        "snapshotHash": snapshot,
        "releaseId": release_id,
        "activatedAt": "2026-08-26T07:16:00.000Z",
    }


def shard_pointer(shard_set_id: str, shard_set_hash: str, catalog_id: str, catalog_hash: str, snapshot: str, release_id: str) -> dict:
    return {
        "contract": "act-authority-domain-shard-current/v1",
        "shardSetId": shard_set_id,
        "shardSetHash": shard_set_hash,
        "snapshotId": "snap-" + snapshot,
        "snapshotHash": snapshot,
        "releaseId": release_id,
        "catalogId": catalog_id,
        "catalogHash": catalog_hash,
        "teachingProjectionId": None,
        "teachingProjectionHash": None,
        "activatedAt": "2026-08-26T07:19:00.000Z",
    }


def prereq_pointer(publication_id: str, publication_hash: str, release_id: str) -> dict:
    return {
        "contract": "act-teaching-prerequisite-current/v1",
        "publicationId": publication_id,
        "publicationHash": publication_hash,
        "authorityReleaseId": release_id,
        "activatedAt": "2026-08-26T07:21:00.000Z",
    }


def domain_teaching_pointer(projection_id: str, projection_hash: str, release_id: str) -> dict:
    return {
        "contract": "act-domain-teaching-projection-current/v1",
        "projectionId": projection_id,
        "projectionHash": projection_hash,
        "authorityReleaseId": release_id,
        "authorityDigest": "c" * 64,
        "teachingCacheFamily": "teaching-domain-proj:%s:%s" % (projection_id, projection_hash[:16]),
        "activatedAt": "2026-08-30T05:18:28.334Z",
    }


def activation_pointer(activation_id: str, activation_hash: str, receipt_id: str) -> dict:
    return {
        "contract": "act-versioned-knowledge-consumer-activation-current/v1",
        "activationId": activation_id,
        "activationHash": activation_hash,
        "activationReceiptId": receipt_id,
        "activatedAt": "2026-08-26T07:21:00.000Z",
    }


def catalog_runtime(catalog_id: str, catalog_hash: str, snapshot: str, release_id: str) -> dict:
    return {
        "catalogId": catalog_id,
        "catalogHash": catalog_hash,
        "authorityBinding": {
            "snapshotId": "snap-" + snapshot,
            "snapshotHash": snapshot,
            "releaseId": release_id,
        },
    }


class InstallSuccessorControlPlaneOverlaysTest(unittest.TestCase):
    def run_installer(self, *args: str):
        import subprocess
        completed = subprocess.run(
            ["python3", str(INSTALLER), *args],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            raise AssertionError(completed.stderr or completed.stdout)
        return json.loads(completed.stdout)

    def populate_source(self, source: Path, identities: dict) -> None:
        write(source / "knowledge/projection/current.json", pointer(
            identities["projectionId"], identities["projectionHash"], identities["releaseId"],
        ))
        write(source / "knowledge/prerequisites/current.json", prereq_pointer(
            identities["publicationId"], identities["publicationHash"], identities["releaseId"],
        ))
        write(source / "knowledge/authority-domain-catalog/current.json", catalog_pointer(
            identities["catalogId"], identities["catalogHash"], identities["snapshot"], identities["releaseId"],
        ))
        write(source / "knowledge/authority-domain-catalog/catalog.json", catalog_runtime(
            identities["catalogId"], identities["catalogHash"], identities["snapshot"], identities["releaseId"],
        ))
        write(source / "knowledge/authority-domain-shards/current.json", shard_pointer(
            identities["shardSetId"], identities["shardSetHash"], identities["catalogId"],
            identities["catalogHash"], identities["snapshot"], identities["releaseId"],
        ))
        write(source / "knowledge/consumer-activation/current.json", activation_pointer(
            identities["activationId"], identities["activationHash"], identities["receiptId"],
        ))
        write(
            source / "knowledge/consumer-activation/activations" / (identities["receiptId"] + ".json"),
            {"activationReceiptId": identities["receiptId"]},
        )
        write(
            source / "knowledge/projection/releases" / identities["projectionId"] / "projection-manifest.json",
            {"projectionId": identities["projectionId"]},
        )
        write(
            source / "knowledge/prerequisites/releases" / identities["publicationId"] / "publication-manifest.json",
            {"publicationId": identities["publicationId"]},
        )
        write(
            source / "knowledge/authority-domain-shards/sets" / identities["shardSetId"] / "manifest.json",
            {"shardSetId": identities["shardSetId"]},
        )
        write(
            source / "knowledge/consumer-activation/releases" / identities["activationId"] / "activation.json",
            {"activationId": identities["activationId"]},
        )

    def test_replaces_predecessor_overlays_and_keeps_successor_blob_payloads(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            view = root / "view"
            source = root / "source"
            predecessor = {
                "projectionId": "proj-" + ("1" * 64),
                "projectionHash": "1" * 64,
                "publicationId": "proj-" + ("2" * 64),
                "publicationHash": "2" * 64,
                "catalogId": "adc-" + ("3" * 64),
                "catalogHash": "3" * 64,
                "snapshot": "4" * 64,
                "releaseId": "ctr:release:control-theory-engineering-v0.22",
                "shardSetId": "ads-" + ("5" * 64),
                "shardSetHash": "5" * 64,
                "activationId": "activation-v022",
                "activationHash": "6" * 64,
                "receiptId": "v022-cutover-consumers",
            }
            successor = {
                "projectionId": "proj-" + ("a" * 64),
                "projectionHash": "a" * 64,
                "publicationId": "proj-" + ("b" * 64),
                "publicationHash": "b" * 64,
                "catalogId": "adc-" + ("c" * 64),
                "catalogHash": "c" * 64,
                "snapshot": "d" * 64,
                "releaseId": "ctr:release:control-theory-engineering-v0.37",
                "shardSetId": "ads-" + ("e" * 64),
                "shardSetHash": "e" * 64,
                "activationId": "activation-v037",
                "activationHash": "f" * 64,
                "receiptId": "coordinated-r4-c6-presentation-evidence-v022",
            }
            self.populate_source(view, predecessor)
            self.populate_source(source, successor)
            successor_payload = view / "knowledge/projection/releases" / successor["projectionId"] / "projection-manifest.json"
            successor_payload.parent.mkdir(parents=True, exist_ok=True)
            blob = root / "blob"
            blob.write_bytes(b'{"projectionId":"successor"}\n')
            os.symlink(str(blob), successor_payload)
            (view / "knowledge/prerequisites/releases" / successor["publicationId"]).mkdir(parents=True, exist_ok=True)
            os.symlink(
                str(blob),
                view / "knowledge/prerequisites/releases" / successor["publicationId"] / "publication-manifest.json",
            )
            (view / "knowledge/authority-domain-shards/sets" / successor["shardSetId"]).mkdir(parents=True, exist_ok=True)
            os.symlink(
                str(blob),
                view / "knowledge/authority-domain-shards/sets" / successor["shardSetId"] / "manifest.json",
            )
            (view / "knowledge/consumer-activation/releases" / successor["activationId"]).mkdir(parents=True, exist_ok=True)
            os.symlink(
                str(blob),
                view / "knowledge/consumer-activation/releases" / successor["activationId"] / "activation.json",
            )
            os.symlink(
                str(blob),
                view / "knowledge/consumer-activation/activations" / (successor["receiptId"] + ".json"),
            )
            domain_projection_id = "proj-" + ("9" * 64)
            write(source / "knowledge/teaching-projection/domain-fragments/current.json", domain_teaching_pointer(
                domain_projection_id, "9" * 64, successor["releaseId"],
            ))
            write(
                source / "knowledge/teaching-projection/domain-fragments/releases" / domain_projection_id / "composed-manifest.json",
                {"projectionId": domain_projection_id, "projectionHash": "9" * 64},
            )

            result = self.run_installer(
                "--view", str(view),
                "--source", str(source),
                "--expected-authority-release-id", successor["releaseId"],
                "--expected-teaching-projection-hash", successor["projectionHash"],
                "--apply",
            )
            self.assertTrue(result["applied"])
            installed = json.loads((view / "knowledge/projection/current.json").read_text(encoding="utf-8"))
            self.assertEqual(installed["projectionHash"], successor["projectionHash"])
            self.assertFalse((view / "knowledge/projection/releases" / predecessor["projectionId"] / "projection-manifest.json").exists())
            self.assertFalse((view / "knowledge/consumer-activation/activations" / (predecessor["receiptId"] + ".json")).exists())
            self.assertTrue((view / "knowledge/projection/releases" / successor["projectionId"] / "projection-manifest.json").is_symlink())
            catalog = json.loads((view / "knowledge/authority-domain-catalog/catalog.json").read_text(encoding="utf-8"))
            self.assertEqual(catalog["catalogHash"], successor["catalogHash"])
            domain_pointer = json.loads(
                (view / "knowledge/teaching-projection/domain-fragments/current.json").read_text(encoding="utf-8"),
            )
            self.assertEqual(domain_pointer["projectionHash"], "9" * 64)
            self.assertTrue(
                (view / "knowledge/teaching-projection/domain-fragments/releases" / domain_projection_id / "composed-manifest.json").is_file(),
            )

    def test_refuses_source_bound_to_predecessor_authority(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            view = root / "view"
            source = root / "source"
            identities = {
                "projectionId": "proj-" + ("1" * 64),
                "projectionHash": "1" * 64,
                "publicationId": "proj-" + ("2" * 64),
                "publicationHash": "2" * 64,
                "catalogId": "adc-" + ("3" * 64),
                "catalogHash": "3" * 64,
                "snapshot": "4" * 64,
                "releaseId": "ctr:release:control-theory-engineering-v0.22",
                "shardSetId": "ads-" + ("5" * 64),
                "shardSetHash": "5" * 64,
                "activationId": "activation-v022",
                "activationHash": "6" * 64,
                "receiptId": "v022-cutover-consumers",
            }
            self.populate_source(view, identities)
            self.populate_source(source, identities)
            import subprocess
            completed = subprocess.run(
                [
                    "python3", str(INSTALLER),
                    "--view", str(view),
                    "--source", str(source),
                    "--expected-authority-release-id", "ctr:release:control-theory-engineering-v0.37",
                    "--expected-teaching-projection-hash", "a" * 64,
                ],
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(completed.returncode, 0)
            self.assertIn("expected successor", completed.stderr)


if __name__ == "__main__":
    unittest.main()
