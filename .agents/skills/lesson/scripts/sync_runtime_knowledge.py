#!/usr/bin/env python3
"""
Sync runtime knowledge back to authoring knowledge sources.

The script is intentionally conservative:
- --check only reports missing items and conflicts.
- --apply copies runtime-only cards and appends runtime-only graph entries.
- conflicts are never overwritten; any conflict exits non-zero.

Runtime sources:
  course-content/runtime/knowledge/graph/nodes.json
  course-content/runtime/knowledge/graph/relations.jsonl
  course-content/runtime/knowledge/cards/

Authoring targets:
  course-content/authoring/knowledge/base/knowledge_graph.json
  course-content/authoring/knowledge/base/relations.jsonl
  course-content/authoring/knowledge/cards/
"""

from __future__ import annotations

import argparse
import filecmp
import json
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[4]
COURSE_ROOT = REPO_ROOT / "course-content" if (REPO_ROOT / "course-content").exists() else REPO_ROOT

RUNTIME_KNOWLEDGE = COURSE_ROOT / "runtime" / "knowledge"
AUTHORING_KNOWLEDGE = COURSE_ROOT / "authoring" / "knowledge"

RUNTIME_NODES = RUNTIME_KNOWLEDGE / "graph" / "nodes.json"
RUNTIME_RELS = RUNTIME_KNOWLEDGE / "graph" / "relations.jsonl"
RUNTIME_CARDS = RUNTIME_KNOWLEDGE / "cards"

AUTHORING_GRAPH = AUTHORING_KNOWLEDGE / "base" / "knowledge_graph.json"
AUTHORING_RELS = AUTHORING_KNOWLEDGE / "base" / "relations.jsonl"
AUTHORING_CARDS = AUTHORING_KNOWLEDGE / "cards"
AUTHORING_CANONICAL_NODES = AUTHORING_KNOWLEDGE / "canonical-nodes.json"
AUTHORING_LESSONS = COURSE_ROOT / "authoring" / "lessons"
AUTHORING_NODE_CARDS = AUTHORING_CARDS / "nodes"
AUTHORING_CONCEPT_CARDS = AUTHORING_CARDS / "concepts"

RELATION_DERIVED_FIELDS = {"id", "source_id", "target_id", "run_id"}
NODE_DERIVED_FIELDS = {
    "nodeType",
    "description",
    "positionX",
    "positionY",
    "positionZ",
    "bloomLevel",
    "knowledgeDim",
    "chapterName",
    "content",
    "resources",
    "tags",
}
VALID_KNOWLEDGE_TYPES = {"C", "X", "D", "框架", "前沿"}


@dataclass(frozen=True)
class NodeFieldBackfill:
    node_id: str
    field: str
    value: Any
    source: str


@dataclass
class SyncReport:
    missing_nodes: list[str] = field(default_factory=list)
    missing_relations: list[str] = field(default_factory=list)
    missing_cards: list[str] = field(default_factory=list)
    node_conflicts: list[str] = field(default_factory=list)
    relation_conflicts: list[str] = field(default_factory=list)
    card_conflicts: list[str] = field(default_factory=list)
    ignored_legacy_cards: list[str] = field(default_factory=list)
    node_field_backfills: list[str] = field(default_factory=list)
    applied: list[str] = field(default_factory=list)

    @property
    def conflicts(self) -> list[str]:
        return self.node_conflicts + self.relation_conflicts + self.card_conflicts

    def print(self) -> None:
        print("=== Runtime knowledge sync report ===")
        print(f"course_root: {COURSE_ROOT}")
        print(f"missing nodes: {len(self.missing_nodes)}")
        print(f"missing relations: {len(self.missing_relations)}")
        print(f"missing cards: {len(self.missing_cards)}")
        print(f"ignored legacy cards: {len(self.ignored_legacy_cards)}")
        print(f"safe node field backfills: {len(self.node_field_backfills)}")
        print(f"conflicts: {len(self.conflicts)}")
        print(f"applied changes: {len(self.applied)}")

        for title, items in [
            ("node conflicts", self.node_conflicts),
            ("relation conflicts", self.relation_conflicts),
            ("card conflicts", self.card_conflicts),
            ("ignored legacy cards", self.ignored_legacy_cards),
            ("safe node field backfills", self.node_field_backfills),
            ("missing nodes", self.missing_nodes),
            ("missing relations", self.missing_relations),
            ("missing cards", self.missing_cards),
            ("applied", self.applied),
        ]:
            if items:
                print(f"\n[{title}]")
                for item in items[:50]:
                    print(f"- {item}")
                if len(items) > 50:
                    print(f"... {len(items) - 50} more")


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rows.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_no}: invalid JSONL: {exc}") from exc
    return rows


