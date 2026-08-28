#!/usr/bin/env python3
"""Create and revalidate an immutable Runtime/application compatibility proof."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict


SCHEMA = "runtime-app-compatibility.v1"
CONSUMER_CONTRACT = "runtime-app-candidate-consumers.v1"
GIT_REVISION = re.compile(r"^[a-f0-9]{40}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
IMAGE_DIGEST = re.compile(r"^sha256:[a-f0-9]{64}$")
RELEASE_ID = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
CONTAINER = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$")


def fail(message: str) -> None:
    raise ValueError(message)


def canonical(value: Any) -> bytes:
    return json.dumps(value, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode("utf-8")


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def string(value: Any, label: str) -> str:
    if not isinstance(value, str):
        fail(f"{label} must be a string")
    return value


def git_revision(value: Any, label: str) -> str:
    value = string(value, label)
    if not GIT_REVISION.fullmatch(value):
        fail(f"{label} must be a full lowercase Git revision")
    return value


def digest(value: Any, label: str) -> str:
    value = string(value, label)
    if not SHA256.fullmatch(value):
        fail(f"{label} must be a SHA-256 digest")
    return value


def image_digest(value: Any, label: str) -> str:
    value = string(value, label)
    if not IMAGE_DIGEST.fullmatch(value):
        fail(f"{label} must be an image SHA-256 digest")
    return value


def release_id(value: Any, label: str) -> str:
    value = string(value, label)
    if not RELEASE_ID.fullmatch(value):
        fail(f"{label} is invalid")
    return value


def regular_file(path: Path, label: str) -> Path:
    if path.is_symlink() or not path.is_file():
        fail(f"{label} must be a regular non-symlink file")
    return path


def read_json(path: Path, label: str) -> Dict[str, Any]:
    regular_file(path, label)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"{label} is unreadable: {error}")
    if not isinstance(value, dict):
        fail(f"{label} must be an object")
    return value


def runtime_identity(manifest_path: Path, expected_release_id: str = "") -> Dict[str, str]:
    manifest = read_json(manifest_path, "runtime manifest")
    if manifest.get("schemaVersion") != "act-runtime-release.v2":
        fail("runtime manifest is not v2")
    identity = {
        "releaseId": release_id(manifest.get("releaseId"), "manifest.releaseId"),
        "sourceRevision": git_revision(manifest.get("sourceRevision"), "manifest.sourceRevision"),
        "manifestSha256": digest(manifest.get("manifestSha256"), "manifest.manifestSha256"),
        "treeSha256": digest(manifest.get("treeSha256"), "manifest.treeSha256"),
    }
    if expected_release_id and identity["releaseId"] != expected_release_id:
        fail("runtime manifest does not match the requested release")
    return identity


def candidate_manifest_identity(candidate_view: Path) -> Dict[str, str]:
    return runtime_identity(candidate_view / ".act-runtime-release.v2.json")


def checked_container(value: str, label: str) -> str:
    if not CONTAINER.fullmatch(value):
        fail(f"{label} is unsafe")
    return value


def run(*args: str) -> str:
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    if result.returncode != 0:
        fail(result.stderr.strip() or result.stdout.strip() or f"command failed: {args[0]}")
    return result.stdout.strip()


def container_image(container: str) -> str:
    value = run("podman", "inspect", "--format", "{{.Image}}", container)
    return image_digest(value, f"{container} image")


def container_running(container: str) -> None:
    if run("podman", "inspect", "--format", "{{.State.Running}}", container) != "true":
        fail(f"{container} is not running")


def application_identity(app_container: str, worker_container: str) -> Dict[str, str]:
    container_running(app_container)
    container_running(worker_container)
    app_image = container_image(app_container)
    if container_image(worker_container) != app_image:
        fail("application and worker containers use different images")
    embedded_revision = git_revision(
        run("podman", "exec", app_container, "/bin/sh", "-eu", "-c", "cat /app/.app-revision"),
        "application embedded revision",
    )
    image_revision = git_revision(
        run("podman", "image", "inspect", "--format", "{{ index .Labels \"org.opencontainers.image.revision\" }}", app_image),
        "application image revision",
    )
    if embedded_revision != image_revision:
        fail("application embedded revision does not match image label")
    return {"revision": embedded_revision, "imageDigest": app_image}


def migration_set(app_container: str) -> Dict[str, Any]:
    script = """
