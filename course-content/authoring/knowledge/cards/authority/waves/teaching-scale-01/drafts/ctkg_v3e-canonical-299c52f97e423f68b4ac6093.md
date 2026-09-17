---
node_id: ctkg_v3e-canonical-299c52f97e423f68b4ac6093
authority_entity_id: "ctkg:v3e-canonical-299c52f97e423f68b4ac6093"
name: "稳态性能"
name_en: "Steady-State Performance"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-b40da3df73a484db5c2c82affebb727a3b885e4f401ad9694c9c05ec8401fbd6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-b40da3df73a484db5c2c82affebb727a3b885e4f401ad9694c9c05ec8401fbd6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-299c52f97e423f68b4ac6093.md"
asset_refs: []
---

## 首页

# 稳态性能 | Steady-State Performance

**一句话定义**：系统瞬态衰减后对跟踪、偏差和扰动残余的长期表现。

**核心直觉**：稳态性能看“最后剩多少误差”，动态性能看“怎么到达那里”，两者必须分开。

**关键公式**：
$$
e_ss=lim(t→∞)[r(t)−y(t)]
$$

**学习目标**：用输入类型、误差通道和最终值报告长期精度，而不把速度或超调混进同一个指标。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

稳态性能包括稳态误差、偏置和对慢扰动的残余响应。它依赖闭环结构、系统型别、输入阶次和稳定性；即使稳态误差为零，系统也可能有很大超调或很慢的调节过程。

请同时检查结果的正负号、数量级和归一化；若与直觉冲突，应优先回查输入类型、通道位置和初始条件。

### 教学计算/推理例

闭环 Φ(s)=2/(s+3) 对单位阶跃的终值为 2/3，因此 e_ss=1/3。这个结果说明跟踪精度有限，但没有告诉我们上升时间或是否有超调。

### 适用条件与边界

要求最终值存在，并说明参考、扰动或噪声通道。对不稳定或持续振荡系统，不能报告有限稳态性能数值。

### 自检

1. Φ(s)=2/(s+3) 的单位阶跃稳态误差是多少？
2. 稳态误差为零是否代表响应没有超调？

**核对要点**：为 1/3；不代表，超调属于动态过程，需要单独计算。

### 关联节点

- **动态性能指标**（出边，关系：相关）
- **动态性能**（出边，关系：相关）