def sorted_json(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, sort_keys=True))


def normalize_node(node: dict[str, Any]) -> dict[str, Any]:
    if isinstance(node.get("metadata"), dict):
        metadata = dict(node["metadata"])
        normalized = {
            "id": node.get("id") or metadata.get("id"),
            "name": node.get("name") or metadata.get("name"),
            "category": metadata.get("category"),
            "bloom_level": metadata.get("bloom_level"),
            "chapter": metadata.get("chapter") or node.get("chapter"),
            "chapter_name": metadata.get("chapter_name") or metadata.get("chapterName"),
            "definition": metadata.get("definition") or node.get("description"),
            "examples": metadata.get("examples", []),
            "formulas": metadata.get("formulas", []),
            "prerequisites": metadata.get("prerequisites", []),
            "related_concepts": metadata.get("related_concepts", metadata.get("relatedConcepts", [])),
            "difficulty": metadata.get("difficulty"),
            "importance": metadata.get("importance"),
            "keywords": metadata.get("keywords", []),
        }
        if metadata.get("knowledge_type") is not None:
            normalized["knowledge_type"] = metadata["knowledge_type"]
        return sorted_json(normalized)

    cleaned = {k: v for k, v in node.items() if k not in NODE_DERIVED_FIELDS and k != "metadata"}
    cleaned.pop("created_at", None)
    cleaned.pop("updated_at", None)
    return sorted_json(cleaned)


def authoring_node_from_runtime(node: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(node.get("metadata"), dict):
        return dict(node)

    metadata = dict(node["metadata"])
    converted = {
        "id": node.get("id") or metadata.get("id"),
        "name": node.get("name") or metadata.get("name"),
        "category": metadata.get("category"),
        "bloom_level": metadata.get("bloom_level"),
        "chapter": metadata.get("chapter") or node.get("chapter"),
        "chapter_name": metadata.get("chapter_name") or metadata.get("chapterName"),
        "definition": metadata.get("definition") or node.get("description", ""),
        "examples": metadata.get("examples", []),
        "formulas": metadata.get("formulas", []),
        "prerequisites": metadata.get("prerequisites", []),
        "related_concepts": metadata.get("related_concepts", metadata.get("relatedConcepts", [])),
        "difficulty": metadata.get("difficulty", 3),
        "importance": metadata.get("importance", 3),
        "keywords": metadata.get("keywords", []),
    }
    if metadata.get("knowledge_type") is not None:
        converted["knowledge_type"] = metadata["knowledge_type"]
    if metadata.get("created_at") is not None:
        converted["created_at"] = metadata["created_at"]
    if metadata.get("updated_at") is not None:
        converted["updated_at"] = metadata["updated_at"]
    return converted


def normalize_relation(rel: dict[str, Any]) -> dict[str, Any]:
    cleaned = {k: v for k, v in rel.items() if k not in RELATION_DERIVED_FIELDS}
    if "relation_id" not in cleaned and rel.get("id"):
        cleaned["relation_id"] = rel["id"]
    return sorted_json(cleaned)


def relation_key(rel: dict[str, Any]) -> str:
    return str(rel.get("relation_id") or rel.get("id") or f"{rel.get('source')}|{rel.get('target')}|{rel.get('relation_type')}")


def runtime_nodes_by_id() -> dict[str, dict[str, Any]]:
    data = load_json(RUNTIME_NODES)
    if isinstance(data, list):
        return {str(node["id"]): node for node in data}
    if isinstance(data, dict) and isinstance(data.get("nodes"), dict):
        return {str(key): node for key, node in data["nodes"].items()}
    if isinstance(data, dict):
        return {str(key): node for key, node in data.items()}
    raise ValueError(f"Unsupported runtime node file shape: {RUNTIME_NODES}")


def authoring_graph() -> dict[str, Any]:
    data = load_json(AUTHORING_GRAPH)
    if not isinstance(data, dict) or not isinstance(data.get("nodes"), dict):
        raise ValueError(f"Unsupported authoring graph shape: {AUTHORING_GRAPH}")
    return data


def read_card_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}

    frontmatter: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        key, raw_value = line.split(":", 1)
        value = raw_value.strip().strip('"').strip("'")
        if value:
            frontmatter[key.strip()] = value
    return frontmatter


