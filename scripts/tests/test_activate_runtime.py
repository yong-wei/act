#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PUBLISH = ROOT / "scripts/runtime-release/publish-runtime.py"
ACTIVATE = ROOT / "scripts/runtime-release/activate-runtime.py"
MATERIALIZE = ROOT / "scripts/runtime-release/materialize-runtime.py"
SOURCE_REVISION = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"


def load_materialize():
    spec = importlib.util.spec_from_file_location("materialize_runtime", str(MATERIALIZE))
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ActivateRuntimeTests(unittest.TestCase):
    def write_tree(self, root: Path, files: dict[str, str]) -> None:
        for relative, body in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body, encoding="utf-8")

    def run_json(self, command: list[str], expect_ok: bool = True) -> dict | subprocess.CompletedProcess[str]:
        result = subprocess.run(command, text=True, capture_output=True)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def publish(self, runtime: Path, index: Path, store: Path) -> dict:
        return self.run_json(
            [
                "python3",
                str(PUBLISH),
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--store-dir",
                str(store),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap" if not index.is_file() else None,
            ]
        )

    def publish_args(self, runtime: Path, index: Path, store: Path, bootstrap: bool) -> dict:
        args = [
            "python3",
            str(PUBLISH),
            "--root",
            str(runtime),
            "--index",
            str(index),
            "--store-dir",
            str(store),
            "--source-revision",
            SOURCE_REVISION,
        ]
        if bootstrap:
            args.append("--bootstrap")
        return self.run_json(args)

    def activate(self, store: Path, state: Path, release_id: str, *extra: str, expect_ok: bool = True):
        return self.run_json(
            [
                "python3",
                str(ACTIVATE),
                "--store-dir",
                str(store),
                "--state-dir",
                str(state),
                "--release-id",
                release_id,
                "--sentinel",
                "lessons/1-1/lesson.json",
                *extra,
            ],
            expect_ok=expect_ok,
        )

    def test_activate_then_rollback_swaps_pointers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            first_switch = self.activate(store, state, first["releaseId"])
            self.assertEqual(first_switch["current"], first["releaseId"])
            self.assertIsNone(first_switch["previous"])
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")
            self.assertEqual(os.readlink(state / "live"), f"views/{first['releaseId']}")
            self.assertEqual((state / "current" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')
            self.assertEqual((state / "live" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')
            first_receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(first_receipt["selection"]["releaseId"], first["releaseId"])
            self.assertEqual(first_receipt["selection"]["generation"], 1)
            first_view = state / "views" / first["releaseId"]
            self.assertTrue((first_view / ".act-runtime-blobs").is_dir())
            self.assertFalse((first_view / ".act-runtime-blobs").is_symlink())
            receipt = json.loads((first_view / ".act-runtime-release-materialization.v1.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["schemaVersion"], "runtime-blob-materialization.v1")
            self.assertEqual(receipt["releaseId"], first["releaseId"])

            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            self.assertNotEqual(second["releaseId"], first["releaseId"])
            second_switch = self.activate(store, state, second["releaseId"])
            self.assertEqual(second_switch["current"], second["releaseId"])
            self.assertEqual(second_switch["previous"], first["releaseId"])
            self.assertEqual(second_switch["deltaCount"], 1)
            self.assertEqual(os.readlink(state / "current"), f"views/{second['releaseId']}")
            self.assertEqual(os.readlink(state / "previous"), f"views/{first['releaseId']}")
            self.assertEqual((state / "current" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"two"}\n')
            self.assertEqual((state / "live" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"two"}\n')
            second_receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(second_receipt["selection"]["releaseId"], second["releaseId"])
            self.assertEqual(second_receipt["selection"]["generation"], 2)

            rolled = self.run_json(
                [
                    "python3",
                    str(ACTIVATE),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--rollback",
                ]
            )
            self.assertEqual(rolled["current"], first["releaseId"])
            self.assertEqual(rolled["previous"], second["releaseId"])
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")
            self.assertEqual((state / "current" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')
            self.assertEqual((state / "live" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')
            pointers = json.loads((state / "pointers.json").read_text(encoding="utf-8"))
            self.assertEqual(pointers, {"current": first["releaseId"], "previous": second["releaseId"]})
            rolled_receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(rolled_receipt["selection"]["releaseId"], first["releaseId"])
            self.assertEqual(rolled_receipt["selection"]["generation"], 3)

    def test_activate_admits_candidate_knowledge_selectors(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(
                runtime,
                {
                    "lessons/1-1/lesson.json": '{"id":"one"}\n',
                    "knowledge/consumer-activation/current.json": '{"activationId":"activation-old"}\n',
                },
            )
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "knowledge/consumer-activation/current.json").write_text(
                '{"activationId":"activation-new"}\n',
                encoding="utf-8",
            )
            second = self.publish_args(runtime, index, store, bootstrap=False)
            self.activate(store, state, second["releaseId"])
            admitted = json.loads(
                (state / "current" / "knowledge/consumer-activation/current.json").read_text(encoding="utf-8")
            )
            self.assertEqual(admitted["activationId"], "activation-new")

    def test_missing_delta_blob_leaves_current_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            blob = next((store / "runtime" / "blobs" / "sha256").iterdir())
            # Delete only the new blob; keep the first release readable.
            for item in (store / "runtime" / "blobs" / "sha256").iterdir():
                if item.name != json.loads(
                    (store / "runtime" / "blob-releases" / first["releaseId"] / "manifest.json").read_text(encoding="utf-8")
                )["files"][0]["sha256"]:
                    item.unlink()
                    blob = item
            result = self.activate(store, state, second["releaseId"], expect_ok=False)
            self.assertIn("delta blob is not visible", result.stderr)
            pointers = json.loads((state / "pointers.json").read_text(encoding="utf-8"))
            self.assertEqual(pointers["current"], first["releaseId"])
            self.assertEqual((state / "live" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')
            self.assertFalse(blob.exists())

    def test_smoke_failure_does_not_switch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            result = self.activate(
                store,
                state,
                second["releaseId"],
                "--smoke",
                "exit 7",
                expect_ok=False,
            )
            self.assertIn("application runtime smoke failed", result.stderr)
            pointers = json.loads((state / "pointers.json").read_text(encoding="utf-8"))
            self.assertEqual(pointers["current"], first["releaseId"])
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")

    def test_smoke_binds_candidate_view_and_reload_runs_after_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            reloaded = root / "reloaded"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            view = (state / "views" / second["releaseId"]).resolve()
            switched = self.activate(
                store,
                state,
                second["releaseId"],
                "--smoke",
                f'test "$RUNTIME_CONTENT_DIR" = "{view}" && test "$ACT_RUNTIME_CANDIDATE_VIEW" = "{view}"',
                "--reload-consumers",
                f"printf ok > '{reloaded}'",
            )
            self.assertEqual(switched["current"], second["releaseId"])
            self.assertEqual(reloaded.read_text(encoding="utf-8"), "ok")

    def test_failed_smoke_does_not_reload_consumers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            reloaded = root / "reloaded"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            result = self.activate(
                store,
                state,
                second["releaseId"],
                "--smoke",
                "exit 7",
                "--reload-consumers",
                f"printf ok > '{reloaded}'",
                expect_ok=False,
            )
            self.assertIn("application runtime smoke failed", result.stderr)
            self.assertFalse(reloaded.exists())
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")

    def test_production_view_root_requires_smoke(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "data" / "runtime" / "blob-views"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            missing = self.activate(store, state, first["releaseId"], expect_ok=False)
            self.assertIn("runtime smoke is required before selecting current", missing.stderr)
            self.assertFalse((state / "current").exists())
            switched = self.activate(store, state, first["releaseId"], "--smoke", "true")
            self.assertEqual(switched["current"], first["releaseId"])
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")
            self.assertTrue((state.parent / ".act-runtime-selection.lock").is_file())

    def test_require_smoke_flag_rejects_missing_command(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            result = self.activate(store, state, first["releaseId"], "--require-smoke", expect_ok=False)
            self.assertIn("runtime smoke is required before selecting current", result.stderr)

    def test_tampered_manifest_path_is_rejected_before_materialize(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            manifest_file = store / "runtime" / "blob-releases" / first["releaseId"] / "manifest.json"
            manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
            manifest["files"][0]["path"] = "../escape.txt"
            manifest_file.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            result = self.activate(store, state, first["releaseId"], expect_ok=False)
            self.assertIn("invalid runtime path", result.stderr)
            self.assertFalse((root / "escape.txt").exists())
            self.assertFalse((state / "current").exists())

    def test_reload_failure_restores_previous_current(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            result = self.activate(
                store,
                state,
                second["releaseId"],
                "--reload-consumers",
                "exit 9",
                expect_ok=False,
            )
            self.assertIn("consumer reload failed after current pointer commit", result.stderr)
            pointers = json.loads((state / "pointers.json").read_text(encoding="utf-8"))
            self.assertEqual(pointers["current"], first["releaseId"])
            self.assertIsNone(pointers["previous"])
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")

    def test_activate_uses_explicit_manifest_and_ossfs_blob_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            blob_root = root / "ossfs" / "blobs"
            cas_store = root / "cas-store"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            blob_root.mkdir(parents=True)
            for blob in (store / "runtime" / "blobs" / "sha256").iterdir():
                (blob_root / blob.name).write_bytes(blob.read_bytes())
            manifest = store / "runtime" / "blob-releases" / first["releaseId"] / "manifest.json"
            cas_store.mkdir()
            switched = self.activate(
                cas_store,
                state,
                first["releaseId"],
                "--manifest",
                str(manifest),
                "--blob-root",
                str(blob_root),
            )
            self.assertEqual(switched["current"], first["releaseId"])
            self.assertEqual((state / "current" / "lessons/1-1/lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')

    def rewrite_manifest_source(self, manifest_path: Path, source: dict) -> None:
        materialize = load_materialize()
        raw = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = []
        for item in raw["files"]:
            files.append(
                {
                    "path": item["path"],
                    "objectKey": item["objectKey"],
                    "sizeBytes": item["sizeBytes"],
                    "sha256": item["sha256"],
                    "source": source,
                }
            )
        without = {
            "schemaVersion": raw["schemaVersion"],
            "releaseId": raw["releaseId"],
            "sourceRevision": raw["sourceRevision"],
            "fileCount": raw["fileCount"],
            "totalBytes": raw["totalBytes"],
            "treeSha256": raw["treeSha256"],
            "files": files,
        }
        raw["files"] = files
        raw["manifestSha256"] = materialize.sha256_text(materialize.stable_stringify(without))
        manifest_path.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    def test_first_activate_seeds_previous_from_existing_current(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            (state / "pointers.json").unlink()
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            switched = self.activate(store, state, second["releaseId"])
            self.assertEqual(switched["current"], second["releaseId"])
            self.assertEqual(switched["previous"], first["releaseId"])
            self.assertEqual(os.readlink(state / "previous"), f"views/{first['releaseId']}")

    def test_legacy_selection_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "data" / "runtime" / "blob-views"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"], "--smoke", "true")
            (state / "pointers.json").unlink()
            (state.parent / "act-runtime-selection.json").write_text(
                json.dumps(
                    {
                        "schemaVersion": "runtime-release-selection.v1",
                        "generation": 1,
                        "releaseId": "runtime-not-the-current-release-id-xxxxxxxxxxxxxxxx",
                        "manifestSha256": "a" * 64,
                        "treeSha256": "b" * 64,
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            result = self.activate(store, state, first["releaseId"], "--smoke", "true", expect_ok=False)
            self.assertIn("legacy runtime selection does not match the current view", result.stderr)

    def test_optional_source_field_is_kept_in_manifest_digest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            manifest = store / "runtime" / "blob-releases" / first["releaseId"] / "manifest.json"
            self.rewrite_manifest_source(manifest, {"gitObjectId": "dddddddddddddddddddddddddddddddddddddddd"})
            switched = self.activate(store, state, first["releaseId"])
            self.assertEqual(switched["current"], first["releaseId"])
            copied = json.loads((state / "current" / ".act-runtime-release.v2.json").read_text(encoding="utf-8"))
            self.assertEqual(copied["files"][0]["source"], {"gitObjectId": "dddddddddddddddddddddddddddddddddddddddd"})

    def test_production_blob_root_binds_helper_before_reload(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "data" / "runtime" / "blob-views"
            blob_root = root / "ossfs" / "blobs"
            bound = root / "bound"
            reloaded = root / "reloaded"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            blob_root.mkdir(parents=True)
            for blob in (store / "runtime" / "blobs" / "sha256").iterdir():
                (blob_root / blob.name).write_bytes(blob.read_bytes())
            switched = self.activate(
                store,
                state,
                first["releaseId"],
                "--smoke",
                "true",
                "--blob-root",
                str(blob_root),
                "--bind-helper",
                (
                    f'test "${{ACT_RUNTIME_BLOB_VIEW##*/}}" = "{first["releaseId"]}" && '
                    f'test "$ACT_RUNTIME_BLOB_ROOT" = "{blob_root}" && '
                    f'test ! -e "{reloaded}" && '
                    f'for item in "$ACT_RUNTIME_BLOB_ROOT"/*; do cp "$item" "$ACT_RUNTIME_BLOB_VIEW/.act-runtime-blobs/"; done && '
                    f'printf bound > "{bound}"'
                ),
                "--reload-consumers",
                f'test -f "{bound}" && printf ok > "{reloaded}"',
            )
            self.assertEqual(switched["current"], first["releaseId"])
            self.assertEqual(bound.read_text(encoding="utf-8"), "bound")
            self.assertEqual(reloaded.read_text(encoding="utf-8"), "ok")

    def test_bind_helper_failure_does_not_switch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "data" / "runtime" / "blob-views"
            blob_root = root / "ossfs" / "blobs"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            blob_root.mkdir(parents=True)
            for blob in (store / "runtime" / "blobs" / "sha256").iterdir():
                (blob_root / blob.name).write_bytes(blob.read_bytes())
            result = self.activate(
                store,
                state,
                first["releaseId"],
                "--smoke",
                "true",
                "--blob-root",
                str(blob_root),
                "--bind-helper",
                "exit 4",
                expect_ok=False,
            )
            self.assertIn("candidate helper bind failed", result.stderr)
            self.assertFalse((state / "current").exists())
            self.assertFalse((state / "pointers.json").exists())

    def test_active_receipt_tracks_current_and_restores_on_reload_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            first_manifest = json.loads(
                (store / "runtime" / "blob-releases" / first["releaseId"] / "manifest.json").read_text(encoding="utf-8")
            )
            self.assertEqual(receipt["schemaVersion"], "runtime-release-active-receipt.v1")
            self.assertEqual(receipt["healthCheck"], "readyz")
            self.assertEqual(receipt["selection"]["releaseId"], first["releaseId"])
            self.assertEqual(receipt["selection"]["manifestSha256"], first_manifest["manifestSha256"])
            self.assertEqual(receipt["selection"]["treeSha256"], first_manifest["treeSha256"])
            self.assertEqual(receipt["selection"]["generation"], 1)
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            failed = self.activate(
                store,
                state,
                second["releaseId"],
                "--reload-consumers",
                "exit 9",
                expect_ok=False,
            )
            self.assertIn("consumer reload failed after current pointer commit", failed.stderr)
            restored = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(restored["selection"]["releaseId"], first["releaseId"])
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")

    def test_stale_pointers_json_does_not_override_current_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            (state / "pointers.json").write_text(
                json.dumps({"current": "runtime-not-actually-current-xxxxxxxxxxxxxxxxxxxx", "previous": None}, indent=2)
                + "\n",
                encoding="utf-8",
            )
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            switched = self.activate(store, state, second["releaseId"])
            self.assertEqual(switched["previous"], first["releaseId"])
            self.assertEqual(os.readlink(state / "previous"), f"views/{first['releaseId']}")

    def test_receipt_write_failure_restores_selection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            blocked = state / "blocked-receipt"
            blocked.mkdir()
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            failed = self.activate(
                store,
                state,
                second["releaseId"],
                "--active-receipt",
                str(blocked),
                expect_ok=False,
            )
            self.assertIn("unable to write active receipt after current pointer commit", failed.stderr)
            self.assertEqual(os.readlink(state / "current"), f"views/{first['releaseId']}")
            pointers = json.loads((state / "pointers.json").read_text(encoding="utf-8"))
            self.assertEqual(pointers["current"], first["releaseId"])
            receipt = json.loads((state / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["selection"]["releaseId"], first["releaseId"])

    def test_helper_leaf_links_do_not_stat_helper_files(self):
        materialize = load_materialize()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            view = root / "view"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            manifest = materialize.load_manifest(store / "runtime" / "blob-releases" / first["releaseId"] / "manifest.json")
            materialize.prepare_view(view, manifest)
            probes = []
            original = Path.is_file

            def wrapped(self):
                if self.parent.name == materialize.HELPER_NAME:
                    probes.append(str(self))
                return original(self)

            Path.is_file = wrapped  # type: ignore[method-assign]
            try:
                materialize.populate_view(store, manifest, view, use_helper_leaves=True)
            finally:
                Path.is_file = original  # type: ignore[method-assign]
            self.assertEqual(probes, [])
            lesson = view / "lessons" / "1-1" / "lesson.json"
            self.assertTrue(lesson.is_symlink())
            self.assertIn(materialize.HELPER_NAME, os.readlink(lesson))

    def test_rollback_rebinds_previous_helper_before_switch(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            blob_root = root / "ossfs" / "blobs"
            bind = 'for item in "$ACT_RUNTIME_BLOB_ROOT"/*; do cp "$item" "$ACT_RUNTIME_BLOB_VIEW/.act-runtime-blobs/"; done'
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            blob_root.mkdir(parents=True)
            for blob in (store / "runtime" / "blobs" / "sha256").iterdir():
                (blob_root / blob.name).write_bytes(blob.read_bytes())
            self.activate(
                store,
                state,
                first["releaseId"],
                "--blob-root",
                str(blob_root),
                "--bind-helper",
                bind,
            )
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish_args(runtime, index, store, bootstrap=False)
            for blob in (store / "runtime" / "blobs" / "sha256").iterdir():
                target = blob_root / blob.name
                if not target.exists():
                    target.write_bytes(blob.read_bytes())
            self.activate(
                store,
                state,
                second["releaseId"],
                "--blob-root",
                str(blob_root),
                "--bind-helper",
                bind,
            )
            helper = state / "views" / first["releaseId"] / ".act-runtime-blobs"
            for item in helper.iterdir():
                if item.is_file():
                    item.unlink()
            rolled = self.run_json(
                [
                    "python3",
                    str(ACTIVATE),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--rollback",
                    "--blob-root",
                    str(blob_root),
                    "--bind-helper",
                    bind,
                    "--sentinel",
                    "lessons/1-1/lesson.json",
                ]
            )
            self.assertEqual(rolled["current"], first["releaseId"])
            self.assertEqual((state / "current" / "lessons" / "1-1" / "lesson.json").read_text(encoding="utf-8"), '{"id":"one"}\n')

    def test_helper_leaves_are_used_instead_of_copying_blobs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "data" / "runtime" / "blob-views"
            blob_root = root / "ossfs" / "blobs"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish_args(runtime, index, store, bootstrap=True)
            blob_root.mkdir(parents=True)
            for blob in (store / "runtime" / "blobs" / "sha256").iterdir():
                (blob_root / blob.name).write_bytes(blob.read_bytes())
            switched = self.activate(
                store,
                state,
                first["releaseId"],
                "--smoke",
                "true",
                "--blob-root",
                str(blob_root),
                "--bind-helper",
                'for item in "$ACT_RUNTIME_BLOB_ROOT"/*; do cp "$item" "$ACT_RUNTIME_BLOB_VIEW/.act-runtime-blobs/"; done',
            )
            self.assertEqual(switched["current"], first["releaseId"])
            lesson = state / "current" / "lessons" / "1-1" / "lesson.json"
            self.assertTrue(lesson.is_symlink())
            self.assertEqual(lesson.read_text(encoding="utf-8"), '{"id":"one"}\n')
            receipt = json.loads((state.parent / "act-runtime-active-receipt.json").read_text(encoding="utf-8"))
            self.assertEqual(receipt["selection"]["releaseId"], first["releaseId"])

    def test_host_scripts_use_python36_syntax(self):
        forbidden = (
            "from __future__ import annotations",
            " | None",
            "list[",
            "dict[",
            "tuple[",
            "text=True",
        )
        paths = [
            ACTIVATE,
            ROOT / "scripts/runtime-release/materialize-runtime.py",
            ROOT / "scripts/runtime-release/runtime-gc.py",
            ROOT / "scripts/runtime-release/runtime-doctor.py",
        ]
        for path in paths:
            text = path.read_text(encoding="utf-8")
            for token in forbidden:
                self.assertNotIn(token, text, f"{path.name} must not use {token}")


if __name__ == "__main__":
    unittest.main()
