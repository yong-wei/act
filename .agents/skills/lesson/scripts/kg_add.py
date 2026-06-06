#!/usr/bin/env python3
"""
知识图谱节点/关系新增工具 - 供 control-lesson-creator 技能调用
新增内容写入 staging 文件（authoring/knowledge/base/new_nodes.jsonl, new_relations.jsonl），
不修改原始数据文件，保持数据安全。

用法（直接传入JSON）：
  python3 scripts/kg_add.py node '{"id":...,"name":...,...}'
  python3 scripts/kg_add.py relation '{"source":...,"target":...,...}'
  python3 scripts/kg_add.py batch_nodes '[{...},{...}]'
  python3 scripts/kg_add.py batch_relations '[{...},{...}]'
  python3 scripts/kg_add.py validate_node '{"id":...}'    # 校验格式
"""

import json
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
COURSE_ROOT = REPO_ROOT / "course-content" if (REPO_ROOT / "course-content").exists() else REPO_ROOT
KG_FILE = COURSE_ROOT / "authoring" / "knowledge" / "base" / "knowledge_graph.json"
REL_FILE = COURSE_ROOT / "authoring" / "knowledge" / "base" / "relations.jsonl"
NEW_NODES_FILE = COURSE_ROOT / "authoring" / "knowledge" / "base" / "new_nodes.jsonl"
NEW_RELS_FILE = COURSE_ROOT / "authoring" / "knowledge" / "base" / "new_relations.jsonl"

# 合法的枚举值
VALID_CATEGORIES = {"概念性", "程序性", "事实性"}
VALID_BLOOM = {"记忆", "理解", "应用", "分析", "评价", "创造"}
VALID_KNOWLEDGE_TYPES = {"C", "X", "D", "框架", "前沿"}
VALID_REL_TYPES = {
    "related",        # 相关（弱关联）
    "applies_to",     # A应用于B（A is applied to B）
    "contains",       # A包含B（A contains B）
    "leads_to",       # A导致/引出B
    "prerequisite",   # A是B的前置知识
    "opposite",       # A与B相对/相反
    "cross_domain",   # A与B跨域映射（新增，用于[X]类知识）
    "generalizes",    # A泛化B（A is more general than B）
    "instance_of",    # A是B的实例（新增）
}


def make_node_id(name, chapter):
    """生成与现有格式一致的节点ID"""
    hash_suffix = hashlib.md5(f"{name}_{chapter}".encode()).hexdigest()[:8]
    return f"{name}_{chapter}_{hash_suffix}"


def validate_node(node):
    """校验节点格式，返回 (is_valid, errors)"""
    errors = []
    required = ["id", "name", "category", "bloom_level", "chapter",
                "chapter_name", "definition"]
    for field in required:
        if field not in node:
            errors.append(f"缺少必填字段: {field}")

    if node.get("category") and node["category"] not in VALID_CATEGORIES:
        errors.append(f"category 值无效: {node['category']}，应为 {VALID_CATEGORIES}")

    if node.get("bloom_level") and node["bloom_level"] not in VALID_BLOOM:
        errors.append(f"bloom_level 值无效: {node['bloom_level']}，应为 {VALID_BLOOM}")

    if node.get("knowledge_type") and node["knowledge_type"] not in VALID_KNOWLEDGE_TYPES:
        errors.append(f"knowledge_type 值无效: {node['knowledge_type']}，应为 {VALID_KNOWLEDGE_TYPES}")

    if "difficulty" in node and not (1 <= node["difficulty"] <= 5):
        errors.append("difficulty 应为 1-5")

    if "importance" in node and not (1 <= node["importance"] <= 5):
        errors.append("importance 应为 1-5")

    return len(errors) == 0, errors


def validate_relation(rel):
    """校验关系格式，返回 (is_valid, errors)"""
    errors = []
    required = ["source", "target", "relation_type", "strength"]
    for field in required:
        if field not in rel:
            errors.append(f"缺少必填字段: {field}")

    if rel.get("relation_type") and rel["relation_type"] not in VALID_REL_TYPES:
        errors.append(f"relation_type 值无效: {rel['relation_type']}，应为 {VALID_REL_TYPES}")

    if "strength" in rel and not (0.0 <= rel["strength"] <= 1.0):
        errors.append("strength 应为 0.0-1.0")

    return len(errors) == 0, errors