def authoring_node_field_sources() -> dict[str, dict[str, dict[Any, set[str]]]]:
    sources: dict[str, dict[str, dict[Any, set[str]]]] = {}

    for path in sorted(AUTHORING_LESSONS.glob("**/graph/nodes.jsonl")):
        for node in load_jsonl(path):
            node_id = node.get("id")
            value = node.get("knowledge_type")
            if not node_id or value is None:
                continue
            rel_path = path.relative_to(COURSE_ROOT)
            field_sources = sources.setdefault(str(node_id), {}).setdefault("knowledge_type", {})
            field_sources.setdefault(value, set()).add(str(rel_path))

    if AUTHORING_NODE_CARDS.exists():
        for path in sorted(AUTHORING_NODE_CARDS.glob("*.md")):
            frontmatter = read_card_frontmatter(path)
            node_id = frontmatter.get("id") or frontmatter.get("node_id") or path.stem
            value = frontmatter.get("knowledge_type")
            if not node_id or value is None:
                continue
            rel_path = path.relative_to(COURSE_ROOT)
            field_sources = sources.setdefault(str(node_id), {}).setdefault("knowledge_type", {})
            field_sources.setdefault(value, set()).add(str(rel_path))

    return sources


def node_backfill_candidate(
    node_id: str,
    authoring_node: dict[str, Any],
    runtime_node: dict[str, Any],
    field_sources: dict[str, dict[str, dict[Any, set[str]]]],
) -> NodeFieldBackfill | None:
    normalized_authoring = normalize_node(authoring_node)
    normalized_runtime = normalize_node(runtime_node)
    if normalized_authoring == normalized_runtime:
        return None

    differing_fields = {
        key
        for key in set(normalized_authoring) | set(normalized_runtime)
        if normalized_authoring.get(key) != normalized_runtime.get(key)
    }
    if differing_fields != {"knowledge_type"}:
        return None

    authoring_value = normalized_authoring.get("knowledge_type")
    runtime_value = normalized_runtime.get("knowledge_type")
    if authoring_value is not None or runtime_value is None:
        return None

    if runtime_value not in VALID_KNOWLEDGE_TYPES:
        return None

    node_sources = field_sources.get(node_id, {}).get("knowledge_type", {})
    source_values = set(node_sources)
    if source_values != {runtime_value}:
        return None

    source = sorted(node_sources[runtime_value])[0]
    return NodeFieldBackfill(node_id=node_id, field="knowledge_type", value=runtime_value, source=source)


