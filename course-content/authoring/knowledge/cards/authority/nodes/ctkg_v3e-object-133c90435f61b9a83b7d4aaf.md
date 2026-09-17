---
node_id: ctkg_v3e-object-133c90435f61b9a83b7d4aaf
authority_entity_id: "ctkg:v3e-object-133c90435f61b9a83b7d4aaf"
name: "可控性"
name_en: "Controllability"
category: 概念性
knowledge_type: C
bloom_level: 应用
card_version: 3
content_origin: act-course-enrichment
authority_release_id: ctr:release:control-theory-engineering-v0.48
authority_snapshot_id: snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
authority_snapshot_hash: 7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731
status: ready
source_docs:
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-afde513727ce302ca9d08e6aaef56c7f11b3dd499dfb7e21941d63b7435be6a0.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-afde513727ce302ca9d08e6aaef56c7f11b3dd499dfb7e21941d63b7435be6a0.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/可控性_9_b22a45c8.md
asset_refs: []
---

## 首页

# 可控性 | Controllability

**一句话定义**：对连续线性时不变状态模型，输入能在有限时间内把任意初始状态转移到任意目标状态的性质。

**核心直觉**：一个输入可以通过动态耦合影响多个状态；关键是有没有永远无法影响的方向。

**关键公式**：
$$
\mathcal C=[B\ AB\ \cdots\ A^{n-1}B],\qquad\operatorname{rank}\mathcal C=n.
$$

**学习目标**：使用秩判据判断连续线性系统的状态可控性，并区分它与稳定性及执行器能力。

---

## 详情

### 完整解释

#### 模型和输入假设

考虑 $\dot x=Ax+Bu$，其中状态维数为 $n$。本卡讨论无输入幅值约束的线性时不变模型。可控性是状态空间的结构性质，不等于某个实际执行器在限幅、限速和有限能量下能完成任意任务。

矩阵 $B$ 表示输入直接影响的方向，$AB,A^2B$ 等反映这种影响如何经系统动态传播。可控性矩阵列张成的空间若覆盖全部状态空间，则不存在完全无法通过输入调整的状态方向。

#### 一个输入控制两个状态

取教学模型
$$
A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix},\qquad B=\begin{bmatrix}0\\1\end{bmatrix}.
$$
得到
$$
\mathcal C=\begin{bmatrix}0&1\\1&-3\end{bmatrix},\qquad\det\mathcal C=-1.
$$
矩阵满秩，所以系统可控。输入没有直接出现在第一条状态方程中，但能通过第二个状态的变化间接影响第一个状态。

#### 不可控不等于必然不稳定

取 $A=\operatorname{diag}(-1,-2)$、$B=[1\ 0]^\mathsf T$，可控性矩阵为 $[[1,-1],[0,0]]$，秩为 $1$。第二状态满足 $\dot x_2=-2x_2$，输入无法把它任意指定为某个值，但它自身会衰减。

因此应区分“全部状态可控”和“不可控模态是否稳定”。后者与可稳定性有关。对完全可控系统，状态反馈可用于极点配置；实际配置仍会受到控制量、噪声与模型误差限制。

#### 与输出可控性的区别

一个模型可能无法控制全部内部状态，却仍能调节所关心的输出。图谱专门关联了状态可控性、输出可控性、可达性和不可控模态，这提醒我们先明确分析对象。离散系统中“从任意初态到零”和“从零到任意状态”等定义的等价性还需检查条件，不能脱离模型直接搬用措辞。

#### 自检

1. 输入维数小于状态维数，是否必然不可控？
2. 第一个算例把 $B$ 改为零矩阵后，秩是多少？

**核对要点**：不必然，动态耦合可能传递作用；秩为零，输入完全无法影响状态。

### 关联节点

- **图谱关联**：状态可达、完全可控、不完全可控、状态与输出可控性的区别、可控与不可控模态。
- **学习延伸**：可观测性处理测量信息；两者一起支持状态反馈与观测器设计。
