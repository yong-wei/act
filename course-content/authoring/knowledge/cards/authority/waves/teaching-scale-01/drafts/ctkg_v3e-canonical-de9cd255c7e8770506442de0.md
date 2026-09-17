---
node_id: ctkg_v3e-canonical-de9cd255c7e8770506442de0
authority_entity_id: "ctkg:v3e-canonical-de9cd255c7e8770506442de0"
name: "叠加原理"
name_en: "Superposition Principle"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-2463eb6c0effd7bc4ccf73d1d8ddbbb43239466b831d75d016df537fd163f8e6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-2463eb6c0effd7bc4ccf73d1d8ddbbb43239466b831d75d016df537fd163f8e6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01/previous/ctkg_v3e-canonical-de9cd255c7e8770506442de0.md"
asset_refs: []
---

## 首页

# 叠加原理 | Superposition Principle

**一句话定义**：线性系统对输入的加权和响应等于各输入响应的加权和。

**核心直觉**：可以先拆输入、分别求响应，再把结果相加；非线性环节会破坏这条捷径。

**关键公式**：
$$
T[a u₁+b u₂]=aT[u₁]+bT[u₂]
$$

**学习目标**：判断一个计算是否可以用叠加，并保持初始状态和工作点一致。

---

## 详情

### 完整解释

本卡的核对顺序是：先固定模型、输入输出与单位，再代入公式计算，最后把结果与图谱中的关联边界对照。这里的数值例服务于该定义；一旦出现不同的反馈符号、工作点、采样方式或额外动态，就应回到适用条件重新建模。

叠加原理是线性系统的结构性质，要求相同的系统参数、初始条件和输入输出通道。它可把复杂参考分解为阶跃、斜坡或正弦分量，但饱和、死区、继电器和状态相关参数会使分解后的和不再等于真实响应。

### 教学计算/推理例

对 G(s)=1/(s+1)，单位阶跃响应 y₁(1)=1−e^(−1)≈0.6321。输入 3·1(t) 的响应为 3y₁(1)≈1.8964，也等于 y₁+2y₁；这里仅使用线性比例。

### 适用条件与边界

需要线性定常或至少在同一线性化模型内，且不改变初始状态。大信号和执行器限幅时必须直接仿真原输入。

### 自检

1. 为什么同一对象的两个输入响应可以相加？
2. 经过饱和器后，叠加关系还成立吗？

**核对要点**：因为系统是线性的；一般不成立，饱和器是非线性环节。

### 关联节点

- **线性叠加原理**（入边，关系：相关）
- **当且仅当系统为线性系统时，叠加原理适用。**（入边，关系：适用于）
