---
node_id: ctkg_v3e-object-10c37fd947ba55593ff03ede
authority_entity_id: "ctkg:v3e-object-10c37fd947ba55593ff03ede"
name: "性能指标"
name_en: "Performance Indices"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: draft
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-7c6e57cd77d92d9d2e8892527b6979462f44d25a7fb50e2d51ceebc8363d489c.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-7c6e57cd77d92d9d2e8892527b6979462f44d25a7fb50e2d51ceebc8363d489c.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-10c37fd947ba55593ff03ede.md"
asset_refs: []
---

## 首页

# 性能指标 | Performance Indices

**一句话定义**：把响应速度、超调、调节、稳态误差或频域余量写成可比较的量化要求。

**核心直觉**：指标必须带定义、输入、归一化和容许范围，单独一个数字不能代表全部性能。

**关键公式**：
$$
M_p=(y_max−y_∞)/|y_∞|×100%,  |y−y_∞|≤δ|y_∞|
$$

**学习目标**：从曲线中正确读取性能指标，并区分动态指标、稳态指标和频域指标。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

性能指标是设计问题的验收语言。超调量描述峰值相对终值的偏离，调节时间描述进入并保持误差带的时间，稳态误差描述长期偏差；它们的参考输入和归一化方式必须一致。

### 教学计算/推理例

若阶跃终值为 1、峰值为 1.2，则超调量为 20%。若曲线首次进入并保持 2% 误差带的时刻为 3 s，则按该定义调节时间为 3 s。

### 适用条件与边界

必须说明输入幅值、终值、误差带（如 2% 或 5%）和是否要求“进入并保持”。没有这些约定，指标数值不能直接比较。

### 自检

1. 终值 2、峰值 2.4 时超调量是多少？
2. 调节时间是否只看第一次穿过误差带？

**核对要点**：仍为 20%；不是，还要确认之后一直保持在误差带内。

### 关联节点

- **系统带宽**（出边，关系：前置于）
- **时域性能指标**（入边，关系：属于）
- **校正问题**（出边，关系：适用于）
- **系统带宽**（入边，关系：属于）
- **复合型性能指标**（出边，关系：表示）