def load_existing_names():
    """加载所有现有节点名称（用于重复检查）"""
    with open(KG_FILE) as f:
        data = json.load(f)
    names = set(n["name"] for n in data["nodes"].values())

    if NEW_NODES_FILE.exists():
        with open(NEW_NODES_FILE) as f:
            for line in f:
                line = line.strip()
                if line:
                    n = json.loads(line)
                    names.add(n["name"])
    return names


def add_node(node_dict):
    """添加单个节点到 staging"""
    # 自动补全必填字段
    now = datetime.now(timezone.utc).isoformat()
    node_dict.setdefault("examples", [])
    node_dict.setdefault("formulas", [])
    node_dict.setdefault("prerequisites", [])
    node_dict.setdefault("related_concepts", [])
    node_dict.setdefault("keywords", [])
    node_dict.setdefault("tags", [])
    node_dict.setdefault("difficulty", 3)
    node_dict.setdefault("importance", 3)
    node_dict.setdefault("created_at", now)
    node_dict.setdefault("updated_at", now)

    # 自动生成 ID（如果未提供）
    if "id" not in node_dict:
        chapter = node_dict.get("chapter", 0)
        node_dict["id"] = make_node_id(node_dict["name"], chapter)

    # 校验
    is_valid, errors = validate_node(node_dict)
    if not is_valid:
        print(f"[ERROR] 节点校验失败: {errors}")
        return False

    # 重复检查
    existing_names = load_existing_names()
    if node_dict["name"] in existing_names:
        print(f"[WARN] 节点 '{node_dict['name']}' 已存在，跳过（如需更新请手动编辑）")
        return False

    with open(NEW_NODES_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(node_dict, ensure_ascii=False) + "\n")

    print(f"[OK] 已添加节点: {node_dict['name']} (id: {node_dict['id']})")
    return True


def add_relation(rel_dict):
    """添加单条关系到 staging"""
    # 自动生成 relation_id
    if "relation_id" not in rel_dict:
        rel_dict["relation_id"] = f"{rel_dict['source']}|{rel_dict['target']}|new"

    rel_dict.setdefault("source_chapter", 0)
    rel_dict.setdefault("target_chapter", 0)
    rel_dict.setdefault("label", "")

    is_valid, errors = validate_relation(rel_dict)
    if not is_valid:
        print(f"[ERROR] 关系校验失败: {errors}")
        return False

    with open(NEW_RELS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(rel_dict, ensure_ascii=False) + "\n")

    print(f"[OK] 已添加关系: {rel_dict['source']} --[{rel_dict['relation_type']}]--> {rel_dict['target']}")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    data_str = sys.argv[2]

    try:
        data = json.loads(data_str)
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON 解析失败: {e}")
        sys.exit(1)

    if cmd == "node":
        add_node(data)
    elif cmd == "relation":
        add_relation(data)
    elif cmd == "batch_nodes":
        success = sum(1 for n in data if add_node(n))
        print(f"\n批量添加节点: {success}/{len(data)} 成功")
    elif cmd == "batch_relations":
        success = sum(1 for r in data if add_relation(r))
        print(f"\n批量添加关系: {success}/{len(data)} 成功")
    elif cmd == "validate_node":
        is_valid, errors = validate_node(data)
        if is_valid:
            print("[OK] 节点格式有效")
        else:
            print(f"[FAIL] 校验失败:\n" + "\n".join(f"  - {e}" for e in errors))
    elif cmd == "validate_relation":
        is_valid, errors = validate_relation(data)
        if is_valid:
            print("[OK] 关系格式有效")
        else:
            print(f"[FAIL] 校验失败:\n" + "\n".join(f"  - {e}" for e in errors))
    else:
        print(f"未知命令: {cmd}")
        print(__doc__)
