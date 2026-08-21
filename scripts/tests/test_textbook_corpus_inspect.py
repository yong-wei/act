import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LIFECYCLE_PATH = ROOT / "scripts/runtime-release/runtime-blob-release-lifecycle.py"
INSPECT_PATH = ROOT / "scripts/runtime-release/inspect-textbook-corpus.py"
REQUIRED_RUNTIME = [
    "manifest.json",
    "navigation.json",
    "units.jsonl",
    "anchors.jsonl",
    "windows.jsonl",
    "anomalies.jsonl",
    "samples.jsonl",
]
REQUIRED_INDEX = [
    "manifest.json",
    "windows.jsonl",
    "bodies.utf8",
    "vectors.f32",
    "lexical-terms.jsonl",
    "lexical-postings.bin",
    "build-report.json",
]

LIFECYCLE_SPEC = importlib.util.spec_from_file_location("lifecycle_for_corpus_inspect", str(LIFECYCLE_PATH))
LIFECYCLE = importlib.util.module_from_spec(LIFECYCLE_SPEC)
LIFECYCLE_SPEC.loader.exec_module(LIFECYCLE)
INSPECT_SPEC = importlib.util.spec_from_file_location("textbook_corpus_inspect", str(INSPECT_PATH))
INSPECT = importlib.util.module_from_spec(INSPECT_SPEC)
INSPECT_SPEC.loader.exec_module(INSPECT)


def identity(release_id, seed):
    return {
        "schemaVersion": "runtime-blob-release-identity.v1",
        "releaseId": release_id,
        "manifestVersion": "act-runtime-release.v2",
        "manifestSha256": seed * 64,
        "manifestWireSha256": ("1" if seed != "1" else "2") * 64,
        "manifestWireSizeBytes": 10,
        "treeSha256": ("3" if seed != "3" else "4") * 64,
    }


def write_book(runtime_root: Path, book_id: str, revision: str) -> None:
    book = runtime_root / book_id
    book.mkdir(parents=True)
    for name in REQUIRED_RUNTIME:
        if name == "manifest.json":
            (book / name).write_text(json.dumps({
                "recordType": "export-manifest",
                "schemaVersion": "structured-textbook-runtime.v2",
                "bookId": book_id,
                "edition": "1",
                "sourceRevision": revision,
                "sourceHashes": {"textbooks/%s/chapter-01/textbook.md" % book_id: "sha256:" + "1" * 64},
            }), encoding="utf-8")
        else:
            (book / name).write_text("", encoding="utf-8")


def write_index(index_root: Path, runtime_root: Path, book_ids, revision: str, resource_set_id: str) -> None:
    index_root.mkdir(parents=True)
    books = []
    for book_id in book_ids:
        manifest_path = runtime_root / book_id / "manifest.json"
        digest = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        books.append({
            "bookId": book_id,
            "edition": "1",
            "manifestHash": "sha256:" + digest,
            "sourceHashes": {"textbooks/%s/chapter-01/textbook.md" % book_id: "sha256:" + "1" * 64},
        })
    for name in REQUIRED_INDEX:
        if name == "manifest.json":
            (index_root / name).write_text(json.dumps({
                "recordType": "index-manifest",
                "formatVersion": "textbook-hybrid-retrieval.v1",
                "sourceRevision": revision,
                "resourceSetId": resource_set_id,
                "books": books,
            }), encoding="utf-8")
        else:
            (index_root / name).write_text("", encoding="utf-8")


