"""Consumer-identity filesystem gate for the developer OSS runtime view.

Issue #1713: the materializer's ``verify`` proves link shape and sizes but
never opens content as the user that will run the app, and the release
manifest can legitimately omit a governance artifact the app requires, so a
broken delivery used to surface as a business "resource missing" error.  This
module verifies every manifest leaf from the consumer process identity
(same UID/GID as frontend/worker, because bootstrap launches them), checks the
versioned required-artifact registry, and emits a credential-free receipt that
``/api/readyz`` keeps validating after startup.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

REQUIREMENTS_SCHEMA = "act-runtime-requirements.v1"
VERIFICATION_SCHEMA = "act-runtime-consumer-verification.v1"
VERIFIER_VERSION = "consumer-verification.v1"
RECEIPT_FILENAME = ".act-runtime-consumer-verification.json"
DEV_DELIVERY_FILENAME = ".act-runtime-dev-delivery.json"
# 分层验证阈值（设计决议）：低于该大小的叶节点启动前做全量 SHA-256；
# 更大的媒体文件以「发布时哈希 + 运行时可读打开 + 大小比对」证明。
# 该阈值由单元测试固定，调整必须同步测试。
MEDIA_FULL_HASH_LIMIT_BYTES = 8 * 1024 * 1024
DEFAULT_REQUIREMENTS_PATH = Path(__file__).resolve().parent / "runtime_requirements.json"
SECRET_FIELD_NAMES = ("accessKeyId", "accessKeySecret", "AccessKeyId", "AccessKeySecret", "Secret")


class ConsumerVerificationError(RuntimeError):
    """Raised with a credential-safe failure class when the view is not consumer-ready."""

    def __init__(self, failure_class: str, detail: str) -> None:
        super().__init__("%s: %s" % (failure_class, detail))
        self.failure_class = failure_class
        self.detail = detail


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_runtime_requirements(path: Optional[Path] = None) -> Dict[str, Any]:
    requirements_path = Path(path) if path else DEFAULT_REQUIREMENTS_PATH
    try:
        payload = json.loads(requirements_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ConsumerVerificationError("requirements-missing", "runtime requirement registry is missing")
    except json.JSONDecodeError:
        raise ConsumerVerificationError("requirements-invalid", "runtime requirement registry is not valid JSON")
    if not isinstance(payload, dict) or payload.get("schemaVersion") != REQUIREMENTS_SCHEMA:
        raise ConsumerVerificationError("requirements-invalid", "runtime requirement registry schema is unsupported")
    capabilities = payload.get("capabilities")
    if not isinstance(capabilities, dict) or not capabilities:
        raise ConsumerVerificationError("requirements-invalid", "runtime requirement registry has no capabilities")
    for name, capability in capabilities.items():
        artifacts = capability.get("artifacts") if isinstance(capability, dict) else None
        if not isinstance(artifacts, list) or not artifacts:
            raise ConsumerVerificationError(
                "requirements-invalid",
                "capability %s does not declare artifacts" % name,
            )
        for artifact in artifacts:
            relative = artifact.get("path") if isinstance(artifact, dict) else None
            if (
                not isinstance(relative, str)
                or not relative
                or relative.startswith("/")
                or ".." in relative.split("/")
            ):
                raise ConsumerVerificationError(
                    "requirements-invalid",
                    "capability %s declares an invalid artifact path" % name,
                )
    return payload


def required_artifact_paths(requirements: Dict[str, Any]) -> List[str]:
    paths: List[str] = []
    for capability in requirements["capabilities"].values():
        for artifact in capability["artifacts"]:
            if artifact["path"] not in paths:
                paths.append(artifact["path"])
    return paths


def verify_required_artifacts(view: Path, requirements: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Open and parse every registered artifact as the current (consumer) user.

    Issue #1713 P1：除存在与可读外，还校验 registry 声明的精确合同版本，以及
    工件之间的内部引用关系（如 option attributions 的 baselineVersion 必须等于
    正式 baseline 的 version），防止版本漂移被当作成功交付持久化。
    """
    payloads: Dict[str, Any] = {}
    verified: List[Dict[str, Any]] = []
    for name, capability in sorted(requirements["capabilities"].items()):
        for artifact in capability["artifacts"]:
            relative = artifact["path"]
            target = view / relative
            try:
                raw = target.read_bytes()
            except PermissionError:
                raise ConsumerVerificationError("permission-denied", "required artifact %s" % relative)
            except FileNotFoundError:
                raise ConsumerVerificationError(
                    "artifact-missing",
                    "capability %s requires %s which the selected view does not expose" % (name, relative),
                )
            except OSError as error:
                raise ConsumerVerificationError("read-failure", "required artifact %s (%s)" % (relative, error))
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise ConsumerVerificationError("artifact-invalid", "required artifact %s is not JSON" % relative)
            if artifact.get("requireVersion") and not isinstance(payload, dict):
                raise ConsumerVerificationError(
                    "artifact-invalid",
                    "required artifact %s must be an object with a version field" % relative,
                )
            # 正式治理工件使用 version 字段（如 micro-tutoring-assessment-baseline.v2）；
            # 同时接受 schemaVersion 以兼容对象形态的目录类工件。
            if artifact.get("requireVersion") and not isinstance(
                payload.get("version") or payload.get("schemaVersion"), str,
            ):
                raise ConsumerVerificationError(
                    "artifact-invalid",
                    "required artifact %s does not declare a version" % relative,
                )
            if artifact.get("requireVersion"):
                payloads[relative] = payload
            verified.append({
                "capability": name,
                "path": relative,
                "sizeBytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
            })
    for name, capability in sorted(requirements["capabilities"].items()):
        for artifact in capability["artifacts"]:
            relative = artifact["path"]
            expected_version = artifact.get("exactVersion")
            if expected_version:
                actual = payloads.get(relative, {}).get("version") or payloads.get(relative, {}).get("schemaVersion")
                if actual != expected_version:
                    raise ConsumerVerificationError(
                        "version-drift",
                        "required artifact %s declares %r but the runtime contract requires %r"
                        % (relative, actual, expected_version),
                    )
            for reference in artifact.get("references") or []:
                field = reference.get("field")
                referenced_path = reference.get("artifact")
                referenced = payloads.get(referenced_path, {})
                referenced_version = referenced.get("version") or referenced.get("schemaVersion")
                actual = payloads.get(relative, {}).get(field)
                if referenced_version is None or actual != referenced_version:
                    raise ConsumerVerificationError(
                        "reference-drift",
                        "required artifact %s field %s does not match the governed version of %s"
                        % (relative, field, referenced_path),
                    )
    return verified


