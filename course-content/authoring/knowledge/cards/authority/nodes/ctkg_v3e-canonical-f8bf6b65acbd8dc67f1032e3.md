---
node_id: ctkg_v3e-canonical-f8bf6b65acbd8dc67f1032e3
authority_entity_id: "ctkg:v3e-canonical-f8bf6b65acbd8dc67f1032e3"
name: "单位脉冲函数"
name_en: "Unit Impulse"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-bfa57e39514f60fad95c8e6c95ee5d551a8fcf7a81aa5f276e65042f417cd3ed.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-bfa57e39514f60fad95c8e6c95ee5d551a8fcf7a81aa5f276e65042f417cd3ed.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-10a/previous/ctkg_v3e-canonical-f8bf6b65acbd8dc67f1032e3.md"
asset_refs: []
---

## 首页

# 单位脉冲函数 | Unit Impulse

**一句话定义**：连续时间单位脉冲函数通常指 Dirac 单位冲激，其核心性质是单位面积，而不是有限的峰值高度。

**核心直觉**：脉宽越短，若要保持相同面积，脉冲就必须越高。

**关键公式**：矩形逼近在 $0\le t<\varepsilon$ 内取 $1/\varepsilon$，面积保持为 1。

**学习目标**：正确理解单位冲激的分布性质，并用有限脉冲逼近检查系统响应。

---

## 详情

### 完整解释

Dirac 冲激不是一个在原点取普通有限数值的函数。它通过积分中的作用定义：集中在某一时刻的单位权重，用来描述理想瞬时输入。对因果系统，需采用包含该时刻完整冲激作用的积分约定，不能只讨论某一个点的“高度”。

实际实验可以用短矩形脉冲近似冲激，但必须保留面积。宽度为 $\varepsilon$、高度为 $1/\varepsilon$ 的脉冲面积为 1；若高度始终为 1 而宽度趋于零，面积也趋于零，得到的是越来越弱的输入，不是单位冲激的逼近。

### 教学计算/推理例

在归一化时间下，取输入
$$
u_\varepsilon(t)=\begin{cases}1/\varepsilon,&0\le t<\varepsilon,\\0,&\text{其他时刻}.\end{cases}
$$
系统为 $G=2/(s+1)$，冲激前状态为零。有限脉冲作用期间解 $\dot y+y=2/\varepsilon$；脉冲结束后自由衰减。因此在 $t\ge\varepsilon$ 时
$$
y_\varepsilon(t)=\frac2\varepsilon(e^\varepsilon-1)e^{-t}.
$$
当 $\varepsilon=0.1$，高度为 10；当 $\varepsilon=0.01$，高度为 100，两者面积都为 1。在 $t=1$，对应输出约为 $0.773804$ 与 $0.739450$，而理想单位冲激响应为
$$
h(1)=\frac2e\approx0.735759.
$$
较窄脉冲在这个固定时刻更接近理想响应。这与 $(e^\varepsilon-1)/\varepsilon\to1$ 一致，从而 $y_\varepsilon(t)\to2e^{-t}$，这里比较的是固定的 $t>0$，不是把有限脉冲的每个峰值都说成完全相同。

### 适用条件与边界

实际脉冲高度可能受到执行器限制，过大的峰值也可能使对象离开线性范围。有限脉冲近似是否有效，应比较脉宽与对象动态，并检查输入面积及测量条件。本例使用理想线性对象，没有把数学极限当作实际装置可无限增大幅值的许可。连续时间 Dirac 冲激也不同于离散序列中某个样本取 1 的单位样本序列，两者的归一化和积分、求和规则不同。

### 常见误区

1. **误区**：把宽度缩小而高度固定为 1，就得到单位冲激。**纠正**：其面积趋于零。
2. **误区**：Dirac 冲激可以用一个普通有限峰值完整定义。**纠正**：关键是积分中的单位权重及分布极限。

### 自检

1. 本例宽度从 0.1 变为 0.01 时，高度为什么从 10 变为 100？
2. 两个有限脉冲在 $t=1$ 的结果接近哪个理想值？

**核对要点**：保持面积为 1；接近 $2/e$，而不是接近脉冲自身的高度。

### 关联节点

- **典型输入信号**（入边，关系：包含组件）
- **矩形脉冲近似单位脉冲**（无向，关系：相关）
