---
node_id: ctc_modeling-5e62391de61ac1af304601cb
authority_entity_id: "ctc:modeling-5e62391de61ac1af304601cb"
name: "信号流图支路"
name_en: "Signal-Flow Branch"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-4325d73f7fb4070addc8537046e5baca27a6cc21f8474053e36300c6eb779745.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-4325d73f7fb4070addc8537046e5baca27a6cc21f8474053e36300c6eb779745.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-06a/previous/ctc_modeling-5e62391de61ac1af304601cb.md"
asset_refs: []
---

## 首页

# 信号流图支路 | Signal-Flow Branch

**一句话定义**：支路是带有方向和增益的连接，表示一个变量对另一个变量的贡献关系。

**核心直觉**：一条入支路给出一个贡献；目标节点有多条入支路时，要把所有贡献相加。

**关键公式**：$y\to x$ 的增益为 $-0.1$，表示向 $x$ 贡献 $-0.1y$。

**学习目标**：正确读取支路方向、增益和目标节点求和，避免把单个贡献当成完整节点值。

---

## 详情

### 完整解释

支路箭头从起点变量指向终点变量。起点变量乘上支路增益，形成送到终点的一项贡献。若终点还接收其他支路，它的节点方程包含所有这些贡献；因此不能只盯住一条支路就写出整个终点变量。

方向与负号分别表达不同信息：方向说明哪一个变量出现在另一个变量的表达式右端，负号说明该项在求和中取负。负增益并不意味着箭头反向。一个变量也可以同时沿多条出支路影响不同目标，信号不会因此被自动分成几份。

### 教学计算/推理例

仍用无量纲代数图 $r\to x:2$、$x\to y:3$、$y\to x:-0.1$、$r\to y:1$、$y\to z:1$。目标节点 $x$ 有两条入支路，分别贡献 $2r$ 与 $-0.1y$，所以
$$
x=2r-0.1y.
$$
不能只根据 $y\to x$ 写成 $x=-0.1y$。同理，$y$ 接收 $3x$ 与 $r$，故 $y=3x+r$；$z$ 只有一条单位增益入支路，才有 $z=y$。

当 $r=1$，整组方程的解是 $x=19/13$、$y=z=70/13$。对 $x$ 的反馈贡献为 $-0.1(70/13)=-7/13$，输入贡献为 $2=26/13$，相加得到 $19/13$。对 $y$，两项为 $3(19/13)=57/13$ 与 $1=13/13$，相加为 $70/13$。逐节点核对能够发现漏支路或负号错误。

### 适用条件与边界

支路增益可以是常数或适用条件下的传递函数；它的单位应把起点变量转换成能与终点其他贡献相加的单位。此处所有信号已无量纲化，避免单位混用。只有当完整关系满足额外条件时，才能做代数反解；即使可以反解，也不等于原图中自动存在一条反向支路。若把反向支路直接添加而保留原方程，会改变原图结构。

本例有反馈，所有节点关系需同时求解。箭头不是计算机程序的单次执行顺序，也不代表真实信号必须经过一个离散时间步才到达下一节点。

### 常见误区

1. **误区**：支路 $y\to x:-0.1$ 表示完整的 $x=-0.1y$。**纠正**：还要加入 $r\to x$ 的贡献。
2. **误区**：负增益意味着支路箭头应反转。**纠正**：方向和正负号承担不同语义。

### 自检

1. 本例节点 $y$ 的两项入支路贡献分别是什么？
2. 为什么 $z=y$ 可以由一条支路直接写出，而 $x$ 不行？

**核对要点**：$y$ 接收 $3x$ 和 $r$；$z$ 只有一条单位增益入边，$x$ 则有两条入边需要求和。

### 关联节点

- **信号流图**（出边，关系：组成部分属于）
