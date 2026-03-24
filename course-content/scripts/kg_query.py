#!/usr/bin/env python3
"""
知识图谱查询工具 - 供 control-lesson-creator 技能调用
用法：
  python3 scripts/kg_query.py stats                         # 总体统计
  python3 scripts/kg_query.py chapter <章节名或编号>         # 按章节列出节点
  python3 scripts/kg_query.py search <关键词>               # 模糊搜索节点
  python3 scripts/kg_query.py node <节点名>                  # 查看单个节点详情+关系
  python3 scripts/kg_query.py unit <大纲单元编号>            # 查与某单元相关的节点
  python3 scripts/kg_query.py new                           # 列出所有新增节点（staging区）
  python3 scripts/kg_query.py missing <关键词列表>           # 检查哪些概念尚无节点
"""

import json
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
KG_FILE = ROOT / "authoring" / "knowledge" / "base" / "knowledge_graph.json"
REL_FILE = ROOT / "authoring" / "knowledge" / "base" / "relations.jsonl"
NEW_NODES_FILE = ROOT / "authoring" / "knowledge" / "base" / "new_nodes.jsonl"
NEW_RELS_FILE = ROOT / "authoring" / "knowledge" / "base" / "new_relations.jsonl"

# 新课纲单元→传统章节的近似映射（供 unit 查询使用）
UNIT_TO_CHAPTERS = {
    "1-1": [1, 2],
    "1-2": [3],
    "1-3": [4],
    "1-4": [5],
    "1-5": [3, 4, 5],
    "2-1": [2],
    "2-2": [3],
    "2-3": [5],
    "2-4": [5],
    "3-1": [3],
    "3-2": [3],
    "3-3": [4],
    "3-4": [4, 5],
    "3-5": [4, 5, 6],
    "3-6": [4, 5, 6],
    "3-7": [2, 6],
    "3-8": [5, 6],
    "3-9": [3, 4, 5, 6],
    "4-1": [3, 5, 6],
    "4-2": [6],
    "4-3": [6],
    "4-4": [6],
    "4-5": [6],
    "4-6": [6],
    "4-7": [6],
    "4-8": [6],
    "5-1": [7],
    "5-2": [8],
    "5-3": [6, 8],
    "5-4": [9, 10],
    "5-5": [7, 8],
    "5-6": [9, 10],
    "legacy/1-1": [2],
    "legacy/1-2": [2],
    "legacy/L-2a": [3],
    "legacy/L-2b": [4],
    "legacy/L-2c": [5],
    "legacy/L-2d": [3, 4, 5],
    "legacy/L-sum": [4, 5, 6],
    "L-2a": [3],
    "L-2b": [4],
    "L-2c": [5],
    "L-2d": [3, 4, 5],
    "L-sum": [4, 5, 6],
}

CHAPTER_NAMES = {
    1: "基本概念", 2: "系统模型", 3: "时域分析", 4: "根轨迹分析",
    5: "频域分析", 6: "系统校正", 7: "离散系统", 8: "非线性系统",
    9: "状态空间", 10: "状态空间（最优控制）"
}


def load_kg():
    with open(KG_FILE) as f:
        data = json.load(f)
    return data["nodes"]


