#!/usr/bin/env python3
"""Install successor Teaching control-plane overlays onto a selected blob-view.

#1509 10.7 commits host Authority, then activate-runtime-blob-release restores
parent Teaching overlays onto the successor Runtime view. That leaves host
Authority on v0.37 while blob-view Teaching stays on v0.22.

This installer does not write Authority current.json, Runtime identity, OSS
objects, or a new Runtime release. It copies successor overlay pointers from a
Git runtime snapshot, then removes predecessor overlay regular files that would
fail view verification.
"""

from __future__ import print_function

import argparse
import hashlib
import importlib.util
import json
import math
import os
import stat
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


REQUIRED_POINTER_RELATIVES = (
    "knowledge/projection/current.json",
    "knowledge/prerequisites/current.json",
    "knowledge/authority-domain-catalog/current.json",
    "knowledge/authority-domain-shards/current.json",
    "knowledge/consumer-activation/current.json",
    "knowledge/teaching-projection/domain-fragments/current.json",
)
PREFIX_PAYLOAD_POINTER_RELATIVES = (
    "knowledge/teaching-projection/domain-fragments/current.json",
)
CATALOG_PAYLOAD_RELATIVE = "knowledge/authority-domain-catalog/catalog.json"
DOMAIN_TEACHING_FRAGMENT_CONTRACT = "act-domain-teaching-fragment/v1"
DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION = "act-domain-teaching-fragment-builder/v1"
DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT = "act-domain-teaching-composed-manifest/v1"
DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION = "act-domain-teaching-composition-builder/v1"
REGISTERED_PEER_DOMAIN_IDS = (
    "classical-control-design",
    "discrete-time-control-analysis",
    "frequency-domain-analysis",
    "root-locus",
    "stability-analysis",
    "state-space-control-analysis-and-design",
    "system-modeling",
    "time-domain-analysis",
)
COVERAGE_NOTES = {
    "available": "该领域已发布可用的教学关系覆盖",
    "partial": "该领域仅有部分教学关系已发布",
    "empty": "该领域尚无已发布的教学关系",
    "unavailable": "教学投影层暂不可用",
}


def fail(message):
    # type: (str) -> None
    raise ValueError(message)


def load_materializer():
    candidates = [
        Path(__file__).resolve().parents[1] / "materialize-runtime-blob-release.py",
        Path(__file__).resolve().parents[1] / "runtime-release" / "materialize-runtime-blob-release.py",
    ]
    last_error = "materializer is unavailable"
    for path in candidates:
        if not path.is_file() or path.is_symlink():
            continue
        spec = importlib.util.spec_from_file_location("materialize_runtime_blob_release", str(path))
        if spec is None or spec.loader is None:
            continue
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, "read_control_plane_pointer") and hasattr(module, "discover_control_plane_overlay_regular_paths"):
            return module
        last_error = "materializer %s lacks control-plane overlay helpers" % path
    fail(last_error)


def require_real_directory(path, label):
    # type: (Path, str) -> Path
    try:
        details = os.lstat(str(path))
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
        fail("%s must be a real directory" % label)
    return path.resolve()


def require_regular_file(path, label):
    # type: (Path, str) -> Path
    try:
        details = os.lstat(str(path))
    except OSError as error:
        fail("%s is missing: %s" % (label, error))
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        fail("%s must be a regular non-symlink file" % label)
    return path


def read_json(path):
    # type: (Path) -> Dict[str, Any]
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        fail("%s is not a JSON object" % path)
    return value


def sha256_file(path):
    # type: (Path) -> str
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_regular_bytes(path, body):
    # type: (Path, bytes) -> None
    path.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(str(path.parent), 0o755)
    temporary = path.parent / (".%s.%s.tmp" % (path.name, os.getpid()))
    if temporary.exists() or temporary.is_symlink():
        temporary.unlink()
    with temporary.open("wb") as handle:
        handle.write(body)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(str(temporary), 0o644)
    os.replace(str(temporary), str(path))


