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
DOCTOR = ROOT / "scripts/runtime-release/runtime-doctor.py"
GC = ROOT / "scripts/runtime-release/runtime-gc.py"
SOURCE_REVISION = "cccccccccccccccccccccccccccccccccccccccc"


class RuntimeDoctorGcTests(unittest.TestCase):
    def write_tree(self, root: Path, files: dict[str, str]) -> None:
        for relative, body in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body, encoding="utf-8")

    def run_json(self, command: list[str], expect_ok: bool = True, env: dict[str, str] | None = None):
        result = subprocess.run(command, text=True, capture_output=True, env=env)
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def gc_env(self) -> dict[str, str]:
        env = os.environ.copy()
        env.pop("DATABASE_URL", None)
        return env

    def publish(self, runtime: Path, index: Path, store: Path, bootstrap: bool) -> dict:
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

    def activate(self, store: Path, state: Path, release_id: str) -> dict:
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
            ]
        )

    def test_full_doctor_rehashes_without_changing_pointers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            before = (state / "pointers.json").read_text(encoding="utf-8")
            report = self.run_json(
                [
                    "python3",
                    str(DOCTOR),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--full",
                ]
            )
            self.assertEqual(report["releaseId"], first["releaseId"])
            self.assertTrue(report["full"])
            self.assertGreaterEqual(report["hashed"], 1)
            self.assertEqual((state / "pointers.json").read_text(encoding="utf-8"), before)

    def test_gc_dry_run_keeps_blobs_and_execute_retains_current_previous_and_pins(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"two"}\n', encoding="utf-8")
            second = self.publish(runtime, index, store, bootstrap=False)
            self.activate(store, state, second["releaseId"])
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"three"}\n', encoding="utf-8")
            third = self.publish(runtime, index, store, bootstrap=False)
            self.activate(store, state, third["releaseId"])
            dry = self.run_json(
                [
                    "python3",
                    str(GC),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--dry-run",
                ],
                env=self.gc_env(),
            )
            self.assertTrue(dry["dryRun"])
            self.assertEqual(dry["blobsDeleted"], 0)
            self.assertEqual(dry["current"], third["releaseId"])
            self.assertEqual(dry["previous"], second["releaseId"])
            self.assertEqual(dry["removableReleases"], [first["releaseId"]])
            blobs_before = sorted(path.name for path in (store / "runtime" / "blobs" / "sha256").iterdir())
            pinned = self.run_json(
                [
                    "python3",
                    str(GC),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--execute",
                    "--session-release",
                    first["releaseId"],
                ],
                env=self.gc_env(),
            )
            self.assertEqual(pinned["removableReleases"], [])
            self.assertTrue((store / "runtime" / "blob-releases" / first["releaseId"]).is_dir())
            executed = self.run_json(
                [
                    "python3",
                    str(GC),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--execute",
                    "--no-session-refs",
                ],
                env=self.gc_env(),
            )
            self.assertFalse(executed["dryRun"])
            self.assertEqual(executed["blobsDeleted"], 0)
            self.assertEqual(executed["removableReleases"], [first["releaseId"]])
            self.assertFalse((store / "runtime" / "blob-releases" / first["releaseId"]).exists())
            self.assertTrue((store / "runtime" / "blob-releases" / second["releaseId"]).is_dir())
            self.assertTrue((store / "runtime" / "blob-releases" / third["releaseId"]).is_dir())
            self.assertEqual(
                sorted(path.name for path in (store / "runtime" / "blobs" / "sha256").iterdir()),
                blobs_before,
            )

    def test_gc_execute_fails_closed_without_session_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            state = root / "state"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"one"}\n'})
            first = self.publish(runtime, index, store, bootstrap=True)
            self.activate(store, state, first["releaseId"])
            result = self.run_json(
                [
                    "python3",
                    str(GC),
                    "--store-dir",
                    str(store),
                    "--state-dir",
                    str(state),
                    "--execute",
                ],
                expect_ok=False,
                env=self.gc_env(),
            )
            self.assertIn("session release discovery unavailable", result.stderr)
            self.assertTrue((store / "runtime" / "blob-releases" / first["releaseId"]).is_dir())


    def test_hot_path_scripts_do_not_invoke_doctor_or_gc(self):
        hot_paths = [
            ROOT / "scripts/runtime-release/publish-runtime.py",
            ROOT / "scripts/runtime-release/activate-runtime.py",
            ROOT / "scripts/runtime-release/activate-runtime.sh",
            ROOT / "scripts/runtime-release/materialize-runtime.py",
            ROOT / "scripts/remote-deploy.sh",
        ]
        forbidden = ("runtime-doctor", "runtime-gc", "runtime:doctor", "runtime:gc")
        for path in hot_paths:
            text = path.read_text(encoding="utf-8")
            for token in forbidden:
                self.assertNotIn(token, text, f"{path.name} must not call {token}")


if __name__ == "__main__":
    unittest.main()
