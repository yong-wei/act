---
node_id: ctkg_v3e-canonical-b1fa48122cb30019661f9eaa
authority_entity_id: "ctkg:v3e-canonical-b1fa48122cb30019661f9eaa"
name: "峰值时间T_p"
name_en: "Peak Time and Time Origin"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8dcb1f7a1dec4ee49d2acc5005b071d318a1a66a624a1bbb09a89c5f0710d6cb.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8dcb1f7a1dec4ee49d2acc5005b071d318a1a66a624a1bbb09a89c5f0710d6cb.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-12a/previous/ctkg_v3e-canonical-b1fa48122cb30019661f9eaa.md"
asset_refs: []
---

## 首页

# 峰值时间T_p | Peak Time and Time Origin

**一句话定义**：峰值时间应说明计时原点，通常从输入施加时刻计到第一次超调峰。

**核心直觉**：同一个响应晚开始，并不意味着它自身的上升和振荡变慢；绝对时钟与相对时间要分开。

**关键公式**：本例 $t_{p,\mathrm{absolute}}=0.5+t_{p,\mathrm{relative}}$。

**学习目标**：正确处理输入起始时刻的平移，避免把参考延后与反馈内部时延混为一谈。

---

## 详情

### 完整解释

测量记录经常在输入改变之前就已经开始。若直接把横坐标上的峰值位置当成响应峰时，会把等待时间也计入动态指标。报告时应说明时间零点，或明确将输入开始时刻从绝对时间中减去。

对同一个时不变闭环，只有参考输入的施加时刻整体平移时，响应相应平移，形状和相对峰时保持一致。这个结论不表示可以往反馈内部插入时延而保持原极点不变；后者改变了反馈动态，是另一个模型问题。

### 教学计算/推理例

采用归一化标准闭环 $T=4/(s^2+2s+4)$。若单位阶跃从 $t=0$ 施加，第一峰相对时间为
$$
t_{p,\mathrm{relative}}=\frac\pi{\sqrt3}\approx1.813799.
$$
现在让同一参考在绝对时钟 $t=0.5$ 才开始，即 $r(t)=H(t-0.5)$，此前状态为零。若记原单位阶跃响应为 $y_0$，新的输出为
$$
y(t)=\begin{cases}0,&t<0.5,\\y_0(t-0.5),&t\ge0.5.\end{cases}
$$
因此峰值在绝对时钟上出现在
$$
t_{p,\mathrm{absolute}}=0.5+\frac\pi{\sqrt3}\approx2.313799.
$$
从输入实际开始时刻计，仍为1.813799。数值2.313799与1.813799都可以正确，但它们描述的是不同时间坐标，不能在没有说明的情况下相互比较。

由于只是输入起点平移，峰值幅度也不改变；这个结论依赖相同闭环与相同输入形状，而不是一般“时延不影响性能”的结论。

### 适用条件与边界

本例将延后放在参考施加时刻，闭环本身保持不变。若时延位于控制器、对象或传感器反馈链中，就需要重新建立特征条件，不能直接在原峰时上加一个常数。实际数据还应确认触发标记与采样时钟是否一致，否则输入起点误差会直接传到指标。

若响应没有超调峰，或有多个不同机制产生的局部峰，也应先说明采用哪个事件定义，而不是从曲线上任选最大样本。

### 常见误区

1. **误区**：峰出现在绝对时钟2.313799，说明系统相对峰时变长。**纠正**：本例包含0.5的输入等待时间。
2. **误区**：任何反馈时延都只需要平移响应。**纠正**：反馈内部时延会改变系统本身。

### 自检

1. 怎样从本例绝对峰值时刻恢复通常的相对峰时？
2. 为什么本例不能证明反馈时延不改变稳定性？

**核对要点**：减去输入起始时刻0.5；本例只移动参考开始时间，没有修改反馈链。

### 关联节点

- **调节时间 t_s**（无向，关系：相关）
- **上升时间 T_r**（无向，关系：相关）
- **调节时间 T_s**（无向，关系：相关）