def verify_consumer_view(
    view: Path,
    manifest: Dict[str, Any],
    requirements: Dict[str, Any],
    *,
    media_full_hash_limit: int = MEDIA_FULL_HASH_LIMIT_BYTES,
) -> Dict[str, Any]:
    """Verify the complete manifest leaf set from the consumer process identity.

    Runs in the bootstrap process, which owns the same UID/GID as the
    frontend/worker/scheduler it is about to start, so a successful read here
    is a consumer read, not an owner or root read.
    """
    helper = view / ".act-runtime-blobs"
    hashed_leaves = 0
    for entry in manifest["files"]:
        logical = view / entry["path"]
        expected_blob = helper / entry["sha256"]
        try:
            os.lstat(str(logical))
        except PermissionError:
            raise ConsumerVerificationError("permission-denied", "manifest leaf %s" % entry["path"])
        except FileNotFoundError:
            raise ConsumerVerificationError("artifact-missing", "manifest leaf %s" % entry["path"])
        except OSError as error:
            raise ConsumerVerificationError("traversal-denied", "manifest leaf %s (%s)" % (entry["path"], error))
        if not os.path.islink(str(logical)):
            raise ConsumerVerificationError("link-invalid", "manifest leaf %s is not a relative blob link" % entry["path"])
        target = Path(os.path.realpath(str(logical)))
        if target != expected_blob.resolve():
            raise ConsumerVerificationError("link-escape", "manifest leaf %s escapes its manifest blob" % entry["path"])
        try:
            with target.open("rb") as handle:
                handle.read(1)
                size = os.fstat(handle.fileno()).st_size
        except PermissionError:
            raise ConsumerVerificationError("permission-denied", "blob content %s" % entry["path"])
        except FileNotFoundError:
            raise ConsumerVerificationError("artifact-missing", "blob content %s" % entry["path"])
        except OSError as error:
            raise ConsumerVerificationError("read-failure", "blob content %s (%s)" % (entry["path"], error))
        if size != entry["sizeBytes"]:
            raise ConsumerVerificationError("size-mismatch", "manifest leaf %s" % entry["path"])
        if entry["sizeBytes"] <= media_full_hash_limit:
            if _sha256_file(target) != entry["sha256"]:
                raise ConsumerVerificationError("digest-mismatch", "manifest leaf %s" % entry["path"])
            hashed_leaves += 1
    artifacts = verify_required_artifacts(view, requirements)
    artifact_set_digest = hashlib.sha256(
        json.dumps(artifacts, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "schemaVersion": VERIFICATION_SCHEMA,
        "verifierVersion": VERIFIER_VERSION,
        "releaseId": manifest["releaseId"],
        "manifestSha256": manifest["manifestSha256"],
        "treeSha256": manifest["treeSha256"],
        "consumerUid": os.geteuid(),
        "consumerGid": os.getegid(),
        "leafCount": len(manifest["files"]),
        "hashedLeafCount": hashed_leaves,
        "mediaFullHashLimitBytes": media_full_hash_limit,
        "requiredArtifacts": artifacts,
        "requiredArtifactSetDigest": artifact_set_digest,
        "verifiedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def write_verification_receipt(path: Path, payload: Dict[str, Any]) -> None:
    serialized = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    for secret in SECRET_FIELD_NAMES:
        if secret in serialized:
            raise ConsumerVerificationError("receipt-invalid", "verification receipt must not contain credentials")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(serialized, encoding="utf-8")
    os.chmod(temporary, 0o644)
    os.replace(temporary, path)


def read_verification_receipt(path: Path) -> Optional[Dict[str, Any]]:
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("schemaVersion") != VERIFICATION_SCHEMA:
        return None
    return payload


def receipt_matches_binding(
    payload: Optional[Dict[str, Any]],
    *,
    release_id: str,
    manifest_sha256: str,
    tree_sha256: str,
    runtime_root: Path,
    consumer_uid: int,
) -> bool:
    if not payload:
        return False
    return (
        payload.get("releaseId") == release_id
        and payload.get("manifestSha256") == manifest_sha256
        and payload.get("treeSha256") == tree_sha256
        and payload.get("consumerUid") == consumer_uid
        and payload.get("runtimeRoot") == str(runtime_root)
        and payload.get("verifierVersion") == VERIFIER_VERSION
    )