const { Client } = require('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const result = await client.query('SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name');
  await client.end();
  process.stdout.write(JSON.stringify(result.rows));
})().catch((error) => { console.error(error.message); process.exit(1); });
"""
    raw = run("podman", "exec", app_container, "node", "-e", script)
    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as error:
        fail(f"migration query returned invalid JSON: {error}")
    if not isinstance(rows, list) or not rows:
        fail("migration query returned no applied migrations")
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            fail("migration query returned an invalid row")
        name = string(row.get("migration_name"), "migration_name")
        checksum = string(row.get("checksum"), "migration checksum")
        normalized.append({"migrationName": name, "checksum": checksum})
    if normalized != sorted(normalized, key=lambda item: item["migrationName"]):
        fail("migration query is not deterministically ordered")
    return {"count": len(normalized), "sha256": sha256(canonical(normalized))}


def parse_proof(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict) or sorted(value) != ["application", "consumerContract", "migrationSet", "runtime", "schemaVersion"]:
        fail("compatibility proof has unsupported or missing fields")
    if value["schemaVersion"] != SCHEMA:
        fail("compatibility proof has an unsupported schema")
    runtime = value["runtime"]
    application = value["application"]
    migration = value["migrationSet"]
    if not isinstance(runtime, dict) or sorted(runtime) != ["manifestSha256", "releaseId", "sourceRevision", "treeSha256"]:
        fail("compatibility proof runtime is invalid")
    if not isinstance(application, dict) or sorted(application) != ["imageDigest", "revision"]:
        fail("compatibility proof application is invalid")
    if not isinstance(migration, dict) or sorted(migration) != ["count", "sha256"]:
        fail("compatibility proof migration set is invalid")
    count = migration["count"]
    if not isinstance(count, int) or isinstance(count, bool) or count < 1:
        fail("compatibility proof migration count is invalid")
    return {
        "schemaVersion": SCHEMA,
        "runtime": {
            "releaseId": release_id(runtime.get("releaseId"), "proof.runtime.releaseId"),
            "sourceRevision": git_revision(runtime.get("sourceRevision"), "proof.runtime.sourceRevision"),
            "manifestSha256": digest(runtime.get("manifestSha256"), "proof.runtime.manifestSha256"),
            "treeSha256": digest(runtime.get("treeSha256"), "proof.runtime.treeSha256"),
        },
        "application": {
            "revision": git_revision(application.get("revision"), "proof.application.revision"),
            "imageDigest": image_digest(application.get("imageDigest"), "proof.application.imageDigest"),
        },
        "consumerContract": string(value.get("consumerContract"), "proof.consumerContract"),
        "migrationSet": {"count": count, "sha256": digest(migration.get("sha256"), "proof.migrationSet.sha256")},
    }


def read_proof(path: Path) -> Dict[str, Any]:
    wire = regular_file(path, "compatibility proof").read_bytes()
    try:
        proof = parse_proof(json.loads(wire.decode("utf-8")))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail(f"compatibility proof is unreadable: {error}")
    if wire != canonical(proof) + b"\n":
        fail("compatibility proof is not canonical")
    return proof


def ensure_matches(proof: Dict[str, Any], runtime: Dict[str, str], application: Dict[str, str], migrations: Dict[str, Any]) -> None:
    if proof["runtime"] != runtime:
        fail("compatibility proof does not match runtime manifest")
    if proof["application"] != application:
        fail("compatibility proof does not match current application image")
    if proof["consumerContract"] != CONSUMER_CONTRACT:
        fail("compatibility proof consumer contract is unsupported")
    if proof["migrationSet"] != migrations:
        fail("compatibility proof does not match current migration set")


def write_immutable(path: Path, proof: Dict[str, Any]) -> None:
    payload = canonical(proof) + b"\n"
    if path.parent.is_symlink():
        fail("compatibility proof directory must not be a symlink")
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.parent.is_symlink() or not path.parent.is_dir():
        fail("compatibility proof directory is invalid")
    if path.exists() or path.is_symlink():
        if path.is_symlink() or path.read_bytes() != payload:
            fail("compatibility proof path already contains different content")
        return
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def proof_path(output_dir: Path, proof: Dict[str, Any]) -> Path:
    """Return the immutable content-addressed location for one proof.

    A Runtime manifest may be qualified repeatedly after an independent
    application image or migration transition.  The proof body, rather than
    just the Runtime identity, therefore owns the filename.
    """
    if output_dir.is_symlink():
        fail("compatibility proof directory must not be a symlink")
    return output_dir / (sha256(canonical(proof) + b"\n") + ".json")


def capture(args: argparse.Namespace) -> Dict[str, Any]:
    app = checked_container(args.app_container, "application container")
    worker = checked_container(args.worker_container, "worker container")
    runtime = runtime_identity(Path(args.manifest), args.release_id)
    candidate = candidate_manifest_identity(Path(args.candidate_view))
    if candidate != runtime:
        fail("candidate view manifest does not match the published runtime manifest")
    application = application_identity(app, worker)
    migrations = migration_set(app)
    proof = {
        "schemaVersion": SCHEMA,
        "runtime": runtime,
        "application": application,
        "consumerContract": CONSUMER_CONTRACT,
        "migrationSet": migrations,
    }
    output = proof_path(Path(args.output_dir), proof)
    write_immutable(output, proof)
    return {"proofSha256": sha256(canonical(proof) + b"\n"), **proof}


def verify(args: argparse.Namespace) -> Dict[str, Any]:
    app = checked_container(args.app_container, "application container")
    worker = checked_container(args.worker_container, "worker container")
    proof = read_proof(Path(args.proof))
    runtime = runtime_identity(Path(args.manifest), args.release_id)
    if args.candidate_view:
        candidate = candidate_manifest_identity(Path(args.candidate_view))
        if candidate != runtime:
            fail("candidate view manifest does not match the published runtime manifest")
    ensure_matches(proof, runtime, application_identity(app, worker), migration_set(app))
    return {"proofSha256": sha256(canonical(proof) + b"\n"), **proof}


def inspect(args: argparse.Namespace) -> Dict[str, Any]:
    proof = read_proof(Path(args.proof))
    runtime = runtime_identity(Path(args.manifest), args.release_id)
    if proof["runtime"] != runtime:
        fail("compatibility proof does not match runtime manifest")
    return {"proofSha256": sha256(canonical(proof) + b"\n"), **proof}


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command")
    for name in ("capture", "verify", "inspect"):
        command = commands.add_parser(name)
        command.add_argument("--release-id", required=True)
        command.add_argument("--manifest", required=True)
        if name != "inspect":
            command.add_argument("--app-container", required=True)
            command.add_argument("--worker-container", required=True)
    commands.choices["capture"].add_argument("--candidate-view", required=True)
    commands.choices["capture"].add_argument("--output-dir", required=True)
    for name in ("verify", "inspect"):
        commands.choices[name].add_argument("--proof", required=True)
    commands.choices["verify"].add_argument("--candidate-view")
    args = parser.parse_args()
    if args.command is None:
        parser.error("a command is required")
    try:
        result = capture(args) if args.command == "capture" else verify(args) if args.command == "verify" else inspect(args)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    main()