def write_view(view: Path, ident, book_ids, revision: str, schema="v1") -> None:
    view.mkdir(parents=True)
    (view / ".act-runtime-release.v2.json").write_text(json.dumps({
        "releaseId": ident["releaseId"],
        "manifestSha256": ident["manifestSha256"],
        "treeSha256": ident["treeSha256"],
    }), encoding="utf-8")
    runtime = view / "resources" / "textbooks-v2"
    runtime.mkdir(parents=True)
    for book_id in book_ids:
        write_book(runtime, book_id, revision)
    if schema == "v1":
        provenance = {
            "schemaVersion": "act.textbook-runtime-input-provenance.v1",
            "sourceRevision": revision,
            "inputDigest": "a" * 64,
            "inputFileCount": 2,
        }
        resource_set_id = "historical"
    else:
        from hashlib import sha256
        identity_json = json.dumps({"bookIds": list(book_ids), "resourceSetId": "current-authoring-bundle-v1"}, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        provenance = {
            "schemaVersion": "act.textbook-runtime-input-provenance.v2",
            "authoringSourceRevision": revision,
            "resourceSetId": "current-authoring-bundle-v1",
            "bookIds": list(book_ids),
            "resourceSetDigest": sha256(identity_json.encode("utf-8")).hexdigest(),
            "inputDigest": "a" * 64,
            "inputFileCount": 2,
            "generator": {"id": "act-textbook-runtime-v2-generator", "version": "v2"},
        }
        resource_set_id = "current-authoring-bundle-v1"
    (runtime / "input-provenance.json").write_text(json.dumps(provenance), encoding="utf-8")
    write_index(view / "resources" / "textbook-hybrid-retrieval" / "bge-m3", runtime, book_ids, revision, resource_set_id)


class TextbookCorpusInspectTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.state = self.root / "state"
        self.active = identity("runtime-active", "a")
        self.rollback = identity("runtime-rollback", "b")
        after = LIFECYCLE.lifecycle({
            "schemaVersion": "runtime-blob-release-lifecycle.v2",
            "generation": 2,
            "transactionId": "b" * 32,
            "desired": None,
            "active": self.active,
            "rollback": self.rollback,
            "publishing": [],
            "retained": [],
        })
        LIFECYCLE.transaction(self.state, after)
        self.revision = "a" * 40
        self.active_books = ["control-encyclopedia", "hu-shousong-exercise-analysis-3rd"]
        self.rollback_books = [
            "control-encyclopedia",
            "dorf-modern-control-systems",
            "hu-shousong-exercise-analysis-3rd",
        ]
        self.active_view = self.root / "active-view"
        self.rollback_view = self.root / "rollback-view"
        write_view(self.active_view, self.active, self.active_books, self.revision, schema="v1")
        write_view(self.rollback_view, self.rollback, self.rollback_books, self.revision, schema="v1")

    def tearDown(self):
        self.temp.cleanup()

    def inspect(self, role, view, expect_ok=True):
        args = argparse_namespace(self.state, view, role)
        if expect_ok:
            return INSPECT.inspect(args)
        with self.assertRaises(ValueError):
            INSPECT.inspect(args)
        return None

    def test_active_and_rollback_are_not_unioned(self):
        active = self.inspect("active", self.active_view)
        rollback = self.inspect("rollback", self.rollback_view)
        self.assertEqual(active["lifecycleState"], "active")
        self.assertEqual(rollback["lifecycleState"], "rollback")
        self.assertEqual(sorted(active["bookIds"]), sorted(self.active_books))
        self.assertEqual(sorted(rollback["bookIds"]), sorted(self.rollback_books))
        self.assertNotEqual(set(active["bookIds"]), set(rollback["bookIds"]))
        self.assertEqual(active["provenanceGeneration"], "legacy")
        encoded = json.dumps(active) + json.dumps(rollback)
        self.assertNotRegex(encoded, r"objectKey|/home/|AccessKey|blob-releases/")

    def test_exactly_one_active_corpus(self):
        active = self.inspect("active", self.active_view)
        rollback = self.inspect("rollback", self.rollback_view)
        states = [active["lifecycleState"], rollback["lifecycleState"]]
        self.assertEqual(states.count("active"), 1)

    def test_lifecycle_drift_fails_closed(self):
        original = INSPECT.run_node_inspect

        def mutate_then_inspect(view_root):
            after = LIFECYCLE.lifecycle({
                **LIFECYCLE.read_v2(self.state),
                "generation": 3,
                "transactionId": "c" * 32,
            })
            marker = {
                "schemaVersion": "runtime-release-authority.v2",
                "mode": "v2",
                "generation": after["generation"],
                "lifecycleSha256": LIFECYCLE.digest(after),
            }
            LIFECYCLE.write_atomic(self.state / "act-runtime-blob-lifecycle.v2.json", after)
            LIFECYCLE.write_atomic(self.state / "act-runtime-authority.v2.json", marker)
            return original(view_root)

        INSPECT.run_node_inspect = mutate_then_inspect
        try:
            with self.assertRaises(ValueError) as raised:
                INSPECT.inspect(argparse_namespace(self.state, self.active_view, "active"))
            self.assertIn("drifted", str(raised.exception))
        finally:
            INSPECT.run_node_inspect = original


def argparse_namespace(state, view, role_name):
    class Args:
        state_dir = str(state)
        view_root = str(view)
        role = role_name
        release_id = None
    return Args()


if __name__ == "__main__":
    unittest.main()
