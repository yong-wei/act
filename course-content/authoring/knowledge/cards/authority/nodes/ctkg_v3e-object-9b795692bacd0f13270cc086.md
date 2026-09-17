---
node_id: ctkg_v3e-object-9b795692bacd0f13270cc086
authority_entity_id: "ctkg:v3e-object-9b795692bacd0f13270cc086"
name: "秩判据"
name_en: "Controllability Rank Criterion"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-9a9f15e8d7605c47afd34a5a99fd3e3a126d2bd8e79b55c0b019107a799c002b.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-9a9f15e8d7605c47afd34a5a99fd3e3a126d2bd8e79b55c0b019107a799c002b.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-04a/previous/ctkg_v3e-object-9b795692bacd0f13270cc086.md"
asset_refs: []
---

## 首页

# 秩判据 | Controllability Rank Criterion

**一句话定义**：连续线性定常系统的可控性秩判据通过输入方向及其动态传播方向是否覆盖整个状态空间来判断完全可控性。

**核心直觉**：不只看输入直接进入哪里，还要看系统内部动态能把这种作用传到哪里。

**关键公式**：$\operatorname{rank}[B\;AB\;\cdots\;A^{n-1}B]=n$。

**学习目标**：构造可控矩阵，解释缺秩状态方向，并避免只看 $B$ 的秩。

---

## 详情

### 完整解释

对于 $\dot x=Ax+Bu$，矩阵 $B$ 描述输入的直接作用方向，$AB$、$A^2B$ 等描述这种作用经系统动态传播产生的方向。将它们横向拼接，得到可控矩阵。如果这些列张成整个 $n$ 维状态空间，系统完全可控；否则存在无法由输入独立指定的状态方向。

单输入系统的 $B$ 只有一列，本身秩最多为 1，但经 $A$ 传播后仍可能得到多个独立方向。因此不能用 $\operatorname{rank}B<n$ 作为不可控的理由。另一方面，如果内部动态没有把输入传到某个状态，增加考察时间也不会自动填补该结构缺口。

### 教学计算/推理例

取无量纲模型
$$
A=\begin{bmatrix}-1&0\\0&-2\end{bmatrix},\quad B=\begin{bmatrix}1\\0\end{bmatrix}.
$$
状态方程为 $\dot x_1=-x_1+u$、$\dot x_2=-2x_2$。由此
$$
\mathcal C=[B\;AB]=\begin{bmatrix}1&-1\\0&0\end{bmatrix},\qquad \operatorname{rank}\mathcal C=1<2.
$$
第二状态按 $x_2(t)=e^{-2t}x_2(0)$ 自由变化，不受 $u$ 影响。从零状态出发，它始终为零；从非零初态出发，它虽衰减，也不能由输入在指定时刻任意设值。

保持 $A$ 不变，改用 $B=[1,1]^{\mathsf T}$，则
$$
\mathcal C=\begin{bmatrix}1&-1\\1&-2\end{bmatrix},\qquad \det\mathcal C=-1.
$$
矩阵满秩，系统完全可控。两个例子都是单输入，但第二例输入同时激励不同衰减速率的模态，形成两个独立方向。可见输入数量并非决定性依据。

### 适用条件与边界

该判据假定有限维连续 LTI 模型和无约束输入；它不保证控制能量小，也不保证有限执行器能完成指定快速动作。可逆状态坐标变换不改变可控矩阵的秩，因此换一种坐标表示不会凭空改变可控性。接近奇异的数值矩阵可能意味着控制代价很大，应区分精确数学秩与数值条件，而不是只报告一个软件秩值。

### 常见误区

1. **误区**：一个输入不能控制两个状态。**纠正**：第二个例子可控矩阵满秩。
2. **误区**：状态会自行衰减就意味着可控。**纠正**：第一个例子的第二状态稳定但不能由输入指定。

### 自检

1. 第一个例子中哪一条状态方程直接解释了缺秩？
2. 为什么第二个例子仍是单输入，却能满秩？

**核对要点**：第二状态方程不含输入；改后的输入激励两个不同模态，$B$ 与 $AB$ 不再共线。

### 关联节点

- **可控性判别阵**（出边，关系：包含组件）
- **系统完全可控**（出边，关系：包含组件）
- **秩判据的充分性**（出边，关系：包含组件）
