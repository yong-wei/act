---
node_id: ctkg_v3e-object-5592624b3ec200b86f7b744d
authority_entity_id: "ctkg:v3e-object-5592624b3ec200b86f7b744d"
name: "可观测性"
name_en: "Observability"
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
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8ab30f2f1616b1892b4d219f04e6c0bc1203bea6c8ff86e3390f8eacdbf0ffd4.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8ab30f2f1616b1892b4d219f04e6c0bc1203bea6c8ff86e3390f8eacdbf0ffd4.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/可观测性_9_b26c542c.md
asset_refs: []
---

## 首页

# 可观测性 | Observability

**一句话定义**：已知输入和一段有限时间的输出记录，能够唯一确定初始状态的性质。

**核心直觉**：某个状态不被直接测量，并不意味着它不会通过动态在输出中留下可辨识痕迹。

**关键公式**：
$$
\mathcal O=\begin{bmatrix}C\\CA\\\vdots\\CA^{n-1}\end{bmatrix},\qquad\operatorname{rank}\mathcal O=n.
$$

**学习目标**：对线性时不变模型使用秩判据，区分可观测性与实际估计精度。

---

## 详情

### 完整解释

#### 已知的是输入和输出

对 $\dot x=Ax+Bu$、$y=Cx+Du$，可观测性要求输入已知，并能从理想输出历史唯一识别初始状态。已知输入造成的响应可以在分析中扣除，所以基本秩判据由 $(A,C)$ 决定，而不是仅看传感器数量。

输出只有一个通道时，也可能通过不同模态的时间变化区分多个状态。反过来，传感器不少也不保证信息独立。

#### 一个输出辨识两个状态

取教学模型 $A=\operatorname{diag}(-1,-2)$，$C=[1\ 1]$。可观测性矩阵为
$$
\mathcal O=\begin{bmatrix}1&1\\-1&-2\end{bmatrix},\qquad\det\mathcal O=-1.
$$
矩阵满秩。零输入时，$y(0)=x_1(0)+x_2(0)$，$\dot y(0)=-x_1(0)-2x_2(0)$。若理想读数为 $y(0)=3$、$\dot y(0)=-5$，联立可得 $x_1(0)=1$、$x_2(0)=2$。

这个例子用导数展示信息独立性，不表示实际设备应直接对含噪测量做数值微分；工程中通常采用状态估计方法处理噪声。

#### 测量选择会改变结论

若同一 $A$ 改用 $C=[1\ 0]$，则第二状态始终不进入输出，可观测性矩阵秩为 $1$。即使采集更长时间，理想输出也不能唯一确定第二状态的初值。

若把 $A$ 改为 $-I$，同时保留 $C=[1\ 1]$，两个状态以相同速率衰减，输出只保留两者之和，仍无法分开。这说明动态差异也是可辨识信息的一部分。

#### 可观测不等于估计容易

秩判据判断的是理想模型的唯一性。实际数据可能受到噪声、有限采样、模型误差和病态数值的影响。不可观测模态若稳定，可涉及可检测性与观测器收敛问题，但不能因此声称全部初始状态都可识别。

#### 自检

1. 为什么本例一个输出仍可观察两个状态？
2. 可观测性是否自动保证测量噪声很大时估计仍精确？

**核对要点**：不同动态在输出历史中留下独立信息；不保证，唯一性与估计精度是不同问题。

### 关联节点

- **图谱关联**：可检测性、对偶性、观测器规范型、零输入初始状态估计。
- **学习延伸**：与可控性对照，区分输入作用范围和输出信息范围，再进入状态反馈及观测器设计。
