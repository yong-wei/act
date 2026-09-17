---
node_id: ctc_0f418dc24d2aacaaafdcdcc0
authority_entity_id: "ctc:0f418dc24d2aacaaafdcdcc0"
name: "前向通路总增益"
name_en: "Forward-Path Gain"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-058d8a612f8a057971ba364c0dbad31b1a0f76a37e3b5c1083c83d2db9235b34.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-058d8a612f8a057971ba364c0dbad31b1a0f76a37e3b5c1083c83d2db9235b34.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-07a/previous/ctc_0f418dc24d2aacaaafdcdcc0.md"
asset_refs: []
---

## 首页

# 前向通路总增益 | Forward-Path Gain

**一句话定义**：前向通路总增益 $P_k$ 是第 $k$ 条前向通路上各支路增益的乘积。

**核心直觉**：这里的“总”指一条通路经历的全部变换，不是把所有前向通路的增益先相加。

**关键公式**：$P_k=\prod_{i\in\text{第 }k\text{ 条通路}}g_i$。

**学习目标**：正确计算每条通路的增益，并保留通路编号用于梅森公式中的加权求和。

---

## 详情

### 完整解释

前向通路从输入源点沿箭头到输出汇点，途中不重复节点。每经过一条支路就乘上对应增益，所以整条通路的增益是连乘。正负号和支路上的动态因子都属于乘积，不能在计算中随意删除。多条通路则各有一个 $P_k$，应先分开记录。

区分单条通路增益和通路增益之和很重要。含反馈的图中，不同通路可能接触不同回路，因此梅森公式会给每条通路配上自己的余子式 $\Delta_k$。若过早把所有 $P_k$ 相加，就可能失去这种对应，错误地用同一个系数处理全部通路。

### 教学计算/推理例

共同无量纲代数图的支路为 $r\to x:2$、$x\to y:3$、$y\to x:-0.1$、$r\to y:1$、$y\to z:1$，以及 $r\to q:4$、$q\to q:0.2$、$q\to z:0.5$。

从 $r$ 到 $z$ 的三条前向通路及其增益为
$$
P_1: r\to x\to y\to z,\qquad P_1=2\times3\times1=6,
$$
$$
P_2: r\to y\to z,\qquad P_2=1\times1=1,
$$
$$
P_3: r\to q\to z,\qquad P_3=4\times0.5=2.
$$
$q$ 的自环不能额外绕进第三条前向通路，否则会重复节点。三条通路增益之和为 $6+1+2=9$，但 9 不是任何一条通路的 $P_k$，也不是整图输入输出增益。

本例对应的余子式分别为 $4/5,4/5,13/10$，故梅森分子为 $6(4/5)+1(4/5)+2(13/10)=41/5$。再除以特征式 $26/25$，整图增益为 $205/26$。不同权重说明为何要先保存每条通路的独立增益。

### 适用条件与边界

本例只有常数增益，所有变量均无量纲化。若支路是传递函数，乘积关系依赖相应线性模型条件。通路是否存在由图的方向和连接决定，不因某一次输入取值为零而改变。路径上的增益乘积也不直接说明沿途各个内部变量的幅值，因为内部节点可能还接受其他支路贡献。

### 常见误区

1. **误区**：“前向通路总增益”就是所有通路增益之和。**纠正**：来源定义中的 $P_k$ 针对一条通路。
2. **误区**：进入带自环的节点后，要先绕一圈才算完整通路。**纠正**：前向通路不重复节点，自环属于回路项。

### 自检

1. 第三条通路为何增益为 2，而不是包含 $0.2$ 的乘积？
2. 为什么不能先用 9 替代梅森公式中的全部 $P_k$？

**核对要点**：自环不属于前向通路；各通路配有不同余子式，应分别加权后求和。

### 关联节点

本卡的核心结论可由上述节点方程与回路乘积独立复核。
