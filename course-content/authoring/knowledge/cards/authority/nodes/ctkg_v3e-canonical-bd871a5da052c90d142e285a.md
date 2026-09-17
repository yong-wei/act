---
node_id: ctkg_v3e-canonical-bd871a5da052c90d142e285a
authority_entity_id: "ctkg:v3e-canonical-bd871a5da052c90d142e285a"
name: "瞬态响应"
name_en: "Transient Response"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-af135296b8586ca50256e1f7c6fb00437dc464c326fb2d4790e3bb85a3735a9a.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-af135296b8586ca50256e1f7c6fb00437dc464c326fb2d4790e3bb85a3735a9a.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-12a/previous/ctkg_v3e-canonical-bd871a5da052c90d142e285a.md"
asset_refs: []
---

## 首页

# 瞬态响应 | Transient Response

**一句话定义**：本卡把完整响应中随时间衰减到零的过渡分量称为瞬态响应。

**核心直觉**：瞬态不仅可能来自非零初态，也可能出现在零初态下接通输入的过程中。

**关键公式**：本例 $y_{\mathrm{tr}}(t)=0.8e^{-t}$，但零输入零初态响应为0。

**学习目标**：从完整解中识别瞬态，并避免把瞬态与零输入响应直接等同。

---

## 详情

### 完整解释

瞬态描述相对于长期响应形式的过渡分量。对稳定线性系统，输入接通时需要一段调整过程，完整解会同时包含长期部分和衰减部分。这个分解与“零输入加零状态”分解不是同一个分类依据，不能只因两种表达都出现指数函数就把它们合并。

零输入响应要求将外部输入置零并保留相应初态；零状态响应则保留输入但将初态置零。一个零状态响应本身可以同时含瞬态与稳态部分。本例正是用这一情况说明两种分解的区别。

### 教学计算/推理例

取归一化模型 $G=2/(s+1)$，输入为从零时刻开始的 $u(t)=\sin(2t)$，初始输出为零。完整响应为
$$
y(t)=0.4\sin(2t)-0.8\cos(2t)+0.8e^{-t}.
$$
前两项构成长期周期响应，最后一项衰减到零，因此
$$
y_{\mathrm{tr}}(t)=0.8e^{-t}.
$$
在初始时刻，长期部分为 $-0.8$，瞬态为 $0.8$，两者相加得到实际初值0。瞬态项并不是多余修正，而是完整解满足初始条件所必需的一部分。

如果同一系统保持零初态，同时把输入也置零，解为 $y(t)=0$。所以本例的瞬态 $0.8e^{-t}$ 不能称为“该零初态下的零输入响应”；它是在实际正弦输入接通过程的零状态响应中出现的。系统没有初始储能，也不意味着接通输入后没有过渡过程。

### 适用条件与边界

本卡采用会衰减的瞬态分量定义。若系统含不衰减或增长模态，不能不加条件地说所有自然模态最终都会消失，也不能假定存在同样的唯一稳态分解。实际分析应明确稳定性、输入持续方式和所选长期部分。本例中指数衰减率为1，时间已归一化。

从测量数据估计稳态幅相时，应避免把早期瞬态直接当成稳态误差；但“等待足够久”也需要结合模型与精度要求，而不是使用一个没有依据的固定时长。

### 常见误区

1. **误区**：只要初态为零，就没有瞬态。**纠正**：本例零状态正弦响应仍含衰减项。
2. **误区**：所有瞬态都是零输入响应。**纠正**：两者按不同方式分解完整响应。

### 自检

1. 本例哪个分量随时间消失？
2. 为什么零输入零初态的结果不能解释为 $0.8e^{-t}$？

**核对要点**：瞬态为 $0.8e^{-t}$；输入和初态都为零时，原线性方程的解是零。

### 关联节点

- **稳态**（无向，关系：相关）
- **稳态响应**（无向，关系：相关）
- **系统灵敏度**（出边，关系：用于分析）