def copy_regular(source, destination):
    # type: (Path, Path) -> str
    require_regular_file(source, str(source))
    with source.open("rb") as handle:
        body = handle.read()
    write_regular_bytes(destination, body)
    return sha256_file(destination)


def unlink_regular(path):
    # type: (Path) -> bool
    try:
        details = os.lstat(str(path))
    except OSError:
        return False
    if stat.S_ISLNK(details.st_mode) or not stat.S_ISREG(details.st_mode):
        return False
    path.unlink()
    return True


def prune_empty_directories(root, relative):
    # type: (Path, str) -> None
    current = (root / relative).resolve()
    root_resolved = root.resolve()
    while current != root_resolved and str(current).startswith(str(root_resolved) + os.sep):
        try:
            details = os.lstat(str(current))
        except OSError:
            return
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
            return
        try:
            os.rmdir(str(current))
        except OSError:
            return
        current = current.parent


def pointer_authority_release_id(pointer):
    # type: (Dict[str, Any]) -> Optional[str]
    for key in ("authorityReleaseId", "releaseId"):
        value = pointer.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def collect_source_overlay_files(source_root, materializer):
    # type: (Path, Any) -> List[str]
    relatives = list(REQUIRED_POINTER_RELATIVES)
    relatives.append(CATALOG_PAYLOAD_RELATIVE)
    files = []
    seen = set()
    for relative in relatives:
        require_regular_file(source_root / relative, relative)
        if relative not in seen:
            files.append(relative)
            seen.add(relative)
        if not relative.endswith("/current.json"):
            continue
        pointer = materializer.read_control_plane_pointer(source_root / relative)
        for kind, payload_relative in materializer.control_plane_payload_targets(relative, pointer):
            if kind == "prefix":
                if relative not in PREFIX_PAYLOAD_POINTER_RELATIVES:
                    continue
                for extra in sorted(materializer.regular_files_under(source_root, payload_relative)):
                    require_regular_file(source_root / extra, extra)
                    if extra not in seen:
                        files.append(extra)
                        seen.add(extra)
            elif kind in {"file", "any_file"}:
                candidate = source_root / payload_relative
                try:
                    details = os.lstat(str(candidate))
                except OSError:
                    continue
                if stat.S_ISREG(details.st_mode) and not stat.S_ISLNK(details.st_mode):
                    if payload_relative not in seen:
                        files.append(payload_relative)
                        seen.add(payload_relative)
    return files


