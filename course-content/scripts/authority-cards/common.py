#!/usr/bin/env python3
"""Shared helpers for authority DomainConcept cards and infographs."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_RELEASE_ID = "control-theory-engineering-v0.12"
DEFAULT_PROJECTION = (
    REPO_ROOT
    / "course-content"
    / "authoring"
    / "knowledge"
    / "releases"
    / DEFAULT_RELEASE_ID
    / "domain-projection.json"
)
DEFAULT_COVERAGE = (
    REPO_ROOT
    / "course-content"
    / "authoring"
    / "knowledge"
    / "course-coverage"
    / "aggregate"
    / "active"
    / "automatic-control.json"
)

AUTHORING_CARDS = (
    REPO_ROOT / "course-content" / "authoring" / "knowledge" / "cards" / "authority" / "nodes"
)
RUNTIME_CARDS = (
    REPO_ROOT / "course-content" / "runtime" / "knowledge" / "cards" / "authority" / "nodes"
)
AUTHORING_INFOGRAPH_ROOT = (
    REPO_ROOT
    / "course-content"
    / "authoring"
    / "knowledge"
    / "infographs"
    / "authority"
    / "nodes"
)
RUNTIME_INFOGRAPH_ROOT = (
    REPO_ROOT / "course-content" / "runtime" / "knowledge" / "infographs" / "authority" / "nodes"
)
RUNTIME_INFOGRAPH_MANIFEST = (
    REPO_ROOT
    / "course-content"
    / "runtime"
    / "knowledge"
    / "infographs"
    / "authority"
    / "manifest.json"
)
INVENTORY_DIR = REPO_ROOT / "course-content" / "authoring" / "knowledge" / "cards" / "authority"
INVENTORY_JSON = INVENTORY_DIR / "inventory.json"
STATUS_JSON = INVENTORY_DIR / "status.json"

TEACHING_ROLES = frozenset(
    {"formal_objective", "necessary_prerequisite", "explicit_extension"}
)

CONCEPT_KIND_CATEGORY = {
    "theoretical_construct": "概念性",
    "analysis_method": "程序性",
    "design_method": "程序性",
    "mathematical_object": "事实性",
    "representation_kind": "概念性",
    "performance_metric": "事实性",
    "system_kind": "概念性",
    "system_component": "概念性",
    "system_property": "概念性",
    "phenomenon": "概念性",
    "signal_role": "概念性",
    "criterion": "概念性",
}

RELATION_LABEL_ZH = {
    "applies_to": "应用于",
    "association": "关联",
    "derived_from": "派生自",
    "has_component": "包含组件",
    "has_formula": "含公式",
    "has_representation": "有表示",
    "is_a": "是一种",
    "part_of": "属于",
    "used_to_analyze": "用于分析",
    "prerequisite": "先修",
    "contains": "包含",
    "refers_to": "指涉",
    "mentions": "提及",
}


def repo_path(*parts: str) -> Path:
    return REPO_ROOT.joinpath(*parts)


def repo_relative_path(path: Path | str) -> str:
    """Return an in-repository path as a stable POSIX reference.

    Metadata is consumed outside the checkout that produced it, so absolute
    workstation paths are never part of the persisted contract. Relative
    inputs are resolved from ``REPO_ROOT`` rather than the caller's cwd.
    """
    raw = Path(path).expanduser()
    resolved = (raw if raw.is_absolute() else REPO_ROOT / raw).resolve()
    try:
        relative = resolved.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise ValueError(f"path is outside REPO_ROOT: {path}") from exc
    return relative.as_posix()


def path_basename(path: Path | str) -> str:
    """Return only the final path component using POSIX separators."""
    return PurePosixPath(str(path).replace("\\", "/")).name


def authority_card_status(card_path: Path) -> str:
    """Classify a generated authority card from its on-disk contents."""
    if not card_path.exists():
        return "missing"
    text = card_path.read_text(encoding="utf-8")
    if re.search(r"^status:\s*draft-blocked\s*$", text, flags=re.MULTILINE):
        return "blocked"
    if "## 首页" in text and "## 详情" in text:
        return "ok"
    return "invalid"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def safe_entity_id(entity_id: str) -> str:
    """Filesystem-safe id: keep readability, replace reserved chars."""
    value = entity_id.strip()
    value = value.replace(":", "_")
    value = re.sub(r"[^\w.\-一-龥]", "_", value, flags=re.UNICODE)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "unknown"


def has_cjk(text: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", text or ""))


def clean_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def first_sentence(text: str, max_len: int = 80) -> str:
    text = clean_spaces(text)
    if not text:
        return ""
    for sep in ("。", "；", ";", "！", "!", "？", "?", "\n"):
        if sep in text:
            part = text.split(sep, 1)[0].strip()
            if part:
                text = part + ("。" if sep in "。！？" else "")
                break
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


# Common semantic_name → short Chinese teaching title
SEMANTIC_NAME_ZH: dict[str, str] = {
    "closed_loop_poles": "闭环极点",
    "open_loop_poles": "开环极点",
    "open_loop_zeros": "开环零点",
    "parameter_root_locus": "参数根轨迹",
    "conventional_root_locus": "常规根轨迹",
    "root_locus": "根轨迹",
    "root_locus_method": "根轨迹法",
    "equivalent_open_loop_transfer_function": "等效开环传递函数",
    "reaction_curve": "反应曲线",
    "reaction_curve_parameters": "反应曲线参数",
    "reaction_rate_r": "反应速率",
    "transport_delay": "传输延迟",
    "transfer_function": "传递函数",
    "step_response": "阶跃响应",
    "bode_plot": "Bode图",
    "nyquist_plot": "Nyquist图",
    "stability": "稳定性",
    "feedback_control": "反馈控制",
    "pid_controller": "PID控制器",
    "closed_loop_transfer_function": "闭环传递函数",
    "open_loop_transfer_function": "开环传递函数",
    "characteristic_equation": "特征方程",
    "damping_ratio": "阻尼比",
    "natural_frequency": "自然频率",
    "settling_time": "调节时间",
    "overshoot": "超调量",
    "steady_state_error": "稳态误差",
    "phase_margin": "相角裕度",
    "gain_margin": "幅值裕度",
    "bandwidth": "带宽",
    "type_one_system": "I型系统",
    "type_i_system": "I型系统",
    "type_0_system": "0型系统",
    "type_two_system": "II型系统",
    "generalized_root_locus": "广义根轨迹",
    "zero": "零点",
    "pole": "极点",
    "gain": "增益",
    "root_locus_gain": "根轨迹增益",
    "forward_path_gain": "前向通路增益",
    "positive_feedback_inner_loop": "正反馈内回路",
    "differential_equation_model": "微分方程模型",
    "time_domain_model": "时域模型",
    "analogous_systems": "相似系统",
    "across_variable": "位变量",
    "through_variable": "流变量",
    "matrix_linear_algebra": "矩阵线性代数",
}


def _semantic_key(text: str) -> str:
    return re.sub(r"\s+", "_", clean_spaces(text).lower())


def _extract_zh_title_from_definition(text: str, max_len: int = 16) -> str | None:
    """Pull a short noun-phrase title from a long Chinese definition sentence."""
    text = clean_spaces(text)
    if not text or not has_cjk(text):
        return None
    patterns = [
        r"称为([^，。；;：:\s]{2,18})",
        r"称作([^，。；;：:\s]{2,18})",
        r"即([^，。；;：:\s]{2,18})",
        r"记为\s*([A-Za-z0-9_\*∗]+)",
        r"记作\s*([A-Za-z0-9_\*∗]+)",
        r"是([^，。；;：:\s]{2,18})",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if not m:
            continue
        hit = clean_spaces(m.group(1))
        # Filter low-value fragments
        if hit in {"一种", "一个", "系统", "概念", "方法", "在控制系统中", "对于"}:
            continue
        if hit.startswith("modeling") or hit.startswith("合同明确"):
            continue
        if len(hit) > max_len:
            hit = hit[: max_len - 1] + "…"
        if len(hit) >= 2:
            return hit
    # Prefer clause before first comma if it looks like a noun phrase end
    for sep in ("，", "。", "；", ";", "：", ":"):
        if sep in text:
            head = text.split(sep, 1)[0].strip()
            # If head is "X的Y" style under max_len
            if 2 <= len(head) <= max_len and not head.startswith(("在", "对于", "当", "若", "如果")):
                return head
    return None


def short_concept_title(
    name: str,
    name_en: str | None = None,
    semantic_name: str | None = None,
    description: str | None = None,
    max_len: int = 16,
) -> str:
    """Prefer a short teaching title suitable for cards and infograph labels."""
    sn = clean_spaces(semantic_name or "")
    en = clean_spaces(name_en or "")
    desc = clean_spaces(description or "")
    for key in (_semantic_key(sn), _semantic_key(en), _semantic_key(name)):
        if key in SEMANTIC_NAME_ZH:
            return SEMANTIC_NAME_ZH[key]
    n = clean_spaces(name or "")
    # Long Chinese definition used as display_name
    if has_cjk(n):
        if len(n) <= max_len and not re.search(r"[，。；;：:]", n):
            return n
        extracted = _extract_zh_title_from_definition(n, max_len=max_len)
        if extracted:
            return extracted
        extracted = _extract_zh_title_from_definition(desc, max_len=max_len) if desc else None
        if extracted:
            return extracted
        for sep in ("，", "。", "；", ";", "：", ":", "、"):
            if sep in n:
                head = n.split(sep, 1)[0].strip()
                if 2 <= len(head) <= max_len:
                    return head
        return n[: max_len - 1] + "…" if len(n) > max_len else n
    # English machine / modeling recovered ids
    cand = sn or en or n
    if cand.startswith("modeling_") or re.fullmatch(r"[0-9a-f]{8,}", cand) or cand.startswith("contract"):
        extracted = _extract_zh_title_from_definition(desc, max_len=max_len) if desc else None
        if extracted:
            return extracted
        # English description head words
        if desc:
            head = first_sentence(desc, 48)
            # Prefer Chinese if any
            if has_cjk(head):
                ex = _extract_zh_title_from_definition(head, max_len=max_len)
                if ex:
                    return ex
            # Compact english phrase
            words = re.findall(r"[A-Za-z][A-Za-z\-]+", head)
            if words:
                phrase = " ".join(words[:4])
                if len(phrase) <= 28:
                    return phrase
        return "领域概念"
    if cand and len(cand) <= 40:
        return cand.replace("_", " ")
    return (n or cand or "领域概念")[:max_len]


def display_name_pair(node: dict[str, Any]) -> tuple[str, str | None]:
    """Return (name, name_en). Prefer short Chinese teaching title for name."""
    dn = clean_spaces(node.get("display_name") or "")
    sn = clean_spaces(node.get("semantic_name") or "")
    desc = clean_spaces(node.get("description") or "")

    # Prefer known semantic mapping
    for key in (_semantic_key(sn), _semantic_key(dn)):
        if key in SEMANTIC_NAME_ZH:
            en = sn if sn and not has_cjk(sn) else (dn if dn and not has_cjk(dn) else None)
            return SEMANTIC_NAME_ZH[key], en

    if has_cjk(dn):
        # Long definition-as-name → compress for card title
        title = short_concept_title(
            dn, name_en=sn or None, semantic_name=sn or None, description=desc or dn
        )
        en = sn if sn and not has_cjk(sn) and sn != title else None
        if not en and dn != title and not has_cjk(dn):
            en = dn
        return title, en
    if has_cjk(sn):
        return (
            short_concept_title(sn, name_en=dn or None, description=desc),
            dn or None,
        )
    # English machine name: derive Chinese title from description head
    zh = first_sentence(desc, 40).rstrip("。")
    if zh and has_cjk(zh):
        title = short_concept_title(
            zh, name_en=dn or sn or None, semantic_name=sn or None, description=desc
        )
        return title, dn or sn or None
    # Fall back to semantic map / readable english
    title = short_concept_title(
        dn or sn or "未命名概念",
        semantic_name=sn or None,
        description=desc,
    )
    return title, dn or sn or None


def concept_category(node: dict[str, Any]) -> str:
    kind = node.get("concept_kind")
    if kind in CONCEPT_KIND_CATEGORY:
        return CONCEPT_KIND_CATEGORY[kind]
    return "概念性"


def keywords_from_node(node: dict[str, Any], name: str) -> list[str]:
    tags: list[str] = []
    kind = node.get("concept_kind")
    if kind:
        tags.append(str(kind))
    tier = node.get("release_tier")
    if tier:
        tags.append(str(tier))
    # light tokens from name
    for token in re.split(r"[\s/|·,，、]+", name):
        token = token.strip()
        if 1 < len(token) <= 12 and token not in tags:
            tags.append(token)
        if len(tags) >= 8:
            break
    return tags[:8]


def load_domain_projection(path: Path = DEFAULT_PROJECTION) -> dict[str, Any]:
    return load_json(path)


def load_coverage_roles(path: Path = DEFAULT_COVERAGE) -> dict[str, str]:
    if not path.exists():
        return {}
    data = load_json(path)
    roles: dict[str, str] = {}
    for entry in data.get("entries") or []:
        cid = str(entry.get("canonicalId") or "").strip()
        role = str(entry.get("role") or "").strip()
        if cid and role:
            roles[cid] = role
    return roles


def index_domain_concepts(
    projection: dict[str, Any],
    coverage_roles: dict[str, str] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    coverage_roles = coverage_roles or {}
    nodes = [
        n
        for n in projection.get("nodes") or []
        if n.get("entity_type") == "DomainConcept"
    ]
    by_id = {n.get("entity_id") or n.get("id"): n for n in nodes}

    adj: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for link in projection.get("links") or []:
        sid = link.get("source_id")
        tid = link.get("target_id")
        rel = link.get("relation_type") or "association"
        if sid in by_id and tid in by_id:
            adj[sid].append(
                {
                    "direction": "out",
                    "peer_id": tid,
                    "relation_type": rel,
                    "label": RELATION_LABEL_ZH.get(rel, rel),
                }
            )
            adj[tid].append(
                {
                    "direction": "in",
                    "peer_id": sid,
                    "relation_type": rel,
                    "label": RELATION_LABEL_ZH.get(rel, rel),
                }
            )

    degree = Counter()
    for eid, edges in adj.items():
        degree[eid] = len(edges)

    rows: list[dict[str, Any]] = []
    for node in nodes:
        eid = node.get("entity_id") or node.get("id")
        assert eid
        name, name_en = display_name_pair(node)
        desc = clean_spaces(node.get("description") or "")
        role = coverage_roles.get(eid)
        desc_len = len(desc)
        cardable = (
            node.get("publication_status") == "published"
            and node.get("candidate") is not True
            and desc_len >= 20
        )
        batch = "C"
        if role in TEACHING_ROLES:
            batch = "A"
        elif cardable:
            batch = "B"
        rows.append(
            {
                "entity_id": eid,
                "safe_id": safe_entity_id(eid),
                "display_name": node.get("display_name"),
                "semantic_name": node.get("semantic_name"),
                "name": name,
                "name_en": name_en,
                "description": desc,
                "description_len": desc_len,
                "release_tier": node.get("release_tier"),
                "concept_kind": node.get("concept_kind"),
                "publication_status": node.get("publication_status"),
                "review_status": node.get("review_status"),
                "candidate": bool(node.get("candidate")),
                "coverage_role": role,
                "degree": degree.get(eid, 0),
                "batch": batch,
                "cardable": cardable,
                "evidence_refs": list(node.get("evidence_refs") or []),
            }
        )

    rows.sort(key=lambda r: (r["batch"], -(r["degree"] or 0), r["safe_id"]))
    return rows, adj


def peer_label(node: dict[str, Any] | None, peer_id: str) -> str:
    if not node:
        return peer_id
    name, _ = display_name_pair(node)
    return name


def build_relation_summary(
    entity_id: str,
    adj: dict[str, list[dict[str, Any]]],
    by_id: dict[str, dict[str, Any]],
    limit: int = 6,
) -> tuple[str, list[tuple[str, str, str]]]:
    edges = adj.get(entity_id) or []
    # prefer prerequisites and structural relations
    priority = {
        "prerequisite": 0,
        "is_a": 1,
        "part_of": 2,
        "has_component": 3,
        "has_formula": 4,
        "used_to_analyze": 5,
        "applies_to": 6,
        "derived_from": 7,
        "association": 8,
    }
    edges = sorted(
        edges,
        key=lambda e: (priority.get(e["relation_type"], 50), e["peer_id"]),
    )
    rows: list[tuple[str, str, str]] = []
    pre: list[str] = []
    nxt: list[str] = []
    for edge in edges[: limit * 2]:
        peer = by_id.get(edge["peer_id"])
        label = peer_label(peer, edge["peer_id"])
        direction = "前置" if edge["direction"] == "in" else "后续"
        if edge["relation_type"] == "prerequisite":
            direction = "前置" if edge["direction"] == "out" else "后续"
        rows.append((direction, label, edge["label"]))
        if direction == "前置" and label not in pre:
            pre.append(label)
        if direction == "后续" and label not in nxt:
            nxt.append(label)
        if len(rows) >= limit:
            break
    head_bits: list[str] = []
    if pre:
        head_bits.append("前置 → " + "、".join(pre[:3]))
    if nxt:
        head_bits.append("后续 → " + "、".join(nxt[:3]))
    head = " · ".join(head_bits) if head_bits else "（权威图邻接待补充）"
    return head, rows
