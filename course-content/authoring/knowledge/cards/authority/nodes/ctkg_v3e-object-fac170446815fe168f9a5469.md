---
node_id: ctkg_v3e-object-fac170446815fe168f9a5469
authority_entity_id: "ctkg:v3e-object-fac170446815fe168f9a5469"
name: "对角线规范型判据"
name_en: "Diagonal-Form Criterion"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-337d84b130fd95b2a88fd4ad258dc34b4d2b412a54b2dd265821e416074eebb5.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-337d84b130fd95b2a88fd4ad258dc34b4d2b412a54b2dd265821e416074eebb5.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-04a/previous/ctkg_v3e-object-fac170446815fe168f9a5469.md"
asset_refs: []
---

## 首页

# 对角线规范型判据 | Diagonal-Form Criterion

**一句话定义**：当特征值互异且系统已写成对角坐标时，可通过输入矩阵的零行或输出矩阵的零列判断模态是否缺少作用或观测。

**核心直觉**：在独立模态坐标中，某行没有输入就意味着该模态不受控，某列没有输出就意味着该模态看不见。

**关键公式**：互异特征值下，可控要求变换后的 $B$ 无全零行；可观测要求变换后的 $C$ 无全零列。

**学习目标**：正确使用互异特征值条件，并通过重根反例识别判据的边界。

---

## 详情

### 完整解释

在对角坐标中，每个状态对应一个自然模态。若特征值两两不同，不同模态的时间变化规律可以被区分。此时输入矩阵某一行全零，表示所有输入都没有直接激励该模态；由于对角矩阵也不把其他模态传入它，这个方向不可控。输出矩阵某一列全零，则所有输出都不包含该模态，导致不可观测。

若原模型先经过状态变换，必须同步变换 $B$ 和 $C$。把 $A$ 对角化后却继续检查原坐标的输入或输出矩阵，是把不同坐标中的对象混在一起。本判据也明确要求特征值互异；重特征值可能使不同状态具有无法区分的相同时间规律。

### 教学计算/推理例

取
$$
A=\begin{bmatrix}-1&0\\0&-2\end{bmatrix}.
$$
使用 $B=[1,1]^{\mathsf T}$ 时，两行均非零，可控矩阵为 $\begin{bmatrix}1&-1\\1&-2\end{bmatrix}$，秩为 2。改为 $B=[1,0]^{\mathsf T}$，第二行全零，可控矩阵降为秩 1。

同理，$C=[1,1]$ 的两列均非零，可观测矩阵为 $\begin{bmatrix}1&1\\-1&-2\end{bmatrix}$，秩为 2；改为 $C=[1,0]$，第二列全零，第二模态不可观测。

现在改变条件，取 $A=-I$、$B=[1,1]^{\mathsf T}$。虽然 $B$ 每行都非零，但
$$
[B\;AB]=\begin{bmatrix}1&-1\\1&-1\end{bmatrix}
$$
只有秩 1。输入同时以相同方式驱动两个相同模态，不能独立指定它们。这不是秩判据失效，而是“特征值互异”的简化判据条件被删除了。

### 适用条件与边界

特征值互异时可在适当复坐标下对角化；有复特征值时需按复数矩阵解释。一般系统可以使用可控、可观测矩阵或 PBH 判据，不必强行求对角形式。某个矩阵元素很小与精确为零也不同，数值实现应结合模型精度判断，避免把近似计算的微小量当成可靠的模态激励。

### 常见误区

1. **误区**：任何矩阵只要 $B$ 无零行就完全可控。**纠正**：必须处于对角坐标且特征值互异。
2. **误区**：可观测性检查 $C$ 的零行。**纠正**：对应状态模态的是 $C$ 的列。

### 自检

1. 重根反例为何只有一个可控方向？
2. 做状态坐标变换后，要用哪个 $B$、$C$ 检查？

**核对要点**：两列传播方向共线；使用与新 $A$ 同坐标的变换后输入、输出矩阵。

### 关联节点

- **系统不可观测**（出边，关系：适用于）
- **对角标准型可控性判据**（出边，关系：前置于）
- **对角标准型可控性判据**（入边，关系：属于）