def compare_graph(
    report: SyncReport,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], list[NodeFieldBackfill]]:
    runtime_nodes = runtime_nodes_by_id()
    graph = authoring_graph()
    authoring_nodes = graph["nodes"]
    field_sources = authoring_node_field_sources()

    missing_nodes: list[dict[str, Any]] = []
    node_field_backfills: list[NodeFieldBackfill] = []
    for node_id, runtime_node in runtime_nodes.items():
        authoring_node = authoring_nodes.get(node_id)
        if authoring_node is None:
            report.missing_nodes.append(node_id)
            missing_nodes.append(authoring_node_from_runtime(runtime_node))
        elif normalize_node(authoring_node) != normalize_node(runtime_node):
            candidate = node_backfill_candidate(node_id, authoring_node, runtime_node, field_sources)
            if candidate is None:
                report.node_conflicts.append(node_id)
            else:
                node_field_backfills.append(candidate)
                report.node_field_backfills.append(f"{candidate.node_id}.{candidate.field}={candidate.value} <- {candidate.source}")

    runtime_rels = load_jsonl(RUNTIME_RELS)
    authoring_rels = load_jsonl(AUTHORING_RELS)
    authoring_by_key = {relation_key(rel): normalize_relation(rel) for rel in authoring_rels}

    missing_rels: list[dict[str, Any]] = []
    for runtime_rel in runtime_rels:
        key = relation_key(runtime_rel)
        normalized_runtime = normalize_relation(runtime_rel)
        authoring_rel = authoring_by_key.get(key)
        if authoring_rel is None:
            report.missing_relations.append(key)
            missing_rels.append(normalized_runtime)
        elif authoring_rel != normalized_runtime:
            report.relation_conflicts.append(key)

    return graph, missing_nodes, missing_rels, node_field_backfills


def iter_card_files(base: Path) -> list[Path]:
    if not base.exists():
        return []
    return sorted(path for path in base.rglob("*") if path.is_file())


def canonical_alias_targets() -> dict[str, str]:
    if not AUTHORING_CANONICAL_NODES.exists():
        return {}

    data = load_json(AUTHORING_CANONICAL_NODES)
    if isinstance(data, dict):
        raw_entries = data.get("nodes") or data.get("entries") or data.get("canonical_nodes") or []
    else:
        raw_entries = data
    entries = raw_entries.values() if isinstance(raw_entries, dict) else raw_entries

    targets: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        target = entry.get("selected_card_node_id") or entry.get("canonical_node_id")
        if not target:
            continue
        for alias in entry.get("aliases", []) or []:
            targets[str(alias)] = str(target)
    return targets


def registered_authoring_node_ids() -> set[str]:
    if not AUTHORING_GRAPH.exists():
        return set()
    graph = authoring_graph()
    return set(graph["nodes"])


def deprecated_concept_target(stem: str, registered_node_ids: set[str], alias_targets: dict[str, str]) -> str:
    if stem in registered_node_ids:
        return f"nodes/{stem}.md"
    if stem in alias_targets:
        return f"nodes/{alias_targets[stem]}.md"
    return "delete unregistered concept card"


def compare_cards(report: SyncReport) -> list[tuple[Path, Path]]:
    missing: list[tuple[Path, Path]] = []
    runtime_node_ids = set(runtime_nodes_by_id()) if RUNTIME_NODES.exists() else set()
    registered_node_ids = registered_authoring_node_ids()
    alias_targets = canonical_alias_targets()

    for authoring_concept in sorted(AUTHORING_CONCEPT_CARDS.glob("*.mdx")) if AUTHORING_CONCEPT_CARDS.exists() else []:
        rel = authoring_concept.relative_to(AUTHORING_CARDS)
        target = deprecated_concept_target(authoring_concept.stem, registered_node_ids, alias_targets)
        report.card_conflicts.append(
            f"deprecated authoring concept card must be migrated or deleted: {rel} -> {target}"
        )

    for runtime_file in iter_card_files(RUNTIME_CARDS):
        rel = runtime_file.relative_to(RUNTIME_CARDS)
        if len(rel.parts) > 1 and rel.parts[0] == "concepts" and runtime_file.suffix == ".mdx":
            target = f"nodes/{runtime_file.stem}.md" if runtime_file.stem in runtime_node_ids else "authoring node card"
            report.card_conflicts.append(
                f"deprecated runtime concept card must be migrated or deleted: {rel} -> {target}"
            )
            continue
        authoring_file = AUTHORING_CARDS / rel
        if not authoring_file.exists():
            report.missing_cards.append(str(rel))
            missing.append((runtime_file, authoring_file))
        elif not filecmp.cmp(runtime_file, authoring_file, shallow=False):
            report.card_conflicts.append(str(rel))
    return missing


