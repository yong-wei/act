#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import stat
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/publish-runtime.py"
SOURCE_REVISION = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"


class PublishRuntimeTests(unittest.TestCase):
    def write_tree(self, root: Path, files: dict[str, str]) -> None:
        for relative, body in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body, encoding="utf-8")

    def publish(self, *args: str, expect_ok: bool = True) -> subprocess.CompletedProcess[str] | dict:
        result = subprocess.run(
            ["python3", str(SCRIPT), *args],
            text=True,
            capture_output=True,
        )
        if expect_ok:
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        self.assertNotEqual(result.returncode, 0)
        return result

    def test_missing_index_fails_closed_without_bootstrap(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            result = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(root / "missing" / "index.sqlite"),
                "--store-dir",
                str(root / "store"),
                "--source-revision",
                SOURCE_REVISION,
                expect_ok=False,
            )
            self.assertIn("local publish index unavailable", result.stderr)
            self.assertIn("run with --bootstrap to rebuild", result.stderr)
            self.assertFalse(any((root / "store").rglob("*")))

    def test_unchanged_republish_hashes_and_uploads_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            self.write_tree(
                runtime,
                {
                    "lessons/1-1/lesson.json": '{"id":"1-1"}\n',
                    "cards/a.md": "# A\n",
                    "media/poster.png": "png-bytes",
                },
            )
            first = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--store-dir",
                str(store),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap",
            )
            self.assertEqual(first["hashed"], 3)
            self.assertEqual(first["uploadedBlobs"], 3)
            self.assertGreaterEqual(first["uploaded"], 3)
            second = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--store-dir",
                str(store),
                "--source-revision",
                SOURCE_REVISION,
            )
            self.assertEqual(second["hashed"], 0)
            self.assertEqual(second["uploaded"], 0)
            self.assertEqual(second["uploadedBlobs"], 0)
            self.assertEqual(second["releaseId"], first["releaseId"])

    def test_one_changed_file_hashes_only_the_delta(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "store"
            self.write_tree(
                runtime,
                {
                    "lessons/1-1/lesson.json": '{"id":"1-1"}\n',
                    "cards/a.md": "# A\n",
                },
            )
            self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--store-dir",
                str(store),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap",
            )
            time.sleep(0.02)
            (runtime / "lessons/1-1/lesson.json").write_text('{"id":"1-1","changed":true}\n', encoding="utf-8")
            delta = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--store-dir",
                str(store),
                "--source-revision",
                SOURCE_REVISION,
            )
            self.assertEqual(delta["hashed"], 1)
            self.assertLessEqual(delta["uploadedBlobs"], 1)

    def test_writes_current_v2_manifest_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            store = root / "store"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            result = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(root / "index.sqlite"),
                "--store-dir",
                str(store),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap",
            )
            manifest_path = store / "runtime" / "blob-releases" / result["releaseId"] / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["schemaVersion"], "act-runtime-release.v2")
            self.assertEqual(manifest["sourceRevision"], SOURCE_REVISION)
            self.assertEqual(manifest["releaseId"], result["releaseId"])
            file_entry = manifest["files"][0]
            self.assertEqual(file_entry["objectKey"], f"runtime/blobs/sha256/{file_entry['sha256']}")
            self.assertTrue((store / "runtime" / "blobs" / "sha256" / file_entry["sha256"]).is_file())
            self.assertNotIn("source", file_entry)

    def test_corrupt_index_does_not_silently_rebuild(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            index.write_text("not-a-sqlite-database", encoding="utf-8")
            result = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--store-dir",
                str(root / "store"),
                "--source-revision",
                SOURCE_REVISION,
                expect_ok=False,
            )
            self.assertIn("local publish index unavailable", result.stderr)

    def test_ossutil_store_treats_forbid_overwrite_as_hit_without_head(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            store = root / "oss"
            log = root / "ossutil.log"
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import os, sys",
                        "from pathlib import Path",
                        "args = sys.argv[1:]",
                        f"log = Path({str(log)!r})",
                        "log.write_text(log.read_text() + ' '.join(args) + chr(10) if log.exists() else ' '.join(args) + chr(10))",
                        "if args[:1] != ['api'] or 'put-object' not in args:",
                        "    sys.stderr.write('unexpected ossutil invocation\\n')",
                        "    sys.exit(9)",
                        "if 'head-object' in args or 'get-object' in args:",
                        "    sys.exit(9)",
                        "key = args[args.index('--key') + 1]",
                        "body = args[args.index('--body') + 1].removeprefix('file://')",
                        f"dest = Path({str(store)!r}) / key",
                        "if dest.exists():",
                        "    sys.stderr.write('{\\\"statusCode\\\":412,\\\"errorCode\\\":\\\"FileAlreadyExists\\\"}\\n')",
                        "    sys.exit(1)",
                        "dest.parent.mkdir(parents=True, exist_ok=True)",
                        "dest.write_bytes(Path(body).read_bytes())",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            first = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(root / "index.sqlite"),
                "--oss-bucket",
                "test-bucket",
                "--ossutil",
                str(fake),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap",
            )
            self.assertEqual(first["uploadedBlobs"], 1)
            second = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(root / "index.sqlite"),
                "--oss-bucket",
                "test-bucket",
                "--ossutil",
                str(fake),
                "--source-revision",
                SOURCE_REVISION,
            )
            self.assertEqual(second["hashed"], 0)
            self.assertEqual(second["uploaded"], 0)
            log_text = log.read_text(encoding="utf-8")
            self.assertNotIn("head-object", log_text)
            self.assertNotIn("get-object", log_text)
            self.assertIn("put-object", log_text)
            self.assertIn("--forbid-overwrite", log_text)

    def test_ossutil_unknown_forbid_overwrite_flag_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "oss"
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import sys",
                        "sys.stderr.write('unknown flag: --forbid-overwrite\\n')",
                        "sys.exit(1)",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            result = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--oss-bucket",
                "test-bucket",
                "--ossutil",
                str(fake),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap",
                expect_ok=False,
            )
            self.assertIn("conditional PUT failed", result.stderr)
            self.assertFalse(any(store.rglob("*")))
            connection = __import__("sqlite3").connect(index)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM files").fetchone()[0], 0)
            connection.close()

    def test_ossutil_unstructured_precondition_text_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "oss"
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import sys",
                        "sys.stderr.write('failed to decode PreconditionFailed response from proxy\\n')",
                        "sys.exit(1)",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            result = self.publish(
                "--root",
                str(runtime),
                "--index",
                str(index),
                "--oss-bucket",
                "test-bucket",
                "--ossutil",
                str(fake),
                "--source-revision",
                SOURCE_REVISION,
                "--bootstrap",
                expect_ok=False,
            )
            self.assertIn("conditional PUT failed", result.stderr)
            self.assertFalse(any(store.rglob("*")))
            connection = __import__("sqlite3").connect(index)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM files").fetchone()[0], 0)
            connection.close()


if __name__ == "__main__":
    unittest.main()
