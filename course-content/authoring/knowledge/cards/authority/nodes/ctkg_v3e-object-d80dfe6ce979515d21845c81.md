---
node_id: ctkg_v3e-object-d80dfe6ce979515d21845c81
authority_entity_id: "ctkg:v3e-object-d80dfe6ce979515d21845c81"
name: "串联滞后-超前校正"
name_en: "Series Lead-Lag Compensation"
category: 概念性
knowledge_type: C
bloom_level: 评价
card_version: 3
content_origin: act-course-enrichment
authority_release_id: "ctr:release:control-theory-engineering-v0.48"
authority_snapshot_id: "snap-7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
authority_snapshot_hash: "7f1549103098d6efcc8a3989a344c047af682df7d8b4bddd7a28101dee04e731"
status: ready
source_docs:
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-8677504b988904be14627ec17514ab41b0b2d67bc951c28521a300cf4d58e1ce.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-8677504b988904be14627ec17514ab41b0b2d67bc951c28521a300cf4d58e1ce.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-scale-01g/previous/ctkg_v3e-object-d80dfe6ce979515d21845c81.md"
asset_refs: []
---

## 首页

# 串联滞后-超前校正 | Series Lead-Lag Compensation

**一句话定义**：串联滞后-超前网络把相位超前与低频增益调节组合到同一前向校正中。

**核心直觉**：超前部分用于争取相位裕度，滞后部分用于改善稳态性能；每个指标都必须在完整新环路上重算。

**关键公式**：
$$
C(s)=\frac{1+s}{1+0.1s}\,10\frac{1+10s}{1+100s}.
$$

**学习目标**：用低频性能、闭环根、增益穿越频率和相位裕度共同评价滞后-超前校正。

---

## 详情

### 完整解释

滞后-超前校正是两个作用因子的串联组合。对本例，超前因子为 $(1+s)/(1+0.1s)$，滞后因子为 $10(1+10s)/(1+100s)$；前者提供相位改善的设计空间，后者提高低频增益以改善稳态性能。来源描述把响应速度、超调和噪声抑制列为组合目标，但这些是设计用途，不是任意参数下的保证。

### 教学计算/推理例

已验算的基线环路为 $1/[s(s+1)]$，其增益穿越频率为 $0.7861513777573741\ \mathrm{rad/s}$，相位裕度为 $51.82729237298949^\circ$。加入上述控制器后，增益穿越频率为 $0.9999509697194077\ \mathrm{rad/s}$，相位裕度为 $79.15178050016591^\circ$。斜坡稳态误差由基线的 $1$ 变为 $0.1$，对应速度系数由 $K_v=1$ 提升到 $K_v=10$。

完整闭环特征多项式为
$$
10s^4+110.1s^3+201.1s^2+111s+10,
$$
其闭环根为 $-8.886051522703896$、$-1.0128390998003511$、$-1.0000000000000093$ 和 $-0.11110937749575278$，均为左半平面实根。这里用根、交越频率和相位裕度共同复核，而不是只引用某个设计因子。

### 适用条件与边界

本例采用理想线性定常对象、零初态、单位负反馈和连续时间模型；所有频率均以 $\mathrm{rad/s}$ 表示，相位裕度以度表示。控制器高频增益为 $10$，所以测量噪声的高频控制通道可能被放大；“抑制高频噪声”不能脱离传感器、滤波器和噪声传递函数单独宣称。改变对象、反馈或参数后必须重新计算全部闭环根和裕度。

### 常见误区

1. **误区**：相位裕度从 $51.82729237298949^\circ$ 增到 $79.15178050016591^\circ$ 就证明所有性能都改善。**纠正**：本例还需同时检查斜坡误差、闭环根、控制量和噪声通道，结果只属于给定模型。
2. **误区**：滞后-超前校正的高频增益自然会降低噪声。**纠正**：本控制器的高频增益已验算为 $10$，实际噪声效果取决于完整测量通道。

### 自检

1. 本例中相位裕度和斜坡误差分别发生了什么变化？
2. 为什么必须重新计算完整四阶闭环多项式，而不能只看两个因子的零极点？

**核对要点**：相位裕度增至 $79.15178050016591^\circ$，斜坡误差降至 $0.1$；两个因子与对象耦合后共同决定闭环根和交越频率。

### 关联节点

- **相位超前补偿器**（出边，关系：包含组件）
- **相位滞后补偿器**（出边，关系：包含组件）
- **利用滞后-超前网络的超前部分来增大系统的相角裕度，同时利用滞后部分来改善系统的稳态性能。**（入边，关系：适用于）
- **兼有滞后校正和超前校正的优点，即已校正系统响应速度较快，超调量较小，抑制高频噪声的性能也较好。**（入边，关系：适用于）