def apply_missing_graph(
    report: SyncReport,
    graph: dict[str, Any],
    missing_nodes: list[dict[str, Any]],
    missing_rels: list[dict[str, Any]],
) -> None:
    if missing_nodes:
        nodes = graph["nodes"]
        for node in missing_nodes:
            nodes[str(node["id"])] = node
            report.applied.append(f"node {node['id']}")
        AUTHORING_GRAPH.write_text(
            json.dumps(graph, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    if missing_rels:
        with AUTHORING_RELS.open("a", encoding="utf-8") as f:
            for rel in missing_rels:
                f.write(json.dumps(rel, ensure_ascii=False) + "\n")
                report.applied.append(f"relation {relation_key(rel)}")


def apply_node_field_backfills(
    report: SyncReport,
    graph: dict[str, Any],
    backfills: list[NodeFieldBackfill],
) -> bool:
    if not backfills:
        return False

    nodes = graph["nodes"]
    changed = False
    for backfill in backfills:
        node = nodes.get(backfill.node_id)
        if not isinstance(node, dict):
            continue
        existing = node.get(backfill.field)
        if existing is not None:
            continue
        node[backfill.field] = backfill.value
        report.applied.append(f"node {backfill.node_id}.{backfill.field}={backfill.value}")
        changed = True

    if changed:
        AUTHORING_GRAPH.write_text(
            json.dumps(graph, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return changed


def apply_missing_cards(report: SyncReport, missing_cards: list[tuple[Path, Path]]) -> None:
    for source, target in missing_cards:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        report.applied.append(f"card {target.relative_to(AUTHORING_CARDS)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="report differences without writing; this is the default")
    mode.add_argument("--apply", action="store_true", help="copy runtime-only knowledge into authoring sources")
    parser.add_argument(
        "--node-field-backfills-only",
        action="store_true",
        help="with --apply, only apply safe node field backfills and leave missing runtime-only items untouched",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    apply_changes = bool(args.apply)

    required = [RUNTIME_NODES, RUNTIME_RELS, RUNTIME_CARDS, AUTHORING_GRAPH, AUTHORING_RELS, AUTHORING_CARDS]
    missing_required = [str(path) for path in required if not path.exists()]
    if missing_required:
        print("[ERROR] missing required knowledge paths:")
        for path in missing_required:
            print(f"- {path}")
        return 2

    report = SyncReport()
    graph, missing_nodes, missing_rels, node_field_backfills = compare_graph(report)
    missing_cards = compare_cards(report)

    if report.conflicts:
        report.print()
        print("\n[ERROR] conflicts detected; refusing to modify authoring knowledge.")
        return 1

    if apply_changes:
        backfilled_graph = apply_node_field_backfills(report, graph, node_field_backfills)
        if not args.node_field_backfills_only:
            apply_missing_graph(report, graph, missing_nodes, missing_rels)
            apply_missing_cards(report, missing_cards)
        elif not backfilled_graph and node_field_backfills:
            print("[WARN] safe node field backfills were detected but none were applied.")

    report.print()
    if not apply_changes:
        if report.node_field_backfills:
            print("\n[INFO] run with --apply --node-field-backfills-only to backfill safe node fields.")
        if report.missing_nodes or report.missing_relations or report.missing_cards:
            print("[INFO] run with --apply to copy runtime-only knowledge into authoring sources.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
