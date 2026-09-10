#!/usr/bin/env python3
from __future__ import annotations

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
SOURCE_REVISION = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"


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


if __name__ == "__main__":
    unittest.main()
