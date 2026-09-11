#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/runtime-release/publish-runtime.py"
SOURCE_REVISION = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
OSS_ENV_KEYS = (
    "OSS_ACCESS_KEY_ID",
    "OSS_ACCESS_KEY_SECRET",
    "OSS_ENDPOINT",
    "OSS_REGION",
    "ALIBABA_CLOUD_ACCESS_KEY_ID",
    "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
    "ACT_RUNTIME_OSS_ENDPOINT",
)


class PublishRuntimeTests(unittest.TestCase):
    def write_tree(self, root: Path, files: dict[str, str]) -> None:
        for relative, body in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body, encoding="utf-8")

    def isolated_env(self) -> dict[str, str]:
        env = os.environ.copy()
        for key in OSS_ENV_KEYS:
            env.pop(key, None)
        return env

    def publish(self, *args: str, expect_ok: bool = True) -> subprocess.CompletedProcess[str] | dict:
        result = subprocess.run(
            ["python3", str(SCRIPT), *args],
            text=True,
            capture_output=True,
            env=self.isolated_env(),
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
                        "if 'list-objects-v2' in args:",
                        "    sys.stdout.write('{\"IsTruncated\":false}\\n')",
                        "    sys.exit(0)",
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
                        "args = sys.argv[1:]",
                        "if 'list-objects-v2' in args:",
                        "    sys.stdout.write('{\"IsTruncated\":false}\\n')",
                        "    sys.exit(0)",
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

    def test_ossutil_labeled_file_already_exists_is_hit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            store = root / "oss"
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import sys",
                        "from pathlib import Path",
                        "args = sys.argv[1:]",
                        "if 'list-objects-v2' in args:",
                        "    sys.stdout.write('{\"IsTruncated\":false}\\n')",
                        "    sys.exit(0)",
                        "key = args[args.index('--key') + 1]",
                        "body = args[args.index('--body') + 1].removeprefix('file://')",
                        f"dest = Path({str(store)!r}) / key",
                        "if dest.exists():",
                        "    sys.stderr.write('Error: operation error PutObject: Error returned by Service. \\n')",
                        "    sys.stderr.write('Http Status Code: 409. \\n')",
                        "    sys.stderr.write('Error Code: FileAlreadyExists. \\n')",
                        "    sys.exit(1)",
                        "dest.parent.mkdir(parents=True, exist_ok=True)",
                        "from pathlib import Path as P",
                        "dest.write_bytes(P(body).read_bytes())",
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
                "--rebuild-index",
            )
            self.assertGreaterEqual(second["casHits"], 1)
            self.assertEqual(second["uploadedBlobs"], 0)

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
                        "args = sys.argv[1:]",
                        "if 'list-objects-v2' in args:",
                        "    sys.stdout.write('{\"IsTruncated\":false}\\n')",
                        "    sys.exit(0)",
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

    def test_ossutil_signal_exit_is_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            store = root / "oss"
            attempts = root / "attempts"
            attempts.write_text("0", encoding="utf-8")
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import sys",
                        "from pathlib import Path",
                        "args = sys.argv[1:]",
                        "if 'list-objects-v2' in args:",
                        "    sys.stdout.write('{\"IsTruncated\":false}\\n')",
                        "    sys.exit(0)",
                        "key = args[args.index('--key') + 1]",
                        "body = args[args.index('--body') + 1].removeprefix('file://')",
                        f"dest = Path({str(store)!r}) / key",
                        f"attempts = Path({str(attempts)!r})",
                        "n = int(attempts.read_text() or '0')",
                        "attempts.write_text(str(n + 1))",
                        "if n < 2:",
                        "    sys.exit(137)",
                        "if dest.exists():",
                        "    sys.stderr.write('Http Status Code: 409.\\n')",
                        "    sys.stderr.write('Error Code: FileAlreadyExists.\\n')",
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
            result = self.publish(
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
            self.assertEqual(result["uploadedBlobs"], 1)
            self.assertGreaterEqual(int(attempts.read_text()), 3)

    def test_progress_default_is_quiet_and_flag_emits_phases(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            self.write_tree(runtime, {"lessons/1-1/lesson.json": '{"id":"1-1"}\n'})
            quiet = subprocess.run(
                [
                    "python3",
                    str(SCRIPT),
                    "--root",
                    str(runtime),
                    "--index",
                    str(root / "index.sqlite"),
                    "--store-dir",
                    str(root / "store"),
                    "--source-revision",
                    SOURCE_REVISION,
                    "--bootstrap",
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(quiet.returncode, 0, quiet.stderr)
            self.assertNotIn("progress ", quiet.stderr)
            json.loads(quiet.stdout)
            verbose = subprocess.run(
                [
                    "python3",
                    str(SCRIPT),
                    "--root",
                    str(runtime),
                    "--index",
                    str(root / "index-progress.sqlite"),
                    "--store-dir",
                    str(root / "store-progress"),
                    "--source-revision",
                    SOURCE_REVISION,
                    "--bootstrap",
                    "--progress",
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(verbose.returncode, 0, verbose.stderr)
            self.assertIn("progress event=scan-complete", verbose.stderr)
            self.assertIn("progress event=put-start", verbose.stderr)
            self.assertLessEqual(verbose.stderr.count("progress "), 20)
            self.assertNotIn("progress ", verbose.stdout)
            json.loads(verbose.stdout)

    def test_bootstrap_does_not_wipe_valid_index(self):
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
            self.assertEqual(first["hashed"], 2)
            second = self.publish(
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
            self.assertEqual(second["hashed"], 0)
            self.assertEqual(second["uploaded"], 0)
            self.assertEqual(second["uploadedBlobs"], 0)
            self.assertEqual(second["releaseId"], first["releaseId"])

    def test_interrupted_publish_resumes_hashed_and_blobs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            index = root / "index.sqlite"
            store = root / "oss"
            fail_once = root / "fail-once"
            counter = root / "created-blobs"
            fail_once.write_text("1", encoding="utf-8")
            counter.write_text("0", encoding="utf-8")
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import sys",
                        "from pathlib import Path",
                        "args = sys.argv[1:]",
                        "if 'list-objects-v2' in args:",
                        "    sys.stdout.write('{\"IsTruncated\":false}\\n')",
                        "    sys.exit(0)",
                        "key = args[args.index('--key') + 1]",
                        "body = args[args.index('--body') + 1].removeprefix('file://')",
                        f"dest = Path({str(store)!r}) / key",
                        f"fail_once = Path({str(fail_once)!r})",
                        f"counter = Path({str(counter)!r})",
                        "if dest.exists():",
                        "    sys.stderr.write('Http Status Code: 409.\\n')",
                        "    sys.stderr.write('Error Code: FileAlreadyExists.\\n')",
                        "    sys.exit(1)",
                        "if key.startswith('runtime/blobs/'):",
                        "    created = int(counter.read_text() or '0')",
                        "    if created >= 1 and fail_once.exists():",
                        "        fail_once.unlink()",
                        "        sys.stderr.write('injected fail after first blob\\n')",
                        "        sys.exit(1)",
                        "    counter.write_text(str(created + 1))",
                        "dest.parent.mkdir(parents=True, exist_ok=True)",
                        "dest.write_bytes(Path(body).read_bytes())",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
            self.write_tree(
                runtime,
                {
                    "lessons/1-1/lesson.json": '{"id":"1-1"}\n',
                    "cards/a.md": "# A\n",
                },
            )
            first = self.publish(
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
            self.assertIn("conditional PUT failed", first.stderr)
            connection = __import__("sqlite3").connect(index)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM hashed").fetchone()[0], 2)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM blobs").fetchone()[0], 1)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM files").fetchone()[0], 1)
            connection.close()
            second = self.publish(
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
            )
            self.assertEqual(second["hashed"], 0)
            self.assertEqual(second["uploadedBlobs"], 1)
            connection = __import__("sqlite3").connect(index)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM files").fetchone()[0], 2)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM hashed").fetchone()[0], 0)
            connection.close()

    def load_module(self):
        spec = importlib.util.spec_from_file_location("publish_runtime", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        sys.modules["publish_runtime"] = module
        spec.loader.exec_module(module)
        return module

    def test_parse_list_objects_page_accepts_object_or_array_contents(self):
        module = self.load_module()
        digest = "a" * 64
        key = f"runtime/blobs/sha256/{digest}"
        single, token = module.parse_list_objects_page(
            json.dumps({"Contents": {"Key": key}, "IsTruncated": True, "NextContinuationToken": "n1"})
        )
        self.assertEqual(single, [digest])
        self.assertEqual(token, "n1")
        many, done = module.parse_list_objects_page(json.dumps({"Contents": [{"Key": key}], "IsTruncated": False}))
        self.assertEqual(many, [digest])
        self.assertIsNone(done)

    def test_parse_list_objects_xml(self):
        module = self.load_module()
        digest = "b" * 64
        keys, token = module.parse_list_objects_xml(
            f"<ListBucketResult><Contents><Key>runtime/blobs/sha256/{digest}</Key></Contents>"
            "<IsTruncated>true</IsTruncated><NextContinuationToken>abc</NextContinuationToken></ListBucketResult>"
        )
        self.assertEqual(keys, [digest])
        self.assertEqual(token, "abc")
        empty, done = module.parse_list_objects_xml("<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>")
        self.assertEqual(empty, [])
        self.assertIsNone(done)

    def test_remote_listing_skips_put_and_retires_missing_blob(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            runtime = root / "runtime"
            store = root / "oss"
            index = root / "index.sqlite"
            remote = root / "remote-keys.json"
            log = root / "ossutil.log"
            body_keep = "# keep\n"
            body_gone = "# gone\n"
            keep_digest = hashlib.sha256(body_keep.encode("utf-8")).hexdigest()
            gone_digest = hashlib.sha256(body_gone.encode("utf-8")).hexdigest()
            remote.write_text(json.dumps([f"runtime/blobs/sha256/{keep_digest}"]), encoding="utf-8")
            fake = root / "fake-ossutil"
            fake.write_text(
                "\n".join(
                    [
                        "#!/usr/bin/env python3",
                        "import json, sys",
                        "from pathlib import Path",
                        "args = sys.argv[1:]",
                        f"log = Path({str(log)!r})",
                        "log.write_text((log.read_text() if log.exists() else '') + ' '.join(args) + chr(10))",
                        f"remote = Path({str(remote)!r})",
                        "if 'list-objects-v2' in args:",
                        "    keys = json.loads(remote.read_text())",
                        "    sys.stdout.write(json.dumps({'Contents':[{'Key': key} for key in keys], 'IsTruncated': False}) + chr(10))",
                        "    sys.exit(0)",
                        "key = args[args.index('--key') + 1]",
                        "body = args[args.index('--body') + 1].removeprefix('file://')",
                        f"dest = Path({str(store)!r}) / key",
                        "dest.parent.mkdir(parents=True, exist_ok=True)",
                        "dest.write_bytes(Path(body).read_bytes())",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )
            os.chmod(fake, os.stat(fake).st_mode | stat.S_IEXEC)
            self.write_tree(runtime, {"cards/keep.md": body_keep, "cards/gone.md": body_gone})
            first = self.publish(
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
            )
            self.assertEqual(first["uploadedBlobs"], 1)
            log_text = log.read_text(encoding="utf-8")
            self.assertIn("list-objects-v2", log_text)
            self.assertNotIn(keep_digest, log_text)
            self.assertIn(gone_digest, log_text)
            connection = __import__("sqlite3").connect(index)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM blobs").fetchone()[0], 2)
            connection.close()
            second = self.publish(
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
            )
            self.assertEqual(second["hashed"], 0)
            self.assertEqual(second["uploadedBlobs"], 1)
            self.assertEqual(log.read_text(encoding="utf-8").count(gone_digest), 2)

    def test_oss_http_store_reuses_connection_and_treats_conflict_as_hit(self):
        module = self.load_module()
        with tempfile.TemporaryDirectory() as directory:
            stored: dict[str, bytes] = {}
            puts: list[str] = []

            class Handler(BaseHTTPRequestHandler):
                def log_message(self, *_args) -> None:
                    return

                def do_GET(self) -> None:
                    body = b"<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>"
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)

                def do_PUT(self) -> None:
                    puts.append(self.path)
                    length = int(self.headers.get("Content-Length", "0"))
                    payload = self.rfile.read(length)
                    if self.headers.get("x-oss-forbid-overwrite") != "true":
                        self.send_response(400)
                        self.end_headers()
                        return
                    if self.path in stored:
                        self.send_response(409)
                        self.end_headers()
                        self.wfile.write(b"<Error><Code>FileAlreadyExists</Code></Error>")
                        return
                    stored[self.path] = payload
                    self.send_response(200)
                    self.end_headers()

            server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                source = Path(directory) / "lesson.json"
                source.write_text('{"id":"1-1"}\n', encoding="utf-8")
                store = module.OssHttpObjectStore(
                    "test-bucket",
                    "id",
                    "secret",
                    f"127.0.0.1:{server.server_address[1]}",
                    scheme="http",
                )
                key = "runtime/blobs/sha256/" + "c" * 64
                self.assertEqual(store.put_file(key, source), "created")
                self.assertEqual(store.put_file(key, source), "hit")
                self.assertEqual(store.list_blob_page(), ([], None))
                self.assertEqual(store._client is not None, True)
                self.assertGreaterEqual(len(puts), 2)
                self.assertTrue(all(item.startswith("/test-bucket/") for item in puts))
                store.close()
            finally:
                server.shutdown()
                server.server_close()

    def test_oss_http_list_signature_excludes_unsigned_query(self):
        module = self.load_module()
        store = module.OssHttpObjectStore("test-bucket", "id", "secret", "oss.example.com", scheme="http")
        headers = {"Date": "Fri, 11 Sep 2026 02:15:38 GMT"}
        query = {"list-type": "2", "max-keys": "1000", "prefix": "runtime/blobs/sha256/"}
        unsigned = store._authorization("GET", "", headers, None)
        self.assertEqual(store._authorization("GET", "", headers, query), unsigned)
        paged = dict(query)
        paged["continuation-token"] = "n1"
        self.assertNotEqual(store._authorization("GET", "", headers, paged), unsigned)
        self.assertTrue(unsigned.startswith("OSS id:"))

    def test_progress_heartbeats_are_once_per_minute(self):
        module = self.load_module()
        stream = __import__("io").StringIO()
        reporter = module.ProgressReporter(True, stream=stream)
        times = iter([0.0, 10.0, 59.0, 60.0])
        original = module.time.monotonic
        module.time.monotonic = lambda: next(times)
        try:
            reporter.maybe(1, phase="put", done="1/10")
            reporter.maybe(2, phase="put", done="2/10")
            reporter.maybe(3, phase="put", done="3/10")
            reporter.maybe(4, phase="put", done="4/10")
        finally:
            module.time.monotonic = original
        lines = [line for line in stream.getvalue().splitlines() if line.startswith("progress phase=put")]
        self.assertEqual(len(lines), 2)
        self.assertIn("done=1/10", lines[0])
        self.assertIn("done=4/10", lines[1])


if __name__ == "__main__":
    unittest.main()