def load_relations():
    rels = []
    with open(REL_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                rels.append(json.loads(line))
    return rels


def load_new_nodes():
    if not NEW_NODES_FILE.exists():
        return {}
    nodes = {}
    with open(NEW_NODES_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                n = json.loads(line)
                nodes[n["id"]] = n
    return nodes


def load_new_relations():
    if not NEW_RELS_FILE.exists():
        return []
    rels = []
    with open(NEW_RELS_FILE) as f:
        for line in f:
            line = line.strip()
            if line:
                rels.append(json.loads(line))
    return rels


def cmd_stats():
    nodes = load_kg()
    rels = load_relations()
    new_nodes = load_new_nodes()
    new_rels = load_new_relations()

    from collections import Counter
    ch_dist = Counter(n["chapter_name"] for n in nodes.values())
    cat_dist = Counter(n["category"] for n in nodes.values())
    rel_dist = Counter(r["relation_type"] for r in rels)

    # 新增节点的knowledge_type分布
    new_kt = Counter(n.get("knowledge_type", "未标注") for n in new_nodes.values())

    print("=== 知识图谱统计 ===")
    print(f"\n【现有节点】总计: {len(nodes)}")
    for ch, cnt in sorted(ch_dist.items(), key=lambda x: x[1], reverse=True):
        print(f"  {ch}: {cnt}")

    print(f"\n【现有关系】总计: {len(rels)}")
    for rt, cnt in sorted(rel_dist.items(), key=lambda x: x[1], reverse=True):
        print(f"  {rt}: {cnt}")

    print(f"\n【新增节点（staging）】总计: {len(new_nodes)}")
    for kt, cnt in new_kt.items():
        print(f"  knowledge_type={kt}: {cnt}")

    print(f"\n【新增关系（staging）】总计: {len(new_rels)}")

    # 检查欠缺覆盖的前沿/船舶内容
    missing_topics = ["船舶", "MASS", "数据驱动", "NeuralODE", "卡尔曼滤波",
                      "自主系统", "模型预测控制（数据驱动）", "Pareto前沿"]
    print("\n【前沿/船舶主题覆盖检查】")
    all_names = set(n["name"] for n in nodes.values()) | set(n["name"] for n in new_nodes.values())
    for topic in missing_topics:
        matched = [name for name in all_names if topic in name]
        status = f"✅ {matched}" if matched else "❌ 缺失"
        print(f"  {topic}: {status}")


def cmd_chapter(arg):
    nodes = load_kg()
    # 支持章节名或数字
    try:
        ch_num = int(arg)
        matches = {nid: n for nid, n in nodes.items() if n["chapter"] == ch_num}
        ch_label = f"第{ch_num}章（{CHAPTER_NAMES.get(ch_num, '?')}）"
    except ValueError:
        matches = {nid: n for nid, n in nodes.items() if arg in n["chapter_name"]}
        ch_label = arg

    print(f"=== {ch_label} | 共 {len(matches)} 个节点 ===\n")
    for nid, n in sorted(matches.items(), key=lambda x: x[1]["importance"], reverse=True):
        kt_tag = f" [{n.get('knowledge_type', '?')}]" if n.get("knowledge_type") else ""
        print(f"  [{n['category']}/{n['bloom_level']}]{kt_tag} {n['name']}")
        print(f"    定义: {n['definition'][:60]}{'...' if len(n['definition']) > 60 else ''}")
        if n.get("formulas"):
            print(f"    公式: {n['formulas'][0][:60]}")
        print()


def cmd_search(keyword):
    nodes = load_kg()
    new_nodes = load_new_nodes()
    all_nodes = {**nodes, **new_nodes}

    matches = []
    for nid, n in all_nodes.items():
        score = 0
        if keyword in n["name"]:
            score += 3
        if keyword in n.get("definition", ""):
            score += 2
        if any(keyword in kw for kw in n.get("keywords", [])):
            score += 1
        if any(keyword in ex for ex in n.get("examples", [])):
            score += 1
        if score > 0:
            matches.append((score, nid, n))

    matches.sort(key=lambda x: x[0], reverse=True)
    is_new = set(new_nodes.keys())

    print(f"=== 搜索 '{keyword}' | 找到 {len(matches)} 个节点 ===\n")
    for score, nid, n in matches[:20]:
        tag = " [NEW]" if nid in is_new else ""
        kt_tag = f" [{n.get('knowledge_type')}]" if n.get("knowledge_type") else ""
        print(f"  {n['name']}{tag}{kt_tag} (相关度:{score})")
        print(f"    {n['definition'][:80]}{'...' if len(n['definition']) > 80 else ''}")
    if len(matches) > 20:
        print(f"  ... 还有 {len(matches) - 20} 个结果（用更精确的关键词缩小范围）")


def cmd_node(name):
    nodes = load_kg()
    new_nodes = load_new_nodes()
    rels = load_relations()
    new_rels = load_new_relations()

    # 找节点（精确匹配优先，否则模糊）
    target = None
    for nid, n in {**nodes, **new_nodes}.items():
        if n["name"] == name:
            target = n
            break
    if not target:
        for nid, n in {**nodes, **new_nodes}.items():
            if name in n["name"]:
                target = n
                print(f"[提示] 未找到精确匹配，显示 '{n['name']}'\n")
                break
    if not target:
        print(f"未找到节点: {name}")
        return

    print(f"=== 节点详情: {target['name']} ===")
    print(json.dumps(target, ensure_ascii=False, indent=2))

    # 查找相关关系
    all_rels = rels + new_rels
    out_rels = [r for r in all_rels if r["source"] == target["name"]]
    in_rels = [r for r in all_rels if r["target"] == target["name"]]

    print(f"\n【出向关系】{len(out_rels)} 条")
    for r in out_rels[:10]:
        print(f"  --[{r['relation_type']} {r['strength']:.1f}]--> {r['target']}")

    print(f"\n【入向关系】{len(in_rels)} 条")
    for r in in_rels[:10]:
        print(f"  {r['source']} --[{r['relation_type']} {r['strength']:.1f}]-->")

    if len(out_rels) > 10 or len(in_rels) > 10:
        print(f"  （仅显示前10条，总计出:{len(out_rels)} 入:{len(in_rels)}）")


def cmd_unit(unit_id):
    nodes = load_kg()
    new_nodes = load_new_nodes()
    rels = load_relations()

    chapters = UNIT_TO_CHAPTERS.get(unit_id)
    if not chapters:
        print(f"未知单元: {unit_id}，有效单元: {list(UNIT_TO_CHAPTERS.keys())}")
        return

    ch_names = [CHAPTER_NAMES.get(c, str(c)) for c in chapters]
    print(f"=== 单元 {unit_id} 相关节点 (对应章节: {ch_names}) ===\n")

    # 现有节点中对应章节的
    existing = {nid: n for nid, n in nodes.items() if n["chapter"] in chapters}
    # 新增节点中unit字段匹配的
    unit_new = {nid: n for nid, n in new_nodes.items() if n.get("unit") == unit_id}

    print(f"【现有节点】{len(existing)} 个（来自对应传统章节）")
    for n in sorted(existing.values(), key=lambda x: x["importance"], reverse=True)[:20]:
        kt = f"[{n.get('knowledge_type','?')}]" if n.get("knowledge_type") else ""
        print(f"  {kt} {n['name']} ({n['category']}, {n['bloom_level']})")

    if existing and len(existing) > 20:
        print(f"  ... 还有 {len(existing) - 20} 个（共{len(existing)}）")

    print(f"\n【新增节点】{len(unit_new)} 个")
    for n in unit_new.values():
        print(f"  [{n.get('knowledge_type','?')}] {n['name']}")


def cmd_new():
    new_nodes = load_new_nodes()
    new_rels = load_new_relations()

    if not new_nodes:
        print("暂无新增节点（staging区为空）")
        return

    print(f"=== 新增节点列表 ({len(new_nodes)} 个) ===\n")
    from collections import defaultdict
    by_unit = defaultdict(list)
    for n in new_nodes.values():
        by_unit[n.get("unit", "未指定单元")].append(n)

    for unit, ns in sorted(by_unit.items()):
        print(f"【单元 {unit}】{len(ns)} 个节点")
        for n in ns:
            print(f"  [{n.get('knowledge_type','?')}] {n['name']}: {n['definition'][:50]}...")
        print()

    print(f"=== 新增关系列表 ({len(new_rels)} 条) ===")
    from collections import Counter
    rt_dist = Counter(r["relation_type"] for r in new_rels)
    for rt, cnt in rt_dist.items():
        print(f"  {rt}: {cnt}")


def cmd_missing(keywords):
    nodes = load_kg()
    new_nodes = load_new_nodes()
    all_names = set(n["name"] for n in nodes.values()) | set(n["name"] for n in new_nodes.values())

    print("=== 概念缺口检查 ===\n")
    for kw in keywords:
        matched = [name for name in all_names if kw in name]
        if matched:
            print(f"✅ '{kw}' → 找到: {matched[:3]}")
        else:
            print(f"❌ '{kw}' → 图谱中无相关节点，需要新增")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    args = sys.argv[2:]

    if cmd == "stats":
        cmd_stats()
    elif cmd == "chapter":
        cmd_chapter(args[0] if args else "基本概念")
    elif cmd == "search":
        cmd_search(args[0] if args else "")
    elif cmd == "node":
        cmd_node(" ".join(args))
    elif cmd == "unit":
        cmd_unit(args[0] if args else "0-1")
    elif cmd == "new":
        cmd_new()
    elif cmd == "missing":
        cmd_missing(args)
    else:
        print(f"未知命令: {cmd}")
        print(__doc__)
