---
node_id: ctkg_v3e-object-0a05ec9e84791b95d3794bc0
authority_entity_id: "ctkg:v3e-object-0a05ec9e84791b95d3794bc0"
name: "补偿器"
name_en: "Compensator"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-361cf33656c82f196d171eaa0520cf63a48abb487cfeae39f066daf503afcd23.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-361cf33656c82f196d171eaa0520cf63a48abb487cfeae39f066daf503afcd23.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-object-0a05ec9e84791b95d3794bc0.md"
asset_refs: []
---

## 首页

# 补偿器 | Compensator

**一句话定义**：为弥补既有系统性能不足而插入的附加动态环节。

**核心直觉**：先说明要弥补的指标，再选择改变低频精度、中频相位或高频衰减的网络。

**关键公式**：
$$
G_c(s)=E_o(s)/E_in(s)
$$

**学习目标**：根据性能缺口选择补偿器，并比较加入前后的完整闭环通道。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

补偿器是一个设计部件，可能位于串联前向通道、反馈通道或其他信号位置。它不是“增益越大越好”的替代词：补偿器的极点、零点和放置位置会同时影响稳态、动态、噪声和鲁棒性。

### 教学计算/推理例

单位反馈对象 G=1/(s+1) 无补偿时闭环为 1/(s+2)，单位阶跃静差为 1/2。加入常数补偿器 G_c=4 后闭环为 4/(s+5)，静差降为 1/5=0.2；这是名义模型下的比较。

### 适用条件与边界

需明确补偿器所在信号位置、设计目标和稳定性条件。加入补偿器后应重新看所有输入通道和执行器限制。

### 自检

1. 补偿器只改变参考通道吗？
2. 上例加入 G_c=4 后单位阶跃静差是多少？

**核对要点**：不一定，位置不同会改变不同通道；为 0.2。

### 关联节点

- **积分补偿器**（出边，关系：前置于）
- **串联补偿器**（出边，关系：前置于）
- **相位超前补偿器**（出边，关系：前置于）
- **补偿器中的衰减因子1/α**（入边，关系：相关）
- **不可变部分**（入边，关系：相关）
