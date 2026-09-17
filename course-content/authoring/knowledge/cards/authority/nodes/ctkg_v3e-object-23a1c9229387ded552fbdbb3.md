---
node_id: ctkg_v3e-object-23a1c9229387ded552fbdbb3
authority_entity_id: "ctkg:v3e-object-23a1c9229387ded552fbdbb3"
name: "PBH秩判据"
name_en: "PBH Rank Test"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-5c013b33346d3051774344b6fa009d71f691b301051076aa844587665da280e6.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-5c013b33346d3051774344b6fa009d71f691b301051076aa844587665da280e6.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-04a/previous/ctkg_v3e-object-23a1c9229387ded552fbdbb3.md"
asset_refs: []
---

## 首页

# PBH秩判据 | PBH Rank Test

**一句话定义**：PBH 秩判据在状态矩阵的各个特征值处检查输入或输出是否遗漏某个动态模态。

**核心直觉**：逐个模态询问“输入能否作用到它”或“输出能否看见它”，就能找到整体秩不足的来源。

**关键公式**：可控性检查 $\operatorname{rank}[\lambda I-A\;B]=n$；可观测性检查 $\operatorname{rank}\begin{bmatrix}\lambda I-A\\C\end{bmatrix}=n$。

**学习目标**：正确区分横向与纵向拼接，并定位不可控或不可观测模态。

---

## 详情

### 完整解释

PBH 判据将整体可控性与可观测性转化为特征值处的秩检查。对有限维线性定常系统，完全可控要求每个特征值处的横向拼接矩阵满行秩；完全可观测要求每个特征值处的纵向拼接矩阵满列秩。不是只选一个方便的特征值检查，也不是看到特征值都稳定就跳过秩判断。

当 $\lambda$ 不是 $A$ 的特征值时，$\lambda I-A$ 已经可逆，拼接后不会缺秩。因此实际只需考察特征值。若有复特征值，矩阵及秩在复数域中解释；不能把特征值的虚部丢掉再代入。判据也适用于重特征值，不要求状态矩阵可对角化。

### 教学计算/推理例

取无量纲模型
$$
A=\begin{bmatrix}-1&0\\0&-2\end{bmatrix},\quad B=\begin{bmatrix}1\\0\end{bmatrix},\quad C=\begin{bmatrix}1&1\end{bmatrix}.
$$
在 $\lambda=-1$ 时，可控 PBH 矩阵为
$$
\begin{bmatrix}0&0&1\\0&1&0\end{bmatrix},
$$
秩为 2；在 $\lambda=-2$ 时，它为
$$
\begin{bmatrix}-1&0&1\\0&0&0\end{bmatrix},
$$
秩为 1。第二个模态不能被输入驱动，因此系统不完全可控。它的极点为负，只说明其自由响应衰减，不能改变不可控的事实。

可观测性则使用纵向矩阵。在 $\lambda=-1$ 时为 $\begin{bmatrix}0&0\\0&1\\1&1\end{bmatrix}$，在 $\lambda=-2$ 时为 $\begin{bmatrix}-1&0\\0&0\\1&1\end{bmatrix}$，两者均为秩 2。所以这个系统完全可观测，却不完全可控。输入能到达哪些状态与输出能辨别哪些状态是不同问题。

### 适用条件与边界

可控性判据针对 $(A,B)$，可观测性判据针对 $(A,C)$，不能只给出 $A$ 就声称系统可控或可观测。数值计算中接近缺秩与精确缺秩也不同，应结合模型尺度和容差解释结果；本例使用精确小矩阵，没有这种数值歧义。稳定的不可控模态可能不妨碍稳定化，但会限制任意极点配置。

### 常见误区

1. **误区**：所有极点在左半平面就通过 PBH。**纠正**：稳定性和输入输出模态覆盖不同，本例就是反例。
2. **误区**：可观测性也把 $C$ 横着拼在右边。**纠正**：可观测检查把 $C$ 纵向接在下方。

### 自检

1. 哪个特征值处的可控检查失败？
2. 为什么该模态仍能通过输出被观察？

**核对要点**：$\lambda=-2$ 处缺秩；$C$ 同时包含两个状态，且两个模态衰减速率不同，可观测检查均满秩。

### 关联节点

- **可控性PBH秩判据法**（出边，关系：属于）
