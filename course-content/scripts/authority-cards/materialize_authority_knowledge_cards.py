#!/usr/bin/env python3
"""Materialize DomainConcept knowledge cards under cards/authority/nodes."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Any

from common import (
    AUTHORING_CARDS,
    DEFAULT_PROJECTION,
    DEFAULT_RELEASE_ID,
    build_relation_summary,
    clean_spaces,
    concept_category,
    first_sentence,
    has_cjk,
    index_domain_concepts,
    keywords_from_node,
    load_coverage_roles,
    load_domain_projection,
    sha256_text,
    write_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projection", type=Path, default=DEFAULT_PROJECTION)
    parser.add_argument("--release-id", default=DEFAULT_RELEASE_ID)
    parser.add_argument("--batch", choices=["A", "B", "C", "all"], default="all")
    parser.add_argument("--limit", type=int, default=0, help="Max cards to write (0=all)")
    parser.add_argument("--entity-id", action="append", default=[], help="Only these entity_ids")
    parser.add_argument("--force", action="store_true", help="Rewrite even if hash matches")
    parser.add_argument("--include-blocked", action="store_true",
                        help="Also write minimal cards for short-description Batch C")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--out-dir", type=Path, default=AUTHORING_CARDS)
    return parser.parse_args()


def yaml_escape(value: str) -> str:
    if value is None:
        return '""'
    text = str(value)
    if re.search(r'[:#\[\]{},&*!|>\'"%@`]', text) or text.strip() != text or "\n" in text:
        return '"' + text.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return text


def source_hash_marker(content_hash: str) -> str:
    return f"<!-- authority_source_sha256: {content_hash} -->"


def existing_hash(path: Path) -> str | None:
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8")
    m = re.search(r"authority_source_sha256:\s*([0-9a-f]{64})", text)
    return m.group(1) if m else None


def definition_line(desc: str, name: str) -> str:
    desc = clean_spaces(desc)
    if not desc:
        return f"{name}是自动控制原理权威图谱中的领域概念。"
    # Prefer first sentence; if description starts with English machine name, keep Chinese head
    sent = first_sentence(desc, 120)
    if has_cjk(sent):
        return sent if sent.endswith(("。", "！", "？", "…")) else sent + "。"
    # English-only description
    return f"{name}：{sent}" if sent else f"{name}是领域概念。"


def intuition_line(desc: str, relation_head: str) -> str | None:
    desc = clean_spaces(desc)
    if len(desc) < 40:
        return None
    # second sentence if available
    parts = re.split(r"[。；;]\s*", desc)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) >= 2 and has_cjk(parts[1]):
        s = parts[1]
        return s if s.endswith(("。", "！", "？")) else s + "。"
    if relation_head and "（权威图" not in relation_head:
        return f"在图谱邻接中可把握：{relation_head}。"
    return None


def render_card(
    row: dict[str, Any],
    node: dict[str, Any],
    adj: dict[str, list[dict[str, Any]]],
    by_id: dict[str, dict[str, Any]],
    release_id: str,
    projection_rel: str,
) -> str:
    eid = row["entity_id"]
    safe_id = row["safe_id"]
    name = row["name"]
    name_en = row["name_en"]
    desc = row["description"]
    relation_head, rel_rows = build_relation_summary(eid, adj, by_id, limit=8)
    definition = definition_line(desc, name)
    intuition = intuition_line(desc, relation_head)
    category = concept_category(node)
    tags = keywords_from_node(node, name)
    content_basis = "\n".join(
        [
            eid,
            desc,
            relation_head,
            "|".join(f"{a}|{b}|{c}" for a, b, c in rel_rows),
            release_id,
        ]
    )
    content_hash = sha256_text(content_basis)

    title = name
    if name_en and name_en != name:
        title = f"{name} | {name_en}"

    lines: list[str] = ["---"]
    lines.append(f"node_id: {yaml_escape(safe_id)}")
    lines.append(f"authority_entity_id: {yaml_escape(eid)}")
    lines.append(f"name: {yaml_escape(name)}")
    if name_en and name_en != name:
        lines.append(f"name_en: {yaml_escape(name_en)}")
    lines.append(f"category: {yaml_escape(category)}")
    if row.get("coverage_role"):
        lines.append(f"coverage_role: {yaml_escape(row['coverage_role'])}")
    lines.append(f"batch: {row['batch']}")
    if node.get("concept_kind"):
        lines.append(f"concept_kind: {yaml_escape(str(node['concept_kind']))}")
    if node.get("release_tier"):
        lines.append(f"release_tier: {yaml_escape(str(node['release_tier']))}")
    lines.append("tags:")
    for t in tags:
        lines.append(f"  - {yaml_escape(t)}")
    lines.append("card_version: 1")
    lines.append("source_docs:")
    lines.append(f"  - {projection_rel}")
    lines.append(f"authority_release_id: {yaml_escape(release_id)}")
    if not row["cardable"] and row["batch"] == "C":
        lines.append("status: draft-blocked")
        lines.append("blocked_reason: description_too_short")
    lines.append("asset_refs: []")
    lines.append("---")
    lines.append("")
    lines.append(source_hash_marker(content_hash))
    lines.append("")
    lines.append("## 首页")
    lines.append("")
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**一句话定义**：{definition}")
    lines.append("")
    if intuition:
        lines.append(f"**核心直觉**：{intuition}")
        lines.append("")
    lines.append(f"**关联**：{relation_head}")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 详情")
    lines.append("")
    lines.append("### 完整解释")
    lines.append("")
    if desc:
        # Keep description paragraphs as-is (cleaned), fail-closed: no invention
        for para in re.split(r"\n{2,}", desc):
            p = clean_spaces(para)
            if p:
                lines.append(p)
                lines.append("")
    else:
        lines.append("权威图谱尚未提供足够描述，本卡仅作占位，待补描述后重写。")
        lines.append("")

    lines.append("### 关联节点")
    lines.append("")
    lines.append("| 方向 | 节点 | 关系说明 |")
    lines.append("|------|------|---------|")
    if rel_rows:
        for direction, peer, rel in rel_rows:
            lines.append(f"| {direction} | {peer} | {rel} |")
    else:
        lines.append("| — | — | 权威图中暂无 DomainConcept 邻接 |")
    lines.append("")

    # Boundary section instead of invented misconceptions
    lines.append("### 边界与使用说明")
    lines.append("")
    tier = node.get("release_tier") or "unknown"
    kind = node.get("concept_kind") or "unknown"
    lines.append(
        f"本卡内容严格来自权威发布 `{release_id}` 的 DomainConcept 描述与邻接关系"
        f"（concept_kind=`{kind}`，release_tier=`{tier}`）。"
        "未在权威源中出现的工程实例与常见误区不在此编造；后续可按证据补全。"
    )
    lines.append("")

    lines.append("### 关键词")
    lines.append("")
    lines.append("、".join(tags) if tags else name)
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    projection = load_domain_projection(args.projection)
    roles = load_coverage_roles()
    rows, adj = index_domain_concepts(projection, roles)
    nodes = [
        n
        for n in projection.get("nodes") or []
        if n.get("entity_type") == "DomainConcept"
    ]
    by_id = {n.get("entity_id") or n.get("id"): n for n in nodes}

    from common import REPO_ROOT

    try:
        projection_rel = str(args.projection.resolve().relative_to(REPO_ROOT))
    except Exception:
        projection_rel = str(args.projection)

    selected = rows
    if args.entity_id:
        want = set(args.entity_id)
        selected = [r for r in rows if r["entity_id"] in want]
    elif args.batch != "all":
        selected = [r for r in rows if r["batch"] == args.batch]

    if not args.include_blocked and args.batch != "C":
        # For A/B/all default: write A+B fully; C only if include-blocked or batch=C
        if args.batch == "all":
            selected = [r for r in selected if r["batch"] != "C" or args.include_blocked]

    if args.limit and args.limit > 0:
        selected = selected[: args.limit]

    written = skipped = forced = blocked_skip = 0
    for row in selected:
        if row["batch"] == "C" and not args.include_blocked and args.batch != "C":
            blocked_skip += 1
            continue
        node = by_id[row["entity_id"]]
        out_path = args.out_dir / f"{row['safe_id']}.md"
        if out_path.exists() and not args.force and re.search(
            r"^content_origin:\s*act-course-enrichment\s*$",
            out_path.read_text(encoding="utf-8"),
            flags=re.MULTILINE,
        ):
            skipped += 1
            continue
        body = render_card(row, node, adj, by_id, args.release_id, projection_rel)
        # extract hash from body
        m = re.search(r"authority_source_sha256:\s*([0-9a-f]{64})", body)
        new_hash = m.group(1) if m else ""
        old = existing_hash(out_path)
        if out_path.exists() and old == new_hash and not args.force:
            skipped += 1
            continue
        if args.dry_run:
            written += 1
            continue
        write_text(out_path, body)
        if old and old != new_hash:
            forced += 1
        written += 1

    print(
        f"materialize cards: selected={len(selected)} written={written} "
        f"skipped_unchanged={skipped} rewrote={forced} blocked_skip={blocked_skip} "
        f"out={args.out_dir} dry_run={args.dry_run}"
    )


if __name__ == "__main__":
    main()
