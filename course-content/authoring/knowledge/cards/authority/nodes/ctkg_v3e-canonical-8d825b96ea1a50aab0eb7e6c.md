---
node_id: ctkg_v3e-canonical-8d825b96ea1a50aab0eb7e6c
authority_entity_id: "ctkg:v3e-canonical-8d825b96ea1a50aab0eb7e6c"
name: "一阶系统"
name_en: "First-Order System"
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
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-67ab7cd6ce8e9883ee1b36d5da32378950308c44aafd519542c898f9e6583e56.json
  - course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-67ab7cd6ce8e9883ee1b36d5da32378950308c44aafd519542c898f9e6583e56.json
  - git:f655dee490f714247dea867602a4d42bf699f2fd:course-content/authoring/knowledge/cards/nodes/一阶系统_3_4f3b29ce.md
asset_refs: []
---

## 首页

# 一阶系统 | First-Order System

**一句话定义**：由一阶微分方程描述动态的系统；稳定低通标准型具有一个正时间常数。

**核心直觉**：每过一个时间常数，尚未完成的变化缩小到原来的约 $36.8\%$。

**关键公式**：
$$
G(s)=\frac{K}{Ts+1},\qquad y(t)=KA(1-e^{-t/T}),\quad T>0.
$$

**学习目标**：用时间常数计算响应进度，并区分精确指标与常用近似。

---

## 详情

### 完整解释

#### 先说明模型范围

首页响应对应零初始状态、幅值为 $A$ 的阶跃输入，以及无零点、无时延的稳定一阶低通模型。一般的一阶输入输出模型可能带零点或直通项，不能全部套用这一单调响应。

$K$ 决定稳态增益，$T$ 决定动态时间尺度，唯一极点为 $-1/T$。对正的 $KA$，标准响应从零单调趋于 $KA$，不会越过终值产生超调。

#### 教学计算例

取 $K=2$、$T=0.5$ 秒，单位阶跃输入。终值为 $2$：

| 时刻 | 输出 | 达到终值的比例 |
|---|---:|---:|
| $0.5$ 秒 | $1.2642$ | $63.21\%$ |
| $1.5$ 秒 | $1.9004$ | $95.02\%$ |
| $2$ 秒 | $1.9634$ | $98.17\%$ |

按首次从 $10\%$ 到 $90\%$ 的定义，上升时间为 $t_r=T\ln9\approx2.1972T$，本例为 $1.0986$ 秒。若调节误差带取终值的 $\delta$，标准单调响应的精确调节时间为
$$
t_s=-T\ln\delta.
$$
因此 $2\%$ 带对应 $3.9120T=1.9560$ 秒，常写成约 $4T$；$5\%$ 带对应约 $2.9957T$，常写成 $3T$。报告数值时应说清误差带。

#### 如何从实验理解时间常数

已知终值后，可用达到终值 $63.2\%$ 的时刻估计 $T$。也可利用初始斜率 $KA/T$：零时刻切线与终值线的交点位于 $t=T$。这与图谱中的“初始斜率求时间常数”相对应。

对该标准低通模型，带宽频率为 $1/T$。本例为 $2$ rad/s；它连接时域速度与频域响应，但不能推广成任意高阶模型的恒等式。

#### 自检

1. 将 $K$ 加倍但保持 $T$，归一化响应速度会改变吗？
2. 一阶近似出现明显超调或纯时延时，应继续机械拟合标准式吗？

**核对要点**：归一化速度不变；应检查是否遗漏零点、时延或其他动态。

### 关联节点

- **图谱关联**：单位阶跃响应、单位脉冲响应、初始斜率求时间常数、一阶动态性能指标。
- **学习延伸**：传递函数与系统带宽共同描述模型；二阶系统用于理解新增振荡动态。
