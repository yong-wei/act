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


@dataclass
class SyncReport:
    missing_nodes: list[str] = field(default_factory=list)
    missing_relations: list[str] = field(default_factory=list)
    missing_cards: list[str] = field(default_factory=list)
    node_conflicts: list[str] = field(default_factory=list)
    relation_conflicts: list[str] = field(default_factory=list)
    card_conflicts: list[str] = field(default_factory=list)
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
        print(f"conflicts: {len(self.conflicts)}")
        print(f"applied changes: {len(self.applied)}")

        for title, items in [
            ("node conflicts", self.node_conflicts),
            ("relation conflicts", self.relation_conflicts),
            ("card conflicts", self.card_conflicts),
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
        return json.loads(json.dumps(normalized, ensure_ascii=False, sort_keys=True))

    cleaned = {k: v for k, v in node.items() if k not in NODE_DERIVED_FIELDS and k != "metadata"}
    cleaned.pop("created_at", None)
    cleaned.pop("updated_at", None)
    return json.loads(json.dumps(cleaned, ensure_ascii=False, sort_keys=True))


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
    return json.loads(json.dumps(cleaned, ensure_ascii=False, sort_keys=True))


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


def compare_graph(report: SyncReport) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    runtime_nodes = runtime_nodes_by_id()
    graph = authoring_graph()
    authoring_nodes = graph["nodes"]

    missing_nodes: list[dict[str, Any]] = []
    for node_id, runtime_node in runtime_nodes.items():
        authoring_node = authoring_nodes.get(node_id)
        if authoring_node is None:
            report.missing_nodes.append(node_id)
            missing_nodes.append(authoring_node_from_runtime(runtime_node))
        elif normalize_node(authoring_node) != normalize_node(runtime_node):
            report.node_conflicts.append(node_id)

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

    return graph, missing_nodes, missing_rels


def iter_card_files(base: Path) -> list[Path]:
    if not base.exists():
        return []
    return sorted(path for path in base.rglob("*") if path.is_file())


def compare_cards(report: SyncReport) -> list[tuple[Path, Path]]:
    missing: list[tuple[Path, Path]] = []
    for runtime_file in iter_card_files(RUNTIME_CARDS):
        rel = runtime_file.relative_to(RUNTIME_CARDS)
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
    graph, missing_nodes, missing_rels = compare_graph(report)
    missing_cards = compare_cards(report)

    if report.conflicts:
        report.print()
        print("\n[ERROR] conflicts detected; refusing to modify authoring knowledge.")
        return 1

    if apply_changes:
        apply_missing_graph(report, graph, missing_nodes, missing_rels)
        apply_missing_cards(report, missing_cards)

    report.print()
    if not apply_changes and (report.missing_nodes or report.missing_relations or report.missing_cards):
        print("\n[INFO] run with --apply to copy runtime-only knowledge into authoring sources.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
