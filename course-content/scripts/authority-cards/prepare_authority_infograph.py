#!/usr/bin/env python3
"""Prepare source.json + prompt.md for authority DomainConcept infographs."""

from __future__ import annotations

import argparse
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from common import (
    AUTHORING_CARDS,
    AUTHORING_INFOGRAPH_ROOT,
    DEFAULT_PROJECTION,
    DEFAULT_RELEASE_ID,
    build_relation_summary,
    clean_spaces,
    first_sentence,
    has_cjk,
    index_domain_concepts,
    load_coverage_roles,
    load_domain_projection,
    repo_relative_path,
    safe_entity_id,
    write_json,
    write_text,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projection", type=Path, default=DEFAULT_PROJECTION)
    parser.add_argument("--release-id", default=DEFAULT_RELEASE_ID)
    parser.add_argument("--batch", choices=["A", "B", "C", "all"], default="all")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--entity-id", action="append", default=[])
    parser.add_argument("--safe-id", action="append", default=[])
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--include-blocked", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_card_fields(card_path: Path) -> dict[str, str]:
    if not card_path.exists():
        return {}
    text = card_path.read_text(encoding="utf-8")
    out: dict[str, str] = {}
    m = re.search(r"\*\*一句话定义\*\*：\s*(.+)", text)
    if m:
        out["definition"] = m.group(1).strip()
    m = re.search(r"\*\*核心直觉\*\*：\s*(.+)", text)
    if m:
        out["intuition"] = m.group(1).strip()
    m = re.search(r"\*\*关联\*\*：\s*(.+)", text)
    if m:
        out["relation_head"] = m.group(1).strip()
    # detail explanation first paragraph after ### 完整解释
    m = re.search(r"### 完整解释\s*\n+([\s\S]*?)(?:\n### |\Z)", text)
    if m:
        out["explanation"] = clean_spaces(m.group(1))[:800]
    return out


def pick_archetype(name: str, concept_kind: str | None, desc: str) -> str:
    blob = f"{name} {concept_kind or ''} {desc}"
    if re.search(r"Bode|幅频|相频|裕度|带宽|截止|穿越|奈奎斯特|Nyquist|频域", blob, re.I):
        return "频域仪表盘"
    if re.search(r"根轨迹|极点|零点|s平面|主导极点|特征根", blob, re.I):
        return "s 平面机理板"
    if re.search(r"设计|校正|整定|综合|流程|步骤", blob):
        return "流程板"
    if re.search(r"对比|差异|误区|权衡|trade", blob, re.I):
        return "对比板"
    if re.search(r"积分|微分|滞后|超前|机制|累积", blob):
        return "机制剖面图"
    if concept_kind in {"analysis_method", "design_method"}:
        return "流程板"
    if concept_kind in {"performance_metric", "criterion"}:
        return "工程评审板"
    return "科普百科图鉴"


def short_label(text: str, max_len: int = 10) -> str:
    from common import short_concept_title

    text = short_concept_title(clean_spaces(text), max_len=max_len)
    text = re.sub(r"[。；;！!？?，,：:].*$", "", text)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def build_labels(
    name: str,
    definition: str,
    rel_rows: list[tuple[str, str, str]],
    name_en: str | None = None,
) -> list[str]:
    labels: list[str] = []
    labels.append(short_label(name, 12))
    # Prefer a second conceptual cue, not a truncated copy of the long definition
    if name_en and not has_cjk(name_en) and len(name_en) <= 24:
        labels.append(name_en.replace("_", " ")[:12])
    for _direction, peer, rel in rel_rows[:5]:
        peer_s = short_label(peer, 8)
        rel_s = short_label(rel, 4)
        labels.append(short_label(f"{rel_s}·{peer_s}", 10))
    # unique preserve order; drop pure ASCII garbage truncations under 3 chars
    seen: set[str] = set()
    out: list[str] = []
    for lab in labels:
        if not lab or lab in seen:
            continue
        if re.fullmatch(r"[A-Za-z0-9_.\-]{1,2}", lab):
            continue
        seen.add(lab)
        out.append(lab)
        if len(out) >= 10:
            break
    return out


def build_prompt(
    *,
    name: str,
    name_en: str | None,
    definition: str,
    intuition: str | None,
    explanation: str,
    labels: list[str],
    archetype: str,
    relation_head: str,
    concept_kind: str | None,
) -> str:
    title = name if not name_en or name_en == name else f"{name} ({name_en})"
    label_list = "、".join(f"「{x}」" for x in labels)
    intuition_line = intuition or "抓住定义核心与邻接关系，不扩展未给出的事实。"
    explanation_snip = first_sentence(explanation or definition, 100)

    return f"""# Authority DomainConcept Infograph — GPT/Grok Image Gen Spec

Generate ONE landscape teaching infographic for the control-theory concept below.
Provider: Grok image_gen (or latest native image generation). Treat output as a polished visual teaching asset, not a flat electronic knowledge card.

## Subject
- Title: {title}
- Concept kind: {concept_kind or "unknown"}
- One-line definition (source of truth): {definition}
- Core intuition: {intuition_line}
- Relation summary: {relation_head}
- Extended explanation (do not paste verbatim on image): {explanation_snip}

## visual_archetype
{archetype}

## layout_contract
- Canvas: landscape 16:9
- Layered composition: (1) main visual scene or engineering metaphor for the concept, (2) 1–3 technical insets (diagram / axes / mechanism cutaway), (3) compact formula or symbolic anchors only if already present in the definition text, (4) a boundary/judgment strip
- Reading order: left-to-right or top-to-bottom, clear visual hierarchy
- Main visual occupies ~45–55% of frame; insets and labels share remaining space without clutter

## text_contract
- Clean Chinese typography; short labels only
- Allowed visible labels (max ~10, each preferably ≤10 Chinese characters): {label_list}
- Do NOT paste the full definition paragraph onto the image
- Do NOT render prompt metadata, source labels, entity ids, batch names, or English instruction headers
- Translate relation cues to Chinese short phrases already listed
- No decorative fake UI chrome, no watermark, no invented numbers or formulas

## technical_insets_contract
- Provide 1–3 insets that explain mechanism, readback, or boundary judgment
- Prefer control-engineering visuals when supported by the concept name/definition: ship heading, tank level, compass, dashboard, Bode axes, root-locus plane, Nyquist curve, step response, block diagram fragments
- Visual richness must explain the concept, not decorate randomly

## negative_constraints
- No electronic handout screenshot look
- No generic icon-card grid with long paragraphs
- No invented engineering examples, parameters, or stability claims not in the source text
- No malformed Chinese or broken formulas; if no formula is in the source, omit formula panels
- No lesson-id / group / knowledge-type chrome

## Style
Premium educational infographic: crisp lines, calm academic palette (deep navy, teal accents, warm paper-white panels), high information density with breathing room, magazine-quality illustration meeting engineering teaching standards.
"""


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

    selected = rows
    if args.entity_id:
        want = set(args.entity_id)
        selected = [r for r in rows if r["entity_id"] in want]
    elif args.safe_id:
        want = set(args.safe_id)
        selected = [r for r in rows if r["safe_id"] in want]
    elif args.batch != "all":
        selected = [r for r in rows if r["batch"] == args.batch]

    if args.batch == "all" and not args.include_blocked and not args.entity_id and not args.safe_id:
        selected = [r for r in selected if r["batch"] != "C"]

    if args.limit and args.limit > 0:
        selected = selected[: args.limit]

    prepared = skipped = missing_card = 0
    for row in selected:
        card_path = AUTHORING_CARDS / f"{row['safe_id']}.md"
        if not card_path.exists():
            missing_card += 1
            continue
        out_dir = AUTHORING_INFOGRAPH_ROOT / row["safe_id"]
        source_path = out_dir / "source.json"
        prompt_path = out_dir / "prompt.md"
        if source_path.exists() and prompt_path.exists() and not args.force:
            skipped += 1
            continue

        fields = read_card_fields(card_path)
        definition = fields.get("definition") or first_sentence(row["description"], 120) or row["name"]
        if definition and not definition.endswith(("。", "！", "？", "…")) and has_cjk(definition):
            definition = definition + "。"
        intuition = fields.get("intuition")
        explanation = fields.get("explanation") or row["description"]
        relation_head, rel_rows = build_relation_summary(row["entity_id"], adj, by_id, limit=6)
        if fields.get("relation_head"):
            relation_head = fields["relation_head"]
        labels = build_labels(
            row["name"], definition, rel_rows, name_en=row.get("name_en")
        )
        archetype = pick_archetype(row["name"], row.get("concept_kind"), row.get("description") or "")

        source = {
            "schema_version": 1,
            "created_at": now_iso(),
            "namespace": "authority",
            "release_id": args.release_id,
            "entity_id": row["entity_id"],
            "safe_id": row["safe_id"],
            "node": {
                "name": row["name"],
                "name_en": row.get("name_en"),
                "concept_kind": row.get("concept_kind"),
                "release_tier": row.get("release_tier"),
                "batch": row["batch"],
                "coverage_role": row.get("coverage_role"),
            },
            "definition": definition,
            "intuition": intuition,
            "explanation": explanation,
            "relation_head": relation_head,
            "relations": [
                {"direction": d, "peer": p, "relation": r} for d, p, r in rel_rows
            ],
            "labels": labels,
            "visual_archetype": archetype,
            "card_path": repo_relative_path(card_path),
            "provider_policy": "grok-image_gen",
        }
        prompt = build_prompt(
            name=row["name"],
            name_en=row.get("name_en"),
            definition=definition,
            intuition=intuition,
            explanation=explanation or "",
            labels=labels,
            archetype=archetype,
            relation_head=relation_head,
            concept_kind=row.get("concept_kind"),
        )
        if args.dry_run:
            prepared += 1
            continue
        write_json(source_path, source)
        write_text(prompt_path, prompt)
        prepared += 1

    print(
        f"prepare infograph: selected={len(selected)} prepared={prepared} "
        f"skipped={skipped} missing_card={missing_card} dry_run={args.dry_run}"
    )


if __name__ == "__main__":
    main()
