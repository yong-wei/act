#!/usr/bin/env python3
"""Validate the developer read-only RAM policy template."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable

ALLOWED_OBJECT_ACTIONS = {
    "oss:GetObject",
    "oss:GetObjectMeta",
    "oss:GetObjectAcl",
    "oss:HeadObject",
}
ALLOWED_LIST_ACTIONS = {"oss:ListObjects", "oss:ListObjectsV2"}
ALLOWED_OBJECT_RESOURCES = {
    "acs:oss:*:*:act-course-assets/runtime/blob-releases/*",
    "acs:oss:*:*:act-course-assets/runtime/blobs/sha256/*",
}
ALLOWED_LIST_RESOURCE = "acs:oss:*:*:act-course-assets"
ALLOWED_PREFIXES = {
    "runtime/blob-releases/",
    "runtime/blob-releases/*",
    "runtime/blobs/sha256/",
    "runtime/blobs/sha256/*",
}
FORBIDDEN_ACTION_MARKERS = (
    "Put",
    "Delete",
    "Copy",
    "Append",
    "Abort",
    "Restore",
    "LiveChannel",
    "Bucket",
    "ram:",
    "sts:",
    "oss:*",
)

POLICY_PATH = Path(__file__).with_name("act-runtime-dev-read.policy.json")


def fail(message: str) -> None:
    raise ValueError(message)


def _as_list(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list) and all(isinstance(item, str) for item in value):
        return value
    fail("policy action or resource must be a string or string array")
    return []


def _contains_forbidden(action: str) -> bool:
    lowered = action.lower()
    if action == "oss:*" or action.endswith(":*"):
        return True
    return any(marker.lower() in lowered for marker in FORBIDDEN_ACTION_MARKERS if marker != "oss:*")


def validate_policy(document: Any) -> dict[str, Any]:
    if not isinstance(document, dict) or set(document) != {"Version", "Statement"}:
        fail("policy must contain only Version and Statement")
    if document.get("Version") != "1":
        fail("policy Version must be 1")
    statements = document.get("Statement")
    if not isinstance(statements, list) or len(statements) != 2:
        fail("policy must contain exactly two Allow statements")

    object_statement, list_statement = statements
    _validate_object_statement(object_statement)
    _validate_list_statement(list_statement)
    return document


def _validate_object_statement(statement: Any) -> None:
    if not isinstance(statement, dict) or set(statement) != {"Effect", "Action", "Resource"}:
        fail("object statement must contain only Effect, Action and Resource")
    if statement.get("Effect") != "Allow":
        fail("object statement Effect must be Allow")
    actions = set(_as_list(statement.get("Action")))
    if actions != ALLOWED_OBJECT_ACTIONS:
        fail("object statement actions are not the read-only allowlist")
    resources = set(_as_list(statement.get("Resource")))
    if resources != ALLOWED_OBJECT_RESOURCES:
        fail("object statement resources must stay inside v2 manifest/blob prefixes")


def _validate_list_statement(statement: Any) -> None:
    if not isinstance(statement, dict) or set(statement) != {"Effect", "Action", "Resource", "Condition"}:
        fail("list statement must contain only Effect, Action, Resource and Condition")
    if statement.get("Effect") != "Allow":
        fail("list statement Effect must be Allow")
    actions = set(_as_list(statement.get("Action")))
    if actions != ALLOWED_LIST_ACTIONS:
        fail("list statement actions must be prefix-scoped ListObjects only")
    resources = _as_list(statement.get("Resource"))
    if resources != [ALLOWED_LIST_RESOURCE]:
        fail("list statement resource must be the bucket without object wildcard")
    condition = statement.get("Condition")
    if not isinstance(condition, dict) or set(condition) != {"StringLike"}:
        fail("list statement must use StringLike oss:Prefix")
    string_like = condition.get("StringLike")
    if not isinstance(string_like, dict) or set(string_like) != {"oss:Prefix"}:
        fail("list statement Condition must contain only oss:Prefix")
    prefixes = set(_as_list(string_like.get("oss:Prefix")))
    if prefixes != ALLOWED_PREFIXES:
        fail("list statement prefixes must stay inside v2 blob-release and blob namespaces")


def load_and_validate(path: Path = POLICY_PATH) -> dict[str, Any]:
    document = json.loads(path.read_text(encoding="utf-8"))
    validate_policy(document)
    dumped = json.dumps(document)
    for marker in ("PutObject", "DeleteObject", "AssumeRole", "ram:", "sts:"):
        if marker.lower() in dumped.lower() and marker != "ListObjects":
            fail("policy document contains a forbidden action marker: %s" % marker)
    return document


def forbidden_actions(actions: Iterable[str]) -> list[str]:
    return [action for action in actions if _contains_forbidden(action)]
