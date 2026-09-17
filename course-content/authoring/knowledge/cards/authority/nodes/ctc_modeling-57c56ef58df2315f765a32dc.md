---
node_id: ctc_modeling-57c56ef58df2315f765a32dc
authority_entity_id: "ctc:modeling-57c56ef58df2315f765a32dc"
name: "梅森增益公式"
name_en: "Mason's Gain Formula"
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
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/details/node-1d8e71d0adc0067bb4db9fae6ba9e5d63d411aea6ab8a50afbc82a994f87c844.json"
  - "course-content/runtime/knowledge/authority-domain-shards/sets/ads-30c0c98ada82432b68f9de26b698a658394780acbd1faa801cb18b5e8e8a99a1/neighborhoods/node-1d8e71d0adc0067bb4db9fae6ba9e5d63d411aea6ab8a50afbc82a994f87c844.json"
  - "course-content/authoring/knowledge/cards/authority/waves/teaching-core-07a/previous/ctc_modeling-57c56ef58df2315f765a32dc.md"
asset_refs: []
---

## 首页

# 梅森增益公式 | Mason's Gain Formula

**一句话定义**：梅森增益公式通过前向通路增益、回路特征式和通路余子式计算信号流图的输入输出增益。

**核心直觉**：每条通路先乘自己的余子式，再把结果相加，最后除以全图特征式。

**关键公式**：$T=\dfrac{\sum_kP_k\Delta_k}{\Delta}$。

**学习目标**：把路径、回路和余子式正确配对，并用节点方程独立核对最终结果。

---

## 详情

### 完整解释

公式中的 $P_k$ 是单条前向通路的支路增益乘积，$\Delta$ 由全图基本回路及不接触回路组合构造，$\Delta_k$ 则仅使用不接触第 $k$ 条通路的回路。三者承担不同角色，不能只把所有路径增益相加后除以一个分母。

实际计算可先固定节点与方向，再枚举不重复节点的前向通路和基本回路，随后确定接触关系。这个顺序能减少遗漏，也便于逐项检查。公式是线性关系的求解方法，不会替代建模本身；如果原图漏掉反馈、扰动支路或加载关系，公式会准确地求解一个错误的图。

### 教学计算/推理例

共同无量纲图对应
$$
x=2r-0.1y,\quad y=3x+r,\quad q=4r+0.2q,\quad z=y+0.5q.
$$
三条前向通路 $r-x-y-z$、$r-y-z$、$r-q-z$ 的增益为 $6,1,2$。两个不接触回路 $x-y-x$ 与 $q$ 自环的增益为 $L_1=-3/10$、$L_2=1/5$，因此
$$
\Delta=1-(L_1+L_2)+L_1L_2=\frac{26}{25}.
$$
前两条通路接触 $L_1$，第三条接触 $L_2$，故余子式分别为 $4/5,4/5,13/10$。分子为
$$
\sum_kP_k\Delta_k=6\frac45+1\frac45+2\frac{13}{10}=\frac{41}{5}.
$$
最终
$$
\frac zr=\frac{41/5}{26/25}=\frac{205}{26}.
$$
独立消元得到 $y=(70/13)r$、$q=5r$，再由 $z=y+0.5q$ 得到相同结果。若错误使用未加权的路径和 9，则得到 $9/(26/25)=225/26$，与原节点方程不符。这说明余子式不是可有可无的修正。

### 适用条件与边界

本例是非奇异的线性代数图，所有变量无量纲化。支路为传递函数时，结果按相应零状态输入输出关系解释；可能的内部模态、初态和实现约束要另行检查。只有在表达式定义良好时才能使用除法，不能在 $\Delta=0$ 时直接套数值公式。对大型图，路径和回路枚举可能繁多，节点矩阵求解可以作为另一种计算与核对方式。

### 常见误区

1. **误区**：梅森公式分子就是全部 $P_k$ 之和。**纠正**：每项必须乘对应的 $\Delta_k$。
2. **误区**：套用公式后无需检查原方程。**纠正**：独立代入可发现漏路径、回路符号或余子式配对错误。

### 自检

1. 第三条通路为什么乘 $13/10$ 而不是 $4/5$？
2. 本例如何不依赖梅森公式核验 $205/26$？

**核对要点**：第三条只接触 $q$ 自环，留下 $L_1$；直接求出 $y,q$ 并代入 $z=y+0.5q$。

### 关联节点

- **通路增益**（入边，关系：组成部分属于）
- **信号流图**（出边，关系：适用于）
- **信号流图通路**（无向，关系：相关）