def projection_canonical_json(value):
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int) and not isinstance(value, bool):
        return json.dumps(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            fail("canonical JSON cannot contain a non-finite number")
        return json.dumps(value)
    if isinstance(value, list):
        return "[" + ",".join(projection_canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return "{" + ",".join(
            "%s:%s" % (json.dumps(key, ensure_ascii=False), projection_canonical_json(value[key]))
            for key in keys
        ) + "}"
    fail("canonical JSON contains an unsupported value")


def projection_digest(value):
    return hashlib.sha256(projection_canonical_json(value).encode("utf-8")).hexdigest()


def require_string_list(value, label):
    if not isinstance(value, list):
        fail("%s must be an array" % label)
    items = []
    for item in value:
        if not isinstance(item, str):
            fail("%s must contain only strings" % label)
        items.append(item)
    return items


def require_object_list(value, label):
    if not isinstance(value, list):
        fail("%s must be an array" % label)
    items = []
    for item in value:
        if not isinstance(item, dict):
            fail("%s must contain only objects" % label)
        items.append(item)
    return items


def compute_fragment_body_digest(fragment):
    return projection_digest({
        "contract": DOMAIN_TEACHING_FRAGMENT_CONTRACT,
        "builderVersion": DOMAIN_TEACHING_FRAGMENT_BUILDER_VERSION,
        "fragmentKey": fragment.get("fragmentKey"),
        "fragmentVersion": fragment.get("fragmentVersion"),
        "domainKeys": sorted(require_string_list(fragment.get("domainKeys"), "fragment.domainKeys")),
        "authorityBinding": fragment.get("authorityBinding"),
        "authoritySelection": fragment.get("authoritySelection"),
        "authoringRevision": fragment.get("authoringRevision"),
        "sourceInventoryDigest": fragment.get("sourceInventoryDigest"),
        "authorityDigest": fragment.get("authorityDigest"),
        "evidenceRefs": sorted(require_string_list(fragment.get("evidenceRefs"), "fragment.evidenceRefs")),
        "coreNodes": sorted(
            require_object_list(fragment.get("coreNodes"), "fragment.coreNodes"),
            key=lambda node: node.get("canonicalId") if isinstance(node.get("canonicalId"), str) else "",
        ),
        "relations": sorted(
            require_object_list(fragment.get("relations"), "fragment.relations"),
            key=lambda relation: relation.get("edgeId") if isinstance(relation.get("edgeId"), str) else "",
        ),
    })


def compute_fragment_source_inventory_digest(fragment):
    nodes = []
    for node in sorted(
        require_object_list(fragment.get("coreNodes"), "fragment.coreNodes"),
        key=lambda item: item.get("canonicalId") if isinstance(item.get("canonicalId"), str) else "",
    ):
        nodes.append({
            "canonicalId": node.get("canonicalId"),
            "sourceKind": node.get("sourceKind"),
            "sourceEvidence": sorted(str(item) for item in (node.get("sourceEvidence") or [])),
            "moduleId": node.get("moduleId"),
            "pathEligible": node.get("pathEligible") is True,
            "cardPolicy": node.get("cardPolicy"),
        })
    relations = []
    for relation in sorted(
        require_object_list(fragment.get("relations"), "fragment.relations"),
        key=lambda item: "%s\x1f%s\x1f%s\x1f%s" % (
            item.get("sourceNodeId") or "",
            item.get("targetNodeId") or "",
            item.get("relationType") or "",
            item.get("strength") or "",
        ),
    ):
        relations.append({
            "edgeId": relation.get("edgeId"),
            "sourceNodeId": relation.get("sourceNodeId"),
            "targetNodeId": relation.get("targetNodeId"),
            "relationType": relation.get("relationType"),
            "strength": relation.get("strength"),
            "evidenceRefs": sorted(str(item) for item in (relation.get("evidenceRefs") or [])),
            "authorDecisionId": relation.get("authorDecisionId"),
        })
    return projection_digest({
        "kind": "act-domain-teaching-source-inventory",
        "nodes": nodes,
        "relations": relations,
    })


def verify_domain_teaching_fragment(fragment, fragment_id):
    recomputed = compute_fragment_body_digest(fragment)
    if fragment.get("fragmentDigest") != recomputed:
        fail("domain teaching fragment %s body digest drifted" % fragment_id)
    if fragment.get("fragmentId") != "dtf-%s" % recomputed:
        fail("domain teaching fragment %s identity drifted" % fragment_id)
    if fragment.get("sourceInventoryDigest") != compute_fragment_source_inventory_digest(fragment):
        fail("domain teaching fragment %s source inventory drifted" % fragment_id)
    core_nodes = require_object_list(fragment.get("coreNodes"), "fragment.coreNodes")
    relations = require_object_list(fragment.get("relations"), "fragment.relations")
    if fragment.get("coreNodeCount") != len(core_nodes) or fragment.get("relationCount") != len(relations):
        fail("domain teaching fragment %s count fields drifted" % fragment_id)


def pick_stable_nullable(left, right):
    if left == right:
        return left
    if not left:
        return right
    if not right:
        return left
    if left <= right:
        return left
    return right


def merge_core_nodes(fragments):
    by_id = {}
    for fragment in fragments:
        for node in require_object_list(fragment.get("coreNodes"), "fragment.coreNodes"):
            canonical_id = node.get("canonicalId")
            if not isinstance(canonical_id, str) or not canonical_id:
                fail("domain teaching fragment core node is missing canonicalId")
            existing = by_id.get(canonical_id)
            if existing is None:
                by_id[canonical_id] = dict(
                    node,
                    domainKeys=list(require_string_list(node.get("domainKeys"), "coreNode.domainKeys")),
                    sourceEvidence=list(node.get("sourceEvidence") or []),
                )
                continue
            if existing.get("pathEligible") != node.get("pathEligible") or existing.get("cardPolicy") != node.get("cardPolicy"):
                fail("domain teaching core node %s policy conflict" % canonical_id)
            merged = {
                "canonicalId": existing["canonicalId"],
                "domainKeys": sorted(set(existing["domainKeys"] + require_string_list(node.get("domainKeys"), "coreNode.domainKeys"))),
                "pathEligible": existing.get("pathEligible"),
                "cardPolicy": existing.get("cardPolicy"),
                "moduleId": existing.get("moduleId") if existing.get("moduleId") is not None else node.get("moduleId"),
                "rationale": existing.get("rationale"),
                "sourceKind": existing.get("sourceKind"),
                "sourceEvidence": sorted(set(list(existing.get("sourceEvidence") or []) + list(node.get("sourceEvidence") or []))),
            }
            by_id[canonical_id] = dict(merged, nodeDigest=projection_digest(merged))
    return sorted(by_id.values(), key=lambda node: node["canonicalId"])


def merge_relations(fragments):
    by_semantic = {}
    edge_to_semantic = {}
    for fragment in fragments:
        for relation in require_object_list(fragment.get("relations"), "fragment.relations"):
            semantic = "\x1f".join([
                relation.get("sourceNodeId") or "",
                relation.get("targetNodeId") or "",
                relation.get("relationType") or "",
                relation.get("strength") or "",
            ])
            edge_id = relation.get("edgeId")
            if not isinstance(edge_id, str) or not edge_id:
                fail("domain teaching relation is missing edgeId")
            existing_semantic = edge_to_semantic.get(edge_id)
            if existing_semantic and existing_semantic != semantic:
                fail("domain teaching relation %s semantic conflict" % edge_id)
            existing = by_semantic.get(semantic)
            if existing is None:
                by_semantic[semantic] = dict(
                    relation,
                    domainKeys=list(require_string_list(relation.get("domainKeys"), "relation.domainKeys")),
                    evidenceRefs=list(relation.get("evidenceRefs") or []),
                )
                edge_to_semantic[edge_id] = semantic
                continue
            if existing.get("edgeId") != edge_id:
                fail("domain teaching relation %s identity conflict" % edge_id)
            body = {
                "edgeId": existing["edgeId"],
                "sourceNodeId": existing.get("sourceNodeId"),
                "targetNodeId": existing.get("targetNodeId"),
                "layer": existing.get("layer"),
                "relationType": existing.get("relationType"),
                "strength": existing.get("strength"),
                "domainKeys": sorted(set(existing["domainKeys"] + require_string_list(relation.get("domainKeys"), "relation.domainKeys"))),
                "evidenceRefs": sorted(set(list(existing.get("evidenceRefs") or []) + list(relation.get("evidenceRefs") or []))),
                "curatorId": pick_stable_nullable(existing.get("curatorId"), relation.get("curatorId")),
                "curatorRationale": pick_stable_nullable(existing.get("curatorRationale"), relation.get("curatorRationale")),
                "authorDecisionId": pick_stable_nullable(existing.get("authorDecisionId"), relation.get("authorDecisionId")),
                "presentationFamily": existing.get("presentationFamily"),
            }
            by_semantic[semantic] = dict(body, edgeDigest=projection_digest(body))
    return sorted(by_semantic.values(), key=lambda relation: relation["edgeId"])


def build_domain_coverage_report(declared_domain_keys, core_nodes, relations):
    declared = set(declared_domain_keys)
    report = []
    for domain_id in REGISTERED_PEER_DOMAIN_IDS:
        domain_nodes = [node for node in core_nodes if domain_id in (node.get("domainKeys") or [])]
        domain_relations = [relation for relation in relations if domain_id in (relation.get("domainKeys") or [])]
        core_node_count = len(domain_nodes)
        relation_count = len(domain_relations)
        if relation_count == 0:
            uncovered = core_node_count
        else:
            covered = set()
            for relation in domain_relations:
                covered.add(relation.get("sourceNodeId"))
                covered.add(relation.get("targetNodeId"))
            uncovered = len([node for node in domain_nodes if node.get("canonicalId") not in covered])
        if domain_id not in declared and relation_count == 0 and core_node_count == 0:
            coverage = "empty"
        elif relation_count == 0:
            coverage = "empty"
        elif uncovered > 0:
            coverage = "partial"
        else:
            coverage = "available"
        report.append({
            "domainId": domain_id,
            "coverage": coverage,
            "coreNodeCount": core_node_count,
            "relationCount": relation_count,
            "uncoveredCoreNodeCount": uncovered,
            "note": COVERAGE_NOTES[coverage],
        })
    return report


def recompose_domain_teaching_projection(fragments, authoring_revision):
    if not fragments:
        fail("composed-manifest does not declare any domain teaching fragments")
    core_nodes = merge_core_nodes(fragments)
    relations = merge_relations(fragments)
    declared = []
    for fragment in fragments:
        declared.extend(require_string_list(fragment.get("domainKeys"), "fragment.domainKeys"))
    coverage = build_domain_coverage_report(declared, core_nodes, relations)
    fragment_refs = []
    for index, fragment in enumerate(fragments):
        fragment_refs.append({
            "order": index,
            "fragmentId": fragment.get("fragmentId"),
            "fragmentKey": fragment.get("fragmentKey"),
            "fragmentVersion": fragment.get("fragmentVersion"),
            "fragmentDigest": fragment.get("fragmentDigest"),
            "sourceInventoryDigest": fragment.get("sourceInventoryDigest"),
            "domainKeys": list(require_string_list(fragment.get("domainKeys"), "fragment.domainKeys")),
        })
    fragments_hash = projection_digest([
        {
            "order": ref["order"],
            "fragmentId": ref["fragmentId"],
            "fragmentDigest": ref["fragmentDigest"],
            "sourceInventoryDigest": ref["sourceInventoryDigest"],
        }
        for ref in fragment_refs
    ])
    source_inventory_digest = projection_digest([
        {
            "fragmentId": ref["fragmentId"],
            "sourceInventoryDigest": ref["sourceInventoryDigest"],
        }
        for ref in fragment_refs
    ])
    first = fragments[0]
    authority_binding = first.get("authorityBinding")
    authority_selection = first.get("authoritySelection")
    if not isinstance(authority_binding, dict) or not isinstance(authority_selection, dict):
        fail("domain teaching fragment authority identity is missing")
    authority_digest = projection_digest({
        "kind": "act-domain-teaching-authority-identity",
        "binding": authority_binding,
        "sourceDatasetHash": authority_selection.get("sourceDatasetHash"),
        "captureRevision": authority_selection.get("captureRevision"),
        "authoringRevision": authoring_revision,
        "nodeIndexDigest": authority_selection.get("nodeIndexDigest"),
    })
    body = {
        "contract": DOMAIN_TEACHING_COMPOSED_MANIFEST_CONTRACT,
        "builderVersion": DOMAIN_TEACHING_COMPOSITION_BUILDER_VERSION,
        "authorityBinding": authority_binding,
        "authoritySelection": authority_selection,
        "authoringRevision": authoring_revision,
        "sourceInventoryDigest": source_inventory_digest,
        "authorityDigest": authority_digest,
        "fragments": fragment_refs,
        "domainCoverage": coverage,
        "coreNodeCount": len(core_nodes),
        "relationCount": len(relations),
        "gateStatus": "PUBLISHED",
        "gatePassed": True,
        "sourceHashes": {
            "fragments": fragments_hash,
            "sourceInventory": source_inventory_digest,
        },
    }
    body_hash = projection_digest(body)
    projection_hash = projection_digest({
        "contract": body["contract"],
        "builderVersion": body["builderVersion"],
        "authorityBinding": body["authorityBinding"],
        "authoritySelection": body["authoritySelection"],
        "authoringRevision": body["authoringRevision"],
        "sourceInventoryDigest": body["sourceInventoryDigest"],
        "authorityDigest": body["authorityDigest"],
        "fragments": body["fragments"],
        "domainCoverage": body["domainCoverage"],
        "coreNodeCount": body["coreNodeCount"],
        "relationCount": body["relationCount"],
        "gateStatus": body["gateStatus"],
        "gatePassed": body["gatePassed"],
        "sourceHashes": {
            "fragments": fragments_hash,
            "sourceInventory": source_inventory_digest,
            "body": body_hash,
        },
    })
    return {
        "coreNodes": core_nodes,
        "relations": relations,
        "coverage": coverage,
        "fragmentRefs": fragment_refs,
        "fragmentsHash": fragments_hash,
        "sourceInventoryDigest": source_inventory_digest,
        "authorityDigest": authority_digest,
        "bodyHash": body_hash,
        "projectionHash": projection_hash,
    }


def require_domain_teaching_closure(source_root, pointer, expected_hash):
    # type: (Path, Dict[str, Any], str) -> None
    projection_id = pointer.get("projectionId")
    projection_hash = pointer.get("projectionHash")
    if not isinstance(projection_id, str) or not projection_id:
        fail("domain teaching projectionId is missing")
    if projection_hash != expected_hash:
        fail("successor domain teaching projection hash does not match the expected identity")
    release = source_root / "knowledge/teaching-projection/domain-fragments/releases" / projection_id
    manifest_path = release / "composed-manifest.json"
    require_regular_file(manifest_path, "knowledge/teaching-projection/domain-fragments/releases/%s/composed-manifest.json" % projection_id)
    manifest = read_json(manifest_path)
    if manifest.get("projectionId") != projection_id or manifest.get("projectionHash") != expected_hash:
        fail("composed-manifest identity does not match the expected domain teaching projection")
    fragment_refs = manifest.get("fragments")
    if not isinstance(fragment_refs, list) or not fragment_refs:
        fail("composed-manifest does not declare any domain teaching fragments")
    ordered = []
    for item in fragment_refs:
        if not isinstance(item, dict):
            fail("composed-manifest fragment ref is invalid")
        ordered.append(item)
    ordered.sort(key=lambda item: item["order"] if isinstance(item.get("order"), int) else -1)
    fragments = []
    for ref in ordered:
        fragment_id = ref.get("fragmentId")
        fragment_digest = ref.get("fragmentDigest")
        if not isinstance(fragment_id, str) or not fragment_id:
            fail("composed-manifest fragmentId is missing")
        relative = "knowledge/teaching-projection/domain-fragments/releases/%s/fragments/%s.json" % (
            projection_id,
            fragment_id,
        )
        require_regular_file(source_root / relative, relative)
        fragment = read_json(source_root / relative)
        if fragment.get("fragmentId") != fragment_id:
            fail("domain teaching fragment %s identity drifted" % fragment_id)
        if isinstance(fragment_digest, str) and fragment.get("fragmentDigest") != fragment_digest:
            fail("domain teaching fragment %s digest drifted" % fragment_id)
        if ref.get("sourceInventoryDigest") != fragment.get("sourceInventoryDigest"):
            fail("domain teaching fragment %s inventory drifted" % fragment_id)
        verify_domain_teaching_fragment(fragment, fragment_id)
        fragments.append(fragment)
    authoring_revision = manifest.get("authoringRevision")
    if not isinstance(authoring_revision, str) or not authoring_revision:
        fail("composed-manifest authoringRevision is missing")
    recomputed = recompose_domain_teaching_projection(fragments, authoring_revision)
    source_hashes = manifest.get("sourceHashes")
    if not isinstance(source_hashes, dict):
        fail("composed-manifest sourceHashes are missing")
    if recomputed["projectionHash"] != expected_hash:
        fail("recomposed domain teaching projection hash does not match the expected identity")
    if (
        recomputed["projectionHash"] != manifest.get("projectionHash")
        or recomputed["bodyHash"] != source_hashes.get("body")
        or recomputed["fragmentsHash"] != source_hashes.get("fragments")
        or recomputed["sourceInventoryDigest"] != manifest.get("sourceInventoryDigest")
        or recomputed["authorityDigest"] != manifest.get("authorityDigest")
        or len(recomputed["coreNodes"]) != manifest.get("coreNodeCount")
        or len(recomputed["relations"]) != manifest.get("relationCount")
        or recomputed["coverage"] != manifest.get("domainCoverage")
        or recomputed["fragmentRefs"] != ordered
    ):
        fail("recomposed domain teaching projection identity drifted")


def plan_install(
    view,
    source_root,
    expected_authority_release_id,
    expected_teaching_projection_hash,
    expected_domain_teaching_projection_hash,
    materializer,
):
    # type: (Path, Path, str, str, str, Any) -> Dict[str, Any]
    source_files = collect_source_overlay_files(source_root, materializer)
    successor_pointers = {}
    for relative in REQUIRED_POINTER_RELATIVES:
        pointer = materializer.read_control_plane_pointer(source_root / relative)
        authority = pointer_authority_release_id(pointer)
        if authority is not None and authority != expected_authority_release_id:
            fail("%s authority identity is not the expected successor (%s keys=%s)" % (
                relative, authority, sorted(pointer.keys()),
            ))
        successor_pointers[relative] = pointer
    teaching_hash = successor_pointers["knowledge/projection/current.json"].get("projectionHash")
    if teaching_hash != expected_teaching_projection_hash:
        fail("successor teaching projection hash does not match the expected identity")
    domain_hash = successor_pointers["knowledge/teaching-projection/domain-fragments/current.json"].get("projectionHash")
    if domain_hash != expected_domain_teaching_projection_hash:
        fail("successor domain teaching projection hash does not match the expected identity")
    require_domain_teaching_closure(
        source_root,
        successor_pointers["knowledge/teaching-projection/domain-fragments/current.json"],
        expected_domain_teaching_projection_hash,
    )
    predecessor_regular = set(materializer.discover_control_plane_overlay_regular_paths(view))
    return {
        "successorPointers": successor_pointers,
        "predecessorRegularPaths": sorted(predecessor_regular),
        "sourceFiles": source_files,
    }


def apply_install(
    view,
    source_root,
    expected_authority_release_id,
    expected_teaching_projection_hash,
    expected_domain_teaching_projection_hash,
    materializer,
):
    # type: (Path, Path, str, str, str, Any) -> Dict[str, Any]
    plan = plan_install(
        view,
        source_root,
        expected_authority_release_id,
        expected_teaching_projection_hash,
        expected_domain_teaching_projection_hash,
        materializer,
    )
    copied = {}
    for relative in plan["sourceFiles"]:
        copied[relative] = copy_regular(source_root / relative, view / relative)
    successor_regular = set(materializer.discover_control_plane_overlay_regular_paths(view))
    removed = []
    for relative in plan["predecessorRegularPaths"]:
        if relative in successor_regular:
            continue
        if unlink_regular(view / relative):
            removed.append(relative)
            prune_empty_directories(view, str(Path(relative).parent))
    materializer.require_control_plane_overlay_payloads(view)
    leftover = set(plan["predecessorRegularPaths"]) - successor_regular
    leftover_regular = []
    for relative in leftover:
        path = view / relative
        try:
            details = os.lstat(str(path))
        except OSError:
            continue
        if stat.S_ISREG(details.st_mode) and not stat.S_ISLNK(details.st_mode):
            leftover_regular.append(relative)
    if leftover_regular:
        fail("predecessor overlay regular files remain: %s" % leftover_regular[0])
    return {
        "copied": copied,
        "removed": removed,
        "successorRegularPaths": sorted(successor_regular),
        "teachingProjectionHash": expected_teaching_projection_hash,
        "domainTeachingProjectionHash": expected_domain_teaching_projection_hash,
        "authorityReleaseId": expected_authority_release_id,
    }


def snapshot_overlays(view, snapshot_root, materializer):
    # type: (Path, Path, Any) -> Dict[str, Any]
    if snapshot_root.exists() or snapshot_root.is_symlink():
        fail("overlay snapshot path already exists")
    snapshot_root.mkdir(parents=True)
    os.chmod(str(snapshot_root), 0o755)
    copied = {}
    for relative in sorted(materializer.discover_control_plane_overlay_regular_paths(view)):
        copied[relative] = copy_regular(view / relative, snapshot_root / relative)
    return {"snapshotRoot": str(snapshot_root), "files": copied}


def restore_overlays(view, snapshot_root, materializer):
    # type: (Path, Path, Any) -> Dict[str, Any]
    snapshot = require_real_directory(snapshot_root, "overlay snapshot")
    snapshot_files = set()
    for current, directories, filenames in os.walk(str(snapshot), followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name for name in directories
            if not os.path.islink(str(current_path / name))
        ]
        for name in filenames:
            absolute = current_path / name
            details = os.lstat(str(absolute))
            if stat.S_ISREG(details.st_mode) and not stat.S_ISLNK(details.st_mode):
                snapshot_files.add(absolute.relative_to(snapshot).as_posix())
    current = set(materializer.discover_control_plane_overlay_regular_paths(view))
    removed = []
    for relative in sorted(current - snapshot_files):
        if unlink_regular(view / relative):
            removed.append(relative)
            prune_empty_directories(view, str(Path(relative).parent))
    restored = {}
    for relative in sorted(snapshot_files):
        restored[relative] = copy_regular(snapshot / relative, view / relative)
    return {"restored": restored, "removed": removed}


def parse_args(argv):
    # type: (Optional[List[str]]) -> argparse.Namespace
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--view", required=True, help="resolved blob-view directory")
    parser.add_argument("--source", help="Git runtime root containing successor overlays")
    parser.add_argument("--expected-authority-release-id")
    parser.add_argument("--expected-teaching-projection-hash")
    parser.add_argument("--expected-domain-teaching-projection-hash")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--receipt", help="optional JSON receipt path written after --apply")
    parser.add_argument("--snapshot-to", help="copy current overlay regular files to this directory")
    parser.add_argument("--restore-from", help="restore overlay regular files from a snapshot directory")
    return parser.parse_args(argv)


def main(argv=None):
    # type: (Optional[List[str]]) -> int
    args = parse_args(argv)
    view = require_real_directory(Path(args.view), "view")
    materializer = load_materializer()
    if args.snapshot_to:
        result = snapshot_overlays(view, Path(args.snapshot_to), materializer)
    elif args.restore_from:
        result = restore_overlays(view, Path(args.restore_from), materializer)
    else:
        if (
            not args.source
            or not args.expected_authority_release_id
            or not args.expected_teaching_projection_hash
            or not args.expected_domain_teaching_projection_hash
        ):
            fail("source and successor identities are required")
        source = require_real_directory(Path(args.source), "source")
        if args.apply:
            result = apply_install(
                view,
                source,
                args.expected_authority_release_id,
                args.expected_teaching_projection_hash,
                args.expected_domain_teaching_projection_hash,
                materializer,
            )
            result["applied"] = True
            if args.receipt:
                write_regular_bytes(
                    Path(args.receipt),
                    (json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8"),
                )
        else:
            result = plan_install(
                view,
                source,
                args.expected_authority_release_id,
                args.expected_teaching_projection_hash,
                args.expected_domain_teaching_projection_hash,
                materializer,
            )
            result["applied"] = False
    print(json.dumps(result, separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print("ERROR: %s" % error, file=sys.stderr)
        sys.exit(1)
